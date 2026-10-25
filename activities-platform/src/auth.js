// كلمات المرور (scrypt) والجلسات والصلاحيات.
import crypto from 'node:crypto';

export const PERMISSIONS = {
  activities: 'المشاركات الخارجية والترشيحات وبطاقات المشاركين',
  teams: 'الفرق والمنتخبات',
  talents: 'سجل المواهب',
  posts: 'الإعلانات والأخبار والقرارات',
  quizzes: 'المسابقة الأسبوعية',
  polls: 'التصويت على المشاركات والبرامج',
  members: 'صفحة أعضاء اللجنة',
  complaints: 'طلبات الدعم والشكاوى',
  settings: 'إعدادات المنصة وروابط التواصل',
};

export function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const candidate = crypto.scryptSync(String(password), salt, 64);
  const expected = Buffer.from(hash, 'hex');
  return candidate.length === expected.length && crypto.timingSafeEqual(candidate, expected);
}

export function userPermissions(user) {
  if (!user) return [];
  if (user.role === 'admin') return Object.keys(PERMISSIONS);
  return (user.permissions || []).filter((p) => p in PERMISSIONS);
}

const SESSION_TTL = 12 * 60 * 60 * 1000;

export function createSessions() {
  const sessions = new Map();
  return {
    create(userId) {
      const token = crypto.randomBytes(32).toString('hex');
      sessions.set(token, { userId, expires: Date.now() + SESSION_TTL });
      return token;
    },
    get(token) {
      const s = token && sessions.get(token);
      if (!s) return null;
      if (s.expires < Date.now()) { sessions.delete(token); return null; }
      s.expires = Date.now() + SESSION_TTL;
      return s;
    },
    destroy(token) { sessions.delete(token); },
    destroyUser(userId) {
      for (const [t, s] of sessions) if (s.userId === userId) sessions.delete(t);
    },
  };
}

export function parseCookies(header = '') {
  const out = {};
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
