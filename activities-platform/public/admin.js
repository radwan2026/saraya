// لوحة تحكم لجنة الأنشطة — تُعرض الأقسام حسب صلاحيات كل عضو.
const $view = document.getElementById('view');
let ME = null;
let LABELS = {};
let CFG = null; // الإعدادات العامة (التصنيفات وأنواع المنشورات...)

const can = (perm) => perm === 'admin' ? ME.role === 'admin' : ME.permissions.includes(perm);
const nowLocal = (offsetDays = 0) => {
  const d = new Date(Date.now() + offsetDays * 864e5);
  d.setSeconds(0, 0);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
};
const windowStatus = (x) => {
  const now = Date.now();
  if (now < parseLocal(x.startsAt)?.getTime()) return 'upcoming';
  if (now > parseLocal(x.endsAt)?.getTime()) return 'ended';
  return 'active';
};
const yesNo = (v) => (v ? '<span class="badge">نعم</span>' : '<span class="badge gray">لا</span>');

// ---------- النموذج المنبثق ----------
const modal = document.getElementById('modal');
let modalSubmit = null;
function openModal(title, bodyHtml, onSubmit, { saveLabel = 'حفظ' } = {}) {
  document.getElementById('modalTitle').textContent = title;
  document.getElementById('modalBody').innerHTML = bodyHtml;
  document.getElementById('modalMsg').innerHTML = '';
  document.getElementById('modalSave').textContent = saveLabel;
  document.getElementById('modalSave').hidden = !onSubmit;
  modalSubmit = onSubmit;
  modal.showModal();
  bindImageFields(document.getElementById('modalBody'));
  return document.getElementById('modalBody');
}
const closeModal = () => modal.close();
document.getElementById('modalClose').addEventListener('click', closeModal);
document.getElementById('modalCancel').addEventListener('click', closeModal);
document.getElementById('modalForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!modalSubmit) { closeModal(); return; }
  const btn = document.getElementById('modalSave');
  btn.disabled = true;
  try {
    await modalSubmit(document.getElementById('modalBody'));
    closeModal();
  } catch (err) {
    document.getElementById('modalMsg').innerHTML = `<div class="alert err">${esc(err.message)}</div>`;
  } finally {
    btn.disabled = false;
  }
});

