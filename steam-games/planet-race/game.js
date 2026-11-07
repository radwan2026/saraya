/* ===============================================================
   سباق الكواكب — المحرّك والرسم والواجهة
   لعبة فردية (6 مراحل بالنجوم) أو لاعبَين بالتناوب على نفس الجهاز.
   لا تحتاج خادماً: تعمل مباشرة من الملفات أو داخل iframe في المنصة.
   =============================================================== */
(() => {
  'use strict';

  const P = window.PlanetPhysics;
  const W = P.WORLD;
  const TIME_SCALE = 1.6;        // تسريع الزمن ليكون اللعب ممتعاً (الفيزياء نفسها لا تتغير)
  const ROCKETS_PER_LEVEL = 3;
  const PLAYER_COLORS = ['#3fcf6e', '#4f7cff'];

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  };

  // ------------------------------------------------------------------
  // الحفظ (محلي فقط ومحمي من أخطاء التصفح الخاص)
  // ------------------------------------------------------------------
  const STORE_KEY = 'steamGames.planetRace.v1';
  function load() {
    try { return { stars: [], sound: true, ...JSON.parse(localStorage.getItem(STORE_KEY) || '{}') }; } catch { return { stars: [], sound: true }; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(store)); } catch { /* تجاهل */ }
  }
  const store = load();

  /** يخبر المنصة الحاضنة (إن وُجدت) بأحداث اللعبة */
  function notify(event, data = {}) {
    try {
      if (window.parent && window.parent !== window) {
        window.parent.postMessage({ source: 'steam-games', game: 'planet-race', event, ...data }, '*');
      }
    } catch { /* تجاهل */ }
  }

  // ------------------------------------------------------------------
  // الأصوات (WebAudio — بدون ملفات)
  // ------------------------------------------------------------------
  let actx = null;
  function tone(freq, dur = 0.15, type = 'sine', vol = 0.12, delay = 0, slideTo = null) {
    if (!store.sound) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      const t = actx.currentTime + delay;
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(actx.destination);
      o.start(t); o.stop(t + dur + 0.05);
    } catch { /* تجاهل */ }
  }
  const sfx = {
    click: () => tone(660, 0.06, 'triangle', 0.06),
    launch: () => { tone(90, 1.2, 'sawtooth', 0.1, 0, 520); tone(180, 1, 'triangle', 0.07, 0.1, 800); },
    land: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.2, 'triangle', 0.1, i * 0.08)),
    flyby: () => [660, 880].forEach((f, i) => tone(f, 0.15, 'sine', 0.08, i * 0.1)),
    burn: () => tone(220, 0.5, 'sawtooth', 0.08, 0, 50),
    lost: () => tone(520, 0.6, 'sine', 0.07, 0, 140),
    win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 'triangle', 0.11, i * 0.13)),
  };

  // ------------------------------------------------------------------
  // اللوحة والرؤية
  // ------------------------------------------------------------------
  const cv = $('space');
  const ctx = cv.getContext('2d');
  const view = { w: 0, h: 0, dpr: 1, cx: 0, cy: 0, s: 1 };
  let stars = [];

  function resize() {
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.w = cv.clientWidth; view.h = cv.clientHeight;
    cv.width = Math.round(view.w * view.dpr); cv.height = Math.round(view.h * view.dpr);
    const top = document.querySelector('.hud-top').offsetHeight;
    const bottom = $('controls').offsetHeight;
    const playH = Math.max(200, view.h - top - bottom);
    view.s = Math.min(view.w * 0.98, playH * 0.98) / (2 * W.worldRadius);
    view.cx = view.w / 2;
    view.cy = top + playH / 2;
    stars = Array.from({ length: Math.round((view.w * view.h) / 3500) }, () => ({
      x: Math.random() * view.w, y: Math.random() * view.h, r: 0.4 + Math.random() * 1.4, p: Math.random() * 6.3, s: 0.5 + Math.random() * 2,
    }));
  }
  window.addEventListener('resize', resize);

  /** من إحداثيات الشاشة إلى العالم */
  function toWorld(px, py) {
    return { x: (px - view.cx) / view.s, y: -(py - view.cy) / view.s };
  }
  /** حجم خط مقروء بغض النظر عن التكبير (بوحدات العالم) */
  const fs = (screenPx) => screenPx / view.s;

  // ------------------------------------------------------------------
  // الحالة
  // ------------------------------------------------------------------
  const S = {
    time: Math.random() * 100, // زمن المجموعة الشمسية (الكواكب تدور دائماً)
    mode: null,                // 'single' | 'duo'
    phase: 'idle',             // 'idle' | 'aim' | 'flight' | 'wait'
    paused: false,
    aim: 62,
    power: 2,
    target: null,              // { planet, theta0, launchTime }
    rocket: null,
    ghosts: [],                // مسارات المحاولات السابقة
    landed: [],                // صواريخ هبطت على الكوكب { off, color }
    single: { level: 0, attempt: 1 },
    duo: null,
  };
  const fx = [];

  function guideLevel() {
    if (S.mode === 'single') return P.LEVELS[S.single.level].guide;
    if (S.mode === 'duo') return S.duo.guide;
    return 1;
  }
  function currentColor() {
    return S.mode === 'duo' ? PLAYER_COLORS[S.duo.turn] : PLAYER_COLORS[0];
  }

  function newTarget(planetId) {
    const planet = P.planetById(planetId);
    // نبدأ والكوكب بعيداً عن نقطة الالتقاء السهلة حتى يحتاج اللاعب إلى التفكير في التوقيت
    S.target = { planet, theta0: Math.random() * Math.PI * 2 - P.angularSpeed(planet.orbit) * S.time, launchTime: 0 };
    S.ghosts = [];
    S.landed = [];
    S.rocket = null;
  }

  // ------------------------------------------------------------------
  // الرسم
  // ------------------------------------------------------------------
  function drawBackground(time) {
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    ctx.clearRect(0, 0, view.w, view.h);
    ctx.fillStyle = '#fff';
    for (const s of stars) {
      ctx.globalAlpha = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(time * s.s + s.p));
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    // من الآن نرسم بوحدات العالم: (x, -y)
    ctx.setTransform(view.dpr * view.s, 0, 0, view.dpr * view.s, view.dpr * view.cx, view.dpr * view.cy);
  }

  function drawSun(g, time) {
    const R = W.sunRadius;
    const pulse = 1 + 0.04 * Math.sin(time * 3);
    let gr = g.createRadialGradient(0, 0, R * 0.4, 0, 0, R * 3.4 * pulse);
    gr.addColorStop(0, 'rgba(255,210,90,.55)'); gr.addColorStop(0.4, 'rgba(255,140,30,.18)'); gr.addColorStop(1, 'rgba(255,120,0,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R * 3.4 * pulse, 0, Math.PI * 2); g.fill();
    g.save(); g.rotate(time * 0.25);
    for (let i = 0; i < 14; i++) {
      g.rotate((Math.PI * 2) / 14);
      const len = R * (1.25 + 0.15 * Math.sin(time * 4 + i * 1.7));
      g.fillStyle = 'rgba(255,170,40,.45)';
      g.beginPath(); g.moveTo(-10, R * 0.8); g.lineTo(0, len); g.lineTo(10, R * 0.8); g.fill();
    }
    g.restore();
    gr = g.createRadialGradient(-16, -18, 6, 0, 0, R);
    gr.addColorStop(0, '#fffbe0'); gr.addColorStop(0.45, '#ffd23f'); gr.addColorStop(1, '#ff8a00');
    g.fillStyle = gr; g.beginPath(); g.arc(0, 0, R, 0, Math.PI * 2); g.fill();
    if (view.s > 0.45) label(g, 'الشمس', 0, fs(6), fs(15), 'rgba(90,35,0,.9)', false);
  }

  function label(g, text, x, y, size, color, stroke = true) {
    g.font = `900 ${size}px 'Jannat LT', sans-serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    if (stroke) { g.lineWidth = size * 0.22; g.strokeStyle = 'rgba(0,0,0,.75)'; g.strokeText(text, x, y); }
    g.fillStyle = color; g.fillText(text, x, y);
  }

  function drawOrbit(r, color, width, dash) {
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = width;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  /** يرسم كوكباً في (x, y) على أي لوحة (المشهد أو الصور المصغّرة) */
  function drawPlanet(g, pl, x, y, R, lightAngle = null) {
    const glow = g.createRadialGradient(x, y, R * 0.6, x, y, R * 2.1);
    glow.addColorStop(0, `${pl.glow}66`); glow.addColorStop(1, `${pl.glow}00`);
    g.fillStyle = glow; g.beginPath(); g.arc(x, y, R * 2.1, 0, Math.PI * 2); g.fill();
    const ring = (from, to, alpha) => {
      g.save(); g.translate(x, y); g.rotate(-0.35);
      g.strokeStyle = `rgba(255,240,190,${alpha})`; g.lineWidth = R * 0.18;
      g.beginPath(); g.ellipse(0, 0, R * 1.9, R * 0.55, 0, from, to); g.stroke();
      g.restore();
    };
    if (pl.rings) ring(Math.PI, Math.PI * 2, 0.7);
    const gr = g.createRadialGradient(x - R * 0.35, y - R * 0.35, R * 0.15, x, y, R);
    gr.addColorStop(0, '#fff'); gr.addColorStop(0.25, pl.glow); gr.addColorStop(1, pl.color);
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fill();
    if (pl.id === 'jupiter') {
      g.save(); g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.clip();
      g.fillStyle = 'rgba(150,80,40,.35)';
      for (const dy of [-0.45, -0.1, 0.3]) g.fillRect(x - R, y + dy * R, R * 2, R * 0.16);
      g.fillStyle = 'rgba(190,60,40,.8)';
      g.beginPath(); g.ellipse(x + R * 0.3, y + R * 0.42, R * 0.2, R * 0.11, 0, 0, Math.PI * 2); g.fill();
      g.restore();
    }
    if (pl.id === 'mars') {
      g.fillStyle = 'rgba(255,255,255,.75)';
      g.beginPath(); g.ellipse(x, y - R * 0.86, R * 0.32, R * 0.12, 0, 0, Math.PI * 2); g.fill();
    }
    if (pl.rings) ring(0, Math.PI, 0.9);
    if (lightAngle !== null) {
      // الجهة البعيدة عن الشمس مظلمة
      const sh = g.createLinearGradient(x - Math.cos(lightAngle) * R, y - Math.sin(lightAngle) * R, x + Math.cos(lightAngle) * R, y + Math.sin(lightAngle) * R);
      sh.addColorStop(0.45, 'rgba(0,0,20,0)'); sh.addColorStop(1, 'rgba(0,0,20,.55)');
      g.fillStyle = sh; g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.fill();
    }
  }

  function drawEarth(time) {
    const x = 0; const y = W.earthOrbit; // (x, -y) في نظام الرسم
    const R = 30;
    const glow = ctx.createRadialGradient(x, y, R * 0.8, x, y, R * 2.3);
    glow.addColorStop(0, 'rgba(90,180,255,.5)'); glow.addColorStop(1, 'rgba(90,180,255,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, R * 2.3, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.clip();
    const gr = ctx.createRadialGradient(x - 10, y - 10, 4, x, y, R);
    gr.addColorStop(0, '#9fe0ff'); gr.addColorStop(1, '#1b5fd1');
    ctx.fillStyle = gr; ctx.fillRect(x - R, y - R, R * 2, R * 2);
    ctx.fillStyle = '#3fcf6e';
    const off = (time * 14) % (R * 4);
    for (const [cx, cy, rx, ry] of [[-20, -8, 13, 9], [10, 10, 11, 7], [30, -12, 9, 12], [-48, 12, 10, 8]]) {
      for (const k of [0, R * 4]) { ctx.beginPath(); ctx.ellipse(x + cx + off - k, y + cy, rx, ry, 0.4, 0, Math.PI * 2); ctx.fill(); }
    }
    ctx.restore();
    label(ctx, 'الأرض', x, y + R + fs(14), fs(14), '#cfe8ff');
  }

  function drawRocket(x, y, ang, scale, time, color) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(scale, scale);
    const f = 14 + Math.sin(time * 40) * 4;
    const fg = ctx.createLinearGradient(-10, 0, -10 - f, 0);
    fg.addColorStop(0, '#fff6b0'); fg.addColorStop(0.5, '#ff9d1c'); fg.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(-10, -6); ctx.lineTo(-10 - f, 0); ctx.lineTo(-10, 6); ctx.fill();
    ctx.fillStyle = '#f4f7ff';
    ctx.beginPath(); ctx.moveTo(18, 0); ctx.quadraticCurveTo(8, -9, -10, -7); ctx.lineTo(-10, 7); ctx.quadraticCurveTo(8, 9, 18, 0); ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.moveTo(-4, -7); ctx.lineTo(-14, -14); ctx.lineTo(-10, -4); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-4, 7); ctx.lineTo(-14, 14); ctx.lineTo(-10, 4); ctx.fill();
    ctx.fillStyle = '#4fb6ff'; ctx.beginPath(); ctx.arc(5, 0, 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawTrail(points, color, width, alpha, dash) {
    if (points.length < 2) return;
    ctx.save();
    ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); ctx.moveTo(points[0][0], -points[0][1]);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], -points[i][1]);
    ctx.stroke();
    ctx.restore();
  }

  let previewCache = { key: '', pts: null, tOrb: null };
  function preview() {
    const key = `${S.aim.toFixed(1)}|${S.power}|${S.target.planet.id}|${guideLevel()}`;
    if (previewCache.key !== key) {
      const pow = P.POWERS[S.power];
      const tOrb = P.timeToOrbit(S.aim, pow, S.target.planet.orbit);
      const g = guideLevel();
      const len = g >= 1 ? (tOrb ?? 2.5) + 0.12 : g > 0 ? (tOrb ?? 2.5) * g : 0.22;
      previewCache = { key, pts: P.predictPath(S.aim, pow, len), tOrb };
    }
    return previewCache;
  }

  function drawAim(time) {
    const pv = preview();
    const g = guideLevel();
    const color = currentColor();
    ctx.save();
    ctx.setLineDash([fs(3), fs(7)]); ctx.lineDashOffset = -time * 60;
    ctx.strokeStyle = color; ctx.lineWidth = fs(3.2); ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(pv.pts[0][0], -pv.pts[0][1]);
    for (let i = 1; i < pv.pts.length; i++) ctx.lineTo(pv.pts[i][0], -pv.pts[i][1]);
    ctx.stroke();
    ctx.restore();
    const end = pv.pts[pv.pts.length - 1];
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(end[0], -end[1], fs(5), 0, Math.PI * 2); ctx.fill();

    // في المستوى السهل: «شبح» الكوكب حيث سيكون لحظة وصول الصاروخ إلى مداره
    if (g >= 1 && pv.tOrb) {
      const pl = S.target.planet;
      const fut = P.planetPos(pl.orbit, S.target.theta0, S.time + pv.tOrb);
      ctx.save();
      ctx.setLineDash([fs(5), fs(5)]); ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = fs(2);
      ctx.beginPath(); ctx.arc(fut.x, -fut.y, pl.radius, 0, Math.PI * 2); ctx.stroke();
      ctx.restore();
      label(ctx, 'سيكون هنا', fut.x, -fut.y - pl.radius - fs(12), fs(12), 'rgba(255,255,255,.85)');
    }

    // الصاروخ على المنصة يدور مع التصويب
    const a = (S.aim * Math.PI) / 180;
    drawRocket(Math.cos(a) * 40, W.earthOrbit - Math.sin(a) * 40, -a, 1.6, time, color);
  }

  function drawScene(time) {
    drawBackground(time);
    const tgt = S.target ? S.target.planet : null;

    drawOrbit(W.earthOrbit, 'rgba(120,190,255,.3)', fs(1.4), [fs(4), fs(8)]);
    for (const pl of P.PLANETS) {
      const isT = pl === tgt;
      drawOrbit(pl.orbit, isT ? 'rgba(181,239,106,.55)' : 'rgba(255,255,255,.1)', isT ? fs(2.2) : fs(1.2), isT ? null : [fs(3), fs(9)]);
    }
    // حزام الكويكبات
    ctx.fillStyle = 'rgba(200,190,170,.45)';
    for (let i = 0; i < 120; i++) {
      const r = 368 + ((i * 37) % 26);
      const a = i * 2.39996 + time * 0.03;
      ctx.beginPath(); ctx.arc(r * Math.cos(a), -r * Math.sin(a), 1 + (i % 3) * 0.6, 0, Math.PI * 2); ctx.fill();
    }
    drawSun(ctx, time);

    // الكواكب غير المستهدفة تدور بسرعاتها الحقيقية (قانون كبلر) بشكل باهت
    for (const pl of P.PLANETS) {
      if (pl === tgt) continue;
      const pos = P.planetPos(pl.orbit, pl.orbit * 0.01, S.time);
      ctx.globalAlpha = tgt ? 0.3 : 0.9;
      drawPlanet(ctx, pl, pos.x, -pos.y, pl.radius, Math.atan2(-pos.y, pos.x));
      ctx.globalAlpha = 1;
    }

    drawEarth(time);

    for (const gh of S.ghosts) drawTrail(gh.pts, gh.color, fs(2), 0.35);

    if (tgt) {
      const t = S.phase === 'flight' && S.rocket ? S.target.launchTime + S.rocket.t : S.time;
      const pos = P.planetPos(tgt.orbit, S.target.theta0, t);
      const k = 0.5 + 0.5 * Math.sin(time * 5);
      ctx.strokeStyle = `rgba(181,239,106,${0.4 + 0.5 * k})`; ctx.lineWidth = fs(2.5);
      ctx.beginPath(); ctx.arc(pos.x, -pos.y, tgt.radius + 12 + k * 6, 0, Math.PI * 2); ctx.stroke();
      drawPlanet(ctx, tgt, pos.x, -pos.y, tgt.radius, Math.atan2(-pos.y, pos.x));
      // صواريخ هبطت وبقيت على الكوكب
      for (const m of S.landed) {
        const a = pos.a + m.off;
        const mx = pos.x + Math.cos(a) * (tgt.radius + 6); const my = pos.y + Math.sin(a) * (tgt.radius + 6);
        drawRocket(mx, -my, -a + Math.PI, 0.9, time, m.color);
      }
      label(ctx, `🎯 ${tgt.name}`, pos.x, -pos.y - tgt.radius - (tgt.rings ? fs(26) : fs(20)), fs(17), '#eaffc8');

      if (S.phase === 'aim' && !S.paused) drawAim(time);
    }

    if (S.rocket) {
      const r = S.rocket;
      drawTrail(r.trail.concat([[r.x, r.y]]), currentColor(), fs(3), 0.9);
      if (!r.done) {
        const ang = Math.atan2(-r.vy, r.vx);
        drawRocket(r.x, -r.y, ang, 1.6, time, currentColor());
      }
    }
    drawFx();
  }

  // ------------------------------------------------------------------
  // المؤثرات
  // ------------------------------------------------------------------
  function burst(x, y, color, n = 60) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2; const v = 60 + Math.random() * 260;
      fx.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, color, r: 2 + Math.random() * 4 });
    }
  }
  let fxLast = performance.now();
  function drawFx() {
    const now = performance.now();
    const dt = Math.min(0.05, (now - fxLast) / 1000);
    fxLast = now;
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.life -= dt * 0.9;
      if (f.life <= 0) { fx.splice(i, 1); continue; }
      f.x += f.vx * dt; f.y += f.vy * dt; f.vx *= 0.95; f.vy *= 0.95;
      ctx.globalAlpha = f.life; ctx.fillStyle = f.color;
      ctx.beginPath(); ctx.arc(f.x, -f.y, f.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ------------------------------------------------------------------
  // الحلقة الرئيسية
  // ------------------------------------------------------------------
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!S.paused) {
      S.time += dt * TIME_SCALE;
      if (S.phase === 'flight' && S.rocket && !S.rocket.done) {
        const need = S.time - S.target.launchTime - S.rocket.t;
        if (need > 0) P.stepRocket(S.rocket, need, { ...S.target.planet, theta0: S.target.theta0, launchTime: S.target.launchTime });
        if (S.rocket.done) onRocketDone();
      }
    }
    drawScene(now / 1000);
    requestAnimationFrame(loop);
  }

  // ------------------------------------------------------------------
  // الإطلاق والنتائج
  // ------------------------------------------------------------------
  function launch() {
    if (S.phase !== 'aim' || S.paused || !S.target) return;
    S.rocket = P.createRocket(S.aim, P.POWERS[S.power]);
    S.target.launchTime = S.time;
    S.phase = 'flight';
    sfx.launch();
    updateHud();
  }

  function onRocketDone() {
    const r = S.rocket;
    const pl = S.target.planet;
    S.phase = 'wait';
    const color = currentColor();
    if (r.outcome === 'landed') {
      const pos = P.planetPos(pl.orbit, S.target.theta0, S.target.launchTime + r.t);
      S.landed.push({ off: r.landAngle, color });
      burst(pos.x, pos.y, '#b5ef6a', 90); burst(pos.x, pos.y, '#ffd23f', 40);
      sfx.land();
    } else if (r.outcome === 'burned') {
      burst(r.x, r.y, '#ff9d1c', 50); sfx.burn();
    } else if (r.outcome === 'flyby') {
      burst(r.x, r.y, '#ffffff', 25); sfx.flyby();
    } else {
      sfx.lost();
    }
    S.ghosts.push({ pts: r.trail.slice(), color });
    if (S.ghosts.length > 4) S.ghosts.shift();
    setTimeout(() => (S.mode === 'single' ? resolveSingle(r) : resolveDuo(r)), 1100);
  }

  // ---------------- لاعب واحد ----------------
  function resolveSingle(r) {
    const lvl = S.single.level;
    const pl = S.target.planet;
    if (r.outcome === 'landed') {
      const stars = P.starsFor(S.single.attempt);
      store.stars[lvl] = Math.max(store.stars[lvl] || 0, stars);
      save();
      notify('level-complete', { level: lvl + 1, stars, totalStars: totalStars() });
      sfx.win();
      showResult({
        stars,
        title: `هبطت على ${pl.name}! 🎉`,
        text: S.single.attempt === 1 ? 'من أول محاولة! أنت رائد فضاء حقيقي.' : `نجحت في المحاولة رقم ${S.single.attempt}.`,
        fact: lessonFor(r),
        actions: lvl + 1 < P.LEVELS.length
          ? [['▶ المرحلة التالية', 'primary', () => startLevel(lvl + 1)], ['↻ أعد المحاولة', 'ghost', () => startLevel(lvl)], ['المراحل', 'ghost', showLevels]]
          : [['🏆 أنهيت كل الرحلات!', 'primary', showLevels], ['↻ أعد المحاولة', 'ghost', () => startLevel(lvl)]],
      });
      if (lvl + 1 === P.LEVELS.length) notify('all-levels-complete', { totalStars: totalStars() });
      return;
    }
    S.single.attempt += 1;
    if (S.single.attempt > ROCKETS_PER_LEVEL) {
      notify('level-failed', { level: lvl + 1 });
      showResult({
        stars: 0,
        title: 'نفدت الصواريخ 🚀',
        text: P.adviceFor(r, pl.name),
        fact: 'تذكّر: الكوكب يتحرك أثناء رحلتك! صوّب إلى حيث سيكون الكوكب، لا حيث هو الآن.',
        actions: [['↻ حاول مرة أخرى', 'primary', () => startLevel(lvl)], ['المراحل', 'ghost', showLevels]],
      });
      return;
    }
    toast(r.outcome === 'flyby' ? `اقتربت جداً! ✨ ${P.adviceFor(r, pl.name)}` : P.adviceFor(r, pl.name), r.outcome === 'flyby' ? 'warn' : 'bad', 4200);
    S.rocket = null;
    S.phase = 'aim';
    updateHud();
  }

  function lessonFor(r) {
    const pl = S.target.planet;
    const bent = Math.abs(S.aim - 90) < 40;
    return bent
      ? `لاحظ كيف انحنى مسار صاروخك حول الشمس — هذه هي الجاذبية! واستخدمها العلماء لتسريع المركبات (مقلاع الجاذبية).`
      : `أطلقت صاروخك نحو المكان الذي سيكون فيه ${pl.name}، تماماً كما يحسب العلماء «نافذة الإطلاق» للرحلات الحقيقية.`;
  }

  function totalStars() {
    return store.stars.reduce((a, b) => a + (b || 0), 0);
  }

  function startLevel(i) {
    S.mode = 'single';
    S.duo = null;
    S.single = { level: i, attempt: 1 };
    const lv = P.LEVELS[i];
    newTarget(lv.planet);
    S.phase = 'idle';
    const pl = S.target.planet;
    showIntro({
      planet: pl,
      sub: `المرحلة ${i + 1} من ${P.LEVELS.length} • ${lv.title}`,
      title: `الهدف: ${pl.name}`,
      fact: pl.facts[Math.floor(Math.random() * pl.facts.length)],
      goal: `لديك ${ROCKETS_PER_LEVEL} صواريخ. ${lv.guide >= 1 ? 'المسار المتوقّع و«شبح» الكوكب سيساعدانك.' : lv.guide > 0 ? 'ستظهر بداية المسار فقط — توقّع الباقي!' : 'بلا مساعدة: اعتمد على ما تعلّمته!'}`,
      onGo: () => { S.phase = 'aim'; updateHud(); },
    });
  }

  // ---------------- لاعبان ----------------
  function startDuo(names, rounds, guide) {
    S.mode = 'duo';
    S.duo = {
      players: names.map((n, i) => ({ name: n || `رائد ${i + 1}`, score: 0, landings: 0 })),
      rounds, guide, round: 1, turn: 0, order: shuffle(P.PLANETS.map((p) => p.id)),
    };
    notify('duo-start', { rounds });
    beginDuoRound();
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  function beginDuoRound() {
    const d = S.duo;
    newTarget(d.order[(d.round - 1) % d.order.length]);
    d.turn = (d.round - 1) % 2; // يتناوب من يبدأ كل جولة
    S.phase = 'aim';
    hideScreens();
    S.paused = false;
    updateHud();
    turnBanner(`الجولة ${d.round}: ${S.target.planet.name} — دور ${d.players[d.turn].name}`);
  }

  function resolveDuo(r) {
    const d = S.duo;
    const p = d.players[d.turn];
    const pts = P.pointsFor(r.outcome);
    p.score += pts;
    if (r.outcome === 'landed') p.landings += 1;
    const msg = r.outcome === 'landed' ? `🎉 ${p.name} هبط! +3`
      : r.outcome === 'flyby' ? `✨ ${p.name} مرّ قريباً +1`
        : r.outcome === 'burned' ? `🔥 صاروخ ${p.name} احترق في الشمس` : `🌌 صاروخ ${p.name} ضاع في الفضاء`;
    toast(msg, pts ? 'good' : 'bad', 2200);

    const startedBy = (d.round - 1) % 2;
    const roundOver = d.turn !== startedBy;
    S.rocket = null;
    if (!roundOver) {
      d.turn = 1 - d.turn;
      S.phase = 'aim';
      updateHud();
      setTimeout(() => turnBanner(`دور ${d.players[d.turn].name}`), 700);
      return;
    }
    if (d.round >= d.rounds) { finishDuo(); return; }
    d.round += 1;
    setTimeout(beginDuoRound, 900);
  }

  function finishDuo() {
    const [a, b] = S.duo.players;
    const winner = a.score === b.score ? null : a.score > b.score ? 0 : 1;
    notify('duo-finished', { scores: [a.score, b.score], winner: winner === null ? null : S.duo.players[winner].name });
    sfx.win();
    const board = el('div', 'scoreboard');
    S.duo.players.forEach((p, i) => {
      const c = el('div', `p${i + 1} ${winner === i ? 'win' : ''}`);
      c.append(el('span', '', p.name), el('b', '', String(p.score)), el('small', 'muted', `${p.landings} هبوط`));
      board.append(c);
    });
    showResult({
      stars: null,
      title: winner === null ? 'تعادل! 🤝' : `🏆 فاز ${S.duo.players[winner].name}!`,
      text: winner === null ? 'كلاكما رائد فضاء ماهر.' : 'أحسنتما! من يطلب جولة ثأر؟',
      fact: 'في الرحلات الحقيقية، يحسب العلماء مسار المركبة وحركة الكوكب معاً قبل الإطلاق بأشهر!',
      extra: board,
      actions: [['↻ تحدٍّ جديد', 'primary', () => startDuo(S.duo.players.map((p) => p.name), S.duo.rounds, S.duo.guide)], ['🏠 القائمة', 'ghost', () => showScreen('menu')]],
    });
  }

  // ------------------------------------------------------------------
  // الواجهة
  // ------------------------------------------------------------------
  const SCREENS = { menu: 'scrMenu', levels: 'scrLevels', duo: 'scrDuo', intro: 'scrIntro', result: 'scrResult', help: 'scrHelp', pause: 'scrPause' };
  let current = 'menu';
  let beforeHelp = 'menu';

  function hideScreens() {
    for (const id of Object.values(SCREENS)) $(id).classList.add('hidden');
    current = null;
    updateControls();
  }
  function showScreen(name) {
    for (const [k, id] of Object.entries(SCREENS)) $(id).classList.toggle('hidden', k !== name);
    current = name;
    if (name === 'menu') { S.mode = null; S.target = null; S.rocket = null; S.phase = 'idle'; S.paused = false; updateHud(); }
    S.paused = name === 'pause';
    updateControls();
  }

  function planetThumb(pl, size = 130) {
    const c = document.createElement('canvas');
    const d = Math.min(window.devicePixelRatio || 1, 2);
    c.width = size * d; c.height = size * d; c.style.width = `${size}px`; c.style.height = `${size}px`;
    const g = c.getContext('2d');
    g.scale(d, d);
    const R = size * (pl.rings ? 0.24 : 0.3);
    drawPlanet(g, pl, size / 2, size / 2, R, 0.6);
    return c;
  }

  function showIntro({ planet, sub, title, fact, goal, onGo }) {
    $('introArt').replaceChildren(planetThumb(planet));
    $('introSub').textContent = sub;
    $('introTitle').textContent = title;
    $('introFact').textContent = fact;
    $('introGoal').textContent = goal;
    $('btnIntroGo').onclick = () => { sfx.click(); hideScreens(); onGo(); };
    showScreen('intro');
  }

  function showResult({ stars, title, text, fact, actions, extra }) {
    const st = $('resStars');
    st.textContent = '';
    if (stars !== null && stars !== undefined) {
      for (let i = 0; i < 3; i++) st.append(el('span', i < stars ? '' : 'off', '⭐'));
    }
    st.classList.toggle('hidden', stars === null);
    $('resTitle').textContent = title;
    $('resText').textContent = text;
    for (const old of document.querySelectorAll('#scrResult .scoreboard')) old.remove();
    if (extra) $('resText').after(extra);
    $('resFact').textContent = fact || '';
    $('resFactBox').classList.toggle('hidden', !fact);
    const box = $('resActions');
    box.textContent = '';
    for (const [labelText, cls, fn] of actions) {
      const b = el('button', `btn ${cls}`, labelText);
      b.onclick = () => { sfx.click(); fn(); };
      box.append(b);
    }
    showScreen('result');
  }

  function showLevels() {
    const box = $('levels');
    box.textContent = '';
    P.LEVELS.forEach((lv, i) => {
      const pl = P.planetById(lv.planet);
      const unlocked = i === 0 || (store.stars[i - 1] || 0) > 0;
      const b = el('button', 'level');
      b.disabled = !unlocked;
      const got = store.stars[i] || 0;
      const st = el('span', 'st', '⭐'.repeat(got) + '☆'.repeat(3 - got));
      const th = planetThumb(pl, 52); th.classList.add('pl');
      b.append(el('span', 'num', String(i + 1)), th, el('b', '', lv.title), el('small', '', `${pl.name} • ${lv.guide >= 1 ? 'سهل' : lv.guide > 0 ? 'متوسط' : 'صعب'}`), st);
      if (!unlocked) b.append(el('span', 'lock', '🔒'));
      b.onclick = () => { sfx.click(); startLevel(i); };
      box.append(b);
    });
    showScreen('levels');
  }

  function updateHud() {
    const info = $('hudInfo');
    const stats = $('hudStats');
    info.textContent = '';
    stats.textContent = '';
    $('btnLaunch').classList.toggle('p2', S.mode === 'duo' && S.duo.turn === 1);
    if (S.mode === 'single') {
      const lv = P.LEVELS[S.single.level];
      info.append(el('span', 'lvl', `المرحلة ${S.single.level + 1}`), document.createTextNode(` • ${lv.title} • الهدف: ${S.target.planet.name}`));
      const rk = el('span', 'pill rockets');
      for (let i = 1; i <= ROCKETS_PER_LEVEL; i++) rk.append(el('span', i < S.single.attempt ? 'used' : '', '🚀'));
      stats.append(rk, el('span', 'pill', `⭐ ${totalStars()}`));
    } else if (S.mode === 'duo') {
      const d = S.duo;
      info.append(el('span', 'lvl', `الجولة ${d.round}/${d.rounds}`), document.createTextNode(` • الهدف: ${S.target.planet.name}`));
      d.players.forEach((p, i) => stats.append(el('span', `pill p${i + 1} ${d.turn === i ? 'turn' : ''}`, `${p.name}: ${p.score}`)));
    }
    updateControls();
  }

  function updateControls() {
    const locked = S.phase !== 'aim' || current !== null || S.paused;
    $('controls').classList.toggle('locked', locked);
    $('angleVal').textContent = `${Math.round(S.aim)}°`;
    for (const b of $('power').children) {
      const on = Number(b.dataset.i) === S.power;
      b.classList.toggle('on', on);
      b.setAttribute('aria-checked', String(on));
    }
  }

  let toastTimer = null;
  function toast(text, kind = '', ms = 2600) {
    const t = $('toast');
    t.textContent = text;
    t.className = `toast show ${kind}`;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = `toast ${kind}`; }, ms);
  }

  function turnBanner(text) {
    const b = $('turnBanner');
    b.textContent = text;
    b.className = `turn-banner ${S.mode === 'duo' && S.duo.turn === 1 ? 'p2' : ''}`;
    void b.offsetWidth;
    b.classList.remove('hidden');
    clearTimeout(b._t);
    b._t = setTimeout(() => b.classList.add('hidden'), 1700);
  }

  // ------------------------------------------------------------------
  // التحكم
  // ------------------------------------------------------------------
  function setAim(deg) {
    S.aim = P.clampAngle(deg);
    updateControls();
  }
  function setPower(i) {
    S.power = Math.max(0, Math.min(P.POWERS.length - 1, i));
    updateControls();
  }

  // أزرار القوة
  P.POWERS.forEach((_, i) => {
    const b = el('button', '', String(i + 1));
    b.dataset.i = String(i);
    b.style.height = `${18 + i * 6}px`;
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-label', `القوة ${i + 1}`);
    b.onclick = () => { sfx.click(); setPower(i); };
    $('power').append(b);
  });

  // التصويب بالسحب على المشهد
  let dragging = false;
  function aimAt(e) {
    if (S.phase !== 'aim' || current !== null || S.paused) return;
    const rect = cv.getBoundingClientRect();
    const w = toWorld(e.clientX - rect.left, e.clientY - rect.top);
    const deg = (Math.atan2(w.y + W.earthOrbit, w.x) * 180) / Math.PI;
    if (deg < -90) setAim(W.maxAngle); else if (deg < 0) setAim(W.minAngle); else setAim(deg);
  }
  cv.addEventListener('pointerdown', (e) => { dragging = true; cv.setPointerCapture(e.pointerId); aimAt(e); });
  cv.addEventListener('pointermove', (e) => { if (dragging) aimAt(e); });
  cv.addEventListener('pointerup', () => { dragging = false; });
  cv.addEventListener('pointercancel', () => { dragging = false; });

  // أزرار التدوير (مع الضغط المستمر)
  function holdButton(btn, fn) {
    let t = null;
    const stop = () => { clearInterval(t); t = null; };
    btn.addEventListener('pointerdown', (e) => { e.preventDefault(); fn(); stop(); t = setInterval(fn, 70); });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, stop);
  }
  holdButton($('angLeft'), () => setAim(S.aim + 1));
  holdButton($('angRight'), () => setAim(S.aim - 1));

  $('btnLaunch').onclick = launch;

  window.addEventListener('keydown', (e) => {
    if (e.target && e.target.tagName === 'INPUT') return;
    if (e.key === 'Escape') { togglePause(); return; }
    if (S.phase !== 'aim' || current !== null) return;
    const step = e.shiftKey ? 5 : 1;
    if (e.key === 'ArrowLeft') { setAim(S.aim + step); e.preventDefault(); }
    else if (e.key === 'ArrowRight') { setAim(S.aim - step); e.preventDefault(); }
    else if (e.key === 'ArrowUp') { setPower(S.power + 1); e.preventDefault(); }
    else if (e.key === 'ArrowDown') { setPower(S.power - 1); e.preventDefault(); }
    else if (e.key === ' ' || e.key === 'Enter') { launch(); e.preventDefault(); }
  });

  function togglePause() {
    if (!S.mode) return;
    if (current === 'pause') { hideScreens(); S.paused = false; updateControls(); }
    else if (current === null) showScreen('pause');
  }

  // أزرار الشاشات
  $('btnMenu').onclick = () => { sfx.click(); if (S.mode && current === null) togglePause(); else showScreen('menu'); };
  $('btnResume').onclick = () => { sfx.click(); togglePause(); };
  $('btnSingle').onclick = () => { sfx.click(); showLevels(); };
  $('btnDuo').onclick = () => { sfx.click(); showScreen('duo'); };
  $('btnHelp').onclick = () => { sfx.click(); beforeHelp = 'menu'; showScreen('help'); };
  $('btnPauseHelp').onclick = () => { sfx.click(); beforeHelp = 'pause'; showScreen('help'); };
  for (const b of document.querySelectorAll('[data-go]')) {
    b.addEventListener('click', () => {
      sfx.click();
      const to = b.dataset.go === 'back' ? beforeHelp : b.dataset.go;
      showScreen(to);
    });
  }
  for (const segId of ['segRounds', 'segGuide']) {
    const seg = $(segId);
    seg.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      for (const x of seg.children) x.classList.toggle('on', x === b);
    });
  }
  $('btnDuoStart').onclick = () => {
    sfx.click();
    const rounds = Number($('segRounds').querySelector('.on').dataset.v);
    const guide = Number($('segGuide').querySelector('.on').dataset.v);
    startDuo([$('name1').value.trim(), $('name2').value.trim()], rounds, guide);
  };

  function renderSoundBtn() {
    $('btnSound').textContent = store.sound ? '🔊' : '🔇';
  }
  $('btnSound').onclick = () => { store.sound = !store.sound; save(); renderSoundBtn(); sfx.click(); };

  // ------------------------------------------------------------------
  // البدء
  // ------------------------------------------------------------------
  renderSoundBtn();
  resize();
  showScreen('menu');
  updateHud();
  requestAnimationFrame(loop);
  // الخط قد يصل بعد أول رسم — نعيد ضبط الأحجام بعد تحميله
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(resize);
  notify('ready');

  // للاختبار الآلي فقط
  window.__planetRace = { S, launch, startLevel, startDuo, setAim, setPower };
})();
