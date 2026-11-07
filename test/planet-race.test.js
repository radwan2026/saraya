// اختبارات فيزياء «سباق الكواكب» (steam-games/planet-race/physics.js)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const code = fs.readFileSync(new URL('../steam-games/planet-race/physics.js', import.meta.url), 'utf8');
const sandbox = { Math, Object, Infinity };
sandbox.globalThis = sandbox;
vm.runInNewContext(code, sandbox);
const P = sandbox.PlanetPhysics;

test('قانون كبلر: الكوكب الأبعد يدور أبطأ', () => {
  const [mars, jupiter, saturn] = P.PLANETS;
  assert.ok(P.angularSpeed(mars.orbit) > P.angularSpeed(jupiter.orbit));
  assert.ok(P.angularSpeed(jupiter.orbit) > P.angularSpeed(saturn.orbit));
});

test('حدود التصويب', () => {
  assert.equal(P.clampAngle(-30), P.WORLD.minAngle);
  assert.equal(P.clampAngle(200), P.WORLD.maxAngle);
  assert.equal(P.clampAngle(77), 77);
});

/** يطير صاروخاً حتى النهاية مع كوكب في موقع معيّن */
function fly(angle, power, planet, theta0) {
  const r = P.createRocket(angle, power);
  const target = { ...planet, theta0, launchTime: 0 };
  for (let i = 0; i < 2000 && !r.done; i++) P.stepRocket(r, 1 / 60, target);
  return r;
}

test('الصاروخ المتجه نحو الشمس يحترق', () => {
  const r = fly(90, 1, P.PLANETS[0], Math.PI); // الكوكب في الجهة الأخرى
  assert.equal(r.outcome, 'burned');
  assert.equal(P.pointsFor(r.outcome), 0);
});

test('الإطلاق نحو «حيث سيكون» الكوكب يؤدي إلى الهبوط — لكل الكواكب والقوى', () => {
  for (const planet of P.PLANETS) {
    for (const power of P.POWERS) {
      for (const angle of [25, 55, 125, 155]) {
        // نفس حساب «شبح» الكوكب في المستوى السهل
        const tOrb = P.timeToOrbit(angle, power, planet.orbit);
        assert.ok(tOrb, `${planet.id} ${angle}° يجب أن يصل إلى المدار`);
        const path = P.predictPath(angle, power, tOrb);
        const end = path[path.length - 1];
        const theta0 = Math.atan2(end[1], end[0]) - P.angularSpeed(planet.orbit) * tOrb;
        const r = fly(angle, power, planet, theta0);
        assert.equal(r.outcome, 'landed', `${planet.id} power ${power} angle ${angle}`);
        assert.equal(P.pointsFor(r.outcome), 3);
      }
    }
  }
});

test('الإطلاق في توقيت خاطئ لا يهبط، والنصيحة تقول هل كان مبكراً أم متأخراً', () => {
  const planet = P.planetById('jupiter');
  const angle = 40; const power = 1.05;
  const tOrb = P.timeToOrbit(angle, power, planet.orbit);
  const path = P.predictPath(angle, power, tOrb);
  const end = path[path.length - 1];
  const meet = Math.atan2(end[1], end[0]) - P.angularSpeed(planet.orbit) * tOrb;

  const early = fly(angle, power, planet, meet - 0.9); // الكوكب متأخر عن نقطة الالتقاء
  assert.notEqual(early.outcome, 'landed');
  assert.match(P.adviceFor(early, planet.name), /قبل/);

  const late = fly(angle, power, planet, meet + 0.9); // الكوكب سبق نقطة الالتقاء
  assert.notEqual(late.outcome, 'landed');
  assert.match(P.adviceFor(late, planet.name), /بعد مرور/);
});

test('النجوم حسب رقم المحاولة', () => {
  assert.deepEqual([1, 2, 3, 4].map(P.starsFor), [3, 2, 1, 0]);
});

test('المراحل تشير إلى كواكب موجودة والمساعدة تقلّ تدريجياً', () => {
  assert.equal(P.LEVELS.length, 6);
  for (const lv of P.LEVELS) assert.ok(P.planetById(lv.planet));
  assert.equal(P.LEVELS[0].guide, 1);
  assert.equal(P.LEVELS[P.LEVELS.length - 1].guide, 0);
});
