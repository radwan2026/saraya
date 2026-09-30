import { EventEmitter } from 'node:events';

// ===============================================================
//  لعبة «حصار المفاعل» — منطق اللعبة (الخادم هو المرجع الوحيد للحالة)
//
//  المفاعل (core) يتحرك على محور من -100 إلى +100:
//    +100 = قاعدة الفريق الأحمر دُمّرت  => فوز الأزرق
//    -100 = قاعدة الفريق الأزرق دُمّرت  => فوز الأحمر
//  طاقة كل فريق = المسافة المتبقية بين المفاعل وقاعدة خصمه (مجموعهما 100%).
// ===============================================================

export const Phase = Object.freeze({
  COUNTDOWN: 'countdown', // عد تنازلي قبل الجولة
  BATTLE: 'battle',       // المعركة
  VICTORY: 'victory',     // شاشة الفوز
});

export const TEAMS = ['blue', 'red'];
export const SIGN = { blue: 1, red: -1 };
export const other = (team) => (team === 'blue' ? 'red' : 'blue');

const DIGITS = { '٠': 0, '١': 1, '٢': 2, '٣': 3, '٤': 4, '٥': 5, '٦': 6, '٧': 7, '٨': 8, '٩': 9,
  '۰': 0, '۱': 1, '۲': 2, '۳': 3, '۴': 4, '۵': 5, '۶': 6, '۷': 7, '۸': 8, '۹': 9 };

/**
 * يقرأ اختيار الفريق من تعليق: "1" أو "2" (بالأرقام العربية أيضاً) أو اسم اللون.
 * @returns {'blue'|'red'|null}
 */
