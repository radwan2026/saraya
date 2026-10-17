import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseAnswer, detectDhikr, normalizeArabic } from '../src/noor/text.js';
import { classifyGift, GiftStreaks } from '../src/noor/gifts.js';
import { NoorEngine } from '../src/noor/engine.js';
import { QUESTIONS, CATEGORIES } from '../src/noor/questions.js';
import { normalizeGift } from '../src/tiktok.js';
import config from '../noor.config.js';

const user = (id) => ({ id, uniqueId: id, nickname: id, avatar: '' });
function makeEngine(patch = {}) {
  let t = 1_000_000;
  const engine = new NoorEngine({ ...config.game, ...patch, quiz: { ...config.game.quiz, auto: false } }, QUESTIONS, { now: () => t });
  return { engine, advance: (ms) => { t += ms; } };
}

test('parseAnswer يقرأ الأرقام والحروف العربية والإنجليزية', () => {
  assert.equal(parseAnswer('1'), 0);
  assert.equal(parseAnswer(' ٤ '), 3);
  assert.equal(parseAnswer('أ'), 0);
  assert.equal(parseAnswer('ج'), 2);
  assert.equal(parseAnswer('B'), 1);
  assert.equal(parseAnswer('3️⃣'), 2);
  assert.equal(parseAnswer('5'), null);
  assert.equal(parseAnswer('12'), null);
  assert.equal(parseAnswer('سبحان الله'), null);
});

test('detectDhikr يكتشف الأذكار بأشكال كتابة مختلفة', () => {
  assert.equal(detectDhikr('سُبْحَانَ اللَّهِ').key, 'subhan');
  assert.equal(detectDhikr('الحمدلله').key, 'hamd');
  assert.equal(detectDhikr('الله اكبر').key, 'takbir');
  assert.equal(detectDhikr('لا إله إلا الله').key, 'tahlil');
  assert.equal(detectDhikr('صلى الله عليه وسلم').key, 'salawat');
  assert.equal(detectDhikr('لا حول ولا قوة إلا بالله').key, 'hawqala');
  assert.equal(detectDhikr('سبحان الله سبحان الله سبحان الله').count, 3);
  assert.equal(detectDhikr('مرحبا'), null);
  assert.equal(normalizeArabic('إِيمَانٌ'), 'ايمان');
});

test('classifyGift يربط الهدايا بالتأثيرات', () => {
  assert.equal(classifyGift('Rose'), 'rose');
  assert.equal(classifyGift('Finger Heart'), 'heart');
  assert.equal(classifyGift('Doughnut'), 'donut');
  assert.equal(classifyGift('Perfume'), 'perfume');
  assert.equal(classifyGift('Lion'), 'other');
});

test('GiftStreaks يحتسب كل هدية في السلسلة مرة واحدة فقط', () => {
  const s = new GiftStreaks();
  const g = (repeatCount, repeatEnd = false) => ({ id: '5655', streakable: true, groupId: 'g1', repeatCount, repeatEnd });
  assert.equal(s.resolve('u', g(1)), 1);
  assert.equal(s.resolve('u', g(3)), 2);
  assert.equal(s.resolve('u', g(5)), 2);
  assert.equal(s.resolve('u', g(5, true)), 0);
  // هدية سلسلة أُرسلت مرة واحدة: حدثان (بداية + نهاية)
  assert.equal(s.resolve('u', { ...g(1), groupId: 'g2' }), 1);
  assert.equal(s.resolve('u', { ...g(1, true), groupId: 'g2' }), 0);
  // هدية غير متسلسلة
  assert.equal(s.resolve('u', { id: 'x', streakable: false, repeatCount: 1 }), 1);
});

test('normalizeGift يقرأ بيانات الهدية من المكتبة', () => {
  const g = normalizeGift({ giftId: 5655, repeatCount: 3, repeatEnd: 1, groupId: '9', giftDetails: { giftName: 'Rose', diamondCount: 1, giftType: 1, giftImage: { urlList: ['https://x/r.png'] } } });
  assert.deepEqual(g, { id: '5655', name: 'Rose', diamonds: 1, image: 'https://x/r.png', streakable: true, repeatCount: 3, repeatEnd: true, groupId: '9' });
});

