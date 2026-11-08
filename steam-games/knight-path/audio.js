/* ===============================================================
   فارس الدرب — الصوت (مولّد بالكامل عبر WebAudio، بلا ملفات)
   موسيقى على المقامات العربية بأرباع الأصوات الحقيقية:
     حجاز للمغامرة والمبارزة، بياتي للمدن والخريطة، راست للنهاية.
   - عود وقانون بتركيب «الوتر المنقور» (موجات + مرشّح متحرك)
   - ناي بنَفَس واهتزاز طبيعي
   - دربكة على إيقاع المقسوم، ودفّ للمبارزات الكبرى
   =============================================================== */
(function (root) {
  'use strict';

  var ctx = null, master, musicBus, sfxBus, reverb;
  var musicOn = true, sfxOn = true;
  var scene = 'menu';
  var nextBeat = 0, beatIdx = 0, nextPhrase = 0, droneNodes = null;
  var noiseBuf = null;

  // المقامات بالسنت من القرار (الربع تون = 50 سنت)
  var MAQAM = {
    hijaz: [0, 100, 400, 500, 700, 800, 1000, 1200],
    bayati: [0, 150, 300, 500, 700, 800, 1000, 1200],
    rast: [0, 200, 350, 500, 700, 900, 1050, 1200],
    nahawand: [0, 200, 300, 500, 700, 800, 1100, 1200],
  };
  // ما يُعزف في كل مشهد
  var SCENES = {
    menu: { maqam: 'bayati', root: 146.83, bpm: 72, drum: null, lead: 'ney', density: 0.5 },
    map: { maqam: 'bayati', root: 146.83, bpm: 76, drum: 'soft', lead: 'oud', density: 0.6 },
    travel: { maqam: 'hijaz', root: 146.83, bpm: 112, drum: 'maqsum', lead: 'oud', density: 0.85 },
    duel: { maqam: 'hijaz', root: 146.83, bpm: 104, drum: 'maqsum', lead: 'qanun', density: 0.6 },
    boss: { maqam: 'hijaz', root: 130.81, bpm: 120, drum: 'boss', lead: 'oud', density: 0.75 },
    wisdom: { maqam: 'rast', root: 130.81, bpm: 70, drum: null, lead: 'ney', density: 0.45 },
    victory: { maqam: 'rast', root: 130.81, bpm: 96, drum: 'soft', lead: 'qanun', density: 0.8 },
    finale: { maqam: 'rast', root: 130.81, bpm: 66, drum: null, lead: 'ney', density: 0.5 },
    silent: null,
  };

  function cents(rootHz, c) { return rootHz * Math.pow(2, c / 1200); }

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9;
    var comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3.5;
    master.connect(comp).connect(ctx.destination);
    reverb = ctx.createConvolver(); reverb.buffer = impulse(2.6, 2.4);
    var rv = ctx.createGain(); rv.gain.value = 0.32; reverb.connect(rv).connect(master);
    musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
    var ms = ctx.createGain(); ms.gain.value = 0.7; musicBus.connect(ms).connect(reverb);
    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? 0.85 : 0; sfxBus.connect(master);
    var ss = ctx.createGain(); ss.gain.value = 0.25; sfxBus.connect(ss).connect(reverb);
    noiseBuf = makeNoise(1.5);
    setMusic(musicOn);
    nextBeat = nextPhrase = ctx.currentTime + 0.2;
    setInterval(schedule, 100);
  }

  function impulse(sec, decay) {
    var len = Math.floor(ctx.sampleRate * sec);
    var b = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) { var d = b.getChannelData(c); for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); }
    return b;
  }
  function makeNoise(sec) {
    var len = Math.floor(ctx.sampleRate * sec);
    var b = ctx.createBuffer(1, len, ctx.sampleRate); var d = b.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }

  // ------------------------------------------------------------------
  // الآلات
  // ------------------------------------------------------------------
  /** وتر منقور (عود/قانون): موجتان مع مرشّح يُغلق بسرعة كأن الريشة ضربت الوتر */
  function pluck(t, freq, vol, bright, bus, len) {
    var dur = len || 1.4;
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = bright ? 2 : 4;
    lp.frequency.setValueAtTime(Math.min(9000, freq * (bright ? 14 : 8)), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(200, freq * (bright ? 2.5 : 1.6)), t + dur * 0.5);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol * 0.32, t + 0.004);
    g.gain.exponentialRampToValueAtTime(vol * 0.12, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    var o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = freq;
    var o2 = ctx.createOscillator(); o2.type = bright ? 'square' : 'triangle'; o2.frequency.value = freq; o2.detune.value = bright ? 7 : -6;
    var g2 = ctx.createGain(); g2.gain.value = 0.6;
    // جسم العود الخشبي
    var body = ctx.createBiquadFilter(); body.type = 'peaking'; body.frequency.value = bright ? 2400 : 320; body.gain.value = 6; body.Q.value = 1.2;
    o1.connect(lp); o2.connect(g2).connect(lp);
    lp.connect(body).connect(g).connect(bus || musicBus);
    o1.start(t); o2.start(t); o1.stop(t + dur + 0.05); o2.stop(t + dur + 0.05);
    // لمسة الريشة
    var n = ctx.createBufferSource(); n.buffer = noiseBuf;
    var hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 3000;
    var ng = ctx.createGain(); ng.gain.setValueAtTime(vol * 0.12, t); ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
    n.connect(hp).connect(ng).connect(bus || musicBus); n.start(t, Math.random()); n.stop(t + 0.03);
  }

  /** ناي: موجة ناعمة + اهتزاز + نَفَس */
  function ney(t, freq, dur, vol) {
    var o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = freq;
    var o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = freq * 2;
    var vib = ctx.createOscillator(); vib.frequency.value = 5.2; var vg = ctx.createGain(); vg.gain.value = freq * 0.012;
    vib.connect(vg); vg.connect(o.frequency); vg.connect(o2.frequency);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(vol, t + Math.min(0.25, dur * 0.3));
    g.gain.setValueAtTime(vol * 0.9, t + dur * 0.8); g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.15);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    var g2 = ctx.createGain(); g2.gain.value = 0.25;
    o.connect(lp); o2.connect(g2).connect(lp); lp.connect(g).connect(musicBus);
    // النَّفَس
    var n = ctx.createBufferSource(); n.buffer = noiseBuf;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq * 2; bp.Q.value = 3;
    var ng = ctx.createGain(); ng.gain.setValueAtTime(0.0001, t); ng.gain.linearRampToValueAtTime(vol * 0.35, t + 0.08); ng.gain.linearRampToValueAtTime(0.0001, t + dur);
    n.connect(bp).connect(ng).connect(musicBus);
    [o, o2, vib].forEach(function (x) { x.start(t); x.stop(t + dur + 0.3); });
    n.start(t, Math.random()); n.stop(t + dur + 0.1);
  }

  function dum(t, vol, bus) {
    var o = ctx.createOscillator(); o.type = 'sine';
    o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.25);
    var g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
    o.connect(g).connect(bus || musicBus); o.start(t); o.stop(t + 0.4);
  }
  function tak(t, vol, freq, bus) {
    var n = ctx.createBufferSource(); n.buffer = noiseBuf;
    var bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = freq || 3200; bp.Q.value = 1.4;
    var g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.07);
    n.connect(bp).connect(g).connect(bus || musicBus); n.start(t, Math.random()); n.stop(t + 0.09);
    var o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = (freq || 3200) / 8;
    var g2 = ctx.createGain(); g2.gain.setValueAtTime(vol * 0.5, t); g2.gain.exponentialRampToValueAtTime(0.001, t + 0.05);
    o.connect(g2).connect(bus || musicBus); o.start(t); o.stop(t + 0.06);
  }
  function frame(t, vol) { // دفّ/بندير منخفض
    var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(70, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.4);
    var g = ctx.createGain(); g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.55);
    o.connect(g).connect(musicBus); o.start(t); o.stop(t + 0.6);
    tak(t, vol * 0.35, 900);
  }

  function startDrone(cfg) {
    stopDrone();
    if (!cfg) return;
    var g = ctx.createGain(); g.gain.value = 0; g.gain.linearRampToValueAtTime(0.045, ctx.currentTime + 2);
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500;
    var oscs = [cfg.root / 2, cfg.root / 2 * 1.5, cfg.root].map(function (f, i) {
      var o = ctx.createOscillator(); o.type = i === 2 ? 'sine' : 'sawtooth'; o.frequency.value = f; o.detune.value = (i - 1) * 4;
      var og = ctx.createGain(); og.gain.value = i === 2 ? 0.5 : 0.3;
      o.connect(og).connect(lp); o.start();
      return o;
    });
    lp.connect(g).connect(musicBus);
    droneNodes = { g: g, oscs: oscs };
  }
  function stopDrone() {
    if (!droneNodes) return;
    var d = droneNodes; droneNodes = null;
    d.g.gain.cancelScheduledValues(ctx.currentTime);
    d.g.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
    setTimeout(function () { d.oscs.forEach(function (o) { try { o.stop(); } catch (e) { /* */ } }); }, 2500);
  }

  // ------------------------------------------------------------------
  // المؤلّف: جمل لحنية بالمقام، حركة متدرجة، وقفلات على القرار
  // ------------------------------------------------------------------
  var deg = 0;
  function phrase(cfg, t) {
    var sc = MAQAM[cfg.maqam];
    var beat = 60 / cfg.bpm;
    var n = 4 + Math.floor(Math.random() * 4);
    var tt = t;
    var oct = cfg.lead === 'ney' ? 2 : cfg.lead === 'qanun' ? 2 : 1;
    for (var i = 0; i < n; i++) {
      // حركة متدرجة غالباً، وقفزات قليلة
      var step = Math.random() < 0.75 ? (Math.random() < 0.5 ? -1 : 1) : (Math.random() < 0.5 ? -2 : 2);
      deg = Math.max(0, Math.min(10, deg + step));
      if (i === n - 1) deg = Math.random() < 0.6 ? 0 : 4; // قفلة على القرار أو الخامسة
      var c = sc[deg % 7] + 1200 * Math.floor(deg / 7);
      var f = cents(cfg.root * oct, c);
      var durBeats = [0.5, 0.5, 1, 1, 1.5, 2][Math.floor(Math.random() * 6)];
      if (i === n - 1) durBeats = 2;
      var d = durBeats * beat;
      if (cfg.lead === 'ney') ney(tt, f, d * 0.95, 0.07);
      else {
        pluck(tt, f, 0.5, cfg.lead === 'qanun', null, Math.max(1, d * 1.6));
        // زخرفة: نقرة مكرّرة سريعة كالريشة على العود
        if (durBeats >= 1 && Math.random() < 0.35) pluck(tt + beat * 0.25, f, 0.3, cfg.lead === 'qanun');
      }
      tt += d;
    }
    // تهدئة بين الجمل
    return tt + beat * (cfg.density > 0.7 ? 0.5 : 2);
  }

  // المقسوم: دُم تَك - تَك دُم - تَك -
  var MAQSUM = ['D', 'T', '', 'T', 'D', '', 'T', ''];
  var BOSS = ['D', 'k', 'T', 'k', 'D', 'D', 'T', 'k'];
  var SOFT = ['D', '', '', 'k', '', '', 'T', ''];

  function schedule() {
    if (!ctx || ctx.state !== 'running') return;
    var cfg = SCENES[scene];
    var ahead = ctx.currentTime + 0.4;
    if (!cfg || !musicOn) { nextBeat = nextPhrase = ctx.currentTime + 0.2; return; }
    var eighth = 60 / cfg.bpm / 2;
    while (nextBeat < ahead) {
      var pat = cfg.drum === 'maqsum' ? MAQSUM : cfg.drum === 'boss' ? BOSS : cfg.drum === 'soft' ? SOFT : null;
      if (pat) {
        var s = pat[beatIdx % 8];
        var v = cfg.drum === 'soft' ? 0.5 : 1;
        if (s === 'D') dum(nextBeat, 0.5 * v);
        else if (s === 'T') tak(nextBeat, 0.22 * v, 3000);
        else if (s === 'k') tak(nextBeat, 0.1 * v, 4200);
        if (cfg.drum === 'boss' && beatIdx % 16 === 0) frame(nextBeat, 0.5);
      }
      // نقرة عود منخفضة تثبّت الإيقاع في الرحلة والمبارزة
      if ((cfg.drum === 'maqsum' || cfg.drum === 'boss') && beatIdx % 4 === 0) {
        pluck(nextBeat, cents(cfg.root / 2, MAQAM[cfg.maqam][beatIdx % 8 === 0 ? 0 : 4]), 0.35, false, null, 0.8);
      }
      beatIdx++;
      nextBeat += eighth;
    }
    if (nextPhrase < ahead) nextPhrase = phrase(cfg, Math.max(nextPhrase, ctx.currentTime + 0.05));
  }

  function setScene(name) {
    if (scene === name) return;
    scene = name;
    if (!ctx) return;
    var cfg = SCENES[name];
    deg = 0;
    beatIdx = 0;
    nextBeat = nextPhrase = ctx.currentTime + 0.3;
    if (musicOn) startDrone(cfg); else stopDrone();
  }

  function setMusic(on) {
    musicOn = on;
    if (!ctx) return;
    musicBus.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, on ? 0.8 : 0.2);
    if (on) startDrone(SCENES[scene]); else stopDrone();
  }
  function setSfx(on) { sfxOn = on; if (ctx) sfxBus.gain.setTargetAtTime(on ? 0.85 : 0, ctx.currentTime, 0.05); }

  // ------------------------------------------------------------------
  // المؤثرات
  // ------------------------------------------------------------------
  function now(d) { return ctx.currentTime + (d || 0); }
  function noise(t, dur, type, f0, f1, vol, q) {
    var n = ctx.createBufferSource(); n.buffer = noiseBuf;
    var f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q || 1;
    f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur);
    var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.15); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f).connect(g).connect(sfxBus); n.start(t, Math.random()); n.stop(t + dur + 0.05);
  }
  function tone(t, f, dur, type, vol, f2) {
    var o = ctx.createOscillator(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
    var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(sfxBus); o.start(t); o.stop(t + dur + 0.05);
  }
  function metal(t, vol) {
    [1, 1.47, 2.09, 2.76, 3.9].forEach(function (k, i) { tone(t, 980 * k, 0.9 - i * 0.12, 'sine', vol / (i + 1.5)); });
  }

  var SFX = {
    click: function () { tak(now(), 0.25, 3500, sfxBus); },
    page: function () { noise(now(), 0.25, 'bandpass', 2500, 1200, 0.12, 0.8); },
    gallop: function () { var t = now(); [0, 0.09, 0.22, 0.31].forEach(function (d) { tak(t + d, 0.22, 900, sfxBus); dum(t + d, 0.06, sfxBus); }); },
    jump: function () { noise(now(), 0.28, 'bandpass', 600, 2200, 0.15, 1.2); tone(now(), 300, 0.2, 'sine', 0.06, 600); },
    land: function () { dum(now(), 0.25, sfxBus); tak(now(), 0.15, 700, sfxBus); },
    collect: function () { var t = now(); pluck(t, 880, 0.5, true, sfxBus, 0.6); pluck(t + 0.07, 1318, 0.4, true, sfxBus, 0.6); },
    water: function () { var t = now(); for (var i = 0; i < 4; i++) tone(t + i * 0.05, 600 + i * 220, 0.08, 'sine', 0.06, 900 + i * 260); },
    stumble: function () { dum(now(), 0.4, sfxBus); noise(now(), 0.3, 'lowpass', 900, 200, 0.2); },
    unsheathe: function () { noise(now(), 0.45, 'highpass', 2000, 7000, 0.12, 0.7); metal(now(0.3), 0.05); },
    slash: function () { noise(now(), 0.22, 'bandpass', 5000, 900, 0.3, 0.9); },
    clang: function () { metal(now(), 0.14); dum(now(), 0.2, sfxBus); },
    crit: function () { SFX.slash(); metal(now(0.08), 0.2); tone(now(0.08), 160, 0.5, 'sawtooth', 0.08, 60); },
    spell: function () { var t = now(); noise(t, 0.7, 'bandpass', 400, 3000, 0.16, 3); tone(t, 220, 0.7, 'sawtooth', 0.04, 880); tone(t, 330, 0.7, 'triangle', 0.05, 1320); },
    hurt: function () { dum(now(), 0.5, sfxBus); noise(now(), 0.25, 'lowpass', 1200, 200, 0.2); },
    correct: function () { var t = now(); [0, 400, 700, 1200].forEach(function (c, i) { pluck(t + i * 0.06, cents(293.66, c), 0.55, true, sfxBus, 0.9); }); },
    wrong: function () { var t = now(); pluck(t, cents(146.83, 100), 0.6, false, sfxBus, 0.8); pluck(t + 0.12, 146.83, 0.6, false, sfxBus, 0.9); },
    tick: function () { tak(now(), 0.12, 5200, sfxBus); },
    falcon: function () { var t = now(); tone(t, 2400, 0.35, 'sine', 0.08, 1500); tone(t + 0.3, 2600, 0.5, 'sine', 0.07, 1300); noise(t, 0.6, 'bandpass', 1800, 900, 0.05, 2); },
    shield: function () { metal(now(), 0.1); tone(now(), 500, 0.6, 'sine', 0.06, 900); },
    heal: function () { var t = now(); [0, 200, 350, 700].forEach(function (c, i) { tone(t + i * 0.08, cents(523.25, c), 0.5, 'sine', 0.07); }); },
    freeze: function () { noise(now(), 0.8, 'bandpass', 3000, 6000, 0.08, 4); tone(now(), 1400, 0.8, 'sine', 0.05, 2000); },
    phase: function () { var t = now(); frame(t, 0.9); noise(t, 1.2, 'lowpass', 200, 3000, 0.2); tone(t, 80, 1.2, 'sawtooth', 0.08, 40); },
    defeat: function () { var t = now(); noise(t, 1.2, 'bandpass', 3000, 200, 0.25, 2); [0, 100, 400, 700].forEach(function (c, i) { pluck(t + 0.3 + i * 0.12, cents(293.66, c), 0.5, true, sfxBus, 1.2); }); },
    lose: function () { var t = now(); [700, 500, 400, 100, 0].forEach(function (c, i) { pluck(t + i * 0.16, cents(146.83, c), 0.5, false, sfxBus, 1); }); },
    stamp: function () { dum(now(), 0.7, sfxBus); tak(now(0.02), 0.3, 1500, sfxBus); },
    fanfare: function () { var t = now(); [0, 200, 350, 500, 700, 900, 1200].forEach(function (c, i) { pluck(t + i * 0.09, cents(261.63, c), 0.55, true, sfxBus, 1.2); }); for (var k = 0; k < 8; k++) tak(t + k * 0.06, 0.12, 3000, sfxBus); dum(t + 0.7, 0.6, sfxBus); },
    wind: function () { noise(now(), 1.6, 'bandpass', 300, 1200, 0.12, 0.6); },
    sand: function () { noise(now(), 1.2, 'highpass', 2000, 6000, 0.07, 0.5); },
  };

  function play(name) { if (!ctx || !sfxOn || !SFX[name]) return; try { SFX[name](); } catch (e) { /* */ } }

  root.KnightAudio = { init: init, play: play, setScene: setScene, setMusic: setMusic, setSfx: setSfx };
})(window);