// ---------- مولّد الحقول ----------
function fieldHtml(f, v) {
  const val = v ?? f.default ?? '';
  const req = f.required ? 'required' : '';
  const label = `<label>${esc(f.label)} ${f.required ? '<span class="req">*</span>' : ''}</label>`;
  const help = f.help ? `<small>${esc(f.help)}</small>` : '';
  const cls = `field ${f.full ? 'full' : ''}`;
  switch (f.type) {
    case 'textarea':
      return `<div class="${cls}">${label}<textarea class="input" name="${f.name}" ${req} rows="${f.rows || 4}">${esc(val)}</textarea>${help}</div>`;
    case 'select':
      return `<div class="${cls}">${label}<select class="input" name="${f.name}">${Object.entries(f.options).map(([k, l]) => `<option value="${esc(k)}" ${String(val) === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>${help}</div>`;
    case 'checkbox':
      return `<div class="${cls}"><label class="check"><input type="checkbox" name="${f.name}" ${val ? 'checked' : ''}> <span>${esc(f.label)}</span></label>${help}</div>`;
    case 'image':
      return `<div class="${cls}">${label}<div class="img-field" data-image>
        <div class="preview" style="${val ? `background-image:url('${esc(val)}')` : ''}"></div>
        <input class="input" name="${f.name}" value="${esc(val)}" placeholder="رابط الصورة أو ارفع ملفاً" dir="ltr">
        <label class="btn small ghost">رفع<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden></label>
      </div>${help}</div>`;
    default:
      return `<div class="${cls}">${label}<input class="input" type="${f.type || 'text'}" name="${f.name}" value="${esc(val)}" ${req} ${f.type === 'number' ? 'min="0"' : ''} ${f.dir ? `dir="${f.dir}"` : ''}>${help}</div>`;
  }
}

function bindImageFields(root) {
  root.querySelectorAll('[data-image]').forEach((box) => {
    const input = box.querySelector('input[name]');
    const preview = box.querySelector('.preview');
    input.addEventListener('input', () => { preview.style.backgroundImage = input.value ? `url('${input.value}')` : ''; });
    box.querySelector('input[type=file]').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      try {
        const dataUrl = await readImage(file);
        const r = await api('/api/admin/upload', { method: 'POST', body: { dataUrl } });
        input.value = r.url;
        preview.style.backgroundImage = `url('${r.url}')`;
        toast('تم رفع الصورة');
      } catch (err) { toast(err.message, true); }
    });
  });
}

function readFields(root, fields) {
  const out = {};
  for (const f of fields) {
    const el = root.querySelector(`[name="${f.name}"]`);
    if (!el) continue;
    out[f.name] = f.type === 'checkbox' ? el.checked : el.value;
  }
  return out;
}

// ---------- بناء أسئلة المسابقة وخيارات التصويت ----------
function questionBlock(q = { text: '', options: [], correct: 0 }, i = 0) {
  const options = [...q.options, '', '', '', ''].slice(0, Math.max(4, q.options.length));
  const name = `correct-${Math.random().toString(36).slice(2)}`;
  return `<div class="q-block" data-qid="${esc(q.id || '')}">
    <div class="flex"><b>سؤال</b><span class="spacer"></span><button type="button" class="icon-btn" data-del-q title="حذف السؤال">🗑</button></div>
    <input class="input" data-q-text value="${esc(q.text)}" placeholder="نص السؤال ${i + 1}">
    <small class="muted">اكتب الخيارات وحدد الإجابة الصحيحة بالدائرة:</small>
    <div data-opts>${options.map((o, k) => `<div class="opt"><input type="radio" name="${name}" ${q.correct === k ? 'checked' : ''}><input class="input" data-opt value="${esc(o)}" placeholder="خيار ${k + 1}"></div>`).join('')}</div>
  </div>`;
}

function questionsBuilder(questions = []) {
  return `<div class="field full"><label>أسئلة المسابقة <span class="req">*</span></label><div class="builder" id="qBuilder">
    ${(questions.length ? questions : [undefined]).map((q, i) => questionBlock(q, i)).join('')}
  </div><button type="button" class="btn small ghost" id="addQ" style="justify-self:start;margin-top:8px">+ إضافة سؤال</button></div>`;
}

function bindQuestionsBuilder(root) {
  const b = root.querySelector('#qBuilder');
  root.querySelector('#addQ').addEventListener('click', () => b.insertAdjacentHTML('beforeend', questionBlock(undefined, b.children.length)));
  b.addEventListener('click', (e) => { if (e.target.closest('[data-del-q]')) e.target.closest('.q-block').remove(); });
}

const readQuestions = (root) => [...root.querySelectorAll('.q-block')].map((blk) => {
  const opts = [...blk.querySelectorAll('.opt')];
  return {
    id: blk.dataset.qid || undefined,
    text: blk.querySelector('[data-q-text]').value,
    options: opts.map((o) => o.querySelector('[data-opt]').value),
    correct: Math.max(0, opts.findIndex((o) => o.querySelector('input[type=radio]').checked)),
  };
}).map((q) => {
  // إزالة الخيارات الفارغة مع الحفاظ على مؤشر الإجابة الصحيحة
  const keep = q.options.map((o, i) => [o.trim(), i]).filter(([o]) => o);
  return { ...q, options: keep.map(([o]) => o), correct: Math.max(0, keep.findIndex(([, i]) => i === q.correct)) };
});

function optionsBuilder(options = []) {
  const list = options.length ? options : [{ label: '' }, { label: '' }];
  return `<div class="field full"><label>خيارات التصويت <span class="req">*</span></label><div class="builder" id="oBuilder">
    ${list.map((o) => `<div class="opt flex"><input class="input" data-oid="${esc(o.id || '')}" value="${esc(o.label)}" placeholder="الخيار" style="flex:1"><button type="button" class="icon-btn" data-del-o>🗑</button></div>`).join('')}
  </div><button type="button" class="btn small ghost" id="addO" style="justify-self:start;margin-top:8px">+ إضافة خيار</button></div>`;
}

function bindOptionsBuilder(root) {
  const b = root.querySelector('#oBuilder');
  root.querySelector('#addO').addEventListener('click', () => b.insertAdjacentHTML('beforeend', '<div class="opt flex"><input class="input" data-oid="" placeholder="الخيار" style="flex:1"><button type="button" class="icon-btn" data-del-o>🗑</button></div>'));
  b.addEventListener('click', (e) => { if (e.target.closest('[data-del-o]')) e.target.closest('.opt').remove(); });
}

const readOptions = (root) => [...root.querySelectorAll('#oBuilder input')].map((i) => ({ id: i.dataset.oid || undefined, label: i.value }));

// ---------- تعريف الموارد ----------
const RES = {
  activities: {
    title: 'الأنشطة', single: 'نشاط', perm: 'activities', icon: '🏆',
    fields: () => [
      { name: 'title', label: 'عنوان النشاط', required: true, full: true },
      { name: 'category', label: 'التصنيف', type: 'select', options: CFG.categories },
      { name: 'status', label: 'حالة التسجيل', type: 'select', options: { open: 'مفتوح', closed: 'مغلق', completed: 'منتهي' } },
      { name: 'startDate', label: 'تاريخ البداية', type: 'date' },
      { name: 'endDate', label: 'تاريخ النهاية', type: 'date' },
      { name: 'deadline', label: 'آخر موعد للتسجيل', type: 'date' },
      { name: 'capacity', label: 'العدد المطلوب', type: 'number', default: 0, help: '0 = بدون حد' },
      { name: 'location', label: 'المكان', full: true },
      { name: 'image', label: 'صورة النشاط', type: 'image', full: true },
      { name: 'description', label: 'الوصف والشروط', type: 'textarea', full: true, rows: 5 },
      { name: 'requiresApproval', label: 'يتطلب موافقة اللجنة قبل إصدار البطاقة', type: 'checkbox', default: true },
      { name: 'published', label: 'منشور في المنصة', type: 'checkbox', default: true },
    ],
    columns: [
      ['', (r) => `<div class="thumb" style="${r.image ? `background-image:url('${esc(r.image)}')` : ''}"></div>`],
      ['العنوان', (r) => `<b>${esc(r.title)}</b>`],
      ['التصنيف', (r) => esc(CFG.categories[r.category])],
      ['التاريخ', (r) => fmtDate(r.startDate)],
      ['الحالة', (r) => statusBadge(r.status)],
      ['منشور', (r) => yesNo(r.published)],
    ],
    rowActions: (r) => `<a class="btn small ghost" href="#/registrations?activityId=${r.id}">التسجيلات</a>`,
  },
  posts: {
    title: 'الإعلانات والأخبار والقرارات', single: 'منشور', perm: 'posts', icon: '📢',
    fields: () => [
      { name: 'type', label: 'النوع', type: 'select', options: CFG.postTypes },
      { name: 'publishedAt', label: 'تاريخ النشر', type: 'date', default: new Date().toISOString().slice(0, 10) },
      { name: 'title', label: 'العنوان', required: true, full: true },
      { name: 'summary', label: 'ملخص قصير', type: 'textarea', full: true, rows: 2 },
      { name: 'body', label: 'النص الكامل', type: 'textarea', full: true, rows: 8 },
      { name: 'image', label: 'الصورة', type: 'image', full: true },
      { name: 'pinned', label: 'عرض في المساحة الإعلانية بالواجهة الرئيسية', type: 'checkbox' },
      { name: 'published', label: 'منشور', type: 'checkbox', default: true },
    ],
    columns: [
      ['العنوان', (r) => `<b>${esc(r.title)}</b>`],
      ['النوع', (r) => esc(CFG.postTypes[r.type])],
      ['التاريخ', (r) => fmtDate(r.publishedAt)],
      ['إعلان مثبت', (r) => yesNo(r.pinned)],
      ['منشور', (r) => yesNo(r.published)],
    ],
  },
  quizzes: {
    title: 'المسابقة الأسبوعية', single: 'مسابقة', perm: 'quizzes', icon: '🎁',
    fields: () => [
      { name: 'title', label: 'عنوان المسابقة', required: true, full: true },
      { name: 'description', label: 'الوصف', type: 'textarea', full: true, rows: 2 },
      { name: 'prize', label: 'الجائزة', default: 'رصيد مكالمات بقيمة 20 دينار لكل فائز', full: true },
      { name: 'startsAt', label: 'تبدأ', type: 'datetime-local', required: true, default: nowLocal(0) },
      { name: 'endsAt', label: 'تنتهي', type: 'datetime-local', required: true, default: nowLocal(7) },
      { name: 'winnersCount', label: 'عدد الفائزين', type: 'number', default: 3 },
      { name: 'published', label: 'منشورة', type: 'checkbox', default: true },
    ],
    extra: (r) => questionsBuilder(r?.questions),
    bindExtra: bindQuestionsBuilder,
    readExtra: (root) => ({ questions: readQuestions(root) }),
    columns: [
      ['العنوان', (r) => `<b>${esc(r.title)}</b>`],
      ['الفترة', (r) => `${fmtDateTime(r.startsAt)}<br>${fmtDateTime(r.endsAt)}`],
      ['الحالة', (r) => statusBadge(windowStatus(r))],
      ['الأسئلة', (r) => r.questions.length],
      ['الفائزون', (r) => `${(r.winners || []).length} / ${r.winnersCount}`],
    ],
    rowActions: (r) => `<a class="btn small gold" href="#/quiz/${r.id}">المشاركات والسحب</a>`,
  },
  polls: {
    title: 'التصويت على المشاريع والبرامج', single: 'تصويت', perm: 'polls', icon: '🗳️',
    fields: () => [
      { name: 'title', label: 'عنوان التصويت / المشروع', required: true, full: true },
      { name: 'description', label: 'الوصف', type: 'textarea', full: true, rows: 3 },
      { name: 'startsAt', label: 'يبدأ', type: 'datetime-local', required: true, default: nowLocal(0) },
      { name: 'endsAt', label: 'ينتهي', type: 'datetime-local', required: true, default: nowLocal(14) },
      { name: 'resultsVisibility', label: 'إظهار النتائج للموظفين', type: 'select', options: { always: 'دائماً', after_close: 'بعد إغلاق التصويت', admin: 'للجنة فقط' } },
      { name: 'published', label: 'منشور', type: 'checkbox', default: true },
    ],
    extra: (r) => optionsBuilder(r?.options),
    bindExtra: bindOptionsBuilder,
    readExtra: (root) => ({ options: readOptions(root) }),
    columns: [
      ['العنوان', (r) => `<b>${esc(r.title)}</b>`],
      ['الفترة', (r) => `${fmtDateTime(r.startsAt)}<br>${fmtDateTime(r.endsAt)}`],
      ['الحالة', (r) => statusBadge(windowStatus(r))],
      ['الخيارات', (r) => r.options.length],
    ],
    rowActions: (r) => `<a class="btn small gold" href="#/poll/${r.id}">النتائج</a>`,
  },
  members: {
    title: 'أعضاء اللجنة', single: 'عضو', perm: 'members', icon: '👥',
    fields: () => [
      { name: 'name', label: 'الاسم', required: true },
      { name: 'position', label: 'الصفة في اللجنة', required: true },
      { name: 'jobTitle', label: 'الوظيفة في الشركة' },
      { name: 'department', label: 'الإدارة / الفرع' },
      { name: 'email', label: 'البريد الإلكتروني', dir: 'ltr' },
      { name: 'order', label: 'ترتيب العرض', type: 'number', default: 10 },
      { name: 'photo', label: 'الصورة الشخصية', type: 'image', full: true },
      { name: 'tasks', label: 'المهام (كل مهمة في سطر)', type: 'textarea', full: true, rows: 5 },
      { name: 'bio', label: 'السيرة الذاتية', type: 'textarea', full: true, rows: 6 },
    ],
    columns: [
      ['#', (r) => r.order],
      ['', (r) => `<div class="thumb" style="width:40px;height:40px;border-radius:50%;${r.photo ? `background-image:url('${esc(r.photo)}')` : ''}"></div>`],
      ['الاسم', (r) => `<b>${esc(r.name)}</b>`],
      ['الصفة', (r) => esc(r.position)],
      ['الإدارة', (r) => esc(r.department)],
    ],
  },
  stars: {
    title: 'نجم الأسبوع', single: 'نجم أسبوع', perm: 'stars', icon: '⭐',
    fields: () => [
      { name: 'name', label: 'اسم الموظف', required: true },
      { name: 'employeeId', label: 'الرقم الوظيفي' },
      { name: 'jobTitle', label: 'الوصف الوظيفي' },
      { name: 'department', label: 'الإدارة / المكتب' },
      { name: 'weekOf', label: 'أسبوع التكريم', type: 'date', required: true, default: new Date().toISOString().slice(0, 10) },
      { name: 'reason', label: 'سبب الاختيار (الفكرة / البرنامج / النشاط)' },
      { name: 'photo', label: 'الصورة', type: 'image', full: true },
      { name: 'achievements', label: 'نبذة عن الإنجاز', type: 'textarea', full: true, rows: 5 },
      { name: 'published', label: 'منشور في المنصة', type: 'checkbox', default: true },
    ],
    columns: [
      ['الأسبوع', (r) => fmtDate(r.weekOf)],
      ['الاسم', (r) => `<b>${esc(r.name)}</b>`],
      ['الإدارة', (r) => esc(r.department)],
      ['السبب', (r) => esc(r.reason)],
      ['منشور', (r) => yesNo(r.published)],
    ],
    headerExtra: '<a class="btn ghost" href="#/ideas">💡 الأفكار المقدّمة من الموظفين</a>',
  },
};

async function resourceView(name) {
  const cfg = RES[name];
  const rows = await api(`/api/admin/${name}`);
  $view.innerHTML = `
    <div class="toolbar"><button class="btn" id="addBtn">+ إضافة ${esc(cfg.single)}</button>${cfg.headerExtra || ''}<span class="spacer"></span><span class="muted">${rows.length} عنصر</span></div>
    <div class="panel"><div class="table-wrap">${rows.length ? `<table class="list"><thead><tr>${cfg.columns.map(([h]) => `<th>${h}</th>`).join('')}<th></th></tr></thead>
      <tbody>${rows.map((r) => `<tr>${cfg.columns.map(([, fn]) => `<td>${fn(r)}</td>`).join('')}
        <td><div class="actions-cell">${cfg.rowActions ? cfg.rowActions(r) : ''}<button class="btn small ghost" data-edit="${r.id}">تعديل</button><button class="btn small danger" data-del="${r.id}">حذف</button></div></td></tr>`).join('')}</tbody></table>`
    : empty('📭', 'لا توجد عناصر بعد')}</div></div>`;
  const edit = (row) => {
    const fields = cfg.fields();
    const root = openModal(row ? `تعديل ${cfg.single}` : `إضافة ${cfg.single}`,
      fields.map((f) => fieldHtml(f, row ? row[f.name] : undefined)).join('') + (cfg.extra ? cfg.extra(row) : ''),
      async (body) => {
        const data = { ...readFields(body, fields), ...(cfg.readExtra ? cfg.readExtra(body) : {}) };
        await api(row ? `/api/admin/${name}/${row.id}` : `/api/admin/${name}`, { method: row ? 'PUT' : 'POST', body: data });
        toast('تم الحفظ');
        resourceView(name);
      });
    cfg.bindExtra?.(root);
  };
  document.getElementById('addBtn').addEventListener('click', () => edit(null));
  $view.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => edit(rows.find((r) => r.id === b.dataset.edit))));
  $view.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('هل أنت متأكد من الحذف؟ لا يمكن التراجع عن هذا الإجراء.')) return;
    try { await api(`/api/admin/${name}/${b.dataset.del}`, { method: 'DELETE' }); toast('تم الحذف'); resourceView(name); } catch (err) { toast(err.message, true); }
  }));
}

const empty = (icon, text) => `<div class="empty"><span class="ico">${icon}</span>${esc(text)}</div>`;

// ---------- الصفحات الخاصة ----------
async function dashboardView() {
  const s = await api('/api/admin/stats');
  const total = Object.values(s.byCategory).reduce((a, b) => a + b, 0) || 1;
  $view.innerHTML = `
    <div class="panel" style="margin-bottom:20px;background:linear-gradient(135deg,var(--green-800),var(--green-600));color:#fff">
      <h2 style="margin:0">مرحباً ${esc(ME.name)} 👋</h2>
      <p style="margin:4px 0 0;opacity:.9">صلاحياتك: ${ME.role === 'admin' ? 'مدير المنصة (جميع الصلاحيات)' : ME.permissions.map((p) => esc(LABELS[p])).join('، ') || 'لا توجد'}</p>
    </div>
    <div class="kpis">
      <div class="kpi"><b>${s.openActivities} / ${s.activities}</b><span>أنشطة مفتوحة / الكل</span></div>
      <div class="kpi gold"><b>${s.pendingRegistrations}</b><span>طلبات تسجيل بانتظار المراجعة</span></div>
      <div class="kpi"><b>${s.registrations}</b><span>إجمالي التسجيلات</span></div>
      <div class="kpi red"><b>${s.newComplaints}</b><span>شكاوى جديدة</span></div>
      <div class="kpi gold"><b>${s.newIdeas}</b><span>أفكار جديدة</span></div>
      <div class="kpi"><b>${s.quizSubmissions}</b><span>مشاركات المسابقات</span></div>
      <div class="kpi"><b>${s.votes}</b><span>أصوات التصويت</span></div>
    </div>
    <div class="grid cols-2">
      <div class="panel"><h3>المشاركات حسب نوع النشاط</h3>
        ${Object.entries(s.categories).map(([k, l]) => { const n = s.byCategory[k] || 0; return `<div class="bar-row"><div class="lbl"><span>${CATEGORY_ICONS[k]} ${esc(l)}</span><b>${n}</b></div><div class="bar"><i style="width:${Math.round((n / total) * 100)}%"></i></div></div>`; }).join('')}
      </div>
      <div class="panel"><h3>اختصارات</h3>
        <div class="flex">
          ${can('activities') ? '<a class="btn" href="#/registrations?status=pending">مراجعة الطلبات</a>' : ''}
          ${can('posts') ? '<a class="btn ghost" href="#/posts">نشر إعلان</a>' : ''}
          ${can('quizzes') ? '<a class="btn gold" href="#/quizzes">المسابقة الأسبوعية</a>' : ''}
          ${can('complaints') ? '<a class="btn ghost" href="#/complaints">الشكاوى</a>' : ''}
        </div>
        <p class="muted mt" style="font-size:14px">${s.mailEnabled ? '✅ إرسال الشكاوى والأفكار إلى بريد اللجنة مُفعّل.' : 'ℹ️ إرسال الشكاوى إلى بريد اللجنة غير مُفعّل — تُحفظ في المنصة فقط. راجع ملف README لضبط إعدادات SMTP.'}</p>
      </div>
    </div>`;
}

async function registrationsView(params) {
  const [acts, rows] = await Promise.all([api('/api/admin/activities'), api(`/api/admin/registrations?${params}`)]);
  const activityId = params.get('activityId') || '';
  const status = params.get('status') || '';
  const q = new URLSearchParams({ ...(activityId && { activityId }), ...(status && { status }) });
  $view.innerHTML = `
    <div class="toolbar">
      <select class="input" id="fAct"><option value="">كل الأنشطة</option>${acts.map((a) => `<option value="${a.id}" ${a.id === activityId ? 'selected' : ''}>${esc(a.title)}</option>`).join('')}</select>
      <select class="input" id="fStatus"><option value="">كل الحالات</option>${['pending', 'approved', 'rejected'].map((s) => `<option value="${s}" ${s === status ? 'selected' : ''}>${STATUS_LABELS[s][0]}</option>`).join('')}</select>
      <input class="input" id="fSearch" placeholder="🔍 بحث بالاسم أو الرقم الوظيفي">
      <span class="spacer"></span>
      <a class="btn ghost" href="/api/admin/registrations.csv?${q}">⬇️ تصدير Excel (CSV)</a>
    </div>
    <div class="panel"><div class="table-wrap">${rows.length ? `<table class="list" id="regTable"><thead><tr><th>الاسم</th><th>الرقم الوظيفي</th><th>الوصف الوظيفي / الإدارة</th><th>النشاط</th><th>الهاتف</th><th>التاريخ</th><th>الحالة</th><th></th></tr></thead><tbody>
      ${rows.map((r) => `<tr data-search="${esc(`${r.name} ${r.employeeId}`.toLowerCase())}">
        <td><b>${esc(r.name)}</b>${r.contractType ? `<br><small class="muted">${esc(r.contractType)}</small>` : ''}</td>
        <td>${esc(r.employeeId)}</td>
        <td>${esc(r.jobTitle)}<br><small class="muted">${esc(r.department)}</small></td>
        <td>${esc(r.activityTitle)}</td>
        <td dir="ltr">${esc(r.phone)}</td>
        <td>${fmtDate(r.createdAt.slice(0, 10))}</td>
        <td>${statusBadge(r.status)}${r.reviewNote ? `<br><small class="muted">${esc(r.reviewNote)}</small>` : ''}</td>
        <td><div class="actions-cell">
          <button class="btn small ghost" data-view="${r.id}">التفاصيل</button>
          ${r.status !== 'approved' ? `<button class="btn small" data-approve="${r.id}">قبول</button>` : ''}
          ${r.status !== 'rejected' ? `<button class="btn small danger" data-reject="${r.id}">رفض</button>` : ''}
          ${r.status === 'approved' && r.cardCode ? `<a class="btn small gold" target="_blank" href="/#/card/${esc(r.cardCode)}">🪪 البطاقة</a>` : ''}
        </div></td></tr>`).join('')}
    </tbody></table>` : empty('📭', 'لا توجد تسجيلات')}</div></div>`;
  const reload = () => {
    const p = new URLSearchParams();
    if (document.getElementById('fAct').value) p.set('activityId', document.getElementById('fAct').value);
    if (document.getElementById('fStatus').value) p.set('status', document.getElementById('fStatus').value);
    location.hash = `#/registrations${p.toString() ? `?${p}` : ''}`;
  };
  document.getElementById('fAct').addEventListener('change', reload);
  document.getElementById('fStatus').addEventListener('change', reload);
  document.getElementById('fSearch').addEventListener('input', (e) => {
    const t = e.target.value.trim().toLowerCase();
    $view.querySelectorAll('#regTable tbody tr').forEach((tr) => { tr.hidden = t && !tr.dataset.search.includes(t); });
  });
  const patch = async (id, body) => {
    try { await api(`/api/admin/registrations/${id}`, { method: 'PATCH', body }); toast('تم التحديث'); registrationsView(params); } catch (err) { toast(err.message, true); }
  };
  $view.querySelectorAll('[data-approve]').forEach((b) => b.addEventListener('click', () => patch(b.dataset.approve, { status: 'approved' })));
  $view.querySelectorAll('[data-reject]').forEach((b) => b.addEventListener('click', () => {
    openModal('رفض طلب التسجيل', `<div class="field full"><label>سبب الرفض <span class="req">*</span></label><textarea class="input" name="reviewNote" required></textarea><small>تلتزم اللجنة بتسبيب قرار الرفض (المادة 10 من الميثاق).</small></div>`,
      async (root) => {
        await api(`/api/admin/registrations/${b.dataset.reject}`, { method: 'PATCH', body: { status: 'rejected', reviewNote: root.querySelector('[name=reviewNote]').value } });
        toast('تم رفض الطلب');
        registrationsView(params);
      }, { saveLabel: 'تأكيد الرفض' });
  }));
  $view.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
    const r = rows.find((x) => x.id === b.dataset.view);
    openModal(`طلب: ${r.name}`, `<div class="full"><table class="list"><tbody>
      ${[['النشاط', r.activityTitle], ['الاسم', r.name], ['الرقم الوظيفي', r.employeeId], ['الوصف الوظيفي', r.jobTitle], ['الإدارة / المكتب', r.department],
    ['الهاتف', r.phone], ['البريد', r.email], ['نوع العقد', r.contractType], ['الخبرة السابقة', r.experience], ['ملاحظات', r.notes],
    ['رقم البطاقة', r.cardNo], ['تاريخ الطلب', fmtDateTime(r.createdAt.slice(0, 16))], ['تمت المراجعة بواسطة', r.reviewedBy]]
    .map(([k, v]) => `<tr><th>${k}</th><td style="white-space:pre-line">${esc(v || '—')}</td></tr>`).join('')}
    </tbody></table>
    <div class="flex mt"><button type="button" class="btn small danger" id="delReg">حذف الطلب نهائياً</button></div></div>`, null);
    document.getElementById('delReg').addEventListener('click', async () => {
      if (!confirm('حذف الطلب نهائياً؟')) return;
      await api(`/api/admin/registrations/${r.id}`, { method: 'DELETE' });
      closeModal();
      toast('تم الحذف');
      registrationsView(params);
    });
  }));
}