export function parseTeam(text) {
  if (typeof text !== 'string') return null;
  const t = text.replace(/[٠-٩۰-۹]/g, (d) => String(DIGITS[d])).trim().replace(/^#\s*/, '').toLowerCase();
  if (t === '1' || /^(أزرق|ازرق|الأزرق|الازرق|blue)$/.test(t)) return 'blue';
  if (t === '2' || /^(أحمر|احمر|الأحمر|الاحمر|red)$/.test(t)) return 'red';
  return null;
}

/**
 * يحدد تأثير الهدية: laser | mines | emp | overload
 * الأسماء في giftOverrides لها الأولوية، وإلا يُحدَّد حسب قيمة الهدية بالعملات.
 */
export function classifyGift(gift, { tiers, giftOverrides = {} }) {
  const byName = giftOverrides[gift.name] || giftOverrides[String(gift.name || '').toLowerCase()];
  if (byName) return byName;
  const coins = Number(gift.diamonds) || 0;
  if (coins >= tiers.overload) return 'overload';
  if (coins >= tiers.emp) return 'emp';
  if (coins >= tiers.mines) return 'mines';
  return 'laser';
}

export class ReactorGame extends EventEmitter {
  constructor(options, { now = Date.now } = {}) {
    super();
    this.opt = options;
    this.now = now;
    this.loop = null;
    this.members = new Map();
    this.commander = null;
    this.history = [];
    this.round = 0;
    this.pending = [];
    this.newRound();
  }

  // ------------------------------------------------------------------
  // دورة الحياة
  // ------------------------------------------------------------------

  /** يبدأ حلقة التحديث (10 مرات في الثانية) */
  start(hz = 10) {
    if (this.loop) return;
    this.lastTick = this.now();
    this.loop = setInterval(() => this.tick(), 1000 / hz);
  }

  destroy() {
    if (this.loop) clearInterval(this.loop);
    this.loop = null;
    this.removeAllListeners();
  }

  newRound() {
    this.round += 1;
    this.core = 0;
    this.winner = null;
    this.mines = [];
    this.teams = Object.fromEntries(TEAMS.map((t) => [t, { shield: 0, jamUntil: 0, likes: 0, coins: 0, gifts: 0 }]));
    if (!this.opt.keepTeamsBetweenRounds) this.members.clear();
    for (const m of this.members.values()) { m.roundCoins = 0; m.roundLikes = 0; }
    this.rosterDirty = true;
    this.setPhase(Phase.COUNTDOWN, this.opt.countdownSeconds);
    this.emit('round', { round: this.round });
  }

  setPhase(phase, seconds) {
    this.phase = phase;
    this.phaseEndsAt = seconds ? this.now() + seconds * 1000 : null;
    this.emit('phase', { phase, phaseEndsAt: this.phaseEndsAt, round: this.round });
    this.emit('state', this.snapshot());
    if (phase === Phase.BATTLE) this.flushPending();
  }

  /** تحديث دوري: تلاشي الدروع، تفجير الألغام، انتهاء الوقت */
  tick(now = this.now()) {
    const dt = Math.min(1, Math.max(0, (now - (this.lastTick ?? now)) / 1000));
    this.lastTick = now;

    if (this.phase === Phase.BATTLE) {
      for (const t of TEAMS) {
        const team = this.teams[t];
        team.shield = Math.max(0, team.shield - this.opt.shieldDecayPerSec * dt);
      }
      this.detonateMines(now);
    }

    if (this.phaseEndsAt && now >= this.phaseEndsAt) {
      if (this.phase === Phase.COUNTDOWN) this.setPhase(Phase.BATTLE, this.opt.battleSeconds);
      else if (this.phase === Phase.BATTLE) this.finish(this.core > 0 ? 'blue' : this.core < 0 ? 'red' : null, 'time');
      else if (this.phase === Phase.VICTORY) this.newRound();
    }

    if (this.rosterDirty) {
      this.rosterDirty = false;
      this.emit('roster', this.roster());
    }
    this.emit('tick', this.tickState(now));
  }

  /** إنهاء الجولة */
  finish(winner, reason) {
    if (this.phase !== Phase.BATTLE) return;
    this.mines = [];
    const mvp = winner ? this.topMembers(winner, 1)[0] || null : null;
    this.winner = {
      team: winner,
      reason, // destroyed | time | admin
      mvp,
      core: this.core,
      stats: Object.fromEntries(TEAMS.map((t) => [t, { ...this.teams[t], members: this.countTeam(t) }])),
    };
    this.history.unshift({ round: this.round, team: winner, reason, mvp: mvp && { nickname: mvp.nickname, avatar: mvp.avatar }, at: this.now() });
    this.history = this.history.slice(0, 10);
    this.emit('victory', this.winner);
    this.setPhase(Phase.VICTORY, this.opt.victorySeconds);
  }

  // ------------------------------------------------------------------
  // الأعضاء
  // ------------------------------------------------------------------

  countTeam(team) {
    let n = 0;
    for (const m of this.members.values()) if (m.team === team) n++;
    return n;
  }

  smallerTeam() {
    const b = this.countTeam('blue');
    const r = this.countTeam('red');
    if (b !== r) return b < r ? 'blue' : 'red';
    // عند التعادل: الفريق الخاسر حالياً يحصل على الدعم
    return this.core > 0 ? 'red' : 'blue';
  }

  /**
   * انضمام أو تبديل فريق
   * @returns {'joined'|'switched'|'same'|'locked'|'ignored'}
   */
  join(user, team) {
    if (!user?.id || !TEAMS.includes(team)) return 'ignored';
    const existing = this.members.get(user.id);
    if (existing) {
      if (user.avatar) existing.avatar = user.avatar;
      if (user.nickname) existing.nickname = user.nickname;
      if (existing.team === team) return 'same';
      if (this.phase === Phase.BATTLE && !this.opt.allowSwitchDuringBattle) return 'locked';
      existing.team = team;
      this.rosterDirty = true;
      this.emit('fx', { type: 'join', team, user: pub(existing), switched: true });
      return 'switched';
    }
    const m = {
      id: user.id,
      uniqueId: user.uniqueId || user.id,
      nickname: user.nickname || user.uniqueId || 'جندي',
      avatar: user.avatar || '',
      isBot: Boolean(user.isBot),
      team,
      order: this.members.size + 1,
      totalCoins: 0,
      roundCoins: 0,
      roundLikes: 0,
    };
    this.members.set(m.id, m);
    this.rosterDirty = true;
    this.emit('fx', { type: 'join', team, user: pub(m) });
    return 'joined';
  }

  /** يعيد العضو، أو يضيفه تلقائياً للفريق الأقل عدداً إذا كان التفعيل التلقائي مسموحاً */
  memberFor(user) {
    if (!user?.id) return null;
    const m = this.members.get(user.id);
    if (m) {
      if (user.avatar && !m.avatar) m.avatar = user.avatar;
      return m;
    }
    if (!this.opt.autoAssign) return null;
    this.join(user, this.smallerTeam());
    return this.members.get(user.id) || null;
  }

  // ------------------------------------------------------------------
  // أحداث البث
  // ------------------------------------------------------------------

  handleComment(user, text) {
    const team = parseTeam(text);
    if (!team) return 'ignored';
    return this.join(user, team);
  }

  /** التكبيس: يشحن درع قاعدة الفريق (ودفعة صغيرة جداً للمفاعل) */
  handleLike(user, count = 1) {
    if (this.phase !== Phase.BATTLE) return 'ignored';
    const m = this.memberFor(user);
    if (!m) return 'ignored';
    const n = Math.max(1, Math.min(1000, Number(count) || 1));
    const team = this.teams[m.team];
    team.likes += n;
    m.roundLikes += n;
    const jammed = team.jamUntil > this.now();
    if (!jammed) team.shield = Math.min(this.opt.shieldMax, team.shield + this.opt.likeShield * n);
    this.move(m.team, this.opt.likePush * n);
    this.emit('fx', { type: 'like', team: m.team, user: pub(m), count: n, jammed });
    return jammed ? 'jammed' : 'shield';
  }

  /**
   * الهدايا
   * @param gift {{name:string, diamonds:number}}
   * @param count عدد الهدايا الجديدة (بعد حساب سلاسل الكومبو)
   */
  handleGift(user, gift, count = 1) {
    const m = this.memberFor(user);
    if (!m) return 'ignored';
    const n = Math.max(1, Number(count) || 1);
    const unit = Math.max(1, Number(gift.diamonds) || 1);
    const coins = unit * n;
    const kind = classifyGift(gift, this.opt);
    m.totalCoins += coins;
    m.roundCoins += coins;
    this.rosterDirty = true;

    const action = { kind, memberId: m.id, team: m.team, gift: { name: gift.name, diamonds: unit, image: gift.image || '' }, count: n, coins };
    // اللقب يُحسم قبل عرض الأنيميشن حتى تعرف الواجهة أن الداعم أصبح «قائد الأسطول»
    action.commander = kind === 'overload' && this.checkCommander(m, action.gift);
    if (this.phase === Phase.BATTLE) this.applyGift(action);
    else {
      // الهدايا بين الجولات لا تضيع: تُنفَّذ فور بدء المعركة التالية
      this.pending.push(action);
      this.emit('fx', { type: 'queued', team: m.team, user: pub(m), gift: action.gift, count: n, kind });
    }
    return kind;
  }

  flushPending() {
    const list = this.pending;
    this.pending = [];
    for (const a of list) {
      const m = this.members.get(a.memberId);
      if (!m) continue;
      this.applyGift({ ...a, team: m.team });
    }
  }

  applyGift(action) {
    const m = this.members.get(action.memberId);
    if (!m || this.phase !== Phase.BATTLE) return;
    const { kind, count, coins } = action;
    const team = this.teams[m.team];
    team.coins += coins;
    team.gifts += count;
    const enemyTeam = other(m.team);
    const enemy = this.teams[enemyTeam];
    const base = { team: m.team, user: pub(m), gift: action.gift, count, coins, kind };

    if (kind === 'laser') {
      const r = this.push(m.team, this.opt.laserPushPerCoin * coins);
      this.emit('fx', { type: 'laser', ...base, ...r });
    } else if (kind === 'mines') {
      const { seconds, blasts, push } = this.opt.mines;
      const now = this.now();
      const total = blasts * count;
      for (let i = 0; i < total; i++) {
        this.mines.push({ team: m.team, at: now + ((i + 1) * seconds * 1000) / (total + 1), push: push / blasts, by: m.id });
      }
      this.emit('fx', { type: 'mines', ...base, blasts: total, seconds });
    } else if (kind === 'emp') {
      const { seconds, push } = this.opt.emp;
      const now = this.now();
      enemy.shield = 0;
      enemy.jamUntil = Math.max(enemy.jamUntil, now) + seconds * 1000 * count;
      const r = this.push(m.team, push * count, { ignoreShield: true });
      this.emit('fx', { type: 'emp', ...base, target: enemyTeam, jamUntil: enemy.jamUntil, ...r });
    } else if (kind === 'overload') {
      const before = this.core;
      enemy.shield = 0;
      for (let i = 0; i < count && this.phase === Phase.BATTLE; i++) {
        const remaining = 100 - SIGN[m.team] * this.core; // طاقة الخصم ×2
        this.move(m.team, Math.max(remaining / 2, this.opt.overload.minPush));
      }
      this.emit('fx', { type: 'overload', ...base, target: enemyTeam, commander: Boolean(action.commander), moved: Math.abs(this.core - before) });
    }
    this.checkWin();
  }

  detonateMines(now) {
    if (!this.mines.length) return;
    const due = this.mines.filter((x) => x.at <= now);
    if (!due.length) return;
    this.mines = this.mines.filter((x) => x.at > now);
    for (const mine of due) {
      if (this.phase !== Phase.BATTLE) break;
      const r = this.push(mine.team, mine.push);
      this.emit('fx', { type: 'mineBlast', team: mine.team, ...r });
    }
    this.checkWin();
  }

  /** دفع المفاعل نحو قاعدة الخصم مع احتساب درعه */
  push(team, amount, { ignoreShield = false } = {}) {
    const enemy = this.teams[other(team)];
    let effective = amount;
    if (!ignoreShield && enemy.shield > 0) {
      const ratio = enemy.shield / this.opt.shieldMax;
      effective = amount * (1 - this.opt.shieldBlock * ratio);
      enemy.shield = Math.max(0, enemy.shield - amount * this.opt.shieldErosion);
    }
    this.move(team, effective);
    return { pushed: effective, blocked: amount - effective };
  }

  move(team, amount) {
    if (this.phase !== Phase.BATTLE) return;
    this.core = Math.max(-100, Math.min(100, this.core + SIGN[team] * amount));
    this.checkWin();
  }

  checkWin() {
    if (this.phase !== Phase.BATTLE) return;
    if (this.core >= 100) this.finish('blue', 'destroyed');
    else if (this.core <= -100) this.finish('red', 'destroyed');
  }

  /** «قائد الأسطول»: يُثبَّت صاحب الهدية الكبرى حتى يتفوق عليه داعم آخر بمجموع دعمه */
  checkCommander(m, gift) {
    const cur = this.commander;
    const curCoins = cur ? (this.members.get(cur.id)?.totalCoins ?? cur.coins) : -1;
    if (cur && cur.id !== m.id && m.totalCoins <= curCoins) return false;
    const previous = cur && cur.id !== m.id ? cur : null;
    this.commander = { ...pub(m), coins: m.totalCoins, gift: gift.name, since: this.now() };
    this.emit('commander', { commander: this.commander, previous });
    return true;
  }

  // ------------------------------------------------------------------
  // أوامر لوحة التحكم
  // ------------------------------------------------------------------

  /** جولة جديدة فوراً */
  restartRound() {
    this.pending = [];
    this.newRound();
  }

  /** تخطي المرحلة الحالية */
  skip() {
    if (this.phase === Phase.COUNTDOWN) this.setPhase(Phase.BATTLE, this.opt.battleSeconds);
    else if (this.phase === Phase.BATTLE) this.finish(this.core > 0 ? 'blue' : this.core < 0 ? 'red' : null, 'admin');
    else this.newRound();
  }

  /** مسح كل شيء: الأعضاء، القائد، السجل */
  resetSession() {
    this.members.clear();
    this.commander = null;
    this.history = [];
    this.pending = [];
    this.round = 0;
    this.emit('commander', { commander: null, previous: null });
    this.newRound();
  }

  // ------------------------------------------------------------------
  // اللقطات المرسلة للواجهة
  // ------------------------------------------------------------------

  topMembers(team, n = 3) {
    return [...this.members.values()]
      .filter((m) => m.team === team && (m.roundCoins > 0 || m.roundLikes > 0))
      .sort((a, b) => b.roundCoins - a.roundCoins || b.roundLikes - a.roundLikes || a.order - b.order)
      .slice(0, n)
      .map(pub);
  }

  roster(limit = 120) {
    const out = {};
    for (const t of TEAMS) {
      const list = [...this.members.values()].filter((m) => m.team === t);
      // الأحدث انضماماً أولاً لكن الداعمون دائماً في المقدمة
      list.sort((a, b) => b.roundCoins - a.roundCoins || b.order - a.order);
      out[t] = { count: list.length, members: list.slice(0, limit).map(pub), top: this.topMembers(t, 3) };
    }
    return out;
  }

  tickState(now = this.now()) {
    return {
      phase: this.phase,
      phaseEndsAt: this.phaseEndsAt,
      serverNow: now,
      round: this.round,
      core: round2(this.core),
      teams: Object.fromEntries(TEAMS.map((t) => {
        const x = this.teams[t];
        return [t, {
          energy: round2((100 + SIGN[t] * this.core) / 2),
          shield: round2(x.shield),
          jammedMs: Math.max(0, x.jamUntil - now),
          likes: x.likes,
          coins: x.coins,
          mines: this.mines.filter((m) => m.team === t).length,
        }];
      })),
    };
  }

  snapshot() {
    return {
      ...this.tickState(),
      roster: this.roster(),
      commander: this.commander,
      winner: this.winner,
      history: this.history,
      battleSeconds: this.opt.battleSeconds,
    };
  }
}

const round2 = (x) => Math.round(x * 100) / 100;

function pub(m) {
  return {
    id: m.id,
    uniqueId: m.uniqueId,
    nickname: m.nickname,
    avatar: m.avatar,
    team: m.team,
    isBot: m.isBot,
    roundCoins: m.roundCoins,
    roundLikes: m.roundLikes,
    totalCoins: m.totalCoins,
  };
}
