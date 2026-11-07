// اختبارات محاكاة «غابة الحياة» (steam-games/forest-of-life/ecosystem.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('../steam-games/forest-of-life/ecosystem.js', import.meta.url), 'utf8');
const sandbox = { Math, Object, Infinity };
sandbox.globalThis = sandbox;
vm.runInNewContext(code, sandbox);
const E = sandbox.Ecosystem;

function run(s, seconds) { for (let t = 0; t < seconds; t += 0.5) E.step(s, 0.5); }

test('النهار والليل: يوجد ضوء نهاراً ولا يوجد ليلاً', () => {
  const s = E.createWorld({ rng: E.seeded(1) });
  assert.ok(E.light(s) > 0);
  s.time = E.WORLD.dayLength * (E.WORLD.dayPart - 0.12 + 0.1);
  assert.equal(E.light(s), 0);
  assert.ok(E.isNight(s));
});

test('النبات لا ينمو في تربة جافة، وينمو بالمطر', () => {
  const dry = E.createWorld({ rng: E.seeded(2), moisture: 0 });
  const p1 = E.addPlant(dry, 'grass', 300, 0.1);
  run(dry, 10);
  assert.ok(p1.growth <= 0.1 + 1e-9, 'لا نمو بلا ماء');

  const wet = E.createWorld({ rng: E.seeded(2), moisture: 0, energy: 50 });
  const p2 = E.addPlant(wet, 'grass', 300, 0.1);
  assert.ok(E.place(wet, 'rain', 300).ok);
  run(wet, 12);
  assert.ok(p2.growth > 0.4, `نما العشب بعد المطر (${p2.growth.toFixed(2)})`);
});

test('العطش يذبل النبات حتى يموت ويزيد خصوبة التربة', () => {
  const s = E.createWorld({ rng: E.seeded(3), moisture: 0 });
  E.addPlant(s, 'grass', 500, 0.8);
  run(s, 60);
  assert.equal(s.plants.length, 0);
  assert.ok(s.events.some((e) => e.type === 'wilt'));
});

test('الطاقة: لا يمكن الوضع بلا طاقة كافية، والتكلفة تُخصم', () => {
  const s = E.createWorld({ rng: E.seeded(4), energy: 5 });
  assert.equal(E.place(s, 'fox', 400).ok, false);
  assert.ok(E.place(s, 'grass', 400).ok);
  assert.equal(s.energy, 5 - E.TOOLS.grass.cost);
});

test('الأشجار تحتاج مسافة بينها', () => {
  const s = E.createWorld({ rng: E.seeded(5), energy: 100 });
  assert.ok(E.place(s, 'tree', 400).ok);
  assert.equal(E.place(s, 'tree', 450).ok, false);
  assert.ok(E.place(s, 'tree', 700).ok);
});

test('الأرنب يأكل العشب، والثعلب الجائع يصطاد الأرنب', () => {
  const s = E.createWorld({ rng: E.seeded(6), moisture: 0.6 });
  E.addPlant(s, 'grass', 300, 1);
  const r = E.addAnimal(s, 'rabbit', 340, null, true);
  r.energy = 0.4;
  run(s, 6);
  assert.ok(s.events.some((e) => e.type === 'ate' && e.species === 'rabbit'));

  const f = E.addAnimal(s, 'fox', 600, null, true);
  f.energy = 0.3;
  run(s, 10);
  assert.ok(s.events.some((e) => e.type === 'ate' && e.species === 'fox'));
  assert.equal(E.counts(s).rabbit, 0);
});

test('اليرقة تصبح شرنقة ثم فراشة (التحوّل الكامل)', () => {
  const s = E.createWorld({ rng: E.seeded(7), moisture: 0.6 });
  for (let i = 0; i < 6; i++) E.addPlant(s, 'grass', 250 + i * 20, 1);
  const c = E.addAnimal(s, 'caterpillar', 300, null, false);
  c.energy = 0.9;
  run(s, 40);
  const types = s.events.map((e) => e.type);
  assert.ok(types.includes('cocoon'));
  assert.ok(types.includes('metamorph'));
  assert.ok(E.counts(s).butterfly >= 1);
});

