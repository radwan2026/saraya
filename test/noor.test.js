import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { NoorEngine, Phase, normalizeArabic, parseDhikr, parseQuizAnswer, parseTeamComment } from '../src/noor/engine.js';
import { giftKind, QUIZ, TEAMS } from '../src/noor/content.js';
import { DEFAULTS, sanitizeSettings } from '../src/noor/settings.js';
import { GiftStreaks, normalizeGift } from '../src/tiktok.js';

const u = (id) => ({ id, uniqueId: id, nickname: id, avatar: '' });

function makeEngine(overrides = {}) {
  mock.timers.reset();
  mock.timers.enable({ apis: ['setTimeout', 'setInterval', 'Date'] });
  const engine = new NoorEngine({ ...DEFAULTS, quizEnabled: false, ...overrides }, { random: () => 0.5 });
  return engine;
}

function done(engine) {
  engine.destroy();
  mock.timers.reset();
}

test('normalizeArabic يزيل التشكيل ويوحّد الحروف', () => {
  assert.equal(normalizeArabic('سُبْحَانَ اللّٰهِ'), 'سبحان الله');
  assert.equal(normalizeArabic('اللهُ أكبـــر'), 'الله اكبر');
  assert.equal(normalizeArabic('٣'), '3');
});

test('parseTeamComment يقبل الرقم أو اسم الفريق', () => {
  assert.equal(parseTeamComment('1'), 0);
  assert.equal(parseTeamComment('٤'), 3);
  assert.equal(parseTeamComment('#2'), 1);
  assert.equal(parseTeamComment('الصبر'), 0);
  assert.equal(parseTeamComment('إحسان'), 2);
  assert.equal(parseTeamComment('فريق التقوى'), 3);
  assert.equal(parseTeamComment('5'), null);
  assert.equal(parseTeamComment('12'), null);
  assert.equal(parseTeamComment('مرحبا'), null);
});

test('parseDhikr يتعرف على الأذكار مهما كُتبت', () => {
  assert.equal(parseDhikr('سبحان الله وبحمده'), 'subhan');
  assert.equal(parseDhikr('الحمدلله'), 'hamd');
  assert.equal(parseDhikr('اللهُ أَكبر 🤍'), 'takbir');
  assert.equal(parseDhikr('استغفر الله العظيم'), 'istighfar');
  assert.equal(parseDhikr('اللهم صلِّ على محمد'), 'salat');
  assert.equal(parseDhikr('مرحبا'), null);
});

test('parseQuizAnswer يقبل الحروف العربية والإنجليزية فقط', () => {
  assert.equal(parseQuizAnswer('أ'), 0);
  assert.equal(parseQuizAnswer('ا'), 0);
  assert.equal(parseQuizAnswer('ب'), 1);
  assert.equal(parseQuizAnswer('C'), 2);
  assert.equal(parseQuizAnswer('د.'), 3);
  assert.equal(parseQuizAnswer('باب'), null);
});

test('giftKind يطابق الأسماء ويعتمد على القيمة كاحتياط', () => {
  assert.equal(giftKind('Rose', 1), 'rose');
  assert.equal(giftKind('Heart Me', 1), 'heart');
  assert.equal(giftKind('Finger Heart', 5), 'heart');
  assert.equal(giftKind('Doughnut', 30), 'donut');
  assert.equal(giftKind('Perfume', 20), 'perfume');
  assert.equal(giftKind('Galaxy', 1000), 'grand');
  assert.equal(giftKind('Corgi', 299), 'meteor');
  assert.equal(giftKind('GG', 1), 'sparkle');
});

test('بنك الأسئلة سليم: 4 خيارات مختلفة وإجابة صحيحة', () => {
  assert.ok(QUIZ.length >= 40);
  for (const q of QUIZ) {
    assert.equal(q.o.length, 4, q.q);
    assert.equal(new Set(q.o).size, 4, q.q);
    assert.ok(q.a >= 0 && q.a < 4, q.q);
  }
});