async function quizDetailView(id) {
  const { quiz, submissions } = await api(`/api/admin/quizzes/${id}/submissions`);
  const winners = quiz.winners || [];
  $view.innerHTML = `
    <div class="toolbar"><a class="btn ghost" href="#/quizzes">→ كل المسابقات</a><h2 style="margin:0">${esc(quiz.title)}</h2>${statusBadge(windowStatus(quiz))}</div>
    <div class="kpis">
      <div class="kpi"><b>${submissions.length}</b><span>مشاركة</span></div>
      <div class="kpi gold"><b>${submissions.filter((s) => s.score === s.total).length}</b><span>إجابات كاملة</span></div>
      <div class="kpi"><b>${winners.length} / ${quiz.winnersCount}</b><span>الفائزون</span></div>
    </div>
    <div class="panel">
      <div class="flex"><h3 style="margin:0">🏆 الفائزون</h3><span class="spacer"></span>
        <button class="btn gold" id="drawBtn" ${submissions.length ? '' : 'disabled'}>🎲 سحب عشوائي على الفائزين</button></div>
      <p class="muted" style="font-size:14px">يتم السحب عشوائياً بين أصحاب أعلى درجة. تظهر أسماء الفائزين للموظفين بعد انتهاء المسابقة.</p>
      ${winners.length ? `<div class="table-wrap"><table class="list"><thead><tr><th>الاسم</th><th>الرقم الوظيفي</th><th>الإدارة</th><th>الهاتف (لتحويل الرصيد)</th><th>الدرجة</th><th>الجائزة</th><th></th></tr></thead><tbody>
        ${winners.map((w) => `<tr><td><b>${esc(w.name)}</b></td><td>${esc(w.employeeId)}</td><td>${esc(w.department)}</td><td dir="ltr">${esc(w.phone)}</td><td>${w.score}/${w.total}</td>
          <td><label class="check"><input type="checkbox" data-deliver="${w.submissionId}" ${w.delivered ? 'checked' : ''}> تم تحويل الرصيد</label></td>
          <td><button class="btn small danger" data-unwin="${w.submissionId}">إلغاء</button></td></tr>`).join('')}
      </tbody></table></div>` : '<p class="muted">لم يتم السحب بعد.</p>'}
    </div>
    <div class="panel">
      <h3>📋 جميع المشاركات</h3>
      <div class="table-wrap">${submissions.length ? `<table class="list"><thead><tr><th>الاسم</th><th>الرقم الوظيفي</th><th>الإدارة</th><th>الهاتف</th><th>الدرجة</th><th>الوقت</th></tr></thead><tbody>
        ${submissions.map((s) => `<tr><td>${esc(s.name)}</td><td>${esc(s.employeeId)}</td><td>${esc(s.department)}</td><td dir="ltr">${esc(s.phone)}</td><td><b>${s.score}</b>/${s.total}</td><td>${fmtDateTime(s.createdAt.slice(0, 16))}</td></tr>`).join('')}
      </tbody></table>` : empty('📭', 'لا توجد مشاركات بعد')}</div>
    </div>`;
  document.getElementById('drawBtn').addEventListener('click', async () => {
    const left = Math.max(1, quiz.winnersCount - winners.length);
    const n = prompt('كم عدد الفائزين المراد سحبهم؟', String(left));
    if (!n) return;
    try { await api(`/api/admin/quizzes/${id}/draw`, { method: 'POST', body: { count: Number(n) } }); toast('تم السحب'); quizDetailView(id); } catch (err) { toast(err.message, true); }
  });
  $view.querySelectorAll('[data-deliver]').forEach((c) => c.addEventListener('change', async () => {
    try { await api(`/api/admin/quizzes/${id}/winners/${c.dataset.deliver}`, { method: 'PATCH', body: { delivered: c.checked } }); toast('تم التحديث'); } catch (err) { toast(err.message, true); }
  }));
  $view.querySelectorAll('[data-unwin]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('إلغاء هذا الفائز؟')) return;
    await api(`/api/admin/quizzes/${id}/winners/${b.dataset.unwin}`, { method: 'DELETE' });
    quizDetailView(id);
  }));
}

