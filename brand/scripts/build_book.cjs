// Build the Sadad Libya brand book outputs with the pre-installed Playwright Chromium.
//   node brand/scripts/build_book.cjs [--shots <dir>]
// Outputs:
//   brand/Sadad-Libya-Brand-Guidelines-v1.0.pdf
//   brand/Sadad-Libya-Quick-Reference.pdf
//   brand/assets/logo/pdf/*.pdf      (vector PDFs of the traced SVG logos)
//   brand/assets/icons/*.svg         (icon set extracted from index.html)
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const BOOK = 'file://' + path.join(ROOT, 'index.html');
const shotsIdx = process.argv.indexOf('--shots');
const SHOTS = shotsIdx > -1 ? process.argv[shotsIdx + 1] : null;

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1200, height: 900 } });
  await page.goto(BOOK, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);

  const fontOk = await page.evaluate(() => document.fonts.check('500 20px "GE Dinar One"', 'سداد'));
  console.log('GE Dinar One loaded:', fontOk);
  if (!fontOk) console.warn('WARNING: primary font missing — place it at brand/fonts/GE-Dinar-One-Medium.otf');

  // Full book
  await page.emulateMedia({ media: 'print' });
  await page.pdf({ path: path.join(ROOT, 'Sadad-Libya-Brand-Guidelines-v1.0.pdf'), width: '297mm', height: '210mm', printBackground: true, preferCSSPageSize: true });

  // Quick reference = the #quick-ref page alone
  const pages = await page.$$eval('section.page', (els) => els.map((e) => e.id));
  const qr = pages.indexOf('quick-ref') + 1;
  await page.pdf({ path: path.join(ROOT, 'Sadad-Libya-Quick-Reference.pdf'), width: '297mm', height: '210mm', printBackground: true, pageRanges: String(qr) });
  console.log('pages:', pages.length, '· quick reference page:', qr);

  // Optional page screenshots for review
  if (SHOTS) {
    await page.emulateMedia({ media: 'screen' });
    fs.mkdirSync(SHOTS, { recursive: true });
    const els = await page.$$('section.page');
    for (let i = 0; i < els.length; i++) {
      await els[i].screenshot({ path: path.join(SHOTS, `p${String(i + 1).padStart(2, '0')}.png`) });
    }
  }

  // Icon set → standalone SVG files
  const icons = await page.$$eval('symbol[id^="i-"]', (els) => els.map((s) => ({ id: s.id.slice(2), body: s.innerHTML.trim() })));
  const iconDir = path.join(ROOT, 'assets', 'icons');
  fs.mkdirSync(iconDir, { recursive: true });
  for (const { id, body } of icons) {
    fs.writeFileSync(path.join(iconDir, `${id}.svg`),
      `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">${body}</svg>\n`);
  }
  console.log('icons:', icons.length);

  // Vector PDFs of every traced SVG logo (sized to the artwork)
  const logoDir = path.join(ROOT, 'assets', 'logo');
  const pdfDir = path.join(logoDir, 'pdf');
  fs.mkdirSync(pdfDir, { recursive: true });
  for (const f of fs.readdirSync(logoDir).filter((n) => n.endsWith('.svg'))) {
    const svg = fs.readFileSync(path.join(logoDir, f), 'utf8');
    const [, w, h] = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    const p = await browser.newPage();
    await p.setContent(`<html><body style="margin:0">${svg.replace(/width="[\d.]+" height="[\d.]+"/, `width="${w}px" height="${h}px"`)}</body></html>`);
    await p.pdf({ path: path.join(pdfDir, f.replace('.svg', '.pdf')), width: `${w}px`, height: `${h}px`, pageRanges: '1' });
    await p.close();
  }
  console.log('logo pdfs written');
  await browser.close();
})();
