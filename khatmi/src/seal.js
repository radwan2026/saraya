// محرك رسم الأختام: يحوّل مواصفات التصميم (spec) إلى ملف SVG متجه بالكامل.
// كل النصوص تتحول إلى منحنيات، لذا يُفتح الملف في Illustrator / Inkscape / CorelDraw
// ويُطبع بدقة دون الحاجة لتثبيت الخطوط.
import { shapeLine, cmdsToPath, straightTextPath, hasArabic, FONT_FAMILIES } from './fonts.js';

export const SHAPES = ['circle', 'oval', 'rect', 'rounded', 'hexagon'];
export const BORDERS = ['single', 'double', 'thick-thin', 'dotted', 'dashed', 'beaded'];
export const ICONS = ['none', 'logo', 'star', 'crescent', 'check'];
export const SEPARATORS = ['star', 'dot', 'none'];
export const INK_PRESETS = ['#1f3c88', '#0b5ed7', '#c1121f', '#111111', '#1b7a3a', '#5b2a86', '#b8860b'];

export const DEFAULT_SIZES = {
  circle: [40, 40], hexagon: [40, 40], oval: [50, 35], rect: [60, 30], rounded: [60, 30],
};

const U = 10; // وحدة الرسم: 10 وحدات = 1 ملم
const MAX_TEXT = 60;

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
const num = (v, d) => (Number.isFinite(Number(v)) ? Number(v) : d);
const pick = (v, list, d) => (list.includes(v) ? v : d);
const cleanText = (s) => String(s ?? '').replace(/[\u0000-\u001f\u007f<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, MAX_TEXT);

/** تنظيف وتوحيد مواصفات التصميم القادمة من العميل أو من الذكاء الاصطناعي. */
export function normalizeSpec(input = {}) {
  const shape = pick(input.shape, SHAPES, 'circle');
  const [dw, dh] = DEFAULT_SIZES[shape];
  let widthMm = clamp(num(input.widthMm, dw), 20, 120);
  let heightMm = clamp(num(input.heightMm, dh), 15, 120);
  if (shape === 'circle' || shape === 'hexagon') heightMm = widthMm;
  if (shape === 'oval' && heightMm >= widthMm) heightMm = Math.round(widthMm * 0.7);
  const ink = /^#[0-9a-fA-F]{6}$/.test(input.ink || '') ? input.ink.toLowerCase() : INK_PRESETS[0];
  const t = input.texts || {};
  const texts = { top: cleanText(t.top), bottom: cleanText(t.bottom), center: cleanText(t.center), extra: cleanText(t.extra) };
  let icon = pick(input.icon, ICONS, 'none');
  const logoId = typeof input.logoId === 'string' && /^[a-f0-9]{16,64}$/.test(input.logoId) ? input.logoId : null;
  if (icon === 'logo' && !logoId) icon = 'none';
  return {
    shape,
    widthMm,
    heightMm,
    ink,
    border: pick(input.border, BORDERS, 'double'),
    fontAr: FONT_FAMILIES[input.fontAr] ? input.fontAr : 'cairo',
    fontEn: FONT_FAMILIES[input.fontEn] ? input.fontEn : 'montserrat',
    texts,
    icon,
    logoId: icon === 'logo' ? logoId : null,
    separator: pick(input.separator, SEPARATORS, 'star'),
    innerRing: input.innerRing !== false,
    textScale: clamp(num(input.textScale, 1), 0.6, 1.4),
    letterSpacing: clamp(num(input.letterSpacing, 0), 0, 1),
  };
}

const fontFor = (spec, text) => (hasArabic(text) ? spec.fontAr : spec.fontEn);

// مقاييس مرجعية لكل خط حتى يكون ارتفاع النص ثابتاً مهما كانت الحروف.
const metricCache = new Map();
function refMetrics(family, arabic) {
  const key = family + arabic;
  if (!metricCache.has(key)) {
    const l = shapeLine(arabic ? 'لأجيك' : 'HÉgjy', family, 100);
    metricCache.set(key, { asc: -l.top / 100, desc: l.bottom / 100 });
  }
  return metricCache.get(key);
}

// ---------- أشكال مساعدة ----------
const r2 = (n) => Math.round(n * 100) / 100;

function starPath(cx, cy, ro, ri, n = 5, rotDeg = -90) {
  let d = '';
  for (let i = 0; i < n * 2; i++) {
    const r = i % 2 ? ri : ro;
    const a = ((rotDeg + (i * 180) / n) * Math.PI) / 180;
    d += `${i ? 'L' : 'M'}${r2(cx + r * Math.cos(a))} ${r2(cy + r * Math.sin(a))}`;
  }
  return d + 'Z';
}

function circleIntersections(r1, x2, y2, r2_) {
  const d = Math.hypot(x2, y2);
  const a = (r1 * r1 - r2_ * r2_ + d * d) / (2 * d);
  const h = Math.sqrt(Math.max(0, r1 * r1 - a * a));
  const px = (a * x2) / d;
  const py = (a * y2) / d;
  return [
    [px + (h * y2) / d, py - (h * x2) / d],
    [px - (h * y2) / d, py + (h * x2) / d],
  ];
}

// أيقونات مدمجة داخل مربع مركزه (cx,cy) ونصف ضلعه s
function builtinIcon(kind, cx, cy, s, ink) {
  if (kind === 'star') return `<path d="${starPath(cx, cy, s, s * 0.42)}" fill="${ink}"/>`;
  if (kind === 'crescent') {
    const R = s * 0.85;
    const ox = R * 0.42;
    const oy = -R * 0.12;
    const R2 = R * 0.84;
    const [p1, p2] = circleIntersections(R, ox, oy, R2);
    const X = (p) => `${r2(cx - s * 0.12 + p[0])} ${r2(cy + p[1])}`;
    const crescent = `M${X(p1)}A${r2(R)} ${r2(R)} 0 1 0 ${X(p2)}A${r2(R2)} ${r2(R2)} 0 1 1 ${X(p1)}Z`;
    return `<path d="${crescent}" fill="${ink}"/><path d="${starPath(cx + s * 0.5, cy - s * 0.08, s * 0.3, s * 0.12)}" fill="${ink}"/>`;
  }
  if (kind === 'check') {
    const w = s * 0.16;
    return `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(s * 0.9)}" fill="none" stroke="${ink}" stroke-width="${r2(w)}"/>` +
      `<path d="M${r2(cx - s * 0.45)} ${r2(cy + s * 0.02)}L${r2(cx - s * 0.12)} ${r2(cy + s * 0.35)}L${r2(cx + s * 0.5)} ${r2(cy - s * 0.35)}" fill="none" stroke="${ink}" stroke-width="${r2(w * 1.3)}" stroke-linecap="round" stroke-linejoin="round"/>`;
  }
  return '';
}

// ---------- الحدود ----------
function makeOutline(shape, W, H) {
  const cx = W / 2;
  const cy = H / 2;
  return (k, attrs) => {
    switch (shape) {
      case 'circle': return `<circle cx="${r2(cx)}" cy="${r2(cy)}" r="${r2(W / 2 - k)}" ${attrs}/>`;
      case 'oval': return `<ellipse cx="${r2(cx)}" cy="${r2(cy)}" rx="${r2(W / 2 - k)}" ry="${r2(H / 2 - k)}" ${attrs}/>`;
      case 'hexagon': {
        const R = (W / 2 - k / 0.866) ;
        const pts = [];
        for (let i = 0; i < 6; i++) {
          const a = ((60 * i - 90) * Math.PI) / 180;
          pts.push(`${r2(cx + R * Math.cos(a))},${r2(cy + R * Math.sin(a))}`);
        }
        return `<polygon points="${pts.join(' ')}" ${attrs}/>`;
      }
      default: {
        const rx = shape === 'rounded' ? Math.max(0, Math.min(W, H) * 0.14 - k) : 0;
        return `<rect x="${r2(k)}" y="${r2(k)}" width="${r2(W - 2 * k)}" height="${r2(H - 2 * k)}" rx="${r2(rx)}" ${attrs}/>`;
      }
    }
  };
}

function borderElements(outline, style, sw, ink) {
  const st = (w, extra = '') => `fill="none" stroke="${ink}" stroke-width="${r2(w)}" ${extra}`;
  const els = [];
  let used;
  switch (style) {
    case 'single':
      els.push(outline(sw * 0.75, st(sw * 1.5)));
      used = sw * 1.5;
      break;
    case 'thick-thin':
      els.push(outline(sw * 1.3, st(sw * 2.6)));
      els.push(outline(sw * 4.1, st(sw * 0.6)));
      used = sw * 4.4;
      break;
    case 'dotted':
      els.push(outline(sw * 0.6, st(sw * 1.2)));
      els.push(outline(sw * 2.9, st(sw * 1.5, `stroke-linecap="round" stroke-dasharray="0 ${r2(sw * 3)}"`)));
      used = sw * 3.7;
      break;
    case 'dashed':
      els.push(outline(sw * 0.7, st(sw * 1.4, `stroke-dasharray="${r2(sw * 4)} ${r2(sw * 2.5)}"`)));
      els.push(outline(sw * 2.9, st(sw * 0.6)));
      used = sw * 3.2;
      break;
    case 'beaded':
      els.push(outline(sw * 0.35, st(sw * 0.7)));
      els.push(outline(sw * 2.2, st(sw * 2.1, `stroke-linecap="round" stroke-dasharray="0 ${r2(sw * 3.4)}"`)));
      els.push(outline(sw * 4.1, st(sw * 0.7)));
      used = sw * 4.5;
      break;
    default: // double
      els.push(outline(sw * 0.65, st(sw * 1.3)));
      els.push(outline(sw * 2.9, st(sw * 0.6)));
      used = sw * 3.2;
  }
  return { els, used };
}

// ---------- نص على منحنى بيضاوي/دائري ----------
function ellipseCurve(cx, cy, a, b, side) {
  const N = 1440;
  const pts = [];
  let len = 0;
  for (let i = 0; i <= N; i++) {
    const t = side === 'top' ? Math.PI / 2 + (2 * Math.PI * i) / N : (3 * Math.PI) / 2 - (2 * Math.PI * i) / N;
    const x = cx + a * Math.cos(t);
    const y = cy + b * Math.sin(t);
    if (i) len += Math.hypot(x - pts[i - 1].x, y - pts[i - 1].y);
    pts.push({ x, y, t, s: len });
  }
  const at = (s) => {
    s = clamp(s, 0, len);
    let lo = 0;
    let hi = N;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (pts[mid].s < s) lo = mid; else hi = mid;
    }
    const p = pts[lo];
    const q = pts[hi];
    const f = q.s === p.s ? 0 : (s - p.s) / (q.s - p.s);
    return { x: p.x + (q.x - p.x) * f, y: p.y + (q.y - p.y) * f, t: p.t + (q.t - p.t) * f, angle: Math.atan2(q.y - p.y, q.x - p.x) };
  };
  return { length: len, at };
}

