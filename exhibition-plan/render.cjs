// Render floor-plan.html to high-resolution PNG and PDF.
const { chromium } = require('playwright');
const path = require('path');
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 2900, height: 1560 }, deviceScaleFactor: 2 });
  await p.goto('file://' + path.join(__dirname, 'floor-plan.html'), { waitUntil: 'networkidle' });
  await p.evaluate(() => document.fonts.ready);
  await p.screenshot({ path: path.join(__dirname, 'floor-plan.png') });
  await p.pdf({ path: path.join(__dirname, 'floor-plan.pdf'), width: '2900px', height: '1560px', printBackground: true, pageRanges: '1' });
  await b.close();
})();
