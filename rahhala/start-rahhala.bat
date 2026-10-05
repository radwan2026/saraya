@echo off
title Al-Rahhala
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  Node.js is not installed.
  echo  Please install it from https://nodejs.org  then run this file again.
  echo.
  start "" https://nodejs.org
  pause
  exit /b 1
)

if not exist node_modules (
  echo.
  echo  First run: installing, please wait one minute...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo  Installation failed. Check your internet connection and try again.
    pause
    exit /b 1
  )
)

echo.
echo  ==========================================================
echo   Al-Rahhala is running.  Do NOT close this window.
echo   Browser address:  http://localhost:3100
echo   User: admin     Password: admin
echo  ==========================================================
echo.
start "" cmd /c "timeout /t 4 >nul & start http://localhost:3100"
call npm start
pause
