const $ = (id) => document.getElementById(id);
const socket = io();
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const fmt = (n) => Number(n || 0).toLocaleString('en-US');
const fallback = (name = '?') => `data:image/svg+xml;charset=utf-8,${encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" fill="#2d4a8a"/><text x="32" y="43" font-size="30" font-family="Arial" fill="#fff" text-anchor="middle">${esc([...String(name)][0] || '?')}</text></svg>`)}`;
const time = (t) => new Date(t).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

let state = null;
let settings = null;
let offset = 0;
const PHASES = { playing: '🟢 جارية', victory: '🏆 شاشة الفوز', paused: '⏸ متوقفة' };

// ------------------------------------------------------------------
// الاتصال بتيك توك
// ------------------------------------------------------------------
$('username').value = localStorage.getItem('noor:user') || '';
$('connect').onclick = () => {
  const u = $('username').value.trim().replace(/^@/, '');
  try { localStorage.setItem('noor:user', u); } catch { /* تجاهل */ }
  socket.emit('admin:connect', u);
};
$('disconnect').onclick = () => socket.emit('admin:disconnect');
socket.on('tiktokStatus', (s) => {
  $('ttDot').className = `dot ${s.state}`;
  $('ttMsg').textContent = s.message || 'غير متصل';
  if (s.username && !$('username').value) $('username').value = s.username;
});

// ------------------------------------------------------------------
// الجولة
// ------------------------------------------------------------------
const confirmThen = (msg, ev) => () => { if (confirm(msg)) socket.emit(ev); };
$('newRound').onclick = confirmThen('بدء جولة جديدة؟ سيُصفَّر نور الفرق الحالي.', 'admin:newRound');
$('finish').onclick = () => socket.emit('admin:finishRound');
$('pause').onclick = () => socket.emit('admin:pause');
$('resume').onclick = () => socket.emit('admin:resume');
$('quizNow').onclick = () => socket.emit('admin:quiz');
$('quizEnd').onclick = () => socket.emit('admin:endQuiz');
$('resetSession').onclick = confirmThen('تصفير كل شيء (الفرق، أهل الكرم، العدادات، الفائزين)؟', 'admin:resetSession');

// ------------------------------------------------------------------
// المحاكاة
// ------------------------------------------------------------------
const GIFTS = [
  ['🌹', 'Rose', 1], ['🫶', 'Heart Me', 1], ['🤞', 'Finger Heart', 5], ['🧴', 'Perfume', 20],
  ['🍩', 'Doughnut', 30], ['💞', 'Hand Hearts', 100], ['🌌', 'Galaxy', 1000], ['🦁', 'Lion', 29999],
];
$('simGifts').innerHTML = GIFTS.map(([e, n, c], i) => `<button data-g="${i}"><span>${e}</span>${n}<small>${fmt(c)} 🪙</small></button>`).join('');
const simName = () => $('simName').value.trim() || 'مختبر';
$('simGifts').onclick = (ev) => {
  const b = ev.target.closest('button[data-g]');
  if (!b) return;
  const [, name, coins] = GIFTS[b.dataset.g];
  socket.emit('sim:gift', { name: simName(), gift: name, coins, count: Number($('simCount').value) || 1 });
};
const sendComment = (text) => socket.emit('sim:comment', { name: simName(), text });
$('simSend').onclick = () => { sendComment($('simText').value); $('simText').value = ''; };
$('simText').onkeydown = (e) => { if (e.key === 'Enter') $('simSend').onclick(); };
$('simDhikr').innerHTML = ['سبحان الله', 'الحمد لله', 'الله أكبر', 'أستغفر الله', 'اللهم صل على محمد']
  .map((d) => `<button data-c="${d}">${d}</button>`).join('');
$('simDhikr').onclick = (e) => { const b = e.target.closest('button'); if (b) sendComment(b.dataset.c); };
document.querySelectorAll('[data-ans]').forEach((b) => { b.onclick = () => sendComment(b.dataset.ans); });
$('simLike').onclick = () => socket.emit('sim:like', { name: simName(), count: 50 });
$('simFollow').onclick = () => socket.emit('sim:follow', { name: simName() });
$('simShare').onclick = () => socket.emit('sim:share', { name: simName() });
$('simTeams').onclick = (e) => { const b = e.target.closest('button'); if (b) sendComment(b.dataset.t); };

$('demo').onchange = (e) => socket.emit('admin:demo', e.target.checked);
$('burst').onclick = () => socket.emit('admin:burst');
socket.on('demoStatus', (s) => { $('demo').checked = s.running; });

// ------------------------------------------------------------------
// الإعدادات
// ------------------------------------------------------------------
const form = $('settings');
function fillSettings() {
  for (const el of form.elements) {
    if (!el.name || !(el.name in settings)) continue;
    if (el.type === 'checkbox') el.checked = Boolean(settings[el.name]);
    else el.value = settings[el.name];
  }
  const names = state?.teams.map((t) => t.name) || [];
  $('teamNames').innerHTML = [0, 1, 2, 3].map((i) => `<input data-team="${i}" placeholder="فريق ${i + 1}" value="${esc(settings.teamNames?.[i] || names[i] || '')}">`).join('');
}
function readSettings() {
  const out = {};
  for (const el of form.elements) {
    if (!el.name) continue;
    out[el.name] = el.type === 'checkbox' ? el.checked : el.type === 'number' || el.type === 'range' ? Number(el.value) : el.value;
  }
  out.teamNames = [...document.querySelectorAll('[data-team]')].map((i) => i.value.trim());
  return out;
}
form.onsubmit = (e) => { e.preventDefault(); socket.emit('admin:settings', readSettings()); };
// مستوى الصوت والخلفية تُطبَّق فوراً
form.musicVolume.oninput = form.sfxVolume.oninput = form.musicMode.onchange = () => {
  socket.emit('admin:settings', { musicVolume: Number(form.musicVolume.value), sfxVolume: Number(form.sfxVolume.value), musicMode: form.musicMode.value });
};
$('resetSettings').onclick = () => { if (confirm('إرجاع كل الإعدادات للقيم الافتراضية؟')) socket.emit('admin:resetSettings'); };
socket.on('settings', (s) => {
  const first = !settings;
  settings = s;
  // لا نكتب فوق ما يحرره المستخدم إلا عند أول تحميل أو بعد الحفظ
  if (first || !form.contains(document.activeElement)) fillSettings();
});

// ------------------------------------------------------------------
// الحالة
// ------------------------------------------------------------------
socket.on('state', (s) => {
  offset = s.serverNow - Date.now();
  const firstTeams = !state;
  state = s;
  if (firstTeams && settings) fillSettings();
  $('phase').textContent = PHASES[s.phase] || s.phase;
  $('round').textContent = s.round;
  $('simTeams').innerHTML = s.teams.map((t, i) => `<button data-t="${i + 1}" style="border-color:${t.color}">انضم ${i + 1} · ${esc(t.name)}</button>`).join('');
  $('teamBars').innerHTML = s.teams.map((t) => `
    <div class="teambar"><div class="lbl"><span style="color:${t.color}">${esc(t.name)} ${t.boostUntil ? '🌸' : ''}</span>
      <span><span class="ltr">${fmt(t.light)} / ${fmt(s.target)}</span> · 👥 ${fmt(t.members)}</span></div>
      <div class="bar"><i style="width:${Math.min(100, (t.light / s.target) * 100)}%;background:${t.color}"></i></div></div>`).join('');
  const ss = s.session;
  $('stats').innerHTML = [['🪙 عملات', ss.coins], ['🎁 هدايا', ss.gifts], ['📿 أذكار', ss.dhikr], ['❤️ إعجابات', ss.likes],
    ['➕ متابعات', ss.followers], ['👥 مشاركون', s.players]].map(([k, v]) => `<div>${k}<b>${fmt(v)}</b></div>`).join('');
  $('supporters').innerHTML = s.supporters.length
    ? s.supporters.map((u, i) => `<div class="sup">${i + 1}. <img src="${esc(u.avatar || fallback(u.nickname))}" alt=""><span class="n">${esc(u.nickname)}</span><b>${fmt(u.coins)} 🪙</b></div>`).join('')
    : '<div class="muted">لا هدايا بعد</div>';
  $('history').innerHTML = s.history.length
    ? s.history.map((h) => `<div><time>${time(h.at)}</time>الجولة ${h.round}: <b style="color:${h.color}">${esc(h.team)}</b> (${fmt(h.light)}) ${h.mvp ? `· الأبرز: ${esc(h.mvp)}` : ''}</div>`).join('')
    : '<div class="muted">لا فائزين بعد</div>';
  const q = s.quiz;
  $('quizInfo').innerHTML = q ? `<div class="quizbox">📜 <b>${esc(q.q)}</b><br>${q.options.map((o, i) => `${'أبجد'[i]}) ${esc(o)} — ${q.counts[i]}`).join('<br>')}
    ${q.revealed ? `<br>✅ الإجابة: <b>${esc(q.options[q.answer])}</b> · صحيح: ${q.correctCount}` : ''}</div>` : '';
});

setInterval(() => {
  if (!state) return;
  const ms = state.phase === 'playing' ? state.endsAt - (Date.now() + offset)
    : state.phase === 'victory' ? state.victoryEndsAt - (Date.now() + offset) : state.pausedLeft || 0;
  const sec = Math.max(0, Math.ceil(ms / 1000));
  $('clock').textContent = `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
}, 500);

// ------------------------------------------------------------------
// السجل
// ------------------------------------------------------------------
const addLog = (e, top = true) => {
  const div = document.createElement('div');
  div.innerHTML = `<time>${time(e.at)}</time>${esc(e.message)}`;
  if (top) $('log').prepend(div); else $('log').append(div);
  while ($('log').children.length > 120) $('log').lastChild.remove();
};
socket.on('logs', (list) => { $('log').innerHTML = ''; list.forEach((e) => addLog(e, false)); });
socket.on('log', (e) => addLog(e));
