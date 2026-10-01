/* 5) محاكاة آلية التنفّس — نموذج الجرس الزجاجي (قانون بويل) */
(function () {
  'use strict';
  const { clamp, roundRect, fmt, rand } = STEAM.util;
  const P0 = 1013;          // الضغط الجوي hPa
  const VJAR = 2000;        // حجم الهواء حول الرئتين عند الراحة (mL)
  const VL0 = 1000;         // حجم الرئتين عند الراحة (mL)
  const A = 800;            // تغيّر حجم الحجرة عند سحب الحجاب لأقصى حد (mL)
  const E = 0.005;          // مرونة الرئتين hPa/mL
  const SAFE = 8;           // الحدّ الآمن لفرق الضغط hPa
  const SUB = 1 / 1000;
  const R0 = 0.003;         // مقاومة المجرى الهوائي hPa·s/mL

  STEAM.sims.lungs = {
    controls: (level) => [
      { id: 'auto', type: 'toggle', label: '🔁 تنفّس تلقائي', value: level === 'simple', on: 'تشغيل', off: 'يدوي', disabledInChallenge: true },
      { id: 'rate', type: 'range', label: '⏱️ معدّل التنفّس', min: 8, max: 40, step: 1, value: 15, unit: 'نَفَس/دقيقة', presets: [10, 15, 30], presetLabels: ['بطيء', 'عادي', 'سريع'] },
      { id: 'diaphragm', type: 'range', label: '⬇️ موضع الحجاب الحاجز (يدوي)', min: 0, max: 100, step: 1, value: 0, unit: '%', hidden: level === 'simple', hint: 'أو اسحب الغشاء المطاطي مباشرة في الرسم' },
      { id: 'resist', type: 'range', label: '🌬️ مقاومة المجرى الهوائي', min: 1, max: 4, step: 0.5, value: 1, decimals: 1, hidden: level !== 'advanced', hint: 'قيمة أعلى = مجرى ضيّق (مثل نوبة الربو)' },
    ],
    chartTitle: (level) => (level === 'simple' ? null : 'الضغط داخل الصدر وحجم الرئتين مع الزمن'),
    help: (level) => (level === 'simple' ? 'شاهد البالونين ينتفخان وينكمشان' : 'اسحب الغشاء السفلي للأسفل (شهيق) وللأعلى (زفير)'),

    create(host) {
      const P = host.params;
      let s;
      function reset() {
        s = { d: 0, dTarget: 0, vl: VL0, pc: P0, t: 0, phase: 0, hist: [], drag: false, ch: null, particles: [], flow: 0 };
        P.diaphragm = 0;
      }
      reset();

      function geom(w, h) {
        const jw = Math.min(260, w * 0.42), jh = Math.min(300, h * 0.62);
        const x = w * 0.42 - jw / 2, y = 60;
        return { x, y, w: jw, h: jh, bottom: y + jh, cx: x + jw / 2 };
      }

      return {
        reset,
        settings: () => ({ peakDP: s.ch ? s.ch.peak : null }),
        startChallenge() {
          P.auto = false; host.refreshControls();
          s.ch = { cycles: 0, state: 'low', peak: 0, cycleStart: null, t: 0, bad: 0 };
          host.setChallenge('اسحب الغشاء ببطء للأسفل ثم ادفعه للأعلى — 5 دورات.', 0);
        },
        onParam(id, v) { if (id === 'diaphragm') s.dTarget = v / 100; },
        pointerDown(p) {
          const g = geom(host.stage.w, host.stage.h);
          if (P.auto) { host.toast('أوقف التنفّس التلقائي لتتحكّم يدوياً'); return; }
          if (p.y > g.bottom - 40 && p.x > g.x - 20 && p.x < g.x + g.w + 20) s.drag = true;
        },
        pointerMove(p, down) {
          if (!s.drag || !down) return;
          const g = geom(host.stage.w, host.stage.h);
          s.dTarget = clamp((p.y - g.bottom) / 70, 0, 1);
          P.diaphragm = Math.round(s.dTarget * 100);
        },
        pointerUp() { s.drag = false; },
        hud() {
          const dp = s.pc - P0;
          const out = [['الحالة', s.flow > 30 ? 'شهيق 🌬️' : s.flow < -30 ? 'زفير 💨' : 'سكون']];
          if (host.level !== 'simple') {
            out.push(['فرق الضغط في الصدر', (dp >= 0 ? '+' : '') + fmt(dp, 1) + ' hPa']);
            out.push(['حجم الرئتين', fmt(s.vl) + ' mL']);
          }
          return out;
        },
        step(dt) {
          s.t += dt;
          if (P.auto) {
            s.phase += dt * (P.rate / 60) * Math.PI * 2;
            s.dTarget = 0.5 - 0.5 * Math.cos(s.phase);
          } else if (!s.drag) {
            s.dTarget = (P.diaphragm || 0) / 100;
          }
          // حركة الغشاء (عضلة) نحو الهدف
          const prevVl = s.vl;
          const n = Math.max(1, Math.round(dt / SUB)), h = dt / n;
          for (let i = 0; i < n; i++) {
            s.d += (s.dTarget - s.d) * (1 - Math.exp(-h / 0.15));
            const vgas = VJAR + A * s.d - (s.vl - VL0);
            s.pc = (P0 * VJAR) / vgas;
            const flow = (P0 - s.pc - E * (s.vl - VL0)) / (R0 * (P.resist || 1));
            s.vl += flow * h;
          }
          s.flow = (s.vl - prevVl) / Math.max(dt, 1e-4);
          s.hist.push([s.t, s.pc - P0, s.vl]);
          while (s.hist.length && s.hist[0][0] < s.t - 12) s.hist.shift();

          // جسيمات الهواء في القصبة
          if (Math.abs(s.flow) > 40 && Math.random() < 0.6) s.particles.push({ y: 0, dir: Math.sign(s.flow), x: rand(-4, 4), life: 1 });
          for (let i = s.particles.length - 1; i >= 0; i--) { const q = s.particles[i]; q.y += q.dir * dt * 160; q.life -= dt * 1.4; if (q.life <= 0) s.particles.splice(i, 1); }

          // تقييم التحدّي
          if (s.ch) {
            const c = s.ch, dp = Math.abs(s.pc - P0);
            c.t += dt;
            c.peak = Math.max(c.peak, dp);
            if (dp > SAFE) {
              const pk = c.peak; s.ch = null;
              host.challengeResult(false, `تجاوز فرق الضغط الحدّ الآمن (${fmt(pk, 1)} hPa) — حرّك الغشاء أبطأ`);
              return;
            }
            const frac = (s.vl - VL0) / (A * 0.95);
            if (c.state === 'low' && frac > 0.7) { c.state = 'high'; if (c.cycleStart == null) c.cycleStart = c.t; }
            else if (c.state === 'high' && frac < 0.2) {
              c.state = 'low';
              const dur = c.t - c.cycleStart;
              c.cycleStart = c.t;
              if (dur < 2) host.toast(`دورة سريعة جداً (${fmt(dur, 1)} ث) — أبطئ قليلاً`);
              else if (dur > 6) host.toast(`دورة بطيئة جداً (${fmt(dur, 1)} ث) — أسرع قليلاً`);
              else { c.cycles++; host.sound.tone(660, 0.1, 'triangle', 0.06); }
            }
            host.setChallenge(`الدورات الصحيحة: ${fmt(c.cycles)} / 5 — أعلى فرق ضغط: ${fmt(c.peak, 1)} hPa`, c.cycles / 5);
            if (c.cycles >= 5) { s.ch = null; host.challengeResult(true, `أعلى فرق ضغط ${fmt(c.peak, 1)} hPa`); }
          }
        },
        draw(c, w, h) {
          const g = geom(w, h);
          const inflate = clamp((s.vl - VL0) / A, -0.2, 1.1);
          const dp = s.pc - P0;

          // الجرس الزجاجي
          c.fillStyle = `rgba(${dp < 0 ? '123,45,142' : '200,51,74'},${clamp(Math.abs(dp) / 20, 0, 0.18)})`;
          roundRect(c, g.x, g.y, g.w, g.h, 40); c.fill();
          c.strokeStyle = 'rgba(123,45,142,.6)'; c.lineWidth = 4;
          c.beginPath();
          c.moveTo(g.x, g.bottom); c.lineTo(g.x, g.y + 60); c.quadraticCurveTo(g.x, g.y, g.x + 60, g.y);
          c.lineTo(g.cx - 14, g.y); c.moveTo(g.cx + 14, g.y);
          c.lineTo(g.x + g.w - 60, g.y); c.quadraticCurveTo(g.x + g.w, g.y, g.x + g.w, g.y + 60); c.lineTo(g.x + g.w, g.bottom);
          c.stroke();

          // القصبة الهوائية (Y)
          const ty = g.y + g.h * 0.35;
          c.strokeStyle = '#8a8a96'; c.lineWidth = 10; c.lineCap = 'round';
          c.beginPath(); c.moveTo(g.cx, g.y - 40); c.lineTo(g.cx, ty);
          c.moveTo(g.cx, ty); c.lineTo(g.cx - g.w * 0.2, ty + 30);
          c.moveTo(g.cx, ty); c.lineTo(g.cx + g.w * 0.2, ty + 30); c.stroke();
          c.lineCap = 'butt';
          // جسيمات الهواء
          for (const q of s.particles) {
            const yy = q.dir > 0 ? g.y - 40 + q.y : ty - (-q.y);
            if (yy < g.y - 60 || yy > ty) continue;
            c.fillStyle = `rgba(74,144,217,${q.life})`; c.beginPath(); c.arc(g.cx + q.x, yy, 3, 0, Math.PI * 2); c.fill();
          }

          // الرئتان (بالونان)
          const lr = 30 + 26 * inflate;
          for (const sx of [-1, 1]) {
            const lx = g.cx + sx * g.w * 0.22, ly = ty + 30 + lr * 0.9;
            const grad = c.createRadialGradient(lx - lr * 0.3, ly - lr * 0.4, 4, lx, ly, lr * 1.2);
            grad.addColorStop(0, '#ffc3d6'); grad.addColorStop(1, '#e25d8a');
            c.fillStyle = grad;
            c.beginPath(); c.ellipse(lx, ly, lr * 0.8, lr * 1.05, 0, 0, Math.PI * 2); c.fill();
            c.strokeStyle = '#b5176f'; c.lineWidth = 2; c.stroke();
          }

          // الحجاب الحاجز (غشاء مطاطي)
          const dy = s.d * 70;
          c.fillStyle = '#7b2d8e'; c.strokeStyle = '#4a2c8f'; c.lineWidth = 3;
          c.beginPath(); c.moveTo(g.x - 6, g.bottom); c.quadraticCurveTo(g.cx, g.bottom + dy * 2 - 20 * (1 - s.d), g.x + g.w + 6, g.bottom);
          c.lineTo(g.x + g.w + 6, g.bottom + 6); c.quadraticCurveTo(g.cx, g.bottom + dy * 2 - 14 * (1 - s.d), g.x - 6, g.bottom + 6); c.closePath(); c.fill();
          // مقبض السحب
          const hy = g.bottom + dy + 8;
          c.strokeStyle = '#4a2c8f'; c.lineWidth = 3; c.beginPath(); c.moveTo(g.cx, g.bottom + dy - 4); c.lineTo(g.cx, hy + 10); c.stroke();
          c.fillStyle = s.drag ? STEAM.colors.magenta : '#fff'; c.beginPath(); c.arc(g.cx, hy + 18, 11, 0, Math.PI * 2); c.fill(); c.stroke();
          if (!P.auto && !s.drag && host.level !== 'simple') {
            c.fillStyle = '#4a2c8f'; c.font = 'bold 12px Tajawal, sans-serif'; c.textAlign = 'center';
            c.fillText('↕ اسحب', g.cx, hy + 46);
          }

          // التسميات
          c.direction = 'rtl'; c.textAlign = 'right'; c.font = 'bold 13px Tajawal, sans-serif'; c.fillStyle = '#4a2c8f';
          const lab = (t, x, y) => { c.fillText(t, x, y); };
          lab('القصبة الهوائية', g.x - 12, g.y - 20);
          lab('الرئتان', g.x - 12, ty + 70);
          lab('الحجاب الحاجز', g.x - 12, g.bottom + 10);
          lab('القفص الصدري', g.x - 12, g.y + g.h * 0.2);

          // كلمة الحالة الكبيرة
          const big = s.flow > 30 ? 'شهيق' : s.flow < -30 ? 'زفير' : '';
          if (big) {
            c.textAlign = 'center'; c.font = 'bold 26px Tajawal, sans-serif';
            c.fillStyle = s.flow > 0 ? '#1f9d6b' : '#b5176f';
            c.fillText(big + (s.flow > 0 ? ' ⬇' : ' ⬆'), g.x + 60, g.y + 44);
          }

          // مقياس الضغط
          if (host.level !== 'simple') {
            const mx = g.x + g.w + 50, my = g.y + 20, mh = g.h - 40;
            c.fillStyle = '#eeeef2'; roundRect(c, mx, my, 24, mh, 12); c.fill();
            const mid = my + mh / 2, k = (mh / 2) / 12;
            const bar = clamp(-dp * k, -mh / 2, mh / 2);
            c.fillStyle = Math.abs(dp) > SAFE ? '#c8334a' : '#7b2d8e';
            c.fillRect(mx + 4, Math.min(mid, mid + bar), 16, Math.abs(bar));
            c.strokeStyle = '#c8334a'; c.setLineDash([4, 3]); c.lineWidth = 1.5;
            c.beginPath(); c.moveTo(mx - 6, mid + SAFE * k); c.lineTo(mx + 30, mid + SAFE * k); c.moveTo(mx - 6, mid - SAFE * k); c.lineTo(mx + 30, mid - SAFE * k); c.stroke(); c.setLineDash([]);
            c.strokeStyle = '#5f5f6b'; c.beginPath(); c.moveTo(mx - 4, mid); c.lineTo(mx + 28, mid); c.stroke();
            c.fillStyle = '#5f5f6b'; c.textAlign = 'center'; c.font = 'bold 11px Tajawal, sans-serif';
            c.fillText('ضغط منخفض', mx + 12, my + mh + 16);
            c.fillText('ضغط مرتفع', mx + 12, my - 6);
            c.fillStyle = '#c8334a'; c.fillText('حدّ آمن', mx + 48, mid + SAFE * k + 4);
          }
        },
        drawChart(cv) {
          const d = s.hist;
          const t1 = Math.max(12, s.t), t0 = t1 - 12;
          STEAM.chart.draw(cv, {
            xRange: [t0, t1], yRange: [-12, 12], xLabel: 'الزمن (ث)', yLabel: 'hPa / حجم',
            series: [
              { data: d.map((x) => [x[0], x[1]]), color: STEAM.colors.purple, label: 'فرق الضغط (hPa)', dashedLimit: -SAFE },
              { data: d.map((x) => [x[0], ((x[2] - VL0) / A) * 10]), color: STEAM.colors.magenta, label: 'حجم الرئتين (نسبي)' },
            ],
          });
        },
      };
    },
  };
})();
