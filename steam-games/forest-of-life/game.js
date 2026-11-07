/* ===============================================================
   غابة الحياة — الرسم والتحكم والمهمات
   =============================================================== */
(() => {
  'use strict';

  const E = window.Ecosystem;
  const A = window.ForestAudio;
  const WD = E.WORLD;
  const GY = WD.groundY;

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };
  const lerp = (a, b, k) => a + (b - a) * k;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

  // ------------------------------------------------------------------
  // الحفظ المحلي
  // ------------------------------------------------------------------
  const STORE_KEY = 'steamGames.forestOfLife.v1';
  const store = (() => {
    const def = { stars: [], discovered: [], music: true, sound: true, seenTips: [] };
    try { return { ...def, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') }; } catch { return def; }
  })();
  function save() { try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* تجاهل */ } }

  function notify(event, data = {}) {
    try {
      if (window.parent && window.parent !== window) window.parent.postMessage({ source: 'steam-games', game: 'forest-of-life', event, ...data }, '*');
    } catch { /* تجاهل */ }
  }

  // ------------------------------------------------------------------
  // الألوان
  // ------------------------------------------------------------------
  function hex(c) { const n = parseInt(c.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function mix(a, b, k) {
    const x = hex(a); const y = hex(b);
    return `rgb(${Math.round(lerp(x[0], y[0], k))},${Math.round(lerp(x[1], y[1], k))},${Math.round(lerp(x[2], y[2], k))})`;
  }
  const SKY = [
    [0.00, '#6a7fd0', '#ffc59e'], [0.08, '#4fa3ff', '#cfeaff'], [0.34, '#3b8ff0', '#aee0ff'],
    [0.58, '#5b86d6', '#ffe0a8'], [0.67, '#46479a', '#ff9a6b'], [0.73, '#161c4a', '#41437e'],
    [0.85, '#060a24', '#121a42'], [0.95, '#0b1236', '#2a2f66'], [1.00, '#6a7fd0', '#ffc59e'],
  ];
  function skyAt(p) {
    for (let i = 0; i < SKY.length - 1; i++) {
      const a = SKY[i]; const b = SKY[i + 1];
      if (p >= a[0] && p <= b[0]) {
        const k = (p - a[0]) / (b[0] - a[0]);
        return [mix(a[1], b[1], k), mix(a[2], b[2], k)];
      }
    }
    return [SKY[0][1], SKY[0][2]];
  }
  /** درجة الظلام 0..1 */
  function darkness(p) {
    if (p < 0.05) return lerp(0.55, 0, p / 0.05);
    if (p < WD.dayPart - 0.04) return 0;
    if (p < WD.dayPart + 0.06) return lerp(0, 0.62, (p - (WD.dayPart - 0.04)) / 0.1);
    if (p < 0.95) return 0.62;
    return lerp(0.62, 0.55, (p - 0.95) / 0.05);
  }

  // ------------------------------------------------------------------
  // اللوحة
  // ------------------------------------------------------------------
  const cv = $('scene');
  const ctx = cv.getContext('2d');
  const view = { w: 0, h: 0, dpr: 1, s: 1, ox: 0, oy: 0 };
  let bgStars = [];
  let mountains = [];
  let hills = [];

  function resize() {
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.w = cv.clientWidth; view.h = cv.clientHeight;
    cv.width = Math.round(view.w * view.dpr); cv.height = Math.round(view.h * view.dpr);
    const bottom = $('toolbar').offsetHeight || 100;
    view.s = Math.min(view.w / WD.width, view.h / WD.height);
    view.ox = (view.w - WD.width * view.s) / 2;
    view.oy = Math.min(view.h - WD.height * view.s, view.h - bottom - 26 - GY * view.s);
    bgStars = Array.from({ length: 140 }, () => ({ x: Math.random(), y: Math.random() * 0.6, r: 0.5 + Math.random() * 1.4, p: Math.random() * 6 }));
    $('rotateHint').classList.toggle('hidden', !(view.h > view.w * 1.15 && view.w < 700 && current === null));
  }
  window.addEventListener('resize', resize);

  // تضاريس ثابتة (بذرة ثابتة لتبقى الخلفية نفسها)
  (function makeTerrain() {
    const r = E.seeded(42);
    const left = -800; const right = WD.width + 800;
    for (let x = left; x <= right; x += 40) mountains.push([x, 380 + Math.sin(x * 0.004) * 60 + Math.sin(x * 0.011) * 30 + r() * 14]);
    for (let x = left; x <= right; x += 30) hills.push([x, 540 + Math.sin(x * 0.006 + 1) * 34 + Math.sin(x * 0.017) * 14]);
  })();

  function toWorld(px, py) { return { x: (px - view.ox) / view.s, y: (py - view.oy) / view.s }; }

  // ------------------------------------------------------------------
  // الحالة
  // ------------------------------------------------------------------
  let world = E.showcase(E.seeded(Date.now() % 100000));
  let level = null;           // المهمة الحالية (أو اللعب الحر)
  let levelIdx = -1;
  let running = true;         // تعمل المحاكاة؟
  let speed = 1;
  let tool = null;
  let pointer = null;         // موقع المؤشر بإحداثيات العالم
  let current = 'menu';       // الشاشة الظاهرة (null = أثناء اللعب)
  let finished = false;
  const fx = [];
  const ambientClouds = Array.from({ length: 5 }, (_, i) => ({ x: i * 340 + Math.random() * 200, y: 110 + Math.random() * 140, s: 0.6 + Math.random() * 0.7, v: 6 + Math.random() * 8 }));
  const fireflies = Array.from({ length: 26 }, () => ({ x: Math.random() * WD.width, y: GY - 30 - Math.random() * 260, p: Math.random() * 6, v: 0.5 + Math.random() }));
  const sessionTips = new Set();

  // ------------------------------------------------------------------
  // رسم الكائنات (كل دالة ترسم على لوحة g بإحداثيات العالم)
  // ------------------------------------------------------------------
  function drawGrass(g, p, t) {
    const n = 4 + Math.floor(p.seed * 4);
    const hgt = 8 + 40 * p.growth;
    const col = mix('#c9b25a', p.growth < 0.4 ? '#7fe06a' : '#36b24a', clamp(p.health, 0, 1));
    const col2 = mix('#b39a46', '#2a8f3c', clamp(p.health, 0, 1));
    const sway = Math.sin(t * 1.7 + p.x * 0.05) * 4 * p.growth + (world.clouds.length ? Math.sin(t * 6 + p.x) * 2 : 0);
    for (let i = 0; i < n; i++) {
      const bx = p.x + (i - n / 2) * 4.2;
      const h = hgt * (0.65 + ((i * 37 + p.seed * 100) % 10) / 28);
      const lean = (i - n / 2) * 2.2 + sway;
      g.fillStyle = i % 2 ? col : col2;
      g.beginPath();
      g.moveTo(bx - 2.6, GY);
      g.quadraticCurveTo(bx + lean * 0.4, GY - h * 0.6, bx + lean, GY - h);
      g.quadraticCurveTo(bx + lean * 0.4 + 1.5, GY - h * 0.6, bx + 2.6, GY);
      g.fill();
    }
  }

  function drawFlower(g, p, t) {
    const gr = p.growth;
    const h = 14 + 52 * gr;
    const wilt = 1 - clamp(p.health, 0, 1);
    const sway = Math.sin(t * 1.5 + p.x * 0.07) * 4 * gr;
    const hx = p.x + sway + wilt * 10; const hy = GY - h + wilt * 14;
    g.strokeStyle = mix('#3f9c3a', '#9c8a3a', wilt); g.lineWidth = 3;
    g.beginPath(); g.moveTo(p.x, GY); g.quadraticCurveTo(p.x + sway * 0.3, GY - h * 0.5, hx, hy); g.stroke();
    g.fillStyle = mix('#4fb84a', '#a79a4a', wilt);
    if (gr > 0.25) {
      g.beginPath(); g.ellipse(p.x + 7, GY - h * 0.35, 8 * gr, 3.5, -0.5, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(p.x - 7, GY - h * 0.5, 8 * gr, 3.5, 0.5, 0, Math.PI * 2); g.fill();
    }
    if (gr < 0.6) {
      g.fillStyle = '#5fbf56'; g.beginPath(); g.ellipse(hx, hy, 4 + 4 * gr, 6 + 6 * gr, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = p.color; g.beginPath(); g.ellipse(hx, hy - 4 - 4 * gr, 2.5 + 3 * gr, 3 + 2 * gr, 0, 0, Math.PI * 2); g.fill();
      return;
    }
    const open = clamp((gr - 0.6) / 0.4, 0, 1);
    const R = 5 + 9 * open;
    g.save(); g.translate(hx, hy); g.rotate(wilt * 0.9 + Math.sin(t * 2 + p.x) * 0.05);
    g.fillStyle = mix(p.color, '#b8a77a', wilt * 0.8);
    for (let i = 0; i < 6; i++) {
      g.rotate(Math.PI / 3);
      g.beginPath(); g.ellipse(0, -R * 0.7, R * 0.45, R * 0.75, 0, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = '#ffcf3a'; g.beginPath(); g.arc(0, 0, R * 0.38, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#c98a1a'; g.beginPath(); g.arc(R * 0.08, R * 0.08, R * 0.16, 0, Math.PI * 2); g.fill();
    g.restore();
    if (p.pollinated) {
      g.strokeStyle = `rgba(255,240,150,${0.5 + 0.4 * Math.sin(t * 6 + p.x)})`; g.lineWidth = 2;
      g.beginPath(); g.arc(hx, hy, R + 6, 0, Math.PI * 2); g.stroke();
    }
  }

  function drawTree(g, p, t) {
    const gr = p.growth;
    const wilt = 1 - clamp(p.health, 0, 1);
    const trunkH = 24 + 150 * gr;
    const tw = 4 + 16 * gr;
    const sway = Math.sin(t * 0.9 + p.x * 0.01) * 3 * gr;
    // الجذع
    const tg = g.createLinearGradient(p.x - tw, 0, p.x + tw, 0);
    tg.addColorStop(0, '#5a3a1e'); tg.addColorStop(0.5, '#8a5a2b'); tg.addColorStop(1, '#4a2f18');
    g.fillStyle = tg;
    g.beginPath();
    g.moveTo(p.x - tw * 0.8, GY); g.lineTo(p.x - tw * 0.45 + sway * 0.3, GY - trunkH); g.lineTo(p.x + tw * 0.45 + sway * 0.3, GY - trunkH); g.lineTo(p.x + tw * 0.8, GY);
    g.fill();
    if (gr < 0.25) {
      g.fillStyle = '#5fc65a';
      g.beginPath(); g.ellipse(p.x + 6 + sway, GY - trunkH, 9, 4, -0.5, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(p.x - 6 + sway, GY - trunkH + 4, 9, 4, 0.5, 0, Math.PI * 2); g.fill();
      return;
    }
    // الفروع
    g.strokeStyle = '#6a4322'; g.lineWidth = tw * 0.35;
    g.beginPath(); g.moveTo(p.x + sway * 0.3, GY - trunkH * 0.7); g.lineTo(p.x + 30 * gr + sway, GY - trunkH * 0.95); g.stroke();
    g.beginPath(); g.moveTo(p.x + sway * 0.3, GY - trunkH * 0.6); g.lineTo(p.x - 32 * gr + sway, GY - trunkH * 0.9); g.stroke();
    // التاج
    const R = 18 + 62 * gr;
    const cx = p.x + sway; const cy = GY - trunkH - R * 0.45;
    const blobs = [[0, -0.35, 0.75], [-0.6, 0, 0.62], [0.6, 0.02, 0.62], [-0.3, 0.3, 0.6], [0.3, 0.32, 0.6], [0, 0.05, 0.7]];
    const dark = mix('#1f7a3a', '#8a7a2a', wilt); const light = mix('#5fd16a', '#d2b04a', wilt);
    blobs.forEach(([dx, dy, rr], i) => {
      const bx = cx + dx * R + Math.sin(t * 1.1 + i) * 1.5; const by = cy + dy * R;
      const lg = g.createRadialGradient(bx - rr * R * 0.3, by - rr * R * 0.35, rr * R * 0.15, bx, by, rr * R);
      lg.addColorStop(0, light); lg.addColorStop(1, dark);
      g.fillStyle = lg; g.beginPath(); g.arc(bx, by, rr * R, 0, Math.PI * 2); g.fill();
    });
    if (gr >= 0.8) {
      const r2 = E.seeded(Math.floor(p.seed * 1000));
      for (let i = 0; i < 6; i++) {
        const fx2 = cx + (r2() - 0.5) * R * 1.4; const fy = cy + (r2() - 0.3) * R * 0.9;
        g.fillStyle = '#ff4d4d'; g.beginPath(); g.arc(fx2, fy, 4.5, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(fx2 - 1.4, fy - 1.4, 1.3, 0, Math.PI * 2); g.fill();
      }
    }
  }

  function drawMushroom(g, m, t) {
    const k = clamp(Math.min(m.t / 0.8, (m.life - m.t) / 1.5), 0, 1);
    if (k <= 0) return;
    g.save(); g.translate(m.x, GY); g.scale(k, k);
    g.fillStyle = '#f5ead6'; g.fillRect(-3, -12, 6, 12);
    g.fillStyle = '#e8453c'; g.beginPath(); g.ellipse(0, -12, 11, 8, 0, Math.PI, Math.PI * 2); g.fill();
    g.fillStyle = '#fff';
    [[-5, -15, 1.8], [3, -17, 1.5], [6, -13, 1.2]].forEach(([x, y, r]) => { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill(); });
    g.restore();
  }

  function drawRabbit(g, a, t, moving) {
    const sc = a.baby ? 0.62 : 1;
    const hop = moving ? Math.abs(Math.sin(t * 9 + a.id)) * 12 : 0;
    const fur = a.seed > 0.66 ? '#f4efe8' : a.seed > 0.33 ? '#cfb79a' : '#a8896c';
    g.save(); g.translate(a.x, a.y - hop * sc); g.scale(a.dir * sc, sc);
    g.fillStyle = 'rgba(0,0,0,.15)'; g.beginPath(); g.ellipse(0, hop + 2, 16, 4, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(-15, -11, 5, 0, Math.PI * 2); g.fill();
    g.fillStyle = fur;
    g.beginPath(); g.ellipse(-2, -11, 15, 11, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(12, -20, 8.5, 0, Math.PI * 2); g.fill();
    const ear = a.state === 'flee' ? -0.8 : -0.25;
    [[8, 0], [13, 0.25]].forEach(([ex, off]) => {
      g.save(); g.translate(ex, -27); g.rotate(ear + off);
      g.fillStyle = fur; g.beginPath(); g.ellipse(0, -9, 3.6, 10, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffb3c1'; g.beginPath(); g.ellipse(0, -9, 1.6, 7, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    });
    g.fillStyle = '#ffb3c1'; g.beginPath(); g.arc(20, -19, 1.8, 0, Math.PI * 2); g.fill();
    if (a.state === 'sleep') {
      g.strokeStyle = '#333'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(13, -22); g.lineTo(17, -22); g.stroke();
    } else { g.fillStyle = '#222'; g.beginPath(); g.arc(15, -22, 1.8, 0, Math.PI * 2); g.fill(); }
    g.restore();
    if (a.state === 'sleep') floatZ(g, a, t);
  }

  function floatZ(g, a, t) {
    const k = (t * 0.6 + a.id * 0.3) % 1;
    g.globalAlpha = 1 - k; g.fillStyle = '#fff'; g.font = `700 ${12 + k * 8}px sans-serif`; g.textAlign = 'center';
    g.fillText('z', a.x + 10 * a.dir, a.y - 40 - k * 24); g.globalAlpha = 1;
  }

  function drawFox(g, a, t, moving) {
    const sc = a.baby ? 0.6 : 1;
    const run = moving ? t * (a.state === 'hunt' ? 16 : 10) + a.id : 0;
    g.save(); g.translate(a.x, a.y); g.scale(a.dir * sc, sc);
    g.fillStyle = 'rgba(0,0,0,.16)'; g.beginPath(); g.ellipse(0, 2, 26, 5, 0, 0, Math.PI * 2); g.fill();
    // الذيل
    g.save(); g.translate(-22, -18); g.rotate(-0.5 + Math.sin(t * 3 + a.id) * 0.15);
    g.fillStyle = '#e8742a'; g.beginPath(); g.ellipse(-12, 0, 16, 7, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.ellipse(-24, 0, 6, 5, 0, 0, Math.PI * 2); g.fill();
    g.restore();
    // الأرجل
    g.strokeStyle = '#3a2416'; g.lineWidth = 3.5; g.lineCap = 'round';
    [[-12, 0], [-6, Math.PI], [8, Math.PI], [14, 0]].forEach(([lx, ph]) => {
      const sw = moving ? Math.sin(run + ph) * 6 : 0;
      g.beginPath(); g.moveTo(lx, -10); g.lineTo(lx + sw, 0); g.stroke();
    });
    g.fillStyle = '#ee7d2f'; g.beginPath(); g.ellipse(0, -16, 22, 10, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff3e6'; g.beginPath(); g.ellipse(12, -12, 8, 6, 0, 0, Math.PI * 2); g.fill();
    // الرأس
    g.fillStyle = '#ee7d2f';
    g.beginPath(); g.moveTo(14, -28); g.lineTo(38, -18); g.lineTo(16, -12); g.closePath(); g.fill();
    g.beginPath(); g.arc(19, -22, 9, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(13, -28); g.lineTo(15, -40); g.lineTo(21, -29); g.fill();
    g.beginPath(); g.moveTo(20, -29); g.lineTo(25, -39); g.lineTo(27, -27); g.fill();
    g.fillStyle = '#fff3e6'; g.beginPath(); g.moveTo(22, -16); g.lineTo(38, -18); g.lineTo(24, -12); g.fill();
    g.fillStyle = '#222'; g.beginPath(); g.arc(38, -18, 2, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(22, -24, 1.8, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  function drawCaterpillar(g, a, t) {
    const sc = a.baby ? 0.7 : 1;
    if (a.cocoon) {
      const wob = Math.sin(t * 5 + a.id) * 0.12 * (a.cocoonT > 6 ? 3 : 1);
      g.save(); g.translate(a.x, GY); g.rotate(wob);
      const cg = g.createLinearGradient(-8, -30, 8, 0);
      cg.addColorStop(0, '#c9d37a'); cg.addColorStop(1, '#8a7a3a');
      g.fillStyle = cg; g.beginPath(); g.ellipse(0, -14, 8, 15, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(80,60,20,.5)'; g.lineWidth = 1.2;
      for (let i = -1; i <= 1; i++) { g.beginPath(); g.moveTo(-7, -14 + i * 6); g.quadraticCurveTo(0, -11 + i * 6, 7, -14 + i * 6); g.stroke(); }
      g.restore();
      return;
    }
    g.save(); g.translate(a.x, GY); g.scale(a.dir * sc, sc);
    for (let i = 5; i >= 0; i--) {
      const wave = Math.max(0, Math.sin(t * 5 - i * 0.9 + a.id)) * 4;
      g.fillStyle = i === 0 ? '#2f9a3a' : i % 2 ? '#7fd34a' : '#5fc040';
      g.beginPath(); g.arc(-i * 6.5, -6 - wave, i === 0 ? 6.5 : 5.5, 0, Math.PI * 2); g.fill();
      if (i > 0) { g.fillStyle = '#ffd23f'; g.beginPath(); g.arc(-i * 6.5, -9 - wave, 1.3, 0, Math.PI * 2); g.fill(); }
    }
    g.strokeStyle = '#2a5a1a'; g.lineWidth = 1.3;
    g.beginPath(); g.moveTo(2, -11); g.lineTo(5, -17); g.moveTo(-1, -11); g.lineTo(0, -17); g.stroke();
    g.fillStyle = '#111'; g.beginPath(); g.arc(3, -7, 1.3, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  const WING = ['#ff6fb5', '#ffb03a', '#5fd3ff', '#b07cff', '#ffe14a'];
  function drawButterfly(g, a, t) {
    const flap = Math.abs(Math.sin(t * (a.state === 'sleep' ? 2 : 13) + a.id));
    const col = WING[Math.floor(a.seed * WING.length)];
    g.save(); g.translate(a.x, a.y + Math.sin(t * 3 + a.id) * 4); g.scale(a.dir, 1);
    g.fillStyle = col;
    g.save(); g.scale(0.25 + 0.75 * flap, 1);
    g.beginPath(); g.ellipse(-8, -6, 10, 8, -0.4, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(8, -6, 10, 8, 0.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = mix(col, '#ffffff', 0.35);
    g.beginPath(); g.ellipse(-6, 6, 6, 6, 0.3, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(6, 6, 6, 6, -0.3, 0, Math.PI * 2); g.fill();
    g.fillStyle = 'rgba(255,255,255,.7)'; g.beginPath(); g.arc(-9, -7, 2.4, 0, Math.PI * 2); g.arc(9, -7, 2.4, 0, Math.PI * 2); g.fill();
    g.restore();
    g.fillStyle = '#3a2a4a'; g.beginPath(); g.ellipse(0, 0, 2.2, 10, 0, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#3a2a4a'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(0, -9); g.lineTo(-4, -16); g.moveTo(0, -9); g.lineTo(4, -16); g.stroke();
    g.restore();
  }

  function drawBee(g, a, t) {
    const jx = Math.sin(t * 23 + a.id) * 1.2; const jy = Math.cos(t * 19 + a.id) * 1.2;
    g.save(); g.translate(a.x + jx, a.y + jy); g.scale(a.dir, 1);
    const flap = Math.abs(Math.sin(t * 40 + a.id));
    g.fillStyle = 'rgba(220,240,255,.8)';
    g.beginPath(); g.ellipse(-2, -9, 6, 4 + 3 * flap, -0.4, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(4, -9, 5, 3 + 3 * flap, 0.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffcc1a'; g.beginPath(); g.ellipse(0, 0, 10, 7, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2a2a2a';
    g.fillRect(-4, -6.5, 3, 13); g.fillRect(2, -6.5, 3, 13);
    g.beginPath(); g.arc(9, -1, 4.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(10.5, -2.5, 1.4, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2a2a2a'; g.beginPath(); g.moveTo(-10, 0); g.lineTo(-14, 1); g.lineTo(-10, 2); g.fill();
    g.restore();
  }

  const BIRD = ['#3a8bff', '#ff5a5a', '#ffb52a', '#2fc28a'];
  function drawBird(g, a, t) {
    const col = BIRD[Math.floor(a.seed * BIRD.length)];
    const perched = a.state === 'perch' && Math.abs(a.vxSeen || 0) < 0.3;
    const flap = perched ? 0 : Math.sin(t * 14 + a.id);
    const sc = a.baby ? 0.65 : 1;
    g.save(); g.translate(a.x, a.y); g.scale(a.dir * sc, sc);
    g.fillStyle = col; g.beginPath(); g.ellipse(0, 0, 13, 9, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.moveTo(-10, -2); g.lineTo(-22, -6); g.lineTo(-21, 4); g.fill();
    g.beginPath(); g.arc(11, -6, 7, 0, Math.PI * 2); g.fill();
    g.fillStyle = mix(col, '#ffffff', 0.55); g.beginPath(); g.ellipse(3, 3, 8, 5, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#ffb02a'; g.beginPath(); g.moveTo(17, -7); g.lineTo(24, -5); g.lineTo(17, -3); g.fill();
    g.fillStyle = '#111'; g.beginPath(); g.arc(13, -8, 1.7, 0, Math.PI * 2); g.fill();
    g.fillStyle = mix(col, '#000000', 0.25);
    g.beginPath(); g.moveTo(-4, -3); g.quadraticCurveTo(-2, -3 - 18 * flap, 6, -3 - 14 * flap); g.lineTo(4, 0); g.fill();
    if (perched) { g.strokeStyle = '#7a4a1a'; g.lineWidth = 1.5; g.beginPath(); g.moveTo(-2, 8); g.lineTo(-2, 12); g.moveTo(3, 8); g.lineTo(3, 12); g.stroke(); }
    g.restore();
  }

  function drawOrb(g, o, t) {
    const bob = Math.sin(t * 3 + o.id) * 5;
    const fade = o.life - o.t < 2 ? (o.life - o.t) / 2 : 1;
    const x = o.x; const y = o.y + bob - Math.min(o.t, 1) * 10;
    g.globalAlpha = fade;
    const gl = g.createRadialGradient(x, y, 2, x, y, 30);
    gl.addColorStop(0, o.kind === 'fruit' ? 'rgba(255,120,90,.7)' : 'rgba(255,230,120,.8)');
    gl.addColorStop(1, 'rgba(255,230,120,0)');
    g.fillStyle = gl; g.beginPath(); g.arc(x, y, 30, 0, Math.PI * 2); g.fill();
    if (o.kind === 'fruit') {
      g.fillStyle = '#ff3d3d'; g.beginPath(); g.arc(x, y, 10, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#3fa34a'; g.beginPath(); g.ellipse(x + 4, y - 11, 5, 2.5, -0.5, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,.75)'; g.beginPath(); g.arc(x - 3.5, y - 3.5, 2.8, 0, Math.PI * 2); g.fill();
    } else {
      g.fillStyle = '#ffe14a'; star(g, x, y, 11, 5, t * 2);
    }
    g.globalAlpha = 1;
  }
  function star(g, x, y, R, r, rot) {
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = rot + (i * Math.PI) / 5; const rr = i % 2 ? r : R; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
    g.closePath(); g.fill();
  }

  function drawCloud(g, x, y, s, dark) {
    g.fillStyle = dark ? 'rgba(110,125,150,.95)' : 'rgba(255,255,255,.9)';
    [[0, 0, 34], [30, -14, 30], [62, 0, 32], [-30, 6, 24], [92, 8, 22]].forEach(([dx, dy, r]) => {
      g.beginPath(); g.arc(x + dx * s, y + dy * s, r * s, 0, Math.PI * 2); g.fill();
    });
    g.fillRect(x - 30 * s, y, 124 * s, 24 * s * 0.8);
  }

  // ------------------------------------------------------------------
  // المشهد
  // ------------------------------------------------------------------
  const lastPos = new Map();
  function drawScene(t, dt) {
    const s = world;
    const phase = E.dayPhase(s);
    const dk = darkness(phase);
    const [top, bot] = skyAt(phase);

    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    const sk = ctx.createLinearGradient(0, 0, 0, view.oy + GY * view.s);
    sk.addColorStop(0, top); sk.addColorStop(1, bot);
    ctx.fillStyle = sk; ctx.fillRect(0, 0, view.w, view.h);
    // النجوم
    if (dk > 0.15) {
      ctx.fillStyle = '#fff';
      for (const st of bgStars) {
        ctx.globalAlpha = (dk - 0.15) * 1.6 * (0.5 + 0.5 * Math.sin(t * 2 + st.p));
        ctx.beginPath(); ctx.arc(st.x * view.w, st.y * view.h, st.r, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
    }

    // من هنا نرسم بإحداثيات العالم
    ctx.setTransform(view.dpr * view.s, 0, 0, view.dpr * view.s, view.dpr * view.ox, view.dpr * view.oy);
    const L = (view.ox / view.s) + 10; const Lx = -L; const Rx = WD.width + L;

    // الشمس والقمر
    if (phase < WD.dayPart) {
      const k = phase / WD.dayPart;
      const sx = lerp(-60, WD.width + 60, k); const sy = 520 - 420 * Math.sin(Math.PI * k);
      const sg = ctx.createRadialGradient(sx, sy, 10, sx, sy, 140);
      sg.addColorStop(0, 'rgba(255,240,170,.9)'); sg.addColorStop(0.25, 'rgba(255,210,90,.35)'); sg.addColorStop(1, 'rgba(255,200,80,0)');
      ctx.fillStyle = sg; ctx.beginPath(); ctx.arc(sx, sy, 140, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#fff2b0'; ctx.beginPath(); ctx.arc(sx, sy, 38, 0, Math.PI * 2); ctx.fill();
    } else {
      const k = (phase - WD.dayPart) / (1 - WD.dayPart);
      const mx = lerp(WD.width + 40, -40, k); const my = 480 - 360 * Math.sin(Math.PI * k);
      const mg = ctx.createRadialGradient(mx, my, 10, mx, my, 110);
      mg.addColorStop(0, 'rgba(220,230,255,.5)'); mg.addColorStop(1, 'rgba(220,230,255,0)');
      ctx.fillStyle = mg; ctx.beginPath(); ctx.arc(mx, my, 110, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#f1f4ff'; ctx.beginPath(); ctx.arc(mx, my, 30, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(180,190,220,.6)'; ctx.beginPath(); ctx.arc(mx - 9, my - 6, 6, 0, Math.PI * 2); ctx.arc(mx + 8, my + 8, 4, 0, Math.PI * 2); ctx.fill();
    }

    // الغيوم الزخرفية
    for (const c of ambientClouds) {
      c.x += c.v * dt; if (c.x > WD.width + 300) c.x = -300;
      ctx.globalAlpha = 0.75 - dk * 0.5;
      drawCloud(ctx, c.x, c.y, c.s, false);
    }
    ctx.globalAlpha = 1;

    // كمية الحياة (تلوّن الأرض والتلال)
    const cnt = E.counts(s);
    const life = clamp((cnt.grassAll + cnt.flowerAll * 1.2 + cnt.treeAll * 4) / 45, 0, 1);
    const moist = E.avgMoisture(s);

    // الجبال البعيدة
    ctx.fillStyle = mix('#7c8fbf', '#5a7fa8', life * 0.6);
    ctx.beginPath(); ctx.moveTo(Lx, GY);
    for (const [x, y] of mountains) if (x >= Lx - 40 && x <= Rx + 40) ctx.lineTo(x, y);
    ctx.lineTo(Rx, GY); ctx.fill();
    // التلال
    ctx.fillStyle = mix('#c2a666', '#5aa64e', life);
    ctx.beginPath(); ctx.moveTo(Lx, GY);
    for (const [x, y] of hills) if (x >= Lx - 30 && x <= Rx + 30) ctx.lineTo(x, y);
    ctx.lineTo(Rx, GY); ctx.fill();
    ctx.fillStyle = mix('#ad9258', '#3f8f45', life);
    ctx.beginPath(); ctx.moveTo(Lx, GY);
    for (const [x, y] of hills) if (x >= Lx - 30 && x <= Rx + 30) ctx.lineTo(x, y + 40 + Math.sin(x * 0.02) * 10);
    ctx.lineTo(Rx, GY); ctx.fill();

    // غيوم المطر
    for (const cl of s.clouds) {
      const k = clamp(Math.min(cl.t / 0.8, (cl.dur - cl.t) / 0.8), 0, 1);
      ctx.globalAlpha = k;
      drawCloud(ctx, cl.x - 50, 150, 1.25, true);
      ctx.globalAlpha = 1;
    }

    // التربة
    const soil = ctx.createLinearGradient(0, GY, 0, WD.height + 200);
    soil.addColorStop(0, mix('#a9824e', '#6b4a2b', clamp(moist * 1.6, 0, 1))); soil.addColorStop(1, '#3b2614');
    ctx.fillStyle = soil; ctx.fillRect(Lx, GY, Rx - Lx, WD.height + 400 - GY);
    // حجارة صغيرة
    ctx.fillStyle = 'rgba(0,0,0,.12)';
    for (let i = 0; i < 40; i++) { const x = (i * 173) % (WD.width + 400) - 200; const y = GY + 30 + ((i * 61) % 150); ctx.beginPath(); ctx.ellipse(x, y, 6 + (i % 4) * 2, 3 + (i % 3), 0, 0, Math.PI * 2); ctx.fill(); }

    // سطح الأرض لكل خلية: أصفر جاف ← أخضر رطب
    const plantsPerCell = new Array(E.CELLS).fill(0);
    for (const p of s.plants) plantsPerCell[p.cell] += p.type === 'tree' ? 2 : 1;
    for (let c = -2; c < E.CELLS + 2; c++) {
      const cc = clamp(c, 0, E.CELLS - 1);
      const m = s.cells[cc].moisture;
      const k = clamp(m * 1.4 + plantsPerCell[cc] * 0.12, 0, 1);
      const x0 = c * WD.cellW; const w = WD.cellW + 1;
      ctx.fillStyle = mix('#d8b874', '#4fb24c', k);
      ctx.fillRect(c < 0 ? Lx : x0, GY - 2, c < 0 || c >= E.CELLS ? (c < 0 ? -Lx + 0 : Rx - x0) : w, 16);
      if (m < 0.06 && c >= 0 && c < E.CELLS) {
        ctx.strokeStyle = 'rgba(90,60,30,.5)'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(x0 + 10, GY + 3); ctx.lineTo(x0 + 18, GY + 10); ctx.lineTo(x0 + 26, GY + 6); ctx.lineTo(x0 + 34, GY + 13); ctx.stroke();
      }
    }

    // مؤشر الرطوبة عند اختيار المطر أو نبات
    if (tool && ['rain', 'grass', 'flower', 'tree'].includes(tool)) {
      for (let c = 0; c < E.CELLS; c++) {
        const m = s.cells[c].moisture;
        ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(c * WD.cellW + 14, GY + 22, 22, 60);
        ctx.fillStyle = m < 0.1 ? '#ff8a4c' : '#4fb6ff';
        ctx.fillRect(c * WD.cellW + 14, GY + 82 - 60 * clamp(m, 0, 1), 22, 60 * clamp(m, 0, 1));
      }
      ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.font = "700 18px 'Jannat LT', sans-serif"; ctx.textAlign = 'center';
      ctx.fillText('💧 رطوبة التربة', WD.width / 2, GY + 108);
    }

    // النباتات (الأشجار في الخلف)
    const sorted = s.plants.slice().sort((a, b) => (a.type === 'tree' ? 0 : a.type === 'flower' ? 1 : 2) - (b.type === 'tree' ? 0 : b.type === 'flower' ? 1 : 2));
    for (const p of sorted) {
      if (p.type === 'tree') drawTree(ctx, p, t);
      else if (p.type === 'flower') drawFlower(ctx, p, t);
      else drawGrass(ctx, p, t);
    }
    for (const m of s.mushrooms) drawMushroom(ctx, m, t);

    // الحيوانات
    for (const a of s.animals) {
      const lp = lastPos.get(a.id);
      const moving = lp ? Math.hypot(a.x - lp[0], a.y - lp[1]) > 0.05 : false;
      a.vxSeen = lp ? a.x - lp[0] : 0;
      lastPos.set(a.id, [a.x, a.y]);
      ctx.save();
      if (a.flyAway) ctx.globalAlpha = 0.7;
      switch (a.type) {
        case 'rabbit': drawRabbit(ctx, a, t, moving); break;
        case 'fox': drawFox(ctx, a, t, moving); break;
        case 'caterpillar': drawCaterpillar(ctx, a, t); break;
        case 'butterfly': drawButterfly(ctx, a, t); break;
        case 'bee': drawBee(ctx, a, t); break;
        case 'bird': drawBird(ctx, a, t); break;
        default:
      }
      ctx.restore();
      if (a.energy < 0.25 && !a.cocoon) {
        ctx.font = '18px sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('😟', a.x, (a.type === 'bee' || a.type === 'butterfly' || a.type === 'bird' ? a.y : GY) - 46);
      }
    }
    if (lastPos.size > 400) lastPos.clear();

    // المطر
    for (const cl of s.clouds) {
      if (cl.t < 0.8 || cl.t > cl.dur - 0.8) continue;
      ctx.strokeStyle = 'rgba(170,210,255,.75)'; ctx.lineWidth = 2;
      ctx.beginPath();
      for (let i = 0; i < 46; i++) {
        const rx = cl.x - cl.w / 2 + ((i * 53.7) % cl.w);
        const ry = 180 + ((t * 620 + i * 97) % (GY - 180));
        ctx.moveTo(rx, ry); ctx.lineTo(rx - 4, ry + 16);
      }
      ctx.stroke();
      if (Math.random() < 0.5) fx.push({ kind: 'drop', x: cl.x + (Math.random() - 0.5) * cl.w, y: GY, vx: 0, vy: -40, life: 0.4, color: 'rgba(190,225,255,.9)', r: 2 });
    }

    // الليل
    if (dk > 0) {
      ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
      ctx.fillStyle = `rgba(8,12,48,${dk * 0.75})`;
      ctx.fillRect(0, 0, view.w, view.h);
      ctx.setTransform(view.dpr * view.s, 0, 0, view.dpr * view.s, view.dpr * view.ox, view.dpr * view.oy);
      // اليراعات
      const n = Math.min(fireflies.length, 6 + Math.floor(life * 20));
      for (let i = 0; i < n; i++) {
        const f = fireflies[i];
        f.x += Math.sin(t * f.v + f.p) * 0.6; f.y += Math.cos(t * f.v * 0.8 + f.p) * 0.4;
        const a = dk * (0.4 + 0.6 * Math.max(0, Math.sin(t * 2.4 + f.p * 3)));
        const fg = ctx.createRadialGradient(f.x, f.y, 0, f.x, f.y, 12);
        fg.addColorStop(0, `rgba(230,255,140,${a})`); fg.addColorStop(1, 'rgba(230,255,140,0)');
        ctx.fillStyle = fg; ctx.beginPath(); ctx.arc(f.x, f.y, 12, 0, Math.PI * 2); ctx.fill();
      }
    }

    // الثمار المضيئة فوق كل شيء
    for (const o of s.orbs) drawOrb(ctx, o, t);

    drawFx(dt);
    drawGhost(t);
  }

  function drawGhost(t) {
    if (!tool || !pointer || current !== null) return;
    const chk = E.canPlace(world, tool, pointer.x);
    const flyer = tool === 'bee' || tool === 'butterfly' || tool === 'bird';
    const x = pointer.x;
    const y = tool === 'rain' ? 170 : flyer ? clamp(pointer.y, WD.skyMin, WD.skyMax) : GY - 20;
    ctx.strokeStyle = chk.ok ? 'rgba(181,239,106,.9)' : 'rgba(255,90,79,.9)';
    ctx.lineWidth = 3; ctx.setLineDash([8, 6]); ctx.lineDashOffset = -t * 30;
    ctx.beginPath();
    if (tool === 'rain') ctx.ellipse(x, y, 120, 46, 0, 0, Math.PI * 2);
    else ctx.arc(x, y, 30, 0, Math.PI * 2);
    ctx.stroke(); ctx.setLineDash([]);
    ctx.globalAlpha = 0.85;
    ctx.font = `${tool === 'rain' ? 56 : 38}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(E.TOOLS[tool].icon, x, y);
    ctx.globalAlpha = 1; ctx.textBaseline = 'alphabetic';
    if (!flyer && tool !== 'rain') { ctx.fillStyle = chk.ok ? 'rgba(181,239,106,.5)' : 'rgba(255,90,79,.5)'; ctx.fillRect(x - 25, GY - 2, 50, 6); }
  }

  // ------------------------------------------------------------------
  // المؤثرات
  // ------------------------------------------------------------------
  function burst(x, y, colors, n = 24, kind = 'dot', spd = 140) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2; const v = spd * (0.3 + Math.random());
      fx.push({ kind, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, life: 1, color: colors[i % colors.length], r: 2 + Math.random() * 3.5, rot: Math.random() * 6 });
    }
  }
  function floatText(x, y, text, color) { fx.push({ kind: 'text', x, y, vx: 0, vy: -38, life: 1.4, color, text }); }
  function hearts(x, y) { for (let i = 0; i < 4; i++) fx.push({ kind: 'heart', x: x + (Math.random() - 0.5) * 30, y: y - 20, vx: (Math.random() - 0.5) * 20, vy: -50 - Math.random() * 30, life: 1.3, color: '#ff6fa8', r: 7 }); }

  function drawFx(dt) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.life -= dt;
      if (f.life <= 0) { fx.splice(i, 1); continue; }
      f.x += f.vx * dt; f.y += f.vy * dt;
      if (f.kind === 'dot' || f.kind === 'leaf' || f.kind === 'petal') { f.vy += 160 * dt; f.vx *= 0.98; }
      ctx.globalAlpha = clamp(f.life, 0, 1);
      ctx.fillStyle = f.color;
      if (f.kind === 'text') {
        ctx.font = "900 26px 'Jannat LT', sans-serif"; ctx.textAlign = 'center';
        ctx.lineWidth = 5; ctx.strokeStyle = 'rgba(0,0,0,.5)'; ctx.strokeText(f.text, f.x, f.y); ctx.fillText(f.text, f.x, f.y);
      } else if (f.kind === 'heart') {
        const r = f.r; ctx.beginPath();
        ctx.moveTo(f.x, f.y + r * 0.9); ctx.bezierCurveTo(f.x - r * 1.6, f.y - r * 0.4, f.x - r * 0.6, f.y - r * 1.5, f.x, f.y - r * 0.5);
        ctx.bezierCurveTo(f.x + r * 0.6, f.y - r * 1.5, f.x + r * 1.6, f.y - r * 0.4, f.x, f.y + r * 0.9); ctx.fill();
      } else if (f.kind === 'leaf' || f.kind === 'petal') {
        f.rot += dt * 5;
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
        ctx.beginPath(); ctx.ellipse(0, 0, f.r * 1.8, f.r * 0.8, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
      } else if (f.kind === 'sparkle') {
        star(ctx, f.x, f.y, f.r * 2, f.r * 0.8, f.life * 4);
      } else if (f.kind === 'drop') {
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------
  // الأحداث العلمية: أصوات ومؤثرات ونصائح
  // ------------------------------------------------------------------
  const TIPS = {
    sprout: 'نبتت أول نبتة! النبات يصنع غذاءه من الماء وضوء الشمس — هذا «البناء الضوئي» 🌱',
    night: 'جاء الليل 🌙 النباتات تنمو ببطء شديد في الظلام لأنها تحتاج ضوء الشمس.',
    wilt: 'بعض النباتات تذبل! التربة جافة — أنزل المطر فوقها 🌧️',
    ate_rabbit: 'الأرنب «عاشب»: يحصل على طاقته من أكل النباتات 🐇🌿',
    ate_fox: 'الثعلب «مفترس» اصطاد أرنباً. هكذا تعمل السلسلة الغذائية: عشب ← أرنب ← ثعلب 🦊',
    ate_bird: 'الطائر أكل يرقة! الطيور تحمي أوراق النباتات من اليرقات 🐦',
    starved: 'كائن مات من الجوع 😢 كل حيوان يحتاج طعاماً كافياً حوله.',
    decompose: 'ظهر فطر! 🍄 الفطر «محلِّل» يعيد بقايا الكائنات غذاءً للتربة.',
    pollinate: 'النحلة نقلت حبوب اللقاح! الزهرة الملقَّحة ستنثر بذوراً جديدة 🌸',
    cocoon: 'اليرقة صنعت شرنقة… انتظر قليلاً لترى ماذا سيحدث! 🐛',
    metamorph: 'تحوّلت اليرقة إلى فراشة! هذا اسمه «التحوّل الكامل» 🦋',
    homeless: 'الطائر طار بعيداً لأنه لم يجد شجرة كبيرة يعيش فيها. ازرع شجرة أولاً 🌳',
    tree: 'كبرت الشجرة! أصبحت بيتاً للطيور، وستعطي ثماراً مضيئة 🍎',
    born: 'وُلد صغير جديد! الكائنات تتكاثر عندما تجد طعاماً كافياً 💕',
    orb: 'اجمع الثمار المضيئة بالنقر عليها لتحصل على طاقة حياة إضافية ✨',
  };
  let tipTimer = null;
  function tip(key) {
    if (sessionTips.has(key) || !TIPS[key] || level === null) return;
    sessionTips.add(key);
    $('tipText').textContent = TIPS[key];
    const box = $('tip');
    box.classList.remove('hidden'); void box.offsetWidth;
    A.play('tip');
    clearTimeout(tipTimer);
    tipTimer = setTimeout(() => box.classList.add('hidden'), 7000);
  }
  $('tip').addEventListener('click', () => $('tip').classList.add('hidden'));

  const throttle = {};
  function once(key, ms) {
    const now = performance.now();
    if (throttle[key] && now - throttle[key] < ms) return false;
    throttle[key] = now;
    return true;
  }

  function handleEvents() {
    const evs = world.events.splice(0);
    const showcase = level === null;
    for (const e of evs) {
      const y = e.y != null ? e.y : GY - 20;
      switch (e.type) {
        case 'planted': burst(e.x, GY - 5, ['#7fe06a', '#b5ef6a', '#8a5a2b'], 18, 'leaf', 110); A.play('plant'); break;
        case 'released': burst(e.x, y - 20, ['#ffffff', '#ffe14a', '#b5ef6a'], 22, 'sparkle', 120); A.play('animal'); break;
        case 'rain': A.play('rain'); break;
        case 'sprout': if (!showcase && once('sprout', 900)) { A.play('sprout'); burst(e.x, GY - 10, ['#b5ef6a'], 5, 'sparkle', 50); } tip('sprout'); break;
        case 'wilt': if (once('wilt', 3000)) A.play('wilt'); tip('wilt'); break;
        case 'born': hearts(e.x, y - 30); if (!showcase && once('born', 600)) A.play('born'); tip('born'); break;
        case 'ate':
          if (e.food === 'rabbit') { burst(e.x, GY - 20, ['#d9c7b0', '#ffffff'], 14, 'dot', 90); if (!showcase) A.play('eaten'); tip('ate_fox'); }
          else if (e.food === 'caterpillar') tip('ate_bird');
          else tip('ate_rabbit');
          break;
        case 'died': if (e.why === 'starved') { burst(e.x, y - 20, ['#999', '#bbb'], 10, 'dot', 60); tip('starved'); } break;
        case 'decompose': burst(e.x, GY - 6, ['#e8453c', '#f5ead6'], 8, 'sparkle', 50); if (!showcase && once('dec', 2000)) A.play('decompose'); tip('decompose'); break;
        case 'pollinate': burst(e.x, e.y, ['#ffe14a'], 6, 'sparkle', 40); if (!showcase && once('pol', 700)) A.play('pollinate'); tip('pollinate'); break;
        case 'cocoon': tip('cocoon'); break;
        case 'metamorph': burst(e.x, e.y, ['#ff6fb5', '#5fd3ff', '#ffe14a', '#b07cff'], 40, 'sparkle', 160); A.play('metamorph'); tip('metamorph'); break;
        case 'homeless': A.play('left'); tip('homeless'); break;
        case 'tree-grown': burst(e.x, GY - 180, ['#5fd16a', '#b5ef6a'], 26, 'leaf', 120); tip('tree'); break;
        case 'orb': floatText(e.x, e.y - 20, `+${e.value} ✨`, '#ffe14a'); burst(e.x, e.y, ['#ffe14a', '#fff'], 16, 'sparkle', 120); A.play('orb'); bumpEnergy(); break;
        case 'orb-auto': floatText(e.x, e.y - 20, `+${e.value}`, '#ffe9a0'); break;
        default:
      }
    }
  }

  // ------------------------------------------------------------------
  // الحلقة
  // ------------------------------------------------------------------
  let last = performance.now();
  let hudT = 0;
  let wasNight = false;
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const t = now / 1000;
    if (running) E.step(world, dt * speed);
    handleEvents();
    drawScene(t, dt);
    hudT -= dt;
    if (hudT <= 0) { hudT = 0.25; updateHud(); }
    requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------------
  // الواجهة: الشريط العلوي
  // ------------------------------------------------------------------
  let lastEnergy = 0;
  function bumpEnergy() {
    const e = $('energy');
    e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump');
  }

  function updateHud() {
    const s = world;
    const cnt = E.counts(s);
    const night = E.isNight(s);
    A.update({ night, raining: s.clouds.filter((c) => c.t > 0.8 && c.t < c.dur - 0.8).length, birds: cnt.bird, life: cnt.grassAll + cnt.flowerAll });
    if (level === null) return;
    if (night && !wasNight) tip('night');
    wasNight = night;

    const en = Math.floor(s.energy);
    $('energyVal').textContent = String(en);
    lastEnergy = en;
    for (const b of document.querySelectorAll('.tool')) {
      const tl = E.TOOLS[b.dataset.tool];
      b.classList.toggle('poor', s.energy < tl.cost);
    }

    const bal = s.lastBalance || E.balance(s);
    const fill = $('balanceFill');
    fill.style.width = `${Math.round(bal.score * 100)}%`;
    fill.style.background = bal.status === 'danger' ? '#ff5a4f' : bal.status === 'balanced' ? 'linear-gradient(90deg,#3fcf6e,#b5ef6a)' : '#ffd23f';
    $('balanceTxt').textContent = bal.status === 'balanced' ? 'متوازنة 🌍' : bal.status === 'danger' ? 'في خطر ⚠️' : bal.status === 'empty' ? 'فارغة' : 'تنمو 🌱';
    $('balance').title = bal.reason;
    if (bal.status === 'danger' && once('danger-' + bal.reason, 12000)) toast(bal.reason, 'bad', 3800);

    // الاكتشافات
    for (const sp of E.speciesPresent(s)) {
      if (!store.discovered.includes(sp)) {
        store.discovered.push(sp); save();
        $('bookDot').classList.remove('hidden');
        toast(`📖 اكتشاف جديد: ${E.SPECIES[sp].name} أُضيف إلى الموسوعة!`, 'good', 3200);
        A.play('goal');
        notify('discovered', { species: sp, total: store.discovered.length });
      }
    }

    // الأهداف
    const box = $('goals');
    box.textContent = '';
    if (level.free) {
      const kinds = E.speciesPresent(s).length;
      box.append(el('div', 'goal', `🏞️ ${level.title} • 🌍 ${kinds}/10 أنواع • ${night ? '🌙 ليل' : '☀️ نهار'}`));
      return;
    }
    const pr = E.goalProgress(s, level);
    for (const g of pr.goals) {
      const d = el('div', `goal ${g.done ? 'done' : ''}`);
      const ic = g.balanced ? '⚖️' : (E.TOOLS[g.species] || {}).icon || '🦋';
      d.append(el('span', '', `${ic} ${g.label}`));
      const bar = el('span', 'bar'); const i = el('i'); i.style.width = `${(g.have / g.need) * 100}%`; bar.append(i);
      d.append(bar, el('span', '', `${g.have}/${g.need}`));
      box.append(d);
    }
    if (pr.done && !finished) {
      finished = true;
      setTimeout(completeLevel, 1200);
      celebrate();
    }
  }

  function celebrate() {
    A.play('goal');
    for (let i = 0; i < 6; i++) {
      setTimeout(() => burst(150 + Math.random() * (WD.width - 300), 200 + Math.random() * 250, ['#ff6fb5', '#ffe14a', '#b5ef6a', '#5fd3ff', '#ffffff'], 40, i % 2 ? 'petal' : 'sparkle', 220), i * 180);
    }
  }

  // ------------------------------------------------------------------
  // الأدوات
  // ------------------------------------------------------------------
  function buildToolbar(tools, fresh) {
    const bar = $('toolbar');
    bar.textContent = '';
    for (const k of Object.keys(E.TOOLS)) {
      const d = E.TOOLS[k];
      const b = el('button', 'tool');
      b.dataset.tool = k;
      b.title = `${d.name} — ${d.cost} طاقة`;
      b.append(el('span', 'cost', `✨${d.cost}`), el('span', 'ic', d.icon), el('span', 'nm', d.name));
      if (!tools.includes(k)) b.classList.add('locked');
      if (fresh.includes(k)) b.classList.add('new');
      b.onclick = () => selectTool(tool === k ? null : k);
      bar.append(b);
    }
    selectTool(null);
  }
  function selectTool(k) {
    tool = k;
    A.play('select');
    for (const b of document.querySelectorAll('.tool')) {
      b.classList.toggle('on', b.dataset.tool === k);
      if (b.dataset.tool === k) b.classList.remove('new');
    }
    cv.classList.toggle('placing', !!k);
  }

  // ------------------------------------------------------------------
  // اللمس والنقر على المشهد
  // ------------------------------------------------------------------
  function pointerWorld(e) {
    const r = cv.getBoundingClientRect();
    return toWorld(e.clientX - r.left, e.clientY - r.top);
  }
  cv.addEventListener('pointermove', (e) => { pointer = pointerWorld(e); });
  cv.addEventListener('pointerleave', () => { pointer = null; });
  cv.addEventListener('pointerdown', (e) => {
    A.init();
    if (current !== null || level === null) return;
    const p = pointerWorld(e);
    pointer = p;
    // جمع الثمار المضيئة أولاً
    const hitR = Math.max(34, 26 / view.s);
    let best = null; let bd = hitR;
    for (const o of world.orbs) { const d = Math.hypot(o.x - p.x, o.y - p.y); if (d < bd) { bd = d; best = o; } }
    if (best) { E.collectOrb(world, best.id); return; }
    if (world.orbs.length && !sessionTips.has('orb')) tip('orb');

    if (tool) {
      const res = E.place(world, tool, p.x, p.y);
      if (!res.ok) {
        toast(res.reason, 'bad', 2200);
        A.play('error');
        if (/طاقة/.test(res.reason)) { const en = $('energy'); en.classList.remove('low'); void en.offsetWidth; en.classList.add('low'); }
      }
      return;
    }
    // بدون أداة: عرض معلومات الكائن المنقور
    const info = inspect(p);
    if (info) { toast(info, '', 3600); A.play('select'); }
    else toast('اختر أداة من الشريط السفلي ثم انقر على الأرض 👇', '', 2400);
  });

  function inspect(p) {
    let best = null; let bd = 60;
    for (const a of world.animals) { const d = Math.hypot(a.x - p.x, a.y - 15 - p.y); if (d < bd) { bd = d; best = a; } }
    if (!best) for (const pl of world.plants) { const top = GY - (pl.type === 'tree' ? 150 * pl.growth : 30); const d = Math.hypot(pl.x - p.x, (p.y < GY && p.y > top - 40) ? 0 : 999); if (d < bd) { bd = d; best = pl; } }
    if (!best) return null;
    const type = best.type === 'caterpillar' && best.cocoon ? 'caterpillar' : best.type;
    const sp = E.SPECIES[type];
    const icon = (E.TOOLS[type] || {}).icon || '🦋';
    if (best.energy != null) {
      const mood = best.cocoon ? 'داخل الشرنقة… يتحوّل!' : best.energy > 0.6 ? 'شبعان وسعيد 😊' : best.energy > 0.3 ? 'جائع قليلاً' : 'جائع جداً 😟';
      return `${icon} ${sp.name}${best.baby ? ' (صغير)' : ''} — يأكل: ${sp.eats} • ${mood}`;
    }
    const st = best.health < 0.5 ? 'عطشان يذبل 🥀' : best.growth < 0.6 ? 'ينمو…' : 'نامٍ وبصحة جيدة';
    return `${icon} ${sp.name} — يحتاج: ${sp.needs} • ${st}`;
  }

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { if (current === null && level) showScreen('pause'); else if (current === 'pause') resume(); return; }
    if (current !== null || !level) return;
    const keys = Object.keys(E.TOOLS).filter((k) => level.tools.includes(k));
    const n = Number(e.key);
    if (n >= 1 && n <= keys.length) selectTool(keys[n - 1] === tool ? null : keys[n - 1]);
  });

  // ------------------------------------------------------------------
  // الرسائل
  // ------------------------------------------------------------------
  let toastTimer = null;
  function toast(text, kind = '', ms = 2600) {
    const t = $('toast');
    t.textContent = text;
    t.className = `toast show ${kind}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = `toast ${kind}`; }, ms);
  }

  // ------------------------------------------------------------------
  // الشاشات والمهمات
  // ------------------------------------------------------------------
  const SCREENS = { menu: 'scrMenu', levels: 'scrLevels', intro: 'scrIntro', result: 'scrResult', book: 'scrBook', help: 'scrHelp', pause: 'scrPause' };
  let returnTo = 'menu'; // إلى أين نعود من الموسوعة أو الشرح (null = اللعب)

  function showScreen(name) {
    for (const [k, id] of Object.entries(SCREENS)) $(id).classList.toggle('hidden', k !== name);
    current = name;
    if (name === 'menu') toMenuWorld();
    running = name === 'menu' || name === 'levels' || name === 'book' && level === null || name === 'help' && level === null;
    const playing = level !== null;
    $('toolbar').classList.toggle('hidden', !playing);
    document.querySelector('.hud-top .goals').classList.toggle('hidden', !playing);
    $('energy').classList.toggle('hidden', !playing);
    $('balance').classList.toggle('hidden', !playing);
    $('tip').classList.add('hidden');
    resize();
  }
  function hideScreens() {
    for (const id of Object.values(SCREENS)) $(id).classList.add('hidden');
    current = null;
    running = true;
    resize();
  }
  function resume() { hideScreens(); }

  function toMenuWorld() {
    if (level !== null) {
      level = null; levelIdx = -1;
      world = E.showcase(E.seeded(Date.now() % 100000));
      selectTool(null);
      $('goals').textContent = '';
    }
  }

  /** صورة مصغّرة لمشهد (للمهمات والموسوعة) */
  function thumb(draw, w = 220, h = 130, sky = ['#8fd3ff', '#e6f7ff']) {
    const c = document.createElement('canvas');
    const d = Math.min(window.devicePixelRatio || 1, 2);
    c.width = w * d; c.height = h * d;
    const g = c.getContext('2d');
    g.scale(d, d);
    const sg = g.createLinearGradient(0, 0, 0, h); sg.addColorStop(0, sky[0]); sg.addColorStop(1, sky[1]);
    g.fillStyle = sg; g.fillRect(0, 0, w, h);
    g.fillStyle = '#5aa64e'; g.beginPath(); g.ellipse(w / 2, h + 30, w * 0.8, 70, 0, 0, Math.PI * 2); g.fill();
    draw(g, w, h);
    return c;
  }
  /** يرسم كائناً واحداً في صورة مصغّرة */
  function drawSpecimen(g, type, x, groundY, scale) {
    g.save();
    g.translate(x, groundY); g.scale(scale, scale); g.translate(0, -GY);
    const t = 1.3;
    const fake = { id: 3, x: 0, y: GY, dir: 1, seed: 0.5, growth: 1, health: 1, energy: 0.8, state: 'wander', baby: false, color: '#ff6fb5', cell: 0 };
    switch (type) {
      case 'grass': drawGrass(g, { ...fake, seed: 0.9 }, t); break;
      case 'flower': drawFlower(g, fake, t); break;
      case 'tree': drawTree(g, { ...fake, growth: 0.9 }, t); break;
      case 'mushroom': drawMushroom(g, { x: 0, t: 5, life: 14 }, t); break;
      case 'caterpillar': drawCaterpillar(g, fake, t); break;
      case 'butterfly': drawButterfly(g, { ...fake, y: GY - 30 }, t); break;
      case 'bee': drawBee(g, { ...fake, y: GY - 30 }, t); break;
      case 'rabbit': drawRabbit(g, fake, t, false); break;
      case 'bird': drawBird(g, { ...fake, y: GY - 30, seed: 0.1 }, t); break;
      case 'fox': drawFox(g, fake, t, false); break;
      default:
    }
    g.restore();
  }

  const LEVEL_ART = [['grass', 'grass', 'grass'], ['grass', 'rabbit', 'flower'], ['flower', 'bee', 'butterfly'], ['tree', 'bird', 'grass'], ['grass', 'rabbit', 'fox']];

  function showLevels() {
    const box = $('levels');
    box.textContent = '';
    E.LEVELS.forEach((lv, i) => {
      const unlocked = i === 0 || (store.stars[i - 1] || 0) > 0;
      const b = el('button', 'level');
      b.disabled = !unlocked;
      const art = LEVEL_ART[i];
      b.append(thumb((g, w, h) => {
        drawSpecimen(g, art[0], w * 0.25, h - 18, art[0] === 'tree' ? 0.42 : 1.1);
        drawSpecimen(g, art[1], w * 0.55, art[1] === 'bee' || art[1] === 'bird' || art[1] === 'butterfly' ? h - 55 : h - 16, art[1] === 'fox' ? 1 : 1.2);
        drawSpecimen(g, art[2], w * 0.8, art[2] === 'butterfly' ? h - 60 : h - 16, art[2] === 'fox' ? 1 : 1.2);
      }));
      const got = store.stars[i] || 0;
      b.append(el('span', 'num', String(i + 1)), el('b', '', lv.title), el('small', '', lv.goals.map((g) => `${g.balanced ? '⚖️' : (E.TOOLS[g.species] || {}).icon || '🦋'} ${g.balanced || g.n}`).join('  ')), el('span', 'st', '⭐'.repeat(got) + '☆'.repeat(3 - got)));
      if (!unlocked) b.append(el('span', 'lock', '🔒'));
      b.onclick = () => { A.play('select'); startLevel(i); };
      box.append(b);
    });
    const fb = el('button', 'level free');
    fb.append(thumb((g, w, h) => {
      drawSpecimen(g, 'tree', w * 0.2, h - 16, 0.42);
      drawSpecimen(g, 'fox', w * 0.5, h - 14, 0.9);
      drawSpecimen(g, 'butterfly', w * 0.72, h - 70, 1.2);
      drawSpecimen(g, 'rabbit', w * 0.82, h - 14, 1);
    }, 220, 130, ['#ffb38a', '#ffe7c4']), el('span', 'num', '∞'), el('b', '', E.FREE_PLAY.title), el('small', '', 'كل الأدوات • بلا أهداف'), el('span', 'st', '🏞️'));
    fb.onclick = () => { A.play('select'); startLevel(-1); };
    box.append(fb);
    showScreen('levels');
  }

  function startLevel(i) {
    levelIdx = i;
    level = i < 0 ? E.FREE_PLAY : E.LEVELS[i];
    world = E.createWorld({ energy: level.energy, moisture: level.free ? 0.25 : undefined });
    finished = false;
    fx.length = 0;
    sessionTips.clear();
    wasNight = false;
    const prevTools = i > 0 ? E.LEVELS[i - 1].tools : [];
    buildToolbar(level.tools, i > 0 ? level.tools.filter((k) => !prevTools.includes(k)) : []);
    // بطاقة المهمة
    $('introArt').replaceChildren(thumb((g, w, h) => {
      const art = i < 0 ? ['tree', 'fox', 'rabbit'] : LEVEL_ART[i];
      art.forEach((k, j) => drawSpecimen(g, k, w * (0.22 + j * 0.28), k === 'bee' || k === 'butterfly' || k === 'bird' ? h - 70 : h - 22, k === 'tree' ? 0.75 : 1.7));
    }, 480, 190));
    $('introSub').textContent = i < 0 ? 'اللعب الحر' : `المهمة ${i + 1} من ${E.LEVELS.length}`;
    $('introTitle').textContent = level.title;
    $('introText').textContent = level.intro;
    const gl = $('introGoals');
    gl.textContent = '';
    for (const g of level.goals) {
      const ic = g.balanced ? '⚖️' : (E.TOOLS[g.species] || {}).icon || '🦋';
      gl.append(el('li', '', g.balanced ? `${ic} حافظ على توازن الغابة ${g.balanced} ثانية` : `${ic} ${g.label}: ${g.n}`));
    }
    if (!level.goals.length) gl.append(el('li', '', '🌍 اكتشف كل الكائنات العشرة وأكمل الموسوعة!'));
    showScreen('intro');
    running = false;
  }

  $('btnIntroGo').onclick = () => {
    A.init(); A.play('plant');
    hideScreens();
    // أول أداة مقترحة: المطر
    setTimeout(() => toast('ابدأ بـ 🌧️ المطر: اختره من الأسفل ثم انقر فوق الأرض الجافة', '', 4200), 400);
  };

  function completeLevel() {
    const stars = E.starsFor(level, world.time);
    store.stars[levelIdx] = Math.max(store.stars[levelIdx] || 0, stars);
    save();
    notify('level-complete', { level: levelIdx + 1, stars, totalStars: store.stars.reduce((a, b) => a + (b || 0), 0) });
    A.play('win');
    const st = $('resStars');
    st.textContent = '';
    for (let k = 0; k < 3; k++) st.append(el('span', k < stars ? '' : 'off', '⭐'));
    $('resTitle').textContent = `أحسنت! أكملت «${level.title}» 🎉`;
    $('resLesson').textContent = level.lesson;
    const acts = $('resActions');
    acts.textContent = '';
    const add = (txt, cls, fn) => { const b = el('button', `btn ${cls}`, txt); b.onclick = () => { A.play('select'); fn(); }; acts.append(b); };
    if (levelIdx + 1 < E.LEVELS.length) add('▶ المهمة التالية', 'primary', () => startLevel(levelIdx + 1));
    else { add('🏞️ غابتي الحرّة', 'primary', () => startLevel(-1)); notify('all-levels-complete', {}); }
    add('🌳 تابع اللعب هنا', 'ghost', () => { level = { ...level, goals: [], free: true, title: level.title }; hideScreens(); });
    add('المهمات', 'ghost', showLevels);
    showScreen('result');
  }

  function showBook() {
    $('bookDot').classList.add('hidden');
    const box = $('book');
    box.textContent = '';
    const keys = Object.keys(E.SPECIES);
    $('bookCount').textContent = `اكتشفت ${store.discovered.length} من ${keys.length} كائنات`;
    for (const k of keys) {
      const sp = E.SPECIES[k];
      const found = store.discovered.includes(k);
      const c = el('div', `card ${found ? '' : 'locked'}`);
      const fly = k === 'bee' || k === 'butterfly' || k === 'bird';
      const sc = k === 'tree' ? 0.42 : k === 'flower' ? 1.15 : k === 'grass' ? 1.4 : 1.6;
      c.append(thumb((g, w, h) => drawSpecimen(g, k, w / 2, fly ? h - 12 : h - 14, sc), 150, 110, ['#bfe9ff', '#eafaff']));
      c.append(el('b', '', found ? sp.name : '؟؟؟'), el('span', 'kind', found ? sp.kind : 'لم يُكتشف بعد'));
      if (found) c.append(el('p', '', `يحتاج: ${sp.needs}`), el('p', '', sp.fact));
      box.append(c);
    }
    if (current !== 'book') returnTo = current;
    showScreen('book');
    if (level) running = false;
  }

  // ------------------------------------------------------------------
  // الأزرار
  // ------------------------------------------------------------------
  $('btnPlay').onclick = () => { A.init(); A.play('select'); showLevels(); };
  $('btnFree').onclick = () => { A.init(); A.play('select'); startLevel(-1); };
  $('btnMenuBook').onclick = () => { A.init(); showBook(); };
  $('btnBook').onclick = () => { A.play('select'); showBook(); };
  $('btnHelp').onclick = () => { A.init(); A.play('select'); returnTo = current; showScreen('help'); };
  $('btnMenu').onclick = () => { A.init(); A.play('select'); if (current === null && level) showScreen('pause'); else showScreen('menu'); };
  $('btnResume').onclick = () => { A.play('select'); resume(); };
  $('btnRestart').onclick = () => { A.play('select'); startLevel(levelIdx); };
  for (const b of document.querySelectorAll('[data-go]')) {
    b.addEventListener('click', () => {
      A.play('select');
      if (b.dataset.go !== 'back') { showScreen(b.dataset.go); return; }
      if (returnTo === null) hideScreens(); else showScreen(returnTo);
    });
  }
  $('btnSpeed').onclick = () => {
    speed = speed === 1 ? 2 : 1;
    $('btnSpeed').classList.toggle('on', speed === 2);
    $('btnSpeed').textContent = speed === 2 ? '⏩2' : '⏩';
    toast(speed === 2 ? 'الزمن أسرع ×2 ⏩' : 'الزمن بسرعته العادية', '', 1500);
  };
  function renderAudioBtns() {
    $('btnMusic').classList.toggle('off', !store.music);
    $('btnSound').textContent = store.sound ? '🔊' : '🔇';
  }
  $('btnMusic').onclick = () => { A.init(); store.music = !store.music; save(); A.setMusic(store.music); renderAudioBtns(); toast(store.music ? '🎵 الموسيقى تعمل' : 'الموسيقى متوقفة', '', 1400); };
  $('btnSound').onclick = () => { A.init(); store.sound = !store.sound; save(); A.setSfx(store.sound); renderAudioBtns(); };

  // تشغيل الصوت عند أول تفاعل (سياسة المتصفحات)
  const firstGesture = () => { A.init(); A.setMusic(store.music); A.setSfx(store.sound); window.removeEventListener('pointerdown', firstGesture); window.removeEventListener('keydown', firstGesture); };
  window.addEventListener('pointerdown', firstGesture);
  window.addEventListener('keydown', firstGesture);

  // ------------------------------------------------------------------
  // البدء
  // ------------------------------------------------------------------
  A.setMusic(store.music); A.setSfx(store.sound);
  renderAudioBtns();
  if (store.discovered.length === 0) $('bookDot').classList.add('hidden');
  showScreen('menu');
  resize();
  requestAnimationFrame(loop);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);
  notify('ready');

  // للاختبار الآلي فقط
  window.__forest = { get world() { return world; }, startLevel, showLevels, showBook, selectTool, E, hideScreens, get level() { return level; } };
})();
