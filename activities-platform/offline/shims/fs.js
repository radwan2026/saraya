// نظام ملفات افتراضي محفوظ في localStorage، ونصوص الميثاق واللائحة مضمّنة وقت البناء.
const NS = 'almadar-activities:fs:';
const CONTENT = globalThis.__OFFLINE_CONTENT__ || {};
const pending = new Map();
const key = (p) => NS + (p instanceof URL ? p.pathname : String(p));

export function existsSync(p) { return localStorage.getItem(key(p)) !== null; }

export function readFileSync(p) {
  const s = p instanceof URL ? p.pathname : String(p);
  const name = s.split('/').pop();
  if (s.includes('/content/') && name in CONTENT) return CONTENT[name];
  const v = localStorage.getItem(key(p));
  if (v === null) { const e = new Error(`ENOENT: ${s}`); e.code = 'ENOENT'; throw e; }
  return v;
}

const persist = (k, v) => {
  try { localStorage.setItem(k, v); } catch {
    throw new Error('امتلأت مساحة التخزين في المتصفح — احذف بعض الصور المرفوعة ثم أعد المحاولة');
  }
};

export function writeFileSync(p, data) {
  const s = String(p);
  if (s.endsWith('.tmp')) { pending.set(s, String(data)); return; }
  persist(key(p), String(data));
}

export function renameSync(from, to) {
  const v = pending.has(from) ? pending.get(from) : localStorage.getItem(key(from));
  pending.delete(from);
  persist(key(to), v);
}

export function mkdirSync() {}

export default { existsSync, readFileSync, writeFileSync, renameSync, mkdirSync };
