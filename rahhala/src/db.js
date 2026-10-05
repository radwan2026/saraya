import { DatabaseSync } from 'node:sqlite';
import { hashPassword } from './auth.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'user',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS currencies (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  rate REAL NOT NULL DEFAULT 1,
  is_base INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS countries (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS cities (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT,
  country_id INTEGER REFERENCES countries(id)
);

CREATE TABLE IF NOT EXISTS carriers (
  id INTEGER PRIMARY KEY,
  code TEXT,
  name TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS services (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  markup_pct REAL NOT NULL DEFAULT 0,
  fixed_fee REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bank_accounts (
  id INTEGER PRIMARY KEY,
  acc_title TEXT NOT NULL,
  company_name TEXT,
  bank_name TEXT,
  account_no TEXT,
  iban TEXT,
  swift TEXT,
  country TEXT,
  details TEXT,
  more_details TEXT
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  phone TEXT,
  email TEXT,
  address TEXT,
  notes TEXT,
  system INTEGER NOT NULL DEFAULT 0,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS commissions (
  id INTEGER PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  service_id INTEGER NOT NULL REFERENCES services(id) ON DELETE CASCADE,
  markup_pct REAL NOT NULL DEFAULT 0,
  fixed_fee REAL NOT NULL DEFAULT 0,
  UNIQUE (account_id, service_id)
);

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY,
  type TEXT NOT NULL,
  no INTEGER NOT NULL,
  date TEXT NOT NULL,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  counter_account_id INTEGER REFERENCES accounts(id),
  currency TEXT NOT NULL,
  rate REAL NOT NULL DEFAULT 1,
  subtotal REAL NOT NULL DEFAULT 0,
  services_pct REAL NOT NULL DEFAULT 0,
  discount_pct REAL NOT NULL DEFAULT 0,
  amount REAL NOT NULL DEFAULT 0,
  attention TEXT,
  notes TEXT,
  bank_account_id INTEGER REFERENCES bank_accounts(id),
  show_fees INTEGER NOT NULL DEFAULT 0,
  reviewed INTEGER NOT NULL DEFAULT 0,
  reviewed_by INTEGER REFERENCES users(id),
  user_id INTEGER REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (type, no)
);

CREATE TABLE IF NOT EXISTS invoice_lines (
  id INTEGER PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  date TEXT,
  service_id INTEGER REFERENCES services(id),
  supplier_id INTEGER REFERENCES accounts(id),
  carrier_id INTEGER REFERENCES carriers(id),
  doc_no TEXT,
  pax_name TEXT,
  description TEXT,
  cost REAL NOT NULL DEFAULT 0,
  price REAL NOT NULL DEFAULT 0,
  fees REAL NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS entries (
  id INTEGER PRIMARY KEY,
  document_id INTEGER NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  date TEXT NOT NULL,
  debit REAL NOT NULL DEFAULT 0,
  credit REAL NOT NULL DEFAULT 0,
  memo TEXT
);

CREATE INDEX IF NOT EXISTS idx_entries_account ON entries(account_id, date);
CREATE INDEX IF NOT EXISTS idx_documents_date ON documents(date);
CREATE INDEX IF NOT EXISTS idx_lines_doc ON invoice_lines(document_id);
`;

/** Accounts the ledger posts to automatically. Keys are stored in settings. */
export const SYSTEM_ACCOUNTS = [
  { key: 'acc_cash', code: '101', name: 'الخزينة الرئيسية', type: 'cash' },
  { key: 'acc_revenue', code: '401', name: 'إيرادات الخدمات', type: 'revenue' },
  { key: 'acc_adjust', code: '402', name: 'التسويات (إشعارات مدين/دائن)', type: 'revenue' },
  { key: 'acc_opening', code: '301', name: 'الأرصدة الافتتاحية', type: 'equity' },
];

const DEFAULT_SETTINGS = {
  company_name: 'مكتب الرحالة للسياحة والسفر',
  company_phone: '',
  company_address: '',
  office_no: '0001',
  base_currency: 'LYD',
  theme: 'blue',
  invoice_footer: 'شكراً لتعاملكم معنا',
};

const SEED_CURRENCIES = [
  ['LYD', 'دينار ليبي', 1, 1],
  ['USD', 'دولار أمريكي', 4.85, 0],
  ['EUR', 'يورو', 5.25, 0],
  ['TND', 'دينار تونسي', 1.55, 0],
  ['EGP', 'جنيه مصري', 0.1, 0],
  ['TRY', 'ليرة تركية', 0.14, 0],
];

const SEED_SERVICES = ['تذاكر', 'حجز فنادق', 'تأشيرات', 'تأمين سفر', 'نقل', 'رحلات سياحية', 'عمرة وحج'];

export function openDb(file = ':memory:') {
  const db = new DatabaseSync(file);
  db.exec('PRAGMA foreign_keys = ON;');
  if (file !== ':memory:') db.exec('PRAGMA journal_mode = WAL;');
  db.exec(SCHEMA);
  seed(db);
  return db;
}

function seed(db) {
  const insSetting = db.prepare('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)');
  for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) insSetting.run(k, v);

  for (const acc of SYSTEM_ACCOUNTS) {
    const existing = db.prepare('SELECT value FROM settings WHERE key = ?').get(acc.key);
    if (existing) continue;
    const { lastInsertRowid } = db
      .prepare('INSERT INTO accounts (code, name, type, system) VALUES (?, ?, ?, 1)')
      .run(acc.code, acc.name, acc.type);
    insSetting.run(acc.key, String(lastInsertRowid));
  }

  if (!db.prepare('SELECT 1 FROM users LIMIT 1').get()) {
    db.prepare("INSERT INTO users (username, name, password_hash, role) VALUES ('admin', 'مدير النظام', ?, 'admin')")
      .run(hashPassword('admin'));
  }

  if (!db.prepare('SELECT 1 FROM currencies LIMIT 1').get()) {
    const ins = db.prepare('INSERT INTO currencies (code, name, rate, is_base) VALUES (?, ?, ?, ?)');
    for (const c of SEED_CURRENCIES) ins.run(...c);
  }

  if (!db.prepare('SELECT 1 FROM services LIMIT 1').get()) {
    const ins = db.prepare('INSERT INTO services (name) VALUES (?)');
    for (const s of SEED_SERVICES) ins.run(s);
  }
}

export function getSettings(db) {
  const rows = db.prepare('SELECT key, value FROM settings').all();
  return Object.fromEntries(rows.map((r) => [r.key, r.value]));
}

export function systemAccount(db, key) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? Number(row.value) : null;
}

/** Run fn inside a transaction, rolling back on any error. */
export function tx(db, fn) {
  db.exec('BEGIN');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (err) {
    db.exec('ROLLBACK');
    throw err;
  }
}
