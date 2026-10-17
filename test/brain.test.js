import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  PUZZLES, DEFAULT_ORDER, publicPuzzle, solveDetective, simulateGears, machineWorksWith,
  laneConducts, solveIllusion, countAtoms, solveScience, solveFinal,
} from '../src/brain/puzzles.js';
import { BrainGame, Phase, parseAnswer, scoreFor } from '../src/brain/game.js';

// ------------------------------------------------------------------
// الألغاز: الإجابات محسوبة من بيانات الرسم، ونتأكد أنها تطابق المتوقع وأن الحل وحيد
// ------------------------------------------------------------------

test('الإجابات المعتمدة لكل لغز', () => {
  assert.deepEqual(
    Object.fromEntries(DEFAULT_ORDER.map((id) => [id, PUZZLES[id].answer])),
    { detective: '5281', machine: '2', circuit: '4', illusion: '3', science: '7463', final: '36' },
  );
});

test('المحقق: كل رمز في الورقة موجود مرة واحدة، والتمويه خارج الشفرة', () => {
  const v = PUZZLES.detective.visual;
  assert.equal(solveDetective(v), '5281');
  assert.equal(new Set(v.note).size, 4);
  for (const shape of v.note) assert.equal(v.symbols.filter((s) => s.shape === shape).length, 1);
  const decoy = v.symbols.filter((s) => !v.note.includes(s.shape));
  assert.ok(decoy.length >= 1, 'يوجد رمز تمويه واحد على الأقل');
  // الرموز داخل لوحة المشهد
  for (const s of v.symbols) assert.ok(s.x > 0 && s.x < 1000 && s.y > 0 && s.y < 900);
  // رمز مكرر يجعل اللغز غامضاً => يجب أن يرفضه الحل
  assert.throws(() => solveDetective({ ...v, symbols: [...v.symbols, { shape: 'star', digit: 4 }] }));
});

test('محاكاة التروس: الاتجاهات، القرص الأملس، والحلقة الفردية', () => {
  const g = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
  assert.deepEqual(simulateGears(g, [['a', 'b'], ['b', 'c']], 'a').dirs, { a: 1, b: -1, c: 1 });
  assert.equal(simulateGears(g, [['a', 'b'], ['b', 'c'], ['a', 'c']], 'a').jammed, true);
  const smooth = [{ id: 'a' }, { id: 'b', teeth: false }];
  assert.equal(simulateGears(smooth, [['a', 'b']], 'a').dirs.b, undefined);
});

test('الآلة: خيار واحد فقط يشغّلها، ولكل خيار خاطئ سبب مختلف', () => {
  const v = PUZZLES.machine.visual;
  const reasons = v.options.map((o) => machineWorksWith(v, o).reason);
  assert.deepEqual(reasons, ['reverse', 'ok', 'jam', 'idle']);
});

test('الآلة: التروس المتعشّقة متلامسة هندسياً (المسافة = مجموع نصفي القطرين)', () => {
  const v = PUZZLES.machine.visual;
  for (const o of v.options) {
    const all = new Map([...v.gears, ...o.gears].map((x) => [x.id, x]));
    for (const [a, b] of [...v.meshes, ...o.meshes]) {
      const A = all.get(a); const B = all.get(b);
      const d = Math.hypot(A.x - B.x, A.y - B.y);
      assert.ok(Math.abs(d - (A.r + B.r)) < 0.5, `${o.label}: ${a}-${b} المسافة ${d.toFixed(2)} ≠ ${A.r + B.r}`);
    }
  }
});

test('الدائرة: مسار واحد فقط يوصل التيار', () => {
  const lanes = PUZZLES.circuit.visual.lanes;
  assert.deepEqual(lanes.map(laneConducts), [false, false, false, true]);
  assert.equal(laneConducts({ parts: [{ type: 'diode', dir: 'reverse' }] }), false);
  // الخيارات متقاربة: كل المسارات فيها صمام ومفتاح
  for (const l of lanes) {
    assert.ok(l.parts.some((p) => p.type === 'diode'));
    assert.ok(l.parts.some((p) => p.type === 'switch'));
  }
});

