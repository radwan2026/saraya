// تصنيف هدايا تيك توك وربط كل هدية بتأثير داخل الواحة

export const GIFT_EFFECTS = {
  rose: { kind: 'rose', effect: 'flower', title: 'وردة', action: 'أزهرت الواحة بوردة' },
  heart: { kind: 'heart', effect: 'lantern', title: 'قلب', action: 'أطلق فانوساً في السماء' },
  donut: { kind: 'donut', effect: 'feed', title: 'دونات', action: 'أطعم مسافري القافلة' },
  perfume: { kind: 'perfume', effect: 'musk', title: 'عطر', action: 'نشر نفحات المسك — النقاط مضاعفة!' },
  other: { kind: 'other', effect: 'sparkle', title: 'هدية', action: 'أضاء الواحة بالنور' },
};

/** يحدد نوع الهدية من اسمها (بالإنجليزية كما يرسلها تيك توك، أو بالعربية من لوحة التحكم) */
export function classifyGift(name = '') {
  const n = String(name).toLowerCase();
  if (/rose|وردة|ورده|ورد/.test(n)) return 'rose';
  if (/heart|قلب/.test(n)) return 'heart';
  if (/donut|doughnut|دونات/.test(n)) return 'donut';
  if (/perfume|عطر/.test(n)) return 'perfume';
  return 'other';
}

/** هدايا للمحاكاة من لوحة التحكم ووضع التجربة (الأسعار بالعملات/الماسات كما في تيك توك تقريباً) */
export const SAMPLE_GIFTS = [
  { id: 'rose', name: 'Rose', label: 'وردة', diamonds: 1 },
  { id: 'heart', name: 'Finger Heart', label: 'قلب', diamonds: 5 },
  { id: 'perfume', name: 'Perfume', label: 'عطر', diamonds: 20 },
  { id: 'donut', name: 'Doughnut', label: 'دونات', diamonds: 30 },
  { id: 'icecream', name: 'Ice Cream Cone', label: 'آيس كريم', diamonds: 1 },
  { id: 'galaxy', name: 'Galaxy', label: 'مجرّة', diamonds: 1000 },
  { id: 'lion', name: 'Lion', label: 'أسد', diamonds: 29999 },
];

/**
 * هدايا السلسلة (giftType = 1) تصل عدة مرات بعدد repeatCount متزايد، ثم مرة أخيرة بـ repeatEnd.
 * هذا المتتبع يعيد «الفرق» فقط في كل حدث، فتظهر التأثيرات فوراً دون احتساب الهدية مرتين.
 */
export class GiftStreaks {
  constructor(ttlMs = 120_000) {
    this.ttlMs = ttlMs;
    this.map = new Map();
  }

  resolve(userId, gift, now = Date.now()) {
    const repeat = Math.max(1, Number(gift.repeatCount) || 1);
    if (!gift.streakable) return repeat;
    const key = `${userId}:${gift.id}:${gift.groupId || ''}`;
    const prev = this.map.get(key)?.count || 0;
    const delta = Math.max(0, repeat - prev);
    if (gift.repeatEnd) this.map.delete(key);
    else this.map.set(key, { count: Math.max(prev, repeat), at: now });
    for (const [k, v] of this.map) if (now - v.at > this.ttlMs) this.map.delete(k);
    return delta;
  }
}
