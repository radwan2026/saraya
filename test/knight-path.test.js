// اختبارات «فارس الدرب»: بنك الأسئلة ومنطق المبارزة
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const sandbox = { Math, Object, Infinity, JSON };
sandbox.globalThis = sandbox;
for (const f of ['questions.js', 'engine.js']) {
  vm.runInNewContext(fs.readFileSync(new URL(`../steam-games/knight-path/${f}`, import.meta.url), 'utf8'), sandbox);
}
const QB = sandbox.KnightQuestions;
const K = sandbox.KnightEngine;
const Q = QB.QUESTIONS;

test('بنك الأسئلة سليم: خيارات غير مكررة وشرح لكل سؤال', () => {
  assert.ok(Q.length >= 110, `عدد الأسئلة ${Q.length}`);
  const seen = new Set();
  for (const q of Q) {
    assert.ok(q.q && q.e, `سؤال بلا نص أو شرح: ${q.q}`);
    assert.ok(['sci', 'din', 'his'].includes(q.cat), q.q);
    assert.ok([1, 2, 3].includes(q.d), q.q);
    assert.ok(q.stage >= -1 && q.stage <= 7, q.q);
    assert.equal(new Set(q.a).size, q.a.length, `خيارات مكررة: ${q.q}`);
    if (q.type === 'tf') assert.deepEqual([...q.a].sort(), ['خطأ', 'صح'].sort(), q.q);
    else assert.ok(q.a.length >= 4, `يحتاج 4 خيارات: ${q.q}`);
    const key = `${q.stage}|${q.q}`;
    assert.ok(!seen.has(key), `سؤال مكرر: ${q.q}`);
    seen.add(key);
  }
});

test('لكل محطة أسئلة كافية لكل الأعمار', () => {
  for (let st = 0; st < 8; st++) {
    for (let age = 0; age < 3; age++) {
      const used = {};
      const qs = K.pickQuestions(Q, st, age, 22, K.seeded(st * 10 + age), used);
      assert.equal(qs.length, 22);
      const keys = new Set(qs.map((q) => q.q));
      assert.equal(keys.size, 22, `تكرار في المحطة ${st} للعمر ${age}`);
      assert.ok(qs.slice(0, 6).every((q) => q.stage === st || q.stage === -1));
    }
  }
});

test('الأصغر سناً يحصلون على الأسئلة السهلة أولاً', () => {
  const qs = K.pickQuestions(Q, 0, 0, 4, K.seeded(3), {});
  assert.ok(qs.every((q) => q.d === 1));
  const teen = K.pickQuestions(Q, 0, 2, 4, K.seeded(3), {});
  assert.ok(teen.every((q) => q.d >= 2));
});

test('تحضير السؤال: إجابة صحيحة واحدة، وأسئلة الترتيب لا تبدأ مرتّبة', () => {
  const rng = K.seeded(5);
  for (const q of Q) {
    const p = K.prepare(q, rng);
    if (q.type === 'order') {
      assert.ok(!p.items.every((it, i) => it.i === i));
      const correct = p.items.map((_, i) => p.items.findIndex((it) => it.i === i));
      assert.ok(K.checkOrder(p, correct));
      assert.ok(!K.checkOrder(p, [...correct].reverse()));
    } else {
      assert.equal(p.options.filter((o) => o.ok).length, 1, q.q);
      assert.equal(p.options.find((o) => o.ok).t, q.a[0]);
    }
  }
});

test('المبارزة: الإجابة الصحيحة تضرب الخصم، والسريعة ضربة قاضية', () => {
  const d = K.createDuel({ hp: 100 }, { sword: 0, shield: 0 });
  const slow = K.answer(d, true, 0.1);
  assert.ok(slow.damage > 0 && !slow.crit);
  const fast = K.answer(d, true, 0.95);
  assert.ok(fast.crit && fast.damage > slow.damage);
  const before = d.playerHp;
  const wrong = K.answer(d, false, 0.5);
  assert.ok(wrong.hurt > 0);
  assert.equal(d.playerHp, before - wrong.hurt);
  assert.equal(d.streak, 0);
});

test('السيف والدرع يغيّران الضرر', () => {
  const a = K.createDuel({ hp: 999 }, { sword: 0, shield: 0 });
  const b = K.createDuel({ hp: 999 }, { sword: 3, shield: 3 });
  assert.ok(K.answer(b, true, 0.3).damage > K.answer(a, true, 0.3).damage);
  assert.ok(K.answer(b, false, 0).hurt < K.answer(a, false, 0).hurt);
});

test('اختبار الحكمة لا يؤذي الفارس', () => {
  const d = K.createDuel({ hp: 100, friendly: true });
  for (let i = 0; i < 10; i++) K.answer(d, false, 0);
  assert.equal(d.playerHp, 100);
  assert.equal(d.done, false);
});

test('أطوار الخصم الكبير وخدعه', () => {
  const d = K.createDuel({ hp: 100 });
  assert.equal(K.phaseOf(d), 0);
  let changed = false;
  while (!d.done) { const r = K.answer(d, true, 0); if (r.phaseChanged) changed = true; }
  assert.ok(changed && d.won);
  assert.deepEqual([...K.tricksFor('mirage', 0)], []);
  assert.deepEqual([...K.tricksFor('mirage', 1)], ['mirage']);
  assert.ok(K.tricksFor('final', 2).length >= 3);
  assert.deepEqual([...K.tricksFor('wisdom', 2)], []);
});

test('الخسارة عند نفاد الحياة', () => {
  const d = K.createDuel({ hp: 100 }, {}, { playerHp: 20 });
  K.answer(d, false, 0);
  assert.ok(d.done && !d.won);
});

test('المتجر والرتب والنجوم', () => {
  const s = K.newSave('سارة', 1);
  s.dates = 100;
  assert.ok(K.buyUpgrade(s, 'sword').ok);
  assert.equal(s.upgrades.sword, 1);
  assert.equal(s.dates, 70);
  s.dates = 0;
  assert.equal(K.buyUpgrade(s, 'sword').ok, false);
  assert.equal(K.rankOf(0).name, 'فتى الدرب');
  assert.equal(K.rankOf(1300).name, 'فارس النور');
  assert.equal(K.starsFor(9, 10), 3);
  assert.equal(K.starsFor(7, 10), 2);
  assert.equal(K.starsFor(3, 10), 1);
});

test('المحطات الثماني بالترتيب من دمشق إلى مكة', () => {
  assert.equal(K.STAGES.length, 8);
  assert.equal(K.STAGES[0].name, 'دمشق');
  assert.equal(K.STAGES[7].name, 'مكة المكرمة');
  assert.equal(QB.STATIONS_INFO.length, 8);
  for (const st of K.STAGES) assert.ok(st.boss && st.guardians.length >= 1);
});
