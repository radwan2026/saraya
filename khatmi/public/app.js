// ختمي — واجهة المستخدم
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

// ================= الترجمة =================
const I18N = {
  ar: {
    appName: 'ختمي', tagline: 'صمّم ختمك الاحترافي بالذكاء الاصطناعي خلال دقيقة', login: 'تسجيل الدخول', register: 'حساب جديد',
    fullName: 'الاسم الكامل', phone: 'رقم الهاتف', password: 'كلمة المرور', switchLang: 'English', langShort: 'EN', logout: 'خروج',
    navStudio: 'التصميم', navWallet: 'المحفظة', navOrders: 'أختامي', lyd: 'د.ل', lydLong: 'دينار ليبي',
    stepData: 'بيانات الختم', sealType: 'نوع الختم', company: 'شركة / مؤسسة', personal: 'شخصي', language: 'لغة الختم', both: 'الاثنين',
    nameAr: 'الاسم بالعربي (شخصي أو اسم الشركة)', nameEn: 'الاسم بالإنجليزي', taglineLbl: 'النشاط أو المسمى الوظيفي (اختياري)',
    city: 'المدينة (اختياري)', extraLbl: 'سطر إضافي: هاتف / سجل تجاري (اختياري)', logo: 'الشعار (اختياري — يضاف رسم الشعار للسعر)',
    uploadLogo: 'رفع الشعار', remove: 'إزالة', logoInk: 'بلون الحبر', logoOriginal: 'ألوان أصلية', logoThreshold: 'درجة تحويل الشعار',
    styleNotes: 'وصف الأسلوب (اختياري)', styleNotesPh: 'مثال: رسمي، فخم، ألوان هادئة…', aiDesign: 'صمّم لي بالذكاء الاصطناعي', manualDesign: 'تصميم يدوي',
    aiOn: 'المصمم الذكي (Claude) جاهز.', aiOff: 'يعمل المصمم الذكي المحلي.', stepPick: 'اختر تصميماً', srcAi: 'ذكاء اصطناعي', srcLocal: 'مصمم ذكي',
    stepEdit: 'التصميم المباشر', editingOrder: 'تعديل مجاني لختم مشترى (النصوص والشعار ثابتة)', cancel: 'إلغاء',
    shape: 'الشكل', width: 'العرض', height: 'الارتفاع', mm: 'ملم', ink: 'لون الحبر', border: 'الإطار', fontAr: 'الخط العربي', fontEn: 'الخط الإنجليزي',
    iconLbl: 'أيقونة / شعار في المنتصف', separator: 'الفواصل', textScale: 'حجم النص', spacing: 'تباعد الحروف (إنجليزي)', innerRing: 'إطار داخلي',
    slotTop: 'النص العلوي (حول الإطار)', slotBottom: 'النص السفلي (حول الإطار)', slotCenter: 'نص المنتصف', slotExtra: 'سطر صغير في المنتصف',
    line1: 'السطر الأول (الاسم)', line2: 'السطر الثالث', line3: 'السطر الثاني', line4: 'السطر الرابع',
    livePreview: 'المعاينة المباشرة', realInk: 'مظهر حبر حقيقي', letters: 'عدد الحروف', perLetter: 'سعر الحرف', lettersTotal: 'قيمة الحروف',
    iconFee: 'رسوم الأيقونة', logoFee: 'رسوم الشعار', minimum: 'الحد الأدنى', total: 'الإجمالي', yourBalance: 'رصيد محفظتك',
    buy: 'شراء وتنزيل', topupFirst: 'اشحن المحفظة', emptyDesign: 'أدخل نص الختم', saveFree: 'حفظ التعديلات مجاناً',
    formatsHint: 'تحصل على ملف PDF و SVG متجه قابل للتعديل + صورة PNG بدقة عالية', priceText: 'ختم نصي', priceIcon: 'ختم بأيقونة ونص',
    shapes: { circle: 'دائري', oval: 'بيضاوي', rect: 'مستطيل', rounded: 'مستطيل منحني', hexagon: 'سداسي' },
    borders: { single: 'مفرد', double: 'مزدوج', 'thick-thin': 'سميك ورفيع', dotted: 'منقّط', dashed: 'متقطع', beaded: 'خرز' },
    icons: { none: 'بدون', logo: 'شعاري', star: 'نجمة', crescent: 'هلال', check: 'صح' },
    seps: { star: 'نجوم', dot: 'نقاط', none: 'بدون' },
    confirmTitle: 'تأكيد الشراء', confirmBuy: 'تأكيد الخصم من المحفظة', after: 'الرصيد بعد الشراء',
    bought: 'تم شراء الختم بنجاح! 🎉', download: 'تنزيل', walletBalance: 'رصيد المحفظة', topupTitle: 'شحن المحفظة برصيد المكالمات',
    topupHint: 'حوّل رصيداً من خطك (المدار أو ليبيانا) إلى رقم ختمي، وسيضاف المبلغ إلى محفظتك بعد التأكيد.',
    carrier: 'الشركة', senderPhone: 'رقمك الذي ستحوّل منه', amount: 'قيمة الرصيد (د.ل)', topupSubmit: 'متابعة',
    unavailable: 'غير متاح حالياً', willCredit: 'سيضاف إلى محفظتك', topupRequests: 'طلبات الشحن', transactions: 'حركات المحفظة',
    instrTitle: 'خطوة أخيرة: حوّل الرصيد', instr1: 'افتح خدمة تحويل الرصيد في', instr2: 'حوّل مبلغ', instr3: 'من رقمك', instr4: 'إلى رقم ختمي:',
    instr5: 'سيتم إضافة الرصيد لمحفظتك فور التأكد من وصول التحويل.', copy: 'نسخ الرقم', copied: 'تم النسخ',
    st: { pending: 'قيد المراجعة', approved: 'تمت الإضافة', rejected: 'مرفوض', cancelled: 'ملغي' },
    noItems: 'لا توجد بيانات بعد', myOrders: 'أختامي المشتراة', noOrders: 'لم تشترِ أي ختم بعد. ابدأ التصميم الآن!',
    editStyle: 'تعديل', saved: 'تم حفظ التعديلات', needLogin: 'يرجى تسجيل الدخول', designing: 'جاري التصميم…',
    pickVariant: 'تم اختيار التصميم، عدّل عليه كما تريد', nameFirst: 'أدخل الاسم أولاً', cancelReq: 'إلغاء الطلب',
    fonts: { cairo: 'القاهرة (عصري)', tajawal: 'تجوال (نظيف)', amiri: 'أميري (نسخ رسمي)', reemkufi: 'ريم كوفي', montserrat: 'Montserrat', playfair: 'Playfair (كلاسيكي)' },
  },
  en: {
    appName: 'Khatmi', tagline: 'Design your professional seal with AI in a minute', login: 'Sign in', register: 'Create account',
    fullName: 'Full name', phone: 'Phone number', password: 'Password', switchLang: 'العربية', langShort: 'ع', logout: 'Logout',
    navStudio: 'Design', navWallet: 'Wallet', navOrders: 'My seals', lyd: 'LYD', lydLong: 'Libyan Dinar',
    stepData: 'Seal details', sealType: 'Seal type', company: 'Company', personal: 'Personal', language: 'Seal language', both: 'Both',
    nameAr: 'Arabic name (personal or company)', nameEn: 'English name', taglineLbl: 'Activity or job title (optional)',
    city: 'City (optional)', extraLbl: 'Extra line: phone / reg. no. (optional)', logo: 'Logo (optional — adds the logo fee)',
    uploadLogo: 'Upload logo', remove: 'Remove', logoInk: 'Ink color', logoOriginal: 'Original colors', logoThreshold: 'Logo conversion level',
    styleNotes: 'Style notes (optional)', styleNotesPh: 'e.g. formal, luxurious, calm colors…', aiDesign: 'Design it with AI', manualDesign: 'Manual design',
    aiOn: 'AI designer (Claude) is ready.', aiOff: 'Local smart designer is active.', stepPick: 'Pick a design', srcAi: 'AI', srcLocal: 'Smart designer',
    stepEdit: 'Live design', editingOrder: 'Free restyle of a purchased seal (texts & logo locked)', cancel: 'Cancel',
    shape: 'Shape', width: 'Width', height: 'Height', mm: 'mm', ink: 'Ink color', border: 'Border', fontAr: 'Arabic font', fontEn: 'English font',
    iconLbl: 'Center icon / logo', separator: 'Separators', textScale: 'Text size', spacing: 'Letter spacing (English)', innerRing: 'Inner ring',
    slotTop: 'Top text (around the rim)', slotBottom: 'Bottom text (around the rim)', slotCenter: 'Center text', slotExtra: 'Small center line',
    line1: 'Line 1 (name)', line2: 'Line 3', line3: 'Line 2', line4: 'Line 4',
    livePreview: 'Live preview', realInk: 'Real ink look', letters: 'Letters', perLetter: 'Price per letter', lettersTotal: 'Letters total',
    iconFee: 'Icon fee', logoFee: 'Logo fee', minimum: 'Minimum', total: 'Total', yourBalance: 'Wallet balance',
    buy: 'Buy & download', topupFirst: 'Top up wallet', emptyDesign: 'Enter the seal text', saveFree: 'Save changes for free',
    formatsHint: 'You get editable vector PDF & SVG files + a high-resolution PNG', priceText: 'Text seal', priceIcon: 'Icon + text seal',
    shapes: { circle: 'Round', oval: 'Oval', rect: 'Rectangle', rounded: 'Rounded', hexagon: 'Hexagon' },
    borders: { single: 'Single', double: 'Double', 'thick-thin': 'Thick-thin', dotted: 'Dotted', dashed: 'Dashed', beaded: 'Beaded' },
    icons: { none: 'None', logo: 'My logo', star: 'Star', crescent: 'Crescent', check: 'Check' },
    seps: { star: 'Stars', dot: 'Dots', none: 'None' },
    confirmTitle: 'Confirm purchase', confirmBuy: 'Pay from wallet', after: 'Balance after purchase',
    bought: 'Seal purchased successfully! 🎉', download: 'Download', walletBalance: 'Wallet balance', topupTitle: 'Top up with phone credit',
    topupHint: 'Transfer credit from your line (Almadar or Libyana) to the Khatmi number; it will be added to your wallet once confirmed.',
    carrier: 'Carrier', senderPhone: 'Your number (sending credit)', amount: 'Credit amount (LYD)', topupSubmit: 'Continue',
    unavailable: 'Not available yet', willCredit: 'Will be added to your wallet', topupRequests: 'Top-up requests', transactions: 'Wallet activity',
    instrTitle: 'Last step: transfer the credit', instr1: 'Open the credit-transfer service of', instr2: 'Transfer', instr3: 'from your number', instr4: 'to the Khatmi number:',
    instr5: 'Your wallet will be credited as soon as the transfer is confirmed.', copy: 'Copy number', copied: 'Copied',
    st: { pending: 'Pending', approved: 'Credited', rejected: 'Rejected', cancelled: 'Cancelled' },
    noItems: 'Nothing here yet', myOrders: 'My purchased seals', noOrders: "You haven't bought a seal yet. Start designing!",
    editStyle: 'Edit', saved: 'Changes saved', needLogin: 'Please sign in', designing: 'Designing…',
    pickVariant: 'Design selected — customise it freely', nameFirst: 'Enter the name first', cancelReq: 'Cancel request',
    fonts: { cairo: 'Cairo (modern)', tajawal: 'Tajawal (clean)', amiri: 'Amiri (formal naskh)', reemkufi: 'Reem Kufi', montserrat: 'Montserrat', playfair: 'Playfair (classic)' },
  },
};
let lang = safeGet('khatmi.lang') || 'ar';
const t = (k) => k.split('.').reduce((o, p) => o?.[p], I18N[lang]) ?? k;

