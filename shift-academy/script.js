(function () {
  'use strict';

  var DICT = window.SA_I18N;
  var lang = document.documentElement.lang === 'ar' ? 'ar' : 'en';
  var currentFilter = 'all';

  function t(key, vars) {
    var s = (DICT[lang] && DICT[lang][key]) || DICT.en[key] || key;
    if (vars) Object.keys(vars).forEach(function (k) { s = s.replace('{' + k + '}', vars[k]); });
    return s;
  }

  var COURSES = [
    { track: 'ai', level: 'beginner', weeks: 6,
      en: ['Machine Learning Fundamentals', 'Regression, classification and model evaluation with Python and scikit-learn.'],
      ar: ['أساسيات تعلّم الآلة', 'الانحدار، التصنيف، وتقييم النماذج باستخدام Python وscikit-learn.'] },
    { track: 'ai', level: 'intermediate', weeks: 8,
      en: ['Applied Deep Learning', 'Neural networks, computer vision and building models with PyTorch.'],
      ar: ['التعلّم العميق التطبيقي', 'الشبكات العصبية والرؤية الحاسوبية وبناء نماذج بـ PyTorch.'] },
    { track: 'ai', level: 'advanced', weeks: 6,
      en: ['LLM Application Engineering', 'Retrieval-augmented generation (RAG), AI agents and evaluating systems in production.'],
      ar: ['هندسة تطبيقات النماذج اللغوية', 'الاسترجاع المعزّز (RAG)، الوكلاء الذكيون، وتقييم الأنظمة في بيئة الإنتاج.'] },
    { track: 'ai', level: 'beginner', weeks: 5,
      en: ['Data Science for Business', 'Analyse and visualise data, and make decisions backed by numbers.'],
      ar: ['علم البيانات للأعمال', 'تحليل البيانات وتصويرها واتخاذ قرارات مبنية على الأرقام.'] },
    { track: 'cyber', level: 'beginner', weeks: 5,
      en: ['Introduction to Cybersecurity', 'Core concepts, common threats and the basics of protecting systems.'],
      ar: ['مدخل إلى الأمن السيبراني', 'المفاهيم الأساسية، التهديدات الشائعة، وأساسيات حماية الأنظمة.'] },
    { track: 'cyber', level: 'intermediate', weeks: 8,
      en: ['Web Application Penetration Testing', 'OWASP Top 10 and hands-on labs for finding and reporting vulnerabilities.'],
      ar: ['اختبار اختراق تطبيقات الويب', 'OWASP Top 10 ومختبرات عملية لاكتشاف الثغرات والإبلاغ عنها.'] },
    { track: 'cyber', level: 'intermediate', weeks: 7,
      en: ['Network & Infrastructure Security', 'Firewalls, intrusion detection systems and server hardening.'],
      ar: ['أمن الشبكات والبنية التحتية', 'الجدران النارية، أنظمة كشف التسلّل، وتقوية الخوادم.'] },
    { track: 'cyber', level: 'advanced', weeks: 6,
      en: ['Incident Response & Forensics', 'Handling incidents, log analysis and collecting digital evidence.'],
      ar: ['الاستجابة للحوادث والتحليل الجنائي', 'التعامل مع الحوادث، تحليل السجلات، وجمع الأدلة الرقمية.'] },
    { track: 'chain', level: 'beginner', weeks: 4,
      en: ['Blockchain Fundamentals', 'How chains work, consensus mechanisms, wallets and cryptography.'],
      ar: ['أساسيات البلوك تشين', 'كيف تعمل السلاسل، آليات الإجماع، والمحافظ والتشفير.'] },
    { track: 'chain', level: 'intermediate', weeks: 8,
      en: ['Smart Contracts with Solidity', 'Write, test and securely deploy smart contracts on testnets.'],
      ar: ['تطوير العقود الذكية بـ Solidity', 'كتابة واختبار ونشر العقود الذكية بأمان على شبكات تجريبية.'] },
    { track: 'chain', level: 'advanced', weeks: 6,
      en: ['Building Decentralized Apps', 'Connect front ends to smart contracts and design Web3 user experiences.'],
      ar: ['بناء التطبيقات اللامركزية', 'ربط الواجهات بالعقود الذكية وتصميم تجربة مستخدم Web3.'] },
    { track: 'code', level: 'beginner', weeks: 6,
      en: ['Programming Fundamentals with Python', 'Computational thinking, data structures and writing clean code from day one.'],
      ar: ['أساسيات البرمجة بـ Python', 'التفكير البرمجي، هياكل البيانات، وكتابة كود نظيف من اليوم الأول.'] },
    { track: 'code', level: 'intermediate', weeks: 10,
      en: ['Full-Stack Web Development', 'HTML, CSS, JavaScript, React and Node.js to build complete applications.'],
      ar: ['تطوير الويب الشامل', 'HTML وCSS وJavaScript وReact وNode.js لبناء تطبيقات متكاملة.'] },
    { track: 'code', level: 'advanced', weeks: 8,
      en: ['Back-End Engineering', 'APIs, databases, testing and cloud deployment.'],
      ar: ['هندسة الخدمات الخلفية', 'واجهات API، قواعد البيانات، الاختبارات والنشر السحابي.'] }
  ];

  // ---- Courses grid + filters ----
  var grid = document.getElementById('courses-grid');
  var filters = document.querySelectorAll('.filter');

  function esc(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }

  function render(filter) {
    currentFilter = filter;
    var list = COURSES.filter(function (c) { return filter === 'all' || c.track === filter; });
    grid.innerHTML = list.map(function (c, i) {
      var txt = c[lang];
      return '<article class="course" style="animation-delay:' + (i * 40) + 'ms">' +
        '<div class="course-top"><span class="tag">' + esc(t('track.' + c.track)) + '</span>' +
        '<span class="level">' + esc(t('level.' + c.level)) + '</span></div>' +
        '<h3>' + esc(txt[0]) + '</h3>' +
        '<p>' + esc(txt[1]) + '</p>' +
        '<div class="course-foot"><span>' + esc(t('course.weeks', { n: c.weeks })) + '</span>' +
        '<a href="#join">' + esc(t('course.cta')) + '</a></div>' +
        '</article>';
    }).join('');
  }

  filters.forEach(function (btn) {
    btn.addEventListener('click', function () {
      filters.forEach(function (b) {
        b.classList.toggle('active', b === btn);
        b.setAttribute('aria-selected', b === btn ? 'true' : 'false');
      });
      render(btn.dataset.filter);
    });
  });

  // ---- Language switch (English default, Arabic optional) ----
  var langBtn = document.getElementById('lang-toggle');

  function applyLang(next) {
    lang = next;
    var root = document.documentElement;
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    document.title = t('meta.title');
    document.querySelectorAll('[data-i18n]').forEach(function (el) { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll('[data-i18n-html]').forEach(function (el) { el.innerHTML = t(el.dataset.i18nHtml); });
    document.querySelectorAll('[data-i18n-aria]').forEach(function (el) { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    langBtn.textContent = t('lang.switch');
    langBtn.setAttribute('lang', lang === 'ar' ? 'en' : 'ar');
    langBtn.setAttribute('aria-label', t('lang.switch'));
    render(currentFilter);
    var msg = document.querySelector('.form-msg');
    if (msg) { msg.textContent = ''; msg.className = 'form-msg'; }
    try { localStorage.setItem('sa-lang', lang); } catch (e) {}
  }

  langBtn.addEventListener('click', function () { applyLang(lang === 'ar' ? 'en' : 'ar'); });
  applyLang(lang);

  // ---- Mobile nav ----
  var toggle = document.querySelector('.nav-toggle');
  var nav = document.getElementById('main-nav');
  toggle.addEventListener('click', function () {
    var open = nav.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  nav.addEventListener('click', function (e) {
    if (e.target.tagName === 'A') {
      nav.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    }
  });

  // ---- Header shade on scroll ----
  var header = document.querySelector('.site-header');
  function onScroll() { header.classList.toggle('scrolled', window.scrollY > 20); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // ---- Counters ----
  function animateCounter(el) {
    var target = +el.dataset.target, suffix = el.dataset.suffix || '', start = null, dur = 1400;
    function step(ts) {
      if (!start) start = ts;
      var p = Math.min((ts - start) / dur, 1);
      el.textContent = Math.round(target * (1 - Math.pow(1 - p, 3))) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  // ---- Reveal on scroll ----
  var revealEls = document.querySelectorAll('.section-head, .track-card, .audience-card, .step, .instructor, .quote, .faq details, .join-form');
  var counters = document.querySelectorAll('.counter');
  if ('IntersectionObserver' in window) {
    revealEls.forEach(function (el) { el.classList.add('reveal'); });
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        if (entry.target.classList.contains('counter')) animateCounter(entry.target);
        else entry.target.classList.add('in');
        io.unobserve(entry.target);
      });
    }, { threshold: 0.15 });
    revealEls.forEach(function (el) { io.observe(el); });
    counters.forEach(function (el) { io.observe(el); });
  } else {
    counters.forEach(function (el) { el.textContent = el.dataset.target + (el.dataset.suffix || ''); });
  }

  // ---- Join form (front-end only) ----
  var form = document.getElementById('join-form');
  var msg = form.querySelector('.form-msg');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var name = form.name.value.trim();
    var email = form.email.value.trim();
    msg.className = 'form-msg';
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      msg.textContent = t('form.err');
      msg.classList.add('err');
      return;
    }
    msg.textContent = t('form.ok', { name: name });
    msg.classList.add('ok');
    form.reset();
  });

  document.getElementById('year').textContent = new Date().getFullYear();
})();
