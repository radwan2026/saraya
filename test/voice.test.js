import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { voiceLines, voiceFile, prepareVoices } from '../src/brain/voice.js';
import { DEFAULT_ORDER } from '../src/brain/puzzles.js';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const bundledDir = path.join(root, 'public', 'brain', 'voice');

test('كل مقطع صوتي له ملف مرفق مع اللعبة (يعمل بدون إنترنت)', () => {
  for (const l of voiceLines('radwanzenati0', 'رضوان')) {
    assert.ok(fs.existsSync(path.join(bundledDir, `${l.id}.mp3`)), `ينقص ${l.id}.mp3`);
    assert.ok(l.caption && l.text, l.id);
  }
});

test('لكل لغز جملة صوتية، والشرح يذكر طريقة الاشتراك والمتابعة', () => {
  const lines = voiceLines('radwanzenati0', 'رضوان');
  for (const id of DEFAULT_ORDER) assert.ok(lines.some((l) => l.group === `round-${id}`), id);
  const welcome = lines.filter((l) => l.group === 'welcome').map((l) => l.caption).join(' ');
  assert.match(welcome, /اكتب أي تعليق/);
  assert.match(welcome, /@radwanzenati0/);
  assert.ok(lines.some((l) => l.group === 'hurry'));
  assert.ok(lines.some((l) => l.group === 'finale'));
});

test('voiceFile: الصوت المولّد أولاً ثم المرفق، ويرفض الأسماء غير الآمنة', () => {
  const cacheDir = fs.mkdtempSync(path.join(os.tmpdir(), 'voice-'));
  const dirs = { cacheDir, bundledDir };
  assert.equal(voiceFile('welcome-1', dirs), path.join(bundledDir, 'welcome-1.mp3'));
  fs.writeFileSync(path.join(cacheDir, 'welcome-1.mp3'), 'x');
  assert.equal(voiceFile('welcome-1', dirs), path.join(cacheDir, 'welcome-1.mp3'));
  assert.equal(voiceFile('../server', dirs), null);
  assert.equal(voiceFile('nope', dirs), null);
});

test('prepareVoices لا يحاول الاتصال إذا عُطّل الصوت الطبيعي', async () => {
  const r = await prepareVoices({ cacheDir: os.tmpdir(), lines: voiceLines(), voice: { neural: false } });
  assert.equal(r.skipped, true);
});