function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* ignore */ } }

function applyLang() {
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  document.title = lang === 'ar' ? 'ختمي | تصميم الأختام' : 'Khatmi | My seal';
  $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
  $$('[data-i18n-ph]').forEach((el) => { el.placeholder = t(el.dataset.i18nPh); });
  if (state.user) { buildEditorControls(); syncEditor(); renderPrice(); renderCarriers(); updateTopupCredit(); }
  $('#ai-hint').textContent = state.config ? (state.config.aiEnabled ? t('aiOn') : t('aiOff')) : '';
}
$$('.lang-toggle').forEach((b) => b.addEventListener('click', () => { lang = lang === 'ar' ? 'en' : 'ar'; safeSet('khatmi.lang', lang); applyLang(); if (state.user) { refreshWallet(); if (!$('#view-orders').hidden) loadOrders(); } }));

// ================= الحالة و API =================
const state = {
  token: safeGet('khatmi.token'),
  user: null,
  config: null,
  spec: null,
  quote: null,
  editingOrder: null,
  logo: { file: null, img: null, id: null, mode: 'ink', thr: 170 },
  inputs: { kind: 'company', lang: 'ar' },
  carrier: 'madar',
};

async function api(path, opts = {}) {
  const res = await fetch(path, {
    method: opts.method || (opts.body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', ...(state.token ? { Authorization: 'Bearer ' + state.token } : {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  if (opts.raw) {
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).message || res.statusText);
    return res;
  }
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && path !== '/api/auth/login') { logout(); }
  if (!res.ok) { const e = new Error(data.message || res.statusText); e.code = data.error; throw e; }
  return data;
}

