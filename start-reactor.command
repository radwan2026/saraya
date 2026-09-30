#!/bin/bash
# تشغيل حصار المفاعل على ماك: انقر مرتين على هذا الملف
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "[X] برنامج Node.js غير مثبت. حمّله من nodejs.org (اختر LTS) ثم أعد تشغيل هذا الملف."
  open https://nodejs.org
  read -r -p "اضغط Enter للإغلاق"
  exit 1
fi
[ -d node_modules ] || npm install
(sleep 3; open http://localhost:3001/admin) &
echo "لا تغلق هذه النافذة طوال البث."
npm run reactor
