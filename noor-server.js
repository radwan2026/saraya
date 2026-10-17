import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';

import config from './noor.config.js';
import { NoorEngine } from './src/noor/engine.js';
import { QUESTIONS, CATEGORIES } from './src/noor/questions.js';
import { GiftStreaks, SAMPLE_GIFTS, GIFT_EFFECTS, classifyGift } from './src/noor/gifts.js';
import { NoorDemo } from './src/noor/demo.js';
import { TikTokSource } from './src/tiktok.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.length ? v.join('=') : true];
}));

const PORT = Number(args.port || process.env.PORT || config.port || 3000);
const USERNAME = String(args.user || process.env.TIKTOK_USERNAME || config.tiktokUsername || '').replace(/^@/, '');
const SIGN_KEY = String(args.key || process.env.SIGN_API_KEY || config.signApiKey || '');
const DEMO = Boolean(args.demo || process.env.DEMO === '1' || config.demo);
const SAVE_FILE = path.join(__dirname, 'data', 'noor-state.json');

// ------------------------------------------------------------------
// حفظ واسترجاع الحالة (لوحة الشرف والمستوى) بين مرات التشغيل
// ------------------------------------------------------------------
function loadSaved() {
  if (args.fresh) return null;
  try { return JSON.parse(fs.readFileSync(SAVE_FILE, 'utf8')); } catch { return null; }
}
function save() {
  try {
    fs.mkdirSync(path.dirname(SAVE_FILE), { recursive: true });
    fs.writeFileSync(SAVE_FILE, JSON.stringify(engine.toJSON()));
  } catch (err) { console.warn('[حفظ] تعذّر حفظ الحالة:', err.message); }
}

// ------------------------------------------------------------------
// الخادم
// ------------------------------------------------------------------
const app = express();
app.use('/noor', express.static(path.join(__dirname, 'public', 'noor')));
app.get('/', (_req, res) => res.redirect('/noor/'));
app.get('/admin', (_req, res) => res.redirect('/noor/admin.html'));

const server = http.createServer(app);
const io = new Server(server);

const engine = new NoorEngine(config.game, QUESTIONS, { saved: loadSaved() });
const tiktok = new TikTokSource({ signApiKey: SIGN_KEY });
const streaks = new GiftStreaks();
const settings = { audio: { ...config.audio }, showQuiz: true, showTicker: true };
const log = [];

function pushLog(entry) {
  const e = { at: Date.now(), ...entry };
  log.unshift(e);
  log.length = Math.min(log.length, 80);
  io.to('admin').emit('log', e);
}

// إرسال الحالة بشكل مُجمّع (كل 150ms كحد أقصى) لتخفيف الضغط عند كثرة التفاعل
let stateTimer = null;
engine.on('change', () => {
  if (stateTimer) return;
  stateTimer = setTimeout(() => {
    stateTimer = null;
    io.emit('state', engine.snapshot());
  }, 150);
});
engine.on('fx', (fx) => io.emit('fx', fx));
engine.on('quiz', (q) => io.emit('quiz', q));

// ------------------------------------------------------------------
// مصادر الأحداث: تيك توك، وضع التجربة، لوحة التحكم
// ------------------------------------------------------------------
const actions = {
  comment(user, text, source = 'demo') {
    const result = engine.handleComment(user, text);
    if (source !== 'demo' || result !== 'none') pushLog({ kind: 'comment', source, nickname: user.nickname, text, result });
  },
  like(user, count) { engine.handleLike(user, count); },
  gift(user, gift, source = 'demo') {
    const pts = engine.handleGift(user, gift);
    pushLog({ kind: 'gift', source, nickname: user.nickname, gift: gift.name, count: gift.count, diamonds: (gift.diamonds || 0) * gift.count, points: pts });
  },
  follow(user, source = 'demo') { engine.handleFollow(user); pushLog({ kind: 'follow', source, nickname: user.nickname }); },
  share(user, source = 'demo') { engine.handleShare(user); pushLog({ kind: 'share', source, nickname: user.nickname }); },
  member(user) { engine.handleMember(user); },
};

const demo = new NoorDemo(engine, actions, config.demoBots);

tiktok.on('status', (s) => {
  console.log(`[TikTok] ${s.message}`);
  io.emit('tiktokStatus', s);
});
tiktok.on('comment', ({ user, text }) => actions.comment(user, text, 'tiktok'));
tiktok.on('like', ({ user, count }) => actions.like(user, count));
tiktok.on('follow', ({ user }) => actions.follow(user, 'tiktok'));
tiktok.on('share', ({ user }) => actions.share(user, 'tiktok'));
tiktok.on('member', ({ user }) => actions.member(user));
tiktok.on('gift', ({ user, gift }) => {
  const count = streaks.resolve(user.id, gift);
  if (count > 0) actions.gift(user, { ...gift, count }, 'tiktok');
});

const manualUser = (name) => {
  const nickname = String(name || 'مختبر').slice(0, 30);
  return { id: `manual-${nickname}`, uniqueId: nickname, nickname, avatar: '' };
};

const meta = () => ({
  categories: CATEGORIES,
  sampleGifts: SAMPLE_GIFTS.map((g) => ({ ...g, kind: classifyGift(g.name) })),
  effects: GIFT_EFFECTS,
  usdPerDiamond: config.usdPerDiamond,
  questionCount: QUESTIONS.length,
  options: engine.opt,
});