function toast(msg, err = false) {
  const el = $('#toast');
  el.textContent = msg;
  el.className = 'toast' + (err ? ' err' : '');
  el.hidden = false;
  clearTimeout(toast.tm);
  toast.tm = setTimeout(() => { el.hidden = true; }, 3200);
}
const money = (n) => Number(n || 0).toFixed(3);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function openModal(html) { $('#modal-body').innerHTML = html; $('#modal').hidden = false; }
function closeModal() { $('#modal').hidden = true; }
$('#modal-x').addEventListener('click', closeModal);
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal') closeModal(); });

// ================= الدخول =================
let authMode = 'login';
$$('#auth-tabs button').forEach((b) => b.addEventListener('click', () => {
  authMode = b.dataset.tab;
  $$('#auth-tabs button').forEach((x) => x.classList.toggle('active', x === b));
  $$('.reg-only').forEach((el) => { el.hidden = authMode !== 'register'; });
  $('#auth-submit').textContent = t(authMode);
  $('#auth-submit').dataset.i18n = authMode;
}));
$('#auth-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  $('#auth-error').hidden = true;
  try {
    const data = await api('/api/auth/' + authMode, { body: Object.fromEntries(f) });
    state.token = data.token;
    safeSet('khatmi.token', data.token);
    await boot();
  } catch (err) {
    $('#auth-error').textContent = err.message;
    $('#auth-error').hidden = false;
  }
});
function logout() {
  state.token = null; state.user = null;
  safeSet('khatmi.token', null);
  $('#app').hidden = true; $('#auth-screen').hidden = false;
}
$('#logout').addEventListener('click', logout);

async function boot() {
  try { state.config = await api('/api/config'); } catch { /* offline */ }
  if (!state.token) { $('#auth-screen').hidden = false; applyLang(); return; }
  try {
    const me = await api('/api/me');
    state.user = me.user; state.config = me.settings;
  } catch { logout(); applyLang(); return; }
  $('#auth-screen').hidden = true; $('#app').hidden = false;
  if (!state.spec) state.spec = defaultSpec();
  applyLang();
  updateBalance();
  refreshPreview();
  refreshWallet();
}

// ================= التنقل =================
function showView(v) {
  $$('.view').forEach((s) => { s.hidden = s.id !== 'view-' + v; });
  $$('#tabs button').forEach((b) => b.classList.toggle('active', b.dataset.view === v));
  if (v === 'wallet') refreshWallet();
  if (v === 'orders') loadOrders();
  window.scrollTo({ top: 0 });
}
$$('[data-view]').forEach((b) => b.addEventListener('click', () => showView(b.dataset.view)));

