import { Phase, TEAMS } from './game.js';

const FIRST = ['أحمد', 'سارة', 'محمد', 'نور', 'ليلى', 'يوسف', 'مريم', 'عمر', 'هدى', 'خالد', 'ريم', 'علي',
  'فاطمة', 'زياد', 'جنى', 'حمزة', 'لين', 'سلمى', 'آدم', 'تالا', 'Ali', 'Lina', 'Sam', 'Maya', 'Omar', 'Zed'];
const SUFFIX = ['_gamer', '.x', '99', '_pro', '777', '_ksa', '_eg', '.official', '_01', ''];
const COLORS = ['#1e90ff', '#ff3b5c', '#8a5cff', '#00d1b2', '#ffb020', '#ff6a3d', '#3ddc84', '#e040fb'];

// هدايا وهمية بأسعارها الحقيقية تقريباً (بالعملات)
export const DEMO_GIFTS = {
  small: [{ name: 'Rose', diamonds: 1 }, { name: 'Rose', diamonds: 1 }, { name: 'Finger Heart', diamonds: 5 }],
  medium: [{ name: 'TikTok', diamonds: 1 }, { name: 'Perfume', diamonds: 20 }, { name: 'Hand Hearts', diamonds: 100 }],
  big: [{ name: 'Lion', diamonds: 29999 }, { name: 'Whale diving', diamonds: 2150 }, { name: 'Universe', diamonds: 34999 }],
};

function avatarFor(name, i) {
  const bg = COLORS[i % COLORS.length];
  const letter = [...name][0] || '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">`
    + `<rect width="128" height="128" fill="${bg}"/>`
    + `<text x="64" y="84" font-size="58" font-family="Arial" font-weight="bold" fill="#fff" text-anchor="middle">${letter}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * وضع التجربة: جنود وهميون ينضمون ويكبّسون ويرسلون هدايا لتجربة اللعبة كاملة بدون بث.
 * callbacks: { comment(user, text), like(user, count), gift(user, gift, count) }
 */
export class ReactorDemo {
  constructor(game, callbacks, { count = 24, giftsPerMinute = 30, bigGiftEverySeconds = 75 } = {}) {
    this.game = game;
    this.cb = callbacks;
    this.count = count;
    this.giftsPerMinute = giftsPerMinute;
    this.bigEvery = bigGiftEverySeconds;
    this.running = false;
    this.bots = [];
    this.serial = 0;
    this.timers = new Set();
    this.favored = 'blue';
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.addBots(this.count);
    this.loop = setInterval(() => this.step(), 500);
    this.swing = setInterval(() => { this.favored = Math.random() < 0.5 ? 'blue' : 'red'; }, 20_000);
    this.lastBig = Date.now();
  }

  stop() {
    this.running = false;
    clearInterval(this.loop);
    clearInterval(this.swing);
    for (const t of this.timers) clearTimeout(t);
    this.timers.clear();
  }

  later(ms, fn) {
    const t = setTimeout(() => { this.timers.delete(t); fn(); }, ms);
    this.timers.add(t);
  }

  makeBot() {
    const i = this.serial++;
    const first = pick(FIRST);
    const uniqueId = `${first}${pick(SUFFIX)}${i}`.replace(/\s/g, '');
    return { id: `bot-${i}`, uniqueId, nickname: first, avatar: avatarFor(first, i), isBot: true };
  }

  addBots(n, spreadMs = 6000) {
    for (let k = 0; k < n; k++) {
      const bot = this.makeBot();
      this.bots.push(bot);
      this.later(Math.random() * spreadMs, () => this.cb.comment(bot, k % 2 ? '2' : '1'));
    }
  }

  botOf(team) {
    const list = this.bots.filter((b) => this.game.members.get(b.id)?.team === team);
    return list.length ? pick(list) : null;
  }

  step() {
    if (!this.running || this.game.phase !== Phase.BATTLE) return;
    if (this.game.members.size === 0) { this.bots = []; this.addBots(this.count, 3000); return; }

    const teamFor = () => (Math.random() < 0.62 ? this.favored : pick(TEAMS));

    // تكبيس مستمر من الطرفين
    for (let i = 0; i < 3; i++) {
      const b = this.botOf(pick(TEAMS));
      if (b && Math.random() < 0.7) this.cb.like(b, 1 + Math.floor(Math.random() * 12));
    }

    // ورود (أحياناً كومبو)
    if (Math.random() < this.giftsPerMinute / 120) {
      const b = this.botOf(teamFor());
      if (b) {
        const gift = pick(DEMO_GIFTS.small);
        const combo = Math.random() < 0.3 ? 2 + Math.floor(Math.random() * 6) : 1;
        for (let c = 0; c < combo; c++) this.later(c * 250, () => this.cb.gift(b, gift, 1));
      }
    }

    // هدايا متوسطة
    if (Math.random() < 1 / 36) {
      const b = this.botOf(teamFor());
      if (b) this.cb.gift(b, pick(DEMO_GIFTS.medium), 1);
    }

    // هدية كبرى
    if (Date.now() - this.lastBig > this.bigEvery * 1000 * (0.6 + Math.random() * 0.8)) {
      this.lastBig = Date.now();
      // الفريق الخاسر هو من يرد غالباً — لإثارة التحدي
      const losing = this.game.core > 0 ? 'red' : 'blue';
      const b = this.botOf(Math.random() < 0.7 ? losing : pick(TEAMS));
      if (b) this.cb.gift(b, pick(DEMO_GIFTS.big), 1);
    }
  }
}
