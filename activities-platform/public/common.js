// أدوات مشتركة بين الواجهة العامة ولوحة التحكم.
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(url, { method = 'GET', body } = {}) {
  const res = await fetch(url, {
    method,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
    body: body !== undefined ? JSON.stringify(body) : undefined,
    credentials: 'same-origin',
  });
  const isJson = (res.headers.get('content-type') || '').includes('application/json');
  const data = isJson ? await res.json() : await res.text();
  if (!res.ok) {
    const err = new Error((data && data.error) || 'تعذر الاتصال بالخادم');
    err.status = res.status;
    throw err;
  }
  return data;
}

const AR_MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
const parseLocal = (s) => {
  if (!s) return null;
  const d = new Date(s.length === 10 ? `${s}T00:00:00` : s);
  return Number.isNaN(d.getTime()) ? null : d;
};
function fmtDate(s) {
  const d = parseLocal(s);
  return d ? `${d.getDate()} ${AR_MONTHS[d.getMonth()]} ${d.getFullYear()}` : '';
}
function fmtDateTime(s) {
  const d = parseLocal(s);
  if (!d) return '';
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${fmtDate(s.slice(0, 10))} — ${hh}:${mm}`;
}

function toast(msg, isError = false) {
  const el = document.createElement('div');
  el.className = `toast${isError ? ' err' : ''}`;
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

function formData(form) {
  const out = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    if (el.type === 'checkbox') out[el.name] = el.checked;
    else if (el.type === 'radio') { if (el.checked) out[el.name] = el.value; }
    else out[el.name] = el.value;
  }
  return out;
}

const CATEGORY_ICONS = { sports: '⚽', cultural: '📚', arts: '🎨', volunteer: '🤝', social: '🎉', other: '✨' };
const STATUS_LABELS = {
  pending: ['قيد المراجعة', 'warn'], approved: ['مقبول', ''], reserve: ['احتياطي', 'blue'], rejected: ['مرفوض', 'red'],
  evaluating: ['قيد التقييم', 'warn'], registered: ['مقيد بالسجل', ''], sponsored: ['ترعاه الشركة', 'gold'], declined: ['غير مقبول', 'gray'],
  selection: ['الاختيار والاختبارات', 'blue'], preparing: ['التجهيز والتدريب', 'warn'], competing: ['المشاركة جارية', 'gold'],
  forming: ['قيد التشكيل', 'blue'], training: ['في مرحلة الإعداد', 'warn'], inactive: ['غير نشط', 'gray'],
  new: ['جديدة', 'blue'], in_progress: ['قيد المعالجة', 'warn'], resolved: ['تم الحل', ''], closed: ['مغلقة', 'gray'],
  reviewed: ['تمت المراجعة', 'warn'], adopted: ['معتمدة', ''], archived: ['مؤرشفة', 'gray'],
  open: ['باب الترشح مفتوح', ''], completed: ['منتهية', 'gray'],
  active: ['جارية', ''], upcoming: ['قادمة', 'blue'], ended: ['منتهية', 'gray'],
};
const statusBadge = (s) => {
  const [label, cls] = STATUS_LABELS[s] || [s, 'gray'];
  return `<span class="badge ${cls}">${esc(label)}</span>`;
};

const SOCIAL = {
  facebook: ['فيسبوك', '<svg viewBox="0 0 24 24"><path d="M14 8h3V4h-3c-2.8 0-4.5 1.8-4.5 4.6V11H7v4h2.5v9h4v-9h3l.5-4h-3.5V8.8c0-.5.3-.8.5-.8z"/></svg>'],
  tiktok: ['تيك توك', '<svg viewBox="0 0 24 24"><path d="M16.6 5.8A4.3 4.3 0 0 1 15.5 3h-3.3v12.4a2.6 2.6 0 1 1-2.6-2.6c.3 0 .5 0 .8.1V9.5a6 6 0 1 0 5.1 5.9V9.1a7.6 7.6 0 0 0 4.5 1.4V7.2a4.3 4.3 0 0 1-3.4-1.4z"/></svg>'],
  instagram: ['إنستغرام', '<svg viewBox="0 0 24 24"><path d="M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10zm0 8.2a3.2 3.2 0 1 1 0-6.4 3.2 3.2 0 0 1 0 6.4zM17.3 5.5a1.2 1.2 0 1 0 0 2.4 1.2 1.2 0 0 0 0-2.4zM12 2c-2.7 0-3 0-4.1.1C4.3 2.3 2.3 4.3 2.1 7.9 2 9 2 9.3 2 12s0 3 .1 4.1c.2 3.6 2.2 5.6 5.8 5.8 1.1.1 1.4.1 4.1.1s3 0 4.1-.1c3.6-.2 5.6-2.2 5.8-5.8.1-1.1.1-1.4.1-4.1s0-3-.1-4.1c-.2-3.6-2.2-5.6-5.8-5.8C15 2 14.7 2 12 2z"/></svg>'],
  youtube: ['يوتيوب', '<svg viewBox="0 0 24 24"><path d="M23 7.2a3 3 0 0 0-2.1-2.1C19 4.6 12 4.6 12 4.6s-7 0-8.9.5A3 3 0 0 0 1 7.2 31 31 0 0 0 .5 12a31 31 0 0 0 .5 4.8 3 3 0 0 0 2.1 2.1c1.9.5 8.9.5 8.9.5s7 0 8.9-.5a3 3 0 0 0 2.1-2.1 31 31 0 0 0 .5-4.8 31 31 0 0 0-.5-4.8zM9.8 15.1V8.9l5.8 3.1-5.8 3.1z"/></svg>'],
};
function socialLinks(social = {}) {
  return Object.entries(SOCIAL).map(([key, [label, icon]]) => (social[key]
    ? `<a href="${esc(social[key])}" target="_blank" rel="noopener">${icon}${label}</a>`
    : `<span title="سيتم ربط الحساب قريباً">${icon}${label}</span>`)).join('');
}

// تحويل الملف المختار إلى dataURL مع تصغير الصور الكبيرة قبل الرفع.
function readImage(file, maxSize = 1600) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('تعذر قراءة الملف'));
    reader.onload = () => {
      if (file.type === 'image/gif') { resolve(reader.result); return; }
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL(file.type === 'image/png' ? 'image/png' : 'image/jpeg', 0.88));
      };
      img.onerror = () => reject(new Error('الملف ليس صورة صالحة'));
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
