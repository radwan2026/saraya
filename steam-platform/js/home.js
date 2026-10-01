/* الصفحة الرئيسية: ملف التلميذ + شبكة التجارب + الأوسمة + الشهادة */
(function () {
  'use strict';
  const { el, fmt } = STEAM.util;
  const store = STEAM.store;
  STEAM.ui.header('home');
  const app = document.getElementById('app');
  const st = store.get();

  const nameIn = el('input', { type: 'text', placeholder: 'اكتب اسمك', value: st.profile.name || '', maxlength: 40 });
  const gradeSel = el('select', {}, [1, 2, 3, 4, 5, 6].map((g) => el('option', { value: g, selected: g === store.grade() }, `الصف ${fmt(g)}`)));
  if (st.teacher.forcedGrade) gradeSel.disabled = true;
  nameIn.addEventListener('change', () => { store.setProfile({ name: nameIn.value.trim() }); STEAM.ui.toast('تم حفظ الاسم'); });
  gradeSel.addEventListener('change', () => { store.setProfile({ grade: +gradeSel.value }); renderGrid(); renderStats(); });

  const stats = el('div', { class: 'stats-row' });
  app.append(el('section', { class: 'hero' },
    el('div', { class: 'container hero-grid' },
      el('div', {},
        el('h1', {}, 'اكتشف العلوم باللعب! 🔬'),
        el('p', {}, 'سبع تجارب علمية تفاعلية: شاهد، جرّب، غيّر المتغيّرات، اربح الأوسمة، واحصل على شهادة العالِم الصغير.'),
        stats),
      el('div', { class: 'profile-card' },
        el('label', {}, 'اسم التلميذ/ة'), nameIn,
        el('label', {}, 'الصف'), gradeSel,
        st.teacher.forcedGrade ? el('div', { style: 'font-size:13px' }, '🔒 الصف محدّد من قِبل المعلّم') : el('div', { style: 'font-size:13px;opacity:.9' }, 'يتكيّف مستوى المحاكاة تلقائياً حسب الصف')))));

  function renderStats() {
    const n = store.badgeCount();
    const lvl = { simple: 'مبسّط', standard: 'قياسي', advanced: 'متقدّم' }[store.level()];
    stats.innerHTML = '';
    stats.append(
      el('span', { class: 'stat-pill' }, `🏅 الأوسمة: ${fmt(n)} / ${fmt(STEAM.experiments.length)}`),
      el('span', { class: 'stat-pill' }, `🎚️ المستوى: ${lvl}`),
      n >= STEAM.CERT_THRESHOLD
        ? el('button', { class: 'btn btn-sm', onclick: () => STEAM.ui.certificate() }, '🎓 عرض شهادتي')
        : el('span', { class: 'stat-pill' }, `🎓 الشهادة بعد ${fmt(STEAM.CERT_THRESHOLD - n)} تجارب`));
  }
  renderStats();

  // كيف يسير الدرس
  const flow = [['🎬', 'فيديو تمهيدي'], ['🧪', 'المحاكاة'], ['⭐', 'التحدّي'], ['📝', 'اختبار فوري'], ['🏠', 'نشاط منزلي آمن']];
  app.append(el('section', { class: 'section' }, el('div', { class: 'container' },
    el('div', { class: 'card', style: 'display:flex;gap:12px;flex-wrap:wrap;align-items:center;justify-content:space-between' },
      el('strong', {}, 'تسلسل كل درس:'),
      ...flow.map(([i, t], k) => el('span', { class: 'tag purple', style: 'font-size:14px;padding:6px 14px' }, `${fmt(k + 1)}. ${i} ${t}`))))));

  // الشبكة
  let onlyMine = false;
  const grid = el('div', { class: 'grid grid-3' });
  const filterBtn = el('button', { class: 'btn btn-outline btn-sm', onclick: () => { onlyMine = !onlyMine; filterBtn.textContent = onlyMine ? 'عرض كل التجارب' : 'المناسبة لصفّي فقط'; renderGrid(); } }, 'المناسبة لصفّي فقط');
  app.append(el('section', { class: 'section', style: 'padding-top:0' }, el('div', { class: 'container' },
    el('div', { class: 'section-title' }, el('h2', {}, '🧪 التجارب'), filterBtn), grid)));

  function renderGrid() {
    grid.innerHTML = '';
    const g = store.grade();
    for (const e of STEAM.experiments) {
      const fits = g >= e.grades[0] && g <= e.grades[1];
      if (onlyMine && !fits) continue;
      const badge = st.badges[e.id];
      const q = st.quiz[e.id];
      grid.append(el('article', { class: 'card exp-card' + (fits ? '' : ' dimmed') },
        badge ? el('span', { class: 'badge-earned' }, '🏅 وسام') : null,
        el('div', { class: 'thumb' }, e.icon),
        el('div', { class: 'body' },
          el('div', { class: 'en' }, e.en),
          el('h3', {}, e.title),
          el('p', { class: 'hint', style: 'margin:0' }, e.summary),
          el('div', { class: 'tags' },
            el('span', { class: 'tag purple' }, `الصفوف ${fmt(e.grades[0])}–${fmt(e.grades[1])}`),
            q ? el('span', { class: 'tag ' + (q.score === q.total ? 'green' : 'orange') }, `الاختبار ${fmt(q.score)}/${fmt(q.total)}`) : null,
            !fits ? el('span', { class: 'tag' }, 'خارج نطاق صفّك') : null),
          el('div', { class: 'actions' },
            el('a', { class: 'btn btn-primary btn-sm', href: `experiment.html?id=${e.id}` }, badge ? 'العب مجدداً' : 'ابدأ التجربة ←')))));
    }
    if (!grid.children.length) grid.append(el('div', { class: 'empty card' }, 'لا توجد تجارب مقترحة لهذا الصف.'));
  }
  renderGrid();

  // الأوسمة
  const badgesBox = el('div', { class: 'badges' }, STEAM.experiments.map((e) => el('div', { class: 'badge' + (st.badges[e.id] ? ' earned' : ''), title: e.title }, el('div', { class: 'medal' }, e.icon), e.title)));
  const n = store.badgeCount();
  app.append(el('section', { class: 'section', style: 'padding-top:0' }, el('div', { class: 'container' },
    el('div', { class: 'card' },
      el('div', { class: 'section-title' }, el('h2', { style: 'margin:0' }, '🏅 أوسمتي'),
        el('span', { class: 'hint' }, `أكمل تحدّيات ${fmt(STEAM.CERT_THRESHOLD)} تجارب لتحصل على الشهادة`)),
      el('div', { class: 'progress', style: 'margin-bottom:18px' }, el('span', { style: `width:${Math.min(100, (n / STEAM.CERT_THRESHOLD) * 100)}%` })),
      badgesBox))));
})();
