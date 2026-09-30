import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ReactorGame, Phase, parseTeam, classifyGift } from '../src/reactor/game.js';
import config from '../reactor.config.js';

function setup(over = {}) {
  let t = 1_000_000;
  const clock = { now: () => t, advance: (ms) => { t += ms; } };
  const game = new ReactorGame({ ...config.game, ...over }, { now: clock.now });
  game.lastTick = t;
  const battle = () => {
    if (game.phase === Phase.WAITING) game.skip(); // بدء إجباري كما في لوحة التحكم
    clock.advance(config.game.countdownSeconds * 1000 + 1); game.tick();
    assert.equal(game.phase, Phase.BATTLE);
  };
  const u = (id) => ({ id, uniqueId: id, nickname: id });
  return { game, clock, battle, u };
}

test('parseTeam يقرأ 1 / 2 والأرقام العربية وأسماء الألوان', () => {
  assert.equal(parseTeam('1'), 'blue');
  assert.equal(parseTeam(' ٢ '), 'red');
  assert.equal(parseTeam('#1'), 'blue');
  assert.equal(parseTeam('أحمر'), 'red');
  assert.equal(parseTeam('Blue'), 'blue');
  assert.equal(parseTeam('12'), null);
  assert.equal(parseTeam('3'), null);
  assert.equal(parseTeam('انا مع 1'), 'blue');
  assert.equal(parseTeam('1❤️'), 'blue');
  assert.equal(parseTeam('1️⃣'), 'blue');
  assert.equal(parseTeam('2 احمر 🔥'), 'red');
  assert.equal(parseTeam('يلا الأزرق'), 'blue');
  assert.equal(parseTeam('اتنين'), 'red');
  assert.equal(parseTeam('اكتب 1 للأزرق و2 للأحمر'), null); // الفريقان معاً
  assert.equal(parseTeam('مرحبا كيف حالكم'), null);
  assert.equal(parseTeam('هذه جملة طويلة جداً فيها رقم 1 وكلام كثير آخر'), null);
  assert.equal(parseTeam(undefined), null);
});

test('classifyGift: الاسم أولاً ثم القيمة', () => {
  const o = config.game;
  assert.equal(classifyGift({ name: 'Rose', diamonds: 1 }, o), 'laser');
  assert.equal(classifyGift({ name: 'TikTok', diamonds: 1 }, o), 'emp');
  assert.equal(classifyGift({ name: 'Lion', diamonds: 29999 }, o), 'overload');
  assert.equal(classifyGift({ name: 'Unknown', diamonds: 5 }, o), 'laser');
  assert.equal(classifyGift({ name: 'Unknown', diamonds: 30 }, o), 'mines');
  assert.equal(classifyGift({ name: 'Unknown', diamonds: 199 }, o), 'emp');
  assert.equal(classifyGift({ name: 'Unknown', diamonds: 5000 }, o), 'overload');
});

test('الانضمام والتبديل (مقفل أثناء المعركة)', () => {
  const { game, battle, u } = setup();
  assert.equal(game.handleComment(u('a'), '1'), 'joined');
  assert.equal(game.handleComment(u('a'), '1'), 'same');
  assert.equal(game.handleComment(u('a'), '2'), 'switched'); // مسموح قبل المعركة
  battle();
  assert.notEqual(game.handleComment(u('a'), '1'), 'switched'); // مقفل (قد يُحتسب كتعليق فقط)
  assert.equal(game.members.get('a').team, 'red');
  assert.equal(game.handleComment(u('b'), 'hello'), 'ignored');
  game.destroy();
});

test('الوردة تدفع المفاعل نحو الخصم، والدرع يقلل الدفع', () => {
  const { game, battle, u } = setup();
  game.handleComment(u('a'), '1');
  game.handleComment(u('b'), '2');
  battle();
  game.handleGift(u('a'), { name: 'Rose', diamonds: 1 }, 10);
  const free = game.core;
  assert.ok(Math.abs(free - 10 * config.game.laserPushPerCoin) < 1e-9);

  // الأحمر يكبّس فيشحن درعه
  assert.equal(game.handleLike(u('b'), 200), 'shield');
  assert.ok(game.teams.red.shield > 50);
  const before = game.core;
  game.handleGift(u('a'), { name: 'Rose', diamonds: 1 }, 10);
  const shielded = game.core - before;
  assert.ok(shielded < free * 0.7, `الدفع مع الدرع (${shielded}) يجب أن يكون أقل من ${free}`);
  game.destroy();
});

test('الدرع يتلاشى مع الوقت', () => {
  const { game, battle, clock, u } = setup();
  game.handleComment(u('b'), '2');
  battle();
  game.handleLike(u('b'), 100);
  const s = game.teams.red.shield;
  clock.advance(1000); game.tick();
  clock.advance(1000); game.tick();
  assert.ok(game.teams.red.shield < s);
  game.destroy();
});

test('EMP يعطّل درع الخصم ويمنع شحنه 10 ثوانٍ', () => {
  const { game, battle, clock, u } = setup();
  game.handleComment(u('a'), '1');
  game.handleComment(u('b'), '2');
  battle();
  game.handleLike(u('b'), 100);
  assert.equal(game.handleGift(u('a'), { name: 'TikTok', diamonds: 1 }, 1), 'emp');
  assert.equal(game.teams.red.shield, 0);
  assert.equal(game.handleLike(u('b'), 100), 'jammed');
  assert.equal(game.teams.red.shield, 0);
  clock.advance(10_001); game.tick();
  assert.equal(game.handleLike(u('b'), 10), 'shield');
  game.destroy();
});