function updateBalance() {
  $('#balance-chip').innerHTML = `${money(state.user?.balance)} <small>${t('lyd')}</small>`;
  $('#w-balance').textContent = money(state.user?.balance);
}

// ================= بيانات الختم =================
function segment(id, key) {
  $$(`#${id} button`).forEach((b) => b.addEventListener('click', () => {
    $$(`#${id} button`).forEach((x) => x.classList.toggle('active', x === b));
    state.inputs[key] = b.dataset.v;
    if (key === 'lang') { $('#f-nameAr').hidden = b.dataset.v === 'en'; $('#f-nameEn').hidden = b.dataset.v === 'ar'; }
  }));
}
segment('in-kind', 'kind');
segment('in-lang', 'lang');

function collectInputs() {
  return {
    ...state.inputs,
    nameAr: $('#in-nameAr').value, nameEn: $('#in-nameEn').value, tagline: $('#in-tagline').value,
    city: $('#in-city').value, extra: $('#in-extra').value, style: $('#in-style').value, logoId: state.logo.id,
  };
}

function defaultSpec() {
  return { shape: 'circle', widthMm: 40, heightMm: 40, ink: '#1f3c88', border: 'double', fontAr: 'cairo', fontEn: 'montserrat', separator: 'star', icon: 'none', innerRing: true, textScale: 1, letterSpacing: 0, texts: { top: '', bottom: '', center: '', extra: '' } };
}

$('#btn-ai').addEventListener('click', () => suggest());
$('#btn-manual').addEventListener('click', () => suggest(true));

async function suggest(manual = false) {
  const inputs = collectInputs();
  if (!inputs.nameAr.trim() && !inputs.nameEn.trim()) { toast(t('nameFirst'), true); return; }
  if (manual) inputs.style = '';
  const btn = manual ? $('#btn-manual') : $('#btn-ai');
  const label = btn.innerHTML;
  btn.disabled = true; btn.textContent = t('designing');
  try {
    const data = await api('/api/design/suggest', { body: { inputs, manual } });
    if (manual) { pickVariant(data.variants[0]); return; }
    $('#gallery-card').hidden = false;
    $('#gallery-src').textContent = data.source === 'ai' ? t('srcAi') : t('srcLocal');
    $('#gallery').innerHTML = data.variants.map((v, i) => `
      <button type="button" class="variant" data-i="${i}">
        <div class="thumb">${v.svg}</div>
        <b>${esc(lang === 'ar' ? v.title : v.titleEn || v.title)}</b>
        <small>${esc(v.reason)}</small>
        <span class="vp">${money(v.quote.total)} ${t('lyd')}</span>
      </button>`).join('');
    $$('#gallery .variant').forEach((el) => el.addEventListener('click', () => {
      $$('#gallery .variant').forEach((x) => x.classList.toggle('active', x === el));
      pickVariant(data.variants[el.dataset.i]);
    }));
    $('#gallery-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
  } catch (err) {
    toast(err.message, true);
  } finally {
    btn.disabled = false; btn.innerHTML = label;
  }
}

async function pickVariant(v) {
  exitEditOrder();
  state.spec = structuredClone(v.spec);
  syncEditor();
  if (state.spec.icon === 'logo' && state.logo.img && state.logo.mode === 'ink') await uploadLogo();
  refreshPreview();
  toast(t('pickVariant'));
  if (window.innerWidth < 960) $('#paper').scrollIntoView({ behavior: 'smooth' });
}

// ================= الشعار =================
$('#in-logo').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const img = new Image();
  img.src = URL.createObjectURL(file);
  try { await img.decode(); } catch { toast('Logo?', true); return; }
  state.logo.img = img;
  $('#logo-thumb').src = img.src;
  $('#logo-thumb').hidden = false; $('#logo-remove').hidden = false; $('#logo-opts').hidden = false;
  await uploadLogo();
  if (state.logo.id) { state.spec.icon = 'logo'; syncEditor(); refreshPreview(); }
  e.target.value = '';
});
$('#logo-remove').addEventListener('click', () => {
  state.logo = { ...state.logo, img: null, id: null };
  $('#logo-thumb').hidden = true; $('#logo-remove').hidden = true; $('#logo-opts').hidden = true;
  if (state.spec.icon === 'logo') state.spec.icon = 'none';
  state.spec.logoId = null;
  syncEditor(); refreshPreview();
});
$$('#logo-mode button').forEach((b) => b.addEventListener('click', async () => {
  $$('#logo-mode button').forEach((x) => x.classList.toggle('active', x === b));
  state.logo.mode = b.dataset.v;
  $('#logo-thr-wrap').hidden = b.dataset.v !== 'ink';
  await uploadLogo(); refreshPreview();
}));
let thrTimer;
$('#logo-thr').addEventListener('input', (e) => {
  state.logo.thr = Number(e.target.value);
  clearTimeout(thrTimer);
  thrTimer = setTimeout(async () => { await uploadLogo(); refreshPreview(); }, 250);
});

