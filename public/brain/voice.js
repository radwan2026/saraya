/* التعليق الصوتي بصوت «الجدّ الحكيم» + ترجمة مكتوبة على الشاشة (لمن يشاهد بدون صوت)
   تأثير الرجل العجوز يُضاف لحظياً: إبطاء وتعميق، بحّة دافئة، رجفة خفيفة في الصوت، وصدى غرفة. */
(() => {
  'use strict';

  const params = new URLSearchParams(location.search);
  const ENABLED = params.get('voice') !== '0' && params.get('sound') !== '0';

  class Voice {
    constructor() {
      this.lines = [];
      this.buffers = new Map();
      this.queue = [];
      this.playing = null;
      this.enabled = ENABLED;
      this.welcomeEvery = 0;
    }

    async init() {
      try {
        const m = await (await fetch('/voice/manifest.json')).json();
        this.lines = m.lines || [];
        this.enabled = this.enabled && m.enabled;
        this.welcomeEvery = m.welcomeEveryMinutes || 0;
      } catch { this.enabled = false; }
    }

    get ctx() { return window.BrainMusic.ctx; }

    /** سلسلة تأثير «الرجل العجوز» — تُبنى مرة واحدة */
    chain() {
      if (this.input) return this.input;
      const c = this.ctx;
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 110;
      const warm = c.createBiquadFilter(); warm.type = 'peaking'; warm.frequency.value = 280; warm.gain.value = 4; warm.Q.value = 0.8;
      const rasp = c.createBiquadFilter(); rasp.type = 'peaking'; rasp.frequency.value = 2600; rasp.gain.value = 3; rasp.Q.value = 1.2;
      const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 6200;
      // رجفة الصوت: تأخير صغير يتذبذب بتردد ~5.5 هرتز (vibrato)
      const wobble = c.createDelay(0.05); wobble.delayTime.value = 0.012;
      const lfo = c.createOscillator(); lfo.frequency.value = 5.5;
      const depth = c.createGain(); depth.gain.value = 0.0011;
      lfo.connect(depth).connect(wobble.delayTime); lfo.start();
      // تموّج خفيف في الشدة (tremolo)
      const trem = c.createGain(); trem.gain.value = 0.9;
      const lfo2 = c.createOscillator(); lfo2.frequency.value = 5.5;
      const tdepth = c.createGain(); tdepth.gain.value = 0.08;
      lfo2.connect(tdepth).connect(trem.gain); lfo2.start();
      // صدى غرفة قصير
      const verb = c.createConvolver(); verb.buffer = this.impulse(1.3);
      const wet = c.createGain(); wet.gain.value = 0.16;
      const out = c.createGain(); out.gain.value = 1.25;
      this.input = c.createGain();
      this.input.connect(hp).connect(warm).connect(rasp).connect(lp).connect(wobble).connect(trem);
      trem.connect(out);
      trem.connect(verb).connect(wet).connect(out);
      out.connect(window.BrainMusic.sfxOut() || c.destination);
      return this.input;
    }

    impulse(sec) {
      const c = this.ctx; const len = Math.floor(c.sampleRate * sec);
      const b = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const d = b.getChannelData(ch);
        for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 2.6;
      }
      return b;
    }

    async buffer(id) {
      if (this.buffers.has(id)) return this.buffers.get(id);
      const p = fetch(`/voice/${id}.mp3`).then((r) => {
        if (!r.ok) throw new Error(String(r.status));
        return r.arrayBuffer();
      }).then((ab) => this.ctx.decodeAudioData(ab)).catch(() => null);
      this.buffers.set(id, p);
      return p;
    }

    /** يحمّل كل المقاطع مسبقاً حتى لا يتأخر الكلام */
    preload() {
      if (!this.ctx) return;
      for (const l of this.lines) this.buffer(l.id);
    }

    /** يشغّل مجموعة مقاطع بالترتيب (welcome، round-detective، hurry، finale...) */
    say(group, { interrupt = true } = {}) {
      if (!this.enabled || !this.ctx) return;
      const ids = this.lines.filter((l) => l.group === group);
      if (!ids.length) return;
      if (interrupt) this.stop();
      else if (this.playing) return;
      this.queue.push(...ids);
      this.next();
    }

    async next() {
      if (this.playing || !this.queue.length) return;
      const line = this.queue.shift();
      const token = {};
      this.playing = token;
      const buf = await this.buffer(line.id);
      if (this.playing !== token) return; // أُوقف أثناء التحميل
      if (!buf) { this.playing = null; this.next(); return; }
      const src = this.ctx.createBufferSource();
      src.buffer = buf;
      src.playbackRate.value = 0.94; // أبطأ وأعمق قليلاً = صوت أكبر سناً
      src.connect(this.chain());
      const dur = buf.duration / src.playbackRate.value;
      window.BrainMusic.duck(0.32, dur);
      this.caption(line.caption, dur);
      src.onended = () => {
        if (this.playing !== token) return;
        this.playing = null;
        this.src = null;
        setTimeout(() => this.next(), 250);
      };
      this.src = src;
      src.start();
    }

    stop() {
      this.queue = [];
      this.playing = null;
      if (this.src) { try { this.src.stop(); } catch { /* تجاهل */ } }
      this.src = null;
      this.caption('', 0);
    }

    caption(text, dur) {
      const box = document.getElementById('caption');
      if (!box) return;
      clearTimeout(this.capTimer);
      if (!text) { box.classList.remove('show'); return; }
      box.querySelector('span').textContent = text;
      box.classList.remove('show'); void box.offsetWidth; box.classList.add('show');
      this.capTimer = setTimeout(() => box.classList.remove('show'), dur * 1000 + 300);
    }
  }

  window.BrainVoice = new Voice();
})();