test('الخداع البصري: خط واحد أطول فعلاً، وليست متساوية', () => {
  const v = PUZZLES.illusion.visual;
  assert.equal(solveIllusion(v), '3');
  assert.equal(solveIllusion({ lines: [{ length: 5 }, { length: 5 }, { length: 5 }] }), '4');
  // الخط الأطول هو صاحب الأطراف الداخلية (يبدو الأقصر) — هذا هو الفخ
  assert.equal(v.lines[2].fins, 'in');
  assert.equal(v.lines[0].fins, 'out');
});

test('الشفرة العلمية: كل مرحلة صحيحة علمياً', () => {
  assert.equal(countAtoms('H2O'), 3);
  assert.equal(countAtoms('CO2'), 3);
  assert.equal(countAtoms('CH4'), 5);
  const { values, code } = solveScience(PUZZLES.science.visual);
  assert.deepEqual(values, [3, 6, 4, 7]);
  assert.equal(code, '7463');
});

test('اللغز النهائي: المربعات الحمراء × عدد النجوم', () => {
  const v = PUZZLES.final.visual;
  assert.deepEqual(solveFinal(v), { sum: 12, stars: 3, answer: '36' });
  assert.equal(v.tiles.length, 9);
  assert.ok(v.showAt < v.hideAt && v.hideAt < PUZZLES.final.seconds);
});

test('النسخة العامة من اللغز لا تحتوي الإجابة ولا الحل', () => {
  for (const p of Object.values(PUZZLES)) {
    const pub = publicPuzzle(p);
    assert.equal(pub.answer, undefined);
    assert.equal(pub.steps, undefined);
    if (p.type === 'choice') assert.equal(pub.optionCount, 4);
  }
});

// ------------------------------------------------------------------
// قراءة الإجابات من التعليقات
// ------------------------------------------------------------------

test('parseAnswer يقبل صيغ الإجابة الشائعة', () => {
  const choice = publicPuzzle(PUZZLES.machine);
  assert.equal(parseAnswer('2', choice), '2');
  assert.equal(parseAnswer('٢', choice), '2');
  assert.equal(parseAnswer('ب', choice), '2');
  assert.equal(parseAnswer('B', choice), '2');
  assert.equal(parseAnswer('#4', choice), '4');
  assert.equal(parseAnswer('5', choice), null);
  assert.equal(parseAnswer('الجواب 2', choice), null);

  const code = publicPuzzle(PUZZLES.detective);
  assert.equal(parseAnswer('5281', code), '5281');
  assert.equal(parseAnswer('٥٢٨١', code), '5281');
  assert.equal(parseAnswer('5 2 8 1', code), '5281');
  assert.equal(parseAnswer('5-2-8-1', code), '5281');
  assert.equal(parseAnswer('528', code), null);
  assert.equal(parseAnswer('رمز 5281', code), null);

  const num = publicPuzzle(PUZZLES.final);
  assert.equal(parseAnswer('36', num), '36');
  assert.equal(parseAnswer('٣٦', num), '36');
  assert.equal(parseAnswer('036', num), '36');
  assert.equal(parseAnswer('ستة وثلاثين', num), null);
});

test('scoreFor: الأسرع يحصل على نقاط أكثر، والجولة النهائية مضاعفة', () => {
  const scoring = { base: 100, speedBonus: 100, firstBonus: [50, 30, 20] };
  assert.equal(scoreFor({ elapsedMs: 0, totalMs: 10000, rank: 0 }, scoring), 250);
  assert.equal(scoreFor({ elapsedMs: 5000, totalMs: 10000, rank: 1 }, scoring), 180);
  assert.equal(scoreFor({ elapsedMs: 10000, totalMs: 10000, rank: 5 }, scoring), 100);
  assert.equal(scoreFor({ elapsedMs: 5000, totalMs: 10000, rank: 3, multiplier: 2 }, scoring), 300);
});

// ------------------------------------------------------------------
// تدفّق البرنامج
// ------------------------------------------------------------------

