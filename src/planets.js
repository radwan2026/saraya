import { EventEmitter } from 'node:events';
import { parseNumberComment } from './game.js';
import { PLANETS, WORLD, lanes, planRound, planetById } from './planets-physics.js';

// مراحل «سباق الكواكب» (lobby و choosing بنفس أسماء اللعبة الأولى ليعمل معها وضع التجربة)
export const PlanetsPhase = Object.freeze({
  LOBBY: 'lobby',       // الانضمام بكتابة رقم مسار
  CHOOSING: 'choosing', // العدّ التنازلي: الهدف ظاهر، اختر/غيّر مسارك
  FLIGHT: 'flight',     // الإطلاق! الصواريخ تطير
  RESULT: 'result',     // النتائج والنقاط ومعلومة علمية
  WINNER: 'winner',
  GAMEOVER: 'gameover', // انتهت الجولات ولم يسجّل أحد نقطة
});

export const OUTCOME_LABEL = Object.freeze({
  landed: 'هبط بنجاح',
  flyby: 'مرّ قريباً',
  burned: 'احترق في الشمس',
  lost: 'ضاع في الفضاء',
});

/** يختار الفائز: الأعلى نقاطاً، وعند التعادل الأسبق انضماماً */
export function pickLeader(players) {
  if (!players.length) return null;
  return [...players].sort((a, b) => b.score - a.score || a.order - b.order)[0];
}

export class PlanetsGame extends EventEmitter {
  constructor(options, { random = Math.random, now = Date.now } = {}) {
    super();
    this.opt = { minNumber: 1, maxNumber: 10, ...options };
    this.laneCount = this.opt.maxNumber - this.opt.minNumber + 1;
    this.random = random;
    this.now = now;
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
    this.round = 0;
    this.plan = null;
    this.planet = null;
    this.fact = '';
    this.launchAt = null;
    this.lastResult = null;
    this.winner = null;
    this.lastPlanetId = null;
    this.gameNumber += 1;
    this.setPhase(PlanetsPhase.LOBBY, null);
    this.maybeStartLobbyCountdown();
  }

  /** لا يوجد إقصاء في هذه اللعبة — الجميع «أحياء» */
  get alivePlayers() {
    return [...this.players.values()];
  }

  /** ما يُرسل للمتصفح. مسارات الرحلة لا تُكشف قبل الإطلاق حتى لا يُعرف المسار الرابح */
  snapshot() {
    const showFlight = [PlanetsPhase.FLIGHT, PlanetsPhase.RESULT, PlanetsPhase.WINNER, PlanetsPhase.GAMEOVER]
      .includes(this.phase) && this.plan;
    const revealed = this.phase !== PlanetsPhase.FLIGHT && showFlight;
    return {
      kind: 'planets',
      phase: this.phase,
      phaseEndsAt: this.phaseEndsAt,
      serverNow: this.now(),
      round: this.round,
      maxRounds: this.opt.maxRounds,
      targetScore: this.opt.targetScore,
      gameNumber: this.gameNumber,
      minNumber: this.opt.minNumber,
      maxNumber: this.opt.maxNumber,
      minPlayers: this.opt.minPlayers,
      autoStart: this.opt.autoStart,
      world: { ...WORLD, lanes: lanes(this.laneCount).map((l) => ({ n: l.n + this.opt.minNumber - 1, angle: l.angle })) },
      planet: this.planet ? publicPlanet(this.planet) : null,
      target: this.plan ? this.plan.target : null,
      fact: this.fact,
      launchAt: this.launchAt,
      flight: showFlight ? { duration: this.plan.duration, paths: this.plan.paths, events: flightEvents(this.plan.results) } : null,
      landingPoints: this.opt.landingPoints,
      results: revealed ? this.plan.results : null,
      launchWindow: revealed ? this.plan.window : null,
      players: [...this.players.values()].map(publicPlayer),
      aliveCount: this.players.size,
      laneCounts: this.laneCounts(),
      lastResult: this.lastResult,
      winner: this.winner ? publicPlayer(this.winner) : null,
      history: this.history,
      // توافق مع لوحة التحكم
      dollNumber: revealed ? this.plan.window : null,
    };
  }

