import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb, systemAccount } from '../src/db.js';
import * as L from '../src/ledger.js';

function setup() {
  const db = openDb(':memory:');
  const client = L.createAccount(db, { name: 'خالد سالم', type: 'client' }, 1);
  const supplier = L.createAccount(db, { name: 'الخطوط الليبية', type: 'supplier' }, 1);
  const cash = systemAccount(db, 'acc_cash');
  const balance = (id) => L.accountStatement(db, id).closing;
  return { db, client, supplier, cash, balance };
}

function trialBalance(db) {
  const { d, c } = db.prepare('SELECT ROUND(SUM(debit),3) AS d, ROUND(SUM(credit),3) AS c FROM entries').get();
  return [d || 0, c || 0];
}

test('account codes are auto-numbered per type', () => {
  const { db } = setup();
  assert.equal(db.prepare('SELECT code FROM accounts WHERE name = ?').get('خالد سالم').code, '2001');
  const id = L.createAccount(db, { name: 'عميل ثاني', type: 'client' });
  assert.equal(db.prepare('SELECT code FROM accounts WHERE id = ?').get(id).code, '2002');
  assert.throws(() => L.createAccount(db, { name: 'مكرر', type: 'client', code: '2001' }), /مستخدم/);
});

test('invoice posts client debit, supplier credit and profit to revenue', () => {
  const { db, client, supplier, balance } = setup();
  const id = L.createDocument(db, {
    type: 'invoice',
    date: '2026-03-16',
    account_id: client,
    currency: 'LYD',
    services_pct: 10,
    discount_pct: 5,
    lines: [
      { service_id: 1, supplier_id: supplier, doc_no: '148-2400123654', pax_name: 'KHALED SALEM', description: 'TIP-AMM-TIP', cost: 480, price: 530 },
      { description: 'رسوم خدمة', price: 0, fees: 20 },
    ],
  }, 1);
  const doc = L.getDocument(db, id);
  assert.equal(doc.no, 1);
  assert.equal(doc.subtotal, 550);
  assert.equal(doc.amount, 577.5); // 550 + 55 - 27.5
  assert.equal(balance(client), 577.5);
  assert.equal(balance(supplier), -480);
  assert.equal(balance(systemAccount(db, 'acc_revenue')), -97.5);
  const [d, c] = trialBalance(db);
  assert.equal(d, c);
});

test('foreign currency documents are converted to base currency', () => {
  const { db, client, supplier, balance } = setup();
  L.createDocument(db, {
    type: 'invoice', account_id: client, currency: 'USD', rate: 5,
    lines: [{ supplier_id: supplier, cost: 100, price: 120 }],
  });
  assert.equal(balance(client), 600);
  assert.equal(balance(supplier), -500);
});

test('receipts, payments and notes settle balances', () => {
  const { db, client, supplier, cash, balance } = setup();
  L.createDocument(db, { type: 'invoice', account_id: client, lines: [{ supplier_id: supplier, cost: 400, price: 500 }] });
  L.createDocument(db, { type: 'receipt', account_id: client, counter_account_id: cash, amount: 300 });
  L.createDocument(db, { type: 'payment', account_id: supplier, counter_account_id: cash, amount: 400 });
  L.createDocument(db, { type: 'credit_note', account_id: client, amount: 50 });
  L.createDocument(db, { type: 'debit_note', account_id: client, amount: 10 });
  assert.equal(balance(client), 160);
  assert.equal(balance(supplier), 0);
  assert.equal(balance(cash), -100);
  const [d, c] = trialBalance(db);
  assert.equal(d, c);
});

test('validation rejects bad documents', () => {
  const { db, client, cash } = setup();
  assert.throws(() => L.createDocument(db, { type: 'invoice', account_id: client, lines: [] }), /بند/);
  assert.throws(() => L.createDocument(db, { type: 'invoice', account_id: client, lines: [{ cost: 10, price: 20 }] }), /المزود/);
  assert.throws(() => L.createDocument(db, { type: 'receipt', account_id: client, amount: 10 }), /الخزينة/);
  assert.throws(() => L.createDocument(db, { type: 'receipt', account_id: client, counter_account_id: client, amount: 10 }), /خزينة/);
  assert.throws(() => L.createDocument(db, { type: 'receipt', account_id: client, counter_account_id: cash, amount: 0 }), /قيمة/);
  assert.throws(() => L.createDocument(db, { type: 'payment', account_id: client, counter_account_id: cash, amount: 5, currency: 'XXX' }), /العملة/);
});

test('editing reposts entries and reviewed documents are locked', () => {
  const { db, client, cash, balance } = setup();
  const user = { id: 1, role: 'admin' };
  const id = L.createDocument(db, { type: 'receipt', account_id: client, counter_account_id: cash, amount: 100 }, 1);
  L.updateDocument(db, id, { account_id: client, counter_account_id: cash, amount: 250 }, user);
  assert.equal(balance(client), -250);
  L.setReviewed(db, id, true, user);
  assert.throws(() => L.updateDocument(db, id, { account_id: client, counter_account_id: cash, amount: 1 }, user), /مقفل/);
  assert.throws(() => L.setReviewed(db, id, false, { id: 2, role: 'user' }), /المدير/);
  L.setReviewed(db, id, false, user);
  L.deleteDocument(db, id, user);
  assert.equal(balance(client), 0);
});

test('opening balance and statement running balance', () => {
  const { db, cash } = setup();
  const acc = L.createAccount(db, { name: 'عميل قديم', type: 'client', opening_balance: 1000, opening_date: '2026-01-01' });
  L.createDocument(db, { type: 'receipt', date: '2026-02-01', account_id: acc, counter_account_id: cash, amount: 400 });
  L.createDocument(db, { type: 'debit_note', date: '2026-03-01', account_id: acc, amount: 50 });
  const st = L.accountStatement(db, acc, { from: '2026-02-01' });
  assert.equal(st.opening, 1000);
  assert.deepEqual(st.rows.map((r) => r.balance), [600, 650]);
  assert.equal(st.closing, 650);
  assert.throws(() => L.deleteAccount(db, acc), /حركات/);
});

test('pricing uses service policy, overridden by special commission', () => {
  const { db, client } = setup();
  db.prepare('UPDATE services SET markup_pct = 10, fixed_fee = 5 WHERE id = 1').run();
  assert.equal(L.suggestPrice(db, { account_id: client, service_id: 1, cost: 100 }), 115);
  db.prepare('INSERT INTO commissions (account_id, service_id, markup_pct) VALUES (?, 1, 2)').run(client);
  assert.equal(L.suggestPrice(db, { account_id: client, service_id: 1, cost: 100 }), 102);
});

test('sales report and search', () => {
  const { db, client, supplier } = setup();
  L.createDocument(db, { type: 'invoice', date: '2026-03-16', account_id: client, discount_pct: 10,
    lines: [{ service_id: 1, supplier_id: supplier, cost: 80, price: 100, pax_name: 'AHMED ALI', doc_no: '148-111' }] });
  const rep = L.salesReport(db, { from: '2026-03-01', to: '2026-03-31' });
  assert.equal(rep.totals.sales, 100);
  assert.equal(rep.totals.profit, 20);
  assert.equal(rep.adjustments, -10);
  assert.equal(rep.net_profit, 10);
  assert.equal(L.search(db, 'ahmed').lines.length, 1);
  assert.equal(L.search(db, '148-111').lines.length, 1);
});
