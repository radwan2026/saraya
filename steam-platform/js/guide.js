/* دليل المحتوى: ورقة درس لكل تجربة وفق القالب الموحّد (قابلة للطباعة) */
(function () {
  'use strict';
  const { el, fmt } = STEAM.util;
  STEAM.ui.header('guide');
  const app = document.getElementById('app');
  const c = el('div', { class: 'container section' });
  app.append(c);

  c.append(el('div', { class: 'section-title' },
    el('div', {}, el('h1', { style: 'margin:0' }, '📚 دليل المحتوى'), el('p', { class: 'hint', style: 'margin:0' }, 'ورقة محتوى لكل درس — جاهزة للمعلّم أو المطوّر أو المصمّم.')),
    el('button', { class: 'btn btn-primary no-print', onclick: () => window.print() }, '🖨️ طباعة الدليل')));

  c.append(el('div', { class: 'card no-print', style: 'margin-bottom:20px' },
    el('strong', {}, 'الفهرس: '),
    STEAM.experiments.map((e, i) => el('a', { href: '#' + e.id, class: 'tag purple', style: 'margin:4px;display:inline-block' }, `${fmt(i + 1)}. ${e.title}`))));

  STEAM.experiments.forEach((e, i) => {
    c.append(el('article', { class: 'card unit', id: e.id },
      el('h2', {}, `${fmt(i + 1)}) ${e.icon} ${e.title} — `, el('span', { style: 'direction:ltr;unicode-bidi:isolate' }, e.en)),
      el('ol', { class: 'tpl' },
        el('li', {}, el('strong', {}, 'اسم التجربة + الصف المقترح: '), `${e.title} — الصفوف ${fmt(e.grades[0])}–${fmt(e.grades[1])}`),
        el('li', {}, el('strong', {}, 'أهداف التعلّم:'), el('ul', {}, e.objectives.map((o) => el('li', {}, o)))),
        el('li', {}, el('strong', {}, 'وصف المحاكاة الرقمية (UX) وتفاعل التلميذ:'), el('ul', {}, e.ux.map((o) => el('li', {}, o)))),
        el('li', {}, el('strong', {}, 'باراميترات قابلة للتعديل:'), el('ul', {}, e.params.map((o) => el('li', {}, o)))),
        el('li', {}, el('strong', {}, 'النموذج الفيزيائي/المنطقي المبسّط:'), el('pre', {}, e.model)),
        el('li', {}, el('strong', {}, 'المهمة التفاعلية / التحدّي: '), `«${e.challenge.title}» — ${e.challenge.text}`, el('br'), el('em', {}, 'مؤشّر النجاح: '), e.challenge.success),
        el('li', {}, el('strong', {}, 'أسئلة التقييم:'), el('ol', {}, e.quiz.map((q) => el('li', {}, q.q, ' ', el('span', { class: 'tag green' }, 'الإجابة: ' + q.options[q.answer]))))),
        el('li', {}, el('strong', {}, 'امتدادات صفّية:'), el('ul', {}, el('li', {}, 'تبسيط: ' + e.extensions.lower), el('li', {}, 'توسيع: ' + e.extensions.upper))),
        el('li', {}, el('strong', {}, 'ملاحظات الأمان للتجربة الحقيقية:'), el('ul', {}, e.safety.map((o) => el('li', {}, o)))),
        el('li', {}, el('strong', {}, 'مستوى تعقيد التطوير + التقنيات: '), e.complexity, ' — ', e.tech.join('، '))),
      el('a', { class: 'btn btn-sm no-print', href: `experiment.html?id=${e.id}` }, 'افتح التجربة ←')));
  });

  const sec = (title, items) => el('div', { class: 'card unit' }, el('h2', {}, title), el('ul', {}, items.map((x) => el('li', {}, x))));
  c.append(
    sec('🎓 اقتراحات عامة للتعليم والتقييم (مطبّقة في المنصّة)', [
      'وسام (Badge) عند إتمام تحدّي كل تجربة، وشهادة بسيطة عند إتمام سلسلة 5 تجارب.',
      'سجل بيانات: وقت التفاعل، إعدادات التلميذ، نجاح/فشل المحاولات — يُعرض في لوحة المعلّم.',
      'وضع المعلّم: قفل باراميترات معيّنة (مثل منع تعديل درجة الحرارة) وتثبيت صف الدرس.',
      'تسلسل الدرس: فيديو تمهيدي ← محاكاة ← تحدّي ← اختبار فوري ← نشاط منزلي مع تعليمات الأمان.',
    ]),
    sec('🎨 موارد الواجهة لكل وحدة', [
      'أيقونات وأصول رسومية (إناء، قنينة، بركان، نبتة، سحب، قطرات) — مرسومة برمجياً على Canvas.',
      'جسيمات (قطرات، فقاعات، بخار) — نظام جسيمات خفيف داخل كل محاكاة.',
      'مؤثرات صوتية قصيرة — مولّدة عبر WebAudio دون ملفات خارجية.',
      'قراءة صوتية (TTS) للأهداف والتعليمات والأسئلة لتسهيل الاستخدام على الصفوف الدنيا.',
    ]),
    sec('🗂️ البيانات التي تُسجَّل وتُعرض للمعلّم', [
      'إعدادات التجربة المستخدمة في كل محاولة.',
      'عدد المحاولات ومدّة كل محاولة.',
      'نتيجة التقييم الفوري لكل درس والأسئلة الخاطئة.',
      'توصية تلقائية للدرس التصحيحي عند تكرار الخطأ.',
    ]),
    sec('⏱️ تقدير تعقيد التنفيذ', [
      'MVP تفاعلي (نسخ رقمية مبسّطة لكل تجربة): 8–12 أسبوع عمل لفريق صغير (1–2 مطوّر واجهات، 1 مطوّر محاكاة، 1 مصمّم محتوى).',
      'يمكن إطلاق تجريبي بـ3–4 تجارب أولية ثم إضافة الباقي.',
      'هذا النموذج الأوّلي يغطّي التجارب السبع كاملة بتقنيات الويب القياسية (HTML/CSS/JS + Canvas) دون مكتبات خارجية.',
    ]));
})();