function curvedText(spec, text, geo, side, maxFrac) {
  const family = fontFor(spec, text);
  const arabic = hasArabic(text);
  const m = refMetrics(family, arabic);
  let size = (geo.bandH * 0.84 * spec.textScale) / (m.asc + m.desc);
  // نقيس على خط الأساس التقريبي (منتصف الحزام)
  const mid = geo.bandOut + geo.bandH / 2;
  const approx = ellipseCurve(geo.cx, geo.cy, geo.a - mid, geo.b - mid, side).length;
  const avail = approx * maxFrac;
  let line = shapeLine(text, family, size);
  if (line.width > avail) {
    size *= avail / line.width;
    line = shapeLine(text, family, size);
  }
  let spacing = spec.letterSpacing * size * 0.5;
  if (!arabic) {
    const gaps = Math.max(1, line.glyphs.filter((g) => g.adv > 0).length - 1);
    const fill = Math.max(0, (avail * 0.8 - line.width) / gaps);
    spacing = Math.min(spacing + Math.min(fill, size * 0.45), (avail - line.width) / gaps);
    if (spacing > 0) line = shapeLine(text, family, size, spacing);
  }
  const asc = m.asc * size;
  const desc = m.desc * size;
  const pad = (geo.bandH - asc - desc) / 2;
  const baseInset = geo.bandOut + pad + (side === 'top' ? asc : desc);
  const curve = ellipseCurve(geo.cx, geo.cy, geo.a - baseInset, geo.b - baseInset, side);
  const s0 = curve.length / 2 - line.width / 2;
  let d = '';
  for (const g of line.glyphs) {
    const half = g.adv / 2;
    const P = curve.at(s0 + g.x + half);
    const c = Math.cos(P.angle);
    const s = Math.sin(P.angle);
    d += cmdsToPath(g.cmds, [c, s, -s, c, P.x - c * half, P.y - s * half]);
  }
  return { d, tStart: curve.at(s0).t, tEnd: curve.at(s0 + line.width).t };
}

