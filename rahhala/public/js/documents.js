// Invoices, receipts/payments, debit/credit notes and document lists.
import {
  api, h, qs, fmt, num, round3, today, monthStart, pad, esc, toast, fail, confirmBox, field, select, dataTable,
  exportCSV, printHtml, printTable, lookup, accounts, accountPicker, currencySelect, DOC_TYPES, docLabel, state,
} from './core.js';
import { openWindow } from './wm.js';

const PARTY_TYPES = 'client,subagent,supplier,expense,revenue,bank,cash,equity';

export function openDocument(doc) {
  if (doc.type === 'invoice') return openInvoice(doc.id);
  if (doc.type === 'opening') return toast('الرصيد الافتتاحي يُعدَّل من شاشة الحساب');
  return openVoucher(doc.type, doc.id);
}

// ================================================================= invoice
export function openInvoice(id = null) {
  return openWindow({
    key: id ? 'doc-' + id : undefined,
    title: id ? 'فاتورة' : 'إنشاء فاتورة جديدة',
    width: 1180,
    height: 640,
    render: (win) => renderInvoice(win, id),
  });
}

async function renderInvoice(win, id) {
  const [services, carriers, suppliers, banks] = await Promise.all([
    lookup('services', { fresh: true }), lookup('carriers', { fresh: true }), accounts('supplier,subagent'), lookup('bank_accounts', { fresh: true }),
  ]);
  const doc = id ? await api('/documents/' + id) : null;
  let docId = doc?.id || null;
  const locked = !!doc?.reviewed;

  const party = accountPicker('client,subagent,supplier', { value: doc?.account_id });
  const attention = h('input', { value: doc?.attention || '' });
  const notes = h('input', { value: doc?.notes || '' });
  const office = h('input.ltr', { readonly: true, value: state.settings.office_no || '0001' });
  const invNo = h('input.ltr', { readonly: true, value: doc ? pad(doc.no) : 'جديد' });
  const date = h('input', { type: 'date', value: doc?.date || today() });
  const subtotalEl = h('input.ltr.num', { readonly: true });
  const rate = h('input.ltr', { type: 'number', step: 'any', min: 0, value: doc?.rate ?? 1 });
  const currency = await currencySelect(doc?.currency, (r) => { rate.value = r; });
  const showFees = h('input', { type: 'checkbox', checked: doc?.show_fees });
  const svcPct = h('input.ltr', { type: 'number', step: 'any', value: doc?.services_pct || 0 });
  const svcVal = h('input.ltr.num', { readonly: true });
  const discPct = h('input.ltr', { type: 'number', step: 'any', value: doc?.discount_pct || 0 });
  const discVal = h('input.ltr.num', { readonly: true });
  const totalEl = h('input.ltr.num', { readonly: true, style: { fontSize: '16px' } });
  const showBank = h('input', { type: 'checkbox', checked: !!doc?.bank_account_id });
  const bankSel = select(banks.map((b) => ({ value: b.id, label: `${b.acc_title} - ${b.bank_name || ''}` })), { value: doc?.bank_account_id || banks[0]?.id, empty: '— اختر الحساب المصرفي —' });

  const tbody = h('tbody');
  const lineCols = ['التاريخ', 'الخدمة', 'المزود', 'الناقل', 'رقم المستند / التذكرة', 'الاسم', 'البيان', 'التكلفة', 'القيمة', 'خدمات', 'إجمالي', ''];
  const table = h('table.data.lines', h('thead', h('tr', lineCols.map((c) => h('th', c)))), tbody);

  const optSvc = services.map((s) => ({ value: s.id, label: s.name }));
  const optSup = suppliers.map((s) => ({ value: s.id, label: s.name }));
  const optCar = carriers.map((c) => ({ value: c.id, label: c.code ? `${c.code} - ${c.name}` : c.name }));

  function addLine(l = {}) {
    const inp = {
      date: h('input.w-date', { type: 'date', value: l.date || date.value }),
      service_id: select(optSvc, { value: l.service_id, empty: '', class: 'w-sm' }),
      supplier_id: select(optSup, { value: l.supplier_id, empty: '', class: 'w-lg' }),
      carrier_id: select(optCar, { value: l.carrier_id, empty: '', class: 'w-sm' }),
      doc_no: h('input.ltr.w-lg', { value: l.doc_no || '' }),
      pax_name: h('input.w-lg', { value: l.pax_name || '' }),
      description: h('input.w-lg', { value: l.description || '' }),
      cost: h('input.ltr.w-sm', { type: 'number', step: 'any', min: 0, value: l.cost || '' }),
      price: h('input.ltr.w-sm', { type: 'number', step: 'any', min: 0, value: l.price || '' }),
      fees: h('input.ltr.w-sm', { type: 'number', step: 'any', min: 0, value: l.fees || '' }),
    };
    const total = h('td.num');
    const del = h('button.btn.danger', { type: 'button', title: 'حذف البند', onclick: () => { tr.remove(); recalc(); } }, '✕');
    const tr = h('tr', Object.values(inp).map((i) => h('td', i)), total, h('td', del));
    tr.inputs = inp;
    tr.totalCell = total;
    const suggest = async () => {
      if (num(inp.price.value) || !num(inp.cost.value)) return;
      try {
        const { price } = await api('/pricing' + qs({ account_id: party.value, service_id: inp.service_id.value, cost: inp.cost.value }));
        if (!num(inp.price.value)) { inp.price.value = price; recalc(); }
      } catch { /* suggestion is optional */ }
    };
    inp.cost.addEventListener('change', suggest);
    tr.addEventListener('input', recalc);
    tbody.append(tr);
    recalc();
    return tr;
  }

  function readLines() {
    return [...tbody.children].map((tr) => Object.fromEntries(Object.entries(tr.inputs).map(([k, i]) => [k, i.value])))
      .filter((l) => num(l.price) || num(l.fees) || num(l.cost) || l.pax_name || l.doc_no || l.description);
  }

  function recalc() {
    let sub = 0;
    for (const tr of tbody.children) {
      const t = round3(num(tr.inputs.price.value) + num(tr.inputs.fees.value));
      tr.totalCell.textContent = fmt(t);
      sub += t;
    }
    sub = round3(sub);
    const sv = round3((sub * num(svcPct.value)) / 100);
    const dv = round3((sub * num(discPct.value)) / 100);
    subtotalEl.value = fmt(sub);
    svcVal.value = fmt(sv);
    discVal.value = fmt(dv);
    totalEl.value = fmt(sub + sv - dv);
  }
  [svcPct, discPct].forEach((i) => i.addEventListener('input', recalc));

  (doc?.lines?.length ? doc.lines : [{}]).forEach(addLine);

  async function save() {
    const payload = {
      type: 'invoice', account_id: party.value, attention: attention.value, notes: notes.value, date: date.value,
      currency: currency.value, rate: rate.value, services_pct: svcPct.value, discount_pct: discPct.value,
      show_fees: showFees.checked, bank_account_id: showBank.checked ? bankSel.value : null, lines: readLines(),
    };
    try {
      if (docId) await api('/documents/' + docId, { method: 'PUT', body: payload });
      else docId = (await api('/documents', { method: 'POST', body: payload })).id;
      const saved = await api('/documents/' + docId);
      invNo.value = pad(saved.no);
      win.setTitle(`فاتورة رقم ${pad(saved.no)} - ${saved.account_name}`);
      toast('تم حفظ الفاتورة', 'ok');
      return saved;
    } catch (err) {
      fail(err);
      return null;
    }
  }

  const btnSave = h('button.btn.big.primary', { onclick: save, disabled: locked }, '💾 حفظ');
  const btnUndo = h('button.btn.big', {
    onclick: async () => {
      if (!(await confirmBox('تجاهل التعديلات غير المحفوظة؟'))) return;
      win.close();
      openInvoice(docId);
    },
  }, '↩ تراجع');
  const btnPrint = h('button.btn.big', { onclick: async () => { const d = locked ? doc : await save(); if (d) printInvoice(d); } }, '🖨 طباعة');
  const btnExit = h('button.btn.big', { onclick: () => win.close() }, '🔒 خروج');

  if (doc) win.setTitle(`فاتورة رقم ${pad(doc.no)} - ${doc.account_name}`);

  win.body.append(
    locked ? h('div.panel', '🔒 هذه الفاتورة مُراجَعة ومقفلة. لإجراء تعديل يجب إلغاء المراجعة من قائمة «مراجعة».') : '',
    h('div.inv-head.panel',
      h('div.col', field('الجهة', party.el), field('السادة', attention), field('ملاحظات', notes)),
      h('div.col', field('رقم الفاتورة', office, invNo), field('التاريخ', date), field('المجموع', subtotalEl)),
      h('div.col',
        field('العملة', currency),
        field('سعر الصرف', rate),
        h('button.btn', { type: 'button', onclick: () => addLine().inputs.service_id.focus() }, '🔍 إضافة خدمات'),
        h('label.field.check', showFees, h('span', 'إظهار قيمة الخدمات في الطباعة'))),
      h('div.col.totals', field('خدمات %', svcPct, svcVal), field('تخفيض %', discPct, discVal), field('الإجمالي', totalEl))),
    h('div.table-wrap', table),
    h('div.actions', { style: { alignItems: 'center' } },
      h('label.field.check', showBank, h('span', 'إظهار الحساب البنكي في نهاية الفاتورة')), h('div', { style: { minWidth: '260px' } }, bankSel)),
    h('div.actions', btnSave, btnPrint, btnUndo, btnExit),
  );
  recalc();
}

