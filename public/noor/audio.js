// ===============================================================
//  الصوت: خلفية هادئة مولّدة بالكامل في المتصفح (Web Audio) + مؤثرات ناعمة
//  الأوضاع: ambient (نغمات هادئة على مقام البياتي) | nature (طبيعة بلا آلات: نسيم، نافورة، صراصير الليل)
//           file (ملف صوتي خاص بك: public/noor/audio/background.mp3) | off
// ===============================================================

// مقام البياتي على «ري» — الدرجة الثانية ربع تون (نصف بيمول) لإحساس شرقي أصيل
const D = 146.83;
const BAYATI = [0, 1.5, 3, 5, 7, 8, 10, 12, 13.5, 15, 17, 19].map((st) => D * 2 ** (st / 12));

export class NoorAudio {
  constructor() {
    this.ctx = null;
    this.mode = 'off';
    this.musicVolume = 0.5;
    this.sfxVolume = 0.7;
    this.nodes = [];
    this.timers = [];
    this.file = null;
  }

  /** يجب استدعاؤها بعد تفاعل المستخدم في المتصفحات العادية (OBS يسمح تلقائياً) */
  async unlock() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.musicBus = this.ctx.createGain();
      this.sfxBus = this.ctx.createGain();
      this.reverb = this.ctx.createConvolver();
      this.reverb.buffer = this.impulse(4.5);
      const wet = this.ctx.createGain(); wet.gain.value = 0.55;
      this.musicBus.connect(this.master);
      this.musicBus.connect(this.reverb);
      this.sfxBus.connect(this.master);
      this.sfxBus.connect(this.reverb);
      this.reverb.connect(wet).connect(this.master);
      this.applyVolumes();
      const wanted = this.mode;
      this.mode = 'off';
      this.setMode(wanted);
    }
    if (this.ctx.state === 'suspended') {
      try { await this.ctx.resume(); } catch { /* تجاهل */ }
    }
    return this.ctx.state === 'running';
  }

  get running() { return this.ctx?.state === 'running'; }

  impulse(seconds) {
    const rate = this.ctx.sampleRate;
    const len = rate * seconds;
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6;
    }
    return buf;
  }

  noiseBuffer(seconds = 3) {
    const len = this.ctx.sampleRate * seconds;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) { last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = last * 3.5; }
    return buf;
  }

  setVolumes({ musicVolume, sfxVolume }) {
    if (musicVolume !== undefined) this.musicVolume = musicVolume;
    if (sfxVolume !== undefined) this.sfxVolume = sfxVolume;
    this.applyVolumes();
  }

  applyVolumes() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.musicBus.gain.setTargetAtTime(this.musicVolume * 0.6, t, 0.3);
    this.sfxBus.gain.setTargetAtTime(this.sfxVolume * 0.8, t, 0.1);
    if (this.file) this.file.volume = Math.min(1, this.musicVolume);
  }

  setMode(mode) {
    if (mode === this.mode) return;
    this.stopMusic();
    this.mode = mode;
    if (!this.ctx) return;
    if (mode === 'ambient') this.startAmbient();
    else if (mode === 'nature') this.startNature();
    else if (mode === 'file') this.startFile();
  }

  stopMusic() {
    for (const t of this.timers) clearTimeout(t);
    this.timers = [];
    for (const n of this.nodes) {
      try { n.stop?.(); } catch { /* تجاهل */ }
      try { n.disconnect(); } catch { /* تجاهل */ }
    }
    this.nodes = [];
    if (this.file) { this.file.pause(); this.file = null; }
  }

  later(ms, fn) { this.timers.push(setTimeout(fn, ms)); }

  // ---------------- الخلفية الهادئة ----------------
  startAmbient() {
    const c = this.ctx;
    // درون (قرار المقام والخامسة) يتنفس ببطء
    const droneGain = c.createGain(); droneGain.gain.value = 0.0;
    droneGain.gain.setTargetAtTime(0.16, c.currentTime, 3);
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700;
    droneGain.connect(lp).connect(this.musicBus);
    for (const [f, det, type] of [[D / 2, 0, 'sine'], [D / 2, 4, 'triangle'], [D * 0.75, -3, 'sine'], [D, 2, 'sine']]) {
      const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det;
      const g = c.createGain(); g.gain.value = 0.25;
      const lfo = c.createOscillator(); lfo.frequency.value = 0.05 + Math.random() * 0.08;
      const lg = c.createGain(); lg.gain.value = 0.12;
      lfo.connect(lg).connect(g.gain);
      o.connect(g).connect(droneGain);
      o.start(); lfo.start();
      this.nodes.push(o, lfo, g, lg);
    }
    this.nodes.push(droneGain, lp);
    // نغمات قانون/سنطور خافتة تتجوّل في المقام
    let idx = 4;
    const phrase = () => {
      const steps = 3 + Math.floor(Math.random() * 4);
      for (let i = 0; i < steps; i++) {
        idx = Math.max(0, Math.min(BAYATI.length - 1, idx + [-2, -1, -1, 1, 1, 2][Math.floor(Math.random() * 6)]));
        const f = BAYATI[idx];
        this.later(i * (420 + Math.random() * 260), () => this.pluck(f, 0.09 + Math.random() * 0.05));
      }
      // العودة إلى القرار أحياناً
      if (Math.random() < 0.35) idx = Math.random() < 0.5 ? 0 : 4;
      this.later(steps * 600 + 2200 + Math.random() * 3800, phrase);
    };
    this.later(1500, phrase);
  }

  pluck(freq, vol = 0.1, bus = this.musicBus, decay = 2.6) {
    const c = this.ctx; const t = c.currentTime;
    const g = c.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq * 6; f.Q.value = 0.7;
    g.connect(f).connect(bus);
    for (const [mult, amp] of [[1, 1], [2, 0.35], [3, 0.12], [4.02, 0.06]]) {
      const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = freq * mult;
      const og = c.createGain(); og.gain.value = amp;
      o.connect(og).connect(g);
      o.start(t); o.stop(t + decay + 0.1);
    }
  }

  // ---------------- الطبيعة (بلا آلات موسيقية) ----------------
  startNature() {
    const c = this.ctx;
    const noise = this.noiseBuffer(4);
    // نسيم الليل
    const wind = c.createBufferSource(); wind.buffer = noise; wind.loop = true;
    const wf = c.createBiquadFilter(); wf.type = 'bandpass'; wf.frequency.value = 400; wf.Q.value = 0.6;
    const wg = c.createGain(); wg.gain.value = 0.25;
    const lfo = c.createOscillator(); lfo.frequency.value = 0.07;
    const lg = c.createGain(); lg.gain.value = 250;
    lfo.connect(lg).connect(wf.frequency);
    wind.connect(wf).connect(wg).connect(this.musicBus);
    wind.start(); lfo.start();
    // نافورة الماء
    const water = c.createBufferSource(); water.buffer = noise; water.loop = true; water.playbackRate.value = 1.7;
    const hf = c.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = 1800;
    const wa = c.createGain(); wa.gain.value = 0.05;
    water.connect(hf).connect(wa).connect(this.musicBus);
    water.start();
    this.nodes.push(wind, wf, wg, lfo, lg, water, hf, wa);
    // صراصير الليل
    const cricket = () => {
      const t = c.currentTime; const f = 4200 + Math.random() * 600;
      for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
        const o = c.createOscillator(); o.frequency.value = f;
        const g = c.createGain(); const s = t + i * 0.09;
        g.gain.setValueAtTime(0, s); g.gain.linearRampToValueAtTime(0.012, s + 0.02); g.gain.linearRampToValueAtTime(0, s + 0.06);
        o.connect(g).connect(this.musicBus); o.start(s); o.stop(s + 0.08);
      }
      this.later(900 + Math.random() * 2600, cricket);
    };
    this.later(800, cricket);
  }

  startFile() {
    const a = new Audio('audio/background.mp3');
    a.loop = true;
    a.volume = Math.min(1, this.musicVolume);
    a.play().catch(() => console.warn('ضع ملفاً صوتياً في public/noor/audio/background.mp3'));
    this.file = a;
  }

  // ---------------- المؤثرات ----------------
  chime(level = 1) {
    if (!this.running) return;
    const base = [4, 6, 7, 9][Math.floor(Math.random() * 4)];
    for (let i = 0; i < 2 + level; i++) {
      setTimeout(() => this.pluck(BAYATI[Math.min(BAYATI.length - 1, base + i)] * 2, 0.12, this.sfxBus, 2), i * 110);
    }
  }

  softPing() {
    if (!this.running) return;
    this.pluck(BAYATI[7 + Math.floor(Math.random() * 4)] * 2, 0.05, this.sfxBus, 1.2);
  }

  whoosh() {
    if (!this.running) return;
    const c = this.ctx; const t = c.currentTime;
    const src = c.createBufferSource(); src.buffer = this.noiseBuffer(2);
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(300, t); f.frequency.exponentialRampToValueAtTime(2400, t + 1.2);
    const g = c.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.25, t + 0.4); g.gain.linearRampToValueAtTime(0, t + 1.6);
    src.connect(f).connect(g).connect(this.sfxBus); src.start(t); src.stop(t + 1.7);
  }

  fanfare() {
    if (!this.running) return;
    [0, 2, 4, 5, 7, 9, 11].forEach((n, i) => setTimeout(() => this.pluck(BAYATI[n] * 2, 0.14, this.sfxBus, 3), i * 170));
    setTimeout(() => [0, 4, 7].forEach((n) => this.pluck(BAYATI[n] * 4, 0.1, this.sfxBus, 4)), 1300);
  }

  tick() {
    if (!this.running) return;
    this.pluck(1200, 0.03, this.sfxBus, 0.15);
  }
}