// ---------- سطر مستقيم مع ملاءمة العرض ----------
function fittedLine(spec, text, targetH, maxW) {
  const family = fontFor(spec, text);
  const m = refMetrics(family, hasArabic(text));
  let size = targetH / (m.asc + m.desc);
  let line = shapeLine(text, family, size, hasArabic(text) ? 0 : spec.letterSpacing * size * 0.4);
  if (line.width > maxW) {
    size *= maxW / line.width;
    line = shapeLine(text, family, size, hasArabic(text) ? 0 : spec.letterSpacing * size * 0.4);
  }
  return { line, asc: m.asc * size, desc: m.desc * size, h: (m.asc + m.desc) * size };
}

function iconBox(spec, cx, cy, half, logo, ink) {
  if (spec.icon === 'logo' && logo) {
    const ratio = logo.width / logo.height;
    let w = half * 2;
    let h = half * 2;
    if (ratio > 1) h = w / ratio; else w = h * ratio;
    return `<image x="${r2(cx - w / 2)}" y="${r2(cy - h / 2)}" width="${r2(w)}" height="${r2(h)}" href="${logo.dataUri}" xlink:href="${logo.dataUri}"/>`;
  }
  return builtinIcon(spec.icon, cx, cy, half, ink);
}

// محتوى المنتصف داخل منطقة بيضاوية نصف قطريها (ax, ay)
function centerContent(spec, cx, cy, ax, ay, logo) {
  const { center, extra } = spec.texts;
  const hasIcon = spec.icon !== 'none' && (spec.icon !== 'logo' || logo);
  const items = [];
  const R = Math.min(ax, ay);
  const sc = spec.textScale;
  if (hasIcon) items.push({ kind: 'icon', h: R * (center || extra ? 0.95 : 1.35) * (spec.icon === 'logo' ? 1.1 : 0.8) });
  if (center) items.push({ kind: 'center', text: center, h: R * (hasIcon ? 0.3 : 0.38) * sc });
  if (extra) items.push({ kind: 'extra', text: extra, h: R * 0.22 * sc });
  if (!items.length) return '';
  const gap = R * 0.07;
  let total = items.reduce((s, it) => s + it.h, 0) + gap * (items.length - 1);
  const maxTotal = ay * 1.62;
  if (total > maxTotal) {
    const k = maxTotal / total;
    items.forEach((it) => { it.h *= k; });
    total = maxTotal;
  }
  let y = cy - total / 2;
  const chord = (dy) => 2 * ax * Math.sqrt(Math.max(0, 1 - (dy / ay) ** 2)) * 0.92;
  let out = '';
  for (const it of items) {
    if (it.kind === 'icon') {
      const half = Math.min(it.h / 2, chord(Math.max(Math.abs(y - cy), Math.abs(y + it.h - cy))) / 2 || it.h / 2);
      out += `<g id="icon">${iconBox(spec, cx, y + it.h / 2, half, logo, spec.ink)}</g>`;
    } else {
      const edge = Math.max(Math.abs(y - cy), Math.abs(y + it.h - cy));
      const f = fittedLine(spec, it.text, it.h, chord(edge));
      const base = y + (it.h - f.h) / 2 + f.asc;
      out += `<path id="${it.kind}-text" d="${straightTextPath(f.line, cx, base)}" fill="${spec.ink}"/>`;
    }
    y += it.h + gap;
  }
  return out;
}

