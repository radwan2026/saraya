'use strict';
// منطق لعبة «المؤمن الصغير»: رسم الرقعة، الأدوار، النرد، البطاقات

// ───────── إعداد الرقعة ─────────
const LAST = 67;            // آخر مربع مرقّم
const END = 68;             // نهاية الرحلة
const COLS = 11, STEP = 115, TS = 110;
const X_RIGHT = 1595, X_LEFT = X_RIGHT - (COLS - 1) * STEP;
const ROW_Y = [120, 360, 600, 840, 1080];
const R_MID = 120, R_IN = 64, R_OUT = 176;

// ألوان المربعات كما في الرقعة المطبوعة: W أبيض، S رمادي، Y أصفر، G أخضر
const COLORS_STR =
  'WSYGSWYWYWG' + 'WSG' +
  'YWGWYWYWSYG' + 'WSG' +
  'YWSGYWYWSGS' + 'WYW' +
  'YWSGSWYWYGS' + 'WSG' +
  'YWSWYWYGSWY';
const TILE_TYPE = {};
for (let n = 1; n <= LAST; n++) TILE_TYPE[n] = COLORS_STR[n - 1];

const TREASURE = { 4: 14, 17: 28, 32: 56, 38: 64 };   // نقطة الكنز ← مربع الكنز
const LADDERS = { 11: 17, 25: 52, 46: 64 };           // أسفل السلم ← أعلاه (أخضر إلى أخضر)
const TORNADO = { 31: 10, 60: 44 };                   // الزوبعة ← المربع المكتوب عليها
const BONUS = { 14: 2, 28: 2, 52: 2, 56: 2, 64: 1 };  // مكافأة خطوات إضافية

const FILL = { W: '#edece7', S: '#b9b8b3', Y: '#d6a024', G: '#5c8a2a' };
const NUM_COLOR = { W: '#3a2310', S: '#3a2310', Y: '#3a2310', G: '#fbf1dc' };

const ICONS = ['🐪', '🐎', '🌙', '⭐', '🌴', '🦅', '🕌', '📖'];
const PLAYER_COLORS = ['#b8322a', '#2a62b8', '#7a3fb0', '#e07b12'];

const START_POS = { x: 1790, y: 150 };
const END_POS = { x: 245, y: 1075 };

function tileInfo(n) {
  if (n <= 0) return { x: START_POS.x, y: START_POS.y };
  if (n >= END) return { x: END_POS.x, y: END_POS.y };
  const idx = n - 1, block = Math.floor(idx / 14), r = idx % 14;
  if (r < COLS) {
    const rtl = block % 2 === 0;
    const x = rtl ? X_RIGHT - r * STEP : X_LEFT + r * STEP;
    return { kind: 'rect', x, y: ROW_Y[block] };
  }
  const k = r - COLS;
  const left = block % 2 === 0;
  const cx = left ? X_LEFT - STEP / 2 : X_RIGHT + STEP / 2;
  const cy = (ROW_Y[block] + ROW_Y[block + 1]) / 2;
  const a1 = left ? 270 - 60 * k : 270 + 60 * k;
  const a2 = left ? a1 - 60 : a1 + 60;
  const am = (a1 + a2) / 2;
  const rad = d => d * Math.PI / 180;
  return { kind: 'arc', left, cx, cy, a1, a2, x: cx + R_MID * Math.cos(rad(am)), y: cy + R_MID * Math.sin(rad(am)), am };
}

// ───────── أدوات SVG ─────────
const SVGNS = 'http://www.w3.org/2000/svg';
function el(tag, attrs = {}, parent) {
  const e = document.createElementNS(SVGNS, tag);
  for (const k in attrs) e.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(e);
  return e;
}
function pt(cx, cy, r, deg) { const a = deg * Math.PI / 180; return [cx + r * Math.cos(a), cy + r * Math.sin(a)]; }
function sectorPath(t, inset = 3) {
  const s = t.left ? -1 : 1;
  const a1 = t.a1 + s * 0.8, a2 = t.a2 - s * 0.8;
  const ro = R_OUT - inset, ri = R_IN + inset;
  const [x1, y1] = pt(t.cx, t.cy, ro, a1), [x2, y2] = pt(t.cx, t.cy, ro, a2);
  const [x3, y3] = pt(t.cx, t.cy, ri, a2), [x4, y4] = pt(t.cx, t.cy, ri, a1);
  const sw = t.left ? 0 : 1;
  return `M${x1},${y1} A${ro},${ro} 0 0 ${sw} ${x2},${y2} L${x3},${y3} A${ri},${ri} 0 0 ${1 - sw} ${x4},${y4} Z`;
}

// ───────── رسم الرقعة ─────────
const svg = document.getElementById('board');
let tokenLayer;

