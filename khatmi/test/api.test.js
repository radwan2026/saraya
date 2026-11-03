import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp } from '../src/app.js';
import { Store } from '../src/db.js';

delete process.env.ANTHROPIC_API_KEY;
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'khatmi-'));
const cfg = { secret: 'test-secret', adminPassword: 'admin-pw', smsWebhookSecret: 'sms-secret' };
const app = createApp(new Store(dir), cfg, { log: { warn() {}, error() {} } });
const server = app.listen(0);
const base = `http://127.0.0.1:${server.address().port}`;
test.after(() => server.close());

async function call(p, { body, token, method } = {}) {
  const res = await fetch(base + p, { method: method || (body ? 'POST' : 'GET'), headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const type = res.headers.get('content-type') || '';
  return { status: res.status, data: type.includes('json') ? await res.json() : await res.arrayBuffer() };
}

test('دورة كاملة: تسجيل ← شحن ← اعتماد ← شراء ← تنزيل ← تعديل مجاني', async () => {
  let r = await call('/api/auth/register', { body: { name: 'علي', phone: '+218 92 123 4567', password: 'secret1' } });
  assert.equal(r.status, 200);
  const token = r.data.token;
  assert.equal(r.data.user.phone, '0921234567');

  r = await call('/api/auth/register', { body: { name: 'x', phone: '0921234567', password: 'secret1' } });
  assert.equal(r.status, 409);
  r = await call('/api/auth/login', { body: { phone: '921234567', password: 'secret1' } });
  assert.equal(r.status, 200);

  const spec = { shape: 'circle', icon: 'star', texts: { top: 'ختمي', bottom: 'My seal' } };
  r = await call('/api/render', { token, body: { spec } });
  assert.equal(r.data.quote.total, 0.5 * 10 + 3);
  assert.match(r.data.svg, /id="watermark"/);

  // رصيد غير كافٍ
  r = await call('/api/orders', { token, body: { spec } });
  assert.equal(r.status, 402);

  // ليبيانا غير مفعّلة افتراضياً، والمدار برقم ختمي
  r = await call('/api/config');
  assert.equal(r.data.carriers.madar.number, '0911110588');
  assert.equal(r.data.carriers.libyana.enabled, false);
  r = await call('/api/topups', { token, body: { carrier: 'madar', senderPhone: '0921234567', amount: 20 } });
  assert.equal(r.status, 400, 'رقم ليبيانا لا يحوّل رصيد المدار');
  r = await call('/api/topups', { token, body: { carrier: 'madar', senderPhone: '0913334444', amount: 20 } });
  assert.equal(r.status, 200);
  const topupId = r.data.topup.id;

  // اعتماد عبر رسالة SMS
  r = await call('/api/webhooks/sms', { body: { secret: 'wrong', message: 'x' } });
  assert.equal(r.status, 401);
  r = await call('/api/webhooks/sms', { body: { secret: 'sms-secret', from: 'Almadar', message: 'تم استلام 20 د.ل من الرقم 0913334444' } });
  assert.equal(r.data.matched, topupId);
  r = await call('/api/wallet', { token });
  assert.equal(r.data.balance, 20);

  // شحن آخر يعتمده المشرف بمبلغ مختلف
  r = await call('/api/topups', { token, body: { carrier: 'madar', senderPhone: '0913334444', amount: 10 } });
  const t2 = r.data.topup.id;
  const admin = (await call('/api/admin/login', { body: { password: 'admin-pw' } })).data.token;
  assert.equal((await call('/api/admin/overview', { token })).status, 401);
  r = await call(`/api/admin/topups/${t2}/approve`, { token: admin, body: { received: 7 } });
  assert.equal(r.status, 200);
  assert.equal((await call('/api/wallet', { token })).data.balance, 27);

  // شراء
  r = await call('/api/orders', { token, body: { spec, expectedTotal: 8 } });
  assert.equal(r.status, 200);
  assert.equal(r.data.user.balance, 19);
  const orderId = r.data.order.id;

  r = await call(`/api/orders/${orderId}/download?format=svg`, { token });
  const svg = Buffer.from(r.data).toString();
  assert.match(svg, /<svg/);
  assert.doesNotMatch(svg, /watermark/);
  r = await call(`/api/orders/${orderId}/download?format=pdf`, { token });
  assert.equal(Buffer.from(r.data).subarray(0, 5).toString(), '%PDF-');

  // تعديل مجاني للشكل واللون، لكن تغيير النص يتطلب شراءً جديداً
  r = await call(`/api/orders/${orderId}`, { token, method: 'PUT', body: { spec: { ...spec, shape: 'oval', ink: '#c1121f' } } });
  assert.equal(r.status, 200);
  assert.equal(r.data.order.spec.shape, 'oval');
  r = await call(`/api/orders/${orderId}`, { token, method: 'PUT', body: { spec: { ...spec, texts: { top: 'نص آخر طويل جداً' } } } });
  assert.equal(r.status, 409);
  assert.equal((await call('/api/wallet', { token })).data.balance, 19);
});

test('اقتراح التصاميم يعمل بدون مفتاح ذكاء اصطناعي', async () => {
  const { data } = await call('/api/auth/register', { body: { name: 'سارة', phone: '0941112222', password: 'secret1' } });
  const r = await call('/api/design/suggest', { token: data.token, body: { inputs: { lang: 'both', nameAr: 'صيدلية الشفاء', nameEn: 'Al Shifa Pharmacy', tagline: 'أدوية ومستلزمات طبية' } } });
  assert.equal(r.status, 200);
  assert.equal(r.data.source, 'local');
  assert.equal(r.data.variants.length, 4);
  assert.ok(r.data.variants.every((v) => v.svg.includes('<svg') && v.quote.total > 0));
});