test('النحلة تلقّح الزهرة فتنتشر أزهار جديدة', () => {
  const s = E.createWorld({ rng: E.seeded(8), moisture: 0.7 });
  for (let i = 0; i < 5; i++) E.addPlant(s, 'flower', 300 + i * 100, 1);
  E.addAnimal(s, 'bee', 500, 300, true).energy = 0.6;
  run(s, 45);
  assert.ok(s.events.some((e) => e.type === 'pollinate'));
  assert.ok(E.counts(s).flowerAll > 5, 'ظهرت أزهار جديدة من البذور');
});

test('الطائر بلا شجرة يطير بعيداً', () => {
  const s = E.createWorld({ rng: E.seeded(9) });
  E.addAnimal(s, 'bird', 500, 300, true);
  run(s, 16);
  assert.ok(s.events.some((e) => e.type === 'homeless'));
  assert.equal(E.counts(s).bird, 0);
});

test('موت الحيوان يُظهر فطراً (محلِّل)', () => {
  const s = E.createWorld({ rng: E.seeded(10) });
  const r = E.addAnimal(s, 'rabbit', 500, null, true);
  r.energy = 0.01;
  run(s, 2);
  assert.equal(s.mushrooms.length, 1);
  assert.ok(s.events.some((e) => e.type === 'decompose'));
});

test('ميزان الحياة يكتشف الجفاف وكثرة الآكلات', () => {
  const s = E.createWorld({ rng: E.seeded(11), moisture: 0.5 });
  assert.equal(E.balance(s).status, 'empty');
  E.addPlant(s, 'grass', 300, 1);
  for (let i = 0; i < 4; i++) E.addAnimal(s, 'rabbit', 300 + i * 30, null, true);
  assert.equal(E.balance(s).status, 'danger');
});

test('كل المهمات قابلة للإنجاز بلاعب يتصرّف بحكمة', () => {
  const plans = [
    (s, t) => { if (t % 3 === 0) E.place(s, 'grass', 100 + ((t * 137) % 1200)); },
    (s, t) => { if (t % 4 === 0) E.place(s, 'grass', 100 + ((t * 137) % 1200)); if ([40, 41, 60].includes(t)) E.place(s, 'rabbit', 600); },
    (s, t) => { if (t % 4 === 0) E.place(s, 'flower', 100 + ((t * 137) % 1200)); if (t % 9 === 0) E.place(s, 'grass', 100 + ((t * 91) % 1200)); if (t === 30 || t === 50) E.place(s, 'bee', 600); if (t === 35) E.place(s, 'caterpillar', 500); },
    (s, t) => { if (t === 2) E.place(s, 'tree', 300); if (t === 20) E.place(s, 'tree', 700); if (t === 40) E.place(s, 'tree', 1100); if (t % 9 === 0) E.place(s, 'grass', 100 + ((t * 91) % 1200)); if ([70, 72, 100].includes(t)) E.place(s, 'bird', 600); },
    (s, t) => { if (t % 3 === 0) E.place(s, 'grass', 100 + ((t * 137) % 1200)); if ([40, 42, 44].includes(t)) E.place(s, 'rabbit', 500); if (t === 90) E.place(s, 'fox', 900); },
  ];
  E.LEVELS.forEach((lv, i) => {
    const s = E.createWorld({ rng: E.seeded(7), energy: lv.energy });
    let done = false;
    for (let t = 0; t < 320 && !done; t += 0.5) {
      // مطر فوق أجفّ مكان فيه نبات
      if (t % 2 === 0) {
        let worst = -1; let wm = 1;
        s.cells.forEach((c, k) => { if (s.plants.some((p) => p.cell === k) && c.moisture < wm) { wm = c.moisture; worst = k; } });
        if (worst >= 0 && wm < 0.2) E.place(s, 'rain', worst * 50 + 25);
      }
      plans[i](s, t);
      for (const o of s.orbs.slice()) if (o.t > 1) E.collectOrb(s, o.id);
      E.step(s, 0.5);
      done = E.goalProgress(s, lv).done;
    }
    assert.ok(done, `المهمة ${i + 1} «${lv.title}» يجب أن تُنجز`);
  });
});
