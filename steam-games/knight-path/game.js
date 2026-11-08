/* ===============================================================
   فارس الدرب — المحرّك والمشاهد والواجهة
   =============================================================== */
(() => {
  'use strict';

  const K = window.KnightEngine;
  const ART = window.KnightArt;
  const AU = window.KnightAudio;
  const QB = window.KnightQuestions;
  const STAGES = K.STAGES;
  const GY = ART.GY;
  const KX = 1170;  // موقع الفارس
  const FX0 = 430;  // موقع الخصم

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text !== undefined) e.textContent = text; return e; };
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const rng = Math.random;

  // ------------------------------------------------------------------
  // الحفظ
  // ------------------------------------------------------------------
  const SAVE_KEY = 'steamGames.knightPath.v1';
  const SET_KEY = 'steamGames.knightPath.settings';
  const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
  let save = read(SAVE_KEY);
  const settings = { music: true, sound: true, ...(read(SET_KEY) || {}) };
  function persist() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); localStorage.setItem(SET_KEY, JSON.stringify(settings)); } catch { /* */ } }
  function notify(event, data = {}) {
    try { if (window.parent && window.parent !== window) window.parent.postMessage({ source: 'steam-games', game: 'knight-path', event, ...data }, '*'); } catch { /* */ }
  }

  // ------------------------------------------------------------------
  // اللوحة والكاميرا
  // ------------------------------------------------------------------
  const cv = $('scene');
  const ctx = cv.getContext('2d');
  let W = 0, H = 0, DPR = 1;
  const cam = { s: 1, ox: 0, oy: 0, vw: 0 };
  function resize() {
    DPR = Math.min(window.devicePixelRatio || 1, 2);
    W = cv.clientWidth; H = cv.clientHeight;
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
  }
  window.addEventListener('resize', resize);

  function computeCam() {
    let s, ox, oy;
    if (mode === 'map') {
      s = Math.min(W / 1600, H / 900); ox = (W - 1600 * s) / 2; oy = (H - 900 * s) / 2;
    } else if (mode === 'duel' || mode === 'duo') {
      const panel = $('qpanel');
      const top = panel.classList.contains('hidden') ? H - 40 : panel.getBoundingClientRect().top;
      s = clamp(Math.min(W / 1080, (top - 110) / 250), 0.28, 1.15);
      ox = W / 2 - 800 * s; oy = top - 8 - GY * s;
    } else {
      s = Math.min(W / 1250, H / 720); ox = W / 2 - 900 * s; oy = Math.min(H - 900 * s, H * 0.86 - GY * s);
      if (mode === 'title' || mode === 'final') { s = Math.min(W / 1600, H / 900) * 1.02; ox = (W - 1600 * s) / 2; oy = H - 900 * s; }
    }
    cam.s = s; cam.ox = ox; cam.oy = oy;
    cam.vw = Math.max(ox, W - ox - 1600 * s, 0) / s + 60;
  }
  function worldXY(px, py) { return { x: (px - cam.ox) / cam.s, y: (py - cam.oy) / cam.s }; }

  // ------------------------------------------------------------------
  // الحالة العامة
  // ------------------------------------------------------------------
  let mode = 'title';
  let paused = false;
  let stageIdx = 0;
  let stage = STAGES[0];
  let scroll = 0;
  let shake = 0;
  const fx = [];
  let toastTimer = null;

  function toast(text, ms = 2600) {
    const t = $('toast');
    t.textContent = text; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }
  function flash(kind = '') {
    const f = $('flash');
    f.className = `flash on ${kind}`;
    requestAnimationFrame(() => requestAnimationFrame(() => { f.className = `flash ${kind}`; }));
  }
  function bump(id) { const e = $(id).parentElement; e.classList.remove('bump'); void e.offsetWidth; e.classList.add('bump'); }

  function updateRes() {
    if (!save) return;
    $('resDates').textContent = String(save.dates);
    $('resWater').textContent = String(save.water);
  }

  // ------------------------------------------------------------------
  // الشاشات
  // ------------------------------------------------------------------
  const SCREENS = ['scrTitle', 'scrSetup', 'scrMap', 'scrReward', 'scrShop', 'scrCodex', 'scrHelp', 'scrPause', 'scrLose', 'scrDuo', 'scrFinal', 'scrCert'];
  let screen = 'scrTitle';
  let returnTo = 'scrTitle';
  function show(id) {
    for (const s of SCREENS) $(s).classList.toggle('hidden', s !== id);
    screen = id;
  }
  function hideAll() { for (const s of SCREENS) $(s).classList.add('hidden'); screen = null; }

  function setHud(text) { $('hudMid').innerHTML = text; }
  function setMode(m) {
    mode = m;
    $('runnerUi').classList.toggle('hidden', m !== 'travel');
    $('bars').classList.toggle('hidden', !(m === 'duel' || m === 'duo'));
    if (m !== 'duel' && m !== 'duo') { $('qpanel').classList.add('hidden'); $('speech').classList.add('hidden'); }
    $('hud').querySelector('.hud-res').classList.toggle('hidden', !save || m === 'duo' || m === 'title');
    updateRes();
  }

  // ------------------------------------------------------------------
  // العنوان والإعداد
  // ------------------------------------------------------------------
  function goTitle() {
    setMode('title');
    paused = false;
    stage = STAGES[0];
    AU.setScene('menu');
    $('btnContinue').classList.toggle('hidden', !save);
    $('btnNew').textContent = save ? '✨ رحلة جديدة' : '✨ ابدأ الرحلة';
    setHud('');
    show('scrTitle');
  }

  let setupAge = 1;
  function buildAges(boxId, current, onPick) {
    const box = $(boxId); box.textContent = '';
    K.AGES.forEach((a, i) => {
      const b = el('button', i === current ? 'on' : '', a.label);
      b.onclick = () => { AU.play('click'); for (const x of box.children) x.classList.remove('on'); b.classList.add('on'); onPick(i); };
      box.append(b);
    });
  }
  function goSetup() {
    $('setupName').value = save ? save.name : '';
    setupAge = save ? save.age : 1;
    buildAges('ages', setupAge, (i) => { setupAge = i; });
    show('scrSetup');
  }
  $('setupGo').onclick = () => {
    AU.init();
    const name = $('setupName').value.trim() || 'الفارس';
    if (save && !confirm('ستبدأ رحلة جديدة ويُمسح التقدّم الحالي. هل أنت متأكد؟')) return;
    save = K.newSave(name, setupAge);
    persist();
    AU.play('unsheathe');
    goMap(0);
    setTimeout(() => toast(`أهلاً يا ${name}! رحلتك تبدأ من دمشق 🐎`, 3500), 300);
  };

  // ------------------------------------------------------------------
  // الخريطة
  // ------------------------------------------------------------------
  let mapSel = -1;
  let mapHover = -1;
  function goMap(select) {
    setMode('map');
    paused = false;
    AU.setScene('map');
    const r = K.rankOf(save.xp);
    setHud(`<b>${save.name}</b> • ${r.icon} ${r.name}`);
    renderRank();
    $('btnCert').classList.toggle('hidden', !save.finished);
    $('stationCard').classList.add('hidden');
    mapSel = -1;
    show('scrMap');
    const target = select != null ? select : Math.min(save.unlocked - 1, 7);
    if (target >= 0) selectStation(target);
  }
  function renderRank() {
    const r = K.rankOf(save.xp);
    const next = K.RANKS.find((x) => x.xp > save.xp);
    const box = $('rankBox'); box.textContent = '';
    const bar = el('div', 'xp'); const i = el('i');
    const from = r.xp; const to = next ? next.xp : r.xp + 1;
    i.style.width = `${next ? ((save.xp - from) / (to - from)) * 100 : 100}%`;
    bar.append(i);
    box.append(el('div', 'ic', r.icon), el('b', '', r.name), bar, el('small', '', next ? `${save.xp} / ${next.xp} نقطة خبرة` : `${save.xp} نقطة خبرة`));
  }
  const TRICK_TXT = {
    shadow: '🌑 يُطفئ الأنوار — حرّك إصبعك لتنير السؤال',
    wind: '🌪️ يبعثر كلمات السؤال',
    mirage: '🏜️ يحرّك الإجابات كالسراب',
    sand: '⏳ عاصفته تُسرع الوقت',
    stone: '🪨 أسئلة متتالية بلا راحة',
    wisdom: '🕊️ اختبار هادئ بلا مبارزة',
    final: '💫 يجمع كل خدع السحرة!',
  };
  function selectStation(i) {
    if (i >= save.unlocked) { toast('🔒 أكمل المحطة السابقة أولاً'); AU.play('wrong'); return; }
    mapSel = i;
    const st = STAGES[i];
    $('scSub').textContent = `المحطة ${i + 1} من 8 • ${st.sub}`;
    $('scName').textContent = st.name;
    const got = save.stars[i] || 0;
    $('scStars').textContent = '⭐'.repeat(got) + '☆'.repeat(3 - got);
    const ul = $('scFoes'); ul.textContent = '';
    st.guardians.forEach((g) => ul.append(el('li', '', `🧔 ${g.name}`)));
    ul.append(el('li', '', `👑 ${st.boss.name}`));
    if (st.boss.trick) ul.append(el('li', '', TRICK_TXT[st.boss.trick]));
    $('scGo').textContent = got ? '🐎 أعد المحطة' : '🐎 انطلق';
    $('stationCard').classList.remove('hidden');
    AU.play('page');
  }
  $('scGo').onclick = () => { AU.init(); if (mapSel >= 0) startStage(mapSel); };

  function drawMap(t) {
    ART.map(ctx, t, save ? save.unlocked : 1, mapSel, cam.vw);
    const pts = ART.MAP_PTS;
    for (let i = 0; i < pts.length; i++) {
      const [x, y] = pts[i];
      const unlocked = save && i < save.unlocked;
      const done = save && (save.stars[i] || 0) > 0;
      const current = save && i === save.unlocked - 1 && !done;
      const R = 30 + (i === mapSel ? 6 : 0) + (i === mapHover ? 3 : 0);
      if (current || i === mapSel) {
        ctx.strokeStyle = `rgba(232,182,74,${0.5 + 0.5 * Math.sin(t * 4)})`; ctx.lineWidth = 5;
        ctx.beginPath(); ctx.arc(x, y, R + 12 + Math.sin(t * 4) * 3, 0, Math.PI * 2); ctx.stroke();
      }
      const g = ctx.createRadialGradient(x - 8, y - 10, 4, x, y, R);
      if (done) { g.addColorStop(0, '#e05a4a'); g.addColorStop(1, '#7a120c'); }
      else if (unlocked) { g.addColorStop(0, '#ffe08a'); g.addColorStop(1, '#b5761a'); }
      else { g.addColorStop(0, '#b8ab94'); g.addColorStop(1, '#6a604e'); }
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(60,30,10,.5)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, R - 6, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = done ? '#ffe0b0' : unlocked ? '#5a3208' : '#3a342a';
      ctx.font = "900 26px 'Jannat LT', sans-serif"; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(done ? QB.STATIONS_INFO[i].icon : unlocked ? String(i + 1) : '🔒', x, y + 1);
      ctx.textBaseline = 'alphabetic';
      ctx.font = "900 24px 'Jannat LT', sans-serif";
      ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(246,231,196,.9)';
      const lx = x + (i % 2 ? -R - 14 : R + 14); ctx.textAlign = i % 2 ? 'right' : 'left';
      ctx.strokeText(STAGES[i].name, lx, y + 8); ctx.fillStyle = unlocked ? '#4a2a10' : 'rgba(74,42,16,.5)'; ctx.fillText(STAGES[i].name, lx, y + 8);
      if (done) { ctx.font = '16px sans-serif'; ctx.fillText('⭐'.repeat(save.stars[i]), lx, y + 30); }
    }
    // الفارس على الخريطة
    if (save) {
      const ci = Math.min(save.unlocked - 1, 7);
      const [x, y] = pts[ci];
      ART.knight(ctx, x + 6, y - 34, t, { dir: -1, scale: 0.36, gallop: 0 });
    }
  }

  function mapPick(px, py) {
    const p = worldXY(px, py);
    let best = -1; let bd = 60;
    ART.MAP_PTS.forEach(([x, y], i) => { const d = Math.hypot(p.x - x, p.y - y); if (d < bd) { bd = d; best = i; } });
    return best;
  }

  // ------------------------------------------------------------------
  // بدء المحطة والرحلة
  // ------------------------------------------------------------------
  let stageRun = null; // إحصاءات المحطة الحالية
  let run = null;      // حالة الرحلة

  function startStage(i) {
    stageIdx = i; stage = STAGES[i];
    stageRun = { correct: 0, total: 0, dates: 0, water: 0, xp: 0, falcon: 1 + (save.upgrades.falcon || 0), timeStop: 1, used: {}, hp: 100 };
    hideAll();
    startTravel();
  }

  const OBS = { damascus: ['rock', 'thorn'], bosra: ['column', 'rock'], castle: ['rock', 'thorn'], oasis: ['thorn', 'rock'], desert: ['scorpion', 'rock', 'scorpion'], hegra: ['rock', 'scorpion', 'column'], madinah: ['rock'], makkah: ['rock', 'thorn'] };
  const OBS_H = { rock: 46, scorpion: 40, thorn: 42, column: 38 };

  function startTravel() {
    setMode('travel');
    paused = false;
    AU.setScene('travel');
    AU.play('gallop');
    const prev = stageIdx === 0 ? 'دمشق' : STAGES[stageIdx - 1].name;
    $('runFrom').textContent = stageIdx === 0 ? 'الأسواق' : prev;
    $('runTo').textContent = stage.name;
    setHud(`الطريق إلى <b>${stage.name}</b>`);
    $('runHint').classList.remove('hidden');
    run = { t: 0, dur: stage.runner, speed: 520, jy: 0, vy: 0, jumps: 0, objs: [], next: 1.4, inv: 0, gallopT: 0, ending: false, hits: 0 };
  }

  function jump() {
    if (mode !== 'travel' || paused || !run) return;
    $('runHint').classList.add('hidden');
    if (run.jy <= 0.5) { run.vy = 980; run.jumps = 1; AU.play('jump'); }
    else if (run.jumps < 2) { run.vy = 820; run.jumps = 2; AU.play('jump'); burst(KX, GY - 60 - run.jy, ['#fff', '#f3e2bd'], 10, 'dust'); }
  }

  function spawnTravel() {
    const types = OBS[stage.theme];
    const peaceful = !!stage.peaceful;
    const k = run.t / run.dur;
    if (rng() < (peaceful ? 0.45 : 0.72)) {
      const type = types[Math.floor(rng() * types.length)];
      run.objs.push({ kind: 'obs', type, x: -120, hit: false });
    }
    // مجموعة تمر بقوس، وأحياناً قِربة ماء
    const n = 3 + Math.floor(rng() * 3);
    const base = rng() < 0.5 ? 70 : 170 + rng() * 60;
    for (let i = 0; i < n; i++) run.objs.push({ kind: 'pick', type: 'date', x: -260 - i * 60, y: GY - base - Math.sin((i / (n - 1)) * Math.PI) * 60 });
    if (rng() < 0.18) run.objs.push({ kind: 'pick', type: 'water', x: -260 - n * 60 - 80, y: GY - 230 });
    run.next = (peaceful ? 1.9 : 1.55 - k * 0.35) + rng() * 0.6;
  }

  function updateTravel(dt) {
    run.t += dt;
    const k = Math.min(1, run.t / run.dur);
    run.speed = 520 + 170 * k;
    scroll += run.speed * dt;
    // القفز
    if (run.jy > 0 || run.vy > 0) {
      run.vy -= 2700 * dt; run.jy += run.vy * dt;
      if (run.jy <= 0) { run.jy = 0; run.vy = 0; run.jumps = 0; AU.play('land'); burst(KX + 40, GY, ['#e8d2a0', '#c9a46a'], 8, 'dust'); }
    }
    run.inv = Math.max(0, run.inv - dt);
    run.gallopT -= dt;
    if (run.gallopT <= 0 && run.jy === 0) { AU.play('gallop'); run.gallopT = 0.46; }
    if (!run.ending) {
      run.next -= dt;
      if (run.next <= 0 && run.t < run.dur - 1.5) spawnTravel();
    }
    const magnet = 70 + (save.upgrades.saddle || 0) * 60;
    const ky = GY - 110 - run.jy;
    for (let i = run.objs.length - 1; i >= 0; i--) {
      const o = run.objs[i];
      o.x += run.speed * dt;
      if (o.kind === 'obs' && !o.hit && o.x > KX - 75 && o.x < KX + 45) {
        if (run.jy < OBS_H[o.type] - 4 && run.inv <= 0) {
          o.hit = true; run.inv = 1.1; run.hits++;
          shake = 10; flash('red'); AU.play('stumble');
          const lost = Math.min(save.dates, 2);
          if (lost) { save.dates -= lost; stageRun.dates -= lost; fxText(KX, GY - 220, `-${lost} 🌴`, '#ff8a6a'); updateRes(); }
        }
      }
      if (o.kind === 'pick') {
        const dx = KX - o.x; const dy = ky - o.y;
        if (Math.hypot(dx, dy) < magnet) {
          if (Math.hypot(dx, dy) < 50) {
            run.objs.splice(i, 1);
            if (o.type === 'date') { save.dates++; stageRun.dates++; AU.play('collect'); bump('resDates'); }
            else { if (save.water < 6) { save.water++; stageRun.water++; } AU.play('water'); bump('resWater'); fxText(o.x, o.y - 30, '+1 💧', '#8fd3ff'); }
            burst(o.x, o.y, o.type === 'date' ? ['#ffd36a', '#fff'] : ['#8fd3ff', '#fff'], 8, 'spark');
            updateRes();
            continue;
          }
          o.x += dx * Math.min(1, dt * 8); o.y += dy * Math.min(1, dt * 8);
        }
      }
      if (o.x > 1900) run.objs.splice(i, 1);
    }
    if (Math.random() < dt * 30) fx.push({ type: 'dust', x: KX + 50 + Math.random() * 30, y: GY - 2, vx: 120 + Math.random() * 80, vy: -40 - Math.random() * 60, life: 0.6, max: 0.6, r: 3 + Math.random() * 4, color: 'rgba(230,200,150,.7)' });
    $('runProg').style.width = `${k * 100}%`;
    $('runHorse').style.right = `${k * 100}%`;
    if (run.t >= run.dur && !run.ending) {
      run.ending = true;
      toast(`🏁 وصلت إلى ${stage.name}!`, 2000);
      setTimeout(() => { if (mode === 'travel') startEncounter(); }, 1300);
    }
  }

  function drawTravel(t) {
    ART.world(ctx, stage, t, -scroll, cam.vw);
    for (const o of run.objs) {
      if (o.kind === 'obs') { ctx.globalAlpha = o.hit ? 0.5 : 1; ART.obstacle(ctx, o.type, o.x, t); ctx.globalAlpha = 1; }
      else ART.pickup(ctx, o.type, o.x, o.y, t);
    }
    const blink = run.inv > 0 && Math.sin(t * 40) > 0;
    ctx.globalAlpha = blink ? 0.45 : 1;
    ART.knight(ctx, KX, GY, t, { dir: -1, gallop: 1, jump: run.jy, sword: 'up' });
    ctx.globalAlpha = 1;
    weather(t);
  }

  function weather(t) {
    if (stage.theme === 'desert') { // عاصفة رملية خفيفة
      ctx.fillStyle = 'rgba(230,180,110,.35)';
      for (let i = 0; i < 70; i++) { const x = ((i * 137 + t * 900) % (1600 + cam.vw * 2)) - cam.vw; const y = 300 + ((i * 71) % 420); ctx.fillRect(x, y + Math.sin(t * 3 + i) * 6, 26, 2); }
    }
    if (stage.theme === 'castle') {
      ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 2;
      for (let i = 0; i < 8; i++) { const x = ((i * 260 + t * 500) % 1900) - 150; const y = 200 + i * 50; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 60, y - 14, x + 120, y); ctx.stroke(); }
    }
  }

  // ------------------------------------------------------------------
  // المبارزات
  // ------------------------------------------------------------------
  let enc = null; // { queue, idx, foe, duel, qs, qi, prepared, locked, tLeft, qTime, frozen, shieldUsed, tricks, swing, cast, foeHurt, knightHurt, defeat }

  function startEncounter() {
    const foes = stage.guardians.map((g) => ({ ...g, isBoss: false })).concat([{ ...stage.boss, isBoss: true }]);
    enc = { queue: foes, idx: 0 };
    setMode('duel');
    startFoe();
  }

  function startFoe() {
    const foe = enc.queue[enc.idx];
    enc.foe = foe;
    enc.duel = K.createDuel(foe, save.upgrades, { playerHp: stageRun.hp });
    enc.shieldUsed = false;
    enc.tricks = [];
    enc.swing = 0; enc.cast = 0; enc.foeHurt = 0; enc.knightHurt = 0; enc.defeat = 0;
    enc.foeIn = 0;
    const count = foe.isBoss ? 14 : 8;
    enc.qs = K.pickQuestions(QB.QUESTIONS, stageIdx, save.age, count, rng, stageRun.used);
    enc.qi = 0;
    AU.setScene(foe.friendly ? 'wisdom' : foe.isBoss ? 'boss' : 'duel');
    $('enemyName').textContent = foe.name;
    $('playerName').textContent = save.name;
    setHud(`<b>${stage.name}</b> • ${foe.isBoss ? '👑 ' : ''}${foe.name}`);
    updateBars();
    $('qpanel').classList.add('hidden');
    if (foe.isBoss && !foe.friendly) { AU.play('phase'); flash('purple'); shake = 14; }
    speak(foe.name, foe.intro, () => { if (!foe.friendly) AU.play('unsheathe'); askNext(); });
  }

  function updateBars() {
    const d = enc.duel;
    $('enemyHp').style.width = `${(d.enemyHp / d.enemyMax) * 100}%`;
    $('playerHp').style.width = `${(d.playerHp / d.playerMax) * 100}%`;
  }

  // فقاعة الكلام بتأثير الآلة الكاتبة
  let speechCb = null; let typeTimer = null;
  function speak(who, text, cb) {
    const box = $('speech');
    $('speaker').textContent = who;
    const p = $('speechText'); p.textContent = '';
    box.classList.remove('hidden');
    speechCb = cb;
    let i = 0;
    clearInterval(typeTimer);
    typeTimer = setInterval(() => {
      i += 2; p.textContent = text.slice(0, i);
      if (i % 6 === 0) AU.play('click');
      if (i >= text.length) clearInterval(typeTimer);
    }, 28);
    p.dataset.full = text;
  }
  $('speechNext').onclick = () => {
    const p = $('speechText');
    if (p.textContent.length < (p.dataset.full || '').length) { clearInterval(typeTimer); p.textContent = p.dataset.full; return; }
    $('speech').classList.add('hidden');
    const cb = speechCb; speechCb = null;
    if (cb) cb();
  };

  // ------------------------------------------------------------------
  // الأسئلة
  // ------------------------------------------------------------------
  const CAT = { sci: ['علوم 🔬', ''], din: ['دين 🕌', 'din'], his: ['تاريخ وجغرافيا 🗺️', 'his'] };
  let mirageTimer = null;
  let orderPick = [];

  function askNext() {
    const d = enc.duel;
    if (d.done) { endFoe(); return; }
    if (enc.qi >= enc.qs.length) enc.qs = enc.qs.concat(K.pickQuestions(QB.QUESTIONS, stageIdx, save.age, 6, rng, stageRun.used));
    const q = enc.qs[enc.qi++];
    enc.prepared = K.prepare(q, rng);
    enc.locked = false;
    enc.tricks = enc.foe.isBoss ? K.tricksFor(enc.foe.trick, d.phase) : [];
    const sand = enc.tricks.includes('sand');
    enc.qTime = K.AGES[save.age].time * (sand ? 0.55 : 1) * (enc.foe.trick === 'stone' && d.phase > 0 ? 0.85 : 1) + (q.type === 'order' ? 10 : 0);
    enc.tLeft = enc.qTime;
    enc.frozen = 0;
    enc.lastTick = null;
    renderQuestion();
    computeCam();
  }

  function renderQuestion() {
    const panel = $('qpanel');
    const P = enc.prepared; const q = P.q;
    panel.classList.remove('hidden', 'locked', 't-shadow', 't-wind', 't-mirage', 't-sand');
    for (const t of enc.tricks) panel.classList.add(`t-${t}`);
    panel.querySelector('.trick-badge')?.remove();
    if (enc.tricks.length) panel.append(el('span', 'trick-badge', `✨ خدعة: ${enc.tricks.map((t) => ({ shadow: 'الظلال', wind: 'الرياح', mirage: 'السراب', sand: 'الرمال' })[t]).join(' + ')}`));
    const [catTxt, catCls] = CAT[q.cat] || CAT.sci;
    const chip = $('qCat'); chip.textContent = catTxt; chip.className = `chip ${catCls}`;
    $('qCount').textContent = `${'★'.repeat(q.d)}`;
    // نص السؤال (كلمات منفصلة لخدعة الرياح)
    const qt = $('qText'); qt.textContent = '';
    const words = q.q.split(' ');
    words.forEach((w, i) => {
      const s = el('span', 'w', w);
      if (enc.tricks.includes('wind')) { s.style.transform = `translate(${(Math.random() - 0.5) * 500}px, ${(Math.random() - 0.5) * 160}px) rotate(${(Math.random() - 0.5) * 90}deg)`; s.style.opacity = '0'; }
      qt.append(s); if (i < words.length - 1) qt.append(document.createTextNode(' '));
    });
    if (enc.tricks.includes('wind')) { AU.play('wind'); setTimeout(() => { for (const s of qt.querySelectorAll('.w')) { s.style.transform = ''; s.style.opacity = '1'; } }, 120); }
    if (enc.tricks.includes('sand')) AU.play('sand');
    $('explain').classList.add('hidden');
    const ans = $('answers'); ans.textContent = '';
    const ord = $('order');
    if (P.type === 'order') {
      ans.classList.add('hidden'); ord.classList.remove('hidden');
      orderPick = [];
      renderOrder();
    } else {
      ord.classList.add('hidden'); ans.classList.remove('hidden');
      ans.className = `answers ${P.type === 'tf' ? 'tf' : ''}`;
      P.options.forEach((o, i) => {
        const b = el('button', 'ans', o.t);
        b.dataset.i = String(i);
        b.onclick = () => choose(i);
        ans.append(b);
      });
    }
    clearInterval(mirageTimer);
    if (enc.tricks.includes('mirage') && P.type !== 'order') {
      mirageTimer = setInterval(() => {
        if (enc.locked) return;
        const btns = [...$('answers').children];
        const order = btns.map((_, i) => i).sort(() => Math.random() - 0.5);
        btns.forEach((b, i) => { b.style.order = String(order[i]); });
      }, 1700);
    }
    updateLifelines();
  }

  function renderOrder() {
    const P = enc.prepared;
    const slots = $('slots'); slots.textContent = '';
    for (let i = 0; i < P.items.length; i++) {
      const pick = orderPick[i];
      const s = el('div', `slot ${pick != null ? 'filled' : ''}`);
      s.append(el('b', '', String(i + 1)), document.createTextNode(pick != null ? P.items[pick].t : '…'));
      slots.append(s);
    }
    const pool = $('pool'); pool.textContent = '';
    P.items.forEach((it, i) => {
      if (orderPick.includes(i)) return;
      const b = el('button', 'ans', it.t);
      b.onclick = () => { if (enc.locked) return; AU.play('click'); orderPick.push(i); renderOrder(); };
      pool.append(b);
    });
    $('orderOk').disabled = orderPick.length !== P.items.length;
  }
  $('orderReset').onclick = () => { if (enc && !enc.locked) { orderPick = []; renderOrder(); } };
  $('orderOk').onclick = () => {
    if (!enc || enc.locked) return;
    const ok = K.checkOrder(enc.prepared, orderPick);
    resolve(ok, null);
  };

  function choose(i) {
    if (!enc || enc.locked || paused) return;
    const ok = enc.prepared.options[i].ok;
    resolve(ok, i);
  }

  function resolve(ok, chosen) {
    enc.locked = true;
    clearInterval(mirageTimer);
    const panel = $('qpanel'); panel.classList.add('locked');
    const P = enc.prepared;
    if (P.type !== 'order') {
      const btns = [...$('answers').children];
      btns.forEach((b, i) => { if (P.options[i].ok) b.classList.add('good'); else if (i === chosen) b.classList.add('bad'); });
    }
    const speed = enc.tLeft / enc.qTime;
    const res = K.answer(enc.duel, ok, speed);
    stageRun.total++; save.answered++;
    if (ok) { stageRun.correct++; save.correct++; }
    // الشرح
    const ex = $('explain');
    const correctTxt = P.type === 'order' ? P.q.a.join(' ← ') : P.options.find((o) => o.ok).t;
    ex.className = `explain ${ok ? '' : 'bad'}`;
    ex.textContent = ok ? `✔ أحسنت! ${P.q.e}` : `✖ الإجابة الصحيحة: «${correctTxt}» — ${P.q.e}`;
    if (chosen === -1) ex.textContent = `⏳ انتهى الوقت! الإجابة: «${correctTxt}» — ${P.q.e}`;
    if (ok) {
      const xp = 10 + (res.crit ? 5 : 0);
      save.xp += xp; stageRun.xp += xp;
      save.dates += 2; stageRun.dates += 2; updateRes();
      AU.play('correct');
      strike(res);
    } else {
      AU.play('wrong');
      if (enc.foe.friendly) { fxText(KX, GY - 260, 'فكّر مرة أخرى 🤍', '#fff'); }
      else spell(res);
    }
    persist();
    const wait = (enc.foe.trick === 'stone' && enc.duel.phase > 0) ? 1500 : ok ? 2600 : 3800;
    setTimeout(() => {
      if (mode !== 'duel') return;
      if (res.phaseChanged && enc.foe.isBoss && !enc.foe.friendly && !enc.duel.done) {
        const lines = enc.duel.phase === 1 ? 'أحسنت… لكن هذه البداية فقط! خذ هذه!' : 'سأستخدم كل قوتي الآن!';
        AU.play('phase'); flash('purple'); shake = 16;
        $('qpanel').classList.add('hidden');
        speak(enc.foe.name, enc.foe.trick === 'final' ? lines : `${lines} (${TRICK_TXT[enc.foe.trick].replace(/^.\S*\s/, '')})`, askNext);
        return;
      }
      askNext();
    }, wait);
  }

  function strike(res) {
    enc.swing = 0.001;
    setTimeout(() => {
      AU.play(res.crit ? 'crit' : 'slash');
      setTimeout(() => AU.play('clang'), 80);
      enc.foeHurt = 1; shake = res.crit ? 14 : 8;
      fx.push({ type: 'slash', x: FX0 + 10, y: GY - 120, life: 0.45, max: 0.45, crit: res.crit });
      burst(FX0, GY - 130, ['#ffe08a', '#ffffff', '#ffb03a'], res.crit ? 30 : 18, 'spark');
      shards(FX0, GY - 130, enc.foe.color || '#9a7aff');
      fxText(FX0, GY - 250, `-${res.damage}`, '#ffe08a', res.crit ? 'ضربة قاضية ⚡' : null);
      updateBars();
    }, 260);
  }

  function spell(res) {
    enc.cast = 1;
    AU.play('spell');
    const color = enc.foe.color || '#b07aff';
    fx.push({ type: 'orb', x0: FX0 + 50, y0: GY - 210, x1: KX, y1: GY - 130, t: 0, dur: 0.55, color, done: () => {
      AU.play(res.hurt > 15 ? 'hurt' : 'shield');
      enc.knightHurt = 1; shake = 10; flash('red');
      burst(KX, GY - 130, [color, '#fff'], 22, 'spark');
      fx.push({ type: 'ring', x: KX - 20, y: GY - 120, life: 0.5, max: 0.5, color: '#ffe08a' });
      fxText(KX, GY - 260, `-${res.hurt}`, '#ff8a6a');
      updateBars();
    } });
  }

  function timeout() {
    if (!enc || enc.locked) return;
    resolve(false, -1);
  }

  function endFoe() {
    $('qpanel').classList.add('hidden');
    const d = enc.duel; const foe = enc.foe;
    stageRun.hp = d.playerHp;
    if (!d.won) {
      AU.play('lose');
      $('loseText').textContent = foe.isBoss ? `${foe.name} انتصر بخدعه هذه المرة… لكن العلم يُكتسب بالمحاولة!` : 'لا بأس يا فارس، فكل فارس يتعلّم من عثرته.';
      show('scrLose');
      return;
    }
    enc.defeat = 0.001;
    AU.play('defeat');
    const bonus = foe.isBoss ? 20 : 8;
    save.dates += bonus; stageRun.dates += bonus; updateRes(); persist();
    setTimeout(() => {
      speak(foe.name, foe.win, () => {
        enc.idx++;
        if (enc.idx < enc.queue.length) {
          stageRun.hp = Math.min(100, stageRun.hp + 30);
          toast(`💚 استرحت قليلاً (+30 حياة) • 🌴 +${bonus}`, 2200);
          startFoe();
        } else finishStage();
      });
    }, 900);
  }

  $('btnRetry').onclick = () => { AU.play('click'); hideAll(); stageRun.hp = 100; startFoe(); };
  $('btnLoseMap').onclick = () => { AU.play('click'); goMap(stageIdx); };

  // ------------------------------------------------------------------
  // المساعدات
  // ------------------------------------------------------------------
  function updateLifelines() {
    if (!stageRun || !enc || enc.isDuo) return;
    const P = enc.prepared;
    const set = (id, n, ok) => { const b = $(id); b.querySelector('b').textContent = String(n); b.disabled = !ok; };
    set('lfFalcon', stageRun.falcon, stageRun.falcon > 0 && !enc.locked);
    set('lfShield', enc.shieldUsed ? 0 : 1, !enc.shieldUsed && !enc.locked && P.type === 'mc');
    set('lfWater', save.water, save.water > 0 && !enc.locked && enc.duel.playerHp < enc.duel.playerMax && !enc.foe.friendly);
    set('lfTime', stageRun.timeStop, stageRun.timeStop > 0 && !enc.locked);
  }
  $('lfFalcon').onclick = () => {
    if (!enc || enc.locked || stageRun.falcon <= 0) return;
    stageRun.falcon--;
    AU.play('falcon');
    fx.push({ type: 'falcon', t: 0, dur: 1.4 });
    const P = enc.prepared;
    if (P.type === 'order') {
      orderPick = [];
      for (let k = 0; k < Math.min(2, P.items.length - 1); k++) orderPick.push(P.items.findIndex((it) => it.i === k));
      renderOrder();
    } else {
      const btns = [...$('answers').children];
      btns.forEach((b, i) => { if (P.options[i].ok) b.classList.add('hint'); });
    }
    updateLifelines();
  };
  $('lfShield').onclick = () => {
    if (!enc || enc.locked || enc.shieldUsed || enc.prepared.type !== 'mc') return;
    enc.shieldUsed = true;
    AU.play('shield');
    const btns = [...$('answers').children];
    const wrong = btns.map((b, i) => i).filter((i) => !enc.prepared.options[i].ok).sort(() => Math.random() - 0.5).slice(0, 2);
    wrong.forEach((i) => btns[i].classList.add('off'));
    updateLifelines();
  };
  $('lfWater').onclick = () => {
    if (!enc || enc.locked || save.water <= 0) return;
    save.water--; K.healWater(enc.duel); updateBars(); updateRes(); persist();
    AU.play('heal');
    burst(KX, GY - 120, ['#8fd3ff', '#3fcf6e', '#fff'], 24, 'spark');
    fxText(KX, GY - 250, '+35 💧', '#8fd3ff');
    updateLifelines();
  };
  $('lfTime').onclick = () => {
    if (!enc || enc.locked || stageRun.timeStop <= 0) return;
    stageRun.timeStop--; enc.frozen = 10;
    AU.play('freeze');
    updateLifelines();
  };

  // خدعة الظلال: الضوء يتبع الإصبع
  let veilAuto = 0;
  $('qpanel').addEventListener('pointermove', (e) => {
    const r = $('qpanel').getBoundingClientRect();
    $('qpanel').style.setProperty('--vx', `${e.clientX - r.left}px`);
    $('qpanel').style.setProperty('--vy', `${e.clientY - r.top}px`);
    veilAuto = 2.5;
  });

  // ------------------------------------------------------------------
  // المكافأة
  // ------------------------------------------------------------------
  function finishStage() {
    const i = stageIdx;
    const stars = K.starsFor(stageRun.correct, stageRun.total);
    const rankBefore = K.rankOf(save.xp - stageRun.xp).name;
    save.stars[i] = Math.max(save.stars[i] || 0, stars);
    save.unlocked = Math.min(8, Math.max(save.unlocked, i + 2));
    if (!save.codex.includes(i)) save.codex.push(i);
    save.xp += 50; stageRun.xp += 50;
    persist();
    notify('stage-complete', { stage: i + 1, name: STAGES[i].name, stars, correct: stageRun.correct, total: stageRun.total });
    AU.setScene('victory');
    AU.play('fanfare');
    setTimeout(() => AU.play('stamp'), 250);
    const info = QB.STATIONS_INFO[i];
    $('rwSeal').textContent = info.icon;
    $('rwSub').textContent = `ختم المحطة ${i + 1} من 8`;
    $('rwTitle').textContent = `أتممت محطة ${STAGES[i].name}!`;
    const st = $('rwStars'); st.textContent = '';
    for (let k = 0; k < 3; k++) st.append(el('span', k < stars ? '' : 'off', '⭐'));
    const loot = $('rwLoot'); loot.textContent = '';
    loot.append(el('span', '', `✔ ${stageRun.correct} / ${stageRun.total}`), el('span', '', `🌴 ${stageRun.dates >= 0 ? '+' : ''}${stageRun.dates}`), el('span', '', `✨ +${stageRun.xp} خبرة`));
    $('rwArtifact').textContent = `${info.icon} حصلت على: ${info.artifact}`;
    $('rwFact').textContent = info.fact;
    const acts = $('rwActions'); acts.textContent = '';
    const add = (t, cls, fn) => { const b = el('button', `btn ${cls}`, t); b.onclick = () => { AU.play('click'); fn(); }; acts.append(b); };
    if (i === 7) add('🌅 ادخل مكة المكرمة', 'gold big', startFinale);
    else { add('🗺️ إلى المحطة التالية', 'gold', () => goMap(i + 1)); add('⛺ مخيم القافلة', 'green', goShop); }
    setMode('reward');
    setHud(`ختم <b>${STAGES[i].name}</b> ${info.icon}`);
    show('scrReward');
    const rankAfter = K.rankOf(save.xp).name;
    if (rankAfter !== rankBefore) setTimeout(() => { toast(`🎉 رتبة جديدة: ${K.rankOf(save.xp).icon} ${rankAfter}`, 4000); AU.play('fanfare'); }, 1400);
  }

  // ------------------------------------------------------------------
  // مخيم القافلة
  // ------------------------------------------------------------------
  function goShop() {
    renderShop();
    show('scrShop');
    AU.play('page');
  }
  function renderShop() {
    $('shopDates').textContent = `(لديك ${save.dates} 🌴)`;
    const box = $('shop'); box.textContent = '';
    for (const [key, u] of Object.entries(K.UPGRADES)) {
      const lvl = save.upgrades[key] || 0;
      const cost = K.upgradeCost(key, lvl);
      const it = el('div', 'item');
      it.append(el('div', 'ic', u.icon), el('b', '', u.name), el('small', '', u.desc), el('div', 'lv', '◆'.repeat(lvl) + '◇'.repeat(u.costs.length - lvl)));
      const b = el('button', 'btn small gold', cost == null ? 'الأعلى ✔' : `${cost} 🌴`);
      b.disabled = cost == null;
      b.onclick = () => {
        const r = K.buyUpgrade(save, key);
        if (!r.ok) { toast(r.reason); AU.play('wrong'); return; }
        AU.play('unsheathe'); persist(); updateRes(); renderShop();
        toast(`${u.icon} ${u.name} — المستوى ${r.level}`);
      };
      it.append(b); box.append(it);
    }
    const w = el('div', 'item');
    w.append(el('div', 'ic', '💧'), el('b', '', 'قِربة ماء'), el('small', '', 'تشفيك في المبارزة (حتى 6 قِرب)'), el('div', 'lv', `لديك ${save.water}`));
    const wb = el('button', 'btn small gold', '6 🌴');
    wb.disabled = save.water >= 6;
    wb.onclick = () => {
      if (save.dates < 6) { toast('تحتاج تمراً أكثر 🌴'); AU.play('wrong'); return; }
      save.dates -= 6; save.water++; persist(); updateRes(); AU.play('water'); renderShop();
    };
    w.append(wb); box.append(w);
  }

  // ------------------------------------------------------------------
  // المخطوطة
  // ------------------------------------------------------------------
  function goCodex() {
    returnTo = screen || 'scrTitle';
    const box = $('codex'); box.textContent = '';
    const s = save || K.newSave('');
    const acc = s.answered ? Math.round((s.correct / s.answered) * 100) : 0;
    $('codexStats').textContent = save ? `${save.name} • ${K.rankOf(save.xp).icon} ${K.rankOf(save.xp).name} • ${save.correct} إجابة صحيحة من ${save.answered} (${acc}%)` : 'ابدأ الرحلة لتملأ المخطوطة!';
    STAGES.forEach((st, i) => {
      const info = QB.STATIONS_INFO[i];
      const open = save && save.codex.includes(i);
      const c = el('div', `cx ${open ? '' : 'locked'}`);
      c.append(el('span', 'ic', open ? info.icon : '🔒'), el('b', '', st.name), el('small', '', open ? info.artifact : 'لم تصل بعد'));
      if (open) c.append(el('p', '', info.fact));
      box.append(c);
    });
    show('scrCodex');
    AU.play('page');
  }

  // ------------------------------------------------------------------
  // النهاية والشهادة
  // ------------------------------------------------------------------
  let finale = null;
  function startFinale() {
    stage = STAGES[7];
    setMode('final');
    hideAll();
    AU.setScene('finale');
    finale = { t: 0, x: 1500 };
    save.finished = true;
    save.finishedAt = save.finishedAt || new Date().toISOString();
    save.xp = Math.max(save.xp, 1300);
    persist();
    notify('journey-complete', { name: save.name, stars: save.stars.reduce((a, b) => a + (b || 0), 0), correct: save.correct, answered: save.answered });
    setHud('<b>مكة المكرمة</b> 🌅');
    setTimeout(() => {
      if (mode !== 'final') return;
      $('finTitle').textContent = `وصل الفارس ${save.name} إلى مكة المكرمة 🌅`;
      $('finText').textContent = 'من دمشق إلى مكة، ثماني محطات عبرتها بالعلم لا بالسحر. هزمت الظلال والرياح والسراب والرمال والصخر، لأن العلم نور يبدّد الأوهام. أنت الآن «فارس النور» 🌟';
      const acts = $('finActions'); acts.textContent = '';
      const a = el('button', 'btn gold big', '🏅 شهادتي'); a.onclick = () => { AU.play('click'); returnTo = 'scrFinal'; goCert(); };
      const b = el('button', 'btn ghost', '🗺️ الخريطة'); b.onclick = () => { AU.play('click'); goMap(7); };
      acts.append(a, b);
      show('scrFinal');
      AU.play('fanfare');
    }, 5200);
  }

  function drawFinale(t, dt) {
    finale.t += dt;
    finale.x = Math.max(980, finale.x - dt * 110);
    ART.world(ctx, stage, t, 0, cam.vw);
    // أشعة الفجر
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 - 0.9 + i * 0.22 + Math.sin(t * 0.3 + i) * 0.02;
      const gr = ctx.createLinearGradient(1180, 560, 1180 + Math.cos(a) * 900, 560 + Math.sin(a) * 900);
      gr.addColorStop(0, 'rgba(255,220,150,.22)'); gr.addColorStop(1, 'rgba(255,220,150,0)');
      ctx.fillStyle = gr; ctx.beginPath(); ctx.moveTo(1180, 560); ctx.lineTo(1180 + Math.cos(a - 0.05) * 1000, 560 + Math.sin(a - 0.05) * 1000); ctx.lineTo(1180 + Math.cos(a + 0.05) * 1000, 560 + Math.sin(a + 0.05) * 1000); ctx.fill();
    }
    ctx.restore();
    // طيور
    for (let i = 0; i < 6; i++) {
      const x = (t * 60 + i * 230) % 1900 - 150; const y = 220 + Math.sin(t + i) * 30 + i * 18;
      ctx.strokeStyle = 'rgba(60,40,40,.7)'; ctx.lineWidth = 3; const f = Math.sin(t * 8 + i) * 8;
      ctx.beginPath(); ctx.moveTo(x - 14, y - f); ctx.quadraticCurveTo(x - 6, y - 4, x, y); ctx.quadraticCurveTo(x + 6, y - 4, x + 14, y - f); ctx.stroke();
    }
    ART.knight(ctx, finale.x, GY, t, { dir: -1, gallop: finale.x > 985 ? 0.35 : 0, sword: 'down' });
    if (finale.t > 1) {
      ctx.globalAlpha = Math.min(1, (finale.t - 1) / 1.5);
      ctx.font = "900 64px 'Jannat LT', sans-serif"; ctx.textAlign = 'center';
      ctx.lineWidth = 10; ctx.strokeStyle = 'rgba(60,30,10,.6)'; ctx.strokeText('مكة المكرمة', 800, 200);
      ctx.fillStyle = '#ffe9b0'; ctx.fillText('مكة المكرمة', 800, 200);
      ctx.globalAlpha = 1;
    }
  }

  const logoImg = new Image(); logoImg.src = '../assets/logo.png';
  function goCert() {
    const c = $('cert'); const g = c.getContext('2d');
    const w = c.width, h = c.height;
    const pg = g.createRadialGradient(w / 2, h / 2, 100, w / 2, h / 2, w * 0.7);
    pg.addColorStop(0, '#fbf1d6'); pg.addColorStop(1, '#e3c58a');
    g.fillStyle = pg; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(120,80,30,.05)';
    for (let i = 0; i < 400; i++) { g.beginPath(); g.arc((i * 397) % w, (i * 211) % h, 2 + (i % 9), 0, Math.PI * 2); g.fill(); }
    // إطار مزدوج وزخارف
    g.strokeStyle = '#8a5a12'; g.lineWidth = 14; g.strokeRect(40, 40, w - 80, h - 80);
    g.strokeStyle = '#c9902a'; g.lineWidth = 4; g.strokeRect(66, 66, w - 132, h - 132);
    for (let x = 100; x < w - 80; x += 60) { ART.starShape(g, x, 66, 12, 5, 8, 'rgba(201,144,42,.8)', 0); ART.starShape(g, x, h - 66, 12, 5, 8, 'rgba(201,144,42,.8)', 0); }
    [[66, 66], [w - 66, 66], [66, h - 66], [w - 66, h - 66]].forEach(([x, y]) => { ART.starShape(g, x, y, 34, 14, 8, '#8a5a12', 0); ART.starShape(g, x, y, 18, 8, 8, '#e8b64a', 0.3); });
    if (logoImg.complete && logoImg.naturalWidth) g.drawImage(logoImg, w / 2 - 110, 110, 220, 220 * logoImg.naturalHeight / logoImg.naturalWidth);
    g.textAlign = 'center'; g.fillStyle = '#7a4f12';
    g.font = "900 92px 'Jannat LT', serif"; g.fillText('شهادة فارس النور', w / 2, 360);
    g.font = "700 40px 'Jannat LT', serif"; g.fillStyle = '#5a3a1a'; g.fillText('تشهد قافلة «فارس الدرب» بأنّ الفارس', w / 2, 450);
    g.font = "900 110px 'Jannat LT', serif"; g.fillStyle = '#1f6a3a'; g.fillText(save.name, w / 2, 590);
    g.strokeStyle = '#c9902a'; g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2 - 380, 620); g.lineTo(w / 2 + 380, 620); g.stroke();
    g.font = "700 38px 'Jannat LT', serif"; g.fillStyle = '#5a3a1a';
    g.fillText('قد أتمّ رحلة العلم على طريق الحج الشامي من دمشق إلى مكة المكرمة،', w / 2, 690);
    g.fillText(`وعبر ثماني محطات، وأجاب إجابة صحيحة عن ${save.correct} سؤالاً في العلوم والدين والتاريخ.`, w / 2, 745);
    const stars = save.stars.reduce((a, b) => a + (b || 0), 0);
    const acc = save.answered ? Math.round((save.correct / save.answered) * 100) : 0;
    g.font = "900 40px 'Jannat LT', serif"; g.fillStyle = '#7a4f12';
    g.fillText(`⭐ ${stars} / 24      🎯 الدقة ${acc}%      🌟 ${K.rankOf(save.xp).name}`, w / 2, 840);
    const date = new Date(save.finishedAt || Date.now());
    let ds = ''; try { ds = date.toLocaleDateString('ar', { year: 'numeric', month: 'long', day: 'numeric' }); } catch { ds = date.toDateString(); }
    g.font = "700 30px 'Jannat LT', serif"; g.fillStyle = '#6a4422'; g.fillText(`حُرّرت في ${ds}`, w / 2, 905);
    // الختم الأحمر
    const sx = w - 260, sy = h - 230;
    const sg = g.createRadialGradient(sx - 20, sy - 20, 10, sx, sy, 100);
    sg.addColorStop(0, '#d8483a'); sg.addColorStop(1, '#7a120c');
    g.fillStyle = sg; g.beginPath();
    for (let i = 0; i < 24; i++) { const a = (i / 24) * Math.PI * 2; const r = i % 2 ? 92 : 100; g.lineTo(sx + Math.cos(a) * r, sy + Math.sin(a) * r); }
    g.fill();
    ART.starShape(g, sx, sy, 56, 24, 8, '#ffd9a8', 0.2);
    ART.starShape(g, sx, sy, 22, 10, 8, '#b5281c', 0.6);
    g.font = "900 30px 'Jannat LT', serif"; g.fillStyle = '#7a120c'; g.fillText('خَتْم فارس الدرب', sx, sy + 140);
    g.font = "900 30px 'Jannat LT', serif"; g.fillStyle = '#7a4f12'; g.fillText('STEAM Games', 260, h - 200);
    g.font = "700 26px 'Jannat LT', serif"; g.fillText('العلم نورٌ يبدّد الأوهام', 260, h - 160);
    show('scrCert');
  }
  $('certDl').onclick = () => {
    const a = document.createElement('a');
    a.download = `شهادة-فارس-الدرب-${(save && save.name) || ''}.png`;
    try { a.href = $('cert').toDataURL('image/png'); a.click(); notify('certificate-downloaded', {}); } catch { toast('تعذّر التحميل — جرّب الضغط المطوّل على الشهادة لحفظها'); }
  };

  // ------------------------------------------------------------------
  // مبارزة فارسين
  // ------------------------------------------------------------------
  let duo = null;
  let duoAge = 1;
  function goDuoSetup() {
    buildAges('duoAges', duoAge, (i) => { duoAge = i; });
    show('scrDuo');
  }
  $('duoGo').onclick = () => {
    AU.init(); AU.play('unsheathe');
    const names = [$('duo1').value.trim() || 'فارس 1', $('duo2').value.trim() || 'فارس 2'];
    const ds = K.AGES[duoAge].dset[0];
    const pool = K.shuffle(QB.QUESTIONS.filter((q) => ds.includes(q.d)), rng);
    duo = { names, hp: [100, 100], turn: 0, qs: pool, qi: 0, rounds: 0, maxRounds: 14, locked: false, swing: [0, 0], hurt: [0, 0] };
    stage = STAGES[Math.floor(rng() * 8)];
    hideAll();
    setMode('duo');
    AU.setScene('duel');
    $('playerName').textContent = names[0];
    $('enemyName').textContent = names[1];
    duoBars();
    duoNext();
  };
  function duoBars() {
    $('playerHp').style.width = `${duo.hp[0]}%`;
    $('enemyHp').style.width = `${duo.hp[1]}%`;
  }
  function duoNext() {
    if (duo.hp[0] <= 0 || duo.hp[1] <= 0 || duo.rounds >= duo.maxRounds) { duoEnd(); return; }
    const q = duo.qs[duo.qi++ % duo.qs.length];
    duo.prepared = K.prepare(q, rng);
    duo.locked = false;
    duo.qTime = K.AGES[duoAge].time + (q.type === 'order' ? 10 : 0);
    duo.tLeft = duo.qTime;
    setHud(`دور: <b style="color:${duo.turn === 0 ? '#3fcf6e' : '#6fa0ff'}">${duo.names[duo.turn]}</b> • الجولة ${Math.floor(duo.rounds / 2) + 1}`);
    // نستخدم نفس لوحة الأسئلة
    enc = { prepared: duo.prepared, locked: false, tricks: [], duel: { playerHp: 1, playerMax: 1 }, foe: { friendly: true }, isDuo: true };
    renderQuestion();
    $('lifelines').classList.add('hidden');
    toast(`⚔️ دور ${duo.names[duo.turn]}`, 1400);
    computeCam();
  }
  function duoResolve(ok, chosen) {
    duo.locked = true; enc.locked = true;
    const P = duo.prepared;
    $('qpanel').classList.add('locked');
    if (P.type !== 'order') [...$('answers').children].forEach((b, i) => { if (P.options[i].ok) b.classList.add('good'); else if (i === chosen) b.classList.add('bad'); });
    const correctTxt = P.type === 'order' ? P.q.a.join(' ← ') : P.options.find((o) => o.ok).t;
    const ex = $('explain'); ex.className = `explain ${ok ? '' : 'bad'}`;
    ex.textContent = ok ? `✔ ${P.q.e}` : `✖ الإجابة: «${correctTxt}» — ${P.q.e}`;
    const me = duo.turn; const other = 1 - me;
    if (ok) {
      const dmg = Math.round(22 + 12 * (duo.tLeft / duo.qTime));
      duo.hp[other] = Math.max(0, duo.hp[other] - dmg);
      AU.play('correct'); duo.swing[me] = 0.001;
      setTimeout(() => {
        AU.play('slash'); AU.play('clang'); duo.hurt[other] = 1; shake = 9;
        const x = other === 0 ? KX : FX0 + 20;
        fx.push({ type: 'slash', x, y: GY - 120, life: 0.45, max: 0.45 });
        burst(x, GY - 130, ['#ffe08a', '#fff'], 20, 'spark');
        fxText(x, GY - 250, `-${dmg}`, '#ffe08a');
        duoBars();
      }, 260);
    } else AU.play('wrong');
    duo.rounds++;
    setTimeout(() => { if (mode !== 'duo') return; duo.turn = other; duoNext(); }, ok ? 2600 : 3400);
  }
  function duoEnd() {
    $('qpanel').classList.add('hidden');
    $('lifelines').classList.remove('hidden');
    const w = duo.hp[0] === duo.hp[1] ? -1 : duo.hp[0] > duo.hp[1] ? 0 : 1;
    AU.play('fanfare');
    notify('duo-finished', { names: duo.names, hp: duo.hp, winner: w < 0 ? null : duo.names[w] });
    $('finTitle').textContent = w < 0 ? 'تعادل! ⚔️🤝' : `🏆 فاز ${duo.names[w]}!`;
    $('finText').textContent = w < 0 ? 'فارسان متكافئان في العلم والشجاعة!' : `أحسن ${duo.names[w]} في المبارزة. والفائز الحقيقي من تعلّم معلومة جديدة!`;
    const acts = $('finActions'); acts.textContent = '';
    const a = el('button', 'btn gold', '⚔️ مبارزة جديدة'); a.onclick = () => { AU.play('click'); $('duoGo').onclick(); };
    const b = el('button', 'btn ghost', '🏠 القائمة'); b.onclick = () => { AU.play('click'); goTitle(); };
    acts.append(a, b);
    show('scrFinal');
  }

  // ------------------------------------------------------------------
  // المؤثرات
  // ------------------------------------------------------------------
  function burst(x, y, colors, n, kind) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2; const v = 120 + Math.random() * 380;
      fx.push({ type: kind || 'spark', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 80, life: 0.7 + Math.random() * 0.4, max: 1.1, r: 2 + Math.random() * 4, color: colors[i % colors.length] });
    }
  }
  function shards(x, y, color) {
    for (let i = 0; i < 10; i++) {
      const a = Math.random() * Math.PI * 2; const v = 200 + Math.random() * 300;
      fx.push({ type: 'shard', x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 150, life: 1, max: 1, r: 6 + Math.random() * 10, rot: Math.random() * 6, color });
    }
  }
  function fxText(x, y, text, color, sub) { fx.push({ type: 'text', x, y, vy: -60, life: 1.5, max: 1.5, text, color, sub }); }

  function drawFx(dt, t) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      if (f.type === 'orb') {
        f.t += dt;
        const k = Math.min(1, f.t / f.dur);
        const x = f.x0 + (f.x1 - f.x0) * k; const y = f.y0 + (f.y1 - f.y0) * k - Math.sin(k * Math.PI) * 120;
        const g = ctx.createRadialGradient(x, y, 2, x, y, 40);
        g.addColorStop(0, '#fff'); g.addColorStop(0.3, f.color); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, 40, 0, Math.PI * 2); ctx.fill();
        for (let k2 = 0; k2 < 3; k2++) fx.push({ type: 'spark', x, y, vx: (Math.random() - 0.5) * 80, vy: (Math.random() - 0.5) * 80, life: 0.35, max: 0.35, r: 3, color: f.color });
        if (k >= 1) { fx.splice(i, 1); f.done(); }
        continue;
      }
      if (f.type === 'falcon') {
        f.t += dt;
        const k = f.t / f.dur;
        ART.falcon(ctx, 1500 - k * 1100, 260 + Math.sin(k * Math.PI * 2) * 60, t, -1);
        if (k >= 1) fx.splice(i, 1);
        continue;
      }
      f.life -= dt;
      if (f.life <= 0) { fx.splice(i, 1); continue; }
      const a = clamp(f.life / (f.max || 1), 0, 1);
      ctx.globalAlpha = a;
      if (f.type === 'spark' || f.type === 'dust') {
        f.x += f.vx * dt; f.y += f.vy * dt; f.vy += (f.type === 'dust' ? 60 : 500) * dt; f.vx *= 0.97;
        ctx.fillStyle = f.color; ctx.beginPath(); ctx.arc(f.x, f.y, f.r * (f.type === 'dust' ? (1.6 - a) * 2 : 1), 0, Math.PI * 2); ctx.fill();
      } else if (f.type === 'shard') {
        f.x += f.vx * dt; f.y += f.vy * dt; f.vy += 700 * dt; f.rot += dt * 8;
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(f.rot);
        ctx.fillStyle = f.color; ctx.beginPath(); ctx.moveTo(0, -f.r); ctx.lineTo(f.r * 0.6, f.r * 0.5); ctx.lineTo(-f.r * 0.5, f.r * 0.4); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.moveTo(0, -f.r); ctx.lineTo(f.r * 0.2, 0); ctx.lineTo(-f.r * 0.3, 0); ctx.fill();
        ctx.restore();
      } else if (f.type === 'slash') {
        const k = 1 - a;
        ctx.save(); ctx.translate(f.x, f.y); ctx.rotate(-0.6);
        ctx.strokeStyle = f.crit ? '#fff3a0' : '#ffffff'; ctx.lineWidth = 16 * a + 2; ctx.lineCap = 'round';
        ctx.shadowColor = '#ffd84a'; ctx.shadowBlur = 30;
        ctx.beginPath(); ctx.arc(0, 0, 110 + k * 30, -1.3 + k * 0.4, 1.0 + k * 0.6); ctx.stroke();
        ctx.restore();
      } else if (f.type === 'ring') {
        ctx.strokeStyle = f.color; ctx.lineWidth = 6 * a;
        ctx.beginPath(); ctx.arc(f.x, f.y, 70 + (1 - a) * 60, 0, Math.PI * 2); ctx.stroke();
      } else if (f.type === 'text') {
        f.y += f.vy * dt;
        ctx.font = "900 52px 'Jannat LT', sans-serif"; ctx.textAlign = 'center';
        ctx.direction = /^[-+]/.test(f.text) ? 'ltr' : 'rtl';
        ctx.lineWidth = 8; ctx.strokeStyle = 'rgba(0,0,0,.6)'; ctx.strokeText(f.text, f.x, f.y); ctx.fillStyle = f.color; ctx.fillText(f.text, f.x, f.y);
        if (f.sub) { ctx.font = "900 30px 'Jannat LT', sans-serif"; ctx.strokeText(f.sub, f.x, f.y - 52); ctx.fillStyle = '#fff3a0'; ctx.fillText(f.sub, f.x, f.y - 52); }
      }
      ctx.globalAlpha = 1;
    }
  }

  // ------------------------------------------------------------------
  // مشهد المبارزة
  // ------------------------------------------------------------------
  function drawDuel(t, dt) {
    ART.world(ctx, stage, t, -stageIdx * 900 - 300, cam.vw);
    weather(t);
    if (mode === 'duo') {
      duo.swing = duo.swing.map((s) => (s > 0 ? (s + dt * 2.6 > 1 ? 0 : s + dt * 2.6) : 0));
      duo.hurt = duo.hurt.map((h) => Math.max(0, h - dt * 2.5));
      ART.knight(ctx, FX0 + 20, GY, t, { dir: 1, cloak: '#2f6fd0', horse: '#8b5a2b', horseDark: '#6a4220', mane: '#2a1a0e', sword: duo.swing[1] ? 'swing' : 'up', swing: duo.swing[1], hurt: duo.hurt[1], glow: 0.6 });
      ART.knight(ctx, KX, GY, t, { dir: -1, sword: duo.swing[0] ? 'swing' : 'up', swing: duo.swing[0], hurt: duo.hurt[0], glow: 0.6 });
      return;
    }
    if (!enc) return;
    enc.swing = enc.swing > 0 ? (enc.swing + dt * 2.6 > 1 ? 0 : enc.swing + dt * 2.6) : 0;
    enc.cast = Math.max(0, enc.cast - dt * 1.6);
    enc.foeHurt = Math.max(0, enc.foeHurt - dt * 2.5);
    enc.knightHurt = Math.max(0, enc.knightHurt - dt * 2.5);
    if (enc.defeat > 0) enc.defeat = Math.min(1, enc.defeat + dt * 0.9);
    enc.foeIn = Math.min(1, enc.foeIn + dt * 1.5);
    const foe = enc.foe;
    // تعتيم الطور الأخير للخصم الكبير
    if (foe.isBoss && !foe.friendly && enc.duel.phase === 2) {
      ctx.fillStyle = `rgba(40,0,60,${0.18 + 0.06 * Math.sin(t * 3)})`; ctx.fillRect(-cam.vw, -300, 1600 + cam.vw * 2, 1400);
    }
    const fxPos = FX0 - (1 - enc.foeIn) * 500;
    ART.person(ctx, fxPos, GY, t, { look: foe.look, color: foe.color, dir: 1, hurt: enc.foeHurt, cast: enc.cast, defeat: enc.defeat, scale: foe.isBoss ? 1.15 : 1 });
    const glow = enc.duel.streak >= 2 ? Math.min(1, enc.duel.streak * 0.25) : 0;
    ART.knight(ctx, KX, GY, t, { dir: -1, gallop: 0, sword: enc.swing ? 'swing' : 'up', swing: enc.swing, hurt: enc.knightHurt, glow });
    if (enc.tricks && enc.tricks.includes('sand')) {
      ctx.fillStyle = 'rgba(220,170,90,.45)';
      for (let i = 0; i < 90; i++) { const x = ((i * 157 + t * 1100) % 1900) - 150; const y = 150 + ((i * 89) % 600); ctx.fillRect(x, y, 30, 2); }
    }
    if (foe.trick === 'stone' && enc.duel.phase > 0 && Math.random() < dt * 3) {
      fx.push({ type: 'shard', x: 200 + Math.random() * 1200, y: -40, vx: 0, vy: 200, life: 1.6, max: 1.6, r: 10 + Math.random() * 14, rot: 0, color: '#8a7a6a' });
    }
  }

  // ------------------------------------------------------------------
  // الحلقة الرئيسية
  // ------------------------------------------------------------------
  let last = performance.now();
  function loop(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const t = now / 1000;
    computeCam();
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.fillStyle = mode === 'map' ? '#d9b982' : '#1a0f06'; ctx.fillRect(0, 0, W, H);
    shake = Math.max(0, shake - dt * 40);
    const sx = shake ? (Math.random() - 0.5) * shake : 0; const sy = shake ? (Math.random() - 0.5) * shake : 0;
    ctx.setTransform(DPR * cam.s, 0, 0, DPR * cam.s, DPR * (cam.ox + sx), DPR * (cam.oy + sy));

    if (!paused && mode === 'travel' && run) updateTravel(dt);
    if (!paused && (mode === 'duel' || mode === 'duo')) tickTimer(dt);

    if (mode === 'map') drawMap(t);
    else if (mode === 'travel' && run) drawTravel(t);
    else if (mode === 'duel' || mode === 'duo') drawDuel(t, paused ? 0 : dt);
    else if (mode === 'final' && finale) drawFinale(t, dt);
    else if (mode === 'reward') { ART.world(ctx, stage, t, -stageIdx * 900 - 300, cam.vw); ART.knight(ctx, KX - 200, GY, t, { dir: -1, sword: 'up', glow: 0.8 }); }
    else { // العنوان
      scroll += dt * 120;
      ART.world(ctx, STAGES[0], t, -scroll, cam.vw);
      ART.knight(ctx, 1180, GY, t, { dir: -1, gallop: 0.8, sword: 'up', glow: 0.4 });
    }
    drawFx(paused ? 0 : dt, t);
    // ضوء خدعة الظلال يتحرك وحده إن لم يحرّكه اللاعب
    if (enc && enc.tricks && enc.tricks.includes('shadow')) {
      veilAuto -= dt;
      if (veilAuto <= 0) {
        const r = $('qpanel').getBoundingClientRect();
        $('qpanel').style.setProperty('--vx', `${r.width * (0.5 + 0.42 * Math.sin(t * 0.9))}px`);
        $('qpanel').style.setProperty('--vy', `${r.height * (0.45 + 0.3 * Math.sin(t * 1.7))}px`);
      }
    }
    requestAnimationFrame(loop);
  }

  function tickTimer(dt) {
    const st = mode === 'duo' ? duo : enc;
    if (!st || st.locked || $('qpanel').classList.contains('hidden') || !$('speech').classList.contains('hidden')) return;
    const timer = $('qTimer').parentElement;
    if (mode === 'duel' && enc.frozen > 0) { enc.frozen -= dt; timer.classList.add('frozen'); return; }
    timer.classList.remove('frozen');
    st.tLeft -= dt;
    const k = Math.max(0, st.tLeft / st.qTime);
    $('qTimer').style.width = `${k * 100}%`;
    timer.classList.toggle('low', k < 0.3);
    const sec = Math.ceil(st.tLeft);
    if (sec <= 5 && sec > 0 && st.lastTick !== sec) { st.lastTick = sec; AU.play('tick'); }
    if (st.tLeft <= 0) { if (mode === 'duo') duoResolve(false, -1); else timeout(); }
  }

  // توجيه الإجابات في وضع الفارسين
  const _resolve = resolve;
  resolve = function (ok, chosen) { if (mode === 'duo') duoResolve(ok, chosen); else _resolve(ok, chosen); };

  // ------------------------------------------------------------------
  // الإدخال
  // ------------------------------------------------------------------
  cv.addEventListener('pointerdown', (e) => {
    AU.init();
    if (mode === 'travel') { jump(); return; }
    if (mode === 'map' && screen === 'scrMap') {
      const r = cv.getBoundingClientRect();
      const i = mapPick(e.clientX - r.left, e.clientY - r.top);
      if (i >= 0) selectStation(i);
    }
  });
  cv.addEventListener('pointermove', (e) => {
    if (mode !== 'map') return;
    const r = cv.getBoundingClientRect();
    mapHover = mapPick(e.clientX - r.left, e.clientY - r.top);
    cv.style.cursor = mapHover >= 0 ? 'pointer' : 'default';
  });
  window.addEventListener('keydown', (e) => {
    AU.init();
    if (e.target && e.target.tagName === 'INPUT') return;
    if (e.key === 'Escape') { togglePause(); return; }
    if (mode === 'travel' && (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'Enter')) { e.preventDefault(); jump(); return; }
    if ((mode === 'duel' || mode === 'duo') && !$('speech').classList.contains('hidden') && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); $('speechNext').click(); return; }
    if ((mode === 'duel' || mode === 'duo') && /^[1-4]$/.test(e.key)) {
      const btns = [...$('answers').children].sort((a, b) => (Number(a.style.order) || 0) - (Number(b.style.order) || 0));
      const b = btns[Number(e.key) - 1]; if (b) b.click();
    }
  });

  function togglePause() {
    if (screen === 'scrPause') { hideAll(); paused = false; return; }
    if (screen === null && (mode === 'travel' || mode === 'duel' || mode === 'duo')) { paused = true; show('scrPause'); }
  }

  // ------------------------------------------------------------------
  // الأزرار
  // ------------------------------------------------------------------
  $('btnContinue').onclick = () => { AU.init(); AU.play('click'); goMap(); };
  $('btnNew').onclick = () => { AU.init(); AU.play('click'); goSetup(); };
  $('btnDuo').onclick = () => { AU.init(); AU.play('click'); goDuoSetup(); };
  $('btnCodex').onclick = () => { AU.init(); goCodex(); };
  $('btnMapCodex').onclick = () => { goCodex(); };
  $('btnHelp').onclick = () => { AU.init(); AU.play('click'); returnTo = 'scrTitle'; show('scrHelp'); };
  $('btnPauseHelp').onclick = () => { AU.play('click'); returnTo = 'scrPause'; show('scrHelp'); };
  $('btnShop').onclick = () => { AU.play('click'); goShop(); };
  $('btnCert').onclick = () => { AU.play('click'); returnTo = 'scrMap'; goCert(); };
  $('btnPause').onclick = () => { AU.init(); AU.play('click'); if (mode === 'map' || mode === 'title' || mode === 'reward' || mode === 'final') goTitle(); else togglePause(); };
  $('btnResume').onclick = () => { AU.play('click'); togglePause(); };
  $('btnToMap').onclick = () => { AU.play('click'); paused = false; enc = null; goMap(stageIdx); };
  for (const b of document.querySelectorAll('[data-go]')) {
    b.addEventListener('click', () => {
      AU.play('click');
      const go = b.dataset.go;
      if (go === 'title') { paused = false; enc = null; goTitle(); return; }
      if (go === 'map') { goMap(mapSel >= 0 ? mapSel : undefined); return; }
      if (go === 'back') {
        if (returnTo === 'scrMap') goMap(mapSel >= 0 ? mapSel : undefined);
        else if (returnTo === 'scrTitle') goTitle();
        else show(returnTo);
      }
    });
  }
  function renderAudioBtns() {
    $('btnMusic').classList.toggle('off', !settings.music);
    $('btnSound').textContent = settings.sound ? '🔊' : '🔇';
  }
  $('btnMusic').onclick = () => { AU.init(); settings.music = !settings.music; AU.setMusic(settings.music); renderAudioBtns(); persist(); toast(settings.music ? '🎵 الموسيقى تعمل' : 'وضع بلا موسيقى — المؤثرات فقط', 1800); };
  $('btnSound').onclick = () => { AU.init(); settings.sound = !settings.sound; AU.setSfx(settings.sound); renderAudioBtns(); persist(); };

  // صورة الغلاف في القائمة إن وُجدت
  const cover = $('coverArt');
  const showCover = () => { if (cover.naturalWidth) { cover.classList.remove('hidden'); $('titleLogo').classList.add('hidden'); } };
  if (cover.complete) showCover(); else cover.addEventListener('load', showCover);
  cover.addEventListener('error', () => cover.classList.add('hidden'));

  // ------------------------------------------------------------------
  // البدء
  // ------------------------------------------------------------------
  AU.setMusic(settings.music); AU.setSfx(settings.sound);
  const firstGesture = () => { AU.init(); AU.setMusic(settings.music); AU.setSfx(settings.sound); window.removeEventListener('pointerdown', firstGesture); };
  window.addEventListener('pointerdown', firstGesture);
  renderAudioBtns();
  resize();
  goTitle();
  requestAnimationFrame(loop);
  notify('ready');

  // للاختبار الآلي فقط
  window.__knight = {
    get save() { return save; }, set save(v) { save = v; persist(); },
    get enc() { return enc; }, get run() { return run; }, get mode() { return mode; },
    startStage, goMap, startEncounter, finishStage, startFinale, goCert, K, choose,
    bossOf: (i) => { startStage(i); hideAll(); startEncounter(); enc.idx = enc.queue.length - 1; startFoe(); },
    setStageRun: (o) => { stageRun = { ...stageRun, ...o }; },
  };
})();