function sepMark(kind, x, y, s, ink) {
  if (kind === 'none') return '';
  if (kind === 'dot') return `<circle cx="${r2(x)}" cy="${r2(y)}" r="${r2(s * 0.5)}" fill="${ink}"/>`;
  return `<path d="${starPath(x, y, s, s * 0.42)}" fill="${ink}"/>`;
}

function renderRound(spec, W, H, sw, logo) {
  const cx = W / 2;
  const cy = H / 2;
  const outline = makeOutline(spec.shape, W, H);
  const { els, used } = borderElements(outline, spec.border, sw, spec.ink);
  const minR = Math.min(W, H) / 2;
  // للسداسي نستخدم الدائرة الداخلية المماسة
  const a = spec.shape === 'hexagon' ? (W / 2) * 0.866 : W / 2;
  const b = spec.shape === 'hexagon' ? (H / 2) * 0.866 : H / 2;
  const { top, bottom } = spec.texts;
  const hasBand = Boolean(top || bottom);
  const bandOut = used + sw * 0.9;
  const bandH = minR * 0.25;
  const geo = { cx, cy, a, b, bandOut, bandH };
  let out = `<g id="border">${els.join('')}</g>`;
  let innerInset = used + sw;
  if (hasBand) {
    const ringInset = bandOut + bandH + sw * 0.4;
    innerInset = ringInset + sw * 1.2;
    if (spec.innerRing) {
      const ringOutline = (k, attrs) => `<ellipse cx="${r2(cx)}" cy="${r2(cy)}" rx="${r2(a - k)}" ry="${r2(b - k)}" ${attrs}/>`;
      const st = `fill="none" stroke="${spec.ink}" stroke-width="${r2(sw * 0.7)}"`;
      out += `<g id="inner-ring">${ringOutline(ringInset, st)}`;
      if (spec.border === 'double' || spec.border === 'thick-thin') out += ringOutline(ringInset + sw * 1.4, st);
      out += '</g>';
      innerInset += spec.border === 'double' || spec.border === 'thick-thin' ? sw * 1.4 : 0;
    }
    let topRes = null;
    let botRes = null;
    if (top) {
      topRes = curvedText(spec, top, geo, 'top', bottom ? 0.47 : 0.78);
      out += `<path id="top-text" d="${topRes.d}" fill="${spec.ink}"/>`;
    }
    if (bottom) {
      botRes = curvedText(spec, bottom, geo, 'bottom', top ? 0.33 : 0.6);
      out += `<path id="bottom-text" d="${botRes.d}" fill="${spec.ink}"/>`;
    }
    // فواصل زخرفية بين النص العلوي والسفلي
    const midInset = bandOut + bandH / 2;
    const ps = (t) => [cx + (a - midInset) * Math.cos(t), cy + (b - midInset) * Math.sin(t)];
    const ss = bandH * 0.22;
    let seps = '';
    if (topRes && botRes) {
      const left = (topRes.tStart + botRes.tStart) / 2;
      const right = (topRes.tEnd + (botRes.tEnd + 2 * Math.PI)) / 2;
      seps += sepMark(spec.separator, ...ps(left), ss, spec.ink) + sepMark(spec.separator, ...ps(right), ss, spec.ink);
    } else if (topRes) {
      seps += sepMark(spec.separator, ...ps(Math.PI / 2), ss * 1.3, spec.ink);
    } else if (botRes) {
      seps += sepMark(spec.separator, ...ps((3 * Math.PI) / 2), ss * 1.3, spec.ink);
    }
    if (seps) out += `<g id="separators">${seps}</g>`;
  }
  out += `<g id="center">${centerContent(spec, cx, cy, a - innerInset, b - innerInset, logo)}</g>`;
  return out;
}

