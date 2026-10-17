@echo off
chcp 65001 >nul
title Manarat Al-Noor - TikTok LIVE
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Download it from https://nodejs.org & pause & exit /b)
if not exist node_modules (echo Installing... & call npm install)
start "" http://localhost:3100/admin
call npm run noor
pause