function drawBoard() {
  svg.innerHTML = '';
  const defs = el('defs', {}, svg);
  defs.innerHTML = `
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f6c47a"/><stop offset=".5" stop-color="#e9973a"/><stop offset="1" stop-color="#cf6a22"/>
    </linearGradient>
    <linearGradient id="scroll" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#f3e6c6"/><stop offset="1" stop-color="#d9c294"/>
    </linearGradient>
    <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="6" flood-color="#5a2e0c" flood-opacity=".35"/></filter>`;

  el('rect', { x: 0, y: 0, width: 2000, height: 1200, fill: 'url(#sky)' }, svg);
  // كثبان رملية
  const dunes = [
    ['M0,260 C300,170 520,320 820,230 S1400,120 1700,250 S2000,200 2000,200 V0 H0Z', '#f2b462', .55],
    ['M0,560 C260,460 600,620 900,520 S1500,420 2000,560 V420 C1700,300 1300,360 1000,420 S300,380 0,460Z', '#f0a24c', .5],
    ['M0,900 C350,800 650,960 1000,880 S1650,780 2000,900 V760 C1600,700 1300,760 1000,780 S400,720 0,800Z', '#dc7f2f', .45],
    ['M0,1200 V1060 C300,980 700,1120 1050,1050 S1700,960 2000,1080 V1200Z', '#c45f1d', .55],
  ];
  for (const [d, f, o] of dunes) el('path', { d, fill: f, opacity: o }, svg);

  // ظل المسار والإطار الرملي
  const track = `M1700,120 L${X_LEFT - STEP / 2},120 A120,120 0 0 0 ${X_LEFT - STEP / 2},360 L${X_RIGHT + STEP / 2},360 A120,120 0 0 1 ${X_RIGHT + STEP / 2},600 L${X_LEFT - STEP / 2},600 A120,120 0 0 0 ${X_LEFT - STEP / 2},840 L${X_RIGHT + STEP / 2},840 A120,120 0 0 1 ${X_RIGHT + STEP / 2},1080 L330,1080`;
  el('path', { d: track, fill: 'none', stroke: '#7a3f12', 'stroke-opacity': .35, 'stroke-width': 150, 'stroke-linejoin': 'round', transform: 'translate(0,8)' }, svg);
  el('path', { d: track, fill: 'none', stroke: '#f3d9a4', 'stroke-width': 136, 'stroke-linejoin': 'round' }, svg);

  // المربعات
  const tiles = el('g', { id: 'tiles' }, svg);
  for (let n = 1; n <= LAST; n++) {
    const t = tileInfo(n), type = TILE_TYPE[n];
    const g = el('g', { id: 'tile-' + n }, tiles);
    if (t.kind === 'rect') el('rect', { x: t.x - TS / 2, y: t.y - TS / 2, width: TS, height: TS, rx: 6, fill: FILL[type] }, g);
    else el('path', { d: sectorPath(t), fill: FILL[type] }, g);
    const numY = t.kind === 'rect' ? t.y + 38 : t.y + 14;
    const numX = t.kind === 'rect' ? t.x + 22 : t.x;
    el('text', { x: numX, y: numY, 'text-anchor': 'middle', 'font-family': 'Reem Kufi, Tajawal, sans-serif', 'font-weight': 700, 'font-size': 38, fill: NUM_COLOR[type] }, g).textContent = n;
  }

  // ديكور: خيمتا البداية والنهاية
  drawTent(1790, 110, 'بداية الرحلة');
  drawTent(245, 1035, 'نهاية الرحلة');

  // اللفافة الوسطى
  const sc = el('g', { filter: 'url(#soft)' }, svg);
  el('rect', { x: 760, y: 428, width: 560, height: 108, rx: 10, fill: 'url(#scroll)', stroke: '#a77c3d', 'stroke-width': 3 }, sc);
  for (const cx of [760, 1320]) el('rect', { x: cx - 16, y: 420, width: 32, height: 124, rx: 16, fill: '#c9a76a', stroke: '#8a5d24', 'stroke-width': 3 }, sc);
  el('text', { x: 1040, y: 492, 'text-anchor': 'middle', 'font-family': 'Reem Kufi, sans-serif', 'font-weight': 700, 'font-size': 62, fill: '#6b3d12', direction: 'rtl' }, sc).textContent = 'المؤمن الصغير';
  el('text', { x: 1040, y: 526, 'text-anchor': 'middle', 'font-family': 'Tajawal, sans-serif', 'font-weight': 700, 'font-size': 24, fill: '#3a2310', direction: 'rtl' }, sc).textContent = 'لعبة تعليمية ثقافية';

  // نخيل وجمل للزينة
  drawPalm(150, 470, 1);
  drawPalm(1890, 760, .9);
  drawPalm(110, 860, .8);

  // السلالم
  for (const [from, to] of Object.entries(LADDERS)) drawLadder(+from, to);
  // الكنوز
  for (const [from, to] of Object.entries(TREASURE)) drawTreasureStart(+from, to);
  for (const to of Object.values(TREASURE)) drawChest(to);
  // المكافآت
  for (const [n, v] of Object.entries(BONUS)) drawBonus(+n, v);
  // الزوابع
  for (const [from, to] of Object.entries(TORNADO)) drawTornado(+from, to);

  tokenLayer = el('g', { id: 'tokens' }, svg);
}

