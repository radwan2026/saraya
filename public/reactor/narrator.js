/* global speechSynthesis, SpeechSynthesisUtterance */
// =====================================================================
//  الراوي الصوتي لحصار المفاعل
//  1) إن وُجد ملف صوتي مسجّل في /voice/<key>.mp3 يُشغَّل هو (صوتك أنت)
//  2) وإلا يُقرأ النص بصوت عربي من الجهاز (Speech Synthesis)
//  3) وفي كل الأحوال يظهر النص كترجمة على الشاشة
// =====================================================================
(() => {
  'use strict';

  const TEAM_NAMES = { blue: 'الفريق الأزرق', red: 'الفريق الأحمر' };

  // النصوص — يمكنك تعديلها كما تريد. {name} و {team} تُستبدل تلقائياً عند القراءة الآلية
  const LINES = {
    intro: [
      'أهلاً بكم في حصار المفاعل!',
      'اكتب واحد في التعليقات لتنضم إلى الفريق الأزرق، أو اثنين لتنضم إلى الفريق الأحمر.',
      'كبّسوا على الشاشة لشحن درع قاعدتكم، وكل تعليق منكم يدفع المفاعل نحو العدو.',
      'الوردة تطلق ليزر يدفع المفاعل، والهدايا المتوسطة تزرع الألغام أو تعطّل دفاعات الخصم.',
      'أما الأسد والحوت، فيفجّران المفاعل ويمسحان نصف طاقة العدو، ويصبح صاحبها قائد الأسطول!',
      'الفريق الذي يدمّر قاعدة خصمه يفوز. هيا إلى المعركة!',
    ],
    waiting: ['نحتاج محاربين! اكتب واحد للأزرق، أو اثنين للأحمر، وتبدأ المعركة فوراً.'],
    battleStart: ['بدأت المعركة! كبّسوا وادعموا فريقكم!'],
    lastMinute: ['تبقّت دقيقة واحدة! كل هدية الآن قد تقلب النتيجة!'],
    overload: ['أوفرلود! تم مسح نصف طاقة العدو!'],
    commander: ['لدينا قائد أسطول جديد: {name}!'],
    emp: ['تم تعطيل دفاعات {team}!'],
    victoryBlue: ['انتصر الفريق الأزرق! مبروك للأبطال!'],
    victoryRed: ['انتصر الفريق الأحمر! مبروك للأبطال!'],
    draw: ['انتهت الجولة بالتعادل!'],
  };

  // أسماء الملفات الصوتية المقابلة (داخل مجلد public/reactor/voice)
  const FILES = {
    intro: 'intro', waiting: 'waiting', battleStart: 'battle-start', lastMinute: 'last-minute',
    overload: 'overload', commander: 'commander', emp: 'emp',
    victoryBlue: 'victory-blue', victoryRed: 'victory-red', draw: 'draw',
  };

  const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] ?? ''));

  class Narrator {
    constructor({ captionEl, onStatus, onSpeaking } = {}) {
      this.onSpeaking = onSpeaking || (() => {});
      this.captionEl = captionEl || null;
      this.onStatus = onStatus || (() => {});
      this.enabled = true;
      this.queue = [];
      this.busy = false;
      this.files = {};
      this.voice = null;
      this.cooldown = {};
      this.hasTTS = 'speechSynthesis' in window;
    }

    async init() {
      await Promise.all(Object.entries(FILES).map(async ([key, file]) => {
        try {
          const r = await fetch(`/voice/${file}.mp3`, { method: 'HEAD', cache: 'no-store' });
          if (r.ok) this.files[key] = `/voice/${file}.mp3`;
        } catch { /* لا يوجد ملف */ }
      }));
      if (this.hasTTS) {
        this.pickVoice();
        speechSynthesis.onvoiceschanged = () => this.pickVoice();
      }
      this.report();
    }

    pickVoice() {
      const voices = speechSynthesis.getVoices().filter((v) => /^ar/i.test(v.lang));
      // الأصوات الطبيعية (Natural / Online) أوضح بكثير
      voices.sort((a, b) => score(b) - score(a));
      this.voice = voices[0] || null;
      this.report();
    }

    status() {
      const nFiles = Object.keys(this.files).length;
      return {
        files: nFiles,
        total: Object.keys(FILES).length,
        voice: this.voice ? this.voice.name : '',
        mode: nFiles ? 'files' : (this.voice ? 'tts' : 'text'),
        enabled: this.enabled,
      };
    }

    report() { this.onStatus(this.status()); }

    /**
     * @param key اسم الجملة من LINES
     * @param vars متغيرات مثل {name, team}
     * @param cooldownSec لا تُكرَّر نفس الجملة قبل مرور هذه المدة
     */
    say(key, vars = {}, cooldownSec = 0) {
      if (!this.enabled || !LINES[key]) return;
      const now = Date.now();
      if (cooldownSec && this.cooldown[key] && now - this.cooldown[key] < cooldownSec * 1000) return;
      this.cooldown[key] = now;
      if (key === 'intro' && this.queue.some((q) => q.key === 'intro')) return;
      this.queue.push({ key, vars, at: now });
      if (this.queue.length > 5) this.queue.splice(0, this.queue.length - 5);
      if (!this.busy) this.next();
    }

    stop() {
      this.queue = [];
      if (this.audio) { this.audio.pause(); this.audio = null; }
      if (this.hasTTS) speechSynthesis.cancel();
      this.caption('');
      this.busy = false;
      this.onSpeaking(false);
    }

    next() {
      const item = this.queue.shift();
      if (!item) { this.busy = false; this.caption(''); this.onSpeaking(false); return; }
      // الأحداث القديمة (أكثر من 12 ثانية) لم تعد مهمة
      if (item.key !== 'intro' && Date.now() - item.at > 12000) { this.next(); return; }
      this.busy = true;
      this.onSpeaking(true);
      const sentences = LINES[item.key].map((s) => fill(s, item.vars));
      const done = () => { clearTimeout(this.guard); setTimeout(() => this.next(), 400); };

      if (this.files[item.key]) this.playFile(this.files[item.key], sentences, done);
      else if (this.voice) this.speak(sentences, 0, done);
      else this.textOnly(sentences, 0, done);
    }

    playFile(src, sentences, done) {
      const audio = new Audio(src);
      this.audio = audio;
      const total = sentences.reduce((n, s) => n + s.length, 0);
      audio.onloadedmetadata = () => {
        // توزيع الترجمة على مدة الملف بحسب طول كل جملة
        let t = 0;
        sentences.forEach((s) => {
          const at = t;
          setTimeout(() => { if (this.audio === audio) this.caption(s); }, at * 1000);
          t += (s.length / total) * audio.duration;
        });
      };
      audio.onended = () => { this.audio = null; done(); };
      audio.onerror = () => { this.audio = null; this.textOnly(sentences, 0, done); };
      audio.play().catch(() => { this.audio = null; this.textOnly(sentences, 0, done); });
      this.guard = setTimeout(done, 90_000);
    }

    speak(sentences, i, done) {
      if (i >= sentences.length) { done(); return; }
      const s = sentences[i];
      this.caption(s);
      const u = new SpeechSynthesisUtterance(s);
      u.voice = this.voice;
      u.lang = this.voice.lang;
      u.rate = 1;
      let finished = false;
      const go = () => { if (finished) return; finished = true; clearTimeout(t); this.speak(sentences, i + 1, done); };
      // بعض المتصفحات لا ترسل onend أحياناً — مؤقت احتياطي
      const t = setTimeout(go, 2500 + s.length * 110);
      u.onend = go;
      u.onerror = go;
      speechSynthesis.speak(u);
    }

    textOnly(sentences, i, done) {
      if (i >= sentences.length) { done(); return; }
      this.caption(sentences[i]);
      setTimeout(() => this.textOnly(sentences, i + 1, done), 1800 + sentences[i].length * 65);
    }

    caption(text) {
      const el = this.captionEl;
      if (!el) return;
      if (!text) { el.classList.remove('on'); return; }
      el.querySelector('.cap-text').textContent = text;
      el.classList.remove('on'); void el.offsetWidth; el.classList.add('on');
    }
  }

  function score(v) {
    let s = 0;
    if (/natural|online|neural/i.test(v.name)) s += 10;
    if (/ar-SA/i.test(v.lang)) s += 2;
    if (/ar-EG|ar-AE|ar-LY/i.test(v.lang)) s += 1;
    return s;
  }

  /**
   * يربط الراوي بأحداث اللعبة القادمة من الخادم.
   * getRemaining(): الثواني المتبقية في المرحلة الحالية
   */
  function attachNarrator(socket, narrator, getRemaining) {
    let phase = null;
    let lastMinuteSaid = false;
    let round = null;

    const onPhase = (p, r) => {
      if (r !== round) { round = r; lastMinuteSaid = false; }
      if (p === phase) return;
      const prev = phase;
      phase = p;
      if (prev === null) return; // أول اتصال: لا نعلن شيئاً
      if (p === 'waiting') narrator.say('waiting', {}, 30);
      else if (p === 'battle') narrator.say('battleStart', {}, 10);
    };

    socket.on('state', (st) => onPhase(st.phase, st.round));
    socket.on('tick', (t) => {
      onPhase(t.phase, t.round);
      if (t.phase === 'battle' && !lastMinuteSaid) {
        const rem = getRemaining(t);
        if (rem > 0 && rem <= 60) { lastMinuteSaid = true; narrator.say('lastMinute'); }
      }
    });
    socket.on('fx', (f) => {
      if (f.type === 'overload') {
        narrator.say('overload', { name: f.user.nickname }, 4);
        if (f.commander) narrator.say('commander', { name: f.user.nickname });
      } else if (f.type === 'emp') {
        narrator.say('emp', { team: TEAM_NAMES[f.target] }, 15);
      }
    });
    socket.on('victory', (w) => {
      narrator.say(w.team === 'blue' ? 'victoryBlue' : w.team === 'red' ? 'victoryRed' : 'draw');
    });
    socket.on('narrate', ({ key } = {}) => narrator.say(key || 'intro'));
    socket.on('narrationConfig', (c) => { narrator.enabled = c.enabled !== false; if (!narrator.enabled) narrator.stop(); narrator.report(); });
  }

  window.Narrator = Narrator;
  window.attachNarrator = attachNarrator;
  window.NARRATION_LINES = LINES;
  window.NARRATION_FILES = FILES;
})();
