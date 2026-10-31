// خادم المنصة: واجهة برمجية عامة للموظفين + واجهة برمجية محمية للوحة تحكم اللجنة.
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import QRCode from 'qrcode';
import { createStore, newId } from './store.js';
import {
  PERMISSIONS, hashPassword, verifyPassword, userPermissions, createSessions, parseCookies,
} from './auth.js';
import { loadDocs } from './docs.js';
import { buildSeed, generatePassword } from './seed.js';
import { createMailer } from './mailer.js';
import { DEFAULT_CHECKLIST } from './checklist.js';

export { DEFAULT_CHECKLIST };

export const CATEGORIES = {
  sports: 'رياضية', cultural: 'ثقافية', arts: 'فنية', volunteer: 'تطوعية', social: 'اجتماعية', other: 'أخرى',
};
export const POST_TYPES = { announcement: 'إعلان', decision: 'قرار', news: 'خبر' };
const COMPLAINT_TYPES = { support: 'طلب دعم وتجهيز', complaint: 'شكوى', problem: 'مشكلة', suggestion: 'مقترح' };
const CONTRACT_TYPES = ['دائم', 'محدد المدة', 'متعاون'];
// مراحل المشاركة الخارجية من فتح باب الترشح حتى إعلان النتيجة.
export const STAGES = {
  open: 'باب الترشح مفتوح', selection: 'الاختيار والاختبارات', preparing: 'التجهيز والتدريب',
  competing: 'المشاركة جارية', completed: 'منتهية',
};
export const LEVELS = { local: 'محلية', regional: 'إقليمية', international: 'دولية' };
export const RESULT_RANKS = {
  '': 'لم تُسجَّل بعد', gold: 'المركز الأول', silver: 'المركز الثاني', bronze: 'المركز الثالث',
  honor: 'تكريم / جائزة خاصة', participation: 'مشاركة مشرّفة',
};
const AFFILIATIONS = { none: 'غير منتسب', club: 'منتسب لنادٍ', national: 'منتسب لمنتخب وطني', other: 'جهة أخرى' };
// نموذج حصر المواهب داخل شركة المدار الجديد.
const TALENT_FIELDS = { sports: 'رياضة', literature: 'أدب', innovation: 'ابتكار', arts: 'فنون', media: 'إعلام', other: 'أخرى' };
const TALENT_FIELD_HINTS = {
  sports: 'جماعية – فردية', literature: 'كتابة – شعر – قصة – رواية – الخ', innovation: 'اختراع – برمجة – أبحاث – علوم – الخ',
  arts: 'رسم – خط – تصوير – تصميم – الخ', media: 'مونتاج – إخراج – إذاعة – تقديم – صناعة محتوى – الخ', other: '',
};
const SPORT_TYPES = { team: 'جماعية', individual: 'فردية' };
const TALENT_LEVELS = { beginner: 'مبتدئ', intermediate: 'متوسط', advanced: 'متقدم', professional: 'محترف' };
const TALENT_NEEDS = { training: 'تدريب ودورات', equipment: 'تجهيز وأدوات', exposure: 'فرص عرض ومشاركة', media: 'دعم إعلامي', other: 'أخرى' };
const BRANCHES = ['الإدارة العامة', 'فرع المنطقة الغربية', 'فرع المنطقة الشرقية', 'فرع المنطقة الجنوبية', 'فرع المنطقة الوسطى'];
const keysOf = (dict) => (v) => [...new Set((Array.isArray(v) ? v : []).map(String).filter((k) => k in dict))];
const TALENT_STATUSES = ['new', 'evaluating', 'registered', 'sponsored', 'declined'];
const TEAM_STATUSES = { forming: 'قيد التشكيل', training: 'في مرحلة الإعداد', active: 'جاهز للمشاركة', inactive: 'غير نشط' };

class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const fail = (status, message) => { throw new HttpError(status, message); };

// ---------- منظّفات الحقول ----------
const str = (max = 200) => (v) => (v == null ? '' : String(v).trim().slice(0, max));
const int = (min = 0, max = 1e6) => (v) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
};
const bool = (v) => v === true || v === 'true' || v === 'on' || v === 1;
const oneOf = (values, def) => (v) => (values.includes(v) ? v : def);
const date = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v ?? '')) ? String(v) : '');
const dateTime = (v) => {
  const s = String(v ?? '').slice(0, 16);
  return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(s) ? s : '';
};
const link = (v) => {
  const s = str(500)(v);
  return /^(https?:\/\/|\/(?!\/))/i.test(s) ? s : '';
};
const lines = (max = 100) => (v) => (Array.isArray(v) ? v : String(v ?? '').split('\n'))
  .map((x) => String(x).trim()).filter(Boolean).slice(0, max).map((x) => x.slice(0, 200));

function clean(body, schema) {
  const out = {};
  for (const [k, fn] of Object.entries(schema)) out[k] = fn(body?.[k]);
  return out;
}

function requireFields(obj, fields) {
  for (const [key, label] of Object.entries(fields)) {
    if (!obj[key]) fail(400, `الحقل «${label}» مطلوب`);
  }
}

// الأرقام العربية الهندية إلى لاتينية، وإزالة الفراغات من الرقم الوظيفي.
export const normalizeEmployeeId = (v) => String(v ?? '')
  .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x660))
  .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x6f0))
  .replace(/\s+/g, '').toUpperCase().slice(0, 30);

const toTime = (s, endOfDay = false) => {
  if (!s) return NaN;
  const full = s.length === 10 ? `${s}T${endOfDay ? '23:59:59' : '00:00:00'}` : s;
  return new Date(full).getTime();
};

function windowStatus(item, now = Date.now()) {
  if (now < toTime(item.startsAt)) return 'upcoming';
  if (now > toTime(item.endsAt)) return 'ended';
  return 'active';
}

const byDateDesc = (key) => (a, b) => String(b[key] || '').localeCompare(String(a[key] || ''));

const randomCode = (len = 10) => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(len);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join('');
};

function rateLimiter({ windowMs, max }) {
  const hits = new Map();
  return (req, res, next) => {
    const now = Date.now();
    const key = req.ip;
    const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
    if (list.length >= max) {
      res.status(429).json({ error: 'عدد كبير من المحاولات، يرجى المحاولة بعد قليل' });
      return;
    }
    list.push(now);
    hits.set(key, list);
    if (hits.size > 5000) hits.clear();
    next();
  };
}

// ---------- مخططات الموارد التي تديرها اللجنة ----------
const questionsSchema = (v) => (Array.isArray(v) ? v : []).slice(0, 50).map((q) => {
  const options = (Array.isArray(q?.options) ? q.options : []).map(str(200)).filter(Boolean).slice(0, 8);
  return {
    id: str(40)(q?.id) || newId(),
    text: str(500)(q?.text),
    options,
    correct: Math.min(int(0, 7)(q?.correct), Math.max(0, options.length - 1)),
  };
}).filter((q) => q.text && q.options.length >= 2);

const pollOptionsSchema = (v) => (Array.isArray(v) ? v : []).slice(0, 20)
  .map((o) => ({ id: str(40)(o?.id) || newId(), label: str(200)(o?.label) }))
  .filter((o) => o.label);

