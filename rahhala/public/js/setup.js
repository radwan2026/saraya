// "خدمات" menu: master data (ضبط), operators, password, appearance, licence and about.
import {
  api, h, qs, num, today, toast, fail, confirmBox, field, select, dataTable, exportCSV, lookup, invalidate,
  accounts, ACCOUNT_TYPES, state,
} from './core.js';
import { openWindow } from './wm.js';
import { openStatement } from './reports.js';

/**
 * Record editor in the style of the "البيانات المصرفية" screen:
 * a form, a navigator bar (first/prev/next/last/add/delete/save/cancel/refresh) and a grid of all records.
 *
 * spec: { title, key, width, height, fields: [{name, label, type, options, ltr, readonlyOnEdit, onlyNew}],
 *         columns, load(), create(data), update(id, data), remove(id), defaults(), extraActions(rec) }
 */
export function recordEditor(spec) {
  return openWindow({
    key: spec.key,
    title: spec.title,
    width: spec.width || 820,
    height: spec.height || 600,
    render: async (win) => {
      let rows = [];
      let index = -1; // -1 = new record
      const inputs = {};
      const form = h('div.grid.cols-2.panel');
      for (const f of spec.fields) {
        let input;
        if (f.type === 'select') input = select(typeof f.options === 'function' ? await f.options() : f.options, { empty: f.empty });
        else if (f.type === 'checkbox') input = h('input', { type: 'checkbox' });
        else if (f.type === 'textarea') input = h('textarea', { rows: 2 });
        else input = h('input', { type: f.type || 'text', step: f.type === 'number' ? 'any' : undefined, class: f.ltr ? 'ltr' : '' });
        inputs[f.name] = input;
        const wrap = f.type === 'checkbox' ? h('label.field.check', input, h('span', f.label)) : field(f.label, input);
        if (f.wide) wrap.style.gridColumn = '1 / -1';
        f.wrap = wrap;
        form.append(wrap);
      }
      const status = h('span.muted.small');
      const holder = h('div', { style: { display: 'contents' } });
      const extra = h('div.actions');

      const fill = (rec) => {
        for (const f of spec.fields) {
          const v = rec ? rec[f.name] : (spec.defaults?.()[f.name] ?? (f.type === 'checkbox' ? false : ''));
          if (f.type === 'checkbox') inputs[f.name].checked = !!v;
          else inputs[f.name].value = v ?? '';
          inputs[f.name].disabled = !!(rec && f.readonlyOnEdit);
          f.wrap.classList.toggle('hidden', !!(rec && f.onlyNew));
        }
        status.textContent = rec ? `سجل ${index + 1} من ${rows.length}` : 'سجل جديد';
        extra.replaceChildren(...(rec && spec.extraActions ? spec.extraActions(rec) : []));
        nav.first.disabled = nav.prev.disabled = index <= 0;
        nav.next.disabled = nav.last.disabled = index < 0 || index >= rows.length - 1;
        nav.del.disabled = !rec || !!rec.system;
        holder.querySelectorAll('tbody tr').forEach((tr, i) => tr.classList.toggle('sel', i === index));
      };
      const go = (i) => { index = i; fill(rows[i]); };
      const read = () => Object.fromEntries(spec.fields.map((f) => [f.name, f.type === 'checkbox' ? inputs[f.name].checked : inputs[f.name].value]));

      const reload = async (focusId) => {
        rows = await spec.load();
        holder.replaceChildren(dataTable(spec.columns, rows, { footer: !!spec.footer, onRowClick: (r) => go(rows.indexOf(r)) }));
        const i = focusId ? rows.findIndex((r) => r.id === focusId) : -1;
        if (i >= 0) go(i); else { index = -1; fill(null); }
      };
      const save = async () => {
        try {
          const data = read();
          let id;
          if (index >= 0) { id = rows[index].id; await spec.update(id, data); }
          else id = (await spec.create(data)).id;
          toast('تم الحفظ', 'ok');
          spec.onChange?.();
          await reload(id);
        } catch (err) { fail(err); }
      };
      const remove = async () => {
        const rec = rows[index];
        if (!rec || !(await confirmBox('حذف هذا السجل نهائياً؟', 'حذف'))) return;
        try { await spec.remove(rec.id); toast('تم الحذف', 'ok'); spec.onChange?.(); await reload(); } catch (err) { fail(err); }
      };

      const btn = (label, title, fn) => h('button', { type: 'button', title, 'aria-label': title, onclick: fn }, label);
      const nav = {
        first: btn('⏮', 'الأول', () => go(0)),
        prev: btn('◀', 'السابق', () => go(index - 1)),
        next: btn('▶', 'التالي', () => go(index + 1)),
        last: btn('⏭', 'الأخير', () => go(rows.length - 1)),
        add: btn('+', 'جديد', () => { index = -1; fill(null); form.querySelector('input, select')?.focus(); }),
        del: btn('−', 'حذف', remove),
        save: btn('✔', 'حفظ', save),
        cancel: btn('✕', 'تراجع', () => (index >= 0 ? go(index) : fill(null))),
        refresh: btn('↻', 'تحديث', () => reload(rows[index]?.id)),
      };
      // RTL: "first" sits on the right, matching the reading direction.
      await reload();
      win.body.append(form, h('div.nav-bar', Object.values(nav)), h('div.actions', { style: { alignItems: 'center' } }, status, extra),
        holder, spec.below ? spec.below() : '');
      form.querySelector('input:not([disabled]), select')?.focus();
    },
  });
}

