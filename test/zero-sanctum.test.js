import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

// puzzles.js سكربت متصفح عادي؛ نشغّله في سياق معزول ونقرأ ZS منه
const ctx = {};
vm.createContext(ctx);
vm.runInContext(readFileSync(new URL('../zero-sanctum/puzzles.js', import.meta.url), 'utf8'), ctx);
const ZS = ctx.ZS;
const plain = (v) => JSON.parse(JSON.stringify(v));

test('كل رمز يختلف عن صورته في المرآة', () => {
  assert.equal(ZS.GLYPH_IDS.length, 5);
  assert.equal(ZS.mirrorGlyph('kaf'), 'kaf~');
  assert.equal(ZS.mirrorGlyph('kaf~'), 'kaf');
});

test('الساعة: الترتيب حسب الظل وليس حسب الوقت المكتوب', () => {
  assert.deepEqual(plain(ZS.solveClockOrder()), ['A', 'B', 'C', 'D', 'E']);
  assert.deepEqual(plain(ZS.checkClockOrder(['A', 'B', 'C', 'D', 'E'])), { engaged: 5, solved: true });
  // الترتيب حسب الأوقات المكتوبة يجب أن يفشل
  const byShownTime = ZS.PHOTO_IDS.slice().sort((a, b) => ZS.PHOTOS[a].shownTime.localeCompare(ZS.PHOTOS[b].shownTime));
  assert.equal(ZS.checkClockOrder(byShownTime).solved, false);
  assert.deepEqual(plain(ZS.checkClockOrder(['A', 'B', 'D', 'C', 'E'])), { engaged: 2, solved: false });
  assert.equal(ZS.checkClockOrder(['A', 'B', 'C', 'D']).solved, false);
  assert.deepEqual(plain(ZS.clockSequence()), ['kaf', 'step', 'flag', 'moon', 'fork']);
});

test('مختبر الضوء: حل وحيد، ويستحيل دون البلورة، وحالة البداية غير محلولة', () => {
  assert.equal(ZS.laserSolutions(true).length, 1);
  assert.equal(ZS.laserSolutions(false).length, 0);
  assert.equal(ZS.traceLasers(ZS.initialMirrors(), true).solved, false);
  const sol = ZS.laserSolutions(true)[0];
  const r = ZS.traceLasers(sol, true);
  assert.equal(r.solved, true);
  assert.deepEqual(Object.values(r.receivers).map((x) => x.got[0]).sort(), ['gold', 'green', 'white']);
});

test('الأرشيف: البيان المزوّر يسبب تعارضًا، والخط الصادق بلا تعارض', () => {
  const good = ['photo', 'incident', 'maintenance', 'audio', 'memo'];
  assert.equal(ZS.timelineComplete(good), true);
  const forged = ['photo', 'statement', 'maintenance', 'audio', 'memo'];
  assert.ok(ZS.timelineConflicts(forged).length > 0);
  assert.equal(ZS.timelineComplete(forged), false);
  // البيان المزوّر لا يصلح في أي ترتيب كامل
  const perms = (a) => (a.length <= 1 ? [a] : a.flatMap((x, i) => perms([...a.slice(0, i), ...a.slice(i + 1)]).map((p) => [x, ...p])));
  const withForged = perms(['photo', 'statement', 'maintenance', 'audio', 'memo']);
  assert.equal(withForged.filter((p) => ZS.timelineComplete(p)).length, 0);
  const genuine = perms(good);
  assert.equal(genuine.filter((p) => ZS.timelineComplete(p)).length, 1);
  assert.ok(ZS.timelineConflicts(['incident', 'incident']).some((c) => c.type === 'duplicate'));
  assert.equal(ZS.archiveCode(), '27194');
  assert.equal(ZS.checkArchiveCode('27194'), true);
  assert.equal(ZS.checkArchiveCode('25194'), false);
  assert.deepEqual(plain(ZS.collapseOrder()), [5, 2, 1, 4, 3]);
});

test('القلب الميكانيكي: الأخطاء تغيّر الحالة ولا تمنع الحل', () => {
  const run = (actions, s = ZS.heartInitial()) => actions.reduce((st, a) => ZS.heartAction(st, a), s);
  // تشغيل القابض والمكابس مقفلة: انحشار، ثم التنفيس يعيد الآلة
  let s = run(['installGear', 'clutch']);
  assert.equal(s.jammed, true);
  assert.equal(run(['clutch'], s).last, 'stillJammed');
  s = run(['vent', 'pistons', 'clutch'], s);
  assert.equal(s.last, 'wrongWay');
  assert.equal(s.solved, false);
  assert.equal(run(['idler'], s).last, 'busy');
  s = run(['clutch', 'idler', 'clutch'], s);
  assert.equal(s.solved, true);
  // دون الترس لا يصل الدوران إلى القلب
  assert.equal(run(['pistons', 'idler', 'clutch']).last, 'noGear');
  // السلسلة الصحيحة: القلب مع عقارب الساعة
  const chain = ZS.heartChain({ gear: true, idler: true }).chain;
  assert.equal(chain[chain.length - 1].dir, 1);
});

test('الغرفة المعكوسة: المرآة يجب أن ترى تسلسل الساعة', () => {
  const answer = ZS.mirrorLockAnswer();
  assert.deepEqual(plain(answer), ['fork~', 'moon~', 'flag~', 'step~', 'kaf~']);
  assert.equal(ZS.checkMirrorLock(answer).solved, true);
  assert.equal(ZS.checkMirrorLock(ZS.clockSequence()).solved, false);
  assert.equal(ZS.checkMirrorLock(ZS.clockSequence().slice().reverse()).solved, false);
  answer.forEach((g) => assert.ok(ZS.MIRROR_DIAL_OPTIONS.includes(g)));
});

test('البوابة صفر: المقابس والقطاعات والهوية', () => {
  const placement = {};
  ZS.GATE_SOCKETS.forEach((_, i) => {
    const fits = Object.keys(ZS.CORES).filter((c) => ZS.socketAccepts(i, c));
    assert.equal(fits.length, 1, 'كل مقبس يقبل نواة واحدة');
    placement[i] = fits[0];
  });
  assert.equal(new Set(Object.values(placement)).size, 3);
  assert.equal(ZS.checkSigils([5, 2, 1, 4, 3]), true);
  assert.equal(ZS.checkSigils([1, 2, 3, 4, 5]), false);
  assert.equal(ZS.checkIdentity('self'), true);
  assert.equal(ZS.checkIdentity('nour'), false);
});
