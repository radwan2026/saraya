/* 2) محاكاة ترشيح المياه الجوفية */
(function () {
  'use strict';
  const { clamp, rand, roundRect, fmt, mixHex } = STEAM.util;

  const LAYERS = {
    cotton: { label: 'قطن', color: '#f4f4f6', dot: '#dcdce4', a: { mud: 0.6, dye: 0.2, oil: 0.55 }, perm: 0.45 },
    fine: { label: 'رمل ناعم', color: '#eedcae', dot: '#d9c38c', a: { mud: 0.65, dye: 0.3, oil: 0.4 }, perm: 0.35 },
    coarse: { label: 'رمل خشن', color: '#d6b37d', dot: '#b8935c', a: { mud: 0.4, dye: 0.12, oil: 0.25 }, perm: 0.7 },
    gravel: { label: 'حصى', color: '#b3aea5', dot: '#8f8a82', a: { mud: 0.2, dye: 0.05, oil: 0.1 }, perm: 0.9 },
    rocks: { label: 'صخور', color: '#86827c', dot: '#65625d', a: { mud: 0.08, dye: 0.02, oil: 0.05 }, perm: 1 },
    charcoal: { label: 'فحم نشط', color: '#3a3a40', dot: '#1f1f24', a: { mud: 0.45, dye: 0.75, oil: 0.6 }, perm: 0.5 },
  };
  const WATER = {
    clean: { label: 'نظيف', c0: 5, color: '#9cc9f0', pol: 'mud' },
    muddy: { label: 'موحل', c0: 100, color: '#8b5a2b', pol: 'mud' },
    dye: { label: 'به ملوّنات', c0: 100, color: '#c0399e', pol: 'dye' },
    oily: { label: 'به زيوت', c0: 100, color: '#c9a400', pol: 'oil' },
  };
  const CLEAR = '#cfe9ff';
  const MAX = 5;

  function compute(stack, water) {
    const W = WATER[water];
    let c = W.c0;
    const after = [];
    let time = 0;
    // الترتيب: من الأعلى (أول طبقة يقابلها الماء) إلى الأسفل
    const order = stack.slice().reverse();
    order.forEach((id, i) => {
      const L = LAYERS[id];
      c = c * (1 - L.a[W.pol]);
      after.push(c);
      let lt = 1 / L.perm;
      if (i === 0 && water === 'muddy' && (id === 'fine' || id === 'cotton')) lt *= 1.5; // انسداد
      time += lt;
    });
    return { c, after, time, purity: clamp(100 - c, 0, 100) };
  }

  STEAM.sims.filtration = {
    controls(level, host) {
      const sim = host._filtration;
      const avail = Object.keys(LAYERS).filter((k) => k !== 'charcoal' || level === 'advanced');
      return [
        { id: 'water', type: 'chips', label: '💧 نوع الماء المبدئي', value: 'muddy', options: Object.entries(WATER).map(([k, v]) => ({ value: k, label: v.label, color: v.color })) },
        {
          id: 'layers', type: 'chips', label: `🧱 أضف طبقة (حتى ${MAX}) — تُضاف فوق الطبقات الحالية`, value: null,
          options: avail.map((k) => ({ value: k, label: LAYERS[k].label, color: LAYERS[k].color })),
          onPick: (k) => sim && sim.add(k),
          hint: 'اضغط على طبقة داخل القنينة لإزالتها.',
        },
      ];
    },
    actions: () => [
      { id: 'pour', label: '🚿 اسكب الماء', primary: true },
      { id: 'clear', label: '🗑️ إفراغ الطبقات' },
    ],
    chartTitle: (level) => (level === 'simple' ? null : 'تركيز الملوّثات بعد كل طبقة (من الأعلى إلى الأسفل)'),
    help: () => 'الطبقات تُقرأ من الأعلى (أول ما يمرّ به الماء) إلى الأسفل',

    create(host) {
      const P = host.params;
      let s;
      const api = {
        add(k) {
          if (s.pour) return;
          if (s.stack.includes(k)) { host.toast('هذه الطبقة موجودة بالفعل'); return; }
          if (s.stack.length >= MAX) { host.toast(`الحد الأقصى ${MAX} طبقات`); return; }
          s.stack.push(k); s.result = null;
        },
      };
      host._filtration = api;

      function reset() {
        s = {
          stack: host.level === 'simple' ? ['cotton', 'fine', 'coarse', 'gravel'] : [],
          pour: null, result: null, cup: 0, cupColor: CLEAR, t: 0, drips: [],
        };
      }
      reset();

      function geom(w, h) {
        const bw = Math.min(220, w * 0.38), x = w * 0.42 - bw / 2;
        const top = 70, lh = Math.min(52, (h - 220) / MAX);
        const bottom = top + lh * MAX;
        return { x, w: bw, top, lh, bottom, neckY: bottom + 26, cupY: h - 80, cupH: 64 };
      }

      function layerY(g, i) { return g.bottom - (i + 1) * g.lh; } // i = 0 أسفل

      return Object.assign(api, {
        reset,
        settings: () => ({ stack: s.stack.join('>'), purity: s.result ? Math.round(s.result.purity) : null }),
        startChallenge() {
          host.setChallenge('اختر «موحل» و3 طبقات بالضبط ثم اضغط «اسكب الماء».', 0);
        },
        onAction(id) {
          if (id === 'clear') { if (!s.pour) { s.stack = []; s.result = null; } return; }
          if (id === 'pour') {
            if (!s.stack.length) { host.toast('أضف طبقة واحدة على الأقل'); return; }
            if (s.pour) return;
            const r = compute(s.stack, P.water);
            s.pour = { t: 0, front: 0, r, layerTimes: [] };
            s.result = null; s.cup = 0;
            host.sound.noise(0.8, 0.04, 600);
          }
        },
        pointerDown(p) {
          if (s.pour) return;
          const g = geom(host.stage.w, host.stage.h);
          if (p.x < g.x || p.x > g.x + g.w) return;
          for (let i = 0; i < s.stack.length; i++) {
            const y = layerY(g, i);
            if (p.y >= y && p.y < y + g.lh) { s.stack.splice(i, 1); s.result = null; host.sound.click(); return; }
          }
        },
        hud() {
          const out = [['عدد الطبقات', fmt(s.stack.length)]];
          if (s.result) {
            out.push(['النقاء', fmt(s.result.purity) + '%']);
            if (host.level !== 'simple') out.push(['زمن الترشيح', fmt(s.result.time * 10) + ' ث']);
          } else if (s.pour) out.push(['الحالة', 'يرشّح...']);
          return out;
        },
        step(dt) {
          s.t += dt;
          for (let i = s.drips.length - 1; i >= 0; i--) { const d = s.drips[i]; d.vy += 500 * dt; d.y += d.vy * dt; if (d.y > d.end) s.drips.splice(i, 1); }
          if (!s.pour) return;
          const pr = s.pour, n = s.stack.length;
          const W = WATER[P.water];
          // تقدّم جبهة الماء: الطبقة الحالية تحدّد السرعة
          const idxTop = Math.floor(pr.front); // 0 = الطبقة العليا
          if (idxTop < n) {
            const id = s.stack[n - 1 - idxTop];
            let lt = 1 / LAYERS[id].perm;
            if (idxTop === 0 && P.water === 'muddy' && (id === 'fine' || id === 'cotton')) lt *= 1.5;
            pr.front = Math.min(n, pr.front + dt / (lt * 0.9));
          } else {
            pr.t += dt;
            s.cup = clamp(s.cup + dt * 0.45, 0, 1);
            const g = geom(host.stage.w, host.stage.h);
            if (Math.random() < 0.5) s.drips.push({ x: g.x + g.w / 2 + rand(-3, 3), y: g.neckY, vy: 0, end: g.cupY + g.cupH * (1 - s.cup) });
            s.cupColor = mixHex(CLEAR, W.color, clamp(pr.r.c / 100, 0, 1));
            if (s.cup >= 1) {
              s.result = pr.r; s.pour = null;
              host.sound.drip();
              if (host.challengeActive()) {
                const ok = P.water === 'muddy' && s.stack.length === 3 && pr.r.purity >= 90;
                let why = '';
                if (P.water !== 'muddy') why = 'يجب استخدام الماء الموحل';
                else if (s.stack.length !== 3) why = 'يجب استخدام 3 طبقات بالضبط';
                else if (pr.r.purity < 90) why = `النقاء ${fmt(pr.r.purity)}% أقل من 90%`;
                host.setChallenge(null, pr.r.purity / 100);
                host.challengeResult(ok, ok ? `نقاء ${fmt(pr.r.purity)}%` : why);
              }
            }
          }
        },
        draw(c, w, h) {
          const g = geom(w, h);
          const W = WATER[P.water];
          const n = s.stack.length;

          // الوعاء المصدر
          c.fillStyle = W.color; c.globalAlpha = 0.85;
          roundRect(c, g.x + g.w / 2 - 34, 8, 68, 34, 8); c.fill(); c.globalAlpha = 1;
          c.strokeStyle = '#7b2d8e'; c.lineWidth = 2; roundRect(c, g.x + g.w / 2 - 34, 8, 68, 34, 8); c.stroke();
          c.fillStyle = '#fff'; c.font = 'bold 12px Tajawal, sans-serif'; c.textAlign = 'center';
          c.fillText(W.label, g.x + g.w / 2, 30);
          if (s.pour && s.pour.front < n) {
            c.strokeStyle = W.color; c.lineWidth = 6;
            c.beginPath(); c.moveTo(g.x + g.w / 2, 42); c.lineTo(g.x + g.w / 2, g.top + 4); c.stroke();
          }

          // جسم القنينة
          c.fillStyle = 'rgba(255,255,255,.6)';
          c.beginPath(); c.moveTo(g.x, g.top - 10); c.lineTo(g.x + g.w, g.top - 10); c.lineTo(g.x + g.w, g.bottom);
          c.lineTo(g.x + g.w / 2 + 16, g.neckY - 6); c.lineTo(g.x + g.w / 2 - 16, g.neckY - 6); c.lineTo(g.x, g.bottom); c.closePath(); c.fill();

          // الطبقات
          const conc = s.pour ? s.pour.r.after : s.result ? s.result.after : null;
          for (let i = 0; i < n; i++) {
            const id = s.stack[i], L = LAYERS[id], y = layerY(g, i);
            c.fillStyle = L.color; c.fillRect(g.x + 2, y, g.w - 4, g.lh);
            // نقش الحبيبات
            c.fillStyle = L.dot;
            const size = id === 'rocks' ? 9 : id === 'gravel' ? 5 : id === 'coarse' ? 2.4 : id === 'fine' ? 1.3 : id === 'charcoal' ? 3 : 0;
            if (size) {
              let seed = i * 977 + 13;
              const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
              const count = id === 'rocks' ? 14 : id === 'gravel' ? 40 : 90;
              for (let k = 0; k < count; k++) { c.beginPath(); c.arc(g.x + 6 + rnd() * (g.w - 12), y + 4 + rnd() * (g.lh - 8), size * (0.6 + rnd() * 0.6), 0, Math.PI * 2); c.fill(); }
            } else {
              c.strokeStyle = L.dot; c.lineWidth = 1;
              for (let k = 0; k < 8; k++) { c.beginPath(); c.arc(g.x + 20 + k * (g.w - 40) / 7, y + g.lh / 2, 10, 0, Math.PI * 2); c.stroke(); }
            }
            // الماء داخل الطبقة
            const topIdx = n - 1 - i; // ترتيبها من الأعلى
            if (s.pour || s.result) {
              const f = s.pour ? clamp(s.pour.front - topIdx, 0, 1) : 1;
              if (f > 0) {
                const cin = topIdx === 0 ? W.c0 : conc[topIdx - 1];
                const cout = conc[topIdx];
                const col = mixHex(CLEAR, W.color, clamp((cin + cout) / 200, 0, 1));
                c.fillStyle = col; c.globalAlpha = 0.45;
                c.fillRect(g.x + 2, y, g.w - 4, g.lh * f);
                c.globalAlpha = 1;
              }
            }
            c.strokeStyle = 'rgba(0,0,0,.08)'; c.beginPath(); c.moveTo(g.x, y); c.lineTo(g.x + g.w, y); c.stroke();
            // التسمية
            c.textAlign = 'right'; c.direction = 'rtl'; c.font = 'bold 13px Tajawal, sans-serif'; c.fillStyle = '#4a2c8f';
            c.fillText(`${fmt(topIdx + 1)}. ${L.label}`, g.x - 10, y + g.lh / 2 + 5);
          }
          if (!n) {
            c.fillStyle = '#8a8a96'; c.textAlign = 'center'; c.font = 'bold 15px Tajawal, sans-serif';
            c.fillText('أضف طبقات من لوحة التحكم ←', g.x + g.w / 2, (g.top + g.bottom) / 2);
          }

          // حدود القنينة
          c.strokeStyle = 'rgba(123,45,142,.6)'; c.lineWidth = 3;
          c.beginPath(); c.moveTo(g.x, g.top - 10); c.lineTo(g.x, g.bottom); c.lineTo(g.x + g.w / 2 - 16, g.neckY - 6); c.lineTo(g.x + g.w / 2 - 16, g.neckY);
          c.moveTo(g.x + g.w, g.top - 10); c.lineTo(g.x + g.w, g.bottom); c.lineTo(g.x + g.w / 2 + 16, g.neckY - 6); c.lineTo(g.x + g.w / 2 + 16, g.neckY); c.stroke();

          // قطرات
          c.fillStyle = s.cupColor;
          for (const d of s.drips) { c.beginPath(); c.arc(d.x, d.y, 3, 0, Math.PI * 2); c.fill(); }

          // الكأس
          const cx = g.x + g.w / 2 - 50, cw = 100;
          c.fillStyle = s.cupColor; c.globalAlpha = 0.8;
          const fh = g.cupH * s.cup;
          c.fillRect(cx + 3, g.cupY + g.cupH - fh, cw - 6, fh); c.globalAlpha = 1;
          if (P.water === 'oily' && s.cup > 0.05 && (s.pour ? s.pour.r.c : s.result ? s.result.c : 0) > 20) {
            c.fillStyle = 'rgba(230,190,0,.7)'; c.fillRect(cx + 3, g.cupY + g.cupH - fh, cw - 6, 3);
          }
          c.strokeStyle = 'rgba(123,45,142,.6)'; c.lineWidth = 3;
          c.beginPath(); c.moveTo(cx, g.cupY); c.lineTo(cx + 4, g.cupY + g.cupH); c.lineTo(cx + cw - 4, g.cupY + g.cupH); c.lineTo(cx + cw, g.cupY); c.stroke();

          // مؤشّر النقاء
          const mx = Math.min(w - 70, g.x + g.w + 130), my = g.top, mh = g.cupY + g.cupH - g.top - 26;
          c.fillStyle = '#eeeef2'; roundRect(c, mx, my, 26, mh, 13); c.fill();
          const pur = s.result ? s.result.purity : s.pour && s.pour.front >= n ? s.pour.r.purity * s.cup : 0;
          const ph = (mh - 6) * pur / 100;
          const pg = c.createLinearGradient(0, my + mh, 0, my);
          pg.addColorStop(0, '#c8334a'); pg.addColorStop(0.6, '#d98a00'); pg.addColorStop(0.9, '#1f9d6b');
          c.fillStyle = pg; roundRect(c, mx + 3, my + mh - 3 - ph, 20, ph, 10); c.fill();
          c.strokeStyle = '#1f9d6b'; c.setLineDash([4, 3]); c.lineWidth = 2;
          c.beginPath(); c.moveTo(mx - 6, my + mh - 3 - (mh - 6) * 0.9); c.lineTo(mx + 32, my + mh - 3 - (mh - 6) * 0.9); c.stroke(); c.setLineDash([]);
          c.fillStyle = '#4a2c8f'; c.textAlign = 'center'; c.font = 'bold 13px Tajawal, sans-serif';
          c.fillText('النقاء', mx + 13, my - 10);
          c.fillText(fmt(pur) + '%', mx + 13, my + mh + 18);
          c.fillStyle = '#1f9d6b'; c.font = '11px Tajawal, sans-serif';
          c.fillText('90%', mx - 18, my + mh - (mh - 6) * 0.9);
        },
        drawChart(cv) {
          const W = WATER[P.water];
          const r = s.result || (s.stack.length ? compute(s.stack, P.water) : null);
          const order = s.stack.slice().reverse();
          const bars = [{ label: 'قبل', value: W.c0, color: W.color }];
          if (r) order.forEach((id, i) => bars.push({ label: LAYERS[id].label, value: r.after[i], color: STEAM.colors.purple }));
          STEAM.chart.draw(cv, { bars, yRange: [0, 100], yLabel: 'التركيز' });
        },
      });
    },
  };
})();