export function printInvoice(d) {
  const showFees = !!d.show_fees;
  const rows = d.lines.map((l) => `<tr>
    <td>${esc(l.date || d.date)}</td><td>${esc(l.service_name || '')}</td><td class="num">${esc(l.doc_no || '')}</td>
    <td>${esc(l.pax_name || '')}</td><td>${esc(l.description || '')}</td>
    <td class="num">${fmt(showFees ? l.price : l.price + l.fees)}</td>
    ${showFees ? `<td class="num">${fmt(l.fees)}</td>` : ''}
    <td class="num">${fmt(l.price + l.fees)}</td></tr>`).join('');
  const sv = (d.subtotal * d.services_pct) / 100;
  const dv = (d.subtotal * d.discount_pct) / 100;
  const b = d.bank;
  printHtml(`فاتورة ${pad(d.no)}`, `
    <h2>فاتورة رقم ${esc(state.settings.office_no || '')}-${pad(d.no)}</h2>
    <div class="meta">
      <div><b>الجهة:</b> ${esc(d.account_code)} - ${esc(d.account_name)}</div><div><b>التاريخ:</b> <bdi>${esc(d.date)}</bdi></div>
      <div><b>السادة:</b> ${esc(d.attention || '')}</div><div><b>العملة:</b> ${esc(d.currency)}</div>
      ${d.notes ? `<div><b>ملاحظات:</b> ${esc(d.notes)}</div>` : ''}
    </div>
    <table><thead><tr><th>التاريخ</th><th>الخدمة</th><th>رقم المستند</th><th>الاسم</th><th>البيان</th><th>القيمة</th>
      ${showFees ? '<th>خدمات</th>' : ''}<th>الإجمالي</th></tr></thead><tbody>${rows}</tbody></table>
    <table style="width:320px;margin-right:auto">
      <tr><th>المجموع</th><td class="num">${fmt(d.subtotal)}</td></tr>
      ${d.services_pct ? `<tr><th>خدمات ${d.services_pct}%</th><td class="num">${fmt(sv)}</td></tr>` : ''}
      ${d.discount_pct ? `<tr><th>تخفيض ${d.discount_pct}%</th><td class="num">${fmt(dv)}</td></tr>` : ''}
      <tr><th>الإجمالي (${esc(d.currency)})</th><td class="num"><b>${fmt(d.amount)}</b></td></tr>
    </table>
    ${b ? `<div class="box"><b>بيانات الحساب المصرفي</b><table>
      <tr><th>Acc. Title</th><td>${esc(b.acc_title)}</td><th>Bank</th><td>${esc(b.bank_name || '')}</td></tr>
      <tr><th>Company</th><td>${esc(b.company_name || '')}</td><th>Account No</th><td class="num">${esc(b.account_no || '')}</td></tr>
      <tr><th>IBAN</th><td class="num">${esc(b.iban || '')}</td><th>SWIFT</th><td class="num">${esc(b.swift || '')}</td></tr>
      ${b.details || b.more_details ? `<tr><td colspan="4">${esc(b.details || '')} ${esc(b.more_details || '')}</td></tr>` : ''}
    </table></div>` : ''}
    <div class="sign"><span>المحاسب: ${esc(d.user_name || '')}</span><span>التوقيع: ............................</span></div>`);
}

