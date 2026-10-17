import { Scene } from './scene.js';
import { NoorAudio } from './audio.js';
import { ICONS, GIFT_ICON } from './icons.js';

const params = new URLSearchParams(location.search);
if (params.get('transparent') === '1') document.body.classList.add('transparent');
if (params.get('scene') === '0') document.body.classList.add('no-scene', 'transparent');

const $ = (s) => document.querySelector(s);
const stage = $('#stage');
const scene = new Scene($('#scene'));
const audio = new NoorAudio();
if (params.get('sound') === '0') audio.setMuted(true);

for (const el of document.querySelectorAll('[data-icon]')) el.innerHTML = ICONS[el.dataset.icon] || '';

// ------------------------------------------------------------------
// ملاءمة المسرح 1080×1920 لأي نافذة
// ------------------------------------------------------------------
function fit() {
  const s = Math.min(innerWidth / 1080, innerHeight / 1920);
  stage.style.transform = `translate(-50%, -50%) scale(${s})`;
}
addEventListener('resize', fit);
fit();

// ------------------------------------------------------------------
// الصوت: يعمل تلقائياً في OBS، وفي المتصفح يحتاج نقرة واحدة
// ------------------------------------------------------------------
function tryAudio() {
  audio.resume();
  setTimeout(() => $('#soundHint').classList.toggle('hidden', audio.running || audio.muted), 400);
}
tryAudio();
addEventListener('pointerdown', tryAudio);
addEventListener('keydown', tryAudio);

// ------------------------------------------------------------------
// أدوات
// ------------------------------------------------------------------
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n || 0).toLocaleString('ar-EG');
const LETTERS = ['أ', 'ب', 'ج', 'د'];
const CATS = { quran: 'القرآن الكريم', prophets: 'قصص الأنبياء', seerah: 'السيرة النبوية', sahaba: 'الصحابة', ibadat: 'العبادات والعقيدة' };

function avatar(u, cls = '') {
  const letter = esc([...(u?.nickname || '?')][0] || '?');
  if (u?.avatar) {
    return `<img class="${cls}" src="${esc(u.avatar)}" alt="${letter}" referrerpolicy="no-referrer" `
      + `onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'av ${cls}',textContent:this.alt}))">`;
  }
  return `<span class="av ${cls}">${letter}</span>`;
}

function bump(el) {
  el.classList.remove('bump');
  void el.offsetWidth;
  el.classList.add('bump');
}

// ------------------------------------------------------------------
// الشريط السفلي: طريقة المشاركة
// ------------------------------------------------------------------
const TICKER = [
  ['rose', '<b>وردة</b> = زهرة تتفتّح في الواحة'],
  ['heart', '<b>قلب</b> = فانوس يطير في السماء'],
  ['donut', '<b>دونات</b> = إطعام مسافري القافلة'],
  ['perfume', '<b>عطر</b> = نفحات مسك ونقاط ×2'],
  ['crown', '<b>هدية كبرى</b> = موكب النور الذهبي'],
  ['tasbih', 'اكتب <b>سبحان الله</b> لتعدّ المسبحة'],
  ['book', 'أجب عن السؤال بـ <b>1 2 3 4</b>'],
  ['star', 'كل <b>إعجاب</b> = نجمة في السماء'],
];
function buildTicker() {
  const items = TICKER.map(([ic, t]) => `<div class="tk"><span class="ico">${ICONS[ic]}</span><span>${t}</span></div>`).join('');
  $('#tickerTrack').innerHTML = items + items;
}
buildTicker();

