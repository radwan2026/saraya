import { EventEmitter } from 'node:events';

// مراحل اللعبة
export const Phase = Object.freeze({
  LOBBY: 'lobby',       // الردهة: الانضمام بكتابة رقم
  CHOOSING: 'choosing', // الضوء الأخضر: اختيار/تغيير الأرقام
  DOLL: 'doll',         // الدمية تلتفت وتختار رقماً
  RESULT: 'result',     // عرض نتيجة الجولة
  WINNER: 'winner',     // شاشة الفوز
  GAMEOVER: 'gameover', // خرج الجميع بدون فائز
});

const ARABIC_DIGITS = { '٠': 0, '١': 1, '٢': 2, '٣': 3, '٤': 4, '٥': 5, '٦': 6, '٧': 7, '٨': 8, '٩': 9,
  '۰': 0, '۱': 1, '۲': 2, '۳': 3, '۴': 4, '۵': 5, '۶': 6, '۷': 7, '۸': 8, '۹': 9 };

/**
 * يستخرج رقماً من تعليق. يقبل الأرقام الإنجليزية والعربية والفارسية.
 * التعليق يجب أن يكون رقماً فقط (مع مسافات أو # اختيارية) حتى لا تُحتسب الجمل العادية.
 * @returns {number|null}
 */