// ================================================================= vouchers & notes
const VOUCHER = {
  receipt: { title: 'إيصال قبض', party: 'استلمنا من', counter: 'إلى الخزينة / المصرف' },
  payment: { title: 'إيصال دفع', party: 'صرفنا إلى', counter: 'من الخزينة / المصرف' },
  debit_note: { title: 'إشعار مدين - Debit Note', party: 'الحساب', hint: 'يزيد رصيد الحساب المدين (مبلغ مستحق على الجهة).' },
  credit_note: { title: 'إشعار دائن - Credit Note', party: 'الحساب', hint: 'يخفض رصيد الحساب (مبلغ مستحق للجهة / خصم / استرجاع).' },
};

export function openVoucher(type, id = null) {
  const cfg = VOUCHER[type];
  return openWindow({
    key: id ? 'doc-' + id : undefined,
    title: cfg.title,
    width: 640,
    height: 520,
    render: (win) => renderVoucher(win, type, id),
  });
}

async function renderVoucher(win, type, id) {
  const cfg = VOUCHER[type];
  const doc = id ? await api('/documents/' + id) : null;
  let docId = doc?.id || null;
  const locked = !!doc?.reviewed;
  const balance = h('span.num');
  const showBalance = async (acc) => {
    if (!acc) { balance.textContent = ''; return; }
    const [row] = (await api('/accounts' + qs({ q: acc.code, all: 1 }))).filter((a) => a.id === acc.id);
    balance.textContent = row ? fmt(row.balance) : '';
    balance.classList.toggle('neg', row?.balance < 0);
  };
  const party = accountPicker(PARTY_TYPES, { value: doc?.account_id, onChange: showBalance });
  party.ready.then(() => party.account && showBalance(party.account));
  const counterRows = cfg.counter ? await accounts('cash,bank') : [];
  const counter = cfg.counter ? select(counterRows.map((a) => ({ value: a.id, label: `${a.code} - ${a.name}` })), { value: doc?.counter_account_id }) : null;
  const no = h('input.ltr', { readonly: true, value: doc ? pad(doc.no) : 'جديد' });
  const date = h('input', { type: 'date', value: doc?.date || today() });
  const amount = h('input.ltr', { type: 'number', step: 'any', min: 0, value: doc?.amount || '', style: { fontSize: '18px' } });
  const rate = h('input.ltr', { type: 'number', step: 'any', value: doc?.rate ?? 1 });
  const currency = await currencySelect(doc?.currency, (r) => { rate.value = r; });
  const notes = h('textarea', { rows: 3 }, doc?.notes || '');

  if (doc) win.setTitle(`${cfg.title} رقم ${pad(doc.no)}`);

  async function save() {
    const payload = {
      type, account_id: party.value, counter_account_id: counter?.value, date: date.value, amount: amount.value,
      currency: currency.value, rate: rate.value, notes: notes.value,
    };
    try {
      if (docId) await api('/documents/' + docId, { method: 'PUT', body: payload });
      else docId = (await api('/documents', { method: 'POST', body: payload })).id;
      const saved = await api('/documents/' + docId);
      no.value = pad(saved.no);
      win.setTitle(`${cfg.title} رقم ${pad(saved.no)}`);
      showBalance(party.account);
      toast('تم الحفظ', 'ok');
      return saved;
    } catch (err) {
      fail(err);
      return null;
    }
  }

  win.body.append(
    locked ? h('div.panel', '🔒 المستند مُراجَع ومقفل.') : '',
    cfg.hint ? h('div.panel.small', cfg.hint) : '',
    h('div.grid.cols-2.panel',
      field('الرقم', no),
      field('التاريخ', date),
      h('div', { style: { gridColumn: '1 / -1' } }, field(cfg.party, party.el)),
      field('الرصيد الحالي', balance),
      counter ? field(cfg.counter, counter) : '',
      field('المبلغ', amount),
      field('العملة', currency),
      field('سعر الصرف', rate),
      h('div', { style: { gridColumn: '1 / -1' } }, field('البيان', notes))),
    h('div.actions',
      h('button.btn.big.primary', { onclick: save, disabled: locked }, '💾 حفظ'),
      h('button.btn.big', { onclick: async () => { const d = locked ? doc : await save(); if (d) printVoucher(d); } }, '🖨 طباعة'),
      h('button.btn.big', { onclick: () => { win.close(); openVoucher(type); } }, '➕ جديد'),
      h('button.btn.big', { onclick: () => win.close() }, '🔒 خروج')),
  );
}