test('الانضمام لفريق وتغييره يحدّث عدد الأعضاء', () => {
  const e = makeEngine();
  assert.equal(e.handleComment(u('a'), '1'), 'joined');
  assert.equal(e.teams[0].members, 1);
  assert.equal(e.handleComment(u('a'), '1'), 'ignored');
  assert.equal(e.handleComment(u('a'), '3'), 'joined');
  assert.equal(e.teams[0].members, 0);
  assert.equal(e.teams[2].members, 1);
  done(e);
});

test('الهدية تضيف نوراً لفريق المُهدي وتضمّه تلقائياً لأقل الفرق عدداً', () => {
  const e = makeEngine();
  e.handleComment(u('x'), '1');
  e.handleGift(u('g'), { name: 'Rose', coins: 1, count: 5 });
  const user = e.users.get('g');
  assert.equal(user.team, TEAMS[1].id); // الفريق الأول فيه عضو، فيذهب للثاني
  assert.equal(e.teams[1].light, 50);
  assert.equal(e.teams[1].roses, 5);
  assert.equal(user.coins, 5);
  assert.equal(e.session.coins, 5);
  done(e);
});

test('العطر يمنح نفحة مسك تضاعف النور', () => {
  const e = makeEngine();
  e.handleComment(u('p'), '2');
  e.handleGift(u('p'), { name: 'Perfume', coins: 20, count: 1 });
  assert.equal(e.teams[1].light, 200);
  e.handleGift(u('p'), { name: 'Rose', coins: 1, count: 1 });
  assert.equal(e.teams[1].light, 220); // 10 × 2
  mock.timers.tick(DEFAULTS.boostSeconds * 1000 + 10);
  e.handleGift(u('p'), { name: 'Rose', coins: 1, count: 1 });
  assert.equal(e.teams[1].light, 230);
  done(e);
});

test('الذكر يملأ المسبحة ويحترم الفاصل الزمني لكل شخص', () => {
  const e = makeEngine();
  const events = [];
  e.on('fx', (f) => events.push(f.type));
  assert.equal(e.handleComment(u('d'), 'سبحان الله'), 'dhikr');
  assert.equal(e.handleComment(u('d'), 'الحمد لله'), 'cooldown');
  mock.timers.tick(DEFAULTS.dhikrCooldownMs);
  assert.equal(e.handleComment(u('d'), 'الحمد لله'), 'dhikr');
  assert.equal(e.tasbeeh, 2);
  for (let i = 0; i < 31; i++) e.handleComment(u(`z${i}`), 'الله أكبر');
  assert.equal(e.tasbeeh, 0);
  assert.ok(events.includes('tasbeeh'));
  assert.equal(e.session.dhikr, 33);
  done(e);
});

test('اكتمال المنارة يُنهي الجولة بعد مهلة قصيرة ويعلن الفائز', () => {
  const e = makeEngine({ target: 100 });
  e.handleComment(u('w'), '4');
  e.handleGift(u('w'), { name: 'Doughnut', coins: 30, count: 1 });
  assert.equal(e.teams[3].light, 100); // لا يتجاوز الهدف
  assert.equal(e.phase, Phase.PLAYING);
  e.handleGift(u('w'), { name: 'Rose', coins: 1, count: 1 }); // بعد الاكتمال لا يُضاف نور
  assert.equal(e.teams[3].light, 100);
  mock.timers.tick(DEFAULTS.finishDelayMs);
  assert.equal(e.phase, Phase.VICTORY);
  assert.equal(e.winner.teamId, 'taqwa');
  assert.equal(e.winner.top[0].id, 'w');
  assert.equal(e.winner.top[0].points, 100);
  assert.equal(e.history.length, 1);
  mock.timers.tick(DEFAULTS.victorySeconds * 1000);
  assert.equal(e.phase, Phase.PLAYING);
  assert.equal(e.round, 2);
  assert.equal(e.teams[3].light, 0);
  assert.equal(e.users.get('w').coins, 31); // الداعمون يبقون طوال الجلسة
  done(e);
});