// ------------------------------------------------------------------
// نوري: الفانوس المتكلم
// ------------------------------------------------------------------
const TIPS = [
  'السلام عليكم ورحمة الله 🌙 حيّاكم في واحة النور',
  'أرسل وردة 🌹 لتتفتّح زهرة باسمك في الواحة',
  'القلب ❤️ يطلق فانوساً يضيء السماء',
  'الدونات 🍩 تُطعم مسافري القافلة 🐪',
  'العطر 🧴 ينشر المسك ويضاعف النقاط!',
  'اكتب «سبحان الله» وشارك في المسبحة 📿',
  'أجب عن السؤال بكتابة رقم الإجابة ✍️',
  'كل إعجاب ⭐ نجمة جديدة في سماء الواحة',
  'معاً نُنير المسجد كاملاً الليلة ✨',
  'تابع الحساب لتطير حمامة باسمك 🕊️',
];
let tipIndex = 0;
let sayUntil = 0;
function say(text, ms = 5000, excited = false) {
  const b = $('#bubble');
  b.classList.add('swap');
  setTimeout(() => {
    $('#bubbleText').textContent = text;
    b.classList.remove('swap');
  }, 250);
  sayUntil = Date.now() + ms;
  if (excited) {
    const n = $('#noori');
    n.classList.remove('excited');
    void n.offsetWidth;
    n.classList.add('excited');
  }
}
setInterval(() => {
  if (Date.now() < sayUntil) return;
  tipIndex = (tipIndex + 1) % TIPS.length;
  say(TIPS[tipIndex], 0);
}, 7000);

let lastThanks = 0;
function thank(text) {
  if (Date.now() - lastThanks < 3500) return;
  lastThanks = Date.now();
  say(text, 4500, true);
}

// ------------------------------------------------------------------
// الإشعارات الجانبية
// ------------------------------------------------------------------
function toast({ user, what, kind = 'other', iconHtml = '', count = 0, points = 0 }) {
  const box = $('#toasts');
  const el = document.createElement('div');
  el.className = `toast k-${kind}`;
  el.innerHTML = `${avatar(user)}
    <div class="body"><div class="who">${esc(user?.nickname || '')}</div><div class="what">${esc(what)}</div>${points ? `<div class="pts">✨ ${fmt(points)} نقطة نور</div>` : ''}</div>
    <div class="gift">${iconHtml}${count > 1 ? `<b>×${fmt(count)}</b>` : ''}</div>`;
  box.prepend(el);
  while (box.children.length > 4) box.lastChild.remove();
  setTimeout(() => { el.classList.add('leave'); setTimeout(() => el.remove(), 400); }, 5200);
}

// ------------------------------------------------------------------
// اللافتة الكبرى (بطابور حتى لا تتداخل)
// ------------------------------------------------------------------
const bannerQueue = [];
let bannerBusy = false;
function banner(html, ms = 5500) {
  bannerQueue.push({ html, ms });
  if (!bannerBusy) nextBanner();
}
function nextBanner() {
  const item = bannerQueue.shift();
  const el = $('#banner');
  if (!item) { bannerBusy = false; el.classList.add('hidden'); return; }
  bannerBusy = true;
  el.classList.remove('hidden', 'leave');
  el.innerHTML = item.html;
  void el.offsetWidth;
  el.style.animation = 'none';
  void el.offsetWidth;
  el.style.animation = '';
  setTimeout(() => {
    el.classList.add('leave');
    setTimeout(nextBanner, 450);
  }, item.ms);
}

