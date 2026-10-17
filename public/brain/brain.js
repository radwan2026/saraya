/* global io */
(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  if (params.get('transparent') === '1') document.body.classList.add('transparent');
  const SOUND = params.get('sound') !== '0';
  const MUSIC = params.get('music') !== '0';
  const Music = window.BrainMusic;
  const Voice = window.BrainVoice;

  const $ = (id) => document.getElementById(id);
  const stage = $('stage');
  const Views = window.PuzzleViews;

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
  function el(tag, cls, text, parent) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    if (parent) parent.appendChild(e);
    return e;
  }
  const COLORS = ['#7c3aed', '#06b6d4', '#f59e0b', '#ef4444', '#10b981', '#ec4899', '#3b82f6'];
  function fallbackAvatar(name) {
    const letter = [...(name || '?')][0] || '?';
    let h = 0;
    for (const ch of name || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="${COLORS[h % COLORS.length]}"/>`
      + `<text x="64" y="84" font-size="60" font-family="Arial" font-weight="bold" fill="#fff" text-anchor="middle">${letter.replace(/[<>&"]/g, '')}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
  function avatar(player, cls = 'av') {
    const img = el('img', cls);
    img.referrerPolicy = 'no-referrer';
    img.alt = '';
    img.onerror = () => { img.onerror = null; img.src = fallbackAvatar(player.nickname); };
    img.src = player.avatar || fallbackAvatar(player.nickname);
    return img;
  }
  const restart = (node, cls) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); };
  let clockOffset = 0;
  const serverNow = () => Date.now() + clockOffset;

  // ------------------------------------------------------------------
  // الأصوات — مولّدة عبر WebAudio (بدون ملفات)
  // ------------------------------------------------------------------
  let actx = null;
  function ctx() {
    if (!SOUND) return null;
    try {
      if (!actx) {
        actx = new (window.AudioContext || window.webkitAudioContext)();
        Music.attach(actx);
        Music.setEnabled(MUSIC);
        const vol = Number(params.get('vol'));
        if (params.has('vol') && Number.isFinite(vol)) Music.setVolume(vol);
      }
    } catch { return null; }
    if (actx.state === 'suspended') actx.resume().catch(() => {});
    return actx;
  }
  const out = (a) => Music.sfxOut() || a.destination;
  function tone(freq, dur = 0.15, type = 'sine', vol = 0.15, delay = 0, slideTo) {
    const a = ctx(); if (!a) return;
    const t = a.currentTime + delay;
    const o = a.createOscillator(); const g = a.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(out(a));
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noise(dur = 0.4, vol = 0.12, delay = 0, from = 400, to = 4000, q = 1) {
    const a = ctx(); if (!a) return;
    const t = a.currentTime + delay;
    const buf = a.createBuffer(1, Math.floor(a.sampleRate * dur), a.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = a.createBufferSource(); src.buffer = buf;
    const f = a.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = q;
    f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(out(a));
    src.start(t); src.stop(t + dur);
  }
  const sfx = {
    whoosh: () => noise(0.6, 0.18, 0, 300, 5000, 0.8),
    boom: () => { tone(110, 0.9, 'sine', 0.3, 0, 40); noise(0.5, 0.1, 0, 200, 80, 0.6); },
    tick: () => tone(1250, 0.05, 'square', 0.05),
    tock: () => tone(880, 0.05, 'square', 0.05),
    heart: () => { tone(70, 0.16, 'sine', 0.4); tone(62, 0.18, 'sine', 0.32, 0.2); },
    lock: () => { tone(1500, 0.04, 'triangle', 0.05); tone(2100, 0.05, 'triangle', 0.04, 0.04); },
    join: () => { tone(880, 0.1, 'triangle', 0.07); tone(1320, 0.12, 'triangle', 0.07, 0.08); },
    timeup: () => { tone(220, 0.6, 'sawtooth', 0.14, 0, 110); noise(0.4, 0.12, 0, 900, 200); },
    step: () => tone(740, 0.12, 'triangle', 0.09),
    ding: () => { [988, 1319, 1976].forEach((f, i) => tone(f, 0.5, 'sine', 0.1, i * 0.07)); },
    stamp: () => { tone(90, 0.3, 'sine', 0.35, 0, 50); noise(0.15, 0.15, 0, 3000, 600); },
    wrong: () => tone(160, 0.35, 'square', 0.08),
    flip: () => { noise(0.25, 0.12, 0, 2000, 6000, 1.5); tone(500, 0.15, 'triangle', 0.08, 0, 900); },
    rise: () => tone(200, 1.6, 'sawtooth', 0.06, 0, 1200),
    drum: (sec = 2.6) => { for (let t = 0; t < sec; t += 0.07) noise(0.08, 0.05 + (t / sec) * 0.12, t, 120, 300, 2); },
    fanfare: () => {
      [[523, 0], [659, 0.14], [784, 0.28], [1047, 0.42], [784, 0.62], [1047, 0.76]].forEach(([f, d]) => {
        tone(f, 0.45, 'triangle', 0.14, d); tone(f / 2, 0.45, 'sawtooth', 0.04, d);
      });
      tone(1319, 1.2, 'triangle', 0.12, 0.95);
    },
    pop: () => { noise(0.12, 0.1, 0, 800, 6000, 2); tone(300, 0.1, 'sine', 0.1, 0, 900); },
    // مؤثرات قوية
    hit: () => { Music.duck(0.25, 0.4); tone(60, 0.7, 'sine', 0.5, 0, 30); noise(0.9, 0.16, 0, 9000, 3000, 0.4); },
    crash: () => noise(1.6, 0.14, 0, 12000, 4000, 0.3),
    drop: () => { Music.duck(0.15, 1.2); tone(160, 1.4, 'sine', 0.55, 0, 28); tone(80, 1.4, 'square', 0.08, 0, 20); noise(1.8, 0.16, 0.05, 10000, 2500, 0.3); },
    hype: () => [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.22, 'square', 0.06, i * 0.06)),
    shutter: () => { noise(0.05, 0.2, 0, 6000, 6000, 1); noise(0.08, 0.15, 0.08, 3000, 3000, 1); },
    applause: () => { for (let t = 0; t < 2.6; t += 0.035) noise(0.05, 0.03 + Math.random() * 0.05 * (1 - t / 3), t, 1500 + Math.random() * 2500, 2500, 1.5); },
  };
  window.BrainFX = { sfx: (name) => sfx[name]?.() };
  // OBS / LIVE Studio يشغّلان الصوت تلقائياً؛ المتصفح العادي يحتاج نقرة — نُظهر زراً لذلك
  ctx();
  const voiceReady = Voice.init().then(() => Voice.preload());
  const soundBtn = $('soundBtn');
  const checkAudio = () => soundBtn.classList.toggle('hidden', !SOUND || !actx || actx.state === 'running');
  window.addEventListener('pointerdown', () => { ctx(); setTimeout(checkAudio, 200); });
  setInterval(checkAudio, 1000);

  // نبض مع إيقاع الموسيقى
  window.addEventListener('brain:beat', () => restart(stage, 'kick'));

  /** وميض شاشة كامل (كاميرا/انفجار ضوئي) */
  function flash(strength = 1) {
    const f = $('flash');
    f.style.setProperty('--f', String(strength));
    restart(f, 'go');
  }
  /** اهتزاز الشاشة كلها لحظة الضربة */
  function quake() { restart(stage, 'quake'); }

  // ------------------------------------------------------------------
  // جزيئات الخلفية
  // ------------------------------------------------------------------
  (function particles() {
    const box = $('particles');
    for (let i = 0; i < 26; i++) {
      const p = el('i', '', undefined, box);
      p.style.left = `${Math.random() * 100}%`;
      p.style.animationDuration = `${10 + Math.random() * 16}s`;
      p.style.animationDelay = `${-Math.random() * 20}s`;
      p.style.setProperty('--s', `${2 + Math.random() * 5}px`);
      p.textContent = Math.random() < 0.3 ? ['?', '+', '×', '÷', '∑', 'π'][i % 6] : '';
    }
  }());

  // ------------------------------------------------------------------
  // الحالة
  // ------------------------------------------------------------------
  let state = null;
  let viewKey = null;    // gameNumber:roundIndex للعرض المركّب حالياً
  let view = null;
  let revealTimers = [];
  let finaleTimers = [];
  let prevRanks = new Map();
  let introTimers = [];
  let voiceTimer = null;
  let welcomeLoop = null;
  let hypeShown = new Set();

  // مزاج الموسيقى لكل مرحلة (بطاقة العنوان صامتة لتبرز الضربات، والتتويج يبدأ بقرع طبول)
  const MOODS = { lobby: 'lobby', intro: 'silent', question: 'question', reveal: 'reveal', leaderboard: 'board', finale: 'silent' };
  const SCREENS = { lobby: 'lobby', intro: 'intro', question: 'play', reveal: 'play', leaderboard: 'board-screen', finale: 'finale' };
  const ACCENTS = { detective: '#f59e0b', machine: '#38bdf8', circuit: '#22d3ee', illusion: '#a78bfa', science: '#34d399', final: '#f472b6' };

  function showScreen(id) {
    for (const s of document.querySelectorAll('.screen')) s.classList.toggle('active', s.id === id);
  }

  /** انتقال سينمائي: مصراعان يغلقان ثم ينفتحان */
  function shutter(cb) {
    const sh = $('shutter');
    restart(sh, 'go');
    sfx.whoosh();
    setTimeout(() => flash(0.35), 300);
    setTimeout(cb, 330);
  }

  function toast(text) {
    const t = $('toast');
    t.textContent = text;
    restart(t, 'show');
  }

  // ------------------------------------------------------------------
  // الشريط العلوي: تقدّم الجولات
  // ------------------------------------------------------------------
  function renderProgress(s) {
    const box = $('progress');
    const order = s.order || [];
    if (box.children.length !== s.totalRounds) {
      box.textContent = '';
      for (let i = 0; i < s.totalRounds; i++) el('i', '', String(i + 1), box);
    }
    [...box.children].forEach((d, i) => {
      d.className = i < s.roundIndex || (i === s.roundIndex && ['leaderboard', 'finale'].includes(s.phase)) ? 'done'
        : i === s.roundIndex ? 'now' : '';
      if (order[i]) d.style.setProperty('--c', ACCENTS[order[i]] || '#a78bfa');
    });
    $('playerCount').textContent = String(s.playerCount);
  }

  // ------------------------------------------------------------------
  // الاستوديو
  // ------------------------------------------------------------------
  const lobbyAv = new Set();
  function renderLobby(s) {
    const prev = $('roundsPreview');
    if (!prev.children.length && s.roundsInfo) {
      s.roundsInfo.forEach((r, i) => {
        const c = el('div', 'rp', undefined, prev);
        c.style.setProperty('--c', ACCENTS[r.id] || '#a78bfa');
        c.style.animationDelay = `${i * 0.12}s`;
        el('span', 'rp-i', r.icon, c);
        el('span', 'rp-t', r.title, c);
      });
    }
    for (const p of s.leaderboard) addLobbyAvatar(p);
    const cd = $('lobbyCountdown');
    cd.classList.toggle('hidden', !s.phaseEndsAt);
    if (!s.phaseEndsAt && s.playerCount === 0) lobbyAv.clear();
  }
  function addLobbyAvatar(p) {
    if (lobbyAv.has(p.id)) return;
    lobbyAv.add(p.id);
    const box = $('lobbyAvatars');
    const a = el('div', 'la', undefined, box);
    a.append(avatar(p), el('span', '', p.nickname));
    while (box.children.length > 12) box.firstChild.remove();
  }

  // ------------------------------------------------------------------
  // بطاقة عنوان الجولة
  // ------------------------------------------------------------------
  function renderIntro(s) {
    const pz = s.puzzle;
    if (!pz) return;
    stage.style.setProperty('--accent', ACCENTS[pz.id] || '#a78bfa');
    $('introRound').textContent = s.roundIndex + 1 === s.totalRounds ? 'الجولة الأخيرة' : `الجولة ${s.roundIndex + 1} من ${s.totalRounds}`;
    $('introIcon').textContent = pz.icon;
    $('introTitle').textContent = pz.title;
    $('introTitle').dataset.text = pz.title;
    $('introTag').textContent = pz.tagline;
    $('introMult').classList.toggle('hidden', pz.multiplier <= 1);
    restart($('intro'), 'play-in');
    sfx.boom();
    introTimers.forEach(clearTimeout);
    introTimers = [
      setTimeout(() => { sfx.hit(); flash(0.9); quake(); }, 600),   // هبوط الأيقونة
      setTimeout(() => { sfx.crash(); flash(0.5); }, 1050),          // العنوان
      setTimeout(() => sfx.rise(), 2600),
    ];
  }

  // ------------------------------------------------------------------
  // السؤال
  // ------------------------------------------------------------------
  const HOWTO = {
    code: (pz) => `اكتب الشفرة (${pz.codeLength} أرقام) في التعليقات — مثال: <b>${'1234567890'.slice(0, pz.codeLength)}</b>`,
    choice: (pz) => `اكتب رقم الإجابة الصحيحة: ${Array.from({ length: pz.optionCount }, (_, i) => `<b>${i + 1}</b>`).join(' ')}`,
    number: () => 'اكتب الناتج رقماً في التعليقات — <b>الأسرع يربح أكثر!</b>',
  };

  function mountView(s) {
    const key = `${s.gameNumber}:${s.roundIndex}`;
    if (viewKey === key) return;
    viewKey = key;
    const pz = s.puzzle;
    const boardEl = $('board');
    boardEl.textContent = '';
    boardEl.className = `board b-${pz.id}`;
    view = Object.create(Views[pz.id]);
    view.mount(boardEl, pz);
    stage.style.setProperty('--accent', ACCENTS[pz.id] || '#a78bfa');
    $('qIcon').textContent = pz.icon;
    $('qTitle').textContent = pz.title;
    $('qPrompt').textContent = pz.prompt;
    $('howTo').innerHTML = HOWTO[pz.type](pz);
    $('stream').textContent = '';
    $('steps').textContent = '';
    $('solution').classList.add('hidden');
    $('stats').classList.add('hidden');
    $('answerStamp').classList.add('hidden');
    $('answerStamp').classList.remove('docked');
    $('timeUp').classList.add('hidden');
    $('play').classList.remove('revealing');
    lastSecond = null;
  }

  function addStream(p) {
    const box = $('stream');
    const chip = el('div', 'chip', undefined, box);
    chip.append(avatar(p), el('span', '', p.nickname), el('i', '', '🔒'));
    while (box.children.length > 5) box.firstChild.remove();
  }

  // ------------------------------------------------------------------
  // المؤقت المتوتر
  // ------------------------------------------------------------------
  const RING = 2 * Math.PI * 88;
  let lastSecond = null;
  function loop() {
    requestAnimationFrame(loop);
    if (!state) return;
    const now = serverNow();
    if (state.phase === 'lobby' && state.phaseEndsAt) {
      const left = Math.max(0, Math.ceil((state.phaseEndsAt - now) / 1000));
      $('lobbyCountdown').querySelector('b').textContent = String(left);
    }
    if (state.phase !== 'question' || !state.phaseEndsAt) {
      stage.classList.remove('urgent', 'critical');
      return;
    }
    const total = state.phaseEndsAt - state.phaseStartedAt;
    const leftMs = Math.max(0, state.phaseEndsAt - now);
    const frac = leftMs / total;
    const left = Math.ceil(leftMs / 1000);
    const ring = $('ringFg');
    ring.style.strokeDasharray = `${RING}`;
    ring.style.strokeDashoffset = `${RING * (1 - frac)}`;
    const hue = Math.round(120 * frac); // أخضر ← أصفر ← أحمر
    ring.style.stroke = `hsl(${hue} 95% 55%)`;
    $('timerNum').textContent = String(left);
    stage.classList.toggle('urgent', left <= 10 && left > 0);
    stage.classList.toggle('critical', left <= 5 && left > 0);
    Music.setIntensity(left <= 5 ? 2 : left <= 10 ? 1 : 0);
    if (view && view.tick) view.tick((now - state.phaseStartedAt) / 1000);
    if (left !== lastSecond) {
      lastSecond = left;
      if (left === 10) Voice.say('hurry');
      if (left <= 5 && left > 0) { sfx.heart(); restart($('timerNum'), 'beat'); } else if (left <= 10 && left > 0) { (left % 2 ? sfx.tick : sfx.tock)(); restart($('timerNum'), 'beat'); }
    }
  }
  requestAnimationFrame(loop);

  // ------------------------------------------------------------------
  // كشف الحل تدريجياً
  // ------------------------------------------------------------------
  function clearReveal() { revealTimers.forEach(clearTimeout); revealTimers = []; }

  function runReveal(s) {
    clearReveal();
    const r = s.reveal;
    if (!r || !view) return;
    $('play').classList.add('revealing');
    $('solution').classList.remove('hidden');
    const stepsEl = $('steps');
    stepsEl.textContent = '';
    const total = (s.phaseEndsAt - s.phaseStartedAt) / 1000;
    const elapsed = (serverNow() - s.phaseStartedAt) / 1000;
    const t0 = 1.7;
    const gap = Math.min(1.9, Math.max(0.8, (total * 0.62 - t0) / r.steps.length));
    const tEnd = t0 + r.steps.length * gap + 0.2;
    const at = (sec, fn) => {
      const ms = (sec - elapsed) * 1000;
      if (ms <= 0) fn(true); else revealTimers.push(setTimeout(() => fn(false), ms));
    };

    at(0, (late) => { if (!late) { $('timeUp').classList.remove('hidden'); restart($('timeUp'), 'slam'); sfx.timeup(); sfx.hit(); flash(0.6); quake(); } });
    at(t0 - 0.2, () => $('timeUp').classList.add('hidden'));
    r.steps.forEach((text, i) => {
      at(t0 + i * gap, (late) => {
        const li = el('li', late ? 'shown' : '', text, stepsEl);
        if (!late) { requestAnimationFrame(() => li.classList.add('shown')); sfx.step(); }
        try { view.reveal(i, r); } catch (e) { console.warn(e); }
      });
    });
    at(tEnd, (late) => {
      const stamp = $('answerStamp');
      stamp.querySelector('b').textContent = r.answer;
      stamp.classList.remove('hidden', 'docked');
      if (!late) { restart(stamp, 'slam'); sfx.stamp(); sfx.crash(); Music.duck(0.2, 1.4); flash(1); quake(); setTimeout(sfx.ding, 250); if (r.correctCount > 0) setTimeout(sfx.applause, 300); }
      // بعد لحظة الإعلان يصغر الختم وينتقل للزاوية ليظهر المشهد المحلول كاملاً
      revealTimers.push(setTimeout(() => stamp.classList.add('docked'), late ? 0 : 2200));
      renderStats(s, r);
      if (!late && r.correctCount > 0) burstConfetti(140);
    });
  }

  function renderStats(s, r) {
    $('stats').classList.remove('hidden');
    const pct = r.totalAnswers ? Math.round((100 * r.correctCount) / r.totalAnswers) : 0;
    $('correctPct').textContent = r.totalAnswers ? `${pct}%` : '—';
    const dist = $('dist');
    dist.textContent = '';
    if (s.puzzle && s.puzzle.type === 'choice') {
      const max = Math.max(1, ...Object.values(r.distribution));
      for (let k = 1; k <= s.puzzle.optionCount; k++) {
        const n = r.distribution[k] || 0;
        const bar = el('div', `bar ${String(k) === r.answer ? 'ok' : ''}`, undefined, dist);
        const fill = el('i', '', undefined, bar);
        requestAnimationFrame(() => { fill.style.height = `${Math.max(4, (100 * n) / max)}%`; });
        el('span', 'bn', String(n), bar);
        el('b', '', String(k), bar);
      }
    } else {
      el('div', 'dist-note', `${r.correctCount} من ${r.totalAnswers} إجابة`, dist);
    }
    const f = $('fastest');
    f.textContent = '';
    if (!r.fastest.length) { el('div', 'none', 'لم يحلّها أحد! 😱', f); return; }
    el('div', 'f-title', '⚡ الأسرع', f);
    r.fastest.forEach((p, i) => {
      const row = el('div', 'f-row', undefined, f);
      row.style.animationDelay = `${i * 0.15}s`;
      row.append(el('span', 'medal', ['🥇', '🥈', '🥉'][i]), avatar(p), el('span', 'n', p.nickname), el('span', 's', `${p.seconds}ث`), el('span', 'g', `+${p.lastGain}`));
    });
  }

  // ------------------------------------------------------------------
  // الترتيب
  // ------------------------------------------------------------------
  function renderLeaderboard(s) {
    const list = $('lbList');
    list.textContent = '';
    $('lbSub').textContent = `بعد الجولة ${s.roundIndex + 1} من ${s.totalRounds}`;
    const next = s.roundsInfo && s.roundsInfo[s.roundIndex + 1];
    $('lbNext').textContent = next ? `التالي: ${next.icon} ${next.title}` : '';
    if (!s.leaderboard.length) { el('li', 'empty', 'لا يوجد متسابقون بعد — اكتب تعليقاً للانضمام!', list); return; }
    const ranks = new Map();
    s.leaderboard.slice(0, 8).forEach((p, i) => {
      ranks.set(p.id, i);
      const li = el('li', i < 3 ? `lead t${i + 1}` : '', undefined, list);
      li.style.animationDelay = `${0.08 * (Math.min(8, s.leaderboard.length) - i)}s`;
      const before = prevRanks.get(p.id);
      const move = before === undefined ? '' : before > i ? `▲${before - i}` : before < i ? `▼${i - before}` : '';
      li.append(
        el('span', 'rk', String(i + 1)),
        avatar(p),
        el('span', 'n', p.nickname),
        el('span', `mv ${move.startsWith('▲') ? 'up' : 'down'}`, move),
        el('span', 'gain', p.lastGain ? `+${p.lastGain}` : ''),
        el('span', 'sc', String(p.score)),
      );
    });
    prevRanks = ranks;
    sfx.rise();
  }

  // ------------------------------------------------------------------
  // إعلان الفائز
  // ------------------------------------------------------------------
  function clearFinale() { finaleTimers.forEach(clearTimeout); finaleTimers = []; stopFireworks(); }
  function runFinale(s) {
    clearFinale();
    const podium = s.podium || [];
    const elapsed = (serverNow() - s.phaseStartedAt) / 1000;
    const at = (sec, fn) => {
      const ms = (sec - elapsed) * 1000;
      if (ms <= 0) fn(true); else finaleTimers.push(setTimeout(() => fn(false), ms));
    };
    const fin = $('finale');
    fin.classList.remove('stage2', 'stage3');
    $('champion').classList.add('hidden');
    $('noWinner').classList.add('hidden');
    const pod = $('podium');
    pod.textContent = '';
    Music.setMood('silent');
    at(0, (late) => { if (!late) sfx.drum(5.2); });
    if (!podium.length) {
      at(2.8, (late) => {
        $('noWinner').classList.remove('hidden'); fin.classList.add('stage2'); sfx.wrong();
        if (!late) Voice.say('follow');
      });
      return;
    }
    // منصة التتويج: الثاني يميناً، الأول في الوسط، الثالث يساراً
    const slots = [1, 0, 2].filter((i) => podium[i]);
    for (const i of slots) {
      const p = podium[i];
      const col = el('div', `pod p${i + 1}`, undefined, pod);
      col.append(avatar(p), el('div', 'pn', p.nickname), el('div', 'ps', `${p.score} نقطة`), el('div', 'block', String(i + 1)));
    }
    const showPod = (i, t) => at(t, (late) => {
      const node = pod.querySelector(`.p${i + 1}`);
      if (node) node.classList.add('up');
      if (!late) { sfx.pop(); sfx.shutter(); flash(0.5); }
    });
    showPod(2, 3); showPod(1, 4.2);
    at(5.4, (late) => {
      const w = podium[0];
      const img = $('champImg');
      img.referrerPolicy = 'no-referrer';
      img.onerror = () => { img.onerror = null; img.src = fallbackAvatar(w.nickname); };
      img.src = w.avatar || fallbackAvatar(w.nickname);
      $('champName').textContent = w.nickname;
      $('champUser').textContent = `@${w.uniqueId}`;
      $('champScore').textContent = `${w.score} نقطة • حلّ ${w.correct} من ${s.totalRounds}`;
      $('champion').classList.remove('hidden');
      pod.querySelector('.p1')?.classList.add('up');
      fin.classList.add('stage2');
      startFireworks();
      Music.setMood('finale');
      if (!late) finaleTimers.push(setTimeout(() => Voice.say('finale'), 3200));
      if (!late) {
        sfx.drop(); sfx.fanfare(); sfx.applause(); burstConfetti(320); quake();
        // وميض كاميرات الصحافة
        [0, 180, 420, 650, 1000, 1300].forEach((d, k) => setTimeout(() => { flash(k === 0 ? 1 : 0.55); sfx.shutter(); }, d));
      }
    });
    at(9, () => fin.classList.add('stage3'));
  }

  // ------------------------------------------------------------------
  // قصاصات الاحتفال + ألعاب نارية
  // ------------------------------------------------------------------
  let confRAF = null; let confParts = [];
  function burstConfetti(n) {
    const cv = $('confetti'); const c = cv.getContext('2d');
    const colors = ['#fbbf24', '#f472b6', '#22d3ee', '#a78bfa', '#ffffff', '#34d399'];
    for (let i = 0; i < n; i++) {
      const fromLeft = i % 2 === 0;
      confParts.push({
        x: fromLeft ? -20 : 1100, y: 1100 + Math.random() * 500,
        vx: (fromLeft ? 1 : -1) * (8 + Math.random() * 14), vy: -18 - Math.random() * 18,
        w: 10 + Math.random() * 14, h: 6 + Math.random() * 10, r: Math.random() * 6, vr: -0.3 + Math.random() * 0.6,
        c: colors[i % colors.length], life: 0,
      });
    }
    if (confRAF) return;
    const frame = () => {
      c.clearRect(0, 0, 1080, 1920);
      confParts = confParts.filter((p) => p.y < 2000 && p.life < 400);
      for (const p of confParts) {
        p.vy += 0.45; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.r += p.vr; p.life++;
        c.save(); c.translate(p.x, p.y); c.rotate(p.r);
        c.fillStyle = p.c; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h * Math.abs(Math.cos(p.r * 2)));
        c.restore();
      }
      confRAF = confParts.length ? requestAnimationFrame(frame) : null;
      if (!confRAF) c.clearRect(0, 0, 1080, 1920);
    };
    confRAF = requestAnimationFrame(frame);
  }

  let fwRAF = null;
  function startFireworks() {
    stopFireworks();
    const cv = $('fireworks'); const c = cv.getContext('2d');
    let sparks = []; let rockets = []; let tick = 0;
    const hues = [45, 320, 190, 270, 150];
    const frame = () => {
      c.globalCompositeOperation = 'destination-out';
      c.fillStyle = 'rgba(0,0,0,0.18)';
      c.fillRect(0, 0, 1080, 1920);
      c.globalCompositeOperation = 'lighter';
      if (tick++ % 26 === 0) rockets.push({ x: 150 + Math.random() * 780, y: 1920, vy: -24 - Math.random() * 8, ty: 300 + Math.random() * 600, h: hues[Math.floor(Math.random() * hues.length)] });
      rockets = rockets.filter((r) => {
        r.y += r.vy; r.vy *= 0.985;
        c.fillStyle = `hsl(${r.h} 100% 75%)`; c.fillRect(r.x - 2, r.y, 4, 14);
        if (r.y <= r.ty) {
          for (let i = 0; i < 70; i++) {
            const a = Math.random() * Math.PI * 2; const sp = 2 + Math.random() * 9;
            sparks.push({ x: r.x, y: r.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, l: 60 + Math.random() * 30, h: r.h });
          }
          sfx.pop();
          return false;
        }
        return true;
      });
      sparks = sparks.filter((p) => p.l > 0);
      for (const p of sparks) {
        p.vy += 0.12; p.vx *= 0.97; p.vy *= 0.97; p.x += p.vx; p.y += p.vy; p.l--;
        c.fillStyle = `hsla(${p.h} 100% ${55 + p.l / 3}% / ${Math.min(1, p.l / 40)})`;
        c.beginPath(); c.arc(p.x, p.y, 3, 0, Math.PI * 2); c.fill();
      }
      fwRAF = requestAnimationFrame(frame);
    };
    fwRAF = requestAnimationFrame(frame);
  }
  function stopFireworks() {
    if (fwRAF) cancelAnimationFrame(fwRAF);
    fwRAF = null;
    $('fireworks').getContext('2d').clearRect(0, 0, 1080, 1920);
  }

  // ------------------------------------------------------------------
  // تطبيق الحالة
  // ------------------------------------------------------------------
  function apply(s, prev) {
    const phaseChanged = !prev || prev.phase !== s.phase || prev.roundIndex !== s.roundIndex || prev.gameNumber !== s.gameNumber;
    renderProgress(s);
    if (s.channel) {
      for (const h of document.querySelectorAll('.handle')) { h.textContent = `@${s.channel}`; h.classList.remove('hidden'); }
      document.querySelector('.follow-line').classList.remove('hidden');
    }
    for (const ph of Object.keys(SCREENS)) stage.classList.toggle(`phase-${ph}`, s.phase === ph);
    $('answeredCount').textContent = String(s.answeredCount);
    if (s.phase === 'lobby') renderLobby(s);
    if (!phaseChanged) return;

    const enter = () => {
      if (s.phase !== 'reveal') clearReveal();
      if (s.phase !== 'finale') clearFinale();
      if (s.gameNumber !== prev?.gameNumber) { prevRanks = new Map(); lobbyAv.clear(); $('lobbyAvatars').textContent = ''; }
      showScreen(SCREENS[s.phase]);
      Music.setMood(MOODS[s.phase] || 'silent');
      if (s.phase !== 'question') Music.setIntensity(0);
      if (s.phase === 'question') hypeShown = new Set();
      $('followBanner').classList.toggle('show', s.phase === 'leaderboard' && Boolean(s.channel));
      // التعليق الصوتي: شرح البرنامج في الاستوديو، وجملة قصيرة مع كل لغز
      clearTimeout(voiceTimer); clearInterval(welcomeLoop);
      if (prev && prev.phase === 'lobby' && s.phase !== 'lobby') Voice.stop();
      if (s.phase === 'lobby') {
        voiceTimer = setTimeout(() => voiceReady.then(() => Voice.say('welcome')), 1800);
        if (Voice.welcomeEvery > 0) {
          welcomeLoop = setInterval(() => Voice.say('welcome', { interrupt: false }), Voice.welcomeEvery * 60_000);
        }
      }
      if (s.phase === 'question' && s.puzzle) voiceTimer = setTimeout(() => Voice.say(`round-${s.puzzle.id}`), 700);
      switch (s.phase) {
        case 'lobby': renderLobby(s); break;
        case 'intro': renderIntro(s); break;
        case 'question': mountView(s); break;
        case 'reveal': mountView(s); runReveal(s); break;
        case 'leaderboard': renderLeaderboard(s); break;
        case 'finale': runFinale(s); break;
        default:
      }
    };
    // انتقال سينمائي بين الشاشات المختلفة؛ السؤال → الكشف يبقى على نفس الشاشة
    const sameScreen = prev && SCREENS[prev.phase] === SCREENS[s.phase] && prev.roundIndex === s.roundIndex;
    if (!prev || sameScreen) enter(); else shutter(enter);
  }

  // ------------------------------------------------------------------
  // الاتصال بالخادم
  // ------------------------------------------------------------------
  const socket = io();
  socket.on('connect', () => $('conn').classList.add('hidden'));
  socket.on('disconnect', () => $('conn').classList.remove('hidden'));

  socket.on('state', (s) => {
    const prev = state;
    state = s;
    clockOffset = s.serverNow - Date.now();
    apply(s, prev);
  });
  socket.on('join', (p) => {
    if (state && state.phase === 'lobby') { addLobbyAvatar(p); sfx.join(); } else toast(`👋 انضم ${p.nickname}`);
  });
  // لحظات «الحماس»: كلما وصل عدد الإجابات لرقم مميز يظهر إعلان كبير — يحفّز المشاهدين على المشاركة
  const HYPE = [5, 10, 20, 30, 50, 75, 100, 150, 200, 300, 500];
  socket.on('answer', ({ player, count }) => {
    addStream(player); sfx.lock(); restart($('answeredCount'), 'bump');
    if (HYPE.includes(count) && !hypeShown.has(count)) {
      hypeShown.add(count);
      const h = $('hype');
      h.querySelector('b').textContent = String(count);
      restart(h, 'go');
      sfx.hype(); flash(0.25);
    }
  });
  // أوامر التعليق الصوتي من لوحة التحكم
  socket.on('voice', (cmd) => {
    if (cmd === 'stop') Voice.stop();
    else if (cmd === 'off') { Voice.stop(); Voice.enabled = false; } else if (cmd === 'on') Voice.enabled = true;
    else if (typeof cmd === 'string') { ctx(); Voice.say(cmd); }
  });
  // التحكم في الصوت من لوحة التحكم
  socket.on('audio', (a) => {
    if (!a) return;
    if (typeof a.music === 'boolean') Music.setEnabled(a.music && MUSIC);
    Music.setVolume(Number(a.musicVolume), Number(a.sfxVolume));
  });
})();
