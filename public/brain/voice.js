/* التعليق الصوتي بصوت مقدّم البرنامج + ترجمة مكتوبة على الشاشة (لمن يشاهد بدون صوت)
   معالجة خفيفة لوضوح الكلام فوق الموسيقى: إزالة الهمهمة، إبراز مخارج الحروف، وضغط يثبّت مستوى الصوت. */
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

    /** سلسلة وضوح الصوت — تُبنى مرة واحدة */
    chain() {
      if (this.input) return this.input;
      const c = this.ctx;
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 90;
      const mud = c.createBiquadFilter(); mud.type = 'peaking'; mud.frequency.value = 320; mud.gain.value = -2; mud.Q.value = 1;
      const presence = c.createBiquadFilter(); presence.type = 'peaking'; presence.frequency.value = 3200; presence.gain.value = 4; presence.Q.value = 0.9;
      const air = c.createBiquadFilter(); air.type = 'highshelf'; air.frequency.value = 8000; air.gain.value = 2;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -20; comp.ratio.value = 3; comp.attack.value = 0.005; comp.release.value = 0.15;
      const out = c.createGain(); out.gain.value = 1.35;
      this.input = c.createGain();
      this.input.connect(hp).connect(mud).connect(presence).connect(air).connect(comp).connect(out);
      out.connect(window.BrainMusic.sfxOut() || c.destination);
      return this.input;
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
      src.connect(this.chain());
      const dur = buf.duration;
      window.BrainMusic.duck(0.22, dur); // الموسيقى تنخفض أكثر ليبقى الكلام واضحاً
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
