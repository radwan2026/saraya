// =====================================================================
//  الصوت: يُولَّد بالكامل داخل المتصفح (Web Audio) — لا ملفات ولا حقوق نشر.
//  ambient: موسيقى هادئة (درون + نغمات عود خفيفة على مقام الحجاز) + طبيعة
//  nature : أصوات طبيعة فقط (ريح، صراصير ليل، ماء) — لمن يفضّل البث بلا موسيقى
//  off    : صمت (المؤثرات تبقى حسب مستواها)
// =====================================================================

// مقام الحجاز على «ري»: ري، مي♭، فا#، صول، لا، سي♭، دو، ري
const HIJAZ = [146.83, 155.56, 185.0, 196.0, 220.0, 233.08, 261.63, 293.66, 311.13, 369.99, 392.0, 440.0];

export class NoorAudio {
  constructor() {
    this.ctx = null;
    this.mode = 'ambient';
    this.levels = { music: 0.55, nature: 0.5, sfx: 0.7 };
    this.muted = false;
    this.started = false;
    this.pluckTimer = null;
    this.cricketTimer = null;
  }

  /** يحاول بدء الصوت (يعمل تلقائياً في OBS، وفي المتصفح بعد أول نقرة) */
  init() {
    if (this.ctx) return this.ctx.state === 'running';
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    const comp = ctx.createDynamicsCompressor();
    this.master.connect(comp).connect(ctx.destination);

    this.reverb = ctx.createConvolver();
    this.reverb.buffer = this.makeImpulse(3.2);
    this.reverbOut = ctx.createGain();
    this.reverbOut.gain.value = 0.55;
    this.reverb.connect(this.reverbOut).connect(this.master);

    this.musicBus = ctx.createGain();
    this.natureBus = ctx.createGain();
    this.sfxBus = ctx.createGain();
    for (const b of [this.musicBus, this.natureBus, this.sfxBus]) { b.connect(this.master); b.connect(this.reverb); }
    this.applyLevels();
    return ctx.state === 'running';
  }

  get running() { return this.ctx?.state === 'running'; }