const checklistSchema = (v) => (Array.isArray(v) ? v : []).slice(0, 40)
  .map((c) => ({ label: str(200)(c?.label), done: bool(c?.done) }))
  .filter((c) => c.label);

const membersSchema = (v) => (Array.isArray(v) ? v : []).slice(0, 80)
  .map((m) => ({ name: str(120)(m?.name), employeeId: normalizeEmployeeId(m?.employeeId), role: str(80)(m?.role) }))
  .filter((m) => m.name);

const RESOURCES = {
  activities: {
    perm: 'activities',
    sort: byDateDesc('startDate'),
    schema: {
      title: str(200), category: oneOf(Object.keys(CATEGORIES), 'other'), description: str(5000),
      organizer: str(200), level: oneOf(Object.keys(LEVELS), 'local'),
      location: str(200), startDate: date, endDate: date, deadline: date, capacity: int(0, 100000),
      image: link, status: oneOf(Object.keys(STAGES), 'open'), teamId: str(40), checklist: checklistSchema,
      budget: int(0, 1e9), resultRank: oneOf(Object.keys(RESULT_RANKS), ''), result: str(300), resultNotes: str(5000),
      published: bool, requiresApproval: bool,
    },
    validate: (d) => requireFields(d, { title: 'عنوان المشاركة' }),
    cascade: { registrations: 'activityId' },
  },
  teams: {
    perm: 'teams',
    sort: (a, b) => String(a.name).localeCompare(String(b.name), 'ar'),
    schema: {
      name: str(160), category: oneOf(Object.keys(CATEGORIES), 'sports'), description: str(3000),
      coach: str(120), manager: str(120), captain: str(120), image: link,
      status: oneOf(Object.keys(TEAM_STATUSES), 'forming'), schedule: str(1000), needs: str(2000),
      members: membersSchema, published: bool,
    },
    validate: (d) => requireFields(d, { name: 'اسم الفريق / المنتخب' }),
    onDelete: (store, id) => { for (const a of store.all('activities')) if (a.teamId === id) a.teamId = ''; },
  },
  posts: {
    perm: 'posts',
    sort: byDateDesc('publishedAt'),
    schema: {
      type: oneOf(Object.keys(POST_TYPES), 'news'), title: str(200), summary: str(500), body: str(20000),
      image: link, pinned: bool, published: bool, publishedAt: date,
    },
    validate: (d) => {
      requireFields(d, { title: 'العنوان' });
      if (!d.publishedAt) d.publishedAt = new Date().toISOString().slice(0, 10);
    },
  },
  quizzes: {
    perm: 'quizzes',
    sort: byDateDesc('startsAt'),
    schema: {
      title: str(200), description: str(2000), prize: str(300), winnersCount: int(1, 100),
      startsAt: dateTime, endsAt: dateTime, published: bool, questions: questionsSchema,
    },
    validate: (d) => {
      requireFields(d, { title: 'عنوان المسابقة', startsAt: 'تاريخ البداية', endsAt: 'تاريخ النهاية' });
      if (toTime(d.endsAt) <= toTime(d.startsAt)) fail(400, 'يجب أن يكون تاريخ النهاية بعد تاريخ البداية');
      if (!d.questions.length) fail(400, 'أضف سؤالاً واحداً على الأقل بخيارين أو أكثر');
    },
    onCreate: (d) => { d.winners = []; },
    cascade: { quizSubmissions: 'quizId' },
  },
  polls: {
    perm: 'polls',
    sort: byDateDesc('startsAt'),
    schema: {
      title: str(200), description: str(2000), options: pollOptionsSchema, startsAt: dateTime, endsAt: dateTime,
      published: bool, resultsVisibility: oneOf(['always', 'after_close', 'admin'], 'always'),
    },
    validate: (d) => {
      requireFields(d, { title: 'عنوان التصويت', startsAt: 'تاريخ البداية', endsAt: 'تاريخ النهاية' });
      if (toTime(d.endsAt) <= toTime(d.startsAt)) fail(400, 'يجب أن يكون تاريخ النهاية بعد تاريخ البداية');
      if (d.options.length < 2) fail(400, 'أضف خيارين على الأقل');
    },
    cascade: { votes: 'pollId' },
  },
  members: {
    perm: 'members',
    sort: (a, b) => a.order - b.order,
    schema: {
      name: str(120), position: str(120), jobTitle: str(160), department: str(160), bio: str(5000),
      tasks: str(5000), photo: link, email: str(160), order: int(0, 1000),
    },
    validate: (d) => requireFields(d, { name: 'الاسم', position: 'الصفة في اللجنة' }),
  },
};