const lookupCrud = (table) => ({
  load: () => api('/lookups/' + table),
  create: (d) => api('/lookups/' + table, { method: 'POST', body: d }),
  update: (id, d) => api(`/lookups/${table}/${id}`, { method: 'PUT', body: d }),
  remove: (id) => api(`/lookups/${table}/${id}`, { method: 'DELETE' }),
  onChange: () => invalidate(table),
});

// ------------------------------------------------------------ accounts (عملاء / مزودين / وكلاء)
const ACCOUNT_SCREEN = {
  client: 'إضافة عميل',
  supplier: 'إضافة مزود',
  subagent: 'إضافة وكيل فرعي - New Sub Agent',
  bank: 'الخزائن والحسابات المصرفية',
  expense: 'حسابات المصروفات',
};

export function openAccounts(type) {
  const types = type === 'bank' ? 'cash,bank' : type;
  return recordEditor({
    key: 'acc-' + type,
    title: ACCOUNT_SCREEN[type] || 'الحسابات',
    width: 900,
    footer: true,
    fields: [
      ...(type === 'bank' ? [{ name: 'type', label: 'النوع', type: 'select', options: [{ value: 'cash', label: 'خزينة نقدية' }, { value: 'bank', label: 'حساب مصرفي' }], readonlyOnEdit: true }] : []),
      { name: 'code', label: 'رقم الحساب', ltr: true },
      { name: 'name', label: 'الاسم' },
      { name: 'phone', label: 'الهاتف', ltr: true },
      { name: 'email', label: 'البريد الإلكتروني', ltr: true },
      { name: 'address', label: 'العنوان' },
      { name: 'notes', label: 'ملاحظات' },
      { name: 'opening_balance', label: 'رصيد افتتاحي', type: 'number', onlyNew: true },
      { name: 'opening_date', label: 'تاريخ الرصيد', type: 'date', onlyNew: true },
      { name: 'active', label: 'نشط', type: 'checkbox' },
    ],
    defaults: () => ({ active: true, opening_date: today(), type: 'cash' }),
    columns: [
      { key: 'code', label: 'الرقم' }, { key: 'name', label: 'الاسم' }, { key: 'phone', label: 'الهاتف' },
      { label: 'الحالة', render: (a) => (a.active ? 'نشط' : 'موقوف') }, { key: 'balance', label: 'الرصيد', num: true, total: true },
    ],
    load: () => api('/accounts' + qs({ type: types, all: 1 })),
    create: (d) => api('/accounts', { method: 'POST', body: { ...d, type: type === 'bank' ? d.type : type } }),
    update: (id, d) => api('/accounts/' + id, { method: 'PUT', body: d }),
    remove: (id) => api('/accounts/' + id, { method: 'DELETE' }),
    extraActions: (rec) => [h('button.btn', { onclick: () => openStatement(rec.id) }, '📒 كشف الحساب')],
  });
}