function drawTent(x, y, label) {
  const g = el('g', { filter: 'url(#soft)' }, svg);
  el('path', { d: `M${x - 95},${y + 55} L${x},${y - 75} L${x + 95},${y + 55} Z`, fill: '#f4ead6', stroke: '#8a5d24', 'stroke-width': 4 }, g);
  el('path', { d: `M${x - 28},${y + 55} L${x},${y - 5} L${x + 28},${y + 55} Z`, fill: '#5a3514' }, g);
  el('line', { x1: x, y1: y - 75, x2: x, y2: y - 105, stroke: '#8a5d24', 'stroke-width': 5 }, g);
  el('path', { d: `M${x},${y - 105} l26,8 l-26,8 Z`, fill: '#b8322a' }, g);
  el('rect', { x: x - 100, y: y + 62, width: 200, height: 54, rx: 27, fill: '#5a3514' }, g);
  el('text', { x, y: y + 99, 'text-anchor': 'middle', 'font-family': 'Reem Kufi, sans-serif', 'font-weight': 700, 'font-size': 32, fill: '#fbf1dc', direction: 'rtl' }, g).textContent = label;
}

function drawPalm(x, y, s) {
  const g = el('g', { transform: `translate(${x},${y}) scale(${s})`, opacity: .9 }, svg);
  el('path', { d: 'M0,0 C6,-60 2,-120 10,-170', stroke: '#7a4a1c', 'stroke-width': 14, fill: 'none', 'stroke-linecap': 'round' }, g);
  const leaves = [[-80, -150], [-70, -200], [10, -230], [80, -195], [90, -145]];
  for (const [lx, ly] of leaves) el('path', { d: `M10,-170 Q${(lx + 10) / 2},${ly - 30} ${lx},${ly}`, stroke: '#3f7d22', 'stroke-width': 16, fill: 'none', 'stroke-linecap': 'round' }, g);
}

function drawLadder(from, to) {
  const a = tileInfo(from), b = tileInfo(to);
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
  const ux = dx / len, uy = dy / len, px = -uy * 16, py = ux * 16;
  const g = el('g', { opacity: .95, filter: 'url(#soft)' }, svg);
  for (const k of [1, -1]) el('line', { x1: a.x + px * k, y1: a.y + py * k, x2: b.x + px * k, y2: b.y + py * k, stroke: '#7b4a1b', 'stroke-width': 9, 'stroke-linecap': 'round' }, g);
  for (let d = 28; d < len - 10; d += 30) {
    const cx = a.x + ux * d, cy = a.y + uy * d;
    el('line', { x1: cx + px, y1: cy + py, x2: cx - px, y2: cy - py, stroke: '#c48a45', 'stroke-width': 7 }, g);
  }
  for (const k of [1, -1]) el('line', { x1: a.x + px * k, y1: a.y + py * k, x2: b.x + px * k, y2: b.y + py * k, stroke: '#c48a45', 'stroke-width': 3 }, g);
  // سهم صغير يبين اتجاه الصعود
  const mx = a.x + dx * .5, my = a.y + dy * .5;
  const ang = Math.atan2(dy, dx) * 180 / Math.PI;
  el('path', { d: 'M-16,-12 L16,0 L-16,12 Z', fill: '#fbf1dc', stroke: '#3a2310', 'stroke-width': 3, transform: `translate(${mx},${my}) rotate(${ang})` }, g);
}

function drawChestShape(g, x, y, s) {
  const c = el('g', { transform: `translate(${x},${y}) scale(${s})` }, g);
  el('rect', { x: -30, y: -6, width: 60, height: 34, rx: 4, fill: '#8a5526', stroke: '#3a2310', 'stroke-width': 3 }, c);
  el('path', { d: 'M-30,-6 Q0,-38 30,-6 Z', fill: '#a8692e', stroke: '#3a2310', 'stroke-width': 3 }, c);
  el('rect', { x: -32, y: -8, width: 64, height: 7, fill: '#d6a024', stroke: '#3a2310', 'stroke-width': 2 }, c);
  el('rect', { x: -7, y: 2, width: 14, height: 16, rx: 2, fill: '#e6e2d6', stroke: '#3a2310', 'stroke-width': 2 }, c);
}