async function pollDetailView(id) {
  const { poll, total, counts, votes } = await api(`/api/admin/polls/${id}/results`);
  $view.innerHTML = `
    <div class="toolbar"><a class="btn ghost" href="#/polls">→ كل الاستطلاعات</a><h2 style="margin:0">${esc(poll.title)}</h2>${statusBadge(windowStatus(poll))}</div>
    <div class="grid cols-2">
      <div class="panel"><h3>النتائج (${total} صوت)</h3>
        ${poll.options.map((o) => { const n = counts[o.id] || 0; const pct = total ? Math.round((n / total) * 100) : 0; return `<div class="bar-row"><div class="lbl"><span>${esc(o.label)}</span><b>${pct}% (${n})</b></div><div class="bar"><i style="width:${pct}%"></i></div></div>`; }).join('')}
      </div>
      <div class="panel"><h3>المصوّتون</h3><div class="table-wrap" style="max-height:420px">
        ${votes.length ? `<table class="list"><thead><tr><th>الاسم</th><th>الرقم الوظيفي</th><th>الخيار</th><th>الوقت</th></tr></thead><tbody>
        ${votes.map((v) => `<tr><td>${esc(v.name)}</td><td>${esc(v.employeeId)}</td><td>${esc(v.optionLabel)}</td><td>${fmtDateTime(v.createdAt.slice(0, 16))}</td></tr>`).join('')}</tbody></table>` : empty('🗳️', 'لا توجد أصوات بعد')}
      </div></div>
    </div>`;
}

