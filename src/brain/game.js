import { EventEmitter } from 'node:events';
import { PUZZLES, DEFAULT_ORDER, publicPuzzle, revealData } from './puzzles.js';

// مراحل البرنامج
export const Phase = Object.freeze({
  LOBBY: 'lobby',             // الاستوديو: تسجيل المتسابقين
  INTRO: 'intro',             // بطاقة عنوان الجولة (انتقال سينمائي)
  QUESTION: 'question',       // اللغز والمؤقت — استقبال الإجابات
  REVEAL: 'reveal',           // كشف الحل تدريجياً
  LEADERBOARD: 'leaderboard', // ترتيب النقاط بعد الجولة
  FINALE: 'finale',           // إعلان الفائز
});

const DIGITS = { '٠': 0, '١': 1, '٢': 2, '٣': 3, '٤': 4, '٥': 5, '٦': 6, '٧': 7, '٨': 8, '٩': 9,
  '۰': 0, '۱': 1, '۲': 2, '۳': 3, '۴': 4, '۵': 5, '۶': 6, '۷': 7, '۸': 8, '۹': 9 };
const LETTERS = { 'أ': 1, 'ا': 1, 'إ': 1, 'آ': 1, 'ب': 2, 'ج': 3, 'د': 4, a: 1, b: 2, c: 3, d: 4 };

/**
 * يحوّل تعليقاً إلى إجابة حسب نوع اللغز، أو null إذا لم يكن إجابة.
 * - choice: رقم الخيار 1..n أو حرف (أ ب ج د / A B C D)
 * - code:   أرقام بطول محدد، مع السماح بالمسافات والشرطات (5 2 8 1 أو 5-2-8-1)
 * - number: عدد صحيح من 1 إلى 4 خانات
 */
