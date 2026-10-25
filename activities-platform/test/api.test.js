import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createApp, normalizeEmployeeId } from '../src/app.js';
import { parseDoc } from '../src/docs.js';

let server;
let base;
let dataDir;
let cookie = '';
const mails = [];

before(async () => {
  dataDir = fs.mkdtempSync(path.join(os.tmpdir(), 'activities-'));
  const { app } = createApp({
    dataDir,
    adminPassword: 'admin-pass-123',
    mailer: { enabled: true, async send(m) { mails.push(m); return true; } },
    log: () => {},
  });
  await new Promise((resolve) => { server = app.listen(0, resolve); });
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  server.close();
  fs.rmSync(dataDir, { recursive: true, force: true });
});

async function call(method, url, body, { auth = false } = {}) {
  const res = await fetch(base + url, {
    method,
    headers: {
      ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      ...(auth ? { Cookie: cookie } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const type = res.headers.get('content-type') || '';
  return { status: res.status, headers: res.headers, data: type.includes('json') ? await res.json() : await res.text() };
}

const employee = {
  name: 'أحمد علي', employeeId: '١٢٣٤٥', jobTitle: 'مهندس شبكات', department: 'الشبكات', phone: '0912345678', pledge: true,
};

test('normalizes Arabic-Indic digits in employee ids', () => {
  assert.equal(normalizeEmployeeId(' ١٢٣ ٤٥ '), '12345');
  assert.equal(normalizeEmployeeId('ab-12'), 'AB-12');
});

test('document parser keeps article numbering and nested bullets', () => {
  const doc = parseDoc('# العنوان\n> فرعي\n## مادة 1\n3. بند\n- فرعي\n4. بند آخر\n| أ | ب |');
  assert.equal(doc.title, 'العنوان');
  assert.equal(doc.toc.length, 1);
  assert.match(doc.html, /<li value="3">بند<ul><li>فرعي<\/li><\/ul><\/li><li value="4">/);
  assert.match(doc.html, /<th>أ<\/th>/);
});

test('serves charter and bylaws', async () => {
  const charter = await call('GET', '/api/docs/charter');
  assert.equal(charter.status, 200);
  assert.equal(charter.data.toc.length, 90);
  const bylaws = await call('GET', '/api/docs/bylaws');
  assert.equal(bylaws.data.toc.length, 17);
  assert.equal((await call('GET', '/api/docs/other')).status, 404);
});

test('home exposes seeded content without private fields', async () => {
  const { data } = await call('GET', '/api/home');
  assert.ok(data.activities.length > 0);
  assert.ok(data.ads.length > 0);
  assert.ok(data.quiz);
  assert.equal(data.stats.teams, 4);
  assert.ok(data.achievements.length >= 2, 'completed participations with results appear as achievements');
  assert.ok(data.upcoming.length >= 1);
  const quiz = await call('GET', '/api/quiz');
  assert.ok(quiz.data.current.questions.every((q) => !('correct' in q)), 'answers must not leak');
});

test('registration with approval flow, card issuance and verification', async () => {
  const acts = (await call('GET', '/api/activities')).data;
  const needsApproval = acts.find((a) => a.requiresApproval && a.isOpen);
  const instant = acts.find((a) => !a.requiresApproval && a.isOpen);

  const noPledge = await call('POST', `/api/activities/${needsApproval.id}/register`, { ...employee, pledge: false });
  assert.equal(noPledge.status, 400);

  const r1 = await call('POST', `/api/activities/${needsApproval.id}/register`, employee);
  assert.equal(r1.status, 201);
  assert.equal(r1.data.status, 'pending');
  assert.equal(r1.data.cardCode, null);

  const dup = await call('POST', `/api/activities/${needsApproval.id}/register`, { ...employee, employeeId: '12345' });
  assert.equal(dup.status, 409);

  const r2 = await call('POST', `/api/activities/${instant.id}/register`, employee);
  assert.equal(r2.data.status, 'approved');
  assert.ok(r2.data.cardCode);

  const card = await call('GET', `/api/cards/${r2.data.cardCode}`);
  assert.equal(card.status, 200);
  assert.equal(card.data.name, employee.name);
  assert.equal(card.data.employeeId, '12345');
  assert.match(card.data.verifyUrl, /#\/verify\//);
  const qr = await call('GET', `/api/cards/${r2.data.cardCode}/qr.svg`);
  assert.equal(qr.status, 200);
  assert.match(qr.data, /<svg/);

  const mine = await call('GET', '/api/my/registrations?employeeId=12345');
  assert.equal(mine.data.length, 2);
  assert.equal(mine.data.find((r) => r.status === 'pending').cardCode, null);
  assert.equal((await call('GET', '/api/cards/NOPE')).status, 404);
});

test('admin login, permissions and CSRF guard', async () => {
  assert.equal((await call('GET', '/api/admin/stats')).status, 401);
  const bad = await call('POST', '/api/auth/login', { username: 'admin', password: 'wrong' });
  assert.equal(bad.status, 401);
  const ok = await call('POST', '/api/auth/login', { username: 'admin', password: 'admin-pass-123' });
  assert.equal(ok.status, 200);
  cookie = ok.headers.get('set-cookie').split(';')[0];
  assert.match(ok.headers.get('set-cookie'), /HttpOnly/);

  const stats = await call('GET', '/api/admin/stats', undefined, { auth: true });
  assert.equal(stats.data.pendingRegistrations, 1);

  // طلب بدون JSON (نموذج HTML من موقع آخر) يُرفض
  const form = await fetch(`${base}/api/admin/posts`, { method: 'POST', headers: { Cookie: cookie, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'title=x' });
  assert.equal(form.status, 415);

  // عضو بصلاحية الأخبار فقط
  const created = await call('POST', '/api/admin/users', {
    username: 'media', name: 'المسؤول الإعلامي', password: 'media-pass-1', role: 'member', active: true, permissions: ['posts', 'bogus'],
  }, { auth: true });
  assert.equal(created.status, 201);
  assert.deepEqual(created.data.permissions, ['posts']);
  assert.equal(created.data.passwordHash, undefined);

  const login = await call('POST', '/api/auth/login', { username: 'media', password: 'media-pass-1' });
  const memberCookie = login.headers.get('set-cookie').split(';')[0];
  const asMember = (method, url, body) => fetch(base + url, {
    method, headers: { Cookie: memberCookie, 'Content-Type': 'application/json' }, body: body && JSON.stringify(body),
  });
  assert.equal((await asMember('GET', '/api/admin/posts')).status, 200);
  assert.equal((await asMember('GET', '/api/admin/registrations')).status, 403);
  assert.equal((await asMember('GET', '/api/admin/users')).status, 403);
  const post = await asMember('POST', '/api/admin/posts', { title: 'خبر جديد', type: 'news', published: true, image: 'javascript:alert(1)' });
  assert.equal(post.status, 201);
  assert.equal((await post.json()).image, '', 'unsafe image urls are dropped');
});

test('reviewing registrations requires a reason for rejection and issues cards on approval', async () => {
  const pending = (await call('GET', '/api/admin/registrations?status=pending', undefined, { auth: true })).data[0];
  const noReason = await call('PATCH', `/api/admin/registrations/${pending.id}`, { status: 'rejected' }, { auth: true });
  assert.equal(noReason.status, 400);
  const approved = await call('PATCH', `/api/admin/registrations/${pending.id}`, { status: 'approved' }, { auth: true });
  assert.equal(approved.data.status, 'approved');
  assert.ok(approved.data.cardCode);
  assert.match(approved.data.cardNo, /^\d{4}-\d{5}$/);

  const csv = await call('GET', '/api/admin/registrations.csv', undefined, { auth: true });
  assert.equal(csv.status, 200);
  const raw = Buffer.from(await (await fetch(`${base}/api/admin/registrations.csv`, { headers: { Cookie: cookie } })).arrayBuffer());
  assert.deepEqual([...raw.subarray(0, 3)], [0xef, 0xbb, 0xbf], 'UTF-8 BOM so Excel shows Arabic');
  assert.match(csv.data, /أحمد علي/);
});

test('weekly quiz: one submission per employee, scoring and winner draw', async () => {
  const { current } = (await call('GET', '/api/quiz')).data;
  const full = (await call('GET', '/api/admin/quizzes', undefined, { auth: true })).data.find((q) => q.id === current.id);
  const right = full.questions.map((q) => q.correct);
  const wrong = full.questions.map((q) => (q.correct + 1) % q.options.length);

  const incomplete = await call('POST', `/api/quiz/${current.id}/submit`, { ...employee, answers: [0] });
  assert.equal(incomplete.status, 400);
  const a = await call('POST', `/api/quiz/${current.id}/submit`, { ...employee, answers: right });
  assert.deepEqual(a.data, { score: right.length, total: right.length });
  const again = await call('POST', `/api/quiz/${current.id}/submit`, { ...employee, answers: right });
  assert.equal(again.status, 409);
  await call('POST', `/api/quiz/${current.id}/submit`, { ...employee, employeeId: '999', answers: wrong });

  const draw = await call('POST', `/api/admin/quizzes/${current.id}/draw`, { count: 3 }, { auth: true });
  assert.equal(draw.status, 200);
  assert.equal(draw.data.winners.length, 1, 'only top scorers are eligible');
  assert.equal(draw.data.winners[0].employeeId, '12345');
});

test('quiz validation rejects bad windows and empty questions', async () => {
  const bad = await call('POST', '/api/admin/quizzes', {
    title: 'x', startsAt: '2026-01-02T10:00', endsAt: '2026-01-01T10:00', questions: [{ text: 'q', options: ['a', 'b'], correct: 1 }],
  }, { auth: true });
  assert.equal(bad.status, 400);
  const noQ = await call('POST', '/api/admin/quizzes', {
    title: 'x', startsAt: '2026-01-01T10:00', endsAt: '2026-01-02T10:00', questions: [{ text: 'q', options: ['a'] }],
  }, { auth: true });
  assert.equal(noQ.status, 400);
});

test('polls: one vote per employee and results visibility', async () => {
  const [poll] = (await call('GET', '/api/polls')).data;
  const vote = await call('POST', `/api/polls/${poll.id}/vote`, { name: 'أ', employeeId: '1', optionId: poll.options[0].id });
  assert.equal(vote.status, 201);
  assert.equal(vote.data.results[poll.options[0].id], 1);
  const twice = await call('POST', `/api/polls/${poll.id}/vote`, { name: 'أ', employeeId: '١', optionId: poll.options[1].id });
  assert.equal(twice.status, 409);
  const badOption = await call('POST', `/api/polls/${poll.id}/vote`, { name: 'ب', employeeId: '2', optionId: 'zzz' });
  assert.equal(badOption.status, 400);

  const hidden = await call('POST', '/api/admin/polls', {
    title: 'سري', startsAt: '2020-01-01T00:00', endsAt: '2099-01-01T00:00', published: true, resultsVisibility: 'admin',
    options: [{ label: 'نعم' }, { label: 'لا' }],
  }, { auth: true });
  const list = (await call('GET', '/api/polls')).data;
  assert.equal(list.find((p) => p.id === hidden.data.id).results, null);
});

test('complaints get a ticket, email the committee and can be tracked', async () => {
  const missing = await call('POST', '/api/complaints', { ...employee, phone: '', subject: 's', message: 'm' });
  assert.equal(missing.status, 400);
  const r = await call('POST', '/api/complaints', { ...employee, type: 'problem', subject: 'مشكلة في التسجيل', message: 'تفاصيل' });
  assert.equal(r.status, 201);
  assert.match(r.data.ticket, /^T-\d{4}-0001$/);
  assert.ok(mails.some((m) => m.subject.includes(r.data.ticket)));

  const list = (await call('GET', '/api/admin/complaints', undefined, { auth: true })).data;
  await call('PATCH', `/api/admin/complaints/${list[0].id}`, { status: 'resolved', response: 'تم الحل' }, { auth: true });
  const tracked = await call('GET', `/api/complaints/track?ticket=${r.data.ticket.toLowerCase()}&employeeId=12345`);
  assert.equal(tracked.data.status, 'resolved');
  assert.equal(tracked.data.response, 'تم الحل');
  assert.equal((await call('GET', `/api/complaints/track?ticket=${r.data.ticket}&employeeId=1`)).status, 404);
});

test('talent inventory form: validation, one active request per employee, committee evaluation and export', async () => {
  const form = {
    name: 'أحمد علي محمد الورفلي', employeeId: '١٢٣٤٥', age: 31, branch: 'فرع المنطقة الغربية', department: 'الشبكات',
    division: 'دائرة التشغيل', section: 'قسم الصيانة', phone: '0912345678', email: 'a@x.ly',
    fields: ['sports', 'innovation', 'bogus'], sportType: 'team', fieldDescription: 'كرة القدم والبرمجة',
    level: 'advanced', levelDescription: 'لاعب في نادي الاتحاد', achievements: 'بطولة 2024',
    needs: ['training', 'other'], otherNeed: 'أخصائي تغذية', needsDescription: 'دورات تدريبية', extra: 'لا شيء', consent: true,
  };
  assert.equal((await call('POST', '/api/talents', { ...form, consent: false })).status, 400);
  assert.equal((await call('POST', '/api/talents', { ...form, fields: [] })).status, 400, 'a field is required');
  assert.equal((await call('POST', '/api/talents', { ...form, fields: ['other'] })).status, 400, '"other" needs a description');
  assert.equal((await call('POST', '/api/talents', { ...form, level: '' })).status, 400, 'level is required');
  assert.equal((await call('POST', '/api/talents', { ...form, age: 7 })).status, 400);
  assert.equal((await call('POST', '/api/talents', form)).status, 201);
  assert.equal((await call('POST', '/api/talents', { ...form, fields: ['arts'] })).status, 409, 'one active request per employee');
  assert.equal((await call('GET', '/api/talents/stats')).data.registered, 0, 'new requests are not counted until accepted');

  const [t] = (await call('GET', '/api/admin/talents', undefined, { auth: true })).data;
  assert.deepEqual(t.fields, ['sports', 'innovation']);
  assert.equal(t.employeeId, '12345');
  assert.equal(t.sportType, 'team');
  assert.equal(t.otherNeed, 'أخصائي تغذية');
  const upd = await call('PATCH', `/api/admin/talents/${t.id}`, { status: 'sponsored', rating: 4, evaluation: 'موهبة واعدة' }, { auth: true });
  assert.equal(upd.data.status, 'sponsored');
  const stats = (await call('GET', '/api/talents/stats')).data;
  assert.deepEqual([stats.registered, stats.sponsored, stats.byField.sports, stats.byField.innovation], [1, 1, 1, 1]);

  const csv = await call('GET', '/api/admin/talents.csv', undefined, { auth: true });
  assert.equal(csv.status, 200);
  assert.match(csv.data, /أحمد علي محمد الورفلي/);
  assert.match(csv.data, /رياضة \(جماعية\)، ابتكار/);
  assert.match(csv.data, /تدريب ودورات، أخصائي تغذية/);
});

test('teams: public view hides employee ids and lists linked participations; deleting unlinks', async () => {
  const team = await call('POST', '/api/admin/teams', {
    name: 'منتخب الشطرنج', category: 'cultural', status: 'training', published: true, needs: 'ساعات شطرنج',
    members: [{ name: 'لاعب أ', employeeId: '١١١', role: 'الرقعة الأولى' }, { name: '' }],
  }, { auth: true });
  assert.equal(team.status, 201);
  assert.equal(team.data.members.length, 1);
  assert.equal(team.data.members[0].employeeId, '111');
  const act = await call('POST', '/api/admin/activities', {
    title: 'بطولة الشطرنج للمؤسسات', category: 'cultural', level: 'regional', status: 'preparing', teamId: team.data.id, published: true,
    checklist: [{ label: 'الزي', done: true }, { label: 'السفر', done: false }], resultRank: 'nope',
  }, { auth: true });
  assert.equal(act.data.resultRank, '', 'unknown result ranks are dropped');
  const pub = (await call('GET', '/api/teams')).data.find((t) => t.id === team.data.id);
  assert.equal(pub.members[0].employeeId, undefined);
  assert.equal(pub.needs, undefined, 'support needs stay internal');
  assert.equal(pub.participations[0].title, 'بطولة الشطرنج للمؤسسات');
  const view = (await call('GET', `/api/activities/${act.data.id}`)).data;
  assert.deepEqual(view.prep, { done: 1, total: 2 });
  assert.equal(view.team.name, 'منتخب الشطرنج');
  assert.equal(view.isOpen, false, 'nominations only open in the open stage');
  assert.equal((await call('POST', `/api/activities/${act.data.id}/register`, employee)).status, 400);
  await call('DELETE', `/api/admin/teams/${team.data.id}`, undefined, { auth: true });
  assert.equal((await call('GET', `/api/activities/${act.data.id}`)).data.team, null);
});

test('nominations support a reserve list and manager notification tracking', async () => {
  const acts = (await call('GET', '/api/activities?status=open')).data;
  assert.ok(acts.every((a) => a.status === 'open'));
  const target = acts.find((a) => a.requiresApproval);
  const r = await call('POST', `/api/activities/${target.id}/register`, { ...employee, employeeId: '777', affiliation: 'national', clubName: 'المنتخب الوطني' });
  assert.equal(r.status, 201);
  const reserve = await call('PATCH', `/api/admin/registrations/${r.data.id}`, { status: 'reserve' }, { auth: true });
  assert.equal(reserve.data.status, 'reserve');
  assert.equal(reserve.data.cardCode, undefined, 'reserves get no card');
  const notified = await call('PATCH', `/api/admin/registrations/${r.data.id}`, { managerNotified: true }, { auth: true });
  assert.equal(notified.data.managerNotified, true);
  assert.equal(notified.data.status, 'reserve', 'toggling notification keeps the status');
  assert.equal(notified.data.affiliation, 'national');
});

test('settings update social links and reject unsafe urls', async () => {
  const s = (await call('GET', '/api/admin/settings', undefined, { auth: true })).data;
  await call('PUT', '/api/admin/settings', {
    ...s, phone: '1414', departments: 'أ\nب', social: { facebook: 'https://facebook.com/x', tiktok: 'javascript:alert(1)' },
  }, { auth: true });
  const pub = (await call('GET', '/api/settings')).data;
  assert.equal(pub.social.facebook, 'https://facebook.com/x');
  assert.equal(pub.social.tiktok, '');
  assert.deepEqual(pub.departments, ['أ', 'ب']);
});

test('image upload accepts only raster images', async () => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
  const ok = await call('POST', '/api/admin/upload', { dataUrl: png }, { auth: true });
  assert.equal(ok.status, 201);
  const file = await fetch(base + ok.data.url);
  assert.equal(file.status, 200);
  const svg = await call('POST', '/api/admin/upload', { dataUrl: 'data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=' }, { auth: true });
  assert.equal(svg.status, 400);
});

test('the last admin cannot be removed or demoted', async () => {
  const users = (await call('GET', '/api/admin/users', undefined, { auth: true })).data;
  const admin = users.find((u) => u.username === 'admin');
  const demote = await call('PUT', `/api/admin/users/${admin.id}`, { ...admin, role: 'member' }, { auth: true });
  assert.equal(demote.status, 400);
  const self = await call('DELETE', `/api/admin/users/${admin.id}`, undefined, { auth: true });
  assert.equal(self.status, 400);
});

test('data persists across restarts', async () => {
  const { store } = createApp({ dataDir, log: () => {} });
  assert.ok(store.all('registrations').length >= 2);
  assert.ok(store.all('complaints').length >= 1);
});

test('older databases migrate to the external-participation model', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'activities-old-'));
  fs.writeFileSync(path.join(dir, 'db.json'), JSON.stringify({
    settings: { committeeName: 'لجنة', companyName: 'شركة', tagline: 'معاً نصنع بيئة عمل نابضة بالحياة — رياضة، ثقافة، فن وتطوع' },
    users: [{ id: 'u1', username: 'x', role: 'member', permissions: ['stars', 'posts'], active: true }],
    activities: [{ id: 'a1', title: 'قديم', status: 'closed', published: true }],
    stars: [{ id: 's1', name: 'نجم' }], ideas: [],
    talents: [{ id: 't1', name: 'قديم', employeeId: '5', category: 'arts', discipline: 'الخط العربي', level: 'club', clubName: 'مركز الفنون', needs: 'أدوات', status: 'new', createdAt: '2026-01-01' }],
  }));
  const { store } = createApp({ dataDir: dir, log: () => {} });
  const a = store.find('activities', 'a1');
  assert.equal(a.status, 'selection');
  assert.equal(a.checklist.length, 8);
  assert.deepEqual(store.find('users', 'u1').permissions.sort(), ['posts', 'talents']);
  assert.match(store.data.settings.tagline, /محفل/);
  assert.deepEqual(store.all('teams'), []);
  const t = store.find('talents', 't1');
  assert.deepEqual([t.fields, t.fieldDescription, t.level, t.levelDescription, t.needsDescription], [['arts'], 'الخط العربي', 'advanced', 'مركز الفنون', 'أدوات']);
  assert.deepEqual(t.needs, []);
  fs.rmSync(dir, { recursive: true, force: true });
});
