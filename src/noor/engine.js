import { EventEmitter } from 'node:events';
import { classifyGift, GIFT_EFFECTS } from './gifts.js';
import { parseAnswer, detectDhikr } from './text.js';
import { WISDOM } from './wisdom.js';

export const THEME_COUNT = 4;
const TOP_N = 5;

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const publicUser = (u) => ({ id: u.id, nickname: u.nickname, avatar: u.avatar || '' });

/**
 * منطق «واحة النور»:
 * - كل تفاعل (هدية، إعجاب، ذكر، إجابة صحيحة) يضيف نقاط نور تُضيء المسجد.
 * - عند اكتمال الهدف يُضاء المسجد كاملاً وتبدأ «ليلة» جديدة بهدف أكبر ولون سماء مختلف.
 * - مسابقة أسئلة دينية تلقائية يجيب عنها المتابعون بالتعليق 1-4.
 *
 * الأحداث: 'change' (تغيّرت الحالة)، 'fx' (تأثير بصري)، 'quiz' (تغيّرت مرحلة المسابقة)
 */
export class NoorEngine extends EventEmitter {
  constructor(opt, questions, { now = () => Date.now(), saved = null } = {}) {
    super();
    this.opt = structuredClone(opt);
    this.questions = questions;
    this.now = now;
    this.timers = new Set();
    this.deck = [];
    this.quizTimer = null;
    this.quiz = { phase: 'idle', id: 0, endsAt: 0, duration: 0, card: WISDOM[0] };
    this.wisdomIndex = 0;
    this.challenge = null;
    this.challengeTimer = null;
    this.pendingStars = 0;
    this.starsTimer = null;
    this.likeRemainder = 0;
    this.dhikrAt = new Map();
    this.lastWelcome = 0;
    this.resetAll(saved);
  }

  // ------------------------------------------------------------------
  // الحالة العامة
  // ------------------------------------------------------------------
  resetAll(saved = null) {
    this.level = saved?.level || 1;
    this.goal = saved?.goal || this.opt.firstGoal;
    this.points = saved?.points || 0;
    this.dhikr = saved?.dhikr || 0;
    this.totals = {
      points: 0, gifts: 0, diamonds: 0, flowers: 0, lanterns: 0, fed: 0,
      musk: 0, likes: 0, dhikr: 0, correct: 0, follows: 0, shares: 0,
      ...(saved?.totals || {}),
    };
    this.supporters = new Map((saved?.supporters || []).map((s) => [s.id, s]));
    this.scholars = new Map((saved?.scholars || []).map((s) => [s.id, s]));
    this.levelContrib = new Map();
    this.muskUntil = 0;
    this.changed();
  }

  resetBoard() {
    this.supporters.clear();
    this.scholars.clear();
    this.changed();
  }

  resetLevel() {
    this.level = 1;
    this.goal = this.opt.firstGoal;
    this.points = 0;
    this.levelContrib.clear();
    this.emit('fx', { type: 'reset', theme: 0 });
    this.changed();
  }

  setGoal(goal) {
    const g = Math.max(10, Math.round(Number(goal) || this.goal));
    this.goal = g;
    this.checkLevel();
    this.changed();
  }

  setOptions(patch = {}) {
    for (const [k, v] of Object.entries(patch)) {
      if (k === 'quiz' && v && typeof v === 'object') Object.assign(this.opt.quiz, v);
      else if (k in this.opt && typeof v === typeof this.opt[k]) this.opt[k] = v;
    }
    if (patch.quiz?.categories) this.deck = [];
    this.changed();
  }

  changed() { this.emit('change'); }

  later(ms, fn) {
    const t = setTimeout(() => { this.timers.delete(t); fn(); }, ms);
    this.timers.add(t);
    return t;
  }

  cancel(t) {
    if (!t) return;
    clearTimeout(t);
    this.timers.delete(t);
  }

