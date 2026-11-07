/* ===============================================================
   غابة الحياة — الصوت (مولّد بالكامل عبر WebAudio، بلا ملفات)
   - موسيقى خلفية هادئة: أوتار ناعمة + أجراس خماسية مع صدى
   - أصوات الطبيعة: ريح، مطر، زقزقة طيور نهاراً، صرصور الليل
   - مؤثرات اللعب
   =============================================================== */
(function (root) {
  'use strict';

  var ctx = null;
  var master, musicBus, sfxBus, ambBus, reverb, reverbSend;
  var musicOn = true;
  var sfxOn = true;
  var started = false;
  var env = { night: false, raining: 0, birds: 0, life: 0 };
  var noiseBuf = null;
  var rainGain, windGain;
  var nextChordAt = 0, chordIdx = 0, nextChimeAt = 0, nextBirdAt = 0, nextCricketAt = 0;

  // نغمات (هرتز)
  function hz(n) { return 440 * Math.pow(2, (n - 69) / 12); } // n = رقم MIDI
  // تتابع هادئ: Fmaj7 → C/E → Am7 → G6
  var CHORDS = [[53, 57, 60, 64], [52, 55, 59, 64], [45, 52, 55, 60], [43, 50, 55, 59]];
  var PENTA = [72, 74, 76, 79, 81, 84, 86, 88]; // C D E G A (خماسي)

  function init() {
    if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
    var AC = root.AudioContext || root.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain(); master.gain.value = 0.9;
    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -18; comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);

    reverb = ctx.createConvolver();
    reverb.buffer = impulse(3.2, 2.6);
    var revOut = ctx.createGain(); revOut.gain.value = 0.55;
    reverb.connect(revOut).connect(master);

    musicBus = ctx.createGain(); musicBus.gain.value = 0;
    musicBus.connect(master);
    reverbSend = ctx.createGain(); reverbSend.gain.value = 0.9;
    musicBus.connect(reverbSend).connect(reverb);

    sfxBus = ctx.createGain(); sfxBus.gain.value = sfxOn ? 0.75 : 0;
    sfxBus.connect(master);
    var sfxRev = ctx.createGain(); sfxRev.gain.value = 0.25;
    sfxBus.connect(sfxRev).connect(reverb);

    ambBus = ctx.createGain(); ambBus.gain.value = sfxOn ? 0.8 : 0;
    ambBus.connect(master);

    noiseBuf = makeNoise(2);
    // الريح: ضجيج منخفض يتنفّس ببطء
    var wind = loopNoise(); var wf = ctx.createBiquadFilter(); wf.type = 'lowpass'; wf.frequency.value = 380;
    windGain = ctx.createGain(); windGain.gain.value = 0.018;
    var lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; var lfoG = ctx.createGain(); lfoG.gain.value = 0.012;
    lfo.connect(lfoG).connect(windGain.gain); lfo.start();
    wind.connect(wf).connect(windGain).connect(ambBus);
    // المطر
    var rain = loopNoise(); var rf = ctx.createBiquadFilter(); rf.type = 'bandpass'; rf.frequency.value = 1500; rf.Q.value = 0.6;
    var rh = ctx.createBiquadFilter(); rh.type = 'highpass'; rh.frequency.value = 500;
    rainGain = ctx.createGain(); rainGain.gain.value = 0;
    rain.connect(rf).connect(rh).connect(rainGain).connect(ambBus);

    started = true;
    nextChordAt = ctx.currentTime + 0.3;
    nextChimeAt = ctx.currentTime + 2;
    setMusic(musicOn);
    setInterval(schedule, 200);
  }

  function impulse(seconds, decay) {
    var len = Math.floor(ctx.sampleRate * seconds);
    var buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (var c = 0; c < 2; c++) {
      var d = buf.getChannelData(c);
      for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
    }
    return buf;
  }
  function makeNoise(seconds) {
    var len = Math.floor(ctx.sampleRate * seconds);
    var buf = ctx.createBuffer(1, len, ctx.sampleRate);
    var d = buf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return buf;
  }
  function loopNoise() {
    var src = ctx.createBufferSource(); src.buffer = noiseBuf; src.loop = true; src.start();
    return src;
  }

  // ------------------------------------------------------------------
  // الموسيقى
  // ------------------------------------------------------------------
  function pad(notes, t, dur, night) {
    var lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = night ? 650 : 1100; lp.Q.value = 0.4;
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.06, t + 2.2);
    g.gain.setValueAtTime(0.06, t + dur - 1.5);
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 2.5);
    lp.connect(g).connect(musicBus);
    notes.forEach(function (n, i) {
      [-6, 6].forEach(function (det) {
        var o = ctx.createOscillator();
        o.type = i === 0 ? 'sine' : 'triangle';
        o.frequency.value = hz(n - (night ? 12 : 0) + (i === 0 ? 0 : 12));
        o.detune.value = det;
        var vg = ctx.createGain(); vg.gain.value = i === 0 ? 0.9 : 0.35;
        o.connect(vg).connect(lp);
        o.start(t); o.stop(t + dur + 2.6);
      });
    });
  }

  function chime(t, note, vol, pan) {
    var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = hz(note);
    var o2 = ctx.createOscillator(); o2.type = 'sine'; o2.frequency.value = hz(note) * 2.76; // نغمة جرس معدنية
    var g = ctx.createGain(); var g2 = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + 2.8);
    g2.gain.setValueAtTime(0.0001, t); g2.gain.exponentialRampToValueAtTime(vol * 0.25, t + 0.01); g2.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    var p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    var out = p || musicBus;
    if (p) { p.pan.value = pan; p.connect(musicBus); }
    o.connect(g).connect(out); o2.connect(g2).connect(out);
    o.start(t); o2.start(t); o.stop(t + 3); o2.stop(t + 1);
  }

  function schedule() {
    if (!ctx || ctx.state !== 'running') return;
    var now = ctx.currentTime;
    var ahead = now + 0.6;
    // الأوتار
    if (musicOn) {
      while (nextChordAt < ahead) {
        var dur = env.night ? 8 : 6.5;
        pad(CHORDS[chordIdx % CHORDS.length], nextChordAt, dur, env.night);
        chordIdx++;
        nextChordAt += dur;
      }
      // الأجراس الخماسية (أقل وأخفض في الليل)
      while (nextChimeAt < ahead) {
        var n = PENTA[Math.floor(Math.random() * PENTA.length)] - (env.night ? 12 : 0);
        chime(nextChimeAt, n, env.night ? 0.03 : 0.045, Math.random() * 1.4 - 0.7);
        if (Math.random() < 0.35) chime(nextChimeAt + 0.22, n + (Math.random() < 0.5 ? 3 : 5), 0.025, Math.random() * 1.4 - 0.7);
        nextChimeAt += (env.night ? 2.6 : 1.6) + Math.random() * 2.4;
      }
    } else {
      nextChordAt = Math.max(nextChordAt, now);
      nextChimeAt = Math.max(nextChimeAt, now);
    }
    // أصوات الطبيعة
    if (!sfxOn) return;
    if (!env.night && env.birds > 0 && now > nextBirdAt) {
      birdCall(now + 0.05);
      nextBirdAt = now + Math.max(1.2, 6 - env.birds) + Math.random() * 3;
    } else if (!env.night && env.life > 6 && now > nextBirdAt) {
      if (Math.random() < 0.3) birdCall(now + 0.05, 0.4);
      nextBirdAt = now + 7 + Math.random() * 6;
    }
    if (env.night && now > nextCricketAt) {
      cricket(now + 0.05);
      nextCricketAt = now + 0.9 + Math.random() * 1.6;
    }
  }

  function birdCall(t, vol) {
    vol = vol || 1;
    var base = 2300 + Math.random() * 1400;
    var notes = 2 + Math.floor(Math.random() * 4);
    var p = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    if (p) { p.pan.value = Math.random() * 1.6 - 0.8; p.connect(ambBus); }
    for (var i = 0; i < notes; i++) {
      var s = t + i * (0.09 + Math.random() * 0.05);
      var o = ctx.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(base * (0.9 + Math.random() * 0.2), s);
      o.frequency.exponentialRampToValueAtTime(base * (1.25 + Math.random() * 0.3), s + 0.06);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.03 * vol, s + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.08);
      o.connect(g).connect(p || ambBus);
      o.start(s); o.stop(s + 0.1);
    }
  }

  function cricket(t) {
    var o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 4300 + Math.random() * 500;
    var am = ctx.createGain(); am.gain.value = 0;
    var g = ctx.createGain(); g.gain.value = 0.012;
    for (var i = 0; i < 3; i++) {
      var s = t + i * 0.06;
      am.gain.setValueAtTime(0, s); am.gain.linearRampToValueAtTime(1, s + 0.01); am.gain.linearRampToValueAtTime(0, s + 0.04);
    }
    o.connect(am).connect(g).connect(ambBus);
    o.start(t); o.stop(t + 0.25);
  }

  // ------------------------------------------------------------------
  // المؤثرات
  // ------------------------------------------------------------------
  function tone(f, dur, type, vol, delay, slideTo, bus) {
    if (!ctx || !sfxOn) return;
    var t = ctx.currentTime + (delay || 0);
    var o = ctx.createOscillator(); o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    var g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.1, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(bus || sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  function noiseBurst(dur, from, to, vol) {
    if (!ctx || !sfxOn) return;
    var t = ctx.currentTime;
    var src = ctx.createBufferSource(); src.buffer = noiseBuf;
    var f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(from, t); f.frequency.exponentialRampToValueAtTime(to, t + dur);
    var g = ctx.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + dur * 0.3); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f).connect(g).connect(sfxBus);
    src.start(t); src.stop(t + dur);
  }

  var SFX = {
    select: function () { tone(880, 0.07, 'triangle', 0.05); },
    place: function () { tone(330, 0.12, 'sine', 0.12, 0, 660); tone(990, 0.08, 'triangle', 0.04, 0.05); },
    plant: function () { [72, 76, 79].forEach(function (n, i) { tone(hz(n), 0.35, 'triangle', 0.07, i * 0.07); }); },
    sprout: function () { tone(hz(84), 0.25, 'sine', 0.04); tone(hz(91), 0.3, 'sine', 0.03, 0.08); },
    rain: function () { noiseBurst(1.1, 400, 2400, 0.12); },
    animal: function () { tone(523, 0.12, 'triangle', 0.08); tone(784, 0.18, 'triangle', 0.08, 0.1); },
    born: function () { tone(hz(79), 0.15, 'sine', 0.07); tone(hz(84), 0.25, 'sine', 0.07, 0.12); },
    orb: function () { [84, 88, 91, 96].forEach(function (n, i) { tone(hz(n), 0.25, 'sine', 0.06, i * 0.05); }); },
    eaten: function () { tone(160, 0.18, 'sine', 0.08, 0, 90); },
    wilt: function () { tone(hz(67), 0.4, 'sine', 0.05, 0, hz(60)); },
    metamorph: function () { for (var i = 0; i < 8; i++) tone(hz(72 + i * 2), 0.3, 'sine', 0.045, i * 0.06); },
    pollinate: function () { tone(hz(88), 0.18, 'sine', 0.035); },
    decompose: function () { tone(220, 0.2, 'triangle', 0.05, 0, 330); },
    tip: function () { tone(hz(81), 0.6, 'sine', 0.06); tone(hz(88), 0.8, 'sine', 0.05, 0.15); },
    goal: function () { [76, 79, 84].forEach(function (n, i) { tone(hz(n), 0.4, 'triangle', 0.08, i * 0.1); }); },
    win: function () { [72, 76, 79, 84, 88, 91].forEach(function (n, i) { tone(hz(n), 0.6, 'triangle', 0.08, i * 0.12); }); },
    error: function () { tone(220, 0.15, 'sine', 0.06); tone(185, 0.2, 'sine', 0.06, 0.12); },
    left: function () { tone(hz(84), 0.5, 'sine', 0.05, 0, hz(72)); },
  };

  function play(name) {
    if (!started) return;
    if (SFX[name]) SFX[name]();
  }

  function setMusic(on) {
    musicOn = on;
    if (!ctx) return;
    musicBus.gain.cancelScheduledValues(ctx.currentTime);
    musicBus.gain.setTargetAtTime(on ? 0.55 : 0, ctx.currentTime, on ? 1.2 : 0.3);
  }
  function setSfx(on) {
    sfxOn = on;
    if (!ctx) return;
    sfxBus.gain.setTargetAtTime(on ? 0.75 : 0, ctx.currentTime, 0.1);
    ambBus.gain.setTargetAtTime(on ? 0.8 : 0, ctx.currentTime, 0.3);
  }

  /** يحدّث أصوات البيئة حسب حالة الغابة */
  function update(e) {
    env.night = !!e.night;
    env.birds = e.birds || 0;
    env.life = e.life || 0;
    var r = Math.min(1, e.raining || 0);
    if (ctx && rainGain && Math.abs(r - env.raining) > 0.01) rainGain.gain.setTargetAtTime(r * 0.09, ctx.currentTime, 0.6);
    env.raining = r;
  }

  root.ForestAudio = { init: init, play: play, setMusic: setMusic, setSfx: setSfx, update: update };
})(window);
