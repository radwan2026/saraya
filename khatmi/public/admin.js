const $ = (s) => document.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => Number(n || 0).toFixed(3);
const ST = { pending: 'قيد المراجعة', approved: 'معتمد', rejected: 'مرفوض', cancelled: 'ملغي' };
let token = sessionStorage.getItem('khatmi.admin');

async function api(path, body, method) {
  const res = await fetch(path, { method: method || (body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/api/admin/login') { sessionStorage.removeItem('khatmi.admin'); location.reload(); }
  if (!res.ok) throw new Error(data.message || res.statusText);
  return data;
}
function toast(m, err) { const t = $('#toast'); t.textContent = m; t.className = 'toast' + (err ? ' err' : ''); t.hidden = false; setTimeout(() => { t.hidden = true; }, 3000); }
const date = (d) => (d ? new Date(d).toLocaleString('ar-LY', { dateStyle: 'short', timeStyle: 'short' }) : '');

$('#login-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  try {
    token = (await api('/api/admin/login', { password: new FormData(e.target).get('password') })).token;
    sessionStorage.setItem('khatmi.admin', token);
    start();
  } catch (err) { $('#login-err').textContent = err.message; $('#login-err').hidden = false; }
});
$('#out').addEventListener('click', () => { sessionStorage.removeItem('khatmi.admin'); location.reload(); });
$('#reload').addEventListener('click', () => load());

function start() { $('#login').hidden = true; $('#panel').hidden = false; load(); setInterval(load, 30000); }

async function load() {
  const d = await api('/api/admin/overview');
  const s = d.stats;
  $('#stats').innerHTML = [['المستخدمون', s.users], ['الأختام المباعة', s.orders], ['الإيرادات (د.ل)', money(s.revenue)], ['أرصدة المحافظ (د.ل)', money(s.walletTotal)], ['طلبات شحن معلقة', s.pendingTopups]]
    .map(([a, b]) => `<div class="stat"><small>${a}</small><b>${b}</b></div>`).join('');

  $('#topups').innerHTML = '<tr><th>التاريخ</th><th>العميل</th><th>الشركة</th><th>من رقم</th><th>المبلغ</th><th>الحالة</th><th>إجراء</th></tr>' +
    (d.topups.map((t) => `<tr>
      <td>${date(t.createdAt)}</td><td>${esc(t.userName)}<br><small dir="ltr">${esc(t.userPhone)}</small></td>
      <td>${esc(d.settings.carriers[t.carrier]?.name)}</td><td dir="ltr">${esc(t.senderPhone)}</td>
      <td>${money(t.amount)}${t.status === 'approved' ? `<br><small>أضيف ${money(t.credit)}</small>` : ''}</td>
      <td><span class="status ${t.status}">${ST[t.status]}</span></td>
      <td>${t.status === 'pending' ? `<input type="number" step="0.001" value="${t.amount}" data-recv="${t.id}" title="المبلغ المستلم">
        <button class="btn primary" data-ok="${t.id}">اعتماد</button> <button class="btn danger" data-no="${t.id}">رفض</button>` : esc(t.note)}</td></tr>`).join('') || '<tr><td colspan="7" class="empty">لا توجد طلبات</td></tr>');
  document.querySelectorAll('[data-ok]').forEach((b) => b.addEventListener('click', async () => {
    try { await api(`/api/admin/topups/${b.dataset.ok}/approve`, { received: document.querySelector(`[data-recv="${b.dataset.ok}"]`).value }); toast('تم اعتماد الشحن'); load(); } catch (e) { toast(e.message, true); }
  }));
  document.querySelectorAll('[data-no]').forEach((b) => b.addEventListener('click', async () => {
    const note = prompt('سبب الرفض (يظهر للعميل):', 'لم يصل التحويل');
    if (note === null) return;
    try { await api(`/api/admin/topups/${b.dataset.no}/reject`, { note }); load(); } catch (e) { toast(e.message, true); }
  }));

  const st = d.settings;
  const f = $('#settings-form');
  if (!f.dataset.loaded) {
    for (const k of ['pricePerLetter', 'iconFee', 'logoFee', 'minPrice']) f.elements[k].value = st[k];
    $('#carrier-settings').innerHTML = Object.entries(st.carriers).map(([k, c]) => `
      <fieldset><legend>${esc(c.name)}</legend><div class="settings">
        <label class="field"><span>رقم استقبال الرصيد</span><input name="${k}.number" dir="ltr" value="${esc(c.number)}" placeholder="${k === 'madar' ? '091XXXXXXX' : '092XXXXXXX'}"></label>
        <label class="field"><span>نسبة التحويل (1 = 100%)</span><input name="${k}.rate" type="number" step="0.01" min="0" max="2" value="${c.rate}"></label>
        <label class="field"><span>أقل مبلغ</span><input name="${k}.min" type="number" step="1" min="1" value="${c.min}"></label>
        <label class="field"><span>أعلى مبلغ</span><input name="${k}.max" type="number" step="1" min="1" value="${c.max}"></label>
        <label class="check"><input type="checkbox" name="${k}.enabled" ${c.enabled ? 'checked' : ''}> مفعّل</label>
      </div></fieldset>`).join('');
    f.dataset.loaded = '1';
  }

  $('#users').innerHTML = '<tr><th>الاسم</th><th>الهاتف</th><th>الرصيد</th><th>تاريخ التسجيل</th><th>تعديل الرصيد</th></tr>' +
    d.users.map((u) => `<tr><td>${esc(u.name)}</td><td dir="ltr">${esc(u.phone)}</td><td>${money(u.balance)}</td><td>${date(u.createdAt)}</td>
      <td><input type="number" step="0.001" data-adj="${u.id}" placeholder="±"> <button class="btn outline" data-adjbtn="${u.id}">تطبيق</button></td></tr>`).join('');
  document.querySelectorAll('[data-adjbtn]').forEach((b) => b.addEventListener('click', async () => {
    const amount = Number(document.querySelector(`[data-adj="${b.dataset.adjbtn}"]`).value);
    if (!amount) return;
    const note = prompt('ملاحظة للحركة:', amount > 0 ? 'إضافة رصيد من الإدارة' : 'خصم من الإدارة');
    if (note === null) return;
    try { await api(`/api/admin/users/${b.dataset.adjbtn}/adjust`, { amount, note }); toast('تم'); load(); } catch (e) { toast(e.message, true); }
  }));

  $('#orders').innerHTML = '<tr><th>التاريخ</th><th>العميل</th><th>النص</th><th>الحروف</th><th>السعر</th></tr>' +
    (d.orders.map((o) => `<tr><td>${date(o.createdAt)}</td><td>${esc(o.userName)}</td><td>${esc(o.spec.texts.top)}</td><td>${o.quote.letters}${o.quote.iconFee ? ' + أيقونة' : ''}</td><td>${money(o.price)}</td></tr>`).join('') || '<tr><td colspan="5" class="empty">لا توجد طلبات</td></tr>');

  $('#sms').innerHTML = '<tr><th>التاريخ</th><th>المرسل</th><th>الرسالة</th><th>الرقم المستخرج</th></tr>' +
    (d.smsLog.map((m) => `<tr><td>${date(m.at)}</td><td>${esc(m.from)}</td><td>${esc(m.message)}</td><td dir="ltr">${esc(m.sender || '-')} ${esc((m.amounts || []).join(', '))}</td></tr>`).join('') || '<tr><td colspan="4" class="empty">لا توجد رسائل</td></tr>');
}

$('#settings-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = e.target;
  const body = { carriers: {} };
  for (const el of f.elements) {
    if (!el.name) continue;
    const [a, b] = el.name.split('.');
    const v = el.type === 'checkbox' ? el.checked : el.value;
    if (b) (body.carriers[a] ||= {})[b] = v; else body[a] = v;
  }
  $('#set-err').hidden = true;
  try { await api('/api/admin/settings', body, 'PUT'); toast('تم حفظ الإعدادات'); load(); } catch (err) { $('#set-err').textContent = err.message; $('#set-err').hidden = false; }
});

if (token) start();
