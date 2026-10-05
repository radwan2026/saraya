import test from 'node:test';
import assert from 'node:assert/strict';
import { openDb } from '../src/db.js';
import { createApp } from '../src/app.js';

async function start() {
  const server = createApp(openDb(':memory:')).listen(0);
  await new Promise((r) => server.once('listening', r));
  const base = `http://127.0.0.1:${server.address().port}/api`;
  let token = '';
  const call = async (method, url, body) => {
    const res = await fetch(base + url, {
      method,
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { status: res.status, body: await res.json() };
  };
  const login = async (u, p) => {
    const r = await call('POST', '/login', { username: u, password: p });
    token = r.body.token || '';
    return r;
  };
  return { server, call, login };
}

test('API end to end', async () => {
  const { server, call, login } = await start();
  try {
    assert.equal((await call('GET', '/accounts')).status, 401);
    assert.equal((await login('admin', 'wrong')).status, 401);
    assert.equal((await login('admin', 'admin')).status, 200);

    const { body: { id: client } } = await call('POST', '/accounts', { name: 'خالد سالم', type: 'client', phone: '0910000000' });
    const { body: { id: supplier } } = await call('POST', '/accounts', { name: 'مزود تذاكر', type: 'supplier' });
    const cash = (await call('GET', '/accounts?type=cash')).body[0].id;

    const inv = await call('POST', '/documents', {
      type: 'invoice', account_id: client, currency: 'LYD',
      lines: [{ service_id: 1, supplier_id: supplier, pax_name: 'KHALED', doc_no: '148-2400123654', cost: 500, price: 530 }],
    });
    assert.equal(inv.status, 200);
    assert.equal((await call('POST', '/documents', { type: 'receipt', account_id: client, counter_account_id: cash, amount: 530 })).status, 200);

    const st = await call('GET', `/reports/statement?account_id=${client}`);
    assert.equal(st.body.closing, 0);
    assert.equal(st.body.rows.length, 2);

    const dash = await call('GET', '/reports/dashboard');
    assert.equal(dash.body.payables, 500);

    // lookups
    const bank = await call('POST', '/lookups/bank_accounts', { acc_title: 'Main', bank_name: 'Jumhouria Bank', iban: 'LY00' });
    assert.equal(bank.status, 200);
    assert.equal((await call('POST', '/lookups/services', { name: 'تذاكر' })).status, 400); // duplicate
    assert.equal((await call('GET', '/lookups/nope')).status, 404);

    // operators: non-admin cannot manage users
    assert.equal((await call('POST', '/users', { username: 'ali', name: 'علي', password: '1234' })).status, 200);
    await login('ali', '1234');
    assert.equal((await call('GET', '/users')).status, 403);
    const del = await call('DELETE', `/documents/${inv.body.id}`);
    assert.equal(del.status, 403);
    assert.equal((await call('POST', '/change-password', { old_password: '1234', new_password: 'abcd' })).status, 200);
    assert.equal((await login('ali', 'abcd')).status, 200);

    const found = await call('GET', '/search?q=2400123654');
    assert.equal(found.body.lines.length, 1);
  } finally {
    server.close();
  }
});