async function ideasView() {
  const rows = await api('/api/admin/ideas');
  $view.innerHTML = `
    <div class="toolbar"><a class="btn ghost" href="#/stars">→ نجم الأسبوع</a><p class="muted" style="margin:0">الأفكار والبرامج المقدّمة من الموظفين — يمكن اعتماد صاحب الفكرة كنجم للأسبوع.</p></div>
    <div class="panel"><div class="table-wrap">${rows.length ? `<table class="list"><thead><tr><th>الفكرة</th><th>صاحب الفكرة</th><th>المجال</th><th>التاريخ</th><th>الحالة</th><th></th></tr></thead><tbody>
      ${rows.map((r) => `<tr><td><b>${esc(r.title)}</b><br><small class="muted">${esc(r.description.slice(0, 140))}${r.description.length > 140 ? '…' : ''}</small></td>
        <td>${esc(r.name)}<br><small class="muted">${esc(r.employeeId)} — ${esc(r.department)}</small></td>
        <td>${CATEGORY_ICONS[r.category] || ''} ${esc(CFG.categories[r.category])}</td><td>${fmtDate(r.createdAt.slice(0, 10))}</td><td>${statusBadge(r.status)}</td>
        <td><div class="actions-cell">
          <button class="btn small ghost" data-view="${r.id}">عرض</button>
          <select class="input" data-status="${r.id}" style="width:auto;padding:4px 8px">${['new', 'reviewed', 'adopted', 'archived'].map((s) => `<option value="${s}" ${s === r.status ? 'selected' : ''}>${STATUS_LABELS[s][0]}</option>`).join('')}</select>
          <button class="btn small gold" data-promote="${r.id}">⭐ نجم الأسبوع</button>
          <button class="btn small danger" data-del="${r.id}">حذف</button>
        </div></td></tr>`).join('')}
    </tbody></table>` : empty('💡', 'لا توجد أفكار مقدّمة بعد')}</div></div>`;
  $view.querySelectorAll('[data-view]').forEach((b) => b.addEventListener('click', () => {
    const r = rows.find((x) => x.id === b.dataset.view);
    openModal(r.title, `<div class="full"><p><b>${esc(r.name)}</b> — ${esc(r.employeeId)} — ${esc(r.jobTitle)} — ${esc(r.department)} ${r.phone ? `— <span dir="ltr">${esc(r.phone)}</span>` : ''}</p><pre class="box">${esc(r.description)}</pre></div>`, null);
  }));
  $view.querySelectorAll('[data-status]').forEach((s) => s.addEventListener('change', async () => {
    await api(`/api/admin/ideas/${s.dataset.status}`, { method: 'PATCH', body: { status: s.value } });
    toast('تم التحديث');
  }));
  $view.querySelectorAll('[data-promote]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('إنشاء «نجم الأسبوع» من هذه الفكرة؟ سيُنشأ كمسودة لتضيف الصورة ثم تنشره.')) return;
    await api(`/api/admin/ideas/${b.dataset.promote}/promote`, { method: 'POST', body: {} });
    toast('تم الإنشاء — راجعه وانشره من قسم نجم الأسبوع');
    location.hash = '#/stars';
  }));
  $view.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('حذف الفكرة؟')) return;
    await api(`/api/admin/ideas/${b.dataset.del}`, { method: 'DELETE' });
    ideasView();
  }));
}