// ------------------------------------------------------------ دليل الحسابات
export function openChart() {
  return openWindow({
    key: 'chart',
    title: 'دليل الحسابات',
    width: 900,
    height: 620,
    render: async (win) => {
      const typeSel = select(Object.entries(ACCOUNT_TYPES).map(([value, label]) => ({ value, label })), { empty: 'كل الأنواع' });
      const holder = h('div', { style: { display: 'contents' } });
      const cols = [
        { key: 'code', label: 'رقم الحساب' }, { key: 'name', label: 'اسم الحساب' }, { label: 'النوع', render: (a) => ACCOUNT_TYPES[a.type] },
        { label: 'حساب نظام', render: (a) => (a.system ? '✓' : '') }, { label: 'الحالة', render: (a) => (a.active ? 'نشط' : 'موقوف') },
        { key: 'debit', label: 'مدين', num: true, total: true }, { key: 'credit', label: 'دائن', num: true, total: true },
        { key: 'balance', label: 'الرصيد', num: true, total: true },
      ];
      let rows = [];
      const load = async () => {
        rows = await api('/accounts' + qs({ type: typeSel.value, all: 1 }));
        holder.replaceChildren(dataTable(cols, rows, { onRowDblClick: (a) => openStatement(a.id) }));
      };
      typeSel.addEventListener('change', load);
      win.body.append(
        h('div.filters.panel', h('label', 'النوع', typeSel),
          ...['client', 'supplier', 'subagent', 'bank', 'expense'].map((t) => h('button.btn', { onclick: () => openAccounts(t) }, ACCOUNT_SCREEN[t]))),
        holder,
        h('div.actions', h('button.btn', { onclick: () => exportCSV('دليل الحسابات', cols, rows) }, '📊 تصدير Excel'), h('button.btn', { onclick: load }, '↻ تحديث')),
      );
      await load();
    },
  });
}

// ------------------------------------------------------------ lookups
export function openBankData() {
  return recordEditor({
    key: 'banks', title: 'البيانات المصرفية', width: 760, ...lookupCrud('bank_accounts'),
    fields: [
      { name: 'acc_title', label: 'Acc. Title', ltr: true }, { name: 'company_name', label: 'Company Name', ltr: true },
      { name: 'bank_name', label: 'Bank Name', ltr: true }, { name: 'account_no', label: 'Account No', ltr: true },
      { name: 'iban', label: 'IBAN No', ltr: true }, { name: 'swift', label: 'SWIFT Code', ltr: true },
      { name: 'country', label: 'Country', ltr: true }, { name: 'details', label: 'Details', ltr: true, wide: true },
      { name: 'more_details', label: 'More Details', ltr: true, wide: true },
    ],
    columns: [{ key: 'acc_title', label: 'Acc. Title' }, { key: 'bank_name', label: 'Bank' }, { key: 'account_no', label: 'Account No' }, { key: 'iban', label: 'IBAN' }],
  });
}

export function openServices() {
  return recordEditor({
    key: 'services', title: 'إضافة خدمة / سياسات البيع', width: 760, ...lookupCrud('services'),
    fields: [
      { name: 'name', label: 'اسم الخدمة' },
      { name: 'markup_pct', label: 'نسبة الربح %', type: 'number' },
      { name: 'fixed_fee', label: 'رسوم ثابتة', type: 'number' },
    ],
    columns: [{ key: 'name', label: 'الخدمة' }, { key: 'markup_pct', label: 'نسبة الربح %' }, { key: 'fixed_fee', label: 'رسوم ثابتة', num: true }],
    below: () => h('p.muted.small', 'سياسة البيع: عند إدخال تكلفة البند في الفاتورة يقترح النظام سعر البيع = التكلفة × (1 + النسبة) + الرسوم الثابتة.'),
  });
}

export function openCommissions() {
  return recordEditor({
    key: 'commissions', title: 'عمولات خاصة', width: 820, ...lookupCrud('commissions'),
    fields: [
      { name: 'account_id', label: 'العميل / الوكيل', type: 'select', options: async () => (await accounts('client,subagent')).map((a) => ({ value: a.id, label: `${a.code} - ${a.name}` })) },
      { name: 'service_id', label: 'الخدمة', type: 'select', options: async () => (await lookup('services', { fresh: true })).map((s) => ({ value: s.id, label: s.name })) },
      { name: 'markup_pct', label: 'نسبة الربح %', type: 'number' },
      { name: 'fixed_fee', label: 'رسوم ثابتة', type: 'number' },
    ],
    columns: [{ key: 'account_name', label: 'العميل' }, { key: 'service_name', label: 'الخدمة' }, { key: 'markup_pct', label: 'النسبة %' }, { key: 'fixed_fee', label: 'رسوم', num: true }],
    below: () => h('p.muted.small', 'العمولة الخاصة تتقدم على سياسة البيع العامة للخدمة لهذا العميل أو الوكيل الفرعي.'),
  });
}

