import fs from 'node:fs';
import path from 'node:path';

/** القيم الافتراضية لإعدادات «منارة النور» — تُعدَّل من لوحة التحكم وتُحفظ في data/noor-settings.json */
export const DEFAULTS = {
  // الجولة
  roundSeconds: 240,        // مدة الجولة؛ عند انتهائها يفوز الفريق الأعلى نوراً
  target: 2000,             // النور اللازم لإضاءة المنارة بالكامل (فوز فوري)
  victorySeconds: 14,       // مدة شاشة الفوز
  finishDelayMs: 2500,      // مهلة بعد اكتمال المنارة لعرض الهدية الأخيرة قبل شاشة الفوز
  autoStart: true,          // بدء جولة جديدة تلقائياً بعد كل فوز

  // النقاط (النور)
  lightPerCoin: 10,         // نور لكل عملة من الهدايا
  minGiftLight: 10,         // أقل نور لأي هدية
  dhikrLight: 5,            // نور لكل ذكر في التعليقات
  dhikrCooldownMs: 3000,    // أقل فاصل بين ذكرين محسوبين لنفس الشخص
  lightPerLike: 0.2,        // نور لكل إعجاب (تاب)
  likesPerStar: 200,        // كل كم إعجاب يمر شهاب في السماء
  shareLight: 30,           // نور لكل مشاركة للبث
  boostSeconds: 20,         // مدة نفحة المسك (هدية العطر)
  boostMultiplier: 2,       // مضاعف النور أثناء نفحة المسك

  // سؤال النور
  quizEnabled: true,
  quizEverySeconds: 75,     // الفاصل بين الأسئلة
  quizSeconds: 20,          // وقت الإجابة
  quizRevealSeconds: 6,     // مدة عرض الإجابة الصحيحة
  quizLight: 40,            // نور لكل إجابة صحيحة (الأسرع ×2)
  extraQuestions: [],       // أسئلة إضافية: [{ q, o: [4 خيارات], a: رقم الصحيحة }]

  // العرض والصوت
  wisdomSeconds: 20,        // مدة كل آية/حديث في الشريط
  teamNames: [],            // أسماء مخصصة للفرق (اتركها فارغة للأسماء الافتراضية)
  musicMode: 'ambient',     // ambient | nature | file | off
  musicVolume: 0.5,
  sfxVolume: 0.7,
};

const NUMERIC = Object.entries(DEFAULTS).filter(([, v]) => typeof v === 'number').map(([k]) => k);

/** يتحقق من القيم القادمة من لوحة التحكم ويعيد ما هو صالح فقط */
export function sanitizeSettings(patch = {}) {
  const out = {};
  for (const [k, v] of Object.entries(patch)) {
    if (!(k in DEFAULTS)) continue;
    if (NUMERIC.includes(k)) {
      const n = Number(v);
      if (Number.isFinite(n) && n >= 0) out[k] = n;
    } else if (typeof DEFAULTS[k] === 'boolean') {
      out[k] = Boolean(v);
    } else if (k === 'musicMode') {
      if (['ambient', 'nature', 'file', 'off'].includes(v)) out[k] = v;
    } else if (k === 'teamNames') {
      if (Array.isArray(v)) out[k] = v.slice(0, 4).map((s) => String(s || '').trim().slice(0, 20));
    } else if (k === 'extraQuestions') {
      if (Array.isArray(v)) {
        out[k] = v.filter((q) => q && typeof q.q === 'string' && Array.isArray(q.o) && q.o.length === 4
          && Number.isInteger(q.a) && q.a >= 0 && q.a < 4);
      }
    }
  }
  for (const k of ['roundSeconds', 'target', 'victorySeconds', 'quizSeconds', 'quizEverySeconds', 'quizRevealSeconds', 'likesPerStar', 'wisdomSeconds', 'boostMultiplier']) {
    if (k in out && out[k] < 1) out[k] = 1;
  }
  return out;
}

export class SettingsStore {
  constructor(file) {
    this.file = file;
    this.values = { ...DEFAULTS };
    try {
      const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
      Object.assign(this.values, sanitizeSettings(saved));
    } catch { /* لا يوجد ملف محفوظ بعد */ }
  }

  update(patch) {
    const clean = sanitizeSettings(patch);
    Object.assign(this.values, clean);
    try {
      fs.mkdirSync(path.dirname(this.file), { recursive: true });
      fs.writeFileSync(this.file, JSON.stringify(this.values, null, 2));
    } catch (err) {
      console.warn('[Settings] تعذّر حفظ الإعدادات:', err.message);
    }
    return clean;
  }

  reset() {
    this.values = { ...DEFAULTS };
    try { fs.rmSync(this.file, { force: true }); } catch { /* تجاهل */ }
    return this.values;
  }
}
