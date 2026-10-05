import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSettings, tx } from './db.js';
import { hashPassword, newToken, verifyPassword } from './auth.js';
import * as L from './ledger.js';

const PUBLIC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'public');
export const VERSION = '1.0.0';

/** Simple lookup tables managed from the "ضبط" menu: table -> editable columns. */
const LOOKUPS = {
  currencies: ['code', 'name', 'rate'],
  countries: ['name'],
  cities: ['name', 'code', 'country_id'],
  carriers: ['code', 'name'],
  services: ['name', 'markup_pct', 'fixed_fee'],
  bank_accounts: ['acc_title', 'company_name', 'bank_name', 'account_no', 'iban', 'swift', 'country', 'details', 'more_details'],
  commissions: ['account_id', 'service_id', 'markup_pct', 'fixed_fee'],
};
const LOOKUP_ORDER = {
  currencies: 'is_base DESC, code',
  countries: 'name',
  cities: 'name',
  carriers: 'name',
  services: 'id',
  bank_accounts: 'id',
  commissions: 'id',
};
const SETTING_KEYS = ['company_name', 'company_phone', 'company_address', 'office_no', 'theme', 'invoice_footer'];

const wrap = (fn) => (req, res, next) => {
  try {
    const out = fn(req, res);
    if (out !== undefined) res.json(out);
  } catch (err) {
    next(err);
  }
};