const opts = {
  rounds: ['machine', 'final'], minPlayers: 1, maxPlayers: 0, allowLateJoin: true, autoStart: false,
  lobbySeconds: 1000, introSeconds: 1000, revealSeconds: 1000, leaderboardSeconds: 1000, finaleSeconds: 1000,
  timeScale: 1, scoring: { base: 100, speedBonus: 100, firstBonus: [50, 30, 20] },
};

test('دورة برنامج كاملة: تسجيل، إجابات، نقاط، فائز', () => {
  let t = 1_000_000;
  const game = new BrainGame(opts, { now: () => t });
  const u = (id) => ({ id, uniqueId: id, nickname: id });

  assert.equal(game.handleComment(u('a'), 'جاهز'), 'joined');
  assert.equal(game.handleComment(u('b'), 'مرحبا'), 'joined');
  assert.equal(game.handleComment(u('a'), 'مرة ثانية'), 'ignored');

  assert.ok(game.start());
  assert.equal(game.phase, Phase.INTRO);
  assert.equal(game.handleComment(u('a'), '2'), 'closed'); // لا إجابات أثناء بطاقة العنوان

  game.skip();
  assert.equal(game.phase, Phase.QUESTION);
  assert.equal(game.snapshot().puzzle.answer, undefined);
  t += 3000;
  assert.equal(game.handleComment(u('b'), '1'), 'answered'); // خطأ
  assert.equal(game.handleComment(u('b'), '2'), 'locked');   // الإجابة الأولى نهائية
  t += 2000;
  assert.equal(game.handleComment(u('a'), 'ب'), 'answered'); // صحيح
  assert.equal(game.handleComment(u('c'), 'كلام'), 'ignored');
  assert.equal(game.handleComment(u('c'), '2'), 'answered'); // دخل متأخراً بإجابة صحيحة

  game.skip();
  assert.equal(game.phase, Phase.REVEAL);
  const r = game.snapshot().reveal;
  assert.equal(r.answer, '2');
  assert.equal(r.correctCount, 2);
  assert.equal(r.totalAnswers, 3);
  assert.deepEqual(r.distribution, { 1: 1, 2: 2 });
  assert.equal(r.fastest[0].id, 'a');
  const a = game.players.get('a'); const c = game.players.get('c');
  assert.ok(a.score > c.score, 'الأول يحصل على مكافأة أعلى');
  assert.equal(game.players.get('b').score, 0);

  game.skip();
  assert.equal(game.phase, Phase.LEADERBOARD);
  assert.equal(game.snapshot().leaderboard[0].id, 'a');

  game.skip(); // -> الجولة النهائية
  assert.equal(game.phase, Phase.INTRO);
  assert.equal(game.puzzle.id, 'final');
  game.skip();
  t += 1000;
  game.handleComment(u('b'), '36');
  game.skip(); // -> كشف
  assert.equal(game.players.get('b').lastGain > 0, true);
  game.skip(); // آخر جولة => إعلان الفائز مباشرة
  assert.equal(game.phase, Phase.FINALE);
  const podium = game.snapshot().podium;
  assert.equal(podium.length, 3);
  assert.equal(podium[0].id, 'b', 'النقاط المضاعفة في النهائي تقلب الترتيب');
  assert.equal(game.history[0].id, 'b');

  game.skip();
  assert.equal(game.phase, Phase.LOBBY);
  assert.equal(game.players.size, 0);
  game.destroy();
});

test('يمكن بدء البرنامج بدون متسابقين، ولا فائز إذا لم يُجب أحد', () => {
  const game = new BrainGame({ ...opts, rounds: ['circuit'] });
  assert.ok(game.start());
  game.skip(); game.skip(); game.skip();
  assert.equal(game.phase, Phase.FINALE);
  assert.deepEqual(game.snapshot().podium, []);
  game.destroy();
});

test('العد التنازلي في الاستوديو يبدأ عند اكتمال الحد الأدنى', () => {
  const game = new BrainGame({ ...opts, autoStart: true, minPlayers: 2 });
  game.handleComment({ id: 'a' }, 'هلا');
  assert.equal(game.phaseEndsAt, null);
  game.handleComment({ id: 'b' }, 'هلا');
  assert.ok(game.phaseEndsAt > Date.now());
  game.destroy();
});