export function printVoucher(d) {
  const cfg = VOUCHER[d.type];
  const line = d.type === 'receipt' ? `استلمنا من السيد/ة: <b>${esc(d.account_name)}</b>`
    : d.type === 'payment' ? `صرفنا إلى السيد/ة: <b>${esc(d.account_name)}</b>`
      : `الحساب: <b>${esc(d.account_code)} - ${esc(d.account_name)}</b>`;
  printHtml(`${cfg.title} ${pad(d.no)}`, `
    <h2>${esc(cfg.title)}</h2>
    <div class="meta"><div><b>الرقم:</b> ${pad(d.no)}</div><div><b>التاريخ:</b> <bdi>${esc(d.date)}</bdi></div></div>
    <div class="box" style="font-size:16px;line-height:2.2">
      ${line}<br>
      مبلغاً وقدره: <b class="num">${fmt(d.amount)} ${esc(d.currency)}</b>${d.rate !== 1 ? ` (سعر الصرف ${d.rate} = ${fmt(d.amount * d.rate)} ${esc(state.settings.base_currency || 'LYD')})` : ''}<br>
      ${d.counter_name ? `${d.type === 'receipt' ? 'إلى' : 'من'}: ${esc(d.counter_name)}<br>` : ''}
      وذلك عن: ${esc(d.notes || '')}
    </div>
    <div class="sign"><span>المستلم: ............................</span><span>المحاسب: ${esc(d.user_name || '')}</span></div>`);
}

