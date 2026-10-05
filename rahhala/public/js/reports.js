// Account statements, treasury, sales/profit, balances, search and review screens.
import {
  api, h, qs, fmt, today, monthStart, pad, esc, toast, fail, confirmBox, field, select, dataTable, exportCSV,
  printTable, accountPicker, lookup, DOC_TYPES, ACCOUNT_TYPES, state,
} from './core.js';
import { openWindow } from './wm.js';
import { openDocument } from './documents.js';

const ALL_TYPES = Object.keys(ACCOUNT_TYPES).join(',');

/** Shared report frame: filters row, results holder, print/export buttons. */
function reportFrame(win, { filters, load, title }) {
  const holder = h('div', { style: { display: 'contents' } });
  let last = { cols: [], rows: [], extra: '' };
  const run = async () => {
    try {
      last = await load();
      holder.replaceChildren(...[].concat(last.view || dataTable(last.cols, last.rows, last.tableOpts || {})));
    } catch (err) { fail(err); }
  };
  win.body.append(
    h('div.filters.panel', filters, h('button.btn.primary', { onclick: run }, 'عرض')),
    holder,
    h('div.actions',
      h('button.btn', { onclick: () => printTable(last.title || title, last.cols, last.rows, last.extra || '') }, '🖨 طباعة'),
      h('button.btn', { onclick: () => exportCSV(last.title || title, last.cols, last.rows) }, '📊 تصدير Excel')),
  );
  return run;
}

// ------------------------------------------------------------ عرض حساب
export function openStatement(accountId = null) {
  return openWindow({
    title: 'عرض حساب - كشف حساب',
    width: 1050,
    height: 620,
    render: async (win) => {
      const party = accountPicker(ALL_TYPES, { value: accountId });
      const from = h('input', { type: 'date', value: today().slice(0, 4) + '-01-01' });
      const to = h('input', { type: 'date', value: today() });
      const summary = h('div.grid.panel');
      const cols = [
        { key: 'date', label: 'التاريخ' },
        { label: 'المستند', render: (r) => (r.type ? `${DOC_TYPES[r.type]} ${pad(r.no)}` : '') },
        { label: 'البيان', wrap: true, render: (r) => r.memo || r.notes || '' },
        { key: 'debit', label: 'مدين', num: true, total: true },
        { key: 'credit', label: 'دائن', num: true, total: true },
        { key: 'balance', label: 'الرصيد', num: true },
      ];
      const run = reportFrame(win, {
        title: 'كشف حساب',
        filters: [h('label', { style: { minWidth: '320px' } }, 'الحساب', party.el), h('label', 'من', from), h('label', 'إلى', to)],
        load: async () => {
          if (!party.value) throw new Error('اختر الحساب أولاً');
          const st = await api('/reports/statement' + qs({ account_id: party.value, from: from.value, to: to.value }));
          const rows = [{ date: from.value, memo: 'رصيد سابق', debit: 0, credit: 0, balance: st.opening }, ...st.rows];
          const bal = (v) => h('b.num', { class: v < 0 ? 'neg' : '' }, fmt(v));
          summary.replaceChildren(
            field('الحساب', h('b', `${st.account.code} - ${st.account.name}`)),
            field('رصيد سابق', bal(st.opening)), field('إجمالي مدين', bal(st.debit)), field('إجمالي دائن', bal(st.credit)),
            field('الرصيد النهائي', bal(st.closing)),
            field('الحالة', h('b', st.closing > 0 ? 'مدين (عليه)' : st.closing < 0 ? 'دائن (له)' : 'متزن')));
          return {
            title: `كشف حساب ${st.account.name}`,
            cols, rows,
            extra: `<p>الحساب: ${esc(st.account.code)} - ${esc(st.account.name)} &nbsp; | &nbsp; الفترة: ${esc(from.value)} إلى ${esc(to.value)} &nbsp; | &nbsp; الرصيد النهائي: <b>${fmt(st.closing)}</b> ${esc(state.settings.base_currency || 'LYD')}</p>`,
            view: [summary, dataTable(cols, rows, { onRowDblClick: (r) => r.document_id && openDocument({ id: r.document_id, type: r.type }) })],
          };
        },
      });
      if (accountId) party.ready.then(run);
    },
  });
}

