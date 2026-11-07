/* =====================================================================
 * app.js — منطق المنصة وإدارة الحالة باستخدام Alpine.js
 * ---------------------------------------------------------------------
 * الحالة (State) كلها داخل كائن واحد اسمه stemApp:
 *   • view  : 'dashboard' (لوحة الدروس) أو 'lesson' (مساحة العمل)
 *   • mode  : داخل الدرس — 'assembly' ← 'simulation' ← 'quiz'
 *   • xp / progress : نقاط الخبرة وتقدّم الطفل (تُحفظ في المتصفح)
 * Alpine يعيد رسم الواجهة تلقائياً عند تغيّر أي قيمة من هذه القيم.
 * ===================================================================== */

/* ---------- نصوص الواجهة باللغتين ---------- */
const I18N = {
  ar: {
    brand: 'ألعاب العلوم', brandSub: 'أكاديمية ستيم الصغيرة',
    level: 'المستوى', xp: 'نقاط الخبرة', toNext: 'للمستوى التالي',
    hello: 'أهلاً يا', welcome: 'جاهز لبناء اختراع جديد اليوم؟',
    lessonsDone: 'دروس مكتملة', totalXp: 'مجموع النقاط', stars: 'نجوم',
    continue: 'تابع التعلّم', lessons: 'الدروس', start: 'ابدأ', replay: 'أعد اللعب',
    minutes: 'دقيقة', new: 'جديد', inProgress: 'قيد التقدم', completed: 'مكتمل',
    easy: 'سهل', medium: 'متوسط', hard: 'متقدم',
    leaderboard: 'لوحة الصدارة الأسبوعية', resetsIn: 'تبدأ من جديد بعد', you: 'أنت',
    days: 'ي', hours: 'س', mins: 'د', yourRank: 'ترتيبك', weeklyXp: 'نقاط هذا الأسبوع',
    back: 'الدروس', assembly: 'التجميع', simulation: 'المحاكاة', quiz: 'الاختبار',
    inventory: 'صندوق القطع', workbench: 'طاولة العمل', steps: 'خطوات التجميع',
    dragHint: 'اسحب القطعة إلى مكانها الصحيح على طاولة العمل — أو اضغط عليها ثم اضغط على مكانها.',
    selected: 'اخترت: {part} — الآن اضغط على مكانها في الطاولة',
    placedOk: 'رائع! ثبّتّ {part} 👏', wrongSpot: 'ليس هنا! انظر إلى المكان المتوهّج ✨',
    needsFirst: 'ركّب «{part}» أولاً 🔧', allPlaced: 'أحسنت! اكتمل التجميع 🎉',
    partsLeft: 'قطع متبقية', hint: 'تلميح', resetBench: 'فكّ الكل', autoBuild: 'تجميع تلقائي',
    goSim: 'انتقل إلى المحاكاة', powerOn: 'تشغيل', powerOff: 'إيقاف', speed: 'السرعة',
    energyFlow: 'رحلة الطاقة', whatsHappening: 'ماذا يحدث؟', funFact: 'هل تعلم؟', realKit: 'المجسّم الحقيقي',
    simHint: 'اضغط زر التشغيل وشاهد كيف يعمل اختراعك!', startQuiz: 'ابدأ الاختبار',
    quizLocked: 'شغّل المحاكاة أولاً لفتح الاختبار', question: 'السؤال', of: 'من',
    correct: 'إجابة صحيحة!', wrong: 'حاول مرة أخرى 💪', next: 'التالي', finish: 'إنهاء',
    already: 'حصلت على هذه النقاط سابقاً',
    quizDone: 'أنهيت الدرس!', earned: 'النقاط المكتسبة', backHome: 'العودة للدروس', nextLesson: 'الدرس التالي',
    levelUp: 'مستوى جديد!', locked: 'مقفل', sound: 'الصوت', resetAll: 'مسح التقدم',
    resetConfirm: 'هل تريد مسح كل النقاط والتقدّم؟', editName: 'غيّر اسمك',
    levelNames: ['مبتدئ فضولي', 'مستكشف', 'باني صغير', 'مخترع', 'مهندس ماهر', 'عبقري العلوم', 'أسطورة ستيم']
  },
  en: {
    brand: 'Science Games', brandSub: 'Little STEAM Academy',
    level: 'Level', xp: 'XP', toNext: 'to next level',
    hello: 'Hi,', welcome: 'Ready to build a new invention today?',
    lessonsDone: 'Lessons done', totalXp: 'Total XP', stars: 'Stars',
    continue: 'Continue learning', lessons: 'Lessons', start: 'Start', replay: 'Play again',
    minutes: 'min', new: 'New', inProgress: 'In progress', completed: 'Completed',
    easy: 'Easy', medium: 'Medium', hard: 'Advanced',
    leaderboard: 'Weekly Leaderboard', resetsIn: 'Resets in', you: 'You',
    days: 'd', hours: 'h', mins: 'm', yourRank: 'Your rank', weeklyXp: 'XP this week',
    back: 'Lessons', assembly: 'Assembly', simulation: 'Simulation', quiz: 'Quiz',
    inventory: 'Parts Box', workbench: 'Workbench', steps: 'Build Steps',
    dragHint: 'Drag each part to its spot on the workbench — or tap a part, then tap its spot.',
    selected: 'Picked: {part} — now tap its spot on the workbench',
    placedOk: 'Great! {part} snapped in 👏', wrongSpot: 'Not there! Look at the glowing spot ✨',
    needsFirst: 'Install “{part}” first 🔧', allPlaced: 'Awesome! Assembly complete 🎉',
    partsLeft: 'parts left', hint: 'Hint', resetBench: 'Take apart', autoBuild: 'Auto-build',
    goSim: 'Go to Simulation', powerOn: 'Power On', powerOff: 'Power Off', speed: 'Speed',
    energyFlow: 'Energy Journey', whatsHappening: 'What\'s happening?', funFact: 'Did you know?', realKit: 'The real kit',
    simHint: 'Press Power On and watch your invention work!', startQuiz: 'Start Quiz',
    quizLocked: 'Run the simulation first to unlock the quiz', question: 'Question', of: 'of',
    correct: 'Correct!', wrong: 'Try again 💪', next: 'Next', finish: 'Finish',
    already: 'You already earned these points',
    quizDone: 'Lesson complete!', earned: 'XP earned', backHome: 'Back to lessons', nextLesson: 'Next lesson',
    levelUp: 'Level up!', locked: 'Locked', sound: 'Sound', resetAll: 'Reset progress',
    resetConfirm: 'Erase all XP and progress?', editName: 'Change your name',
    levelNames: ['Curious Beginner', 'Explorer', 'Little Builder', 'Inventor', 'Skilled Engineer', 'Science Genius', 'STEAM Legend']
  }
};

