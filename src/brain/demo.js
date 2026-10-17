import { Phase } from './game.js';
import { PUZZLES } from './puzzles.js';

const FIRST = ['أحمد', 'سارة', 'محمد', 'نور', 'ليلى', 'يوسف', 'مريم', 'عمر', 'هدى', 'خالد', 'ريم', 'علي',
  'فاطمة', 'زياد', 'جنى', 'حمزة', 'لين', 'سلمى', 'آدم', 'تالا', 'Ali', 'Lina', 'Sam', 'Maya', 'Omar', 'Zed'];
const SUFFIX = ['_gamer', '.x', '99', '_pro', '777', '_ksa', '_eg', '.official', '_01', '', '', ''];
const COLORS = ['#7c3aed', '#06b6d4', '#f59e0b', '#ef4444', '#10b981', '#ec4899', '#3b82f6', '#84cc16'];

function avatarFor(name, i) {
  const bg = COLORS[i % COLORS.length];
  const letter = [...name][0] || '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">`
    + `<rect width="128" height="128" fill="${bg}"/>`
    + `<text x="64" y="84" font-size="60" font-family="Arial" font-weight="bold" fill="#fff" text-anchor="middle">${letter}</text>`
    + `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/** إجابة خاطئة معقولة لكل نوع لغز (لتبدو المسابقة حقيقية في وضع التجربة) */
function wrongAnswer(pz) {
  if (pz.type === 'choice') {
    const n = pz.visual.options?.length || pz.visual.lanes?.length || 4;
    const wrong = Array.from({ length: n }, (_, i) => String(i + 1)).filter((v) => v !== pz.answer);
    return wrong[Math.floor(Math.random() * wrong.length)];
  }
  if (pz.type === 'code') {
    // خطأ شائع: رقم واحد خاطئ أو ترتيب معكوس
    const a = [...pz.answer];
    if (Math.random() < 0.4) return a.reverse().join('');
    const i = Math.floor(Math.random() * a.length);
    a[i] = String((Number(a[i]) + 1 + Math.floor(Math.random() * 8)) % 10);
    return a.join('');
  }
  return String(Number(pz.answer) + (Math.random() < 0.5 ? -1 : 1) * (1 + Math.floor(Math.random() * 12)));
}

/**
 * وضع التجربة: متسابقون وهميون يسجّلون في الاستوديو ويجيبون بنسب نجاح مختلفة.
 */
export class BrainDemoBots {
  constructor(game, onComment, { count = 14, accuracy = 0.55 } = {}) {
    this.game = game;
    this.onComment = onComment;
    this.count = count;
    this.accuracy = accuracy;
    this.running = false;
    this.timers = new Set();
    this.serial = 0;
    this.bots = [];
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
    // لكل متسابق وهمي «ذكاء» خاص به
    return { id: `bot-${i}`, uniqueId, nickname: first, avatar: avatarFor(first, i), isBot: true,
      skill: Math.min(0.95, Math.max(0.1, this.accuracy + (Math.random() - 0.5) * 0.6)) };
  }

  addBots(n = this.count, spreadMs = 8000) {
    for (let k = 0; k < n; k++) {
      const bot = this.makeBot();
      this.bots.push(bot);
      this.later(Math.random() * spreadMs, () => this.onComment(bot, ['جاهز', 'أنا معكم', '🔥', 'يلا'][k % 4]));
    }
  }

  onPhase({ phase }) {
    if (!this.running) return;
    if (phase === Phase.LOBBY && this.game.players.size === 0) {
      this.bots = [];
      this.addBots(this.count);
    } else if (phase === Phase.QUESTION) {
      const pz = PUZZLES[this.game.puzzle.id];
      const windowMs = Math.max(1000, (this.game.phaseEndsAt - this.game.phaseStartedAt) * 0.9);
      const minMs = pz.visual.hideAt ? 4000 : 2500;
      for (const bot of this.bots) {
        if (Math.random() < 0.12) continue; // بعضهم لا يلحق
        const correct = Math.random() < bot.skill;
        const at = minMs + (Math.random() ** (correct ? 1.3 : 0.8)) * (windowMs - minMs);
        const { skill, ...user } = bot;
        this.later(at, () => this.onComment(user, correct ? pz.answer : wrongAnswer(pz)));
      }
    }
  }
}
