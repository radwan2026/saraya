import { test } from 'node:test';
import assert from 'node:assert/strict';
import { commentText, normalizeUser } from '../src/tiktok.js';

test('commentText يقرأ content (الإصدار 2) و comment (القديم)', () => {
  assert.equal(commentText({ content: '5' }), '5');
  assert.equal(commentText({ comment: '7' }), '7');
  assert.equal(commentText({}), '');
});

test('normalizeUser يقرأ بيانات المستخدم بصيغة الإصدار 2', () => {
  const u = normalizeUser({ id: '123', displayId: 'radwan', nickname: 'Radwan', avatarThumb: { urlList: ['https://x/a.webp'] } });
  assert.deepEqual(u, { id: '123', uniqueId: 'radwan', nickname: 'Radwan', avatar: 'https://x/a.webp' });
});
