/* global io */
(() => {
  'use strict';

  // ?transparent=1  خلفية شفافة   |  ?sound=0  بدون مؤثرات  |  ?voice=0  بدون معلّق  |  ?subs=0  بدون ترجمة
  const params = new URLSearchParams(location.search);
  if (params.get('transparent') === '1') document.body.classList.add('transparent');
  const SOUND = params.get('sound') !== '0';
  const VOICE = params.get('voice') !== '0';
  const SUBS = params.get('subs') !== '0';

  const $ = (id) => document.getElementById(id);
  const stage = $('stage');

  function fit() {
    const s = Math.min(window.innerWidth / 1080, window.innerHeight / 1920);
    stage.style.transform = `translate(-50%, -50%) scale(${s})`;
  }
  window.addEventListener('resize', fit);
  fit();

  // ------------------------------------------------------------------
  // أدوات
  // ------------------------------------------------------------------
  const fmt = (n) => Number(n || 0).toLocaleString('en-US');
  function el(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text !== undefined) e.textContent = text;
    return e;
  }
  const PALETTE = ['#ff3d6e', '#2f8cff', '#b36bff', '#22e39b', '#f58231', '#18c7a4'];
  function fallbackAvatar(name) {
    const letter = [...(name || '?')][0] || '?';
    let h = 0;
    for (const ch of name || '') h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128"><rect width="128" height="128" fill="${PALETTE[h % PALETTE.length]}"/>`
      + `<text x="64" y="84" font-size="60" font-family="Arial" font-weight="bold" fill="#fff" text-anchor="middle">${letter.replace(/[<>&"']/g, '')}</text></svg>`;
    return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  }
  function avatarImg(user) {
    const img = el('img');
    img.alt = '';
    img.referrerPolicy = 'no-referrer';
    img.onerror = () => { img.onerror = null; img.src = fallbackAvatar(user?.nickname); };
    img.src = user?.avatar || fallbackAvatar(user?.nickname);
    return img;
  }

  // ------------------------------------------------------------------
  // المؤثرات الصوتية (WebAudio — بدون ملفات)
  // ------------------------------------------------------------------
  let actx = null;
  function ctx() {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    return actx;
  }
  function tone(freq, dur = 0.15, type = 'sine', vol = 0.12, delay = 0, slide = 0) {
    if (!SOUND) return;
    try {
      const a = ctx();
      const t = a.currentTime + delay;
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(a.destination);
      o.start(t); o.stop(t + dur + 0.05);
    } catch { /* تجاهل */ }
  }
  function noise(dur = 0.6, vol = 0.3) {
    if (!SOUND) return;
    try {
      const a = ctx();
      const buf = a.createBuffer(1, a.sampleRate * dur, a.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length) ** 2;
      const src = a.createBufferSource();
      const g = a.createGain();
      g.gain.value = vol;
      src.buffer = buf;
      src.connect(g).connect(a.destination);
      src.start();
    } catch { /* تجاهل */ }
  }
  const sfx = {
    join: () => { tone(740, 0.08, 'triangle', 0.06); tone(1110, 0.1, 'triangle', 0.06, 0.07); },
    coin: () => { tone(988, 0.08, 'square', 0.05); tone(1319, 0.18, 'square', 0.05, 0.08); },
    gift: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.18, 'triangle', 0.09, i * 0.07)),
    big: () => { [523, 659, 784, 1047, 1319, 1568].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.06, i * 0.08)); tone(110, 0.8, 'sine', 0.2); },
    boost: () => tone(200, 0.7, 'sawtooth', 0.09, 0, 1400),
    bomb: () => { noise(1.1, 0.5); tone(80, 0.9, 'sine', 0.35, 0, -40); },
    start: () => [392, 523, 659, 784].forEach((f, i) => tone(f, 0.22, 'square', 0.07, i * 0.12)),
    tick: () => tone(1200, 0.05, 'square', 0.05),
    final: () => { tone(880, 0.25, 'sawtooth', 0.08); tone(660, 0.25, 'sawtooth', 0.08, 0.3); tone(880, 0.25, 'sawtooth', 0.08, 0.6); },
    win: () => [523, 659, 784, 1047, 784, 1047, 1319].forEach((f, i) => tone(f, 0.32, 'triangle', 0.12, i * 0.14)),
  };

  // ------------------------------------------------------------------
  // المعلّق الصوتي: طابور بأولويات + ترجمة نصية على الشاشة
  // ------------------------------------------------------------------
  const voice = { queue: [], playing: false, blocked: false, audio: new Audio(), arVoice: null };
  function loadVoices() {
    const list = window.speechSynthesis?.getVoices?.() || [];
    voice.arVoice = list.find((v) => /^ar/i.test(v.lang)) || null;
  }
  if (window.speechSynthesis) { loadVoices(); window.speechSynthesis.onvoiceschanged = loadVoices; }

  function fetchAudio(text) {
    return fetch(`/tts?text=${encodeURIComponent(text)}`)
      .then((r) => (r.status === 200 ? r.blob() : null))
      .catch(() => null);
  }

  function enqueueSay(line) {
    if (!VOICE && !SUBS) return;
    const q = voice.queue;
    if (line.priority === 'high') {
      for (let i = q.length - 1; i >= 0; i--) if (q[i].priority === 'low') q.splice(i, 1);
      const idx = q.findIndex((x) => x.priority !== 'high');
      if (q.length >= 6) return;
      q.splice(idx === -1 ? q.length : idx, 0, line);
    } else if (line.priority === 'low') {
      if (voice.playing || q.length) return;
      q.push(line);
    } else {
      if (q.length >= 3) return;
      q.push(line);
    }
    if (VOICE) line.audio = fetchAudio(line.text);
    pump();
  }

  function speakBrowser(text) {
    return new Promise((resolve) => {
      if (!window.speechSynthesis) return resolve();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'ar-SA';
      if (voice.arVoice) u.voice = voice.arVoice;
      u.rate = 1.08; u.pitch = 1.05;
      u.onend = resolve; u.onerror = resolve;
      window.speechSynthesis.speak(u);
      setTimeout(resolve, 30_000);
    });
  }

  function playBlob(blob) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const a = voice.audio;
      const done = () => { URL.revokeObjectURL(url); a.onended = a.onerror = null; resolve(); };
      a.onended = done;
      a.onerror = done;
      a.src = url;
      a.volume = 1;
      a.play().catch((err) => { URL.revokeObjectURL(url); reject(err); });
      setTimeout(done, 45_000);
    });
  }

  async function pump() {
    if (voice.playing || voice.blocked || !voice.queue.length) return;
    voice.playing = true;
    const line = voice.queue.shift();
    showSubtitle(line.text);
    try {
      if (VOICE) {
        const blob = await line.audio;
        if (blob) await playBlob(blob);
        else await speakBrowser(line.text);
      } else {
        await new Promise((r) => setTimeout(r, 1500 + line.text.length * 55));
      }
    } catch (err) {
      if (err && err.name === 'NotAllowedError') {
        // المتصفح يمنع التشغيل التلقائي: نعيد الجملة للطابور وننتظر ضغطة المستخدم
        voice.queue.unshift(line);
        voice.blocked = true;
        $('unlock').classList.remove('hidden');
      }
    } finally {
      voice.playing = false;
      hideSubtitleSoon();
      if (!voice.blocked) setTimeout(pump, 250);
    }
  }

  $('unlock').addEventListener('click', () => {
    $('unlock').classList.add('hidden');
    voice.blocked = false;
    try { ctx().resume(); } catch { /* تجاهل */ }
    pump();
  });

  let subTimer = null;
  function showSubtitle(text) {
    if (!SUBS) return;
    clearTimeout(subTimer);
    $('subtitleTxt').textContent = text;
    $('subtitle').classList.remove('hidden');
  }
  function hideSubtitleSoon() {
    clearTimeout(subTimer);
    subTimer = setTimeout(() => $('subtitle').classList.add('hidden'), 1200);
  }

  // ------------------------------------------------------------------
  // الحالة والعرض
  // ------------------------------------------------------------------
  let state = null;
  let clockOffset = 0;
  const towers = new Map();
  const prevPoints = new Map();
  let lastTickSecond = null;

  function teamById(id) { return state?.teams.find((t) => t.id === id); }

  function buildTowers() {
    const box = $('towers');
    box.innerHTML = '';
    towers.clear();
    for (const t of state.teams) {
      const root = el('div', 'tower');
      root.style.setProperty('--c', t.color);
      const crown = el('div', 'crown', '👑');
      const tube = el('div', 'tube');
      const bank = el('div', 'bank');
      const fill = el('div', 'fill');
      const pts = el('div', 'pts', '0');
      tube.append(bank, fill, pts);
      const badge = el('div', 'badge', t.emoji);
      badge.append(el('div', 'num', String(t.id)));
      const name = el('div', 'name', t.name);
      const meta = el('div', 'meta', '');
      const boost = el('div', 'boost hidden', '');
      root.append(crown, tube, boost, badge, name, meta);
      box.append(root);
      towers.set(t.id, { root, fill, bank, pts, meta, boost, tube });
    }
    // دعوة الانضمام وقواعد اللعب
    const cta = $('joinCta');
    cta.innerHTML = '';
    cta.append(el('span', 'lbl', 'اكتب في التعليقات:'));
    for (const t of state.teams) {
      const chip = el('span', 'chip', `${t.id} ${t.emoji}`);
      chip.style.setProperty('--c', t.color);
      cta.append(chip);
    }
    const r = state.rules;
    const rules = [
      ['💬', 'تعليق', `+${r.commentPoints}`], ['❤️', 'لايك', `+${r.likePoints}`], ['➕', 'متابعة', `+${r.followPoints}`],
      ['🎁', 'كل عملة', `+${r.giftPointsPerCoin}`],
    ];
    const box2 = $('rules');
    box2.innerHTML = '';
    for (const [ico, txt, val] of rules) {
      const d = el('div', 'rule');
      d.append(el('span', '', ico), el('span', '', txt), el('b', '', val));
      box2.append(d);
    }
    if (r.boostCoins > 0) {
      const d = el('div', 'rule power');
      d.append(el('span', '', '⚡'), el('b', '', `${r.boostCoins}+`), el('span', '', `= مضاعف ×${r.boostMultiplier}`));
      box2.append(d);
    }
    if (r.bombCoins > 0) {
      const d = el('div', 'rule power');
      d.append(el('span', '', '💣'), el('b', '', `${r.bombCoins}+`), el('span', '', '= قنبلة'));
      box2.append(d);
    }
  }

  function render() {
    if (!state) return;
    if (towers.size !== state.teams.length) buildTowers();
    document.body.className = document.body.className.replace(/\bphase-\w+/g, '').trim();
    document.body.classList.add(`phase-${state.phase}`);
    document.body.classList.toggle('final', Boolean(state.final));

    $('members').textContent = fmt(state.totalMembers);
    $('roundLbl').textContent = `الجولة ${Math.max(1, state.round + (state.phase === 'lobby' ? 1 : 0))}`;
    $('goalLbl').textContent = state.goal > 0 ? ` · الهدف ${fmt(state.goal)}` : '';

    const maxPts = Math.max(1, ...state.teams.map((t) => t.points + t.bank));
    const scale = state.goal > 0 ? Math.max(state.goal, maxPts) : maxPts * 1.15;
    $('goalLine').style.display = state.goal > 0 ? '' : 'none';

    for (const t of state.teams) {
      const tw = towers.get(t.id);
      if (!tw) continue;
      const pct = Math.min(100, (t.points / scale) * 100);
      const bankPct = Math.min(100, ((t.points + t.bank) / scale) * 100);
      tw.fill.style.height = `${pct}%`;
      tw.bank.style.height = `${bankPct}%`;
      tw.pts.style.bottom = `calc(${Math.min(pct, 86)}% + 12px)`;
      tw.pts.textContent = fmt(t.points + t.bank);
      const prev = prevPoints.get(t.id) ?? t.points;
      const diff = (t.points + t.bank) - prev;
      if (diff > 0 && state.phase !== 'winner') {
        tw.pts.classList.remove('bump'); void tw.pts.offsetWidth; tw.pts.classList.add('bump');
        if (diff >= 3) floater(t, `+${fmt(diff)}`);
      }
      prevPoints.set(t.id, t.points + t.bank);
      const wins = t.wins ? ` · 🏆${t.wins}` : '';
      tw.meta.textContent = `👥 ${fmt(t.members)}${wins}${t.bank ? ' · 💰 محفوظة' : ''}`;
      tw.root.classList.toggle('leader', state.leaderId === t.id && state.phase !== 'lobby');
      const boostLeft = t.boostUntil ? Math.ceil((t.boostUntil - (Date.now() + clockOffset)) / 1000) : 0;
      tw.boost.classList.toggle('hidden', boostLeft <= 0);
      if (boostLeft > 0) tw.boost.textContent = `⚡×${state.rules.boostMultiplier} ${boostLeft}s`;
    }

    renderHeroes();
    renderBanner();
    renderWinner();
  }

  function floater(team, text) {
    const tw = towers.get(team.id);
    if (!tw) return;
    const f = el('div', 'floater', text);
    f.style.setProperty('--c', team.color);
    f.style.bottom = tw.pts.style.bottom;
    f.style.marginLeft = `${(Math.random() - 0.5) * 60}px`;
    tw.tube.append(f);
    setTimeout(() => f.remove(), 1400);
  }

  function renderHeroes() {
    const list = $('heroes');
    list.innerHTML = '';
    if (!state.top.length) {
      list.append(el('li', 'empty', 'كن أول بطل! تفاعل الآن لتظهر هنا'));
    }
    const medals = ['🥇', '🥈', '🥉', '4', '5'];
    state.top.slice(0, 5).forEach((u, i) => {
      const team = teamById(u.team);
      const li = el('li');
      li.style.setProperty('--c', team?.color || '#fff');
      li.append(el('span', 'rk', medals[i]), avatarImg(u), el('span', 'nm', u.nickname), el('span', 'tm', team?.emoji || ''), el('span', 'pt', fmt(u.points)));
      list.append(li);
    });
    const king = $('king');
    king.innerHTML = '';
    const g = state.gifters[0];
    if (g) {
      king.append(el('span', '', '👑 ملك الداعمين:'), avatarImg(g), el('span', '', g.nickname), el('b', '', ` 🪙 ${fmt(g.coins)}`));
    }
  }

  function secondsLeft() {
    if (!state?.phaseEndsAt) return null;
    return Math.max(0, Math.ceil((state.phaseEndsAt - (Date.now() + clockOffset)) / 1000));
  }

  let lastBanner = '';
  function renderBanner() {
    const left = secondsLeft();
    let txt;
    if (state.phase === 'lobby') {
      txt = left === null ? 'اختر فريقك! اكتب رقمه في التعليقات 👇' : `⏳ المعركة تبدأ بعد ${left} — اختر فريقك!`;
    } else if (state.phase === 'battle') {
      if (state.overtime) txt = '⚡ وقت إضافي! أول من يتقدّم يفوز';
      else if (state.final) txt = `🔥 الوقت الحاسم — النقاط ×${state.rules.finalMultiplier}`;
      else txt = '⚔️ المعركة مشتعلة! لايك + تعليق + هدايا';
    } else {
      txt = '🏆 انتهت الجولة';
    }
    if (txt !== lastBanner) {
      const changedKind = txt.split(' ')[0] !== lastBanner.split(' ')[0];
      lastBanner = txt;
      $('bannerTxt').textContent = txt;
      if (changedKind) { $('banner').classList.remove('pop'); void $('banner').offsetWidth; $('banner').classList.add('pop'); }
    }
  }

  function renderClock() {
    if (!state) return;
    const left = secondsLeft();
    const arc = $('clockArc');
    let total = state.rules.roundSeconds;
    if (state.phase === 'lobby') total = 30;
    if (state.overtime) total = 20;
    if (left === null) {
      $('clockTxt').textContent = state.phase === 'lobby' ? '⏸' : '--';
      arc.style.strokeDashoffset = '0';
    } else {
      const m = Math.floor(left / 60);
      $('clockTxt').textContent = left >= 60 ? `${m}:${String(left % 60).padStart(2, '0')}` : String(left);
      arc.style.strokeDashoffset = String(327 * (1 - Math.min(1, left / total)));
      if (state.phase === 'battle' && left <= 10 && left > 0 && left !== lastTickSecond) { lastTickSecond = left; sfx.tick(); }
    }
    renderBanner();
    // تحديث عدّاد المضاعف
    for (const t of state.teams) {
      const tw = towers.get(t.id);
      if (!tw || !t.boostUntil) continue;
      const b = Math.ceil((t.boostUntil - (Date.now() + clockOffset)) / 1000);
      tw.boost.classList.toggle('hidden', b <= 0);
      if (b > 0) tw.boost.textContent = `⚡×${state.rules.boostMultiplier} ${b}s`;
    }
  }
  setInterval(renderClock, 250);

  // ------------------------------------------------------------------
  // المباشر والمؤثرات
  // ------------------------------------------------------------------
  function feed(cls, user, team, text) {
    const ul = $('feed');
    const li = el('li', cls);
    li.style.setProperty('--c', team?.color || '#fff');
    li.append(avatarImg(user), el('span', 't', text));
    ul.prepend(li);
    while (ul.children.length > 5) ul.lastChild.remove();
  }

  const splashQueue = [];
  let splashBusy = false;
  function splash(build, ms = 2600) {
    splashQueue.push({ build, ms });
    if (splashQueue.length > 4) splashQueue.splice(1, 1);
    nextSplash();
  }
  function nextSplash() {
    if (splashBusy || !splashQueue.length) return;
    splashBusy = true;
    const { build, ms } = splashQueue.shift();
    const box = $('splash');
    box.className = 'splash';
    box.innerHTML = '';
    build(box);
    void box.offsetWidth;
    setTimeout(() => { box.classList.add('hidden'); splashBusy = false; setTimeout(nextSplash, 150); }, ms);
  }

  function flash(color = '#fff') {
    const f = $('flash');
    f.style.background = color;
    f.classList.remove('go'); void f.offsetWidth; f.classList.add('go');
  }
  function shake() {
    stage.classList.remove('shake'); void stage.offsetWidth; stage.classList.add('shake');
  }

  // جزيئات خفيفة للخلفية
  const pc = $('particles');
  const pctx = pc.getContext('2d');
  pc.width = 1080; pc.height = 1920;
  const sparks = [];
  function burst(x, y, color, n = 40) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 4 + Math.random() * 14;
      sparks.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 6, life: 1, color, r: 4 + Math.random() * 7 });
    }
  }
  function towerCenter(teamId) {
    const tw = towers.get(teamId);
    if (!tw) return { x: 540, y: 900 };
    const r = tw.tube.getBoundingClientRect();
    const s = stage.getBoundingClientRect();
    const k = 1080 / s.width;
    return { x: (r.left - s.left + r.width / 2) * k, y: (r.top - s.top + r.height * 0.3) * k };
  }
  (function animate() {
    pctx.clearRect(0, 0, 1080, 1920);
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.x += p.vx; p.y += p.vy; p.vy += 0.5; p.life -= 0.018;
      if (p.life <= 0) { sparks.splice(i, 1); continue; }
      pctx.globalAlpha = p.life;
      pctx.fillStyle = p.color;
      pctx.beginPath(); pctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2); pctx.fill();
    }
    pctx.globalAlpha = 1;
    requestAnimationFrame(animate);
  })();

  // قصاصات الفوز
  const cc = $('confetti');
  const cctx = cc.getContext('2d');
  let confetti = [];
  let confettiOn = false;
  function startConfetti(colors) {
    cc.width = 1080; cc.height = 1920;
    confetti = Array.from({ length: 220 }, () => ({
      x: Math.random() * 1080, y: -Math.random() * 1920, w: 12 + Math.random() * 14, h: 8 + Math.random() * 10,
      vy: 4 + Math.random() * 6, vx: -2 + Math.random() * 4, r: Math.random() * 6, vr: -0.2 + Math.random() * 0.4,
      c: colors[Math.floor(Math.random() * colors.length)],
    }));
    if (!confettiOn) { confettiOn = true; requestAnimationFrame(drawConfetti); }
  }
  function drawConfetti() {
    if (!confettiOn) { cctx.clearRect(0, 0, cc.width, cc.height); return; }
    cctx.clearRect(0, 0, cc.width, cc.height);
    for (const p of confetti) {
      p.y += p.vy; p.x += p.vx; p.r += p.vr;
      if (p.y > 1940) { p.y = -20; p.x = Math.random() * 1080; }
      cctx.save(); cctx.translate(p.x, p.y); cctx.rotate(p.r);
      cctx.fillStyle = p.c; cctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      cctx.restore();
    }
    requestAnimationFrame(drawConfetti);
  }

  let shownWinnerAt = null;
  function renderWinner() {
    const box = $('winner');
    const w = state.lastWinner;
    if (state.phase !== 'winner') {
      box.classList.add('hidden');
      confettiOn = false;
      return;
    }
    box.classList.remove('hidden');
    splashQueue.length = 0;
    $('splash').classList.add('hidden');
    const key = w ? w.at : 'none';
    if (shownWinnerAt === key) return;
    shownWinnerAt = key;
    const wb = box.querySelector('.win-box');
    if (!w) {
      wb.style.setProperty('--c', '#888');
      $('winEmoji').textContent = '😴';
      $('winTeam').textContent = 'لا فائز';
      $('winPoints').textContent = 'لم تُسجَّل نقاط هذه الجولة';
      $('winMvp').innerHTML = '';
      $('winRank').innerHTML = '';
      return;
    }
    const team = teamById(w.team.id) || w.team;
    wb.style.setProperty('--c', team.color);
    $('winEmoji').textContent = team.emoji;
    $('winTeam').textContent = `فريق ${team.name}`;
    const pts = w.ranking.find((r) => r.id === team.id)?.points || 0;
    $('winPoints').textContent = `${fmt(pts)} نقطة${w.reason === 'goal' ? ' — وصلوا للهدف! 🎯' : ''}`;
    const mvp = $('winMvp');
    mvp.innerHTML = '';
    if (w.mvp) {
      const d = el('div');
      d.append(el('small', '', '⭐ بطل الجولة'), el('div', '', w.mvp.nickname), el('small', '', `${fmt(w.mvp.points)} نقطة`));
      mvp.append(avatarImg(w.mvp), d);
    }
    const rank = $('winRank');
    rank.innerHTML = '';
    w.ranking.forEach((r, i) => {
      const t = teamById(r.id);
      if (t) rank.append(el('span', '', `${['🥇', '🥈', '🥉', '4️⃣'][i] || ''} ${t.emoji} ${fmt(r.points)}`));
    });
    startConfetti([team.color, '#ffd23f', '#ffffff', '#ff2e7e']);
    sfx.win();
  }

  // ------------------------------------------------------------------
  // الاتصال بالخادم
  // ------------------------------------------------------------------
  const socket = io();
  socket.on('connect', () => $('conn').classList.add('hidden'));
  socket.on('disconnect', () => $('conn').classList.remove('hidden'));

  socket.on('state', (s) => {
    const firstState = !state;
    const phaseChanged = state && state.phase !== s.phase;
    state = s;
    clockOffset = s.serverNow - Date.now();
    if (firstState) for (const t of s.teams) prevPoints.set(t.id, t.points + t.bank);
    if (phaseChanged && s.phase === 'lobby') for (const t of s.teams) prevPoints.set(t.id, t.points + t.bank);
    render();
  });

  socket.on('say', enqueueSay);

  socket.on('join', ({ user, team, auto, switched }) => {
    feed('join', user, team, auto ? `${user.nickname} انضم تلقائياً إلى ${team.emoji}` : `${user.nickname} ${switched ? 'انتقل إلى' : 'انضم إلى'} ${team.emoji} ${team.name}`);
    sfx.join();
  });

  socket.on('gift', ({ user, team, gift, points, banked }) => {
    const big = gift.coins >= (state?.rules.boostCoins || 99);
    const label = `${gift.count > 1 ? `${gift.count}× ` : ''}${gift.name}`;
    feed(`gift${big ? ' big' : ''}`, user, team, `${gift.emoji || '🎁'} ${user.nickname}: ${label} +${fmt(points)}`);
    const c = towerCenter(team.id);
    burst(c.x, c.y, team.color, big ? 120 : 30);
    burst(c.x, c.y, '#ffd23f', big ? 60 : 12);
    if (gift.coins >= 10 || big) {
      sfx[big ? 'big' : 'gift']();
      splash((box) => {
        if (big) box.classList.add('big');
        const ico = el('div', 'ico');
        if (gift.image) {
          const img = el('img'); img.src = gift.image; img.referrerPolicy = 'no-referrer';
          img.onerror = () => { ico.textContent = gift.emoji || '🎁'; };
          ico.append(img);
        } else ico.textContent = gift.emoji || '🎁';
        const who = el('div', 'who');
        who.append(avatarImg(user), el('span', '', user.nickname));
        box.append(ico, who, el('div', 'what', `أرسل ${label} لفريق ${team.emoji} ${team.name}`), el('div', 'plus', `+${fmt(points)}${banked ? ' 💰' : ''}`));
      }, big ? 3600 : 2200);
      if (big) flash(team.color);
    } else {
      sfx.coin();
    }
  });

  socket.on('boost', ({ user, team, seconds, multiplier }) => {
    sfx.boost();
    splash((box) => {
      box.classList.add('boost');
      const who = el('div', 'who');
      who.append(avatarImg(user), el('span', '', user.nickname));
      box.append(el('div', 'ico', '⚡'), el('div', 'plus', `مضاعف ×${multiplier}`), who, el('div', 'what', `فريق ${team.emoji} ${team.name} — ${seconds} ثانية`));
    }, 2600);
    flash('#ffb300');
  });

  socket.on('bomb', ({ user, target, loss }) => {
    sfx.bomb();
    shake();
    flash('#ff3a3a');
    const c = towerCenter(target.id);
    burst(c.x, c.y, '#ff6a00', 160);
    burst(c.x, c.y, '#ffd23f', 80);
    const tw = towers.get(target.id);
    if (tw) { tw.root.classList.remove('hit'); void tw.root.offsetWidth; tw.root.classList.add('hit'); }
    splash((box) => {
      box.classList.add('bomb');
      const who = el('div', 'who');
      who.append(avatarImg(user), el('span', '', user.nickname));
      box.append(el('div', 'ico', '💣'), who, el('div', 'what', `فجّر قنبلة على ${target.emoji} ${target.name}`), el('div', 'plus', `-${fmt(loss)}`));
    }, 3000);
  });

  socket.on('follow', ({ user, team, points }) => feed('follow', user, team, `➕ ${user.nickname} تابع الحساب +${points}`));
  socket.on('share', ({ user, team, points }) => feed('share', user, team, `🔗 ${user.nickname} شارك البث +${points}`));
  socket.on('battleStart', () => { sfx.start(); flash('#29e7ff'); });
  socket.on('final', () => { sfx.final(); flash('#ff3a4f'); });
  socket.on('overtime', () => { sfx.final(); flash('#ffb300'); });
  socket.on('leadChange', ({ team }) => {
    const c = towerCenter(team.id);
    burst(c.x, c.y - 200, '#ffd23f', 50);
  });
})();