/* ---------- قواعد النقاط والمستويات ---------- */
const XP_RULES = { assemble: 30, simulate: 20, firstTry: 50, retry: 20 };
const XP_PER_LEVEL = 250;
const STORAGE_KEY = 'stemSim.v1';
const AVATARS = ['🦊', '🐼', '🦁', '🐯', '🐸', '🐙', '🦄', '🤖', '🐧', '🦉'];

/* لوحة الصدارة (نموذج واجهة فقط) — تُعاد كل أسبوع */
const MOCK_LEADERS = [
  { name: { ar: 'ليان', en: 'Layan' }, avatar: '🦄', xp: 1240 },
  { name: { ar: 'عمر', en: 'Omar' }, avatar: '🦁', xp: 1105 },
  { name: { ar: 'سارة', en: 'Sara' }, avatar: '🐼', xp: 960 },
  { name: { ar: 'يوسف', en: 'Yousef' }, avatar: '🐯', xp: 820 },
  { name: { ar: 'نور', en: 'Noor' }, avatar: '🦉', xp: 655 },
  { name: { ar: 'آدم', en: 'Adam' }, avatar: '🐸', xp: 410 }
];

/* ---------- أدوات صغيرة: الصوت والاحتفال (Confetti) ---------- */
const Sfx = {
  ctx: null,
  // نغمة قصيرة باستخدام Web Audio — لا حاجة لملفات صوتية
  tone(freq, dur = 0.12, type = 'sine', delay = 0, vol = 0.15) {
    try {
      this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
      const t = this.ctx.currentTime + delay;
      const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + dur);
    } catch (_) { /* المتصفح لا يدعم الصوت — نتجاهل */ }
  },
  snap() { this.tone(660, 0.08, 'triangle'); this.tone(990, 0.12, 'triangle', 0.07); },
  wrong() { this.tone(180, 0.22, 'square', 0, 0.08); },
  power() { [300, 450, 600, 800].forEach((f, i) => this.tone(f, 0.12, 'sawtooth', i * 0.06, 0.05)); },
  win() { [523, 659, 784, 1046].forEach((f, i) => this.tone(f, 0.18, 'triangle', i * 0.1)); }
};