export function parseNumberComment(text, min = 1, max = 10) {
  if (typeof text !== 'string') return null;
  const normalized = text.replace(/[٠-٩۰-۹]/g, (d) => String(ARABIC_DIGITS[d])).trim();
  const m = normalized.match(/^#?\s*(\d{1,3})\s*$/);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= min && n <= max ? n : null;
}

/**
 * يطبّق قاعدة الجولة على اللاعبين الأحياء (دالة نقية بدون آثار جانبية).
 * - رقم اللاعب >= رقم الدمية  => يخرج
 * - رقم اللاعب <  رقم الدمية  => يتقدّم بعدد خطوات يساوي رقمه
 * @returns {{ eliminated: string[], advanced: {id:string, from:number, to:number}[], finishers: string[] }}
 */
export function resolveRound(players, dollNumber, trackLength) {
  const eliminated = [];
  const advanced = [];
  const finishers = [];
  for (const p of players) {
    if (!p.alive) continue;
    if (p.number >= dollNumber) {
      eliminated.push(p.id);
    } else {
      const from = p.position;
      const to = from + p.number;
      advanced.push({ id: p.id, from, to });
      if (to >= trackLength) finishers.push(p.id);
    }
  }
  return { eliminated, advanced, finishers };
}

/**
 * يختار الفائز من بين من وصلوا خط النهاية في نفس الجولة:
 * الأبعد مسافةً أولاً، وعند التعادل الأسبق انضماماً.
 */
export function pickWinner(finisherPlayers) {
  if (!finisherPlayers.length) return null;
  return [...finisherPlayers].sort((a, b) => b.position - a.position || a.order - b.order)[0];
}

export class Game extends EventEmitter {
  constructor(options, { random = Math.random, now = Date.now } = {}) {
    super();
    this.opt = options;
    this.random = random;
    this.now = now;
    this.timer = null;
    this.gameNumber = 0;
    this.history = []; // آخر الفائزين
    this.resetToLobby();
  }

  // ------------------------------------------------------------------
  // الحالة
  // ------------------------------------------------------------------

  resetToLobby() {
    this.clearTimer();
    this.players = new Map();
    this.joinCounter = 0;
    this.round = 0;
    this.dollNumber = null;
    this.lastResult = null;
    this.winner = null;
    this.gameNumber += 1;
    this.setPhase(Phase.LOBBY, null);
    this.maybeStartLobbyCountdown();
  }

  get alivePlayers() {
    return [...this.players.values()].filter((p) => p.alive);
  }

  snapshot() {
    return {
      phase: this.phase,
      phaseEndsAt: this.phaseEndsAt,
      serverNow: this.now(),
      round: this.round,
      gameNumber: this.gameNumber,
      dollNumber: this.dollNumber,
      trackLength: this.opt.trackLength,
      minNumber: this.opt.minNumber,
      maxNumber: this.opt.maxNumber,
      minPlayers: this.opt.minPlayers,
      autoStart: this.opt.autoStart,
      players: [...this.players.values()].map(publicPlayer),
      aliveCount: this.alivePlayers.length,
      lastResult: this.lastResult,
      winner: this.winner ? publicPlayer(this.winner) : null,
      history: this.history,
    };
  }

  setPhase(phase, seconds, next) {
    this.clearTimer();
    this.phase = phase;
    this.phaseEndsAt = seconds ? this.now() + seconds * 1000 : null;
    if (seconds && next) {
      this.timer = setTimeout(() => next.call(this), seconds * 1000);
    }
    this.emit('phase', { phase, phaseEndsAt: this.phaseEndsAt });
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
  // التعليقات
  // ------------------------------------------------------------------

  /**
   * يعالج تعليقاً من البث.
   * @param {{id:string, uniqueId?:string, nickname?:string, avatar?:string, isBot?:boolean}} user
   * @param {string} text
   * @returns {'joined'|'changed'|'ignored'|'full'|'closed'|'eliminated'}
   */
  handleComment(user, text) {
    const number = parseNumberComment(text, this.opt.minNumber, this.opt.maxNumber);
    if (number === null || !user || !user.id) return 'ignored';

    const existing = this.players.get(user.id);
    if (existing) {
      if (!existing.alive) return 'eliminated';
      const canChange = this.phase === Phase.LOBBY || (this.phase === Phase.CHOOSING && this.opt.allowChangeNumber);
      if (!canChange || existing.number === number) return 'ignored';
      existing.number = number;
      // تحديث الصورة/الاسم إن تغيّرا
      if (user.avatar) existing.avatar = user.avatar;
      if (user.nickname) existing.nickname = user.nickname;
      this.emit('numberChanged', publicPlayer(existing));
      this.emitState();
      return 'changed';
    }

    const joinOpen = this.phase === Phase.LOBBY || (this.phase === Phase.CHOOSING && this.opt.allowLateJoin);
    if (!joinOpen) return 'closed';
    if (this.opt.maxPlayers > 0 && this.players.size >= this.opt.maxPlayers) return 'full';

    const player = {
      id: user.id,
      uniqueId: user.uniqueId || user.id,
      nickname: user.nickname || user.uniqueId || 'لاعب',
      avatar: user.avatar || '',
      isBot: Boolean(user.isBot),
      number,
      position: 0,
      alive: true,
      order: ++this.joinCounter,
      // توزيع أفقي متساوٍ تقريباً (متتالية النسبة الذهبية) حتى لا يتكدّس اللاعبون فوق بعض
      lane: (this.joinCounter * 0.6180339887) % 1,
      lastMove: 0,
      eliminatedRound: null,
    };
    this.players.set(player.id, player);
    this.emit('join', publicPlayer(player));
    this.emitState();
    this.maybeStartLobbyCountdown();
    return 'joined';
  }

  // ------------------------------------------------------------------
  // تدفّق اللعبة
  // ------------------------------------------------------------------

  maybeStartLobbyCountdown() {
    if (this.phase !== Phase.LOBBY || !this.opt.autoStart || this.phaseEndsAt) return;
    if (this.players.size >= Math.max(1, this.opt.minPlayers)) {
      this.setPhase(Phase.LOBBY, this.opt.lobbySeconds, this.onLobbyEnd);
    }
  }

  onLobbyEnd() {
    if (this.players.size === 0) {
      this.setPhase(Phase.LOBBY, null);
      return;
    }
    // الجولة الأولى: الأرقام مختارة سلفاً عند الانضمام، فننتقل مباشرة إلى الدمية
    this.startDoll();
  }

  /** بدء اللعبة يدوياً من لوحة التحكم */
  start() {
    if (this.phase !== Phase.LOBBY) return false;
    if (this.players.size === 0) return false;
    this.startDoll();
    return true;
  }

  /** تخطي المرحلة الحالية فوراً */
  skip() {
    switch (this.phase) {
      case Phase.LOBBY: return this.start();
      case Phase.CHOOSING: this.startDoll(); return true;
      case Phase.DOLL: this.revealDoll(); return true;
      case Phase.RESULT: this.afterResult(); return true;
      case Phase.WINNER:
      case Phase.GAMEOVER: this.resetToLobby(); return true;
      default: return false;
    }
  }

  startChoosing() {
    this.dollNumber = null;
    this.setPhase(Phase.CHOOSING, this.opt.chooseSeconds, this.startDoll);
  }

  startDoll() {
    this.round += 1;
    this.dollNumber = null;
    this.lastResult = null;
    this.setPhase(Phase.DOLL, this.opt.dollTurnSeconds, this.revealDoll);
  }

  rollDoll() {
    const { dollMin, dollMax } = this.opt;
    return dollMin + Math.floor(this.random() * (dollMax - dollMin + 1));
  }

  revealDoll() {
    this.dollNumber = this.rollDoll();
    const alive = this.alivePlayers;
    const result = resolveRound(alive, this.dollNumber, this.opt.trackLength);

    for (const p of alive) p.lastMove = 0;
    for (const id of result.eliminated) {
      const p = this.players.get(id);
      p.alive = false;
      p.eliminatedRound = this.round;
    }
    for (const { id, to } of result.advanced) {
      const p = this.players.get(id);
      p.lastMove = to - p.position;
      p.position = to;
    }

    const winner = pickWinner(result.finishers.map((id) => this.players.get(id)));
    this.winner = winner || null;
    this.lastResult = {
      round: this.round,
      dollNumber: this.dollNumber,
      eliminated: result.eliminated,
      advanced: result.advanced,
      finishers: result.finishers,
    };
    this.emit('roundResult', this.lastResult);
    this.setPhase(Phase.RESULT, this.opt.resultSeconds, this.afterResult);
  }

  afterResult() {
    if (this.winner) {
      this.history.unshift({ ...publicPlayer(this.winner), rounds: this.round, at: this.now() });
      this.history = this.history.slice(0, 10);
      this.emit('winner', publicPlayer(this.winner));
      this.setPhase(Phase.WINNER, this.opt.winnerSeconds, this.resetToLobby);
    } else if (this.alivePlayers.length === 0) {
      this.setPhase(Phase.GAMEOVER, this.opt.gameOverSeconds, this.resetToLobby);
    } else {
      this.startChoosing();
    }
  }

  destroy() {
    this.clearTimer();
    this.removeAllListeners();
  }
}

function publicPlayer(p) {
  return {
    id: p.id,
    uniqueId: p.uniqueId,
    nickname: p.nickname,
    avatar: p.avatar,
    isBot: p.isBot,
    number: p.number,
    position: p.position,
    alive: p.alive,
    order: p.order,
    lane: p.lane,
    lastMove: p.lastMove,
    eliminatedRound: p.eliminatedRound,
  };
}
