/*
 * ZERO SANCTUM — منطق اللعبة والواجهة
 * الحالة، المخزون، دفتر الأدلة، لوحات الألغاز، التلميحات، الصوت، الانتقالات، والمشهد الختامي.
 */
(function () {
  'use strict';
  const ZS = window.ZS, W = window.ZW;
  const $ = (id) => document.getElementById(id);
  const AR = (n) => String(n).replace(/\d/g, (d) => '٠١٢٣٤٥٦٧٨٩'[d]);
  const SAVE_KEY = 'zero-sanctum-save-v1';
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const ROOMS = {
    1: { name: 'غرفة الساعة المعطوبة', sub: 'الزمن هنا يرتد إلى الخلف' },
    2: { name: 'مختبر الضوء', sub: 'كل شعاع يحمل لونًا وطريقًا' },
    3: { name: 'أرشيف الذاكرة', sub: 'بعض السجلات تكذب' },
    4: { name: 'القلب الميكانيكي', sub: 'الآلة تتذكر كل حركة' },
    5: { name: 'الغرفة المعكوسة', sub: 'المرآة ترى ما لا تراه' },
    6: { name: 'البوابة صفر', sub: 'كل ما عرفته يجتمع هنا' },
  };

  // ===== رسم الرموز كـ SVG =====
  function glyphSvg(id, color = 'currentColor', sw = 1.7) {
    const g = ZS.GLYPHS[ZS.baseGlyph(id)];
    const tr = ZS.isMirrored(id) ? ' transform="translate(20 0) scale(-1 1)"' : '';
    return `<svg viewBox="0 0 20 20" aria-label="${g.name}${ZS.isMirrored(id) ? ' معكوسة' : ''}"><path d="${g.path}" fill="none" stroke="${color}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${tr}/></svg>`;
  }

  // ===== الشعار (يُستبدل تلقائيًا بالملف الأصلي إن وُجد بجانب اللعبة) =====
  const LOGO_MARK = `<svg viewBox="0 0 120 120" aria-label="أكاديمية ستيم لألعاب العلوم"><defs><linearGradient id="lgS" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#b8306f"/><stop offset=".55" stop-color="#7d3b8f"/><stop offset="1" stop-color="#4b2a86"/></linearGradient></defs>
    <g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke-width="19"><path d="M90 34 H46 C30 34 22 44 22 58 V74 C22 88 32 96 46 96 H78 C90 96 96 90 96 80 C96 70 90 64 80 64 H58" stroke="#d4b400" transform="translate(-3 4)"/><path d="M90 34 H46 C30 34 22 44 22 58 V74 C22 88 32 96 46 96 H78 C90 96 96 90 96 80 C96 70 90 64 80 64 H58" stroke="url(#lgS)"/></g>
    <circle cx="98" cy="14" r="9" fill="#d4b400"/><circle cx="112" cy="30" r="5" fill="#a83a6f"/></svg>`;
  // كل نسخة تحمل معرّفات تدرج خاصة بها، لأن المعرّف المكرر يشير إلى أول نسخة حتى لو كانت مخفية
  let logoN = 0;
  const LOGO_FULL = () => { const n = ++logoN; return `<svg class="logo-full" viewBox="0 0 400 120" aria-label="STEAM science games — أكاديمية ستيم لألعاب العلوم"><defs><linearGradient id="lgT_${n}" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b8306f"/><stop offset="1" stop-color="#4b2a86"/></linearGradient></defs>
    <g transform="translate(0 6) scale(.9)">${LOGO_MARK.replace(/<\/?svg[^>]*>/g, '').replace(/lgS/g, 'lgS2_' + n)}</g>
    <defs><linearGradient id="lgS2_${n}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#b8306f"/><stop offset=".55" stop-color="#7d3b8f"/><stop offset="1" stop-color="#4b2a86"/></linearGradient></defs>
    <text x="122" y="56" font-family="'Arial Black', 'Arial Rounded MT Bold', Arial, sans-serif" font-weight="900" font-size="50" fill="#d4b400" transform="translate(-2 3)" direction="ltr">STEAM</text>
    <text x="122" y="56" font-family="'Arial Black', 'Arial Rounded MT Bold', Arial, sans-serif" font-weight="900" font-size="50" fill="url(#lgT_${n})" direction="ltr">STEAM</text>
    <text x="124" y="84" font-family="Arial, sans-serif" font-size="24" fill="#9a9a9a" direction="ltr">science games</text>
    <text x="392" y="110" text-anchor="start" font-family="'IBM Plex Sans Arabic', Tahoma, sans-serif" font-size="17" font-weight="600" fill="#e8e0cc" direction="rtl">اكادمية ستيم لألعاب العلوم</text></svg>`; };
  function mountLogo(el, file, fallback) {
    const img = new Image();
    img.alt = 'أكاديمية ستيم لألعاب العلوم';
    img.className = el.id === 'studioLogo' ? 'logo-full' : '';
    img.onload = () => { el.innerHTML = ''; el.appendChild(img); };
    img.onerror = () => { el.innerHTML = typeof fallback === 'function' ? fallback() : fallback; };
    el.innerHTML = typeof fallback === 'function' ? fallback() : fallback;
    img.src = file;
  }

  // ===== العناصر =====
  const ITEMS = {
    wristband: { name: 'سوار التجربة', desc: 'سوار معدني مثبت على معصمك. شاشته الصغيرة تعرض: الخاضع ٠ · الدورة ٧.', model: 'band' },
    crystal: { name: 'بلورة بنفسجية', desc: 'بلورة متشققة تنبض بضوء بنفسجي خافت. على قاعدتها نقش صغير: «مختبر الضوء — المقبس ٢».', model: 'crystal' },
    axle: { name: 'محور فولاذي', desc: 'محور قصير مصقول، طرفاه مسننان. يبدو أنه صُنع ليثبّت شيئًا يدور.', model: 'axle' },
    gear: { name: 'ترس نحاسي', desc: 'ترس من أربعة عشر سنًا، وفتحته الوسطى فارغة. لو رُكّب هكذا لدار في مكانه دون أن ينقل شيئًا.', model: 'gear' },
    gear_axle: { name: 'ترس بمحوره', desc: 'الترس النحاسي مثبّت على المحور الفولاذي. صار قطعة واحدة جاهزة للتركيب.', model: 'gearAxle' },
    light_core: { name: 'نواة الضوء', desc: 'كرة ذهبية دافئة داخل قفص نحاسي. خرجت من خلف لوح المختبر بعد اكتمال الأشعة.', model: 'core', color: 0xffc85a },
    heart_core: { name: 'نواة القلب', desc: 'نواة حمراء تنبض كقلب. كانت محبوسة داخل حلقات الآلة.', model: 'core', color: 0xff5a2a },
    mirror_shard: { name: 'شظية المرآة', desc: 'شظية باردة لا تعكس وجهك، بل الغرفة التي خلفك.', model: 'shard' },
  };
  ZS.PHOTO_IDS.forEach((p) => {
    ITEMS['photo' + p] = { name: 'صورة مؤرخة ' + ZS.PHOTOS[p].shownTime, desc: 'صورة من الأعلى لساحة فيها مسلّة. البوصلة في الزاوية تشير إلى الشمال، وعلى الحافة وقت مكتوب بالأحمر.', model: 'photo', pid: p };
  });
  // ما يظهر على ظهر كل قطعة عند قلبها في الفاحص
  const BACKS = {
    wristband: { text: 'لا تثق بالوقت المكتوب.\nثق بالظلال.', sign: true },
    light_core: { glyph: ZS.CORES.light_core.back },
    heart_core: { glyph: ZS.CORES.heart_core.back },
    mirror_shard: { glyph: ZS.CORES.mirror_shard.back },
  };
  ZS.PHOTO_IDS.forEach((p) => { BACKS['photo' + p] = { glyph: ZS.PHOTOS[p].back, photo: p }; });

  // ===== الحالة =====
  function freshState() {
    return {
      v: 1, room: 1, inv: ['wristband'], newItems: [], taken: {}, notes: [], backs: {},
      solved: {}, clockSlots: [null, null, null, null, null], clockEngaged: 0,
      mirrors: ZS.initialMirrors(), crystalIn: false,
      cards: [], timeline: [null, null, null, null, null],
      heart: ZS.heartInitial(),
      dials: [3, 7, 1, 9, 5], mirrorView: false, sawGhost: false,
      gateSockets: [null, null, null], sigils: [], gateFails: 0,
      hints: {}, hintsUsed: 0, startedAt: Date.now(), playMs: 0,
    };
  }
  let S = freshState();
  const save = () => { try { S.playMs += Date.now() - (S._t || Date.now()); S._t = Date.now(); localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* التخزين غير متاح */ } };
  function load() { try { const raw = localStorage.getItem(SAVE_KEY); if (!raw) return null; const s = JSON.parse(raw); return s && s.v === 1 ? s : null; } catch (e) { return null; } }
  const has = (id) => S.inv.includes(id);

  // ===== الصوت =====
  const A = { ctx: null, master: null, drone: null, muted: false, tick: null };
  function audioInit() {
    if (A.ctx) { if (A.ctx.state === 'suspended') A.ctx.resume(); return; }
    try { A.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { return; }
    A.master = A.ctx.createGain(); A.master.gain.value = A.muted ? 0 : 0.8;
    const comp = A.ctx.createDynamicsCompressor();
    A.master.connect(comp).connect(A.ctx.destination);
    // صدى بسيط يعطي إحساس القاعة
    A.verb = A.ctx.createConvolver();
    const len = A.ctx.sampleRate * 2.4, buf = A.ctx.createBuffer(2, len, A.ctx.sampleRate);
    for (let c = 0; c < 2; c++) { const d = buf.getChannelData(c); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); }
    A.verb.buffer = buf;
    A.verbGain = A.ctx.createGain(); A.verbGain.gain.value = 0.35;
    A.verb.connect(A.verbGain).connect(A.master);
  }
  const ROOT = { 1: 55, 2: 61.7, 3: 49, 4: 41.2, 5: 65.4, 6: 73.4 };
  function droneFor(room, bright) {
    if (!A.ctx) return;
    const now = A.ctx.currentTime;
    if (A.drone) { const old = A.drone; old.g.gain.cancelScheduledValues(now); old.g.gain.setTargetAtTime(0, now, 0.8); setTimeout(() => old.nodes.forEach((n) => { try { n.stop(); } catch (e) {} }), 4000); }
    const g = A.ctx.createGain(); g.gain.value = 0;
    const filt = A.ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 380 + (bright ? 500 : 0); filt.Q.value = 3;
    const lfo = A.ctx.createOscillator(); lfo.frequency.value = 0.07; const lfoG = A.ctx.createGain(); lfoG.gain.value = 160; lfo.connect(lfoG).connect(filt.frequency);
    const f = ROOT[room];
    const ratios = bright ? [1, 1.5, 2, 3] : [1, 1.498, 2.01, 1.189];
    const nodes = [lfo];
    ratios.forEach((r, i) => {
      const o = A.ctx.createOscillator(); o.type = i === 0 ? 'sine' : 'sawtooth'; o.frequency.value = f * r; o.detune.value = (i - 1.5) * 7;
      const og = A.ctx.createGain(); og.gain.value = i === 0 ? 0.32 : 0.05;
      o.connect(og).connect(filt); o.start(); nodes.push(o);
    });
    filt.connect(g); g.connect(A.master); g.connect(A.verb);
    lfo.start();
    g.gain.setTargetAtTime(0.22, now, 1.5);
    A.drone = { g, nodes };
    clearInterval(A.tick);
    if (room === 1) A.tick = setInterval(() => sfx(S.solved.clock ? 'tick' : 'tock'), 1000);
  }
  function env(type, freq, t0, dur, vol, dest) {
    const o = A.ctx.createOscillator(), g = A.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(vol, t0 + 0.01); g.gain.exponentialRampToValueAtTime(0.0008, t0 + dur);
    o.connect(g); g.connect(dest || A.master); g.connect(A.verb);
    o.start(t0); o.stop(t0 + dur + 0.05);
    return o;
  }
  function noise(t0, dur, vol, fq, type = 'bandpass') {
    const len = Math.floor(A.ctx.sampleRate * dur), b = A.ctx.createBuffer(1, len, A.ctx.sampleRate), d = b.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2);
    const s = A.ctx.createBufferSource(); s.buffer = b;
    const f = A.ctx.createBiquadFilter(); f.type = type; f.frequency.value = fq; f.Q.value = 1.2;
    const g = A.ctx.createGain(); g.gain.value = vol;
    s.connect(f).connect(g); g.connect(A.master); g.connect(A.verb); s.start(t0);
  }
  function sfx(name) {
    if (!A.ctx || A.muted) return;
    const t = A.ctx.currentTime;
    switch (name) {
      case 'click': env('square', 1800, t, 0.03, 0.04); break;
      case 'tick': noise(t, 0.04, 0.25, 3200); break;
      case 'tock': noise(t, 0.05, 0.25, 1400); break;
      case 'pick': env('sine', 880, t, 0.25, 0.12); env('sine', 1320, t + 0.08, 0.35, 0.09); break;
      case 'deny': env('sawtooth', 110, t, 0.25, 0.08); env('sawtooth', 104, t + 0.02, 0.25, 0.06); break;
      case 'mech': noise(t, 0.35, 0.5, 600); env('square', 70, t, 0.2, 0.06); break;
      case 'clunk': noise(t, 0.2, 0.6, 300, 'lowpass'); env('sine', 60, t, 0.3, 0.2); break;
      case 'steam': noise(t, 1.4, 0.35, 5000, 'highpass'); break;
      case 'door': noise(t, 1.2, 0.35, 400, 'lowpass'); env('sine', 48, t, 1.2, 0.18); break;
      case 'note': env('triangle', 660, t, 0.4, 0.07); break;
      case 'solve': [523.25, 659.25, 783.99, 1046.5, 1318.5].forEach((f, i) => env('sine', f, t + i * 0.11, 1.6, 0.11)); env('sine', 130.8, t, 2.4, 0.18); break;
      case 'beam': env('sine', 1567, t, 0.6, 0.05); env('sine', 2093, t + 0.05, 0.6, 0.04); break;
      case 'glitch': for (let i = 0; i < 6; i++) env('square', 200 + Math.random() * 1600, t + i * 0.03, 0.03, 0.04); break;
      case 'final': [130.8, 196, 261.6, 392, 523.25, 783.99].forEach((f, i) => env('sine', f, t + i * 0.35, 5, 0.09)); break;
      default: break;
    }
  }
  function setMuted(m) {
    A.muted = m;
    if (A.master) A.master.gain.setTargetAtTime(m ? 0 : 0.8, A.ctx.currentTime, 0.1);
    $('soundWaves').style.opacity = m ? 0.15 : 1;
    try { localStorage.setItem('zero-sanctum-muted', m ? '1' : '0'); } catch (e) {}
  }

  // ===== أيقونات المخزون =====
  const iconCache = {};
  function itemIcon(id) {
    if (iconCache[id]) return iconCache[id];
    const c = document.createElement('canvas'); c.width = c.height = 96;
    const g = c.getContext('2d');
    const it = ITEMS[id];
    g.translate(48, 48);
    const glowCircle = (col, r) => { const gr = g.createRadialGradient(0, 0, 0, 0, 0, r); gr.addColorStop(0, col); gr.addColorStop(1, 'rgba(0,0,0,0)'); g.fillStyle = gr; g.beginPath(); g.arc(0, 0, r, 0, 7); g.fill(); };
    switch (it.model) {
      case 'photo': {
        const pc = document.createElement('canvas'); pc.width = 320; pc.height = 370;
        W.photoFront(it.pid)(pc.getContext('2d'), 320, 370);
        g.rotate(-0.08); g.drawImage(pc, -30, -35, 60, 70); break;
      }
      case 'band':
        g.strokeStyle = '#8f9a96'; g.lineWidth = 9; g.beginPath(); g.ellipse(0, 0, 32, 22, 0, 0, 7); g.stroke();
        g.fillStyle = '#150a1f'; g.fillRect(-14, -30, 28, 18); g.fillStyle = '#c99bff'; g.font = '700 12px Arial'; g.textAlign = 'center'; g.fillText('0', 0, -16); break;
      case 'crystal':
        glowCircle('rgba(180,107,255,.5)', 40);
        g.fillStyle = '#b46bff'; g.beginPath(); g.moveTo(0, -36); g.lineTo(16, 0); g.lineTo(0, 36); g.lineTo(-16, 0); g.closePath(); g.fill();
        g.fillStyle = 'rgba(255,255,255,.4)'; g.beginPath(); g.moveTo(0, -36); g.lineTo(16, 0); g.lineTo(0, 4); g.closePath(); g.fill(); break;
      case 'axle':
        g.rotate(-0.7); g.fillStyle = '#cfd6d3'; g.fillRect(-36, -5, 72, 10); g.fillStyle = '#8f9693'; for (let i = -36; i < -22; i += 4) g.fillRect(i, -6, 2, 12); for (let i = 24; i < 36; i += 4) g.fillRect(i, -6, 2, 12); break;
      case 'gear': case 'gearAxle': {
        g.fillStyle = '#c77a3a';
        g.beginPath();
        for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2, r = i % 2 ? 26 : 34; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
        g.closePath(); g.fill();
        g.fillStyle = '#0d0b11'; g.beginPath(); g.arc(0, 0, 9, 0, 7); g.fill();
        if (it.model === 'gearAxle') { g.rotate(-0.7); g.fillStyle = '#cfd6d3'; g.fillRect(-42, -5, 84, 10); }
        break;
      }
      case 'core': {
        const col = '#' + it.color.toString(16).padStart(6, '0');
        glowCircle(col, 40); g.fillStyle = col; g.beginPath(); g.arc(0, 0, 16, 0, 7); g.fill();
        g.strokeStyle = '#c9a253'; g.lineWidth = 2.5; g.beginPath(); g.arc(0, 0, 26, 0, 7); g.stroke(); g.beginPath(); g.ellipse(0, 0, 26, 10, 0.6, 0, 7); g.stroke(); break;
      }
      case 'shard':
        glowCircle('rgba(191,230,255,.45)', 40);
        g.fillStyle = '#dff2ff'; g.beginPath(); g.moveTo(-6, -36); g.lineTo(22, 6); g.lineTo(2, 34); g.lineTo(-20, 4); g.closePath(); g.fill();
        g.fillStyle = 'rgba(80,120,150,.6)'; g.beginPath(); g.moveTo(-6, -36); g.lineTo(2, 34); g.lineTo(-20, 4); g.closePath(); g.fill(); break;
      default: break;
    }
    iconCache[id] = c.toDataURL();
    return iconCache[id];
  }
  const photoImgCache = {};
  function photoImg(pid, back) {
    const k = pid + (back ? 'b' : 'f');
    if (!photoImgCache[k]) {
      const c = document.createElement('canvas'); c.width = 320; c.height = 370;
      (back ? W.photoBack(pid) : W.photoFront(pid))(c.getContext('2d'), 320, 370);
      photoImgCache[k] = c.toDataURL('image/jpeg', 0.85);
    }
    return photoImgCache[k];
  }

  // ===== الواجهة العامة =====
  let toastT = 0;
  function toast(msg, kind = '') {
    const t = $('toast');
    t.textContent = msg; t.className = 'toast show ' + kind;
    clearTimeout(toastT);
    toastT = setTimeout(() => { t.className = 'toast ' + kind; }, Math.max(2600, msg.length * 70));
  }
  let sel = null;
  function renderInv() {
    const el = $('inv');
    const items = S.inv.slice();
    const empties = Math.max(0, 6 - items.length);
    el.innerHTML = items.map((id) => `<button class="slot ${sel === id ? 'sel' : ''} ${S.newItems.includes(id) ? 'new' : ''}" data-item="${id}" title="${esc(ITEMS[id].name)}" aria-label="${esc(ITEMS[id].name)}"><img src="${itemIcon(id)}" alt=""></button>`).join('')
      + '<span class="slot empty"></span>'.repeat(empties);
    const h = $('invhint');
    if (sel) {
      h.hidden = false;
      h.innerHTML = `<span><b>${esc(ITEMS[sel].name)}</b> · انقر على شيء في الغرفة لاستخدامها، أو على قطعة أخرى لدمجهما</span><button data-ia="inspect">افحص</button><button data-ia="cancel">إلغاء</button>`;
    } else h.hidden = true;
  }
  function selectItem(id) {
    if (sel && sel !== id) {
      const combo = combine(sel, id);
      if (combo) return;
      sel = id;
    } else sel = sel === id ? null : id;
    S.newItems = S.newItems.filter((x) => x !== id);
    sfx('click');
    renderInv();
  }
  function combine(a, b) {
    const pair = [a, b].sort().join('+');
    if (pair === 'axle+gear') {
      S.inv = S.inv.filter((x) => x !== 'axle' && x !== 'gear');
      sel = null;
      give('gear_axle', { msg: 'ثبّتّ الترس النحاسي على المحور الفولاذي. صارا قطعة واحدة.' });
      sfx('clunk');
      return true;
    }
    if (a.startsWith('photo') && b.startsWith('photo')) { toast('صورتان من الساحة نفسها. مكانهما الصحيح على سكة الساعة.'); sel = null; renderInv(); return true; }
    toast('لا يبدو أن بين القطعتين علاقة.', 'bad'); sfx('deny');
    sel = null; renderInv();
    return true;
  }
  function give(id, o = {}) {
    if (has(id)) return;
    S.inv.push(id);
    S.newItems.push(id);
    sfx('pick');
    toast(o.msg || `أُضيف إلى المخزون: ${ITEMS[id].name}`, 'good');
    renderInv(); save(); updateHud();
  }

  function addNote(id, title, text, o = {}) {
    if (S.notes.some((n) => n.id === id)) return false;
    S.notes.push({ id, room: o.room || S.room, title, text, glyphs: o.glyphs || null });
    $('noteCount').textContent = AR(S.notes.length);
    const b = $('btnNotes'); b.classList.remove('pulse'); void b.offsetWidth; b.classList.add('pulse');
    sfx('note');
    save();
    return true;
  }

  // ===== اللوحات =====
  let panel = null;
  function openPanel(def) {
    panel = def;
    $('pEyebrow').textContent = def.eyebrow || 'SECTOR 0' + S.room;
    $('pTitle').textContent = def.title;
    renderPanel();
    $('panel').classList.add('open');
    $('panel').setAttribute('aria-hidden', 'false');
    W.blocked = false;
    document.body.classList.add('panel-open');
    syncOffset();
    if (def.hot) W.focus(def.hot);
    setTimeout(() => $('pClose').focus({ preventScroll: true }), 50);
  }
  // نزيح مركز المشهد بعيدًا عن اللوحة كي يبقى العنصر المفحوص ظاهرًا
  function syncOffset() {
    const p = $('panel');
    if (innerWidth > 640) W.setOffset(-p.offsetWidth / 2, 0);
    else W.setOffset(0, p.offsetHeight / 2);
  }
  function renderPanel() {
    if (!panel) return;
    const st = $('pBody').scrollTop;
    $('pBody').innerHTML = panel.render();
    $('pBody').scrollTop = st;
    if (panel.after) panel.after();
  }
  function closePanel() {
    if (!panel) return;
    if (panel.onClose) panel.onClose();
    panel = null;
    $('panel').classList.remove('open');
    $('panel').setAttribute('aria-hidden', 'true');
    document.body.classList.remove('panel-open');
    W.setOffset(0, 0);
    W.unfocus();
    stopHeartAnim();
  }
  function notePanel(hot, title, paragraphs, extra = '') {
    openPanel({ hot, title, render: () => paragraphs.map((p) => `<p class="${p.startsWith('«') ? 'quote' : ''}">${p}</p>`).join('') + extra });
  }

  // ===== الهدف الحالي والتلميحات =====
  function stage() {
    if (!S.solved.clock) return ZS.PHOTO_IDS.every((p) => has('photo' + p)) ? 'clock_order' : 'clock_collect';
    if (!S.solved.light) return S.crystalIn ? 'light_mirrors' : 'light_crystal';
    if (!S.solved.archive) return S.cards.length < 6 ? 'archive_find' : !S.timelineDone ? 'archive_order' : 'archive_code';
    if (!S.solved.heart) return S.heart.gear ? 'heart_machine' : 'heart_gear';
    if (!S.solved.mirror) return 'mirror_lock';
    if (!S.solved.gate) return S.gateSockets.every(Boolean) ? (S.sigilsDone ? 'gate_identity' : 'gate_sigils') : 'gate_sockets';
    return 'done';
  }
  const GOALS = {
    clock_collect: 'ابحث في الغرفة عن الصور الناقصة', clock_order: 'أعد تشغيل الساعة بترتيب الصور على السكة',
    light_crystal: 'المقبس على طاولة البصريات فارغ', light_mirrors: 'وجّه الأشعة إلى مستقبلاتها الثلاثة',
    archive_find: 'اجمع سجلات الحوادث المتفرقة', archive_order: 'رتّب الحوادث على الخط الزمني', archive_code: 'افتح خزنة الأرشيف',
    heart_gear: 'أكمل سلسلة التروس', heart_machine: 'أيقظ القلب الميكانيكي',
    mirror_lock: 'افتح قفل الرموز', gate_sockets: 'ركّب النوى الثلاث في البوابة', gate_sigils: 'أيقظ القطاعات بالترتيب الصحيح',
    gate_identity: 'أجب البوابة', done: 'اكتملت الدورة',
  };
  const HINTS = {
    clock_collect: ['الصور في هذه الغرفة ليست زينة.', 'هناك خمس صور: أربع على الجدارين الجانبيين، وواحدة سقطت على الأرض قرب الباب.', 'اجمع الصور الخمس (اثنتان على الجدار الأيسر، اثنتان على الأيمن، وواحدة على الأرض)، ثم افتح سكة الصور تحت الساعة.'],
    clock_order: ['الساعة تكذب، فلا تثق بالأوقات المكتوبة على الصور. افحص ظهر سوارك.', 'رتّب الصور كما يتحرك ظل المسلّة في يوم واحد. الشمس تشرق من الشرق، فيمتد الظل أولًا نحو الغرب، ثم يقصر عند الظهيرة، ثم يطول نحو الشرق.', ZS.SOLUTIONS.clock],
    light_crystal: ['المقبس الفارغ على الطاولة يحجب كل شيء.', 'السبورة تقول إن البلورة نُقلت إلى غرفة الساعة بعد الحادث.', 'بعد إصلاح الساعة انفتح الصندوق الزجاجي في غرفة الساعة. خذ البلورة البنفسجية منه، ثم ركّبها في المقبس على طاولة البصريات.'],
    light_mirrors: ['كل مستقبل يقبل لونًا واحدًا فقط.', 'الأبيض يجب ألا يعبر أي زجاج. الذهبي يخرج من الزجاج الذهبي، والبنفسجي من البلورة. تتبّع كل شعاع من المقسِّم الذي يخرج منه.', ZS.SOLUTIONS.light],
    archive_find: ['الأرشيف مليء بالأوراق، لكن ستة سجلات فقط تخص الحوادث.', 'ابحث عن صورة، وملصق، وخزانة ملفات، وجهاز تسجيل، ومذكرة، وملف ممزق.', 'المصادر الستة: الصورة المؤطرة على الجدار الأيسر، والملصق على الأيمن، وخزانة الملفات في الزاوية، وجهاز التسجيل والمذكرة على المكتب، والملف الممزق على الأرض.'],
    archive_order: ['بطاقتان تصفان الحدث نفسه، وإحداهما كاذبة.', 'اقرأ عبارات «قبل» و«بعد» في كل بطاقة وابنِ منها سلسلة واحدة. البطاقة التي تناقض بطاقتين أخريين هي المزوّرة.', ZS.SOLUTIONS.archive],
    archive_code: ['المذكرة الداخلية تقول كيف تُفتح الخزنة.', 'لكل بطاقة صادقة ختم يحمل رقمًا. اقرأ الأختام بترتيب وقوع الحوادث.', 'الرمز ' + AR(ZS.archiveCode()) + '.'],
    heart_gear: ['المقبس في سلسلة التروس فارغ.', 'الترس النحاسي من الخزنة لا يثبت وحده. تذكّر ما رأيته على مكتب مختبر الضوء.', 'خذ المحور الفولاذي من مكتب مختبر الضوء، ثم اختر الترس والمحور في المخزون لتدمجهما، وركّب الناتج من وحدة التحكم.'],
    heart_machine: ['اقرأ اللوحة النحاسية على الجدار الأيسر.', 'عُدّ التروس من المحرك إلى القلب. المحرك يدور مع عقارب الساعة، وكل ترس يعكس اتجاه جاره. ولا تُشبك القابض والمكابس مقفلة.', ZS.SOLUTIONS.heart],
    mirror_lock: ['الكتابة على الجدار الأيمن لا تُقرأ إلا في المرآة.', '«ما حفظته الساعة» هو الرموز على ظهور صور غرفة الساعة بترتيبها الصحيح. اجعل المرآة ترى هذا التسلسل كما هو، واستعمل زر «في المرآة» لترى ما تراه.', ZS.SOLUTIONS.mirror],
    gate_sockets: ['كل مقبس محفور عليه رمز.', 'افحص النوى الثلاث في المخزون واقلبها. على ظهر كل واحدة رمز.', 'مقبس الهلال لشظية المرآة، ومقبس الشوكة لنواة القلب، ومقبس الراية لنواة الضوء.'],
    gate_sigils: ['«أيقظ القطاعات بالترتيب الذي سقطت به.»', 'الخط الزمني في الأرشيف يربط كل حادث بقطاع من المنشأة.', 'المرآة (٥)، ثم الضوء (٢)، ثم الساعة (١)، ثم القلب (٤)، ثم الأرشيف (٣).'],
    gate_identity: ['من يوقّع الملاحظات؟', 'ظهر سوارك وظهور الصور كلها موقّعة بـ «٠». ورقم من على سوارك؟', 'أنت. الخاضع صفر ترك الأدلة لنفسه في الدورات السابقة.'],
    done: ['اكتملت الدورة.', 'اكتملت الدورة.', 'اكتملت الدورة.'],
  };
  const HINT_LV = ['توجيه عام', 'تلميح أوضح', 'الحل'];
  function hintPanel() {
    openPanel({
      eyebrow: 'HINTS', title: 'تلميحات',
      render() {
        const k = stage(), lv = S.hints[k] || 0, h = HINTS[k];
        let html = `<p>الهدف الحالي: <b>${GOALS[k]}</b>. كل تلميح يكشف أكثر من سابقه، والثالث يشرح الحل كاملًا.</p><div class="hints">`;
        for (let i = 0; i < lv; i++) html += `<div class="hint ${i === 2 ? 'sol' : ''}"><span class="lv">${HINT_LV[i]}</span><p>${h[i]}</p></div>`;
        html += '</div>';
        if (lv < 3) html += `<div class="row"><button class="btn ${lv === 2 ? 'ghost' : ''}" data-act="more">${lv === 0 ? 'أعطني توجيهًا' : lv === 1 ? 'تلميح أوضح' : 'اكشف الحل'}</button></div>`;
        return html;
      },
      on(act) { if (act === 'more') { const k = stage(); S.hints[k] = Math.min(3, (S.hints[k] || 0) + 1); S.hintsUsed++; save(); renderPanel(); } },
    });
  }
  function notesPanel() {
    openPanel({
      eyebrow: 'CASE FILE', title: 'دفتر الأدلة',
      render() {
        if (!S.notes.length) return '<p>لم تدوّن شيئًا بعد. كل ما تكتشفه يُسجَّل هنا تلقائيًا.</p>';
        return '<div class="notes">' + S.notes.slice().reverse().map((n) => `<div class="note"><span class="r">SECTOR 0${n.room}</span><b>${esc(n.title)}</b><p>${n.text}</p>${n.glyphs ? `<div class="glyphrow">${n.glyphs.map((g) => `<span>${glyphSvg(g, '#e8d4a0')}</span>`).join('')}</div>` : ''}</div>`).join('') + '</div>';
      },
    });
  }
  function menuPanel() {
    openPanel({
      eyebrow: 'SYSTEM', title: 'القائمة',
      render: () => `<p>تُحفظ تقدّمك تلقائيًا في هذا المتصفح بعد كل خطوة.</p>
        <div class="row"><button class="btn ghost" data-act="title">العودة إلى الشاشة الرئيسية</button><button class="btn ghost" data-act="reset">ابدأ من جديد</button></div>
        <div id="confirmReset"></div>
        <p class="fine" style="color:var(--muted)">التحكم: اسحب للنظر حولك · انقر على العناصر · <kbd>N</kbd> الدفتر · <kbd>H</kbd> التلميح · <kbd>Esc</kbd> للإغلاق</p>`,
      on(act) {
        if (act === 'title') { closePanel(); showTitle(); }
        if (act === 'reset') $('confirmReset').innerHTML = '<div class="status bad">سيُمحى كل تقدّمك. هل أنت متأكد؟</div><div class="row" style="margin-top:8px"><button class="btn" data-act="resetYes">نعم، ابدأ من جديد</button></div>';
        if (act === 'resetYes') { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} location.reload(); }
      },
    });
  }

  // ===== الغرفة 1 =====
  let pickedPhoto = null, clockMsg = '', showBacks = false;
  function clockPanel() {
    openPanel({
      hot: 'rail', title: 'سكة الصور',
      render() {
        const solved = S.solved.clock;
        const owned = ZS.PHOTO_IDS.filter((p) => has('photo' + p));
        let h = solved
          ? '<p>الصور الخمس ثابتة في إطاراتها، والساعة فوقها تدور إلى الأمام. يمكنك قلب الصور لترى ظهورها.</p>'
          : '<p>خمسة إطارات نحاسية تحت الساعة، مرقّمة من اليسار إلى اليمين. على حافة السكة نقش باهت: «أعد اليوم إلى ترتيبه، فيعود الزمن».</p>';
        h += `<div class="rail">${S.clockSlots.map((pid, i) => `<button class="cell ${solved ? 'lit' : ''}" data-act="slot" data-i="${i}" aria-label="الإطار ${i + 1}">${pid ? `<img src="${photoImg(pid, solved && showBacks)}" alt="">` : `<span class="n">0${i + 1}</span>`}</button>`).join('')}</div>`;
        if (solved) return h + `<div class="row"><button class="btn ghost" data-act="flip">${showBacks ? 'أظهر الوجوه' : 'اقلب الصور'}</button></div>`;
        h += `<div class="label">الصور التي جمعتها (${AR(owned.length)} من ٥)</div>`;
        h += owned.length ? `<div class="photos">${owned.map((p) => `<button class="${pickedPhoto === p ? 'sel' : ''} ${S.clockSlots.includes(p) ? 'used' : ''}" data-act="pick" data-p="${p}" aria-label="${esc(ITEMS['photo' + p].name)}"><img src="${photoImg(p)}" alt=""></button>`).join('')}</div>` : '<p>لم تجد أي صورة بعد.</p>';
        h += `<div class="label">التروس المتعشّقة</div><div class="gauge">${[0, 1, 2, 3, 4].map((i) => `<i class="${i < S.clockEngaged ? 'on' : ''}"></i>`).join('')}</div>`;
        h += `<div class="row"><button class="btn" data-act="run" ${S.clockSlots.every(Boolean) ? '' : 'disabled'}>شغّل الآلية</button><button class="btn ghost" data-act="clear">أفرغ السكة</button></div>`;
        h += `<div class="status ${clockMsg.startsWith('!') ? 'bad' : ''}">${clockMsg.replace(/^!/, '') || 'اختر صورة، ثم انقر على إطار لتضعها فيه. انقر على إطار ممتلئ لتفرغه.'}</div>`;
        return h;
      },
      on(act, el) {
        if (S.solved.clock) { if (act === 'flip') { showBacks = !showBacks; showBacks && ZS.PHOTO_IDS.forEach((p) => seeBack('photo' + p)); renderPanel(); } return; }
        if (act === 'pick') { pickedPhoto = pickedPhoto === el.dataset.p ? null : el.dataset.p; sfx('click'); }
        if (act === 'slot') {
          const i = +el.dataset.i;
          if (pickedPhoto) {
            const prev = S.clockSlots.indexOf(pickedPhoto);
            if (prev >= 0) S.clockSlots[prev] = null;
            S.clockSlots[i] = pickedPhoto; pickedPhoto = null; sfx('clunk');
          } else if (S.clockSlots[i]) { S.clockSlots[i] = null; sfx('click'); }
          clockMsg = ''; syncRail();
        }
        if (act === 'clear') { S.clockSlots = [null, null, null, null, null]; clockMsg = ''; syncRail(); }
        if (act === 'run') {
          const r = ZS.checkClockOrder(S.clockSlots);
          S.clockEngaged = r.engaged; W.dyn.clock.engaged = r.engaged;
          sfx('mech');
          if (r.solved) { solveClock(); return; }
          clockMsg = r.engaged === 0
            ? '!الآلية تئن ولا يتعشّق أي ترس. الإطار الأول يرفض صورته.'
            : `!تعشّقت التروس ${['', 'الأولى', 'الأولى والثانية', 'الثلاثة الأولى', 'الأربعة الأولى'][r.engaged]}، ثم توقفت الآلية عند الإطار ${AR(r.engaged + 1)}.`;
        }
        save(); renderPanel();
      },
    });
  }
  function syncRail() {
    S.clockSlots.forEach((pid, i) => {
      const tex = W.dyn.rail.slotTex[i];
      const c = tex.userData.canvas, g = c.getContext('2d');
      g.fillStyle = '#0a0b0a'; g.fillRect(0, 0, c.width, c.height);
      if (pid) { const pc = document.createElement('canvas'); pc.width = 320; pc.height = 370; W.photoFront(pid)(pc.getContext('2d'), 320, 370); g.drawImage(pc, 0, 0, 320, 370, 40, 0, c.height * 320 / 370, c.height); }
      else { g.fillStyle = 'rgba(201,162,83,.35)'; g.font = '600 60px "IBM Plex Sans Arabic", sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(AR(i + 1), c.width / 2, c.height / 2); }
      tex.needsUpdate = true;
    });
  }
  function solveClock() {
    S.solved.clock = true;
    clockMsg = '';
    W.dyn.clock.forward = true; W.dyn.clock.engaged = 5;
    redrawClockFace(true);
    W.dyn.vitrine.target = 1;
    W.setDoor(1, 2, 'open');
    W.burst(new THREE.Vector3(0, 3.2, -6.4), 0xffd27a);
    sfx('solve'); droneFor(1, true);
    addNote('clockSolved', 'الساعة تدور إلى الأمام', 'رتّبتُ الصور حسب الظل لا حسب الوقت المكتوب. انقلبت أرقام الساعة إلى ترتيبها الصحيح، وانفتح الصندوق الزجاجي وباب القطاع الثاني.', { room: 1 });
    checkSequenceNote();
    toast('الساعة تدور إلى الأمام. انفتح الصندوق الزجاجي وباب القطاع ٠٢.', 'good');
    save(); updateHud(); renderPanel();
  }
  function redrawClockFace(forward) {
    const ft = W.dyn.clock.faceTex, c = ft.userData.canvas, g = c.getContext('2d');
    const w = c.width, h = c.height, cx = w / 2, cy = h / 2;
    const grd = g.createRadialGradient(cx, cy, 20, cx, cy, w / 2);
    grd.addColorStop(0, '#1d2421'); grd.addColorStop(1, '#070908');
    g.fillStyle = grd; g.fillRect(0, 0, w, h);
    g.strokeStyle = '#c9a253'; g.lineWidth = 4; g.beginPath(); g.arc(cx, cy, w * 0.47, 0, 7); g.stroke();
    g.lineWidth = 1.5; g.beginPath(); g.arc(cx, cy, w * 0.37, 0, 7); g.stroke();
    for (let i = 0; i < 60; i++) {
      const a = (i / 60) * Math.PI * 2, r1 = w * 0.44, r2 = i % 5 === 0 ? w * 0.4 : w * 0.425;
      g.strokeStyle = i % 5 === 0 ? '#e8d4a0' : 'rgba(232,212,160,.5)'; g.lineWidth = i % 5 === 0 ? 4 : 1.5;
      g.beginPath(); g.moveTo(cx + Math.sin(a) * r1, cy - Math.cos(a) * r1); g.lineTo(cx + Math.sin(a) * r2, cy - Math.cos(a) * r2); g.stroke();
    }
    g.direction = 'rtl'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '700 44px "Reem Kufi", "IBM Plex Sans Arabic", sans-serif'; g.fillStyle = '#e8d4a0';
    for (let i = 0; i < 12; i++) {
      const a = ((forward ? i : (12 - i) % 12) / 12) * Math.PI * 2;
      g.fillText(AR(i === 0 ? 12 : i), cx + Math.sin(a) * w * 0.32, cy - Math.cos(a) * w * 0.32);
    }
    g.font = '600 22px "IBM Plex Sans Arabic", sans-serif'; g.fillStyle = forward ? '#b46bff' : '#c9a253';
    g.fillText(forward ? 'الزمن يسير' : 'الزمن يرتد', cx, cy + w * 0.16);
    ft.needsUpdate = true;
  }
  function checkSequenceNote() {
    const seq = ZS.clockSequence();
    if (!S.solved.clock) return;
    if (!ZS.PHOTO_IDS.every((p) => S.backs['photo' + p])) return;
    addNote('clockSeq', 'ما حفظته الساعة', 'ظهور الصور الخمس، بترتيبها الصحيح على السكة من اليسار إلى اليمين، تحمل هذه الرموز:', { room: 1, glyphs: seq });
  }
  function seeBack(item) {
    if (S.backs[item]) return;
    S.backs[item] = true;
    const b = BACKS[item];
    if (!b) return;
    if (item === 'wristband') addNote('bandBack', 'ظهر السوار', 'محفور بخط يد مألوف: «لا تثق بالوقت المكتوب. ثق بالظلال.» والتوقيع: ٠.', { room: S.room });
    else if (b.photo) addNote('back' + item, `ظهر ${ITEMS[item].name}`, 'رمز مرسوم بالحبر، وتحته التوقيع نفسه: ٠.', { glyphs: [b.glyph], room: 1 });
    else addNote('back' + item, `ظهر ${ITEMS[item].name}`, 'على الظهر رمز محفور:', { glyphs: [b.glyph] });
    checkSequenceNote();
    save();
  }

  // ===== الغرفة 2 =====
  function laserPanel() {
    openPanel({
      hot: 'laser', title: 'طاولة البصريات',
      render() {
        const tr = ZS.traceLasers(S.mirrors, S.crystalIn);
        const grid = ZS.LASER_GRID, cs = 40, wpx = grid[0].length * cs, hpx = grid.length * cs;
        const col = { white: '#ffffff', green: '#c08aff', gold: '#ffc85a' };
        let svg = `<svg class="laser" viewBox="0 0 ${wpx} ${hpx}" role="img" aria-label="شبكة المرايا والأشعة"><defs><filter id="bl" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2.4"/></filter></defs>`;
        for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid[0].length; x++) {
          const ch = grid[y][x], X = x * cs, Y = y * cs, cx = X + cs / 2, cy = Y + cs / 2;
          if (ch === '#') svg += `<rect x="${X + 1}" y="${Y + 1}" width="${cs - 2}" height="${cs - 2}" fill="#131917" rx="3"/>`;
          else svg += `<circle cx="${cx}" cy="${cy}" r="1.2" fill="#24302b"/>`;
        }
        tr.segments.forEach((s) => {
          let x1 = s.x1 * cs + cs / 2, y1 = s.y1 * cs + cs / 2, x2 = s.x2 * cs + cs / 2, y2 = s.y2 * cs + cs / 2;
          if (s.stop) { x2 = (x1 + x2) / 2; y2 = (y1 + y2) / 2; }
          svg += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col[s.color]}" stroke-width="5" opacity=".55" filter="url(#bl)"/><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${col[s.color]}" stroke-width="1.6"/>`;
        });
        for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid[0].length; x++) {
          const ch = grid[y][x], X = x * cs, Y = y * cs, cx = X + cs / 2, cy = Y + cs / 2, k = x + ',' + y;
          if (ch === 'E') svg += `<rect x="${X + 4}" y="${cy - 8}" width="${cs - 8}" height="16" rx="4" fill="#3a403e"/><circle cx="${X + cs - 6}" cy="${cy}" r="4" fill="#fff"/>`;
          if (ch === 'S') svg += `<line x1="${X + 7}" y1="${Y + cs - 7}" x2="${X + cs - 7}" y2="${Y + 7}" stroke="#bfe6ff" stroke-width="3" stroke-dasharray="4 3"/>`;
          if (ch === 'y') svg += `<rect x="${cx - 4}" y="${Y + 5}" width="8" height="${cs - 10}" fill="#ffc040" opacity=".75" rx="2"/>`;
          if (ch === 'C') svg += `<g data-act="socket" style="cursor:pointer"><circle cx="${cx}" cy="${cy}" r="13" fill="#0d1110" stroke="#c9a253" stroke-width="2"/>${S.crystalIn ? `<path d="M${cx} ${cy - 11} L${cx + 7} ${cy} L${cx} ${cy + 11} L${cx - 7} ${cy}Z" fill="#b46bff"/>` : '<circle cx="' + cx + '" cy="' + cy + '" r="4" fill="#2a2f2d"/>'}</g>`;
          if (ch === 'm') {
            const m = S.mirrors[k];
            const [ax, ay, bx, by] = m === '/' ? [X + 7, Y + cs - 7, X + cs - 7, Y + 7] : [X + 7, Y + 7, X + cs - 7, Y + cs - 7];
            svg += `<g class="mir" data-act="mir" data-k="${k}" role="button" aria-label="مرآة"><rect class="bg" x="${X + 1}" y="${Y + 1}" width="${cs - 2}" height="${cs - 2}" rx="5" fill="rgba(201,162,83,.06)" stroke="rgba(201,162,83,.35)"/><line x1="${ax}" y1="${ay}" x2="${bx}" y2="${by}" stroke="#e9fff8" stroke-width="4" stroke-linecap="round"/></g>`;
          }
          if (ch in ZS.RECEIVERS) {
            const need = ZS.RECEIVERS[ch], r = tr.receivers[k];
            svg += `<circle cx="${cx}" cy="${cy}" r="12" fill="${r.ok ? col[need] : '#0d1110'}" stroke="${col[need]}" stroke-width="2.5" ${r.ok ? 'filter="url(#bl)"' : ''}/><circle cx="${cx}" cy="${cy}" r="${r.ok ? 6 : 3}" fill="${col[need]}"/>`;
          }
        }
        svg += '</svg>';
        const lit = Object.values(tr.receivers).filter((r) => r.ok).length;
        let h = `<p>${S.solved.light ? 'الأشعة الثلاثة مستقرة. اللوح في الجدار الخلفي انفتح.' : 'مصدر ضوء أبيض، ومقسِّمان، ومرايا تدور حول محاورها. ثلاثة مستقبلات تنتظر ألوانها. انقر على أي مرآة لتديرها.'}</p>${svg}`;
        h += `<div class="legend"><span><i style="background:#fff"></i>أبيض</span><span><i style="background:#ffc85a"></i>ذهبي</span><span><i style="background:#c08aff"></i>بنفسجي</span><span><i style="border:2px dashed #bfe6ff"></i>مقسِّم</span><span><i style="border:2px solid #c9a253"></i>مقبس البلورة</span></div>`;
        if (!S.crystalIn) h += has('crystal') ? '<div class="row"><button class="btn vi" data-act="socket">ركّب البلورة البنفسجية في المقبس</button></div>' : '<div class="status">المقبس فارغ ويحجب الشعاع الذي يصله.</div>';
        h += `<div class="status ${S.solved.light ? 'good' : ''}">المستقبلات المضاءة بلونها الصحيح: ${AR(lit)} من ٣</div>`;
        return h;
      },
      on(act, el) {
        if (S.solved.light) return;
        if (act === 'mir') { const k = el.dataset.k; S.mirrors[k] = S.mirrors[k] === '/' ? '\\' : '/'; sfx('click'); }
        if (act === 'socket') { if (!installCrystal()) return; }
        syncLaser(true);
        save(); renderPanel();
      },
    });
  }
  function installCrystal() {
    if (S.crystalIn) return true;
    if (!has('crystal')) { toast('المقبس فارغ. يحتاج إلى بلورة.', 'bad'); sfx('deny'); return false; }
    S.crystalIn = true;
    S.inv = S.inv.filter((x) => x !== 'crystal');
    if (sel === 'crystal') sel = null;
    renderInv(); sfx('beam');
    toast('استقرت البلورة في المقبس، وأضاءت بالبنفسجي.', 'good');
    return true;
  }
  function syncLaser(check) {
    const tr = ZS.traceLasers(S.mirrors, S.crystalIn);
    W.setLaser(S.mirrors, S.crystalIn, tr);
    if (check && tr.solved && !S.solved.light) {
      S.solved.light = true;
      W.dyn.lightVault.target = 1;
      W.setDoor(2, 3, 'open');
      W.burst(new THREE.Vector3(0, 2.9, -6.4), 0xffd27a);
      sfx('solve'); droneFor(2, true);
      addNote('lightSolved', 'مصدر الطاقة المخفي', 'حين وصل البنفسجي والذهبي والأبيض إلى مستقبلاتها معًا، انزلق لوح في الجدار الخلفي وكشف نواة ذهبية. وانفتح باب القطاع الثالث.', { room: 2 });
      toast('اكتملت الأشعة. انفتح لوح في الجدار الخلفي.', 'good');
      updateHud();
    }
  }

  // ===== الغرفة 3 =====
  let selCard = null, readCard = null;
  function readCardPanel(id) {
    const c = ZS.CARDS[id];
    if (!S.cards.includes(id)) {
      S.cards.push(id);
      addNote('card_' + id, c.title, c.text + ` (ختم رقم ${AR(c.seal)})`, { room: 3 });
      save(); updateHud();
    }
    readCard = id;
    openPanel({
      hot: 'card_' + id, eyebrow: 'ARCHIVE RECORD', title: c.title,
      render: () => `<div class="reader"><span class="k">${c.kind}</span><p>${c.text}</p><div class="row"><span class="label">ختم الأرشيف</span><span class="card" style="padding:0;border:0;background:none"><span class="seal">${AR(c.seal)}</span></span></div></div><p>أُضيف السجل إلى لوحة الخط الزمني. (${AR(S.cards.length)} من ٦)</p>${c.kind === 'تسجيل صوتي' ? '<div class="row"><button class="btn ghost" data-act="play">أعد تشغيل التسجيل</button></div>' : ''}`,
      on(act) { if (act === 'play') playTape(); },
    });
    if (c.kind === 'تسجيل صوتي') playTape();
  }
  function playTape() {
    if (!A.ctx || A.muted) return;
    // تسجيل مشوّش: نغمات متقطعة توحي بصوت بشري خلف الضجيج
    const t = A.ctx.currentTime;
    noise(t, 3.2, 0.12, 2400);
    for (let i = 0; i < 22; i++) env('sawtooth', 140 + Math.sin(i * 1.7) * 40 + Math.random() * 30, t + 0.2 + i * 0.13, 0.12, 0.025);
  }
  function timelinePanel() {
    openPanel({
      hot: 'timeline', title: 'لوحة الخط الزمني',
      render() {
        const conf = ZS.timelineConflicts(S.timeline);
        const confCards = new Set(conf.map((c) => c.card));
        const done = ZS.timelineComplete(S.timeline);
        let h = '<p>ضع كل حادث في مكانه، من الأقدم (يمينًا) إلى الأحدث (يسارًا). اللوحة تكشف أي تعارض بين ما تقوله السجلات.</p>';
        h += `<div class="timeline">${S.timeline.map((id, i) => {
          const c = id && ZS.CARDS[id];
          return `<button class="tslot ${c ? 'filled' : ''} ${c && confCards.has(id) ? 'conf' : ''} ${done ? 'ok' : ''}" data-act="tslot" data-i="${i}"><span class="ord">0${i + 1}</span>${c ? `<span>${ZS.EVENTS[c.event].name}</span><small style="color:var(--muted)">${c.kind}</small>${done ? `<span class="seal">${AR(c.seal)}</span>` : ''}` : '<span style="color:var(--muted)">فارغ</span>'}</button>`;
        }).join('')}</div>`;
        if (conf.length) h += `<div class="conflicts">${conf.map((c) => c.type === 'duplicate' ? `<div>حادث «${ZS.EVENTS[c.event].name}» موضوع مرتين.</div>` : `<div>«${ZS.CARDS[c.card].title}» تقول إن «${ZS.EVENTS[c.before].name}» وقع قبل «${ZS.EVENTS[c.after].name}».</div>`).join('')}</div>`;
        else if (done) h += '<div class="status good">الخط الزمني متماسك. الأختام الآن مقروءة بترتيب وقوعها.</div>';
        h += `<div class="label">السجلات التي وجدتها (${AR(S.cards.length)} من ٦)</div>`;
        h += S.cards.length ? `<div class="cards">${S.cards.map((id) => { const c = ZS.CARDS[id]; return `<button class="card ${selCard === id ? 'sel' : ''} ${S.timeline.includes(id) ? 'used' : ''}" data-act="card" data-c="${id}"><span class="k">${c.kind}</span><span class="t">${c.title}</span><span class="seal">${AR(c.seal)}</span></button>`; }).join('')}</div>` : '<p>لم تجد أي سجل بعد. ابحث في الأرشيف.</p>';
        if (selCard) { const c = ZS.CARDS[selCard]; h += `<div class="reader"><span class="k">${c.kind} · محدد للوضع على الخط</span><p>${c.text}</p></div>`; }
        return h;
      },
      on(act, el) {
        if (act === 'card' && S.cards.includes(el.dataset.c)) { selCard = selCard === el.dataset.c ? null : el.dataset.c; sfx('click'); }
        if (act === 'tslot') {
          const i = +el.dataset.i;
          if (selCard) { const prev = S.timeline.indexOf(selCard); if (prev >= 0) S.timeline[prev] = null; S.timeline[i] = selCard; selCard = null; sfx('clunk'); }
          else if (S.timeline[i]) { S.timeline[i] = null; sfx('click'); }
        }
        syncTimeline(true);
        save(); renderPanel();
      },
    });
  }
  function syncTimeline(check) {
    const done = ZS.timelineComplete(S.timeline);
    W.setTimelineHolo(S.timeline.map((id) => id ? ZS.EVENTS[ZS.CARDS[id].event].name : ''), done);
    if (check && done && !S.timelineDone) {
      S.timelineDone = true;
      sfx('beam'); W.pulse(1);
      addNote('timeline', 'ترتيب الحوادث', ZS.collapseOrder().map((room, i) => `${AR(i + 1)}. ${Object.values(ZS.EVENTS).find((e) => e.room === room).name} (القطاع ${AR(room)})`).join('<br>') + '<br>«البيان الرسمي» مزوّر: يناقض سجل الصيانة والمذكرة.', { room: 3 });
      updateHud();
    }
  }
  let code = '', codeMsg = '';
  function vaultPanel() {
    if (S.solved.archive) {
      if (!S.taken.gear) { S.taken.gear = true; give('gear', { msg: 'أخذت الترس النحاسي من داخل الخزنة.' }); }
      notePanel('vault', 'خزنة الأرشيف', ['الخزنة مفتوحة وفارغة الآن. على باطن بابها كُتب بخط اليد: «القلب يحتاج إلى ما يثبّته. —٠»']);
      return;
    }
    openPanel({
      hot: 'vault', title: 'خزنة الأرشيف',
      render: () => `<p>قفل بخمس خانات. تحته لوحة: «لا تُفتح إلا بأختام السجلات الصادقة».</p>
        <div class="codeview ${codeMsg ? 'shake' : ''}" id="codeview">${AR(code) || '·····'}</div>
        <div class="keypad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => `<button data-act="d" data-d="${d}">${AR(d)}</button>`).join('')}<button data-act="del" aria-label="حذف">⌫</button><button data-act="d" data-d="0">${AR(0)}</button><button data-act="ok" style="color:var(--violet)">↵</button></div>
        <div class="status ${codeMsg ? 'bad' : ''}">${codeMsg || 'أدخل الرمز ثم اضغط ↵'}</div>`,
      on(act, el) {
        codeMsg = '';
        if (act === 'd' && code.length < 5) { code += el.dataset.d; sfx('click'); }
        if (act === 'del') code = code.slice(0, -1);
        if (act === 'ok') {
          if (ZS.checkArchiveCode(code)) { code = ''; solveArchive(); return; }
          codeMsg = code.length < 5 ? 'الرمز يتكون من خمس خانات.' : 'الأختام لا تطابق. القفل يعود إلى الصفر.';
          code = ''; sfx('deny');
        }
        renderPanel();
      },
    });
  }
  function solveArchive() {
    S.solved.archive = true;
    W.dyn.archiveVault.target = 1;
    W.setDoor(3, 4, 'open');
    sfx('door'); setTimeout(() => sfx('solve'), 600); droneFor(3, true);
    W.burst(new THREE.Vector3(6.2, 2, -4.2), 0xffc97a);
    closePanel();
    setTimeout(() => { S.taken.gear = true; give('gear', { msg: 'انفتحت الخزنة. في داخلها ترس نحاسي بلا محور. وانفتح باب القطاع ٠٤.' }); }, 1200);
    addNote('archiveSolved', 'الخزنة مفتوحة', 'في داخلها ترس نحاسي فتحته فارغة، وعلى باطن الباب: «القلب يحتاج إلى ما يثبّته. —٠».', { room: 3 });
    save(); updateHud();
  }

  // ===== الغرفة 4 =====
  let heartRAF = 0;
  const HEART_MSG = {
    idle: 'الآلة ساكنة. المكابس مقفلة والقابض مفصول.', gear: 'ثبّتّ الترس في مقبسه. صارت السلسلة متصلة.',
    busy: 'لا يمكن تحريك ذلك والآلة تدور. افصل القابض أولًا.', idlerIn: 'انزلقت العربة يمينًا، ودخل الترس الوسيط بين الترس الأول والمقبس.',
    idlerOut: 'خرج الترس الوسيط، وعادت العربة لتلامس الترس الأول مباشرة.', pistons: 'تحرّكت أذرع المكابس.',
    vented: 'خرج البخار بصفير طويل، وعاد الضغط إلى الصفر.', stopped: 'فصلت القابض. التروس تتباطأ حتى تقف.',
    stillJammed: 'الآلة منحشرة والضغط في الأحمر. افتح صمام التنفيس أولًا.', jam: 'المكابس المقفلة صدّت الحركة. احتكت التروس وارتفع الضغط حتى انحشرت الآلة.',
    noGear: 'المحرك يدور، لكن الحركة تنقطع عند المقبس الفارغ.', wrongWay: 'القلب يدور عكس عقارب الساعة. حلقاته تنضغط أكثر بدل أن تنفرج.',
    open: 'القلب يدور مع عقارب الساعة. الحلقات تنفرج وتنكشف النواة.',
  };
  function gearPath(teeth, r) {
    let d = '';
    for (let i = 0; i < teeth; i++) {
      const a = (i / teeth) * Math.PI * 2, s = (Math.PI * 2) / teeth;
      [[r * 0.84, a], [r, a + s * 0.18], [r, a + s * 0.48], [r * 0.84, a + s * 0.66], [r * 0.84, a + s]].forEach(([rr, aa], k) => { d += (i === 0 && k === 0 ? 'M' : 'L') + (Math.cos(aa) * rr).toFixed(1) + ' ' + (Math.sin(aa) * rr).toFixed(1); });
    }
    return d + 'Z';
  }
  function heartLayout(s) {
    const L = { motor: { x: 64, r: 34, t: 10 }, g1: { x: 64 + 34 + 44, r: 44, t: 14 } };
    let edge = L.g1.x + 44;
    if (s.idler) { L.idler = { x: edge + 30, r: 30, t: 9 }; edge += 60; }
    L.socket = { x: edge + 40, r: 40, t: 12 }; edge += 80;
    L.heart = { x: edge + 52, r: 52, t: 16 };
    return L;
  }
  function heartSvg(s) {
    const L = heartLayout(s);
    const { chain } = ZS.heartChain(s);
    const dirOf = Object.fromEntries(chain.map((c) => [c.id, c.dir]));
    const cy = 150;
    const part = (id, fill, stroke, label) => {
      const g = L[id]; if (!g) return '';
      const missing = id === 'socket' && !s.gear;
      return `<g transform="translate(${g.x} ${cy})"><g class="spin" data-id="${id}" data-dir="${dirOf[id] || 0}" data-r="${g.r}">${missing ? `<circle r="${g.r * 0.8}" fill="none" stroke="#5a4a32" stroke-dasharray="5 5" stroke-width="2"/><circle r="6" fill="#2a2620"/>` : `<path d="${gearPath(g.t, g.r)}" fill="${fill}" stroke="${stroke}" stroke-width="1.2"/><circle r="${g.r * 0.28}" fill="#0a0807" stroke="${stroke}"/><line x1="0" y1="${-g.r * 0.28}" x2="0" y2="${-g.r * 0.7}" stroke="#0a0807" stroke-width="4"/>`}</g><text y="${g.r + 22}" text-anchor="middle" fill="#a89a7e" font-size="12" font-family="IBM Plex Sans Arabic, sans-serif">${label}</text></g>`;
    };
    const H = L.heart;
    const jam = s.jammed;
    const pressure = jam ? 5 : s.clutch ? 2 : 0;
    return `<svg class="machine" viewBox="0 0 480 270" role="img" aria-label="مخطط التروس">
      <rect x="0" y="0" width="480" height="270" fill="#0a0807"/>
      <text x="16" y="26" fill="#c9a253" font-size="11" font-family="Michroma, sans-serif" letter-spacing="3">DRIVE TRAIN</text>
      ${part('motor', '#4a4038', '#8a7a62', 'المحرك ↻')}
      ${part('g1', '#8a6a2c', '#c9a253', 'الترس ١')}
      ${part('idler', '#a85a2c', '#e09a5a', 'الوسيط')}
      ${part('socket', '#c77a3a', '#f0b070', s.gear ? 'المقبس' : 'مقبس فارغ')}
      <g transform="translate(${H.x} ${cy})">
        <g class="spin" data-id="heart" data-dir="${dirOf.heart || 0}" data-r="${H.r}"><path d="${gearPath(H.t, H.r)}" fill="#3a1410" stroke="#ff7a3a" stroke-width="1.4"/><circle r="${H.r * 0.55}" fill="#1a0806" stroke="#ff7a3a"/><circle r="${H.r * 0.3}" fill="${s.solved ? '#ff9a5a' : '#5a1a10'}"/></g>
        <path d="M ${-H.r - 10} -12 A ${H.r + 10} ${H.r + 10} 0 0 1 ${-12} ${-H.r - 10}" fill="none" stroke="#b46bff" stroke-width="2"/>
        <path d="M -12 ${-H.r - 10} l -10 -6 l 2 12 z" fill="#b46bff"/>
        <text y="${H.r + 22}" text-anchor="middle" fill="#ffb27a" font-size="12" font-family="IBM Plex Sans Arabic, sans-serif">القلب</text>
        <text y="${-H.r - 22}" x="-30" text-anchor="middle" fill="#b46bff" font-size="11" font-family="IBM Plex Sans Arabic, sans-serif">محفور: مع العقارب</text>
      </g>
      <g transform="translate(16 236)"><text fill="#a89a7e" font-size="11" font-family="IBM Plex Sans Arabic, sans-serif" x="0" y="0">الضغط</text>${[0, 1, 2, 3, 4].map((i) => `<rect x="${40 + i * 18}" y="-10" width="14" height="10" rx="2" fill="${i < pressure ? (jam ? '#ff5a4a' : '#c9a253') : '#1d1a16'}"/>`).join('')}
      <text x="150" y="0" fill="${s.pistons === 'locked' ? '#ff8b7a' : '#b46bff'}" font-size="11" font-family="IBM Plex Sans Arabic, sans-serif">المكابس: ${s.pistons === 'locked' ? 'مقفلة' : 'محررة'}</text></g>
    </svg>`;
  }
  function heartPanel() {
    openPanel({
      hot: 'machine', title: 'وحدة التحكم',
      render() {
        const s = S.heart;
        let h = `<p>المحرك يدور دائمًا مع عقارب الساعة. يمر الدوران عبر سلسلة التروس حتى القلب، والقلب لا ينفتح إلا إذا دار في الاتجاه المحفور عليه.</p>${heartSvg(s)}`;
        if (!s.gear) h += has('gear_axle') ? '<div class="row"><button class="btn vi" data-act="installGear">ركّب الترس بمحوره في المقبس</button></div>' : has('gear') ? '<div class="status bad">الترس النحاسي يدور في المقبس دون أن يثبت. ينقصه محور.</div>' : '';
        const lever = (act, on, title, sub, warn) => `<button class="lever ${on ? 'on' : ''} ${warn ? 'warn' : ''}" data-act="${act}" ${s.solved ? 'disabled' : ''}><span class="sw"></span><b>${title}</b><small>${sub}</small></button>`;
        h += `<div class="levers">
          ${lever('idler', s.idler, 'الترس الوسيط', s.idler ? 'داخل السلسلة' : 'خارج السلسلة')}
          ${lever('pistons', s.pistons === 'released', 'المكابس', s.pistons === 'released' ? 'محررة' : 'مقفلة')}
          ${lever('clutch', s.clutch, 'القابض', s.clutch ? 'مشبوك' : 'مفصول')}
          ${lever('vent', false, 'صمام التنفيس', s.jammed ? 'الضغط مرتفع' : 'مغلق', s.jammed)}
        </div>`;
        h += `<div class="status ${s.solved ? 'good' : ['jam', 'stillJammed', 'wrongWay', 'busy', 'noGear'].includes(s.last) ? 'bad' : ''}">${HEART_MSG[s.last] || HEART_MSG.idle}</div>`;
        return h;
      },
      after: startHeartAnim,
      on(act) {
        if (S.heart.solved) return;
        if (act === 'installGear') { if (!has('gear_axle')) return; S.inv = S.inv.filter((x) => x !== 'gear_axle'); if (sel === 'gear_axle') sel = null; renderInv(); }
        const before = S.heart;
        S.heart = ZS.heartAction(S.heart, act);
        const s = S.heart;
        if (s.last === 'jam') { sfx('clunk'); W.pulse(0.4); }
        else if (s.last === 'vented') sfx('steam');
        else if (['busy', 'stillJammed'].includes(s.last)) sfx('deny');
        else sfx('mech');
        W.setHeart(s);
        if (s.solved && !before.solved) solveHeart();
        save(); renderPanel();
      },
    });
  }
  function startHeartAnim() {
    stopHeartAnim();
    const angles = {};
    let last = performance.now();
    const step = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      const s = S.heart;
      const running = s.clutch && !s.jammed;
      document.querySelectorAll('#pBody .spin').forEach((g) => {
        const id = g.dataset.id, dir = +g.dataset.dir, r = +g.dataset.r;
        let w = 0;
        if (running && dir) {
          const reaches = s.gear || ['motor', 'g1', 'idler'].includes(id);
          if (reaches) w = (dir * 90) / r; // سرعة زاوية تتناسب عكسيًا مع نصف القطر
        }
        if (s.jammed && ['motor', 'g1'].includes(id)) w = Math.sin(now / 30) * 2;
        angles[id] = (angles[id] || 0) + w * dt * 0.9;
        g.setAttribute('transform', `rotate(${(angles[id] * 180) / Math.PI})`);
      });
      heartRAF = requestAnimationFrame(step);
    };
    heartRAF = requestAnimationFrame(step);
  }
  function stopHeartAnim() { cancelAnimationFrame(heartRAF); heartRAF = 0; }
  function solveHeart() {
    S.solved.heart = true;
    W.setDoor(4, 5, 'open');
    sfx('solve'); droneFor(4, true);
    W.burst(new THREE.Vector3(0, 2.5, -5), 0xff8a4a);
    addNote('heartSolved', 'القلب يدور مع عقارب الساعة', 'بعد إدخال الترس الوسيط صار عدد التروس زوجيًا بين المحرك والقلب، فدار القلب في اتجاه المحرك. انفرجت حلقاته وانكشفت نواته.', { room: 4 });
    toast('انفرجت حلقات القلب. خذ النواة من داخله. وانفتح باب القطاع ٠٥.', 'good');
    updateHud();
  }

  // ===== الغرفة 5 =====
  function lockPanel() {
    openPanel({
      hot: 'mirrorLock', title: 'قفل الرموز',
      render() {
        const row = S.dials.map((i) => ZS.MIRROR_DIAL_OPTIONS[i]);
        const shown = S.mirrorView ? ZS.reflectRow(row) : row;
        let h = `<p>${S.solved.mirror ? 'انفتح القفل، وسقطت من خلفه شظية مرآة.' : 'خمسة أقراص، كل قرص يحمل رمزًا يمكن قلبه. تحت القفل نقش: «لا يُفتح لمن ينظر إليه، بل لمن ينظر إليه المرآة».'}</p>`;
        h += `<div class="row"><span class="label">زاوية النظر</span><div class="seg"><button class="${S.mirrorView ? '' : 'on'}" data-act="view" data-v="0">مباشرة</button><button class="${S.mirrorView ? 'on' : ''}" data-act="view" data-v="1">في المرآة</button></div></div>`;
        h += `<div class="dials ${S.mirrorView ? 'mirror' : ''}">${shown.map((gid, j) => `<div class="dial"><button class="arr" data-act="up" data-j="${j}" aria-label="الرمز التالي" ${S.solved.mirror ? 'disabled' : ''}>▲</button><div class="face">${glyphSvg(gid, S.mirrorView ? '#dff2ff' : '#bfe6ff')}</div><button class="arr" data-act="down" data-j="${j}" aria-label="الرمز السابق" ${S.solved.mirror ? 'disabled' : ''}>▼</button></div>`).join('')}</div>`;
        h += `<div class="status ${S.solved.mirror ? 'good' : ''}">${S.solved.mirror ? 'المرآة ترى تسلسل الساعة كما هو.' : S.mirrorView ? 'هذا ما تراه المرآة: الترتيب معكوس وكل رمز مقلوب.' : 'هذا ما تراه بعينك.'}</div>`;
        const seq = S.notes.find((n) => n.id === 'clockSeq');
        if (seq && !S.solved.mirror) h += `<div class="label">من دفترك: ما حفظته الساعة</div><div class="glyphrow">${seq.glyphs.map((g) => `<span>${glyphSvg(g, '#e8d4a0')}</span>`).join('')}</div>`;
        return h;
      },
      on(act, el) {
        if (act === 'view') { S.mirrorView = el.dataset.v === '1'; sfx('glitch'); W.focus(S.mirrorView ? 'mirror' : 'mirrorLock'); }
        if ((act === 'up' || act === 'down') && !S.solved.mirror) {
          const j = +el.dataset.j;
          const i = S.mirrorView ? 4 - j : j; // في المرآة يظهر القرص الأخير أولًا
          const n = ZS.MIRROR_DIAL_OPTIONS.length;
          S.dials[i] = (S.dials[i] + (act === 'up' ? 1 : n - 1)) % n;
          sfx('click');
          syncLock(true);
        }
        save(); renderPanel();
      },
    });
  }
  function syncLock(check) {
    const row = S.dials.map((i) => ZS.MIRROR_DIAL_OPTIONS[i]);
    W.setLockDials(row);
    if (check && !S.solved.mirror && ZS.checkMirrorLock(row).solved) {
      S.solved.mirror = true;
      W.dyn.shard.visible = !S.taken.shard;
      W.setHotEnabled('shard', !S.taken.shard);
      W.setDoor(5, 6, 'open');
      sfx('solve'); droneFor(5, true);
      W.burst(new THREE.Vector3(-6.2, 1.7, -2.6), 0xbfe6ff);
      addNote('mirrorSolved', 'القفل المعكوس', 'حين رأت المرآة تسلسل الساعة كما هو، انفتح القفل وسقطت شظية مرآة. وانفتح باب البوابة صفر.', { room: 5 });
      toast('انفتح القفل. سقطت شظية مرآة على الأرض، وانفتح باب البوابة صفر.', 'good');
      updateHud();
    }
  }

  // ===== الغرفة 6 =====
  const SIGIL_ROOMS = [1, 2, 3, 4, 5];
  const SIGIL_NAMES = { 1: 'الساعة', 2: 'الضوء', 3: 'الأرشيف', 4: 'القلب', 5: 'المرآة' };
  let gateMsg = '', gateCore = null, idReply = '';
  function gatePanel() {
    openPanel({
      hot: 'gate', title: 'البوابة صفر',
      render() {
        const socketsDone = S.gateSockets.every(Boolean);
        const cores = ['light_core', 'heart_core', 'mirror_shard'].filter(has);
        let h = '<p>حلقة ذهبية بثلاثة مقابس، ومنصتان أمامها. البوابة تنتظر ثلاثة أشياء: طاقة، وذاكرة، واعترافًا.</p><div class="steps">';
        h += `<div class="step ${socketsDone ? 'done' : ''}"><h4>١. الطاقة <small>${socketsDone ? 'اكتملت' : 'اختر نواة ثم مقبسها'}</small></h4>
          <div class="sockets">${ZS.GATE_SOCKETS.map((gid, i) => `<button class="sock ${S.gateSockets[i] ? 'full' : ''}" data-act="sock" data-i="${i}">${glyphSvg(gid, S.gateSockets[i] ? '#b46bff' : '#e8d4a0')}<span>${S.gateSockets[i] ? ITEMS[S.gateSockets[i]].name : 'مقبس ' + ZS.GLYPHS[gid].name}</span></button>`).join('')}</div>
          ${!socketsDone ? (cores.length ? `<div class="row">${cores.map((c) => `<button class="btn ${gateCore === c ? 'vi' : 'ghost'}" data-act="core" data-c="${c}">${ITEMS[c].name}</button>`).join('')}</div>` : '<p>لا تحمل أي نواة.</p>') : ''}</div>`;
        h += `<div class="step ${socketsDone ? '' : 'locked'} ${S.sigilsDone ? 'done' : ''}"><h4>٢. الذاكرة <small>«أيقظ القطاعات بالترتيب الذي سقطت به»</small></h4>
          <div class="sigils">${SIGIL_ROOMS.map((r) => `<button data-act="sig" data-r="${r}" class="${S.sigils.includes(r) || S.sigilsDone ? 'pressed' : ''}" ${S.sigilsDone ? 'disabled' : ''}><b>0${r}</b>${SIGIL_NAMES[r]}</button>`).join('')}</div>
          <div class="seq">${(S.sigilsDone ? ZS.collapseOrder() : S.sigils).map((r) => `<span>0${r}</span>`).join('')}</div></div>`;
        h += `<div class="step ${S.sigilsDone ? '' : 'locked'}"><h4>٣. الاعتراف <small>من ترك لك الأدلة؟</small></h4>
          <div class="opts">${Object.entries(ZS.IDENTITY_OPTIONS).map(([k, o]) => `<button data-act="id" data-k="${k}">${o.label}</button>`).join('')}</div>
          ${idReply ? `<div class="status bad">${idReply}</div>` : ''}</div>`;
        h += '</div>';
        if (gateMsg) h += `<div class="status ${gateMsg.startsWith('!') ? 'bad' : 'good'}">${gateMsg.replace(/^!/, '')}</div>`;
        return h;
      },
      on(act, el) {
        gateMsg = '';
        if (act === 'core') { gateCore = gateCore === el.dataset.c ? null : el.dataset.c; sfx('click'); }
        if (act === 'sock') {
          if (S.gateSockets.every(Boolean)) return;
          const i = +el.dataset.i;
          const core = gateCore || (sel && ZS.CORES[sel] ? sel : null);
          if (S.gateSockets[i]) { gateMsg = 'المقبس ممتلئ.'; }
          else if (!core) gateMsg = '!اختر نواة أولًا.';
          else placeCore(i, core);
          gateCore = null;
        }
        if (act === 'sig') {
          if (!S.gateSockets.every(Boolean) || S.sigilsDone) return;
          S.sigils.push(+el.dataset.r); sfx('note');
          W.setGate({ sockets: S.gateSockets, sigilCount: S.sigils.length, sigilsDone: false });
          if (S.sigils.length === 5) {
            if (ZS.checkSigils(S.sigils)) {
              S.sigilsDone = true; sfx('solve'); W.pulse(1.4); droneFor(6, true);
              gateMsg = 'استيقظت القطاعات الخمسة واحدًا بعد الآخر. البوابة تنتظر جوابك.';
              addNote('sigils', 'القطاعات استيقظت', 'أيقظتُ القطاعات بترتيب سقوطها: المرآة، الضوء، الساعة، القلب، الأرشيف.', { room: 6 });
            } else {
              S.sigils = []; S.gateFails++; sfx('glitch');
              gateMsg = '!انطفأت الرموز الخمسة معًا. الترتيب لا يطابق ما حدث.';
            }
            W.setGate({ sockets: S.gateSockets, sigilCount: S.sigils.length, sigilsDone: !!S.sigilsDone });
          }
        }
        if (act === 'id') {
          if (!S.sigilsDone) return;
          const k = el.dataset.k;
          if (ZS.checkIdentity(k)) { S.solved.gate = true; save(); closePanel(); startEnding(); return; }
          idReply = ZS.IDENTITY_OPTIONS[k].reply; sfx('deny');
        }
        save(); renderPanel(); updateHud();
      },
    });
  }
  function placeCore(i, core) {
    if (!has(core)) return;
    if (!ZS.socketAccepts(i, core)) { gateMsg = `!المقبس يدفع «${ITEMS[core].name}» إلى الخارج. الرمز المحفور لا يطابقها.`; sfx('deny'); return; }
    S.gateSockets[i] = core;
    S.inv = S.inv.filter((x) => x !== core); if (sel === core) sel = null;
    renderInv(); sfx('clunk'); setTimeout(() => sfx('beam'), 200);
    W.setGate({ sockets: S.gateSockets, sigilCount: S.sigils.length, sigilsDone: !!S.sigilsDone });
    gateMsg = `استقرت ${ITEMS[core].name} في مقبسها.`;
    if (S.gateSockets.every(Boolean)) { gateMsg = 'اكتملت النوى الثلاث. الحلقة تدور والضوء البنفسجي يملأ البوابة.'; W.pulse(1.2); }
  }

  // ===== التفاعل مع العناصر =====
  function onHot(id) {
    audioInit();
    W.clearHover();
    if (sel) { useItem(sel, id); return; }
    if (panel) closePanel();
    sfx('click');
    const tk = S.taken;
    // الأبواب
    const dm = id.match(/^door(\d)_(\d)$/);
    if (dm) {
      const from = +dm[1], to = +dm[2];
      const open = to < from || doorOpen(from);
      if (open) { travel(to); return; }
      sfx('deny');
      toast({ 1: 'الباب مقفل. على لوحته: «يُفتح حين يعود الزمن إلى مساره».', 2: 'الباب مقفل. يحتاج إلى طاقة لم تصل بعد.', 3: 'الباب مقفل بختم الأرشيف.', 4: 'الباب موصول بالقلب الميكانيكي، والقلب لا ينبض.', 5: 'الباب مغلق من الجهة الأخرى للمرآة.' }[from], 'bad');
      return;
    }
    if (id.startsWith('card_')) { readCardPanel(id.slice(5)); return; }
    if (id.startsWith('photo')) {
      const item = id;
      if (!tk[item]) {
        tk[item] = true; W.dyn[item].visible = false;
        give(item, { msg: `أخذت ${ITEMS[item].name}.` });
        const count = ZS.PHOTO_IDS.filter((p) => tk['photo' + p]).length;
        if (count === 1) setTimeout(() => inspect(item), 400);
        if (count === 5) addNote('photosAll', 'خمس صور للساحة نفسها', 'كل صورة تُظهر المسلّة وظلها من الأعلى، والبوصلة تشير إلى الشمال. الأوقات المكتوبة لا تتفق مع الظلال.', { room: 1 });
      }
      return;
    }
    switch (id) {
      case 'clock': notePanel('clock', 'الساعة الكبرى', S.solved.clock ? ['العقارب تدور إلى الأمام الآن، والأرقام عادت إلى ترتيبها. صوت التكتكة صار أهدأ.'] : ['عقاربها تدور عكس الزمن، وأرقامها مرتّبة عكس اتجاه العقارب. تحت الساعة سكة نحاسية بخمسة إطارات فارغة.', 'خلف الزجاج ترى تروسًا ساكنة تنتظر شيئًا يحركها.']); addNote('clockSeen', 'الساعة ترتد', 'الساعة الكبرى تدور عكسيًا. تحتها سكة بخمسة إطارات فارغة.', { room: 1 }); break;
      case 'rail': clockPanel(); break;
      case 'crt': notePanel('crt', 'شاشة قديمة', ['«أنت لم تدخل هذه الغرفة للمرة الأولى.»', 'في الزاوية السفلى رقم خافت: الدورة ٧.']); addNote('crt', 'رسالة الشاشة', '«أنت لم تدخل هذه الغرفة للمرة الأولى.» — الدورة ٧.', { room: 1 }); break;
      case 'scratches': notePanel('scratches', 'خدوش على الجدار', ['ستة خطوط محفورة بأداة حادة، أربعة يقطعها خط خامس ثم خط وحيد. شخص ما كان يعدّ شيئًا.', 'الخدوش قديمة، لكن الغبار في آخرها أقل من أولها.']); addNote('tally1', 'ستة خدوش', 'في غرفة الساعة ستة خدوش محفورة على الجدار، كأن أحدًا يعدّ مرات.', { room: 1 }); break;
      case 'vitrine':
        if (S.solved.clock && !tk.crystal) { tk.crystal = true; W.dyn.vitrine.crystal.visible = false; give('crystal', { msg: 'أخذت البلورة البنفسجية من الصندوق.' }); W.setHotEnabled('vitrine', false); }
        else notePanel('vitrine', 'صندوق زجاجي مختوم', ['في داخله بلورة بنفسجية تنبض ببطء. قفل الصندوق موصول بسلك نحاسي يصعد إلى آلية الساعة.']);
        break;
      case 'laser': laserPanel(); break;
      case 'axle': if (!tk.axle) { tk.axle = true; W.dyn.axle.visible = false; give('axle', { msg: 'أخذت المحور الفولاذي.' }); W.setHotEnabled('axle', false); } break;
      case 'board2': notePanel('board2', 'سبورة الملاحظات', ['قوانين البلورات:', '١. الضوء الأبيض يأخذ لون الزجاج الذي يعبره.<br>٢. الزجاج يمرّر لونه فقط، ويبتلع أي لون آخر.<br>٣. المقسِّم يمرّر نصف الشعاع ويعكس نصفه.<br>٤. المقبس الفارغ يحجب كل شيء.', '«البلورة نُقلت إلى غرفة الساعة بعد الحادث. —٠»']); addNote('board2', 'قوانين البلورات', 'الأبيض يأخذ لون الزجاج الذي يعبره. الزجاج يمرّر لونه فقط ويبتلع أي لون آخر. المقسِّم يمرّر ويعكس. المقبس الفارغ يحجب. والبلورة نُقلت إلى غرفة الساعة.', { room: 2 }); break;
      case 'lightVault':
        if (S.solved.light && !tk.light_core) { tk.light_core = true; W.dyn.lightVault.coreLight.visible = false; W.dyn.lightVault.cage.visible = false; give('light_core', { msg: 'أخذت نواة الضوء من خلف اللوح.' }); W.setHotEnabled('lightVault', false); }
        else notePanel('lightVault', 'لوح معدني مغلق', ['لوح مزدوج في منتصف الجدار، تتسرب من شقه حرارة وضوء ذهبي. لا مقبض له. أسلاك رفيعة تصله بمستقبلات طاولة البصريات.']);
        break;
      case 'timeline': timelinePanel(); break;
      case 'vault': vaultPanel(); break;
      case 'machine': heartPanel(); break;
      case 'heartCore':
        if (S.solved.heart && !tk.heart_core) { tk.heart_core = true; W.dyn.heart.core.visible = false; give('heart_core', { msg: 'مددت يدك بين الحلقات وأخذت نواة القلب.' }); W.setHotEnabled('heartCore', false); }
        else notePanel('heartCore', 'القلب الميكانيكي', ['ثلاث حلقات معدنية متداخلة حول نواة حمراء تنبض ببطء. الحلقة الخارجية محفور عليها سهم يدور مع عقارب الساعة.']);
        break;
      case 'plate': notePanel('plate', 'لوحة نحاسية محفورة', ['«القلب لا يستيقظ إلا مع عقارب الساعة.»', '«كل ترس يعكس دوران جاره. لا تُشبك القابض والمكابس مقفلة.»']); addNote('plate', 'اللوحة النحاسية', 'القلب لا يستيقظ إلا مع عقارب الساعة. كل ترس يعكس دوران جاره. لا تُشبك القابض والمكابس مقفلة.', { room: 4 }); break;
      case 'mirror': lookInMirror(); break;
      case 'mirrorText': notePanel('mirrorText', 'كتابة معكوسة', ['الحروف مكتوبة بالمقلوب، كأنها كُتبت لتُقرأ من الجهة الأخرى. ربما تقرؤها المرآة أوضح مما تقرؤها أنت.']); break;
      case 'tally5': notePanel('tally5', 'خدوش على الجدار', ['ستة خدوش، مثل التي في غرفة الساعة تمامًا. الخط نفسه، والأداة نفسها.']); break;
      case 'mirrorLock': lockPanel(); break;
      case 'shard': if (!tk.shard) { tk.shard = true; W.dyn.shard.visible = false; give('mirror_shard', { msg: 'التقطت شظية المرآة.' }); W.setHotEnabled('shard', false); } break;
      case 'gate': case 'sigils': case 'identity': gatePanel(); break;
      case 'socket0': case 'socket1': case 'socket2': gatePanel(); break;
      default: break;
    }
    save();
  }
  function lookInMirror() {
    S.mirrorView = true;
    notePanel('mirror', 'المرآة الكبرى', [
      'المرآة تعكس الغرفة بدقة مزعجة. الكتابة على الجدار الأيمن تُقرأ فيها بوضوح: «ما حفظته الساعة، لا تقرؤه إلا المرآة.»',
      'وفي الانعكاس شيء ليس في الغرفة: هيئة بنفسجية باهتة تقف أمام القفل، ويدها على أقراصه. وعلى الجدار خلفها سبعة خدوش، لا ستة.',
    ]);
    if (!S.sawGhost) {
      S.sawGhost = true; sfx('glitch');
      addNote('ghost', 'ما تراه المرآة', 'المرآة تقرأ الكتابة المعكوسة: «ما حفظته الساعة، لا تقرؤه إلا المرآة». وفي الانعكاس هيئة تقف أمام القفل، وسبعة خدوش بدل ستة.', { room: 5 });
    }
  }
  function doorOpen(from) { return !!{ 1: S.solved.clock, 2: S.solved.light, 3: S.solved.archive, 4: S.solved.heart, 5: S.solved.mirror }[from]; }
  function useItem(item, hot) {
    const name = ITEMS[item].name;
    sel = null; renderInv();
    if (item === 'crystal' && hot === 'laser') { if (panel) closePanel(); laserPanel(); installCrystal(); syncLaser(true); save(); renderPanel(); return; }
    if (item === 'gear_axle' && hot === 'machine') { if (panel) closePanel(); heartPanel(); panel.on('installGear'); return; }
    if (item === 'gear' && hot === 'machine') { toast('الترس يدور في المقبس دون أن يثبت. ينقصه محور.', 'bad'); sfx('deny'); return; }
    if (ZS.CORES[item] && /^socket\d$/.test(hot)) { if (panel) closePanel(); gatePanel(); placeCore(+hot.slice(-1), item); save(); renderPanel(); updateHud(); return; }
    if (ZS.CORES[item] && hot === 'gate') { if (panel) closePanel(); gateCore = item; gatePanel(); return; }
    if (item.startsWith('photo') && hot === 'rail') { if (panel) closePanel(); pickedPhoto = item.slice(5); clockPanel(); return; }
    toast(`لا يحدث شيء حين تستخدم ${name} هنا.`, 'bad'); sfx('deny');
  }

  // ===== الفاحص ثلاثي الأبعاد =====
  const I = { r: null, scene: null, cam: null, obj: null, rx: 0.2, ry: 0, trx: 0.2, try_: 0, zoom: 3.2, tzoom: 3.2, item: null, raf: 0, drag: null };
  function inspect(item) {
    audioInit();
    if (panel) closePanel();
    I.item = item;
    const it = ITEMS[item];
    $('iTitle').textContent = it.name;
    $('iDesc').textContent = it.desc;
    $('iFound').textContent = BACKS[item] ? (S.backs[item] ? 'رأيت ما على ظهرها.' : 'اسحب لتدويرها، والعجلة أو القرص للتكبير.') : 'اسحب لتدويرها، والعجلة أو القرص للتكبير.';
    $('iFlip').hidden = !BACKS[item] && !['gear', 'gearAxle', 'axle', 'crystal'].includes(it.model);
    $('inspect').hidden = false;
    W.blocked = true;
    if (!I.r) setupInspector();
    if (I.obj) { I.scene.remove(I.obj); }
    I.obj = buildInspectModel(item);
    I.scene.add(I.obj);
    I.rx = I.trx = 0.15; I.ry = I.try_ = -0.5; I.zoom = 5; I.tzoom = it.model === 'photo' ? 2.6 : 2.4;
    resizeInspector();
    cancelAnimationFrame(I.raf);
    I.raf = requestAnimationFrame(inspectLoop);
    S.newItems = S.newItems.filter((x) => x !== item); renderInv();
    sfx('note');
  }
  function closeInspect() { $('inspect').hidden = true; cancelAnimationFrame(I.raf); W.blocked = false; }
  function setupInspector() {
    const cv = $('inspectCanvas');
    I.r = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    I.r.setPixelRatio(Math.min(devicePixelRatio, 2));
    I.r.outputEncoding = THREE.sRGBEncoding;
    I.r.toneMapping = THREE.ACESFilmicToneMapping;
    I.scene = new THREE.Scene();
    I.cam = new THREE.PerspectiveCamera(35, 1, 0.05, 50);
    I.scene.add(new THREE.HemisphereLight(0xf0e4ff, 0x221a10, 0.9));
    const k = new THREE.DirectionalLight(0xfff1d6, 1.6); k.position.set(2, 3, 4); I.scene.add(k);
    const r = new THREE.DirectionalLight(0xb46bff, 0.8); r.position.set(-3, 1, -2); I.scene.add(r);
    const envScene = new THREE.Scene();
    envScene.background = new THREE.Color(0x445550);
    const pm = new THREE.PMREMGenerator(I.r);
    I.scene.environment = pm.fromScene(envScene).texture;
    pm.dispose();
    cv.addEventListener('pointerdown', (e) => { I.drag = { x: e.clientX, y: e.clientY, rx: I.trx, ry: I.try_ }; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointermove', (e) => { if (!I.drag) return; I.try_ = I.drag.ry + (e.clientX - I.drag.x) * 0.01; I.trx = Math.max(-1.4, Math.min(1.4, I.drag.rx + (e.clientY - I.drag.y) * 0.01)); });
    cv.addEventListener('pointerup', () => { I.drag = null; });
    cv.addEventListener('wheel', (e) => { e.preventDefault(); I.tzoom = Math.max(1.2, Math.min(5, I.tzoom + e.deltaY * 0.002)); }, { passive: false });
    let pinch = 0;
    cv.addEventListener('touchmove', (e) => { if (e.touches.length === 2) { const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY); if (pinch) I.tzoom = Math.max(1.2, Math.min(5, I.tzoom - (d - pinch) * 0.01)); pinch = d; } }, { passive: true });
    cv.addEventListener('touchend', () => { pinch = 0; });
    addEventListener('resize', resizeInspector);
  }
  function resizeInspector() {
    if (!I.r || $('inspect').hidden) return;
    const cv = $('inspectCanvas'), w = cv.clientWidth || innerWidth, h = cv.clientHeight || innerHeight * 0.6;
    I.r.setSize(w, h, false); I.cam.aspect = w / h; I.cam.updateProjectionMatrix();
  }
  function tex(w, h, draw) {
    const c = document.createElement('canvas'); c.width = w; c.height = h; draw(c.getContext('2d'), w, h);
    const t = new THREE.CanvasTexture(c); t.encoding = THREE.sRGBEncoding; t.anisotropy = 8; return t;
  }
  function backPlate(group, item, z, size) {
    const b = BACKS[item];
    if (!b) return;
    const t = tex(512, 512, (g, w, h) => {
      g.fillStyle = b.photo ? '#e4dccb' : '#151a18'; g.fillRect(0, 0, w, h);
      if (b.glyph) W.drawGlyph(g, b.glyph, w / 2 - 170, h / 2 - 170, 340, b.photo ? '#1a1a17' : '#e8d4a0', 1.3);
      if (b.text) { g.direction = 'rtl'; g.textAlign = 'center'; g.fillStyle = '#ecdcff'; g.font = '600 46px "IBM Plex Sans Arabic", sans-serif'; b.text.split('\n').forEach((ln, i) => g.fillText(ln, w / 2, 200 + i * 70)); }
      if (b.sign || b.photo) { g.fillStyle = b.photo ? '#3d1f5e' : '#b46bff'; g.font = 'italic 54px Georgia, serif'; g.textAlign = 'right'; g.fillText('—٠', w - 50, h - 50); }
    });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(size[0], size[1]), new THREE.MeshStandardMaterial({ map: t, roughness: 0.7, metalness: 0.1 }));
    p.position.z = z; p.rotation.y = Math.PI;
    group.add(p);
    group.userData.backNormal = new THREE.Vector3(0, 0, -1);
  }
  function buildInspectModel(item) {
    const it = ITEMS[item], g = new THREE.Group();
    const M = (c, o = {}) => new THREE.MeshStandardMaterial(Object.assign({ color: c, metalness: 0.7, roughness: 0.35 }, o));
    switch (it.model) {
      case 'photo': {
        const front = tex(320, 370, W.photoFront(it.pid));
        g.add(new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.16, 0.01), M(0xd9cfb8, { metalness: 0, roughness: 0.9 })));
        const f = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.16), M(0xffffff, { map: front, metalness: 0, roughness: 0.8 })); f.position.z = 0.006; g.add(f);
        const bt = tex(320, 370, W.photoBack(it.pid));
        const b = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.16), M(0xffffff, { map: bt, metalness: 0, roughness: 0.85 })); b.position.z = -0.006; b.rotation.y = Math.PI; g.add(b);
        g.userData.backNormal = new THREE.Vector3(0, 0, -1);
        break;
      }
      case 'band': {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.09, 20, 64), M(0x8f9a96, { metalness: 1, roughness: 0.25 }));
        ring.scale.y = 0.8; g.add(ring);
        const scr = tex(256, 128, (c, w, h) => { c.fillStyle = '#12061c'; c.fillRect(0, 0, w, h); c.fillStyle = '#c99bff'; c.textAlign = 'center'; c.direction = 'rtl'; c.font = '700 34px "IBM Plex Sans Arabic", sans-serif'; c.fillText('الخاضع ٠', w / 2, 56); c.font = '24px "IBM Plex Sans Arabic", sans-serif'; c.fillText('الدورة ٧', w / 2, 100); });
        const box = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.28, 0.12), M(0x2a302e));
        box.position.set(0, 0.44, 0.03); g.add(box);
        const s = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.22), new THREE.MeshBasicMaterial({ map: scr, toneMapped: false })); s.position.set(0, 0.44, 0.091); g.add(s);
        const engr = tex(512, 256, (c, w, h) => { c.fillStyle = '#6f7774'; c.fillRect(0, 0, w, h); c.fillStyle = '#1c2220'; c.direction = 'rtl'; c.textAlign = 'center'; c.font = '600 40px "IBM Plex Sans Arabic", sans-serif'; c.fillText('لا تثق بالوقت المكتوب.', w / 2, 100); c.fillText('ثق بالظلال.  —٠', w / 2, 170); });
        const back = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.25), M(0xffffff, { map: engr, metalness: 0.8, roughness: 0.4 }));
        back.position.set(0, 0.44, -0.031); back.rotation.y = Math.PI; g.add(back);
        g.userData.backNormal = new THREE.Vector3(0, 0, -1);
        g.position.y = -0.2;
        break;
      }
      case 'crystal': {
        const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.45, 0), M(0xb46bff, { emissive: 0xb46bff, emissiveIntensity: 0.6, metalness: 0.1, roughness: 0.05, transparent: true, opacity: 0.92 }));
        c.scale.y = 1.6; g.add(c);
        const crack = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 0.9), new THREE.MeshBasicMaterial({ color: 0xffffff })); crack.position.z = 0.2; crack.rotation.z = 0.4; g.add(crack);
        break;
      }
      case 'axle': {
        const a = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.6, 24), M(0xcfd6d3, { metalness: 1, roughness: 0.15 }));
        a.rotation.z = Math.PI / 2; g.add(a);
        for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.17, 0.17), M(0x9aa19e)); s.position.x = -0.78 + i * 0.03; g.add(s); const s2 = s.clone(); s2.position.x = 0.63 + i * 0.03; g.add(s2); }
        break;
      }
      case 'gear': case 'gearAxle': {
        const gm = W.gear(14, 0.6, 0.14, M(0xc77a3a, { metalness: 1, roughness: 0.3 })); g.add(gm);
        if (it.model === 'gearAxle') { const a = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.2, 24), M(0xcfd6d3, { metalness: 1, roughness: 0.15 })); a.rotation.x = Math.PI / 2; g.add(a); }
        break;
      }
      case 'core': {
        const col = it.color;
        g.add(new THREE.Mesh(new THREE.SphereGeometry(0.34, 32, 24), M(0x000000, { emissive: col, emissiveIntensity: 1.6 })));
        const cage = new THREE.Mesh(new THREE.IcosahedronGeometry(0.55, 1), M(0xc9a253, { wireframe: true, metalness: 1 })); g.add(cage);
        const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.05, 40), M(0x1a1f1d)); disc.rotation.x = Math.PI / 2; disc.position.z = -0.62; g.add(disc);
        backPlate(g, item, -0.65, [0.7, 0.7]);
        break;
      }
      case 'shard': {
        const geo = new THREE.BufferGeometry();
        const v = [0, 0.8, 0, 0.45, -0.1, 0, 0.05, -0.75, 0, -0.42, 0.05, 0];
        geo.setAttribute('position', new THREE.Float32BufferAttribute(v, 3)); geo.setIndex([0, 3, 1, 1, 3, 2]); geo.computeVertexNormals();
        const front = new THREE.Mesh(geo, M(0xdff2ff, { metalness: 1, roughness: 0.02, side: THREE.FrontSide }));
        g.add(front);
        backPlate(g, item, -0.01, [0.7, 0.7]);
        g.children[1].scale.set(0.9, 0.9, 1);
        break;
      }
      default: break;
    }
    return g;
  }
  const _n = new THREE.Vector3();
  function inspectLoop() {
    I.rx += (I.trx - I.rx) * 0.15; I.ry += (I.try_ - I.ry) * 0.15; I.zoom += (I.tzoom - I.zoom) * 0.12;
    if (I.obj) {
      I.obj.rotation.set(I.rx, I.ry, 0);
      if (I.obj.userData.backNormal && !S.backs[I.item]) {
        _n.copy(I.obj.userData.backNormal).applyEuler(I.obj.rotation);
        if (_n.z > 0.6) { seeBack(I.item); $('iFound').textContent = 'رأيت ما على ظهرها. أُضيف إلى الدفتر.'; sfx('beam'); }
      }
    }
    I.cam.position.set(0, 0, I.zoom); I.cam.lookAt(0, 0, 0);
    I.r.render(I.scene, I.cam);
    I.raf = requestAnimationFrame(inspectLoop);
  }

  // ===== التنقل بين الغرف =====
  function travel(to, instant) {
    if (travel.busy) return;
    travel.busy = true;
    if (panel) closePanel();
    sel = null; renderInv();
    const from = S.room;
    if (!instant) { W.openDoor(from, to, true); sfx('door'); }
    setTimeout(() => {
      $('fade').classList.add('on');
      setTimeout(() => {
        S.room = to;
        W.setRoom(to);
        if (!instant) W.openDoor(from, to, false);
        $('ctSector').textContent = 'SECTOR 0' + to;
        $('ctName').textContent = ROOMS[to].name;
        $('ctSub').textContent = ROOMS[to].sub;
        $('cardTitle').classList.add('on');
        droneFor(to, !!roomSolved(to));
        updateHud(); save();
        setTimeout(() => {
          $('cardTitle').classList.remove('on');
          $('fade').classList.remove('on');
          travel.busy = false;
          if (!S['visited' + to]) { S['visited' + to] = true; firstVisit(to); }
        }, instant ? 900 : 1500);
      }, 750);
    }, instant ? 0 : 450);
  }
  function roomSolved(n) { return S.solved[['', 'clock', 'light', 'archive', 'heart', 'mirror', 'gate'][n]]; }
  function firstVisit(n) {
    const m = {
      1: 'اسحب لتنظر حولك، وانقر على ما يلفت انتباهك. سوارك في المخزون أسفل الشاشة.',
      2: 'ضوء أبيض بارد ينبض فوق طاولة مليئة بالمرايا.',
      3: 'رائحة ورق قديم. بعض هذه الملفات يقول الحقيقة، وبعضها لا.',
      4: 'الأرض تهتز تحت قدميك. الآلة نائمة، لكنها تسمع.',
      5: 'كل شيء هنا معكوس. حتى الكراسي معلّقة بالسقف.',
      6: 'هواء ساكن. حلقة ذهبية ضخمة تنتظر.',
    };
    toast(m[n]);
  }

  // ===== الواجهة العليا =====
  function updateHud() {
    $('sectorLbl').textContent = 'SECTOR 0' + S.room;
    $('roomName').textContent = ROOMS[S.room].name;
    $('goal').textContent = GOALS[stage()];
    $('noteCount').textContent = AR(S.notes.length);
    const reach = { 1: true, 2: S.solved.clock, 3: S.solved.light, 4: S.solved.archive, 5: S.solved.heart, 6: S.solved.mirror };
    $('sectors').innerHTML = [1, 2, 3, 4, 5, 6].map((n) => `<button data-room="${n}" class="${n === S.room ? 'here' : ''} ${roomSolved(n) ? 'done' : ''}" ${reach[n] ? '' : 'disabled'} title="${ROOMS[n].name}" aria-label="${ROOMS[n].name}">0${n}</button>`).join('');
  }

  // ===== تطبيق الحالة المحفوظة على العالم =====
  function applyWorld() {
    const tk = S.taken;
    ZS.PHOTO_IDS.forEach((p) => { if (tk['photo' + p]) W.dyn['photo' + p].visible = false; });
    syncRail();
    if (S.solved.clock) { W.dyn.clock.forward = true; W.dyn.clock.engaged = 5; redrawClockFace(true); W.dyn.vitrine.target = 1; }
    else { W.dyn.clock.engaged = S.clockEngaged; }
    if (tk.crystal) { W.dyn.vitrine.crystal.visible = false; W.setHotEnabled('vitrine', false); }
    syncLaser(false);
    if (S.solved.light) W.dyn.lightVault.target = 1;
    if (tk.light_core) { W.dyn.lightVault.coreLight.visible = false; W.dyn.lightVault.cage.visible = false; W.setHotEnabled('lightVault', false); }
    if (tk.axle) { W.dyn.axle.visible = false; W.setHotEnabled('axle', false); }
    syncTimeline(false);
    if (S.solved.archive) W.dyn.archiveVault.target = 1;
    W.setHeart(S.heart);
    if (tk.heart_core) { W.dyn.heart.core.visible = false; W.setHotEnabled('heartCore', false); }
    syncLock(false);
    W.dyn.shard.visible = !!S.solved.mirror && !tk.shard;
    W.setHotEnabled('shard', !!S.solved.mirror && !tk.shard);
    W.setGate({ sockets: S.gateSockets, sigilCount: S.sigils.length, sigilsDone: !!S.sigilsDone });
    [[1, 2], [2, 3], [3, 4], [4, 5], [5, 6]].forEach(([a, b]) => W.setDoor(a, b, doorOpen(a) ? 'open' : 'locked'));
    [[2, 1], [3, 2], [4, 3], [5, 4], [6, 5]].forEach(([a, b]) => W.setDoor(a, b, 'open'));
  }

  // ===== الشاشات: البداية والمقدمة والنهاية =====
  let fxRaf = 0;
  function titleFx() {
    const cv = $('titleFx'), g = cv.getContext('2d');
    const P = Array.from({ length: 90 }, () => ({ x: Math.random(), y: Math.random(), s: Math.random() * 1.6 + 0.4, v: Math.random() * 0.0004 + 0.0001 }));
    let t = 0;
    const step = () => {
      const w = (cv.width = cv.clientWidth * Math.min(devicePixelRatio, 2)), h = (cv.height = cv.clientHeight * Math.min(devicePixelRatio, 2));
      t += 0.004;
      g.clearRect(0, 0, w, h);
      const cx = w / 2, cy = h / 2, R = Math.min(w, h);
      const grd = g.createRadialGradient(cx, cy, 0, cx, cy, R * 0.6);
      grd.addColorStop(0, 'rgba(180,107,255,.10)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = grd; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(201,162,83,.18)';
      [0.38, 0.44, 0.5].forEach((r, i) => {
        g.lineWidth = i === 1 ? 2 : 1;
        g.beginPath(); g.arc(cx, cy, R * r, t * (i % 2 ? -1 : 1), t * (i % 2 ? -1 : 1) + Math.PI * 1.6); g.stroke();
      });
      for (let i = 0; i < 60; i++) { const a = (i / 60) * Math.PI * 2 + t * 0.5; g.fillStyle = 'rgba(201,162,83,.25)'; g.fillRect(cx + Math.cos(a) * R * 0.44 - 1, cy + Math.sin(a) * R * 0.44 - 1, 2, i % 5 ? 2 : 6); }
      P.forEach((p) => { p.y -= p.v; if (p.y < 0) p.y = 1; g.fillStyle = 'rgba(180,107,255,.5)'; g.beginPath(); g.arc(p.x * w, p.y * h, p.s, 0, 7); g.fill(); });
      fxRaf = requestAnimationFrame(step);
    };
    cancelAnimationFrame(fxRaf);
    fxRaf = requestAnimationFrame(step);
  }
  function showTitle() {
    $('title').hidden = false; $('hud').hidden = $('inv').hidden = $('sectors').hidden = $('brandmark').hidden = true; $('invhint').hidden = true;
    $('btnContinue').hidden = !load();
    titleFx();
    setTimeout(() => $(load() ? 'btnContinue' : 'btnStart').focus(), 100);
  }
  function enterGame(fromSave) {
    cancelAnimationFrame(fxRaf);
    $('title').hidden = true;
    $('hud').hidden = $('inv').hidden = $('sectors').hidden = $('brandmark').hidden = false;
    S._t = Date.now();
    W.setRoom(S.room);
    applyWorld();
    renderInv(); updateHud();
    droneFor(S.room, !!roomSolved(S.room));
    if (!fromSave) firstVisit(1);
    else toast('تابعت من ' + ROOMS[S.room].name + '.');
  }
  function playLines(container, lines, opts, done) {
    const el = $(container);
    el.innerHTML = lines.map((l) => `<p class="${l.cls || ''}">${l.html}</p>`).join('');
    const ps = [...el.children];
    let i = 0, timer = 0, finished = false;
    const finish = () => { if (finished) return; finished = true; clearTimeout(timer); done(); };
    const next = () => {
      if (i >= ps.length) { timer = setTimeout(finish, opts.hold || 1800); return; }
      if (opts.replace && i > 0) ps[i - 1].classList.remove('on');
      ps[i].classList.add('on');
      if (lines[i].sfx) sfx(lines[i].sfx);
      timer = setTimeout(next, lines[i].ms || 2600);
      i++;
    };
    next();
    return { skip: finish, advance: () => { clearTimeout(timer); next(); } };
  }
  function startIntro() {
    audioInit();
    $('title').hidden = true;
    $('intro').hidden = false;
    S = freshState();
    try { localStorage.removeItem(SAVE_KEY); } catch (e) {}
    droneFor(1, false);
    const ctl = playLines('introLines', [
      { html: 'ظلام. ثم طنين كهربائي.', ms: 2400 },
      { html: 'الطاقة تعود على دفعات قصيرة، وكل دفعة تكشف جزءًا من غرفة لا تعرفها.', ms: 3400 },
      { html: 'معصمك يحمل سوارًا معدنيًا لا تتذكر أنك لبسته.', ms: 3000 },
      { html: '«أنت لم تدخل هذه الغرفة للمرة الأولى.»', cls: 'crt', ms: 3400, sfx: 'glitch' },
    ], { hold: 1600 }, () => { $('intro').hidden = true; enterGame(false); save(); });
    $('btnSkip').onclick = () => ctl.skip();
  }
  function startEnding() {
    $('hud').hidden = $('inv').hidden = $('sectors').hidden = $('brandmark').hidden = true; $('invhint').hidden = true;
    sfx('final');
    W.ending(() => {
      $('ending').hidden = false; $('ending').classList.remove('dark');
      setTimeout(() => $('ending').classList.add('dark'), 2500);
      const ctl = playLines('endLines', [
        { html: 'البوابة لا تقود إلى الخارج.', ms: 3000 },
        { html: 'تقود إلى غرفة بيضاء صغيرة: كرسي، وطاولة، ورزمة ملاحظات بخط تعرفه جيدًا. خطّك.', ms: 4400 },
        { html: 'لم يكن أحد يراقبك. غادر الطاقم بعد ختم الأرشيف، وبقيتَ أنت والساعة تدور عكسيًا.', ms: 4600 },
        { html: 'الساعة لم تكن معطوبة. كانت تعيدك إلى البداية كلما فشلت. ستة خدوش على الجدار تعني ست دورات. والسابع رأيته في المرآة لأنك على وشك أن تحفره.', ms: 6200 },
        { html: 'الصور الخمس لم تكن لخمسة أيام، بل ليوم واحد يتكرر. والبيان المزوّر في الأرشيف كُتب ليخفي أن أحدًا بقي في الداخل.', ms: 5600 },
        { html: '«الشخص الذي يعرف قراراتك مسبقًا» لم يكن يتنبأ. <em>كان يتذكر.</em>', ms: 4600 },
        { html: 'تأخذ القلم لتكتب أول ملاحظة للدورة القادمة: «أنت لم تدخل هذه الغرفة للمرة الأولى.» ثم تشطبها، وتكتب تحتها: <em>«هذه المرة، اخرج.»</em>', ms: 6400 },
      ], { replace: true, hold: 2400 }, credits);
      $('btnEndNext').hidden = false;
      $('btnEndNext').onclick = () => ctl.advance();
    });
  }
  function credits() {
    save();
    const mins = Math.max(1, Math.round(S.playMs / 60000));
    $('btnEndNext').hidden = true;
    $('endLines').innerHTML = `<div class="credits"><span class="loop">CYCLE 07 · COMPLETE</span><h1>الملاذ صفر</h1>
      <p class="by">انتهت الدورة السابعة في نحو ${AR(mins)} دقيقة، باستخدام ${AR(S.hintsUsed)} من التلميحات.</p>
      <div class="studio" id="endLogo"></div>
      <p class="by">تصميم وتطوير: أكاديمية ستيم لألعاب العلوم</p>
      <div class="menu"><button class="btn vi" id="btnAgain">ابدأ الدورة الثامنة</button></div></div>`;
    mountLogo($('endLogo'), 'logo.png', LOGO_FULL);
    $('btnAgain').onclick = () => { try { localStorage.removeItem(SAVE_KEY); } catch (e) {} location.reload(); };
  }

  // ===== الأحداث =====
  function bind() {
    W.onHotspot = onHot;
    const tip = $('tip');
    W.onHover = (label) => { tip.hidden = !label; if (label) tip.textContent = label; };
    addEventListener('pointermove', (e) => { tip.style.left = e.clientX + 'px'; tip.style.top = e.clientY + 'px'; });
    $('pClose').onclick = closePanel;
    $('pBody').addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el || !panel || !panel.on || el.disabled) return;
      panel.on(el.dataset.act, el);
    });
    $('inv').addEventListener('click', (e) => { const b = e.target.closest('[data-item]'); if (b) { audioInit(); selectItem(b.dataset.item); } });
    $('inv').addEventListener('dblclick', (e) => { const b = e.target.closest('[data-item]'); if (b) { sel = null; renderInv(); inspect(b.dataset.item); } });
    $('invhint').addEventListener('click', (e) => {
      const a = e.target.closest('[data-ia]'); if (!a) return;
      if (a.dataset.ia === 'inspect') { const it = sel; sel = null; renderInv(); inspect(it); }
      else { sel = null; renderInv(); }
    });
    $('sectors').addEventListener('click', (e) => { const b = e.target.closest('[data-room]'); if (b && !b.disabled && +b.dataset.room !== S.room) travel(+b.dataset.room, true); });
    $('iClose').onclick = closeInspect;
    $('iFlip').onclick = () => { I.try_ += Math.PI; sfx('click'); };
    $('iReset').onclick = () => { I.trx = 0.15; I.try_ = -0.5; I.tzoom = 2.6; };
    $('btnNotes').onclick = () => { audioInit(); panel && panel.title === 'دفتر الأدلة' ? closePanel() : notesPanel(); };
    $('btnHint').onclick = () => { audioInit(); panel && panel.title === 'تلميحات' ? closePanel() : hintPanel(); };
    $('btnMenu').onclick = () => (panel && panel.title === 'القائمة' ? closePanel() : menuPanel());
    $('btnSound').onclick = () => { audioInit(); setMuted(!A.muted); };
    $('btnStart').onclick = startIntro;
    $('btnContinue').onclick = () => { audioInit(); const s = load(); if (s) { S = Object.assign(freshState(), s); enterGame(true); } };
    addEventListener('keydown', (e) => {
      if (!$('title').hidden || !$('intro').hidden || !$('ending').hidden) return;
      if (e.key === 'Escape') { if (!$('inspect').hidden) closeInspect(); else if (panel) closePanel(); else if (sel) { sel = null; renderInv(); } }
      if (e.target.closest('input')) return;
      if (e.key === 'n' || e.key === 'N' || e.key === 'ى') { panel && panel.title === 'دفتر الأدلة' ? closePanel() : notesPanel(); }
      if (e.key === 'h' || e.key === 'H' || e.key === 'ا') { panel && panel.title === 'تلميحات' ? closePanel() : hintPanel(); }
      if (e.key === 'ArrowLeft') W.nudge(0.25);
      if (e.key === 'ArrowRight') W.nudge(-0.25);
    });
    addEventListener('beforeunload', save);
    document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
  }

  // ===== البدء =====
  async function boot() {
    try { A.muted = localStorage.getItem('zero-sanctum-muted') === '1'; } catch (e) {}
    $('soundWaves').style.opacity = A.muted ? 0.15 : 1;
    mountLogo($('studioLogo'), 'logo.png', LOGO_FULL);
    mountLogo($('brandmark'), 'logo-mark.png', LOGO_MARK);
    showTitle();
    // ننتظر الخطوط قليلًا كي تُرسم النصوص داخل المشهد بالخط الصحيح
    await Promise.race([document.fonts ? document.fonts.ready : Promise.resolve(), new Promise((r) => setTimeout(r, 2500))]);
    W.init($('scene'));
    redrawClockFace(false);
    applyWorld();
    bind();
    try { W.precompile(); } catch (e) { /* التجميع المسبق تحسين فقط */ }
    // للاختبار الآلي فقط
    window.__ZS_GAME = { get state() { return S; }, onHot, travel, inspect, useItem, panelOn: (a, el) => panel && panel.on(a, el || { dataset: {} }) };
  }
  boot();
})();
