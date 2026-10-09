import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import { Server } from 'socket.io';

import config from './battle.config.js';
import { Battle } from './src/battle.js';
import { Announcer, howtoText } from './src/announcer.js';
import { BattleDemo } from './src/battleDemo.js';
import { TikTokSource } from './src/tiktok.js';
import { TTS } from './src/tts.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// --user=xxx --port=3001 --demo --key=xxx --voice=google|openai|elevenlabs|browser
const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...v] = a.replace(/^--/, '').split('=');
  return [k, v.length ? v.join('=') : true];
}));

const PORT = Number(args.port || process.env.PORT || config.port || 3001);
const USERNAME = String(args.user || process.env.TIKTOK_USERNAME || config.tiktokUsername || '').replace(/^@/, '');
const SIGN_KEY = String(args.key || process.env.SIGN_API_KEY || config.signApiKey || '');
const DEMO = Boolean(args.demo || process.env.DEMO === '1' || config.demo);
const voiceOpt = { ...config.voice, provider: String(args.voice || process.env.TTS_PROVIDER || config.voice.provider || 'google') };

// ------------------------------------------------------------------
const app = express();
const server = http.createServer(app);
const io = new Server(server);

const battle = new Battle(config.battle);
const announcer = new Announcer(battle, config.announcer);
const tts = new TTS(voiceOpt);
const tiktok = new TikTokSource({ signApiKey: SIGN_KEY });
const stats = { comments: 0, likes: 0, gifts: 0, coins: 0, follows: 0, shares: 0 };

const publicDir = path.join(__dirname, 'public', 'battle');
app.get('/', (_req, res) => res.sendFile(path.join(publicDir, 'index.html')));
app.get('/admin', (_req, res) => res.sendFile(path.join(publicDir, 'admin.html')));
app.use(express.static(publicDir));

// الصوت: MP3 مولّد بالذكاء الاصطناعي، أو 204 ليستخدم المتصفح صوته الداخلي
app.get('/tts', async (req, res) => {
  const buf = await tts.synth(String(req.query.text || ''));
  if (!buf) return res.status(204).end();
  res.set({ 'Content-Type': 'audio/mpeg', 'Cache-Control': 'public, max-age=3600' }).send(buf);
});

// ------------------------------------------------------------------
// مصادر الأحداث (تيك توك + التجربة + لوحة التحكم) تمرّ كلها من هنا
// ------------------------------------------------------------------
const handlers = {
  comment(user, text) { stats.comments++; return battle.handleComment(user, text); },
  like(user, count) { stats.likes += Number(count) || 1; return battle.handleLike(user, count); },
  gift(user, gift) { stats.gifts++; stats.coins += gift.coins || 0; return battle.handleGift(user, gift); },
  follow(user) { stats.follows++; return battle.handleFollow(user); },
  share(user) { stats.shares++; return battle.handleShare(user); },
};
const demo = new BattleDemo(battle, handlers, config.demoBots);

tiktok.on('comment', ({ user, text }) => handlers.comment(user, text));
tiktok.on('like', ({ user, count }) => handlers.like(user, count));
tiktok.on('gift', ({ user, gift }) => handlers.gift(user, gift));
tiktok.on('follow', ({ user }) => handlers.follow(user));
tiktok.on('share', ({ user }) => handlers.share(user));
tiktok.on('status', (s) => {
  console.log(`[TikTok] ${s.message}`);
  io.emit('tiktokStatus', s);
});

for (const ev of ['state', 'join', 'gift', 'boost', 'bomb', 'follow', 'share', 'leadChange', 'final', 'overtime', 'winner', 'battleStart']) {
  battle.on(ev, (payload) => io.emit(ev, payload));
}
announcer.on('say', (line) => {
  console.log(`[🎙️] ${line.text}`);
  io.emit('say', line);
});

setInterval(() => { io.emit('stats', stats); io.emit('voiceInfo', tts.info()); }, 2000);

io.on('connection', (socket) => {
  socket.emit('state', battle.snapshot());
  socket.emit('tiktokStatus', tiktok.status());
  socket.emit('demoStatus', { running: demo.running });
  socket.emit('voiceInfo', tts.info());
  socket.emit('stats', stats);

  socket.on('admin:start', () => battle.start());
  socket.on('admin:skip', () => battle.skip());
  socket.on('admin:reset', () => battle.reset());
  socket.on('admin:howto', () => announcer.howto());
  socket.on('admin:say', (text) => { if (text) announcer.say(String(text).slice(0, 500), 'high', 'manual'); });
  socket.on('admin:demo', (on) => {
    if (on) demo.start(); else demo.stop();
    io.emit('demoStatus', { running: demo.running });
  });
  socket.on('admin:connect', (username) => tiktok.connect(username));
  socket.on('admin:disconnect', () => tiktok.disconnect());

  // محاكاة يدوية من لوحة التحكم
  const manual = (name) => {
    const nickname = String(name || 'مختبر').slice(0, 30);
    return { id: `manual-${nickname}`, uniqueId: nickname, nickname, avatar: '' };
  };
  socket.on('admin:comment', ({ name, text } = {}) => handlers.comment(manual(name), String(text || '')));
  socket.on('admin:like', ({ name, count } = {}) => handlers.like(manual(name), Number(count) || 10));
  socket.on('admin:follow', ({ name } = {}) => handlers.follow(manual(name)));
  socket.on('admin:share', ({ name } = {}) => handlers.share(manual(name)));
  socket.on('admin:gift', ({ name, gift, coins, emoji } = {}) => {
    const c = Math.max(1, Number(coins) || 1);
    handlers.gift(manual(name), { name: String(gift || 'هدية'), emoji: emoji || '🎁', diamonds: c, count: 1, coins: c, image: '' });
  });
});

server.listen(PORT, () => {
  const base = `http://localhost:${PORT}`;
  console.log('==============================================');
  console.log(' ⚔️  حرب الفرق — لعبة تيك توك لايف التفاعلية');
  console.log('==============================================');
  console.log(` شاشة اللعبة (للـ OBS / LIVE Studio): ${base}/`);
  console.log(` لوحة التحكم:                        ${base}/admin`);
  console.log(` صوت المعلّق:                        ${tts.provider}`);
  console.log('');
  if (DEMO) {
    console.log(' وضع التجربة مفعّل: متابعون وهميون يتفاعلون تلقائياً.');
    demo.start();
  }
  // في وضع التجربة لا نتصل تلقائياً بالحساب المحفوظ (إلا إذا مُرّر --user)، حتى لا تتكرر رسائل «ليس في بث مباشر»
  if (USERNAME && (!DEMO || args.user)) tiktok.connect(USERNAME);
  else if (USERNAME) console.log(` الحساب @${USERNAME} محفوظ. للاتصال بالبث اضغط «اتصال» في لوحة التحكم أو شغّل: npm run battle`);
  else if (!DEMO) console.log(' لم يُحدَّد حساب تيك توك. أدخله من لوحة التحكم أو شغّل: npm run battle -- --user=اسم_الحساب');
  if (args.howto) console.log(howtoText(config.battle));
});

async function shutdown() {
  demo.stop();
  battle.destroy();
  await tiktok.disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