async function complaintsView(params) {
  const all = await api('/api/admin/complaints');
  const status = params.get('status') || '';
  const rows = all.filter((c) => !status || c.status === status);
  $view.innerHTML = `
    <div class="toolbar">
      <select class="input" id="fStatus"><option value="">كل الحالات</option>${['new', 'in_progress', 'resolved', 'closed'].map((s) => `<option value="${s}" ${s === status ? 'selected' : ''}>${STATUS_LABELS[s][0]}</option>`).join('')}</select>
      <span class="spacer"></span><span class="muted">${rows.length} طلب</span>
    </div>
    <div class="panel"><div class="table-wrap">${rows.length ? `<table class="list"><thead><tr><th>التذكرة</th><th>النوع</th><th>الموضوع</th><th>مقدم الطلب</th><th>التاريخ</th><th>الحالة</th><th></th></tr></thead><tbody>
      ${rows.map((c) => `<tr><td dir="ltr"><b>${esc(c.ticket)}</b></td><td>${esc(CFG.complaintTypes[c.type])}</td><td>${esc(c.subject)}</td>
        <td>${esc(c.name)}<br><small class="muted">${esc(c.employeeId)} — ${esc(c.department)}</small></td><td>${fmtDate(c.createdAt.slice(0, 10))}</td><td>${statusBadge(c.status)}</td>
        <td><div class="actions-cell"><button class="btn small" data-open="${c.id}">معالجة</button><button class="btn small danger" data-del="${c.id}">حذف</button></div></td></tr>`).join('')}
    </tbody></table>` : empty('📭', 'لا توجد طلبات')}</div></div>`;
  document.getElementById('fStatus').addEventListener('change', (e) => { location.hash = `#/complaints${e.target.value ? `?status=${e.target.value}` : ''}`; });
  $view.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => {
    const c = rows.find((x) => x.id === b.dataset.open);
    openModal(`${c.ticket} — ${c.subject}`, `
      <div class="full"><p><b>${esc(c.name)}</b> — ${esc(c.employeeId)} — ${esc(c.department)}<br>
        ${c.phone ? `☎️ <a href="tel:${esc(c.phone)}" dir="ltr">${esc(c.phone)}</a> ` : ''}${c.email ? `✉️ <a href="mailto:${esc(c.email)}?subject=${encodeURIComponent(`بخصوص ${c.ticket}`)}">${esc(c.email)}</a>` : ''}</p>
        <pre class="box">${esc(c.message)}</pre></div>
      ${fieldHtml({ name: 'status', label: 'الحالة', type: 'select', options: { new: 'جديدة', in_progress: 'قيد المعالجة', resolved: 'تم الحل', closed: 'مغلقة' } }, c.status)}
      <div></div>
      ${fieldHtml({ name: 'response', label: 'رد اللجنة (يظهر لمقدم الطلب عند الاستعلام)', type: 'textarea', full: true }, c.response)}`,
    async (root) => {
      await api(`/api/admin/complaints/${c.id}`, { method: 'PATCH', body: { status: root.querySelector('[name=status]').value, response: root.querySelector('[name=response]').value } });
      toast('تم الحفظ');
      complaintsView(params);
    });
  }));
  $view.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('حذف الطلب؟')) return;
    await api(`/api/admin/complaints/${b.dataset.del}`, { method: 'DELETE' });
    complaintsView(params);
  }));
}

