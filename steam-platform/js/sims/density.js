/* 4) محاكاة الكثافة وطبقات السوائل */
(function () {
  'use strict';
  const { clamp, rand, roundRect, fmt } = STEAM.util;

  const LIQ = {
    honey: { label: 'عسل', rho: 1.42, color: '#e0a020' },
    soap: { label: 'سائل غسيل', rho: 1.06, color: '#3cb371' },
    water: { label: 'ماء ملوّن', rho: 1.0, color: '#4a90d9' },
    oil: { label: 'زيت', rho: 0.92, color: '#f2d16b' },
  };
  const OBJ = {
    pingpong: { label: 'كرة بينغ بونغ', rho: 0.08, color: '#ffffff', r: 11, shape: 'ball' },
    bead: { label: 'خرزة بلاستيكية', rho: 0.97, color: '#e64a6b', r: 7, shape: 'ball' },
    pclip: { label: 'مشبك بلاستيكي', rho: 1.04, color: '#7b2d8e', r: 9, shape: 'clip' },
    grape: { label: 'حبة عنب', rho: 1.1, color: '#6a3d9a', r: 10, shape: 'ball' },
    mclip: { label: 'مشبك معدني', rho: 7.8, color: '#9aa0a8', r: 9, shape: 'clip' },
  };

  STEAM.sims.density = {
    controls(level, host) {
      const api = host._density;
      const P = host.params;
      const list = [
        { id: 'pourL', type: 'chips', label: '🫗 اسكب سائلاً (بأي ترتيب)', value: null, options: Object.entries(LIQ).map(([k, v]) => ({ value: k, label: v.label, color: v.color })), onPick: (k) => api.pour(k) },
        { id: 'dropO', type: 'chips', label: '🔽 أسقط جسماً', value: null, options: Object.entries(OBJ).map(([k, v]) => ({ value: k, label: v.label + (level !== 'simple' ? ` (${v.rho})` : ''), color: v.color })), onPick: (k) => api.drop(k) },
      ];
      if (level === 'advanced') {
        for (const [k, v] of Object.entries(LIQ)) {
          list.push({ id: 'rho_' + k, type: 'range', label: `كثافة ${v.label}`, min: 0.7, max: 1.6, step: 0.01, value: v.rho, decimals: 2, unit: 'g/cm³' });
        }
      }
      void P;
      return list;
    },
    actions: () => [
      { id: 'empty', label: '🧽 إفراغ المخبار' },
      { id: 'removeObjs', label: '✋ إخراج الأجسام' },
    ],
    chartTitle: (level) => (level === 'simple' ? null : 'كثافة الطبقات (g/cm³ × 100) من الأعلى إلى الأسفل'),
    help: (level) => (level === 'simple' ? 'توقّع قبل الإسقاط: هل سيطفو أم يغرق؟' : 'الجسم يغرق في كل طبقة أخف منه ويستقرّ فوق أول طبقة أكثف منه'),

    create(host) {
      const P = host.params;
      let s;
      const rho = (k) => (P['rho_' + k] != null ? P['rho_' + k] : LIQ[k].rho);
      function reset() { s = { layers: [], objs: [], t: 0 }; }
      reset();

      function geom(w, h) {
        const cw = Math.min(180, w * 0.3), x = w * 0.4 - cw / 2, top = 50, bottom = h - 40;
        return { x, w: cw, top, bottom, lh: (bottom - top - 30) / 4 };
      }
      // الترتيب المستهدف: الأخف في الأعلى
      const sorted = () => s.layers.slice().sort((a, b) => rho(a.k) - rho(b.k));
      function targetY(g, layer) {
        const order = sorted(), n = order.length, i = order.indexOf(layer);
        return g.bottom - (n - i) * g.lh; // أعلى الطبقة
      }
      function rest(g, o) {
        const order = sorted(), n = order.length;
        const R = OBJ[o.k].rho;
        if (!n) return { y: g.bottom - OBJ[o.k].r, idx: null };
        const surface = g.bottom - n * g.lh;
        let i = order.findIndex((L) => rho(L.k) >= R);
        if (i === 0) return { y: surface - OBJ[o.k].r * (R < 0.5 ? 0.6 : 0.2), idx: -1 }; // يطفو على السطح
        if (i === -1) return { y: g.bottom - OBJ[o.k].r - 2, idx: n - 1 }; // في القاع
        return { y: g.bottom - (n - i) * g.lh - OBJ[o.k].r + 2, idx: i - 1 };
      }
      function layerAt(g, y) {
        const order = sorted(), n = order.length;
        for (let i = 0; i < n; i++) { const t = g.bottom - (n - i) * g.lh; if (y >= t && y < t + g.lh) return order[i]; }
        return null;
      }

      const api = {
        pour(k) {
          if (s.layers.find((l) => l.k === k)) { host.toast('هذا السائل موجود في المخبار'); return; }
          const g = geom(host.stage.w, host.stage.h);
          const n = s.layers.length;
          s.layers.push({ k, y: g.bottom - (n + 1) * g.lh - 40, a: 0 });
          host.sound.noise(0.5, 0.03, 500);
          s.objs.forEach((o) => (o.settled = false));
        },
        drop(k) {
          const g = geom(host.stage.w, host.stage.h);
          if (k === 'pclip' && host.challengeActive() && s.layers.length !== 3) { host.toast('ابنِ برجاً من 3 سوائل بالضبط أولاً'); return; }
          s.objs = s.objs.filter((o) => o.k !== k);
          s.objs.push({ k, x: g.x + rand(25, g.w - 25), y: g.top - 20, vy: 0, settled: false, checked: false });
          host.sound.tone(700, 0.08, 'sine', 0.05, -300);
        },
      };
      host._density = api;

      return Object.assign(api, {
        reset,
        settings: () => ({ tower: sorted().map((l) => l.k).join('/'), objects: s.objs.map((o) => o.k).join(',') }),
        startChallenge() { host.setChallenge('كوّن برجاً من 3 سوائل ثم أسقط «المشبك البلاستيكي».', 0); },
        onParam() { s.objs.forEach((o) => (o.settled = false, o.checked = false)); },
        onAction(id) {
          if (id === 'empty') { s.layers = []; s.objs = []; }
          if (id === 'removeObjs') s.objs = [];
        },
        hud() {
          const order = sorted();
          const out = [['عدد الطبقات', fmt(order.length)]];
          for (const o of s.objs) {
            const g = geom(host.stage.w, host.stage.h);
            const r = rest(g, o);
            if (!o.settled) continue;
            const where = r.idx === -1 ? 'يطفو على السطح' : r.idx === null ? 'في القاع' : r.idx === order.length - 1 && OBJ[o.k].rho > rho(order[order.length - 1].k) ? 'في القاع' : 'في طبقة ' + LIQ[order[r.idx].k].label;
            out.push([OBJ[o.k].label, where]);
          }
          return out;
        },
        step(dt) {
          s.t += dt;
          const g = geom(host.stage.w, host.stage.h);
          for (const L of s.layers) {
            const ty = targetY(g, L);
            L.y += (ty - L.y) * (1 - Math.exp(-dt * 2.2));
            L.a = Math.min(1, L.a + dt * 2);
          }
          for (const o of s.objs) {
            const r = rest(g, o);
            const L = layerAt(g, o.y);
            const visc = L ? (L.k === 'honey' ? 0.25 : L.k === 'soap' ? 0.55 : 1) : 1.6;
            const dir = Math.sign(r.y - o.y);
            const sp = 160 * visc;
            if (Math.abs(r.y - o.y) < 1.5) {
              o.y = r.y;
              if (!o.settled) { o.settled = true; host.sound.tone(500, 0.05, 'triangle', 0.04); }
            } else {
              o.settled = false;
              o.y += dir * Math.min(Math.abs(r.y - o.y), sp * dt);
            }
            // تقييم التحدّي
            if (o.k === 'pclip' && o.settled && !o.checked && host.challengeActive()) {
              o.checked = true;
              const n = s.layers.length;
              if (n !== 3) host.challengeResult(false, 'البرج يجب أن يتكوّن من 3 سوائل');
              else if (r.idx === 1) { host.setChallenge(null, 1); host.challengeResult(true, 'المشبك في الطبقة الوسطى'); }
              else host.challengeResult(false, r.idx === -1 ? 'المشبك طفا فوق السطح' : r.idx === 0 ? 'المشبك بقي في الطبقة العليا' : 'المشبك غرق إلى الطبقة السفلى');
            }
          }
        },
        draw(c, w, h) {
          const g = geom(w, h);
          // الطبقات (الأبعد أولاً)
          c.save();
          roundRect(c, g.x, g.top - 10, g.w, g.bottom - g.top + 10, 16); c.clip();
          const order = sorted();
          for (const L of s.layers.slice().sort((a, b) => a.y - b.y)) {
            c.globalAlpha = 0.85 * L.a;
            const grad = c.createLinearGradient(g.x, 0, g.x + g.w, 0);
            grad.addColorStop(0, LIQ[L.k].color); grad.addColorStop(0.3, STEAM.util.mixHex(LIQ[L.k].color, '#ffffff', 0.25)); grad.addColorStop(1, LIQ[L.k].color);
            c.fillStyle = grad;
            c.fillRect(g.x, L.y, g.w, g.lh + 1);
          }
          c.globalAlpha = 1;
          c.restore();

          // التسميات
          c.direction = 'rtl'; c.textAlign = 'right'; c.font = 'bold 14px Tajawal, sans-serif';
          for (const L of s.layers) {
            c.fillStyle = '#2b2b33';
            const lab = LIQ[L.k].label + (host.level !== 'simple' ? `  ρ=${rho(L.k).toFixed(2)}` : '');
            c.fillText(lab, g.x - 14, L.y + g.lh / 2 + 5);
            c.strokeStyle = LIQ[L.k].color; c.lineWidth = 3; c.beginPath(); c.moveTo(g.x - 10, L.y + g.lh / 2); c.lineTo(g.x, L.y + g.lh / 2); c.stroke();
          }
          if (!s.layers.length) {
            c.fillStyle = '#8a8a96'; c.textAlign = 'center'; c.font = 'bold 15px Tajawal, sans-serif';
            c.fillText('اسكب سائلاً للبدء', g.x + g.w / 2, (g.top + g.bottom) / 2);
          }

          // الأجسام
          for (const o of s.objs) {
            const O = OBJ[o.k];
            if (O.shape === 'ball') {
              c.fillStyle = O.color; c.strokeStyle = 'rgba(0,0,0,.25)'; c.lineWidth = 1.5;
              c.beginPath(); c.arc(o.x, o.y, O.r, 0, Math.PI * 2); c.fill(); c.stroke();
              c.fillStyle = 'rgba(255,255,255,.6)'; c.beginPath(); c.arc(o.x - O.r * 0.35, o.y - O.r * 0.35, O.r * 0.3, 0, Math.PI * 2); c.fill();
            } else {
              c.strokeStyle = O.color; c.lineWidth = 3;
              roundRect(c, o.x - 14, o.y - 6, 28, 12, 6); c.stroke();
              roundRect(c, o.x - 9, o.y - 3, 20, 6, 3); c.stroke();
            }
          }

          // المخبار
          c.strokeStyle = 'rgba(123,45,142,.6)'; c.lineWidth = 3;
          roundRect(c, g.x, g.top - 10, g.w, g.bottom - g.top + 10, 16); c.stroke();
          c.strokeStyle = 'rgba(255,255,255,.85)'; c.lineWidth = 4;
          c.beginPath(); c.moveTo(g.x + 12, g.top + 10); c.lineTo(g.x + 12, g.bottom - 20); c.stroke();
          c.strokeStyle = 'rgba(95,95,107,.5)'; c.lineWidth = 1.5;
          for (let i = 0; i <= 8; i++) { const y = g.bottom - i * g.lh / 2; c.beginPath(); c.moveTo(g.x + g.w - (i % 2 ? 10 : 20), y); c.lineTo(g.x + g.w, y); c.stroke(); }

          // مقياس الكثافة على اليسار
          if (host.level !== 'simple' && order.length) {
            const bx = g.x + g.w + 40;
            c.textAlign = 'left'; c.font = 'bold 12px Tajawal, sans-serif'; c.fillStyle = '#5f5f6b';
            c.fillText('أخف ↑', bx, g.top + 10);
            c.fillText('أكثف ↓', bx, g.bottom);
            c.strokeStyle = '#cfcfd8'; c.lineWidth = 2; c.beginPath(); c.moveTo(bx + 18, g.top + 20); c.lineTo(bx + 18, g.bottom - 16); c.stroke();
          }
        },
        drawChart(cv) {
          const order = sorted();
          STEAM.chart.draw(cv, { bars: order.map((L) => ({ label: LIQ[L.k].label, value: rho(L.k) * 100, color: LIQ[L.k].color })), yRange: [0, 160], yLabel: 'الكثافة' });
        },
      });
    },
  };
})();