// ------------------------------------------------------------ حركة الخزينة
export function openTreasury() {
  return openWindow({
    key: 'treasury',
    title: 'حركة الخزينة',
    width: 900,
    height: 520,
    render: async (win) => {
      const from = h('input', { type: 'date', value: monthStart() });
      const to = h('input', { type: 'date', value: today() });
      const cols = [
        { key: 'code', label: 'الرقم' },
        { key: 'name', label: 'الخزينة / المصرف' },
        { key: 'opening', label: 'رصيد أول المدة', num: true, total: true },
        { key: 'in', label: 'المقبوضات (وارد)', num: true, total: true },
        { key: 'out', label: 'المدفوعات (صادر)', num: true, total: true },
        { key: 'closing', label: 'الرصيد', num: true, total: true },
      ];
      const run = reportFrame(win, {
        title: 'حركة الخزينة',
        filters: [h('label', 'من', from), h('label', 'إلى', to)],
        load: async () => ({
          cols,
          rows: await api('/reports/treasury' + qs({ from: from.value, to: to.value })),
          extra: `<p>الفترة: ${esc(from.value)} إلى ${esc(to.value)}</p>`,
          tableOpts: { onRowDblClick: (r) => openStatement(r.id) },
        }),
      });
      win.body.append(h('p.muted.small', 'انقر مرتين على الخزينة لعرض كشف حركتها التفصيلي.'));
      run();
    },
  });
}

// ------------------------------------------------------------ المبيعات والأرباح
export function openSalesReport() {
  return openWindow({
    key: 'sales',
    title: 'تقرير المبيعات والأرباح',
    width: 950,
    height: 580,
    render: async (win) => {
      const from = h('input', { type: 'date', value: monthStart() });
      const to = h('input', { type: 'date', value: today() });
      const group = select([
        { value: 'service', label: 'حسب الخدمة' }, { value: 'supplier', label: 'حسب المزود' }, { value: 'carrier', label: 'حسب الناقل' },
        { value: 'client', label: 'حسب العميل' }, { value: 'day', label: 'حسب اليوم' },
      ]);
      const cols = [
        { key: 'label', label: 'البند' },
        { key: 'count', label: 'عدد البنود' },
        { key: 'sales', label: 'المبيعات', num: true, total: true },
        { key: 'cost', label: 'التكلفة', num: true, total: true },
        { key: 'profit', label: 'الربح', num: true, total: true },
      ];
      const run = reportFrame(win, {
        title: 'تقرير المبيعات والأرباح',
        filters: [h('label', 'من', from), h('label', 'إلى', to), h('label', 'التجميع', group)],
        load: async () => {
          const r = await api('/reports/sales' + qs({ from: from.value, to: to.value, group: group.value }));
          const sum = h('div.grid.panel',
            field('إجمالي المبيعات', h('b.num', fmt(r.totals.sales))),
            field('إجمالي التكلفة', h('b.num', fmt(r.totals.cost))),
            field('ربح البنود', h('b.num', fmt(r.totals.profit))),
            field('خدمات/تخفيض الفواتير', h('b.num', fmt(r.adjustments))),
            field('صافي الربح', h('b.num', { class: r.net_profit < 0 ? 'neg' : '' }, fmt(r.net_profit))));
          return {
            cols, rows: r.rows,
            extra: `<p>الفترة: ${esc(from.value)} إلى ${esc(to.value)} — صافي الربح: <b>${fmt(r.net_profit)}</b></p>`,
            view: [sum, dataTable(cols, r.rows)],
          };
        },
      });
      run();
    },
  });
}

