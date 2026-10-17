// أدوات النص العربي: توحيد الكتابة، قراءة إجابات المسابقة، واكتشاف الأذكار في التعليقات

const TASHKEEL = /[ؐ-ًؚ-ٰٟۖ-ۭـ]/g;

/** يزيل التشكيل والتطويل ويوحّد أشكال الألف والياء والتاء المربوطة */
export function normalizeArabic(s = '') {
  return String(s)
    .replace(TASHKEEL, '')
    .replace(/[إأآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/ؤ/g, 'و')
    .replace(/ئ/g, 'ي')
    .toLowerCase();
}

const ANSWER_MAP = {
  1: 0, 2: 1, 3: 2, 4: 3,
  '١': 0, '٢': 1, '٣': 2, '٤': 3,
  '۱': 0, '۲': 1, '۳': 2, '۴': 3,
  ا: 0, ب: 1, ج: 2, د: 3,
  a: 0, b: 1, c: 2, d: 3,
};

/**
 * يقرأ إجابة المسابقة من التعليق: 1-4 أو ١-٤ أو أ/ب/ج/د.
 * يعيد رقم الخيار (0..3) أو null إذا لم يكن التعليق إجابة.
 */
export function parseAnswer(text) {
  const t = normalizeArabic(text).replace(/[️⃣\s.!؟?،,()[\]-]+/g, '');
  if ([...t].length !== 1) return null;
  const v = ANSWER_MAP[t];
  return v === undefined ? null : v;
}

/** الأذكار المعروفة. الأنماط مكتوبة بعد التوحيد وبدون مسافات */
export const DHIKR = [
  { key: 'hawqala', label: 'لا حول ولا قوة إلا بالله', patterns: ['لاحولولاقوه'] },
  { key: 'tahlil', label: 'لا إله إلا الله', patterns: ['لاالهالاالله'] },
  { key: 'subhan', label: 'سبحان الله', patterns: ['سبحانالله', 'سبحانربي'] },
  { key: 'hamd', label: 'الحمد لله', patterns: ['الحمدلله'] },
  { key: 'takbir', label: 'الله أكبر', patterns: ['اللهاكبر'] },
  { key: 'istighfar', label: 'أستغفر الله', patterns: ['استغفرالله'] },
  { key: 'salawat', label: 'اللهم صلِّ على محمد ﷺ', patterns: ['اللهمصل', 'صلياللهعليهوسلم', 'ﷺ'] },
];

function countOccurrences(haystack, needle) {
  let n = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) { n++; i = haystack.indexOf(needle, i + needle.length); }
  return n;
}

/**
 * يكتشف الذكر في التعليق. يعيد { key, label, count } أو null.
 * count = عدد مرات تكرار الأذكار في التعليق نفسه (بحد أقصى 10).
 */
export function detectDhikr(text) {
  const t = normalizeArabic(text).replace(/\s+/g, '');
  if (!t) return null;
  let first = null;
  let count = 0;
  for (const d of DHIKR) {
    for (const p of d.patterns) {
      const c = countOccurrences(t, p);
      if (c && !first) first = d;
      count += c;
    }
  }
  if (!first) return null;
  return { key: first.key, label: first.label, count: Math.min(10, count) };
}
