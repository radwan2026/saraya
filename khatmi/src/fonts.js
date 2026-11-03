// تحميل الخطوط وتحويل النص إلى منحنيات (Vector paths) مع تشكيل الحروف العربية.
import * as fontkit from 'fontkit';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const FONT_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'assets', 'fonts');

// كل عائلة خط لها ملف للحروف العربية وملف للحروف اللاتينية.
// الخطوط اللاتينية فقط تستعمل Cairo للعربي احتياطياً.
export const FONT_FAMILIES = {
  cairo: { label: 'Cairo', ar: 'cairo-arabic-700-normal.woff', lat: 'cairo-latin-700-normal.woff' },
  tajawal: { label: 'Tajawal', ar: 'tajawal-arabic-700-normal.woff', lat: 'tajawal-latin-700-normal.woff' },
  amiri: { label: 'Amiri', ar: 'amiri-arabic-700-normal.woff', lat: 'amiri-latin-700-normal.woff' },
  reemkufi: { label: 'Reem Kufi', ar: 'reem-kufi-arabic-700-normal.woff', lat: 'reem-kufi-latin-700-normal.woff' },
  montserrat: { label: 'Montserrat', ar: 'cairo-arabic-700-normal.woff', lat: 'montserrat-latin-700-normal.woff' },
  playfair: { label: 'Playfair', ar: 'amiri-arabic-700-normal.woff', lat: 'playfair-display-latin-700-normal.woff' },
};

export const AR_FONTS = ['cairo', 'tajawal', 'amiri', 'reemkufi'];
export const EN_FONTS = ['montserrat', 'playfair', 'cairo', 'tajawal', 'amiri', 'reemkufi'];

const cache = new Map();
function openFont(file) {
  if (!cache.has(file)) cache.set(file, fontkit.openSync(path.join(FONT_DIR, file)));
  return cache.get(file);
}

const ARABIC_RE = /[؀-ۿݐ-ݿࢠ-ࣿﭐ-﷿ﹰ-﻿]/;
const STRONG_LTR_RE = /[A-Za-zÀ-ɏ]/;
export const isArabicChar = (ch) => ARABIC_RE.test(ch);
export const hasArabic = (s) => ARABIC_RE.test(s || '');

// تقسيم النص إلى مقاطع: عربي / غير عربي. المسافات والرموز المحايدة تلتحق بالمقطع السابق.
function splitRuns(text, arFont) {
  const chars = [...text];
  const types = chars.map((ch) => (isArabicChar(ch) ? 'ar' : STRONG_LTR_RE.test(ch) || /[0-9]/.test(ch) ? 'lat' : 'n'));
  const arHas = (ch) => arFont.hasGlyphForCodePoint(ch.codePointAt(0));
  // الرموز المحايدة تأخذ نوع الحرف القوي السابق، أو اللاحق إن كانت في البداية
  for (let i = 0; i < types.length; i++) {
    if (types[i] !== 'n') continue;
    let j = i - 1;
    while (j >= 0 && types[j] === 'n') j--;
    if (j >= 0) types[i] = types[j];
    else {
      j = i + 1;
      while (j < types.length && types[j] === 'n') j++;
      types[i] = j < types.length ? types[j] : 'lat';
    }
    // رمز غير موجود في الخط العربي (مثل - أو ·) يُرسم بالخط اللاتيني
    if (types[i] === 'ar' && !arHas(chars[i])) types[i] = 'sym';
  }
  const runs = [];
  chars.forEach((ch, i) => {
    const ar = types[i] === 'ar';
    const last = runs[runs.length - 1];
    if (last && last.ar === ar && types[i] !== 'sym' && !last.sym) last.text += ch;
    else runs.push({ ar, sym: types[i] === 'sym', text: ch });
  });
  return runs;
}

