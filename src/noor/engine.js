import { EventEmitter } from 'node:events';
import { TEAMS, DHIKR, QUIZ, WISDOM, giftKind } from './content.js';

export const Phase = Object.freeze({
  PAUSED: 'paused',   // متوقفة من لوحة التحكم
  PLAYING: 'playing', // جولة جارية: الفرق تتنافس على إضاءة المنارات
  VICTORY: 'victory', // منارة أُضيئت بالكامل: شاشة الفوز
});

const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

/** يزيل التشكيل والتطويل ويوحّد أشكال الحروف حتى تتطابق الأذكار مهما كُتبت */
export function normalizeArabic(text) {
  return String(text || '')
    .replace(/[ً-ٰٟـ]/g, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

/** يعيد رقم الفريق (0..n-1) إن كان التعليق انضماماً لفريق: رقم وحده أو اسم الفريق */
export function parseTeamComment(text, teams = TEAMS) {
  const t = normalizeArabic(text).replace(/^#/, '').trim();
  const m = t.match(/^(\d)$/);
  if (m) {
    const i = Number(m[1]) - 1;
    return i >= 0 && i < teams.length ? i : null;
  }
  for (let i = 0; i < teams.length; i++) {
    const name = normalizeArabic(teams[i].name);
    const bare = name.replace(/^ال/, '');
    if (t === name || t === bare || t === `فريق ${name}` || t === `فريق ${bare}`) return i;
  }
  return null;
}

/** يعيد مفتاح الذكر الموجود في التعليق أو null */
export function parseDhikr(text) {
  const t = normalizeArabic(text);
  if (!t) return null;
  for (const d of DHIKR) {
    if (d.patterns.some((p) => t.includes(normalizeArabic(p)))) return d.key;
  }
  return null;
}

const ANSWER_LETTERS = [['ا', 'a'], ['ب', 'b'], ['ج', 'c'], ['د', 'd']];
/** يعيد رقم الخيار (0..3) من إجابة مثل «أ» أو «ب» أو «C» */
export function parseQuizAnswer(text) {
  const t = normalizeArabic(text).replace(/[.)\]!؟?]/g, '').trim();
  if (t.length !== 1) return null;
  const i = ANSWER_LETTERS.findIndex((alts) => alts.includes(t));
  return i >= 0 ? i : null;
}

function shuffleQuestion(item, random) {
  const order = [0, 1, 2, 3].sort(() => random() - 0.5);
  return { q: item.q, options: order.map((i) => item.o[i]), answer: order.indexOf(item.a) };
}

/**
 * محرك اللعبة. كل التفاعلات تمر من هنا ويُصدر:
 *  'state' (عند كل تغيير)، 'fx' (حدث بصري: هدية، ذكر، انضمام...)، 'log' (للوحة التحكم)
 */
export class NoorEngine extends EventEmitter {
  constructor(settings, { random = Math.random, now = Date.now } = {}) {
    super();
    this.random = random;
    this.now = now;
    this.s = settings;
    this.timers = {};
    this.users = new Map(); // كل المشاركين في الجلسة
    this.history = [];
    this.round = 0;
    this.session = { coins: 0, gifts: 0, dhikr: 0, likes: 0, followers: 0, shares: 0 };
    this.dhikrCounts = Object.fromEntries(DHIKR.map((d) => [d.key, 0]));
    this.tasbeeh = 0; // حبات المسبحة (0..32)
    this.quiz = null;
    this.quizPool = [];
    this.wisdomIndex = 0;
    this.likeBucket = 0;
    this.phase = Phase.PAUSED;
    this.teams = [];
    this.applyTeamNames();
    if (settings.autoStart !== false) this.newRound();
    else this.resetTeams();
    this.timers.wisdom = setInterval(() => this.nextWisdom(), (settings.wisdomSeconds || 20) * 1000);
  }

  // ------------------------------------------------------------------
  // الإعدادات والفرق
  // ------------------------------------------------------------------

  applyTeamNames() {
    const names = this.s.teamNames || [];
    this.teamDefs = TEAMS.map((t, i) => ({ ...t, name: names[i] || t.name }));
    for (const t of this.teams) {
      const def = this.teamDefs.find((d) => d.id === t.id);
      if (def) Object.assign(t, { name: def.name });
    }
  }

  updateSettings(patch) {
    this.s = { ...this.s, ...patch };
    this.applyTeamNames();
    if (this.round > 0 && this.phase === Phase.PLAYING && !this.finishing && patch.roundSeconds) {
      this.endsAt = this.roundStartedAt + this.s.roundSeconds * 1000;
      this.armRoundTimer();
    }
    if (patch.wisdomSeconds) {
      clearInterval(this.timers.wisdom);
      this.timers.wisdom = setInterval(() => this.nextWisdom(), this.s.wisdomSeconds * 1000);
    }
    this.changed();
  }

  resetTeams() {
    this.teams = this.teamDefs.map((t) => ({
      ...t, light: 0, members: 0, boostUntil: 0, roses: 0, lanterns: 0, contributors: {},
    }));
    for (const u of this.users.values()) { u.team = null; u.roundPoints = 0; }
  }

  // ------------------------------------------------------------------
  // دورة الجولات
  // ------------------------------------------------------------------

  newRound() {
    this.clear('round', 'victory', 'quiz', 'quizNext');
    this.quiz = null;
    this.round += 1;
    this.resetTeams();
    this.winner = null;
    this.finishing = false;
    this.phase = Phase.PLAYING;
    this.roundStartedAt = this.now();
    this.endsAt = this.roundStartedAt + this.s.roundSeconds * 1000;
    this.armRoundTimer();
    this.scheduleQuiz();
    this.fx('roundStart', { round: this.round });
    this.log(`بدأت الجولة ${this.round}`);
    this.changed();
  }

  armRoundTimer() {
    this.clear('round');
    const ms = Math.max(0, this.endsAt - this.now());
    this.timers.round = setTimeout(() => this.finishRound('time'), ms);
  }

  /** إنهاء الجولة وإعلان الفريق الأعلى نوراً */
  finishRound(reason = 'manual') {
    if (this.phase !== Phase.PLAYING) return false;
    this.clear('round', 'quiz', 'quizNext');
    this.finishing = false;
    this.quiz = null;
    const ranked = [...this.teams].sort((a, b) => b.light - a.light);
    const best = ranked[0];
    this.phase = Phase.VICTORY;
    if (best && best.light > 0) {
      const top = Object.entries(best.contributors)
        .sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([id, points]) => ({ ...publicUser(this.users.get(id)), points: Math.round(points) }));
      this.winner = { teamId: best.id, name: best.name, color: best.color, light: Math.round(best.light), reason, top };
      this.history.unshift({ round: this.round, team: best.name, color: best.color, light: Math.round(best.light), mvp: top[0]?.nickname || '', at: this.now() });
      this.history = this.history.slice(0, 12);
      this.log(`🏆 فاز فريق ${best.name} بالجولة ${this.round}`);
    } else {
      this.winner = null;
      this.log(`انتهت الجولة ${this.round} بدون مشاركة`);
    }
    this.victoryEndsAt = this.now() + this.s.victorySeconds * 1000;
    this.fx('victory', { winner: this.winner, round: this.round });
    this.timers.victory = setTimeout(() => {
      if (this.s.autoStart !== false) this.newRound();
      else { this.phase = Phase.PAUSED; this.changed(); }
    }, this.s.victorySeconds * 1000);
    this.changed();
    return true;
  }

  pause() {
    if (this.finishing) return;
    this.clear('round', 'victory', 'quiz', 'quizNext');
    this.quiz = null;
    this.pausedLeft = this.phase === Phase.PLAYING ? Math.max(0, this.endsAt - this.now()) : null;
    this.phase = Phase.PAUSED;
    this.log('تم إيقاف اللعبة مؤقتاً');
    this.changed();
  }

  resume() {
    if (this.phase !== Phase.PAUSED) return;
    if (this.pausedLeft) {
      this.phase = Phase.PLAYING;
      this.endsAt = this.now() + this.pausedLeft;
      this.roundStartedAt = this.endsAt - this.s.roundSeconds * 1000;
      this.pausedLeft = null;
      this.armRoundTimer();
      this.scheduleQuiz();
      this.log('استُؤنفت اللعبة');
      this.changed();
    } else {
      this.newRound();
    }
  }

  /** مسح كل شيء: الفرق، الداعمون، العدادات */
  resetSession() {
    this.users.clear();
    this.history = [];
    this.round = 0;
    this.session = { coins: 0, gifts: 0, dhikr: 0, likes: 0, followers: 0, shares: 0 };
    this.dhikrCounts = Object.fromEntries(DHIKR.map((d) => [d.key, 0]));
    this.tasbeeh = 0;
    this.newRound();
  }

  // ------------------------------------------------------------------
  // المستخدمون والفرق
  // ------------------------------------------------------------------

  user(u) {
    if (!u || !u.id) return null;
    let user = this.users.get(u.id);
    if (!user) {
      user = { id: u.id, uniqueId: u.uniqueId || u.id, nickname: u.nickname || u.uniqueId || 'ضيف', avatar: u.avatar || '',
        team: null, coins: 0, gifts: 0, roundPoints: 0, dhikr: 0, correct: 0, lastDhikrAt: -Infinity, isBot: Boolean(u.isBot) };
      this.users.set(u.id, user);
    } else {
      if (u.nickname) user.nickname = u.nickname;
      if (u.avatar) user.avatar = u.avatar;
    }
    return user;
  }

  teamIndex(id) { return this.teams.findIndex((t) => t.id === id); }

  joinTeam(user, index, auto = false) {
    const team = this.teams[index];
    if (!team) return false;
    if (user.team === team.id) return false;
    if (user.team) {
      const old = this.teams[this.teamIndex(user.team)];
      if (old) old.members = Math.max(0, old.members - 1);
    }
    user.team = team.id;
    team.members += 1;
    this.fx('join', { user: publicUser(user), team: team.id, auto });
    return true;
  }

  /** يضمّ المستخدم تلقائياً لأقل الفرق عدداً إن لم يكن في فريق (للهدايا والإجابات) */
  ensureTeam(user) {
    if (user.team && this.teamIndex(user.team) >= 0) return this.teams[this.teamIndex(user.team)];
    let best = 0;
    for (let i = 1; i < this.teams.length; i++) {
      const a = this.teams[i]; const b = this.teams[best];
      if (a.members < b.members || (a.members === b.members && a.light < b.light)) best = i;
    }
    this.joinTeam(user, best, true);
    return this.teams[best];
  }

  /** يضيف نوراً لفريق المستخدم ويُنهي الجولة إن بلغت المنارة الهدف */
  addLight(user, amount) {
    if (this.phase !== Phase.PLAYING || this.finishing || !(amount > 0)) return 0;
    const team = this.ensureTeam(user);
    const boosted = team.boostUntil > this.now();
    // لا يتجاوز النور هدف المنارة حتى تبقى نقاط الداعمين متسقة مع مجموع الفريق
    const gained = Math.min(amount * (boosted ? this.s.boostMultiplier : 1), this.s.target - team.light);
    team.light += gained;
    team.contributors[user.id] = (team.contributors[user.id] || 0) + gained;
    user.roundPoints += gained;
    if (team.light >= this.s.target) {
      // نؤجّل الإنهاء قليلاً حتى يظهر تأثير الهدية التي أكملت المنارة
      this.finishing = true;
      this.timers.round && clearTimeout(this.timers.round);
      this.timers.round = setTimeout(() => this.finishRound('target'), this.s.finishDelayMs);
    }
    return gained;
  }

  // ------------------------------------------------------------------
  // أحداث البث
  // ------------------------------------------------------------------

  /** تعليق: انضمام لفريق، أو إجابة سؤال، أو ذكر */
  handleComment(u, text) {
    const user = this.user(u);
    if (!user) return 'ignored';

    if (this.quiz && !this.quiz.revealed) {
      const choice = parseQuizAnswer(text);
      if (choice !== null) {
        if (this.quiz.answers.has(user.id)) return 'ignored';
        this.quiz.answers.set(user.id, { choice, at: this.now() });
        this.quiz.counts[choice] += 1;
        this.changed();
        return 'answer';
      }
    }

    const teamIdx = parseTeamComment(text, this.teams);
    if (teamIdx !== null) {
      const ok = this.joinTeam(user, teamIdx);
      if (ok) { this.changed(); return 'joined'; }
      return 'ignored';
    }

    const dhikr = parseDhikr(text);
    if (dhikr) {
      const t = this.now();
      if (t - user.lastDhikrAt < this.s.dhikrCooldownMs) return 'cooldown';
      user.lastDhikrAt = t;
      user.dhikr += 1;
      this.dhikrCounts[dhikr] += 1;
      this.session.dhikr += 1;
      this.tasbeeh += 1;
      let complete = false;
      if (this.tasbeeh >= 33) { this.tasbeeh = 0; complete = true; }
      const def = DHIKR.find((d) => d.key === dhikr);
      if (this.phase === Phase.PLAYING) this.addLight(user, this.s.dhikrLight);
      this.fx('dhikr', { user: publicUser(user), key: dhikr, text: def.text, team: user.team, complete });
      if (complete) this.fx('tasbeeh', { total: this.session.dhikr });
      this.changed();
      return 'dhikr';
    }
    return 'ignored';
  }

  /**
   * هدية. count = عدد الهدايا الجديدة (بعد معالجة السلسلة)
   * @param {{name:string, coins:number, count:number, image?:string, id?:string}} gift
   */
  handleGift(u, gift) {
    const user = this.user(u);
    const count = Math.max(1, Number(gift.count) || 1);
    const coins = Math.max(0, Number(gift.coins) || 0);
    if (!user) return null;
    const total = coins * count;
    user.coins += total;
    user.gifts += count;
    this.session.coins += total;
    this.session.gifts += count;
    const kind = giftKind(gift.name, coins);
    const team = this.ensureTeam(user);

    if (kind === 'rose') team.roses += count;
    if (kind === 'heart') team.lanterns += count;

    const light = Math.max(this.s.minGiftLight, total * this.s.lightPerCoin);
    const gained = this.addLight(user, light);
    // نفحة المسك تبدأ بعد هدية العطر نفسها وتضاعف ما يليها
    if (kind === 'perfume' && this.phase === Phase.PLAYING) {
      const base = Math.max(this.now(), team.boostUntil);
      team.boostUntil = base + this.s.boostSeconds * 1000 * count;
    }
    // تأثير إضافي للهدايا الكبيرة مهما كان نوعها
    const tier = total >= 500 ? 'grand' : total >= 99 ? 'meteor' : null;
    this.fx('gift', { user: publicUser(user), team: team.id, kind, tier, name: gift.name, image: gift.image || '',
      count, coins: total, light: Math.round(gained), boostUntil: team.boostUntil });
    this.log(`🎁 ${user.nickname} أهدى ${gift.name} ×${count} (${total} عملة) → ${team.name}`);
    this.changed();
    return kind;
  }

  handleLike(u, count = 1) {
    const user = this.user(u);
    if (!user) return;
    const n = Math.max(1, Number(count) || 1);
    this.session.likes += n;
    if (this.phase === Phase.PLAYING) this.addLight(user, n * this.s.lightPerLike);
    this.likeBucket += n;
    if (this.likeBucket >= this.s.likesPerStar) {
      const stars = Math.floor(this.likeBucket / this.s.likesPerStar);
      this.likeBucket %= this.s.likesPerStar;
      this.fx('shootingStar', { user: publicUser(user), stars: Math.min(stars, 5) });
    }
    this.changed();
  }

  handleFollow(u) {
    const user = this.user(u);
    if (!user) return;
    this.session.followers += 1;
    this.fx('follow', { user: publicUser(user) });
    this.log(`➕ ${user.nickname} تابع البث`);
    this.changed();
  }

  handleShare(u) {
    const user = this.user(u);
    if (!user) return;
    this.session.shares += 1;
    if (this.phase === Phase.PLAYING) this.addLight(user, this.s.shareLight);
    this.fx('share', { user: publicUser(user), team: user.team });
    this.changed();
  }

  // ------------------------------------------------------------------
  // سؤال النور (مسابقة)
  // ------------------------------------------------------------------

  scheduleQuiz() {
    this.clear('quizNext');
    if (!this.s.quizEnabled || this.phase !== Phase.PLAYING) return;
    this.timers.quizNext = setTimeout(() => this.startQuiz(), this.s.quizEverySeconds * 1000);
  }

  nextQuestion() {
    if (!this.quizPool.length) {
      const bank = [...QUIZ, ...(this.s.extraQuestions || [])];
      this.quizPool = bank.map((_, i) => i).sort(() => this.random() - 0.5);
      this.quizBank = bank;
    }
    return shuffleQuestion(this.quizBank[this.quizPool.pop()], this.random);
  }

  startQuiz() {
    if (this.phase !== Phase.PLAYING || this.finishing) return false;
    this.clear('quiz', 'quizNext');
    const q = this.nextQuestion();
    this.quiz = { id: `${this.round}-${this.now()}`, ...q, startedAt: this.now(),
      endsAt: this.now() + this.s.quizSeconds * 1000, answers: new Map(), counts: [0, 0, 0, 0], revealed: false, winners: [] };
    this.timers.quiz = setTimeout(() => this.endQuiz(), this.s.quizSeconds * 1000);
    this.fx('quizStart', { q: q.q });
    this.log(`❓ سؤال: ${q.q}`);
    this.changed();
    return true;
  }

  endQuiz() {
    const quiz = this.quiz;
    if (!quiz || quiz.revealed) return false;
    this.clear('quiz');
    quiz.revealed = true;
    const correct = [...quiz.answers.entries()]
      .filter(([, a]) => a.choice === quiz.answer)
      .sort((a, b) => a[1].at - b[1].at);
    correct.forEach(([id], i) => {
      const user = this.users.get(id);
      user.correct += 1;
      // الأسرع يحصل على مكافأة أكبر
      const bonus = i === 0 ? 2 : i < 3 ? 1.5 : 1;
      this.addLight(user, this.s.quizLight * bonus);
    });
    quiz.winners = correct.slice(0, 5).map(([id]) => publicUser(this.users.get(id)));
    quiz.correctCount = correct.length;
    this.fx('quizEnd', { answer: quiz.answer, winners: quiz.winners, correctCount: correct.length });
    this.log(`✅ الإجابة: ${quiz.options[quiz.answer]} — أجاب صحيحاً ${correct.length}`);
    this.timers.quiz = setTimeout(() => { this.quiz = null; this.changed(); this.scheduleQuiz(); }, this.s.quizRevealSeconds * 1000);
    this.changed();
    return true;
  }

  // ------------------------------------------------------------------
  // أدوات
  // ------------------------------------------------------------------

  nextWisdom() {
    this.wisdomIndex = (this.wisdomIndex + 1) % WISDOM.length;
    this.changed();
  }

  clear(...names) {
    for (const n of names) {
      if (this.timers[n]) { clearTimeout(this.timers[n]); this.timers[n] = null; }
    }
  }

  fx(type, data) { this.emit('fx', { type, at: this.now(), ...data }); }

  log(message) { this.emit('log', { at: this.now(), message }); }

  changed() { this.emit('state'); }

  topSupporters(n = 5) {
    return [...this.users.values()].filter((u) => u.coins > 0)
      .sort((a, b) => b.coins - a.coins).slice(0, n)
      .map((u) => ({ ...publicUser(u), coins: u.coins }));
  }

  snapshot() {
    const t = this.now();
    const quiz = this.quiz && {
      id: this.quiz.id, q: this.quiz.q, options: this.quiz.options, endsAt: this.quiz.endsAt,
      counts: this.quiz.counts, total: this.quiz.answers.size, revealed: this.quiz.revealed,
      answer: this.quiz.revealed ? this.quiz.answer : null, winners: this.quiz.winners, correctCount: this.quiz.correctCount || 0,
    };
    return {
      phase: this.phase,
      serverNow: t,
      round: this.round,
      endsAt: this.phase === Phase.PLAYING ? this.endsAt : null,
      pausedLeft: this.pausedLeft || null,
      victoryEndsAt: this.phase === Phase.VICTORY ? this.victoryEndsAt : null,
      target: this.s.target,
      boostMultiplier: this.s.boostMultiplier,
      teams: this.teams.map((tm) => {
        const top = Object.entries(tm.contributors).sort((a, b) => b[1] - a[1])[0];
        return {
          id: tm.id, name: tm.name, letter: tm.letter, color: tm.color, glow: tm.glow,
          light: Math.round(tm.light), members: tm.members, roses: tm.roses, lanterns: tm.lanterns,
          boostUntil: tm.boostUntil > t ? tm.boostUntil : 0,
          top: top ? { ...publicUser(this.users.get(top[0])), points: Math.round(top[1]) } : null,
        };
      }),
      quiz,
      winner: this.winner,
      supporters: this.topSupporters(5),
      tasbeeh: this.tasbeeh,
      dhikrCounts: this.dhikrCounts,
      session: this.session,
      history: this.history,
      wisdom: WISDOM[this.wisdomIndex],
      players: this.users.size,
    };
  }

  destroy() {
    for (const k of Object.keys(this.timers)) { clearTimeout(this.timers[k]); clearInterval(this.timers[k]); }
    this.removeAllListeners();
  }
}

export function publicUser(u) {
  if (!u) return null;
  return { id: u.id, uniqueId: u.uniqueId, nickname: u.nickname, avatar: u.avatar, team: u.team };
}