function drawTreasureStart(n, to) {
  const t = tileInfo(n);
  const g = el('g', {}, svg);
  drawChestShape(g, t.x - 18, t.y - 12, .9);
  const lx = t.x, ly = t.y - 78;
  el('rect', { x: lx - 62, y: ly - 26, width: 124, height: 42, rx: 21, fill: '#2f6d16', stroke: '#fbf1dc', 'stroke-width': 3 }, g);
  el('text', { x: lx, y: ly + 5, 'text-anchor': 'middle', 'font-family': 'Reem Kufi, sans-serif', 'font-weight': 700, 'font-size': 26, fill: '#fff', direction: 'rtl' }, g).textContent = `كنز ← ${to}`;
}

function drawChest(n) {
  const t = tileInfo(n);
  const g = el('g', {}, svg);
  // في المنعطفات يوضع الصندوق خارج المسار حتى لا يغطي الرقم
  let cx = t.x - 14, cy = t.y - 14;
  if (t.kind === 'arc') [cx, cy] = pt(t.cx, t.cy, R_OUT + 52, t.am);
  drawChestShape(g, cx, cy, .9);
  el('text', { x: cx, y: cy - 34, 'text-anchor': 'middle', 'font-family': 'Reem Kufi, sans-serif', 'font-weight': 700, 'font-size': 22, fill: '#fff', stroke: '#2f6d16', 'stroke-width': 5, 'paint-order': 'stroke', direction: 'rtl' }, g).textContent = 'كنز';
}

function drawBonus(n, v) {
  const t = tileInfo(n);
  let bx = t.x - 34, by = t.y + 30;
  if (t.kind === 'arc') [bx, by] = pt(t.cx, t.cy, R_MID - 2, t.am + (t.left ? 20 : -20));
  const g = el('g', {}, svg);
  el('circle', { cx: bx, cy: by, r: 18, fill: '#2f6d16', stroke: '#fff', 'stroke-width': 3 }, g);
  const bt = { y: by + 7, 'text-anchor': 'middle', 'font-family': 'Tajawal, sans-serif', 'font-weight': 800, 'font-size': 20, fill: '#fff' };
  el('text', { ...bt, x: bx - 6 }, g).textContent = '+';   // يُرسمان منفصلين ليظهرا «+2» في اتجاه RTL
  el('text', { ...bt, x: bx + 6 }, g).textContent = v;
}

function drawTornado(n, to) {
  const t = tileInfo(n);
  const g = el('g', { filter: 'url(#soft)' }, svg);
  const rings = [[0, -48, 46, 13], [4, -26, 36, 11], [-2, -6, 27, 9], [5, 12, 19, 8], [0, 28, 12, 6], [3, 40, 6, 4]];
  for (const [ox, oy, rx, ry] of rings) el('ellipse', { cx: t.x + ox - 10, cy: t.y + oy - 10, rx, ry, fill: '#9b6a3c', stroke: '#5a3514', 'stroke-width': 3 }, g);
  el('rect', { x: t.x - 70, y: t.y - 112, width: 120, height: 40, rx: 20, fill: '#5a3514', stroke: '#fbf1dc', 'stroke-width': 3 }, g);
  el('text', { x: t.x - 10, y: t.y - 83, 'text-anchor': 'middle', 'font-family': 'Reem Kufi, sans-serif', 'font-weight': 700, 'font-size': 25, fill: '#fbf1dc', direction: 'rtl' }, g).textContent = `زوبعة ← ${to}`;
}

// ───────── حالة اللعبة ─────────
const state = { players: [], turn: 0, busy: false, over: false, extraTurn: false, decks: {} };
let setupCount = 2;
let setupDraft = [];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const SOURCES = { luck: LUCK_CARDS, question: QUESTION_CARDS, challenge: CHALLENGE_CARDS, treasure: TREASURE_CARDS };
function drawCard(kind) {
  if (!state.decks[kind] || !state.decks[kind].length) state.decks[kind] = shuffle(SOURCES[kind]);
  return state.decks[kind].pop();
}
function stepsWord(n) { return n === 1 ? 'خطوة واحدة' : n === 2 ? 'خطوتين' : n + ' خطوات'; }
const sleep = ms => new Promise(r => setTimeout(r, ms));
const $ = id => document.getElementById(id);

// ───────── الأشكال على الرقعة ─────────
function buildTokens() {
  tokenLayer.innerHTML = '';
  state.players.forEach((p, i) => {
    const g = el('g', { class: 'token', id: 'token-' + i }, tokenLayer);
    el('circle', { class: 'halo', cx: 0, cy: 0, r: 40, fill: p.color, opacity: .35 }, g);
    el('circle', { cx: 0, cy: 4, r: 33, fill: '#000', opacity: .25 }, g);
    el('circle', { cx: 0, cy: 0, r: 33, fill: p.color, stroke: '#fff', 'stroke-width': 5 }, g);
    el('text', { x: 0, y: 13, 'text-anchor': 'middle', 'font-size': 36 }, g).textContent = p.icon;
    p.el = g;
  });
  placeTokens();
}

