// مصمم الأختام الذكي: يقترح عدة تصاميم احترافية من بيانات العميل.
// يستخدم Claude عند توفر مفتاح ANTHROPIC_API_KEY، وإلا يعمل بمولّد محلي.
import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import { z } from 'zod';
import { SHAPES, BORDERS, SEPARATORS, INK_PRESETS, DEFAULT_SIZES, normalizeSpec } from './seal.js';
import { AR_FONTS, EN_FONTS } from './fonts.js';

const MODEL = process.env.KHATMI_AI_MODEL || 'claude-opus-5-5';

const clean = (s, n = 60) => String(s ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, n);

/** توحيد بيانات العميل */
export function normalizeInputs(raw = {}) {
  const lang = ['ar', 'en', 'both'].includes(raw.lang) ? raw.lang : 'ar';
  return {
    kind: raw.kind === 'personal' ? 'personal' : 'company',
    lang,
    nameAr: clean(raw.nameAr),
    nameEn: clean(raw.nameEn),
    tagline: clean(raw.tagline),
    extra: clean(raw.extra),
    city: clean(raw.city, 30),
    logoId: typeof raw.logoId === 'string' ? raw.logoId : null,
    style: clean(raw.style, 120),
  };
}

// يحدد النصوص الأساسية حسب اللغة المختارة
function primaryTexts(inp) {
  const ar = inp.lang !== 'en' ? inp.nameAr : '';
  const en = inp.lang !== 'ar' ? inp.nameEn : '';
  const main = ar || en || inp.nameAr || inp.nameEn;
  const second = ar && en ? en : '';
  return { main, second };
}

/** مولّد محلي: 4 تصاميم متنوعة ومتوازنة */
export function localVariants(raw) {
  const inp = normalizeInputs(raw);
  const { main, second } = primaryTexts(inp);
  const hasLogo = Boolean(inp.logoId);
  const icon = hasLogo ? 'logo' : 'none';
  const sub = inp.tagline;
  const loc = inp.city;
  const personal = inp.kind === 'personal';
  const base = { logoId: inp.logoId, fontEn: 'montserrat' };
  const bottomA = second || sub || loc;
  const centerA = second ? sub || loc : bottomA === sub ? loc : '';

  const v = [
    {
      title: 'دائري كلاسيكي', titleEn: 'Classic round',
      reason: personal ? 'الشكل الأكثر استخداماً للأختام الشخصية والرسمية.' : 'الشكل الرسمي المعتاد للشركات، الاسم يلتف حول الإطار.',
      spec: { ...base, shape: 'circle', border: 'double', ink: '#1f3c88', fontAr: 'cairo', separator: 'star', icon,
        texts: { top: main, bottom: bottomA, center: hasLogo ? '' : centerA, extra: hasLogo ? '' : inp.extra } },
    },
    {
      title: 'بيضاوي فاخر', titleEn: 'Elegant oval',
      reason: 'خط النسخ (أميري) بإطار مزدوج سميك يعطي طابعاً رسمياً فاخراً.',
      spec: { ...base, shape: 'oval', border: 'thick-thin', ink: '#c1121f', fontAr: 'amiri', fontEn: 'playfair', separator: 'star', icon,
        texts: { top: main, bottom: second || loc || sub, center: hasLogo ? '' : (second ? sub : '') || inp.extra, extra: '' } },
    },
    {
      title: 'مستطيل عصري', titleEn: 'Modern rectangle',
      reason: 'مناسب للفواتير والمستندات؛ يتسع لأسطر متعددة ويظهر الشعار بجانب الاسم.',
      spec: { ...base, shape: 'rounded', border: 'single', ink: '#111111', fontAr: 'tajawal', separator: 'none', icon,
        texts: { top: main, center: sub, bottom: second, extra: inp.extra || loc } },
    },
    {
      title: personal ? 'توقيع كوفي' : 'سداسي مميز', titleEn: personal ? 'Kufi signature' : 'Distinctive hexagon',
      reason: personal ? 'خط كوفي هندسي بإطار منقّط يعطي هوية شخصية مميزة.' : 'شكل غير تقليدي يميز علامتك التجارية مع إطار مزخرف.',
      spec: { ...base, shape: personal ? 'circle' : 'hexagon', border: personal ? 'dotted' : 'beaded', ink: personal ? '#5b2a86' : '#1b7a3a', fontAr: 'reemkufi', separator: 'dot',
        icon: hasLogo ? 'logo' : personal ? 'none' : 'none',
        texts: { top: main, bottom: second || sub, center: hasLogo ? '' : (second ? sub : '') || loc || inp.extra, extra: '' } },
    },
  ];
  return v.map((x) => ({ ...x, spec: normalizeSpec(x.spec) }));
}

