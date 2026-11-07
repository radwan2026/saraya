import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PLANETS, WORLD, angularSpeed, laneAngle, simulateLane, planRound, planetPos,
} from '../src/planets-physics.js';
import { PlanetsGame, PlanetsPhase, pickLeader } from '../src/planets.js';

const opts = {
  minNumber: 1, maxNumber: 10, targetScore: 9, maxRounds: 10, landingPoints: 3, flybyPoints: 1,
  minPlayers: 2, maxPlayers: 200, allowLateJoin: true, lobbySeconds: 25, chooseSeconds: 12,
  resultSeconds: 7, winnerSeconds: 12, gameOverSeconds: 8, autoStart: false,
};
const user = (id) => ({ id, uniqueId: id, nickname: id });
const seq = (...values) => { let i = 0; return () => values[i++ % values.length]; };

test('قانون كبلر: الكوكب الأبعد يدور أبطأ', () => {
  const [mars, jupiter, saturn] = PLANETS;
  assert.ok(angularSpeed(mars.orbit) > angularSpeed(jupiter.orbit));
  assert.ok(angularSpeed(jupiter.orbit) > angularSpeed(saturn.orbit));
});

test('المسارات مرتبة من اليمين (1) إلى اليسار (10)', () => {
  assert.ok(Math.abs(laneAngle(1) - (WORLD.laneFrom * Math.PI) / 180) < 1e-9);
  assert.ok(Math.abs(laneAngle(10) - (WORLD.laneTo * Math.PI) / 180) < 1e-9);
  assert.ok(laneAngle(3) < laneAngle(4));
});

test('المسار المتجه نحو الشمس يحترق، والمسار الجانبي يعبر مدار الهدف', () => {
  const sunward = simulateLane(Math.PI / 2, 330);
  assert.equal(sunward.end, 'sun');
  const side = simulateLane(laneAngle(1), 330);
  assert.notEqual(side.end, 'sun');
  assert.ok(side.crossing);
});

test('planRound: الكوكب يلتقي بصاروخ نافذة الإطلاق تماماً', () => {
  for (const planet of PLANETS) {
    for (const r of [0, 0.3, 0.6, 0.99]) {
      const plan = planRound(planet, { random: () => r });
      assert.equal(plan.results[plan.window].outcome, 'landed', `${planet.id} window ${plan.window}`);
      assert.equal(plan.results[plan.window].points, 3);
      // المسار الرابح ينتهي عند الكوكب
      const path = plan.paths[plan.window];
      const [t, x, y] = path[path.length - 1];
      const [px, py] = planetPos(plan.target, t);
      assert.ok(Math.hypot(x - px, y - py) <= planet.radius + 16);
    }
  }
});

test('planRound: المسارات المتجهة للشمس تحترق دائماً ولا تكسب نقاطاً', () => {
  const plan = planRound(PLANETS[0], { random: () => 0.5 });
  const burned = Object.values(plan.results).filter((r) => r.outcome === 'burned');
  assert.ok(burned.length >= 1);
  for (const r of burned) assert.equal(r.points, 0);
});

test('pickLeader: الأعلى نقاطاً ثم الأسبق انضماماً', () => {
  const w = pickLeader([{ id: 'a', score: 6, order: 2 }, { id: 'b', score: 6, order: 1 }, { id: 'c', score: 3, order: 0 }]);
  assert.equal(w.id, 'b');
});

test('الانضمام وتغيير المسار', () => {
  const g = new PlanetsGame(opts);
  assert.equal(g.handleComment(user('a'), '٤'), 'joined');
  assert.equal(g.handleComment(user('a'), '7'), 'changed');
  assert.equal(g.handleComment(user('a'), 'مرحبا'), 'ignored');
  assert.equal(g.handleComment(user('b'), '11'), 'ignored');
  assert.equal(g.players.get('a').number, 7);
  g.destroy();
});

test('الجولة كاملة: التصويب ← الإطلاق ← النتيجة، ونافذة الإطلاق مخفية قبل الرحلة', () => {
  const g = new PlanetsGame(opts, { random: seq(0, 0.5) });
  g.handleComment(user('a'), '1');
  g.handleComment(user('b'), '5');
  assert.ok(g.start());
  assert.equal(g.phase, PlanetsPhase.CHOOSING);
  const snap = g.snapshot();
  assert.equal(snap.flight, null);
  assert.equal(snap.launchWindow, null);
  assert.ok(snap.planet && snap.target);

  // اللاعب a يصوّب على النافذة الصحيحة
  const w = g.plan.window;
  g.handleComment(user('a'), String(w));
  g.handleComment(user('c'), String(w === 5 ? 6 : 5)); // انضمام متأخر مسموح
  assert.equal(g.players.size, 3);

  g.skip(); // إطلاق
  assert.equal(g.phase, PlanetsPhase.FLIGHT);
  assert.ok(g.snapshot().flight);
  assert.equal(g.snapshot().launchWindow, null);
  assert.equal(g.handleComment(user('b'), '3'), 'ignored'); // لا تغيير أثناء الطيران

  g.skip(); // النتيجة
  assert.equal(g.phase, PlanetsPhase.RESULT);
  assert.equal(g.snapshot().launchWindow, w);
  assert.equal(g.players.get('a').score, 3);
  assert.equal(g.players.get('a').lastOutcome, 'landed');
  assert.ok(g.lastResult.landed.includes('a'));
  g.destroy();
});

test('الفوز عند بلوغ النقاط المطلوبة', () => {
  const g = new PlanetsGame({ ...opts, targetScore: 3 }, { random: seq(0.2, 0.7) });
  g.handleComment(user('a'), '1');
  g.handleComment(user('b'), '2');
  g.start();
  g.handleComment(user('a'), String(g.plan.window));
  g.skip(); g.skip();
  assert.equal(g.winner.id, 'a');
  g.skip();
  assert.equal(g.phase, PlanetsPhase.WINNER);
  assert.equal(g.history[0].id, 'a');
  g.destroy();
});

test('انتهاء الجولات بدون نقاط = لا فائز', () => {
  const g = new PlanetsGame({ ...opts, maxRounds: 1 }, { random: seq(0.1, 0.9) });
  g.handleComment(user('a'), '1');
  g.start();
  // اختر مساراً يحترق في الشمس
  const burned = Object.entries(g.plan.results).find(([, r]) => r.outcome === 'burned')[0];
  g.handleComment(user('a'), burned);
  g.skip(); g.skip();
  assert.equal(g.winner, null);
  g.skip();
  assert.equal(g.phase, PlanetsPhase.GAMEOVER);
  g.destroy();
});

test('الكوكب لا يتكرر في جولتين متتاليتين', () => {
  const g = new PlanetsGame({ ...opts, targetScore: 99 }, { random: seq(0, 0.4, 0.8) });
  g.handleComment(user('a'), '1');
  g.start();
  let last = g.planet.id;
  for (let i = 0; i < 6; i++) {
    g.skip(); g.skip(); g.skip();
    assert.notEqual(g.planet.id, last);
    last = g.planet.id;
  }
  g.destroy();
});