export function createApp({ dataDir, adminPassword, mailer = createMailer(), log = console.log } = {}) {
  const root = new URL('../', import.meta.url);
  const publicDir = new URL('public/', root);
  const uploadsDir = path.join(dataDir, 'uploads');
  fs.mkdirSync(uploadsDir, { recursive: true });

  let initialPassword = null;
  const store = createStore(path.join(dataDir, 'db.json'), () => {
    initialPassword = adminPassword || generatePassword();
    return buildSeed({ adminPassword: initialPassword });
  });
  // صور الأنشطة التجريبية التي أُضيفت بعد الإصدار الأول: تُملأ فقط إن كانت الصورة ما زالت فارغة.
  const SAMPLE_IMAGES = {
    'مسابقة حفظ القرآن الكريم': '/assets/quran-competition.webp',
    'معرض المواهب الفنية: تصوير ورسم وخط عربي': '/assets/art-talents.webp',
    'حملة التبرع بالدم': '/assets/blood-donation.webp',
  };
  const missing = store.all('activities').filter((a) => !a.image && SAMPLE_IMAGES[a.title]);
  for (const a of missing) a.image = SAMPLE_IMAGES[a.title];
  if (missing.length) store.save();

  const S0 = () => store.data.settings;
  // ترحيل بيانات الإصدارات السابقة إلى نموذج المشاركات الخارجية.
  let migrated = false;
  for (const a of store.all('activities')) {
    if (a.status === 'closed') { a.status = 'selection'; migrated = true; }
    if (!Array.isArray(a.checklist)) {
      Object.assign(a, { checklist: DEFAULT_CHECKLIST.map((label) => ({ label, done: false })), level: a.level || 'local', organizer: a.organizer || '' });
      migrated = true;
    }
  }
  for (const u of store.all('users')) {
    if (u.permissions?.includes('stars')) {
      u.permissions = [...new Set(u.permissions.map((x) => (x === 'stars' ? 'talents' : x)))];
      migrated = true;
    }
  }
  // طلبات المواهب بصيغة الإصدار السابق ← حقول نموذج حصر المواهب.
  const oldCategoryToField = { sports: 'sports', cultural: 'literature', arts: 'arts', volunteer: 'other', social: 'other', other: 'other' };
  const oldLevelToNew = { amateur: 'beginner', regular: 'intermediate', club: 'advanced', national: 'advanced', professional: 'professional' };
  for (const t of store.all('talents')) {
    if (Array.isArray(t.fields)) continue;
    t.fields = [oldCategoryToField[t.category] || 'other'];
    t.fieldDescription = t.discipline || '';
    t.level = oldLevelToNew[t.level] || 'beginner';
    t.levelDescription = [t.clubName].filter(Boolean).join(' — ');
    t.needsDescription = typeof t.needs === 'string' ? t.needs : '';
    t.needs = [];
    migrated = true;
  }
  if (S0().tagline === 'معاً نصنع بيئة عمل نابضة بالحياة — رياضة، ثقافة، فن وتطوع') {
    S0().tagline = 'نمثّل الشركة بفخر في كل محفل — بطولات، مسابقات، ومواهب نرعاها ونجهّزها';
    migrated = true;
  }
  if (migrated) store.save();

  const docs = loadDocs(new URL('content/', root));
  const sessions = createSessions();
  const S = () => store.data.settings;

  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 'loopback');
  app.use((req, res, next) => {
    res.set({
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'SAMEORIGIN',
      'Referrer-Policy': 'same-origin',
    });
    next();
  });
  app.use(express.json({ limit: '8mb' }));

  const publicLimiter = rateLimiter({ windowMs: 60_000, max: 30 });
  const loginLimiter = rateLimiter({ windowMs: 15 * 60_000, max: 10 });

  // ---------- مساعدات العرض ----------
  const publicSettings = () => {
    const s = S();
    return {
      committeeName: s.committeeName, companyName: s.companyName, tagline: s.tagline,
      email: s.email, phone: s.phone, whatsapp: s.whatsapp, social: s.social || {},
      departments: s.departments || [], maxActivitiesPerEmployee: s.maxActivitiesPerEmployee || 0,
      categories: CATEGORIES, postTypes: POST_TYPES, complaintTypes: COMPLAINT_TYPES, contractTypes: CONTRACT_TYPES,
      stages: STAGES, levels: LEVELS, resultRanks: RESULT_RANKS, affiliations: AFFILIATIONS,
      talentLevels: TALENT_LEVELS, talentFields: TALENT_FIELDS, talentFieldHints: TALENT_FIELD_HINTS, sportTypes: SPORT_TYPES,
      talentNeeds: TALENT_NEEDS, branches: BRANCHES, teamStatuses: TEAM_STATUSES, defaultChecklist: DEFAULT_CHECKLIST,
    };
  };

  const activeRegistrations = (activityId) => store.all('registrations')
    .filter((r) => r.activityId === activityId && r.status !== 'rejected');

  const activityView = (a) => {
    const registered = activeRegistrations(a.id).length;
    const deadlinePassed = a.deadline ? Date.now() > toTime(a.deadline, true) : false;
    const full = a.capacity > 0 && registered >= a.capacity;
    const team = a.teamId ? store.find('teams', a.teamId) : null;
    const checklist = a.checklist || [];
    return {
      id: a.id, title: a.title, category: a.category, categoryLabel: CATEGORIES[a.category],
      description: a.description, organizer: a.organizer || '', level: a.level || 'local', levelLabel: LEVELS[a.level || 'local'],
      location: a.location, startDate: a.startDate, endDate: a.endDate,
      deadline: a.deadline, capacity: a.capacity, image: a.image, status: a.status, stageLabel: STAGES[a.status] || '',
      requiresApproval: a.requiresApproval, registered,
      team: team && team.published ? { id: team.id, name: team.name } : null,
      prep: { done: checklist.filter((c) => c.done).length, total: checklist.length },
      resultRank: a.resultRank || '', resultLabel: a.resultRank ? RESULT_RANKS[a.resultRank] : '', result: a.result || '',
      resultNotes: a.status === 'completed' ? a.resultNotes || '' : '',
      isOpen: a.status === 'open' && !deadlinePassed && !full,
      closedReason: a.status !== 'open' ? `${STAGES[a.status] || 'الترشح مغلق'}`
        : deadlinePassed ? 'انتهى موعد الترشح' : full ? 'اكتمل العدد المطلوب' : '',
    };
  };

  const teamPublic = (t) => ({
    id: t.id, name: t.name, category: t.category, categoryLabel: CATEGORIES[t.category], description: t.description,
    coach: t.coach, manager: t.manager, captain: t.captain, image: t.image, status: t.status,
    statusLabel: TEAM_STATUSES[t.status], schedule: t.schedule,
    members: (t.members || []).map(({ name, role }) => ({ name, role })),
    participations: store.all('activities').filter((a) => a.published && a.teamId === t.id)
      .sort(byDateDesc('startDate')).map((a) => ({ id: a.id, title: a.title, status: a.status, stageLabel: STAGES[a.status], startDate: a.startDate, resultLabel: a.resultRank ? RESULT_RANKS[a.resultRank] : '' })),
  });

  const achievements = () => store.all('activities')
    .filter((a) => a.published && a.status === 'completed' && a.resultRank)
    .sort(byDateDesc('endDate')).map(activityView);

  const publishedPosts = () => store.all('posts').filter((p) => p.published).sort((a, b) => (
    (b.pinned - a.pinned) || String(b.publishedAt).localeCompare(String(a.publishedAt))
  ));

  const quizPublic = (q, { withAnswers = false } = {}) => ({
    id: q.id, title: q.title, description: q.description, prize: q.prize, startsAt: q.startsAt, endsAt: q.endsAt,
    status: windowStatus(q), winnersCount: q.winnersCount,
    participants: store.all('quizSubmissions').filter((s) => s.quizId === q.id).length,
    questions: q.questions.map((x) => ({
      id: x.id, text: x.text, options: x.options, ...(withAnswers ? { correct: x.correct } : {}),
    })),
    winners: withAnswers ? (q.winners || []).map((w) => ({ name: w.name, department: w.department, score: w.score })) : [],
  });

  const pollResults = (p) => {
    const votes = store.all('votes').filter((v) => v.pollId === p.id);
    const counts = Object.fromEntries(p.options.map((o) => [o.id, 0]));
    for (const v of votes) if (v.optionId in counts) counts[v.optionId] += 1;
    return { total: votes.length, counts };
  };

  const pollPublic = (p) => {
    const status = windowStatus(p);
    const visible = p.resultsVisibility === 'always' || (p.resultsVisibility === 'after_close' && status === 'ended');
    const results = pollResults(p);
    return {
      id: p.id, title: p.title, description: p.description, startsAt: p.startsAt, endsAt: p.endsAt, status,
      options: p.options, totalVotes: results.total, results: visible ? results.counts : null,
      resultsVisibility: p.resultsVisibility,
    };
  };

  const cardView = (reg, req) => {
    const a = store.find('activities', reg.activityId);
    const base = S().publicUrl || `${req.protocol}://${req.get('host')}`;
    return {
      code: reg.cardCode, cardNo: reg.cardNo, name: reg.name, employeeId: reg.employeeId, jobTitle: reg.jobTitle,
      department: reg.department, issuedAt: reg.cardIssuedAt,
      activity: a ? {
        title: a.title, category: a.category, categoryLabel: CATEGORIES[a.category],
        startDate: a.startDate, endDate: a.endDate, location: a.location,
        organizer: a.organizer || '', levelLabel: LEVELS[a.level || 'local'],
        team: a.teamId ? store.find('teams', a.teamId)?.name || '' : '',
      } : { title: 'مشاركة محذوفة' },
      verifyUrl: `${base.replace(/\/$/, '')}/#/verify/${reg.cardCode}`,
    };
  };

  const issueCard = (reg) => {
    if (reg.cardCode) return;
    reg.cardCode = randomCode(10);
    reg.cardNo = `${new Date().getFullYear()}-${String(store.nextSerial('cardSerial')).padStart(5, '0')}`;
    reg.cardIssuedAt = new Date().toISOString();
  };

  const notifyCommittee = (subject, text, replyTo) => {
    mailer.send({ to: S().email, subject, text, replyTo }).catch(() => {});
  };

  // ======================================================================
  // الواجهة البرمجية العامة
  // ======================================================================
  app.get('/api/settings', (req, res) => res.json(publicSettings()));

  app.get('/api/home', (req, res) => {
    const posts = publishedPosts();
    const activities = store.all('activities').filter((a) => a.published).map(activityView);
    const quiz = store.all('quizzes').find((q) => q.published && windowStatus(q) === 'active');
    const polls = store.all('polls').filter((p) => p.published && windowStatus(p) === 'active');
    const wins = achievements();
    const teams = store.all('teams').filter((t) => t.published);
    res.json({
      settings: publicSettings(),
      ads: posts.filter((p) => p.pinned).slice(0, 5),
      latest: posts.slice(0, 6),
      activities: activities.filter((a) => a.isOpen).slice(0, 6),
      upcoming: activities.filter((a) => ['selection', 'preparing', 'competing'].includes(a.status))
        .sort((a, b) => String(a.startDate).localeCompare(String(b.startDate))).slice(0, 6),
      teams: teams.slice(0, 6).map(teamPublic),
      achievements: wins.slice(0, 6),
      quiz: quiz ? { id: quiz.id, title: quiz.title, prize: quiz.prize, endsAt: quiz.endsAt } : null,
      polls: polls.map((p) => ({ id: p.id, title: p.title, endsAt: p.endsAt })),
      stats: {
        activities: activities.length,
        teams: teams.length,
        participants: new Set(store.all('registrations').filter((r) => r.status === 'approved').map((r) => r.employeeId)).size,
        talents: store.all('talents').filter((t) => ['registered', 'sponsored'].includes(t.status)).length,
        medals: wins.filter((a) => ['gold', 'silver', 'bronze'].includes(a.resultRank)).length,
      },
    });
  });

  app.get('/api/activities', (req, res) => {
    const { category, status } = req.query;
    const list = store.all('activities')
      .filter((a) => a.published && (!category || a.category === category) && (!status || a.status === status))
      .map(activityView)
      .sort((a, b) => (b.isOpen - a.isOpen) || String(a.startDate).localeCompare(String(b.startDate)));
    res.json(list);
  });

  app.get('/api/activities/:id', (req, res) => {
    const a = store.find('activities', req.params.id);
    if (!a || !a.published) fail(404, 'المشاركة غير موجودة');
    res.json(activityView(a));
  });

  app.post('/api/activities/:id/register', publicLimiter, (req, res) => {
    const a = store.find('activities', req.params.id);
    if (!a || !a.published) fail(404, 'المشاركة غير موجودة');
    const view = activityView(a);
    if (!view.isOpen) fail(400, view.closedReason || 'باب الترشح غير مفتوح');
    const d = clean(req.body, {
      name: str(120), employeeId: normalizeEmployeeId, jobTitle: str(160), department: str(160),
      phone: str(30), email: str(160), contractType: oneOf(CONTRACT_TYPES, ''), experience: str(1000),
      notes: str(1000), pledge: bool, affiliation: oneOf(Object.keys(AFFILIATIONS), 'none'), clubName: str(160),
    });
    requireFields(d, {
      name: 'الاسم', employeeId: 'الرقم الوظيفي', jobTitle: 'الوصف الوظيفي', department: 'الإدارة / المكتب', phone: 'رقم الهاتف',
    });
    if (!d.pledge) fail(400, 'يجب الإقرار بالالتزام ببنود الميثاق قبل الترشح');
    const mine = store.all('registrations').filter((r) => r.employeeId === d.employeeId && r.status !== 'rejected');
    if (mine.some((r) => r.activityId === a.id)) fail(409, 'هذا الرقم الوظيفي مرشّح مسبقاً لهذه المشاركة');
    const max = S().maxActivitiesPerEmployee || 0;
    if (max > 0) {
      const live = mine.filter((r) => {
        const act = store.find('activities', r.activityId);
        return act && act.status !== 'completed';
      });
      if (live.length >= max) fail(400, `وفق الميثاق لا يُسمح بالترشح لأكثر من ${max} مشاركات في نفس الوقت`);
    }
    const reg = {
      ...d, activityId: a.id, status: a.requiresApproval ? 'pending' : 'approved', reviewNote: '',
    };
    if (reg.status === 'approved') issueCard(reg);
    const saved = store.insert('registrations', reg);
    res.status(201).json({ id: saved.id, status: saved.status, cardCode: saved.cardCode || null });
  });

  app.get('/api/my/registrations', publicLimiter, (req, res) => {
    const employeeId = normalizeEmployeeId(req.query.employeeId);
    if (!employeeId) fail(400, 'أدخل الرقم الوظيفي');
    const list = store.all('registrations').filter((r) => r.employeeId === employeeId).sort(byDateDesc('createdAt'))
      .map((r) => {
        const a = store.find('activities', r.activityId);
        return {
          id: r.id, activityTitle: a?.title || 'مشاركة محذوفة', category: a?.category, status: r.status,
          stageLabel: a ? STAGES[a.status] : '',
          reviewNote: r.status === 'rejected' ? r.reviewNote : '', createdAt: r.createdAt,
          cardCode: r.status === 'approved' ? r.cardCode : null,
        };
      });
    res.json(list);
  });

  app.get('/api/cards/:code', (req, res) => {
    const reg = store.all('registrations').find((r) => r.cardCode && r.cardCode === String(req.params.code).toUpperCase());
    if (!reg || reg.status !== 'approved') fail(404, 'البطاقة غير موجودة أو غير سارية');
    res.json(cardView(reg, req));
  });

  app.get('/api/cards/:code/qr.svg', async (req, res) => {
    const reg = store.all('registrations').find((r) => r.cardCode && r.cardCode === String(req.params.code).toUpperCase());
    if (!reg || reg.status !== 'approved') fail(404, 'البطاقة غير موجودة');
    const svg = await QRCode.toString(cardView(reg, req).verifyUrl, {
      type: 'svg', margin: 1, color: { dark: '#14532d', light: '#ffffff' },
    });
    res.type('image/svg+xml').send(svg);
  });

  app.get('/api/posts', (req, res) => {
    const { type } = req.query;
    res.json(publishedPosts().filter((p) => !type || p.type === type));
  });

  app.get('/api/posts/:id', (req, res) => {
    const p = store.find('posts', req.params.id);
    if (!p || !p.published) fail(404, 'المنشور غير موجود');
    res.json(p);
  });

  app.get('/api/quiz', (req, res) => {
    const quizzes = store.all('quizzes').filter((q) => q.published);
    const current = quizzes.find((q) => windowStatus(q) === 'active');
    const upcoming = quizzes.filter((q) => windowStatus(q) === 'upcoming')
      .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
    const past = quizzes.filter((q) => windowStatus(q) === 'ended').sort(byDateDesc('endsAt')).slice(0, 5);
    res.json({
      current: current ? quizPublic(current) : null,
      upcoming: upcoming ? { title: upcoming.title, startsAt: upcoming.startsAt, prize: upcoming.prize } : null,
      past: past.map((q) => quizPublic(q, { withAnswers: true })),
    });
  });

  app.post('/api/quiz/:id/submit', publicLimiter, (req, res) => {
    const q = store.find('quizzes', req.params.id);
    if (!q || !q.published) fail(404, 'المسابقة غير موجودة');
    if (windowStatus(q) !== 'active') fail(400, 'المسابقة غير متاحة حالياً');
    const d = clean(req.body, { name: str(120), employeeId: normalizeEmployeeId, department: str(160), phone: str(30) });
    requireFields(d, { name: 'الاسم', employeeId: 'الرقم الوظيفي', department: 'الإدارة / المكتب', phone: 'رقم الهاتف (لاستلام الرصيد)' });
    if (store.all('quizSubmissions').some((s) => s.quizId === q.id && s.employeeId === d.employeeId)) {
      fail(409, 'شاركت في هذه المسابقة مسبقاً — مشاركة واحدة لكل موظف');
    }
    const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];
    const picked = q.questions.map((x, i) => {
      const v = answers[i];
      return Number.isInteger(v) && v >= 0 && v < x.options.length ? v : null;
    });
    if (picked.some((v) => v === null)) fail(400, 'يرجى الإجابة عن جميع الأسئلة');
    const score = picked.reduce((sum, v, i) => sum + (v === q.questions[i].correct ? 1 : 0), 0);
    store.insert('quizSubmissions', { ...d, quizId: q.id, answers: picked, score, total: q.questions.length });
    res.status(201).json({ score, total: q.questions.length });
  });

  app.get('/api/polls', (req, res) => {
    const list = store.all('polls').filter((p) => p.published && windowStatus(p) !== 'upcoming')
      .sort((a, b) => (Number(windowStatus(b) === 'active') - Number(windowStatus(a) === 'active')) || b.endsAt.localeCompare(a.endsAt))
      .slice(0, 20)
      .map(pollPublic);
    res.json(list);
  });

  app.post('/api/polls/:id/vote', publicLimiter, (req, res) => {
    const p = store.find('polls', req.params.id);
    if (!p || !p.published) fail(404, 'التصويت غير موجود');
    if (windowStatus(p) !== 'active') fail(400, 'التصويت غير متاح حالياً');
    const d = clean(req.body, { name: str(120), employeeId: normalizeEmployeeId, department: str(160), optionId: str(40) });
    requireFields(d, { name: 'الاسم', employeeId: 'الرقم الوظيفي' });
    if (!p.options.some((o) => o.id === d.optionId)) fail(400, 'اختر أحد الخيارات');
    if (store.all('votes').some((v) => v.pollId === p.id && v.employeeId === d.employeeId)) {
      fail(409, 'سبق لهذا الرقم الوظيفي التصويت — صوت واحد لكل موظف');
    }
    store.insert('votes', { ...d, pollId: p.id });
    res.status(201).json(pollPublic(p));
  });

  app.get('/api/members', (req, res) => {
    res.json(store.all('members').slice().sort(RESOURCES.members.sort));
  });

  app.get('/api/teams', (req, res) => {
    res.json(store.all('teams').filter((t) => t.published).sort(RESOURCES.teams.sort).map(teamPublic));
  });

  app.get('/api/achievements', (req, res) => {
    const list = achievements();
    const medals = { gold: 0, silver: 0, bronze: 0 };
    for (const a of list) if (a.resultRank in medals) medals[a.resultRank] += 1;
    res.json({ medals, total: list.length, list });
  });

  const talentStats = () => {
    const accepted = store.all('talents').filter((t) => ['registered', 'sponsored'].includes(t.status));
    const byField = {};
    for (const t of accepted) for (const f of t.fields || []) byField[f] = (byField[f] || 0) + 1;
    return { registered: accepted.length, sponsored: accepted.filter((t) => t.status === 'sponsored').length, byField };
  };

  const talentSummary = (t) => (t.fields || []).map((f) => (f === 'other' && t.otherField ? t.otherField
    : f === 'sports' && t.sportType ? `${TALENT_FIELDS.sports} (${SPORT_TYPES[t.sportType]})` : TALENT_FIELDS[f])).join('، ');

  app.get('/api/talents/stats', (req, res) => res.json(talentStats()));

  // نموذج حصر المواهب داخل شركة المدار الجديد.
  app.post('/api/talents', publicLimiter, (req, res) => {
    const d = clean(req.body, {
      name: str(160), employeeId: normalizeEmployeeId, age: int(0, 99), branch: str(120), department: str(160),
      division: str(160), section: str(160), phone: str(30), email: str(160),
      fields: keysOf(TALENT_FIELDS), sportType: oneOf(['', ...Object.keys(SPORT_TYPES)], ''), otherField: str(160),
      fieldDescription: str(3000), level: oneOf(Object.keys(TALENT_LEVELS), ''), levelDescription: str(3000),
      achievements: str(5000), needs: keysOf(TALENT_NEEDS), otherNeed: str(160), needsDescription: str(3000),
      extra: str(5000), consent: bool,
    });
    requireFields(d, {
      name: 'الاسم الرباعي', employeeId: 'الرقم الوظيفي', department: 'الإدارة', phone: 'رقم الهاتف', level: 'مستوى الموهبة',
    });
    if (d.age && (d.age < 16 || d.age > 80)) fail(400, 'يرجى إدخال عمر صحيح');
    if (!d.fields.length) fail(400, 'اختر مجال الموهبة (مجالاً واحداً على الأقل)');
    if (d.fields.includes('other') && !d.otherField) fail(400, 'اكتب مجال الموهبة في خانة «أخرى»');
    if (!d.fields.includes('sports')) d.sportType = '';
    if (!d.fields.includes('other')) d.otherField = '';
    if (!d.needs.includes('other')) d.otherNeed = '';
    if (!d.consent) fail(400, 'يجب الموافقة على القيد في سجل المواهب (القيد اختياري وفق المادة 30)');
    if (store.all('talents').some((t) => t.employeeId === d.employeeId && t.status !== 'declined')) {
      fail(409, 'لديك طلب قائم في سجل المواهب — يمكنك التواصل مع اللجنة لتحديثه');
    }
    const saved = store.insert('talents', { ...d, status: 'new', evaluation: '', rating: 0 });
    notifyCommittee(`نموذج حصر المواهب: ${d.name}`, `${d.name} (${d.employeeId}) — ${d.department}\nالمجال: ${talentSummary(saved)}\nالمستوى: ${TALENT_LEVELS[d.level]}\n\n${d.fieldDescription}`);
    res.status(201).json({ ok: true });
  });

  app.post('/api/complaints', publicLimiter, (req, res) => {
    const d = clean(req.body, {
      type: oneOf(Object.keys(COMPLAINT_TYPES), 'complaint'), name: str(120), employeeId: normalizeEmployeeId,
      department: str(160), phone: str(30), email: str(160), subject: str(200), message: str(5000),
    });
    requireFields(d, {
      name: 'الاسم', employeeId: 'الرقم الوظيفي', department: 'الإدارة / المكتب', subject: 'الموضوع', message: 'التفاصيل',
    });
    if (!d.phone && !d.email) fail(400, 'أدخل رقم الهاتف أو البريد الإلكتروني للتواصل معك');
    const ticket = `T-${new Date().getFullYear()}-${String(store.nextSerial('ticketSerial')).padStart(4, '0')}`;
    store.insert('complaints', { ...d, ticket, status: 'new', response: '' });
    notifyCommittee(
      `[${COMPLAINT_TYPES[d.type]}] ${ticket} — ${d.subject}`,
      `رقم التذكرة: ${ticket}\nالاسم: ${d.name}\nالرقم الوظيفي: ${d.employeeId}\nالإدارة: ${d.department}\nالهاتف: ${d.phone}\nالبريد: ${d.email}\n\n${d.message}`,
      d.email,
    );
    res.status(201).json({ ticket });
  });

  app.get('/api/complaints/track', publicLimiter, (req, res) => {
    const ticket = str(30)(req.query.ticket).toUpperCase();
    const employeeId = normalizeEmployeeId(req.query.employeeId);
    const c = store.all('complaints').find((x) => x.ticket === ticket && x.employeeId === employeeId);
    if (!c) fail(404, 'لم يتم العثور على تذكرة بهذه البيانات');
    res.json({
      ticket: c.ticket, type: c.type, subject: c.subject, status: c.status, response: c.response,
      createdAt: c.createdAt, updatedAt: c.updatedAt,
    });
  });

  app.get('/api/docs/:slug', (req, res) => {
    const doc = docs[req.params.slug];
    if (!doc) fail(404, 'الوثيقة غير موجودة');
    res.json(doc);
  });

  // ======================================================================
  // المصادقة ولوحة التحكم
  // ======================================================================
  const userView = (u) => ({
    id: u.id, username: u.username, name: u.name, role: u.role, active: u.active,
    permissions: userPermissions(u), createdAt: u.createdAt,
  });

  const cookieFlags = (req) => `Path=/; HttpOnly; SameSite=Strict${req.secure ? '; Secure' : ''}`;

  function auth(perm) {
    return (req, res, next) => {
      if (['POST', 'PUT', 'PATCH'].includes(req.method) && !req.is('application/json')) fail(415, 'نوع الطلب غير مدعوم');
      const token = parseCookies(req.headers.cookie).sid;
      const s = sessions.get(token);
      const user = s && store.find('users', s.userId);
      if (!user || !user.active) fail(401, 'يرجى تسجيل الدخول');
      if (perm === 'admin' ? user.role !== 'admin' : perm && !userPermissions(user).includes(perm)) {
        fail(403, 'ليست لديك صلاحية لهذا القسم');
      }
      req.user = user;
      req.token = token;
      next();
    };
  }

  app.post('/api/auth/login', loginLimiter, (req, res) => {
    const username = str(64)(req.body?.username).toLowerCase();
    const user = store.all('users').find((u) => u.username === username);
    if (!user || !user.active || !verifyPassword(req.body?.password, user.passwordHash)) {
      fail(401, 'اسم المستخدم أو كلمة المرور غير صحيحة');
    }
    const token = sessions.create(user.id);
    res.set('Set-Cookie', `sid=${token}; ${cookieFlags(req)}; Max-Age=${12 * 3600}`);
    res.json({ user: userView(user), permissionLabels: PERMISSIONS });
  });

  app.post('/api/auth/logout', (req, res) => {
    sessions.destroy(parseCookies(req.headers.cookie).sid);
    res.set('Set-Cookie', `sid=; ${cookieFlags(req)}; Max-Age=0`);
    res.json({ ok: true });
  });

  app.get('/api/auth/me', auth(), (req, res) => {
    res.json({ user: userView(req.user), permissionLabels: PERMISSIONS });
  });

  app.post('/api/auth/password', auth(), (req, res) => {
    if (!verifyPassword(req.body?.current, req.user.passwordHash)) fail(400, 'كلمة المرور الحالية غير صحيحة');
    const next = String(req.body?.next || '');
    if (next.length < 8) fail(400, 'كلمة المرور الجديدة يجب ألا تقل عن 8 أحرف');
    store.update('users', req.user.id, { passwordHash: hashPassword(next) });
    res.json({ ok: true });
  });

  app.get('/api/admin/stats', auth(), (req, res) => {
    const regs = store.all('registrations');
    const byCategory = {};
    for (const r of regs) {
      if (r.status === 'rejected') continue;
      const cat = store.find('activities', r.activityId)?.category || 'other';
      byCategory[cat] = (byCategory[cat] || 0) + 1;
    }
    res.json({
      activities: store.all('activities').length,
      openActivities: store.all('activities').filter((a) => activityView(a).isOpen).length,
      registrations: regs.length,
      pendingRegistrations: regs.filter((r) => r.status === 'pending').length,
      newComplaints: store.all('complaints').filter((c) => c.status === 'new').length,
      newTalents: store.all('talents').filter((t) => t.status === 'new').length,
      talents: talentStats().registered,
      teams: store.all('teams').length,
      upcoming: store.all('activities').filter((a) => ['selection', 'preparing', 'competing'].includes(a.status)).length,
      medals: store.all('activities').filter((a) => a.status === 'completed' && ['gold', 'silver', 'bronze'].includes(a.resultRank)).length,
      managerNotice: regs.filter((r) => r.status === 'approved' && !r.managerNotified).length,
      quizSubmissions: store.all('quizSubmissions').length,
      votes: store.all('votes').length,
      byCategory,
      categories: CATEGORIES,
      mailEnabled: mailer.enabled,
    });
  });

  // CRUD عام للموارد
  for (const [name, cfg] of Object.entries(RESOURCES)) {
    app.get(`/api/admin/${name}`, auth(cfg.perm), (req, res) => {
      res.json(store.all(name).slice().sort(cfg.sort));
    });
    app.post(`/api/admin/${name}`, auth(cfg.perm), (req, res) => {
      const d = clean(req.body, cfg.schema);
      cfg.validate?.(d);
      cfg.onCreate?.(d);
      res.status(201).json(store.insert(name, { ...d, createdBy: req.user.username }));
    });
    app.put(`/api/admin/${name}/:id`, auth(cfg.perm), (req, res) => {
      if (!store.find(name, req.params.id)) fail(404, 'العنصر غير موجود');
      const d = clean(req.body, cfg.schema);
      cfg.validate?.(d);
      res.json(store.update(name, req.params.id, { ...d, updatedBy: req.user.username }));
    });
    app.delete(`/api/admin/${name}/:id`, auth(cfg.perm), (req, res) => {
      if (!store.remove(name, req.params.id)) fail(404, 'العنصر غير موجود');
      cfg.onDelete?.(store, req.params.id);
      for (const [child, key] of Object.entries(cfg.cascade || {})) {
        store.data[child] = store.all(child).filter((x) => x[key] !== req.params.id);
      }
      store.save();
      res.json({ ok: true });
    });
  }

  // التسجيلات وبطاقات المشاركة
  const registrationRows = (query) => store.all('registrations')
    .filter((r) => (!query.activityId || r.activityId === query.activityId) && (!query.status || r.status === query.status))
    .sort(byDateDesc('createdAt'))
    .map((r) => ({ ...r, activityTitle: store.find('activities', r.activityId)?.title || 'مشاركة محذوفة' }));

  app.get('/api/admin/registrations', auth('activities'), (req, res) => res.json(registrationRows(req.query)));

  app.get('/api/admin/registrations.csv', auth('activities'), (req, res) => {
    const statusLabel = { pending: 'قيد المراجعة', approved: 'مقبول', reserve: 'احتياطي', rejected: 'مرفوض' };
    const header = ['المشاركة', 'الاسم', 'الرقم الوظيفي', 'الوصف الوظيفي', 'الإدارة / المكتب', 'الهاتف', 'البريد', 'نوع العقد', 'الانتساب', 'النادي / المنتخب', 'الخبرة', 'ملاحظات', 'الحالة', 'إشعار الرئيس المباشر', 'رقم البطاقة', 'تاريخ الترشح'];
    const cell = (v) => {
      let s = String(v ?? '');
      if (/^[=+\-@]/.test(s)) s = `'${s}`;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const rows = registrationRows(req.query).map((r) => [
      r.activityTitle, r.name, r.employeeId, r.jobTitle, r.department, r.phone, r.email, r.contractType,
      AFFILIATIONS[r.affiliation || 'none'], r.clubName, r.experience, r.notes, statusLabel[r.status],
      r.managerNotified ? 'تم' : 'لم يتم', r.cardNo || '', r.createdAt.slice(0, 10),
    ]);
    res.set('Content-Disposition', 'attachment; filename="nominations.csv"');
    res.type('text/csv; charset=utf-8').send(`﻿${[header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')}`);
  });

  app.patch('/api/admin/registrations/:id', auth('activities'), (req, res) => {
    const reg = store.find('registrations', req.params.id);
    if (!reg) fail(404, 'التسجيل غير موجود');
    const status = oneOf(['pending', 'approved', 'reserve', 'rejected'], reg.status)(req.body?.status);
    const reviewNote = str(500)(req.body?.reviewNote ?? reg.reviewNote);
    if (status === 'rejected' && !reviewNote) fail(400, 'يجب تسبيب قرار الرفض (المادة 10 من الميثاق)');
    if (status === 'approved') issueCard(reg);
    const managerNotified = req.body?.managerNotified === undefined ? !!reg.managerNotified : bool(req.body.managerNotified);
    res.json(store.update('registrations', reg.id, { status, reviewNote, managerNotified, reviewedBy: req.user.username }));
  });

  app.delete('/api/admin/registrations/:id', auth('activities'), (req, res) => {
    if (!store.remove('registrations', req.params.id)) fail(404, 'التسجيل غير موجود');
    res.json({ ok: true });
  });

  // المسابقة الأسبوعية: المشاركات والسحب على الفائزين
  app.get('/api/admin/quizzes/:id/submissions', auth('quizzes'), (req, res) => {
    const q = store.find('quizzes', req.params.id);
    if (!q) fail(404, 'المسابقة غير موجودة');
    const subs = store.all('quizSubmissions').filter((s) => s.quizId === q.id)
      .sort((a, b) => (b.score - a.score) || a.createdAt.localeCompare(b.createdAt));
    res.json({ quiz: q, submissions: subs });
  });

  app.post('/api/admin/quizzes/:id/draw', auth('quizzes'), (req, res) => {
    const q = store.find('quizzes', req.params.id);
    if (!q) fail(404, 'المسابقة غير موجودة');
    const subs = store.all('quizSubmissions').filter((s) => s.quizId === q.id);
    if (!subs.length) fail(400, 'لا توجد مشاركات بعد');
    const winners = q.winners || [];
    const taken = new Set(winners.map((w) => w.submissionId));
    const best = Math.max(...subs.map((s) => s.score));
    let pool = subs.filter((s) => s.score === best && !taken.has(s.id));
    if (!pool.length) pool = subs.filter((s) => !taken.has(s.id)).sort((a, b) => b.score - a.score)
      .filter((s, _, arr) => s.score === arr[0].score);
    if (!pool.length) fail(400, 'تم اختيار جميع المشاركين كفائزين');
    const need = Math.min(int(1, 100)(req.body?.count || q.winnersCount - winners.length || 1), pool.length);
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const j = crypto.randomInt(i + 1);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    const drawn = pool.slice(0, need).map((s) => ({
      submissionId: s.id, name: s.name, employeeId: s.employeeId, department: s.department, phone: s.phone,
      score: s.score, total: s.total, delivered: false, drawnAt: new Date().toISOString(),
    }));
    res.json(store.update('quizzes', q.id, { winners: [...winners, ...drawn] }));
  });

  app.patch('/api/admin/quizzes/:id/winners/:submissionId', auth('quizzes'), (req, res) => {
    const q = store.find('quizzes', req.params.id);
    const w = q?.winners?.find((x) => x.submissionId === req.params.submissionId);
    if (!w) fail(404, 'الفائز غير موجود');
    w.delivered = bool(req.body?.delivered);
    res.json(store.update('quizzes', q.id, { winners: q.winners }));
  });

  app.delete('/api/admin/quizzes/:id/winners/:submissionId', auth('quizzes'), (req, res) => {
    const q = store.find('quizzes', req.params.id);
    if (!q) fail(404, 'المسابقة غير موجودة');
    res.json(store.update('quizzes', q.id, { winners: (q.winners || []).filter((w) => w.submissionId !== req.params.submissionId) }));
  });

  // نتائج التصويت التفصيلية
  app.get('/api/admin/polls/:id/results', auth('polls'), (req, res) => {
    const p = store.find('polls', req.params.id);
    if (!p) fail(404, 'التصويت غير موجود');
    const { total, counts } = pollResults(p);
    const votes = store.all('votes').filter((v) => v.pollId === p.id).sort(byDateDesc('createdAt'))
      .map((v) => ({ ...v, optionLabel: p.options.find((o) => o.id === v.optionId)?.label || '—' }));
    res.json({ poll: p, total, counts, votes });
  });

  // سجل المواهب (المواد 26-30 من الميثاق)
  app.get('/api/admin/talents', auth('talents'), (req, res) => {
    res.json(store.all('talents').filter((t) => !req.query.status || t.status === req.query.status).sort(byDateDesc('createdAt')));
  });

  app.get('/api/admin/talents.csv', auth('talents'), (req, res) => {
    const statusLabel = { new: 'جديد', evaluating: 'قيد التقييم', registered: 'مقيد بالسجل', sponsored: 'ترعاه الشركة', declined: 'غير مقبول' };
    const header = ['الاسم الرباعي', 'الرقم الوظيفي', 'العمر', 'الفرع', 'الإدارة', 'الدائرة', 'القسم', 'الهاتف', 'البريد', 'المجال',
      'وصف المجال', 'المستوى', 'وصف المستوى والجهة', 'الإنجازات والمشاركات', 'الاحتياجات', 'وصف الاحتياج', 'إضافات', 'الحالة', 'التقييم', 'ملاحظات اللجنة', 'تاريخ الطلب'];
    const cell = (v) => {
      let x = String(v ?? '');
      if (/^[=+\-@]/.test(x)) x = `'${x}`;
      return `"${x.replace(/"/g, '""')}"`;
    };
    const rows = store.all('talents').filter((t) => !req.query.status || t.status === req.query.status).sort(byDateDesc('createdAt'))
      .map((t) => [t.name, t.employeeId, t.age || '', t.branch, t.department, t.division, t.section, t.phone, t.email, talentSummary(t),
        t.fieldDescription, TALENT_LEVELS[t.level] || '', t.levelDescription, t.achievements,
        (t.needs || []).map((n) => (n === 'other' && t.otherNeed ? t.otherNeed : TALENT_NEEDS[n])).join('، '), t.needsDescription, t.extra,
        statusLabel[t.status], t.rating || '', t.evaluation, t.createdAt.slice(0, 10)]);
    res.set('Content-Disposition', 'attachment; filename="talents.csv"');
    res.type('text/csv; charset=utf-8').send(`\uFEFF${[header, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')}`);
  });

  app.patch('/api/admin/talents/:id', auth('talents'), (req, res) => {
    const t = store.find('talents', req.params.id);
    if (!t) fail(404, 'الطلب غير موجود');
    res.json(store.update('talents', t.id, {
      status: oneOf(TALENT_STATUSES, t.status)(req.body?.status),
      evaluation: str(3000)(req.body?.evaluation ?? t.evaluation),
      rating: int(0, 5)(req.body?.rating ?? t.rating),
      reviewedBy: req.user.username,
    }));
  });

  app.delete('/api/admin/talents/:id', auth('talents'), (req, res) => {
    if (!store.remove('talents', req.params.id)) fail(404, 'الطلب غير موجود');
    res.json({ ok: true });
  });

  // الشكاوى والمقترحات
  app.get('/api/admin/complaints', auth('complaints'), (req, res) => {
    res.json(store.all('complaints').slice().sort(byDateDesc('createdAt')));
  });

  app.patch('/api/admin/complaints/:id', auth('complaints'), (req, res) => {
    const c = store.find('complaints', req.params.id);
    if (!c) fail(404, 'الشكوى غير موجودة');
    res.json(store.update('complaints', c.id, {
      status: oneOf(['new', 'in_progress', 'resolved', 'closed'], c.status)(req.body?.status),
      response: str(5000)(req.body?.response ?? c.response),
      handledBy: req.user.username,
    }));
  });

  app.delete('/api/admin/complaints/:id', auth('complaints'), (req, res) => {
    if (!store.remove('complaints', req.params.id)) fail(404, 'الشكوى غير موجودة');
    res.json({ ok: true });
  });

  // الإعدادات
  app.get('/api/admin/settings', auth('settings'), (req, res) => res.json(S()));

  app.put('/api/admin/settings', auth('settings'), (req, res) => {
    const b = req.body || {};
    const d = clean(b, {
      committeeName: str(120), companyName: str(120), tagline: str(300), email: str(160), phone: str(40),
      whatsapp: str(40), publicUrl: link, maxActivitiesPerEmployee: int(0, 20), departments: lines(100),
    });
    d.social = clean(b.social, { facebook: link, tiktok: link, instagram: link, youtube: link });
    requireFields(d, { committeeName: 'اسم اللجنة', companyName: 'اسم الشركة' });
    Object.assign(S(), d);
    store.save();
    res.json(S());
  });

  // المستخدمون والصلاحيات (للمدير فقط)
  app.get('/api/admin/users', auth('admin'), (req, res) => res.json(store.all('users').map(userView)));

  const userInput = (b) => ({
    username: str(32)(b?.username).toLowerCase(),
    name: str(120)(b?.name),
    role: oneOf(['admin', 'member'], 'member')(b?.role),
    active: bool(b?.active),
    permissions: (Array.isArray(b?.permissions) ? b.permissions : []).filter((p) => p in PERMISSIONS),
  });

  const activeAdmins = (exceptId) => store.all('users').filter((u) => u.role === 'admin' && u.active && u.id !== exceptId).length;

  app.post('/api/admin/users', auth('admin'), (req, res) => {
    const d = userInput(req.body);
    if (!/^[a-z0-9._-]{3,32}$/.test(d.username)) fail(400, 'اسم المستخدم: 3 أحرف لاتينية أو أرقام على الأقل');
    requireFields(d, { name: 'الاسم' });
    if (store.all('users').some((u) => u.username === d.username)) fail(409, 'اسم المستخدم مستخدم مسبقاً');
    const password = String(req.body?.password || '');
    if (password.length < 8) fail(400, 'كلمة المرور يجب ألا تقل عن 8 أحرف');
    res.status(201).json(userView(store.insert('users', { ...d, passwordHash: hashPassword(password) })));
  });

  app.put('/api/admin/users/:id', auth('admin'), (req, res) => {
    const u = store.find('users', req.params.id);
    if (!u) fail(404, 'المستخدم غير موجود');
    const d = userInput(req.body);
    requireFields(d, { name: 'الاسم' });
    delete d.username;
    if (u.role === 'admin' && (d.role !== 'admin' || !d.active) && activeAdmins(u.id) === 0) {
      fail(400, 'لا يمكن إلغاء صلاحيات آخر مدير للمنصة');
    }
    const password = String(req.body?.password || '');
    if (password) {
      if (password.length < 8) fail(400, 'كلمة المرور يجب ألا تقل عن 8 أحرف');
      d.passwordHash = hashPassword(password);
    }
    if (!d.active || password) sessions.destroyUser(u.id);
    res.json(userView(store.update('users', u.id, d)));
  });

  app.delete('/api/admin/users/:id', auth('admin'), (req, res) => {
    const u = store.find('users', req.params.id);
    if (!u) fail(404, 'المستخدم غير موجود');
    if (u.id === req.user.id) fail(400, 'لا يمكنك حذف حسابك');
    if (u.role === 'admin' && activeAdmins(u.id) === 0) fail(400, 'لا يمكن حذف آخر مدير للمنصة');
    store.remove('users', u.id);
    sessions.destroyUser(u.id);
    res.json({ ok: true });
  });

  // رفع الصور
  app.post('/api/admin/upload', auth(), (req, res) => {
    const m = String(req.body?.dataUrl || '').match(/^data:image\/(png|jpeg|webp|gif);base64,([A-Za-z0-9+/=]+)$/);
    if (!m) fail(400, 'الصيغ المسموحة: PNG, JPG, WEBP, GIF');
    const buf = Buffer.from(m[2], 'base64');
    if (buf.length > 5 * 1024 * 1024) fail(400, 'حجم الصورة يجب ألا يتجاوز 5 ميغابايت');
    const name = `${newId()}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`;
    fs.writeFileSync(path.join(uploadsDir, name), buf);
    res.status(201).json({ url: `/uploads/${name}` });
  });

  // ---------- الملفات الثابتة ----------
  app.use('/uploads', express.static(uploadsDir, { maxAge: '7d' }));
  app.get('/admin', (req, res) => res.redirect('/admin.html'));
  app.use(express.static(fileURLToPath(publicDir)));

  app.use('/api', (req, res) => res.status(404).json({ error: 'المسار غير موجود' }));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err instanceof HttpError) { res.status(err.status).json({ error: err.message }); return; }
    if (err.type === 'entity.too.large') { res.status(413).json({ error: 'حجم البيانات كبير جداً' }); return; }
    if (err.type === 'entity.parse.failed') { res.status(400).json({ error: 'بيانات غير صالحة' }); return; }
    log('[error]', err);
    res.status(500).json({ error: 'حدث خطأ غير متوقع في الخادم' });
  });

  return { app, store, initialPassword };
}
