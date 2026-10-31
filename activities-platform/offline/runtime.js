// تشغيل المنصة بالكامل داخل المتصفح دون خادم ولا إنترنت: يُعترض كل طلب إلى /api ويُمرَّر إلى نفس كود الخادم.
import './shims/buffer.js';
import { createApp } from '../src/app.js';

const NS = 'almadar-activities:';
const DEMO_PASSWORD = 'admin1234';
const { app, initialPassword } = createApp({
  dataDir: '/data',
  adminPassword: DEMO_PASSWORD,
  mailer: { enabled: false, async send() { return false; } },
  log: (...a) => console.error(...a),
});

// مسارات الصور: الخادم يخزّن "/assets/..." والملفات المحلية تحتاج "assets/...".
const toLocal = (t) => t.replace(/"\/(assets|docs)\//g, '"$1/');
const toServer = (t) => t.replace(/"(assets|docs)\//g, '"/$1/');

let ipCounter = 0;
async function dispatch(method, url, bodyText, { ip } = {}) {
  const u = new URL(url, 'http://offline');
  const headers = { 'content-type': bodyText ? 'application/json' : '' };
  const sid = localStorage.getItem(`${NS}sid`);
  if (sid) headers.cookie = `sid=${sid}`;
  let body = {};
  if (bodyText) { try { body = JSON.parse(toServer(bodyText)); } catch { body = {}; } }

  // رفع الصور: تُحفظ كصورة مضمّنة (data URL) لأن لا خادم ملفات.
  if (method === 'POST' && u.pathname === '/api/admin/upload') {
    if (!sid) return { status: 401, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ error: 'يرجى تسجيل الدخول' }) };
    return { status: 201, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ url: body.dataUrl }) };
  }

  const req = {
    method, url: u.pathname + u.search, path: u.pathname, query: Object.fromEntries(u.searchParams), body, headers,
    ip: ip || '127.0.0.1', protocol: 'http', secure: false,
    get(name) { return name.toLowerCase() === 'host' ? 'offline' : headers[name.toLowerCase()]; },
    is(type) { return (headers['content-type'] || '').includes(type); },
  };
  const res = {
    statusCode: 200, headers: {}, body: '', finished: false,
    status(c) { this.statusCode = c; return this; },
    set(k, v) {
      if (typeof k === 'object') for (const [a, b] of Object.entries(k)) this.headers[a.toLowerCase()] = b;
      else this.headers[k.toLowerCase()] = v;
      return this;
    },
    get(k) { return this.headers[k.toLowerCase()]; },
    type(t) { this.headers['content-type'] = t; return this; },
    json(o) { if (!this.headers['content-type']) this.headers['content-type'] = 'application/json'; return this.send(JSON.stringify(o)); },
    send(b) {
      if (b !== null && typeof b === 'object') return this.json(b);
      this.body = b ?? ''; this.finished = true; this.onDone(); return this;
    },
    redirect(loc) { this.statusCode = 302; this.headers.location = loc; this.finished = true; this.onDone(); },
  };
  await app.handle(req, res);
  const cookie = res.headers['set-cookie'];
  if (cookie) {
    const [pair] = cookie.split(';');
    const value = pair.split('=')[1];
    if (/Max-Age=0/.test(cookie) || !value) localStorage.removeItem(`${NS}sid`);
    else localStorage.setItem(`${NS}sid`, value);
  }
  const text = typeof res.body === 'string' ? res.body : String(res.body);
  return { status: res.statusCode, headers: res.headers, body: (res.headers['content-type'] || '').includes('json') ? toLocal(text) : text };
}

const realFetch = window.fetch.bind(window);
window.fetch = async (input, init = {}) => {
  const url = typeof input === 'string' ? input : input.url;
  if (!/^\/api\//.test(url)) return realFetch(input, init);
  const r = await dispatch((init.method || 'GET').toUpperCase(), url, init.body || '');
  return new Response(r.status === 204 ? null : r.body, { status: r.status, headers: r.headers['content-type'] ? { 'content-type': r.headers['content-type'] } : {} });
};

// صور تأتي من /api (رمز QR) تُولَّد محلياً.
const fixImage = async (img) => {
  const src = img.getAttribute('src') || '';
  if (!src.startsWith('/api/') || img.dataset.offline) return;
  img.dataset.offline = '1';
  const r = await dispatch('GET', src, '');
  img.src = URL.createObjectURL(new Blob([r.body], { type: r.headers['content-type'] || 'image/svg+xml' }));
};
new MutationObserver((muts) => {
  for (const m of muts) for (const n of m.addedNodes) {
    if (n.nodeType !== 1) continue;
    if (n.tagName === 'IMG') fixImage(n);
    n.querySelectorAll?.('img[src^="/api/"]').forEach(fixImage);
  }
}).observe(document.documentElement, { childList: true, subtree: true });

// روابط التصدير (Excel) تُنزَّل كملف.
document.addEventListener('click', async (e) => {
  const a = e.target.closest?.('a[href^="/api/"]');
  if (!a) return;
  e.preventDefault();
  const r = await dispatch('GET', a.getAttribute('href'), '');
  const name = (r.headers['content-disposition'] || '').match(/filename="([^"]+)"/)?.[1] || 'export.csv';
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([r.body], { type: r.headers['content-type'] || 'text/csv' }));
  link.download = name;
  link.click();
}, true);