async function settingsView() {
  const s = await api('/api/admin/settings');
  const fields = [
    { name: 'committeeName', label: 'اسم اللجنة', required: true },
    { name: 'companyName', label: 'اسم الشركة', required: true },
    { name: 'tagline', label: 'الشعار النصي في الواجهة', full: true },
    { name: 'email', label: 'بريد اللجنة (تصله الشكاوى والأفكار)', dir: 'ltr' },
    { name: 'phone', label: 'رقم التواصل', dir: 'ltr' },
    { name: 'whatsapp', label: 'رقم واتساب', dir: 'ltr' },
    { name: 'publicUrl', label: 'الرابط العام للمنصة (لرمز QR في البطاقات)', dir: 'ltr', help: 'مثال: https://activities.almadar.ly' },
    { name: 'maxActivitiesPerEmployee', label: 'الحد الأقصى لعدد الأنشطة لكل موظف', type: 'number', help: '0 = بدون حد. المادة 89 (6) من الميثاق: نشاطان مختلفان.' },
  ];
  const social = [
    { name: 'facebook', label: 'رابط صفحة فيسبوك', dir: 'ltr' },
    { name: 'tiktok', label: 'رابط حساب تيك توك', dir: 'ltr' },
    { name: 'instagram', label: 'رابط حساب إنستغرام', dir: 'ltr' },
    { name: 'youtube', label: 'رابط قناة يوتيوب', dir: 'ltr' },
  ];
  $view.innerHTML = `<form class="panel" id="setForm">
    <h3>بيانات اللجنة والتواصل</h3>
    <div class="modal-body" style="padding:0">${fields.map((f) => fieldHtml(f, s[f.name])).join('')}</div>
    <h3 class="mt">🔗 حسابات التواصل الاجتماعي</h3>
    <p class="muted" style="margin-top:-6px">اترك الحقل فارغاً إذا لم يكن الحساب جاهزاً — سيظهر الزر بعلامة «قريباً».</p>
    <div class="modal-body" style="padding:0">${social.map((f) => fieldHtml(f, s.social?.[f.name])).join('')}</div>
    <h3 class="mt">🏢 قائمة الإدارات والمكاتب</h3>
    ${fieldHtml({ name: 'departments', label: 'تظهر كاقتراحات في نماذج التسجيل (كل إدارة في سطر)', type: 'textarea', rows: 8 }, (s.departments || []).join('\n'))}
    <div class="form-msg mt"></div>
    <button class="btn mt" type="submit">حفظ الإعدادات</button>
  </form>`;
  const form = document.getElementById('setForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const body = { ...readFields(form, fields), departments: form.querySelector('[name=departments]').value, social: readFields(form, social) };
      await api('/api/admin/settings', { method: 'PUT', body });
      CFG = await api('/api/settings');
      toast('تم حفظ الإعدادات');
    } catch (err) { form.querySelector('.form-msg').innerHTML = `<div class="alert err">${esc(err.message)}</div>`; }
  });
}

async function usersView() {
  const rows = await api('/api/admin/users');
  $view.innerHTML = `
    <div class="toolbar"><button class="btn" id="addUser">+ إضافة عضو للوحة التحكم</button><span class="spacer"></span>
      <span class="muted">امنح كل عضو الصلاحيات المرتبطة بمهامه فقط (المادة 14 من اللائحة).</span></div>
    <div class="panel"><div class="table-wrap"><table class="list"><thead><tr><th>الاسم</th><th>اسم المستخدم</th><th>الدور</th><th>الصلاحيات</th><th>الحالة</th><th></th></tr></thead><tbody>
      ${rows.map((u) => `<tr><td><b>${esc(u.name)}</b></td><td dir="ltr">${esc(u.username)}</td><td>${u.role === 'admin' ? '<span class="badge gold">مدير المنصة</span>' : '<span class="badge">عضو لجنة</span>'}</td>
        <td style="max-width:360px">${u.role === 'admin' ? 'جميع الصلاحيات' : u.permissions.map((p) => `<span class="badge gray" style="margin:2px">${esc(LABELS[p])}</span>`).join('') || '—'}</td>
        <td>${u.active ? '<span class="badge">نشط</span>' : '<span class="badge red">موقوف</span>'}</td>
        <td><div class="actions-cell"><button class="btn small ghost" data-edit="${u.id}">تعديل</button>${u.id !== ME.id ? `<button class="btn small danger" data-del="${u.id}">حذف</button>` : ''}</div></td></tr>`).join('')}
    </tbody></table></div></div>`;
  const edit = (u) => {
    openModal(u ? `تعديل: ${u.name}` : 'إضافة عضو', `
      ${fieldHtml({ name: 'name', label: 'الاسم', required: true }, u?.name)}
      ${u ? `<div class="field"><label>اسم المستخدم</label><input class="input" value="${esc(u.username)}" disabled dir="ltr"></div>` : fieldHtml({ name: 'username', label: 'اسم المستخدم (بالإنجليزية)', required: true, dir: 'ltr' })}
      ${fieldHtml({ name: 'password', label: u ? 'كلمة مرور جديدة (اتركها فارغة للإبقاء)' : 'كلمة المرور', type: 'password', required: !u, dir: 'ltr', help: '8 أحرف على الأقل' })}
      ${fieldHtml({ name: 'role', label: 'الدور', type: 'select', options: { member: 'عضو لجنة (صلاحيات محددة)', admin: 'مدير المنصة (كل الصلاحيات)' } }, u?.role || 'member')}
      <div class="field full"><label>الصلاحيات</label><div class="perm-grid">${Object.entries(LABELS).map(([k, l]) => `<label class="check"><input type="checkbox" data-perm="${k}" ${u?.permissions.includes(k) ? 'checked' : ''}> ${esc(l)}</label>`).join('')}</div></div>
      ${fieldHtml({ name: 'active', label: 'الحساب نشط', type: 'checkbox' }, u ? u.active : true)}`,
    async (root) => {
      const body = {
        name: root.querySelector('[name=name]').value,
        username: root.querySelector('[name=username]')?.value,
        password: root.querySelector('[name=password]').value,
        role: root.querySelector('[name=role]').value,
        active: root.querySelector('[name=active]').checked,
        permissions: [...root.querySelectorAll('[data-perm]:checked')].map((c) => c.dataset.perm),
      };
      await api(u ? `/api/admin/users/${u.id}` : '/api/admin/users', { method: u ? 'PUT' : 'POST', body });
      toast('تم الحفظ');
      usersView();
    });
  };
  document.getElementById('addUser').addEventListener('click', () => edit(null));
  $view.querySelectorAll('[data-edit]').forEach((b) => b.addEventListener('click', () => edit(rows.find((u) => u.id === b.dataset.edit))));
  $view.querySelectorAll('[data-del]').forEach((b) => b.addEventListener('click', async () => {
    if (!confirm('حذف هذا المستخدم؟')) return;
    try { await api(`/api/admin/users/${b.dataset.del}`, { method: 'DELETE' }); usersView(); } catch (err) { toast(err.message, true); }
  }));
}

