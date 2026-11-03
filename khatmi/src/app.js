// واجهة برمجة تطبيق ختمي (REST API)
import express from 'express';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderSeal, normalizeSpec } from './seal.js';
import { quote, toDirham, toLyd } from './pricing.js';
import { normalizePhone, carrierOf } from './phone.js';
import { suggestDesigns, localVariants, normalizeInputs, aiEnabled } from './designer.js';
import { svgToPdf } from './pdf.js';
import { defaultSettings } from '../config.js';

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');

class HttpError extends Error {
  constructor(status, code, message) {
    super(message || code);
    this.status = status;
    this.code = code;
  }
}

// ---------- كلمات المرور والجلسات ----------
function hashPassword(pw, salt = crypto.randomBytes(16).toString('hex')) {
  return salt + ':' + crypto.scryptSync(pw, salt, 32).toString('hex');
}
function checkPassword(pw, stored) {
  const [salt, h] = String(stored).split(':');
  const test = crypto.scryptSync(pw, salt, 32);
  return crypto.timingSafeEqual(test, Buffer.from(h, 'hex'));
}

export function createApp(store, cfg, { log = console } = {}) {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '3mb' }));

  const sign = (payload) => {
    const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const sig = crypto.createHmac('sha256', cfg.secret).update(body).digest('base64url');
    return body + '.' + sig;
  };
  const verify = (token) => {
    const [body, sig] = String(token || '').split('.');
    if (!body || !sig) return null;
    const expect = crypto.createHmac('sha256', cfg.secret).update(body).digest('base64url');
    if (sig.length !== expect.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expect))) return null;
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > Date.now() ? p : null;
  };

  const settings = () => {
    if (!store.data.settings) {
      store.data.settings = structuredClone(defaultSettings);
      store.save();
    }
    return store.data.settings;
  };

  const publicUser = (u) => ({ id: u.id, name: u.name, phone: u.phone, balance: toLyd(u.balance), createdAt: u.createdAt });
  const publicSettings = () => {
    const s = settings();
    return {
      pricePerLetter: s.pricePerLetter, iconFee: s.iconFee, logoFee: s.logoFee, minPrice: s.minPrice, currency: 'LYD',
      aiEnabled: aiEnabled(),
      carriers: Object.fromEntries(Object.entries(s.carriers).map(([k, c]) => [k, { name: c.name, nameEn: c.nameEn, number: c.number, rate: c.rate, min: c.min, max: c.max, enabled: Boolean(c.enabled && c.number) }])),
    };
  };

  const auth = (req, _res, next) => {
    const p = verify((req.headers.authorization || '').replace(/^Bearer /, ''));
    const user = p && p.role === 'user' && store.data.users.find((u) => u.id === p.uid);
    if (!user) return next(new HttpError(401, 'UNAUTHORIZED', 'يرجى تسجيل الدخول'));
    req.user = user;
    next();
  };
  const adminAuth = (req, _res, next) => {
    const p = verify((req.headers.authorization || '').replace(/^Bearer /, ''));
    if (!p || p.role !== 'admin') return next(new HttpError(401, 'UNAUTHORIZED', 'غير مصرح'));
    next();
  };
  const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

  const render = (spec, watermark) => renderSeal(spec, { watermark, logo: spec.icon === 'logo' ? store.getLogo(spec.logoId) : null });
  // محتوى التسعير: النصوص + الشعار — إن لم يتغير فالتعديل مجاني
  const contentKey = (spec) => JSON.stringify([spec.texts, spec.icon, spec.logoId]);

  // ================= الحساب =================
  app.post('/api/auth/register', (req, res) => {
    const name = String(req.body?.name || '').trim().slice(0, 60);
    const phone = normalizePhone(req.body?.phone);
    const password = String(req.body?.password || '');
    if (!name) throw new HttpError(400, 'NAME_REQUIRED', 'الاسم مطلوب');
    if (!phone) throw new HttpError(400, 'BAD_PHONE', 'رقم الهاتف غير صحيح، أدخل رقماً ليبياً مثل 0911234567');
    if (password.length < 6) throw new HttpError(400, 'WEAK_PASSWORD', 'كلمة المرور يجب أن تكون 6 أحرف على الأقل');
    if (store.data.users.some((u) => u.phone === phone)) throw new HttpError(409, 'PHONE_EXISTS', 'هذا الرقم مسجل مسبقاً، قم بتسجيل الدخول');
    const user = { id: store.id('u'), name, phone, password: hashPassword(password), balance: 0, createdAt: new Date().toISOString() };
    store.data.users.push(user);
    store.save();
    res.json({ token: sign({ role: 'user', uid: user.id, exp: Date.now() + 30 * 864e5 }), user: publicUser(user) });
  });

  app.post('/api/auth/login', (req, res) => {
    const phone = normalizePhone(req.body?.phone);
    const user = phone && store.data.users.find((u) => u.phone === phone);
    if (!user || !checkPassword(String(req.body?.password || ''), user.password)) throw new HttpError(401, 'BAD_LOGIN', 'رقم الهاتف أو كلمة المرور غير صحيحة');
    res.json({ token: sign({ role: 'user', uid: user.id, exp: Date.now() + 30 * 864e5 }), user: publicUser(user) });
  });

  app.get('/api/config', (_req, res) => res.json(publicSettings()));
  app.get('/api/me', auth, (req, res) => res.json({ user: publicUser(req.user), settings: publicSettings() }));

  // ================= التصميم =================
  app.post('/api/logos', auth, (req, res) => {
    const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(req.body?.dataUrl || ''));
    if (!m) throw new HttpError(400, 'BAD_LOGO', 'صيغة الشعار غير مدعومة');
    const buf = Buffer.from(m[1], 'base64');
    if (buf.length > 2 * 1024 * 1024 || buf.readUInt32BE(0) !== 0x89504e47) throw new HttpError(400, 'BAD_LOGO', 'الشعار يجب أن يكون صورة أقل من 2 ميجابايت');
    res.json({ logoId: store.saveLogo(buf) });
  });

  app.post('/api/render', auth, (req, res) => {
    const spec = normalizeSpec(req.body?.spec);
    res.json({ spec, svg: render(spec, true), quote: quote(spec, settings()) });
  });

  app.post('/api/design/suggest', auth, wrap(async (req, res) => {
    const inputs = normalizeInputs(req.body?.inputs);
    if (!inputs.nameAr && !inputs.nameEn) throw new HttpError(400, 'NAME_REQUIRED', 'أدخل الاسم أولاً');
    const result = req.body?.manual ? { source: 'local', variants: localVariants(inputs) } : await suggestDesigns(inputs, log);
    res.json({
      source: result.source,
      variants: result.variants.map((v) => ({ ...v, svg: render(v.spec, true), quote: quote(v.spec, settings()) })),
    });
  }));

  // ================= الطلبات (شراء الختم) =================
  const publicOrder = (o) => ({ id: o.id, spec: o.spec, price: toLyd(o.price), quote: o.quote, createdAt: o.createdAt, updatedAt: o.updatedAt });

  app.post('/api/orders', auth, (req, res) => {
    const spec = normalizeSpec(req.body?.spec);
    const q = quote(spec, settings());
    if (q.letters === 0) throw new HttpError(400, 'EMPTY_DESIGN', 'أضف نصاً إلى الختم أولاً');
    if (req.body?.expectedTotal !== undefined && Math.abs(Number(req.body.expectedTotal) - q.total) > 0.0005) {
      throw new HttpError(409, 'PRICE_CHANGED', 'تغيّر السعر، راجع المعاينة مرة أخرى');
    }
    if (req.user.balance < q.totalDirham) throw new HttpError(402, 'INSUFFICIENT_BALANCE', `رصيد المحفظة غير كافٍ. السعر ${q.total} د.ل ورصيدك ${toLyd(req.user.balance)} د.ل`);
    const order = { id: store.id('ord'), userId: req.user.id, spec, price: q.totalDirham, quote: q, createdAt: new Date().toISOString() };
    store.addTransaction(req.user, -q.totalDirham, 'purchase', `تصميم ختم (${q.letters} حرف${q.iconFee ? ' + أيقونة' : ''})`, order.id);
    store.data.orders.push(order);
    store.save();
    res.json({ order: publicOrder(order), user: publicUser(req.user) });
  });

  app.get('/api/orders', auth, (req, res) => {
    res.json({ orders: store.data.orders.filter((o) => o.userId === req.user.id).reverse().map(publicOrder) });
  });

  const ownOrder = (req) => {
    const o = store.data.orders.find((x) => x.id === req.params.id && x.userId === req.user.id);
    if (!o) throw new HttpError(404, 'NOT_FOUND', 'الطلب غير موجود');
    return o;
  };

  app.get('/api/orders/:id', auth, (req, res) => {
    const o = ownOrder(req);
    res.json({ order: publicOrder(o), svg: render(o.spec, false) });
  });

  // تعديل التصميم بعد الشراء مجاناً (الشكل، الألوان، الخطوط، الحجم...) ما دامت النصوص والشعار كما هي
  app.put('/api/orders/:id', auth, (req, res) => {
    const o = ownOrder(req);
    const spec = normalizeSpec(req.body?.spec);
    if (contentKey(spec) !== contentKey(o.spec)) {
      throw new HttpError(409, 'CONTENT_CHANGED', 'تغيير النصوص أو الشعار يعتبر ختماً جديداً ويتطلب شراءً جديداً');
    }
    o.spec = spec;
    o.updatedAt = new Date().toISOString();
    store.save();
    res.json({ order: publicOrder(o) });
  });

  app.get('/api/orders/:id/download', auth, wrap(async (req, res) => {
    const o = ownOrder(req);
    const svg = render(o.spec, false);
    const base = `khatmi-${o.id}`;
    if (req.query.format === 'pdf') {
      const pdf = await svgToPdf(svg, { widthMm: o.spec.widthMm, heightMm: o.spec.heightMm, title: o.spec.texts.top || 'Khatmi' });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${base}.pdf"`);
      return res.send(pdf);
    }
    res.setHeader('Content-Type', 'image/svg+xml; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${base}.svg"`);
    res.send(svg);
  }));

  // ================= المحفظة وشحن الرصيد =================
  const publicTopup = (t) => ({ id: t.id, carrier: t.carrier, senderPhone: t.senderPhone, amount: toLyd(t.amount), credit: toLyd(t.credit || 0), status: t.status, note: t.note || '', createdAt: t.createdAt, resolvedAt: t.resolvedAt || null, merchantNumber: t.merchantNumber });

  app.get('/api/wallet', auth, (req, res) => {
    res.json({
      balance: toLyd(req.user.balance),
      transactions: store.data.transactions.filter((t) => t.userId === req.user.id).slice(-50).reverse().map((t) => ({ ...t, amount: toLyd(t.amount), balanceAfter: toLyd(t.balanceAfter) })),
      topups: store.data.topups.filter((t) => t.userId === req.user.id).slice(-30).reverse().map(publicTopup),
    });
  });

  app.post('/api/topups', auth, (req, res) => {
    const s = settings();
    const carrierKey = String(req.body?.carrier || '');
    const carrier = s.carriers[carrierKey];
    if (!carrier || !carrier.enabled || !carrier.number) throw new HttpError(400, 'CARRIER_DISABLED', 'الشحن عبر هذه الشركة غير متاح حالياً');
    const senderPhone = normalizePhone(req.body?.senderPhone);
    if (!senderPhone) throw new HttpError(400, 'BAD_PHONE', 'رقم الهاتف المحوِّل غير صحيح');
    if (carrierOf(senderPhone) !== carrierKey) throw new HttpError(400, 'WRONG_CARRIER', `الرقم ${senderPhone} لا يتبع شركة ${carrier.name}`);
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount < carrier.min || amount > carrier.max) throw new HttpError(400, 'BAD_AMOUNT', `المبلغ يجب أن يكون بين ${carrier.min} و ${carrier.max} د.ل`);
    const pending = store.data.topups.filter((t) => t.userId === req.user.id && t.status === 'pending');
    if (pending.length >= 3) throw new HttpError(429, 'TOO_MANY_PENDING', 'لديك طلبات شحن قيد المراجعة، انتظر تأكيدها');
    const t = { id: store.id('top'), userId: req.user.id, carrier: carrierKey, senderPhone, amount: toDirham(amount), status: 'pending', merchantNumber: carrier.number, createdAt: new Date().toISOString() };
    store.data.topups.push(t);
    store.save();
    res.json({ topup: publicTopup(t) });
  });

  app.post('/api/topups/:id/cancel', auth, (req, res) => {
    const t = store.data.topups.find((x) => x.id === req.params.id && x.userId === req.user.id);
    if (!t || t.status !== 'pending') throw new HttpError(404, 'NOT_FOUND', 'الطلب غير موجود');
    t.status = 'cancelled';
    t.resolvedAt = new Date().toISOString();
    store.save();
    res.json({ topup: publicTopup(t) });
  });

  // اعتماد طلب شحن وإضافة الرصيد للمحفظة
  const approveTopup = (t, receivedLyd, by) => {
    const s = settings();
    const user = store.data.users.find((u) => u.id === t.userId);
    const received = receivedLyd !== undefined && receivedLyd !== null && receivedLyd !== '' ? toDirham(receivedLyd) : t.amount;
    const credit = Math.round(received * (s.carriers[t.carrier]?.rate ?? 1));
    t.status = 'approved';
    t.received = received;
    t.credit = credit;
    t.approvedBy = by;
    t.resolvedAt = new Date().toISOString();
    store.addTransaction(user, credit, 'topup', `شحن رصيد ${s.carriers[t.carrier]?.name || t.carrier} من ${t.senderPhone}`, t.id);
  };

  // Webhook لتطبيق إعادة توجيه الرسائل: يعتمد الطلب تلقائياً عند وصول رسالة تحويل رصيد مطابقة
  app.post('/api/webhooks/sms', (req, res) => {
    if (!cfg.smsWebhookSecret || req.body?.secret !== cfg.smsWebhookSecret) throw new HttpError(401, 'UNAUTHORIZED');
    const message = String(req.body?.message || '').slice(0, 500);
    const digits = message.replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c));
    const phoneMatch = /(?:\+?218|0)?9[1-5]\d{7}/.exec(digits.replace(/[\s-]/g, ''));
    const sender = phoneMatch ? normalizePhone(phoneMatch[0]) : null;
    const withoutPhone = phoneMatch ? digits.replace(/[\s-]/g, ' ').replace(phoneMatch[0], ' ') : digits;
    const amounts = [...withoutPhone.matchAll(/(\d+(?:[.,]\d{1,3})?)/g)].map((m) => Number(m[1].replace(',', '.'))).filter((n) => n > 0 && n <= 1000);
    store.data.smsLog.push({ at: new Date().toISOString(), from: String(req.body?.from || ''), message, sender, amounts });
    let matched = null;
    if (sender) {
      const since = Date.now() - 48 * 3600e3;
      matched = store.data.topups.find((t) => t.status === 'pending' && t.senderPhone === sender && Date.parse(t.createdAt) > since && amounts.some((a) => toDirham(a) === t.amount));
      if (matched) approveTopup(matched, toLyd(matched.amount), 'sms');
    }
    store.save();
    res.json({ ok: true, matched: matched ? matched.id : null });
  });

  // ================= الإدارة =================
  app.post('/api/admin/login', (req, res) => {
    const pw = Buffer.from(String(req.body?.password || ''));
    const real = Buffer.from(cfg.adminPassword);
    if (pw.length !== real.length || !crypto.timingSafeEqual(pw, real)) throw new HttpError(401, 'BAD_LOGIN', 'كلمة المرور غير صحيحة');
    res.json({ token: sign({ role: 'admin', exp: Date.now() + 12 * 3600e3 }) });
  });

  app.get('/api/admin/overview', adminAuth, (_req, res) => {
    const d = store.data;
    const userById = Object.fromEntries(d.users.map((u) => [u.id, u]));
    res.json({
      stats: {
        users: d.users.length,
        orders: d.orders.length,
        revenue: toLyd(d.orders.reduce((s, o) => s + o.price, 0)),
        walletTotal: toLyd(d.users.reduce((s, u) => s + u.balance, 0)),
        pendingTopups: d.topups.filter((t) => t.status === 'pending').length,
      },
      topups: d.topups.slice(-100).reverse().map((t) => ({ ...publicTopup(t), received: toLyd(t.received || 0), userName: userById[t.userId]?.name, userPhone: userById[t.userId]?.phone })),
      users: d.users.slice(-100).reverse().map(publicUser),
      orders: d.orders.slice(-50).reverse().map((o) => ({ ...publicOrder(o), userName: userById[o.userId]?.name })),
      smsLog: d.smsLog.slice(-20).reverse(),
      settings: settings(),
    });
  });

  app.post('/api/admin/topups/:id/approve', adminAuth, (req, res) => {
    const t = store.data.topups.find((x) => x.id === req.params.id);
    if (!t || t.status !== 'pending') throw new HttpError(404, 'NOT_FOUND', 'الطلب غير موجود أو تمت معالجته');
    approveTopup(t, req.body?.received, 'admin');
    store.save();
    res.json({ topup: publicTopup(t) });
  });

  app.post('/api/admin/topups/:id/reject', adminAuth, (req, res) => {
    const t = store.data.topups.find((x) => x.id === req.params.id);
    if (!t || t.status !== 'pending') throw new HttpError(404, 'NOT_FOUND', 'الطلب غير موجود أو تمت معالجته');
    t.status = 'rejected';
    t.note = String(req.body?.note || '').slice(0, 200);
    t.resolvedAt = new Date().toISOString();
    store.save();
    res.json({ topup: publicTopup(t) });
  });

  app.post('/api/admin/users/:id/adjust', adminAuth, (req, res) => {
    const u = store.data.users.find((x) => x.id === req.params.id);
    if (!u) throw new HttpError(404, 'NOT_FOUND', 'المستخدم غير موجود');
    const amount = Number(req.body?.amount);
    if (!Number.isFinite(amount) || amount === 0) throw new HttpError(400, 'BAD_AMOUNT', 'مبلغ غير صحيح');
    try {
      store.addTransaction(u, toDirham(amount), 'adjust', String(req.body?.note || 'تعديل إداري').slice(0, 120));
    } catch {
      throw new HttpError(400, 'INSUFFICIENT_BALANCE', 'لا يمكن أن يصبح الرصيد سالباً');
    }
    store.save();
    res.json({ user: publicUser(u) });
  });

  app.put('/api/admin/settings', adminAuth, (req, res) => {
    const s = settings();
    const b = req.body || {};
    const money = (v, d) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Math.round(Number(v) * 1000) / 1000 : d);
    s.pricePerLetter = money(b.pricePerLetter, s.pricePerLetter);
    s.iconFee = money(b.iconFee, s.iconFee);
    s.logoFee = money(b.logoFee, s.logoFee);
    s.minPrice = money(b.minPrice, s.minPrice);
    for (const key of Object.keys(s.carriers)) {
      const c = b.carriers?.[key];
      if (!c) continue;
      const target = s.carriers[key];
      if (c.number !== undefined) {
        const n = c.number === '' ? '' : normalizePhone(c.number);
        if (n === null || (n && carrierOf(n) !== key)) throw new HttpError(400, 'BAD_PHONE', `رقم ${target.name} غير صحيح`);
        target.number = n;
      }
      target.rate = money(c.rate, target.rate);
      target.min = money(c.min, target.min);
      target.max = money(c.max, target.max);
      if (c.enabled !== undefined) target.enabled = Boolean(c.enabled);
    }
    store.save();
    res.json({ settings: s });
  });

  // ================= الملفات الثابتة والأخطاء =================
  // ملف ربط تطبيق الأندرويد (APK / Google Play) بالموقع: ضع assetlinks.json في public/.well-known/
  app.use('/.well-known', express.static(path.join(PUBLIC_DIR, '.well-known'), { dotfiles: 'allow' }));
  app.use(express.static(PUBLIC_DIR));
  app.use('/api', (_req, _res, next) => next(new HttpError(404, 'NOT_FOUND', 'غير موجود')));
  // eslint-disable-next-line no-unused-vars
  app.use((err, _req, res, _next) => {
    if (err.type === 'entity.too.large') err = new HttpError(413, 'TOO_LARGE', 'الملف كبير جداً');
    const status = err.status || 500;
    if (status >= 500) log.error?.(err);
    res.status(status).json({ error: err.code || 'SERVER_ERROR', message: status >= 500 ? 'حدث خطأ في الخادم' : err.message });
  });

  return app;
}