function placeTokens() {
  const groups = {};
  state.players.forEach((p, i) => { (groups[p.pos] ||= []).push(i); });
  const OFF = [[-24, -20], [24, -20], [-24, 22], [24, 22]];
  for (const [pos, ids] of Object.entries(groups)) {
    const c = tileInfo(+pos);
    ids.forEach((i, k) => {
      const [ox, oy] = ids.length > 1 ? OFF[k] : [0, 0];
      state.players[i].el.style.transform = `translate(${c.x + ox}px, ${c.y + oy}px)`;
    });
  }
  state.players.forEach((p, i) => p.el.classList.toggle('active-token', i === state.turn && !state.over));
  // الشكل صاحب الدور في الأعلى
  const cur = state.players[state.turn];
  if (cur && cur.el.parentNode) cur.el.parentNode.appendChild(cur.el);
}

async function stepMove(p, steps) {
  const dir = Math.sign(steps);
  for (let s = 0; s < Math.abs(steps); s++) {
    const next = p.pos + dir;
    if (next < 0 || p.pos >= END) break;
    p.pos = next;
    placeTokens();
    await sleep(240);
    if (p.pos >= END) break;
  }
  renderPlayers();
}

async function flyTo(p, target) {
  p.el.classList.add('fly');
  p.pos = Math.max(0, Math.min(END, target));
  placeTokens();
  await sleep(950);
  p.el.classList.remove('fly');
  renderPlayers();
}

function highlight(n) {
  const g = $('tile-' + n);
  if (!g) return;
  g.classList.remove('tile-hl'); void g.getBoundingClientRect(); g.classList.add('tile-hl');
}

// ───────── اللوحة الجانبية ─────────
function chipHTML(p, cls = '') { return `<span class="chip ${cls}" style="background:${p.color}">${p.icon}</span>`; }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function posLabel(pos) { return pos <= 0 ? 'البداية' : pos >= END ? 'النهاية' : 'مربع ' + pos; }

function renderPlayers() {
  $('players').innerHTML = state.players.map((p, i) =>
    `<li class="player-row ${i === state.turn && !state.over ? 'active' : ''}">${chipHTML(p)}<span class="pname">${esc(p.name)}</span><span class="ppos">${posLabel(p.pos)}</span></li>`).join('');
  const cur = state.players[state.turn];
  $('turnName').innerHTML = cur ? `${chipHTML(cur)}<span>${esc(cur.name)}</span>` : '—';
}

function log(msg, kind = '') {
  const li = document.createElement('li');
  li.className = kind ? 'k-' + kind : '';
  li.textContent = msg;
  $('log').prepend(li);
  while ($('log').children.length > 40) $('log').lastChild.remove();
}

let toastTimer;
function toast(msg) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const t = document.createElement('div');
  t.className = 'toast'; t.textContent = msg;
  document.body.appendChild(t);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.remove(), 2400);
}

// ───────── النرد ─────────
const PIPS = { 1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8], 6: [0, 2, 3, 5, 6, 8] };
function setDie(v) {
  const die = $('die');
  if (!die.children.length) for (let i = 0; i < 9; i++) { const s = document.createElement('span'); s.className = 'pip'; die.appendChild(s); }
  [...die.children].forEach((s, i) => s.classList.toggle('on', PIPS[v].includes(i)));
  die.setAttribute('aria-label', `النرد: ${v}. اضغط للرمي`);
}
async function rollDie() {
  const die = $('die');
  die.classList.add('rolling');
  for (let i = 0; i < 9; i++) { setDie(1 + Math.floor(Math.random() * 6)); await sleep(65); }
  const v = 1 + Math.floor(Math.random() * 6);
  setDie(v);
  die.classList.remove('rolling');
  return v;
}
function setBusy(b) {
  state.busy = b;
  $('die').disabled = b || state.over;
  $('diceHint').textContent = state.over ? 'انتهت الرحلة' : b ? '...' : 'اضغط على النرد أو زر المسافة';
}

// ───────── البطاقات ─────────
function openCard(type, kindLabel, inner) {
  const ov = $('cardOverlay');
  ov.innerHTML = `<div class="card" data-type="${type}" role="dialog" aria-modal="true">
    <div class="card-arch"><div class="card-kind">${kindLabel}</div>${inner}</div>
    <div class="card-actions"></div></div>`;
  ov.hidden = false;
  return { root: ov.querySelector('.card'), arch: ov.querySelector('.card-arch'), actions: ov.querySelector('.card-actions') };
}
function closeCard() { $('cardOverlay').hidden = true; $('cardOverlay').innerHTML = ''; }
function button(label, cls, onClick) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'btn ' + cls; b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}
function waitButtons(actions, defs) {
  return new Promise(res => {
    actions.innerHTML = '';
    defs.forEach(([label, cls, val]) => actions.appendChild(button(label, cls, () => res(val))));
    actions.querySelector('button')?.focus();
  });
}