// تحويل الشعار إلى PNG (مع خيار تلوينه بلون الحبر ليبدو كختم حقيقي)
function processLogo(img, mode, ink, thr) {
  const max = 700;
  const k = Math.min(1, max / Math.max(img.naturalWidth || img.width, img.naturalHeight || img.height));
  const w = Math.max(1, Math.round((img.naturalWidth || img.width) * k));
  const h = Math.max(1, Math.round((img.naturalHeight || img.height) * k));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  if (mode === 'ink') {
    const d = ctx.getImageData(0, 0, w, h);
    const px = d.data;
    let transparent = 0;
    for (let i = 3; i < px.length; i += 4) if (px[i] < 30) transparent++;
    const useAlpha = transparent / (w * h) > 0.08;
    const r = parseInt(ink.slice(1, 3), 16); const g = parseInt(ink.slice(3, 5), 16); const b = parseInt(ink.slice(5, 7), 16);
    for (let i = 0; i < px.length; i += 4) {
      const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
      let a = px[i + 3] / 255;
      if (!useAlpha) a *= Math.min(1, Math.max(0, (thr - lum) / 30 + 0.5));
      else if (lum > thr + 60) a *= 0.0;
      px[i] = r; px[i + 1] = g; px[i + 2] = b; px[i + 3] = Math.round(a * 255);
    }
    ctx.putImageData(d, 0, 0);
  }
  return c.toDataURL('image/png');
}
async function uploadLogo() {
  if (!state.logo.img) return;
  try {
    const dataUrl = processLogo(state.logo.img, state.logo.mode, state.spec.ink, state.logo.thr);
    const r = await api('/api/logos', { body: { dataUrl } });
    state.logo.id = r.logoId;
    if (!state.editingOrder) state.spec.logoId = r.logoId;
  } catch (err) { toast(err.message, true); }
}

// ================= المحرر المباشر =================
const SHAPE_ICONS = {
  circle: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  oval: '<svg viewBox="0 0 24 24"><ellipse cx="12" cy="12" rx="10" ry="7" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  rect: '<svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  rounded: '<svg viewBox="0 0 24 24"><rect x="2" y="6" width="20" height="12" rx="4" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
  hexagon: '<svg viewBox="0 0 24 24"><polygon points="12,2 21,7 21,17 12,22 3,17 3,7" fill="none" stroke="currentColor" stroke-width="2"/></svg>',
};
const INKS = ['#1f3c88', '#0b5ed7', '#c1121f', '#111111', '#1b7a3a', '#5b2a86', '#b8860b'];
const DEFAULT_SIZES = { circle: [40, 40], hexagon: [40, 40], oval: [50, 35], rect: [60, 30], rounded: [60, 30] };

function chipGroup(id, values, labelFn, key, extraHtml = () => '') {
  const el = $('#' + id);
  el.innerHTML = values.map((v) => `<button type="button" data-v="${v}">${extraHtml(v)}<span>${esc(labelFn(v))}</span></button>`).join('');
  $$('button', el).forEach((b) => b.addEventListener('click', () => {
    if (key === 'icon' && b.dataset.v === 'logo' && !state.logo.id && !state.spec.logoId) { $('#in-logo').click(); return; }
    if (state.editingOrder && key === 'icon') return;
    state.spec[key] = b.dataset.v;
    if (key === 'icon' && b.dataset.v === 'logo') state.spec.logoId = state.logo.id || state.spec.logoId;
    if (key === 'shape') { [state.spec.widthMm, state.spec.heightMm] = DEFAULT_SIZES[b.dataset.v]; }
    syncEditor(); refreshPreview();
  }));
}

function buildEditorControls() {
  chipGroup('ed-shape', Object.keys(SHAPE_ICONS), (v) => t('shapes.' + v), 'shape', (v) => SHAPE_ICONS[v]);
  chipGroup('ed-border', ['double', 'single', 'thick-thin', 'dotted', 'dashed', 'beaded'], (v) => t('borders.' + v), 'border');
  chipGroup('ed-icon', ['none', 'logo', 'star', 'crescent', 'check'], (v) => t('icons.' + v), 'icon');
  chipGroup('ed-sep', ['star', 'dot', 'none'], (v) => t('seps.' + v), 'separator');
  $('#ed-ink').innerHTML = INKS.map((c) => `<button type="button" data-v="${c}" style="background:${c}" aria-label="${c}"></button>`).join('') + '<input type="color" id="ed-ink-custom" aria-label="custom">';
  $$('#ed-ink button').forEach((b) => b.addEventListener('click', () => setInk(b.dataset.v)));
  $('#ed-ink-custom').addEventListener('input', (e) => setInk(e.target.value));
  const fontOpts = (list) => list.map((f) => `<option value="${f}">${esc(t('fonts.' + f))}</option>`).join('');
  $('#ed-fontAr').innerHTML = fontOpts(['cairo', 'tajawal', 'amiri', 'reemkufi']);
  $('#ed-fontEn').innerHTML = fontOpts(['montserrat', 'playfair', 'cairo', 'tajawal', 'amiri', 'reemkufi']);
}

let inkTimer;
function setInk(c) {
  state.spec.ink = c;
  syncEditor(); refreshPreview();
  if (state.logo.img && state.logo.mode === 'ink' && !state.editingOrder) {
    clearTimeout(inkTimer);
    inkTimer = setTimeout(async () => { await uploadLogo(); refreshPreview(); }, 300);
  }
}

