import { teamBadge, minaretSVG, mosqueSVG, GIFT_ICONS, nouriSVG } from './art.js';
import { FxEngine } from './fx.js';
import { NoorAudio } from './audio.js';

const $ = (id) => document.getElementById(id);
const params = new URLSearchParams(location.search);
if (params.get('transparent') === '1') document.body.classList.add('transparent');
const SOUND = params.get('sound') !== '0';

// ------------------------------------------------------------------
// تكبير المسرح 1080×1920 ليناسب النافذة
// ------------------------------------------------------------------
const stage = $('stage');
function fit() {
  const s = Math.min(innerWidth / 1080, innerHeight / 1920);
  stage.style.transform = `translate(${(innerWidth - 1080 * s) / 2}px, ${(innerHeight - 1920 * s) / 2}px) scale(${s})`;
}
addEventListener('resize', fit);
fit();

const fx = new FxEngine($('sky'), $('fx'));
const audio = new NoorAudio();
$('mosque').innerHTML = mosqueSVG();
$('nouriBody').innerHTML = nouriSVG();

// ------------------------------------------------------------------
// الصوت: OBS يسمح بالتشغيل التلقائي، والمتصفح العادي يحتاج ضغطة
// ------------------------------------------------------------------
async function tryUnlock() {
  if (!SOUND) return;
  const ok = await audio.unlock();
  $('soundBtn').classList.toggle('hidden', ok);
}
$('soundBtn').addEventListener('click', tryUnlock);
addEventListener('pointerdown', tryUnlock, { once: true });
setTimeout(tryUnlock, 300);

// ------------------------------------------------------------------
// أدوات
// ------------------------------------------------------------------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const AR = '٠١٢٣٤٥٦٧٨٩';
const ar = (n) => String(n).replace(/\d/g, (d) => AR[d]);
const fmt = (n) => Number(n || 0).toLocaleString('en-US');

