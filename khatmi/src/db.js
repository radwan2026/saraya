// تخزين بسيط في ملف JSON مع كتابة ذرّية. مناسب لتشغيل محلي أو خادم صغير.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export class Store {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'db.json');
    this.logoDir = path.join(dir, 'logos');
    fs.mkdirSync(this.logoDir, { recursive: true });
    this.data = fs.existsSync(this.file)
      ? JSON.parse(fs.readFileSync(this.file, 'utf8'))
      : { users: [], orders: [], topups: [], transactions: [], settings: null, smsLog: [] };
    this.data.smsLog ||= [];
  }

  save() {
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 1));
    fs.renameSync(tmp, this.file);
  }

  id(prefix) {
    return prefix + '_' + crypto.randomBytes(6).toString('hex');
  }

  // ---- الشعارات (PNG فقط) ----
  saveLogo(buffer) {
    const id = crypto.createHash('sha256').update(buffer).digest('hex').slice(0, 32);
    const f = path.join(this.logoDir, id + '.png');
    if (!fs.existsSync(f)) fs.writeFileSync(f, buffer);
    return id;
  }

  getLogo(id) {
    if (!id || !/^[a-f0-9]{16,64}$/.test(id)) return null;
    const f = path.join(this.logoDir, id + '.png');
    if (!fs.existsSync(f)) return null;
    const buf = fs.readFileSync(f);
    return { dataUri: 'data:image/png;base64,' + buf.toString('base64'), width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
  }

  // ---- المحفظة ----
  /** يضيف حركة على المحفظة (المبلغ بالدرهم، موجب = إيداع، سالب = خصم). */
  addTransaction(user, amountDirham, type, note, ref = null) {
    if (user.balance + amountDirham < 0) throw new Error('INSUFFICIENT_BALANCE');
    user.balance += amountDirham;
    const tx = { id: this.id('tx'), userId: user.id, amount: amountDirham, balanceAfter: user.balance, type, note, ref, at: new Date().toISOString() };
    this.data.transactions.push(tx);
    return tx;
  }
}
