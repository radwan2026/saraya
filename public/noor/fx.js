// ===============================================================
//  السماء والمؤثرات البصرية على canvas: نجوم، هلال، فوانيس، بتلات، كعك، مسك، شهب، ألعاب نور
// ===============================================================
import { lanternSVG, kaakSVG, petalSVG } from './art.js';

const W = 1080;
const H = 1920;

function sprite(svg) {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  return img;
}

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (l) => l[Math.floor(Math.random() * l.length)];

export class FxEngine {
  constructor(skyCanvas, fxCanvas) {
    this.sky = skyCanvas.getContext('2d');
    this.ctx = fxCanvas.getContext('2d');
    skyCanvas.width = fxCanvas.width = W;
    skyCanvas.height = fxCanvas.height = H;
    this.particles = [];
    this.lanterns = [];   // فوانيس القلوب الطائرة
    this.dhikrStars = []; // نجوم الأذكار الدائمة
    this.auroraUntil = 0;
    this.flashUntil = 0;
    this.flashColor = '#fff';
    this.t = 0;
    this.sprites = {
      lanterns: ['#ffc24d', '#ff9a4d', '#ffd86b', '#ff7f6b'].map((c) => sprite(lanternSVG(c))),
      kaak: [sprite(kaakSVG()), sprite(kaakSVG()), sprite(kaakSVG())],
      petals: ['#ff4d74', '#e3204b', '#ff8fa8', '#ff6b8b', '#ffd1dc'].map((c) => sprite(petalSVG(c))),
    };
    this.buildSky();
    this.last = performance.now();
    const loop = (now) => {
      const dt = Math.min(0.05, (now - this.last) / 1000);
      this.last = now;
      this.t += dt;
      this.frame(dt);
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------------
  // السماء الثابتة (تُرسم مرة واحدة) + النجوم المتلألئة
  // ------------------------------------------------------------------
  buildSky() {
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const g = c.getContext('2d');
    const grad = g.createLinearGradient(0, 0, 0, H);
    grad.addColorStop(0, '#030716');
    grad.addColorStop(0.35, '#0a1534');
    grad.addColorStop(0.7, '#17255a');
    grad.addColorStop(0.88, '#3a3170');
    grad.addColorStop(1, '#5a3a62');
    g.fillStyle = grad;
    g.fillRect(0, 0, W, H);
    // سُحب مجرّية ناعمة
    for (const [x, y, r, col] of [[260, 700, 520, 'rgba(90,70,190,.16)'], [820, 1000, 600, 'rgba(40,120,170,.12)'], [540, 1500, 700, 'rgba(255,170,90,.10)']]) {
      const rg = g.createRadialGradient(x, y, 0, x, y, r);
      rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rg; g.fillRect(0, 0, W, H);
    }
    // درب التبانة
    g.save();
    g.translate(540, 900); g.rotate(-0.5);
    for (let i = 0; i < 900; i++) {
      const x = rand(-900, 900); const y = rand(-1, 1) * rand(0, 1) * 120;
      g.fillStyle = `rgba(255,255,255,${rand(0.05, 0.35)})`;
      g.fillRect(x, y, 1.3, 1.3);
    }
    g.restore();
    this.skyBase = c;
    this.stars = Array.from({ length: 260 }, () => ({
      x: rand(0, W), y: rand(0, 1500) ** 1.0, r: rand(0.6, 2.2), p: rand(0, Math.PI * 2), s: rand(0.6, 2.2),
    }));
    this.clouds = Array.from({ length: 5 }, (_, i) => ({ x: rand(-200, W), y: 640 + i * 110, w: rand(260, 480), v: rand(6, 14) }));
  }

  drawMoon(g) {
    const x = 560; const y = 650 + Math.sin(this.t * 0.3) * 4;
    const halo = g.createRadialGradient(x, y, 30, x, y, 260);
    halo.addColorStop(0, 'rgba(255,236,170,.45)');
    halo.addColorStop(1, 'rgba(255,236,170,0)');
    g.fillStyle = halo;
    g.fillRect(x - 260, y - 260, 520, 520);
    g.save();
    g.beginPath();
    g.arc(x, y, 92, 0, Math.PI * 2);
    g.arc(x + 42, y - 26, 82, 0, Math.PI * 2, true);
    g.closePath();
    const mg = g.createLinearGradient(x - 90, y - 90, x + 40, y + 90);
    mg.addColorStop(0, '#fffbe6'); mg.addColorStop(1, '#f2c96a');
    g.fillStyle = mg;
    g.shadowColor = '#ffe9a8'; g.shadowBlur = 40;
    g.fill('evenodd');
    g.restore();
  }

  frame(dt) {
    const g = this.sky;
    g.drawImage(this.skyBase, 0, 0);
    // نجوم
    for (const s of this.stars) {
      const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(this.t * s.s + s.p));
      g.fillStyle = `rgba(255,250,230,${a})`;
      g.beginPath(); g.arc(s.x, s.y, s.r, 0, Math.PI * 2); g.fill();
    }
    this.drawMoon(g);
    // سحب خفيفة
    for (const c of this.clouds) {
      c.x += c.v * dt;
      if (c.x - c.w > W) c.x = -c.w;
      const cg = g.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.w);
      cg.addColorStop(0, 'rgba(160,170,230,.07)'); cg.addColorStop(1, 'rgba(160,170,230,0)');
      g.fillStyle = cg;
      g.beginPath(); g.ellipse(c.x, c.y, c.w, c.w * 0.22, 0, 0, Math.PI * 2); g.fill();
    }
    // الشفق (ليلة النور الكبرى)
    if (this.auroraUntil > performance.now()) this.drawAurora(g);
    // نجوم الأذكار الدائمة
    for (const s of this.dhikrStars) this.drawDhikrStar(g, s, dt);

    // طبقة المؤثرات الأمامية
    const ctx = this.ctx;
    ctx.clearRect(0, 0, W, H);
    for (const l of this.lanterns) this.drawLantern(ctx, l, dt);
    this.lanterns = this.lanterns.filter((l) => l.life > 0);
    for (const p of this.particles) this.step(ctx, p, dt);
    this.particles = this.particles.filter((p) => p.life > 0);
    if (this.flashUntil > performance.now()) {
      const k = (this.flashUntil - performance.now()) / 600;
      ctx.fillStyle = this.flashColor;
      ctx.globalAlpha = Math.max(0, k) * 0.35;
      ctx.fillRect(0, 0, W, H);
      ctx.globalAlpha = 1;
    }
  }