// ---------- الذكاء الاصطناعي ----------
const VariantSchema = z.object({
  title: z.string().describe('اسم قصير للتصميم بالعربية'),
  titleEn: z.string().describe('Short design name in English'),
  reason: z.string().describe('سبب اختيار هذا التصميم بجملة عربية واحدة'),
  shape: z.enum(SHAPES),
  border: z.enum(BORDERS),
  ink: z.string().describe('Hex ink color like #1f3c88'),
  fontAr: z.enum(AR_FONTS),
  fontEn: z.enum(EN_FONTS),
  separator: z.enum(SEPARATORS),
  icon: z.enum(['none', 'logo', 'star', 'crescent', 'check']),
  top: z.string(),
  bottom: z.string(),
  center: z.string(),
  extra: z.string(),
});
const ResultSchema = z.object({ variants: z.array(VariantSchema) });

const SYSTEM = `أنت مصمم أختام محترف في ليبيا تعمل داخل تطبيق "ختمي".
مهمتك: اقتراح 4 تصاميم أختام مختلفة ومتوازنة بصرياً من بيانات العميل.

قواعد التخطيط:
- الأشكال circle / oval / hexagon: النص "top" يلتف أعلى الإطار (الاسم الرئيسي)، و"bottom" يلتف أسفله (الاسم بالإنجليزية أو النشاط أو المدينة)، و"center" و"extra" سطران قصيران في المنتصف (اتركهما فارغين إذا كان هناك شعار ليبقى المنتصف للشعار، أو ضع سطراً قصيراً جداً).
- الأشكال rect / rounded: الأسطر تُرتب top ثم center ثم bottom ثم extra، والأيقونة أو الشعار على الجانب.
- استخدم فقط النصوص التي قدمها العميل. يُسمح بالاختصار أو إعادة الترتيب، وبترجمة الاسم أو كتابته بحروف إنجليزية فقط إذا طلب العميل اللغتين ولم يكتب الاسم الإنجليزي.
- إذا كانت اللغة عربية فقط فلا تضع نصوصاً إنجليزية، والعكس صحيح.
- الأختام تُسعَّر بعدد الحروف، فلا تضف كلمات زائدة لم يطلبها العميل.
- icon = "logo" فقط إذا أرفق العميل شعاراً (has_logo = true)؛ وإلا استخدم "none" غالباً، أو أيقونة مدمجة (star / crescent / check) في تصميم واحد على الأكثر (الأيقونة لها رسوم إضافية).
- نوّع بين الأشكال والألوان والخطوط والإطارات. ألوان الحبر الشائعة: ${INK_PRESETS.join(', ')}.
- الخطوط: cairo (عصري) tajawal (نظيف) amiri (نسخ رسمي) reemkufi (كوفي) للعربي، و montserrat / playfair للإنجليزي.`;

let client = null;
export const aiEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);

export async function aiVariants(raw) {
  const inp = normalizeInputs(raw);
  if (!aiEnabled()) return null;
  client ||= new Anthropic();
  const user = JSON.stringify({
    type: inp.kind === 'personal' ? 'ختم شخصي' : 'ختم شركة/مؤسسة',
    language: { ar: 'عربي فقط', en: 'English only', both: 'عربي وإنجليزي' }[inp.lang],
    name_ar: inp.nameAr, name_en: inp.nameEn, activity_or_title: inp.tagline, city: inp.city, extra_line: inp.extra,
    has_logo: Boolean(inp.logoId), style_notes: inp.style,
  });
  const response = await client.beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    betas: ['server-side-fallback-2026-07-01'],
    fallbacks: 'default',
    output_config: { effort: 'low', format: betaZodOutputFormat(ResultSchema) },
    system: SYSTEM,
    messages: [{ role: 'user', content: `بيانات العميل:\n${user}` }],
  });
  if (response.stop_reason === 'refusal' || !response.parsed_output) return null;
  return response.parsed_output.variants.slice(0, 4).map((v) => ({
    title: v.title, titleEn: v.titleEn, reason: v.reason,
    spec: normalizeSpec({
      shape: v.shape, border: v.border, ink: v.ink, fontAr: v.fontAr, fontEn: v.fontEn, separator: v.separator,
      icon: v.icon === 'logo' && !inp.logoId ? 'none' : v.icon, logoId: inp.logoId,
      widthMm: DEFAULT_SIZES[v.shape][0], heightMm: DEFAULT_SIZES[v.shape][1],
      texts: { top: v.top, bottom: v.bottom, center: v.center, extra: v.extra },
    }),
  }));
}

/** يحاول الذكاء الاصطناعي أولاً ثم يرجع للمولد المحلي عند أي خطأ. */
export async function suggestDesigns(raw, log = console) {
  try {
    const ai = await aiVariants(raw);
    if (ai && ai.length) return { source: 'ai', variants: ai };
  } catch (err) {
    log.warn?.('[ai] fallback to local designer:', err?.message || err);
  }
  return { source: 'local', variants: localVariants(raw) };
}
