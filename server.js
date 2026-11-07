import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';

import config from './config.js';
import { Game } from './src/game.js';
import { TikTokSource } from './src/tiktok.js';
import { DemoBots } from './src/demo.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ------------------------------------------------------------------
// قراءة خيارات سطر الأوامر: --user=xxx --port=3000 --demo --key=xxx
// ------------------------------------------------------------------
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.length ? v.join('=') : true];
}));

const PORT = Number(args.port || process.env.PORT || config.port || 3000);
const USERNAME = String(args.user || process.env.TIKTOK_USERNAME || config.tiktokUsername || '').replace(/^@/, '');
const SIGN_KEY = String(args.key || process.env.SIGN_API_KEY || config.signApiKey || '');
const DEMO = Boolean(args.demo || process.env.DEMO === '1' || config.demo);

// ------------------------------------------------------------------
// الخادم
// ------------------------------------------------------------------
const app = express();
app.use(express.static(path.join(__dirname, 'public')));
app.get('/admin', (_req, res) => res.sendFile(path.join(__dirname, 'public', 'admin.html')));

const server = http.createServer(app);
const io = new Server(server);

const game = new Game(config.game);
const tiktok = new TikTokSource({ signApiKey: SIGN_KEY });
const commentLog = [];

function handleComment(user, text, source) {
  const result = game.handleComment(user, text);
  const entry = { at: Date.now(), source, nickname: user.nickname, uniqueId: user.uniqueId, text, result };
  commentLog.unshift(entry);
  commentLog.length = Math.min(commentLog.length, 50);
  io.emit('comment', entry);
  return result;
}

const bots = new DemoBots(game, (user, text) => handleComment(user, text, 'demo'), config.demoBots);

// بث أحداث اللعبة لكل الصفحات المتصلة
for (const ev of ['state', 'join', 'numberChanged', 'roundResult', 'winner']) {
  game.on(ev, (payload) => io.emit(ev, payload));
}
tiktok.on('status', (s) => {
  console.log(`[TikTok] ${s.message}`);
  io.emit('tiktokStatus', s);
});
tiktok.on('comment', ({ user, text }) => handleComment(user, text, 'tiktok'));

const demoStatus = () => ({ running: bots.running });

io.on('connection', (socket) => {
  socket.emit('state', game.snapshot());
  socket.emit('tiktokStatus', tiktok.status());
  socket.emit('demoStatus', demoStatus());
  socket.emit('commentLog', commentLog);

  // ---- أوامر لوحة التحكم ----
  socket.on('admin:start', () => game.start());
  socket.on('admin:skip', () => game.skip());
  socket.on('admin:reset', () => game.resetToLobby());
  socket.on('admin:demo', (on) => {
    if (on) bots.start(); else bots.stop();
    io.emit('demoStatus', demoStatus());
  });
  socket.on('admin:addBots', (n) => {
    const count = Math.max(1, Math.min(100, Number(n) || 5));
    bots.addBots(count, 3000);
  });
  socket.on('admin:connect', (username) => tiktok.connect(username));
  socket.on('admin:disconnect', () => tiktok.disconnect());
  socket.on('admin:comment', ({ name, text } = {}) => {
    const nickname = String(name || 'مختبر').slice(0, 30);
    handleComment({ id: `manual-${nickname}`, uniqueId: nickname, nickname, avatar: '' }, String(text || ''), 'manual');
  });
});

server.listen(PORT, () => {
  const base = `http://localhost:${PORT}`;
  console.log('==============================================');
  console.log(' لعبة الضوء الأحمر / الضوء الأخضر — تيك توك لايف');
  console.log('==============================================');
  console.log(` شاشة اللعبة (للـ OBS / LIVE Studio): ${base}/`);
  console.log(` لوحة التحكم:                        ${base}/admin`);
  console.log('');
  if (DEMO) {
    console.log(' وضع التجربة مفعّل: سيتم توليد لاعبين وهميين.');
    bots.start();
  }
  if (USERNAME) tiktok.connect(USERNAME);
  else if (!DEMO) console.log(' لم يُحدَّد حساب تيك توك. أدخله من لوحة التحكم أو شغّل: npm start -- --user=اسم_الحساب');
});

async function shutdown() {
  bots.stop();
  game.destroy();
  await tiktok.disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