export function createApp(db) {
  const app = express();
  app.use(express.json({ limit: '5mb' }));
  app.use(express.static(PUBLIC_DIR));

  const api = express.Router();

  // ------------------------------------------------------------ auth
  api.post('/login', wrap((req) => {
    const { username, password } = req.body || {};
    const user = db.prepare('SELECT * FROM users WHERE username = ? AND active = 1').get(String(username || '').trim());
    if (!user || !verifyPassword(password || '', user.password_hash)) {
      throw new L.ValidationError('اسم المستخدم أو كلمة المرور غير صحيحة', 401);
    }
    const token = newToken();
    db.prepare('INSERT INTO sessions (token, user_id) VALUES (?, ?)').run(token, user.id);
    return { token, user: publicUser(user) };
  }));

  api.use((req, res, next) => {
    const token = (req.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const user = token
      ? db.prepare('SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token = ? AND u.active = 1').get(token)
      : null;
    if (!user) return res.status(401).json({ error: 'يجب تسجيل الدخول' });
    req.user = user;
    req.token = token;
    next();
  });

  const adminOnly = (req, res, next) =>
    req.user.role === 'admin' ? next() : res.status(403).json({ error: 'هذه العملية من صلاحية المدير فقط' });

  api.post('/logout', wrap((req) => {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(req.token);
    return { ok: true };
  }));

  api.get('/me', wrap((req) => ({ user: publicUser(req.user), settings: getSettings(db), version: VERSION })));

  api.post('/change-password', wrap((req) => {
    const { old_password, new_password } = req.body || {};
    if (!verifyPassword(old_password || '', req.user.password_hash)) throw new L.ValidationError('كلمة المرور الحالية غير صحيحة');
    if (String(new_password || '').length < 4) throw new L.ValidationError('كلمة المرور الجديدة يجب أن تكون 4 أحرف على الأقل');
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(new_password), req.user.id);
    return { ok: true };
  }));

  // ------------------------------------------------------------ settings
  api.get('/settings', wrap(() => getSettings(db)));
  api.put('/settings', adminOnly, wrap((req) => {
    const ins = db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value');
    for (const k of SETTING_KEYS) if (req.body[k] !== undefined) ins.run(k, String(req.body[k]));
    return getSettings(db);
  }));

  // ------------------------------------------------------------ users (المشغلين)
  api.get('/users', adminOnly, wrap(() => db.prepare('SELECT id, username, name, role, active, created_at FROM users ORDER BY id').all()));
  api.post('/users', adminOnly, wrap((req) => {
    const { username, name, password, role } = req.body || {};
    if (!String(username || '').trim() || !String(name || '').trim()) throw new L.ValidationError('اسم الدخول والاسم مطلوبان');
    if (String(password || '').length < 4) throw new L.ValidationError('كلمة المرور يجب أن تكون 4 أحرف على الأقل');
    if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username.trim())) throw new L.ValidationError('اسم الدخول مستخدم مسبقاً');
    const { lastInsertRowid } = db
      .prepare('INSERT INTO users (username, name, password_hash, role) VALUES (?, ?, ?, ?)')
      .run(username.trim(), name.trim(), hashPassword(password), role === 'admin' ? 'admin' : 'user');
    return { id: Number(lastInsertRowid) };
  }));
  api.put('/users/:id', adminOnly, wrap((req) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
    if (!user) throw new L.ValidationError('المستخدم غير موجود', 404);
    const { name, role, active, password } = req.body || {};
    const newRole = role === undefined ? user.role : role === 'admin' ? 'admin' : 'user';
    const newActive = active === undefined ? user.active : active ? 1 : 0;
    if (user.id === req.user.id && (newRole !== 'admin' || !newActive)) throw new L.ValidationError('لا يمكنك إزالة صلاحياتك أو إيقاف حسابك');
    db.prepare('UPDATE users SET name = ?, role = ?, active = ? WHERE id = ?').run(String(name || user.name), newRole, newActive, user.id);
    if (password) {
      if (String(password).length < 4) throw new L.ValidationError('كلمة المرور يجب أن تكون 4 أحرف على الأقل');
      db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(hashPassword(password), user.id);
    }
    if (!newActive) db.prepare('DELETE FROM sessions WHERE user_id = ?').run(user.id);
    return { ok: true };
  }));

  // ------------------------------------------------------------ lookups
  api.get('/lookups/:table', wrap((req) => {
    const table = lookupTable(req.params.table);
    if (table === 'commissions') {
      return db.prepare(
        `SELECT c.*, a.name AS account_name, s.name AS service_name FROM commissions c
         JOIN accounts a ON a.id = c.account_id JOIN services s ON s.id = c.service_id ORDER BY a.name, s.name`,
      ).all();
    }
    if (table === 'cities') {
      return db.prepare('SELECT c.*, co.name AS country_name FROM cities c LEFT JOIN countries co ON co.id = c.country_id ORDER BY c.name').all();
    }
    return db.prepare(`SELECT * FROM ${table} ORDER BY ${LOOKUP_ORDER[table]}`).all();
  }));
  api.post('/lookups/:table', wrap((req) => {
    const table = lookupTable(req.params.table);
    const { cols, vals } = lookupValues(table, req.body);
    try {
      const { lastInsertRowid } = db.prepare(`INSERT INTO ${table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`).run(...vals);
      return { id: Number(lastInsertRowid) };
    } catch (err) {
      throw constraintError(err);
    }
  }));
  api.put('/lookups/:table/:id', wrap((req) => {
    const table = lookupTable(req.params.table);
    const { cols, vals } = lookupValues(table, req.body);
    if (table === 'currencies') {
      const cur = db.prepare('SELECT * FROM currencies WHERE id = ?').get(Number(req.params.id));
      if (cur?.is_base) vals[cols.indexOf('rate')] = 1;
    }
    try {
      db.prepare(`UPDATE ${table} SET ${cols.map((c) => `${c} = ?`).join(', ')} WHERE id = ?`).run(...vals, Number(req.params.id));
    } catch (err) {
      throw constraintError(err);
    }
    return { ok: true };
  }));
  api.delete('/lookups/:table/:id', wrap((req) => {
    const table = lookupTable(req.params.table);
    if (table === 'currencies') {
      const cur = db.prepare('SELECT * FROM currencies WHERE id = ?').get(Number(req.params.id));
      if (cur?.is_base) throw new L.ValidationError('لا يمكن حذف العملة الأساسية');
      if (cur && db.prepare('SELECT 1 FROM documents WHERE currency = ? LIMIT 1').get(cur.code)) throw new L.ValidationError('العملة مستخدمة في مستندات');
    }
    try {
      db.prepare(`DELETE FROM ${table} WHERE id = ?`).run(Number(req.params.id));
    } catch (err) {
      throw constraintError(err, 'لا يمكن الحذف لأن السجل مستخدم في مستندات أخرى');
    }
    return { ok: true };
  }));

  // ------------------------------------------------------------ accounts
  api.get('/accounts', wrap((req) => L.listAccounts(db, { type: req.query.type, q: req.query.q, includeInactive: req.query.all === '1' })));
  api.get('/accounts/next-code', wrap((req) => ({ code: L.nextAccountCode(db, req.query.type) })));
  api.post('/accounts', wrap((req) => ({ id: L.createAccount(db, req.body || {}, req.user.id) })));
  api.post('/accounts/import', wrap((req) => L.importAccounts(db, req.body?.rows, req.user.id)));
  api.put('/accounts/:id', wrap((req) => {
    L.updateAccount(db, req.params.id, req.body || {});
    return { ok: true };
  }));
  api.delete('/accounts/:id', adminOnly, wrap((req) => {
    L.deleteAccount(db, req.params.id);
    return { ok: true };
  }));

  // ------------------------------------------------------------ documents
  api.get('/documents', wrap((req) => L.listDocuments(db, req.query)));
  api.get('/documents/:id', wrap((req) => {
    const doc = L.getDocument(db, req.params.id);
    if (!doc) throw new L.ValidationError('المستند غير موجود', 404);
    return doc;
  }));
  api.post('/documents', wrap((req) => {
    if (req.body?.type === 'opening') throw new L.ValidationError('الأرصدة الافتتاحية تُسجَّل من شاشة الحساب');
    return { id: L.createDocument(db, req.body || {}, req.user.id) };
  }));
  api.put('/documents/:id', wrap((req) => ({ id: L.updateDocument(db, req.params.id, req.body || {}, req.user) })));
  api.delete('/documents/:id', wrap((req) => {
    L.deleteDocument(db, req.params.id, req.user);
    return { ok: true };
  }));
  api.post('/documents/:id/review', wrap((req) => {
    L.setReviewed(db, req.params.id, req.body?.reviewed !== false, req.user);
    return { ok: true };
  }));
  api.post('/documents/review-all', wrap((req) => {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids : [];
    tx(db, () => ids.forEach((id) => L.setReviewed(db, id, true, req.user)));
    return { ok: true, count: ids.length };
  }));

  api.get('/pricing', wrap((req) => ({ price: L.suggestPrice(db, req.query) })));

  // ------------------------------------------------------------ reports
  api.get('/reports/dashboard', wrap(() => L.dashboard(db)));
  api.get('/reports/statement', wrap((req) => L.accountStatement(db, req.query.account_id, req.query)));
  api.get('/reports/sales', wrap((req) => L.salesReport(db, req.query)));
  api.get('/reports/lines', wrap((req) => L.linesReport(db, req.query)));
  api.get('/reports/treasury', wrap((req) => L.treasuryReport(db, req.query)));
  api.get('/reports/balances', wrap((req) => L.listAccounts(db, { type: req.query.type, includeInactive: true })));
  api.get('/search', wrap((req) => L.search(db, req.query.q)));

  app.use('/api', api);
  app.use('/api', (req, res) => res.status(404).json({ error: 'غير موجود' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    const status = err.status || (err.type === 'entity.parse.failed' ? 400 : 500);
    if (status >= 500) console.error(err);
    res.status(status).json({ error: status >= 500 ? 'حدث خطأ غير متوقع في الخادم' : err.message });
  });

  return app;
}

