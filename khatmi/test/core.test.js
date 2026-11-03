import test from 'node:test';
import assert from 'node:assert/strict';
import { countLetters, quote } from '../src/pricing.js';
import { normalizePhone, carrierOf } from '../src/phone.js';
import { renderSeal, normalizeSpec } from '../src/seal.js';
import { localVariants } from '../src/designer.js';
import { svgToPdf } from '../src/pdf.js';

const settings = { pricePerLetter: 0.5, iconFee: 3, logoFee: 5, minPrice: 0 };

test('عدّ الحروف يتجاهل المسافات والتشكيل والتطويل والرموز', () => {
  assert.equal(countLetters('ختمي'), 4);
  assert.equal(countLetters('مُحَمَّد  أحمد'), 8);
  assert.equal(countLetters('شركـــة'), 4);
  assert.equal(countLetters('My Seal - 2026'), 10);
});

test('تسعير ختم نصي فقط = الحروف × السعر', () => {
  const q = quote({ texts: { top: 'ختمي', bottom: 'My seal' } }, settings);
  assert.equal(q.type, 'text');
  assert.equal(q.letters, 10);
  assert.equal(q.total, 5);
  assert.equal(q.iconFee, 0);
});

test('تسعير ختم بأيقونة أو شعار = الحروف × السعر + رسوم الأيقونة', () => {
  const withStar = quote({ icon: 'star', texts: { top: 'ختمي' } }, settings);
  assert.equal(withStar.type, 'icon_text');
  assert.equal(withStar.total, 2 + 3);
  const withLogo = quote({ icon: 'logo', logoId: 'a'.repeat(32), texts: { top: 'ختمي' } }, settings);
  assert.equal(withLogo.total, 2 + 5);
  // شعار بدون ملف = بدون رسوم
  assert.equal(quote({ icon: 'logo', texts: { top: 'ختمي' } }, settings).iconFee, 0);
});

test('الحد الأدنى للسعر', () => {
  assert.equal(quote({ texts: { top: 'أ' } }, { ...settings, minPrice: 3 }).total, 3);
});

test('أرقام الهواتف الليبية فقط', () => {
  for (const v of ['0911110588', '911110588', '+218911110588', '00218 91 111 0588', '٠٩١١١١٠٥٨٨']) assert.equal(normalizePhone(v), '0911110588');
  assert.equal(normalizePhone('+20 100 123 4567'), null);
  assert.equal(normalizePhone('0811110588'), null);
  assert.equal(carrierOf('0911110588'), 'madar');
  assert.equal(carrierOf('0931234567'), 'madar');
  assert.equal(carrierOf('0921234567'), 'libyana');
  assert.equal(carrierOf('0941234567'), 'libyana');
});

test('رسم كل الأشكال والإطارات بدون أخطاء ونص متجه', () => {
  for (const shape of ['circle', 'oval', 'rect', 'rounded', 'hexagon']) {
    for (const border of ['single', 'double', 'thick-thin', 'dotted', 'dashed', 'beaded']) {
      const svg = renderSeal({ shape, border, icon: 'crescent', texts: { top: 'شركة الأفق - للتجارة', bottom: 'AL OFOQ', center: 'طرابلس', extra: '0911110588' } });
      assert.match(svg, /^<\?xml/);
      assert.match(svg, /id="top-text" d="M/);
      assert.doesNotMatch(svg, /NaN|undefined/);
      assert.doesNotMatch(svg, /<text/); // النصوص منحنيات وليست خطوطاً
    }
  }
});

test('تنظيف المواصفات يمنع القيم الخطرة', () => {
  const s = normalizeSpec({ shape: 'x', ink: 'red;evil', widthMm: 9999, texts: { top: '<script>alert(1)</script>' }, logoId: '../../etc' });
  assert.equal(s.shape, 'circle');
  assert.equal(s.ink, '#1f3c88');
  assert.equal(s.widthMm, 120);
  assert.ok(!s.texts.top.includes('<'));
  assert.equal(s.logoId, null);
});

test('المولد المحلي يحترم اللغة المختارة', () => {
  const ar = localVariants({ lang: 'ar', nameAr: 'مؤسسة النور', nameEn: 'Al Noor' });
  assert.equal(ar.length, 4);
  for (const v of ar) assert.ok(!Object.values(v.spec.texts).includes('Al Noor'));
  const both = localVariants({ lang: 'both', nameAr: 'مؤسسة النور', nameEn: 'Al Noor' });
  assert.ok(both.some((v) => Object.values(v.spec.texts).includes('Al Noor')));
});

test('تصدير PDF', async () => {
  const pdf = await svgToPdf(renderSeal({ texts: { top: 'ختمي' } }), { widthMm: 40, heightMm: 40 });
  assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
});