export function openCarriers() {
  return recordEditor({
    key: 'carriers', title: 'إضافة شركة ناقلة', width: 640, ...lookupCrud('carriers'),
    fields: [{ name: 'code', label: 'الرمز (IATA)', ltr: true }, { name: 'name', label: 'اسم الشركة' }],
    columns: [{ key: 'code', label: 'الرمز' }, { key: 'name', label: 'الاسم' }],
  });
}

export function openCountries() {
  return recordEditor({
    key: 'countries', title: 'إضافة دولة', width: 560, ...lookupCrud('countries'),
    fields: [{ name: 'name', label: 'اسم الدولة' }],
    columns: [{ key: 'name', label: 'الدولة' }],
  });
}

export function openCities() {
  return recordEditor({
    key: 'cities', title: 'إضافة مدينة', width: 640, ...lookupCrud('cities'),
    fields: [
      { name: 'name', label: 'اسم المدينة' }, { name: 'code', label: 'رمز المطار', ltr: true },
      { name: 'country_id', label: 'الدولة', type: 'select', empty: '', options: async () => (await api('/lookups/countries')).map((c) => ({ value: c.id, label: c.name })) },
    ],
    columns: [{ key: 'name', label: 'المدينة' }, { key: 'code', label: 'الرمز' }, { key: 'country_name', label: 'الدولة' }],
  });
}

export function openCurrencies(title = 'العملات الأجنبية') {
  return recordEditor({
    key: 'currencies', title, width: 640, ...lookupCrud('currencies'),
    fields: [{ name: 'code', label: 'الرمز', ltr: true }, { name: 'name', label: 'اسم العملة' }, { name: 'rate', label: 'سعر الصرف', type: 'number' }],
    columns: [{ key: 'code', label: 'الرمز' }, { key: 'name', label: 'العملة' }, { key: 'rate', label: 'سعر الصرف', render: (c) => c.rate }, { label: '', render: (c) => (c.is_base ? 'العملة الأساسية' : '') }],
    below: () => h('p.muted.small', 'سعر الصرف = قيمة وحدة واحدة من العملة بالعملة الأساسية (الدينار الليبي).'),
  });
}

// ------------------------------------------------------------ Import From Excel
export function openImport() {
  return openWindow({
    key: 'import',
    title: 'Import From Excel - استيراد الحسابات',
    width: 900,
    height: 620,
    render: (win) => {
      const typeSel = select(['client', 'supplier', 'subagent'].map((t) => ({ value: t, label: ACCOUNT_TYPES[t] })));
      const text = h('textarea', { rows: 8, placeholder: 'الصق هنا الخلايا المنسوخة من Excel…\nالأعمدة بالترتيب: الاسم | الهاتف | البريد | العنوان | الرصيد الافتتاحي | رقم الحساب (اختياري)' });
      const file = h('input', { type: 'file', accept: '.csv,.txt,.tsv' });
      const holder = h('div', { style: { display: 'contents' } });
      let parsed = [];
      file.addEventListener('change', async () => { if (file.files[0]) { text.value = await file.files[0].text(); preview(); } });
      const parse = (src) => {
        const lines = src.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
        const sep = lines.some((l) => l.includes('\t')) ? '\t' : ',';
        return lines.map((l) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, '')));
      };
      const cols = [{ key: 'name', label: 'الاسم' }, { key: 'phone', label: 'الهاتف' }, { key: 'email', label: 'البريد' }, { key: 'address', label: 'العنوان' }, { key: 'opening_balance', label: 'رصيد افتتاحي', num: true }, { key: 'code', label: 'الرقم' }];
      const preview = () => {
        parsed = parse(text.value)
          .filter((c) => c[0] && !/^(الاسم|name)$/i.test(c[0]))
          .map(([name, phone, email, address, opening, code]) => ({ name, phone, email, address, opening_balance: num(opening), code, type: typeSel.value }));
        holder.replaceChildren(dataTable(cols, parsed, { footer: false }));
      };
      text.addEventListener('input', preview);
      const run = async () => {
        if (!parsed.length) return toast('لا توجد بيانات للاستيراد', 'err');
        try {
          const r = await api('/accounts/import', { method: 'POST', body: { rows: parsed.map((p) => ({ ...p, type: typeSel.value })) } });
          toast(`تم استيراد ${r.created} حساب`, 'ok');
          if (r.errors.length) holder.replaceChildren(h('div.panel.error', r.errors.map((e) => h('div', e))));
          else { text.value = ''; preview(); }
        } catch (err) { fail(err); }
      };
      win.body.append(
        h('div.panel.small', 'افتح ملف Excel، حدد الأعمدة (الاسم، الهاتف، البريد، العنوان، الرصيد الافتتاحي، رقم الحساب اختياري) ثم انسخها والصقها هنا، أو احفظ الملف بصيغة CSV واختره.'),
        h('div.filters', h('label', 'نوع الحسابات', typeSel), h('label', 'ملف CSV', file)),
        text, holder,
        h('div.actions', h('button.btn.primary', { onclick: run }, '⬇ استيراد')),
      );
    },
  });
}

