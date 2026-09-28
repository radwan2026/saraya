import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Game, Phase, parseNumberComment, resolveRound, pickWinner } from '../src/game.js';

const baseOpts = {
  trackLength: 10, minNumber: 1, maxNumber: 10, dollMin: 1, dollMax: 10,
  minPlayers: 1, maxPlayers: 0, allowChangeNumber: true, allowLateJoin: false,
  lobbySeconds: 1000, chooseSeconds: 1000, dollTurnSeconds: 1000, resultSeconds: 1000,
  winnerSeconds: 1000, gameOverSeconds: 1000, autoStart: false,
};

/** مولّد أرقام يعيد قيمة تجعل الدمية تختار الرقم المطلوب */
const dollRandom = (n, min = 1, max = 10) => (n - min + 0.5) / (max - min + 1);

test('parseNumberComment يقبل الأرقام الصحيحة فقط', () => {
  assert.equal(parseNumberComment('5'), 5);
  assert.equal(parseNumberComment(' 10 '), 10);
  assert.equal(parseNumberComment('#3'), 3);
  assert.equal(parseNumberComment('٧'), 7);
  assert.equal(parseNumberComment('١٠'), 10);
  assert.equal(parseNumberComment('۴'), 4);
  assert.equal(parseNumberComment('0'), null);
  assert.equal(parseNumberComment('11'), null);
  assert.equal(parseNumberComment('انا 5'), null);
  assert.equal(parseNumberComment('5 5'), null);
  assert.equal(parseNumberComment(''), null);
  assert.equal(parseNumberComment(undefined), null);
});

test('resolveRound: الرقم >= رقم الدمية يخرج، والأقل يتقدّم برقمه', () => {
  const players = [
    { id: 'a', number: 3, position: 0, alive: true },
    { id: 'b', number: 5, position: 2, alive: true },
    { id: 'c', number: 7, position: 0, alive: true },
    { id: 'd', number: 1, position: 9, alive: true },
    { id: 'e', number: 1, position: 0, alive: false },
  ];
  const r = resolveRound(players, 5, 10);
  assert.deepEqual(r.eliminated, ['b', 'c']);
  assert.deepEqual(r.advanced, [{ id: 'a', from: 0, to: 3 }, { id: 'd', from: 9, to: 10 }]);
  assert.deepEqual(r.finishers, ['d']);
});

test('pickWinner: الأبعد أولاً ثم الأسبق انضماماً', () => {
  assert.equal(pickWinner([]), null);
  const w = pickWinner([
    { id: 'x', position: 12, order: 3 },
    { id: 'y', position: 14, order: 5 },
    { id: 'z', position: 14, order: 2 },
  ]);
  assert.equal(w.id, 'z');
});

test('دورة لعبة كاملة حتى الفوز', () => {
  let rnd = 0.1;
  const game = new Game({ ...baseOpts }, { random: () => rnd });
  const u = (id) => ({ id, uniqueId: id, nickname: id });

  assert.equal(game.handleComment(u('a'), '4'), 'joined');
  assert.equal(game.handleComment(u('b'), '9'), 'joined');
  assert.equal(game.handleComment(u('c'), 'مرحبا'), 'ignored');
  assert.equal(game.handleComment(u('a'), '6'), 'changed'); // تغيير الرقم في الردهة
  assert.equal(game.players.size, 2);

  assert.ok(game.start());
  assert.equal(game.phase, Phase.DOLL);
  assert.equal(game.handleComment(u('late'), '3'), 'closed');

  rnd = dollRandom(8); // الدمية تختار 8
  game.skip();
  assert.equal(game.phase, Phase.RESULT);
  assert.equal(game.dollNumber, 8);
  assert.equal(game.players.get('a').position, 6);
  assert.equal(game.players.get('b').alive, false);
  assert.equal(game.handleComment(u('b'), '2'), 'eliminated');

  game.skip(); // -> اختيار
  assert.equal(game.phase, Phase.CHOOSING);
  assert.equal(game.handleComment(u('a'), '5'), 'changed');

  game.skip(); // -> الدمية
  rnd = dollRandom(9);
  game.skip(); // -> النتيجة
  assert.equal(game.players.get('a').position, 11);
  assert.equal(game.winner.id, 'a');

  game.skip(); // -> شاشة الفوز
  assert.equal(game.phase, Phase.WINNER);
  assert.equal(game.history[0].id, 'a');

  game.skip(); // -> لعبة جديدة
  assert.equal(game.phase, Phase.LOBBY);
  assert.equal(game.players.size, 0);
  game.destroy();
});

test('خروج الجميع ينهي اللعبة بدون فائز', () => {
  let rnd = 0;
  const game = new Game({ ...baseOpts }, { random: () => rnd });
  game.handleComment({ id: 'a' }, '3');
  game.start();
  rnd = dollRandom(2);
  game.skip();
  game.skip();
  assert.equal(game.phase, Phase.GAMEOVER);
  assert.equal(game.winner, null);
  game.destroy();
});

test('العد التنازلي في الردهة يبدأ عند اكتمال الحد الأدنى', () => {
  const game = new Game({ ...baseOpts, autoStart: true, minPlayers: 2 });
  game.handleComment({ id: 'a' }, '3');
  assert.equal(game.phaseEndsAt, null);
  game.handleComment({ id: 'b' }, '3');
  assert.ok(game.phaseEndsAt > Date.now());
  game.destroy();
});
