// =====================================================================
//  الموسيقى الخلفية لحصار المفاعل
//  موسيقى «سينث» خيال علمي تُولَّد مباشرة في المتصفح (WebAudio):
//  لا ملفات، ولا حقوق نشر، فلا يكتم تيك توك صوت البث بسببها.
//  تتغير حسب حالة اللعبة: انتظار هادئ ← معركة ← الدقيقة الأخيرة ← احتفال الفوز.
//  اختيارياً: ضع ملفاتك في public/reactor/music (waiting.mp3, battle.mp3, final.mp3, victory.mp3)
// =====================================================================
(() => {
  'use strict';

  const midi = (m) => 440 * 2 ** ((m - 69) / 12);

  // تسلسل الأكوردات (جذر الأكورد + نوعه) — مقام لا الصغير: Am F C G
  const MINOR_PROG = [[57, 'm'], [53, 'M'], [48, 'M'], [55, 'M']];
  // احتفال الفوز: C G Am F
  const VICTORY_PROG = [[48, 'M'], [55, 'M'], [57, 'm'], [53, 'M']];
  const triad = (root, q) => [root, root + (q === 'm' ? 3 : 4), root + 7];

  const MOODS = {
    waiting: { bpm: 92, prog: MINOR_PROG, drums: 0, bass: 'whole', arp: 'sparse', cutoff: 900, gain: 0.8 },
    battle: { bpm: 120, prog: MINOR_PROG, drums: 1, bass: 'eighths', arp: 'sixteenths', cutoff: 1800, gain: 1 },
    final: { bpm: 136, prog: MINOR_PROG, drums: 2, bass: 'eighths', arp: 'octaves', cutoff: 3200, gain: 1 },
    victory: { bpm: 112, prog: VICTORY_PROG, drums: 1, bass: 'eighths', arp: 'sixteenths', cutoff: 4000, gain: 1, bright: true },
  };

  class Music {
    constructor() {
      this.mood = 'off';
      this.enabled = true;
      this.volume = 0.35;
      this.ducked = false;
      this.files = {};
      this.ctx = null;
      this.step = 0;
      this.timer = null;
      this.fileAudio = null;
    }

    async init() {
      await Promise.all(Object.keys(MOODS).map(async (m) => {
        try {
          const r = await fetch(`/music/${m}.mp3`, { method: 'HEAD', cache: 'no-store' });
          if (r.ok) this.files[m] = `/music/${m}.mp3`;
        } catch { /* لا يوجد ملف */ }
      }));
    }

    ensureCtx() {
      if (this.ctx) {
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        return this.ctx;
      }
      try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; }
      const c = this.ctx;
      this.master = c.createGain();
      this.master.gain.value = 0;
      this.filter = c.createBiquadFilter();
      this.filter.type = 'lowpass';
      this.filter.frequency.value = 1800;
      this.filter.Q.value = 0.7;
      this.filter.connect(this.master).connect(c.destination);
      // ضجيج أبيض جاهز للطبول
      const len = c.sampleRate;
      this.noise = c.createBuffer(1, len, c.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return c;
    }

    /** يُستدعى بعد أي نقرة على الصفحة (المتصفح العادي يمنع الصوت قبلها) */
    unlock() { if (this.mood !== 'off') this.ensureCtx(); }

    setEnabled(on) { this.enabled = on; this.apply(); }
    setVolume(v) { this.volume = Math.max(0, Math.min(1, v)); this.applyGain(); }
    duck(on) { this.ducked = on; this.applyGain(); }

    setMood(mood) {
      if (mood === this.mood) return;
      this.mood = mood;
      this.apply();
    }

    targetGain() {
      if (!this.enabled || this.mood === 'off') return 0;
      return this.volume * (this.ducked ? 0.3 : 1) * (MOODS[this.mood]?.gain ?? 1);
    }

    applyGain() {
      const g = this.targetGain();
      if (this.fileAudio) this.fileAudio.volume = Math.min(1, g * 1.6);
      if (this.ctx && this.master) {
        const t = this.ctx.currentTime;
        this.master.gain.cancelScheduledValues(t);
        this.master.gain.setTargetAtTime(this.fileAudio ? 0 : g, t, 0.4);
      }
    }

    apply() {
      const play = this.enabled && this.mood !== 'off';
      // ملف مسجّل لهذه الحالة؟
      const file = play && this.files[this.mood];
      if (file) {
        this.stopSynth();
        if (!this.fileAudio || !this.fileAudio.src.endsWith(file)) {
          if (this.fileAudio) this.fileAudio.pause();
          this.fileAudio = new Audio(file);
          this.fileAudio.loop = this.mood !== 'victory';
          this.fileAudio.play().catch(() => {});
        }
      } else {
        if (this.fileAudio) { this.fileAudio.pause(); this.fileAudio = null; }
        if (play) this.startSynth(); else this.stopSynth();
      }
      this.applyGain();
    }

    // ------------------------------------------------------------------
    // المولّد
    // ------------------------------------------------------------------
    startSynth() {
      const c = this.ensureCtx();
      if (!c) return;
      if (this.timer) return;
      this.nextTime = c.currentTime + 0.1;
      this.step = 0;
      this.timer = setInterval(() => this.schedule(), 25);
    }

    stopSynth() {
      if (this.timer) clearInterval(this.timer);
      this.timer = null;
    }

    schedule() {
      const c = this.ctx;
      const m = MOODS[this.mood];
      if (!c || !m) return;
      if (c.state === 'suspended') return; // بانتظار نقرة لتفعيل الصوت
      this.filter.frequency.setTargetAtTime(m.cutoff, c.currentTime, 1.5);
      const stepDur = 60 / m.bpm / 4; // نوتة 1/16
      while (this.nextTime < c.currentTime + 0.15) {
        this.playStep(this.step, this.nextTime, stepDur, m);
        this.nextTime += stepDur;
        this.step = (this.step + 1) % 64; // 4 مازورات × 16
      }
    }

    playStep(step, t, sd, m) {
      const s = step % 16;
      const [root, q] = m.prog[Math.floor(step / 16)];
      const chord = triad(root, q);

      // الخلفية (Pad) أول كل مازورة
      if (s === 0) this.pad(t, chord.map((n) => midi(n + 12)), sd * 16);

      // الباص
      if (m.bass === 'whole' && s === 0) this.bass(t, midi(root - 12), sd * 15);
      if (m.bass === 'eighths' && s % 2 === 0) this.bass(t, midi(root - 12 + (s % 4 === 2 ? 12 : 0)), sd * 1.8);

      // الأربيجيو
      const order = [0, 1, 2, 1, 2, 0, 1, 2];
      if (m.arp === 'sparse' && s % 4 === 0) this.arp(t, midi(chord[order[(s / 4) % 8]] + 12), 0.035, m.bright);
      if (m.arp === 'sixteenths') this.arp(t, midi(chord[order[s % 8]] + 12), 0.03, m.bright);
      if (m.arp === 'octaves') this.arp(t, midi(chord[order[s % 8]] + (s % 2 ? 24 : 12)), 0.03, m.bright);

      // الإيقاع
      if (m.drums >= 1) {
        if (s % 4 === 0) this.kick(t);
        if (s === 4 || s === 12) this.snare(t);
        if (s % 4 === 2) this.hat(t, 0.08);
      }
      if (m.drums >= 2) {
        if (s % 2 === 1) this.hat(t, 0.04);
        if (s === 14 || s === 15) this.snare(t, 0.5);
      }
    }

    env(g, t, peak, attack, decay) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    }

    kick(t) {
      const c = this.ctx; const o = c.createOscillator(); const g = c.createGain();
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      this.env(g, t, 0.9, 0.002, 0.28);
      o.connect(g).connect(this.master); // بدون فلتر ليبقى قوياً
      o.start(t); o.stop(t + 0.32);
    }

    snare(t, vol = 1) {
      const c = this.ctx; const src = c.createBufferSource(); src.buffer = this.noise;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1900; f.Q.value = 0.8;
      const g = c.createGain(); this.env(g, t, 0.32 * vol, 0.002, 0.16);
      src.connect(f).connect(g).connect(this.master);
      src.start(t, Math.random() * 0.5); src.stop(t + 0.2);
    }

    hat(t, vol) {
      const c = this.ctx; const src = c.createBufferSource(); src.buffer = this.noise;
      const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 7500;
      const g = c.createGain(); this.env(g, t, vol, 0.001, 0.045);
      src.connect(f).connect(g).connect(this.master);
      src.start(t, Math.random() * 0.5); src.stop(t + 0.06);
    }

    bass(t, freq, dur) {
      const c = this.ctx; const o = c.createOscillator(); const f = c.createBiquadFilter(); const g = c.createGain();
      o.type = 'sawtooth'; o.frequency.value = freq;
      f.type = 'lowpass'; f.Q.value = 6;
      f.frequency.setValueAtTime(900, t); f.frequency.exponentialRampToValueAtTime(180, t + Math.min(dur, 0.4));
      this.env(g, t, 0.22, 0.005, dur);
      o.connect(f).connect(g).connect(this.filter);
      o.start(t); o.stop(t + dur + 0.05);
    }

    arp(t, freq, vol, bright) {
      const c = this.ctx; const o = c.createOscillator(); const g = c.createGain();
      o.type = bright ? 'triangle' : 'square'; o.frequency.value = freq;
      this.env(g, t, bright ? vol * 2 : vol, 0.003, 0.14);
      o.connect(g).connect(this.filter);
      o.start(t); o.stop(t + 0.18);
    }

    pad(t, freqs, dur) {
      const c = this.ctx; const g = c.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05, t + Math.min(0.6, dur / 3));
      g.gain.setValueAtTime(0.05, t + dur * 0.8);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      g.connect(this.filter);
      for (const f of freqs) {
        for (const detune of [-8, 8]) {
          const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = detune;
          o.connect(g); o.start(t); o.stop(t + dur + 0.05);
        }
      }
    }
  }

  window.Music = Music;
})();
