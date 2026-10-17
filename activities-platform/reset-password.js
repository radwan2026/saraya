// إعادة تعيين كلمة مرور حساب المدير دون حذف أي بيانات:  npm run reset-password
import fs from 'node:fs';
import path from 'node:path';
import { hashPassword } from './src/auth.js';
import { generatePassword } from './src/seed.js';

const file = path.resolve(process.env.DATA_DIR || 'data', 'db.json');
if (!fs.existsSync(file)) {
  console.log('No data yet: run "npm start" first. / لا توجد بيانات بعد، شغّل المنصة أولاً.');
  process.exit(1);
}
const db = JSON.parse(fs.readFileSync(file, 'utf8'));
let admin = db.users.find((u) => u.username === 'admin') || db.users.find((u) => u.role === 'admin');
if (!admin) {
  admin = { id: 'admin', username: 'admin', name: 'مدير المنصة', role: 'admin', permissions: [], createdAt: new Date().toISOString() };
  db.users.push(admin);
}
const password = process.env.ADMIN_PASSWORD || generatePassword();
Object.assign(admin, { passwordHash: hashPassword(password), active: true, role: 'admin', updatedAt: new Date().toISOString() });
fs.writeFileSync(file, JSON.stringify(db, null, 2));
console.log('Admin password reset (data kept).');
console.log(`   username: ${admin.username}`);
console.log(`   password: ${password}`);