test('الهدايا تضيف نقاط نور، والعطر يضاعفها', () => {
  const { engine, advance } = makeEngine();
  const fx = [];
  engine.on('fx', (e) => fx.push(e));
  assert.equal(engine.handleGift(user('a'), { name: 'Rose', diamonds: 1, count: 5 }), 50);
  assert.equal(engine.totals.flowers, 5);
  engine.handleGift(user('b'), { name: 'Perfume', diamonds: 20, count: 1 });
  assert.equal(engine.multiplier(), 2);
  assert.equal(engine.handleGift(user('a'), { name: 'Rose', diamonds: 1, count: 1 }), 20);
  advance(config.game.muskSeconds * 1000 + 1);
  assert.equal(engine.multiplier(), 1);
  assert.equal(engine.snapshot().topSupporters[0].id, 'b');
  assert.ok(fx.some((e) => e.type === 'gift' && e.effect === 'musk'));
  engine.destroy();
});

test('اكتمال الهدف يرفع الليلة ويكبّر الهدف', () => {
  const { engine } = makeEngine({ firstGoal: 100 });
  const ups = [];
  engine.on('fx', (e) => { if (e.type === 'levelUp') ups.push(e); });
  engine.handleGift(user('a'), { name: 'Galaxy', diamonds: 30, count: 1 }); // 300 نقطة
  assert.ok(engine.level >= 2);
  assert.ok(engine.goal > 100);
  assert.equal(ups[0].top[0].id, 'a');
  assert.ok(engine.points < engine.goal);
  engine.destroy();
});

test('الهدية الكبرى تُعلَّم big لإطلاق موكب النور', () => {
  const { engine } = makeEngine();
  let last;
  engine.on('fx', (e) => { if (e.type === 'gift') last = e; });
  engine.handleGift(user('a'), { name: 'Rose', diamonds: 1, count: 3 });
  assert.equal(last.big, false);
  engine.handleGift(user('a'), { name: 'Lion', diamonds: 29999, count: 1 });
  assert.equal(last.big, true);
  engine.destroy();
});

test('المسابقة: إجابة واحدة لكل شخص، ونقاط للمصيبين بالترتيب', () => {
  const { engine } = makeEngine();
  engine.startQuestion();
  const ok = engine.quiz.correctIndex;
  const wrong = (ok + 1) % 4;
  assert.equal(engine.handleComment(user('a'), String(ok + 1)), 'answer');
  assert.equal(engine.handleComment(user('a'), String(wrong + 1)), 'already');
  assert.equal(engine.handleComment(user('b'), String(wrong + 1)), 'answer');
  assert.equal(engine.handleComment(user('c'), String(ok + 1)), 'answer');
  assert.equal(engine.quizPublic().correctIndex, undefined, 'لا تُكشف الإجابة أثناء السؤال');
  engine.reveal();
  const q = engine.quizPublic();
  assert.equal(q.phase, 'reveal');
  assert.equal(q.correctCount, 2);
  assert.deepEqual(q.winners.map((w) => w.id), ['a', 'c']);
  assert.equal(engine.scholars.get('a').score, config.game.answerPoints + config.game.firstAnswerBonus[0]);
  assert.equal(engine.scholars.get('c').score, config.game.answerPoints + config.game.firstAnswerBonus[1]);
  assert.equal(engine.scholars.has('b'), false);
  engine.destroy();
});

test('الذكر يزيد المسبحة مع حماية من التكرار السريع، وتحدي التسبيح ينجح', () => {
  const { engine, advance } = makeEngine();
  assert.equal(engine.handleComment(user('a'), 'سبحان الله'), 'dhikr');
  assert.equal(engine.handleComment(user('a'), 'الحمد لله'), 'cooldown');
  advance(2000);
  assert.equal(engine.handleComment(user('a'), 'الحمد لله'), 'dhikr');
  assert.equal(engine.dhikr, 2);

  const ends = [];
  engine.on('fx', (e) => { if (e.type === 'challengeEnd') ends.push(e); });
  engine.startChallenge({ target: 10, seconds: 60 });
  for (let i = 0; i < 10; i++) { advance(2000); engine.handleComment(user(`u${i}`), 'الله أكبر'); }
  assert.equal(ends.length, 1);
  assert.equal(ends[0].success, true);
  assert.equal(engine.challenge, null);
  engine.destroy();
});

test('بنك الأسئلة سليم: 4 خيارات مختلفة وتصنيف معروف', () => {
  assert.ok(QUESTIONS.length >= 80);
  for (const q of QUESTIONS) {
    assert.equal(q.a.length, 4, q.q);
    assert.equal(new Set(q.a).size, 4, q.q);
    assert.ok(q.c in CATEGORIES, q.q);
  }
});