function bindInput(id, fn) { $(id).addEventListener('input', (e) => { fn(e.target); refreshPreview(); }); }
bindInput('#ed-w', (el) => { state.spec.widthMm = Number(el.value); if (['circle', 'hexagon'].includes(state.spec.shape)) state.spec.heightMm = state.spec.widthMm; syncEditor(); });
bindInput('#ed-h', (el) => { state.spec.heightMm = Number(el.value); syncEditor(); });
bindInput('#ed-scale', (el) => { state.spec.textScale = Number(el.value); });
bindInput('#ed-spacing', (el) => { state.spec.letterSpacing = Number(el.value); });
['top', 'bottom', 'center', 'extra'].forEach((k) => bindInput('#ed-' + k, (el) => { state.spec.texts[k] = el.value; }));
$('#ed-fontAr').addEventListener('change', (e) => { state.spec.fontAr = e.target.value; refreshPreview(); });
$('#ed-fontEn').addEventListener('change', (e) => { state.spec.fontEn = e.target.value; refreshPreview(); });
$('#ed-ring').addEventListener('change', (e) => { state.spec.innerRing = e.target.checked; refreshPreview(); });
$('#pv-real').addEventListener('change', (e) => { $('#paper').classList.toggle('real', e.target.checked); });

function syncEditor() {
  const s = state.spec;
  if (!s) return;
  const act = (id, v) => $$(`#${id} button`).forEach((b) => b.classList.toggle('active', b.dataset.v === v));
  act('ed-shape', s.shape); act('ed-border', s.border); act('ed-icon', s.icon); act('ed-sep', s.separator); act('ed-ink', s.ink);
  $('#ed-ink-custom').value = s.ink;
  $('#ed-w').value = s.widthMm; $('#ed-w-val').textContent = `${s.widthMm} ${t('mm')}`;
  $('#ed-h').value = s.heightMm; $('#ed-h-val').textContent = `${s.heightMm} ${t('mm')}`;
  $('#ed-h-wrap').hidden = ['circle', 'hexagon'].includes(s.shape);
  $('#ed-fontAr').value = s.fontAr; $('#ed-fontEn').value = s.fontEn;
  $('#ed-scale').value = s.textScale; $('#ed-spacing').value = s.letterSpacing;
  $('#ed-ring').checked = s.innerRing !== false;
  const rect = ['rect', 'rounded'].includes(s.shape);
  $('#lbl-top').textContent = rect ? t('line1') : t('slotTop');
  $('#lbl-center').textContent = rect ? t('line3') : t('slotCenter');
  $('#lbl-bottom').textContent = rect ? t('line2') : t('slotBottom');
  $('#lbl-extra').textContent = rect ? t('line4') : t('slotExtra');
  for (const k of ['top', 'bottom', 'center', 'extra']) {
    const el = $('#ed-' + k);
    if (document.activeElement !== el) el.value = s.texts[k] || '';
    el.dir = /[؀-ۿ]/.test(el.value) ? 'rtl' : el.value ? 'ltr' : 'auto';
    el.disabled = Boolean(state.editingOrder);
  }
  $('#ed-icon').style.opacity = state.editingOrder ? 0.5 : 1;
}

// طلب المعاينة من الخادم (المعاينة عليها علامة مائية حتى الشراء)
let pvTimer; let pvSeq = 0;
function refreshPreview() {
  clearTimeout(pvTimer);
  pvTimer = setTimeout(async () => {
    const seq = ++pvSeq;
    $('#pv-spin').hidden = false;
    try {
      const data = await api('/api/render', { body: { spec: state.spec } });
      if (seq !== pvSeq) return;
      $('#preview').innerHTML = data.svg;
      state.quote = data.quote;
      renderPrice();
    } catch (err) {
      if (seq === pvSeq) toast(err.message, true);
    } finally {
      if (seq === pvSeq) $('#pv-spin').hidden = true;
    }
  }, 160);
}

function renderPrice() {
  const q = state.quote;
  if (!q || !state.user) return;
  const bal = state.user.balance;
  const rows = [
    [t('letters'), `${q.letters}`],
    [t('perLetter'), `${money(q.perLetter)} ${t('lyd')}`],
    [t('lettersTotal'), `${money(q.lettersTotal)} ${t('lyd')}`],
  ];
  if (q.iconFee) rows.push([q.iconKind === 'logo' ? t('logoFee') : t('iconFee'), `${money(q.iconFee)} ${t('lyd')}`]);
  if (q.minimum && q.total === q.minimum && q.lettersTotal + q.iconFee < q.minimum) rows.push([t('minimum'), `${money(q.minimum)} ${t('lyd')}`]);
  $('#price').innerHTML = `<div class="row"><span class="badge">${q.type === 'text' ? t('priceText') : t('priceIcon')}</span></div>` +
    rows.map(([a, b]) => `<div class="row"><span>${a}</span><b>${b}</b></div>`).join('') +
    `<div class="row total"><span>${t('total')}</span><span>${money(q.total)} ${t('lyd')}</span></div>` +
    `<div class="row bal ${bal < q.total ? 'low' : ''}"><span>${t('yourBalance')}</span><span>${money(bal)} ${t('lyd')}</span></div>`;
  const buy = $('#btn-buy');
  buy.hidden = Boolean(state.editingOrder);
  $('#btn-save-order').hidden = !state.editingOrder;
  if (!q.letters) { buy.textContent = t('emptyDesign'); buy.disabled = true; return; }
  buy.disabled = false;
  buy.textContent = bal < q.total ? `${t('topupFirst')} (${money(q.total)} ${t('lyd')})` : `${t('buy')} — ${money(q.total)} ${t('lyd')}`;
}

