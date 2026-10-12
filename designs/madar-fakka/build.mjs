// يولّد كروت "مدار فكة" (5×2 سم) بهوية شركة المدار الجديد.
// الاستخدام: node designs/madar-fakka/build.mjs
// المخرجات في designs/madar-fakka/out/: PDF بالمقاس الفعلي + PNG للمعاينة + ورقة A4 للطباعة.
import { createRequire } from 'node:module';
import { readFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// playwright من التثبيت المحلي أو العام (NODE_PATH=$(npm root -g))
const { chromium } = createRequire(import.meta.url)('playwright');

const here = dirname(fileURLToPath(import.meta.url));
const out = join(here, 'out');
mkdirSync(out, { recursive: true });

const b64 = (f) => 'data:image/png;base64,' + readFileSync(join(here, 'assets', f)).toString('base64');
const LOGO = b64('logo.png');
const ICON = b64('icon.png');
const font = (w) => `@font-face { font-family: 'Cairo'; font-weight: ${w}; src: url(data:font/ttf;base64,${readFileSync(join(here, 'assets', `cairo-${w}.ttf`)).toString('base64')}) format('truetype'); }`;

const CARDS = [
  { id: 'fakka-1-dinar', amount: '1', unit: 'دينار', label: 'رصيد دينار' },
  { id: 'fakka-half-dinar', amount: '0.5', unit: 'نصف دينار', label: 'رصيد نصف دينار' },
];

const CSS = `
${font(800)}
${font(900)}
* { margin: 0; padding: 0; box-sizing: border-box; }
body { background: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
.card {
  position: relative; width: 50mm; height: 20mm; overflow: hidden;
  font-family: 'Cairo', sans-serif; direction: rtl;
  background: linear-gradient(135deg, #ffffff 0%, #ffffff 55%, #eef6e3 100%);
}
.card svg.bg { position: absolute; inset: 0; width: 50mm; height: 20mm; }
.watermark { position: absolute; left: 17mm; bottom: -3mm; height: 15mm; opacity: .07; }
.info {
  position: absolute; right: 2mm; top: 1.4mm; left: 19mm;
  display: flex; flex-direction: column; align-items: flex-start;
}
.info .logo { height: 5.8mm; display: block; }
.info .title {
  margin-top: 1.1mm; font-weight: 900; font-size: 4.5mm; line-height: 1;
  color: #3d7a1c; letter-spacing: -.05mm;
}
.info .title span { color: #8cc63f; }
.info .pill {
  margin-top: .9mm; font-weight: 800; font-size: 2.15mm; line-height: 1;
  color: #fff; background: #5a9a2a; border-radius: 2mm; padding: .55mm 1.8mm .75mm;
}
.value {
  position: absolute; left: 0; top: 0; width: 15mm; height: 20mm;
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  color: #fff; text-shadow: 0 .15mm .3mm rgba(0,0,0,.25);
}
.value .num { font-weight: 900; line-height: .9; font-size: 10mm; direction: ltr; }
.value .num.small { font-size: 7.6mm; }
.value .unit { font-weight: 800; font-size: 2.5mm; line-height: 1; margin-top: .6mm; white-space: nowrap; }
`;

// اللوح الأخضر للقيمة + خطّا المدار الرماديان (مستوحاة من الشعار)
const BG = `
<svg class="bg" viewBox="0 0 50 20" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="0.3" y2="1">
      <stop offset="0" stop-color="#9ccd4c"/><stop offset=".55" stop-color="#6aa832"/><stop offset="1" stop-color="#3d7a1c"/>
    </linearGradient>
    <linearGradient id="s" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#e6e6e6"/><stop offset=".5" stop-color="#9a9a9a"/><stop offset="1" stop-color="#d0d0d0"/>
    </linearGradient>
  </defs>
  <path d="M0 0 H14.6 C18.6 4.5 18.6 15 15.2 20 H0 Z" fill="url(#g)"/>
  <path d="M15.6 -0.5 C20.2 4.5 20 15 16.2 20.5" fill="none" stroke="url(#s)" stroke-width=".75"/>
  <path d="M16.9 -0.5 C21.3 4.8 21.1 15 17.6 20.5" fill="none" stroke="url(#s)" stroke-width=".35"/>
  <rect x="0" y="19.25" width="50" height=".75" fill="#5a9a2a"/>
</svg>`;

const card = (c) => `
<div class="card">
  ${BG}
  <img class="watermark" src="${ICON}">
  <div class="value">
    <div class="num ${c.amount.length > 1 ? 'small' : ''}">${c.amount}</div>
    <div class="unit">${c.unit}</div>
  </div>
  <div class="info">
    <img class="logo" src="${LOGO}">
    <div class="title">مدار <span>فكة</span></div>
    <div class="pill">${c.label}</div>
  </div>
</div>`;

const page = (body, size) => `<!doctype html><html lang="ar"><head><meta charset="utf-8">
<style>@page { size: ${size}; margin: 0; } ${CSS}</style></head><body>${body}</body></html>`;

// ورقة A4: 4 أعمدة × 14 صفاً = 56 كرتاً، مع علامات قص في الهوامش
const COLS = 4, ROWS = 14, X0 = 5, Y0 = 8.5;
const sheet = (c) => {
  let cells = '', marks = '';
  for (let r = 0; r < ROWS; r++)
    for (let k = 0; k < COLS; k++)
      cells += `<div style="position:absolute;left:${X0 + k * 50}mm;top:${Y0 + r * 20}mm">${card(c)}</div>`;
  const line = (x, y, w, h) => `<div style="position:absolute;left:${x}mm;top:${y}mm;width:${w}mm;height:${h}mm;background:#000"></div>`;
  for (let k = 0; k <= COLS; k++) {
    const x = X0 + k * 50 - 0.05;
    marks += line(x, 1, 0.1, Y0 - 2) + line(x, Y0 + ROWS * 20 + 1, 0.1, Y0 - 2);
  }
  for (let r = 0; r <= ROWS; r++) {
    const y = Y0 + r * 20 - 0.05;
    marks += line(0.5, y, X0 - 1.5, 0.1) + line(X0 + COLS * 50 + 1, y, X0 - 1.5, 0.1);
  }
  return `<div style="position:relative;width:210mm;height:297mm">${cells}${marks}</div>`;
};

const browser = await chromium.launch();
const pg = await browser.newPage({ deviceScaleFactor: 12 });
const render = async (html) => {
  await pg.setContent(html, { waitUntil: 'networkidle' });
  await pg.evaluate(() => document.fonts.ready);
};

for (const c of CARDS) {
  await render(page(card(c), '50mm 20mm'));
  await pg.pdf({ path: join(out, `${c.id}.pdf`), width: '50mm', height: '20mm', printBackground: true });
  await pg.locator('.card').screenshot({ path: join(out, `${c.id}.png`) });

  await render(page(sheet(c), 'A4'));
  await pg.pdf({ path: join(out, `${c.id}-A4-sheet.pdf`), format: 'A4', printBackground: true });
}

// معاينة تجمع الكرتين
await pg.setViewportSize({ width: 600, height: 300 });
await render(page(`<div id="p" style="display:inline-flex;flex-direction:column;gap:4mm;padding:4mm;background:#e9ece6">
  ${CARDS.map((c) => `<div style="box-shadow:0 .5mm 1.5mm rgba(0,0,0,.25)">${card(c)}</div>`).join('')}</div>`, 'auto'));
await pg.locator('#p').screenshot({ path: join(out, 'preview.png') });
await browser.close();
console.log('done →', out);
