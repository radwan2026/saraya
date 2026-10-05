import { systemAccount, tx } from './db.js';

export const ACCOUNT_TYPES = {
  client: { label: 'عميل', base: 2001 },
  subagent: { label: 'وكيل فرعي', base: 2501 },
  supplier: { label: 'مزود', base: 5001 },
  cash: { label: 'خزينة', base: 1001 },
  bank: { label: 'حساب مصرفي', base: 1501 },
  revenue: { label: 'إيرادات', base: 4001 },
  expense: { label: 'مصروفات', base: 6001 },
  equity: { label: 'حقوق ملكية', base: 3001 },
};

export const DOC_TYPES = {
  invoice: 'فاتورة',
  receipt: 'إيصال قبض',
  payment: 'إيصال دفع',
  debit_note: 'إشعار مدين',
  credit_note: 'إشعار دائن',
  opening: 'رصيد افتتاحي',
};

export class ValidationError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

export const round3 = (n) => Math.round((Number(n) || 0) * 1000) / 1000;
const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const today = () => new Date().toISOString().slice(0, 10);

function requireDate(value, label = 'التاريخ') {
  const d = value || today();
  if (!DATE_RE.test(d)) throw new ValidationError(`${label} غير صحيح`);
  return d;
}

function getAccount(db, id, label = 'الحساب') {
  const acc = db.prepare('SELECT * FROM accounts WHERE id = ?').get(Number(id));
  if (!acc) throw new ValidationError(`${label} غير موجود`);
  return acc;
}

// ---------------------------------------------------------------- accounts

export function nextAccountCode(db, type) {
  const def = ACCOUNT_TYPES[type];
  if (!def) throw new ValidationError('نوع الحساب غير معروف');
  const row = db
    .prepare('SELECT MAX(CAST(code AS INTEGER)) AS m FROM accounts WHERE type = ? AND CAST(code AS INTEGER) >= ?')
    .get(type, def.base);
  return String(row.m ? row.m + 1 : def.base);
}