// ------------------------------------------------------------ المشغلين
export function openUsers() {
  return recordEditor({
    key: 'users', title: 'المشغلين (المستخدمين)', width: 720,
    fields: [
      { name: 'username', label: 'اسم الدخول', ltr: true, readonlyOnEdit: true },
      { name: 'name', label: 'الاسم' },
      { name: 'role', label: 'الصلاحية', type: 'select', options: [{ value: 'user', label: 'مستخدم' }, { value: 'admin', label: 'مدير' }] },
      { name: 'password', label: 'كلمة المرور', type: 'password' },
      { name: 'active', label: 'نشط', type: 'checkbox' },
    ],
    defaults: () => ({ role: 'user', active: true }),
    columns: [{ key: 'username', label: 'اسم الدخول' }, { key: 'name', label: 'الاسم' }, { label: 'الصلاحية', render: (u) => (u.role === 'admin' ? 'مدير' : 'مستخدم') }, { label: 'الحالة', render: (u) => (u.active ? 'نشط' : 'موقوف') }],
    load: () => api('/users'),
    create: (d) => api('/users', { method: 'POST', body: d }),
    update: (id, d) => api('/users/' + id, { method: 'PUT', body: d }),
    remove: (id) => api('/users/' + id, { method: 'PUT', body: { active: false } }),
    below: () => h('p.muted.small', 'اترك كلمة المرور فارغة عند التعديل للإبقاء على الحالية. الحذف يوقف المستخدم فقط للحفاظ على سجل المستندات.'),
  });
}

export function openChangePassword() {
  return openWindow({
    key: 'password', title: 'تغيير كلمة المرور', width: 460, height: 300,
    render: (win) => {
      const old = h('input', { type: 'password', autocomplete: 'current-password' });
      const nw = h('input', { type: 'password', autocomplete: 'new-password' });
      const nw2 = h('input', { type: 'password', autocomplete: 'new-password' });
      const save = async () => {
        if (nw.value !== nw2.value) return toast('كلمتا المرور غير متطابقتين', 'err');
        try { await api('/change-password', { method: 'POST', body: { old_password: old.value, new_password: nw.value } }); toast('تم تغيير كلمة المرور', 'ok'); win.close(); } catch (err) { fail(err); }
      };
      win.body.append(h('div.grid.panel', field('الحالية', old), field('الجديدة', nw), field('تأكيد', nw2)), h('div.actions', h('button.btn.primary', { onclick: save }, 'حفظ')));
    },
  });
}

// ------------------------------------------------------------ المظهر العام وبيانات المكتب
export const THEMES = { rahhala: 'هوية الرحالة - أخضر وذهبي (افتراضي)', blue: 'أزرق', sand: 'رملي', purple: 'بنفسجي', dark: 'داكن' };

export function applyTheme(theme) {
  document.documentElement.dataset.theme = THEMES[theme] ? theme : 'rahhala';
}