  laneCounts() {
    const c = {};
    for (const p of this.players.values()) c[p.number] = (c[p.number] || 0) + 1;
    return c;
  }

  setPhase(phase, seconds, next) {
    this.clearTimer();
    this.phase = phase;
    this.phaseEndsAt = seconds ? this.now() + seconds * 1000 : null;
    if (seconds && next) this.timer = setTimeout(() => next.call(this), seconds * 1000);
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
  handleComment(user, text) {
    const number = parseNumberComment(text, this.opt.minNumber, this.opt.maxNumber);
    if (number === null || !user || !user.id) return 'ignored';

    const canChoose = this.phase === PlanetsPhase.LOBBY || this.phase === PlanetsPhase.CHOOSING;
    const existing = this.players.get(user.id);
    if (existing) {
      if (!canChoose || existing.number === number) return 'ignored';
      existing.number = number;
      if (user.avatar) existing.avatar = user.avatar;
      if (user.nickname) existing.nickname = user.nickname;
      this.emit('numberChanged', publicPlayer(existing));
      this.emitState();
      return 'changed';
    }

    const joinOpen = this.phase === PlanetsPhase.LOBBY || (this.phase === PlanetsPhase.CHOOSING && this.opt.allowLateJoin);
    if (!joinOpen) return 'closed';
    if (this.opt.maxPlayers > 0 && this.players.size >= this.opt.maxPlayers) return 'full';

    const player = {
      id: user.id,
      uniqueId: user.uniqueId || user.id,
      nickname: user.nickname || user.uniqueId || 'لاعب',
      avatar: user.avatar || '',
      isBot: Boolean(user.isBot),
      number,
      score: 0,
      landings: 0,
      lastOutcome: null,
      lastPoints: 0,
      order: ++this.joinCounter,
      alive: true,
    };
    this.players.set(player.id, player);
    this.emit('join', publicPlayer(player));
    this.emitState();
    this.maybeStartLobbyCountdown();
    return 'joined';
  }

  /** رقم «مقترح» للاعبين الوهميين: قريب من نافذة الإطلاق أحياناً ليبدو اللعب واقعياً */
  botNumber() {
    const { minNumber, maxNumber } = this.opt;
    if (this.plan && this.phase === PlanetsPhase.CHOOSING && this.random() < 0.35) {
      const n = this.plan.window + Math.round((this.random() - 0.5) * 2);
      return Math.min(maxNumber, Math.max(minNumber, n));
    }
    return minNumber + Math.floor(this.random() * (maxNumber - minNumber + 1));
  }

  // ------------------------------------------------------------------
  // تدفّق اللعبة
  // ------------------------------------------------------------------
  maybeStartLobbyCountdown() {
    if (this.phase !== PlanetsPhase.LOBBY || !this.opt.autoStart || this.phaseEndsAt) return;
    if (this.players.size >= Math.max(1, this.opt.minPlayers)) {
      this.setPhase(PlanetsPhase.LOBBY, this.opt.lobbySeconds, this.onLobbyEnd);
    }
  }

  onLobbyEnd() {
    if (this.players.size === 0) { this.setPhase(PlanetsPhase.LOBBY, null); return; }
    this.startChoosing();
  }

  start() {
    if (this.phase !== PlanetsPhase.LOBBY || this.players.size === 0) return false;
    this.startChoosing();
    return true;
  }

  skip() {
    switch (this.phase) {
      case PlanetsPhase.LOBBY: return this.start();
      case PlanetsPhase.CHOOSING: this.launch(); return true;
      case PlanetsPhase.FLIGHT: this.showResult(); return true;
      case PlanetsPhase.RESULT: this.afterResult(); return true;
      case PlanetsPhase.WINNER:
      case PlanetsPhase.GAMEOVER: this.resetToLobby(); return true;
      default: return false;
    }
  }

  pickPlanet() {
    const pool = PLANETS.filter((p) => p.id !== this.lastPlanetId);
    const planet = pool[Math.floor(this.random() * pool.length)];
    this.lastPlanetId = planet.id;
    return planet;
  }

  /** جولة جديدة: نختار الكوكب ونحسب كل شيء سرّاً، ثم نعطي اللاعبين وقتاً للتصويب */
  startChoosing() {
    this.round += 1;
    this.planet = this.pickPlanet();
    this.plan = planRound(this.planet, {
      laneCount: this.laneCount,
      random: this.random,
      landingPoints: this.opt.landingPoints,
      flybyPoints: this.opt.flybyPoints,
    });
    // أرقام المسارات تبدأ من minNumber
    if (this.opt.minNumber !== 1) this.plan = shiftLanes(this.plan, this.opt.minNumber - 1);
    this.fact = this.planet.facts[Math.floor(this.random() * this.planet.facts.length)];
    this.lastResult = null;
    this.launchAt = this.now() + this.opt.chooseSeconds * 1000;
    this.setPhase(PlanetsPhase.CHOOSING, this.opt.chooseSeconds, this.launch);
  }

  launch() {
    this.launchAt = this.now();
    const seconds = Math.ceil(this.plan.duration + 1);
    this.setPhase(PlanetsPhase.FLIGHT, seconds, this.showResult);
  }

  showResult() {
    const { results, window } = this.plan;
    const landed = [];
    const flyby = [];
    for (const p of this.players.values()) {
      const r = results[p.number] || { outcome: 'lost', points: 0 };
      p.lastOutcome = r.outcome;
      p.lastPoints = r.points;
      p.score += r.points;
      if (r.outcome === 'landed') { p.landings += 1; landed.push(p.id); }
      if (r.outcome === 'flyby') flyby.push(p.id);
    }
    this.lastResult = { round: this.round, planetId: this.planet.id, window, landed, flyby };
    this.emit('roundResult', this.lastResult);

    const reached = [...this.players.values()].filter((p) => p.score >= this.opt.targetScore);
    if (reached.length) this.winner = pickLeader(reached);
    else if (this.round >= this.opt.maxRounds) {
      const best = pickLeader([...this.players.values()]);
      this.winner = best && best.score > 0 ? best : null;
    }
    this.setPhase(PlanetsPhase.RESULT, this.opt.resultSeconds, this.afterResult);
  }

  afterResult() {
    if (this.winner) {
      this.history.unshift({ ...publicPlayer(this.winner), rounds: this.round, at: this.now() });
      this.history = this.history.slice(0, 10);
      this.emit('winner', publicPlayer(this.winner));
      this.setPhase(PlanetsPhase.WINNER, this.opt.winnerSeconds, this.resetToLobby);
    } else if (this.round >= this.opt.maxRounds) {
      this.setPhase(PlanetsPhase.GAMEOVER, this.opt.gameOverSeconds, this.resetToLobby);
    } else {
      this.startChoosing();
    }
  }

  destroy() {
    this.clearTimer();
    this.removeAllListeners();
  }
}

/** لحظات الهبوط والاحتراق لكل مسار — ليعرض المتصفح الاحتفال/اللهب في وقته */
function flightEvents(results) {
  const ev = {};
  for (const [lane, r] of Object.entries(results)) {
    if (r.outcome === 'landed') ev[lane] = { kind: 'landed', at: r.at };
    else if (r.outcome === 'burned') ev[lane] = { kind: 'sun', at: r.at };
  }
  return ev;
}

function shiftLanes(plan, by) {
  const shift = (obj) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [Number(k) + by, v]));
  return { ...plan, window: plan.window + by, results: shift(plan.results), paths: shift(plan.paths) };
}

function publicPlanet(p) {
  const { facts, ...rest } = p;
  return rest;
}

function publicPlayer(p) {
  return {
    id: p.id,
    uniqueId: p.uniqueId,
    nickname: p.nickname,
    avatar: p.avatar,
    isBot: p.isBot,
    number: p.number,
    score: p.score,
    landings: p.landings,
    lastOutcome: p.lastOutcome,
    lastPoints: p.lastPoints,
    order: p.order,
    alive: true,
  };
}

export { planetById };
