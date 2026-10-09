import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Battle, BPhase, parseTeamComment, rankTeams } from '../src/battle.js';
import { Announcer, howtoText, speakName } from '../src/announcer.js';
import { splitForTts } from '../src/tts.js';
import { normalizeGift } from '../src/tiktok.js';
import config from '../battle.config.js';

const TEAMS = config.battle.teams;
const opts = (o = {}) => ({
  ...config.battle,
  goal: 1000, roundSeconds: 100, finalSeconds: 10, lobbySeconds: 5, winnerSeconds: 5, overtimeSeconds: 5,
  autoStart: false, ...o,
});

function make(o) {
  let t = 1_000_000;
  const clock = { now: () => t, advance: (ms) => { t += ms; } };
  const b = new Battle(opts(o), { now: clock.now, manualTick: true });
  return { b, clock };
}
const u = (id) => ({ id, uniqueId: id, nickname: id });

test('parseTeamComment يقبل الرقم والرمز والاسم فقط', () => {
  assert.equal(parseTeamComment('1', TEAMS), 1);
  assert.equal(parseTeamComment(' ٣ ', TEAMS), 3);
  assert.equal(parseTeamComment('#2', TEAMS), 2);
  assert.equal(parseTeamComment('🐺', TEAMS), 3);
  assert.equal(parseTeamComment('النسور', TEAMS), 2);
  assert.equal(parseTeamComment('فريق التنانين', TEAMS), 4);
  assert.equal(parseTeamComment('5', TEAMS), null);
  assert.equal(parseTeamComment('انا مع 1', TEAMS), null);
  assert.equal(parseTeamComment('', TEAMS), null);
  assert.equal(parseTeamComment(undefined, TEAMS), null);
});

test('الانضمام والتبديل في الردهة، والقفل أثناء المعركة', () => {
  const { b } = make();
  assert.equal(b.handleComment(u('a'), '1'), 'joined');
  assert.equal(b.handleComment(u('a'), '2'), 'switched');
  assert.equal(b.team(1).members, 0);
  assert.equal(b.team(2).members, 1);
  assert.equal(b.handleComment(u('a'), 'مرحبا'), 'ignored'); // لا نقاط خارج المعركة
  b.start();
  assert.equal(b.handleComment(u('a'), '3'), 'locked');
  assert.equal(b.users.get('a').team, 2);
  assert.equal(b.team(2).points, 1); // التعليق نفسه يُحتسب نقطة
  b.destroy();
});

test('نقاط التعليق مع فترة التهدئة، واللايك والمتابعة مرة واحدة', () => {
  const { b, clock } = make();
  b.handleComment(u('a'), '1');
  b.start();
  assert.equal(b.handleComment(u('a'), 'يلا'), 'points');
  assert.equal(b.handleComment(u('a'), 'يلا'), 'cooldown');
  clock.advance(3000);
  assert.equal(b.handleComment(u('a'), 'يلا'), 'points');
  assert.equal(b.team(1).points, 2);
  b.handleLike(u('a'), 5);
  assert.equal(b.team(1).points, 7);
  assert.equal(b.handleFollow(u('a')), 30);
  assert.equal(b.handleFollow(u('a')), 0);
  b.destroy();
});

test('الانضمام التلقائي لأضعف فريق عند اللايك', () => {
  const { b } = make();
  b.handleComment(u('a'), '1');
  b.handleComment(u('b'), '2');
  b.handleComment(u('c'), '4');
  b.start();
  b.handleLike(u('x'), 1);
  assert.equal(b.users.get('x').team, 3);
  b.destroy();
});

test('الهدايا: نقاط لكل عملة، المضاعف، والقنبلة على المتصدر', () => {
  const { b, clock } = make({ goal: 0 });
  b.handleComment(u('a'), '1');
  b.handleComment(u('b'), '2');
  b.start();
  assert.equal(b.handleGift(u('b'), { name: 'دونات', coins: 30 }), 300);
  assert.equal(b.handleGift(u('a'), { name: 'قبعة', coins: 99 }), 990);
  assert.ok(b.team(1).boostUntil > clock.now());
  // المضاعف ×2 فعّال لفريق 1
  assert.equal(b.handleLike(u('a'), 10), 20);
  // قنبلة من فريق 2 على المتصدر (فريق 1)
  const before = b.team(1).points;
  const events = [];
  b.on('bomb', (e) => events.push(e));
  b.handleGift(u('b'), { name: 'كورجي', coins: 299 });
  assert.equal(events.length, 1);
  assert.equal(events[0].target.id, 1);
  assert.equal(b.team(1).points, before - Math.floor(before * 0.15));
  clock.advance(21_000);
  assert.equal(b.handleLike(u('a'), 1), 1); // انتهى المضاعف
  b.destroy();
});

test('هدايا الردهة تُحفظ لبداية الجولة', () => {
  const { b } = make();
  b.handleComment(u('a'), '3');
  b.handleGift(u('a'), { name: 'وردة', coins: 5 });
  assert.equal(b.team(3).bank, 50);
  assert.equal(b.team(3).points, 0);
  b.start();
  assert.equal(b.team(3).points, 50);
  assert.equal(b.team(3).bank, 0);
  assert.equal(b.topSupporters(1)[0].points, 50);
  b.destroy();
});

