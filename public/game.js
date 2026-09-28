/* global io */
(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  if (params.get('transparent') === '1') document.body.classList.add('transparent');
  const SOUND = params.get('sound') !== '0';

  const $ = (id) => document.getElementById(id);
  const stage = $('stage');

  // ------------------------------------------------------------------
  // ملاءمة المسرح 1080×1920 لأي حجم نافذة
  // ------------------------------------------------------------------
  function fit() {
    const s = Math.min(window.innerWidth / 1080, window.innerHeight / 1920);
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  window.addEventListener('resize', fit);
  fit();

  // ------------------------------------------------------------------
  // أدوات
  // ------------------------------------------------------------------
  const COLORS = ['#ff2e7e', '#18c7a4', '#4363d8', '#f58231', '#911eb4', '#3cb44b', '#e6194b', '#008080'];
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
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // ------------------------------------------------------------------
  // الأصوات (مولّدة عبر WebAudio — لا ملفات خارجية)
  // ------------------------------------------------------------------
  let actx = null;
  function tone(freq, dur = 0.15, type = 'sine', vol = 0.15, delay = 0) {
    if (!SOUND) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      const t = actx.currentTime + delay;
      const o = actx.createOscillator();
      const g = actx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(actx.destination);
      o.start(t); o.stop(t + dur + 0.05);
    } catch { /* تجاهل */ }
  }
  const sfx = {
    join: () => { tone(880, 0.1, 'triangle', 0.08); tone(1320, 0.12, 'triangle', 0.08, 0.08); },
    green: () => { tone(523, 0.15, 'sine'); tone(659, 0.15, 'sine', 0.15, 0.12); tone(784, 0.25, 'sine', 0.15, 0.24); },
    red: () => { tone(220, 0.5, 'sawtooth', 0.12); tone(165, 0.6, 'sawtooth', 0.1, 0.25); },
    out: () => tone(90, 0.35, 'square', 0.12),
    step: () => tone(660, 0.08, 'triangle', 0.06),
    tick: () => tone(1000, 0.05, 'square', 0.05),
    win: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 'triangle', 0.14, i * 0.13)),
  };

  // ------------------------------------------------------------------
  // الحالة والملعب
  // ------------------------------------------------------------------
  let state = null;
  let clockOffset = 0;
  const tokens = new Map(); // id -> { el, img, num, nm }

  const FIELD_W = 1020;
  const FIELD_H = 990;
  const Y_START = FIELD_H - 125; // مركز اللاعب عند البداية
  const Y_FINISH = 95;           // مركز اللاعب عند خط النهاية

  function tokenSize(n) {
    if (n <= 16) return 88;
    if (n <= 40) return 68;
    if (n <= 90) return 52;
    return 40;
  }
  function yFor(pos, track) {
    const r = Math.min(pos, track) / track;
    return Y_START + (Y_FINISH - Y_START) * r;
  }
  function xFor(lane, size) {
    const margin = 50 + size / 2;
    return margin + lane * (FIELD_W - 2 * margin);
  }

  function drawTicks(track) {
    const box = $('ticks');
    if (box.dataset.track === String(track)) return;
    box.dataset.track = String(track);
    box.textContent = '';
    const step = track <= 30 ? 5 : 10;
    for (let i = step; i < track; i += step) {
      const t = el('div', 'tick', String(i));
      t.style.top = `${yFor(i, track)}px`;
      box.appendChild(t);
    }
  }

  function ensureToken(p) {
    let t = tokens.get(p.id);
    if (t) return t;
    const root = el('div', 'token new');
    const av = el('div', 'av');
    const img = el('img');
    setAvatar(img, p);
    const num = el('div', 'num', String(p.number));
    av.append(img, num);
    const nm = el('div', 'nm', p.nickname);
    root.append(av, nm);
    $('tokens').appendChild(root);
    setTimeout(() => root.classList.remove('new'), 700);
    t = { el: root, img, num, nm, number: p.number, dead: false };
    tokens.set(p.id, t);
    return t;
  }

  function renderPlayers() {
    const players = state.players;
    const ids = new Set(players.map((p) => p.id));
    for (const [id, t] of tokens) {
      if (!ids.has(id)) { t.el.remove(); tokens.delete(id); }
    }

    const alive = players.filter((p) => p.alive);
    const size = tokenSize(alive.length || players.length);
    const leaderId = state.phase !== 'lobby' && alive.length
      ? [...alive].sort((a, b) => b.position - a.position || a.order - b.order)[0].id : null;

    for (const p of players) {
      if (!p.alive && !tokens.has(p.id)) continue; // خرج قبل فتح الصفحة
      const t = ensureToken(p);
      t.el.style.setProperty('--size', `${size}px`);
      t.el.classList.toggle('small', size <= 52);
      t.el.style.left = `${xFor(p.lane, size)}px`;
      // إزاحة رأسية بسيطة حسب ترتيب الانضمام لتقليل التداخل بين اللاعبين في نفس الموقع
      const stagger = ((p.order % 3) - 1) * size * 0.3;
      t.el.style.top = `${yFor(p.position, state.trackLength) + stagger}px`;
      t.el.classList.toggle('leader', p.id === leaderId && p.position > 0);
      if (t.number !== p.number) {
        t.number = p.number;
        t.num.textContent = String(p.number);
        t.el.classList.remove('changed'); void t.el.offsetWidth; t.el.classList.add('changed');
      }
      if (!p.alive && !t.dead) {
        t.dead = true;
        t.el.classList.add('dying');
        setTimeout(() => { t.el.classList.remove('dying'); t.el.classList.add('dead'); }, 1800);
      }
    }
  }

  function renderLeaders() {
    const list = $('leaders');
    list.textContent = '';
    const alive = state.players.filter((p) => p.alive)
      .sort((a, b) => b.position - a.position || a.order - b.order).slice(0, 5);
    if (!alive.length) { list.appendChild(el('li', 'empty', 'لا يوجد لاعبون بعد')); return; }
    alive.forEach((p, i) => {
      const li = el('li');
      const img = el('img'); setAvatar(img, p);
      li.append(el('span', '', `${i + 1}.`), img, el('span', 'n', p.nickname), el('span', 'p', `${p.position}/${state.trackLength}`));
      list.appendChild(li);
    });
  }

  // ------------------------------------------------------------------
  // الدمية والشعار والمؤقت
  // ------------------------------------------------------------------
  let rollTimer = null;
  function setDoll(mode) {
    const d = $('doll');
    d.classList.toggle('back', mode === 'back');
    d.classList.toggle('turning', mode === 'turning');
    d.classList.toggle('red', mode === 'red');
  }
  function showDollNumber(value, rolling) {
    const box = $('dollNumber');
    clearInterval(rollTimer);
    if (value === null && !rolling) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    box.classList.toggle('rolling', Boolean(rolling));
    const b = box.querySelector('b');
    if (rolling) {
      rollTimer = setInterval(() => {
        b.textContent = String(1 + Math.floor(Math.random() * (state.maxNumber || 10)));
        sfx.tick();
      }, 110);
    } else {
      b.textContent = String(value);
    }
  }
  function setBanner(text, color) {
    const b = $('banner');
    b.textContent = text;
    b.className = `banner ${color || ''}`;
  }

  let lastTickSecond = null;
  function updateTimer() {
    const t = $('timer');
    const showFor = ['lobby', 'choosing'];
    if (!state || !state.phaseEndsAt || !showFor.includes(state.phase)) { t.classList.add('hidden'); return; }
    const left = Math.max(0, Math.ceil((state.phaseEndsAt - (Date.now() + clockOffset)) / 1000));
    t.classList.remove('hidden');
    t.classList.toggle('urgent', left <= 3);
    t.firstElementChild.textContent = String(left);
    if (left <= 3 && left > 0 && lastTickSecond !== left) { lastTickSecond = left; sfx.tick(); }
  }
  setInterval(updateTimer, 200);

  function renderPhase(prevPhase) {
    const s = state;
    const alive = s.aliveCount;
    const need = Math.max(0, s.minPlayers - s.players.length);
    const msg = $('fieldMsg');
    msg.textContent = '';
    document.body.classList.toggle('phase-red', s.phase === 'doll' || s.phase === 'result');

    switch (s.phase) {
      case 'lobby':
        setDoll('back'); showDollNumber(null);
        if (!s.players.length) {
          setBanner('اكتب رقماً للانضمام', 'green');
          msg.textContent = 'بانتظار اللاعبين...\nاكتب رقماً من 1 إلى 10';
        } else if (need > 0) {
          setBanner(`بانتظار ${need} لاعب${need > 1 ? 'ين' : ''} إضافي${need > 1 ? 'ين' : ''}`, 'green');
        } else if (!s.phaseEndsAt) {
          setBanner('بانتظار بدء اللعبة من المضيف', 'gold');
        } else {
          setBanner('الانضمام مفتوح — اكتب رقمك الآن!', 'green');
        }
        break;
      case 'choosing':
        setDoll('back'); showDollNumber(null);
        setBanner('🟢 الضوء الأخضر — غيّر رقمك الآن!', 'green');
        if (prevPhase !== 'choosing') sfx.green();
        break;
      case 'doll':
        setDoll('turning'); showDollNumber(null, true);
        setBanner('🔴 الضوء الأحمر! الدمية تختار...', 'red');
        if (prevPhase !== 'doll') sfx.red();
        break;
      case 'result': {
        setDoll('red'); showDollNumber(s.dollNumber, false);
        const r = s.lastResult;
        const out = r ? r.eliminated.length : 0;
        setBanner(out ? `الدمية اختارت ${s.dollNumber} — خرج ${out}` : `الدمية اختارت ${s.dollNumber} — نجا الجميع!`, 'red');
        break;
      }
      case 'winner':
        setDoll('back'); showDollNumber(s.dollNumber, false);
        setBanner('🏆 لدينا فائز!', 'gold');
        break;
      case 'gameover':
        setDoll('red'); showDollNumber(s.dollNumber, false);
        setBanner('💀 خرج الجميع!', 'red');
        break;
      default:
    }
    msg.style.whiteSpace = 'pre-line';

    $('winner').classList.toggle('hidden', s.phase !== 'winner');
    $('gameover').classList.toggle('hidden', s.phase !== 'gameover');
    if (s.phase === 'winner' && s.winner) showWinner(s.winner, s.round, prevPhase !== 'winner');
    if (s.phase !== 'winner') stopConfetti();

    $('round').textContent = String(s.round);
    $('alive').textContent = String(alive);
    $('out').textContent = String(s.players.length - alive);
    $('minN').textContent = String(s.minNumber);
    $('maxN').textContent = String(s.maxNumber);
  }

  // ------------------------------------------------------------------
  // بطاقات الانضمام الشخصية
  // ------------------------------------------------------------------
  const MAX_CARDS = 3;
  function showCard(p, kind) {
    const box = $('cards');
    const cards = [...box.querySelectorAll('.card:not(.out)')];
    if (cards.length >= MAX_CARDS) removeCard(cards[0]);

    const c = el('div', `card ${kind === 'changed' ? 'changed' : ''}`);
    const img = el('img'); setAvatar(img, p);
    const info = el('div', 'info');
    info.append(
      el('div', 'tag', kind === 'changed' ? 'غيّر رقمه' : 'انضم إلى اللعبة'),
      el('div', 'name', p.nickname),
      el('div', 'user', `@${p.uniqueId}`),
    );
    c.append(img, info, el('div', 'big', String(p.number)));
    box.appendChild(c);
    c._t = setTimeout(() => removeCard(c), 3500);
  }
  function removeCard(c) {
    clearTimeout(c._t);
    c.classList.add('out');
    setTimeout(() => c.remove(), 400);
  }

  // ------------------------------------------------------------------
  // شاشة الفوز + قصاصات الاحتفال
  // ------------------------------------------------------------------
  let confettiRAF = null;
  function showWinner(w, rounds, fresh) {
    setAvatar($('winAvatar'), w);
    $('winName').textContent = w.nickname;
    $('winUser').textContent = `@${w.uniqueId}`;
    $('winInfo').textContent = `وصل إلى خط النهاية في ${rounds} جول${rounds === 1 ? 'ة' : 'ات'} برقم ${w.number}`;
    if (fresh) { sfx.win(); startConfetti(); }
  }
  function startConfetti() {
    const cv = $('confetti');
    cv.width = 1080; cv.height = 1920;
    const ctx = cv.getContext('2d');
    const colors = ['#ffd23f', '#ff2e7e', '#18c7a4', '#ffffff', '#4363d8'];
    const parts = Array.from({ length: 220 }, () => ({
      x: Math.random() * 1080, y: -Math.random() * 1920, w: 10 + Math.random() * 14, h: 6 + Math.random() * 10,
      vy: 4 + Math.random() * 6, vx: -2 + Math.random() * 4, r: Math.random() * 6, vr: -0.2 + Math.random() * 0.4,
      c: colors[Math.floor(Math.random() * colors.length)],
    }));
    cancelAnimationFrame(confettiRAF);
    const frame = () => {
      ctx.clearRect(0, 0, 1080, 1920);
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.r += p.vr;
        if (p.y > 1940) { p.y = -20; p.x = Math.random() * 1080; }
        ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c; ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx.restore();
      }
      confettiRAF = requestAnimationFrame(frame);
    };
    frame();
  }
  function stopConfetti() {
    cancelAnimationFrame(confettiRAF);
    confettiRAF = null;
  }

  // ------------------------------------------------------------------
  // الاتصال بالخادم
  // ------------------------------------------------------------------
  const socket = io();
  socket.on('connect', () => $('conn').classList.add('hidden'));
  socket.on('disconnect', () => $('conn').classList.remove('hidden'));

  socket.on('state', (s) => {
    const prev = state;
    // لعبة جديدة => امسح لاعبي اللعبة السابقة
    if (prev && prev.gameNumber !== s.gameNumber) {
      for (const t of tokens.values()) t.el.remove();
      tokens.clear();
    }
    state = s;
    clockOffset = s.serverNow - Date.now();
    drawTicks(s.trackLength);
    renderPlayers();
    renderLeaders();
    renderPhase(prev ? prev.phase : null);
    updateTimer();
  });

  socket.on('join', (p) => { showCard(p, 'join'); sfx.join(); });
  socket.on('numberChanged', (p) => showCard(p, 'changed'));

  socket.on('roundResult', (r) => {
    if (r.eliminated.length) setTimeout(sfx.out, 150);
    if (r.advanced.length) setTimeout(sfx.step, 300);
    // إظهار "+N" فوق كل لاعب تقدّم
    setTimeout(() => {
      for (const a of r.advanced) {
        const t = tokens.get(a.id);
        if (!t) continue;
        const mv = el('div', 'mv', `+${a.to - a.from}`);
        t.el.querySelector('.av').appendChild(mv);
        setTimeout(() => mv.remove(), 2300);
      }
    }, 50);
  });
})();
