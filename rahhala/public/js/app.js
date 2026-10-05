// Entry point: login, menu bar, toolbar, desktop dashboard and status bar.
import { api, h, fmt, state, saveToken, toast, fail, confirmBox } from './core.js';
import { closeAll } from './wm.js';
import { openInvoice, openVoucher, openDocList } from './documents.js';
import { openStatement, openTreasury, openSalesReport, openLinesReport, openBalances, openSearch, openReview } from './reports.js';
import * as S from './setup.js';

const $ = (id) => document.getElementById(id);

// ------------------------------------------------------------ menus (mirrors the original system's menu bar)
const SEP = '-';
const MENUS = [
  { label: 'جديد', items: [
    { label: 'فاتورة جديدة', hint: 'F2', run: () => openInvoice() },
    { label: 'إيصال قبض', hint: 'F3', run: () => openVoucher('receipt') },
    { label: 'إيصال دفع', hint: 'F4', run: () => openVoucher('payment') },
    SEP,
    { label: 'إشعار مدين - Debit Note', run: () => openVoucher('debit_note') },
    { label: 'إشعار دائن - Credit Note', run: () => openVoucher('credit_note') },
    SEP,
    { label: 'عميل جديد', run: () => S.openAccounts('client') },
    { label: 'مزود جديد', run: () => S.openAccounts('supplier') },
  ] },
  { label: 'الخزينة', items: [
    { label: 'ملف الحركة', run: () => openDocList({ title: 'ملف الحركة', types: 'invoice,receipt,payment,debit_note,credit_note,opening', key: 'movements' }) },
    { label: 'أسعار العملات', run: () => S.openCurrencies('أسعار العملات') },
    { label: 'إيصال قبض', run: () => openVoucher('receipt') },
    { label: 'إيصال دفع', run: () => openVoucher('payment') },
    SEP,
    { label: 'إشعارات التسوية', items: [
      { label: 'إشعار مدين - Debit Note', run: () => openVoucher('debit_note') },
      { label: 'إشعار دائن - Credit Note', run: () => openVoucher('credit_note') },
      SEP,
      { label: 'قائمة بالإشعارات', run: () => openDocList({ title: 'قائمة بالإشعارات', types: 'debit_note,credit_note' }) },
    ] },
    { label: 'فواتير', items: [
      { label: 'إنشاء فاتورة جديدة', run: () => openInvoice() },
      { label: 'قائمة الفواتير', run: () => openDocList({ title: 'قائمة الفواتير', types: 'invoice' }) },
      { label: 'تقرير التذاكر والخدمات', run: openLinesReport },
    ] },
    SEP,
    { label: 'عرض حساب', hint: 'F5', run: () => openStatement() },
    { label: 'قائمة المقبوضات والمدفوعات', run: () => openDocList({ title: 'قائمة المقبوضات والمدفوعات', types: 'receipt,payment' }) },
    { label: 'حركة الخزينة', run: openTreasury },
  ] },
  { label: 'بحث', items: [
    { label: 'بحث شامل (مسافر / تذكرة / فاتورة)', hint: 'Ctrl+F', run: openSearch },
    { label: 'دليل الحسابات', run: S.openChart },
  ] },
  { label: 'تقارير', items: [
    { label: 'المبيعات والأرباح', run: openSalesReport },
    { label: 'تقرير التذاكر والخدمات', run: openLinesReport },
    SEP,
    { label: 'أرصدة العملاء', run: () => openBalances('client', 'أرصدة العملاء') },
    { label: 'أرصدة الوكلاء الفرعيين', run: () => openBalances('subagent', 'أرصدة الوكلاء الفرعيين') },
    { label: 'أرصدة المزودين', run: () => openBalances('supplier', 'أرصدة المزودين') },
    { label: 'ميزان المراجعة', run: () => openBalances('', 'ميزان المراجعة') },
    SEP,
    { label: 'حركة الخزينة', run: openTreasury },
  ] },
  { label: 'مراجعة', items: [
    { label: 'مراجعة المستندات', run: () => openReview(false) },
    { label: 'المستندات المراجَعة', run: () => openReview(true) },
  ] },
  { label: 'خدمات', items: [
    { label: 'ضبط', items: [
      { label: 'إضافة مزود', run: () => S.openAccounts('supplier') },
      { label: 'إضافة عميل', run: () => S.openAccounts('client') },
      { label: 'البيانات المصرفية', run: S.openBankData },
      { label: 'إضافة خدمة', run: S.openServices },
      { label: 'دليل الحسابات', run: S.openChart },
      SEP,
      { label: 'New Sub Agent', run: () => S.openAccounts('subagent') },
      { label: 'الخزائن والمصارف', run: () => S.openAccounts('bank') },
      { label: 'حسابات المصروفات', run: () => S.openAccounts('expense') },
      SEP,
      { label: 'سياسات البيع', run: S.openServices },
      SEP,
      { label: 'إضافة شركة ناقلة', run: S.openCarriers },
      { label: 'إضافة مدينة', run: S.openCities },
      { label: 'إضافة دولة', run: S.openCountries },
      SEP,
      { label: 'عمولات خاصة', run: S.openCommissions },
      { label: 'العملات الأجنبية', run: () => S.openCurrencies() },
      { label: 'Import From Excel', run: S.openImport },
    ] },
    { label: 'المشغلين', admin: true, run: S.openUsers },
    SEP,
    { label: 'تغيير كلمة المرور', run: S.openChangePassword },
    { label: 'المظهر العام', run: () => S.openSettings(refreshChrome) },
    SEP,
    { label: 'ترخيص النظام…', run: S.openLicense },
    { label: 'حول النظام', run: S.openAbout },
    SEP,
    { label: 'تسجيل الخروج', run: logout },
  ] },
];

