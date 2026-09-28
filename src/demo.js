import { Phase } from './game.js';

const FIRST = ['أحمد', 'سارة', 'محمد', 'نور', 'ليلى', 'يوسف', 'مريم', 'عمر', 'هدى', 'خالد', 'ريم', 'علي',
  'فاطمة', 'زياد', 'جنى', 'حمزة', 'لين', 'سلمى', 'آدم', 'تالا', 'Ali', 'Lina', 'Sam', 'Maya', 'Omar', 'Zed'];
const SUFFIX = ['_gamer', '.x', '99', '_pro', '777', '_ksa', '_eg', '.official', '_01', '', '', ''];

const COLORS = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0',
  '#f032e6', '#bcf60c', '#fabebe', '#008080', '#e6beff', '#9a6324', '#800000', '#aaffc3'];

/** صورة رمزية SVG مولّدة محلياً (لا تحتاج إنترنت) */
function avatarFor(name, i) {
  const bg = COLORS[i % COLORS.length];
  const letter = [...name][0] || '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">`
    + `<rect width="128" height="128" fill="${bg}"/>`
    + `<circle cx="64" cy="50" r="24" fill="rgba(255,255,255,.35)"/>`
    + `<rect x="24" y="82" width="80" height="60" rx="40" fill="rgba(255,255,255,.35)"/>`
    + `<text x="64" y="62" font-size="34" font-family="Arial" font-weight="bold" fill="#fff" text-anchor="middle">${letter}</text>`
    + `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/**
 * وضع التجربة: يولّد لاعبين وهميين يعلّقون بأرقام، ويغيّرون أرقامهم أحياناً بين الجولات.
 */
export class DemoBots {
  constructor(game, onComment, { count = 12, changeChance = 0.5 } = {}) {
    this.game = game;
    this.onComment = onComment;
    this.count = count;
    this.changeChance = changeChance;
    this.running = false;
    this.timers = new Set();
    this.serial = 0;
    this.onPhase = this.onPhase.bind(this);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.game.on('phase', this.onPhase);
    this.onPhase({ phase: this.game.phase });
  }

  stop() {
    this.running = false;
    this.game.off('phase', this.onPhase);
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  later(ms, fn) {
    const t = setTimeout(() => { this.timers.delete(t); fn(); }, ms);
    this.timers.add(t);
  }

  makeBot() {
    const i = this.serial++;
    const first = FIRST[Math.floor(Math.random() * FIRST.length)];
    const uniqueId = `${first}${SUFFIX[Math.floor(Math.random() * SUFFIX.length)]}${i}`.replace(/\s/g, '');
    return { id: `bot-${i}`, uniqueId, nickname: first, avatar: avatarFor(first, i), isBot: true };
  }

  /** رقم «ذكي» قليلاً: الأغلب يختار أرقاماً صغيرة/متوسطة */
  randomNumber() {
    const { minNumber, maxNumber } = this.game.opt;
    const r = Math.random() ** 1.6; // انحياز نحو الأرقام الصغيرة
    return minNumber + Math.floor(r * (maxNumber - minNumber + 1));
  }

  /** ينضم عدد من اللاعبين الوهميين على فترات متفرقة */
  addBots(n = this.count, spreadMs = 8000) {
    for (let k = 0; k < n; k++) {
      const bot = this.makeBot();
      this.later(Math.random() * spreadMs, () => this.onComment(bot, String(this.randomNumber())));
    }
  }

  onPhase({ phase }) {
    if (!this.running) return;
    if (phase === Phase.LOBBY && this.game.players.size === 0) {
      this.addBots(this.count);
    } else if (phase === Phase.CHOOSING) {
      const windowMs = (this.game.opt.chooseSeconds || 5) * 1000 * 0.8;
      for (const p of this.game.alivePlayers) {
        if (!p.isBot || Math.random() > this.changeChance) continue;
        const user = { id: p.id, uniqueId: p.uniqueId, nickname: p.nickname, avatar: p.avatar, isBot: true };
        this.later(Math.random() * windowMs, () => this.onComment(user, String(this.randomNumber())));
      }
    }
  }
}
