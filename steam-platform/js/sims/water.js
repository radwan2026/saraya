/* 1) محاكاة الدورة المائية في وعاء */
(function () {
  'use strict';
  const { clamp, rand, roundRect, fmt } = STEAM.util;
  const T_AIR = 22, K1 = 0.02, K2 = 0.6, LEAK = 0.15;
  const tLid = (ice) => T_AIR - 2.5 * ice;
  const sat = (t) => 4 * Math.exp(0.05 * t);
  const evapRate = (tw) => K1 * Math.max(0, tw - T_AIR);

  STEAM.sims['water-cycle'] = {
    controls: (level) => [
      { id: 'temp', type: 'range', label: '🔥 حرارة الماء', min: 20, max: 100, step: 1, value: 45, unit: '°C', presets: [35, 70, 100], presetLabels: ['دافئ', 'ساخن', 'ساخن جداً'] },
      { id: 'ice', type: 'range', label: '🧊 كمية الثلج على الغطاء', min: 0, max: 10, step: 1, value: 0, unit: 'مكعبات', presets: [0, 5, 10], presetLabels: ['بلا ثلج', 'قليل', 'كثير'] },
      { id: 'speed', type: 'seg', label: '⏩ سرعة الزمن', value: 1, options: [{ value: 1, label: '×1' }, { value: 2, label: '×2' }, { value: 4, label: '×4' }] },
      level === 'simple' ? { id: 'tip', type: 'info', text: 'سخّن الماء وضع ثلجاً على الغطاء، ثم راقب ماذا يحدث!' } : null,
    ].filter(Boolean),
    chartTitle: (level) => (level === 'advanced' ? 'العلاقة بين حرارة الماء ومعدّل التبخّر' : null),
    help: () => 'تلميح: الماء الساخن + غطاء بارد = مطر أكثر',

    create(host) {
      const P = host.params;
      let s;
      function reset() {
        s = { tw: 25, vapor: 0, acc: 0, drops: [], falling: [], steam: [], bubbles: [], splashes: [], rain: 0, t: 0, ch: null };
      }
      reset();

      function geom(w, h) {
        const jw = Math.min(w * 0.42, 300), jh = Math.min(h * 0.72, 340);
        const x = w * 0.42 - jw / 2, y = (h - jh) / 2 + 10;
        return { x, y, w: jw, h: jh, lidY: y, waterY: y + jh * 0.68, bottom: y + jh };
      }

      return {
        reset,
        settings: () => ({ rain: s.rain }),
        startChallenge() { s.ch = { t: 0, rain0: s.rain }; },
        hud() {
          const out = [['حرارة الماء', fmt(s.tw) + '°C'], ['قطرات المطر', fmt(s.rain)]];
          if (host.level !== 'simple') out.splice(1, 0, ['حرارة الغطاء', fmt(tLid(P.ice)) + '°C']);
          if (host.level === 'advanced') out.push(['معدّل التبخّر', fmt(evapRate(s.tw), 2)]);
          if (s.ch) out.push(['زمن التحدّي', fmt(s.ch.t) + ' / 60 ث']);
          return out;
        },
        step(rdt) {
          const g = geom(host.stage.w, host.stage.h);
          const steps = P.speed || 1;
          for (let k = 0; k < steps; k++) {
            const dt = rdt;
            s.t += dt;
            s.tw += (P.temp - s.tw) * (1 - Math.exp(-dt / 3));
            const ev = evapRate(s.tw);
            const sv = sat(tLid(P.ice));
            const cond = s.vapor > sv ? K2 * (s.vapor - sv) : 0;
            s.vapor = Math.max(0, s.vapor + (ev - cond - LEAK * s.vapor) * dt);
            s.acc += cond * dt;

            // نمو قطرات التكثّف على الغطاء
            while (s.acc > 0.05) {
              s.acc -= 0.05;
              const x = rand(g.x + 14, g.x + g.w - 14);
              const near = s.drops.find((d) => Math.abs(d.x - x) < 10);
              if (near) near.r += 0.45; else s.drops.push({ x, r: 1.4 });
            }
            for (let i = s.drops.length - 1; i >= 0; i--) {
              const d = s.drops[i];
              if (d.r > 5) { s.drops.splice(i, 1); s.falling.push({ x: d.x, y: g.lidY + 14 + d.r, vy: 0, r: d.r }); }
            }
            for (let i = s.falling.length - 1; i >= 0; i--) {
              const f = s.falling[i];
              f.vy += 600 * dt; f.y += f.vy * dt;
              if (f.y >= g.waterY) {
                s.falling.splice(i, 1); s.rain++;
                s.splashes.push({ x: f.x, y: g.waterY, life: 0.5 });
                if (k === 0) host.sound.drip();
              }
            }

            // جسيمات البخار
            const spawn = ev * 18 * dt;
            if (Math.random() < spawn % 1) s.steam.push({ x: rand(g.x + 20, g.x + g.w - 20), y: g.waterY - 4, vy: -rand(30, 60), life: 1, ph: rand(0, 6) });
            for (let n = 0; n < Math.floor(spawn); n++) s.steam.push({ x: rand(g.x + 20, g.x + g.w - 20), y: g.waterY - 4, vy: -rand(30, 60), life: 1, ph: rand(0, 6) });
            for (let i = s.steam.length - 1; i >= 0; i--) {
              const p = s.steam[i];
              p.y += p.vy * dt; p.ph += dt * 3; p.x += Math.sin(p.ph) * 0.4;
              if (p.y < g.lidY + 22) { p.vy *= 0.9; p.life -= dt * 1.5; }
              p.life -= dt * 0.15;
              if (p.life <= 0) s.steam.splice(i, 1);
            }
            if (s.steam.length > 400) s.steam.splice(0, s.steam.length - 400);

            // فقاعات الغليان
            if (s.tw > 85 && Math.random() < (s.tw - 85) * 0.08 * dt * 10) {
              s.bubbles.push({ x: rand(g.x + 20, g.x + g.w - 20), y: g.bottom - 8, r: rand(2, 5) });
              if (k === 0 && Math.random() < 0.2) host.sound.bubble();
            }
            for (let i = s.bubbles.length - 1; i >= 0; i--) { const b = s.bubbles[i]; b.y -= 50 * dt; if (b.y < g.waterY) s.bubbles.splice(i, 1); }
            for (let i = s.splashes.length - 1; i >= 0; i--) { s.splashes[i].life -= dt; if (s.splashes[i].life <= 0) s.splashes.splice(i, 1); }

            if (s.ch) {
              s.ch.t += dt;
              const got = s.rain - s.ch.rain0;
              host.setChallenge(`القطرات: ${fmt(got)} / 10 — الوقت: ${fmt(Math.max(0, 60 - s.ch.t))} ث`, got / 10);
              if (got >= 10) { s.ch = null; host.challengeResult(true, `${fmt(got)} قطرات`); }
              else if (s.ch.t >= 60) { s.ch = null; host.challengeResult(false, `سقطت ${fmt(got)} قطرات فقط`); }
            }
          }
        },
        draw(c, w, h) {
          const g = geom(w, h);
          const warm = clamp((s.tw - 20) / 80, 0, 1);

          // الموقد
          c.fillStyle = '#5f5f6b';
          roundRect(c, g.x - 20, g.bottom + 6, g.w + 40, 20, 8); c.fill();
          c.fillStyle = `rgba(${200 + 55 * warm},${90 - 60 * warm},${40},${0.25 + 0.75 * warm})`;
          roundRect(c, g.x, g.bottom + 2, g.w, 8, 4); c.fill();

          // الماء
          const wg = c.createLinearGradient(0, g.waterY, 0, g.bottom);
          wg.addColorStop(0, `rgba(${80 + 120 * warm},${150 - 30 * warm},${230 - 80 * warm},0.55)`);
          wg.addColorStop(1, `rgba(${60 + 100 * warm},${110 - 20 * warm},${210 - 80 * warm},0.75)`);
          c.fillStyle = wg;
          roundRect(c, g.x + 4, g.waterY, g.w - 8, g.bottom - g.waterY - 4, 14); c.fill();
          c.strokeStyle = 'rgba(255,255,255,.6)'; c.lineWidth = 2;
          c.beginPath();
          for (let x = g.x + 6; x <= g.x + g.w - 6; x += 6) c.lineTo(x, g.waterY + Math.sin(x / 12 + s.t * 3) * 1.5);
          c.stroke();
          c.fillStyle = 'rgba(255,255,255,.7)';
          for (const b of s.bubbles) { c.beginPath(); c.arc(b.x, b.y, b.r, 0, Math.PI * 2); c.fill(); }

          // الضباب داخل الوعاء
          c.fillStyle = `rgba(255,255,255,${clamp(s.vapor / 14, 0, 0.45)})`;
          c.fillRect(g.x + 4, g.lidY + 14, g.w - 8, g.waterY - g.lidY - 14);

          // البخار
          for (const p of s.steam) {
            c.fillStyle = `rgba(190,200,225,${0.5 * p.life})`;
            c.beginPath(); c.arc(p.x, p.y, 4 + (1 - p.life) * 6, 0, Math.PI * 2); c.fill();
          }

          // الإناء الزجاجي
          c.strokeStyle = 'rgba(123,45,142,.55)'; c.lineWidth = 4;
          roundRect(c, g.x, g.lidY + 10, g.w, g.h - 10, 18); c.stroke();
          c.strokeStyle = 'rgba(255,255,255,.8)'; c.lineWidth = 3;
          c.beginPath(); c.moveTo(g.x + 14, g.lidY + 40); c.lineTo(g.x + 14, g.bottom - 30); c.stroke();

          // الغطاء
          const cold = clamp(P.ice / 10, 0, 1);
          c.fillStyle = `rgb(${160 - 60 * cold},${160 - 20 * cold},${175 + 50 * cold})`;
          roundRect(c, g.x - 12, g.lidY, g.w + 24, 14, 6); c.fill();

          // الثلج
          const n = Math.round(P.ice);
          for (let i = 0; i < n; i++) {
            const cw = Math.min(26, (g.w - 10) / 5.5);
            const row = Math.floor(i / 5), col = i % 5;
            const x = g.x + 10 + col * (cw + 6) + row * 12, y = g.lidY - cw - row * (cw - 4);
            c.fillStyle = 'rgba(200,235,255,.95)'; c.strokeStyle = '#8fc8ec'; c.lineWidth = 1.5;
            roundRect(c, x, y, cw, cw, 5); c.fill(); c.stroke();
            c.fillStyle = 'rgba(255,255,255,.9)'; c.fillRect(x + 4, y + 4, cw * 0.3, cw * 0.15);
          }

          // قطرات التكثّف والمطر
          c.fillStyle = 'rgba(70,140,230,.85)';
          for (const d of s.drops) { c.beginPath(); c.ellipse(d.x, g.lidY + 14 + d.r * 0.8, d.r * 0.8, d.r, 0, 0, Math.PI * 2); c.fill(); }
          for (const f of s.falling) {
            c.beginPath(); c.moveTo(f.x, f.y - f.r * 2); c.quadraticCurveTo(f.x + f.r, f.y, f.x, f.y + f.r * 0.6); c.quadraticCurveTo(f.x - f.r, f.y, f.x, f.y - f.r * 2); c.fill();
          }
          c.strokeStyle = 'rgba(70,140,230,.6)'; c.lineWidth = 1.5;
          for (const sp of s.splashes) { c.beginPath(); c.ellipse(sp.x, sp.y, (0.5 - sp.life) * 30, (0.5 - sp.life) * 8, 0, 0, Math.PI * 2); c.stroke(); }

          // مخطّط مراحل الدورة
          const ev = evapRate(s.tw), sv = sat(tLid(P.ice));
          const stages = [
            { label: 'تكثّف', icon: '☁️', on: clamp((s.vapor - sv) / 1.5, 0, 1), y: g.lidY + 40 },
            { label: 'هطول', icon: '🌧️', on: s.falling.length ? 1 : clamp(s.drops.reduce((a, d) => Math.max(a, d.r), 0) / 5, 0, 0.6), y: g.lidY + (g.waterY - g.lidY) / 2 + 20 },
            { label: 'تبخّر', icon: '♨️', on: clamp(ev / 1.2, 0, 1), y: g.waterY + 10 },
          ];
          const sx = g.x + g.w + 40;
          c.textAlign = 'right'; c.direction = 'rtl';
          for (const st of stages) {
            const a = 0.25 + 0.75 * st.on;
            c.fillStyle = `rgba(239,231,247,${a})`; c.strokeStyle = `rgba(123,45,142,${a})`; c.lineWidth = 2;
            roundRect(c, sx, st.y - 18, 110, 36, 18); c.fill(); c.stroke();
            c.fillStyle = `rgba(74,44,143,${a})`; c.font = 'bold 15px Tajawal, sans-serif';
            c.fillText(st.icon + ' ' + st.label, sx + 100, st.y + 5);
          }
          c.strokeStyle = 'rgba(123,45,142,.4)'; c.lineWidth = 2; c.setLineDash([4, 4]);
          c.beginPath(); c.moveTo(sx + 55, stages[2].y - 20); c.lineTo(sx + 55, stages[0].y + 20); c.stroke(); c.setLineDash([]);

          // ميزان الحرارة
          const tx = g.x - 50, ty = g.y + 20, th = g.h - 60;
          c.fillStyle = '#fff'; c.strokeStyle = '#cfcfd8'; c.lineWidth = 2;
          roundRect(c, tx, ty, 14, th, 7); c.fill(); c.stroke();
          const fill = clamp((s.tw - 0) / 100, 0, 1) * (th - 8);
          c.fillStyle = STEAM.colors.magenta; roundRect(c, tx + 3, ty + th - 4 - fill, 8, fill, 4); c.fill();
          c.beginPath(); c.arc(tx + 7, ty + th + 8, 11, 0, Math.PI * 2); c.fill();
          c.textAlign = 'center'; c.fillStyle = '#5f5f6b'; c.font = 'bold 12px Tajawal, sans-serif';
          c.fillText(fmt(s.tw) + '°', tx + 7, ty - 8);
        },
        drawChart(cv) {
          const data = [];
          for (let t = 20; t <= 100; t += 4) data.push([t, evapRate(t)]);
          STEAM.chart.draw(cv, {
            xRange: [20, 100], yRange: [0, 1.7], xLabel: 'حرارة الماء (°C)', yLabel: 'معدّل التبخّر',
            series: [{ data, color: STEAM.colors.purple, label: 'معدّل التبخّر' }],
            marker: { x: clamp(s.tw, 20, 100), y: evapRate(s.tw) },
          });
        },
      };
    },
  };
})();