// ---------- التنقل ----------
const NAV = [
  ['dashboard', '📊', 'الرئيسية', null],
  ['sep', 'المحتوى والأنشطة'],
  ['activities', '🏆', 'الأنشطة', 'activities'],
  ['registrations', '📝', 'التسجيلات والبطاقات', 'activities'],
  ['posts', '📢', 'الإعلانات والأخبار', 'posts'],
  ['sep', 'التفاعل'],
  ['quizzes', '🎁', 'المسابقة الأسبوعية', 'quizzes'],
  ['polls', '🗳️', 'التصويت', 'polls'],
  ['stars', '⭐', 'نجم الأسبوع', 'stars'],
  ['ideas', '💡', 'أفكار الموظفين', 'stars'],
  ['complaints', '💬', 'الشكاوى والمقترحات', 'complaints'],
  ['sep', 'اللجنة والإعدادات'],
  ['members', '👥', 'أعضاء اللجنة', 'members'],
  ['settings', '⚙️', 'الإعدادات والروابط', 'settings'],
  ['users', '🔐', 'المستخدمون والصلاحيات', 'admin'],
];

function renderNav(active) {
  let html = '';
  let pendingSep = null;
  for (const item of NAV) {
    if (item[0] === 'sep') { pendingSep = item[1]; continue; }
    const [key, icon, label, perm] = item;
    if (perm && !can(perm)) continue;
    if (pendingSep) { html += `<div class="sep">${pendingSep}</div>`; pendingSep = null; }
    html += `<a href="#/${key}" class="${active === key ? 'active' : ''}">${icon} ${label}</a>`;
  }
  html += '<div class="sep">روابط</div><a href="/" target="_blank">🌐 عرض المنصة</a>';
  document.getElementById('sideNav').innerHTML = html;
}

const VIEWS = {
  dashboard: [() => dashboardView(), null],
  registrations: [(p) => registrationsView(p), 'activities'],
  ideas: [() => ideasView(), 'stars'],
  complaints: [(p) => complaintsView(p), 'complaints'],
  settings: [() => settingsView(), 'settings'],
  users: [() => usersView(), 'admin'],
  quiz: [(p, id) => quizDetailView(id), 'quizzes'],
  poll: [(p, id) => pollDetailView(id), 'polls'],
};

async function route() {
  const [path, qs] = (location.hash.slice(1) || '/dashboard').split('?');
  const [, key = 'dashboard', id] = path.split('/');
  const params = new URLSearchParams(qs || '');
  const navKey = key === 'quiz' ? 'quizzes' : key === 'poll' ? 'polls' : key;
  renderNav(navKey);
  document.getElementById('side').classList.remove('open');
  const navItem = NAV.find((n) => n[0] === navKey);
  document.getElementById('pageTitle').textContent = navItem ? navItem[2] : 'لوحة التحكم';
  $view.innerHTML = '<div class="loading"><div class="spinner"></div>جاري التحميل…</div>';
  try {
    if (RES[key]) {
      if (!can(RES[key].perm)) throw new Error('ليست لديك صلاحية لهذا القسم');
      await resourceView(key);
    } else if (VIEWS[key]) {
      const [fn, perm] = VIEWS[key];
      if (perm && !can(perm)) throw new Error('ليست لديك صلاحية لهذا القسم');
      await fn(params, id);
    } else {
      location.hash = '#/dashboard';
    }
  } catch (err) {
    if (err.status === 401) { showLogin(); return; }
    $view.innerHTML = `<div class="alert err">${esc(err.message)}</div>`;
  }
}

function showLogin() {
  document.getElementById('shell').hidden = true;
  document.getElementById('login').hidden = false;
}

async function start(me) {
  ME = me.user;
  LABELS = me.permissionLabels;
  CFG = await api('/api/settings');
  document.getElementById('login').hidden = true;
  document.getElementById('shell').hidden = false;
  document.getElementById('who').textContent = `${ME.name} (${ME.username})`;
  route();
}

document.getElementById('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const msg = form.querySelector('.form-msg');
  msg.innerHTML = '';
  try {
    const me = await api('/api/auth/login', { method: 'POST', body: formData(form) });
    form.reset();
    start(me);
  } catch (err) { msg.innerHTML = `<div class="alert err">${esc(err.message)}</div>`; }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST', body: {} }).catch(() => {});
  showLogin();
});

document.getElementById('pwBtn').addEventListener('click', () => {
  openModal('تغيير كلمة المرور', `
    ${fieldHtml({ name: 'current', label: 'كلمة المرور الحالية', type: 'password', required: true, full: true, dir: 'ltr' })}
    ${fieldHtml({ name: 'next', label: 'كلمة المرور الجديدة (8 أحرف على الأقل)', type: 'password', required: true, full: true, dir: 'ltr' })}`,
  async (root) => {
    await api('/api/auth/password', { method: 'POST', body: { current: root.querySelector('[name=current]').value, next: root.querySelector('[name=next]').value } });
    toast('تم تغيير كلمة المرور');
  });
});

document.getElementById('sideBtn').addEventListener('click', () => document.getElementById('side').classList.toggle('open'));
window.addEventListener('hashchange', () => { if (ME) route(); });

api('/api/auth/me').then(start).catch(showLogin);
