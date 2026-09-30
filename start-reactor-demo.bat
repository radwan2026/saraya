@echo off
chcp 65001 >nul
title Reactor Siege DEMO - تجربة حصار المفاعل
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo  [X] برنامج Node.js غير مثبت. ثبّته من nodejs.org ثم أعد المحاولة.
  start https://nodejs.org
  pause
  exit /b
)
if not exist node_modules call npm install
start "" cmd /c "timeout /t 3 >nul & start http://localhost:3001"
call npm run reactor:demo
pause