// ------------------------------------------------------------------
// الذكر الطائر
// ------------------------------------------------------------------
function floatDhikr(label, user) {
  const layer = $('#dhikrLayer');
  if (layer.children.length > 14) return;
  const el = document.createElement('div');
  el.className = 'float-dhikr';
  el.innerHTML = `${esc(label)}<small>${esc(user?.nickname || '')}</small>`;
  el.style.left = `${80 + Math.random() * 640}px`;
  el.style.top = `${1300 + Math.random() * 260}px`;
  layer.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ------------------------------------------------------------------
// الحالة العامة
// ------------------------------------------------------------------
let state = null;
let settings = { showQuiz: true, showTicker: true };
let lastDhikr = 0;

function renderState(s) {
  const prev = state;
  state = s;
  $('#level').textContent = fmt(s.level);
  $('#goalFill').style.width = `${(s.progress * 100).toFixed(1)}%`;
  $('#goalText').textContent = `${fmt(s.points)} / ${fmt(s.goal)} نور`;
  $('#goalPct').textContent = `${Math.floor(s.progress * 100)}%`;
  scene.setProgress(s.progress);
  scene.setTheme(s.theme, !prev);

  const dc = $('#dhikrCount');
  dc.textContent = fmt(s.dhikr);
  if (s.dhikr !== lastDhikr) { bump(dc); lastDhikr = s.dhikr; }

  const musk = $('#muskChip');
  musk.classList.toggle('hidden', !(s.muskIn > 0));
  muskEnd = Date.now() + s.muskIn;

  const top = s.topSupporters?.[0];
  const star = $('#starNight');
  star.classList.toggle('hidden', !top);
  if (top) {
    star.querySelector('.name').textContent = `نجم الليلة: ${top.nickname}`;
    const img = star.querySelector('img');
    if (top.avatar) { img.src = top.avatar; img.style.display = ''; } else img.style.display = 'none';
  }

  const ch = s.challenge;
  document.body.classList.toggle('has-challenge', Boolean(ch));
  $('#challenge').classList.toggle('hidden', !ch);
  if (ch) {
    $('#chFill').style.width = `${Math.min(100, (ch.count / ch.target) * 100)}%`;
    $('#chCount').textContent = fmt(ch.count);
    $('#chTarget').textContent = fmt(ch.target);
    challengeEnd = Date.now() + ch.endsIn;
  }

  if (quiz?.phase === 'question') updateAnswered(s.quiz?.answered);
  if (cardMode === 'board') renderBoard();
}

let muskEnd = 0;
let challengeEnd = 0;
setInterval(() => {
  const m = Math.max(0, Math.ceil((muskEnd - Date.now()) / 1000));
  $('#muskTime').textContent = `${fmt(m)}ث`;
  if (m === 0) $('#muskChip').classList.add('hidden');
  const c = Math.max(0, Math.ceil((challengeEnd - Date.now()) / 1000));
  $('#chTime').textContent = fmt(c);
}, 250);

// ------------------------------------------------------------------
// البطاقة: سؤال / نتيجة / آية / لوحة الشرف
// ------------------------------------------------------------------
let quiz = null;
let quizEnd = 0;
let cardMode = '';
let idleSince = 0;
let lastTick = -1;
const recentAnswerers = [];

function setCard(mode, html) {
  const card = $('#card');
  const inner = $('#cardInner');
  if (mode === cardMode && mode !== 'question' && mode !== 'reveal') { inner.innerHTML = html; return; }
  cardMode = mode;
  card.classList.add('out');
  setTimeout(() => {
    inner.innerHTML = html;
    card.classList.remove('out');
  }, 300);
}

const timerHtml = () => `<div class="timer"><svg viewBox="0 0 100 100"><circle class="bg" cx="50" cy="50" r="44"/><circle class="fg" cx="50" cy="50" r="44" stroke-dasharray="276.5" stroke-dashoffset="0"/></svg><b>0</b></div>`;

function renderQuestion(q) {
  recentAnswerers.length = 0;
  const opts = q.options.map((o, i) => `<div class="opt" data-i="${i}"><span class="letter">${LETTERS[i]}<small>${i + 1}</small></span><span class="txt">${esc(o)}</span></div>`).join('');
  setCard('question', `
    <div class="q-head"><span class="q-cat">${esc(CATS[q.category] || 'سؤال')}</span><span class="q-num">السؤال ${fmt(q.id)}</span>${timerHtml()}</div>
    <p class="q-text">${esc(q.question)}</p>
    <div class="opts">${opts}</div>
    <div class="q-foot"><span class="how">اكتب رقم الإجابة <b>1</b> · <b>2</b> · <b>3</b> · <b>4</b></span><span>أجاب: <b id="answered">${fmt(q.answered)}</b></span><div class="answerers" id="answerers"></div></div>`);
  audio.play('question');
}

function renderReveal(q) {
  const total = Math.max(1, q.counts.reduce((a, b) => a + b, 0));
  const opts = q.options.map((o, i) => {
    const pct = Math.round((q.counts[i] / total) * 100);
    const cls = i === q.correctIndex ? 'correct' : 'wrong';
    return `<div class="opt ${cls}"><span class="bar" style="width:${pct}%"></span><span class="letter">${i === q.correctIndex ? '✓' : LETTERS[i]}</span><span class="txt">${esc(o)}</span><span class="pct">${fmt(pct)}%</span></div>`;
  }).join('');
  const winners = q.winners?.length
    ? `<div class="winners"><span class="lbl">🏆 الأسرع:</span>${q.winners.slice(0, 3).map((w) => `<span class="winner">${avatar(w)}${esc(w.nickname)} <b>${fmt(w.score)}</b></span>`).join('')}</div>`
    : `<div class="winners"><span class="lbl">لم يُجب أحد إجابة صحيحة هذه المرة — السؤال القادم لكم 💪</span></div>`;
  setCard('reveal', `
    <div class="q-head"><span class="q-cat">الإجابة الصحيحة</span><span class="q-num">${fmt(q.correctCount)} من ${fmt(q.answered)} أصابوا</span>${timerHtml()}</div>
    <p class="q-text">${esc(q.question)}</p>
    <div class="opts">${opts}</div>
    ${q.note ? `<div class="note">📖 ${esc(q.note)}</div>` : ''}
    ${winners}`);
  audio.play('reveal');
  if (q.correctCount) say(`ما شاء الله! ${fmt(q.correctCount)} أصابوا الإجابة 🕊️`, 5000, true);
}

function renderWisdom(card) {
  if (!card) return;
  const text = card.ayah ? `<span class="orn">﴿</span> ${esc(card.text)} <span class="orn">﴾</span>` : `«${esc(card.text)}»`;
  setCard('wisdom', `
    <div class="wisdom">
      <div class="kind">${card.ayah ? '✦ آية ونور ✦' : '✦ من هدي النبي ﷺ ✦'}</div>
      <div class="text">${text}</div>
      <div class="src">${esc(card.src)}</div>
      <div class="next-in" id="nextIn"></div>
    </div>`);
}

function boardList(list, key, empty) {
  if (!list?.length) return `<div class="empty">${empty}</div>`;
  return list.map((u, i) => `<div class="row"><span class="rank">${fmt(i + 1)}</span>${avatar(u)}<span class="nm">${esc(u.nickname)}</span><span class="pts">${fmt(u[key])}</span></div>`).join('');
}

function renderBoard() {
  if (!state) return;
  setCard('board', `
    <h2 class="board-title">لوحة الشرف</h2>
    <div class="boards">
      <div class="board"><h3><span data-icon="lantern">${ICONS.lantern}</span>الداعمون</h3>${boardList(state.topSupporters, 'points', 'كن أول من يضيء الواحة 🌹')}</div>
      <div class="board"><h3><span data-icon="book">${ICONS.book}</span>أبطال المسابقة</h3>${boardList(state.topScholars, 'score', 'أجب عن السؤال القادم 📖')}</div>
    </div>
    <div class="next-in" id="nextIn" style="text-align:center"></div>`);
}

function onQuiz(q) {
  const prevPhase = quiz?.phase;
  const prevId = quiz?.id;
  quiz = q;
  quizEnd = Date.now() + (q.endsIn || 0);
  lastTick = -1;
  if (q.phase === 'question' && (prevPhase !== 'question' || prevId !== q.id)) renderQuestion(q);
  else if (q.phase === 'reveal' && prevPhase !== 'reveal') renderReveal(q);
  else if (q.phase === 'idle' && prevPhase !== 'idle') { idleSince = Date.now(); renderWisdom(q.card); }
  else if (q.phase === 'idle' && !cardMode) { idleSince = Date.now(); renderWisdom(q.card); }
}

function updateAnswered(n) {
  const el = document.getElementById('answered');
  if (el && n !== undefined) el.textContent = fmt(n);
}

// تحديث المؤقت ودوران البطاقة أثناء الاستراحة
setInterval(() => {
  if (!quiz) return;
  const left = Math.max(0, quizEnd - Date.now());
  const secs = Math.ceil(left / 1000);
  const t = document.querySelector('#card .timer');
  if (t && (quiz.phase === 'question' || quiz.phase === 'reveal')) {
    const frac = quiz.duration ? left / quiz.duration : 0;
    t.querySelector('.fg').style.strokeDashoffset = String(276.5 * (1 - frac));
    t.querySelector('b').textContent = fmt(secs);
    t.classList.toggle('low', quiz.phase === 'question' && secs <= 5);
    if (quiz.phase === 'question' && secs <= 5 && secs > 0 && secs !== lastTick) { lastTick = secs; audio.play('tick'); }
  }
  if (quiz.phase === 'idle') {
    // نصف الاستراحة آية/حديث، والنصف الآخر لوحة الشرف
    const elapsed = Date.now() - idleSince;
    const slot = Math.floor(elapsed / 9000) % 2;
    if (slot === 1 && cardMode === 'wisdom') renderBoard();
    if (slot === 0 && cardMode === 'board') renderWisdom(quiz.card);
    const nx = document.getElementById('nextIn');
    if (nx) nx.innerHTML = quiz.endsIn || left ? `السؤال القادم بعد <b>${fmt(secs)}</b> ثانية` : '';
  }
}, 250);

// ------------------------------------------------------------------
// التأثيرات
// ------------------------------------------------------------------
function onFx(fx) {
  switch (fx.type) {
    case 'gift': return onGift(fx);
    case 'stars':
      scene.addLikeStars(Math.min(fx.count, 25));
      break;
    case 'dhikr':
      floatDhikr(fx.label, fx.user);
      audio.play('dhikr');
      break;
    case 'dhikrMilestone':
      scene.sparkle(540, 300);
      say(`ما شاء الله! بلغت المسبحة ${fmt(fx.total)} تسبيحة 📿`, 5000, true);
      audio.play('win');
      break;
    case 'answer':
      if (recentAnswerers.length < 7) {
        recentAnswerers.push(fx.user);
        const box = document.getElementById('answerers');
        if (box) box.insertAdjacentHTML('beforeend', avatar(fx.user));
      }
      updateAnswered(fx.answered);
      break;
    case 'doves':
      scene.releaseDoves(fx.users);
      break;
    case 'follow':
      toast({ user: fx.user, what: 'انضمّ إلى القافلة 🕊️ — حيّاك الله', kind: 'follow', iconHtml: `<span class="ico">${ICONS.dove}</span>` });
      scene.releaseDoves([fx.user]);
      scene.shootingStar();
      audio.play('follow');
      thank(`أهلاً بك يا ${fx.user.nickname} في القافلة 🕊️`);
      break;
    case 'share':
      toast({ user: fx.user, what: 'نشر النور وشارك البث ✨', kind: 'follow', iconHtml: `<span class="ico">${ICONS.star}</span>` });
      scene.shootingStar();
      scene.shootingStar();
      audio.play('sparkle');
      thank(`جزاك الله خيراً يا ${fx.user.nickname} على النشر ✨`);
      break;
    case 'welcome':
      if (Date.now() > sayUntil) say(`حيّاك الله يا ${fx.user.nickname} 🌙`, 3000);
      break;
    case 'levelUp': return onLevelUp(fx);
    case 'reset':
      scene.setTheme(0);
      break;
    case 'challengeStart':
      say(`تحدّي! ${fmt(fx.target)} تسبيحة خلال ${fmt(fx.seconds)} ثانية 📿 اكتبوا: سبحان الله`, 8000, true);
      audio.play('question');
      break;
    case 'challengeEnd':
      if (fx.success) {
        banner(`<span class="b-ico">${ICONS.tasbih}</span><h2>اكتمل تحدّي التسبيح!</h2><p>${fmt(fx.count)} تسبيحة — بارك الله فيكم · مكافأة ${fmt(fx.bonus)} نقطة نور</p>`);
        scene.celebrate();
        audio.play('levelUp');
      } else {
        say(`انتهى التحدّي: ${fmt(fx.count)} من ${fmt(fx.target)} — نحاول مرة أخرى قريباً 🤍`, 6000);
      }
      break;
    case 'say':
      say(fx.text, 9000, true);
      break;
    case 'banner':
      banner(`<span class="b-ico">${ICONS.moon}</span><h2>${esc(fx.text)}</h2>`, 7000);
      audio.play('sparkle');
      break;
    default: break;
  }
}

function onGift(fx) {
  const { user, kind, count } = fx;
  const icon = GIFT_ICON[kind] || 'gift';
  const iconHtml = kind === 'other' && fx.gift.image
    ? `<img src="${esc(fx.gift.image)}" alt="" referrerpolicy="no-referrer">`
    : `<span class="ico">${ICONS[icon]}</span>`;
  toast({ user, kind, iconHtml, count, what: fx.action, points: fx.points });

  switch (fx.effect) {
    case 'flower':
      scene.addFlowers(count, user.nickname);
      audio.play('rose');
      thank(`جزاك الله خيراً يا ${user.nickname} 🌹 تفتّحت ${count > 1 ? `${fmt(count)} زهرات` : 'زهرة'} باسمك`);
      break;
    case 'lantern':
      scene.spawnLanterns(count, user.nickname);
      audio.play('lantern');
      thank(`أضاء ${user.nickname} سماءنا بالفوانيس ❤️`);
      break;
    case 'feed':
      scene.startCaravan(user.nickname, count);
      audio.play('feed');
      thank(`اللهم تقبّل! ${user.nickname} أطعم مسافري القافلة 🍩`);
      break;
    case 'musk':
      scene.muskWave();
      muskEnd = Date.now() + fx.muskIn;
      $('#muskChip').classList.remove('hidden');
      audio.play('musk');
      thank(`نفحات المسك من ${user.nickname} 🧴 النقاط مضاعفة الآن!`);
      break;
    default:
      scene.sparkle(540 + (Math.random() - 0.5) * 500, 1100);
      audio.play('sparkle');
      thank(`شكراً يا ${user.nickname} على ${fx.gift.name || 'الهدية'} 🎁`);
  }

  if (fx.big) {
    scene.procession();
    audio.play('big');
    banner(`${avatar(user, 'b-av')}<h2>موكب النور</h2><p>${esc(user.nickname)} أضاء الواحة بهدية كبرى — جزاك الله خيراً</p>`, 6500);
  }
}

function onLevelUp(fx) {
  scene.celebrate();
  setTimeout(() => scene.setTheme(fx.theme), 4500);
  audio.play('levelUp');
  const top = fx.top?.length
    ? `<div class="b-top">${fx.top.map((u) => `<div>${avatar(u)}<span>${esc(u.nickname)}</span></div>`).join('')}</div>`
    : '';
  banner(`<span class="b-ico">${ICONS.lantern}</span><h2>أُنير المسجد! الله أكبر</h2><p>بدأت الليلة ${fmt(fx.level)} — شكراً لكل من شارك</p>${top}`, 8000);
  say('أُنير المسجد كاملاً بفضل الله ثم بكم ✨', 8000, true);
}

// ------------------------------------------------------------------
// الإعدادات القادمة من لوحة التحكم
// ------------------------------------------------------------------
function onSettings(s) {
  settings = s;
  if (s.audio) audio.configure(s.audio);
  $('#card').classList.toggle('hide-quiz', s.showQuiz === false);
  $('#ticker').classList.toggle('hidden', s.showTicker === false);
}

// ------------------------------------------------------------------
// الاتصال بالخادم
// ------------------------------------------------------------------
const socket = io();
socket.on('state', renderState);
socket.on('quiz', onQuiz);
socket.on('fx', onFx);
socket.on('settings', onSettings);