// ================================================================= lists
const DOC_COLS = [
  { label: 'النوع', render: (d) => DOC_TYPES[d.type] },
  { label: 'الرقم', render: (d) => pad(d.no) },
  { key: 'date', label: 'التاريخ' },
  { label: 'الحساب', render: (d) => `${d.account_code} - ${d.account_name}` },
  { key: 'counter_name', label: 'الخزينة' },
  { key: 'currency', label: 'العملة' },
  { key: 'amount', label: 'القيمة', num: true },
  { label: 'بالعملة المحلية', num: true, render: (d) => d.amount * d.rate, total: true },
  { key: 'notes', label: 'البيان', wrap: true },
  { key: 'user_name', label: 'المستخدم' },
  { label: 'مراجعة', render: (d) => (d.reviewed ? h('span.badge.ok', '✓ مراجَع') : h('span.badge', 'جديد')) },
];

/** Generic list of documents with filters. opts: { title, types, key } */
export function openDocList({ title, types, key }) {
  return openWindow({
    key: key || 'list-' + types,
    title,
    width: 1100,
    height: 600,
    render: async (win) => {
      const from = h('input', { type: 'date', value: monthStart() });
      const to = h('input', { type: 'date', value: today() });
      const typeSel = select(types.split(',').map((t) => ({ value: t, label: DOC_TYPES[t] })), { empty: 'الكل' });
      const party = accountPicker(PARTY_TYPES);
      const q = h('input', { placeholder: 'رقم / اسم / بيان' });
      const holder = h('div', { style: { display: 'contents' } });
      let rows = [];
      let selected = null;
      const load = async () => {
        try {
          rows = await api('/documents' + qs({ type: typeSel.value || types, from: from.value, to: to.value, account_id: party.value, q: q.value }));
          selected = null;
          holder.replaceChildren(dataTable(DOC_COLS, rows, { onRowClick: (r) => { selected = r; }, onRowDblClick: openDocument }));
        } catch (err) { fail(err); }
      };
      const need = (fn) => async () => (selected ? fn(selected) : toast('اختر مستنداً من القائمة أولاً', 'err'));
      win.body.append(
        h('div.filters.panel',
          h('label', 'من تاريخ', from), h('label', 'إلى تاريخ', to),
          types.includes(',') ? h('label', 'النوع', typeSel) : '',
          h('label', { style: { minWidth: '280px' } }, 'الحساب', party.el),
          h('label', 'بحث', q),
          h('button.btn.primary', { onclick: load }, 'عرض')),
        holder,
        h('div.actions',
          h('button.btn', { onclick: need(openDocument) }, '📂 فتح'),
          h('button.btn', { onclick: need(async (d) => { const full = await api('/documents/' + d.id); d.type === 'invoice' ? printInvoice(full) : printVoucher(full); }) }, '🖨 طباعة المستند'),
          h('button.btn.danger', {
            onclick: need(async (d) => {
              if (!(await confirmBox(`حذف ${docLabel(d)} نهائياً؟`, 'حذف'))) return;
              try { await api('/documents/' + d.id, { method: 'DELETE' }); toast('تم الحذف', 'ok'); load(); } catch (err) { fail(err); }
            }),
          }, '🗑 حذف'),
          h('button.btn', { onclick: () => printTable(title, DOC_COLS, rows, `<p>من ${from.value} إلى ${to.value}</p>`) }, '🖨 طباعة القائمة'),
          h('button.btn', { onclick: () => exportCSV(title, DOC_COLS, rows) }, '📊 تصدير Excel'),
          h('button.btn', { onclick: load }, '↻ تحديث')),
      );
      await load();
    },
  });
}
