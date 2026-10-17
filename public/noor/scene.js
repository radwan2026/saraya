// =====================================================================
//  مشهد الواحة الليلية على Canvas بحجم 1080×1920
//  سماء ونجوم وهلال، مسجد يُضاء تدريجياً، بركة تعكس المسجد، حديقة ورود،
//  فوانيس طائرة، حمام، قافلة جمال، نفحات مسك، وموكب نور ذهبي.
// =====================================================================

export const W = 1080;
export const H = 1920;
const CX = 540;
const BASE = 1420;   // خط الأرض في إحداثيات رسم المسجد الداخلية
const GROUND = 1560; // خط الأرض الفعلي على الشاشة
const MS = 0.9;      // حجم المسجد
const toScreenY = (y) => GROUND + (y - BASE) * MS;

export const THEMES = [
  { name: 'ليلة زرقاء', top: '#040a22', mid: '#0d1d4a', low: '#24407e', glow: '#7fb2ff', sil: '#070d26', dune: '#1a2a55' },
  { name: 'ليلة بنفسجية', top: '#0b0420', mid: '#25104a', low: '#55286f', glow: '#d39bff', sil: '#0d0620', dune: '#2d1748' },
  { name: 'ليلة زمردية', top: '#01120e', mid: '#063026', low: '#0f5a45', glow: '#6ff5c8', sil: '#03130f', dune: '#0c3a2e' },
  { name: 'ليلة ذهبية', top: '#120902', mid: '#3a2108', low: '#7a4a14', glow: '#ffd27a', sil: '#130a03', dune: '#4a2e10' },
];

const GOLD = '#ffd27a';
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const ease = (t) => 1 - (1 - t) ** 3;