// ------------------------------------------------------------ تقرير التذاكر / بنود الفواتير
export function openLinesReport() {
  return openWindow({
    key: 'lines',
    title: 'تقرير التذاكر والخدمات المباعة',
    width: 1150,
    height: 600,
    render: async (win) => {
      const services = await lookup('services', { fresh: true });
      const from = h('input', { type: 'date', value: monthStart() });
      const to = h('input', { type: 'date', value: today() });
      const svc = select(services.map((s) => ({ value: s.id, label: s.name })), { empty: 'كل الخدمات' });
      const supplier = accountPicker('supplier,subagent');
      const cols = [
        { label: 'الفاتورة', render: (r) => pad(r.no) },
        { key: 'doc_date', label: 'التاريخ' },
        { key: 'account_name', label: 'العميل' },
        { key: 'service_name', label: 'الخدمة' },
        { key: 'supplier_name', label: 'المزود' },
        { key: 'carrier_name', label: 'الناقل' },
        { key: 'doc_no', label: 'رقم المستند' },
        { key: 'pax_name', label: 'الاسم' },
        { key: 'description', label: 'البيان' },
        { key: 'currency', label: 'العملة' },
        { key: 'cost', label: 'التكلفة', num: true, total: true },
        { label: 'البيع', num: true, render: (r) => r.price + r.fees, total: true },
        { label: 'الربح', num: true, render: (r) => r.price + r.fees - r.cost, total: true },
      ];
      const run = reportFrame(win, {
        title: 'تقرير التذاكر والخدمات',
        filters: [h('label', 'من', from), h('label', 'إلى', to), h('label', 'الخدمة', svc), h('label', { style: { minWidth: '280px' } }, 'المزود', supplier.el)],
        load: async () => ({
          cols,
          rows: await api('/reports/lines' + qs({ from: from.value, to: to.value, service_id: svc.value, supplier_id: supplier.value })),
          tableOpts: { onRowDblClick: (r) => openDocument({ id: r.document_id, type: 'invoice' }) },
        }),
      });
      run();
    },
  });
}

// ------------------------------------------------------------ الأرصدة / ميزان المراجعة
export function openBalances(type, title) {
  return openWindow({
    key: 'bal-' + (type || 'all'),
    title,
    width: 900,
    height: 580,
    render: async (win) => {
      const hideZero = h('input', { type: 'checkbox', checked: !!type });
      const cols = [
        { key: 'code', label: 'الرقم' },
        { key: 'name', label: 'الاسم' },
        { label: 'النوع', render: (a) => ACCOUNT_TYPES[a.type] },
        { key: 'phone', label: 'الهاتف' },
        { key: 'debit', label: 'مدين', num: true, total: true },
        { key: 'credit', label: 'دائن', num: true, total: true },
        { key: 'balance', label: 'الرصيد', num: true, total: true },
      ];
      const run = reportFrame(win, {
        title,
        filters: [h('label.field.check', hideZero, h('span', 'إخفاء الأرصدة الصفرية'))],
        load: async () => {
          let rows = await api('/reports/balances' + qs({ type }));
          if (hideZero.checked) rows = rows.filter((r) => r.balance);
          return { cols, rows, tableOpts: { onRowDblClick: (r) => openStatement(r.id) } };
        },
      });
      win.body.append(h('p.muted.small', 'الرصيد الموجب = مدين (مستحق لنا)، السالب = دائن (مستحق علينا). انقر مرتين لعرض كشف الحساب.'));
      run();
    },
  });
}

// ------------------------------------------------------------ بحث
export function openSearch() {
  return openWindow({
    key: 'search',
    title: 'بحث شامل',
    width: 1050,
    height: 620,
    render: (win) => {
      const q = h('input', { placeholder: 'اسم المسافر، رقم التذكرة، رقم الفاتورة، اسم الحساب، الهاتف…', style: { minWidth: '360px' } });
      const out = h('div', { style: { display: 'grid', gap: '10px' } });
      const run = async () => {
        if (!q.value.trim()) return;
        try {
          const r = await api('/search' + qs({ q: q.value }));
          out.replaceChildren(
            h('h4', `البنود والتذاكر (${r.lines.length})`),
            dataTable([
              { label: 'فاتورة', render: (l) => pad(l.no) }, { key: 'doc_date', label: 'التاريخ' }, { key: 'account_name', label: 'العميل' },
              { key: 'service_name', label: 'الخدمة' }, { key: 'doc_no', label: 'رقم المستند' }, { key: 'pax_name', label: 'الاسم' },
              { key: 'description', label: 'البيان' }, { label: 'القيمة', num: true, render: (l) => l.price + l.fees },
            ], r.lines, { footer: false, onRowDblClick: (l) => openDocument({ id: l.document_id, type: 'invoice' }) }),
            h('h4', `المستندات (${r.documents.length})`),
            dataTable([
              { label: 'النوع', render: (d) => DOC_TYPES[d.type] }, { label: 'الرقم', render: (d) => pad(d.no) }, { key: 'date', label: 'التاريخ' },
              { key: 'account_name', label: 'الحساب' }, { key: 'amount', label: 'القيمة', num: true }, { key: 'currency', label: 'العملة' }, { key: 'notes', label: 'البيان' },
            ], r.documents, { footer: false, onRowDblClick: openDocument }),
            h('h4', `الحسابات (${r.accounts.length})`),
            dataTable([
              { key: 'code', label: 'الرقم' }, { key: 'name', label: 'الاسم' }, { label: 'النوع', render: (a) => ACCOUNT_TYPES[a.type] },
              { key: 'phone', label: 'الهاتف' }, { key: 'balance', label: 'الرصيد', num: true },
            ], r.accounts, { footer: false, onRowDblClick: (a) => openStatement(a.id) }),
          );
          out.querySelectorAll('.table-wrap').forEach((t) => { t.style.maxHeight = '220px'; t.style.minHeight = '60px'; });
        } catch (err) { fail(err); }
      };
      q.addEventListener('keydown', (e) => { if (e.key === 'Enter') run(); });
      win.body.append(h('div.filters.panel', h('label', { style: { flex: 1 } }, 'نص البحث', q), h('button.btn.primary', { onclick: run }, '🔍 بحث')), out);
    },
  });
}