export function openSettings(onSaved) {
  return openWindow({
    key: 'settings', title: 'المظهر العام وبيانات المكتب', width: 680, height: 520,
    render: async (win) => {
      const s = await api('/settings');
      const inp = {
        company_name: h('input', { value: s.company_name || '' }),
        company_phone: h('input.ltr', { value: s.company_phone || '' }),
        company_address: h('input', { value: s.company_address || '' }),
        office_no: h('input.ltr', { value: s.office_no || '' }),
        invoice_footer: h('input', { value: s.invoice_footer || '' }),
        theme: select(Object.entries(THEMES).map(([value, label]) => ({ value, label })), { value: s.theme }),
      };
      inp.theme.addEventListener('change', () => applyTheme(inp.theme.value));
      const save = async () => {
        try {
          state.settings = await api('/settings', { method: 'PUT', body: Object.fromEntries(Object.entries(inp).map(([k, i]) => [k, i.value])) });
          toast('تم حفظ الإعدادات', 'ok');
          onSaved?.();
        } catch (err) { fail(err); }
      };
      const admin = state.user.role === 'admin';
      win.body.append(
        h('div.grid.cols-2.panel',
          field('اسم المكتب', inp.company_name), field('الهاتف', inp.company_phone), field('العنوان', inp.company_address),
          field('رقم المكتب', inp.office_no), field('تذييل الفاتورة', inp.invoice_footer), field('ألوان الواجهة', inp.theme)),
        admin ? h('div.actions', h('button.btn.primary', { onclick: save }, 'حفظ')) : h('p.muted', 'تعديل الإعدادات من صلاحية المدير فقط (يمكنك معاينة الألوان).'),
      );
      win.body.querySelectorAll('input').forEach((i) => { i.disabled = !admin; });
    },
  });
}

export function openLicense() {
  return openWindow({
    key: 'license', title: 'ترخيص النظام', width: 520, height: 330,
    render: (win) => win.body.append(h('div.panel',
      h('p', h('b', 'منظومة الرحالة'), ` - الإصدار ${state.version}`),
      h('p', 'مرخصة لـ: ', h('b', state.settings.company_name)),
      h('p', 'رقم المكتب: ', h('b', state.settings.office_no)),
      h('p', 'نوع الترخيص: نسخة كاملة غير محدودة المدة (رخصة MIT مفتوحة المصدر).'),
      h('p.muted.small', 'البيانات محفوظة محلياً في ملف قاعدة البيانات data/rahhala.db — احرص على أخذ نسخة احتياطية منه دورياً.'))),
  });
}

export function openAbout() {
  return openWindow({
    key: 'about', title: 'حول النظام', width: 520, height: 380,
    render: (win) => win.body.append(h('div', { style: { textAlign: 'center' } },
      h('img.brand-logo', { src: 'img/logo-green.png', alt: 'الرحالة' }),
      h('p', 'منظومة متكاملة لإدارة حسابات مكاتب السياحة والسفر'),
      h('p.muted', 'الفواتير والتذاكر • إيصالات القبض والدفع • إشعارات التسوية • كشوف الحسابات • الخزينة • العملات • التقارير'),
      h('p', `الإصدار ${state.version}`))),
  });
}

// ------------------------------------------------------------ الآلة الحاسبة
export function openCalculator() {
  return openWindow({
    key: 'calc', title: 'الآلة الحاسبة', width: 300, height: 400,
    render: (win) => {
      const display = h('input', { value: '0', 'aria-label': 'الناتج' });
      const press = (k) => {
        if (k === 'C') display.value = '0';
        else if (k === '=') {
          const expr = display.value.replace(/×/g, '*').replace(/÷/g, '/');
          if (!/^[\d+\-*/.() ]+$/.test(expr)) { display.value = 'خطأ'; return; }
          try { display.value = String(Math.round(Function(`"use strict";return (${expr})`)() * 1000) / 1000); } catch { display.value = 'خطأ'; }
        } else display.value = display.value === '0' || display.value === 'خطأ' ? k : display.value + k;
      };
      const keys = ['C', '(', ')', '÷', '7', '8', '9', '×', '4', '5', '6', '-', '1', '2', '3', '+', '0', '.', '⌫', '='];
      display.addEventListener('keydown', (e) => { if (e.key === 'Enter') press('='); });
      win.body.append(h('div.calc', { dir: 'ltr' }, display, keys.map((k) => h('button.btn', {
        class: k === '=' ? 'primary' : '',
        onclick: () => (k === '⌫' ? (display.value = display.value.slice(0, -1) || '0') : press(k)),
      }, k))));
    },
  });
}

