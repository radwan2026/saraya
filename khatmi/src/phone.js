// أرقام الهواتف الليبية فقط (التطبيق محلي).
// المدار الجديد: 091 / 093   —   ليبيانا: 092 / 094
const CARRIER_PREFIX = { 91: 'madar', 93: 'madar', 92: 'libyana', 94: 'libyana' };

/** يحوّل أي صيغة (0911110588 / 911110588 / +218911110588 / 00218...) إلى الصيغة المحلية 09XXXXXXXX أو null. */
export function normalizePhone(input) {
  let d = String(input || '').replace(/[٠-٩]/g, (c) => '٠١٢٣٤٥٦٧٨٩'.indexOf(c)).replace(/[^\d]/g, '');
  if (d.startsWith('00218')) d = d.slice(5);
  else if (d.startsWith('218')) d = d.slice(3);
  if (d.startsWith('0')) d = d.slice(1);
  if (!/^9[1-5]\d{7}$/.test(d)) return null;
  return '0' + d;
}

export function carrierOf(phone) {
  const p = normalizePhone(phone);
  return p ? CARRIER_PREFIX[p.slice(1, 3)] || null : null;
}

export const formatPhone = (p) => {
  const n = normalizePhone(p);
  return n ? `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}` : String(p || '');
};