function closeMenus() {
  document.querySelectorAll('.menubar .open').forEach((m) => m.classList.remove('open'));
}

function buildMenu(items) {
  const menu = h('div.menu', { role: 'menu' });
  for (const it of items) {
    if (it === SEP) { menu.append(h('div.menu-sep')); continue; }
    if (it.admin && state.user.role !== 'admin') continue;
    const row = h('div.menu-item', { role: 'menuitem', tabindex: -1 }, h('span', it.label), it.hint ? h('span.hint', it.hint) : '');
    if (it.items) {
      row.classList.add('sub');
      row.append(buildMenu(it.items));
      const open = () => {
        row.parentElement.querySelectorAll(':scope > .menu-item.open').forEach((x) => x !== row && x.classList.remove('open'));
        row.classList.add('open');
      };
      row.addEventListener('mouseenter', open);
      row.addEventListener('click', (e) => { e.stopPropagation(); open(); });
    } else {
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        closeMenus();
        try { it.run(); } catch (err) { fail(err); }
      });
    }
    menu.append(row);
  }
  return menu;
}

function renderMenubar() {
  const bar = $('menubar');
  bar.replaceChildren();
  for (const m of MENUS) {
    const top = h('div.menu-top', h('button', { type: 'button', 'aria-haspopup': 'true' }, m.label), buildMenu(m.items));
    top.firstChild.addEventListener('click', (e) => {
      e.stopPropagation();
      const wasOpen = top.classList.contains('open');
      closeMenus();
      if (!wasOpen) top.classList.add('open');
    });
    top.addEventListener('mouseenter', () => {
      if (bar.querySelector('.menu-top.open') && !top.classList.contains('open')) { closeMenus(); top.classList.add('open'); }
    });
    bar.append(top);
  }
}

const TOOLS = [
  { ico: '🧾', label: 'فاتورة جديدة', run: () => openInvoice() },
  { ico: '💰', label: 'إيصال قبض', run: () => openVoucher('receipt') },
  { ico: '💸', label: 'إيصال دفع', run: () => openVoucher('payment') },
  { ico: '📒', label: 'عرض حساب', run: () => openStatement() },
  { ico: '🗂️', label: 'ملف الحركة', run: () => openDocList({ title: 'ملف الحركة', types: 'invoice,receipt,payment,debit_note,credit_note,opening', key: 'movements' }) },
  { ico: '🔍', label: 'بحث', run: openSearch },
  { ico: '🧮', label: 'الآلة الحاسبة', run: S.openCalculator },
  { ico: '📈', label: 'الأرباح', run: openSalesReport },
  { ico: '👥', label: 'العملاء', run: () => S.openAccounts('client') },
  { ico: '⏻', label: 'خروج', run: logout, cls: 'exit' },
];

