// تسعير الختم:
//  - ختم نصي فقط: عدد الحروف × سعر الحرف
//  - ختم بأيقونة/شعار + نص: عدد الحروف × سعر الحرف + رسوم الأيقونة أو الشعار
// كل المبالغ داخلياً بالدرهم (1 دينار ليبي = 1000 درهم) لتفادي أخطاء الكسور.
import { normalizeSpec } from './seal.js';

export const toDirham = (lyd) => Math.round(Number(lyd) * 1000);
export const toLyd = (dirham) => Math.round(dirham) / 1000;

/** عدد الحروف والأرقام فقط (بدون مسافات أو تشكيل أو تطويل أو رموز). */
export function countLetters(str) {
  return [...String(str || '').normalize('NFC')].filter((ch) => /[\p{L}\p{N}]/u.test(ch) && ch !== 'ـ').length;
}

export function quote(rawSpec, settings) {
  const spec = normalizeSpec(rawSpec);
  const t = spec.texts;
  const parts = ['top', 'bottom', 'center', 'extra'].map((k) => ({ slot: k, text: t[k], letters: countLetters(t[k]) })).filter((p) => p.letters);
  const letters = parts.reduce((s, p) => s + p.letters, 0);
  const perLetter = toDirham(settings.pricePerLetter);
  const hasIcon = spec.icon !== 'none';
  const iconFee = hasIcon ? toDirham(spec.icon === 'logo' ? settings.logoFee : settings.iconFee) : 0;
  const lettersTotal = letters * perLetter;
  let total = lettersTotal + iconFee;
  const minimum = toDirham(settings.minPrice || 0);
  if (letters > 0 && total < minimum) total = minimum;
  return {
    type: hasIcon ? 'icon_text' : 'text',
    letters,
    parts,
    perLetter: toLyd(perLetter),
    lettersTotal: toLyd(lettersTotal),
    iconFee: toLyd(iconFee),
    iconKind: hasIcon ? spec.icon : null,
    minimum: toLyd(minimum),
    total: toLyd(total),
    totalDirham: total,
    currency: 'LYD',
  };
}