function renderRect(spec, W, H, sw, logo) {
  const outline = makeOutline(spec.shape, W, H);
  const { els, used } = borderElements(outline, spec.border, sw, spec.ink);
  let out = `<g id="border">${els.join('')}</g>`;
  const pad = used + sw * 2.2 + (spec.shape === 'rounded' ? Math.min(W, H) * 0.03 : 0);
  let x0 = pad;
  let x1 = W - pad;
  const y0 = pad;
  const y1 = H - pad;
  const innerH = y1 - y0;
  const { top, bottom, center, extra } = spec.texts;
  const hasIcon = spec.icon !== 'none' && (spec.icon !== 'logo' || logo);
  const anyText = top || bottom || center || extra;
  if (hasIcon) {
    const side = Math.min(innerH * 0.92, (x1 - x0) * (anyText ? 0.34 : 1));
    const rtl = hasArabic(top || center || bottom || '');
    const icx = !anyText ? (x0 + x1) / 2 : rtl ? x1 - side / 2 : x0 + side / 2;
    out += `<g id="icon">${iconBox(spec, icx, (y0 + y1) / 2, side / 2, logo, spec.ink)}</g>`;
    if (anyText) {
      if (rtl) x1 -= side + sw * 2.5; else x0 += side + sw * 2.5;
      const lx = rtl ? x1 + sw * 1.25 : x0 - sw * 1.25;
      out += `<line x1="${r2(lx)}" y1="${r2(y0 + innerH * 0.08)}" x2="${r2(lx)}" y2="${r2(y1 - innerH * 0.08)}" stroke="${spec.ink}" stroke-width="${r2(sw * 0.6)}"/>`;
    }
  }
  const rows = [
    { id: 'top-text', text: top, w: 1 },
    { id: 'center-text', text: center, w: 0.62 },
    { id: 'bottom-text', text: bottom, w: 0.72 },
    { id: 'extra-text', text: extra, w: 0.5 },
  ].filter((r) => r.text);
  if (!rows.length) return out;
  const gap = innerH * 0.06;
  const ruleH = rows.length > 1 ? sw * 1.6 : 0;
  const sumW = rows.reduce((s, r) => s + r.w, 0);
  const unit = Math.min((innerH - gap * (rows.length - 1) - ruleH) / sumW, innerH * 0.5) * spec.textScale;
  const blockH = unit * sumW + gap * (rows.length - 1) + ruleH;
  let y = (y0 + y1) / 2 - Math.min(blockH, innerH) / 2;
  const cx = (x0 + x1) / 2;
  const maxW = (x1 - x0) * 0.96;
  rows.forEach((r, i) => {
    const f = fittedLine(spec, r.text, unit * r.w, maxW);
    const base = y + (unit * r.w - f.h) / 2 + f.asc;
    out += `<path id="${r.id}" d="${straightTextPath(f.line, cx, base)}" fill="${spec.ink}"/>`;
    y += unit * r.w + gap;
    if (i === 0 && ruleH) {
      const lw = Math.min(maxW, Math.max(f.line.width, maxW * 0.5));
      out += `<line x1="${r2(cx - lw / 2)}" y1="${r2(y - gap / 2 + ruleH / 2)}" x2="${r2(cx + lw / 2)}" y2="${r2(y - gap / 2 + ruleH / 2)}" stroke="${spec.ink}" stroke-width="${r2(sw * 0.5)}"/>`;
      y += ruleH;
    }
  });
  return out;
}