function fallbackAvatar(name = '?') {
  const letter = [...String(name)][0] || '?';
  const hue = [...String(name)].reduce((h, c) => h + c.charCodeAt(0), 0) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="hsl(${hue},45%,32%)"/><text x="32" y="43" font-size="30" font-family="Arial" font-weight="bold" fill="#fff" text-anchor="middle">${letter}</text></svg>`;
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
const avatar = (u) => esc(u?.avatar || fallbackAvatar(u?.nickname));
const imgTag = (u, cls = '') => `<img class="${cls}" src="${avatar(u)}" onerror="this.src='${fallbackAvatar(u?.nickname)}'" alt="">`;

let state = null;
let offset = 0; // فرق ساعة الخادم
const now = () => Date.now() + offset;
const teamById = (id) => state?.teams.find((t) => t.id === id);
const teamIndex = (id) => state ? state.teams.findIndex((t) => t.id === id) : -1;

// ------------------------------------------------------------------
// بناء المنارات وبطاقات الفرق
// ------------------------------------------------------------------
let builtKey = '';
function buildTeams() {
  const key = state.teams.map((t) => t.id + t.name).join('|');
  if (key === builtKey) return;
  builtKey = key;
  $('minarets').innerHTML = state.teams.map((t) => `
    <div class="minaret" id="m-${t.id}">
      <div class="aura" style="background:${t.color}"></div>
      ${minaretSVG(t)}
      <div class="garden"></div>
      <div class="pct">0%</div>
    </div>`).join('');
  $('teams').innerHTML = state.teams.map((t, i) => `
    <div class="team" id="t-${t.id}" style="--c:${t.color};--g:${t.glow}">
      <div class="no">${ar(i + 1)}</div>
      <div class="top"></div>
      ${teamBadge(t, 70)}
      <div class="tname">${esc(t.name)}</div>
      <div class="score">0</div>
      <div class="meta">👥 0</div>
      <div class="boost">🌸 نفحة مسك ×2</div>
    </div>`).join('');
}

/** مركز عمود الفريق بإحداثيات المسرح */
function teamX(id) {
  const el = $(`m-${id}`);
  if (!el) return 540;
  return $('minarets').offsetLeft + el.offsetLeft + el.offsetWidth / 2;
}

const lastLight = {};
function renderTeams() {
  const target = state.target || 1;
  const maxLight = Math.max(...state.teams.map((t) => t.light));
  for (const t of state.teams) {
    const m = $(`m-${t.id}`); const card = $(`t-${t.id}`);
    if (!m || !card) continue;
    const pct = Math.min(1, t.light / target);
    const y = 900 - pct * 868;
    m.querySelector('.light-fill').setAttribute('y', y);
    m.querySelector('.light-edge').setAttribute('y', y - 5);
    m.querySelectorAll('.win').forEach((w, i) => w.classList.toggle('lit', y < [716, 606, 406, 226][i]));
    m.querySelector('.pct').textContent = `${Math.floor(pct * 100)}%`;
    m.querySelector('.aura').style.height = `${pct * 860}px`;
    m.classList.toggle('full', pct >= 1);
    m.classList.toggle('leader', t.light > 0 && t.light === maxLight);
    const boosted = t.boostUntil > now();
    m.classList.toggle('boost', boosted);
    card.classList.toggle('boosted', boosted);
    card.querySelector('.score').textContent = `${fmt(t.light)} / ${fmt(target)}`;
    card.querySelector('.meta').textContent = `👥 ${fmt(t.members)}  ·  🌹 ${fmt(t.roses)}`;
    card.querySelector('.top').innerHTML = t.top ? imgTag(t.top) : '';
    // حديقة الورد عند قاعدة المنارة
    const garden = m.querySelector('.garden');
    const want = Math.min(12, t.roses);
    while (garden.children.length < want) {
      const s = document.createElement('span');
      s.innerHTML = GIFT_ICONS.rose;
      garden.appendChild(s);
    }
    while (garden.children.length > want) garden.lastChild.remove();
    if (lastLight[t.id] !== undefined && t.light > lastLight[t.id]) {
      card.classList.remove('bump'); void card.offsetWidth; card.classList.add('bump');
    }
    lastLight[t.id] = t.light;
  }
}

// ------------------------------------------------------------------
// المسبحة (٣٣ حبة)
// ------------------------------------------------------------------
const beads = $('beads');
beads.innerHTML = Array.from({ length: 33 }, (_, i) => {
  const a = (i / 33) * Math.PI * 2 - Math.PI / 2;
  return `<circle class="bead" cx="${100 + Math.cos(a) * 86}" cy="${100 + Math.sin(a) * 86}" r="7.5"/>`;
}).join('') + '<circle cx="100" cy="186" r="0"/>';
function renderTasbeeh() {
  const n = state.tasbeeh;
  beads.querySelectorAll('.bead').forEach((b, i) => {
    b.classList.toggle('on', i < n);
    b.classList.toggle('last', i === n - 1);
  });
  $('tasbeehNo').textContent = ar(n);
  $('dhikrTotal').textContent = `${ar(fmt(state.session.dhikr))} ذكر`;
}

// ------------------------------------------------------------------
// أهل الكرم، الحكمة، التعليمات
// ------------------------------------------------------------------
function renderSupporters() {
  const list = state.supporters.slice(0, 3);
  $('supList').innerHTML = list.length ? list.map((u, i) => `
    <li><span class="rank">${['🥇', '🥈', '🥉'][i]}</span>${imgTag(u)}<span class="nm">${esc(u.nickname)}</span><span class="cn">${fmt(u.coins)} 🪙</span></li>`).join('')
    : '<li class="empty">تهادَوا تحابّوا 🌹<br>كن أول الداعمين</li>';
}

let wisdomKey = '';
function renderWisdom() {
  const w = state.wisdom;
  if (!w || w.text === wisdomKey) return;
  const inner = document.querySelector('.wisdom-inner');
  const first = !wisdomKey;
  wisdomKey = w.text;
  const apply = () => {
    const t = $('wisdomText');
    t.textContent = w.text;
    t.className = `wisdom-text ${w.type}`;
    t.style.fontSize = w.text.length > 70 ? '28px' : w.text.length > 45 ? '33px' : '38px';
    $('wisdomSrc').textContent = w.source;
    inner.classList.remove('fade');
  };
  if (first) apply();
  else { inner.classList.add('fade'); setTimeout(apply, 800); }
}

function howtoLines() {
  const names = state ? state.teams.map((t, i) => `${ar(i + 1)} ${t.name}`).join(' · ') : '';
  return [
    `اكتب رقم فريقك للانضمام: <em>${esc(names)}</em>`,
    'اذكر الله في التعليقات ✨ <em>سبحان الله · الحمد لله · الله أكبر</em>',
    'كل ذكر يضيء نجمة في السماء ويزيد نور فريقك 🌟',
    'أجب على «سؤال النور» بكتابة <em>أ · ب · ج · د</em>',
    'أول منارة تكتمل إضاءتها تفوز بالجولة 🏆',
    'اضغط ❤️ على الشاشة: كل الإعجابات تُطلق الشُّهب ☄️',
  ];
}
let howtoIdx = 0;
function cycleHowto() {
  const el = $('howtoText');
  el.classList.add('fade');
  setTimeout(() => {
    const lines = howtoLines();
    howtoIdx = (howtoIdx + 1) % lines.length;
    el.innerHTML = lines[howtoIdx];
    el.classList.remove('fade');
  }, 500);
}
setInterval(cycleHowto, 6000);

$('legend').innerHTML = [
  ['rose', 'وردة', 'بستان ورد لفريقك'],
  ['heart', 'قلب', 'فانوس يطير للسماء'],
  ['donut', 'دونات', 'مطر كعك العيد'],
  ['perfume', 'عطر', 'نفحة مسك تضاعف النور'],
].map(([k, n, d]) => `<div class="gift-chip"><div class="ic">${GIFT_ICONS[k]}</div><div><b>${n}</b><small>${d}</small></div></div>`).join('');

// ------------------------------------------------------------------
// نوري: يعلّق على الأحداث
// ------------------------------------------------------------------
const IDLE = ['السلام عليكم ورحمة الله 🌙', 'لا تنسوا الصلاة على النبي ﷺ', 'اكتب «سبحان الله» وشاهد النجوم ✨',
  'تهادَوا تحابّوا 🌹', 'من سيضيء منارته أولاً؟ 🕌', 'الكلمة الطيبة صدقة 🤍', 'اكتب رقم فريقك وانضم إلينا!'];
let nouriTimer = null;
let nouriBusyUntil = 0;
function say(text, happy = false, ms = 3500) {
  const b = $('nouriBubble');
  b.classList.add('hide');
  setTimeout(() => { b.textContent = text; b.classList.remove('hide'); }, 200);
  nouriBusyUntil = Date.now() + ms;
  if (happy) {
    $('nouri').classList.add('happy');
    clearTimeout(nouriTimer);
    nouriTimer = setTimeout(() => $('nouri').classList.remove('happy'), 1600);
  }
}
setInterval(() => {
  if (Date.now() > nouriBusyUntil) say(IDLE[Math.floor(Math.random() * IDLE.length)], false, 0);
}, 9000);

// ------------------------------------------------------------------
// تنبيهات الهدايا (طابور)
// ------------------------------------------------------------------
const KIND_LABEL = { rose: 'وردة', heart: 'قلب', donut: 'دونات', perfume: 'عطر' };
const KIND_EFFECT = { rose: '🌹 بستان ورد يتفتّح', heart: '🏮 فانوس يطير إلى السماء', donut: '🍩 مطر من كعك العيد',
  perfume: '🌸 نفحة مسك: النور مضاعف', meteor: '☄️ شُهب من نور', grand: '🌌 ليلة النور الكبرى', sparkle: '✨ نجمة جديدة' };
const queue = [];
let showing = false;
function enqueueAlert(e) {
  const last = queue[queue.length - 1];
  if (last && last.user.id === e.user.id && last.name === e.name) {
    last.count += e.count; last.light += e.light; return;
  }
  queue.push({ ...e });
  if (!showing) nextAlert();
}
function nextAlert() {
  const e = queue.shift();
  if (!e) { showing = false; return; }
  showing = true;
  const team = teamById(e.team) || { color: '#f7d58b', name: '' };
  const big = e.tier === 'grand';
  const icon = KIND_LABEL[e.kind] ? GIFT_ICONS[e.kind]
    : e.image ? `<img src="${esc(e.image)}" alt="">` : GIFT_ICONS[e.tier || e.kind] || GIFT_ICONS.sparkle;
  const el = document.createElement('div');
  el.className = `alert ${big ? 'grand' : ''}`;
  el.style.setProperty('--c', team.color);
  el.innerHTML = `${imgTag(e.user, 'av')}
    <div class="txt">
      <div class="who">${esc(e.user.nickname)}</div>
      <div class="what">أهدى ${esc(KIND_LABEL[e.kind] || e.name)} · +${fmt(e.light)} نور لفريق ${esc(team.name)}</div>
      <div class="eff">${KIND_EFFECT[e.tier] || KIND_EFFECT[e.kind] || ''}</div>
    </div>
    <div class="gi">${icon}</div>
    ${e.count > 1 ? `<div class="cnt">×${e.count}</div>` : ''}`;
  $('alerts').appendChild(el);
  const ms = big ? 5000 : queue.length > 3 ? 1500 : 3000;
  setTimeout(() => {
    el.classList.add('out');
    setTimeout(() => { el.remove(); nextAlert(); }, 420);
  }, ms);
}

function toast(html, x, y, color, center = false) {
  const el = document.createElement('div');
  el.className = `toast ${center ? 'center' : ''}`;
  el.style.left = `${x}px`; el.style.top = `${y}px`;
  el.style.setProperty('--c', color);
  el.innerHTML = html;
  $('toasts').appendChild(el);
  setTimeout(() => el.remove(), 2700);
}

// ------------------------------------------------------------------
// المؤثرات حسب الأحداث
// ------------------------------------------------------------------
function minaretHit(id) {
  const m = $(`m-${id}`);
  if (!m) return;
  m.classList.remove('hit'); void m.offsetWidth; m.classList.add('hit');
}

function onGift(e) {
  const x = teamX(e.team);
  const team = teamById(e.team);
  const color = team?.glow || '#ffe9a8';
  const n = Math.min(e.count, 20);
  switch (e.kind) {
    case 'rose':
      fx.petals(x, Math.min(90, 24 + n * 4));
      fx.sparkles(x, 1440, 18, '#ff8fa8', 260);
      break;
    case 'heart':
      for (let i = 0; i < Math.min(n, 10); i++) setTimeout(() => fx.lantern(x + (Math.random() - 0.5) * 80, 760), i * 220);
      fx.sparkles(x, 700, 20, '#ff6b8b', 300);
      audio.whoosh();
      break;
    case 'donut':
      fx.kaakRain(Math.min(70, 22 + n * 3));
      break;
    case 'perfume':
      fx.musk();
      fx.sparkles(x, 900, 40, '#e7d0ff', 380);
      say(`نفحة مسك من ${e.user.nickname}! نور ${team?.name || ''} مضاعف 🌸`, true);
      break;
    default:
      fx.sparkles(x, 800, 30, color, 360);
      fx.dhikrStar(x, 800, color);
  }
  if (e.tier === 'meteor') { fx.shootingStars(7); fx.beam(x, 1460, color, 2.5); }
  if (e.tier === 'grand') {
    fx.aurora(8000); fx.flash('#ffe9a8'); fx.fireworks(10);
    for (let i = 0; i < 12; i++) setTimeout(() => fx.lantern(80 + Math.random() * 920, 1500), i * 160);
    say(`ما شاء الله تبارك الله! شكراً ${e.user.nickname} 🌌`, true, 5000);
  } else if (e.kind !== 'perfume') {
    say(`جزاك الله خيراً يا ${e.user.nickname} ${e.kind === 'rose' ? '🌹' : '🤍'}`, true);
  }
  minaretHit(e.team);
  audio.chime(e.tier === 'grand' ? 4 : e.tier === 'meteor' ? 3 : 1);
  enqueueAlert(e);
}

function onDhikr(e) {
  const team = teamById(e.team);
  const color = team?.glow || '#ffe9a8';
  const x = 160 + Math.random() * 760;
  const y = 1150 + Math.random() * 200;
  const el = document.createElement('div');
  el.className = 'dhikr-fly';
  el.style.left = `${x}px`; el.style.top = `${y}px`;
  el.style.setProperty('--c', color);
  el.innerHTML = `${esc(e.text)}<small>${esc(e.user.nickname)}</small>`;
  $('dhikrLayer').appendChild(el);
  setTimeout(() => el.remove(), 3300);
  setTimeout(() => fx.dhikrStar(x, y - 300, color), 2300);
  audio.softPing();
}

function onEvent(e) {
  switch (e.type) {
    case 'gift': onGift(e); break;
    case 'dhikr': onDhikr(e); break;
    case 'tasbeeh': {
      $('tasbeeh').classList.remove('complete'); void $('tasbeeh').offsetWidth; $('tasbeeh').classList.add('complete');
      fx.ring(140, 402, '#ffe9a8', 12, 700);
      fx.sparkles(140, 402, 60, '#ffe9a8', 500);
      fx.shootingStars(3);
      audio.chime(3);
      say('اكتملت المسبحة ٣٣ ✨ بارك الله فيكم', true, 4000);
      break;
    }
    case 'join': {
      const t = teamById(e.team);
      if (!t) break;
      const i = teamIndex(e.team);
      const x = teamX(e.team) - (i === 0 ? 30 : i === 3 ? -30 : 0);
      toast(`${imgTag(e.user)}${esc(e.user.nickname)} ← ${esc(t.name)}`, x, 1420, t.color);
      break;
    }
    case 'follow':
      toast(`${imgTag(e.user)}🤍 جزاك الله خيراً ${esc(e.user.nickname)} على المتابعة`, 540, 1280, '#f7d58b', true);
      audio.softPing();
      break;
    case 'share': {
      const t = teamById(e.team);
      toast(`${imgTag(e.user)}📣 ${esc(e.user.nickname)} نشر الخير وشارك البث`, 540, 1340, t?.color || '#62b3ff', true);
      fx.lantern(teamX(e.team), 1300);
      break;
    }
    case 'shootingStar':
      fx.shootingStars(e.stars + 1);
      break;
    case 'quizStart':
      audio.chime(2);
      say('سؤال جديد! أجب بـ أ ب ج د 📜', true, 4000);
      break;
    case 'quizEnd':
      audio.chime(3);
      if (e.correctCount) fx.fireworks(3, ['#4fe3b8', '#f7d58b']);
      break;
    case 'victory': onVictory(e); break;
    case 'roundStart':
      $('victory').classList.add('hidden');
      say('جولة جديدة! بسم الله نبدأ 🌙', true, 4000);
      break;
    default: break;
  }
}

// ------------------------------------------------------------------
// سؤال النور
// ------------------------------------------------------------------
const LETTERS = ['أ', 'ب', 'ج', 'د'];
let quizId = '';
function renderQuiz() {
  const q = state.quiz;
  const box = $('quiz');
  stage.classList.toggle('quiz-on', Boolean(q));
  if (!q) { box.classList.add('hidden'); quizId = ''; return; }
  if (q.id !== quizId) {
    quizId = q.id;
    box.innerHTML = `
      <div class="quiz-head"><span class="tag">📜 سؤال النور</span><span class="qt" id="qTime"></span></div>
      <div class="quiz-bar"><i id="qBar"></i></div>
      <div class="quiz-q">${esc(q.q)}</div>
      <div class="quiz-opts">${q.options.map((o, i) => `
        <div class="opt" data-i="${i}"><div class="fill"></div><span class="l">${LETTERS[i]}</span><span class="t">${esc(o)}</span><span class="n"></span></div>`).join('')}</div>
      <div class="quiz-foot" id="qFoot"></div>`;
    box.dataset.total = (q.endsAt - now()) / 1000;
  }
  box.classList.remove('hidden');
  box.classList.toggle('revealed', q.revealed);
  box.classList.add('quiz');
  const total = Math.max(1, q.total);
  box.querySelectorAll('.opt').forEach((el, i) => {
    el.querySelector('.fill').style.width = `${(q.counts[i] / total) * 100}%`;
    el.querySelector('.n').textContent = q.counts[i] ? fmt(q.counts[i]) : '';
    el.classList.toggle('correct', q.revealed && q.answer === i);
  });
  const foot = $('qFoot');
  if (q.revealed) {
    foot.innerHTML = q.correctCount
      ? `أحسنتم! أجاب صحيحاً <b>${fmt(q.correctCount)}</b> — الأسرع يحصل على نور مضاعف<div class="quiz-winners">${q.winners.map((u) => `<div>${imgTag(u)}<span>${esc(u.nickname)}</span></div>`).join('')}</div>`
      : 'لم يُجب أحد صحيحاً هذه المرة 🤲 — زادنا الله علماً';
  } else {
    foot.innerHTML = `اكتب الحرف في التعليقات · أجاب <b>${fmt(q.total)}</b>`;
  }
}

// ------------------------------------------------------------------
// الفوز
// ------------------------------------------------------------------
function onVictory(e) {
  const v = $('victory');
  const w = e.winner;
  if (!w) {
    v.style.setProperty('--c', '#f7d58b'); v.style.setProperty('--g', '#ffe9a8');
    v.innerHTML = `<div class="rays"></div><div class="v-inner"><div class="v-small">انتهت الجولة ${ar(e.round)}</div>
      <div class="v-team" style="font-size:90px">لم تُضأ أي منارة</div><div class="v-next">اكتبوا أرقام فرقكم واذكروا الله لتبدأ الجولة القادمة 🌙</div></div>`;
    v.classList.remove('hidden');
    return;
  }
  const team = teamById(w.teamId) || { ...w, glow: w.color, letter: '★', id: w.teamId };
  v.style.setProperty('--c', team.color); v.style.setProperty('--g', team.glow);
  const medals = ['🥇', '🥈', '🥉'];
  const order = w.top.length >= 2 ? [w.top[1], w.top[0], w.top[2]].filter(Boolean) : w.top;
  v.innerHTML = `<div class="rays"></div>
    <div class="v-inner">
      <div class="v-badge">${teamBadge(team, 200)}</div>
      <div class="v-small">${w.reason === 'target' ? 'أضاء منارته بالكامل' : 'الأكثر نوراً في الجولة'} ${ar(e.round)}</div>
      <div class="v-team">فريق ${esc(w.name)}</div>
      <div class="v-sub">✨ ${fmt(w.light)} نور ✨</div>
      <div class="v-top">${order.map((u) => {
        const rank = w.top.indexOf(u);
        return `<div class="${rank === 0 ? 'mvp' : ''}"><span class="medal">${medals[rank]}</span>${imgTag(u)}<span>${esc(u.nickname)}</span><small>${fmt(u.points)} نور</small></div>`;
      }).join('')}</div>
      <div class="v-dua">بارك الله فيكم جميعاً وجعلها في ميزان حسناتكم 🤲</div>
      <div class="v-next" id="vNext"></div>
    </div>`;
  v.classList.remove('hidden');
  const x = teamX(w.teamId);
  fx.beam(x, 1460, team.glow, 6);
  fx.flash(team.glow);
  fx.fireworks(14, [team.color, team.glow, '#ffe9a8', '#ffffff']);
  for (let i = 0; i < 10; i++) setTimeout(() => fx.lantern(x + (Math.random() - 0.5) * 200, 1400), i * 250);
  audio.fanfare();
  say(`مبارك لفريق ${w.name}! 🏆`, true, 6000);
}

// ------------------------------------------------------------------
// الحالة والمؤقت
// ------------------------------------------------------------------
function render() {
  if (!state) return;
  buildTeams();
  renderTeams();
  renderTasbeeh();
  renderSupporters();
  renderWisdom();
  renderQuiz();
  $('roundNo').textContent = ar(state.round);
  $('pausedOverlay').classList.toggle('hidden', state.phase !== 'paused');
  if (state.phase === 'playing') $('victory').classList.add('hidden');
}

let lastSec = null;
function tickClock() {
  if (!state) return;
  let ms = 0;
  if (state.phase === 'playing') ms = state.endsAt - now();
  else if (state.phase === 'paused') ms = state.pausedLeft || 0;
  else if (state.phase === 'victory') ms = state.victoryEndsAt - now();
  ms = Math.max(0, ms);
  const s = Math.ceil(ms / 1000);
  $('timer').textContent = `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  $('timerPill').classList.toggle('low', state.phase === 'playing' && s <= 15);
  if (state.phase === 'playing' && s <= 10 && s !== lastSec && s > 0) audio.tick();
  lastSec = s;
  const vn = $('vNext');
  if (vn && state.phase === 'victory') vn.textContent = `الجولة التالية بعد ${ar(s)} ثانية`;
  const q = state.quiz;
  if (q && !q.revealed && $('qTime')) {
    const left = Math.max(0, q.endsAt - now());
    $('qTime').textContent = `⏳ ${ar(Math.ceil(left / 1000))}`;
    const total = Number($('quiz').dataset.total) || 20;
    $('qBar').style.width = `${Math.min(100, (left / 1000 / total) * 100)}%`;
  }
  for (const t of state.teams) {
    const b = document.querySelector(`#t-${t.id} .boost`);
    if (b && t.boostUntil > now()) b.textContent = `🌸 نفحة مسك ×${ar(state.boostMultiplier)} — ${ar(Math.ceil((t.boostUntil - now()) / 1000))} ث`;
    else if (b && $(`t-${t.id}`).classList.contains('boosted')) renderTeams();
  }
}
setInterval(tickClock, 250);

// ------------------------------------------------------------------
// الاتصال بالخادم
// ------------------------------------------------------------------
const socket = io();
socket.on('state', (s) => {
  offset = s.serverNow - Date.now();
  const firstState = !state;
  state = s;
  render();
  if (firstState) {
    $('howtoText').innerHTML = howtoLines()[0];
    if (s.phase === 'victory' && s.winner) onVictory({ winner: s.winner, round: s.round });
  }
});
socket.on('fx', (e) => { if (state) onEvent(e); });
socket.on('settings', (st) => {
  audio.setVolumes(st);
  const mode = SOUND ? st.musicMode : 'off';
  // قبل تفعيل الصوت نحفظ الوضع فقط، ويبدأ عند unlock()
  if (audio.ctx) audio.setMode(mode); else audio.mode = mode;
});

// للتجربة من وحدة تحكم المتصفح
window.__noor = { fx, audio, onEvent };