export function parseAnswer(text, puzzle) {
  if (typeof text !== 'string') return null;
  const t = text.replace(/[٠-٩۰-۹]/g, (d) => String(DIGITS[d])).trim().replace(/^#\s*/, '');
  if (puzzle.type === 'choice') {
    const n = puzzle.optionCount || 4;
    let m = t.match(/^(\d)$/);
    if (m) { const v = Number(m[1]); return v >= 1 && v <= n ? String(v) : null; }
    m = t.toLowerCase().match(/^([أاإآبجدabcd])$/);
    if (m) { const v = LETTERS[m[1]]; return v <= n ? String(v) : null; }
    return null;
  }
  if (puzzle.type === 'code') {
    if (!/^[\d\s\-–.]+$/.test(t)) return null;
    const digits = t.replace(/\D/g, '');
    return digits.length === puzzle.codeLength ? digits : null;
  }
  if (puzzle.type === 'number') {
    const m = t.match(/^(\d{1,4})$/);
    return m ? String(Number(m[1])) : null;
  }
  return null;
}

/**
 * نقاط الإجابة الصحيحة: أساس + مكافأة سرعة (حسب الوقت المتبقي) + مكافأة للأوائل، مضروبة في مضاعف الجولة.
 */
export function scoreFor({ elapsedMs, totalMs, rank, multiplier = 1 }, scoring) {
  const left = Math.max(0, Math.min(1, 1 - elapsedMs / totalMs));
  const speed = Math.round(scoring.speedBonus * left);
  const podium = scoring.firstBonus[rank] || 0;
  return (scoring.base + speed + podium) * multiplier;
}

export class BrainGame extends EventEmitter {
  constructor(options, { now = Date.now, puzzles = PUZZLES } = {}) {
    super();
    this.opt = options;
    this.now = now;
    this.puzzles = puzzles;
    this.order = (options.rounds && options.rounds.length ? options.rounds : DEFAULT_ORDER)
      .filter((id) => puzzles[id]);
    this.timer = null;
    this.gameNumber = 0;
    this.history = [];
    this.resetToLobby();
  }

  // ------------------------------------------------------------------
  // الحالة
  // ------------------------------------------------------------------

  resetToLobby() {
    this.clearTimer();
    this.players = new Map();
    this.joinCounter = 0;
    this.roundIndex = -1;
    this.answers = new Map(); // id -> { value, at, elapsedMs }
    this.lastReveal = null;
    this.podium = null;
    this.gameNumber += 1;
    this.setPhase(Phase.LOBBY, null);
    this.maybeStartLobbyCountdown();
  }

  get puzzle() {
    return this.roundIndex >= 0 ? this.puzzles[this.order[this.roundIndex]] : null;
  }

  get publicCurrent() {
    const p = this.puzzle;
    return p ? publicPuzzle(p) : null;
  }

  ranking() {
    return [...this.players.values()]
      .sort((a, b) => b.score - a.score || b.correct - a.correct || a.totalMs - b.totalMs || a.order - b.order)
      .map(publicPlayer);
  }

  snapshot() {
    const showPuzzle = [Phase.INTRO, Phase.QUESTION, Phase.REVEAL].includes(this.phase);
    return {
      phase: this.phase,
      phaseEndsAt: this.phaseEndsAt,
      phaseStartedAt: this.phaseStartedAt,
      serverNow: this.now(),
      gameNumber: this.gameNumber,
      roundIndex: this.roundIndex,
      totalRounds: this.order.length,
      order: this.order,
      roundsInfo: this.order.map((id) => ({ id, icon: this.puzzles[id].icon, title: this.puzzles[id].title })),
      autoStart: this.opt.autoStart,
      minPlayers: this.opt.minPlayers,
      puzzle: showPuzzle ? this.publicCurrent : null,
      answeredCount: this.answers.size,
      reveal: this.phase === Phase.REVEAL ? this.lastReveal : null,
      lastReveal: this.lastReveal,
      playerCount: this.players.size,
      leaderboard: this.ranking().slice(0, 10),
      podium: this.podium,
      history: this.history,
    };
  }

  /** معلومات للمضيف فقط — لا تُرسل لشاشة البث */
  hostInfo() {
    const p = this.puzzle;
    return { answer: p && this.phase !== Phase.LOBBY ? p.answer : null };
  }

  setPhase(phase, seconds, next) {
    this.clearTimer();
    this.phase = phase;
    this.phaseStartedAt = this.now();
    this.phaseEndsAt = seconds ? this.phaseStartedAt + seconds * 1000 : null;
    if (seconds && next) this.timer = setTimeout(() => next.call(this), seconds * 1000);
    this.emit('phase', { phase, phaseEndsAt: this.phaseEndsAt, roundIndex: this.roundIndex });
    this.emitState();
  }

  clearTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
  }

  emitState() {
    this.emit('state', this.snapshot());
  }

  // ------------------------------------------------------------------
  // المتسابقون والتعليقات
  // ------------------------------------------------------------------

  ensurePlayer(user) {
    let p = this.players.get(user.id);
    if (p) {
      if (user.avatar) p.avatar = user.avatar;
      if (user.nickname) p.nickname = user.nickname;
      return { player: p, isNew: false };
    }
    if (this.opt.maxPlayers > 0 && this.players.size >= this.opt.maxPlayers) return { player: null, isNew: false };
    p = {
      id: user.id,
      uniqueId: user.uniqueId || user.id,
      nickname: user.nickname || user.uniqueId || 'متسابق',
      avatar: user.avatar || '',
      isBot: Boolean(user.isBot),
      order: ++this.joinCounter,
      score: 0,
      correct: 0,
      totalMs: 0, // مجموع زمن الإجابات الصحيحة — لكسر التعادل
      lastGain: 0,
    };
    this.players.set(p.id, p);
    this.emit('join', publicPlayer(p));
    return { player: p, isNew: true };
  }

  /**
   * @returns {'joined'|'answered'|'locked'|'ignored'|'closed'|'full'}
   */
  handleComment(user, text) {
    if (!user || !user.id) return 'ignored';

    if (this.phase === Phase.LOBBY) {
      // أي تعليق في الاستوديو يسجّل صاحبه متسابقاً
      if (this.players.has(user.id)) return 'ignored';
      const { player } = this.ensurePlayer(user);
      if (!player) return 'full';
      this.emitState();
      this.maybeStartLobbyCountdown();
      return 'joined';
    }

    if (this.phase !== Phase.QUESTION) return 'closed';
    const pz = this.publicCurrent;
    const value = parseAnswer(text, pz);
    if (value === null) return 'ignored';
    if (this.answers.has(user.id)) return 'locked'; // الإجابة الأولى هي النهائية
    if (!this.players.has(user.id) && !this.opt.allowLateJoin) return 'closed';
    const { player } = this.ensurePlayer(user);
    if (!player) return 'full';

    const at = this.now();
    this.answers.set(player.id, { value, at, elapsedMs: at - this.phaseStartedAt });
    this.emit('answer', { player: publicPlayer(player), count: this.answers.size });
    this.emitState();
    return 'answered';
  }

  // ------------------------------------------------------------------
  // تدفّق البرنامج
  // ------------------------------------------------------------------

  maybeStartLobbyCountdown() {
    if (this.phase !== Phase.LOBBY || !this.opt.autoStart || this.phaseEndsAt) return;
    if (this.players.size >= Math.max(1, this.opt.minPlayers)) {
      this.setPhase(Phase.LOBBY, this.opt.lobbySeconds, this.start);
    }
  }

  /** بدء البرنامج (يعمل حتى بدون متسابقين — مفيد لتسجيل فيديو) */
  start() {
    if (this.phase !== Phase.LOBBY) return false;
    this.roundIndex = -1;
    this.nextRound();
    return true;
  }

  skip() {
    switch (this.phase) {
      case Phase.LOBBY: return this.start();
      case Phase.INTRO: this.startQuestion(); return true;
      case Phase.QUESTION: this.reveal(); return true;
      case Phase.REVEAL: this.showLeaderboard(); return true;
      case Phase.LEADERBOARD: this.nextRound(); return true;
      case Phase.FINALE: this.resetToLobby(); return true;
      default: return false;
    }
  }

  nextRound() {
    if (this.roundIndex + 1 >= this.order.length) {
      this.finale();
      return;
    }
    this.roundIndex += 1;
    this.answers = new Map();
    this.lastReveal = null;
    for (const p of this.players.values()) p.lastGain = 0;
    this.setPhase(Phase.INTRO, this.opt.introSeconds, this.startQuestion);
  }

  startQuestion() {
    const seconds = Math.max(5, Math.round(this.puzzle.seconds * (this.opt.timeScale || 1)));
    this.setPhase(Phase.QUESTION, seconds, this.reveal);
  }

  reveal() {
    const pz = this.puzzle;
    const pub = this.publicCurrent;
    const totalMs = Math.max(1, (this.phaseEndsAt || this.now()) - this.phaseStartedAt);
    const correct = [...this.answers.entries()]
      .filter(([, a]) => a.value === pz.answer)
      .sort((a, b) => a[1].at - b[1].at);

    correct.forEach(([id, a], rank) => {
      const p = this.players.get(id);
      const gain = scoreFor({ elapsedMs: a.elapsedMs, totalMs, rank, multiplier: pub.multiplier }, this.opt.scoring);
      p.score += gain;
      p.lastGain = gain;
      p.correct += 1;
      p.totalMs += a.elapsedMs;
    });

    const distribution = {};
    for (const a of this.answers.values()) distribution[a.value] = (distribution[a.value] || 0) + 1;

    this.lastReveal = {
      ...revealData(pz),
      roundIndex: this.roundIndex,
      puzzleId: pz.id,
      totalAnswers: this.answers.size,
      correctCount: correct.length,
      distribution,
      fastest: correct.slice(0, 3).map(([id, a]) => ({
        ...publicPlayer(this.players.get(id)), seconds: Math.round(a.elapsedMs / 100) / 10,
      })),
    };
    this.emit('reveal', this.lastReveal);
    this.setPhase(Phase.REVEAL, this.opt.revealSeconds, this.showLeaderboard);
  }

  showLeaderboard() {
    const last = this.roundIndex + 1 >= this.order.length;
    // بعد الجولة الأخيرة ننتقل مباشرة لإعلان الفائز
    if (last) { this.finale(); return; }
    this.setPhase(Phase.LEADERBOARD, this.opt.leaderboardSeconds, this.nextRound);
  }

  finale() {
    const ranked = this.ranking().filter((p) => p.score > 0);
    this.podium = ranked.slice(0, 3);
    if (this.podium.length) {
      this.history.unshift({ ...this.podium[0], at: this.now() });
      this.history = this.history.slice(0, 10);
      this.emit('winner', this.podium[0]);
    }
    this.setPhase(Phase.FINALE, this.opt.finaleSeconds, this.resetToLobby);
  }

  destroy() {
    this.clearTimer();
    this.removeAllListeners();
  }
}

function publicPlayer(p) {
  return {
    id: p.id, uniqueId: p.uniqueId, nickname: p.nickname, avatar: p.avatar, isBot: p.isBot,
    order: p.order, score: p.score, correct: p.correct, lastGain: p.lastGain,
  };
}
