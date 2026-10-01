/* لوحة المعلّم: تحليل الأداء + وضع المعلّم (قفل الباراميترات) + توصيات تصحيحية */
(function () {
  'use strict';
  const { el, fmt, duration } = STEAM.util;
  const store = STEAM.store;
  STEAM.ui.header('teacher');
  const app = document.getElementById('app');
  const st = store.get();
  const container = el('div', { class: 'container section' });
  app.append(container);

  if (sessionStorage.getItem('steam-teacher') === '1') render();
  else gate();

  function gate() {
    const pin = el('input', { class: 'input', type: 'password', inputmode: 'numeric', placeholder: 'الرمز السرّي', style: 'max-width:220px' });
    const go = () => {
      if (pin.value === st.teacher.pin) { sessionStorage.setItem('steam-teacher', '1'); container.innerHTML = ''; render(); }
      else { STEAM.ui.toast('الرمز غير صحيح'); pin.value = ''; }
    };
    pin.addEventListener('keydown', (e) => e.key === 'Enter' && go());
    container.append(el('div', { class: 'card', style: 'max-width:520px;margin:40px auto;text-align:center' },
      el('h1', {}, '👩‍🏫 وضع المعلّم'),
      el('p', {}, 'أدخل الرمز السرّي للوصول إلى لوحة المعلّم.'),
      el('div', { style: 'display:flex;gap:8px;justify-content:center' }, pin, el('button', { class: 'btn btn-primary', onclick: go }, 'دخول')),
      el('p', { class: 'hint', style: 'margin-top:12px' }, 'الرمز الافتراضي: 1234 (يمكن تغييره من الإعدادات).')));
    pin.focus();
  }

  function render() {
    const log = st.log;
    const ch = log.filter((l) => l.type === 'challenge');
    const qz = log.filter((l) => l.type === 'quiz');
    const ses = log.filter((l) => l.type === 'session');
    const succ = ch.filter((l) => l.success).length;
    const avgQuiz = qz.length ? qz.reduce((a, l) => a + l.score / l.total, 0) / qz.length : 0;
    const avgDur = ch.length ? ch.reduce((a, l) => a + l.duration, 0) / ch.length : 0;
    const timeSpent = ses.reduce((a, l) => a + l.duration, 0);

    container.append(el('div', { class: 'section-title' },
      el('h1', { style: 'margin:0' }, '📊 لوحة المعلّم'),
      el('div', { style: 'display:flex;gap:8px;flex-wrap:wrap' },
        el('button', { class: 'btn btn-sm', onclick: exportCSV }, '⬇️ تصدير CSV'),
        el('button', { class: 'btn btn-sm', onclick: exportJSON }, '⬇️ تصدير JSON'),
        el('button', { class: 'btn btn-sm', onclick: () => { sessionStorage.removeItem('steam-teacher'); location.reload(); } }, '🚪 خروج'))));

    container.append(el('div', { class: 'kpis' },
      kpi(fmt(ch.length), 'محاولات التحدّي'),
      kpi(ch.length ? fmt((succ / ch.length) * 100) + '%' : '—', 'نسبة النجاح'),
      kpi(ch.length ? duration(avgDur) : '—', 'متوسط مدة المحاولة'),
      kpi(qz.length ? fmt(avgQuiz * 100) + '%' : '—', 'متوسط الاختبارات'),
      kpi(timeSpent ? duration(timeSpent) : '—', 'وقت التفاعل الكلي'),
      kpi(`${fmt(store.badgeCount())} / ${fmt(STEAM.experiments.length)}`, 'الأوسمة المكتسبة')));

    // جدول حسب التجربة
    const rows = STEAM.experiments.map((e) => {
      const c = ch.filter((l) => l.exp === e.id), s = c.filter((l) => l.success).length;
      const q = qz.filter((l) => l.exp === e.id);
      const lastQ = q[q.length - 1];
      return el('tr', {},
        el('td', {}, `${e.icon} ${e.title}`),
        el('td', {}, fmt(c.length)),
        el('td', {}, fmt(s)),
        el('td', {}, c.length ? fmt((s / c.length) * 100) + '%' : '—'),
        el('td', {}, c.length ? duration(c.reduce((a, l) => a + l.duration, 0) / c.length) : '—'),
        el('td', {}, q.length ? fmt(q.length) : '—'),
        el('td', {}, lastQ ? `${fmt(lastQ.score)}/${fmt(lastQ.total)}` : '—'),
        el('td', {}, st.badges[e.id] ? '🏅' : '—'));
    });
    container.append(el('div', { class: 'card section', style: 'margin-top:20px' },
      el('h2', {}, '📈 الأداء حسب التجربة'),
      el('div', { class: 'table-wrap' }, el('table', { class: 'data' },
        el('thead', {}, el('tr', {}, ['التجربة', 'المحاولات', 'الناجحة', 'نسبة النجاح', 'متوسط المدة', 'مرات الاختبار', 'آخر نتيجة', 'الوسام'].map((h) => el('th', {}, h)))),
        el('tbody', {}, rows)))));

    // التوصيات
    const recs = recommendations(ch, qz);
    container.append(el('div', { class: 'card', style: 'margin-top:20px' },
      el('h2', {}, '💡 توصيات تلقائية للدروس التصحيحية'),
      recs.length ? recs.map((r) => el('div', { class: 'rec' }, el('strong', {}, r.title), el('div', {}, r.text))) : el('div', { class: 'empty' }, 'لا توجد أخطاء متكرّرة حالياً 👍')));

    // الإعدادات: الصف المفروض + القفل
    const forced = el('select', { class: 'input', style: 'max-width:240px', onchange: (e) => { st.teacher.forcedGrade = e.target.value ? +e.target.value : null; store.save(); STEAM.ui.toast('تم الحفظ'); } },
      el('option', { value: '' }, 'يختاره التلميذ'),
      [1, 2, 3, 4, 5, 6].map((g) => el('option', { value: g, selected: st.teacher.forcedGrade === g }, `الصف ${fmt(g)}`)));
    const pinIn = el('input', { class: 'input', type: 'text', inputmode: 'numeric', placeholder: 'رمز جديد', style: 'max-width:160px' });

    const fakeHost = { params: {}, level: 'advanced', challengeActive: () => false };
    const lockGrid = el('div', { class: 'lock-grid' }, STEAM.experiments.map((e) => {
      const def = STEAM.sims[e.id];
      const ctrls = def ? def.controls('advanced', fakeHost).filter((c) => c.type !== 'info') : [];
      return el('div', { class: 'card', style: 'box-shadow:none' },
        el('h3', {}, `${e.icon} ${e.title}`),
        ctrls.map((c) => el('label', {},
          el('input', { type: 'checkbox', checked: store.isLocked(e.id, c.id), onchange: (ev) => store.setLock(e.id, c.id, ev.target.checked) }),
          c.label.replace(/^[^\p{L}]+/u, ''))));
    }));

    container.append(el('div', { class: 'card', style: 'margin-top:20px' },
      el('h2', {}, '⚙️ وضع المعلّم'),
      el('div', { class: 'grid grid-2' },
        el('div', {}, el('h3', {}, 'تثبيت صف الدرس'), el('p', { class: 'hint' }, 'يحدّد مستوى المحاكاة (مبسّط/قياسي/متقدّم) لجميع التلاميذ على هذا الجهاز.'), forced),
        el('div', {}, el('h3', {}, 'تغيير الرمز السرّي'),
          el('div', { style: 'display:flex;gap:8px' }, pinIn, el('button', { class: 'btn btn-sm', onclick: () => { if (pinIn.value.length < 4) return STEAM.ui.toast('4 أرقام على الأقل'); st.teacher.pin = pinIn.value; store.save(); pinIn.value = ''; STEAM.ui.toast('تم تغيير الرمز'); } }, 'حفظ')))),
      el('h3', { style: 'margin-top:20px' }, '🔒 قفل الباراميترات لكل تجربة'),
      el('p', { class: 'hint' }, 'الباراميترات المقفلة تبقى على قيمها الافتراضية ولا يستطيع التلميذ تغييرها — مفيد لتبسيط الدرس والتركيز على متغيّر واحد.'),
      lockGrid));

    // السجل الخام
    const recent = log.slice(-150).reverse();
    const typeName = { challenge: 'تحدّي', quiz: 'اختبار', session: 'جلسة' };
    container.append(el('div', { class: 'card', style: 'margin-top:20px' },
      el('div', { class: 'section-title' }, el('h2', { style: 'margin:0' }, '🗂️ سجل البيانات (آخر 150)'),
        el('button', { class: 'btn btn-sm btn-danger', onclick: () => { if (confirm('حذف كل السجلات والأوسمة ونتائج الاختبارات؟')) { const t = st.teacher; store.reset(); store.get().teacher = t; store.save(); location.reload(); } } }, '🗑️ مسح البيانات')),
      recent.length ? el('div', { class: 'table-wrap', style: 'max-height:420px' }, el('table', { class: 'data' },
        el('thead', {}, el('tr', {}, ['الوقت', 'التلميذ', 'الصف', 'التجربة', 'النوع', 'النتيجة', 'المدة', 'الإعدادات'].map((h) => el('th', {}, h)))),
        el('tbody', {}, recent.map((l) => el('tr', {},
          el('td', {}, new Date(l.t).toLocaleString('ar-EG')),
          el('td', {}, l.student),
          el('td', {}, fmt(l.grade)),
          el('td', {}, (STEAM.getExperiment(l.exp) || {}).title || l.exp),
          el('td', {}, typeName[l.type] || l.type),
          el('td', {}, l.type === 'challenge' ? (l.success ? '✅ نجاح' : '❌ ' + (l.detail || 'فشل')) : l.type === 'quiz' ? `${fmt(l.score)}/${fmt(l.total)}` : '—'),
          el('td', {}, l.duration ? duration(l.duration) : '—'),
          el('td', { style: 'direction:ltr;font-size:12px;color:#5f5f6b' }, l.settings ? JSON.stringify(l.settings) : ''))))))
        : el('div', { class: 'empty' }, 'لا توجد بيانات بعد. ستظهر هنا محاولات التلاميذ ونتائجهم.')));
  }

  function kpi(v, l) { return el('div', { class: 'card kpi' }, el('div', { class: 'v' }, v), el('div', { class: 'l' }, l)); }

  function recommendations(ch, qz) {
    const out = [];
    for (const e of STEAM.experiments) {
      const c = ch.filter((l) => l.exp === e.id);
      const fails = c.filter((l) => !l.success).length;
      if (fails >= 3 && !c.some((l) => l.success)) {
        out.push({ title: `${e.icon} ${e.title}: ${fmt(fails)} محاولات فاشلة للتحدّي`, text: `أعد عرض الفيديو التمهيدي، ثم وجّه التلميذ إلى مؤشّر النجاح: «${e.challenge.success}». يمكنك قفل بعض الباراميترات لتقليل التشتّت.` });
      }
      const q = qz.filter((l) => l.exp === e.id);
      const wrongCount = {};
      q.forEach((l) => (l.wrong || []).forEach((n) => (wrongCount[n] = (wrongCount[n] || 0) + 1)));
      for (const [n, cnt] of Object.entries(wrongCount)) {
        if (cnt >= 2) {
          const qq = e.quiz[n - 1];
          out.push({ title: `${e.icon} ${e.title}: خطأ متكرّر في السؤال ${fmt(+n)} (${fmt(cnt)} مرات)`, text: `«${qq.q}» — مراجعة مقترحة: ${qq.explain}` });
        }
      }
    }
    return out;
  }

  function download(name, text, type) {
    const a = el('a', { href: URL.createObjectURL(new Blob([text], { type })), download: name });
    document.body.append(a); a.click(); a.remove();
  }
  function exportJSON() { download('steam-log.json', JSON.stringify(st.log, null, 2), 'application/json'); }
  function exportCSV() {
    const head = ['time', 'student', 'grade', 'experiment', 'type', 'success', 'score', 'total', 'duration_ms', 'detail', 'settings'];
    const q = (v) => '"' + String(v == null ? '' : v).replace(/"/g, '""') + '"';
    const lines = st.log.map((l) => [new Date(l.t).toISOString(), l.student, l.grade, l.exp, l.type, l.success, l.score, l.total, l.duration, l.detail, l.settings ? JSON.stringify(l.settings) : ''].map(q).join(','));
    download('steam-log.csv', '﻿' + [head.join(','), ...lines].join('\n'), 'text/csv');
  }
})();