async function luckCard(p) {
  const c = drawCard('luck');
  const effect = c.extra ? 'ارمِ النرد مرة أخرى' : c.steps > 0 ? `تقدّم ${stepsWord(c.steps)}` : `ارجع ${stepsWord(-c.steps)}`;
  const { actions } = openCard('luck', 'بطاقات الحظ',
    `<div class="card-sub">${esc(p.name)}</div><p class="card-text">${esc(c.title)}:<br>${esc(c.text)}<br>${effect}</p>`);
  await waitButtons(actions, [['حسناً', 'primary', 1]]);
  closeCard();
  if (c.extra) { state.extraTurn = true; log(`${p.name}: ${c.title} ← رمية إضافية`, 'good'); return; }
  log(`${p.name}: ${c.title} ← ${effect}`, c.steps > 0 ? 'good' : 'bad');
  await stepMove(p, c.steps);
}

async function questionCard(p) {
  const c = drawCard('question');
  const { arch, actions } = openCard('question', 'بطاقات الأسئلة',
    `<div class="card-sub">${esc(p.name)} — صح أم خطأ؟</div><p class="card-text">${esc(c.q)}</p><div class="slot"></div>
     <div class="reward" aria-label="الجائزة: تقدم ${c.steps}">تقدم<b>${c.steps}</b></div>`);
  const ans = await waitButtons(actions, [['صح', 'primary', true], ['خطأ', 'danger', false]]);
  const ok = ans === c.a;
  arch.querySelector('.slot').innerHTML =
    `<div class="verdict ${c.a}">${c.a ? 'صح' : 'خطأ'}</div>
     <div class="card-answer">${esc(c.ex)}</div>
     <div class="result-msg ${ok ? 'good' : 'bad'}">${ok ? `أحسنت يا ${esc(p.name)}! تقدّم ${stepsWord(c.steps)}` : 'إجابتك غير صحيحة، تبقى في مكانك'}</div>`;
  await waitButtons(actions, [['متابعة', 'primary', 1]]);
  closeCard();
  log(`${p.name}: سؤال — ${ok ? 'إجابة صحيحة ← تقدّم ' + stepsWord(c.steps) : 'إجابة خاطئة'}`, ok ? 'good' : 'bad');
  if (ok) await stepMove(p, c.steps);
}

async function challengeCard(p) {
  const c = drawCard('challenge');
  const { arch, actions } = openCard('challenge', 'بطاقات التحدي',
    `<div class="card-sub">${esc(p.name)}، أجب بصوت مسموع</div><p class="card-text">${esc(c.q)}</p><div class="slot"></div>`);
  await waitButtons(actions, [['أظهر الإجابة', 'primary', 1]]);
  arch.querySelector('.slot').innerHTML = `<div class="divider"></div><div class="answer-gold">الإجابة<br>${esc(c.a)}</div>`;
  const ok = await waitButtons(actions, [['أجاب صحيحاً (+2)', 'primary', true], ['لم يوفّق', 'danger', false]]);
  closeCard();
  log(`${p.name}: تحدٍّ — ${ok ? 'نجح ← تقدّم خطوتين' : 'لم يوفّق'}`, ok ? 'good' : 'bad');
  if (ok) await stepMove(p, 2);
}

async function treasureCard(p, target) {
  const c = drawCard('treasure');
  const opts = shuffle(c.options.map((t, i) => ({ t, ok: i === 0 })));
  const { arch, actions } = openCard('treasure', 'بطاقات الكنوز',
    `<div class="card-sub">${esc(p.name)} — أصب لتنتقل إلى الكنز ${target}</div><p class="card-text">${esc(c.q)}</p>
     <div class="options">${opts.map((o, i) => `<button type="button" data-i="${i}">${esc(o.t)}</button>`).join('')}</div><div class="slot"></div>`);
  actions.innerHTML = '';
  const chosen = await new Promise(res => arch.querySelectorAll('.options button').forEach(b => b.addEventListener('click', () => res(+b.dataset.i))));
  const ok = opts[chosen].ok;
  arch.querySelectorAll('.options button').forEach((b, i) => {
    b.disabled = true;
    if (opts[i].ok) b.classList.add('correct');
    else if (i === chosen) b.classList.add('wrong');
  });
  arch.querySelector('.slot').innerHTML = `<div class="result-msg ${ok ? 'good' : 'bad'}">${ok ? `فتحت الكنز! انتقل فوراً إلى المربع ${target}` : 'لم تفتح الكنز هذه المرة، تبقى في مكانك'}</div>`;
  await waitButtons(actions, [['متابعة', 'primary', 1]]);
  closeCard();
  log(`${p.name}: كنز — ${ok ? 'إجابة صحيحة ← المربع ' + target : 'إجابة خاطئة'}`, ok ? 'gold' : 'bad');
  if (ok) { highlight(target); await flyTo(p, target); }
}

