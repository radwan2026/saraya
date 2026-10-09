import { EventEmitter } from 'node:events';
import { toLatinDigits } from './game.js';

// مراحل لعبة «حرب الفرق»
export const BPhase = Object.freeze({
  LOBBY: 'lobby',   // اختيار الفرق + عد تنازلي
  BATTLE: 'battle', // المعركة: التعليقات واللايكات والهدايا تجمع النقاط
  WINNER: 'winner', // شاشة الفريق الفائز
});

/**
 * يستخرج رقم الفريق من تعليق: رقم الفريق، أو رمزه (🦁)، أو اسمه (الأسود / فريق الأسود).
 * @returns {number|null}
 */
export function parseTeamComment(text, teams) {
  if (typeof text !== 'string') return null;
  const t = toLatinDigits(text).trim().replace(/^#\s*/, '').replace(/\s+/g, ' ');
  if (!t) return null;
  if (/^\d{1,2}$/.test(t)) {
    const n = Number(t);
    return teams.some((x) => x.id === n) ? n : null;
  }
  for (const team of teams) {
    if (t === team.emoji || t === team.name || t === `فريق ${team.name}` || t === `ال${team.name}`) return team.id;
  }
  return null;
}

/** يرتّب الفرق تنازلياً بالنقاط (وعند التعادل الأسبق وصولاً لهذه النقاط) */
export function rankTeams(teams) {
  return [...teams].sort((a, b) => b.points - a.points || a.reachedAt - b.reachedAt || a.id - b.id);
}

export class Battle extends EventEmitter {
  constructor(options, { now = Date.now, manualTick = false } = {}) {
    super();
    this.opt = options;
    this.now = now;
    this.teams = options.teams.map((t) => ({
      id: t.id, name: t.name, emoji: t.emoji, color: t.color,
      points: 0, bank: 0, members: 0, boostUntil: 0, wins: 0, reachedAt: 0,
    }));
    this.users = new Map();
    this.followed = new Set();
    this.round = 0;
    this.history = [];
    this.lastWinner = null;
    this.stateTimer = null;
    this.ticker = manualTick ? null : setInterval(() => this.tick(), 250);
    this.enterLobby();
  }

  // ------------------------------------------------------------------
  // أدوات
  // ------------------------------------------------------------------

  team(id) { return this.teams.find((t) => t.id === id) || null; }

  get remainingMs() {
    return this.phaseEndsAt ? Math.max(0, this.phaseEndsAt - this.now()) : null;
  }

  get isFinal() {
    return this.phase === BPhase.BATTLE && (this.overtime || this.remainingMs <= this.opt.finalSeconds * 1000);
  }

  get leader() {
    const [first, second] = rankTeams(this.teams);
    if (!first || first.points <= 0) return null;
    if (second && second.points === first.points) return null;
    return first;
  }

  /** الفريق الأضعف (الأقل أعضاءً ثم الأقل نقاطاً) — للانضمام التلقائي */
  weakestTeam() {
    return [...this.teams].sort((a, b) => a.members - b.members || a.points - b.points || a.id - b.id)[0];
  }

  multiplierFor(team) {
    let m = 1;
    if (this.isFinal) m *= this.opt.finalMultiplier || 1;
    if (team.boostUntil > this.now()) m *= this.opt.boostMultiplier || 1;
    return m;
  }

  setPhase(phase, seconds) {
    this.phase = phase;
    this.phaseEndsAt = seconds ? this.now() + seconds * 1000 : null;
    this.finalAnnounced = false;
    this.countdownAnnounced = false;
    this.overtime = false;
    this.emit('phase', { phase, round: this.round });
    this.emitState(true);
  }

  // ------------------------------------------------------------------
  // المراحل
  // ------------------------------------------------------------------

  enterLobby() {
    this.setPhase(BPhase.LOBBY, null);
    this.maybeStartCountdown();
  }

  maybeStartCountdown() {
    if (this.phase !== BPhase.LOBBY || !this.opt.autoStart || this.phaseEndsAt) return;
    const members = this.teams.reduce((s, t) => s + t.members, 0);
    if (members >= Math.max(1, this.opt.minPlayers)) {
      this.phaseEndsAt = this.now() + this.opt.lobbySeconds * 1000;
      this.emit('countdown', { seconds: this.opt.lobbySeconds });
      this.emitState(true);
    }
  }

  start() {
    if (this.phase === BPhase.BATTLE) return false;
    this.round += 1;
    const t0 = this.now();
    for (const t of this.teams) {
      t.points = t.bank;
      t.bank = 0;
      t.boostUntil = 0;
      t.reachedAt = t0;
    }
    for (const u of this.users.values()) {
      u.points = u.bank;
      u.bank = 0;
      u.shares = 0;
    }
    this.leaderId = this.leader?.id ?? null;
    this.setPhase(BPhase.BATTLE, this.opt.roundSeconds);
    this.emit('battleStart', { round: this.round });
    // نقاط الهدايا المحفوظة قد تكفي للفوز مباشرة
    for (const t of this.teams) this.checkGoal(t);
    return true;
  }

  finish(reason = 'time') {
    if (this.phase !== BPhase.BATTLE) return;
    const [first, second] = rankTeams(this.teams);
    const tie = second && first.points === second.points;
    if (reason === 'time' && first.points > 0 && tie) {
      this.phaseEndsAt = this.now() + this.opt.overtimeSeconds * 1000;
      this.overtime = true;
      this.countdownAnnounced = false;
      this.emit('overtime', { seconds: this.opt.overtimeSeconds, teams: [first.id, second.id] });
      this.emitState(true);
      return;
    }

    let result = null;
    if (first.points > 0) {
      first.wins += 1;
      const mvp = this.topSupporters(1, first.id)[0] || null;
      result = {
        round: this.round,
        team: this.publicTeam(first),
        mvp,
        reason,
        ranking: rankTeams(this.teams).map((t) => ({ id: t.id, points: t.points })),
        at: this.now(),
      };
      this.history.unshift({ round: this.round, teamId: first.id, points: first.points, mvp: mvp?.nickname || '' });
      this.history = this.history.slice(0, 10);
    }
    this.lastWinner = result;
    this.setPhase(BPhase.WINNER, this.opt.winnerSeconds);
    this.emit('winner', result);
  }

  skip() {
    if (this.phase === BPhase.LOBBY) return this.start();
    if (this.phase === BPhase.BATTLE) { this.finish('skip'); return true; }
    this.enterLobby();
    return true;
  }

  /** لعبة جديدة كلياً: مسح الأعضاء والنقاط والسجل */
  reset() {
    this.users.clear();
    this.followed.clear();
    for (const t of this.teams) Object.assign(t, { points: 0, bank: 0, members: 0, boostUntil: 0, wins: 0 });
    this.round = 0;
    this.history = [];
    this.lastWinner = null;
    this.enterLobby();
  }

  tick() {
    const left = this.remainingMs;
    if (this.phase === BPhase.BATTLE && left !== null) {
      if (!this.overtime && !this.finalAnnounced && left <= this.opt.finalSeconds * 1000 && left > 0) {
        this.finalAnnounced = true;
        this.emit('final', { seconds: Math.round(left / 1000), multiplier: this.opt.finalMultiplier });
        this.emitState(true);
      }
      if (!this.countdownAnnounced && left <= 10_000 && left > 0) {
        this.countdownAnnounced = true;
        this.emit('lastTen', {});
      }
    }
    if (left === 0) {
      if (this.phase === BPhase.LOBBY) {
        const members = this.teams.reduce((s, t) => s + t.members, 0);
        if (members > 0) this.start();
        else { this.phaseEndsAt = null; this.emitState(true); }
      } else if (this.phase === BPhase.BATTLE) {
        this.finish('time');
      } else if (this.phase === BPhase.WINNER) {
        this.enterLobby();
      }
    }
    this.emit('tick');
  }

  // ------------------------------------------------------------------
  // الأعضاء والنقاط
  // ------------------------------------------------------------------

  ensureUser(user) {
    let u = this.users.get(user.id);
    if (!u) {
      u = {
        id: user.id,
        uniqueId: user.uniqueId || user.id,
        nickname: user.nickname || user.uniqueId || 'متابع',
        avatar: user.avatar || '',
        isBot: Boolean(user.isBot),
        team: null,
        points: 0, bank: 0, total: 0, coins: 0, shares: 0,
        lastCommentAt: 0,
      };
      this.users.set(u.id, u);
    } else {
      if (user.avatar) u.avatar = user.avatar;
      if (user.nickname) u.nickname = user.nickname;
    }
    return u;
  }

  join(u, teamId, auto = false) {
    const prev = u.team;
    if (prev === teamId) return 'same';
    if (prev && this.phase === BPhase.BATTLE && !this.opt.allowSwitchDuringBattle) return 'locked';
    if (prev) this.team(prev).members -= 1;
    u.team = teamId;
    this.team(teamId).members += 1;
    this.emit('join', { user: publicUser(u), team: this.publicTeam(this.team(teamId)), auto, switched: Boolean(prev) });
    this.emitState();
    this.maybeStartCountdown();
    return prev ? 'switched' : 'joined';
  }

  /** عضو موجود، أو انضمام تلقائي لأضعف فريق إذا كان مفعّلاً */
  memberFor(user) {
    if (!user || !user.id) return null;
    const u = this.ensureUser(user);
    if (!u.team && this.opt.autoAssign) this.join(u, this.weakestTeam().id, true);
    return u.team ? u : null;
  }

  /**
   * يضيف نقاطاً لفريق العضو. خارج المعركة تُحفظ نقاط الهدايا فقط (bank) لبداية الجولة القادمة.
   * @returns {number} النقاط المضافة فعلياً
   */
  award(u, base, { bankable = false } = {}) {
    if (base <= 0) return 0;
    const team = this.team(u.team);
    if (this.phase !== BPhase.BATTLE) {
      if (!bankable) return 0;
      team.bank += base;
      u.bank += base;
      u.total += base;
      this.emitState();
      return base;
    }
    const pts = Math.round(base * this.multiplierFor(team));
    team.points += pts;
    team.reachedAt = this.now();
    u.points += pts;
    u.total += pts;
    this.afterPoints(team);
    return pts;
  }

  afterPoints(team) {
    const leader = this.leader;
    const id = leader?.id ?? null;
    if (id !== this.leaderId) {
      const prev = this.leaderId;
      this.leaderId = id;
      if (leader) this.emit('leadChange', { team: this.publicTeam(leader), prev });
    }
    this.emitState();
    this.checkGoal(team);
  }

  checkGoal(team) {
    if (this.phase === BPhase.BATTLE && this.opt.goal > 0 && team.points >= this.opt.goal) this.finish('goal');
  }

  /**
   * @returns {'joined'|'switched'|'locked'|'points'|'cooldown'|'ignored'}
   */
  handleComment(user, text) {
    if (!user || !user.id) return 'ignored';
    const teamId = parseTeamComment(text, this.teams);
    const existing = this.users.get(user.id);
    if (teamId && (!existing || existing.team !== teamId)) {
      const u = this.ensureUser(user);
      const r = this.join(u, teamId);
      if (r !== 'locked') return r;
    }
    if (!existing?.team) return 'ignored';
    if (this.phase !== BPhase.BATTLE) return 'ignored';
    const now = this.now();
    if (now - existing.lastCommentAt < this.opt.commentCooldownSeconds * 1000) return 'cooldown';
    existing.lastCommentAt = now;
    this.ensureUser(user);
    this.award(existing, this.opt.commentPoints);
    return teamId && existing.team !== teamId ? 'locked' : 'points';
  }

  handleLike(user, count = 1) {
    const u = this.memberFor(user);
    if (!u) return 0;
    const n = Math.max(1, Math.min(100, Number(count) || 1));
    return this.award(u, n * this.opt.likePoints);
  }

  handleFollow(user) {
    if (!user?.id || this.followed.has(user.id)) return 0;
    this.followed.add(user.id);
    const u = this.memberFor(user);
    if (!u) return 0;
    const pts = this.award(u, this.opt.followPoints, { bankable: true });
    this.emit('follow', { user: publicUser(u), team: this.publicTeam(this.team(u.team)), points: pts });
    return pts;
  }

  handleShare(user) {
    const u = this.memberFor(user);
    if (!u || u.shares >= 3) return 0;
    u.shares += 1;
    const pts = this.award(u, this.opt.sharePoints, { bankable: true });
    this.emit('share', { user: publicUser(u), team: this.publicTeam(this.team(u.team)), points: pts });
    return pts;
  }

  /**
   * @param {{name:string, coins:number, count:number, image?:string}} gift
   */
  handleGift(user, gift) {
    const u = this.memberFor(user);
    if (!u || !gift) return 0;
    const coins = Math.max(0, Number(gift.coins) || 0);
    u.coins += coins;
    const team = this.team(u.team);
    const inBattle = this.phase === BPhase.BATTLE;
    const pts = this.award(u, coins * this.opt.giftPointsPerCoin, { bankable: true });
    this.emit('gift', {
      user: publicUser(u), team: this.publicTeam(team), points: pts, banked: !inBattle,
      gift: { name: gift.name, coins, count: gift.count || 1, image: gift.image || '', emoji: gift.emoji || '' },
    });

    if (inBattle && this.phase === BPhase.BATTLE) {
      if (this.opt.boostCoins > 0 && coins >= this.opt.boostCoins) {
        team.boostUntil = Math.max(team.boostUntil, this.now()) + this.opt.boostSeconds * 1000;
        this.emit('boost', { user: publicUser(u), team: this.publicTeam(team), seconds: this.opt.boostSeconds, multiplier: this.opt.boostMultiplier });
        this.emitState(true);
      }
      if (this.opt.bombCoins > 0 && coins >= this.opt.bombCoins) this.bomb(u, team);
    }
    return pts;
  }

  bomb(u, fromTeam) {
    const target = rankTeams(this.teams).find((t) => t.id !== fromTeam.id && t.points > 0);
    if (!target) return;
    const loss = Math.floor(target.points * (this.opt.bombPercent / 100));
    if (loss <= 0) return;
    target.points -= loss;
    this.emit('bomb', { user: publicUser(u), team: this.publicTeam(fromTeam), target: this.publicTeam(target), loss });
    this.afterPoints(target);
  }

  // ------------------------------------------------------------------
  // الحالة
  // ------------------------------------------------------------------

  topSupporters(n = 6, teamId = null) {
    const list = [];
    for (const u of this.users.values()) {
      if (!u.team || u.points + u.bank <= 0) continue;
      if (teamId && u.team !== teamId) continue;
      list.push(u);
    }
    list.sort((a, b) => (b.points + b.bank) - (a.points + a.bank));
    return list.slice(0, n).map((u) => ({ ...publicUser(u), points: u.points + u.bank }));
  }

  topGifters(n = 3) {
    return [...this.users.values()].filter((u) => u.coins > 0)
      .sort((a, b) => b.coins - a.coins).slice(0, n)
      .map((u) => ({ ...publicUser(u), coins: u.coins }));
  }

  publicTeam(t) {
    return { id: t.id, name: t.name, emoji: t.emoji, color: t.color };
  }

  snapshot() {
    const now = this.now();
    const o = this.opt;
    return {
      phase: this.phase,
      phaseEndsAt: this.phaseEndsAt,
      serverNow: now,
      round: this.round,
      goal: o.goal,
      final: this.isFinal,
      overtime: this.overtime,
      leaderId: this.leader?.id ?? null,
      teams: this.teams.map((t) => ({
        ...this.publicTeam(t), points: t.points, bank: t.bank, members: t.members, wins: t.wins,
        boostUntil: t.boostUntil > now ? t.boostUntil : 0,
      })),
      totalMembers: this.teams.reduce((s, t) => s + t.members, 0),
      top: this.topSupporters(6),
      gifters: this.topGifters(3),
      lastWinner: this.lastWinner,
      history: this.history,
      rules: {
        commentPoints: o.commentPoints, likePoints: o.likePoints, followPoints: o.followPoints,
        sharePoints: o.sharePoints, giftPointsPerCoin: o.giftPointsPerCoin,
        boostCoins: o.boostCoins, boostMultiplier: o.boostMultiplier, boostSeconds: o.boostSeconds,
        bombCoins: o.bombCoins, bombPercent: o.bombPercent,
        roundSeconds: o.roundSeconds, finalSeconds: o.finalSeconds, finalMultiplier: o.finalMultiplier,
      },
    };
  }

  /** إرسال الحالة مع تجميع التحديثات السريعة (اللايكات تصل بكثافة) */
  emitState(immediate = false) {
    if (immediate) {
      if (this.stateTimer) clearTimeout(this.stateTimer);
      this.stateTimer = null;
      this.emit('state', this.snapshot());
      return;
    }
    if (this.stateTimer) return;
    this.stateTimer = setTimeout(() => {
      this.stateTimer = null;
      this.emit('state', this.snapshot());
    }, 150);
  }

  destroy() {
    if (this.ticker) clearInterval(this.ticker);
    if (this.stateTimer) clearTimeout(this.stateTimer);
    this.removeAllListeners();
  }
}

function publicUser(u) {
  return { id: u.id, uniqueId: u.uniqueId, nickname: u.nickname, avatar: u.avatar, team: u.team };
}
