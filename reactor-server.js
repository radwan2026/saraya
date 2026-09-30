import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';

import config from './reactor.config.js';
import { ReactorGame, TEAMS } from './src/reactor/game.js';
import { ReactorDemo, DEMO_GIFTS } from './src/reactor/demo.js';
import { TikTokSource } from './src/tiktok.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ------------------------------------------------------------------
// خيارات سطر الأوامر: --user=xxx --port=3001 --demo --key=xxx
// ------------------------------------------------------------------
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.length ? v.join('=') : true];
}));

const PORT = Number(args.port || process.env.PORT || config.port || 3001);
const USERNAME = String(args.user || process.env.TIKTOK_USERNAME || config.tiktokUsername || '').replace(/^@/, '');
const SIGN_KEY = String(args.key || process.env.SIGN_API_KEY || config.signApiKey || '');
const DEMO = Boolean(args.demo || process.env.DEMO === '1' || config.demo);

// ------------------------------------------------------------------
// الخادم
// ------------------------------------------------------------------
const app = express();
const pub = path.join(__dirname, 'public', 'reactor');
app.use(express.static(pub));
app.get('/vendor/alpine.js', (_req, res) => res.sendFile(path.join(__dirname, 'node_modules', 'alpinejs', 'dist', 'cdn.min.js')));
app.get('/admin', (_req, res) => res.sendFile(path.join(pub, 'admin.html')));

const server = http.createServer(app);
const io = new Server(server);

const game = new ReactorGame(config.game);
const tiktok = new TikTokSource({ signApiKey: SIGN_KEY });
const eventLog = [];

function log(entry) {
  const e = { at: Date.now(), ...entry };
  eventLog.unshift(e);
  eventLog.length = Math.min(eventLog.length, 60);
  io.to('admin').emit('log', e);
}

const actions = {
  comment(user, text, source = 'tiktok') {
    const result = game.handleComment(user, text);
    if (result !== 'ignored' || source !== 'tiktok') log({ kind: 'comment', source, nickname: user.nickname, text, result });
    return result;
  },
  like(user, count, source = 'tiktok') {
    return game.handleLike(user, count);
  },
  gift(user, gift, count, source = 'tiktok') {
    const result = game.handleGift(user, gift, count);
    log({ kind: 'gift', source, nickname: user.nickname, text: `${gift.name} ×${count} (${gift.diamonds * count} 🪙)`, result });
    return result;
  },
};

const demo = new ReactorDemo(game, {
  comment: (u, t) => actions.comment(u, t, 'demo'),
  like: (u, c) => actions.like(u, c, 'demo'),
  gift: (u, g, c) => actions.gift(u, g, c, 'demo'),
}, config.demoBots);

// بث أحداث اللعبة لكل الصفحات المتصلة
for (const ev of ['state', 'tick', 'roster', 'fx', 'commander', 'victory', 'phase', 'round']) {
  game.on(ev, (payload) => io.emit(ev, payload));
}
tiktok.on('status', (s) => {
  console.log(`[TikTok] ${s.message}`);
  io.emit('tiktokStatus', s);
});
tiktok.on('comment', ({ user, text }) => actions.comment(user, text));
tiktok.on('like', ({ user, count }) => actions.like(user, count));
tiktok.on('gift', ({ user, gift, count }) => actions.gift(user, gift, count));

const demoStatus = () => ({ running: demo.running });

io.on('connection', (socket) => {
  socket.emit('state', game.snapshot());
  socket.emit('tiktokStatus', tiktok.status());

  socket.on('admin:hello', () => {
    socket.join('admin');
    socket.emit('demoStatus', demoStatus());
    socket.emit('logAll', eventLog);
    socket.emit('demoGifts', DEMO_GIFTS);
  });

  // ---- أوامر لوحة التحكم ----
  socket.on('admin:restart', () => game.restartRound());
  socket.on('admin:skip', () => game.skip());
  socket.on('admin:resetSession', () => game.resetSession());
  socket.on('admin:demo', (on) => {
    if (on) demo.start(); else demo.stop();
    io.emit('demoStatus', demoStatus());
  });
  socket.on('admin:addBots', (n) => demo.addBots(Math.max(1, Math.min(100, Number(n) || 5)), 3000));
  socket.on('admin:connect', (username) => tiktok.connect(username));
  socket.on('admin:disconnect', () => tiktok.disconnect());

  // محاكاة يدوية من لوحة التحكم
  const manualUser = (name) => {
    const nickname = String(name || 'مختبر').slice(0, 30);
    return { id: `manual-${nickname}`, uniqueId: nickname, nickname, avatar: '' };
  };
  socket.on('admin:comment', ({ name, text } = {}) => actions.comment(manualUser(name), String(text || ''), 'manual'));
  socket.on('admin:like', ({ name, count } = {}) => actions.like(manualUser(name), Number(count) || 10, 'manual'));
  socket.on('admin:gift', ({ name, gift, count } = {}) => {
    if (!gift || typeof gift.name !== 'string') return;
    actions.gift(manualUser(name), { name: gift.name.slice(0, 40), diamonds: Math.max(1, Number(gift.diamonds) || 1) }, Math.max(1, Math.min(99, Number(count) || 1)), 'manual');
  });
});

game.start(10);

server.listen(PORT, () => {
  const base = `http://localhost:${PORT}`;
  console.log('==============================================');
  console.log(' ⚛  حصار المفاعل — Reactor Siege — تيك توك لايف');
  console.log('==============================================');
  console.log(` شاشة اللعبة (للـ OBS / LIVE Studio): ${base}/`);
  console.log(` لوحة التحكم:                        ${base}/admin`);
  console.log(` الفرق: ${TEAMS.join(' / ')} — مدة الجولة ${config.game.battleSeconds} ثانية`);
  console.log('');
  if (DEMO) {
    console.log(' وضع التجربة مفعّل: جنود وهدايا وهمية.');
    demo.start();
  }
  if (USERNAME) tiktok.connect(USERNAME);
  else if (!DEMO) console.log(' لم يُحدَّد حساب تيك توك. أدخله من لوحة التحكم أو شغّل: npm run reactor -- --user=اسم_الحساب');
});

async function shutdown() {
  demo.stop();
  game.destroy();
  await tiktok.disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
