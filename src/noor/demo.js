import { SAMPLE_GIFTS } from './gifts.js';

const NAMES = ['عبدالله', 'مريم', 'يوسف', 'فاطمة', 'عمر', 'خديجة', 'أنس', 'رقية', 'حمزة', 'آمنة', 'بلال', 'زينب',
  'إبراهيم', 'سمية', 'معاذ', 'حفصة', 'سلمان', 'أسماء', 'خالد', 'عائشة', 'طارق', 'هاجر', 'صهيب', 'نسيبة', 'زيد', 'سارة'];
const COLORS = ['#0f766e', '#7c3aed', '#b45309', '#1d4ed8', '#be123c', '#047857', '#9333ea', '#c2410c', '#0369a1', '#a16207'];
const DHIKR = ['سبحان الله', 'الحمد لله', 'الله أكبر', 'لا إله إلا الله', 'أستغفر الله', 'اللهم صل على محمد',
  'سبحان الله وبحمده', 'لا حول ولا قوة إلا بالله', 'الحمدلله', 'سبحان الله سبحان الله'];
const CHAT = ['السلام عليكم', 'ما شاء الله', 'جزاكم الله خيراً', 'بارك الله فيكم', 'اللهم آمين', 'تبارك الله'];
const LETTERS = ['أ', 'ب', 'ج', 'د'];

/** صورة رمزية SVG مولّدة محلياً بنمط زخرفي (لا تحتاج إنترنت) */
function avatarFor(name, i) {
  const bg = COLORS[i % COLORS.length];
  const letter = [...name][0] || '?';
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128">`
    + `<rect width="128" height="128" fill="${bg}"/>`
    + `<g fill="none" stroke="rgba(255,215,130,.45)" stroke-width="3">`
    + `<rect x="34" y="34" width="60" height="60"/><rect x="34" y="34" width="60" height="60" transform="rotate(45 64 64)"/></g>`
    + `<text x="64" y="80" font-size="44" font-family="Arial" font-weight="bold" fill="#fff" text-anchor="middle">${letter}</text>`
    + `</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/**
 * وضع التجربة: متابعون وهميون يذكرون الله، يجيبون عن الأسئلة، يرسلون إعجابات وهدايا.
 * actions: { comment(user,text), like(user,n), gift(user,gift), follow(user), share(user), member(user) }
 */
export class NoorDemo {
  constructor(engine, actions, { count = 24, speed = 1 } = {}) {
    this.engine = engine;
    this.actions = actions;
    this.bots = Array.from({ length: count }, (_, i) => {
      const nickname = NAMES[i % NAMES.length];
      return { id: `bot-${i}`, uniqueId: `${nickname}_${i}`, nickname, avatar: avatarFor(nickname, i), skill: 0.45 + Math.random() * 0.5 };
    });
    this.speed = speed;
    this.running = false;
    this.timer = null;
    this.answered = new Set();
    this.quizId = -1;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.tick();
  }

  stop() {
    this.running = false;
    clearTimeout(this.timer);
  }

  tick() {
    if (!this.running) return;
    this.step();
    this.timer = setTimeout(() => this.tick(), (350 + Math.random() * 700) / this.speed);
  }

  step() {
    const bot = pick(this.bots);
    const q = this.engine.quiz;
    if (q.id !== this.quizId) { this.quizId = q.id; this.answered.clear(); }

    // أثناء السؤال: معظم الحركة إجابات
    if (q.phase === 'question' && Math.random() < 0.6) {
      const free = this.bots.filter((b) => !this.answered.has(b.id));
      if (free.length) {
        const b = pick(free);
        this.answered.add(b.id);
        const correct = this.engine.peekCorrect();
        const idx = Math.random() < b.skill ? correct : Math.floor(Math.random() * 4);
        this.actions.comment(b, Math.random() < 0.7 ? String(idx + 1) : LETTERS[idx]);
        return;
      }
    }

    const r = Math.random();
    if (r < 0.34) this.actions.comment(bot, pick(DHIKR));
    else if (r < 0.52) this.actions.like(bot, 1 + Math.floor(Math.random() * 15));
    else if (r < 0.64) this.actions.gift(bot, { ...SAMPLE_GIFTS[0], count: 1 + Math.floor(Math.random() * 5) });
    else if (r < 0.72) this.actions.gift(bot, { ...SAMPLE_GIFTS[1], count: 1 + Math.floor(Math.random() * 3) });
    else if (r < 0.75) this.actions.gift(bot, { ...SAMPLE_GIFTS[3], count: 1 });
    else if (r < 0.77) this.actions.gift(bot, { ...SAMPLE_GIFTS[2], count: 1 });
    else if (r < 0.775) this.actions.gift(bot, { ...SAMPLE_GIFTS[5], count: 1 });
    else if (r < 0.80) this.actions.follow(bot);
    else if (r < 0.81) this.actions.share(bot);
    else if (r < 0.86) this.actions.member(bot);
    else this.actions.comment(bot, pick(CHAT));
  }
}