// بيانات عرض أولية عند أول فتح، حتى تظهر المنصة بحالة واقعية أمام الإدارة.
async function populateDemo() {
  const call = (m, u, b) => dispatch(m, u, b ? JSON.stringify(b) : '', { ip: `10.0.0.${(ipCounter++ % 250) + 1}` }).then((r) => JSON.parse(r.body || 'null'));
  await call('POST', '/api/auth/login', { username: 'admin', password: DEMO_PASSWORD });
  const people = [
    ['سالم محمد الورفلي', '20456', 'محلل نظم', 'تقنية المعلومات'], ['هدى علي الشريف', '18233', 'أخصائية موارد بشرية', 'الموارد البشرية'],
    ['أحمد خالد بن عمران', '21110', 'مهندس شبكات', 'الشبكات'], ['مريم سالم القماطي', '19874', 'محاسبة', 'الشؤون المالية'],
    ['يوسف عبدالله المصراتي', '22541', 'مندوب مبيعات', 'المبيعات'], ['فاطمة أحمد الزليتني', '17652', 'مشرفة خدمة عملاء', 'خدمة العملاء'],
    ['محمود رمضان التاجوري', '23018', 'مهندس اتصالات', 'فرع المنطقة الشرقية'], ['خديجة عمر الفيتوري', '20987', 'مصممة تسويق', 'التسويق'],
  ];
  const open = (await call('GET', '/api/activities?status=open')) || [];
  let k = 0;
  for (const a of open) {
    for (let n = 0; n < (a.requiresApproval ? 5 : 3); n++) {
      const [name, id, job, dep] = people[k++ % people.length];
      await call('POST', `/api/activities/${a.id}/register`, {
        name, employeeId: id, jobTitle: job, department: dep, phone: `0912${100000 + k}`, contractType: 'دائم',
        affiliation: k % 4 === 0 ? 'club' : 'none', clubName: k % 4 === 0 ? 'نادٍ محلي' : '', pledge: true,
      });
    }
  }
  const pending = (await call('GET', '/api/admin/registrations?status=pending')) || [];
  for (const [i, r] of pending.entries()) {
    if (i % 3 === 0) await call('PATCH', `/api/admin/registrations/${r.id}`, { status: 'approved', managerNotified: i % 2 === 0 });
    else if (i % 3 === 1) await call('PATCH', `/api/admin/registrations/${r.id}`, { status: 'reserve' });
  }
  const quiz = ((await call('GET', '/api/admin/quizzes')) || [])[0];
  if (quiz) {
    for (const [i, [name, id, , dep]] of people.entries()) {
      await call('POST', `/api/quiz/${quiz.id}/submit`, { name, employeeId: id, department: dep, phone: `0913${100000 + i}`, answers: quiz.questions.map((q, x) => (i % 3 === 0 && x === 1 ? (q.correct + 1) % q.options.length : q.correct)) });
    }
  }
  const poll = ((await call('GET', '/api/polls')) || [])[0];
  if (poll) {
    let v = 0;
    for (const [o, w] of [3, 6, 2, 4, 5].entries()) for (let n = 0; n < w && poll.options[o]; n++) await call('POST', `/api/polls/${poll.id}/vote`, { name: 'موظف', employeeId: `V${v++}`, optionId: poll.options[o].id });
  }
  const talents = [
    { name: 'هدى علي محمد الشريف', employeeId: '18233', age: 29, branch: 'فرع المنطقة الغربية', department: 'الموارد البشرية', division: 'دائرة التطوير', section: 'قسم التدريب', phone: '0921234567', fields: ['sports', 'arts'], sportType: 'individual', fieldDescription: 'ألعاب القوى (جري المسافات المتوسطة) والرسم بالألوان المائية', level: 'advanced', levelDescription: 'عضو في نادٍ لألعاب القوى منذ 2019', achievements: 'المركز الثاني في سباق 5 كم 2024', needs: ['training', 'exposure'], needsDescription: 'دورة تدريبية متقدمة والمشاركة في الماراثون الخيري', consent: true, status: 'sponsored', rating: 5 },
    { name: 'أحمد خالد سالم بن عمران', employeeId: '21110', age: 34, branch: 'الإدارة العامة', department: 'الشبكات', phone: '0913334455', fields: ['innovation'], fieldDescription: 'برمجة تطبيقات وتحليل بيانات الشبكات', level: 'professional', levelDescription: 'تطوير ذاتي ومشاركات في هاكاثونات', achievements: 'المركز الأول في هاكاثون محلي 2025', needs: ['exposure', 'media'], consent: true, status: 'registered', rating: 4 },
    { name: 'خديجة عمر علي الفيتوري', employeeId: '20987', age: 27, branch: 'الإدارة العامة', department: 'التسويق', phone: '0925556677', fields: ['media', 'arts'], fieldDescription: 'تصوير ومونتاج وصناعة محتوى', level: 'intermediate', levelDescription: 'تطوير ذاتي', needs: ['equipment', 'training'], needsDescription: 'كاميرا احترافية ودورة مونتاج', consent: true, status: 'evaluating', rating: 3 },
    { name: 'محمود رمضان محمد التاجوري', employeeId: '23018', age: 31, branch: 'فرع المنطقة الشرقية', department: 'الاتصالات', phone: '0917778899', fields: ['sports'], sportType: 'team', fieldDescription: 'كرة القدم — حارس مرمى', level: 'advanced', levelDescription: 'لاعب سابق في نادٍ محلي', needs: ['training'], consent: true, status: 'new', rating: 0 },
  ];
  for (const t of talents) {
    await call('POST', '/api/talents', t);
  }
  const rows = (await call('GET', '/api/admin/talents')) || [];
  for (const t of talents) {
    const row = rows.find((r) => r.employeeId === t.employeeId);
    if (row && t.status !== 'new') await call('PATCH', `/api/admin/talents/${row.id}`, { status: t.status, rating: t.rating, evaluation: t.status === 'sponsored' ? 'موهبة واعدة — تُرشَّح للماراثون الخيري وتُدعم بدورة متقدمة.' : '' });
  }
  await call('POST', '/api/complaints', { type: 'support', name: 'أحمد خالد بن عمران', employeeId: '21110', department: 'الشبكات', phone: '0913334455', subject: 'طلب أطقم تدريب لمنتخب الخماسي', message: 'نحتاج أطقم تدريب وكرات قبل انطلاق البطولة.' });
  await call('POST', '/api/complaints', { type: 'suggestion', name: 'مريم سالم القماطي', employeeId: '19874', department: 'الشؤون المالية', phone: '0921112233', subject: 'تشكيل فريق نسائي لكرة الطائرة', message: 'نقترح تشكيل فريق نسائي وفق المادة 22 من الميثاق.' });
  await call('POST', '/api/auth/logout', {});
  localStorage.setItem(`${NS}demo`, '1');
}

