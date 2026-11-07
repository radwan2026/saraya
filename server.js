import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';

import config from './config.js';
import { Game } from './src/game.js';
import { PlanetsGame } from './src/planets.js';
import { GAMES, catalog } from './src/catalog.js';
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
const START_GAME = String(args.game || process.env.GAME || config.activeGame || 'redlight');

// ------------------------------------------------------------------
// الخادم
// ------------------------------------------------------------------
const app = express();
const PUBLIC = path.join(__dirname, 'public');
// الصفحة الرئيسية "/" تعرض اللعبة النشطة حالياً (رابط ثابت لـ OBS / LIVE Studio)
app.get(['/', '/index.html'], (_req, res) => res.sendFile(path.join(PUBLIC, GAMES[activeId].page)));
app.get('/redlight', (_req, res) => res.sendFile(path.join(PUBLIC, 'index.html')));
app.get('/planets', (_req, res) => res.sendFile(path.join(PUBLIC, 'planets.html')));
app.get('/games', (_req, res) => res.sendFile(path.join(PUBLIC, 'games.html')));
app.get('/admin', (_req, res) => res.sendFile(path.join(PUBLIC, 'admin.html')));
app.get('/api/games', (_req, res) => res.json({ active: activeId, sections: catalog() }));
app.use(express.static(PUBLIC, { index: false }));

const server = http.createServer(app);
const io = new Server(server);

const ENGINES = {
  redlight: () => new Game(config.game),
  planets: () => new PlanetsGame(config.planets),
};

let activeId = GAMES[START_GAME] ? START_GAME : 'redlight';
let game = ENGINES[activeId]();
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
function wireGame(g) {
  for (const ev of ['state', 'join', 'numberChanged', 'roundResult', 'winner']) {
    g.on(ev, (payload) => io.emit(ev, payload));
  }
}
wireGame(game);

const gameInfo = () => ({ active: activeId, title: GAMES[activeId].title, section: GAMES[activeId].section });

/** تبديل اللعبة النشطة: تُغلق اللعبة الحالية وتبدأ الجديدة، وتنتقل الشاشات المفتوحة تلقائياً */
function switchGame(id) {
  if (!ENGINES[id] || id === activeId) return false;
  const old = game;
  activeId = id;
  game = ENGINES[id]();
  wireGame(game);
  bots.setGame(game);
  old.destroy();
  console.log(`[Games] اللعبة النشطة الآن: ${GAMES[id].title}`);
  io.emit('activeGame', gameInfo());
  io.emit('state', game.snapshot());
  return true;
}

tiktok.on('status', (s) => {
  console.log(`[TikTok] ${s.message}`);
  io.emit('tiktokStatus', s);
});
tiktok.on('comment', ({ user, text }) => handleComment(user, text, 'tiktok'));

const demoStatus = () => ({ running: bots.running });

io.on('connection', (socket) => {
  socket.emit('activeGame', gameInfo());
  socket.emit('state', game.snapshot());
  socket.emit('tiktokStatus', tiktok.status());
  socket.emit('demoStatus', demoStatus());
  socket.emit('commentLog', commentLog);

  // ---- أوامر لوحة التحكم ----
  socket.on('admin:setGame', (id) => switchGame(String(id)));
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
  console.log(' ألعاب تيك توك لايف التفاعلية');
  console.log('==============================================');
  console.log(` اللعبة النشطة: ${GAMES[activeId].title}`);
  console.log(` شاشة اللعبة (للـ OBS / LIVE Studio): ${base}/`);
  console.log(` مكتبة الألعاب (STEAM Games):        ${base}/games`);
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