function publicUser(u) {
  return { id: u.id, username: u.username, name: u.name, role: u.role };
}

function lookupTable(name) {
  if (!LOOKUPS[name]) throw new L.ValidationError('جدول غير معروف', 404);
  return name;
}

function lookupValues(table, body = {}) {
  const cols = LOOKUPS[table];
  const vals = cols.map((c) => {
    const v = body[c];
    if (v === undefined || v === null || v === '') return null;
    return typeof v === 'string' ? v.trim() : v;
  });
  const required = { currencies: ['code', 'name'], cities: ['name'], carriers: ['name'], countries: ['name'], services: ['name'],
    bank_accounts: ['acc_title'], commissions: ['account_id', 'service_id'] }[table];
  for (const r of required) if (vals[cols.indexOf(r)] === null) throw new L.ValidationError('أكمل الحقول المطلوبة');
  if (table === 'currencies') {
    vals[0] = String(vals[0]).toUpperCase();
    vals[2] = Number(vals[2]) || 1;
  }
  for (const n of ['markup_pct', 'fixed_fee']) if (cols.includes(n)) vals[cols.indexOf(n)] = Number(vals[cols.indexOf(n)]) || 0;
  return { cols, vals };
}

function constraintError(err, fallback = 'القيمة مكررة أو مرتبطة بسجل آخر') {
  if (/constraint/i.test(err.message)) return new L.ValidationError(fallback);
  return err;
}
