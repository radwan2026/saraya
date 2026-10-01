/* STEAM Science Games — النواة المشتركة: تخزين، صوت، قراءة صوتية، رسوم بيانية، واجهة */
(function () {
  'use strict';
  const STEAM = (window.STEAM = window.STEAM || {});
  STEAM.sims = STEAM.sims || {};

  /* ---------- أدوات عامة ---------- */
  const U = (STEAM.util = {
    clamp: (v, a, b) => Math.max(a, Math.min(b, v)),
    lerp: (a, b, t) => a + (b - a) * t,
    rand: (a, b) => a + Math.random() * (b - a),
    fmt: (v, d = 0) => Number(v).toLocaleString('ar-EG', { maximumFractionDigits: d, minimumFractionDigits: d }),
    el(tag, attrs = {}, ...children) {
      const e = document.createElement(tag);
      for (const [k, v] of Object.entries(attrs || {})) {
        if (v == null || v === false) continue;
        if (k === 'class') e.className = v;
        else if (k === 'html') e.innerHTML = v;
        else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
        else e.setAttribute(k, v === true ? '' : v);
      }
      for (const c of children.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c));
      return e;
    },
    esc: (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]),
    qs: (k) => new URLSearchParams(location.search).get(k),
    // يحوّل لون hex إلى rgba
    rgba(hex, a) {
      const h = hex.replace('#', '');
      const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
      return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
    },
    mixHex(a, b, t) {
      const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
      const r = Math.round(U.lerp((pa >> 16) & 255, (pb >> 16) & 255, t));
      const g = Math.round(U.lerp((pa >> 8) & 255, (pb >> 8) & 255, t));
      const bl = Math.round(U.lerp(pa & 255, pb & 255, t));
      return '#' + ((1 << 24) + (r << 16) + (g << 8) + bl).toString(16).slice(1);
    },
    roundRect(g, x, y, w, h, r) {
      r = Math.min(r, w / 2, h / 2);
      g.beginPath();
      g.moveTo(x + r, y);
      g.arcTo(x + w, y, x + w, y + h, r);
      g.arcTo(x + w, y + h, x, y + h, r);
      g.arcTo(x, y + h, x, y, r);
      g.arcTo(x, y, x + w, y, r);
      g.closePath();
    },
    duration(ms) {
      const s = Math.round(ms / 1000);
      return s < 60 ? `${s} ث` : `${Math.floor(s / 60)} د ${s % 60} ث`;
    },
  });

  STEAM.colors = {
    purple: '#7b2d8e', purpleDark: '#4a2c8f', magenta: '#b5176f', light: '#efe7f7',
    gray: '#8a8a96', grayLight: '#e2e2e8', text: '#2b2b33', success: '#1f9d6b', danger: '#c8334a', warn: '#d98a00',
  };

  /* ---------- التخزين المحلي (التقدّم + سجل البيانات للمعلم) ---------- */
  const KEY = 'steam-science-games-v1';
  const defaults = () => ({
    profile: { name: '', grade: 4 },
    badges: {}, // expId -> {date, stars}
    quiz: {}, // expId -> {score, total, date}
    log: [], // أحداث التجارب
    teacher: { pin: '1234', locks: {}, forcedGrade: null },
    settings: { sound: true },
  });
  let state;
  function load() {
    try {
      const raw = localStorage.getItem(KEY);
      state = Object.assign(defaults(), raw ? JSON.parse(raw) : {});
      state.teacher = Object.assign(defaults().teacher, state.teacher || {});
      state.settings = Object.assign(defaults().settings, state.settings || {});
    } catch (e) {
      state = defaults();
    }
  }
  function save() {
    try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { /* التخزين غير متاح */ }
  }
  load();

  STEAM.store = {
    get: () => state,
    save,
    reset() { state = defaults(); save(); },
    profile: () => state.profile,
    setProfile(p) { Object.assign(state.profile, p); save(); },
    grade() { return state.teacher.forcedGrade || state.profile.grade || 4; },
    level(grade) {
      const g = grade || STEAM.store.grade();
      return g <= 2 ? 'simple' : g <= 4 ? 'standard' : 'advanced';
    },
    addLog(entry) {
      state.log.push(Object.assign({ t: Date.now(), student: state.profile.name || 'تلميذ', grade: STEAM.store.grade() }, entry));
      if (state.log.length > 2000) state.log = state.log.slice(-2000);
      save();
    },
    awardBadge(expId, stars) {
      const prev = state.badges[expId];
      if (!prev || prev.stars < stars) state.badges[expId] = { date: Date.now(), stars };
      save();
      return !prev;
    },
    badgeCount: () => Object.keys(state.badges).length,
    setQuiz(expId, score, total) { state.quiz[expId] = { score, total, date: Date.now() }; save(); },
    isLocked(expId, controlId) { return !!(state.teacher.locks[expId] && state.teacher.locks[expId][controlId]); },
    setLock(expId, controlId, on) {
      state.teacher.locks[expId] = state.teacher.locks[expId] || {};
      if (on) state.teacher.locks[expId][controlId] = true; else delete state.teacher.locks[expId][controlId];
      save();
    },
  };
  STEAM.CERT_THRESHOLD = 5;

  /* ---------- الصوت (WebAudio مولّد بدون ملفات) ---------- */
  let actx = null;
  function ac() {
    if (!state.settings.sound) return null;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      return actx;
    } catch (e) { return null; }
  }
  STEAM.sound = {
    enabled: () => state.settings.sound,
    toggle() { state.settings.sound = !state.settings.sound; save(); return state.settings.sound; },
    tone(freq = 600, dur = 0.12, type = 'sine', vol = 0.08, slide = 0) {
      const c = ac(); if (!c) return;
      const o = c.createOscillator(), g = c.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, c.currentTime);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), c.currentTime + dur);
      g.gain.setValueAtTime(vol, c.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + dur);
      o.connect(g).connect(c.destination); o.start(); o.stop(c.currentTime + dur + 0.02);
    },
    drip() { this.tone(U.rand(900, 1300), 0.09, 'sine', 0.06, -500); },
    bubble() { this.tone(U.rand(250, 500), 0.06, 'sine', 0.035, 300); },
    noise(dur = 0.3, vol = 0.05, freq = 800) {
      const c = ac(); if (!c) return;
      const len = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const s = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain();
      f.type = 'bandpass'; f.frequency.value = freq; g.gain.value = vol;
      s.buffer = buf; s.connect(f).connect(g).connect(c.destination); s.start();
    },
    click() { this.tone(500, 0.05, 'triangle', 0.05); },
    success() { [523, 659, 784, 1046].forEach((f, i) => setTimeout(() => this.tone(f, 0.18, 'triangle', 0.08), i * 110)); },
    fail() { this.tone(300, 0.25, 'sawtooth', 0.04, -150); },
  };

  /* ---------- القراءة الصوتية (TTS) للصفوف الدنيا ---------- */
  STEAM.tts = {
    supported: 'speechSynthesis' in window,
    speak(text) {
      if (!this.supported) { STEAM.ui.toast('القراءة الصوتية غير مدعومة في هذا المتصفح'); return; }
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ar-SA'; u.rate = 0.9;
      const v = speechSynthesis.getVoices().find((x) => x.lang && x.lang.startsWith('ar'));
      if (v) u.voice = v;
      speechSynthesis.speak(u);
    },
    stop() { if (this.supported) speechSynthesis.cancel(); },
    button(text) {
      return U.el('button', { class: 'btn btn-icon btn-sm', title: 'استمع', 'aria-label': 'استمع', onclick: (e) => { e.stopPropagation(); STEAM.tts.speak(typeof text === 'function' ? text() : text); } }, '🔊');
    },
  };

  /* ---------- رسم بياني خفيف (Canvas) ---------- */
  STEAM.chart = {
    /** opts: {series:[{data:[[x,y]], color, label, dots}], xRange, yRange, xLabel, yLabel, marker:{x,y}, bars:[{label,value,color}]} */
    draw(canvas, opts) {
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      const g = canvas.getContext('2d');
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const pad = { l: 44, r: 12, t: 12, b: 30 };
      const pw = w - pad.l - pad.r, ph = h - pad.t - pad.b;
      g.font = '11px Tajawal, sans-serif';
      g.fillStyle = '#8a8a96'; g.strokeStyle = '#e2e2e8'; g.lineWidth = 1;

      if (opts.bars) {
        const max = opts.yRange ? opts.yRange[1] : Math.max(1, ...opts.bars.map((b) => b.value));
        const bw = pw / opts.bars.length;
        for (let i = 0; i <= 4; i++) {
          const y = pad.t + ph - (ph * i) / 4;
          g.beginPath(); g.moveTo(pad.l, y); g.lineTo(pad.l + pw, y); g.stroke();
          g.textAlign = 'right'; g.fillText(Math.round((max * i) / 4), pad.l - 6, y + 4);
        }
        opts.bars.forEach((b, i) => {
          // من اليمين لليسار لتناسب القراءة العربية
          const x = pad.l + pw - (i + 1) * bw + bw * 0.18;
          const bh = (ph * b.value) / max;
          g.fillStyle = b.color || STEAM.colors.purple;
          U.roundRect(g, x, pad.t + ph - bh, bw * 0.64, bh, 5); g.fill();
          g.fillStyle = '#5f5f6b'; g.textAlign = 'center';
          g.fillText(b.label, x + bw * 0.32, h - 10);
          g.fillStyle = '#2b2b33'; g.fillText(Math.round(b.value), x + bw * 0.32, pad.t + ph - bh - 4);
        });
        if (opts.yLabel) { g.save(); g.translate(10, pad.t + ph / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillStyle = '#8a8a96'; g.fillText(opts.yLabel, 0, 0); g.restore(); }
        return;
      }

      const [x0, x1] = opts.xRange, [y0, y1] = opts.yRange;
      const X = (x) => pad.l + ((x - x0) / (x1 - x0 || 1)) * pw;
      const Y = (y) => pad.t + ph - ((y - y0) / (y1 - y0 || 1)) * ph;
      for (let i = 0; i <= 4; i++) {
        const yv = y0 + ((y1 - y0) * i) / 4, y = Y(yv);
        g.beginPath(); g.moveTo(pad.l, y); g.lineTo(pad.l + pw, y); g.stroke();
        g.textAlign = 'right'; g.fillStyle = '#8a8a96'; g.fillText(+yv.toFixed(1), pad.l - 6, y + 4);
      }
      for (let i = 0; i <= 5; i++) {
        const xv = x0 + ((x1 - x0) * i) / 5;
        g.textAlign = 'center'; g.fillText(+xv.toFixed(0), X(xv), h - 14);
      }
      if (opts.xLabel) { g.textAlign = 'center'; g.fillText(opts.xLabel, pad.l + pw / 2, h - 1); }
      if (opts.yLabel) { g.save(); g.translate(10, pad.t + ph / 2); g.rotate(-Math.PI / 2); g.textAlign = 'center'; g.fillText(opts.yLabel, 0, 0); g.restore(); }
      g.save(); g.beginPath(); g.rect(pad.l, pad.t, pw, ph); g.clip();
      for (const s of opts.series || []) {
        if (!s.data.length) continue;
        g.strokeStyle = s.color; g.lineWidth = 2.2; g.beginPath();
        s.data.forEach(([x, y], i) => (i ? g.lineTo(X(x), Y(y)) : g.moveTo(X(x), Y(y))));
        g.stroke();
        if (s.dashedLimit != null) {
          g.setLineDash([5, 4]); g.strokeStyle = STEAM.colors.danger; g.beginPath();
          g.moveTo(pad.l, Y(s.dashedLimit)); g.lineTo(pad.l + pw, Y(s.dashedLimit)); g.stroke(); g.setLineDash([]);
        }
      }
      if (opts.marker) {
        g.fillStyle = STEAM.colors.magenta; g.beginPath(); g.arc(X(opts.marker.x), Y(opts.marker.y), 6, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
      }
      g.restore();
      // وسيلة الإيضاح
      let lx = pad.l + pw - 4;
      g.textAlign = 'right'; g.font = 'bold 11px Tajawal, sans-serif';
      for (const s of opts.series || []) {
        if (!s.label) continue;
        g.fillStyle = s.color; g.fillRect(lx - 10, pad.t + 2, 10, 10);
        g.fillText(s.label, lx - 14, pad.t + 11);
        lx -= g.measureText(s.label).width + 30;
      }
    },
  };

  /* ---------- واجهة مشتركة ---------- */
  STEAM.ui = {
    header(active) {
      const h = U.el('header', { class: 'site-header no-print' },
        U.el('div', { class: 'container' },
          U.el('a', { href: 'index.html', class: 'brand', 'aria-label': 'الصفحة الرئيسية' }, U.el('img', { src: 'assets/logo.png', alt: 'STEAM science games' })),
          U.el('nav', { class: 'nav' },
            U.el('a', { href: 'index.html', class: active === 'home' ? 'active' : '' }, 'التجارب'),
            U.el('a', { href: 'teacher.html', class: active === 'teacher' ? 'active' : '' }, 'لوحة المعلم'),
            U.el('a', { href: 'guide.html', class: active === 'guide' ? 'active' : '' }, 'دليل المحتوى')),
          U.el('div', { class: 'header-tools' },
            U.el('button', {
              class: 'btn btn-icon', id: 'soundToggle', title: 'الصوت',
              onclick: (e) => { const on = STEAM.sound.toggle(); e.currentTarget.textContent = on ? '🔈' : '🔇'; },
            }, state.settings.sound ? '🔈' : '🔇'))));
      document.body.prepend(h);
      document.body.append(U.el('footer', { class: 'footer no-print' },
        U.el('div', { class: 'container' }, '© STEAM Science Games — منصة تجارب علمية تفاعلية للصفوف 1–6')));
    },
    toast(msg, ms = 2600) {
      let t = document.querySelector('.toast');
      if (!t) { t = U.el('div', { class: 'toast', role: 'status' }); document.body.append(t); }
      t.textContent = msg; t.classList.add('show');
      clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), ms);
    },
    modal(content) {
      let b = document.querySelector('.modal-backdrop');
      if (!b) {
        b = U.el('div', { class: 'modal-backdrop', onclick: (e) => { if (e.target === b) b.classList.remove('show'); } });
        document.body.append(b);
      }
      b.innerHTML = '';
      const m = U.el('div', { class: 'modal', role: 'dialog' },
        U.el('button', { class: 'btn btn-icon close no-print', onclick: () => b.classList.remove('show'), 'aria-label': 'إغلاق' }, '✕'), content);
      b.append(m); b.classList.add('show');
      return { close: () => b.classList.remove('show') };
    },
    confetti() {
      const c = U.el('canvas', { class: 'celebrate' });
      document.body.append(c);
      const dpr = window.devicePixelRatio || 1;
      c.width = innerWidth * dpr; c.height = innerHeight * dpr; c.style.width = '100%'; c.style.height = '100%';
      const g = c.getContext('2d'); g.scale(dpr, dpr);
      const cols = ['#b5176f', '#7b2d8e', '#4a2c8f', '#cfcfd8', '#f2c94c'];
      const ps = Array.from({ length: 140 }, () => ({ x: innerWidth / 2, y: innerHeight / 3, vx: U.rand(-7, 7), vy: U.rand(-11, -3), c: cols[(Math.random() * cols.length) | 0], s: U.rand(5, 10), r: U.rand(0, 6) }));
      let t = 0;
      (function f() {
        g.clearRect(0, 0, innerWidth, innerHeight);
        for (const p of ps) { p.vy += 0.3; p.x += p.vx; p.y += p.vy; p.r += 0.15; g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c; g.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); g.restore(); }
        if (++t < 130) requestAnimationFrame(f); else c.remove();
      })();
    },
    certificate() {
      const s = state;
      const exps = STEAM.experiments || [];
      const earned = exps.filter((e) => s.badges[e.id]);
      const node = U.el('div', {},
        U.el('div', { class: 'certificate', id: 'certificate' },
          U.el('img', { src: 'assets/logo.png', alt: 'STEAM' }),
          U.el('h2', {}, 'شهادة عالِم صغير'),
          U.el('p', {}, 'تُمنح هذه الشهادة إلى'),
          U.el('div', { class: 'name' }, s.profile.name || 'التلميذ/ة'),
          U.el('p', {}, `لإتمامه/ا بنجاح تحدّيات ${earned.length} تجارب علمية تفاعلية`),
          U.el('div', { class: 'medals' }, earned.map((e) => e.icon).join(' ')),
          U.el('p', { class: 'hint' }, earned.map((e) => e.title).join(' • ')),
          U.el('p', {}, `الصف: ${STEAM.store.grade()} — التاريخ: ${new Date().toLocaleDateString('ar-EG')}`)),
        U.el('div', { class: 'no-print', style: 'text-align:center;margin-top:16px' },
          U.el('button', { class: 'btn btn-primary', onclick: () => window.print() }, '🖨️ طباعة / حفظ PDF')));
      STEAM.ui.modal(node);
    },
  };

  /* ---------- حلقة تشغيل المحاكاة + قماش مُهيّأ لكثافة البكسل ---------- */
  STEAM.Stage = class {
    constructor(canvas) {
      this.canvas = canvas;
      this.g = canvas.getContext('2d');
      this.w = 0; this.h = 0;
      this.resize();
      this._ro = new ResizeObserver(() => this.resize());
      this._ro.observe(canvas);
    }
    resize() {
      const dpr = window.devicePixelRatio || 1;
      const w = this.canvas.clientWidth, h = this.canvas.clientHeight;
      if (!w || !h) return;
      this.canvas.width = Math.round(w * dpr); this.canvas.height = Math.round(h * dpr);
      this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
      this.w = w; this.h = h;
      if (this.onResize) this.onResize(w, h);
    }
    pointer(e) {
      const r = this.canvas.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
  };
})();