io.on('connection', (socket) => {
  socket.emit('state', engine.snapshot());
  socket.emit('quiz', engine.quizPublic());
  socket.emit('settings', settings);
  socket.emit('tiktokStatus', tiktok.status());

  socket.on('admin:hello', () => {
    socket.join('admin');
    socket.emit('meta', meta());
    socket.emit('demoStatus', { running: demo.running });
    socket.emit('logAll', log);
  });

  // ---- اتصال تيك توك ----
  socket.on('admin:connect', (username) => tiktok.connect(username));
  socket.on('admin:disconnect', () => tiktok.disconnect());

  // ---- وضع التجربة ----
  socket.on('admin:demo', (on) => {
    if (on) demo.start(); else demo.stop();
    io.to('admin').emit('demoStatus', { running: demo.running });
  });

  // ---- محاكاة ----
  socket.on('admin:gift', ({ id, count, name } = {}) => {
    const g = SAMPLE_GIFTS.find((x) => x.id === id) || SAMPLE_GIFTS[0];
    const n = Math.max(1, Math.min(999, Number(count) || 1));
    actions.gift(manualUser(name), { ...g, count: n }, 'manual');
  });
  socket.on('admin:comment', ({ name, text } = {}) => actions.comment(manualUser(name), String(text || ''), 'manual'));
  socket.on('admin:like', ({ name, count } = {}) => actions.like(manualUser(name), Math.max(1, Math.min(5000, Number(count) || 50))));
  socket.on('admin:follow', ({ name } = {}) => actions.follow(manualUser(name), 'manual'));
  socket.on('admin:share', ({ name } = {}) => actions.share(manualUser(name), 'manual'));
  socket.on('admin:member', ({ name } = {}) => { engine.lastWelcome = 0; actions.member(manualUser(name)); });

  // ---- المسابقة ----
  socket.on('admin:quizAuto', (on) => engine.setQuizAuto(on));
  socket.on('admin:quizSkip', () => engine.skipQuiz());
  socket.on('admin:quizStop', () => engine.stopQuiz());
  socket.on('admin:quizOptions', (q = {}) => {
    const clean = {};
    for (const k of ['questionSeconds', 'revealSeconds', 'pauseSeconds']) {
      if (q[k] !== undefined) clean[k] = Math.max(3, Math.min(600, Number(q[k]) || 0));
    }
    if (Array.isArray(q.categories)) clean.categories = q.categories.filter((c) => c in CATEGORIES);
    engine.setOptions({ quiz: clean });
    socket.emit('meta', meta());
  });

  // ---- الأحداث والهدف ----
  socket.on('admin:challenge', (c) => engine.startChallenge(c));
  socket.on('admin:challengeStop', () => engine.finishChallenge(false));
  socket.on('admin:celebrate', () => engine.forceLevelUp());
  socket.on('admin:goal', (g) => engine.setGoal(g));
  socket.on('admin:resetLevel', () => engine.resetLevel());
  socket.on('admin:resetBoard', () => { engine.resetBoard(); save(); });
  socket.on('admin:say', (text) => io.emit('fx', { type: 'say', text: String(text || '').slice(0, 140) }));
  socket.on('admin:banner', (text) => io.emit('fx', { type: 'banner', text: String(text || '').slice(0, 80) }));

  // ---- الإعدادات (الصوت والعرض) ----
  socket.on('admin:settings', (patch = {}) => {
    if (patch.audio) {
      const a = patch.audio;
      if (['ambient', 'nature', 'off'].includes(a.mode)) settings.audio.mode = a.mode;
      for (const k of ['music', 'nature', 'sfx']) if (a[k] !== undefined) settings.audio[k] = Math.max(0, Math.min(1, Number(a[k]) || 0));
    }
    for (const k of ['showQuiz', 'showTicker']) if (typeof patch[k] === 'boolean') settings[k] = patch[k];
    io.emit('settings', settings);
  });
});

// تحديث دوري خفيف (للعدادات التنازلية والمضاعف) + حفظ الحالة
setInterval(() => io.emit('state', engine.snapshot()), 2000);
const saveTimer = setInterval(save, 15_000);

server.listen(PORT, () => {
  const base = `http://localhost:${PORT}`;
  console.log('==============================================');
  console.log('  🌙 واحة النور — لعبة إسلامية لبث تيك توك المباشر');
  console.log('==============================================');
  console.log(` شاشة اللعبة (للـ OBS / LIVE Studio): ${base}/noor/`);
  console.log(` لوحة التحكم:                        ${base}/admin`);
  console.log('');
  if (engine.opt.quiz.auto) engine.setQuizAuto(true);
  if (DEMO) {
    console.log(' وضع التجربة مفعّل: متابعون وهميون يتفاعلون الآن.');
    demo.start();
  }
  if (USERNAME) tiktok.connect(USERNAME);
  else if (!DEMO) console.log(' لم يُحدَّد حساب تيك توك. أدخله من لوحة التحكم أو شغّل: npm run noor -- --user=اسم_الحساب');
});

async function shutdown() {
  demo.stop();
  clearInterval(saveTimer);
  save();
  engine.destroy();
  await tiktok.disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