// ما يحدث عند الوقوف على مربع
async function resolveTile(p) {
  const n = p.pos;
  if (n < 1 || n > LAST) return;
  if (TORNADO[n]) {
    toast(`زوبعة! تحملك إلى المربع ${TORNADO[n]}`);
    log(`${p.name}: زوبعة ← المربع ${TORNADO[n]}`, 'bad');
    await sleep(500); highlight(TORNADO[n]);
    await flyTo(p, TORNADO[n]);
    return;
  }
  if (LADDERS[n]) {
    toast(`سلّم! اصعد إلى المربع ${LADDERS[n]}`);
    log(`${p.name}: سلّم ← المربع ${LADDERS[n]}`, 'good');
    await sleep(500); highlight(LADDERS[n]);
    await flyTo(p, LADDERS[n]);
    await resolveTile(p);            // مربع أعلى السلم يُفعَّل
    return;
  }
  if (TREASURE[n]) return treasureCard(p, TREASURE[n]);
  if (BONUS[n]) {
    toast(`مكافأة! تقدّم ${stepsWord(BONUS[n])}`);
    log(`${p.name}: مكافأة +${BONUS[n]}`, 'good');
    await sleep(400);
    await stepMove(p, BONUS[n]);
    return;
  }
  const type = TILE_TYPE[n];
  if (type === 'W') return questionCard(p);
  if (type === 'S') return luckCard(p);
  if (type === 'Y') return challengeCard(p);
}

// ───────── الدور ─────────
async function playTurn() {
  if (state.busy || state.over || !state.players.length) return;
  setBusy(true);
  const p = state.players[state.turn];
  state.extraTurn = false;
  const roll = await rollDie();
  log(`${p.name} رمى النرد: ${roll}`);
  await stepMove(p, roll);
  if (p.pos < END) await resolveTile(p);
  if (p.pos >= END) return finish(p);
  if (state.extraTurn) toast(`${p.name} يرمي النرد مرة أخرى`);
  else state.turn = (state.turn + 1) % state.players.length;
  placeTokens(); renderPlayers();
  setBusy(false);
  $('die').focus();
}

function finish(winner) {
  state.over = true;
  winner.pos = END;
  placeTokens(); renderPlayers(); setBusy(false);
  log(`🏆 الفائز: ${winner.name}`, 'gold');
  const ranking = state.players.slice().sort((a, b) => b.pos - a.pos);
  const ov = $('cardOverlay');
  ov.innerHTML = `<div class="sheet win" role="dialog" aria-modal="true">
    <h2>مبارك الفوز!</h2>
    <div class="chip big-chip" style="background:${winner.color}">${winner.icon}</div>
    <p class="lead">أول من بلغ نهاية الرحلة: <strong>${esc(winner.name)}</strong>. هنيئاً لك لقب «المؤمن الصغير» في هذه الجولة.</p>
    <ol>${ranking.map(p => `<li>${esc(p.name)} — ${posLabel(p.pos)}</li>`).join('')}</ol>
    <div class="setup-foot"><button class="btn" type="button" id="winClose">عرض الرقعة</button>
    <button class="btn primary" type="button" id="winAgain">العب مرة أخرى بنفس اللاعبين</button></div></div>`;
  ov.hidden = false;
  confetti();
  $('winClose').onclick = closeCard;
  $('winAgain').onclick = () => { closeCard(); startGame(state.players.map(({ name, icon, color }) => ({ name, icon, color }))); };
}

function confetti() {
  const box = document.createElement('div');
  box.className = 'confetti';
  const cols = ['#d6a024', '#5c8a2a', '#b8322a', '#2a62b8', '#fbf1dc'];
  for (let i = 0; i < 90; i++) {
    const c = document.createElement('i');
    c.style.left = Math.random() * 100 + '%';
    c.style.background = cols[i % cols.length];
    c.style.animationDuration = 2.5 + Math.random() * 2.5 + 's';
    c.style.animationDelay = Math.random() * .8 + 's';
    box.appendChild(c);
  }
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 6000);
}

function startGame(players) {
  state.players = players.map(p => ({ ...p, pos: 0 }));
  state.turn = 0; state.over = false; state.extraTurn = false; state.decks = {};
  $('log').innerHTML = '';
  buildTokens(); renderPlayers(); setDie(6); setBusy(false);
  log(`بدأت الرحلة! يلعب أولاً ${state.players[0].name}.`, 'gold');
  $('setup').hidden = true;
  $('die').focus();
}

