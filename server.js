import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';

import config from './config.js';
import { Game } from './src/game.js';
import { TikTokSource } from './src/tiktok.js';
import { DemoBots } from './src/demo.js';
import { BrainGame } from './src/brain/game.js';
import { BrainDemoBots } from './src/brain/demo.js';

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
const MODE = String(args.game || process.env.GAME || config.gameMode || 'redlight') === 'brain' ? 'brain' : 'redlight';

// ------------------------------------------------------------------
// الخادم
// ------------------------------------------------------------------
const app = express();
const pages = MODE === 'brain'
  ? { game: path.join(__dirname, 'public', 'brain', 'index.html'), admin: path.join(__dirname, 'public', 'brain', 'admin.html') }
  : { game: path.join(__dirname, 'public', 'index.html'), admin: path.join(__dirname, 'public', 'admin.html') };
app.get(['/', '/index.html'], (_req, res) => res.sendFile(pages.game));
app.get('/admin', (_req, res) => res.sendFile(pages.admin));
app.use(express.static(path.join(__dirname, 'public')));

const server = http.createServer(app);
const io = new Server(server);

const game = MODE === 'brain' ? new BrainGame(config.brain) : new Game(config.game);
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

const onBotComment = (user, text) => handleComment(user, text, 'demo');
const bots = MODE === 'brain'
  ? new BrainDemoBots(game, onBotComment, config.brainDemoBots)
  : new DemoBots(game, onBotComment, config.demoBots);

// بث أحداث اللعبة لكل الصفحات المتصلة
const EVENTS = MODE === 'brain'
  ? ['state', 'join', 'answer', 'reveal', 'winner']
  : ['state', 'join', 'numberChanged', 'roundResult', 'winner'];
for (const ev of EVENTS) {
  game.on(ev, (payload) => io.emit(ev, payload));
}
// معلومات للمضيف فقط (مثل الإجابة الصحيحة) تُرسل لصفحات لوحة التحكم وحدها
const hostInfo = () => (typeof game.hostInfo === 'function' ? game.hostInfo() : null);
game.on('state', () => io.to('admin').emit('hostInfo', hostInfo()));
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
  socket.on('admin:hello', () => { socket.join('admin'); socket.emit('hostInfo', hostInfo()); });
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
  console.log(MODE === 'brain' ? ' خارج الصندوق | تحدّي العقل — تيك توك لايف' : ' لعبة الضوء الأحمر / الضوء الأخضر — تيك توك لايف');
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