function hexToRgb(h) {
  const n = parseInt(h.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function mixHex(a, b, t) {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  const c = A.map((v, i) => Math.round(v + (B[i] - v) * t));
  return `rgb(${c[0]},${c[1]},${c[2]})`;
}
function mixTheme(a, b, t) {
  const out = {};
  for (const k of Object.keys(a)) out[k] = k === 'name' ? b.name : mixHex(a[k], b[k], t);
  return out;
}

/** نقش نجمة ثمانية إسلامية خفيف يغطي السماء */
function makePattern() {
  const s = 120;
  const c = document.createElement('canvas');
  c.width = s; c.height = s;
  const g = c.getContext('2d');
  g.strokeStyle = 'rgba(255,220,150,0.07)';
  g.lineWidth = 1.5;
  const star = (x, y, r) => {
    g.beginPath();
    for (let i = 0; i < 16; i++) {
      const a = (Math.PI / 8) * i;
      const rr = i % 2 ? r * 0.62 : r;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.stroke();
  };
  star(s / 2, s / 2, 34);
  for (const [x, y] of [[0, 0], [s, 0], [0, s], [s, s]]) star(x, y, 34);
  g.beginPath();
  g.moveTo(s / 2, 0); g.lineTo(s / 2, s / 2 - 34);
  g.moveTo(s / 2, s); g.lineTo(s / 2, s / 2 + 34);
  g.moveTo(0, s / 2); g.lineTo(s / 2 - 34, s / 2);
  g.moveTo(s, s / 2); g.lineTo(s / 2 + 34, s / 2);
  g.stroke();
  return c;
}

/** الهلال مرسوم مسبقاً على لوحة منفصلة */
function makeMoon(r) {
  const s = r * 2 + 8;
  const c = document.createElement('canvas');
  c.width = s; c.height = s;
  const g = c.getContext('2d');
  const grd = g.createRadialGradient(s / 2 - r * 0.3, s / 2 - r * 0.3, r * 0.1, s / 2, s / 2, r);
  grd.addColorStop(0, '#fffbe8');
  grd.addColorStop(1, '#f3d58a');
  g.fillStyle = grd;
  g.beginPath(); g.arc(s / 2, s / 2, r, 0, Math.PI * 2); g.fill();
  g.globalCompositeOperation = 'destination-out';
  g.beginPath(); g.arc(s / 2 + r * 0.42, s / 2 - r * 0.18, r * 0.86, 0, Math.PI * 2); g.fill();
  return c;
}

// ---------------------------------------------------------------------
// أجزاء المسجد التي تُضاء بالترتيب (24 جزءاً)
// ---------------------------------------------------------------------
const BODY = { x1: 290, x2: 790, top: 1180 };
const DRUM = { x1: 405, x2: 675, top: 1092 };
const MINARETS = [215, 865];
const SIDE_DOMES = [345, 735];
const BODY_WINDOWS = [330, 400, 680, 750];
const DRUM_WINDOWS = [440, 490, 540, 590, 640];

const LIGHT_ORDER = [
  'door',
  'bw0', 'bw3', 'bw1', 'bw2',
  'dw2', 'dw0', 'dw4', 'dw1', 'dw3',
  'band',
  'm0b0', 'm1b0', 'm0b1', 'm1b1',
  'sd0', 'sd1',
  'm0top', 'm1top',
  'domeLine', 'domeFill',
  'c1', 'c2', 'c0',
];

function archPath(g, x, y, w, h) {
  // نافذة بقوس مدبّب: x مركز، y أسفل
  const r = w / 2;
  g.beginPath();
  g.moveTo(x - r, y);
  g.lineTo(x - r, y - h + r * 1.2);
  g.quadraticCurveTo(x - r, y - h + r * 0.2, x, y - h);
  g.quadraticCurveTo(x + r, y - h + r * 0.2, x + r, y - h + r * 1.2);
  g.lineTo(x + r, y);
  g.closePath();
}

function domePath(g, cx, base, w, h) {
  const r = w / 2;
  g.beginPath();
  g.moveTo(cx - r * 0.82, base);
  g.bezierCurveTo(cx - r * 1.25, base - h * 0.35, cx - r * 1.05, base - h * 0.78, cx - r * 0.42, base - h * 0.88);
  g.bezierCurveTo(cx - r * 0.12, base - h * 0.93, cx - r * 0.03, base - h * 0.97, cx, base - h);
  g.bezierCurveTo(cx + r * 0.03, base - h * 0.97, cx + r * 0.12, base - h * 0.93, cx + r * 0.42, base - h * 0.88);
  g.bezierCurveTo(cx + r * 1.05, base - h * 0.78, cx + r * 1.25, base - h * 0.35, cx + r * 0.82, base);
  g.closePath();
}

function crescent(g, x, y, r, color) {
  g.save();
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, r, Math.PI * 0.15, Math.PI * 1.85, false);
  g.arc(x + r * 0.45, y, r * 0.78, Math.PI * 1.75, Math.PI * 0.25, true);
  g.closePath();
  g.fill();
  g.restore();
}

// ---------------------------------------------------------------------
export class Scene {
  constructor(canvas) {
    this.canvas = canvas;
    this.g = canvas.getContext('2d');
    canvas.width = W;
    canvas.height = H;
    this.t = 0;
    this.last = performance.now();
    this.pattern = this.g.createPattern(makePattern(), 'repeat');
    this.moon = makeMoon(78);
    this.theme = { ...THEMES[0] };
    this.themeFrom = THEMES[0];
    this.themeTo = THEMES[0];
    this.themeT = 1;
    this.lit = 0;           // عدد الأجزاء المضاءة (قيمة متحركة)
    this.litTarget = 0;
    this.litFull = 0;       // وميض الاكتمال
    this.golden = 0;        // شدة موكب النور
    this.musk = 0;          // شدة نفحات المسك
    this.stars = Array.from({ length: 230 }, () => this.makeStar(false));
    this.likeStars = [];
    this.shooting = [];
    this.lanterns = [];
    this.doves = [];
    this.particles = [];
    this.clouds = [];
    this.caravan = null;
    this.flowerSlots = this.makeFlowerSlots();
    this.flowers = [];
    this.flowerCursor = 0;
    this.rays = 0;
    this.nextShooting = 4;
    this.loop = this.loop.bind(this);
    requestAnimationFrame(this.loop);
  }

  makeStar(fromLike) {
    return {
      x: rand(10, W - 10),
      y: fromLike ? rand(120, 1250) : rand(0, 1400) ** 1.05 / 1.4,
      r: fromLike ? rand(1.8, 3.6) : rand(0.6, 2.2),
      p: rand(0, Math.PI * 2),
      s: rand(0.6, 2.2),
      born: this.t || 0,
      like: fromLike,
    };
  }

  makeFlowerSlots() {
    const slots = [];
    // صفوف أمامية حول البركة وأسفل الشاشة
    for (let row = 0; row < 3; row++) {
      const y = 1752 + row * 40;
      for (let i = 0; i < 18; i++) {
        slots.push({ x: 60 + i * 56 + (row % 2) * 28 + rand(-8, 8), y: y + rand(-6, 6) });
      }
    }
    // أطراف البركة
    for (let i = 0; i < 8; i++) {
      slots.push({ x: 110 + rand(-12, 12), y: 1600 + i * 16 });
      slots.push({ x: 970 + rand(-12, 12), y: 1600 + i * 16 });
    }
    return slots.sort(() => Math.random() - 0.5);
  }

  // ------------------------------------------------------------------
  // أوامر من التطبيق
  // ------------------------------------------------------------------
  setTheme(i, instant = false) {
    const next = THEMES[i % THEMES.length];
    if (next === this.themeTo) return;
    this.themeFrom = instant ? next : { ...this.theme };
    this.themeTo = next;
    this.themeT = instant ? 1 : 0;
    if (instant) this.theme = { ...next };
  }

  setProgress(p) {
    this.litTarget = clamp(p, 0, 1) * LIGHT_ORDER.length;
  }

  celebrate() {
    this.litFull = 1;
    this.lit = LIGHT_ORDER.length;
    for (let i = 0; i < 9; i++) {
      setTimeout(() => this.burst(rand(160, 920), rand(380, 1000), i % 2 ? GOLD : '#ffffff', 70), i * 380);
    }
    this.spawnLanterns(26, null);
  }

  addLikeStars(n) {
    for (let i = 0; i < n; i++) {
      const s = this.makeStar(true);
      this.likeStars.push(s);
    }
    if (this.likeStars.length > 260) this.likeStars.splice(0, this.likeStars.length - 260);
  }

  shootingStar() {
    this.shooting.push({ x: rand(300, 1080), y: rand(80, 500), vx: -rand(14, 20), vy: rand(5, 8), life: 1 });
  }

  addFlowers(n, name) {
    const count = Math.min(n, 24);
    for (let i = 0; i < count; i++) {
      const slot = this.flowerSlots[this.flowerCursor % this.flowerSlots.length];
      this.flowerCursor++;
      const existing = this.flowers.findIndex((f) => f.slot === slot);
      if (existing >= 0) this.flowers.splice(existing, 1);
      const hue = [350, 340, 330, 0, 355, 45, 300][Math.floor(Math.random() * 7)];
      this.flowers.push({
        slot, born: this.t + i * 0.12, hue,
        size: rand(14, 22), sway: rand(0, Math.PI * 2),
        name: i === 0 ? name : '',
      });
    }
    const last = this.flowerSlots[(this.flowerCursor - 1) % this.flowerSlots.length];
    this.burst(last.x, last.y - 30, '#ff7aa8', 24);
  }

  spawnLanterns(n, name) {
    const count = Math.min(n, 16);
    for (let i = 0; i < count; i++) {
      this.lanterns.push({
        x: rand(140, 940), y: 1780 + rand(0, 160) + i * 30,
        vy: rand(1.1, 2.0), sway: rand(0, Math.PI * 2), size: rand(0.8, 1.25) * (n > 16 ? 1.2 : 1),
        name: i === 0 ? name : '', hue: rand(25, 45), born: this.t,
      });
    }
    if (this.lanterns.length > 140) this.lanterns.splice(0, this.lanterns.length - 140);
  }

  releaseDoves(users) {
    users.forEach((u, i) => {
      this.doves.push({
        sx: rand(-80, 100), sy: rand(1650, 1900),
        tx: CX + rand(-180, 180), ty: rand(1080, 1200),
        t: -i * 0.25, dur: rand(2.6, 3.6), name: u.nickname, flap: rand(0, 6),
      });
    });
  }

  startCaravan(name, count) {
    if (this.caravan && this.caravan.x > -400) {
      this.caravan.count += count;
      return;
    }
    this.caravan = { x: W + 160, name, count, step: 0 };
  }

  muskWave() {
    this.musk = 1;
    for (let i = 0; i < 14; i++) {
      this.clouds.push({ x: -300 - rand(0, 700), y: rand(300, 1700), r: rand(160, 320), v: rand(4, 8), hue: rand(280, 330), a: rand(0.18, 0.32) });
    }
  }

  procession() {
    this.golden = 1;
    this.rays = 1;
    this.spawnLanterns(16, null);
    setTimeout(() => this.spawnLanterns(16, null), 800);
    for (let i = 0; i < 6; i++) setTimeout(() => this.burst(rand(200, 880), rand(400, 900), GOLD, 80), i * 300);
  }

  burst(x, y, color, n = 30) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2);
      const v = rand(2, 9);
      this.particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, decay: rand(0.012, 0.025), r: rand(1.5, 4), color });
    }
    if (this.particles.length > 1400) this.particles.splice(0, this.particles.length - 1400);
  }

  sparkle(x = CX, y = 1000) {
    this.burst(x, y, '#ffffff', 30);
    this.burst(x, y, GOLD, 30);
  }

  // ------------------------------------------------------------------
  // الحلقة الرئيسية
  // ------------------------------------------------------------------
  loop(now) {
    const dt = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    this.t += dt;
    this.update(dt);
    this.draw();
    requestAnimationFrame(this.loop);
  }

  update(dt) {
    const k = dt * 60;
    if (this.themeT < 1) {
      this.themeT = Math.min(1, this.themeT + dt / 3);
      this.theme = mixTheme(this.themeFrom, this.themeTo, ease(this.themeT));
    }
    this.lit += (this.litTarget - this.lit) * Math.min(1, dt * 2.5);
    if (this.litFull > 0) {
      this.litFull = Math.max(0, this.litFull - dt / 7);
      if (this.litFull === 0) this.lit = this.litTarget;
    }
    this.golden = Math.max(0, this.golden - dt / 8);
    this.rays = Math.max(0, this.rays - dt / 9);
    this.musk = Math.max(0, this.musk - dt / 7);

    this.nextShooting -= dt;
    if (this.nextShooting <= 0) { this.shootingStar(); this.nextShooting = rand(6, 14); }
    for (const s of this.shooting) { s.x += s.vx * k; s.y += s.vy * k; s.life -= dt * 0.9; }
    this.shooting = this.shooting.filter((s) => s.life > 0);

    for (const l of this.lanterns) { l.y -= l.vy * k; l.sway += dt * 1.4; }
    this.lanterns = this.lanterns.filter((l) => l.y > -80);

    for (const d of this.doves) { d.t += dt; d.flap += dt * 14; }
    this.doves = this.doves.filter((d) => d.t < d.dur + 1.2);

    for (const p of this.particles) {
      p.x += p.vx * k; p.y += p.vy * k; p.vy += 0.06 * k; p.vx *= 0.985; p.life -= p.decay * k;
    }
    this.particles = this.particles.filter((p) => p.life > 0);

    for (const c of this.clouds) c.x += c.v * k;
    this.clouds = this.clouds.filter((c) => c.x < W + 400);

    if (this.caravan) {
      this.caravan.x -= 1.6 * k;
      this.caravan.step += dt * 5;
      if (this.caravan.x < -700) this.caravan = null;
    }
  }

  draw() {
    const g = this.g;
    const th = this.theme;
    // ---- السماء ----
    const sky = g.createLinearGradient(0, 0, 0, GROUND);
    sky.addColorStop(0, th.top);
    sky.addColorStop(0.55, th.mid);
    sky.addColorStop(1, th.low);
    g.fillStyle = sky;
    g.fillRect(0, 0, W, H);

    if (this.golden > 0) {
      g.globalAlpha = this.golden * 0.55;
      const gold = g.createLinearGradient(0, 0, 0, GROUND);
      gold.addColorStop(0, '#3b2405');
      gold.addColorStop(1, '#ffb347');
      g.fillStyle = gold;
      g.fillRect(0, 0, W, GROUND);
      g.globalAlpha = 1;
    }

    g.fillStyle = this.pattern;
    g.fillRect(0, 0, W, 1420);

    this.drawStars(g);
    this.drawMoon(g);
    this.drawRays(g);
    this.drawDunes(g);
    this.drawCaravan(g);
    this.drawMosque(g);
    this.drawGround(g);
    this.drawPalms(g);
    this.drawFlowers(g);
    this.drawClouds(g);
    this.drawLanterns(g);
    this.drawDoves(g);
    this.drawParticles(g);
  }

  drawStars(g) {
    const t = this.t;
    g.fillStyle = '#fff';
    for (const s of this.stars) {
      g.globalAlpha = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(t * s.s + s.p));
      g.fillRect(s.x, s.y, s.r, s.r);
    }
    for (const s of this.likeStars) {
      const age = t - s.born;
      const pop = age < 0.6 ? ease(age / 0.6) : 1;
      const tw = 0.55 + 0.45 * Math.sin(t * s.s * 1.5 + s.p);
      const r = s.r * pop * (age < 0.6 ? 2.2 - age * 2 : 1);
      g.globalAlpha = tw;
      g.fillStyle = '#fff6d8';
      g.beginPath();
      // نجمة رباعية متلألئة
      g.moveTo(s.x, s.y - r * 2.4);
      g.quadraticCurveTo(s.x, s.y, s.x + r * 2.4, s.y);
      g.quadraticCurveTo(s.x, s.y, s.x, s.y + r * 2.4);
      g.quadraticCurveTo(s.x, s.y, s.x - r * 2.4, s.y);
      g.quadraticCurveTo(s.x, s.y, s.x, s.y - r * 2.4);
      g.fill();
    }
    g.globalAlpha = 1;
    for (const s of this.shooting) {
      const grd = g.createLinearGradient(s.x, s.y, s.x - s.vx * 9, s.y - s.vy * 9);
      grd.addColorStop(0, `rgba(255,255,255,${s.life})`);
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.strokeStyle = grd;
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(s.x, s.y); g.lineTo(s.x - s.vx * 9, s.y - s.vy * 9); g.stroke();
    }
  }

  drawMoon(g) {
    const x = 880;
    const y = 470;
    const glow = g.createRadialGradient(x, y, 20, x, y, 260);
    glow.addColorStop(0, 'rgba(255,240,190,0.35)');
    glow.addColorStop(1, 'rgba(255,240,190,0)');
    g.fillStyle = glow;
    g.fillRect(x - 260, y - 260, 520, 520);
    g.drawImage(this.moon, x - this.moon.width / 2, y - this.moon.height / 2);
  }

  drawRays(g) {
    const a = Math.max(this.rays, this.litFull * 0.8);
    if (a <= 0) return;
    g.save();
    g.translate(CX, toScreenY(980));
    g.rotate(this.t * 0.15);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 16; i++) {
      g.rotate((Math.PI * 2) / 16);
      const grd = g.createLinearGradient(0, 0, 0, -1100);
      grd.addColorStop(0, `rgba(255,214,120,${0.28 * a})`);
      grd.addColorStop(1, 'rgba(255,214,120,0)');
      g.fillStyle = grd;
      g.beginPath(); g.moveTo(-14, 0); g.lineTo(-70, -1100); g.lineTo(70, -1100); g.lineTo(14, 0); g.fill();
    }
    g.restore();
  }

  drawDunes(g) {
    const th = this.theme;
    const layer = (y, amp, freq, color, phase) => {
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, GROUND);
      for (let x = 0; x <= W; x += 20) g.lineTo(x, y + Math.sin(x * freq + phase) * amp + Math.sin(x * freq * 2.3 + phase) * amp * 0.3);
      g.lineTo(W, GROUND);
      g.closePath();
      g.fill();
    };
    g.globalAlpha = 0.65;
    layer(1380, 34, 0.006, th.dune, 1.2);
    g.globalAlpha = 1;
    layer(1450, 26, 0.008, mixHex(th.top, '#000000', 0.2), 3.1);
  }

  drawCaravan(g) {
    const c = this.caravan;
    if (!c) return;
    const sil = '#05070f';
    for (let i = 0; i < 3; i++) {
      const x = c.x + i * 190;
      const y = 1462 + Math.sin(x * 0.008 + 3.1) * 20;
      this.drawCamel(g, x, y, c.step + i, sil, i === 0);
    }
    // لافتة الإطعام فوق القافلة
    g.save();
    g.font = 'bold 30px "Cairo", sans-serif';
    g.textAlign = 'center';
    g.direction = 'rtl';
    const label = `🍲 ${c.name} أطعم ${c.count} ${c.count > 10 ? 'مسافراً' : c.count > 2 ? 'مسافرين' : 'مسافراً'}`;
    const lx = c.x + 190;
    const w = g.measureText(label).width + 40;
    g.fillStyle = 'rgba(10,8,25,0.75)';
    g.strokeStyle = GOLD;
    g.lineWidth = 2;
    g.beginPath(); g.roundRect(lx - w / 2, 1300, w, 54, 27); g.fill(); g.stroke();
    g.fillStyle = '#fff3cf';
    g.fillText(label, lx, 1338);
    g.restore();
  }

  drawCamel(g, x, y, step, color, lead) {
    g.save();
    g.translate(x, y);
    g.fillStyle = color;
    g.strokeStyle = color;
    g.lineCap = 'round';
    // أرجل متحركة
    g.lineWidth = 9;
    const legs = [-38, -22, 22, 38];
    legs.forEach((lx, i) => {
      const sw = Math.sin(step * 2 + (i % 2 ? Math.PI : 0)) * 10;
      g.beginPath(); g.moveTo(lx, -40); g.lineTo(lx + sw, 0); g.stroke();
    });
    // جسم وسنام
    g.beginPath();
    g.ellipse(0, -55, 58, 26, 0, 0, Math.PI * 2);
    g.fill();
    g.beginPath();
    g.ellipse(-4, -80, 28, 22, 0, Math.PI, 0);
    g.fill();
    // رقبة ورأس (الاتجاه لليسار)
    g.lineWidth = 16;
    g.beginPath(); g.moveTo(-50, -60); g.quadraticCurveTo(-80, -80, -84, -112); g.stroke();
    g.beginPath(); g.ellipse(-96, -116, 20, 11, -0.2, 0, Math.PI * 2); g.fill();
    // حمولة الطعام مضيئة
    g.fillStyle = '#c98b2b';
    g.beginPath(); g.roundRect(-30, -112, 56, 24, 8); g.fill();
    g.fillStyle = 'rgba(255,210,122,0.9)';
    g.beginPath(); g.arc(-2, -100, 6, 0, Math.PI * 2); g.fill();
    if (lead) {
      // فانوس صغير يتدلى من رقبة الجمل الأول
      g.strokeStyle = '#000';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(-82, -100); g.lineTo(-82, -82); g.stroke();
      const glow = g.createRadialGradient(-82, -74, 2, -82, -74, 26);
      glow.addColorStop(0, 'rgba(255,220,140,0.95)');
      glow.addColorStop(1, 'rgba(255,220,140,0)');
      g.fillStyle = glow;
      g.beginPath(); g.arc(-82, -74, 26, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }

  // ------------------------------------------------------------------
  // المسجد
  // ------------------------------------------------------------------
  isLit(part) {
    const idx = LIGHT_ORDER.indexOf(part);
    const level = this.litFull > 0 ? LIGHT_ORDER.length : this.lit;
    return clamp(level - idx, 0, 1);
  }

  glowFill(g, alpha, pathFn) {
    if (alpha <= 0) return;
    g.save();
    g.globalAlpha = alpha;
    g.shadowColor = '#ffbf4d';
    g.shadowBlur = 30;
    pathFn();
    const flick = 0.92 + 0.08 * Math.sin(this.t * 7 + alpha * 10);
    g.fillStyle = `rgba(255,${Math.round(200 * flick)},${Math.round(110 * flick)},1)`;
    g.fill();
    g.restore();
  }

  drawMosque(g) {
    const th = this.theme;
    const sil = th.sil;
    const edge = mixHex(th.glow, '#000000', 0.35);
    const t = this.t;

    g.save();
    g.translate(CX, GROUND);
    g.scale(MS, MS);
    g.translate(-CX, -BASE);
    // هالة خلف المسجد تزداد مع الإضاءة
    const prog = this.litFull > 0 ? 1 : this.lit / LIGHT_ORDER.length;
    const halo = g.createRadialGradient(CX, 1050, 50, CX, 1050, 620);
    halo.addColorStop(0, `rgba(255,200,110,${0.08 + prog * 0.35})`);
    halo.addColorStop(1, 'rgba(255,200,110,0)');
    g.fillStyle = halo;
    g.fillRect(0, 430, W, 1000);

    g.fillStyle = sil;
    g.strokeStyle = edge;
    g.lineWidth = 2;

    // ---- المئذنتان ----
    MINARETS.forEach((mx, i) => {
      g.fillStyle = sil;
      g.beginPath();
      g.moveTo(mx - 24, BASE); g.lineTo(mx - 20, 930); g.lineTo(mx + 20, 930); g.lineTo(mx + 24, BASE);
      g.closePath(); g.fill(); g.stroke();
      // شرفتان
      [1110, 990].forEach((by, b) => {
        g.fillStyle = sil;
        g.beginPath(); g.roundRect(mx - 36, by - 16, 72, 20, 4); g.fill(); g.stroke();
        const a = this.isLit(`m${i}b${b}`);
        this.glowFill(g, a, () => { g.beginPath(); g.roundRect(mx - 34, by - 8, 68, 6, 3); });
        // نوافذ صغيرة
        this.glowFill(g, a, () => archPath(g, mx, by + 70, 12, 34));
      });
      // القمة
      g.fillStyle = sil;
      g.beginPath();
      g.moveTo(mx - 20, 930);
      g.quadraticCurveTo(mx - 22, 890, mx, 850);
      g.quadraticCurveTo(mx + 22, 890, mx + 20, 930);
      g.fill(); g.stroke();
      const top = this.isLit(`m${i}top`);
      if (top > 0) {
        g.save(); g.globalAlpha = top; g.shadowColor = GOLD; g.shadowBlur = 20; g.strokeStyle = GOLD; g.lineWidth = 3;
        g.beginPath(); g.moveTo(mx - 20, 930); g.quadraticCurveTo(mx - 22, 890, mx, 850); g.quadraticCurveTo(mx + 22, 890, mx + 20, 930); g.stroke();
        g.restore();
      }
      g.strokeStyle = edge;
      g.beginPath(); g.moveTo(mx, 850); g.lineTo(mx, 826); g.stroke();
      const c = this.isLit(`c${i + 1}`);
      crescent(g, mx, 816, 11, c > 0 ? `rgba(255,214,122,${0.35 + 0.65 * c})` : edge);
    });

    // ---- القبتان الجانبيتان ----
    SIDE_DOMES.forEach((sx, i) => {
      g.fillStyle = sil;
      g.strokeStyle = edge;
      domePath(g, sx, BODY.top + 2, 110, 92);
      g.fill(); g.stroke();
      const a = this.isLit(`sd${i}`);
      if (a > 0) {
        g.save(); g.globalAlpha = a; g.shadowColor = GOLD; g.shadowBlur = 22; g.strokeStyle = GOLD; g.lineWidth = 3;
        domePath(g, sx, BODY.top + 2, 110, 92); g.stroke(); g.restore();
      }
      g.strokeStyle = edge;
      g.beginPath(); g.moveTo(sx, BODY.top - 90); g.lineTo(sx, BODY.top - 110); g.stroke();
    });

    // ---- جسم المسجد ----
    g.fillStyle = sil;
    g.strokeStyle = edge;
    g.beginPath(); g.rect(BODY.x1, BODY.top, BODY.x2 - BODY.x1, BASE - BODY.top); g.fill(); g.stroke();
    // شرّافات (زخرفة أعلى الجدار)
    for (let x = BODY.x1 + 6; x < BODY.x2 - 10; x += 26) {
      g.beginPath(); g.moveTo(x, BODY.top); g.lineTo(x + 8, BODY.top - 14); g.lineTo(x + 16, BODY.top); g.fill();
    }
    // شريط زخرفي
    const band = this.isLit('band');
    g.save();
    g.strokeStyle = band > 0 ? `rgba(255,210,122,${0.3 + band * 0.7})` : edge;
    if (band > 0) { g.shadowColor = GOLD; g.shadowBlur = 14 * band; }
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(BODY.x1 + 8, BODY.top + 34); g.lineTo(BODY.x2 - 8, BODY.top + 34); g.stroke();
    for (let x = BODY.x1 + 22; x < BODY.x2 - 14; x += 32) {
      g.beginPath();
      g.moveTo(x, BODY.top + 22); g.lineTo(x + 8, BODY.top + 14); g.lineTo(x + 16, BODY.top + 22); g.lineTo(x + 8, BODY.top + 30); g.closePath();
      g.stroke();
    }
    g.restore();

    // نوافذ الجسم
    BODY_WINDOWS.forEach((wx, i) => {
      g.fillStyle = mixHex(th.top, '#000000', 0.4);
      archPath(g, wx, 1360, 40, 110); g.fill();
      this.glowFill(g, this.isLit(`bw${i}`), () => archPath(g, wx, 1360, 40, 110));
      g.strokeStyle = edge; archPath(g, wx, 1360, 40, 110); g.stroke();
      g.beginPath(); g.moveTo(wx, 1360); g.lineTo(wx, 1265); g.stroke();
    });

    // الباب الكبير (إيوان)
    g.fillStyle = mixHex(th.top, '#000000', 0.5);
    archPath(g, CX, BASE, 130, 210); g.fill();
    this.glowFill(g, this.isLit('door'), () => archPath(g, CX, BASE, 130, 210));
    g.strokeStyle = edge; g.lineWidth = 3;
    archPath(g, CX, BASE, 150, 226); g.stroke();
    archPath(g, CX, BASE, 130, 210); g.stroke();
    g.lineWidth = 2;

    // ---- رقبة القبة ----
    g.fillStyle = sil;
    g.beginPath(); g.rect(DRUM.x1, DRUM.top, DRUM.x2 - DRUM.x1, BODY.top - DRUM.top); g.fill(); g.stroke();
    DRUM_WINDOWS.forEach((wx, i) => {
      g.fillStyle = mixHex(th.top, '#000000', 0.4);
      archPath(g, wx, 1168, 24, 56); g.fill();
      this.glowFill(g, this.isLit(`dw${i}`), () => archPath(g, wx, 1168, 24, 56));
      g.strokeStyle = edge; archPath(g, wx, 1168, 24, 56); g.stroke();
    });

    // ---- القبة الكبرى ----
    g.fillStyle = sil;
    domePath(g, CX, DRUM.top + 2, 300, 236);
    g.fill(); g.stroke();
    const fill = this.isLit('domeFill');
    if (fill > 0) {
      g.save();
      g.globalAlpha = fill * (0.85 + 0.15 * Math.sin(t * 2));
      const dg = g.createLinearGradient(CX - 150, 860, CX + 150, 1092);
      dg.addColorStop(0, '#fff2c4');
      dg.addColorStop(0.5, '#ffc861');
      dg.addColorStop(1, '#b8741d');
      g.fillStyle = dg;
      g.shadowColor = '#ffc861';
      g.shadowBlur = 60;
      domePath(g, CX, DRUM.top + 2, 300, 236);
      g.fill();
      // زخرفة خطوط القبة
      g.globalAlpha = fill * 0.5;
      g.strokeStyle = '#8a4f12';
      g.lineWidth = 2;
      for (let k = -2; k <= 2; k++) {
        g.beginPath();
        g.moveTo(CX + k * 48, DRUM.top + 2);
        g.quadraticCurveTo(CX + k * 62, 950, CX, DRUM.top + 2 - 236);
        g.stroke();
      }
      g.restore();
    }
    const line = this.isLit('domeLine');
    if (line > 0) {
      g.save(); g.globalAlpha = line; g.shadowColor = GOLD; g.shadowBlur = 26; g.strokeStyle = GOLD; g.lineWidth = 4;
      domePath(g, CX, DRUM.top + 2, 300, 236); g.stroke(); g.restore();
    }
    // العمود والهلال
    g.strokeStyle = edge; g.lineWidth = 4;
    const tip = DRUM.top + 2 - 236;
    g.beginPath(); g.moveTo(CX, tip); g.lineTo(CX, tip - 40); g.stroke();
    g.fillStyle = edge;
    g.beginPath(); g.arc(CX, tip - 14, 6, 0, Math.PI * 2); g.fill();
    const c0 = this.isLit('c0');
    if (c0 > 0) { g.save(); g.shadowColor = GOLD; g.shadowBlur = 30 * c0; }
    crescent(g, CX, tip - 62, 20, c0 > 0 ? `rgba(255,214,122,${0.35 + 0.65 * c0})` : edge);
    if (c0 > 0) g.restore();
    g.lineWidth = 2;
    g.restore();
  }

  drawGround(g) {
    const th = this.theme;
    // الأرض/الساحة
    const ground = g.createLinearGradient(0, GROUND, 0, H);
    ground.addColorStop(0, mixHex(th.sil, '#2a1d10', 0.4));
    ground.addColorStop(1, '#05040a');
    g.fillStyle = ground;
    g.fillRect(0, GROUND, W, H - GROUND);

    // البركة مع انعكاس المسجد
    const px = 150; const py = GROUND + 16; const pw = 780; const ph = 130;
    const top = toScreenY(800);
    g.save();
    g.beginPath(); g.roundRect(px, py, pw, ph, 18); g.clip();
    const water = g.createLinearGradient(0, py, 0, py + ph);
    water.addColorStop(0, mixHex(th.low, '#000000', 0.35));
    water.addColorStop(1, mixHex(th.top, '#000000', 0.3));
    g.fillStyle = water;
    g.fillRect(px, py, pw, ph);
    g.translate(0, py * 2);
    g.scale(1, -1);
    g.globalAlpha = 0.42;
    g.drawImage(this.canvas, px, top, pw, GROUND - top, px, py - 6 - ph * 1.05, pw, ph * 1.05);
    g.setTransform(1, 0, 0, 1, 0, 0);
    // تموجات
    g.globalAlpha = 0.25;
    g.strokeStyle = '#cfe3ff';
    g.lineWidth = 2;
    for (let i = 0; i < 9; i++) {
      const y = py + 12 + i * 16;
      const off = Math.sin(this.t * 1.3 + i) * 40;
      g.beginPath(); g.moveTo(px + 60 + off + i * 13, y); g.lineTo(px + 200 + off + i * 13, y); g.stroke();
      g.beginPath(); g.moveTo(px + 460 - off, y + 6); g.lineTo(px + 560 - off, y + 6); g.stroke();
    }
    g.restore();
    // إطار البركة بالبلاط
    g.strokeStyle = 'rgba(255,210,122,0.55)';
    g.lineWidth = 4;
    g.beginPath(); g.roundRect(px, py, pw, ph, 18); g.stroke();
    g.strokeStyle = 'rgba(255,210,122,0.18)';
    g.lineWidth = 12;
    g.beginPath(); g.roundRect(px - 10, py - 10, pw + 20, ph + 20, 24); g.stroke();
  }

  drawPalms(g) {
    const palm = (x, baseY, h, lean, dir) => {
      g.save();
      g.strokeStyle = '#04050b';
      g.fillStyle = '#04050b';
      g.lineWidth = 18;
      g.lineCap = 'round';
      const topX = x + lean;
      const topY = baseY - h;
      g.beginPath(); g.moveTo(x, baseY); g.quadraticCurveTo(x + lean * 0.2, baseY - h * 0.5, topX, topY); g.stroke();
      const sway = Math.sin(this.t * 0.8 + x) * 0.05;
      g.fillStyle = '#04050b';
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI / 2 + (i - 4) * 0.38 * dir + sway;
        const len = 190 + (i % 3) * 30;
        const ex = topX + Math.cos(a) * len;
        const ey = topY + Math.sin(a) * len * 0.55 + 70;
        const mx = topX + Math.cos(a) * len * 0.55;
        const my = topY + Math.sin(a) * len * 0.55 - 40;
        const nx = -Math.sin(a) * 22;
        const ny = Math.cos(a) * 22;
        // سعفة ممتلئة مستدقّة الطرفين
        g.beginPath();
        g.moveTo(topX, topY);
        g.quadraticCurveTo(mx + nx, my + ny, ex, ey);
        g.quadraticCurveTo(mx - nx * 0.4, my - ny * 0.4, topX, topY);
        g.fill();
      }
      // تمر ذهبي صغير
      g.fillStyle = '#7a4a14';
      for (let i = 0; i < 6; i++) { g.beginPath(); g.arc(topX - 12 + i * 5, topY + 18 + (i % 2) * 8, 6, 0, Math.PI * 2); g.fill(); }
      g.restore();
    };
    palm(50, 1900, 560, 40, 1);
    palm(1035, 1900, 600, -50, -1);
    palm(140, 1930, 360, 30, 1);
  }

  drawFlowers(g) {
    const t = this.t;
    for (const f of this.flowers) {
      const age = t - f.born;
      if (age < 0) continue;
      const grow = ease(clamp(age / 1.2, 0, 1));
      const { x, y } = f.slot;
      const sway = Math.sin(t * 1.5 + f.sway) * 4;
      const h = 34 * grow;
      g.strokeStyle = '#1f6b3a';
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + sway, y - h / 2, x + sway, y - h); g.stroke();
      // ورقتان
      g.fillStyle = '#2a8a4a';
      g.beginPath(); g.ellipse(x + sway * 0.5 - 7, y - h * 0.45, 8 * grow, 3.5 * grow, -0.6, 0, Math.PI * 2); g.fill();
      const bloom = ease(clamp((age - 0.6) / 1, 0, 1));
      if (bloom > 0) {
        const r = f.size * bloom;
        const cx = x + sway;
        const cy = y - h;
        g.save();
        g.shadowColor = `hsla(${f.hue},90%,65%,0.8)`;
        g.shadowBlur = 14;
        for (let i = 0; i < 6; i++) {
          const a = (Math.PI * 2 * i) / 6 + t * 0.05;
          g.fillStyle = `hsl(${f.hue},${80 - i * 3}%,${58 - (i % 2) * 8}%)`;
          g.beginPath(); g.ellipse(cx + Math.cos(a) * r * 0.45, cy + Math.sin(a) * r * 0.45, r * 0.55, r * 0.36, a, 0, Math.PI * 2); g.fill();
        }
        g.fillStyle = `hsl(${f.hue},70%,38%)`;
        g.beginPath(); g.arc(cx, cy, r * 0.3, 0, Math.PI * 2); g.fill();
        g.restore();
      }
      if (f.name && age < 4) {
        g.save();
        g.globalAlpha = clamp(4 - age, 0, 1);
        g.font = 'bold 26px "Cairo", sans-serif';
        g.textAlign = 'center';
        g.fillStyle = '#ffe1ec';
        g.shadowColor = '#000';
        g.shadowBlur = 8;
        g.fillText(`🌹 ${f.name}`, clamp(x, 140, 940), y - 70 - age * 10);
        g.restore();
      }
    }
  }

  drawClouds(g) {
    if (!this.clouds.length) return;
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const c of this.clouds) {
      const grd = g.createRadialGradient(c.x, c.y, 10, c.x, c.y, c.r);
      grd.addColorStop(0, `hsla(${c.hue},80%,70%,${c.a})`);
      grd.addColorStop(1, `hsla(${c.hue},80%,60%,0)`);
      g.fillStyle = grd;
      g.fillRect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);
      if (Math.random() < 0.15) this.particles.push({ x: c.x + rand(-c.r / 2, c.r / 2), y: c.y + rand(-c.r / 2, c.r / 2), vx: rand(1, 3), vy: -rand(0.5, 2), life: 1, decay: 0.02, r: rand(1.5, 3), color: '#f3c6ff' });
    }
    g.restore();
  }

  drawLanterns(g) {
    for (const l of this.lanterns) {
      const x = l.x + Math.sin(l.sway) * 18;
      const y = l.y;
      const s = l.size;
      const fade = clamp(y / 300, 0, 1);
      g.save();
      g.globalAlpha = fade;
      const glow = g.createRadialGradient(x, y, 4, x, y, 60 * s);
      glow.addColorStop(0, 'rgba(255,200,110,0.6)');
      glow.addColorStop(1, 'rgba(255,200,110,0)');
      g.fillStyle = glow;
      g.fillRect(x - 60 * s, y - 60 * s, 120 * s, 120 * s);
      // جسم الفانوس
      g.fillStyle = `hsl(${l.hue},95%,62%)`;
      g.beginPath();
      g.moveTo(x - 14 * s, y - 18 * s);
      g.quadraticCurveTo(x - 20 * s, y, x - 12 * s, y + 20 * s);
      g.lineTo(x + 12 * s, y + 20 * s);
      g.quadraticCurveTo(x + 20 * s, y, x + 14 * s, y - 18 * s);
      g.closePath();
      g.fill();
      g.fillStyle = '#7a3c08';
      g.fillRect(x - 15 * s, y - 24 * s, 30 * s, 7 * s);
      g.fillRect(x - 13 * s, y + 18 * s, 26 * s, 5 * s);
      g.fillStyle = '#fff2c4';
      g.beginPath(); g.ellipse(x, y + 2 * s, 4 * s, 7 * s, 0, 0, Math.PI * 2); g.fill();
      if (l.name && this.t - l.born < 3.5) {
        g.globalAlpha = fade * clamp(3.5 - (this.t - l.born), 0, 1);
        g.font = 'bold 26px "Cairo", sans-serif';
        g.textAlign = 'center';
        g.fillStyle = '#fff0c8';
        g.shadowColor = '#000';
        g.shadowBlur = 8;
        g.fillText(`🏮 ${l.name}`, clamp(x, 140, 940), y + 58 * s);
      }
      g.restore();
    }
  }

  drawDoves(g) {
    for (const d of this.doves) {
      const p = clamp(d.t / d.dur, 0, 1);
      if (d.t < 0) continue;
      const e = ease(p);
      // مسار قوسي
      const x = d.sx + (d.tx - d.sx) * e;
      const y = d.sy + (d.ty - d.sy) * e - Math.sin(e * Math.PI) * 260;
      const fade = d.t > d.dur ? clamp(1 - (d.t - d.dur) / 1.2, 0, 1) : 1;
      const flap = Math.sin(d.flap) * 0.9;
      g.save();
      g.globalAlpha = fade;
      g.translate(x, y);
      g.shadowColor = '#ffffff';
      g.shadowBlur = 16;
      g.fillStyle = '#ffffff';
      g.beginPath(); g.ellipse(0, 0, 22, 10, -0.15, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(20, -6, 7, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffb347';
      g.beginPath(); g.moveTo(26, -6); g.lineTo(34, -4); g.lineTo(26, -2); g.fill();
      g.fillStyle = '#f1f5ff';
      g.beginPath(); g.moveTo(-4, -2); g.quadraticCurveTo(-10, -34 * flap - 6, -30, -40 * flap - 4); g.quadraticCurveTo(-14, -8, 8, -2); g.fill();
      g.beginPath(); g.moveTo(-20, 0); g.lineTo(-36, -8); g.lineTo(-34, 8); g.closePath(); g.fill();
      g.shadowBlur = 6;
      g.shadowColor = '#000';
      g.font = 'bold 22px "Cairo", sans-serif';
      g.textAlign = 'center';
      g.fillStyle = '#e6f3ff';
      g.fillText(d.name, 0, 38);
      g.restore();
      if (p >= 1 && !d.arrived) {
        d.arrived = true;
        this.burst(x, y, '#ffffff', 14);
      }
    }
  }

  drawParticles(g) {
    g.save();
    g.globalCompositeOperation = 'lighter';
    for (const p of this.particles) {
      g.globalAlpha = clamp(p.life, 0, 1);
      g.fillStyle = p.color;
      g.beginPath(); g.arc(p.x, p.y, p.r, 0, Math.PI * 2); g.fill();
    }
    g.restore();
  }
}
