/* أكاديمية ستيم — المؤثرات الحركية للخلفية (الصفحة الرئيسية)
   - موجة نقطية ثلاثية الأبعاد متحركة (مستوحاة من هوية ستيم) تتفاعل مع الفأرة
   - نجوم متلألئة وشهب عابرة
   - رموز علمية عائمة في الهيرو
   - هالة ضوئية تتبع المؤشر
   تحترم إعداد «تقليل الحركة» وتتوقف عند إخفاء التبويب. */
(function () {
  "use strict";
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isSmall = () => window.innerWidth < 760;

  /* ---------- طبقات DOM ---------- */
  const layer = document.createElement("div");
  layer.className = "fx-layer";
  layer.setAttribute("aria-hidden", "true");
  layer.innerHTML = `
    <div class="fx-orb fx-orb-1"></div>
    <div class="fx-orb fx-orb-2"></div>
    <div class="fx-orb fx-orb-3"></div>
    <canvas class="fx-canvas"></canvas>
    <div class="fx-spot"></div>`;
  document.body.prepend(layer);
  document.body.classList.add("has-fx");

  const canvas = layer.querySelector(".fx-canvas");
  const ctx = canvas.getContext("2d", { alpha: true });
  const spot = layer.querySelector(".fx-spot");

  /* ---------- الرموز العائمة في الهيرو ---------- */
  const SYMBOLS = [
    // ذرة
    '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2"><ellipse cx="24" cy="24" rx="20" ry="8"/><ellipse cx="24" cy="24" rx="20" ry="8" transform="rotate(60 24 24)"/><ellipse cx="24" cy="24" rx="20" ry="8" transform="rotate(-60 24 24)"/><circle cx="24" cy="24" r="3.5" fill="currentColor"/></svg>',
    // ترس
    '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M21 4h6l1 5 4 2 4-3 4 4-3 4 2 4 5 1v6l-5 1-2 4 3 4-4 4-4-3-4 2-1 5h-6l-1-5-4-2-4 3-4-4 3-4-2-4-5-1v-6l5-1 2-4-3-4 4-4 4 3 4-2z"/><circle cx="24" cy="24" r="7"/></svg>',
    // كود
    '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M16 14 6 24l10 10M32 14l10 10-10 10M27 10l-6 28"/></svg>',
    // دورق
    '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M18 5h12M20 5v13L8 39a3 3 0 0 0 3 4h26a3 3 0 0 0 3-4L28 18V5"/><path d="M13 31h22" opacity=".6"/><circle cx="21" cy="36" r="2" fill="currentColor"/><circle cx="28" cy="33" r="1.5" fill="currentColor"/></svg>',
    // صاروخ
    '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><path d="M24 4c8 6 11 15 9 25H15C13 19 16 10 24 4Z"/><circle cx="24" cy="18" r="4"/><path d="M15 29l-6 7 8-1M33 29l6 7-8-1M20 35l4 8 4-8"/></svg>',
    // باي
    '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"><path d="M8 14h32M18 14v26M30 14v20c0 4 2 6 6 6"/></svg>',
    // مكعب
    '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><path d="M24 4 42 14v20L24 44 6 34V14z"/><path d="M6 14l18 10 18-10M24 24v20"/></svg>',
    // روبوت
    '<svg viewBox="0 0 48 48" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round"><rect x="8" y="14" width="32" height="24" rx="8"/><circle cx="18" cy="26" r="3" fill="currentColor"/><circle cx="30" cy="26" r="3" fill="currentColor"/><path d="M24 14V7M4 24v6M44 24v6"/><circle cx="24" cy="6" r="2.5" fill="currentColor"/></svg>',
  ];
  const hero = document.querySelector(".hero");
  if (hero) {
    const wrap = document.createElement("div");
    wrap.className = "fx-symbols";
    wrap.setAttribute("aria-hidden", "true");
    const spots = [
      [6, 18], [44, 8], [92, 14], [3, 70], [48, 88], [88, 78], [30, 45], [70, 52],
    ];
    const colors = ["#38bdf8", "#d14fa0", "#ffd84a", "#9b4fd1", "#5b6cff", "#34d399", "#c9a8ff", "#d14fa0"];
    wrap.innerHTML = SYMBOLS.map((s, i) => {
      const [x, y] = spots[i];
      const size = 26 + ((i * 7) % 22);
      return `<span class="fx-sym" style="left:${x}%;top:${y}%;width:${size}px;color:${colors[i]};--d:${10 + (i % 4) * 3}s;--delay:${-i * 1.7}s;--r:${i % 2 ? -1 : 1}">${s}</span>`;
    }).join("");
    hero.prepend(wrap);

    // بارالاكس خفيف للرموز مع الفأرة
    if (!reduce) {
      hero.addEventListener("pointermove", (e) => {
        const r = hero.getBoundingClientRect();
        const dx = (e.clientX - r.left) / r.width - 0.5;
        const dy = (e.clientY - r.top) / r.height - 0.5;
        wrap.style.transform = `translate3d(${dx * -24}px, ${dy * -18}px, 0)`;
      });
    }
  }

  /* ---------- الكانفس: الموجة + النجوم ---------- */
  let W = 0, H = 0, DPR = 1;
  let cols, rows, stars = [], meteors = [];
  const mouse = { x: 0.5, y: 0.5, tx: 0.5, ty: 0.5 };

  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 1.6);
    W = window.innerWidth; H = window.innerHeight;
    canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
    canvas.style.width = W + "px"; canvas.style.height = H + "px";
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    cols = isSmall() ? 42 : 78;
    rows = isSmall() ? 20 : 30;
    const n = isSmall() ? 45 : 110;
    stars = Array.from({ length: n }, () => ({
      x: Math.random() * W, y: Math.random() * H * 0.62,
      r: Math.random() * 1.3 + 0.3, p: Math.random() * Math.PI * 2, s: 0.6 + Math.random() * 1.6,
    }));
  }

  // تدرّج اللون حسب ارتفاع النقطة: سماوي ← بنفسجي ← ماجنتا
  const C1 = [56, 189, 248], C2 = [155, 79, 209], C3 = [232, 90, 190];
  function mix(a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; }
  // لوحة ألوان محسوبة مسبقاً (32 درجة) لتجنّب بناء نص اللون لكل نقطة
  const PALETTE = Array.from({ length: 32 }, (_, k) => {
    const h = k / 31;
    const c = h < 0.5 ? mix(C1, C2, h * 2) : mix(C2, C3, (h - 0.5) * 2);
    return `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
  });

  function drawWave(t) {
    const horizon = H * (isSmall() ? 0.55 : 0.5);          // خط الأفق
    const baseY = H * 0.92;            // أقرب صف
    const spread = W * 1.5;
    const mx = (mouse.x - 0.5), my = (mouse.y - 0.5);
    for (let j = 0; j < rows; j++) {
      const z = j / (rows - 1);                 // 0 قريب ← 1 بعيد
      const persp = 1 / (1 + z * 2.6);
      const rowY = horizon + (baseY - horizon) * persp;
      const fade = Math.pow(1 - z, 0.7);
      for (let i = 0; i < cols; i++) {
        const u = i / (cols - 1) - 0.5;         // -0.5..0.5
        const wave =
          Math.sin(u * 7 + t * 0.9 + z * 3) * 0.55 +
          Math.cos(z * 9 - t * 0.7 + u * 2) * 0.35 +
          Math.sin((u + mx * 0.6) * 4 - (z - my) * 5 + t * 1.3) * 0.25 * (1 + Math.abs(mx) * 2);
        const amp = (isSmall() ? 34 : 60) * persp;
        const x = W / 2 + u * spread * persp + mx * 40 * (1 - z);
        const y = rowY - wave * amp;
        if (x < -10 || x > W + 10) continue;
        const h = (wave + 1.15) / 2.3;          // 0..1
        const a = (0.2 + h * 0.7) * fade;
        const size = (0.6 + h * 1.6) * persp * (isSmall() ? 1.5 : 1.9);
        // نقاط مربعة صغيرة بدل الدوائر: أسرع بكثير والفرق غير مرئي بهذا الحجم
        ctx.globalAlpha = a;
        ctx.fillStyle = PALETTE[Math.min(PALETTE.length - 1, (h * PALETTE.length) | 0)];
        if (size < 1.5) ctx.fillRect(x - size, y - size, size * 2, size * 2);
        else { ctx.beginPath(); ctx.arc(x, y, size, 0, 6.283); ctx.fill(); }
      }
    }
  }

  function drawStars(t) {
    for (const s of stars) {
      const a = 0.25 + 0.75 * (0.5 + 0.5 * Math.sin(t * s.s + s.p));
      ctx.fillStyle = `rgba(230,220,255,${(a * 0.8).toFixed(3)})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
    }
    // شهب عابرة
    if (!reduce && Math.random() < 0.006 && meteors.length < 2) {
      meteors.push({ x: W * (0.3 + Math.random() * 0.7), y: Math.random() * H * 0.3, life: 0 });
    }
    meteors = meteors.filter((m) => m.life < 1);
    for (const m of meteors) {
      m.life += 0.018;
      const x = m.x - m.life * 380, y = m.y + m.life * 190;
      const g = ctx.createLinearGradient(x, y, x + 120, y - 60);
      g.addColorStop(0, `rgba(255,216,74,${1 - m.life})`);
      g.addColorStop(1, "rgba(255,216,74,0)");
      ctx.strokeStyle = g; ctx.lineWidth = 2; ctx.lineCap = "round";
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 120, y - 60); ctx.stroke();
    }
  }

  let running = true, last = 0, raf = 0;
  function frame(ms) {
    raf = requestAnimationFrame(frame);
    if (!running) return;
    if (ms - last < 1000 / 45) return;   // حد أقصى ~45 إطاراً في الثانية لتوفير الطاقة
    last = ms;
    const t = ms / 1000;
    mouse.x += (mouse.tx - mouse.x) * 0.05;
    mouse.y += (mouse.ty - mouse.y) * 0.05;
    ctx.clearRect(0, 0, W, H);
    drawStars(t);
    drawWave(t);
    ctx.globalAlpha = 1;
  }

  function still() { ctx.clearRect(0, 0, W, H); drawStars(1); drawWave(1); ctx.globalAlpha = 1; }

  resize();
  window.addEventListener("resize", () => { resize(); if (reduce) still(); });

  if (reduce) { still(); return; }

  window.addEventListener("pointermove", (e) => {
    mouse.tx = e.clientX / W; mouse.ty = e.clientY / H;
    spot.style.transform = `translate3d(${e.clientX - 300}px, ${e.clientY - 300}px, 0)`;
    spot.style.opacity = "1";
  }, { passive: true });
  document.addEventListener("pointerleave", () => { spot.style.opacity = "0"; });

  // تخفيف الموجة عند النزول في الصفحة حتى لا تشتّت القراءة
  window.addEventListener("scroll", () => {
    const k = Math.min(1, window.scrollY / (H * 1.2));
    canvas.style.opacity = String(1 - k * 0.55);
  }, { passive: true });

  document.addEventListener("visibilitychange", () => { running = !document.hidden; });
  raf = requestAnimationFrame(frame);
})();