const Confetti = {
  parts: [], running: false,
  // إطلاق قصاصات ملونة من نقطة (x,y) على الشاشة
  burst(x = innerWidth / 2, y = innerHeight / 3, count = 80) {
    const colors = ['#7C3AED', '#A78BFA', '#FACC15', '#F472B6', '#22C55E', '#38BDF8'];
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, v = 4 + Math.random() * 7;
      this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 5, r: 4 + Math.random() * 5,
        c: colors[i % colors.length], rot: Math.random() * 6, life: 90 + Math.random() * 40 });
    }
    if (!this.running) { this.running = true; requestAnimationFrame(() => this.tick()); }
  },
  tick() {
    const cv = document.getElementById('confetti'); if (!cv) return;
    const ctx = cv.getContext('2d');
    cv.width = innerWidth; cv.height = innerHeight;
    ctx.clearRect(0, 0, cv.width, cv.height);
    this.parts = this.parts.filter(p => p.life-- > 0);
    for (const p of this.parts) {
      p.vy += 0.25; p.vx *= 0.99; p.x += p.vx; p.y += p.vy; p.rot += 0.2;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillStyle = p.c;
      ctx.globalAlpha = Math.min(1, p.life / 30); ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.6); ctx.restore();
    }
    if (this.parts.length) requestAnimationFrame(() => this.tick());
    else { this.running = false; ctx.clearRect(0, 0, cv.width, cv.height); }
  }
};

/* بداية الأسبوع (الأحد) — تُستخدم لإعادة نقاط لوحة الصدارة أسبوعياً */
function weekStart(d = new Date()) {
  const s = new Date(d); s.setHours(0, 0, 0, 0); s.setDate(s.getDate() - s.getDay()); return s;
}

/* =====================================================================
 * مكوّن Alpine الرئيسي
 * ===================================================================== */