  destroy() {
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  multiplier() {
    return this.now() < this.muskUntil ? this.opt.muskMultiplier : 1;
  }

  /** يضيف نقاطاً للهدف الجماعي ويعيد النقاط الفعلية بعد المضاعف */
  addPoints(n, user = null) {
    const pts = Math.round(n * this.multiplier());
    if (pts <= 0) return 0;
    this.points += pts;
    this.totals.points += pts;
    if (user?.id) {
      const c = this.levelContrib.get(user.id) || { ...publicUser(user), points: 0 };
      c.points += pts;
      this.levelContrib.set(user.id, c);
    }
    this.checkLevel();
    return pts;
  }

  checkLevel() {
    while (this.points >= this.goal) {
      this.points -= this.goal;
      const top = [...this.levelContrib.values()].sort((a, b) => b.points - a.points).slice(0, 3);
      this.level += 1;
      this.goal = Math.ceil((this.goal * this.opt.goalGrowth) / 50) * 50;
      this.levelContrib.clear();
      this.emit('fx', { type: 'levelUp', level: this.level, theme: (this.level - 1) % THEME_COUNT, top });
    }
  }

  forceLevelUp() {
    this.points = Math.max(this.points, this.goal);
    this.checkLevel();
    this.changed();
  }

  topOf(map, key) {
    return [...map.values()].sort((a, b) => b[key] - a[key]).slice(0, TOP_N);
  }

  snapshot() {
    const now = this.now();
    return {
      level: this.level,
      theme: (this.level - 1) % THEME_COUNT,
      points: this.points,
      goal: this.goal,
      progress: Math.min(1, this.points / this.goal),
      totals: { ...this.totals },
      dhikr: this.dhikr,
      multiplier: this.multiplier(),
      muskIn: Math.max(0, this.muskUntil - now),
      topSupporters: this.topOf(this.supporters, 'points'),
      topScholars: this.topOf(this.scholars, 'score'),
      challenge: this.challenge && {
        target: this.challenge.target,
        count: this.challenge.count,
        endsIn: Math.max(0, this.challenge.endsAt - now),
      },
      quiz: this.quizPublic(),
      quizAuto: this.opt.quiz.auto,
    };
  }

  toJSON() {
    return {
      level: this.level, goal: this.goal, points: this.points, dhikr: this.dhikr, totals: this.totals,
      supporters: [...this.supporters.values()], scholars: [...this.scholars.values()],
    };
  }

  // ------------------------------------------------------------------
  // الهدايا
  // ------------------------------------------------------------------
  /**
   * gift: { id, name, diamonds, image, count } — count هو العدد الجديد فقط (بعد معالجة السلاسل)
   */
  handleGift(user, gift) {
    const count = Math.max(0, Math.floor(gift.count || 0));
    if (!count || !user?.id) return 0;
    const kind = classifyGift(gift.name);
    const info = GIFT_EFFECTS[kind];
    const unitDiamonds = Math.max(0, Number(gift.diamonds) || 0);
    const diamonds = unitDiamonds * count;
    const now = this.now();

    this.totals.gifts += count;
    this.totals.diamonds += diamonds;
    if (kind === 'rose') this.totals.flowers += count;
    if (kind === 'heart') this.totals.lanterns += count;
    if (kind === 'donut') this.totals.fed += count;
    if (kind === 'perfume') {
      this.totals.musk += count;
      const max = now + this.opt.muskMaxSeconds * 1000;
      this.muskUntil = Math.min(max, Math.max(now, this.muskUntil) + this.opt.muskSeconds * 1000 * count);
    }

    const base = Math.max(diamonds, count) * this.opt.pointsPerDiamond;
    const pts = this.addPoints(base, user);

    const s = this.supporters.get(user.id) || { ...publicUser(user), points: 0, diamonds: 0, gifts: 0 };
    Object.assign(s, publicUser(user));
    s.points += pts;
    s.diamonds += diamonds;
    s.gifts += count;
    this.supporters.set(user.id, s);

    this.emit('fx', {
      type: 'gift',
      kind,
      effect: info.effect,
      action: info.action,
      user: publicUser(user),
      gift: { name: gift.name, image: gift.image || '', diamonds: unitDiamonds },
      count,
      points: pts,
      big: diamonds >= this.opt.bigGiftDiamonds,
      muskIn: Math.max(0, this.muskUntil - now),
    });
    this.changed();
    return pts;
  }

  // ------------------------------------------------------------------
  // التعليقات: إجابات المسابقة والأذكار
  // ------------------------------------------------------------------
  handleComment(user, text) {
    if (!user?.id) return 'none';
    if (this.quiz.phase === 'question') {
      const idx = parseAnswer(text);
      if (idx !== null) return this.answer(user, idx);
    }
    const d = detectDhikr(text);
    if (d) return this.handleDhikr(user, d);
    return 'none';
  }

  handleDhikr(user, d) {
    const now = this.now();
    const last = this.dhikrAt.get(user.id) || 0;
    if (now - last < this.opt.dhikrCooldownMs) return 'cooldown';
    this.dhikrAt.set(user.id, now);
    if (this.dhikrAt.size > 5000) this.dhikrAt.clear();

    const before = this.dhikr;
    this.dhikr += d.count;
    this.totals.dhikr += d.count;
    this.addPoints(d.count * this.opt.dhikrPoints, user);
    this.emit('fx', { type: 'dhikr', label: d.label, key: d.key, count: d.count, total: this.dhikr, user: publicUser(user) });
    if (Math.floor(before / 100) !== Math.floor(this.dhikr / 100)) {
      this.emit('fx', { type: 'dhikrMilestone', total: Math.floor(this.dhikr / 100) * 100 });
    }
    if (this.challenge) {
      this.challenge.count += d.count;
      if (this.challenge.count >= this.challenge.target) this.finishChallenge(true);
    }
    this.changed();
    return 'dhikr';
  }

  // ------------------------------------------------------------------
  // الإعجابات والمتابعة والمشاركة
  // ------------------------------------------------------------------
  handleLike(user, count = 1) {
    const n = Math.max(0, Math.floor(count));
    if (!n) return;
    this.totals.likes += n;
    this.likeRemainder += n;
    const pts = Math.floor(this.likeRemainder / this.opt.likesPerPoint);
    this.likeRemainder %= this.opt.likesPerPoint;
    if (pts) this.addPoints(pts, user);
    this.pendingStars += n;
    if (!this.starsTimer) {
      this.starsTimer = this.later(600, () => {
        this.starsTimer = null;
        this.emit('fx', { type: 'stars', count: Math.min(40, this.pendingStars), total: this.totals.likes });
        this.pendingStars = 0;
      });
    }
    this.changed();
  }

  handleFollow(user) {
    this.totals.follows += 1;
    const pts = this.addPoints(this.opt.followPoints, user);
    this.emit('fx', { type: 'follow', user: publicUser(user), points: pts });
    this.changed();
  }

  handleShare(user) {
    this.totals.shares += 1;
    const pts = this.addPoints(this.opt.sharePoints, user);
    this.emit('fx', { type: 'share', user: publicUser(user), points: pts });
    this.changed();
  }

  handleMember(user) {
    const now = this.now();
    if (now - this.lastWelcome < 5000) return;
    this.lastWelcome = now;
    this.emit('fx', { type: 'welcome', user: publicUser(user) });
  }

  // ------------------------------------------------------------------
  // تحدي التسبيح الجماعي
  // ------------------------------------------------------------------
  startChallenge({ target, seconds } = {}) {
    const cfg = this.opt.dhikrChallenge;
    const t = Math.max(10, Math.round(Number(target) || cfg.target));
    const s = Math.max(10, Math.round(Number(seconds) || cfg.seconds));
    this.cancel(this.challengeTimer);
    this.challenge = { target: t, count: 0, endsAt: this.now() + s * 1000 };
    this.challengeTimer = this.later(s * 1000, () => this.finishChallenge(false));
    this.emit('fx', { type: 'challengeStart', target: t, seconds: s });
    this.changed();
  }

  finishChallenge(success) {
    if (!this.challenge) return;
    const { target, count } = this.challenge;
    this.cancel(this.challengeTimer);
    this.challengeTimer = null;
    this.challenge = null;
    let bonus = 0;
    if (success) bonus = this.addPoints(this.opt.dhikrChallenge.bonusPoints);
    this.emit('fx', { type: 'challengeEnd', success, target, count, bonus });
    this.changed();
  }

  // ------------------------------------------------------------------
  // المسابقة
  // ------------------------------------------------------------------
  nextQuestionData() {
    if (!this.deck.length) {
      const cats = this.opt.quiz.categories;
      const pool = cats?.length ? this.questions.filter((q) => cats.includes(q.c)) : this.questions;
      this.deck = shuffle(pool.length ? pool : this.questions);
    }
    const q = this.deck.pop();
    const options = shuffle(q.a.map((text, i) => ({ text, ok: i === 0 })));
    return {
      question: q.q,
      category: q.c,
      note: q.n || '',
      options: options.map((o) => o.text),
      correctIndex: options.findIndex((o) => o.ok),
    };
  }

  setQuizAuto(on) {
    this.opt.quiz.auto = Boolean(on);
    if (on && this.quiz.phase === 'idle') this.scheduleNext(3000);
    if (!on && this.quiz.phase === 'idle') {
      this.cancel(this.quizTimer);
      this.quizTimer = null;
      this.quiz.endsAt = 0;
      this.emitQuiz();
    }
    this.changed();
  }

  scheduleNext(ms) {
    this.cancel(this.quizTimer);
    this.quiz.endsAt = this.now() + ms;
    this.quiz.duration = ms;
    this.quizTimer = this.later(ms, () => this.startQuestion());
  }

  startQuestion() {
    this.cancel(this.quizTimer);
    const data = this.nextQuestionData();
    const ms = this.opt.quiz.questionSeconds * 1000;
    this.quiz = {
      phase: 'question',
      id: this.quiz.id + 1,
      ...data,
      answers: new Map(),
      counts: [0, 0, 0, 0],
      endsAt: this.now() + ms,
      duration: ms,
    };
    this.quizTimer = this.later(ms, () => this.reveal());
    this.emitQuiz();
    this.changed();
  }

  answer(user, idx) {
    const q = this.quiz;
    if (q.phase !== 'question' || idx < 0 || idx >= q.options.length) return 'none';
    if (q.answers.has(user.id)) return 'already';
    q.answers.set(user.id, { user: publicUser(user), idx });
    q.counts[idx] += 1;
    this.emit('fx', { type: 'answer', user: publicUser(user), answered: q.answers.size });
    this.changed();
    return 'answer';
  }

  reveal() {
    const q = this.quiz;
    if (q.phase !== 'question') return;
    this.cancel(this.quizTimer);
    const winners = [];
    const correctUsers = [];
    let rank = 0;
    for (const { user, idx } of q.answers.values()) {
      if (idx !== q.correctIndex) continue;
      const bonus = this.opt.firstAnswerBonus[rank] || 0;
      rank += 1;
      const score = this.opt.answerPoints + bonus;
      const s = this.scholars.get(user.id) || { ...user, score: 0, correct: 0 };
      Object.assign(s, user);
      s.score += score;
      s.correct += 1;
      this.scholars.set(user.id, s);
      this.totals.correct += 1;
      this.addPoints(this.opt.answerGoalPoints, user);
      if (winners.length < 5) winners.push({ ...user, score });
      if (correctUsers.length < 15) correctUsers.push(user);
    }
    const ms = this.opt.quiz.revealSeconds * 1000;
    Object.assign(q, {
      phase: 'reveal',
      winners,
      correctCount: rank,
      total: q.answers.size,
      endsAt: this.now() + ms,
      duration: ms,
    });
    if (correctUsers.length) this.emit('fx', { type: 'doves', users: correctUsers });
    this.quizTimer = this.later(ms, () => this.toIdle());
    this.emitQuiz();
    this.changed();
  }

  toIdle() {
    this.cancel(this.quizTimer);
    this.quizTimer = null;
    this.wisdomIndex = (this.wisdomIndex + 1) % WISDOM.length;
    this.quiz = { phase: 'idle', id: this.quiz.id, endsAt: 0, duration: 0, card: WISDOM[this.wisdomIndex] };
    if (this.opt.quiz.auto) this.scheduleNext(this.opt.quiz.pauseSeconds * 1000);
    this.emitQuiz();
    this.changed();
  }

  /** زر «التالي» في لوحة التحكم: ينتقل للمرحلة التالية فوراً */
  skipQuiz() {
    if (this.quiz.phase === 'question') this.reveal();
    else if (this.quiz.phase === 'reveal') this.toIdle();
    else this.startQuestion();
  }

  stopQuiz() {
    this.opt.quiz.auto = false;
    this.toIdle();
  }

  emitQuiz() { this.emit('quiz', this.quizPublic()); }

  quizPublic() {
    const q = this.quiz;
    const base = { phase: q.phase, id: q.id, endsIn: Math.max(0, q.endsAt - this.now()), duration: q.duration };
    if (q.phase === 'idle') return { ...base, card: q.card };
    const out = {
      ...base,
      question: q.question,
      category: q.category,
      options: q.options,
      answered: q.answers.size,
    };
    if (q.phase === 'reveal') {
      Object.assign(out, {
        correctIndex: q.correctIndex,
        counts: q.counts,
        winners: q.winners,
        correctCount: q.correctCount,
        note: q.note,
      });
    }
    return out;
  }

  /** للاعبين الوهميين فقط */
  peekCorrect() {
    return this.quiz.phase === 'question' ? this.quiz.correctIndex : null;
  }
}
