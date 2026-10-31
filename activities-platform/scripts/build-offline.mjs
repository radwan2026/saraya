// يبني نسخة المنصة التي تعمل من ملف HTML مباشرة (دون خادم ولا إنترنت):  npm run build:offline
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as esbuild from 'esbuild';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist-offline', 'activities-platform-offline');
const pub = path.join(root, 'public');
fs.rmSync(path.join(root, 'dist-offline'), { recursive: true, force: true });
fs.mkdirSync(out, { recursive: true });

// 1) حزمة الخادم داخل المتصفح.
const shim = (name) => path.join(root, 'offline', 'shims', name);
const content = Object.fromEntries(['charter.md', 'bylaws.md'].map((f) => [f, fs.readFileSync(path.join(root, 'content', f), 'utf8')]));
const offlinePlugin = {
  name: 'offline',
  setup(build) {
    const map = { 'node:fs': 'fs.js', 'node:path': 'path.js', 'node:crypto': 'crypto.js', 'node:url': 'url.js', express: 'express.js', nodemailer: 'empty.js' };
    build.onResolve({ filter: /^(node:(fs|path|crypto|url)|express|nodemailer)$/ }, (a) => ({ path: shim(map[a.path]) }));
    build.onResolve({ filter: /^\.\/auth\.js$/ }, (a) => (a.importer.endsWith(path.join('src', 'app.js')) ? { path: shim('auth.js') } : undefined));
    // الصور المرفوعة تُحفظ كـ data URL في النسخة المحلية.
    build.onLoad({ filter: /src[\\/]app\.js$/ }, (a) => {
      let src = fs.readFileSync(a.path, 'utf8');
      const before = 'const link = (v) => {\n  const s = str(500)(v);\n  return /^(https?:\\/\\/|\\/(?!\\/))/i.test(s) ? s : \'\';';
      if (!src.includes(before)) throw new Error('link() sanitizer changed — update build-offline.mjs');
      src = src.replace(before, 'const link = (v) => {\n  const s = str(4000000)(v);\n  return /^(https?:\\/\\/|\\/(?!\\/)|data:image\\/(png|jpeg|webp|gif);base64,)/i.test(s) ? s : \'\';');
      return { contents: src, loader: 'js' };
    });
  },
};
await esbuild.build({
  entryPoints: [path.join(root, 'offline', 'runtime.js')],
  bundle: true, format: 'iife', platform: 'browser', target: 'es2020', minify: true, charset: 'utf8',
  outfile: path.join(out, 'api.js'), plugins: [offlinePlugin], logLevel: 'warning',
  define: {
    'import.meta.url': '"file:///offline/src/app.js"',
    'process.env': '{}', 'process.pid': '1',
    'globalThis.__OFFLINE_CONTENT__': JSON.stringify(content),
  },
});

// 2) الواجهات مع تحويل المسارات المطلقة إلى نسبية.
const rewrite = (t) => t
  .replace(/https:\/\/fonts\.googleapis\.com\/css2\?[^"]+/g, 'fonts/fonts.css')
  .replace(/<link rel="preconnect"[^>]*>\s*/g, '')
  .replace(/href="\/admin"/g, 'href="admin.html"')
  .replace(/href="\/"/g, 'href="index.html"')
  .replace(/"\/#\//g, '"index.html#/')
  .replace(/(["'(])\/(assets|docs|style\.css|admin\.css|common\.js|app\.js|admin\.js)/g, '$1$2');
for (const f of ['index.html', 'admin.html', 'style.css', 'admin.css', 'common.js', 'app.js', 'admin.js']) {
  let t = rewrite(fs.readFileSync(path.join(pub, f), 'utf8'));
  if (f.endsWith('.html')) t = t.replace('<script src="common.js"></script>', '<script src="api.js"></script>\n  <script src="common.js"></script>');
  // نافذة الطباعة تُفتح فارغة، فتحتاج مساراً كاملاً للشعار.
  if (f === 'admin.js') t = t.replace('<img src="assets/logo-full.png"></header>', '<img src="${new URL(\'assets/logo-full.png\', location.href).href}"></header>');
  if (f === 'style.css') t += '\n.offline-pill{position:fixed;bottom:12px;left:12px;z-index:90;background:#0f3d22;color:#fff;border-radius:999px;padding:6px 8px 6px 14px;font-size:13px;display:flex;gap:8px;align-items:center;box-shadow:0 6px 24px rgba(0,0,0,.2)}.offline-pill button{border:0;border-radius:999px;background:#c9a14a;color:#fff;padding:4px 10px;font:inherit;cursor:pointer}\n';
  fs.writeFileSync(path.join(out, f), t);
}
if (!fs.readFileSync(path.join(out, 'admin.html'), 'utf8').includes('style.css')) throw new Error('admin.html must load style.css');
for (const d of ['assets', 'docs']) fs.cpSync(path.join(pub, d), path.join(out, d), { recursive: true });

// 3) خط Tajawal محلياً (إن توفر الإنترنت وقت البناء؛ وإلا تُستخدم خطوط النظام).
fs.mkdirSync(path.join(out, 'fonts'), { recursive: true });
let css = '';
try {
  const ua = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36' };
  css = await (await fetch('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&display=swap', { headers: ua })).text();
  let n = 0;
  for (const url of [...new Set(css.match(/https:\/\/[^)]+\.woff2/g) || [])]) {
    const name = `tajawal-${n++}.woff2`;
    fs.writeFileSync(path.join(out, 'fonts', name), Buffer.from(await (await fetch(url)).arrayBuffer()));
    css = css.split(url).join(name);
  }
} catch (e) {
  console.warn('تعذر تنزيل خط Tajawal:', e.message);
}
fs.writeFileSync(path.join(out, 'fonts', 'fonts.css'), css);

fs.writeFileSync(path.join(out, 'اقرأني.txt'), [
  'منصة لجنة الأنشطة — نسخة تعمل دون إنترنت ودون تثبيت',
  '',
  '1) افتح الملف index.html بالمتصفح (يُفضّل Google Chrome أو Microsoft Edge) — واجهة الموظفين.',
  '2) افتح الملف admin.html — لوحة تحكم اللجنة.',
  '   اسم المستخدم: admin    كلمة المرور: admin1234',
  '',
  'الواجهتان مرتبطتان: أي تعديل في لوحة التحكم يظهر فوراً في واجهة الموظفين (حدّث الصفحة).',
  'البيانات تُحفظ داخل المتصفح على هذا الجهاز فقط. لاستعادة بيانات العرض الأصلية استخدم زر «استعادة البيانات الأصلية» أسفل الصفحة.',
  'للاستخدام الفعلي من عدة أجهزة شغّل النسخة الكاملة بالأمر npm start.',
].join('\r\n'));
console.log('✅', path.relative(root, out));