function renderToolbar() {
  $('toolbar').replaceChildren(...TOOLS.map((t) => h('button.tool', { type: 'button', class: t.cls || '', title: t.label, onclick: t.run },
    h('span.ico', { 'aria-hidden': 'true' }, t.ico), h('span', t.label))));
}

async function renderDashboard() {
  try {
    const d = await api('/reports/dashboard');
    const stat = (label, v, onclick) => h('div.stat', { style: { cursor: 'pointer', pointerEvents: 'auto' }, onclick }, h('div.lbl', label), h('div.val', fmt(v)));
    $('dashboard').replaceChildren(
      stat('مبيعات اليوم', d.sales_today, openSalesReport),
      stat('مبيعات الشهر', d.sales_month, openSalesReport),
      stat('صافي ربح الشهر', d.profit_month, openSalesReport),
      stat('رصيد الخزائن', d.cash, openTreasury),
      stat('مستحق على العملاء', d.receivables, () => openBalances('client', 'أرصدة العملاء')),
      stat('مستحق للمزودين', d.payables, () => openBalances('supplier', 'أرصدة المزودين')),
    );
  } catch { /* dashboard is informational only */ }
}

function refreshChrome() {
  S.applyTheme(state.settings.theme);
  $('company-title').textContent = state.settings.company_name || '';
  $('st-office').textContent = state.settings.office_no || '';
  document.title = `الرحالة - ${state.settings.company_name || ''}`;
}

function tick() {
  const now = new Date();
  $('st-time').textContent = now.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  $('st-date').textContent = now.toLocaleDateString('en-CA');
}

async function startDesktop() {
  const me = await api('/me');
  state.user = me.user;
  state.settings = me.settings;
  state.version = me.version;
  $('login').classList.add('hidden');
  $('desktop').classList.remove('hidden');
  $('st-user').textContent = state.user.name;
  $('st-version').textContent = state.version;
  refreshChrome();
  renderMenubar();
  renderToolbar();
  renderDashboard();
  tick();
  setInterval(tick, 1000);
  setInterval(renderDashboard, 60000);
}

async function logout() {
  if (!(await confirmBox('هل تريد تسجيل الخروج من المنظومة؟', 'خروج'))) return;
  try { await api('/logout', { method: 'POST' }); } catch { /* ignore */ }
  closeAll();
  saveToken(null);
  location.reload();
}

function showLogin() {
  $('desktop').classList.add('hidden');
  $('login').classList.remove('hidden');
  $('login-form').password.focus();
}

$('login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  $('login-error').textContent = '';
  try {
    const r = await api('/login', { method: 'POST', body: { username: f.username.value, password: f.password.value } });
    saveToken(r.token);
    await startDesktop();
    toast(`مرحباً ${r.user.name}`, 'ok');
  } catch (err) {
    $('login-error').textContent = err.message;
  }
});

document.addEventListener('click', closeMenus);
document.addEventListener('keydown', (e) => {
  if (!state.user) return;
  const keys = { F2: () => openInvoice(), F3: () => openVoucher('receipt'), F4: () => openVoucher('payment'), F5: () => openStatement() };
  if (keys[e.key]) { e.preventDefault(); keys[e.key](); }
  if (e.ctrlKey && e.key.toLowerCase() === 'f') { e.preventDefault(); openSearch(); }
  if (e.key === 'Escape') closeMenus();
});
// keep the desktop numbers fresh after any change
let dashTimer;
document.addEventListener('rahhala:changed', () => { clearTimeout(dashTimer); dashTimer = setTimeout(renderDashboard, 500); });

if (state.token) startDesktop().catch(showLogin);
else showLogin();