test('حقل الألغام ينفجر على دفعات', () => {
  const { game, battle, clock, u } = setup();
  game.handleComment(u('b'), '2');
  battle();
  assert.equal(game.handleGift(u('b'), { name: 'Perfume', diamonds: 20 }, 1), 'mines');
  assert.equal(game.mines.length, config.game.mines.blasts);
  assert.equal(game.core, 0);
  for (let i = 0; i < 11; i++) { clock.advance(1000); game.tick(); }
  assert.equal(game.mines.length, 0);
  assert.ok(Math.abs(game.core + config.game.mines.push) < 1e-6); // الأحمر يدفع نحو الأزرق (سالب)
  game.destroy();
});

test('Overload يمسح نصف طاقة الخصم ويمنح لقب القائد', () => {
  const { game, battle, u } = setup();
  game.handleComment(u('a'), '1');
  game.handleComment(u('b'), '2');
  battle();
  const redBefore = game.tickState().teams.red.energy; // 50
  assert.equal(game.handleGift(u('a'), { name: 'Lion', diamonds: 29999 }, 1), 'overload');
  assert.equal(game.tickState().teams.red.energy, redBefore / 2);
  assert.equal(game.commander.id, 'a');

  // هدية كبرى أصغر من مجموع القائد لا تنتزع اللقب
  game.handleGift(u('b'), { name: 'Whale diving', diamonds: 2150 }, 1);
  assert.equal(game.commander.id, 'a');
  // تجاوز مجموع القائد ينتزع اللقب
  game.handleGift(u('b'), { name: 'Lion', diamonds: 29999 }, 1);
  assert.equal(game.commander.id, 'b');
  game.destroy();
});

test('تدمير القاعدة ينهي الجولة ثم تبدأ جولة جديدة بعدادات مصفّرة', () => {
  const { game, battle, clock, u } = setup();
  game.handleComment(u('a'), '1');
  game.handleComment(u('b'), '2');
  battle();
  game.handleGift(u('a'), { name: 'Rose', diamonds: 1 }, 1000);
  assert.equal(game.phase, Phase.VICTORY);
  assert.equal(game.winner.team, 'blue');
  assert.equal(game.winner.reason, 'destroyed');
  assert.equal(game.winner.mvp.id, 'a');
  assert.equal(game.history[0].team, 'blue');

  clock.advance(config.game.victorySeconds * 1000 + 1); game.tick();
  assert.equal(game.phase, Phase.COUNTDOWN);
  assert.equal(game.round, 2);
  assert.equal(game.core, 0);
  assert.equal(game.members.get('a').roundCoins, 0);
  assert.equal(game.members.get('a').totalCoins, 1000); // مجموع الجلسة محفوظ
  assert.equal(game.members.get('a').team, 'blue');     // الفرق محفوظة
  game.destroy();
});

test('انتهاء الوقت: الفائز من يتقدّم المفاعل نحو قاعدة خصمه', () => {
  const { game, battle, clock, u } = setup();
  game.handleComment(u('b'), '2');
  battle();
  game.handleGift(u('b'), { name: 'Rose', diamonds: 1 }, 5);
  clock.advance(config.game.battleSeconds * 1000 + 1); game.tick();
  assert.equal(game.phase, Phase.VICTORY);
  assert.equal(game.winner.team, 'red');
  assert.equal(game.winner.reason, 'time');
  game.destroy();
});

test('الهدايا بين الجولات لا تضيع بل تُنفَّذ عند بدء المعركة', () => {
  const { game, battle, u } = setup();
  game.handleComment(u('a'), '1');
  game.handleGift(u('a'), { name: 'Rose', diamonds: 1 }, 5);
  assert.equal(game.core, 0);
  battle();
  assert.ok(game.core > 0);
  game.destroy();
});

test('التفعيل التلقائي: المكبّس غير المنضم يُضاف للفريق الأقل عدداً', () => {
  const { game, battle, u } = setup();
  game.handleComment(u('a'), '1');
  battle();
  game.handleLike(u('x'), 5);
  assert.equal(game.members.get('x').team, 'red');
  game.destroy();

  const s2 = setup({ autoAssign: false });
  s2.battle();
  assert.equal(s2.game.handleLike(s2.u('y'), 5), 'ignored');
  s2.game.destroy();
});

test('الجولة تنتظر انضمام لاعبين اثنين قبل العد التنازلي', () => {
  const { game, u } = setup();
  assert.equal(game.phase, Phase.WAITING);
  assert.equal(game.phaseEndsAt, null);
  game.handleComment(u('a'), '1');
  assert.equal(game.handleComment(u('a'), '2'), 'switched'); // نفس الشخص يبدّل فقط
  assert.equal(game.phase, Phase.WAITING);
  game.handleComment(u('b'), '2'); // ولو في نفس الفريق
  assert.equal(game.phase, Phase.COUNTDOWN);
  game.destroy();
});

test('التعليق أثناء المعركة يدفع المفاعل مرة كل فترة لكل شخص', () => {
  const { game, battle, clock, u } = setup();
  game.handleComment(u('a'), '1');
  game.handleComment(u('b'), '2');
  battle();
  assert.equal(game.handleComment(u('a'), 'يلا يا أزرق'), 'chat');
  assert.equal(game.core, config.game.commentPush);
  assert.equal(game.handleComment(u('a'), 'مرة ثانية'), 'ignored'); // سبام
  clock.advance(config.game.commentCooldown * 1000 + 1);
  assert.equal(game.handleComment(u('a'), 'هيا'), 'chat');
  assert.equal(game.handleComment(u('zzz'), 'غريب'), 'ignored'); // غير منضم
  game.destroy();
});