$('#btn-buy').addEventListener('click', () => {
  const q = state.quote;
  if (!q) return;
  if (state.user.balance < q.total) { showView('wallet'); toast(t('topupFirst')); return; }
  openModal(`<h2>${t('confirmTitle')}</h2><div class="thumb">${$('#preview').innerHTML}</div>
    <div class="price">
      <div class="row"><span>${t('letters')}: ${q.letters} × ${money(q.perLetter)}</span><b>${money(q.lettersTotal)}</b></div>
      ${q.iconFee ? `<div class="row"><span>${q.iconKind === 'logo' ? t('logoFee') : t('iconFee')}</span><b>${money(q.iconFee)}</b></div>` : ''}
      <div class="row total"><span>${t('total')}</span><span>${money(q.total)} ${t('lyd')}</span></div>
      <div class="row bal"><span>${t('after')}</span><span>${money(state.user.balance - q.total)} ${t('lyd')}</span></div>
    </div>
    <button type="button" class="btn primary block big" id="confirm-buy">${t('confirmBuy')}</button>`);
  $('#confirm-buy').addEventListener('click', async (e) => {
    e.target.disabled = true;
    try {
      const data = await api('/api/orders', { body: { spec: state.spec, expectedTotal: q.total } });
      state.user = data.user; updateBalance(); renderPrice();
      showDownloads(data.order.id, t('bought'));
    } catch (err) { toast(err.message, true); e.target.disabled = false; }
  });
});

async function showDownloads(orderId, title) {
  const { svg, order } = await api('/api/orders/' + orderId);
  openModal(`<h2>${title}</h2><div class="thumb">${svg}</div>
    <div class="dl-btns">
      <button type="button" class="btn primary" data-f="pdf">PDF</button>
      <button type="button" class="btn primary" data-f="svg">SVG</button>
      <button type="button" class="btn outline" data-f="png">PNG</button>
    </div>`);
  $$('#modal .dl-btns button').forEach((b) => b.addEventListener('click', () => download(order, b.dataset.f, svg)));
}

async function download(order, format, svgText) {
  try {
    let blob;
    if (format === 'png') blob = await svgToPng(svgText, order.spec);
    else blob = await (await api(`/api/orders/${order.id}/download?format=${format}`, { raw: true })).blob();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `khatmi-${order.id}.${format}`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  } catch (err) { toast(err.message, true); }
}

// PNG شفاف بدقة 600 نقطة/إنش
async function svgToPng(svgText, spec) {
  const dpi = 600;
  const w = Math.round(((spec.widthMm + 2) / 25.4) * dpi);
  const h = Math.round(((spec.heightMm + 2) / 25.4) * dpi);
  const img = new Image();
  img.src = URL.createObjectURL(new Blob([svgText], { type: 'image/svg+xml' }));
  await img.decode();
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d').drawImage(img, 0, 0, w, h);
  return new Promise((r) => c.toBlob(r, 'image/png'));
}

// ---- تعديل ختم مشترى مجاناً ----
async function startEditOrder(orderId) {
  const { order } = await api('/api/orders/' + orderId);
  state.editingOrder = order.id;
  state.spec = structuredClone(order.spec);
  $('#edit-order-banner').hidden = false;
  showView('studio');
  syncEditor(); refreshPreview();
  $('#editor-card').scrollIntoView({ behavior: 'smooth' });
}
function exitEditOrder() {
  if (!state.editingOrder) return;
  state.editingOrder = null;
  $('#edit-order-banner').hidden = true;
  syncEditor(); renderPrice();
}
$('#cancel-edit-order').addEventListener('click', () => { exitEditOrder(); state.spec = defaultSpec(); syncEditor(); refreshPreview(); });
$('#btn-save-order').addEventListener('click', async () => {
  try {
    const id = state.editingOrder;
    await api('/api/orders/' + id, { method: 'PUT', body: { spec: state.spec } });
    toast(t('saved'));
    exitEditOrder();
    showDownloads(id, t('saved'));
  } catch (err) { toast(err.message, true); }
});

// ================= المحفظة =================
const CARRIER_COLORS = { madar: '#ef7d00', libyana: '#7b2c8f' };
function renderCarriers() {
  const cs = state.config?.carriers || {};
  if (!cs[state.carrier]?.enabled) state.carrier = Object.keys(cs).find((k) => cs[k].enabled) || 'madar';
  $('#carriers').innerHTML = Object.entries(cs).map(([k, c]) => `
    <button type="button" class="carrier ${k === state.carrier ? 'active' : ''}" data-k="${k}" ${c.enabled ? '' : 'disabled'}>
      <b><span class="dot" style="background:${CARRIER_COLORS[k] || '#888'}"></span>${esc(lang === 'ar' ? c.name : c.nameEn)}</b>
      <small>${c.enabled ? esc(c.number) : t('unavailable')}</small>
    </button>`).join('');
  $$('#carriers .carrier').forEach((b) => b.addEventListener('click', () => { state.carrier = b.dataset.k; renderCarriers(); updateTopupCredit(); }));
  const c = cs[state.carrier];
  const quick = [5, 10, 20, 50, 100].filter((v) => !c || (v >= c.min && v <= c.max));
  $('#tp-quick').innerHTML = quick.map((v) => `<button type="button" data-v="${v}">${v}</button>`).join('');
  $$('#tp-quick button').forEach((b) => b.addEventListener('click', () => { $('#tp-amount').value = b.dataset.v; updateTopupCredit(); }));
  if (c) { $('#tp-amount').min = c.min; $('#tp-amount').max = c.max; }
}
function updateTopupCredit() {
  const c = state.config?.carriers?.[state.carrier];
  const a = Number($('#tp-amount').value);
  $$('#tp-quick button').forEach((b) => b.classList.toggle('active', Number(b.dataset.v) === a));
  $('#tp-credit').textContent = c && a > 0 ? `${t('willCredit')}: ${money(a * c.rate)} ${t('lyd')}` : '';
}
$('#tp-amount').addEventListener('input', updateTopupCredit);