  drawAurora(g) {
    const left = (this.auroraUntil - performance.now()) / 7000;
    const alpha = Math.min(1, left * 3) * 0.55;
    g.save();
    g.globalCompositeOperation = 'lighter';
    const cols = ['60,255,190', '160,110,255', '255,210,120'];
    cols.forEach((col, k) => {
      g.beginPath();
      for (let x = 0; x <= W; x += 20) {
        const y = 520 + k * 90 + Math.sin(x / 160 + this.t * (0.8 + k * 0.3)) * 70;
        if (x === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.lineTo(W, 0); g.lineTo(0, 0); g.closePath();
      const ag = g.createLinearGradient(0, 200, 0, 800);
      ag.addColorStop(0, `rgba(${col},0)`); ag.addColorStop(1, `rgba(${col},${alpha * 0.5})`);
      g.fillStyle = ag; g.fill();
    });
    g.restore();
  }

  drawDhikrStar(g, s, dt) {
    if (s.travel < 1) {
      s.travel = Math.min(1, s.travel + dt / 1.4);
      const e = 1 - (1 - s.travel) ** 3;
      s.x = s.x0 + (s.tx - s.x0) * e;
      s.y = s.y0 + (s.ty - s.y0) * e - Math.sin(e * Math.PI) * 120;
    }
    const tw = 0.6 + 0.4 * Math.sin(this.t * 2 + s.p);
    const r = s.r * (s.travel < 1 ? 1.6 : 1) * tw;
    g.save();
    g.globalCompositeOperation = 'lighter';
    const rg = g.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 5);
    rg.addColorStop(0, s.color); rg.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = rg;
    g.fillRect(s.x - r * 5, s.y - r * 5, r * 10, r * 10);
    g.fillStyle = '#fff';
    g.beginPath();
    for (let i = 0; i < 8; i++) {
      const a = (Math.PI / 4) * i;
      const rr = i % 2 === 0 ? r * 2.4 : r * 0.8;
      g.lineTo(s.x + Math.cos(a) * rr, s.y + Math.sin(a) * rr);
    }
    g.closePath(); g.fill();
    g.restore();
  }

  drawLantern(ctx, l, dt) {
    l.life -= dt;
    l.y += l.vy * dt;
    l.x += Math.sin(this.t * l.sw + l.p) * 12 * dt;
    const a = Math.min(1, l.life / 3, (l.max - l.life) / 0.6);
    ctx.save();
    ctx.globalAlpha = Math.max(0, a);
    const glow = ctx.createRadialGradient(l.x, l.y, 0, l.x, l.y, 70 * l.s);
    glow.addColorStop(0, 'rgba(255,200,100,.55)'); glow.addColorStop(1, 'rgba(255,200,100,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(l.x - 80 * l.s, l.y - 80 * l.s, 160 * l.s, 160 * l.s);
    ctx.translate(l.x, l.y);
    ctx.rotate(Math.sin(this.t * 1.5 + l.p) * 0.08);
    ctx.drawImage(l.img, -30 * l.s, -45 * l.s, 60 * l.s, 90 * l.s);
    ctx.restore();
  }

  step(ctx, p, dt) {
    p.life -= dt;
    const a = Math.max(0, Math.min(1, p.life / (p.fade || 0.8)));
    switch (p.type) {
      case 'petal':
      case 'kaak': {
        p.vy += (p.g || 0) * dt;
        p.x += (p.vx + Math.sin(this.t * 2 + p.p) * (p.sway || 0)) * dt;
        p.y += p.vy * dt;
        p.rot += p.vr * dt;
        if (p.floor && p.y > p.floor && p.vy > 0) { p.y = p.floor; p.vy *= -0.35; p.vr *= 0.5; }
        ctx.save();
        ctx.globalAlpha = a;
        ctx.translate(p.x, p.y); ctx.rotate(p.rot);
        if (p.type === 'petal') ctx.scale(1, Math.abs(Math.cos(this.t * 3 + p.p)) * 0.6 + 0.4);
        ctx.drawImage(p.img, -p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
        break;
      }
      case 'spark': {
        p.vx *= 0.985; p.vy = p.vy * 0.985 + (p.g || 0) * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a;
        const rg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        rg.addColorStop(0, '#fff'); rg.addColorStop(0.3, p.color); rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg;
        ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
        ctx.restore();
        break;
      }
      case 'musk': {
        p.x += p.vx * dt;
        p.y += Math.sin(this.t * 1.5 + p.p) * 30 * dt;
        p.size += 30 * dt;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a * 0.5;
        const rg = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.size);
        rg.addColorStop(0, p.color); rg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = rg;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        break;
      }
      case 'shoot': {
        p.x += p.vx * dt; p.y += p.vy * dt;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a;
        const tx = p.x - p.vx * 0.25; const ty = p.y - p.vy * 0.25;
        const lg = ctx.createLinearGradient(p.x, p.y, tx, ty);
        lg.addColorStop(0, 'rgba(255,255,240,1)'); lg.addColorStop(1, 'rgba(120,200,255,0)');
        ctx.strokeStyle = lg; ctx.lineWidth = p.size; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(tx, ty); ctx.stroke();
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size * 0.9, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
        break;
      }
      case 'ring': {
        p.size += p.grow * dt;
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a;
        ctx.strokeStyle = p.color; ctx.lineWidth = p.width * a + 1;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.stroke();
        ctx.restore();
        break;
      }
      case 'beam': {
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        ctx.globalAlpha = a * (0.6 + 0.4 * Math.sin(this.t * 8));
        const bg = ctx.createLinearGradient(0, p.y, 0, 0);
        bg.addColorStop(0, p.color); bg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = bg;
        ctx.beginPath();
        ctx.moveTo(p.x - 14, p.y); ctx.lineTo(p.x + 14, p.y);
        ctx.lineTo(p.x + p.size, 0); ctx.lineTo(p.x - p.size, 0); ctx.closePath();
        ctx.fill();
        ctx.restore();
        break;
      }
      default: break;
    }
  }

  // ------------------------------------------------------------------
  // واجهة التأثيرات
  // ------------------------------------------------------------------

  sparkles(x, y, n = 20, color = '#ffd86b', speed = 300) {
    for (let i = 0; i < n; i++) {
      const a = rand(0, Math.PI * 2); const v = rand(speed * 0.3, speed);
      this.particles.push({ type: 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 120, size: rand(6, 16), color, life: rand(0.7, 1.5), fade: 0.8 });
    }
  }

  petals(cx, n = 40) {
    for (let i = 0; i < n; i++) {
      this.particles.push({ type: 'petal', img: pick(this.sprites.petals), x: cx + rand(-320, 320), y: rand(-300, -20),
        vx: rand(-20, 20), vy: rand(110, 220), sway: rand(30, 80), rot: rand(0, 6), vr: rand(-2, 2), size: rand(26, 46), p: rand(0, 6), life: rand(7, 10), fade: 1.5 });
    }
  }

  kaakRain(n = 26) {
    for (let i = 0; i < n; i++) {
      this.particles.push({ type: 'kaak', img: pick(this.sprites.kaak), x: rand(60, W - 60), y: rand(-500, -40),
        vx: rand(-30, 30), vy: rand(100, 260), g: 380, rot: rand(0, 6), vr: rand(-3, 3), size: rand(54, 84), floor: rand(1640, 1720), p: 0, life: rand(4.5, 6), fade: 1 });
    }
  }

  musk(color1 = 'rgba(255,214,120,1)', color2 = 'rgba(190,140,255,1)') {
    for (let i = 0; i < 22; i++) {
      this.particles.push({ type: 'musk', x: rand(-300, -60), y: rand(500, 1600), vx: rand(260, 420), size: rand(90, 200),
        color: i % 2 ? color1 : color2, p: rand(0, 6), life: rand(3.5, 5), fade: 1.5 });
    }
    for (let i = 0; i < 40; i++) this.sparkles(rand(0, W), rand(500, 1600), 1, '#ffe7a8', 80);
  }

  lantern(x, y, s = 1) {
    if (this.lanterns.length > 45) this.lanterns.shift();
    const max = rand(13, 18);
    this.lanterns.push({ img: pick(this.sprites.lanterns), x, y, vy: rand(-75, -45), sw: rand(0.6, 1.4), p: rand(0, 6), s: s * rand(0.8, 1.2), life: max, max });
  }

  shootingStars(n = 3) {
    for (let i = 0; i < n; i++) {
      setTimeout(() => this.particles.push({ type: 'shoot', x: rand(500, 1300), y: rand(-80, 400), vx: rand(-1300, -900), vy: rand(500, 800), size: rand(3, 6), life: 1.3, fade: 0.5 }), i * rand(150, 400));
    }
  }

  dhikrStar(x, y, color = '#ffe9a8') {
    if (this.dhikrStars.length > 160) this.dhikrStars.shift();
    this.dhikrStars.push({ x0: x, y0: y, x, y, tx: rand(40, W - 40), ty: rand(60, 900), travel: 0, r: rand(2.2, 3.6), p: rand(0, 6), color });
  }

  ring(x, y, color = '#ffe9a8', width = 10, grow = 600) {
    this.particles.push({ type: 'ring', x, y, size: 20, grow, width, color, life: 1.2, fade: 1.2 });
  }

  beam(x, y, color, life = 3) {
    this.particles.push({ type: 'beam', x, y, size: 260, color, life, fade: 1 });
  }

  fireworks(n = 8, colors = ['#ffd86b', '#9fffe0', '#b9e0ff', '#ecd9ff']) {
    for (let i = 0; i < n; i++) {
      setTimeout(() => {
        const x = rand(140, W - 140); const y = rand(300, 900); const c = pick(colors);
        this.sparkles(x, y, 46, c, 420);
        this.ring(x, y, c, 4, 380);
      }, i * 380);
    }
  }

  aurora(ms = 7000) {
    this.auroraUntil = performance.now() + ms;
  }

  flash(color = '#fff') {
    this.flashColor = color;
    this.flashUntil = performance.now() + 600;
  }

  clearRound() {
    this.dhikrStars.length = 0;
  }
}