const ready = initialPassword || !localStorage.getItem(`${NS}demo`) ? populateDemo().catch((e) => console.error(e)) : Promise.resolve();

// كل طلبات الصفحة تنتظر اكتمال تجهيز بيانات العرض في أول تشغيل.
const guardedFetch = window.fetch;
window.fetch = async (...args) => { await ready; return guardedFetch(...args); };

// شريط «نسخة عرض» + استعادة البيانات الأصلية + بيانات الدخول في صفحة لوحة التحكم.
function decorate() {
  const bar = document.createElement('div');
  bar.className = 'offline-pill no-print';
  bar.innerHTML = '🖥️ نسخة عرض تعمل دون إنترنت <button type="button">↺ استعادة البيانات الأصلية</button>';
  bar.querySelector('button').addEventListener('click', () => {
    if (!confirm('سيتم حذف كل التعديلات واستعادة بيانات العرض الأصلية. متابعة؟')) return;
    Object.keys(localStorage).filter((k) => k.startsWith(NS)).forEach((k) => localStorage.removeItem(k));
    location.reload();
  });
  document.body.appendChild(bar);
  const login = document.getElementById('loginForm');
  if (login) {
    const hint = document.createElement('div');
    hint.className = 'alert info';
    hint.style.fontSize = '14px';
    hint.innerHTML = `بيانات الدخول في نسخة العرض:<br>اسم المستخدم: <b dir="ltr">admin</b> — كلمة المرور: <b dir="ltr">${DEMO_PASSWORD}</b>`;
    login.querySelector('.form-msg').before(hint);
  }
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', decorate); else decorate();
