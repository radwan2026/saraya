// usage: node render.js beats|audio|full|frames <t1,t2,...>
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

const OUT = path.join(__dirname, 'out');
fs.mkdirSync(OUT, { recursive: true });
const mode = process.argv[2] || 'beats';

(async () => {
  const browser = await chromium.launch({ args: ['--force-color-profile=srgb', '--disable-lcd-text'] });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  await page.goto('file://' + path.join(__dirname, 'index.html'));
  await page.evaluate(() => window.ready);
  const cdp = await page.context().newCDPSession(page);
  const shot = async (t, fmt = 'png') => {
    await page.evaluate(t => window.seek(t), t);
    const r = await cdp.send('Page.captureScreenshot', { format: fmt, quality: fmt === 'jpeg' ? 95 : undefined });
    return Buffer.from(r.data, 'base64');
  };

  if (mode === 'beats' || mode === 'frames') {
    const dir = path.join(OUT, mode); fs.mkdirSync(dir, { recursive: true });
    const ts = mode === 'beats'
      ? Array.from({ length: 30 }, (_, b) => b * 0.5 + 0.34)
      : process.argv[3].split(',').map(Number);
    for (let i = 0; i < ts.length; i++) {
      fs.writeFileSync(path.join(dir, `f${String(i).padStart(2, '0')}_${ts[i].toFixed(3)}.png`), await shot(ts[i]));
    }
  } else if (mode === 'audio') {
    const b64 = await page.evaluate(() => window.renderAudio());
    fs.writeFileSync(path.join(OUT, 'soundtrack.wav'), Buffer.from(b64, 'base64'));
  } else if (mode === 'full') {
    // 60 fps × 3 sub-frames centred on each frame time → tmix → pick every 3rd
    const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', '180', '-c:v', 'mjpeg', '-i', '-',
      '-vf', "tmix=frames=3,select='eq(mod(n\\,3)\\,2)',setpts=N/60/TB",
      '-r', '60', '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', path.join(OUT, 'video.mp4')],
      { stdio: ['pipe', 'inherit', 'inherit'] });
    const F = 15 * 60;
    for (let k = 0; k < F; k++) {
      for (let j = 0; j < 3; j++) {
        const buf = await shot(k / 60 + (j - 1) / 180, 'jpeg');
        if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      }
      if (k % 60 === 0) console.error('frame', k);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
  }
  await browser.close();
})();
