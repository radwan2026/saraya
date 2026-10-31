// نفس منطق auth.js مع جلسات محفوظة في localStorage حتى تبقى بعد إعادة تحميل الصفحة أو الانتقال بين الصفحات.
export { PERMISSIONS, hashPassword, verifyPassword, userPermissions, parseCookies } from '../../src/auth.js';

const KEY = 'almadar-activities:sessions';
const TTL = 12 * 60 * 60 * 1000;
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const save = (s) => localStorage.setItem(KEY, JSON.stringify(s));

export function createSessions() {
  return {
    create(userId) {
      const token = Array.from(globalThis.crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('');
      const s = load();
      s[token] = { userId, expires: Date.now() + TTL };
      save(s);
      return token;
    },
    get(token) {
      const s = load();
      const v = token && s[token];
      if (!v) return null;
      if (v.expires < Date.now()) { delete s[token]; save(s); return null; }
      v.expires = Date.now() + TTL;
      save(s);
      return v;
    },
    destroy(token) { const s = load(); delete s[token]; save(s); },
    destroyUser(userId) {
      const s = load();
      for (const [t, v] of Object.entries(s)) if (v.userId === userId) delete s[t];
      save(s);
    },
  };
}
