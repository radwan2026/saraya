// تخزين بسيط في ملف JSON واحد مع كتابة ذرّية (ملف مؤقت ثم إعادة تسمية).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

export const COLLECTIONS = [
  'users', 'activities', 'registrations', 'posts', 'quizzes', 'quizSubmissions',
  'polls', 'votes', 'members', 'teams', 'talents', 'complaints',
];

export const newId = () => crypto.randomBytes(8).toString('hex');

export function createStore(file, seed) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  let data;
  if (fs.existsSync(file)) {
    data = JSON.parse(fs.readFileSync(file, 'utf8'));
  } else {
    data = seed();
  }
  for (const c of COLLECTIONS) data[c] ??= [];
  data.settings ??= {};
  data.meta ??= { cardSerial: 0, ticketSerial: 0 };

  const save = () => {
    const tmp = `${file}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, file);
  };
  save();

  return {
    get data() { return data; },
    save,
    all: (name) => data[name],
    find: (name, id) => data[name].find((x) => x.id === id),
    insert(name, obj) {
      const now = new Date().toISOString();
      const row = { id: newId(), createdAt: now, updatedAt: now, ...obj };
      data[name].push(row);
      save();
      return row;
    },
    update(name, id, patch) {
      const row = data[name].find((x) => x.id === id);
      if (!row) return null;
      Object.assign(row, patch, { updatedAt: new Date().toISOString() });
      save();
      return row;
    },
    remove(name, id) {
      const i = data[name].findIndex((x) => x.id === id);
      if (i === -1) return false;
      data[name].splice(i, 1);
      save();
      return true;
    },
    nextSerial(key) {
      data.meta[key] = (data.meta[key] || 0) + 1;
      return data.meta[key];
    },
  };
}