$('#topup-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  $('#tp-error').hidden = true;
  try {
    const { topup } = await api('/api/topups', { body: { carrier: state.carrier, senderPhone: $('#tp-phone').value, amount: Number($('#tp-amount').value) } });
    safeSet('khatmi.senderPhone', $('#tp-phone').value);
    showInstructions(topup);
    refreshWallet();
  } catch (err) {
    $('#tp-error').textContent = err.message; $('#tp-error').hidden = false;
  }
});
function showInstructions(tp) {
  const c = state.config.carriers[tp.carrier];
  const el = $('#tp-instructions');
  el.hidden = false;
  el.innerHTML = `<div class="instructions">
    <h2>${t('instrTitle')}</h2>
    <ol>
      <li>${t('instr1')} <b>${esc(lang === 'ar' ? c.name : c.nameEn)}</b>.</li>
      <li>${t('instr2')} <b>${money(tp.amount)} ${t('lyd')}</b> ${t('instr3')} <b dir="ltr">${esc(tp.senderPhone)}</b> ${t('instr4')}</li>
    </ol>
    <div class="merchant">${esc(tp.merchantNumber)}</div>
    <button type="button" class="btn outline small" id="copy-num">${t('copy')}</button>
    <p class="hint">${t('instr5')}</p></div>`;
  $('#copy-num').addEventListener('click', async () => { try { await navigator.clipboard.writeText(tp.merchantNumber); toast(t('copied')); } catch { /* ignore */ } });
  el.scrollIntoView({ behavior: 'smooth' });
}

async function refreshWallet() {
  if (!state.user) return;
  try {
    const [w, me] = await Promise.all([api('/api/wallet'), api('/api/me')]);
    state.user = me.user; state.config = me.settings;
    updateBalance(); renderPrice(); renderCarriers(); updateTopupCredit();
    if (!$('#tp-phone').value) $('#tp-phone').value = safeGet('khatmi.senderPhone') || state.user.phone;
    const fmtDate = (d) => new Date(d).toLocaleString(lang === 'ar' ? 'ar-LY' : 'en-GB', { dateStyle: 'medium', timeStyle: 'short' });
    $('#tp-list').innerHTML = w.topups.length ? w.topups.map((tp) => `
      <div class="item">
        <div><b>${esc(lang === 'ar' ? state.config.carriers[tp.carrier]?.name : state.config.carriers[tp.carrier]?.nameEn)}</b> · <span dir="ltr">${esc(tp.senderPhone)}</span><br><small>${fmtDate(tp.createdAt)}</small>
        ${tp.note ? `<br><small>${esc(tp.note)}</small>` : ''}</div>
        <div style="text-align:end"><div class="amt">${money(tp.amount)}</div><span class="status ${tp.status}">${t('st.' + tp.status)}</span>
        ${tp.status === 'pending' ? `<br><button type="button" class="link" data-cancel="${tp.id}">${t('cancelReq')}</button>` : ''}</div>
      </div>`).join('') : `<div class="empty">${t('noItems')}</div>`;
    $$('[data-cancel]').forEach((b) => b.addEventListener('click', async () => { await api(`/api/topups/${b.dataset.cancel}/cancel`, { body: {} }); refreshWallet(); }));
    $('#tx-list').innerHTML = w.transactions.length ? w.transactions.map((x) => `
      <div class="item"><div>${esc(x.note)}<br><small>${fmtDate(x.at)}</small></div>
      <div class="amt ${x.amount >= 0 ? 'plus' : 'minus'}">${x.amount >= 0 ? '+' : ''}${money(x.amount)}</div></div>`).join('') : `<div class="empty">${t('noItems')}</div>`;
  } catch { /* handled */ }
}

// ================= أختامي =================
async function loadOrders() {
  const { orders } = await api('/api/orders');
  const el = $('#orders');
  if (!orders.length) { el.innerHTML = `<div class="empty">${t('noOrders')}</div>`; return; }
  el.innerHTML = orders.map((o) => `
    <div class="order" data-id="${o.id}">
      <div class="thumb"></div>
      <b>${esc(o.spec.texts.top || o.spec.texts.center)}</b>
      <small>${money(o.price)} ${t('lyd')} · ${new Date(o.createdAt).toLocaleDateString(lang === 'ar' ? 'ar-LY' : 'en-GB')}</small>
      <div class="btns">
        <button type="button" class="btn primary" data-f="pdf">PDF</button>
        <button type="button" class="btn primary" data-f="svg">SVG</button>
        <button type="button" class="btn outline" data-f="png">PNG</button>
        <button type="button" class="btn outline" data-edit>${t('editStyle')}</button>
      </div>
    </div>`).join('');
  for (const card of $$('.order', el)) {
    const id = card.dataset.id;
    api('/api/orders/' + id).then(({ svg, order }) => {
      $('.thumb', card).innerHTML = svg;
      $$('[data-f]', card).forEach((b) => b.addEventListener('click', () => download(order, b.dataset.f, svg)));
    });
    $('[data-edit]', card).addEventListener('click', () => startEditOrder(id));
  }
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
boot();
