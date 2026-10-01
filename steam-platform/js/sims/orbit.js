/* 3) محاكاة الجاذبية ومدارات الكواكب — تكامل Velocity-Verlet */
(function () {
  'use strict';
  const { clamp, fmt } = STEAM.util;
  const WORLD = 520; // وحدات العالم المرئية على البعد الأصغر للشاشة
  const GK = 400000; // ثابت جذب مُخفّف بصرياً (G * وحدة الكتلة)
  const SUN_R = 20;
  const DT = 1 / 240;
  const COLORS = ['#b5176f', '#4a90d9', '#1f9d6b', '#d98a00', '#7b2d8e'];

  STEAM.sims.orbit = {
    controls: (level) => [
      { id: 'mass', type: 'range', label: '☀️ كتلة النجم المركزي', min: 1, max: 10, step: 0.5, value: 5, decimals: 1, presets: [2, 5, 9], presetLabels: ['خفيف', 'متوسط', 'ثقيل'] },
      { id: 'speed', type: 'range', label: '🚀 سرعة الإطلاق', min: 0, max: 300, step: 5, value: 110, unit: 'وحدة/ث', hidden: level === 'simple' },
      { id: 'angle', type: 'range', label: '🧭 زاوية الإطلاق', min: 0, max: 360, step: 5, value: 90, unit: '°', hidden: level === 'simple', hint: '90° = عمودي على الخط الواصل بالنجم' },
      { id: 'vectors', type: 'toggle', label: '➡️ متّجهات السرعة والقوة', value: level === 'advanced', on: 'إظهار', off: 'إخفاء', hidden: level === 'simple' },
      { id: 'trails', type: 'toggle', label: '〰️ رسم المسارات', value: true, on: 'نعم', off: 'لا' },
    ],
    actions: (level) => [
      { id: 'launch', label: '🚀 أطلق من نقطة البداية', primary: true, hidden: level === 'simple' },
      { id: 'clear', label: '🧹 مسح الكواكب' },
    ],
    chartTitle: (level) => (level === 'advanced' ? 'بُعد الكوكب الأخير عن النجم مع الزمن' : null),
    help: () => 'اسحب من أي مكان ثم أفلت لإطلاق كوكب',

    create(host) {
      const P = host.params;
      let s;
      function reset() { s = { planets: [], drag: null, t: 0, ch: null, nextColor: 0, hist: [] }; }
      reset();

      // تحويل الإحداثيات
      const scale = () => Math.min(host.stage.w, host.stage.h) / WORLD;
      const toWorld = (p) => ({ x: (p.x - host.stage.w / 2) / scale(), y: (p.y - host.stage.h / 2) / scale() });
      const toScreen = (x, y) => ({ x: host.stage.w / 2 + x * scale(), y: host.stage.h / 2 + y * scale() });
      const gm = () => GK * P.mass;
      const accel = (x, y) => { const r2 = x * x + y * y, r = Math.sqrt(r2), a = -gm() / (r2 * r); return [a * x, a * y]; };
      const vCirc = (r) => Math.sqrt(gm() / r);

      function launch(x, y, vx, vy) {
        const [ax, ay] = accel(x, y);
        const p = { x, y, vx, vy, ax, ay, trail: [], age: 0, state: 'orbit', color: COLORS[s.nextColor++ % COLORS.length], rmin: Infinity, rmax: 0, tracked: !!s.ch && !s.ch.planet };
        s.planets.push(p);
        if (s.planets.length > 6) s.planets.shift();
        if (p.tracked) { s.ch.planet = p; s.ch.t = 0; }
        s.hist = [];
        s.last = p;
        host.sound.tone(300, 0.25, 'triangle', 0.06, 500);
      }

      function stability(p) {
        if (!isFinite(p.rmin) || p.rmax === 0) return 0;
        return clamp(1 - (p.rmax - p.rmin) / (p.rmax + p.rmin), 0, 1);
      }

      return {
        reset,
        settings: () => ({ planets: s.planets.length }),
        startChallenge() {
          s.ch = { planet: null, t: 0 };
          host.setChallenge('أطلق كوكباً الآن! سيتم قياس ثبات مداره لمدة 10 ثوانٍ.', 0);
        },
        onAction(id) {
          if (id === 'clear') { s.planets = []; s.last = null; return; }
          if (id === 'launch') {
            const r0 = 170, a = (P.angle * Math.PI) / 180;
            // نقطة البداية على يمين النجم؛ الزاوية تقاس من الاتجاه نحو الخارج
            const dir = { x: Math.cos(-a), y: Math.sin(-a) };
            launch(r0, 0, dir.x * P.speed, dir.y * P.speed);
          }
        },
        pointerDown(p) { s.drag = { a: p, b: p }; },
        pointerMove(p, down) { if (s.drag && down) s.drag.b = p; },
        pointerUp(p) {
          if (!s.drag) return;
          const d = s.drag; s.drag = null;
          const w = toWorld(d.a);
          const r = Math.hypot(w.x, w.y);
          if (r < SUN_R + 6) { host.toast('ابدأ السحب بعيداً عن النجم'); return; }
          const k = 1.2 / scale();
          launch(w.x, w.y, (d.b.x - d.a.x) * k, (d.b.y - d.a.y) * k);
        },
        hud() {
          const out = [['الكواكب', fmt(s.planets.filter((p) => p.state === 'orbit').length)]];
          const p = s.last;
          if (p && host.level !== 'simple') {
            const r = Math.hypot(p.x, p.y), v = Math.hypot(p.vx, p.vy);
            out.push(['سرعة الكوكب', fmt(v) + ' و/ث']);
            if (host.level === 'advanced') {
              out.push(['السرعة المدارية هنا', fmt(vCirc(r))]);
              out.push(['سرعة الإفلات هنا', fmt(vCirc(r) * Math.SQRT2)]);
            }
            out.push(['ثبات المدار', fmt(stability(p) * 100) + '%']);
          }
          if (host.level !== 'simple' && !s.planets.length) out.push(['السرعة المدارية عند البداية', fmt(vCirc(170))]);
          return out;
        },
        step(dt) {
          s.t += dt;
          const sub = Math.max(1, Math.round(dt / DT));
          const h = dt / sub;
          for (const p of s.planets) {
            if (p.state !== 'orbit') { p.age += dt; continue; }
            for (let i = 0; i < sub; i++) {
              p.x += p.vx * h + 0.5 * p.ax * h * h;
              p.y += p.vy * h + 0.5 * p.ay * h * h;
              const [nx, ny] = accel(p.x, p.y);
              p.vx += 0.5 * (p.ax + nx) * h; p.vy += 0.5 * (p.ay + ny) * h;
              p.ax = nx; p.ay = ny;
              const r = Math.hypot(p.x, p.y);
              if (r < SUN_R) { p.state = 'crash'; host.sound.noise(0.4, 0.06, 300); break; }
              if (r > WORLD * 1.4) { p.state = 'escape'; break; }
            }
            p.age += dt;
            const r = Math.hypot(p.x, p.y);
            if (p.age > 0.3) { p.rmin = Math.min(p.rmin, r); p.rmax = Math.max(p.rmax, r); }
            p.trail.push([p.x, p.y]);
            if (p.trail.length > 600) p.trail.shift();
          }
          if (s.last && s.last.state === 'orbit') {
            s.hist.push([s.last.age, Math.hypot(s.last.x, s.last.y)]);
            if (s.hist.length > 900) s.hist.shift();
          }
          s.planets = s.planets.filter((p) => p.state === 'orbit' || p.age < 30);

          // تقييم التحدّي
          if (s.ch && s.ch.planet) {
            const p = s.ch.planet;
            if (p.state === 'crash') { s.ch = null; host.challengeResult(false, 'سقط الكوكب على النجم — زد السرعة'); return; }
            if (p.state === 'escape') { s.ch = null; host.challengeResult(false, 'هرب الكوكب — قلّل السرعة'); return; }
            s.ch.t += dt;
            const st = stability(p);
            host.setChallenge(`الزمن: ${fmt(s.ch.t, 1)} / 10 ث — الثبات: ${fmt(st * 100)}%`, s.ch.t / 10);
            if (s.ch.t >= 10) {
              s.ch = null;
              if (st >= 0.6) host.challengeResult(true, `ثبات ${fmt(st * 100)}%`);
              else host.challengeResult(false, `المدار متطاول جداً (ثبات ${fmt(st * 100)}%) — حاول الإطلاق عمودياً بسرعة قريبة من السرعة المدارية`);
            }
          }
        },
        draw(c, w, h) {
          const sc = scale();
          const cx = w / 2, cy = h / 2;
          // شبكة «القماش المطاطي» المنحنية
          const depth = P.mass * 9;
          const warp = (x, y) => {
            const dx = x - cx, dy = y - cy, r = Math.hypot(dx, dy) + 1;
            const pull = (depth * 60 * sc) / (r + 40 * sc);
            const k = Math.min(pull, r * 0.85) / r;
            return [x - dx * k, y - dy * k + pull * 0.35];
          };
          c.strokeStyle = 'rgba(123,45,142,.16)'; c.lineWidth = 1;
          const step = 28;
          for (let gx = -step; gx <= w + step; gx += step) {
            c.beginPath();
            for (let gy = -step; gy <= h + step; gy += 8) { const [x, y] = warp(gx, gy); gy === -step ? c.moveTo(x, y) : c.lineTo(x, y); }
            c.stroke();
          }
          for (let gy = -step; gy <= h + step; gy += step) {
            c.beginPath();
            for (let gx = -step; gx <= w + step; gx += 8) { const [x, y] = warp(gx, gy); gx === -step ? c.moveTo(x, y) : c.lineTo(x, y); }
            c.stroke();
          }

          // نقطة البداية + المدار الدائري المرجعي
          if (host.level !== 'simple') {
            const sp = toScreen(170, 0);
            c.strokeStyle = 'rgba(31,157,107,.35)'; c.setLineDash([6, 6]); c.lineWidth = 1.5;
            c.beginPath(); c.arc(cx, cy, 170 * sc, 0, Math.PI * 2); c.stroke(); c.setLineDash([]);
            c.fillStyle = '#1f9d6b'; c.beginPath(); c.arc(sp.x, sp.y, 5, 0, Math.PI * 2); c.fill();
            const a = (P.angle * Math.PI) / 180, L = clamp(P.speed * 0.35, 8, 120) * sc * 1.4;
            c.strokeStyle = '#1f9d6b'; c.lineWidth = 2; c.setLineDash([3, 3]);
            c.beginPath(); c.moveTo(sp.x, sp.y); c.lineTo(sp.x + Math.cos(-a) * L, sp.y + Math.sin(-a) * L); c.stroke(); c.setLineDash([]);
          }

          // النجم
          const sr = (SUN_R + P.mass * 1.6) * sc;
          const glow = c.createRadialGradient(cx, cy, 2, cx, cy, sr * 2.4);
          glow.addColorStop(0, 'rgba(255,214,90,1)'); glow.addColorStop(0.45, 'rgba(255,170,40,.75)'); glow.addColorStop(1, 'rgba(255,170,40,0)');
          c.fillStyle = glow; c.beginPath(); c.arc(cx, cy, sr * 2.4, 0, Math.PI * 2); c.fill();
          c.fillStyle = '#ffb627'; c.beginPath(); c.arc(cx, cy, sr, 0, Math.PI * 2); c.fill();

          // الكواكب
          for (const p of s.planets) {
            if (P.trails && p.trail.length > 1) {
              c.strokeStyle = STEAM.util.rgba(p.color, 0.55); c.lineWidth = 2; c.beginPath();
              p.trail.forEach(([x, y], i) => { const q = toScreen(x, y); i ? c.lineTo(q.x, q.y) : c.moveTo(q.x, q.y); });
              c.stroke();
            }
            const q = toScreen(p.x, p.y);
            if (p.state === 'crash') continue;
            c.fillStyle = p.color; c.beginPath(); c.arc(q.x, q.y, 8, 0, Math.PI * 2); c.fill();
            c.strokeStyle = '#fff'; c.lineWidth = 2; c.stroke();
            if (p.tracked && s.ch) { c.strokeStyle = STEAM.colors.purple; c.setLineDash([3, 3]); c.beginPath(); c.arc(q.x, q.y, 14, 0, Math.PI * 2); c.stroke(); c.setLineDash([]); }
            if (P.vectors && p.state === 'orbit') {
              arrow(c, q.x, q.y, q.x + p.vx * 0.35 * sc, q.y + p.vy * 0.35 * sc, '#1f9d6b');
              const am = Math.hypot(p.ax, p.ay), al = clamp(am * 0.12, 10, 80) * sc;
              arrow(c, q.x, q.y, q.x + (p.ax / am) * al, q.y + (p.ay / am) * al, '#c8334a');
            }
          }

          // سهم السحب
          if (s.drag) {
            const { a, b } = s.drag;
            const v = Math.hypot(b.x - a.x, b.y - a.y) * 1.2 / sc;
            const wpt = toWorld(a), r = Math.hypot(wpt.x, wpt.y);
            const vc = r > SUN_R ? vCirc(r) : 1;
            let col = '#1f9d6b', lab = 'مناسب';
            if (v < vc * 0.7) { col = '#d98a00'; lab = 'بطيء جداً'; }
            else if (v > vc * 1.3) { col = '#c8334a'; lab = 'سريع جداً'; }
            arrow(c, a.x, a.y, b.x, b.y, col);
            c.fillStyle = col; c.font = 'bold 14px Tajawal, sans-serif'; c.textAlign = 'center';
            c.fillText(host.level === 'simple' ? lab : `${lab} (${fmt(v)})`, b.x, b.y - 14);
          }

          // وسيلة الإيضاح للمتّجهات
          if (P.vectors) {
            c.font = 'bold 12px Tajawal, sans-serif'; c.textAlign = 'right';
            c.fillStyle = '#1f9d6b'; c.fillText('■ السرعة', w - 12, h - 30);
            c.fillStyle = '#c8334a'; c.fillText('■ قوة الجاذبية', w - 12, h - 12);
          }
        },
        drawChart(cv) {
          const d = s.hist;
          const t1 = d.length ? Math.max(10, d[d.length - 1][0]) : 10;
          const ymax = d.length ? Math.max(200, ...d.map((x) => x[1])) * 1.1 : 300;
          STEAM.chart.draw(cv, { xRange: [Math.max(0, t1 - 20), t1], yRange: [0, ymax], xLabel: 'الزمن (ث)', yLabel: 'البعد', series: [{ data: d, color: STEAM.colors.magenta, label: 'البعد عن النجم' }] });
        },
      };
    },
  };

  function arrow(c, x1, y1, x2, y2, color) {
    const a = Math.atan2(y2 - y1, x2 - x1), L = Math.hypot(x2 - x1, y2 - y1);
    if (L < 2) return;
    c.strokeStyle = color; c.fillStyle = color; c.lineWidth = 2.5;
    c.beginPath(); c.moveTo(x1, y1); c.lineTo(x2, y2); c.stroke();
    c.beginPath(); c.moveTo(x2, y2);
    c.lineTo(x2 - 10 * Math.cos(a - 0.4), y2 - 10 * Math.sin(a - 0.4));
    c.lineTo(x2 - 10 * Math.cos(a + 0.4), y2 - 10 * Math.sin(a + 0.4));
    c.closePath(); c.fill();
  }
  STEAM.drawArrow = arrow;
})();
