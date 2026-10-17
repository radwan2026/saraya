/* موسيقى خلفية مولّدة لحظياً عبر WebAudio — ألحان أصلية بلا حقوق نشر (لا يكتمها تيك توك)
   لكل مرحلة «مزاج» خاص: الاستوديو، السؤال (يتسارع التوتر مع اقتراب نهاية الوقت)، كشف الحل، الترتيب، التتويج. */
(() => {
  'use strict';

  const hz = (m) => 440 * 2 ** ((m - 69) / 12);
  const CH = {
    Am: [57, 60, 64], F: [53, 57, 60], C: [60, 64, 67], G: [55, 59, 62], E: [52, 56, 59],
    Dm: [50, 53, 57], Bb: [58, 62, 65], D: [50, 54, 57],
  };
  const at = (steps) => new Set(steps);

  // كل مزاج: سرعة، تسلسل كوردات (كورد لكل مازورة = 16 خطوة)، ونمط للطبول
  const MOODS = {
    lobby: { bpm: 112, chords: ['Am', 'F', 'C', 'G'], kick: at([0, 4, 8, 12]), clap: at([4, 12]), hat: at([2, 6, 10, 14]),
      bass: at([0, 3, 6, 8, 11, 14]), arp: 2, pad: 0.5, lead: false },
    question: { bpm: 124, chords: ['Am', 'Am', 'F', 'E'], kick: at([0, 8]), clap: at([]), hat: 'all',
      bass: at([0, 2, 4, 6, 8, 10, 12, 14]), arp: 0, pad: 0.35, clock: true, lead: false },
    reveal: { bpm: 92, chords: ['Dm', 'Bb', 'F', 'C'], kick: at([0, 10]), clap: at([8]), hat: at([4, 12]),
      bass: at([0, 10]), arp: 4, pad: 0.6, lead: false },
    board: { bpm: 120, chords: ['C', 'G', 'Am', 'F'], kick: at([0, 4, 8, 12]), clap: at([4, 12]), hat: at([2, 6, 10, 14]),
      bass: at([0, 3, 6, 8, 10, 14]), arp: 2, pad: 0.45, lead: false },
    finale: { bpm: 128, chords: ['C', 'G', 'Am', 'F'], kick: at([0, 4, 8, 12]), clap: at([4, 12]), hat: 'all',
      bass: at([0, 2, 4, 6, 8, 10, 12, 14]), arp: 2, pad: 0.6, lead: true },
  };
  // لحن التتويج (درجات فوق جذر الكورد) على خطوات المازورة
  const LEAD = { 0: 12, 3: 16, 6: 19, 8: 24, 10: 19, 12: 16, 14: 19 };

  class Music {
    constructor() {
      this.ctx = null;
      this.mood = 'silent';
      this.intensity = 0;
      this.step = 0;
      this.nextTime = 0;
      this.enabled = true;
      this.musicVol = 0.55;
      this.sfxVol = 1;
    }

    /** يربط المحرك بسياق الصوت ويبني المسارات: موسيقى + مؤثرات ← ضاغط ← السماعات */
    attach(ctx) {
      if (this.ctx) return;
      this.ctx = ctx;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.ratio.value = 4; comp.attack.value = 0.003; comp.release.value = 0.2;
      comp.connect(ctx.destination);
      this.output = comp; // متاح للتسجيل/المعاينة
      this.musicBus = ctx.createGain();
      this.musicBus.gain.value = this.enabled ? this.musicVol : 0;
      this.duckGain = ctx.createGain();
      this.tone = ctx.createBiquadFilter(); // فلتر يكتم الموسيقى قليلاً لحظة المؤثرات القوية
      this.tone.type = 'lowpass'; this.tone.frequency.value = 18000;
      this.musicBus.connect(this.duckGain).connect(this.tone).connect(comp);
      this.sfxBus = ctx.createGain();
      this.sfxBus.gain.value = this.sfxVol;
      this.sfxBus.connect(comp);
      const len = ctx.sampleRate;
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.nextTime = ctx.currentTime + 0.1;
      setInterval(() => this.schedule(), 25);
    }

    sfxOut() { return this.sfxBus || null; }

    setMood(m) {
      if (m === this.mood) return;
      const fresh = this.mood === 'silent' || !MOODS[this.mood];
      this.mood = MOODS[m] ? m : 'silent';
      if (fresh && this.ctx) { this.step = 0; this.nextTime = Math.max(this.nextTime, this.ctx.currentTime + 0.05); }
    }

    setIntensity(level) { this.intensity = level; }

    setEnabled(on) {
      this.enabled = on;
      if (this.musicBus) this.musicBus.gain.setTargetAtTime(on ? this.musicVol : 0, this.ctx.currentTime, 0.2);
    }

    setVolume(music, sfx) {
      if (Number.isFinite(music)) this.musicVol = Math.max(0, Math.min(1, music));
      if (Number.isFinite(sfx)) this.sfxVol = Math.max(0, Math.min(1.5, sfx));
      if (!this.ctx) return;
      this.musicBus.gain.setTargetAtTime(this.enabled ? this.musicVol : 0, this.ctx.currentTime, 0.1);
      this.sfxBus.gain.setTargetAtTime(this.sfxVol, this.ctx.currentTime, 0.1);
    }

    /** يخفض الموسيقى لحظياً ليبرز المؤثر الصوتي (كما في برامج المسابقات) */
    duck(depth = 0.2, hold = 0.8) {
      if (!this.ctx) return;
      const t = this.ctx.currentTime;
      const g = this.duckGain.gain;
      g.cancelScheduledValues(t); g.setValueAtTime(g.value, t);
      g.linearRampToValueAtTime(depth, t + 0.04);
      g.setValueAtTime(depth, t + hold);
      g.linearRampToValueAtTime(1, t + hold + 0.8);
      const f = this.tone.frequency;
      f.cancelScheduledValues(t); f.setValueAtTime(900, t + 0.02);
      f.exponentialRampToValueAtTime(18000, t + hold + 0.8);
    }

    // ---------------------------------------------------------------
    schedule() {
      const ctx = this.ctx;
      if (!ctx || ctx.state !== 'running') return;
      const m = MOODS[this.mood];
      if (!m) { this.nextTime = ctx.currentTime + 0.05; return; }
      // يتسارع الإيقاع قليلاً في آخر الثواني
      const bpm = m.bpm * (this.mood === 'question' ? [1, 1.08, 1.16][this.intensity] : 1);
      const dt = 60 / bpm / 4;
      if (this.nextTime < ctx.currentTime - 0.2) this.nextTime = ctx.currentTime + 0.02; // بعد توقف التبويب
      while (this.nextTime < ctx.currentTime + 0.12) {
        this.playStep(m, this.step, this.nextTime, dt);
        this.nextTime += dt;
        this.step += 1;
      }
    }

    playStep(m, step, t, dt) {
      const s = step % 16;
      const bar = Math.floor(step / 16);
      const chord = CH[m.chords[bar % m.chords.length]];
      const root = (chord[0] % 12) + 36;
      const hot = this.mood === 'question' ? this.intensity : 0;

      const kicks = hot >= 1 ? new Set([0, 4, 8, 12]) : m.kick;
      if (kicks.has(s)) { this.kick(t); this.beat(t); }
      if (m.clap.has(s) || (hot >= 2 && (s === 4 || s === 12))) this.clap(t);
      if (m.hat === 'all') this.hat(t, s % 4 === 2 ? 0.09 : 0.035 + hot * 0.02, false);
      else if (m.hat.has(s)) this.hat(t, 0.07, s % 8 === 6);
      if (m.bass.has(s)) this.bass(t, hz(root), dt * (m.bass.size > 6 ? 1.6 : 3), 500 + hot * 700);
      if (m.clock && s % 8 === 0) this.pluck(t, hz(chord[0] + 24), 0.06, 'square', 0.05);
      if (m.arp && s % m.arp === 0) {
        const n = chord[(s / m.arp) % chord.length] + 12;
        this.pluck(t, hz(n), dt * 1.6, 'triangle', 0.06);
      }
      if (s === 0 && m.pad) this.pad(t, chord, dt * 16, m.pad);
      if (m.lead && LEAD[s] !== undefined) this.pluck(t, hz(root + 24 + LEAD[s]), dt * 2, 'sawtooth', 0.045);
      // صوت صاعد قبل كل مازورة جديدة في آخر 5 ثوانٍ
      if (hot >= 2 && s === 8) this.riser(t, dt * 8);
    }

    beat(t) {
      const ms = Math.max(0, (t - this.ctx.currentTime) * 1000);
      setTimeout(() => window.dispatchEvent(new Event('brain:beat')), ms);
    }

    env(g, t, peak, a, d) {
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(peak, t + a);
      g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    }

    kick(t) {
      const c = this.ctx; const o = c.createOscillator(); const g = c.createGain();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.14);
      this.env(g, t, 0.9, 0.003, 0.32);
      o.connect(g).connect(this.musicBus); o.start(t); o.stop(t + 0.4);
    }

    noiseHit(t, type, freq, q, peak, dur) {
      const c = this.ctx; const src = c.createBufferSource(); src.buffer = this.noise;
      const f = c.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = c.createGain(); this.env(g, t, peak, 0.002, dur);
      src.connect(f).connect(g).connect(this.musicBus);
      src.start(t, Math.random() * 0.5); src.stop(t + dur + 0.05);
    }

    clap(t) { for (const k of [0, 0.012, 0.026]) this.noiseHit(t + k, 'bandpass', 1400, 1.2, 0.35, 0.12); }

    hat(t, vol, open) { this.noiseHit(t, 'highpass', 7500, 0.8, vol, open ? 0.16 : 0.035); }

    bass(t, f, dur, cutoff) {
      const c = this.ctx; const o = c.createOscillator(); const lp = c.createBiquadFilter(); const g = c.createGain();
      o.type = 'sawtooth'; o.frequency.value = f;
      lp.type = 'lowpass'; lp.Q.value = 6;
      lp.frequency.setValueAtTime(cutoff * 2.2, t); lp.frequency.exponentialRampToValueAtTime(cutoff * 0.5, t + dur);
      this.env(g, t, 0.22, 0.005, dur);
      o.connect(lp).connect(g).connect(this.musicBus); o.start(t); o.stop(t + dur + 0.05);
    }

    pluck(t, f, dur, type, vol) {
      const c = this.ctx; const o = c.createOscillator(); const g = c.createGain();
      o.type = type; o.frequency.value = f;
      this.env(g, t, vol, 0.004, dur);
      o.connect(g).connect(this.musicBus); o.start(t); o.stop(t + dur + 0.05);
    }

    pad(t, chord, dur, vol) {
      const c = this.ctx; const lp = c.createBiquadFilter(); const g = c.createGain();
      lp.type = 'lowpass'; lp.frequency.value = 1300;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.05 * vol, t + dur * 0.25);
      g.gain.linearRampToValueAtTime(0.0001, t + dur);
      lp.connect(g).connect(this.musicBus);
      for (const n of chord) {
        for (const det of [-7, 7]) {
          const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = hz(n); o.detune.value = det;
          o.connect(lp); o.start(t); o.stop(t + dur + 0.05);
        }
      }
    }

    riser(t, dur) {
      const c = this.ctx; const src = c.createBufferSource(); src.buffer = this.noise; src.loop = true;
      const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 3;
      f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(6000, t + dur);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + dur);
      g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.02);
      src.connect(f).connect(g).connect(this.musicBus); src.start(t); src.stop(t + dur + 0.05);
    }
  }

  window.BrainMusic = new Music();
})();