test('الوصول للهدف ينهي الجولة ويحدد الفائز والبطل', () => {
  const { b } = make({ goal: 500 });
  b.handleComment(u('a'), '2');
  b.handleComment(u('b'), '2');
  b.start();
  b.handleGift(u('a'), { name: 'x', coins: 10 });
  b.handleGift(u('b'), { name: 'y', coins: 45 });
  assert.equal(b.phase, BPhase.WINNER);
  assert.equal(b.lastWinner.team.id, 2);
  assert.equal(b.lastWinner.mvp.id, 'b');
  assert.equal(b.lastWinner.reason, 'goal');
  assert.equal(b.team(2).wins, 1);
  b.destroy();
});

test('الوقت الحاسم يضاعف النقاط، والتعادل يمنح وقتاً إضافياً', () => {
  const { b, clock } = make({ goal: 0 });
  const seen = [];
  for (const ev of ['final', 'lastTen', 'overtime', 'winner']) b.on(ev, () => seen.push(ev));
  b.handleComment(u('a'), '1');
  b.handleComment(u('b'), '2');
  b.start();
  clock.advance(91_000);
  b.tick();
  assert.ok(b.isFinal);
  assert.equal(b.handleLike(u('a'), 3), 6);
  b.handleLike(u('b'), 3);
  clock.advance(10_000);
  b.tick();
  assert.equal(b.phase, BPhase.BATTLE);
  assert.ok(b.overtime);
  b.handleLike(u('b'), 1);
  clock.advance(5000);
  b.tick();
  assert.equal(b.phase, BPhase.WINNER);
  assert.equal(b.lastWinner.team.id, 2);
  assert.deepEqual(seen, ['final', 'lastTen', 'overtime', 'winner']);
  clock.advance(5000);
  b.tick();
  assert.equal(b.phase, BPhase.LOBBY);
  assert.equal(b.users.get('a').team, 1); // الأعضاء يبقون في فرقهم للجولة القادمة
  b.destroy();
});

test('العد التنازلي التلقائي يبدأ الجولة', () => {
  const { b, clock } = make({ autoStart: true, minPlayers: 2 });
  b.handleComment(u('a'), '1');
  assert.equal(b.phaseEndsAt, null);
  b.handleComment(u('b'), '2');
  assert.ok(b.phaseEndsAt);
  clock.advance(5000);
  b.tick();
  assert.equal(b.phase, BPhase.BATTLE);
  b.destroy();
});

test('rankTeams: الأعلى نقاطاً ثم الأسبق وصولاً', () => {
  const r = rankTeams([{ id: 1, points: 5, reachedAt: 3 }, { id: 2, points: 5, reachedAt: 1 }, { id: 3, points: 9, reachedAt: 9 }]);
  assert.deepEqual(r.map((t) => t.id), [3, 2, 1]);
});

test('المعلّق: يشرح اللعبة ويشكر الداعمين', () => {
  const { b, clock } = make({ goal: 0 });
  const lines = [];
  const a = new Announcer(b, config.announcer, { random: () => 0 });
  a.on('say', (l) => lines.push(l));
  b.tick();
  assert.equal(lines[0].kind, 'howto');
  assert.match(lines[0].text, /1 لفريق الأسود/);
  b.handleComment(u('a'), '1');
  b.start();
  b.handleGift(u('a'), { name: 'المجرّة', coins: 1000 });
  assert.ok(lines.some((l) => l.kind === 'gift' && l.priority === 'high' && l.text.includes('المجرّة')));
  b.handleGift({ id: 'z', nickname: 'زياد' }, { name: 'وردة', coins: 1 });
  clock.advance(4000);
  b.tick();
  assert.ok(lines.some((l) => l.kind === 'gift' && l.text.includes('زياد')));
  b.destroy();
});

test('howtoText يذكر القواعد من الإعدادات', () => {
  const t = howtoText(config.battle);
  assert.match(t, new RegExp(String(config.battle.boostCoins)));
  assert.match(t, new RegExp(String(config.battle.bombCoins)));
  assert.match(t, /التنانين/);
});

test('speakName ينظّف الرموز من الأسماء', () => {
  assert.equal(speakName('🔥Ahmed_99🔥'), 'Ahmed 99');
  assert.equal(speakName('★★★'), 'بطل');
});

test('splitForTts يقسّم النص الطويل دون تجاوز الحد', () => {
  const parts = splitForTts(howtoText(config.battle), 180);
  assert.ok(parts.length > 1);
  for (const p of parts) assert.ok(p.length <= 180, p);
  assert.equal(parts.join(' ').replace(/\s+/g, ' '), howtoText(config.battle).replace(/\s+/g, ' '));
});

test('normalizeGift: الهدايا المتتالية تُحتسب عند نهاية السلسلة فقط', () => {
  const mid = normalizeGift({ giftId: 1, repeatCount: 4, repeatEnd: 0, giftDetails: { name: 'Rose', diamondCount: 1, type: 1 } });
  assert.equal(mid.streaking, true);
  const end = normalizeGift({ giftId: 1, repeatCount: 4, repeatEnd: 1, giftDetails: { name: 'Rose', diamondCount: 1, type: 1 } });
  assert.equal(end.streaking, false);
  assert.equal(end.coins, 4);
  const single = normalizeGift({ giftId: 2, repeatCount: 1, giftDetails: { name: 'Universe', diamondCount: 34999, type: 2 } });
  assert.equal(single.streaking, false);
  assert.equal(single.coins, 34999);
});