/**
 * يحوّل سطر نص إلى قائمة رموز (glyphs) جاهزة للرسم.
 * الإحداثيات: x لليمين، y للأسفل، خط الأساس عند y=0، وحدة = وحدة التصميم.
 * @returns {{glyphs: Array<{cmds: Array, x: number, adv: number}>, width: number, top: number, bottom: number, rtl: boolean}}
 */
export function shapeLine(text, familyKey, size, letterSpacing = 0) {
  const fam = FONT_FAMILIES[familyKey] || FONT_FAMILIES.cairo;
  text = (text || '').replace(/\s+/g, ' ').trim();
  const runs = splitRuns(text, openFont(fam.ar));
  const firstStrong = [...text].find((c) => isArabicChar(c) || STRONG_LTR_RE.test(c));
  const rtl = firstStrong ? isArabicChar(firstStrong) : false;
  const ordered = rtl ? [...runs].reverse() : runs;

  const glyphs = [];
  let pen = 0;
  let top = 0;
  let bottom = 0;
  for (const run of ordered) {
    let font = openFont(run.ar ? fam.ar : fam.lat);
    let runText = run.text;
    if (rtl && !run.ar) {
      // المسافات الطرفية في مقطع لاتيني داخل سطر عربي تنعكس مواقعها
      runText = runText.replace(/^(\s*)(.*?)(\s*)$/s, (_, a, b, c) => c + b + a);
    }
    if (![...runText].every((ch) => ch === ' ' || font.hasGlyphForCodePoint(ch.codePointAt(0)))) {
      font = openFont(run.ar ? FONT_FAMILIES.cairo.ar : FONT_FAMILIES.cairo.lat);
    }
    const s = size / font.unitsPerEm;
    const layout = font.layout(runText);
    layout.glyphs.forEach((g, i) => {
      const pos = layout.positions[i];
      const cmds = [];
      for (const c of g.path.commands) {
        const a = c.args;
        const pts = [];
        for (let k = 0; k < a.length; k += 2) {
          const x = (a[k] + pos.xOffset) * s;
          const y = -(a[k + 1] + pos.yOffset) * s;
          pts.push(x, y);
          if (y < top) top = y;
          if (y > bottom) bottom = y;
        }
        cmds.push([c.command, pts]);
      }
      const adv = pos.xAdvance * s;
      glyphs.push({ cmds, x: pen, adv });
      pen += adv;
      // تباعد الحروف فقط للنص اللاتيني (العربي متصل)
      if (!run.ar && adv > 0 && i < layout.glyphs.length - 1) pen += letterSpacing;
    });
  }
  return { glyphs, width: pen, top, bottom, rtl };
}

const r2 = (n) => Math.round(n * 100) / 100;

// تطبيق مصفوفة تحويل [a,b,c,d,e,f] على أوامر الرسم وإخراج نص مسار SVG.
export function cmdsToPath(cmds, m) {
  const [a, b, c, d, e, f] = m;
  const tx = (x, y) => `${r2(a * x + c * y + e)} ${r2(b * x + d * y + f)}`;
  let out = '';
  for (const [cmd, p] of cmds) {
    switch (cmd) {
      case 'moveTo': out += `M${tx(p[0], p[1])}`; break;
      case 'lineTo': out += `L${tx(p[0], p[1])}`; break;
      case 'quadraticCurveTo': out += `Q${tx(p[0], p[1])} ${tx(p[2], p[3])}`; break;
      case 'bezierCurveTo': out += `C${tx(p[0], p[1])} ${tx(p[2], p[3])} ${tx(p[4], p[5])}`; break;
      case 'closePath': out += 'Z'; break;
      default: break;
    }
  }
  return out;
}

// نص مستقيم في سطر واحد، متمركز أفقياً حول cx وخط الأساس عند y.
export function straightTextPath(line, cx, y, scale = 1) {
  const x0 = cx - (line.width * scale) / 2;
  return line.glyphs.map((g) => cmdsToPath(g.cmds, [scale, 0, 0, scale, x0 + g.x * scale, y])).join('');
}