test('انتهاء الوقت يعلن الفريق الأعلى نوراً', () => {
  const e = makeEngine();
  e.handleComment(u('a'), '1');
  e.handleComment(u('b'), '2');
  e.handleGift(u('a'), { name: 'Rose', coins: 1, count: 1 });
  e.handleGift(u('b'), { name: 'Rose', coins: 1, count: 3 });
  mock.timers.tick(DEFAULTS.roundSeconds * 1000);
  assert.equal(e.phase, Phase.VICTORY);
  assert.equal(e.winner.teamId, 'shukr');
  assert.equal(e.winner.reason, 'time');
  done(e);
});

test('سؤال النور: الإجابات الصحيحة تضيف نوراً والأسرع ضعفاً', () => {
  const e = makeEngine();
  e.handleComment(u('a'), '1');
  e.handleComment(u('b'), '2');
  e.startQuiz();
  const right = ['أ', 'ب', 'ج', 'د'][e.quiz.answer];
  const wrong = ['أ', 'ب', 'ج', 'د'][(e.quiz.answer + 1) % 4];
  assert.equal(e.handleComment(u('a'), right), 'answer');
  mock.timers.tick(100);
  assert.equal(e.handleComment(u('b'), right), 'answer');
  assert.equal(e.handleComment(u('b'), wrong), 'ignored'); // إجابة واحدة فقط
  e.handleComment(u('c'), wrong);
  e.endQuiz();
  assert.equal(e.teams[0].light, DEFAULTS.quizLight * 2);
  assert.equal(e.teams[1].light, DEFAULTS.quizLight * 1.5);
  assert.equal(e.quiz.correctCount, 2);
  assert.equal(e.snapshot().quiz.answer, e.quiz.answer);
  done(e);
});

test('الإيقاف المؤقت والاستئناف يحافظان على الوقت المتبقي', () => {
  const e = makeEngine();
  mock.timers.tick(60_000);
  e.pause();
  assert.equal(e.phase, Phase.PAUSED);
  mock.timers.tick(500_000);
  e.resume();
  assert.equal(e.phase, Phase.PLAYING);
  assert.equal(e.endsAt - Date.now(), (DEFAULTS.roundSeconds - 60) * 1000);
  done(e);
});

test('GiftStreaks تحتسب زيادات السلسلة فقط', () => {
  const s = new GiftStreaks();
  const base = { userId: 'u', giftId: '5655', groupId: 'g1', streakable: true };
  assert.equal(s.delta({ ...base, repeatCount: 1 }), 1);
  assert.equal(s.delta({ ...base, repeatCount: 4 }), 3);
  assert.equal(s.delta({ ...base, repeatCount: 4 }), 0);
  assert.equal(s.delta({ ...base, repeatCount: 6, repeatEnd: true }), 2);
  assert.equal(s.delta({ ...base, repeatCount: 1 }), 1); // سلسلة جديدة
  assert.equal(s.delta({ userId: 'u', giftId: '1', repeatCount: 1, streakable: false }), 1);
});

test('normalizeGift يقرأ صيغة الإصدار 2 من المكتبة', () => {
  const g = normalizeGift({ giftId: 5655, repeatCount: 3, repeatEnd: 0, groupId: '9',
    gift: { name: 'Rose', diamondCount: 1, type: 1, image: { urlList: ['https://x/rose.png'] } } });
  assert.deepEqual(g, { id: '5655', name: 'Rose', coins: 1, image: 'https://x/rose.png', streakable: true, repeatCount: 3, repeatEnd: false, groupId: '9' });
});

test('sanitizeSettings يرفض القيم غير الصالحة', () => {
  const s = sanitizeSettings({ target: '500', roundSeconds: -5, musicMode: 'rock', autoStart: 0, hacker: 1, teamNames: ['أ', 'ب'] });
  assert.deepEqual(s, { target: 500, autoStart: false, teamNames: ['أ', 'ب'] });
  assert.equal(sanitizeSettings({ roundSeconds: 0 }).roundSeconds, 1);
});
