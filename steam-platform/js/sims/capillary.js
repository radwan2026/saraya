/* 6) محاكاة نقل الماء في النبات — الخاصية الشعرية */
(function () {
  'use strict';
  const { clamp, roundRect, fmt, mixHex } = STEAM.util;
  const H = 20, K = 2, C = 30, LIMIT = 24, CH_LIMIT = 5;
  const PLANTS = {
    celery: { label: 'كرفس (أوعية رفيعة جداً)', short: 'كرفس', r: 0.3, vessels: 9, leaves: true },
    carnation: { label: 'قرنفل (أوعية رفيعة)', short: 'قرنفل', r: 0.8, vessels: 5, leaves: true },
    wide: { label: 'أنبوب عريض', short: 'أنبوب عريض', r: 1.6, vessels: 1, leaves: false },
  };
  const DYES = { blue: { label: 'أزرق', color: '#3b6fd9' }, red: { label: 'أحمر', color: '#d93b5a' }, green: { label: 'أخضر', color: '#2fa35a' }, purple: { label: 'بنفسجي', color: '#7b2d8e' } };
  const plantOpts = Object.entries(PLANTS).map(([k, v]) => ({ value: k, label: v.label }));

  STEAM.sims.capillary = {
    controls: (level) => [
      { id: 'plantA', type: 'chips', label: '🌱 النبات (أ)', value: 'carnation', options: plantOpts },
      { id: 'plantB', type: 'chips', label: '🌱 النبات (ب)', value: 'wide', options: plantOpts, hidden: level === 'simple' },
      { id: 'dye', type: 'chips', label: '🎨 لون الصبغة', value: 'blue', options: Object.entries(DYES).map(([k, v]) => ({ value: k, label: v.label, color: v.color })) },
      { id: 'speed', type: 'seg', label: '⏩ تسريع الزمن (ساعة لكل ثانية)', value: 0.5, options: [{ value: 0.25, label: '¼' }, { value: 0.5, label: '½' }, { value: 1, label: '1' }] },
      { id: 'transp', type: 'range', label: '☀️ النتح من الأوراق (سحب إضافي)', min: 0, max: 2, step: 0.1, value: 0, decimals: 1, hidden: level !== 'advanced', hint: 'تبخّر الماء من الأوراق يسحب الماء للأعلى (لا يؤثّر على الأنبوب)' },
    ],
    actions: () => [{ id: 'run', label: '▶ ضع النباتات في الماء الملوّن', primary: true }],
    chartTitle: (level) => (level === 'simple' ? null : 'ارتفاع الصبغة (سم) مع الزمن (ساعات)'),
    help: () => 'هل يؤثّر لون الصبغة؟ جرّب وقارن!',

    create(host) {
      const P = host.params;
      let s;
      const single = () => host.level === 'simple';
      function mk(k) { return { k, h: 0.3, reached: null, dye: P.dye, hist: [] }; }
      function reset() { s = { running: false, t: 0, A: mk(P.plantA), B: mk(P.plantB), ch: null, results: [] }; }
      reset();

      function start() {
        s = Object.assign(s, { running: true, t: 0, A: mk(P.plantA), B: mk(P.plantB) });
        host.sound.tone(500, 0.15, 'sine', 0.05, 200);
      }
      function rate(p) {
        const pl = PLANTS[p.k];
        let v = (K * (C - pl.r * p.h)) / Math.max(p.h, 0.3);
        if (pl.leaves) v += (P.transp || 0) * 0.8;
        return Math.max(0, v);
      }

      return {
        reset,
        settings: () => ({ plantA: s.A.k, plantB: s.B.k, dye: P.dye, timeA: s.A.reached, timeB: s.B.reached }),
        onParam(id) { if (!s.running && (id === 'plantA' || id === 'plantB')) { s.A = mk(P.plantA); s.B = mk(P.plantB); } },
        startChallenge() { s.ch = true; start(); host.setChallenge('بدأ السباق! هل ستصل الصبغة إلى الزهرة قبل 5 ساعات؟', 0); },
        onAction(id) { if (id === 'run') start(); },
        hud() {
          const out = [['الزمن', fmt(s.t, 1) + ' ساعة']];
          for (const [n, p] of single() ? [['أ', s.A]] : [['أ', s.A], ['ب', s.B]]) {
            out.push([`${PLANTS[p.k].short} (${n})`, p.reached != null ? `وصل بعد ${fmt(p.reached, 1)} س` : host.level === 'simple' ? (s.running ? 'تصعد...' : '—') : `${fmt(p.h, 1)} / ${H} سم`]);
          }
          return out;
        },
        step(rdt) {
          if (!s.running) return;
          const dt = rdt * P.speed; // ساعات
          s.t += dt;
          for (const p of single() ? [s.A] : [s.A, s.B]) {
            const sub = 10;
            for (let i = 0; i < sub; i++) p.h = Math.min(H, p.h + rate(p) * (dt / sub));
            if (p.reached == null && p.h >= H - 0.01) {
              p.reached = s.t; host.sound.success();
              s.results.push({ k: p.k, dye: p.dye, t: s.t });
            }
            p.hist.push([s.t, p.h]);
          }
          if (s.ch) {
            const best = Math.min(...[s.A, s.B].filter((p, i) => !(single() && i)).map((p) => (p.reached == null ? Infinity : p.reached)));
            host.setChallenge(`الزمن: ${fmt(s.t, 1)} / ${CH_LIMIT} ساعات`, s.t / CH_LIMIT);
            if (best <= CH_LIMIT) { s.ch = null; host.challengeResult(true, `وصلت الصبغة بعد ${fmt(best, 1)} ساعة`); }
            else if (s.t > CH_LIMIT) { s.ch = null; host.challengeResult(false, 'لم تصل الصبغة خلال 5 ساعات — جرّب نباتاً أوعيته أرفع'); }
          }
          const all = single() ? [s.A] : [s.A, s.B];
          if (s.t > LIMIT || all.every((p) => p.reached != null && s.t - p.reached > 3)) s.running = false;
        },
        draw(c, w, h) {
          const list = single() ? [[s.A, w * 0.4, 'أ']] : [[s.A, w * 0.2, 'أ'], [s.B, w * 0.48, 'ب']];
          const dye = DYES[P.dye].color;
          const glassY = h - 110, top = 70, stemH = glassY + 40 - top - 20;
          const pxcm = stemH / H;
          for (const [p, x, name] of list) {
            const pl = PLANTS[p.k];
            const sw = p.k === 'wide' ? 34 : 26;
            const stemTop = top + 20, stemBottom = glassY + 40;
            const pd = DYES[p.dye] ? DYES[p.dye].color : dye;

            // الساق
            c.fillStyle = pl.leaves ? 'rgba(120,190,110,.35)' : 'rgba(220,225,235,.6)';
            roundRect(c, x - sw / 2, stemTop, sw, stemBottom - stemTop, 10); c.fill();
            c.strokeStyle = pl.leaves ? 'rgba(70,140,60,.6)' : 'rgba(123,45,142,.5)'; c.lineWidth = 2;
            roundRect(c, x - sw / 2, stemTop, sw, stemBottom - stemTop, 10); c.stroke();

            // الأوعية
            const hy = stemBottom - p.h * pxcm;
            const n = pl.vessels;
            for (let i = 0; i < n; i++) {
              const vx = n === 1 ? x : x - sw / 2 + 5 + (i * (sw - 10)) / (n - 1);
              const vw = n === 1 ? sw - 10 : Math.max(1.5, pl.r * 3.2);
              c.fillStyle = 'rgba(255,255,255,.55)'; c.fillRect(vx - vw / 2, stemTop + 4, vw, stemBottom - stemTop - 4);
              c.fillStyle = pd; c.globalAlpha = 0.85; c.fillRect(vx - vw / 2, hy, vw, stemBottom - hy); c.globalAlpha = 1;
            }
            // الحد الأقصى النظري (للمستوى المتقدّم)
            if (host.level === 'advanced') {
              const hmax = C / pl.r, my = stemBottom - Math.min(hmax, H + 2) * pxcm;
              if (hmax < H) {
                c.strokeStyle = '#c8334a'; c.setLineDash([4, 3]); c.beginPath(); c.moveTo(x - sw, my); c.lineTo(x + sw, my); c.stroke(); c.setLineDash([]);
                c.fillStyle = '#c8334a'; c.font = 'bold 11px Tajawal, sans-serif'; c.textAlign = 'left'; c.fillText('أقصى ارتفاع', x + sw + 4, my + 4);
              }
            }

            // الأوراق
            if (pl.leaves) {
              for (const [frac, side] of [[0.45, -1], [0.7, 1]]) {
                const ly = stemBottom - H * frac * pxcm;
                const tint = clamp((p.h - H * frac) / 3, 0, 1) * 0.6;
                c.fillStyle = mixHex('#5aab4f', pd, tint);
                c.beginPath(); c.ellipse(x + side * (sw / 2 + 22), ly, 26, 10, side * -0.5, 0, Math.PI * 2); c.fill();
              }
            }

            // الزهرة أو فوهة الأنبوب
            const tint = p.reached != null ? clamp((s.t - p.reached) / 2.5, 0, 1) : 0;
            if (pl.leaves) {
              const fx = x, fy = stemTop - 6;
              for (let i = 0; i < 8; i++) {
                const a = (i / 8) * Math.PI * 2;
                c.fillStyle = mixHex('#ffffff', pd, tint * 0.75); c.strokeStyle = 'rgba(0,0,0,.12)'; c.lineWidth = 1;
                c.beginPath(); c.ellipse(fx + Math.cos(a) * 18, fy + Math.sin(a) * 18, 14, 9, a, 0, Math.PI * 2); c.fill(); c.stroke();
              }
              c.fillStyle = '#f2c94c'; c.beginPath(); c.arc(fx, fy, 9, 0, Math.PI * 2); c.fill();
            } else {
              c.strokeStyle = 'rgba(123,45,142,.5)'; c.lineWidth = 2; c.beginPath(); c.moveTo(x - sw / 2 - 4, stemTop); c.lineTo(x + sw / 2 + 4, stemTop); c.stroke();
            }

            // الكأس
            c.fillStyle = STEAM.util.rgba(pd, 0.55);
            c.fillRect(x - 46, glassY + 20, 92, 60);
            c.strokeStyle = 'rgba(123,45,142,.6)'; c.lineWidth = 3;
            c.beginPath(); c.moveTo(x - 50, glassY - 4); c.lineTo(x - 46, glassY + 82); c.lineTo(x + 46, glassY + 82); c.lineTo(x + 50, glassY - 4); c.stroke();

            // الاسم
            c.fillStyle = '#4a2c8f'; c.font = 'bold 14px Tajawal, sans-serif'; c.textAlign = 'center'; c.direction = 'rtl';
            c.fillText(`(${name}) ${pl.short}`, x, h - 12);
            if (p.reached != null) { c.fillStyle = '#1f9d6b'; c.fillText(`✔ ${fmt(p.reached, 1)} ساعة`, x, top - 40 < 14 ? 14 : top - 40); }
          }

          // مسطرة
          const rx = Math.min(w * 0.68, w - 60);
          c.strokeStyle = '#8a8a96'; c.lineWidth = 2; c.beginPath(); c.moveTo(rx, top + 20); c.lineTo(rx, glassY + 40); c.stroke();
          c.font = '11px Tajawal, sans-serif'; c.fillStyle = '#5f5f6b'; c.textAlign = 'left';
          for (let cm = 0; cm <= H; cm += 5) { const y = glassY + 40 - cm * pxcm; c.beginPath(); c.moveTo(rx - 8, y); c.lineTo(rx, y); c.stroke(); c.fillText(cm + ' سم', rx + 4, y + 4); }
        },
        drawChart(cv) {
          const t1 = Math.max(6, s.t);
          STEAM.chart.draw(cv, {
            xRange: [0, t1], yRange: [0, H], xLabel: 'الزمن (ساعات)', yLabel: 'الارتفاع (سم)',
            series: [
              { data: s.A.hist, color: STEAM.colors.purple, label: `(أ) ${PLANTS[s.A.k].short}` },
              single() ? { data: [], color: '#000' } : { data: s.B.hist, color: STEAM.colors.magenta, label: `(ب) ${PLANTS[s.B.k].short}` },
            ],
          });
        },
      };
    },
  };
})();
