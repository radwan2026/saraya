import { createApp } from './src/app.js';
import { Store } from './src/db.js';
import { config } from './config.js';
import { aiEnabled } from './src/designer.js';

const store = new Store(config.dataDir);
const app = createApp(store, config);

app.listen(config.port, () => {
  console.log(`\n  ختمي يعمل الآن على:  http://localhost:${config.port}`);
  console.log(`  لوحة الإدارة:       http://localhost:${config.port}/admin.html`);
  console.log(`  التصميم بالذكاء الاصطناعي: ${aiEnabled() ? 'مفعّل (Claude)' : 'المولّد المحلي (أضف ANTHROPIC_API_KEY لتفعيل Claude)'}`);
  if (config.adminPassword === 'admin1234') console.warn('  ⚠️  غيّر كلمة مرور الإدارة عبر المتغير ADMIN_PASSWORD');
  if (config.secret.startsWith('change-this')) console.warn('  ⚠️  غيّر سر الجلسات عبر المتغير KHATMI_SECRET');
});