export function createAccount(db, data, userId) {
  const name = String(data.name || '').trim();
  if (!name) throw new ValidationError('اسم الحساب مطلوب');
  const type = data.type;
  if (!ACCOUNT_TYPES[type]) throw new ValidationError('نوع الحساب غير معروف');
  return tx(db, () => {
    const code = String(data.code || '').trim() || nextAccountCode(db, type);
    if (db.prepare('SELECT 1 FROM accounts WHERE code = ?').get(code)) {
      throw new ValidationError(`رقم الحساب ${code} مستخدم مسبقاً`);
    }
    const { lastInsertRowid } = db
      .prepare('INSERT INTO accounts (code, name, type, phone, email, address, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(code, name, type, data.phone || null, data.email || null, data.address || null, data.notes || null);
    const id = Number(lastInsertRowid);
    const opening = round3(data.opening_balance);
    if (opening) {
      insertDocument(db, {
        type: 'opening',
        account_id: id,
        date: data.opening_date,
        amount: opening,
        notes: 'رصيد افتتاحي',
      }, userId);
    }
    return id;
  });
}

export function updateAccount(db, id, data) {
  const acc = getAccount(db, id);
  const name = String(data.name ?? acc.name).trim();
  if (!name) throw new ValidationError('اسم الحساب مطلوب');
  const code = String(data.code ?? acc.code).trim();
  if (code !== acc.code && db.prepare('SELECT 1 FROM accounts WHERE code = ? AND id <> ?').get(code, acc.id)) {
    throw new ValidationError(`رقم الحساب ${code} مستخدم مسبقاً`);
  }
  db.prepare(
    'UPDATE accounts SET code = ?, name = ?, phone = ?, email = ?, address = ?, notes = ?, active = ? WHERE id = ?',
  ).run(
    code,
    name,
    data.phone ?? acc.phone,
    data.email ?? acc.email,
    data.address ?? acc.address,
    data.notes ?? acc.notes,
    data.active === undefined ? acc.active : data.active ? 1 : 0,
    acc.id,
  );
}

export function deleteAccount(db, id) {
  const acc = getAccount(db, id);
  if (acc.system) throw new ValidationError('لا يمكن حذف حساب من حسابات النظام');
  const used =
    db.prepare('SELECT 1 FROM documents WHERE (account_id = ? OR counter_account_id = ?) AND type <> \'opening\' LIMIT 1').get(acc.id, acc.id) ||
    db.prepare('SELECT 1 FROM invoice_lines WHERE supplier_id = ? LIMIT 1').get(acc.id);
  if (used) throw new ValidationError('لا يمكن حذف حساب عليه حركات، يمكنك إيقافه بدلاً من ذلك');
  tx(db, () => {
    db.prepare("DELETE FROM documents WHERE account_id = ? AND type = 'opening'").run(acc.id);
    db.prepare('DELETE FROM accounts WHERE id = ?').run(acc.id);
  });
}

export function listAccounts(db, { type, q, includeInactive } = {}) {
  const where = [];
  const params = [];
  if (type) {
    const types = String(type).split(',');
    where.push(`a.type IN (${types.map(() => '?').join(',')})`);
    params.push(...types);
  }
  if (q) {
    where.push('(a.name LIKE ? OR a.code LIKE ? OR a.phone LIKE ?)');
    params.push(`%${q}%`, `${q}%`, `%${q}%`);
  }
  if (!includeInactive) where.push('a.active = 1');
  return db
    .prepare(
      `SELECT a.*, COALESCE(SUM(e.debit), 0) AS debit, COALESCE(SUM(e.credit), 0) AS credit,
              ROUND(COALESCE(SUM(e.debit), 0) - COALESCE(SUM(e.credit), 0), 3) AS balance
       FROM accounts a LEFT JOIN entries e ON e.account_id = a.id
       ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
       GROUP BY a.id ORDER BY a.type, CAST(a.code AS INTEGER), a.code`,
    )
    .all(...params);
}

export function importAccounts(db, rows, userId) {
  if (!Array.isArray(rows) || !rows.length) throw new ValidationError('لا توجد بيانات للاستيراد');
  let created = 0;
  const errors = [];
  rows.forEach((row, i) => {
    try {
      createAccount(db, { ...row, type: row.type || 'client' }, userId);
      created++;
    } catch (err) {
      errors.push(`سطر ${i + 1}: ${err.message}`);
    }
  });
  return { created, errors };
}

// ---------------------------------------------------------------- pricing

/** Suggested sale price for a cost, based on the service sales policy or a client's special commission. */
export function suggestPrice(db, { account_id, service_id, cost }) {
  const c = num(cost);
  let rule = null;
  if (account_id && service_id) {
    rule = db.prepare('SELECT markup_pct, fixed_fee FROM commissions WHERE account_id = ? AND service_id = ?').get(Number(account_id), Number(service_id));
  }
  if (!rule && service_id) {
    rule = db.prepare('SELECT markup_pct, fixed_fee FROM services WHERE id = ?').get(Number(service_id));
  }
  if (!rule) return round3(c);
  return round3(c * (1 + num(rule.markup_pct) / 100) + num(rule.fixed_fee));
}

// ---------------------------------------------------------------- documents

function normalizeLines(db, lines, date) {
  if (!Array.isArray(lines) || !lines.length) throw new ValidationError('الفاتورة يجب أن تحتوي على بند واحد على الأقل');
  return lines.map((l, i) => {
    const line = {
      date: l.date ? requireDate(l.date, `تاريخ البند ${i + 1}`) : date,
      service_id: l.service_id ? Number(l.service_id) : null,
      supplier_id: l.supplier_id ? Number(l.supplier_id) : null,
      carrier_id: l.carrier_id ? Number(l.carrier_id) : null,
      doc_no: String(l.doc_no || '').trim() || null,
      pax_name: String(l.pax_name || '').trim() || null,
      description: String(l.description || '').trim() || null,
      cost: round3(l.cost),
      price: round3(l.price),
      fees: round3(l.fees),
    };
    if (line.cost < 0 || line.price < 0 || line.fees < 0) throw new ValidationError(`البند ${i + 1}: لا يمكن أن تكون القيم سالبة`);
    if (line.cost > 0 && !line.supplier_id) throw new ValidationError(`البند ${i + 1}: حدد المزود لتسجيل التكلفة`);
    if (line.supplier_id) getAccount(db, line.supplier_id, `مزود البند ${i + 1}`);
    if (!line.price && !line.fees && !line.cost) throw new ValidationError(`البند ${i + 1}: أدخل القيمة`);
    return line;
  });
}

function normalizeDocument(db, data) {
  const type = data.type;
  if (!DOC_TYPES[type]) throw new ValidationError('نوع المستند غير معروف');
  const doc = {
    type,
    date: requireDate(data.date),
    account_id: Number(data.account_id),
    counter_account_id: data.counter_account_id ? Number(data.counter_account_id) : null,
    currency: String(data.currency || 'LYD').toUpperCase(),
    rate: num(data.rate) || 1,
    services_pct: round3(data.services_pct),
    discount_pct: round3(data.discount_pct),
    attention: String(data.attention || '').trim() || null,
    notes: String(data.notes || '').trim() || null,
    bank_account_id: data.bank_account_id ? Number(data.bank_account_id) : null,
    show_fees: data.show_fees ? 1 : 0,
    lines: [],
  };
  if (!doc.account_id) throw new ValidationError('اختر الحساب (الجهة)');
  getAccount(db, doc.account_id);
  const cur = db.prepare('SELECT * FROM currencies WHERE code = ?').get(doc.currency);
  if (!cur) throw new ValidationError('العملة غير معرّفة');
  if (cur.is_base) doc.rate = 1;
  if (doc.rate <= 0) throw new ValidationError('سعر الصرف غير صحيح');

  if (type === 'invoice') {
    doc.lines = normalizeLines(db, data.lines, doc.date);
    doc.subtotal = round3(doc.lines.reduce((s, l) => s + l.price + l.fees, 0));
    doc.amount = round3(doc.subtotal + (doc.subtotal * doc.services_pct) / 100 - (doc.subtotal * doc.discount_pct) / 100);
  } else {
    doc.amount = round3(data.amount);
    doc.subtotal = doc.amount;
    if (type === 'opening') {
      if (!doc.amount) throw new ValidationError('أدخل قيمة الرصيد');
    } else if (doc.amount <= 0) {
      throw new ValidationError('أدخل قيمة صحيحة أكبر من صفر');
    }
  }

  if (type === 'receipt' || type === 'payment') {
    if (!doc.counter_account_id) throw new ValidationError('اختر الخزينة أو المصرف');
    const counter = getAccount(db, doc.counter_account_id, 'الخزينة');
    if (!['cash', 'bank'].includes(counter.type)) throw new ValidationError('حساب القبض/الدفع يجب أن يكون خزينة أو مصرفاً');
    if (counter.id === doc.account_id) throw new ValidationError('لا يمكن أن يكون الحساب والخزينة نفس الحساب');
  } else {
    doc.counter_account_id = null;
  }
  return doc;
}

/** Build the balanced journal entries for a normalized document (amounts in base currency). */
export function buildEntries(db, doc) {
  const r = doc.rate;
  const base = round3(doc.amount * r);
  const out = [];
  const add = (account_id, debit, credit, memo) => {
    debit = round3(debit);
    credit = round3(credit);
    if (debit || credit) out.push({ account_id, debit, credit, memo: memo || null });
  };
  switch (doc.type) {
    case 'invoice': {
      add(doc.account_id, base, 0, doc.notes);
      let costTotal = 0;
      for (const l of doc.lines) {
        if (!l.supplier_id || !l.cost) continue;
        const cost = round3(l.cost * r);
        costTotal = round3(costTotal + cost);
        add(l.supplier_id, 0, cost, [l.pax_name, l.doc_no, l.description].filter(Boolean).join(' - '));
      }
      const profit = round3(base - costTotal);
      const rev = systemAccount(db, 'acc_revenue');
      if (profit >= 0) add(rev, 0, profit, 'ربح فاتورة');
      else add(rev, -profit, 0, 'خسارة فاتورة');
      break;
    }
    case 'receipt':
      add(doc.counter_account_id, base, 0, doc.notes);
      add(doc.account_id, 0, base, doc.notes);
      break;
    case 'payment':
      add(doc.account_id, base, 0, doc.notes);
      add(doc.counter_account_id, 0, base, doc.notes);
      break;
    case 'debit_note':
      add(doc.account_id, base, 0, doc.notes);
      add(systemAccount(db, 'acc_adjust'), 0, base, doc.notes);
      break;
    case 'credit_note':
      add(systemAccount(db, 'acc_adjust'), base, 0, doc.notes);
      add(doc.account_id, 0, base, doc.notes);
      break;
    case 'opening': {
      const eq = systemAccount(db, 'acc_opening');
      if (base > 0) {
        add(doc.account_id, base, 0, 'رصيد افتتاحي');
        add(eq, 0, base, 'رصيد افتتاحي');
      } else {
        add(eq, -base, 0, 'رصيد افتتاحي');
        add(doc.account_id, 0, -base, 'رصيد افتتاحي');
      }
      break;
    }
  }
  const dr = round3(out.reduce((s, e) => s + e.debit, 0));
  const cr = round3(out.reduce((s, e) => s + e.credit, 0));
  if (dr !== cr) throw new Error(`Unbalanced entries for ${doc.type}: ${dr} != ${cr}`);
  return out;
}

function writeChildren(db, id, doc) {
  db.prepare('DELETE FROM invoice_lines WHERE document_id = ?').run(id);
  db.prepare('DELETE FROM entries WHERE document_id = ?').run(id);
  const insLine = db.prepare(
    `INSERT INTO invoice_lines (document_id, date, service_id, supplier_id, carrier_id, doc_no, pax_name, description, cost, price, fees)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );
  for (const l of doc.lines) {
    insLine.run(id, l.date, l.service_id, l.supplier_id, l.carrier_id, l.doc_no, l.pax_name, l.description, l.cost, l.price, l.fees);
  }
  const insEntry = db.prepare('INSERT INTO entries (document_id, account_id, date, debit, credit, memo) VALUES (?, ?, ?, ?, ?, ?)');
  for (const e of buildEntries(db, doc)) insEntry.run(id, e.account_id, doc.date, e.debit, e.credit, e.memo);
}

function insertDocument(db, data, userId) {
  const doc = normalizeDocument(db, data);
  const { m } = db.prepare('SELECT MAX(no) AS m FROM documents WHERE type = ?').get(doc.type);
  const no = (m || 0) + 1;
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO documents (type, no, date, account_id, counter_account_id, currency, rate, subtotal, services_pct, discount_pct,
         amount, attention, notes, bank_account_id, show_fees, user_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(doc.type, no, doc.date, doc.account_id, doc.counter_account_id, doc.currency, doc.rate, doc.subtotal, doc.services_pct,
      doc.discount_pct, doc.amount, doc.attention, doc.notes, doc.bank_account_id, doc.show_fees, userId ?? null);
  const id = Number(lastInsertRowid);
  writeChildren(db, id, doc);
  return id;
}

export function createDocument(db, data, userId) {
  return tx(db, () => insertDocument(db, data, userId));
}

function assertEditable(existing, user) {
  if (!existing) throw new ValidationError('المستند غير موجود', 404);
  if (existing.reviewed) throw new ValidationError('المستند مُراجَع ومقفل، يجب إلغاء المراجعة أولاً');
  if (user && user.role !== 'admin' && existing.user_id !== user.id) {
    throw new ValidationError('لا تملك صلاحية تعديل مستند أنشأه مستخدم آخر', 403);
  }
}

export function updateDocument(db, id, data, user) {
  return tx(db, () => {
    const existing = db.prepare('SELECT * FROM documents WHERE id = ?').get(Number(id));
    assertEditable(existing, user);
    const doc = normalizeDocument(db, { ...data, type: existing.type });
    db.prepare(
      `UPDATE documents SET date = ?, account_id = ?, counter_account_id = ?, currency = ?, rate = ?, subtotal = ?, services_pct = ?,
         discount_pct = ?, amount = ?, attention = ?, notes = ?, bank_account_id = ?, show_fees = ? WHERE id = ?`,
    ).run(doc.date, doc.account_id, doc.counter_account_id, doc.currency, doc.rate, doc.subtotal, doc.services_pct, doc.discount_pct,
      doc.amount, doc.attention, doc.notes, doc.bank_account_id, doc.show_fees, existing.id);
    writeChildren(db, existing.id, doc);
    return existing.id;
  });
}

export function deleteDocument(db, id, user) {
  const existing = db.prepare('SELECT * FROM documents WHERE id = ?').get(Number(id));
  assertEditable(existing, user);
  db.prepare('DELETE FROM documents WHERE id = ?').run(existing.id);
}

export function setReviewed(db, id, reviewed, user) {
  const existing = db.prepare('SELECT * FROM documents WHERE id = ?').get(Number(id));
  if (!existing) throw new ValidationError('المستند غير موجود', 404);
  if (!reviewed && user.role !== 'admin') throw new ValidationError('إلغاء المراجعة من صلاحية المدير فقط', 403);
  db.prepare('UPDATE documents SET reviewed = ?, reviewed_by = ? WHERE id = ?').run(reviewed ? 1 : 0, reviewed ? user.id : null, existing.id);
}

const DOC_SELECT = `
  SELECT d.*, a.name AS account_name, a.code AS account_code, a.type AS account_type,
         c.name AS counter_name, u.name AS user_name, ru.name AS reviewed_by_name
  FROM documents d
  JOIN accounts a ON a.id = d.account_id
  LEFT JOIN accounts c ON c.id = d.counter_account_id
  LEFT JOIN users u ON u.id = d.user_id
  LEFT JOIN users ru ON ru.id = d.reviewed_by`;

export function getDocument(db, id) {
  const doc = db.prepare(`${DOC_SELECT} WHERE d.id = ?`).get(Number(id));
  if (!doc) return null;
  doc.lines = db
    .prepare(
      `SELECT l.*, s.name AS service_name, sp.name AS supplier_name, cr.name AS carrier_name
       FROM invoice_lines l
       LEFT JOIN services s ON s.id = l.service_id
       LEFT JOIN accounts sp ON sp.id = l.supplier_id
       LEFT JOIN carriers cr ON cr.id = l.carrier_id
       WHERE l.document_id = ? ORDER BY l.id`,
    )
    .all(doc.id);
  doc.entries = db
    .prepare('SELECT e.*, a.name AS account_name, a.code AS account_code FROM entries e JOIN accounts a ON a.id = e.account_id WHERE e.document_id = ? ORDER BY e.id')
    .all(doc.id);
  doc.bank = doc.bank_account_id ? db.prepare('SELECT * FROM bank_accounts WHERE id = ?').get(doc.bank_account_id) : null;
  return doc;
}

export function listDocuments(db, { type, from, to, account_id, reviewed, q, limit } = {}) {
  const where = [];
  const params = [];
  if (type) {
    const types = String(type).split(',');
    where.push(`d.type IN (${types.map(() => '?').join(',')})`);
    params.push(...types);
  }
  if (from) { where.push('d.date >= ?'); params.push(from); }
  if (to) { where.push('d.date <= ?'); params.push(to); }
  if (account_id) {
    where.push('(d.account_id = ? OR d.counter_account_id = ?)');
    params.push(Number(account_id), Number(account_id));
  }
  if (reviewed === '0' || reviewed === '1') { where.push('d.reviewed = ?'); params.push(Number(reviewed)); }
  if (q) {
    where.push('(a.name LIKE ? OR d.notes LIKE ? OR CAST(d.no AS TEXT) = ?)');
    params.push(`%${q}%`, `%${q}%`, String(q));
  }
  const lim = Math.min(Number(limit) || 1000, 5000);
  return db
    .prepare(`${DOC_SELECT} ${where.length ? 'WHERE ' + where.join(' AND ') : ''} ORDER BY d.date DESC, d.id DESC LIMIT ${lim}`)
    .all(...params);
}

// ---------------------------------------------------------------- reports

export function accountStatement(db, accountId, { from, to } = {}) {
  const account = getAccount(db, accountId);
  const opening = from
    ? db.prepare('SELECT ROUND(COALESCE(SUM(debit - credit), 0), 3) AS b FROM entries WHERE account_id = ? AND date < ?').get(account.id, from).b
    : 0;
  const where = ['e.account_id = ?'];
  const params = [account.id];
  if (from) { where.push('e.date >= ?'); params.push(from); }
  if (to) { where.push('e.date <= ?'); params.push(to); }
  const rows = db
    .prepare(
      `SELECT e.id, e.date, e.debit, e.credit, e.memo, d.id AS document_id, d.type, d.no, d.notes, d.currency, d.rate, d.amount
       FROM entries e JOIN documents d ON d.id = e.document_id
       WHERE ${where.join(' AND ')} ORDER BY e.date, d.id, e.id`,
    )
    .all(...params);
  let balance = opening;
  let debit = 0;
  let credit = 0;
  for (const r of rows) {
    balance = round3(balance + r.debit - r.credit);
    debit = round3(debit + r.debit);
    credit = round3(credit + r.credit);
    r.balance = balance;
  }
  return { account, opening, rows, debit, credit, closing: balance };
}

export function salesReport(db, { from, to, group = 'service' } = {}) {
  const groups = {
    service: ['l.service_id', "COALESCE(s.name, 'بدون خدمة')"],
    supplier: ['l.supplier_id', "COALESCE(sp.name, 'بدون مزود')"],
    carrier: ['l.carrier_id', "COALESCE(cr.name, 'بدون ناقل')"],
    client: ['d.account_id', 'a.name'],
    day: ['d.date', 'd.date'],
  };
  const [key, label] = groups[group] || groups.service;
  const where = ["d.type = 'invoice'"];
  const params = [];
  if (from) { where.push('d.date >= ?'); params.push(from); }
  if (to) { where.push('d.date <= ?'); params.push(to); }
  const rows = db
    .prepare(
      `SELECT ${key} AS key, ${label} AS label, COUNT(*) AS count,
              ROUND(SUM((l.price + l.fees) * d.rate), 3) AS sales,
              ROUND(SUM(l.cost * d.rate), 3) AS cost,
              ROUND(SUM((l.price + l.fees - l.cost) * d.rate), 3) AS profit
       FROM invoice_lines l
       JOIN documents d ON d.id = l.document_id
       JOIN accounts a ON a.id = d.account_id
       LEFT JOIN services s ON s.id = l.service_id
       LEFT JOIN accounts sp ON sp.id = l.supplier_id
       LEFT JOIN carriers cr ON cr.id = l.carrier_id
       WHERE ${where.join(' AND ')}
       GROUP BY ${key} ORDER BY sales DESC`,
    )
    .all(...params);
  const adj = db
    .prepare(`SELECT ROUND(COALESCE(SUM((d.amount - d.subtotal) * d.rate), 0), 3) AS v FROM documents d WHERE ${where.join(' AND ')}`)
    .get(...params).v;
  const sum = (k) => round3(rows.reduce((s, r) => s + r[k], 0));
  return {
    rows,
    totals: { count: rows.reduce((s, r) => s + r.count, 0), sales: sum('sales'), cost: sum('cost'), profit: sum('profit') },
    adjustments: adj,
    net_profit: round3(sum('profit') + adj),
  };
}

export function treasuryReport(db, { from, to } = {}) {
  const accounts = db.prepare("SELECT * FROM accounts WHERE type IN ('cash', 'bank') ORDER BY code").all();
  return accounts.map((a) => {
    const st = accountStatement(db, a.id, { from, to });
    return { id: a.id, code: a.code, name: a.name, type: a.type, opening: st.opening, in: st.debit, out: st.credit, closing: st.closing };
  });
}

export function linesReport(db, { from, to, service_id, supplier_id } = {}) {
  const where = ["d.type = 'invoice'"];
  const params = [];
  if (from) { where.push('d.date >= ?'); params.push(from); }
  if (to) { where.push('d.date <= ?'); params.push(to); }
  if (service_id) { where.push('l.service_id = ?'); params.push(Number(service_id)); }
  if (supplier_id) { where.push('l.supplier_id = ?'); params.push(Number(supplier_id)); }
  return db
    .prepare(
      `SELECT l.*, d.no, d.date AS doc_date, d.currency, d.rate, a.name AS account_name,
              s.name AS service_name, sp.name AS supplier_name, cr.name AS carrier_name
       FROM invoice_lines l JOIN documents d ON d.id = l.document_id JOIN accounts a ON a.id = d.account_id
       LEFT JOIN services s ON s.id = l.service_id LEFT JOIN accounts sp ON sp.id = l.supplier_id
       LEFT JOIN carriers cr ON cr.id = l.carrier_id
       WHERE ${where.join(' AND ')} ORDER BY d.date DESC, l.id DESC LIMIT 5000`,
    )
    .all(...params);
}

export function dashboard(db, date = today()) {
  const one = (sql, ...p) => db.prepare(sql).get(...p).v || 0;
  const monthStart = date.slice(0, 8) + '01';
  const sumDocs = (type, from) => one(`SELECT ROUND(SUM(amount * rate), 3) AS v FROM documents WHERE type = ? AND date >= ? AND date <= ?`, type, from, date);
  const balanceOf = (types) =>
    one(`SELECT ROUND(SUM(e.debit - e.credit), 3) AS v FROM entries e JOIN accounts a ON a.id = e.account_id WHERE a.type IN (${types})`);
  return {
    date,
    sales_today: sumDocs('invoice', date),
    sales_month: sumDocs('invoice', monthStart),
    receipts_today: sumDocs('receipt', date),
    payments_today: sumDocs('payment', date),
    receivables: balanceOf("'client','subagent'"),
    payables: -balanceOf("'supplier'"),
    cash: balanceOf("'cash','bank'"),
    profit_month: salesReport(db, { from: monthStart, to: date }).net_profit,
    unreviewed: one('SELECT COUNT(*) AS v FROM documents WHERE reviewed = 0'),
    clients: one("SELECT COUNT(*) AS v FROM accounts WHERE type IN ('client','subagent')"),
  };
}

export function search(db, q) {
  q = String(q || '').trim();
  if (!q) return { accounts: [], lines: [], documents: [] };
  const like = `%${q}%`;
  return {
    accounts: listAccounts(db, { q, includeInactive: true }).slice(0, 50),
    lines: db
      .prepare(
        `SELECT l.*, d.no, d.date AS doc_date, d.currency, a.name AS account_name, s.name AS service_name, sp.name AS supplier_name
         FROM invoice_lines l JOIN documents d ON d.id = l.document_id JOIN accounts a ON a.id = d.account_id
         LEFT JOIN services s ON s.id = l.service_id LEFT JOIN accounts sp ON sp.id = l.supplier_id
         WHERE l.pax_name LIKE ? OR l.doc_no LIKE ? OR l.description LIKE ?
         ORDER BY d.date DESC LIMIT 200`,
      )
      .all(like, like, like),
    documents: listDocuments(db, { q, limit: 200 }),
  };
}
