/* global io */
(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  if (params.get('transparent') === '1') document.body.classList.add('transparent');
  const SOUND = params.get('sound') !== '0';

  const $ = (id) => document.getElementById(id);
  const stage = $('stage');
  const cv = $('space');
  const ctx = cv.getContext('2d');

  // مركز الشمس على المسرح (1080×1920)
  const CX = 540;
  const CY = 790;
  const sx = (x) => CX + x;
  const sy = (y) => CY - y;

  function fit() {
    const s = Math.min(window.innerWidth / 1080, window.innerHeight / 1920);
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  window.addEventListener('resize', fit);
  fit();

  // ------------------------------------------------------------------
  // أدوات
  // ------------------------------------------------------------------
  const COLORS = ['#19b97a', '#3fcf6e', '#4363d8', '#f58231', '#911eb4', '#e6194b', '#008080', '#b5a000'];
  function fallbackAvatar(name) {
    const letter = [...(name || '?')][0] || '?';
    let h = 0;
    for (const ch of name || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="${COLORS[h % COLORS.length]}"/>`
      + `<text x="64" y="84" font-size="60" font-family="Arial" font-weight="bold" fill="#fff" text-anchor="middle">${letter.replace(/[<>&"]/g, '')}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
  function setAvatar(img, player) {
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => { img.onerror = null; img.src = fallbackAvatar(player.nickname); };
    img.src = player.avatar || fallbackAvatar(player.nickname);
  }
  const avatarCache = new Map();
  function avatarImage(p) {
    let img = avatarCache.get(p.id);
    if (!img) { img = new Image(); setAvatar(img, p); avatarCache.set(p.id, img); }
    return img;
  }
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  const lerp = (a, b, k) => a + (b - a) * k;

  // ------------------------------------------------------------------
  // الأصوات (WebAudio)
  // ------------------------------------------------------------------
  let actx = null;
  function tone(freq, dur = 0.15, type = 'sine', vol = 0.12, delay = 0, slideTo = null) {
    if (!SOUND) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime + delay;
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(actx.destination);
      o.start(t); o.stop(t + dur + 0.05);
    } catch { /* تجاهل */ }
  }
  const sfx = {
    join: () => { tone(880, 0.1, 'triangle', 0.07); tone(1320, 0.12, 'triangle', 0.07, 0.08); },
    aim: () => [392, 523, 659].forEach((f, i) => tone(f, 0.2, 'sine', 0.12, i * 0.1)),
    launch: () => { tone(90, 1.4, 'sawtooth', 0.12, 0, 600); tone(180, 1.2, 'triangle', 0.08, 0.1, 900); },
    land: () => [784, 988, 1175].forEach((f, i) => tone(f, 0.18, 'triangle', 0.1, i * 0.07)),
    burn: () => tone(200, 0.4, 'sawtooth', 0.08, 0, 60),
    tick: () => tone(1000, 0.05, 'square', 0.04),
    win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 'triangle', 0.12, i * 0.13)),
  };

  // ------------------------------------------------------------------
  // الخلفية: نجوم وحزام كويكبات
  // ------------------------------------------------------------------
  let seed = 7;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const stars = Array.from({ length: 280 }, () => ({
    x: rnd() * 1080, y: rnd() * 1920, r: 0.6 + rnd() * 1.9, p: rnd() * Math.PI * 2, s: 0.5 + rnd() * 2,
  }));
  const asteroids = Array.from({ length: 140 }, () => ({ r: 365 + rnd() * 28, a: rnd() * Math.PI * 2, s: 0.6 + rnd() * 1.6 }));

  // ------------------------------------------------------------------
  // الحالة
  // ------------------------------------------------------------------
  let state = null;
  let clockOffset = 0;
  const serverNow = () => Date.now() + clockOffset;
  const fx = [];            // تأثيرات: انفجارات ونصوص طائرة
  const firedLanes = new Set(); // المسارات التي عُرضت نتيجتها خلال الرحلة

  const PLANET_STYLE = {
    mars: { color: '#ff6b3d', glow: '#ff9a6b', radius: 30, orbit: 330 },
    jupiter: { color: '#e0a96d', glow: '#f3cf9b', radius: 44, orbit: 420 },
    saturn: { color: '#f2d27a', glow: '#fff0b8', radius: 38, orbit: 500, rings: true },
  };

  /** الزمن منذ الإطلاق (بالثواني) */
  function flightTime() {
    if (!state || !state.launchAt) return 0;
    if (state.phase === 'choosing' || state.phase === 'lobby') return 0;
    const t = (serverNow() - state.launchAt) / 1000;
    const d = state.flight ? state.flight.duration : 0;
    return Math.max(0, state.phase === 'flight' ? Math.min(t, d + 0.5) : d + 0.5);
  }

  /** موقع على المسار في الزمن t (استيفاء خطي بين النقاط) */
  function pathAt(path, t) {
    if (t <= path[0][0]) return { x: path[0][1], y: path[0][2], i: 0, done: false };
    const last = path[path.length - 1];
    if (t >= last[0]) return { x: last[1], y: last[2], i: path.length - 1, done: true };
    let lo = 0; let hi = path.length - 1;
    while (hi - lo > 1) { const m = (lo + hi) >> 1; if (path[m][0] <= t) lo = m; else hi = m; }
    const a = path[lo]; const b = path[hi];
    const k = (t - a[0]) / (b[0] - a[0] || 1);
    return { x: lerp(a[1], b[1], k), y: lerp(a[2], b[2], k), i: lo, done: false, dx: b[1] - a[1], dy: b[2] - a[2] };
  }

  // ------------------------------------------------------------------
  // الرسم
  // ------------------------------------------------------------------
  function drawStars(time) {
    for (const s of stars) {
      const a = 0.35 + 0.65 * (0.5 + 0.5 * Math.sin(time * s.s + s.p));
      ctx.globalAlpha = a;
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawSun(time) {
    const R = 55;
    const pulse = 1 + 0.04 * Math.sin(time * 3);
    let g = ctx.createRadialGradient(CX, CY, R * 0.4, CX, CY, R * 3.4 * pulse);
    g.addColorStop(0, 'rgba(255,210,90,.55)');
    g.addColorStop(0.4, 'rgba(255,140,30,.18)');
    g.addColorStop(1, 'rgba(255,120,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(CX, CY, R * 3.4 * pulse, 0, Math.PI * 2); ctx.fill();
    // ألسنة اللهب
    ctx.save(); ctx.translate(CX, CY); ctx.rotate(time * 0.25);
    for (let i = 0; i < 14; i++) {
      ctx.rotate((Math.PI * 2) / 14);
      const len = R * (1.25 + 0.15 * Math.sin(time * 4 + i * 1.7));
      ctx.fillStyle = 'rgba(255,170,40,.45)';
      ctx.beginPath(); ctx.moveTo(-10, R * 0.8); ctx.lineTo(0, len); ctx.lineTo(10, R * 0.8); ctx.fill();
    }
    ctx.restore();
    g = ctx.createRadialGradient(CX - 16, CY - 18, 6, CX, CY, R);
    g.addColorStop(0, '#fffbe0'); g.addColorStop(0.45, '#ffd23f'); g.addColorStop(1, '#ff8a00');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(CX, CY, R, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(80,30,0,.85)'; ctx.font = '700 22px "Jannat LT", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('الشمس', CX, CY + 8);
  }

  function drawOrbit(r, color, width, dash) {
    ctx.save();
    ctx.strokeStyle = color; ctx.lineWidth = width;
    if (dash) ctx.setLineDash(dash);
    ctx.beginPath(); ctx.arc(CX, CY, r, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function drawPlanetBody(x, y, st, time, highlight) {
    const R = st.radius;
    if (highlight) {
      const k = 0.5 + 0.5 * Math.sin(time * 5);
      ctx.strokeStyle = `rgba(181,239,106,${0.45 + 0.5 * k})`;
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x, y, R + 14 + k * 8, 0, Math.PI * 2); ctx.stroke();
    }
    const glow = ctx.createRadialGradient(x, y, R * 0.6, x, y, R * 2.2);
    glow.addColorStop(0, `${st.glow}66`); glow.addColorStop(1, `${st.glow}00`);
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, R * 2.2, 0, Math.PI * 2); ctx.fill();
    if (st.rings) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.35);
      ctx.strokeStyle = 'rgba(255,240,190,.75)'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.ellipse(0, 0, R * 1.9, R * 0.55, 0, Math.PI, Math.PI * 2); ctx.stroke();
      ctx.restore();
    }
    const g = ctx.createRadialGradient(x - R * 0.35, y - R * 0.35, R * 0.15, x, y, R);
    g.addColorStop(0, '#fff'); g.addColorStop(0.25, st.glow); g.addColorStop(1, st.color);
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
    // أحزمة المشتري
    if (st === PLANET_STYLE.jupiter) {
      ctx.save(); ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.clip();
      ctx.fillStyle = 'rgba(150,80,40,.35)';
      for (const dy of [-0.45, -0.1, 0.3]) ctx.fillRect(x - R, y + dy * R, R * 2, R * 0.16);
      ctx.fillStyle = 'rgba(190,60,40,.8)'; ctx.beginPath(); ctx.ellipse(x + R * 0.3, y + R * 0.42, R * 0.2, R * 0.11, 0, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    if (st.rings) {
      ctx.save(); ctx.translate(x, y); ctx.rotate(-0.35);
      ctx.strokeStyle = 'rgba(255,240,190,.9)'; ctx.lineWidth = 7;
      ctx.beginPath(); ctx.ellipse(0, 0, R * 1.9, R * 0.55, 0, 0, Math.PI); ctx.stroke();
      ctx.restore();
    }
    // ظل الجهة البعيدة عن الشمس
    const ang = Math.atan2(y - CY, x - CX);
    const sh = ctx.createLinearGradient(x - Math.cos(ang) * R, y - Math.sin(ang) * R, x + Math.cos(ang) * R, y + Math.sin(ang) * R);
    sh.addColorStop(0.45, 'rgba(0,0,20,0)'); sh.addColorStop(1, 'rgba(0,0,20,.55)');
    ctx.fillStyle = sh; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
  }

  function drawEarth(time) {
    const x = sx(0); const y = sy(-(state ? state.world.earthOrbit : 230));
    const R = 30;
    const glow = ctx.createRadialGradient(x, y, R * 0.8, x, y, R * 2.3);
    glow.addColorStop(0, 'rgba(90,180,255,.5)'); glow.addColorStop(1, 'rgba(90,180,255,0)');
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(x, y, R * 2.3, 0, Math.PI * 2); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.clip();
    const g = ctx.createRadialGradient(x - 10, y - 10, 4, x, y, R);
    g.addColorStop(0, '#9fe0ff'); g.addColorStop(1, '#1b5fd1');
    ctx.fillStyle = g; ctx.fillRect(x - R, y - R, R * 2, R * 2);
    // قارات تدور
    ctx.fillStyle = '#3fcf6e';
    const off = (time * 14) % (R * 4);
    for (const [cx, cy, rx, ry] of [[-20, -8, 13, 9], [10, 10, 11, 7], [30, -12, 9, 12], [-48, 12, 10, 8]]) {
      for (const k of [0, R * 4]) {
        ctx.beginPath(); ctx.ellipse(x + cx + off - k, y + cy, rx, ry, 0.4, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
    ctx.fillStyle = '#cfe8ff'; ctx.font = '700 22px "Jannat LT", sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('الأرض 🚀', x, y + R + 28);
  }

  function targetPlanetPos(t) {
    const tg = state.target;
    const a = tg.theta0 + tg.omega * t;
    return { x: sx(tg.orbit * Math.cos(a)), y: sy(tg.orbit * Math.sin(a)), a };
  }

  /** مسارات التصويب: أشعة مرقّمة تخرج من الأرض */
  function drawLanes(time) {
    const w = state.world;
    const ex = sx(0); const ey = sy(-w.earthOrbit);
    const counts = state.laneCounts || {};
    const max = Math.max(1, ...Object.values(counts));
    for (const l of w.lanes) {
      const c = counts[l.n] || 0;
      const L = 175;
      const bx = ex + Math.cos(l.angle) * L; const by = ey - Math.sin(l.angle) * L;
      ctx.save();
      ctx.strokeStyle = c ? 'rgba(181,239,106,.75)' : 'rgba(255,255,255,.25)';
      ctx.lineWidth = c ? 4 : 2;
      ctx.setLineDash([10, 10]); ctx.lineDashOffset = -time * 30;
      ctx.beginPath(); ctx.moveTo(ex + Math.cos(l.angle) * 38, ey - Math.sin(l.angle) * 38); ctx.lineTo(bx, by); ctx.stroke();
      ctx.restore();
      const r = 25 + (c / max) * 9;
      const g = ctx.createLinearGradient(bx, by - r, bx, by + r);
      g.addColorStop(0, c ? '#b5ef6a' : '#2b3b5c'); g.addColorStop(1, c ? '#19b97a' : '#15203a');
      ctx.fillStyle = g; ctx.strokeStyle = c ? '#eaffc8' : 'rgba(255,255,255,.4)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(bx, by, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = c ? '#06331f' : '#fff'; ctx.font = `900 ${Math.round(r * 1.05)}px "Jannat LT", sans-serif`; ctx.textAlign = 'center';
      ctx.fillText(String(l.n), bx, by + r * 0.38);
      if (c) {
        ctx.fillStyle = '#ff2e7e'; ctx.beginPath(); ctx.arc(bx + r * 0.8, by - r * 0.8, 15, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = '900 18px "Jannat LT", sans-serif';
        ctx.fillText(String(c), bx + r * 0.8, by - r * 0.8 + 6);
      }
    }
  }

  /** سهم يوضح اتجاه حركة الكوكب في مداره */
  function drawMotionArrow(pos, st) {
    const r = st.orbit;
    const a0 = pos.a + (st.radius + 14) / r;
    const a1 = a0 + 0.42;
    ctx.save();
    ctx.strokeStyle = 'rgba(181,239,106,.9)'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(CX, CY, r, -a0, -a1, true); ctx.stroke();
    const hx = sx(r * Math.cos(a1)); const hy = sy(r * Math.sin(a1));
    const tang = -a1 - Math.PI / 2;
    ctx.translate(hx, hy); ctx.rotate(tang);
    ctx.fillStyle = 'rgba(181,239,106,.95)';
    ctx.beginPath(); ctx.moveTo(14, 0); ctx.lineTo(-8, -11); ctx.lineTo(-8, 11); ctx.fill();
    ctx.restore();
  }

  function drawRocket(x, y, angle, scale, time) {
    ctx.save(); ctx.translate(x, y); ctx.rotate(angle); ctx.scale(scale, scale);
    // اللهب
    const f = 14 + Math.sin(time * 40) * 4;
    const fg = ctx.createLinearGradient(-10, 0, -10 - f, 0);
    fg.addColorStop(0, '#fff6b0'); fg.addColorStop(0.5, '#ff9d1c'); fg.addColorStop(1, 'rgba(255,60,0,0)');
    ctx.fillStyle = fg; ctx.beginPath(); ctx.moveTo(-10, -6); ctx.lineTo(-10 - f, 0); ctx.lineTo(-10, 6); ctx.fill();
    // الجسم
    ctx.fillStyle = '#f4f7ff';
    ctx.beginPath(); ctx.moveTo(18, 0); ctx.quadraticCurveTo(8, -9, -10, -7); ctx.lineTo(-10, 7); ctx.quadraticCurveTo(8, 9, 18, 0); ctx.fill();
    ctx.fillStyle = '#19b97a';
    ctx.beginPath(); ctx.moveTo(-4, -7); ctx.lineTo(-14, -14); ctx.lineTo(-10, -4); ctx.fill();
    ctx.beginPath(); ctx.moveTo(-4, 7); ctx.lineTo(-14, 14); ctx.lineTo(-10, 4); ctx.fill();
    ctx.fillStyle = '#4fb6ff'; ctx.beginPath(); ctx.arc(5, 0, 3.6, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function playersByLane() {
    const m = new Map();
    for (const p of state.players) {
      if (!m.has(p.number)) m.set(p.number, []);
      m.get(p.number).push(p);
    }
    return m;
  }

  function drawFlights(t, time) {
    if (!state.flight) return;
    const groups = playersByLane();
    const showAll = state.phase !== 'flight';
    for (const [laneStr, path] of Object.entries(state.flight.paths)) {
      const lane = Number(laneStr);
      const crew = groups.get(lane) || [];
      const isWindow = state.launchWindow === lane;
      if (!crew.length && !(showAll && isWindow)) continue;
      const head = pathAt(path, t);
      const res0 = state.results ? state.results[lane] : null;
      const evt = state.flight.events ? state.flight.events[lane] : null;
      const landed = (res0 && res0.outcome === 'landed') || (evt && evt.kind === 'landed');
      // الذيل المتوهّج
      ctx.save();
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      if (isWindow && showAll) {
        ctx.strokeStyle = 'rgba(255,210,63,.95)'; ctx.lineWidth = 6; ctx.setLineDash([16, 12]);
      } else {
        ctx.strokeStyle = crew.length ? 'rgba(181,239,106,.85)' : 'rgba(255,255,255,.3)';
        ctx.lineWidth = 4;
        ctx.shadowColor = '#b5ef6a'; ctx.shadowBlur = 14;
      }
      ctx.beginPath();
      const upto = isWindow && showAll ? path.length - 1 : head.i;
      ctx.moveTo(sx(path[0][1]), sy(path[0][2]));
      for (let i = 1; i <= upto; i++) ctx.lineTo(sx(path[i][1]), sy(path[i][2]));
      if (!(isWindow && showAll)) ctx.lineTo(sx(head.x), sy(head.y));
      ctx.stroke();
      ctx.restore();

      if (!crew.length) continue;
      const res = state.results ? state.results[lane] : null;
      const hide = head.done && res && res.outcome !== 'landed';
      if (!hide) {
        const nxt = pathAt(path, t + 0.03);
        let ang = Math.atan2(-(nxt.y - head.y), nxt.x - head.x || 0.0001);
        let hx = sx(head.x); let hy = sy(head.y);
        if (landed && head.done && state.target) {
          // بعد الهبوط يلتصق الصاروخ بالكوكب ويدور معه
          const pos = targetPlanetPos(t);
          const st = PLANET_STYLE[state.planet.id];
          const around = (lane * 2.399) % (Math.PI * 2);
          hx = pos.x + Math.cos(around) * (st.radius + 8);
          hy = pos.y + Math.sin(around) * (st.radius + 8);
          ang = around;
        }
        drawRocket(hx, hy, ang, 1.5, time);
        // صورة أول لاعب في المسار + عدد الركّاب
        const img = avatarImage(crew[0]);
        const ax = hx - Math.cos(ang) * 46; const ay = hy - Math.sin(ang) * 46;
        ctx.save(); ctx.beginPath(); ctx.arc(ax, ay, 19, 0, Math.PI * 2); ctx.closePath();
        ctx.fillStyle = '#123'; ctx.fill(); ctx.clip();
        if (img.complete && img.naturalWidth) ctx.drawImage(img, ax - 19, ay - 19, 38, 38);
        ctx.restore();
        ctx.strokeStyle = '#b5ef6a'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(ax, ay, 19, 0, Math.PI * 2); ctx.stroke();
        if (crew.length > 1) {
          ctx.fillStyle = '#ff2e7e'; ctx.beginPath(); ctx.arc(ax + 16, ay - 16, 13, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#fff'; ctx.font = '900 16px "Jannat LT", sans-serif'; ctx.textAlign = 'center';
          ctx.fillText(String(crew.length), ax + 16, ay - 10);
        }
        ctx.fillStyle = '#fff'; ctx.font = '900 20px "Jannat LT", sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(String(lane), hx, hy - 22);
      }
    }
  }

  /** نتائج المسارات تظهر لحظة حدوثها: هبوط، احتراق، ضياع */
  function triggerLaneEvents(t) {
    if (!state.flight || state.phase !== 'flight' || !state.flight.events) return;
    const groups = playersByLane();
    for (const [laneStr, ev] of Object.entries(state.flight.events)) {
      const lane = Number(laneStr);
      if (firedLanes.has(lane) || t < ev.at || !groups.has(lane)) continue;
      firedLanes.add(lane);
      const path = state.flight.paths[lane];
      const end = path[path.length - 1];
      const x = sx(end[1]); const y = sy(end[2]);
      if (ev.kind === 'sun') { burst(x, y, '#ff9d1c', 40); floatText(x, y - 30, '🔥 احترق!', '#ffb347'); sfx.burn(); }
    }
  }

  function burst(x, y, color, n = 60) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2; const v = 2 + Math.random() * 7;
      fx.push({ kind: 'p', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, color, r: 2 + Math.random() * 4 });
    }
  }
  function floatText(x, y, text, color) {
    fx.push({ kind: 't', x, y, text, color, life: 1 });
  }
  function drawFx(dt) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.life -= dt * (f.kind === 't' ? 0.45 : 0.9);
      if (f.life <= 0) { fx.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, f.life);
      if (f.kind === 'p') {
        f.x += f.vx; f.y += f.vy; f.vx *= 0.96; f.vy *= 0.96;
        ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2); ctx.fill();
      } else {
        f.y -= 0.8;
        ctx.font = '900 36px "Jannat LT", sans-serif'; ctx.textAlign = 'center';
        ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.7)'; ctx.strokeText(f.text, f.x, f.y);
        ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
      }
    }
    ctx.globalAlpha = 1;
  }

  let lastFrame = performance.now();
  function frame(nowMs) {
    const dt = Math.min(0.05, (nowMs - lastFrame) / 1000);
    lastFrame = nowMs;
    const time = nowMs / 1000;
    ctx.clearRect(0, 0, 1080, 1920);
    drawStars(time);

    if (state) {
      const st = state.planet ? PLANET_STYLE[state.planet.id] : null;
      const t = flightTime();

      // المدارات
      drawOrbit(state.world.earthOrbit, 'rgba(120,190,255,.35)', 2, [6, 10]);
      for (const [id, p] of Object.entries(PLANET_STYLE)) {
        const isTarget = st === p;
        drawOrbit(p.orbit, isTarget ? 'rgba(181,239,106,.55)' : 'rgba(255,255,255,.10)', isTarget ? 3 : 2, isTarget ? null : [4, 12]);
        if (id === 'mars') {
          // حزام الكويكبات بين المريخ والمشتري
          ctx.fillStyle = 'rgba(200,190,170,.5)';
          for (const a of asteroids) {
            const ang = a.a + time * 0.03;
            ctx.beginPath(); ctx.arc(CX + a.r * Math.cos(ang), CY - a.r * Math.sin(ang), a.s, 0, Math.PI * 2); ctx.fill();
          }
        }
      }
      drawSun(time);

      // الكواكب غير المستهدفة تدور ببطء للزينة (الأبعد أبطأ — قانون كبلر)
      for (const [id, p] of Object.entries(PLANET_STYLE)) {
        if (st === p) continue;
        const w = Math.sqrt(state.world.GM / p.orbit ** 3) * 0.25;
        const a = id.length * 1.7 + time * w;
        ctx.globalAlpha = 0.3;
        drawPlanetBody(sx(p.orbit * Math.cos(a)), sy(p.orbit * Math.sin(a)), p, time, false);
        ctx.globalAlpha = 1;
      }

      drawEarth(time);
      if (state.phase === 'lobby' || state.phase === 'choosing') drawLanes(time);

      if (st && state.target) {
        const pos = targetPlanetPos(state.phase === 'choosing' ? 0 : t);
        if (state.phase === 'choosing') drawMotionArrow(pos, st);
        drawPlanetBody(pos.x, pos.y, st, time, true);
        ctx.font = '900 30px "Jannat LT", sans-serif'; ctx.textAlign = 'center';
        ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,.7)';
        // الاسم فوق الكوكب، أو تحته إذا كان الكوكب أعلى الشاشة (تحت بطاقة المعلومة)
        const above = pos.y - st.radius - (st.rings ? 30 : 22);
        const ly = above < 330 ? pos.y + st.radius + (st.rings ? 46 : 40) : above;
        ctx.strokeText(`🎯 ${state.planet.name}`, pos.x, ly);
        ctx.fillStyle = '#eaffc8'; ctx.fillText(`🎯 ${state.planet.name}`, pos.x, ly);
        checkLandings(t, pos);
      }

      drawFlights(t, time);
      triggerLaneEvents(t);
    }
    drawFx(dt);
    requestAnimationFrame(frame);
  }

  /** عند وصول صاروخ إلى نهاية مساره بنتيجة «هبوط» نطلق احتفالاً عند الكوكب */
  function checkLandings(t, pos) {
    if (state.phase !== 'flight' || !state.flight || !state.flight.events) return;
    const groups = playersByLane();
    for (const [laneStr, ev] of Object.entries(state.flight.events)) {
      const lane = Number(laneStr);
      if (ev.kind !== 'landed' || firedLanes.has(lane) || t < ev.at || !groups.has(lane)) continue;
      firedLanes.add(lane);
      burst(pos.x, pos.y, '#b5ef6a', 80);
      burst(pos.x, pos.y, '#ffd23f', 40);
      floatText(pos.x, pos.y - 70, `✅ هبوط! +${state.landingPoints || 3}`, '#b5ef6a');
      sfx.land();
    }
  }
  requestAnimationFrame(frame);

  // ------------------------------------------------------------------
  // الواجهة: الشعار والمؤقت والسباق
  // ------------------------------------------------------------------
  function setBanner(text, color) {
    const b = $('banner');
    b.textContent = text;
    b.className = `banner ${color || ''}`;
  }

  let lastTickSecond = null;
  function updateTimer() {
    const t = $('timer');
    if (!state || !state.phaseEndsAt || !['lobby', 'choosing'].includes(state.phase)) { t.classList.add('hidden'); return; }
    const left = Math.max(0, Math.ceil((state.phaseEndsAt - serverNow()) / 1000));
    t.classList.remove('hidden');
    t.classList.toggle('urgent', left <= 3);
    t.firstElementChild.textContent = String(left);
    if (left <= 3 && left > 0 && lastTickSecond !== left) { lastTickSecond = left; sfx.tick(); }
  }
  setInterval(updateTimer, 200);

  const prevScores = new Map();
  function renderRace() {
    const list = $('race');
    list.textContent = '';
    const goal = state.targetScore || 9;
    const top = [...state.players].sort((a, b) => b.score - a.score || a.order - b.order).slice(0, 5);
    if (!top.length) { list.appendChild(el('li', 'empty', 'لا يوجد روّاد بعد — اكتب رقماً للانضمام!')); return; }
    top.forEach((p, i) => {
      const li = el('li');
      const img = el('img'); setAvatar(img, p);
      const track = el('div', 'track');
      const k = Math.min(1, p.score / goal);
      const fill = el('div', 'fill'); fill.style.width = `${k * 100}%`;
      const ship = el('div', 'ship', '🚀'); ship.style.right = `${k * 100}%`;
      track.append(fill, el('div', 'planet-end', '🪐'), ship);
      const sc = el('div', 'sc');
      sc.textContent = `${p.score}/${goal}`;
      if (p.lastPoints && state.phase === 'result') sc.prepend(el('i', '', `+${p.lastPoints}`));
      li.append(el('span', 'rk', String(i + 1)), img, el('span', 'nm', p.nickname), track, sc);
      if ((prevScores.get(p.id) ?? p.score) < p.score) li.classList.add('gain');
      list.appendChild(li);
    });
    for (const p of state.players) prevScores.set(p.id, p.score);
  }

  function renderPhase(prevPhase) {
    const s = state;
    const need = Math.max(0, s.minPlayers - s.players.length);
    const name = s.planet ? s.planet.name : '';

    $('fact').classList.toggle('hidden', !(s.fact && ['choosing', 'result'].includes(s.phase)));
    $('factText').textContent = s.fact || '';
    $('windowBadge').classList.toggle('hidden', !(s.launchWindow && s.phase === 'result'));
    $('windowBadge').querySelector('b').textContent = String(s.launchWindow ?? '?');

    switch (s.phase) {
      case 'lobby':
        if (!s.players.length) setBanner('🚀 اكتب رقماً من 1 إلى 10 للانضمام', 'green');
        else if (need > 0) setBanner(`بانتظار ${need} رائد فضاء إضافي`, 'green');
        else if (!s.phaseEndsAt) setBanner('بانتظار بدء الرحلة من المضيف', 'gold');
        else setBanner('العدّ التنازلي بدأ — انضم الآن!', 'green');
        break;
      case 'choosing':
        setBanner(`🎯 الهدف: ${name} — اختر مسارك!`, 'green');
        if (prevPhase !== 'choosing') { sfx.aim(); firedLanes.clear(); }
        break;
      case 'flight':
        setBanner('🚀 الإطلاق! راقب الجاذبية...', 'blue');
        if (prevPhase !== 'flight') { sfx.launch(); firedLanes.clear(); }
        break;
      case 'result': {
        const r = s.lastResult;
        const landed = r ? r.landed.length : 0;
        setBanner(landed ? `🎉 هبط ${landed} على ${name}!` : `لم يهبط أحد — النافذة كانت ${s.launchWindow}`, landed ? 'gold' : 'red');
        break;
      }
      case 'winner': setBanner('🏆 لدينا بطل فضاء!', 'gold'); break;
      case 'gameover': setBanner('🌌 انتهت الرحلة بدون فائز', 'red'); break;
      default:
    }

    $('winner').classList.toggle('hidden', s.phase !== 'winner');
    $('gameover').classList.toggle('hidden', s.phase !== 'gameover');
    if (s.phase === 'winner' && s.winner) showWinner(s.winner, s.round, prevPhase !== 'winner');
    if (s.phase !== 'winner') stopConfetti();

    $('round').textContent = s.round ? `${s.round}/${s.maxRounds}` : '0';
    $('count').textContent = String(s.players.length);
    $('goal').textContent = String(s.targetScore);
    $('raceGoal').textContent = `أول من يجمع ${s.targetScore} نقاط يفوز`;
    $('minN').textContent = String(s.minNumber);
    $('maxN').textContent = String(s.maxNumber);
  }

  // ------------------------------------------------------------------
  // بطاقات الانضمام
  // ------------------------------------------------------------------
  const MAX_CARDS = 1;
  function showCard(p, kind) {
    const box = $('cards');
    const cards = [...box.querySelectorAll('.card:not(.out)')];
    if (cards.length >= MAX_CARDS) removeCard(cards[0]);
    const c = el('div', `card ${kind === 'changed' ? 'changed' : ''}`);
    const img = el('img'); setAvatar(img, p);
    const info = el('div', 'info');
    info.append(
      el('div', 'tag', kind === 'changed' ? 'غيّر مساره' : 'انضم إلى الرحلة 🚀'),
      el('div', 'name', p.nickname),
      el('div', 'user', `@${p.uniqueId}`),
    );
    const big = el('div', 'big', 'المسار');
    big.appendChild(el('b', '', String(p.number)));
    c.append(img, info, big);
    box.appendChild(c);
    c._t = setTimeout(() => removeCard(c), 3200);
  }
  function removeCard(c) {
    clearTimeout(c._t);
    c.classList.add('out');
    setTimeout(() => c.remove(), 400);
  }

  // ------------------------------------------------------------------
  // الفوز: احتفال نجوم
  // ------------------------------------------------------------------
  let confettiRAF = null;
  function showWinner(w, rounds, fresh) {
    setAvatar($('winAvatar'), w);
    $('winName').textContent = w.nickname;
    $('winUser').textContent = `@${w.uniqueId}`;
    $('winInfo').textContent = `${w.score} نقطة • ${w.landings} هبوط ناجح • ${rounds} جول${rounds === 1 ? 'ة' : 'ات'}`;
    if (fresh) { sfx.win(); startConfetti(); }
  }
  function startConfetti() {
    const c = $('confetti');
    const g = c.getContext('2d');
    const colors = ['#b5ef6a', '#19b97a', '#ffd23f', '#ffffff', '#4fb6ff'];
    const parts = Array.from({ length: 200 }, () => ({
      x: Math.random() * 1080, y: -Math.random() * 1920, s: 8 + Math.random() * 14,
      vy: 3 + Math.random() * 6, vx: -2 + Math.random() * 4, r: Math.random() * 6, vr: -0.15 + Math.random() * 0.3,
      c: colors[Math.floor(Math.random() * colors.length)],
    }));
    cancelAnimationFrame(confettiRAF);
    const step = () => {
      g.clearRect(0, 0, 1080, 1920);
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.r += p.vr;
        if (p.y > 1940) { p.y = -20; p.x = Math.random() * 1080; }
        g.save(); g.translate(p.x, p.y); g.rotate(p.r); g.fillStyle = p.c;
        g.beginPath();
        for (let i = 0; i < 10; i++) { const rr = i % 2 ? p.s * 0.45 : p.s; const a = (i * Math.PI) / 5; g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); }
        g.fill(); g.restore();
      }
      confettiRAF = requestAnimationFrame(step);
    };
    step();
  }
  function stopConfetti() { cancelAnimationFrame(confettiRAF); confettiRAF = null; }

  // ------------------------------------------------------------------
  // الاتصال بالخادم
  // ------------------------------------------------------------------
  const socket = io();
  socket.on('connect', () => $('conn').classList.add('hidden'));
  socket.on('disconnect', () => $('conn').classList.remove('hidden'));

  // إذا غيّر المضيف اللعبة النشطة وكانت هذه الشاشة هي "/" ننتقل تلقائياً
  socket.on('activeGame', (g) => {
    if ((location.pathname === '/' || location.pathname === '/index.html') && g.active !== 'planets') location.reload();
  });

  socket.on('state', (s) => {
    if (s.kind !== 'planets') return;
    const prev = state;
    if (prev && prev.gameNumber !== s.gameNumber) { avatarCache.clear(); prevScores.clear(); }
    state = s;
    clockOffset = s.serverNow - Date.now();
    renderRace();
    renderPhase(prev ? prev.phase : null);
    updateTimer();
  });

  socket.on('join', (p) => { if (state && state.kind === 'planets') { showCard(p, 'join'); sfx.join(); } });
  socket.on('numberChanged', (p) => { if (state && state.kind === 'planets') showCard(p, 'changed'); });
})();
