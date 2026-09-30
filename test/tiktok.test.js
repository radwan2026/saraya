import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commentText, normalizeUser, normalizeGift, GiftStreaks } from '../src/tiktok.js';

test('commentText يقرأ content (الإصدار 2) و comment (القديم)', () => {
  assert.equal(commentText({ content: '5' }), '5');
  assert.equal(commentText({ comment: '7' }), '7');
  assert.equal(commentText({}), '');
});

test('normalizeUser يقرأ بيانات المستخدم بصيغة الإصدار 2', () => {
  const u = normalizeUser({ id: '123', displayId: 'radwan', nickname: 'Radwan', avatarThumb: { urlList: ['https://x/a.webp'] } });
  assert.deepEqual(u, { id: '123', uniqueId: 'radwan', nickname: 'Radwan', avatar: 'https://x/a.webp' });
});

test('normalizeGift يقرأ بيانات الهدية بصيغة الإصدار 2', () => {
  const g = normalizeGift({ giftId: 5655, repeatCount: 3, repeatEnd: 0, groupId: '9', gift: { name: 'Rose', diamondCount: 1, type: 1, image: { urlList: ['https://x/r.png'] } } });
  assert.equal(g.name, 'Rose');
  assert.equal(g.diamonds, 1);
  assert.equal(g.repeatCount, 3);
  assert.equal(g.streakable, true);
  assert.equal(g.image, 'https://x/r.png');
});

test('GiftStreaks يحسب الزيادة فقط في سلسلة الكومبو', () => {
  const s = new GiftStreaks();
  const rose = (n, end = false) => ({ giftId: '1', groupId: 'g', streakable: true, repeatCount: n, repeatEnd: end });
  assert.equal(s.delta('u', rose(1)), 1);
  assert.equal(s.delta('u', rose(4)), 3);
  assert.equal(s.delta('u', rose(4)), 0);
  assert.equal(s.delta('u', rose(5, true)), 1);
  assert.equal(s.delta('u', { giftId: '2', streakable: false, repeatCount: 2 }), 2);
});