function watermark(W, H) {
  const line = shapeLine('ختمي · معاينة · KHATMI', 'cairo', Math.min(W, H) * 0.075);
  let d = '';
  const stepY = Math.min(W, H) * 0.22;
  const diag = Math.hypot(W, H);
  const ang = (-28 * Math.PI) / 180;
  const c = Math.cos(ang);
  const s = Math.sin(ang);
  for (let row = -4; row <= 4; row++) {
    for (let col = -2; col <= 2; col++) {
      const lx = col * (line.width + diag * 0.08) + (row % 2) * line.width * 0.5;
      const ly = row * stepY;
      const x = W / 2 + lx * c - ly * s - (line.width / 2) * c;
      const y = H / 2 + lx * s + ly * c - (line.width / 2) * s;
      for (const g of line.glyphs) d += cmdsToPath(g.cmds, [c, s, -s, c, x + g.x * c, y + g.x * s]);
    }
  }
  return `<g id="watermark" opacity="0.28"><path d="${d}" fill="#7a7a7a"/></g>`;
}

/**
 * يرسم الختم ويعيد نص SVG.
 * @param {object} rawSpec مواصفات التصميم
 * @param {{watermark?: boolean, logo?: {dataUri:string,width:number,height:number}|null, title?: string}} opts
 */
export function renderSeal(rawSpec, opts = {}) {
  const spec = normalizeSpec(rawSpec);
  const W = spec.widthMm * U;
  const H = spec.heightMm * U;
  const sw = Math.min(W, H) * 0.012;
  const logo = spec.icon === 'logo' ? opts.logo || null : null;
  const body = spec.shape === 'rect' || spec.shape === 'rounded' ? renderRect(spec, W, H, sw, logo) : renderRound(spec, W, H, sw, logo);
  const m = U; // هامش 1 ملم حول الختم
  const title = cleanText(opts.title || spec.texts.top || 'Khatmi seal');
  return `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${spec.widthMm + 2}mm" height="${spec.heightMm + 2}mm" viewBox="${-m} ${-m} ${W + 2 * m} ${H + 2 * m}">` +
    `<title>${title}</title><desc>Designed with Khatmi - ختمي</desc>` +
    `<g id="seal">${body}</g>${opts.watermark ? watermark(W, H) : ''}</svg>`;
}
