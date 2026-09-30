/* global io */
// =====================================================================
//  حصار المفاعل — الواجهة
//  Alpine.js يدير الحالة والنصوص، وطبقة Canvas ترسم المؤثرات بسلاسة 60fps
// =====================================================================
(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  const OPTS = { transparent: params.get('transparent') === '1', sound: params.get('sound') !== '0' };

  const TEAM = {
    blue: { name: 'الفريق الأزرق', key: '1', color: '#2e8bff', color2: '#36e2ff', rgb: '46,139,255' },
    red: { name: 'الفريق الأحمر', key: '2', color: '#ff2d55', color2: '#ff8a3d', rgb: '255,45,85' },
  };
  const other = (t) => (t === 'blue' ? 'red' : 'blue');

  // هندسة المسرح (بإحداثيات 1080×1920)
  const G = { W: 1080, H: 1920, arenaTop: 550, arenaH: 820, redEdge: 548, blueEdge: 1372, cx: 540 };
  const coreStageY = (core) => G.arenaTop + G.arenaH / 2 - core * (G.arenaH / 2 / 100);

  const MAX_VISIBLE = 34;

  // ------------------------------------------------------------------
  // أدوات
  // ------------------------------------------------------------------
  const PALETTE = ['#2e8bff', '#ff2d55', '#8a5cff', '#00d1b2', '#ffb020', '#ff6a3d', '#3ddc84', '#e040fb'];
  function fallbackAvatar(name) {
    const letter = [...(name || '?')][0] || '?';
    let h = 0;
    for (const ch of name || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="${PALETTE[h % PALETTE.length]}"/>`
      + `<text x="64" y="84" font-size="60" font-family="Arial" font-weight="bold" fill="#fff" text-anchor="middle">${letter.replace(/[<>&"]/g, '')}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
  const avatar = (u) => (u && u.avatar) || fallbackAvatar(u && u.nickname);
  const fmt = (n) => {
    n = Number(n) || 0;
    if (n >= 1e6) return `${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e4) return `${(n / 1e3).toFixed(1)}K`;
    return n.toLocaleString('en-US');
  };
  const rand = (a, b) => a + Math.random() * (b - a);

  // ------------------------------------------------------------------
  // الأصوات (WebAudio — بدون ملفات)
  // ------------------------------------------------------------------
  const Sound = (() => {
    let ctx = null;
    const ac = () => {
      if (!OPTS.sound) return null;
      try { ctx = ctx || new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
      return ctx;
    };
    function tone(f1, f2, dur, type = 'sine', vol = 0.12, delay = 0) {
      const c = ac(); if (!c) return;
      const t = c.currentTime + delay;
      const o = c.createOscillator(); const g = c.createGain();
      o.type = type;
      o.frequency.setValueAtTime(f1, t);
      o.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(c.destination);
      o.start(t); o.stop(t + dur + 0.05);
    }
    function noise(dur, vol = 0.3, freq = 800, delay = 0) {
      const c = ac(); if (!c) return;
      const t = c.currentTime + delay;
      const buf = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
      const src = c.createBufferSource(); src.buffer = buf;
      const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
      const g = c.createGain(); g.gain.value = vol;
      src.connect(f).connect(g).connect(c.destination);
      src.start(t);
    }
    let lastLaser = 0;
    return {
      laser() { const n = performance.now(); if (n - lastLaser < 70) return; lastLaser = n; tone(1400, 180, 0.18, 'sawtooth', 0.05); },
      join() { tone(660, 990, 0.12, 'triangle', 0.06); },
      mine() { tone(900, 900, 0.06, 'square', 0.04); tone(900, 900, 0.06, 'square', 0.04, 0.12); },
      boom() { noise(0.5, 0.35, 600); tone(120, 40, 0.4, 'sine', 0.2); },
      emp() { tone(80, 1200, 0.35, 'sawtooth', 0.07); noise(0.4, 0.15, 3000, 0.1); },
      overload() {
        tone(60, 30, 1.6, 'sawtooth', 0.18); noise(1.4, 0.45, 400);
        [523, 659, 784, 1046].forEach((f, i) => tone(f, f, 0.35, 'triangle', 0.1, 0.5 + i * 0.12));
      },
      tick(n) { tone(n ? 880 : 1320, n ? 880 : 1320, n ? 0.12 : 0.5, 'square', 0.06); },
      victory() { [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, f, 0.4, 'triangle', 0.1, i * 0.13)); },
    };
  })();

  // ------------------------------------------------------------------
  // محرك المؤثرات (Canvas)
  // ------------------------------------------------------------------
  const FX = {
    ctx: null,
    core: 0,         // الموقع المعروض (منعَّم)
    target: 0,       // الموقع الحقيقي من الخادم
    parts: [],
    beams: [],
    rings: [],
    bolts: [],
    mines: [],
    confetti: null,
    stage: null,

    init() {
      const canvas = document.getElementById('fx');
      this.ctx = canvas.getContext('2d');
      this.stage = document.getElementById('stage');
      this.el = {
        core: document.getElementById('core'),
        flowRed: document.getElementById('flowRed'),
        flowBlue: document.getElementById('flowBlue'),
        glowRed: document.getElementById('glowRed'),
        glowBlue: document.getElementById('glowBlue'),
        front: document.getElementById('front'),
      };
      let last = performance.now();
      const frame = (now) => {
        const dt = Math.min(0.05, (now - last) / 1000);
        last = now;
        this.update(dt);
        this.draw();
        requestAnimationFrame(frame);
      };
      requestAnimationFrame(frame);
    },

    coreY() { return coreStageY(this.core); },

    /** نقطة انطلاق من صورة الجندي في قاعدته، أو من حافة القاعدة */
    originFor(team, userId) {
      const el = userId && document.querySelector(`.base.${team} .soldier[data-id="${CSS.escape(userId)}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        const s = this.stage.getBoundingClientRect();
        const k = s.width / G.W;
        return { x: (r.left + r.width / 2 - s.left) / k, y: (r.top + r.height / 2 - s.top) / k };
      }
      return { x: G.cx + rand(-320, 320), y: team === 'red' ? G.redEdge - 40 : G.blueEdge + 40 };
    },

    burst(x, y, color, n = 30, speed = 500, opts = {}) {
      for (let i = 0; i < n; i++) {
        const a = opts.dir != null ? opts.dir + rand(-opts.spread, opts.spread) : rand(0, Math.PI * 2);
        const v = rand(speed * 0.3, speed);
        this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rand(0.4, 1.1) * (opts.life || 1), age: 0,
          size: rand(2, opts.size || 6), color, drag: opts.drag ?? 2.2, g: opts.g || 0 });
      }
      if (this.parts.length > 1800) this.parts.splice(0, this.parts.length - 1800);
    },

    ring(x, y, color, maxR = 300, dur = 0.7, width = 10) {
      this.rings.push({ x, y, color, maxR, dur, width, age: 0 });
    },

    bolt(x1, y1, x2, y2, color, dur = 0.25) {
      const pts = [[x1, y1]];
      const segs = 10;
      for (let i = 1; i < segs; i++) {
        const t = i / segs;
        pts.push([x1 + (x2 - x1) * t + rand(-30, 30), y1 + (y2 - y1) * t + rand(-30, 30)]);
      }
      pts.push([x2, y2]);
      this.bolts.push({ pts, color, dur, age: 0 });
    },

    laser(team, userId, power = 1) {
      if (this.beams.length > 36) return;
      const o = this.originFor(team, userId);
      this.beams.push({ team, o, age: 0, dur: 0.42, w: Math.min(16, 5 + power * 1.5), jitter: rand(-40, 40) });
      Sound.laser();
    },

    addMines(team, n) {
      for (let i = 0; i < n; i++) this.mines.push({ team, f: rand(0.18, 0.85), x: G.cx + rand(-330, 330), born: performance.now() + i * 90 });
    },

    mineBlast(team) {
      const i = this.mines.findIndex((m) => m.team === team);
      let x = G.cx + rand(-300, 300); let y = this.coreY() + (team === 'blue' ? -120 : 120);
      if (i >= 0) { const p = this.minePos(this.mines[i]); x = p.x; y = p.y; this.mines.splice(i, 1); }
      this.burst(x, y, '#ffb020', 40, 600);
      this.burst(x, y, TEAM[team].color2, 20, 350);
      this.ring(x, y, '#ffcf6b', 170, 0.5, 8);
      Sound.boom();
    },

    minePos(m) {
      const cy = this.coreY();
      return m.team === 'blue'
        ? { x: m.x, y: cy - 150 - m.f * Math.max(0, cy - 150 - G.redEdge) }
        : { x: m.x, y: cy + 150 + m.f * Math.max(0, G.blueEdge - cy - 150) };
    },

    emp(team, target) {
      const cy = this.coreY();
      const ty = target === 'red' ? G.redEdge - 30 : G.blueEdge + 30;
      this.ring(G.cx, cy, '#ffe066', 900, 0.9, 16);
      for (let i = 0; i < 7; i++) this.bolt(G.cx + rand(-80, 80), cy, rand(60, 1020), ty + rand(-40, 40), '#fff3a0', 0.45);
      for (let i = 0; i < 5; i++) this.bolt(rand(0, 300), ty, rand(780, 1080), ty + rand(-30, 30), '#ffe066', 0.6);
      this.burst(G.cx, ty, '#ffe066', 60, 700);
      Sound.emp();
    },

    overload(team, target) {
      const cy = this.coreY();
      const dir = target === 'red' ? -Math.PI / 2 : Math.PI / 2;
      this.ring(G.cx, cy, '#ffffff', 1200, 1.1, 30);
      this.ring(G.cx, cy, TEAM[team].color2, 900, 1.4, 18);
      this.burst(G.cx, cy, TEAM[team].color2, 260, 1600, { dir, spread: 1.1, size: 9, life: 1.5, drag: 1.2 });
      this.burst(G.cx, cy, '#ffffff', 120, 1100, { size: 7 });
      const ty = target === 'red' ? G.redEdge : G.blueEdge;
      for (let i = 0; i < 10; i++) this.bolt(G.cx, cy, rand(40, 1040), ty + rand(-60, 60), '#ffffff', 0.6);
      flash();
    },

    likes(team, count) {
      const n = Math.min(6, 1 + Math.floor(count / 4));
      const y = team === 'red' ? G.redEdge - 20 : G.blueEdge + 20;
      for (let i = 0; i < n; i++) {
        this.parts.push({ x: G.cx + rand(-460, 460), y, vx: rand(-20, 20), vy: team === 'red' ? rand(-40, 10) : rand(-10, 40),
          life: rand(0.6, 1.1), age: 0, size: rand(3, 6), color: TEAM[team].color2, drag: 1, g: 0, heart: true });
      }
    },

    destroyBase(team) {
      const y = team === 'red' ? 350 : 1570;
      for (let i = 0; i < 6; i++) {
        setTimeout(() => {
          const x = rand(120, 960); const yy = y + rand(-120, 120);
          this.burst(x, yy, '#ffb020', 80, 900, { size: 9 });
          this.burst(x, yy, TEAM[team].color, 50, 600);
          this.ring(x, yy, '#fff', 300, 0.6, 12);
          Sound.boom();
        }, i * 180);
      }
      flash();
    },

    update(dt) {
      // تنعيم حركة المفاعل
      const prev = this.core;
      this.core += (this.target - this.core) * Math.min(1, dt * 5);
      const cy = coreStageY(this.core) - G.arenaTop; // داخل الساحة
      const e = this.el;
      e.core.style.transform = `translateY(${(cy - G.arenaH / 2).toFixed(1)}px)`;
      e.flowRed.style.height = `${cy}px`;
      e.glowRed.style.height = `${cy}px`;
      e.flowBlue.style.top = `${cy}px`;
      e.glowBlue.style.top = `${cy}px`;
      e.front.style.top = `${cy}px`;
      if (Math.abs(prev - this.core) > 0.001 || !this.hueSet) {
        this.hueSet = true;
        const t = Math.max(-1, Math.min(1, this.core / 60));
        const hue = t >= 0 ? 270 - t * 55 : 270 + -t * 75;
        document.documentElement.style.setProperty('--core-a', `hsl(${hue} 100% 72%)`);
        document.documentElement.style.setProperty('--core-b', `hsl(${hue} 85% 45%)`);
      }

      for (const p of this.parts) {
        p.age += dt;
        p.vx -= p.vx * p.drag * dt; p.vy -= p.vy * p.drag * dt;
        p.vy += p.g * dt;
        p.x += p.vx * dt; p.y += p.vy * dt;
      }
      this.parts = this.parts.filter((p) => p.age < p.life);
      for (const list of [this.beams, this.rings, this.bolts]) for (const b of list) b.age += dt;
      this.beams = this.beams.filter((b) => b.age < b.dur);
      this.rings = this.rings.filter((r) => r.age < r.dur);
      this.bolts = this.bolts.filter((b) => b.age < b.dur);

      // شرارات عشوائية حول المفاعل
      if (Math.random() < dt * 3) {
        const a = rand(0, Math.PI * 2); const cyS = this.coreY();
        this.bolt(G.cx + Math.cos(a) * 90, cyS + Math.sin(a) * 90, G.cx + Math.cos(a) * rand(160, 230), cyS + Math.sin(a) * rand(160, 230), '#e9dcff', 0.12);
      }
      // احتفال الفوز
      if (this.confetti && performance.now() < this.confetti.until) {
        for (let i = 0; i < 4; i++) {
          this.parts.push({ x: rand(0, G.W), y: -20, vx: rand(-60, 60), vy: rand(300, 600), life: 4, age: 0, size: rand(5, 11),
            color: Math.random() < 0.5 ? this.confetti.c1 : (Math.random() < 0.5 ? this.confetti.c2 : '#ffd23f'), drag: 0.4, g: 150, rect: true, rot: rand(0, 6) });
        }
      }
    },

    draw() {
      const c = this.ctx;
      c.clearRect(0, 0, G.W, G.H);
      c.globalCompositeOperation = 'lighter';
      const cy = this.coreY();

      // الألغام
      const now = performance.now();
      for (const m of this.mines) {
        if (now < m.born) continue;
        const p = this.minePos(m);
        const blink = (Math.sin(now / 120 + m.x) + 1) / 2;
        c.fillStyle = `rgba(255,176,32,${0.25 + blink * 0.5})`;
        c.beginPath(); c.arc(p.x, p.y, 26 + blink * 6, 0, Math.PI * 2); c.fill();
        c.fillStyle = blink > 0.5 ? '#ff3b3b' : '#ffcf6b';
        c.beginPath(); c.arc(p.x, p.y, 10, 0, Math.PI * 2); c.fill();
      }

      // أشعة الليزر
      for (const b of this.beams) {
        const k = 1 - b.age / b.dur;
        const tx = G.cx + b.jitter * k; const ty = cy + (b.team === 'blue' ? 60 : -60);
        const col = TEAM[b.team];
        c.lineCap = 'round';
        c.strokeStyle = `rgba(${col.rgb},${0.35 * k})`; c.lineWidth = b.w * 3.2;
        c.beginPath(); c.moveTo(b.o.x, b.o.y); c.lineTo(tx, ty); c.stroke();
        c.strokeStyle = `rgba(${col.rgb},${0.9 * k})`; c.lineWidth = b.w;
        c.beginPath(); c.moveTo(b.o.x, b.o.y); c.lineTo(tx, ty); c.stroke();
        c.strokeStyle = `rgba(255,255,255,${k})`; c.lineWidth = b.w * 0.35;
        c.beginPath(); c.moveTo(b.o.x, b.o.y); c.lineTo(tx, ty); c.stroke();
        if (b.age < 0.05) this.burst(tx, ty, col.color2, 8, 420, { dir: b.team === 'blue' ? -Math.PI / 2 : Math.PI / 2, spread: 1.2 });
      }

      // الصواعق
      for (const b of this.bolts) {
        const k = 1 - b.age / b.dur;
        c.strokeStyle = b.color; c.globalAlpha = k; c.lineWidth = 3;
        c.shadowColor = b.color; c.shadowBlur = 18;
        c.beginPath(); b.pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y))); c.stroke();
        c.shadowBlur = 0; c.globalAlpha = 1;
      }

      // الموجات
      for (const r of this.rings) {
        const t = r.age / r.dur;
        c.strokeStyle = r.color; c.globalAlpha = 1 - t; c.lineWidth = r.width * (1 - t) + 1;
        c.beginPath(); c.arc(r.x, r.y, r.maxR * (1 - (1 - t) ** 3), 0, Math.PI * 2); c.stroke();
        c.globalAlpha = 1;
      }

      // الجسيمات
      for (const p of this.parts) {
        const k = 1 - p.age / p.life;
        c.globalAlpha = Math.max(0, k);
        c.fillStyle = p.color;
        if (p.rect) {
          c.globalCompositeOperation = 'source-over';
          c.save(); c.translate(p.x, p.y); c.rotate(p.rot + p.age * 6); c.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); c.restore();
          c.globalCompositeOperation = 'lighter';
        } else {
          c.beginPath(); c.arc(p.x, p.y, p.size * (p.heart ? 1 : k + 0.2), 0, Math.PI * 2); c.fill();
        }
      }
      c.globalAlpha = 1;
      c.globalCompositeOperation = 'source-over';
    },
  };

  function flash() {
    const f = document.getElementById('flash');
    f.classList.remove('on'); void f.offsetWidth; f.classList.add('on');
  }

  // ------------------------------------------------------------------
  // مكوّن Alpine
  // ------------------------------------------------------------------
  const emptyTeam = () => ({ energy: 50, shield: 0, jammedMs: 0, likes: 0, coins: 0, mines: 0 });
  const emptyRoster = () => ({ count: 0, members: [], top: [] });

  window.reactorApp = function reactorApp() {
    return {
      TEAM,
      opts: OPTS,
      connected: false,
      s: { phase: 'countdown', phaseEndsAt: null, round: 0, core: 0, teams: { blue: emptyTeam(), red: emptyTeam() } },
      roster: { blue: emptyRoster(), red: emptyRoster() },
      vis: { blue: [], red: [] },
      fresh: {},        // الجنود المنضمون حديثاً (لتشغيل أنيميشن الظهور مرة واحدة)
      known: new Set(),
      commander: null,
      winner: null,
      overload: null,
      feed: [],
      hit: { blue: false, red: false },
      shaking: false,
      now: Date.now(),
      offset: 0,
      battleSeconds: 300,
      minPerTeam: 1,
      lastCd: null,

      fmt, avatar, fallbackAvatar,

      get remaining() { return this.s.phaseEndsAt ? Math.max(0, (this.s.phaseEndsAt - (this.now + this.offset)) / 1000) : 0; },
      get clock() {
        const r = Math.ceil(this.s.phase === 'battle' ? this.remaining : this.battleSeconds);
        return `${String(Math.floor(r / 60)).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`;
      },
      get timePct() { return this.s.phase === 'battle' ? (this.remaining / this.battleSeconds) * 100 : 100; },
      get coreLabel() {
        const c = Math.round(this.s.core);
        if (!c) return '⚛';
        return `${c > 0 ? '▲' : '▼'}${Math.abs(c)}`;
      },

      init() {
        FX.init();
        const fit = () => {
          const k = Math.min(window.innerWidth / G.W, window.innerHeight / G.H);
          document.getElementById('stage').style.transform = `translate(-50%, -50%) scale(${k})`;
        };
        window.addEventListener('resize', fit); fit();
        setInterval(() => { this.now = Date.now(); this.countdownBeep(); }, 200);
        this.overloadQueue = [];
        this.connect();
      },

      connect() {
        const socket = io();
        socket.on('connect', () => { this.connected = true; });
        socket.on('disconnect', () => { this.connected = false; });

        socket.on('state', (st) => {
          this.applyTick(st);
          this.setRoster(st.roster);
          this.commander = st.commander;
          this.winner = st.winner;
          this.battleSeconds = st.battleSeconds || this.battleSeconds;
          this.minPerTeam = st.minPlayersPerTeam || 1;
          if (st.phase !== 'battle') FX.mines = [];
        });
        socket.on('tick', (t) => this.applyTick(t));
        socket.on('roster', (r) => this.setRoster(r));
        socket.on('commander', ({ commander }) => { this.commander = commander; });
        socket.on('victory', (w) => {
          this.winner = w;
          FX.mines = [];
          if (w.team) {
            if (w.reason === 'destroyed') FX.destroyBase(other(w.team));
            FX.confetti = { until: performance.now() + 6000, c1: TEAM[w.team].color, c2: TEAM[w.team].color2 };
          }
          this.shake();
          Sound.victory();
        });
        socket.on('round', () => { this.feed = []; FX.mines = []; });
        socket.on('fx', (f) => this.onFx(f));
      },

      applyTick(t) {
        this.offset = t.serverNow - Date.now();
        this.s = { ...this.s, ...t, teams: t.teams };
        FX.target = t.core;
      },

      setRoster(r) {
        if (!r) return;
        const t = Date.now();
        for (const team of ['blue', 'red']) {
          for (const m of r[team].members) {
            if (this.known.has(m.id)) continue;
            this.known.add(m.id);
            if (this.rosterReady) this.fresh[m.id] = t + 900;
          }
        }
        this.rosterReady = true;
        this.roster = r;
        this.vis = { blue: r.blue.members.slice(0, MAX_VISIBLE), red: r.red.members.slice(0, MAX_VISIBLE) };
      },

      countdownBeep() {
        if (this.s.phase !== 'countdown') { this.lastCd = null; return; }
        const n = Math.ceil(this.remaining);
        if (n !== this.lastCd && n > 0) { this.lastCd = n; Sound.tick(n > 1 ? n : 1); }
      },

      shake() {
        this.shaking = false;
        requestAnimationFrame(() => { this.shaking = true; setTimeout(() => { this.shaking = false; }, 650); });
      },

      hitShield(team) {
        this.hit[team] = true;
        clearTimeout(this['hitT' + team]);
        this['hitT' + team] = setTimeout(() => { this.hit[team] = false; }, 180);
      },

      pushFeed(f) {
        const top = this.feed[0];
        if (f.kind === 'laser' && top && top.kind === 'laser' && top.user.id === f.user.id && Date.now() - top.at < 4000) {
          top.n += f.n; top.at = Date.now();
          top.text = `${f.giftName} ×${top.n}`;
          this.feed = [...this.feed];
          return;
        }
        this.feed = [{ ...f, key: Math.random().toString(36).slice(2), at: Date.now() }, ...this.feed].slice(0, 6);
      },

      onFx(f) {
        const name = f.gift && f.gift.name;
        switch (f.type) {
          case 'join':
            this.pushFeed({ kind: 'join', team: f.team, user: f.user, icon: f.team === 'blue' ? '🔵' : '🔴', text: f.switched ? `انتقل إلى ${TEAM[f.team].name}` : `انضم إلى ${TEAM[f.team].name}` });
            Sound.join();
            break;
          case 'like':
            FX.likes(f.team, f.count);
            break;
          case 'chat':
            FX.laser(f.team, f.user.id, 0);
            break;
          case 'laser': {
            const shots = Math.min(5, f.count);
            for (let i = 0; i < shots; i++) setTimeout(() => FX.laser(f.team, f.user.id, f.gift.diamonds), i * 90);
            if (f.blocked > f.pushed * 0.3) this.hitShield(other(f.team));
            this.pushFeed({ kind: 'laser', team: f.team, user: f.user, icon: '🔫', n: f.count, giftName: name, text: `${name} ×${f.count}` });
            break;
          }
          case 'mines':
            FX.addMines(f.team, f.blasts);
            Sound.mine();
            this.pushFeed({ kind: 'mines', team: f.team, user: f.user, icon: '💣', text: `زرع حقل ألغام! (${name})` });
            break;
          case 'mineBlast':
            FX.mineBlast(f.team);
            if (f.blocked > f.pushed * 0.3) this.hitShield(other(f.team));
            break;
          case 'emp':
            FX.emp(f.team, f.target);
            this.shake();
            this.pushFeed({ kind: 'emp', team: f.team, user: f.user, icon: '⚡', text: `عطّل دفاعات ${TEAM[f.target].name}!` });
            break;
          case 'overload':
            this.pushFeed({ kind: 'overload', team: f.team, user: f.user, icon: '☢', text: `OVERLOAD — ${name} ×${f.count}` });
            this.queueOverload(f);
            break;
          case 'queued':
            this.pushFeed({ kind: 'queued', team: f.team, user: f.user, icon: '⏳', text: `${name} — تُفعَّل مع الجولة القادمة` });
            break;
          default:
        }
      },

      // ---- عرض Overload (بالتتابع حتى لا تتداخل) ----
      queueOverload(f) {
        this.overloadQueue.push(f);
        if (!this.overload) this.nextOverload();
      },
      nextOverload() {
        const f = this.overloadQueue.shift();
        if (!f) { this.overload = null; return; }
        this.overload = f;
        FX.overload(f.team, f.target);
        this.shake();
        Sound.overload();
        setTimeout(() => { this.overload = null; setTimeout(() => this.nextOverload(), 350); }, 5200);
      },
    };
  };
})();