// ───────── شاشة الإعداد ─────────
function renderSetup() {
  while (setupDraft.length < 4) {
    const i = setupDraft.length;
    setupDraft.push({ name: '', icon: ICONS[i], color: PLAYER_COLORS[i] });
  }
  document.querySelectorAll('#countPick button').forEach(b => b.setAttribute('aria-pressed', +b.dataset.n === setupCount));
  const taken = i => setupDraft.slice(0, setupCount).filter((_, j) => j !== i).map(p => p.icon);
  $('setupPlayers').innerHTML = setupDraft.slice(0, setupCount).map((p, i) => `
    <div class="setup-row">
      <label for="pname-${i}"><span class="chip" style="background:${p.color}">${p.icon}</span> اللاعب ${i + 1}</label>
      <input id="pname-${i}" data-i="${i}" maxlength="18" placeholder="اكتب الاسم" value="${esc(p.name)}" autocomplete="off">
      <div class="icons" role="group" aria-label="شكل اللاعب ${i + 1}">
        ${ICONS.map(ic => `<button type="button" data-i="${i}" data-icon="${ic}" aria-pressed="${ic === p.icon}" ${taken(i).includes(ic) ? 'disabled' : ''}>${ic}</button>`).join('')}
      </div>
    </div>`).join('');
}

function openSetup() {
  if (!setupDraft.length && state.players.length) setupDraft = state.players.map(({ name, icon, color }) => ({ name, icon, color }));
  if (state.players.length) setupCount = state.players.length;
  $('setupErr').textContent = '';
  renderSetup();
  $('setup').hidden = false;
  $('pname-0')?.focus();
}

$('countPick').addEventListener('click', e => {
  const b = e.target.closest('button[data-n]');
  if (!b) return;
  setupCount = +b.dataset.n;
  // تأكد من عدم تكرار الأشكال بين اللاعبين الظاهرين
  const used = new Set();
  setupDraft.slice(0, setupCount).forEach(p => { if (used.has(p.icon)) p.icon = ICONS.find(ic => !used.has(ic)); used.add(p.icon); });
  renderSetup();
});
$('setupPlayers').addEventListener('input', e => {
  if (e.target.matches('input[data-i]')) setupDraft[+e.target.dataset.i].name = e.target.value;
});
$('setupPlayers').addEventListener('click', e => {
  const b = e.target.closest('button[data-icon]');
  if (!b || b.disabled) return;
  setupDraft[+b.dataset.i].icon = b.dataset.icon;
  renderSetup();
  document.querySelector(`.icons button[data-i="${b.dataset.i}"][data-icon="${b.dataset.icon}"]`)?.focus();
});
$('setupForm').addEventListener('submit', e => {
  e.preventDefault();
  const players = setupDraft.slice(0, setupCount).map(p => ({ ...p, name: p.name.trim() }));
  const missing = players.findIndex(p => !p.name);
  if (missing >= 0) { $('setupErr').textContent = `اكتب اسم اللاعب ${missing + 1}.`; $('pname-' + missing).focus(); return; }
  const names = players.map(p => p.name);
  if (new Set(names).size !== names.length) { $('setupErr').textContent = 'لكل لاعب اسم مختلف، غيّر الأسماء المتكررة.'; return; }
  startGame(players);
});

// ───────── الأزرار العامة ─────────
function openRules() { $('rules').hidden = false; $('rulesClose').focus(); }
$('btnRules').addEventListener('click', openRules);
$('setupRules').addEventListener('click', openRules);
$('rulesClose').addEventListener('click', () => { $('rules').hidden = true; });
$('rules').addEventListener('click', e => { if (e.target.id === 'rules') $('rules').hidden = true; });
$('btnNew').addEventListener('click', () => { if (!state.busy) openSetup(); });
$('die').addEventListener('click', playTurn);
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('rules').hidden) { $('rules').hidden = true; return; }
  if (e.code === 'Space' && $('setup').hidden && $('rules').hidden && $('cardOverlay').hidden && !e.target.closest('input, button')) {
    e.preventDefault(); playTurn();
  }
});

// ───────── التشغيل ─────────
drawBoard();
setDie(1);
// لاعبون تجريبيون حتى تُظهر الرقعة شكلها قبل الإعداد
state.players = [{ name: 'لاعب 1', icon: ICONS[0], color: PLAYER_COLORS[0], pos: 0 }, { name: 'لاعب 2', icon: ICONS[1], color: PLAYER_COLORS[1], pos: 0 }];
buildTokens(); renderPlayers(); setBusy(false);
state.players = [];
openSetup();
