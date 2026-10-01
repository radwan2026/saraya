/* 7) محاكاة البركان — تفاعل الخل مع صودا الخبز */
(function () {
  'use strict';
  const { clamp, rand, roundRect, fmt } = STEAM.util;
  const K = 0.5, ALPHA = 5.5, BETA = 0.9, RIM = 12, TARGET = 8, MAXCM = 26;
  const LAVA = { red: { label: 'أحمر', color: '#e0452b' }, orange: { label: 'برتقالي', color: '#f08a24' }, purple: { label: 'بنفسجي', color: '#9b3fb5' }, green: { label: 'أخضر', color: '#3aa55a' } };

  STEAM.sims.volcano = {
    controls: (level) => [
      { id: 'soda', type: 'range', label: '🧂 صودا الخبز', min: 1, max: 6, step: 1, value: 2, unit: 'ملاعق', presets: [1, 3, 6] },
      { id: 'conc', type: 'range', label: '🍶 تركيز الخل', min: 2, max: 10, step: 1, value: 5, unit: '%', presets: [3, 5, 8], presetLabels: ['مخفّف', 'عادي', 'مركّز'] },
      { id: 'soap', type: 'toggle', label: '🫧 إضافة صابون', value: false, on: 'نعم', off: 'لا' },
      { id: 'color', type: 'chips', label: '🎨 لون الحمم', value: 'red', options: Object.entries(LAVA).map(([k, v]) => ({ value: k, label: v.label, color: v.color })) },
      level === 'advanced' ? { id: 'info', type: 'info', text: 'الخل 100 مل في كل مرة؛ كمية الحمض ∝ التركيز. أيّهما ينفد أولاً: الصودا أم الحمض؟' } : null,
    ].filter(Boolean),
    actions: () => [{ id: 'pour', label: '🍶 اسكب الخل!', primary: true }, { id: 'clean', label: '🧽 تنظيف البركان' }],
    chartTitle: (level) => (level === 'simple' ? null : level === 'advanced' ? 'حجم الغاز المتكوّن وارتفاع الرغوة مع الزمن' : 'ارتفاع الرغوة مع الزمن'),
    help: () => 'المنطقة الخضراء على المسطرة = ارتفاع مثالي (8–12 سم)',

    create(host) {
      const P = host.params;
      let s;
      function reset() { s = { soda: 0, acid: 0, gas: 0, h: 0, max: 0, rate: 0, t: 0, active: false, bubbles: [], foam: [], spill: 0, slope: 0, hist: [], ch: null, evalPending: false }; }
      reset();

      function geom(w, h) {
        const base = h - 46, cx = w * 0.42, top = base - Math.min(170, h * 0.38);
        const half = Math.min(200, w * 0.33), crater = 26;
        const pxcm = (top - 30) / MAXCM;
        return { base, cx, top, half, crater, pxcm };
      }

      return {
        reset,
        settings: () => ({ maxHeight: +s.max.toFixed(1) }),
        startChallenge() { s.ch = true; host.setChallenge('اضبط الكميات ثم اسكب الخل. الهدف: 8–12 سم.', 0); },
        onAction(id) {
          if (id === 'clean') { reset(); return; }
          if (id === 'pour') {
            if (s.active) { host.toast('انتظر حتى ينتهي التفاعل'); return; }
            const keepCh = s.ch;
            reset(); s.ch = keepCh;
            s.soda = P.soda; s.acid = P.conc * 0.6; s.active = true; s.evalPending = !!s.ch;
            host.sound.noise(1.2, 0.06, 900);
          }
        },
        hud() {
          const out = [['ارتفاع الثوران', fmt(s.h, 1) + ' سم'], ['أعلى ارتفاع', fmt(s.max, 1) + ' سم']];
          if (host.level !== 'simple') out.push(['غاز CO₂', fmt(s.gas * 40) + ' مل']);
          if (host.level === 'advanced' && s.active) out.push(['المتبقّي', `صودا ${fmt(s.soda, 1)} • حمض ${fmt(s.acid, 1)}`]);
          if (s.spill > 0.05) out.push(['تنبيه', 'فاضت الرغوة خارج القاعدة!']);
          return out;
        },
        step(dt) {
          s.t += dt;
          const g = geom(host.stage.w, host.stage.h);
          if (s.active) {
            const sub = 5, hh = dt / sub;
            for (let i = 0; i < sub; i++) {
              const r = K * s.soda * s.acid;
              s.rate = r;
              s.soda = Math.max(0, s.soda - r * hh); s.acid = Math.max(0, s.acid - r * hh);
              s.gas += r * hh;
              s.h = Math.max(0, s.h + (ALPHA * r * (P.soap ? 1.6 : 1) - BETA * s.h) * hh);
            }
            s.max = Math.max(s.max, s.h);
            if (s.h > RIM) s.spill = Math.min(1, s.spill + dt * (s.h - RIM) * 0.08);
            s.slope = Math.max(s.slope, Math.min(1, s.max / RIM));
            s.hist.push([s.t, s.h, s.gas * 40]);
            // فقاعات
            const n = s.rate * 6 * dt;
            for (let k = 0; k < Math.floor(n) + (Math.random() < n % 1 ? 1 : 0); k++) {
              s.bubbles.push({ x: g.cx + rand(-18, 18), y: g.base - 10, r: rand(2, P.soap ? 4 : 6), vy: rand(60, 120) });
              if (Math.random() < 0.15) host.sound.bubble();
            }
            if (s.max > 0.5 && s.h < s.max * 0.15 && s.rate < 0.05) {
              s.active = false;
              if (s.evalPending) {
                s.evalPending = false; s.ch = null;
                const ok = s.max >= TARGET && s.max <= RIM;
                host.setChallenge(null, clamp(s.max / RIM, 0, 1));
                host.challengeResult(ok, ok ? `ارتفاع ${fmt(s.max, 1)} سم` : s.max < TARGET ? `الارتفاع ${fmt(s.max, 1)} سم أقل من 8 — زِد الكمية أو التركيز أو أضف صابوناً` : `الارتفاع ${fmt(s.max, 1)} سم تجاوز 12 فاضت الرغوة — قلّل الكمية`);
              }
            }
          }
          for (let i = s.bubbles.length - 1; i >= 0; i--) { const b = s.bubbles[i]; b.y -= b.vy * dt; b.x += Math.sin(b.y / 8) * 0.5; if (b.y < g.top) s.bubbles.splice(i, 1); }
          if (s.ch && s.evalPending) host.setChallenge(`الارتفاع الحالي: ${fmt(s.h, 1)} سم — الأعلى: ${fmt(s.max, 1)} سم`, clamp(s.max / RIM, 0, 1));
        },
        draw(c, w, h) {
          const g = geom(w, h);
          const lava = LAVA[P.color].color;
          // القاعدة (الصينية)
          c.fillStyle = '#cfcfd8'; roundRect(c, g.cx - g.half - 50, g.base, (g.half + 50) * 2, 14, 7); c.fill();
          // البركان (مقطع)
          const grd = c.createLinearGradient(0, g.top, 0, g.base);
          grd.addColorStop(0, '#8d6e63'); grd.addColorStop(1, '#5d4037');
          c.fillStyle = grd;
          c.beginPath(); c.moveTo(g.cx - g.half, g.base); c.lineTo(g.cx - g.crater, g.top); c.lineTo(g.cx + g.crater, g.top); c.lineTo(g.cx + g.half, g.base); c.closePath(); c.fill();
          // نافذة المقطع: الحجرة الداخلية
          c.fillStyle = 'rgba(255,255,255,.85)';
          roundRect(c, g.cx - 26, g.top + 6, 52, g.base - g.top - 12, 12); c.fill();
          c.strokeStyle = 'rgba(123,45,142,.6)'; c.lineWidth = 2;
          roundRect(c, g.cx - 26, g.top + 6, 52, g.base - g.top - 12, 12); c.stroke();
          // السائل داخل الحجرة
          const fillH = s.active || s.max > 0 ? 0.45 + clamp(s.h / RIM, 0, 1) * 0.55 : 0.18;
          const ch = (g.base - g.top - 16) * fillH;
          c.fillStyle = STEAM.util.rgba(lava, s.active || s.max > 0 ? 0.75 : 0.25);
          roundRect(c, g.cx - 22, g.base - 10 - ch, 44, ch, 10); c.fill();
          if (!s.active && s.max === 0) {
            c.fillStyle = '#fff'; c.font = 'bold 11px Tajawal, sans-serif'; c.textAlign = 'center'; c.fillText('صودا', g.cx, g.base - 16);
          }
          for (const b of s.bubbles) { c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.5; c.beginPath(); c.arc(b.x, b.y, b.r, 0, Math.PI * 2); c.stroke(); }

          // سيلان على المنحدرات
          if (s.slope > 0) {
            c.fillStyle = lava;
            for (const side of [-1, 1]) {
              const len = s.slope * (s.spill > 0 ? 1 : 0.85);
              c.beginPath();
              c.moveTo(g.cx + side * g.crater, g.top);
              const ex = g.cx + side * (g.crater + (g.half - g.crater) * len), ey = g.top + (g.base - g.top) * len;
              c.lineTo(ex, ey);
              c.lineTo(ex - side * 14, ey + 2);
              c.lineTo(g.cx + side * (g.crater - 12), g.top);
              c.closePath(); c.fill();
            }
            if (s.spill > 0) {
              c.fillStyle = STEAM.util.rgba(lava, 0.85);
              const spread = (g.half + 50) + s.spill * 60;
              c.beginPath(); c.ellipse(g.cx, g.base + 10, spread, 8, 0, 0, Math.PI * 2); c.fill();
            }
          }

          // عمود الرغوة
          if (s.h > 0.05) {
            const fh = s.h * g.pxcm;
            c.fillStyle = lava;
            c.beginPath(); c.moveTo(g.cx - g.crater + 4, g.top + 2);
            c.quadraticCurveTo(g.cx - g.crater - 6, g.top - fh * 0.6, g.cx - 14, g.top - fh);
            c.quadraticCurveTo(g.cx, g.top - fh - 14, g.cx + 14, g.top - fh);
            c.quadraticCurveTo(g.cx + g.crater + 6, g.top - fh * 0.6, g.cx + g.crater - 4, g.top + 2);
            c.closePath(); c.fill();
            // فقاعات الرغوة
            c.fillStyle = 'rgba(255,255,255,.55)';
            for (let i = 0; i < 10; i++) { const a = s.t * 2 + i; c.beginPath(); c.arc(g.cx + Math.sin(a * 1.7) * 14, g.top - fh * ((i + 1) / 11), P.soap ? 3 : 5, 0, Math.PI * 2); c.fill(); }
          }

          // المسطرة
          const rx = g.cx + g.crater + 70;
          c.fillStyle = 'rgba(31,157,107,.18)';
          c.fillRect(rx - 4, g.top - RIM * g.pxcm, 18, (RIM - TARGET) * g.pxcm);
          c.strokeStyle = '#5f5f6b'; c.lineWidth = 2; c.beginPath(); c.moveTo(rx, g.top); c.lineTo(rx, g.top - 20 * g.pxcm); c.stroke();
          c.font = '11px Tajawal, sans-serif'; c.fillStyle = '#5f5f6b'; c.textAlign = 'left';
          for (let cm = 0; cm <= 20; cm += 2) {
            const y = g.top - cm * g.pxcm;
            c.beginPath(); c.moveTo(rx - (cm % 4 ? 4 : 8), y); c.lineTo(rx, y); c.stroke();
            if (cm % 4 === 0) c.fillText(cm + ' سم', rx + 16, y + 4);
          }
          // مؤشّر أعلى ارتفاع
          if (s.max > 0) {
            const my = g.top - Math.min(s.max, 22) * g.pxcm;
            c.strokeStyle = STEAM.colors.magenta; c.setLineDash([4, 3]); c.beginPath(); c.moveTo(g.cx, my); c.lineTo(rx + 12, my); c.stroke(); c.setLineDash([]);
            c.fillStyle = STEAM.colors.magenta; c.textAlign = 'right'; c.font = 'bold 12px Tajawal, sans-serif';
            c.fillText('الأعلى ' + fmt(s.max, 1), rx - 10, my - 4);
          }
          if (s.spill > 0.05) {
            c.fillStyle = '#c8334a'; c.font = 'bold 16px Tajawal, sans-serif'; c.textAlign = 'center';
            c.fillText('⚠️ فاضت الرغوة خارج القاعدة!', g.cx, g.base + 34 > h - 4 ? h - 4 : g.base + 34);
          }
        },
        drawChart(cv) {
          const t1 = s.hist.length ? s.hist[s.hist.length - 1][0] : 1, t0 = s.hist.length ? s.hist[0][0] : 0;
          const series = [{ data: s.hist.map((x) => [x[0] - t0, x[1]]), color: STEAM.colors.magenta, label: 'ارتفاع الرغوة (سم)', dashedLimit: RIM }];
          let ymax = 20;
          if (host.level === 'advanced') {
            const gmax = Math.max(1, ...s.hist.map((x) => x[2]));
            series.push({ data: s.hist.map((x) => [x[0] - t0, (x[2] / gmax) * 20]), color: STEAM.colors.purple, label: `غاز CO₂ (نسبي، الأقصى ${fmt(gmax)} مل)` });
          }
          STEAM.chart.draw(cv, { xRange: [0, Math.max(6, t1 - t0)], yRange: [0, Math.max(ymax, s.max * 1.1)], xLabel: 'الزمن (ث)', yLabel: 'سم', series });
        },
      };
    },
  };
})();