  resume() {
    this.init();
    if (this.ctx.state !== 'running') this.ctx.resume();
    if (!this.started) { this.started = true; this.startBeds(); }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.2);
  }

  configure({ mode, music, nature, sfx } = {}) {
    if (mode) this.mode = mode;
    if (music !== undefined) this.levels.music = music;
    if (nature !== undefined) this.levels.nature = nature;
    if (sfx !== undefined) this.levels.sfx = sfx;
    this.applyLevels();
  }

  applyLevels() {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const music = this.mode === 'ambient' ? this.levels.music : 0;
    const nature = this.mode === 'off' ? 0 : this.levels.nature;
    this.musicBus.gain.setTargetAtTime(music * 0.5, t, 0.8);
    this.natureBus.gain.setTargetAtTime(nature * 0.5, t, 0.8);
    this.sfxBus.gain.setTargetAtTime(this.levels.sfx * 0.6, t, 0.1);
  }

  makeImpulse(seconds) {
    const rate = this.ctx.sampleRate;
    const len = rate * seconds;
    const buf = this.ctx.createBuffer(2, len, rate);
    for (let c = 0; c < 2; c++) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6;
    }
    return buf;
  }

  noiseBuffer(seconds = 2) {
    const len = this.ctx.sampleRate * seconds;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    let last = 0;
    for (let i = 0; i < len; i++) {
      // ضوضاء «بنية» ناعمة
      last = (last + 0.02 * (Math.random() * 2 - 1)) / 1.02;
      d[i] = last * 3.5;
    }
    return buf;
  }

  // ------------------------------------------------------------------
  // الخلفيات المستمرة
  // ------------------------------------------------------------------
  startBeds() {
    const ctx = this.ctx;
    // ---- درون هادئ (موسيقى) ----
    const droneGain = ctx.createGain();
    droneGain.gain.value = 0.16;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 700;
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    lfo.frequency.value = 0.05;
    lfoGain.gain.value = 300;
    lfo.connect(lfoGain).connect(filt.frequency);
    lfo.start();
    for (const [f, type, g] of [[73.42, 'sine', 0.7], [146.83, 'triangle', 0.35], [220, 'sine', 0.22], [110, 'sine', 0.3]]) {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = f;
      o.detune.value = Math.random() * 8 - 4;
      const og = ctx.createGain();
      og.gain.value = g;
      o.connect(og).connect(filt);
      o.start();
    }
    filt.connect(droneGain).connect(this.musicBus);

    // ---- ريح ----
    const wind = ctx.createBufferSource();
    wind.buffer = this.noiseBuffer(4);
    wind.loop = true;
    const wf = ctx.createBiquadFilter();
    wf.type = 'bandpass';
    wf.frequency.value = 500;
    wf.Q.value = 0.6;
    const wg = ctx.createGain();
    wg.gain.value = 0.25;
    const wl = ctx.createOscillator();
    const wlg = ctx.createGain();
    wl.frequency.value = 0.08;
    wlg.gain.value = 0.15;
    wl.connect(wlg).connect(wg.gain);
    wl.start();
    wind.connect(wf).connect(wg).connect(this.natureBus);
    wind.start();

    // ---- ماء البركة ----
    const water = ctx.createBufferSource();
    water.buffer = this.noiseBuffer(3);
    water.loop = true;
    const hf = ctx.createBiquadFilter();
    hf.type = 'highpass';
    hf.frequency.value = 1800;
    const wa = ctx.createGain();
    wa.gain.value = 0.05;
    water.connect(hf).connect(wa).connect(this.natureBus);
    water.start();

    this.schedulePluck();
    this.scheduleCrickets();
  }

  schedulePluck() {
    let idx = 4;
    const play = () => {
      if (this.mode === 'ambient') {
        // مشي لحني هادئ على درجات المقام
        idx = Math.max(0, Math.min(HIJAZ.length - 1, idx + [-2, -1, -1, 1, 1, 2, 0][Math.floor(Math.random() * 7)]));
        this.pluck(HIJAZ[idx], 0.22, this.musicBus);
        if (Math.random() < 0.25) setTimeout(() => this.pluck(HIJAZ[Math.max(0, idx - 2)], 0.14, this.musicBus), 260);
      }
      this.pluckTimer = setTimeout(play, 1400 + Math.random() * 2600);
    };
    play();
  }

  scheduleCrickets() {
    const chirp = () => {
      if (this.mode !== 'off') {
        const ctx = this.ctx;
        const t = ctx.currentTime;
        for (let i = 0; i < 3; i++) {
          const o = ctx.createOscillator();
          const g = ctx.createGain();
          o.frequency.value = 4200 + Math.random() * 300;
          g.gain.setValueAtTime(0, t + i * 0.07);
          g.gain.linearRampToValueAtTime(0.025, t + i * 0.07 + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.07 + 0.05);
          o.connect(g).connect(this.natureBus);
          o.start(t + i * 0.07);
          o.stop(t + i * 0.07 + 0.06);
        }
      }
      this.cricketTimer = setTimeout(chirp, 900 + Math.random() * 2400);
    };
    chirp();
  }

  /** نغمة وترية (Karplus-Strong مبسّط) تشبه العود */
  pluck(freq, vol = 0.3, bus = this.sfxBus) {
    if (!this.running) return;
    const ctx = this.ctx;
    const rate = ctx.sampleRate;
    const dur = 2.2;
    const len = Math.floor(rate * dur);
    const buf = ctx.createBuffer(1, len, rate);
    const d = buf.getChannelData(0);
    const period = Math.floor(rate / freq);
    const ring = new Float32Array(period).map(() => Math.random() * 2 - 1);
    for (let i = 0; i < len; i++) {
      const j = i % period;
      const v = ring[j];
      ring[j] = 0.5 * (v + ring[(j + 1) % period]) * 0.996;
      d[i] = v;
    }
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 2400;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(lp).connect(g).connect(bus);
    src.start();
  }

  bell(freq = 880, vol = 0.3, delay = 0) {
    if (!this.running) return;
    const ctx = this.ctx;
    const t = ctx.currentTime + delay;
    for (const [mult, v] of [[1, 1], [2.01, 0.4], [3.02, 0.22], [4.17, 0.12]]) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.frequency.value = freq * mult;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol * v, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.4 / mult);
      o.connect(g).connect(this.sfxBus);
      o.start(t);
      o.stop(t + 2.6);
    }
  }

  whoosh(vol = 0.4, dur = 2.5) {
    if (!this.running) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer(dur);
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.Q.value = 1.4;
    f.frequency.setValueAtTime(300, t);
    f.frequency.exponentialRampToValueAtTime(2500, t + dur * 0.6);
    f.frequency.exponentialRampToValueAtTime(600, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + dur * 0.4);
    g.gain.linearRampToValueAtTime(0, t + dur);
    src.connect(f).connect(g).connect(this.sfxBus);
    src.start();
  }

  // ------------------------------------------------------------------
  // مؤثرات الأحداث
  // ------------------------------------------------------------------
  play(name) {
    if (!this.running) return;
    switch (name) {
      case 'rose': this.bell(1174.66, 0.18); this.bell(1567.98, 0.12, 0.12); break;
      case 'lantern': this.bell(587.33, 0.22); this.bell(880, 0.16, 0.18); break;
      case 'feed': [293.66, 369.99, 440].forEach((f, i) => setTimeout(() => this.pluck(f, 0.35), i * 140)); break;
      case 'musk': this.whoosh(0.35, 3); this.bell(1318.5, 0.12, 0.6); break;
      case 'sparkle': this.bell(1760, 0.12); this.bell(2093, 0.08, 0.08); break;
      case 'big':
        this.whoosh(0.4, 4);
        [293.66, 369.99, 440, 587.33, 739.99].forEach((f, i) => this.bell(f, 0.2, i * 0.18));
        break;
      case 'levelUp':
        [293.66, 369.99, 440, 587.33, 739.99, 880].forEach((f, i) => this.bell(f, 0.24, i * 0.22));
        this.whoosh(0.3, 5);
        break;
      case 'question': this.bell(659.25, 0.2); this.bell(987.77, 0.14, 0.15); break;
      case 'tick': this.bell(1975, 0.05); break;
      case 'reveal': [587.33, 739.99, 880].forEach((f, i) => this.bell(f, 0.2, i * 0.12)); break;
      case 'dhikr': this.bell(1318.5 + Math.random() * 200, 0.05); break;
      case 'follow': this.pluck(587.33, 0.3); this.pluck(880, 0.2); break;
      case 'win': [440, 554.37, 659.25, 880].forEach((f, i) => this.bell(f, 0.22, i * 0.15)); break;
      default: break;
    }
  }
}