// ------------------------------------------------------------ مراجعة
export function openReview(reviewed = false) {
  return openWindow({
    key: 'review-' + reviewed,
    title: reviewed ? 'المستندات المراجَعة' : 'مراجعة المستندات',
    width: 1050,
    height: 600,
    render: async (win) => {
      const from = h('input', { type: 'date', value: monthStart() });
      const to = h('input', { type: 'date', value: today() });
      const holder = h('div', { style: { display: 'contents' } });
      let rows = [];
      const checks = new Map();
      const load = async () => {
        try {
          rows = await api('/documents' + qs({ reviewed: reviewed ? 1 : 0, from: from.value, to: to.value }));
          checks.clear();
          const all = h('input', { type: 'checkbox', onchange: () => checks.forEach((c) => { c.checked = all.checked; }) });
          const cols = [
            { label: '✓', render: (d) => { const c = h('input', { type: 'checkbox' }); checks.set(d.id, c); return c; } },
            { label: 'النوع', render: (d) => DOC_TYPES[d.type] }, { label: 'الرقم', render: (d) => pad(d.no) }, { key: 'date', label: 'التاريخ' },
            { key: 'account_name', label: 'الحساب' }, { key: 'amount', label: 'القيمة', num: true }, { key: 'currency', label: 'العملة' },
            { key: 'notes', label: 'البيان', wrap: true }, { key: 'user_name', label: 'أنشأه' },
            ...(reviewed ? [{ key: 'reviewed_by_name', label: 'راجعه' }] : []),
          ];
          const table = dataTable(cols, rows, { footer: false, onRowDblClick: openDocument });
          if (rows.length) table.querySelector('th').replaceChildren(all);
          holder.replaceChildren(table);
        } catch (err) { fail(err); }
      };
      const selectedIds = () => [...checks].filter(([, c]) => c.checked).map(([id]) => id);
      const act = async () => {
        const ids = selectedIds();
        if (!ids.length) return toast('حدد مستنداً واحداً على الأقل', 'err');
        try {
          if (reviewed) {
            if (!(await confirmBox(`إلغاء مراجعة ${ids.length} مستند؟ ستصبح قابلة للتعديل.`))) return;
            for (const id of ids) await api(`/documents/${id}/review`, { method: 'POST', body: { reviewed: false } });
          } else {
            await api('/documents/review-all', { method: 'POST', body: { ids } });
          }
          toast('تم', 'ok');
          load();
        } catch (err) { fail(err); }
      };
      win.body.append(
        h('div.filters.panel', h('label', 'من', from), h('label', 'إلى', to), h('button.btn', { onclick: load }, 'عرض')),
        h('p.muted.small', reviewed
          ? 'المستندات المراجَعة مقفلة ضد التعديل والحذف. إلغاء المراجعة من صلاحية المدير.'
          : 'راجع المستندات ثم اعتمدها؛ المستند المعتمد يُقفل ضد التعديل والحذف. انقر مرتين لفتح المستند.'),
        holder,
        h('div.actions', h('button.btn.primary', { onclick: act }, reviewed ? '↩ إلغاء مراجعة المحدد' : '✓ اعتماد المحدد كمراجَع')),
      );
      load();
    },
  });
}
