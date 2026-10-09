'use strict';
// أصوات «المؤمن الصغير»: كلها مولَّدة في المتصفح (Web Audio) دون ملفات خارجية.
// الخلفية على طريقة الأناشيد: إيقاع دفّ (مقسوم) وهمهمة صوتية على مقام الحجاز، بلا آلات موسيقية.

const Sound = (() => {
  let ctx = null, master, musicBus, sfxBus, noiseBuf;
  let musicOn = true, sfxOn = true, running = false;
  let timer = null, nextTime = 0, eighth = 0, drone = null;

  try {
    const saved = JSON.parse(localStorage.getItem('moumen-sound') || '{}');
    if (typeof saved.music === 'boolean') musicOn = saved.music;
    if (typeof saved.sfx === 'boolean') sfxOn = saved.sfx;
  } catch (e) { /* التخزين غير متاح */ }
  function save() {
    try { localStorage.setItem('moumen-sound', JSON.stringify({ music: musicOn, sfx: sfxOn })); } catch (e) { /* تجاهل */ }
  }

  // يُستدعى من ضغطة المستخدم، فالمتصفحات لا تسمح بالصوت قبلها
  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ctx = new AC();
      master = ctx.createGain(); master.gain.value = .9; master.connect(ctx.destination);
      musicBus = ctx.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
      sfxBus = ctx.createGain(); sfxBus.gain.value = .55; sfxBus.connect(master);
      noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return true;
  }

  // ───── أدوات صغيرة ─────
  function env(g, t, peak, a, d) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
  }
  function tone(bus, t, freq, dur, { type = 'sine', vol = .3, a = .01, slideTo } = {}) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    env(g, t, vol, a, dur);
    o.connect(g); g.connect(bus);
    o.start(t); o.stop(t + a + dur + .05);
  }
  function noise(bus, t, dur, { vol = .3, type = 'bandpass', f = 1000, q = 1, fTo, a = .005 } = {}) {
    const s = ctx.createBufferSource(), flt = ctx.createBiquadFilter(), g = ctx.createGain();
    s.buffer = noiseBuf; s.loop = true;
    flt.type = type; flt.frequency.setValueAtTime(f, t); flt.Q.value = q;
    if (fTo) flt.frequency.exponentialRampToValueAtTime(fTo, t + dur);
    env(g, t, vol, a, dur);
    s.connect(flt); flt.connect(g); g.connect(bus);
    s.start(t, Math.random() * .5); s.stop(t + a + dur + .05);
  }

  // ───── الدفّ ─────
  function dum(t, vol = .55) {
    tone(musicBus, t, 120, .32, { vol, slideTo: 58 });
    noise(musicBus, t, .08, { vol: vol * .35, type: 'lowpass', f: 600 });
  }
  function tek(t, vol = .22) {
    noise(musicBus, t, .05, { vol, type: 'bandpass', f: 2600, q: 1.2 });
    noise(musicBus, t + .004, .14, { vol: vol * .45, type: 'highpass', f: 7000 }); // صنوج الدف
  }

  // ───── الهمهمة (صوت بشري تقريبي «أووو») ─────
  function hum(t, freq, dur, vol = .16) {
    const g = ctx.createGain();
    const f1 = ctx.createBiquadFilter(); f1.type = 'bandpass'; f1.frequency.value = 320; f1.Q.value = 3;
    const f2 = ctx.createBiquadFilter(); f2.type = 'bandpass'; f2.frequency.value = 820; f2.Q.value = 5;
    const f2g = ctx.createGain(); f2g.gain.value = .45;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1600;
    const vib = ctx.createOscillator(), vibG = ctx.createGain();
    vib.frequency.value = 5.2; vibG.gain.value = freq * .007;
    vib.connect(vibG);
    const oscs = [['sawtooth', 1], ['triangle', 1.004], ['sawtooth', .997]].map(([type, k]) => {
      const o = ctx.createOscillator(); o.type = type; o.frequency.value = freq * k;
      vibG.connect(o.frequency); o.connect(f1); o.connect(f2);
      return o;
    });
    f1.connect(lp); f2.connect(f2g); f2g.connect(lp); lp.connect(g); g.connect(musicBus);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + .09);
    g.gain.setValueAtTime(vol, t + Math.max(.1, dur - .05));
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur + .18);
    const end = t + dur + .25;
    vib.start(t); vib.stop(end);
    oscs.forEach(o => { o.start(t); o.stop(end); });
  }

  // مقام الحجاز على «ري»
  const D4 = 293.66;
  const H = { D: D4, Eb: D4 * 16 / 15, Fs: D4 * 5 / 4, G: D4 * 4 / 3, A: D4 * 3 / 2, Bb: D4 * 8 / 5, C: D4 * 16 / 9, D5: D4 * 2 };
  const PHRASES = [
    [['A', 2], ['G', 1], ['Fs', 1], ['G', 2], ['A', 2], ['Bb', 2], ['A', 1], ['G', 1], ['Fs', 4]],
    [['G', 2], ['Fs', 1], ['Eb', 1], ['Fs', 2], ['G', 2], ['Fs', 2], ['Eb', 1], ['D', 1], ['D', 4]],
    [['D', 1], ['Fs', 1], ['A', 2], ['Bb', 2], ['C', 2], ['Bb', 2], ['A', 2], ['G', 4]],
    [['A', 2], ['G', 1], ['Fs', 1], ['Eb', 2], ['Fs', 2], ['G', 2], ['Fs', 1], ['Eb', 1], ['D', 4]],
  ];
  // جدول النغمات: كل عبارة مقياسان (16 ثُمناً)، ثم مقياسان للدفّ وحده
  const MELODY = new Map();
  let pos = 0;
  for (const ph of PHRASES) for (const [n, len] of ph) { MELODY.set(pos, [H[n], len]); pos += len; }
  const LOOP = pos + 16;
  // الإيقاع المقسوم: دُم تَك - تَك دُم - تَك -
  const RHYTHM = ['D', 'T', null, 'T', 'D', null, 'T', null];
  const BPM = 88, E = 60 / BPM / 2;

  function startDrone() {
    const g = ctx.createGain(); g.gain.value = 0;
    g.gain.setTargetAtTime(.05, ctx.currentTime, 1.5);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420;
    const breath = ctx.createOscillator(), bg = ctx.createGain();
    breath.frequency.value = .11; bg.gain.value = .02; breath.connect(bg); bg.connect(g.gain);
    const oscs = [D4 / 2, D4 / 2 * 1.003, D4 * 3 / 8].map(f => {
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.connect(lp); return o;
    });
    lp.connect(g); g.connect(musicBus);
    breath.start(); oscs.forEach(o => o.start());
    drone = { stop() { const t = ctx.currentTime; g.gain.setTargetAtTime(0, t, .3); breath.stop(t + 1.5); oscs.forEach(o => o.stop(t + 1.5)); } };
  }

  function schedule() {
    while (nextTime < ctx.currentTime + .3) {
      const i = eighth % LOOP, b = i % 8;
      const r = RHYTHM[b];
      if (r === 'D') dum(nextTime, b === 0 ? .6 : .45);
      if (r === 'T') tek(nextTime, b === 3 ? .2 : .16);
      const m = MELODY.get(i);
      if (m) hum(nextTime, m[0], m[1] * E * .94);
      nextTime += E; eighth++;
    }
  }

  function startMusic() {
    if (running || !musicOn || !ensure()) return;
    running = true;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setTargetAtTime(.5, ctx.currentTime, .6);
    nextTime = ctx.currentTime + .15; eighth = 0;
    startDrone();
    timer = setInterval(schedule, 60);
    schedule();
  }
  function stopMusic() {
    if (!running) return;
    running = false;
    clearInterval(timer); timer = null;
    musicBus.gain.setTargetAtTime(0, ctx.currentTime, .25);
    if (drone) { drone.stop(); drone = null; }
  }

  // ───── المؤثرات ─────
  const FX = {
    click(t) { tone(sfxBus, t, 900, .05, { type: 'triangle', vol: .12 }); },
    dice(t) {
      for (let i = 0; i < 9; i++) noise(sfxBus, t + i * .065 + Math.random() * .02, .035, { vol: .35, f: 1800 + Math.random() * 1500, q: 3 });
      tone(sfxBus, t + .6, 180, .1, { type: 'triangle', vol: .25, slideTo: 120 });
    },
    step(t) {
      tone(sfxBus, t, 520, .06, { type: 'triangle', vol: .16, slideTo: 380 });
      noise(sfxBus, t, .03, { vol: .08, f: 3000, q: 2 });
    },
    card(t) { noise(sfxBus, t, .32, { vol: .22, f: 400, fTo: 3500, q: .8, a: .05 }); },
    correct(t) {
      [H.D * 2, H.Fs * 2, H.A * 2].forEach((f, i) => tone(sfxBus, t + i * .09, f, .35, { type: 'sine', vol: .22 }));
      tone(sfxBus, t + .27, H.D5 * 2, .6, { type: 'triangle', vol: .12 });
    },
    wrong(t) {
      tone(sfxBus, t, 330, .22, { type: 'triangle', vol: .2, slideTo: 300 });
      tone(sfxBus, t + .2, 262, .4, { type: 'triangle', vol: .2, slideTo: 220 });
    },
    ladder(t) { [H.D, H.Fs, H.G, H.A, H.Bb, H.D5].forEach((f, i) => tone(sfxBus, t + i * .08, f * 2, .18, { type: 'triangle', vol: .17 })); },
    tornado(t) {
      noise(sfxBus, t, 1.1, { vol: .35, f: 300, fTo: 1800, q: 4, a: .3 });
      noise(sfxBus, t + .5, .8, { vol: .25, f: 1600, fTo: 250, q: 4, a: .1 });
      tone(sfxBus, t + .2, 600, .9, { type: 'sine', vol: .08, slideTo: 180 });
    },
    treasure(t) {
      [H.A, H.C, H.D5, H.Fs * 2, H.A * 2].forEach((f, i) => tone(sfxBus, t + i * .07, f * 2, .5, { type: 'sine', vol: .14 }));
      for (let i = 0; i < 6; i++) tone(sfxBus, t + .35 + i * .05, 3000 + Math.random() * 2500, .12, { vol: .05 });
    },
    bonus(t) { tone(sfxBus, t, H.A * 2, .15, { type: 'triangle', vol: .18 }); tone(sfxBus, t + .1, H.D5 * 2, .3, { type: 'triangle', vol: .18 }); },
    back(t) { [H.A, H.G, H.Fs, H.Eb].forEach((f, i) => tone(sfxBus, t + i * .09, f, .16, { type: 'triangle', vol: .16 })); },
    win(t) {
      const tune = [['D', 1], ['Fs', 1], ['A', 1], ['D5', 2], ['C', 1], ['Bb', 1], ['A', 3]];
      let x = 0;
      tune.forEach(([n, l]) => { tone(sfxBus, t + x * .16, H[n] * 2, l * .16 + .2, { type: 'triangle', vol: .2 }); x += l; });
      for (let i = 0; i < 10; i++) noise(sfxBus, t + i * .08, .07, { vol: .18, f: 2600, q: 1.2 });
      tone(sfxBus, t, 120, .4, { vol: .5, slideTo: 58 });
      tone(sfxBus, t + x * .16, 120, .5, { vol: .5, slideTo: 58 });
    },
  };

  return {
    // أول تفاعل للمستخدم: تهيئة الصوت وبدء الخلفية إن كانت مفعّلة
    unlock() { if (ensure() && musicOn) startMusic(); },
    sfx(name) {
      if (!sfxOn || !FX[name] || !ensure()) return;
      try { FX[name](ctx.currentTime + .01); } catch (e) { /* لا نوقف اللعبة بسبب الصوت */ }
    },
    toggleMusic() { musicOn = !musicOn; save(); musicOn ? startMusic() : stopMusic(); return musicOn; },
    toggleSfx() { sfxOn = !sfxOn; save(); if (sfxOn) this.sfx('click'); return sfxOn; },
    get musicOn() { return musicOn; },
    get sfxOn() { return sfxOn; },
  };
})();
