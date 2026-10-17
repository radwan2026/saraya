// نقطة تشغيل المنصة.
import path from 'node:path';
import { createApp } from './src/app.js';

// المنفذ 8080 حتى لا تتعارض المنصة مع لعبة تيك توك في نفس المستودع (تستخدم 3000).
const port = Number(process.env.PORT || 8080);
const dataDir = path.resolve(process.env.DATA_DIR || 'data');
const { app, initialPassword } = createApp({ dataDir, adminPassword: process.env.ADMIN_PASSWORD });

const server = app.listen(port, (err) => {
  if (err) return;
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

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${port} is already in use by another program (another window may still be running).`);
    console.error(`❌ المنفذ ${port} مستخدم من برنامج آخر. أغلق النوافذ السوداء الأخرى ثم أعد التشغيل،`);
    console.error('   أو شغّل المنصة على منفذ آخر:  set PORT=8090 && npm start');
  } else {
    console.error(err);
  }
  process.exit(1);
});
