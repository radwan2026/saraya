(function () {
  'use strict';

  var TRACKS = {
    ai: 'الذكاء الاصطناعي',
    cyber: 'الأمن السيبراني',
    chain: 'البلوك تشين',
    code: 'البرمجة'
  };

  var COURSES = [
    { track: 'ai', title: 'أساسيات تعلّم الآلة', level: 'مبتدئ', weeks: 6, desc: 'الانحدار، التصنيف، وتقييم النماذج باستخدام Python وscikit-learn.' },
    { track: 'ai', title: 'التعلّم العميق التطبيقي', level: 'متوسط', weeks: 8, desc: 'الشبكات العصبية والرؤية الحاسوبية وبناء نماذج بـ PyTorch.' },
    { track: 'ai', title: 'هندسة تطبيقات النماذج اللغوية', level: 'متقدّم', weeks: 6, desc: 'الاسترجاع المعزّز (RAG)، الوكلاء الذكيون، وتقييم الأنظمة في بيئة الإنتاج.' },
    { track: 'ai', title: 'علم البيانات للأعمال', level: 'مبتدئ', weeks: 5, desc: 'تحليل البيانات وتصويرها واتخاذ قرارات مبنية على الأرقام.' },
    { track: 'cyber', title: 'مدخل إلى الأمن السيبراني', level: 'مبتدئ', weeks: 5, desc: 'المفاهيم الأساسية، التهديدات الشائعة، وأساسيات حماية الأنظمة.' },
    { track: 'cyber', title: 'اختبار اختراق تطبيقات الويب', level: 'متوسط', weeks: 8, desc: 'OWASP Top 10 ومختبرات عملية لاكتشاف الثغرات والإبلاغ عنها.' },
    { track: 'cyber', title: 'أمن الشبكات والبنية التحتية', level: 'متوسط', weeks: 7, desc: 'الجدران النارية، أنظمة كشف التسلّل، وتقوية الخوادم.' },
    { track: 'cyber', title: 'الاستجابة للحوادث والتحليل الجنائي', level: 'متقدّم', weeks: 6, desc: 'التعامل مع الحوادث، تحليل السجلات، وجمع الأدلة الرقمية.' },
    { track: 'chain', title: 'أساسيات البلوك تشين', level: 'مبتدئ', weeks: 4, desc: 'كيف تعمل السلاسل، آليات الإجماع، والمحافظ والتشفير.' },
    { track: 'chain', title: 'تطوير العقود الذكية بـ Solidity', level: 'متوسط', weeks: 8, desc: 'كتابة واختبار ونشر العقود الذكية بأمان على شبكات تجريبية.' },
    { track: 'chain', title: 'بناء التطبيقات اللامركزية', level: 'متقدّم', weeks: 6, desc: 'ربط الواجهات بالعقود الذكية وتصميم تجربة مستخدم Web3.' },
    { track: 'code', title: 'أساسيات البرمجة بـ Python', level: 'مبتدئ', weeks: 6, desc: 'التفكير البرمجي، هياكل البيانات، وكتابة كود نظيف من اليوم الأول.' },
    { track: 'code', title: 'تطوير الويب الشامل', level: 'متوسط', weeks: 10, desc: 'HTML وCSS وJavaScript وReact وNode.js لبناء تطبيقات متكاملة.' },
    { track: 'code', title: 'هندسة الخدمات الخلفية', level: 'متقدّم', weeks: 8, desc: 'واجهات API، قواعد البيانات، الاختبارات والنشر السحابي.' }
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
    var list = COURSES.filter(function (c) { return filter === 'all' || c.track === filter; });
    grid.innerHTML = list.map(function (c, i) {
      return '<article class="course" style="animation-delay:' + (i * 40) + 'ms">' +
        '<div class="course-top"><span class="tag">' + esc(TRACKS[c.track]) + '</span>' +
        '<span class="level">' + esc(c.level) + '</span></div>' +
        '<h3>' + esc(c.title) + '</h3>' +
        '<p>' + esc(c.desc) + '</p>' +
        '<div class="course-foot"><span>' + c.weeks + ' أسابيع</span>' +
        '<a href="#join">سجّل اهتمامك ←</a></div>' +
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
  render('all');

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
      msg.textContent = 'يرجى إدخال الاسم وبريد إلكتروني صحيح.';
      msg.classList.add('err');
      return;
    }
    msg.textContent = 'شكراً ' + name + '! تم استلام طلبك وسنتواصل معك قريباً.';
    msg.classList.add('ok');
    form.reset();
  });

  document.getElementById('year').textContent = new Date().getFullYear();
})();
