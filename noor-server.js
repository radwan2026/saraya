import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';

import config from './config.js';
import { NoorEngine } from './src/noor/engine.js';
import { NoorDemo } from './src/noor/demo.js';
import { SettingsStore } from './src/noor/settings.js';
import { TikTokSource } from './src/tiktok.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ------------------------------------------------------------------
// خيارات سطر الأوامر: --user=xxx --port=3100 --demo --key=xxx
// ------------------------------------------------------------------
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.length ? v.join('=') : true];
}));

const PORT = Number(args.port || process.env.NOOR_PORT || 3100);
const USERNAME = String(args.user || process.env.TIKTOK_USERNAME || config.tiktokUsername || '').replace(/^@/, '');
const SIGN_KEY = String(args.key || process.env.SIGN_API_KEY || config.signApiKey || '');
const DEMO = Boolean(args.demo || process.env.DEMO === '1');

// ------------------------------------------------------------------
// الخادم
// ------------------------------------------------------------------
const app = express();
const pub = path.join(__dirname, 'public', 'noor');
app.use(express.static(pub));
app.get('/admin', (_req, res) => res.sendFile(path.join(pub, 'admin.html')));

const server = http.createServer(app);
const io = new Server(server);

const store = new SettingsStore(path.join(__dirname, 'data', 'noor-settings.json'));
const engine = new NoorEngine(store.values);
const tiktok = new TikTokSource({ signApiKey: SIGN_KEY });
const logs = [];

// إرسال الحالة بحد أقصى ~6 مرات في الثانية حتى لا تُغرق الإعجابات الكثيفة الشاشة
let stateQueued = false;
function pushState() {
  if (stateQueued) return;
  stateQueued = true;
  setTimeout(() => {
    stateQueued = false;
    io.emit('state', engine.snapshot());
  }, 160);
}
engine.on('state', pushState);
engine.on('fx', (fx) => io.emit('fx', fx));
engine.on('log', (entry) => {
  logs.unshift(entry);
  logs.length = Math.min(logs.length, 80);
  io.emit('log', entry);
});

const handlers = {
  comment: (user, text) => engine.handleComment(user, text),
  gift: (user, gift) => engine.handleGift(user, gift),
  like: (user, count) => engine.handleLike(user, count),
  follow: (user) => engine.handleFollow(user),
  share: (user) => engine.handleShare(user),
};
const demo = new NoorDemo(engine, handlers);

tiktok.on('status', (s) => {
  console.log(`[TikTok] ${s.message}`);
  io.emit('tiktokStatus', s);
});
tiktok.on('comment', ({ user, text }) => handlers.comment(user, text));
tiktok.on('gift', ({ user, gift }) => handlers.gift(user, gift));
tiktok.on('like', ({ user, count }) => handlers.like(user, count));
tiktok.on('follow', ({ user }) => handlers.follow(user));
tiktok.on('share', ({ user }) => handlers.share(user));

const settingsPayload = () => store.values;
const demoStatus = () => ({ running: demo.running });

function manualUser(name) {
  const nickname = String(name || 'مختبر').trim().slice(0, 30) || 'مختبر';
  return { id: `manual-${nickname}`, uniqueId: nickname, nickname, avatar: '' };
}

io.on('connection', (socket) => {
  socket.emit('settings', settingsPayload());
  socket.emit('state', engine.snapshot());
  socket.emit('tiktokStatus', tiktok.status());
  socket.emit('demoStatus', demoStatus());
  socket.emit('logs', logs);

  // ---- أوامر لوحة التحكم ----
  socket.on('admin:newRound', () => engine.newRound());
  socket.on('admin:finishRound', () => engine.finishRound('manual'));
  socket.on('admin:pause', () => engine.pause());
  socket.on('admin:resume', () => engine.resume());
  socket.on('admin:resetSession', () => engine.resetSession());
  socket.on('admin:quiz', () => engine.startQuiz());
  socket.on('admin:endQuiz', () => engine.endQuiz());
  socket.on('admin:connect', (username) => tiktok.connect(username));
  socket.on('admin:disconnect', () => tiktok.disconnect());
  socket.on('admin:demo', (on) => {
    if (on) demo.start(); else demo.stop();
    io.emit('demoStatus', demoStatus());
  });
  socket.on('admin:burst', () => demo.burst(20));
  socket.on('admin:settings', (patch) => {
    store.update(patch || {});
    engine.updateSettings(store.values);
    io.emit('settings', settingsPayload());
  });
  socket.on('admin:resetSettings', () => {
    store.reset();
    engine.updateSettings(store.values);
    io.emit('settings', settingsPayload());
  });

  // ---- محاكاة يدوية للتجربة ----
  socket.on('sim:comment', ({ name, text } = {}) => handlers.comment(manualUser(name), String(text || '')));
  socket.on('sim:gift', ({ name, gift, coins, count } = {}) => handlers.gift(manualUser(name), {
    name: String(gift || 'Rose'), coins: Number(coins) || 1, count: Math.min(99, Math.max(1, Number(count) || 1)),
  }));
  socket.on('sim:like', ({ name, count } = {}) => handlers.like(manualUser(name), Number(count) || 50));
  socket.on('sim:follow', ({ name } = {}) => handlers.follow(manualUser(name)));
  socket.on('sim:share', ({ name } = {}) => handlers.share(manualUser(name)));
});

server.listen(PORT, () => {
  const base = `http://localhost:${PORT}`;
  console.log('==============================================');
  console.log(' 🌙 منارة النور — لعبة تيك توك لايف الإسلامية');
  console.log('==============================================');
  console.log(` شاشة اللعبة (للـ OBS / LIVE Studio): ${base}/`);
  console.log(` لوحة التحكم:                        ${base}/admin`);
  console.log('');
  if (DEMO) {
    console.log(' وضع التجربة مفعّل: متابعون وهميون يرسلون تعليقات وهدايا.');
    demo.start();
  }
  if (USERNAME) tiktok.connect(USERNAME);
  else if (!DEMO) console.log(' أدخل اسم حساب تيك توك من لوحة التحكم أو شغّل: npm run noor -- --user=اسم_الحساب');
});

async function shutdown() {
  demo.stop();
  engine.destroy();
  await tiktok.disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
