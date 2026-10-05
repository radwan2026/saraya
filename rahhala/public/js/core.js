// Shared helpers: API calls, DOM building, formatting, notifications, printing and export.

export const state = { token: null, user: null, settings: {}, version: '' };

try { state.token = localStorage.getItem('rahhala_token'); } catch { /* storage unavailable */ }

export function saveToken(token) {
  state.token = token;
  try { token ? localStorage.setItem('rahhala_token', token) : localStorage.removeItem('rahhala_token'); } catch { /* ignore */ }
}

export async function api(path, { method = 'GET', body } = {}) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'content-type': 'application/json', ...(state.token ? { authorization: `Bearer ${state.token}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  let data = null;
  try { data = await res.json(); } catch { /* empty body */ }
  if (res.status === 401 && path !== '/login') {
    saveToken(null);
    location.reload();
  }
  if (!res.ok) throw new Error(data?.error || 'تعذر الاتصال بالخادم');
  if (method !== 'GET') document.dispatchEvent(new Event('rahhala:changed'));
  return data;
}

export const qs = (obj) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(obj)) if (v !== undefined && v !== null && v !== '') p.set(k, v);
  const s = p.toString();
  return s ? '?' + s : '';
};

/** Tiny hyperscript: h('div.cls', {attrs}, ...children) */
export function h(tag, attrs, ...children) {
  const [name, ...classes] = tag.split('.');
  const el = document.createElement(name || 'div');
  if (classes.length) el.className = classes.join(' ');
  if (attrs && (typeof attrs !== 'object' || attrs instanceof Node || Array.isArray(attrs))) {
    children.unshift(attrs);
    attrs = null;
  }
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'class') el.className += ' ' + v;
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const nf = new Intl.NumberFormat('en-US', { minimumFractionDigits: 3, maximumFractionDigits: 3 });
export const fmt = (n) => nf.format(Number(n) || 0);
export const num = (v) => { const n = parseFloat(String(v ?? '').replace(/,/g, '')); return Number.isFinite(n) ? n : 0; };
export const round3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
export const today = () => new Date().toLocaleDateString('en-CA');
export const monthStart = () => today().slice(0, 8) + '01';
export const pad = (n, len = 6) => String(n).padStart(len, '0');
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const DOC_TYPES = {
  invoice: 'فاتورة', receipt: 'إيصال قبض', payment: 'إيصال دفع',
  debit_note: 'إشعار مدين', credit_note: 'إشعار دائن', opening: 'رصيد افتتاحي',
};
export const ACCOUNT_TYPES = {
  client: 'عميل', subagent: 'وكيل فرعي', supplier: 'مزود', cash: 'خزينة', bank: 'حساب مصرفي',
  revenue: 'إيرادات', expense: 'مصروفات', equity: 'حقوق ملكية',
};
export const docLabel = (d) => `${DOC_TYPES[d.type] || d.type} رقم ${pad(d.no)}`;

export function toast(msg, kind = '') {
  const t = h('div.toast', { class: kind }, msg);
  document.getElementById('toasts').append(t);
  setTimeout(() => t.remove(), kind === 'err' ? 5000 : 2800);
}

export const fail = (err) => toast(err.message || String(err), 'err');

export function confirmBox(message, okText = 'نعم') {
  return new Promise((resolve) => {
    const close = (v) => { back.remove(); resolve(v); };
    const back = h('div.modal-back', h('div.modal', { role: 'dialog' },
      h('div', message),
      h('div.actions', { style: { justifyContent: 'flex-start' } },
        h('button.btn.primary', { onclick: () => close(true) }, okText),
        h('button.btn', { onclick: () => close(false) }, 'إلغاء'))));
    document.body.append(back);
    back.querySelector('.btn.primary').focus();
  });
}

/** Labelled field: field('الاسم', input) */
export const field = (label, ...control) => h('label.field', h('span', label), control.length > 1 ? h('div.pair', control) : control[0]);

export function select(options, { value, empty, ...attrs } = {}) {
  const s = h('select', attrs);
  if (empty !== undefined) s.append(h('option', { value: '' }, empty));
  for (const o of options) s.append(h('option', { value: o.value }, o.label));
  if (value !== undefined && value !== null) s.value = String(value);
  return s;
}

/** Renders a read-only data table. cols: [{key, label, num, render, total}] */
export function dataTable(cols, rows, { onRowClick, onRowDblClick, footer = true, selectable } = {}) {
  const table = h('table.data');
  table.append(h('thead', h('tr', cols.map((c) => h('th', c.label)))));
  const tbody = h('tbody');
  if (!rows.length) {
    tbody.append(h('tr', h('td.empty', { colspan: cols.length }, 'لا توجد بيانات')));
  }
  rows.forEach((r) => {
    const tr = h('tr', { class: onRowClick || onRowDblClick ? 'clickable' : '' },
      cols.map((c) => {
        const v = c.render ? c.render(r) : r[c.key];
        if (c.num) return h('td.num', { class: num(v) < 0 ? 'neg' : '' }, fmt(v));
        return h('td', { class: c.wrap ? 'wrap' : '' }, v instanceof Node ? v : (v ?? ''));
      }));
    if (onRowClick || selectable) tr.addEventListener('click', () => {
      tbody.querySelectorAll('tr.sel').forEach((x) => x.classList.remove('sel'));
      tr.classList.add('sel');
      onRowClick?.(r);
    });
    if (onRowDblClick) tr.addEventListener('dblclick', () => onRowDblClick(r));
    tbody.append(tr);
  });
  table.append(tbody);
  if (footer && cols.some((c) => c.total)) {
    table.append(h('tfoot', h('tr', cols.map((c, i) => {
      if (c.total) {
        const t = typeof c.total === 'function' ? c.total(rows) : rows.reduce((s, r) => s + num(c.render ? c.render(r) : r[c.key]), 0);
        return h('td.num', fmt(t));
      }
      return h('td', i === 0 ? `العدد: ${rows.length}` : '');
    }))));
  }
  return h('div.table-wrap', table);
}

export function exportCSV(filename, cols, rows) {
  const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const lines = [cols.map((c) => cell(c.label)).join(',')];
  for (const r of rows) {
    lines.push(cols.map((c) => {
      const v = c.render ? c.render(r) : r[c.key];
      return cell(v instanceof Node ? v.textContent : c.num ? round3(v) : v);
    }).join(','));
  }
  const blob = new Blob(['﻿' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8' });
  const a = h('a', { href: URL.createObjectURL(blob), download: filename + '.csv' });
  document.body.append(a);
  a.click();
  a.remove();
}

const PRINT_CSS = `
  body { font-family: 'Cairo', Tahoma, sans-serif; direction: rtl; color: #111; margin: 24px; font-size: 13px; }
  .head { display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 3px double #333; padding-bottom: 10px; margin-bottom: 14px; }
  .head h1 { margin: 0; font-size: 22px; } .head .logo { font-size: 30px; font-weight: 700; color: #0b5fae; }
  h2 { text-align: center; margin: 6px 0 14px; font-size: 20px; }
  table { width: 100%; border-collapse: collapse; margin: 8px 0; }
  th, td { border: 1px solid #555; padding: 5px 6px; text-align: right; }
  th { background: #eee; } .num { direction: ltr; text-align: left; white-space: nowrap; }
  .meta { display: grid; grid-template-columns: 1fr 1fr; gap: 4px 20px; margin-bottom: 10px; }
  .box { border: 1px solid #555; padding: 8px; margin-top: 10px; } .sign { display: flex; justify-content: space-between; margin-top: 50px; }
  .footer { margin-top: 24px; text-align: center; color: #555; border-top: 1px solid #aaa; padding-top: 8px; }
  @media print { body { margin: 8mm; } button { display: none; } }`;

export function printHtml(title, bodyHtml) {
  const s = state.settings;
  const w = window.open('', '_blank', 'width=900,height=700');
  if (!w) return toast('اسمح للمتصفح بفتح النوافذ المنبثقة للطباعة', 'err');
  w.document.write(`<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><title>${esc(title)}</title>
    <style>${PRINT_CSS}</style></head><body>
    <div class="head"><div><h1>${esc(s.company_name)}</h1><div>${esc(s.company_address || '')}</div><div>${esc(s.company_phone || '')}</div></div>
    <div class="logo">الرحالة</div></div>
    ${bodyHtml}
    <div class="footer">${esc(s.invoice_footer || '')}</div>
    <script>window.onload = () => setTimeout(() => window.print(), 300);<\/script></body></html>`);
  w.document.close();
}

/** Print a table built from column definitions. */
export function printTable(title, cols, rows, extraHtml = '') {
  const head = cols.map((c) => `<th>${esc(c.label)}</th>`).join('');
  const body = rows.map((r) => '<tr>' + cols.map((c) => {
    const v = c.render ? c.render(r) : r[c.key];
    const text = v instanceof Node ? v.textContent : v;
    return c.num ? `<td class="num">${fmt(text)}</td>` : `<td>${esc(text)}</td>`;
  }).join('') + '</tr>').join('');
  const foot = cols.some((c) => c.total)
    ? '<tr>' + cols.map((c) => c.total
      ? `<th class="num">${fmt(typeof c.total === 'function' ? c.total(rows) : rows.reduce((s, r) => s + num(c.render ? c.render(r) : r[c.key]), 0))}</th>`
      : '<th></th>').join('') + '</tr>'
    : '';
  printHtml(title, `<h2>${esc(title)}</h2>${extraHtml}<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody><tfoot>${foot}</tfoot></table>`);
}

// ------------------------------------------------------------ cached lookups
const cache = new Map();
export async function lookup(table, { fresh } = {}) {
  if (fresh || !cache.has(table)) cache.set(table, api('/lookups/' + table));
  try { return await cache.get(table); } catch (err) { cache.delete(table); throw err; }
}
export const invalidate = (table) => cache.delete(table);

export async function accounts(type) {
  return api('/accounts' + qs({ type }));
}

/**
 * Account picker: code box + name box with autocomplete, like "الجهة" in the screenshots.
 * Returns { el, get value(), set value(id), account, onChange }.
 */
export function accountPicker(types, { value, onChange } = {}) {
  let list = [];
  let current = null;
  const listId = 'acc-' + Math.random().toString(36).slice(2);
  const code = h('input.ltr', { placeholder: 'رقم', style: { flex: '0 0 90px' } });
  const name = h('input', { list: listId, placeholder: 'اكتب اسم الحساب أو رقمه…' });
  const dl = h('datalist', { id: listId });
  const el = h('div.pair', code, name, dl);
  const set = (acc, fire = true) => {
    current = acc || null;
    code.value = acc ? acc.code : '';
    name.value = acc ? acc.name : '';
    if (fire) onChange?.(current);
  };
  const resolve = (text) => {
    const t = text.trim();
    return list.find((a) => a.code === t) || list.find((a) => `${a.code} - ${a.name}` === t) || list.find((a) => a.name === t);
  };
  code.addEventListener('change', () => { const a = resolve(code.value); set(a); if (!a && code.value) toast('رقم الحساب غير موجود', 'err'); });
  name.addEventListener('change', () => { const a = resolve(name.value); if (a) set(a); else if (!name.value) set(null); });
  const ready = accounts(types).then((rows) => {
    list = rows;
    dl.replaceChildren(...rows.map((a) => h('option', { value: `${a.code} - ${a.name}` })));
    if (value) set(list.find((a) => a.id === Number(value)), false);
  });
  return {
    el,
    ready,
    get value() { return current?.id || null; },
    set value(id) { ready.then(() => set(list.find((a) => a.id === Number(id)), false)); },
    get account() { return current; },
    focus: () => name.focus(),
    async reload() { list = await accounts(types); dl.replaceChildren(...list.map((a) => h('option', { value: `${a.code} - ${a.name}` }))); },
  };
}

export async function currencySelect(value, onChange) {
  const rows = await lookup('currencies', { fresh: true });
  const s = select(rows.map((c) => ({ value: c.code, label: `${c.code} - ${c.name}` })), { value: value || state.settings.base_currency || 'LYD' });
  s.rates = Object.fromEntries(rows.map((c) => [c.code, c.rate]));
  s.addEventListener('change', () => onChange?.(s.rates[s.value]));
  return s;
}
