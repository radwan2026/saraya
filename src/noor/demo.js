import { DEMO_NAMES } from './content.js';

const COLORS = ['#1f6f5c', '#8a5a1f', '#2d4a8a', '#6b3f8a', '#8a2d4a', '#2d7a8a', '#5a6b1f', '#7a4a2d'];
const COMMENTS = ['سبحان الله', 'الحمد لله', 'الله أكبر', 'لا إله إلا الله', 'أستغفر الله', 'اللهم صل على محمد',
  'سبحان الله وبحمده', 'لا حول ولا قوة إلا بالله', 'ما شاء الله', 'السلام عليكم', 'جزاكم الله خيراً'];
const TEAM_WORDS = ['1', '2', '3', '4', 'الصبر', 'الشكر', 'إحسان', 'التقوى'];
// هدايا تجريبية بأسمائها في تيك توك وقيمتها بالعملات، والوزن = احتمال الظهور
export const DEMO_GIFTS = [
  { name: 'Rose', coins: 1, weight: 40, streak: true },
  { name: 'Heart Me', coins: 1, weight: 22, streak: true },
  { name: 'Finger Heart', coins: 5, weight: 10, streak: true },
  { name: 'Perfume', coins: 20, weight: 8, streak: true },
  { name: 'Doughnut', coins: 30, weight: 8, streak: true },
  { name: 'Hand Hearts', coins: 100, weight: 3, streak: false },
  { name: 'Galaxy', coins: 1000, weight: 1, streak: false },
];

/** صورة رمزية SVG مولّدة محلياً بزخرفة نجمة ثمانية */
export function avatarFor(name, i) {
  const bg = COLORS[i % COLORS.length];
  const letter = [...String(name)][0] || '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128">`
    + `<rect width="128" height="128" fill="${bg}"/>`
    + `<g fill="none" stroke="rgba(255,255,255,.22)" stroke-width="3"><rect x="34" y="34" width="60" height="60"/>`
    + `<rect x="34" y="34" width="60" height="60" transform="rotate(45 64 64)"/></g>`
    + `<text x="64" y="80" font-size="46" font-family="Arial" font-weight="bold" fill="#fff" text-anchor="middle">${letter}</text>`
    + `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

function pick(list) { return list[Math.floor(Math.random() * list.length)]; }

function weighted(list) {
  const sum = list.reduce((s, g) => s + g.weight, 0);
  let r = Math.random() * sum;
  for (const g of list) { r -= g.weight; if (r <= 0) return g; }
  return list[0];
}

/**
 * وضع التجربة: متابعون وهميون يعلّقون ويذكرون الله ويجيبون الأسئلة ويرسلون الهدايا والإعجابات.
 * handlers: { comment(user,text), gift(user,{name,coins,count}), like(user,n), follow(user), share(user) }
 */
export class NoorDemo {
  constructor(engine, handlers) {
    this.engine = engine;
    this.h = handlers;
    this.running = false;
    this.bots = [];
    this.timer = null;
    for (let i = 0; i < 28; i++) {
      const name = DEMO_NAMES[i % DEMO_NAMES.length];
      this.bots.push({ id: `demo-${i}`, uniqueId: `${name}_${i}`.replace(/\s/g, ''), nickname: name, avatar: avatarFor(name, i), isBot: true });
    }
  }

  start() {
    if (this.running) return;
    this.running = true;
    const loop = () => {
      if (!this.running) return;
      this.tick();
      this.timer = setTimeout(loop, 500 + Math.random() * 900);
    };
    loop();
  }

  stop() {
    this.running = false;
    clearTimeout(this.timer);
  }

  tick() {
    const bot = pick(this.bots);
    const quiz = this.engine.quiz;
    const r = Math.random();
    if (quiz && !quiz.revealed && !quiz.answers.has(bot.id) && r < 0.55) {
      // معظم الوهميين يعرفون الإجابة
      const choice = Math.random() < 0.65 ? quiz.answer : Math.floor(Math.random() * 4);
      this.h.comment(bot, ['أ', 'ب', 'ج', 'د'][choice]);
    } else if (r < 0.12) {
      this.h.comment(bot, pick(TEAM_WORDS));
    } else if (r < 0.5) {
      this.h.comment(bot, pick(COMMENTS));
    } else if (r < 0.68) {
      this.h.like(bot, 5 + Math.floor(Math.random() * 40));
    } else if (r < 0.95) {
      this.sendGift(bot);
    } else if (r < 0.975) {
      this.h.follow(bot);
    } else {
      this.h.share(bot);
    }
  }

  sendGift(bot, gift = weighted(DEMO_GIFTS)) {
    const count = gift.streak && Math.random() < 0.4 ? 2 + Math.floor(Math.random() * 9) : 1;
    this.h.gift(bot, { name: gift.name, coins: gift.coins, count });
  }

  /** دفعة نشاط سريعة (زر في لوحة التحكم) */
  burst(n = 15) {
    for (let i = 0; i < n; i++) setTimeout(() => this.tick(), i * 150);
  }
}
