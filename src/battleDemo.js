import { BPhase } from './battle.js';

const FIRST = ['أحمد', 'سارة', 'محمد', 'نور', 'ليلى', 'يوسف', 'مريم', 'عمر', 'هدى', 'خالد', 'ريم', 'علي',
  'فاطمة', 'زياد', 'جنى', 'حمزة', 'لين', 'سلمى', 'آدم', 'تالا', 'فهد', 'دانة', 'Ali', 'Lina', 'Sam', 'Maya'];
const SUFFIX = ['_gamer', '.x', '99', '_pro', '777', '_ksa', '_eg', '_01', '', ''];
const COLORS = ['#e6194b', '#3cb44b', '#ffe119', '#4363d8', '#f58231', '#911eb4', '#46f0f0', '#f032e6', '#008080'];
const CHAT = ['يلا يلا 🔥', 'نحن الأقوى 💪', 'لايك لايك', 'هههههه', 'وين الفريق؟', '❤️❤️', 'كملوا', 'فزعة يا شباب', 'GG', '🔥🔥🔥'];

// هدايا تجريبية (القيمة بالعملات) مع أوزان احتمالية
export const DEMO_GIFTS = [
  { name: 'وردة', emoji: '🌹', diamonds: 1, weight: 40 },
  { name: 'تيك توك', emoji: '🎵', diamonds: 1, weight: 20 },
  { name: 'قلب الأصابع', emoji: '🫰', diamonds: 5, weight: 14 },
  { name: 'عطر', emoji: '🧴', diamonds: 20, weight: 8 },
  { name: 'دونات', emoji: '🍩', diamonds: 30, weight: 6 },
  { name: 'قبعة وشارب', emoji: '🎩', diamonds: 99, weight: 4 },
  { name: 'قلوب اليد', emoji: '🫶', diamonds: 100, weight: 3 },
  { name: 'كورجي', emoji: '🐶', diamonds: 299, weight: 1.6 },
  { name: 'المجرّة', emoji: '🌌', diamonds: 1000, weight: 0.35 },
  { name: 'الأسد', emoji: '🦁', diamonds: 29999, weight: 0.02 },
];

function avatarFor(name, i) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="${COLORS[i % COLORS.length]}"/>`
    + `<text x="64" y="84" font-size="60" font-family="Arial" font-weight="bold" fill="#fff" text-anchor="middle">${[...name][0]}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

/**
 * وضع التجربة: متابعون وهميون ينضمون للفرق ويعلّقون ويضغطون لايك ويرسلون هدايا.
 * handlers: { comment(user,text), like(user,count), gift(user,gift), follow(user), share(user) }
 */
export class BattleDemo {
  constructor(battle, handlers, { count = 24, activity = 1 } = {}) {
    this.battle = battle;
    this.h = handlers;
    this.count = count;
    this.activity = activity;
    this.running = false;
    this.bots = [];
    this.serial = 0;
    this.timers = new Set();
    this.loop = null;
  }

  makeBot() {
    const i = this.serial++;
    const first = FIRST[Math.floor(Math.random() * FIRST.length)];
    const uniqueId = `${first}${SUFFIX[Math.floor(Math.random() * SUFFIX.length)]}${i}`;
    return { id: `bot-${i}`, uniqueId, nickname: first, avatar: avatarFor(first, i), isBot: true, joined: false };
  }

  later(ms, fn) {
    const t = setTimeout(() => { this.timers.delete(t); if (this.running) fn(); }, ms);
    this.timers.add(t);
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.addBots(this.count);
    this.loop = setInterval(() => this.step(), 400);
  }

  stop() {
    this.running = false;
    clearInterval(this.loop);
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  addBots(n, spreadMs = 10_000) {
    const teams = this.battle.teams;
    for (let k = 0; k < n; k++) {
      const bot = this.makeBot();
      this.bots.push(bot);
      this.later(Math.random() * spreadMs, () => {
        // انحياز بسيط لفريق ما حتى تكون المنافسة غير متساوية
        const r = Math.random() ** 1.3;
        const team = teams[Math.floor(r * teams.length)];
        bot.joined = true;
        this.h.comment(bot, String(team.id));
      });
    }
  }

  randomGift() {
    const total = DEMO_GIFTS.reduce((s, g) => s + g.weight, 0);
    let r = Math.random() * total;
    for (const g of DEMO_GIFTS) {
      r -= g.weight;
      if (r <= 0) return g;
    }
    return DEMO_GIFTS[0];
  }

  step() {
    if (!this.running) return;
    const joined = this.bots.filter((b) => b.joined);
    if (!joined.length) return;
    const bot = () => joined[Math.floor(Math.random() * joined.length)];
    const a = this.activity;
    const inBattle = this.battle.phase === BPhase.BATTLE;
    if (!inBattle) {
      if (Math.random() < 0.04 * a) this.h.comment(bot(), CHAT[Math.floor(Math.random() * CHAT.length)]);
      return;
    }
    const final = this.battle.isFinal ? 2 : 1;
    if (Math.random() < 0.8 * a) this.h.like(bot(), 1 + Math.floor(Math.random() * 12));
    if (Math.random() < 0.35 * a) this.h.comment(bot(), CHAT[Math.floor(Math.random() * CHAT.length)]);
    if (Math.random() < 0.09 * a * final) {
      const g = this.randomGift();
      const count = g.diamonds < 10 ? 1 + Math.floor(Math.random() * 5) : 1;
      this.h.gift(bot(), { name: g.name, emoji: g.emoji, diamonds: g.diamonds, count, coins: g.diamonds * count, image: '' });
    }
    if (Math.random() < 0.012 * a) this.h.follow(bot());
    if (Math.random() < 0.008 * a) this.h.share(bot());
    // متابعون جدد يصلون للبث
    if (Math.random() < 0.01 * a && this.bots.length < 300) this.addBots(1, 1000);
  }
}
