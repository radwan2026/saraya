import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { openDb } from './src/db.js';
import { createApp } from './src/app.js';

const dir = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT) || 3100;
const DB_FILE = process.env.RAHHALA_DB || path.join(dir, 'data', 'rahhala.db');

const db = openDb(DB_FILE);
const app = createApp(db);

app.listen(PORT, () => {
  console.log('==============================================');
  console.log('  منظومة الرحالة تعمل الآن');
  console.log(`  افتح المتصفح على: http://localhost:${PORT}`);
  console.log('  المستخدم الافتراضي: admin / admin');
  console.log(`  قاعدة البيانات: ${DB_FILE}`);
  console.log('==============================================');
});