document.addEventListener('alpine:init', () => {
  Alpine.data('stemApp', () => ({
    /* ---------------- الحالة العامة ---------------- */
    lessons: window.LESSONS,
    lang: 'ar',
    view: 'dashboard',
    sound: true,
    playerName: '',
    avatar: '🦊',
    editingName: false,
    xp: 0,
    progress: {},                 // { lessonId: { assembled, simulated, quiz:{qi:true}, stars, done } }
    weekly: { week: 0, xp: 0 },   // نقاط هذا الأسبوع
    now: Date.now(),
    xpGlow: false,
    levelUpShow: false,
    toast: null,

    /* ---------------- حالة مساحة العمل (الدرس الحالي) ---------------- */
    lesson: null,
    mode: 'assembly',             // assembly | simulation | quiz
    placed: {},                   // القطع المركّبة
    selectedPart: null,           // قطعة مختارة بالنقر (للأجهزة اللمسية)
    dragging: null,               // القطعة التي تُسحب الآن
    touchDrag: null,              // سحب باللمس {id,x,y,active}
    hintPart: null,
    lastPlaced: null,
    message: null,                // { text, type: info|ok|warn }
    benchShake: false,
    powered: false,
    speed: 1,
    // حالة الاختبار
    qi: 0, chosen: null, wrongPicks: [], firstTry: 0, runXp: 0, quizFinished: false, answerXp: 0,

    thumbs: {},                   // صور مصغرة مخزّنة مسبقاً لبطاقات الدروس

    /* ---------------- الاشتراك وصلاحيات الوصول (أكاديمية ستيم) ---------------- */
    access: (window.STEAM_ACCESS ? window.STEAM_ACCESS.status() : { active: true }),
    lockOpen: false,              // نافذة «الدرس مقفل»
    lockLesson: null,
    codeInput: '',
    codeMsg: null,                // { text, ok }
    codeBusy: false,

    /* ---------------- التهيئة ---------------- */
    init() {
      this.load();
      // صور البطاقات ثابتة، فنبنيها مرة واحدة فقط
      for (const l of this.lessons) this.thumbs[l.id] = buildScene(l, { showAll: true });
      this.applyLang();
      this.$watch('lang', () => { this.applyLang(); this.save(); });
      setInterval(() => { this.now = Date.now(); }, 30000);
      // إعادة نقاط الأسبوع عند بداية أسبوع جديد
      const wk = weekStart().getTime();
      if (this.weekly.week !== wk) { this.weekly = { week: wk, xp: 0 }; this.save(); }
      // متابعة السحب باللمس على مستوى النافذة
      window.addEventListener('pointermove', (e) => this.onTouchMove(e));
      window.addEventListener('pointerup', (e) => this.onTouchEnd(e));
    },

    /* ---------------- الترجمة والاتجاه ---------------- */
    t(key, params = {}) {
      let s = (I18N[this.lang][key] ?? key);
      for (const [k, v] of Object.entries(params)) s = s.replace(`{${k}}`, v);
      return s;
    },
    tr(obj) { return obj ? (obj[this.lang] ?? obj.en) : ''; },   // ترجمة حقل {ar,en} من بيانات الدرس
    applyLang() {
      document.documentElement.lang = this.lang;
      document.documentElement.dir = this.lang === 'ar' ? 'rtl' : 'ltr';
      document.title = this.lang === 'ar' ? 'ألعاب العلوم — محاكاة ستيم' : 'Science Games — STEAM Simulation';
    },
    toggleLang() { this.lang = this.lang === 'ar' ? 'en' : 'ar'; },
    displayName() { return this.playerName || (this.lang === 'ar' ? 'المهندس الصغير' : 'Little Engineer'); },

    /* ---------------- الحفظ في المتصفح ---------------- */
    load() {
      try {
        const d = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
        Object.assign(this, {
          xp: d.xp || 0, progress: d.progress || {}, lang: d.lang || 'ar', sound: d.sound !== false,
          avatar: d.avatar || '🦊', playerName: d.playerName || '', weekly: d.weekly || { week: 0, xp: 0 }
        });
      } catch (_) { /* التخزين غير متاح (وضع خاص مثلاً) — نبدأ من الصفر */ }
    },
    save() {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          xp: this.xp, progress: this.progress, lang: this.lang, sound: this.sound,
          avatar: this.avatar, playerName: this.playerName, weekly: this.weekly
        }));
      } catch (_) { /* نتجاهل أخطاء التخزين */ }
    },
    resetAll() {
      if (!confirm(this.t('resetConfirm'))) return;
      this.xp = 0; this.progress = {}; this.weekly = { week: weekStart().getTime(), xp: 0 };
      this.save(); this.goHome();
    },
    sfx(name) { if (this.sound) Sfx[name](); },
    cycleAvatar() { const i = AVATARS.indexOf(this.avatar); this.avatar = AVATARS[(i + 1) % AVATARS.length]; this.save(); },

    /* ---------------- المستويات ونقاط الخبرة ---------------- */
    get level() { return Math.floor(this.xp / XP_PER_LEVEL) + 1; },
    get levelProgress() { return (this.xp % XP_PER_LEVEL) / XP_PER_LEVEL * 100; },
    get xpToNext() { return XP_PER_LEVEL - (this.xp % XP_PER_LEVEL); },
    get levelName() { const n = I18N[this.lang].levelNames; return n[Math.min(this.level - 1, n.length - 1)]; },

    /**
     * إضافة نقاط خبرة مع تأثير بصري:
     *  1) رقم «‎+50 XP» يطفو من مكان الحدث
     *  2) توهّج شريط النقاط في الأعلى
     *  3) احتفال إذا انتقل الطفل إلى مستوى جديد
     */
    addXP(amount, x, y) {
      if (amount <= 0) return;
      const before = this.level;
      this.xp += amount;
      this.weekly.xp += amount;
      this.save();
      const el = document.createElement('div');
      el.className = 'xp-float text-2xl';
      el.dir = 'ltr';
      el.textContent = `+${amount} XP`;
      el.style.left = (x ?? innerWidth / 2) + 'px';
      el.style.top = (y ?? innerHeight / 2) + 'px';
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 1400);
      this.xpGlow = false;
      this.$nextTick(() => { this.xpGlow = true; setTimeout(() => (this.xpGlow = false), 1200); });
      if (this.level > before) {
        setTimeout(() => { this.levelUpShow = true; Confetti.burst(innerWidth / 2, 120, 140); this.sfx('win'); }, 600);
        setTimeout(() => (this.levelUpShow = false), 3800);
      }
    },

    /* ---------------- لوحة الدروس ---------------- */
    prog(id) { return this.progress[id] || {}; },
    ensureProg(id) { if (!this.progress[id]) this.progress[id] = { quiz: {} }; return this.progress[id]; },
    status(id) {
      const p = this.prog(id);
      if (p.done) return 'completed';
      if (p.assembled) return 'inProgress';
      return 'new';
    },
    get doneCount() { return this.lessons.filter(l => this.prog(l.id).done).length; },
    get starCount() { return this.lessons.reduce((s, l) => s + (this.prog(l.id).stars || 0), 0); },
    get nextLesson() { return this.lessons.find(l => !this.prog(l.id).done) || this.lessons[0]; },
    levelLabel(n) { return this.t(['easy', 'medium', 'hard'][n - 1]); },

    /* لوحة الصدارة: ندمج الطالب الحالي مع القائمة ونرتّب حسب نقاط الأسبوع */
    get leaderboard() {
      const me = { me: true, name: { ar: this.displayName(), en: this.displayName() }, avatar: this.avatar, xp: this.weekly.xp };
      return [...MOCK_LEADERS, me].sort((a, b) => b.xp - a.xp).map((r, i) => ({ ...r, rank: i + 1 }));
    },
    get myRank() { return this.leaderboard.find(r => r.me).rank; },
    get resetCountdown() {
      const next = weekStart(new Date(this.now)); next.setDate(next.getDate() + 7);
      const ms = next - this.now;
      const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 36e5), m = Math.floor(ms % 36e5 / 6e4);
      return `${d}${this.t('days')} ${h}${this.t('hours')} ${m}${this.t('mins')}`;
    },

    /* ---------------- الاشتراك: هل الدرس مقفل؟ ---------------- */
    isLocked(l) {
      if (!window.STEAM_ACCESS) return false;
      return !this.access.active && !window.STEAM_ACCESS.isLessonFree(this.lessons.indexOf(l));
    },
    get lockedCount() { return this.lessons.filter(l => this.isLocked(l)).length; },
    get subscribeUrl() { return '../simulation.html#subscribe'; },
    async activateCode() {
      if (!window.STEAM_ACCESS || this.codeBusy) return;
      this.codeBusy = true;
      const r = await window.STEAM_ACCESS.activate(this.codeInput);
      this.codeBusy = false;
      this.codeMsg = { text: r.message, ok: r.ok };
      if (r.ok) {
        this.access = window.STEAM_ACCESS.status();
        this.sfx('win'); Confetti.burst(innerWidth / 2, innerHeight / 3, 140);
        const target = this.lockLesson;
        setTimeout(() => { this.lockOpen = false; this.codeInput = ''; this.codeMsg = null; if (target) this.openLesson(target.id); }, 1300);
      } else this.sfx('wrong');
    },

    /* ---------------- فتح درس وإدارة الأوضاع ---------------- */
    openLesson(id) {
      const target = this.lessons.find(l => l.id === id);
      if (this.isLocked(target)) { this.lockLesson = target; this.lockOpen = true; this.codeMsg = null; return; }
      this.lesson = target;
      Object.assign(this, {
        view: 'lesson', mode: 'assembly', placed: {}, selectedPart: null, dragging: null, hintPart: null,
        lastPlaced: null, powered: false, speed: 1, quizFinished: false, runXp: 0
      });
      this.say(this.t('dragHint'), 'info');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    goHome() { this.view = 'dashboard'; this.lesson = null; this.powered = false; window.scrollTo({ top: 0 }); },
    get isAssembled() { return this.lesson && this.lesson.parts.every(p => this.placed[p.id]); },
    get placedCount() { return this.lesson ? this.lesson.parts.filter(p => this.placed[p.id]).length : 0; },
    /* قفل الأوضاع: لا محاكاة قبل اكتمال التجميع، ولا اختبار قبل تشغيل المحاكاة */
    canEnter(m) {
      if (m === 'assembly') return true;
      if (m === 'simulation') return this.isAssembled;
      return this.isAssembled && !!this.prog(this.lesson.id).simulated;
    },
    setMode(m) {
      if (!this.canEnter(m)) { this.sfx('wrong'); return; }
      if (m === 'quiz') return this.startQuiz();
      this.mode = m;
      if (m !== 'simulation') this.powered = false;
    },
    say(text, type = 'info') { this.message = { text, type, id: Date.now() }; },

    /* ---------------- المشاهد (SVG) ---------------- */
    // مشهد طاولة العمل: يعتمد على القطع المركّبة وحالة السحب
    benchScene() {
      if (!this.lesson) return '';
      return buildScene(this.lesson, {
        placed: this.placed, ghosts: true, hintPart: this.hintPart,
        awaiting: !!(this.dragging || this.selectedPart || this.touchDrag?.active), lastPlaced: this.lastPlaced
      });
    },
    // مشهد المحاكاة: لا يعتمد إلا على الدرس — حتى لا يُعاد رسمه فتتوقف الحركات
    simScene() { return this.lesson ? buildScene(this.lesson, { showAll: true }) : ''; },
    partIcon(part) { return buildPartIcon(part); },
    partName(id) { return this.tr(this.lesson.parts.find(p => p.id === id).name); },

    /* =================================================================
     *  منطق التجميع (السحب والإفلات)
     * ================================================================= */
    // تحويل موضع المؤشر على الشاشة إلى إحداثيات المشهد (400×300)
    toScene(clientX, clientY) {
      const r = this.$refs.bench.getBoundingClientRect();
      return { x: (clientX - r.left) / r.width * 400, y: (clientY - r.top) / r.height * 300 };
    },
    // 1) سحب بالفأرة — HTML5 Drag & Drop
    onDragStart(e, id) {
      if (this.placed[id]) { e.preventDefault(); return; }
      e.dataTransfer.setData('text/plain', id);
      e.dataTransfer.effectAllowed = 'move';
      this.dragging = id; this.selectedPart = null;
    },
    onDragEnd() { this.dragging = null; },
    onDrop(e) {
      const id = e.dataTransfer.getData('text/plain') || this.dragging;
      this.dragging = null;
      if (id) this.tryPlace(id, this.toScene(e.clientX, e.clientY));
    },
    // 2) النقر: اختيار قطعة ثم النقر على مكانها
    selectPart(id) {
      if (this.placed[id]) return;
      this.selectedPart = this.selectedPart === id ? null : id;
      if (this.selectedPart) this.say(this.t('selected', { part: this.partName(id) }), 'info');
    },
    onBenchClick(e) {
      if (!this.selectedPart) return;
      this.tryPlace(this.selectedPart, this.toScene(e.clientX, e.clientY));
    },
    // 3) سحب باللمس (الأجهزة اللوحية) عبر Pointer Events
    onPointerDown(e, id) {
      if (e.pointerType === 'mouse' || this.placed[id]) return;
      this.touchDrag = { id, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, active: false };
    },
    onTouchMove(e) {
      const d = this.touchDrag; if (!d) return;
      d.x = e.clientX; d.y = e.clientY;
      if (!d.active && Math.hypot(d.x - d.sx, d.y - d.sy) > 8) d.active = true;
    },
    onTouchEnd(e) {
      const d = this.touchDrag; if (!d) return;
      this.touchDrag = null;
      if (!d.active) return; // لم يتحرك الإصبع = نقرة عادية (يعالجها selectPart)
      const r = this.$refs.bench?.getBoundingClientRect();
      if (r && e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) {
        this.tryPlace(d.id, this.toScene(e.clientX, e.clientY));
      }
    },

    /**
     * محاولة تركيب قطعة عند نقطة معيّنة:
     *  - إذا كانت تحتاج قطعة أخرى قبلها ← رسالة توجيه + إضاءة القطعة المطلوبة
     *  - إذا كانت النقطة داخل مكانها (مع هامش تسامح) ← «تنطبق» القطعة في مكانها
     *  - غير ذلك ← اهتزاز الطاولة وإضاءة المكان الصحيح كتلميح
     */
    tryPlace(id, pt) {
      const part = this.lesson.parts.find(p => p.id === id);
      if (!part || this.placed[id]) return;
      const missing = (part.needs || []).filter(n => !this.placed[n]);
      if (missing.length) {
        this.say(this.t('needsFirst', { part: this.partName(missing[0]) }), 'warn');
        this.flashHint(missing[0]); this.sfx('wrong');
        return;
      }
      const s = part.slot, pad = 30;
      const inside = pt.x >= s.x - pad && pt.x <= s.x + s.w + pad && pt.y >= s.y - pad && pt.y <= s.y + s.h + pad;
      if (!inside) {
        this.say(this.t('wrongSpot'), 'warn');
        this.flashHint(id); this.sfx('wrong');
        this.benchShake = true; setTimeout(() => (this.benchShake = false), 450);
        return;
      }
      this.place(id);
    },
    place(id) {
      this.placed[id] = true;
      this.lastPlaced = id; this.selectedPart = null; this.hintPart = null;
      this.sfx('snap');
      this.say(this.t('placedOk', { part: this.partName(id) }), 'ok');
      if (this.isAssembled) this.onAssembled();
    },
    flashHint(id) {
      this.hintPart = id;
      clearTimeout(this._hintT);
      this._hintT = setTimeout(() => (this.hintPart = null), 1800);
    },
    // زر التلميح: يضيء مكان أول قطعة يمكن تركيبها الآن
    showHint() {
      const next = this.lesson.parts.find(p => !this.placed[p.id] && (p.needs || []).every(n => this.placed[n]));
      if (next) { this.flashHint(next.id); this.selectedPart = next.id; this.say(this.t('selected', { part: this.tr(next.name) }), 'info'); }
    },
    resetBench() { this.placed = {}; this.lastPlaced = null; this.say(this.t('dragHint'), 'info'); },
    autoBuild() { for (const p of this.lesson.parts) this.placed[p.id] = true; this.onAssembled(); },
    onAssembled() {
      const p = this.ensureProg(this.lesson.id);
      this.say(this.t('allPlaced'), 'ok');
      this.sfx('win');
      const r = this.$refs.bench?.getBoundingClientRect();
      Confetti.burst(r ? r.left + r.width / 2 : undefined, r ? r.top + r.height / 3 : undefined, 90);
      if (!p.assembled) { p.assembled = true; this.addXP(XP_RULES.assemble, r?.left + r?.width / 2, r?.top + 40); }
      this.save();
    },

    /* =================================================================
     *  منطق المحاكاة
     * ================================================================= */
    togglePower(e) {
      this.powered = !this.powered;
      if (!this.powered) return;
      this.sfx('power');
      // بعد ثانيتين من التشغيل نعتبر أن الطفل شاهد المحاكاة ← يُفتح الاختبار
      const id = this.lesson.id, x = e?.clientX, y = e?.clientY;
      clearTimeout(this._simT);
      this._simT = setTimeout(() => {
        const p = this.ensureProg(id);
        if (this.powered && !p.simulated) { p.simulated = true; this.save(); this.addXP(XP_RULES.simulate, x, y); }
      }, 2000);
    },

    /* =================================================================
     *  منطق الاختبار
     * ================================================================= */
    startQuiz() {
      Object.assign(this, { mode: 'quiz', qi: 0, chosen: null, wrongPicks: [], firstTry: 0, quizFinished: false, answerXp: 0 });
    },
    get question() { return this.lesson?.quiz[this.qi]; },
    answer(i, e) {
      if (this.chosen !== null || this.wrongPicks.includes(i)) return;
      const q = this.question;
      if (i !== q.answer) {
        // إجابة خاطئة: اهتزاز + صوت، ويمكن المحاولة مرة أخرى بنقاط أقل
        this.wrongPicks.push(i); this.sfx('wrong');
        e?.currentTarget?.classList.add('shake'); setTimeout(() => e?.currentTarget?.classList.remove('shake'), 450);
        return;
      }
      // إجابة صحيحة: نقاط + احتفال (النقاط تُمنح مرة واحدة لكل سؤال)
      this.chosen = i;
      const first = this.wrongPicks.length === 0;
      if (first) this.firstTry++;
      const p = this.ensureProg(this.lesson.id);
      const earned = p.quiz[this.qi] ? 0 : (first ? XP_RULES.firstTry : XP_RULES.retry);
      p.quiz[this.qi] = true;
      this.answerXp = earned;
      this.runXp += earned;
      this.sfx('win');
      const r = e?.currentTarget?.getBoundingClientRect();
      Confetti.burst(r ? r.left + r.width / 2 : undefined, r ? r.top : undefined, 70);
      this.addXP(earned, r ? r.left + r.width / 2 : undefined, r ? r.top : undefined);
    },
    nextQuestion() {
      if (this.qi < this.lesson.quiz.length - 1) {
        this.qi++; this.chosen = null; this.wrongPicks = []; this.answerXp = 0;
        return;
      }
      // نهاية الاختبار: حفظ أفضل عدد نجوم وتعليم الدرس كمكتمل
      const p = this.ensureProg(this.lesson.id);
      p.done = true;
      p.stars = Math.max(p.stars || 0, this.firstTry);
      this.save();
      this.quizFinished = true;
      Confetti.burst(innerWidth / 2, innerHeight / 3, 160);
      this.sfx('win');
    },
    closeQuiz() { this.mode = 'simulation'; },
    goNextLesson() {
      const i = this.lessons.indexOf(this.lesson);
      this.openLesson(this.lessons[(i + 1) % this.lessons.length].id);
    }
  }));
});
