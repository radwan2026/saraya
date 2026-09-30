@echo off
chcp 65001 >nul
title Reactor Siege - حصار المفاعل
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  [X] برنامج Node.js غير مثبت على هذا الجهاز.
  echo      حمّله من الموقع الذي سيفتح الآن ^(اختر LTS^) ثم ثبّته وأعد تشغيل هذا الملف.
  echo.
  start https://nodejs.org
  pause
  exit /b
)

if not exist node_modules (
  echo  جارٍ تثبيت المكتبات لأول مرة... انتظر دقيقة أو دقيقتين
  call npm install
  if errorlevel 1 (
    echo  [X] فشل التثبيت. تأكد من اتصال الإنترنت ثم أعد المحاولة.
    pause
    exit /b
  )
)

echo.
echo  سيتم فتح لوحة التحكم في المتصفح بعد ثوانٍ...
echo  لا تغلق هذه النافذة طوال البث. لإيقاف اللعبة أغلق النافذة.
echo.
start "" cmd /c "timeout /t 3 >nul & start http://localhost:3001/admin"
call npm run reactor
pause
