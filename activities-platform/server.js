// نقطة تشغيل المنصة.
import path from 'node:path';
import { createApp } from './src/app.js';

const port = Number(process.env.PORT || 3000);
const dataDir = path.resolve(process.env.DATA_DIR || 'data');
const { app, initialPassword } = createApp({ dataDir, adminPassword: process.env.ADMIN_PASSWORD });

app.listen(port, () => {
  console.log(`✅ منصة لجنة الأنشطة تعمل على: http://localhost:${port}`);
  console.log(`🔐 لوحة التحكم: http://localhost:${port}/admin`);
  if (initialPassword) {
    console.log('');
    console.log('— أول تشغيل: تم إنشاء حساب المدير —');
    console.log('   اسم المستخدم: admin');
    console.log(`   كلمة المرور:  ${initialPassword}`);
    console.log('   (احفظها الآن وغيّرها من لوحة التحكم)');
  }
});
