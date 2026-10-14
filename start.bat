@echo off
REM ExamPro - one-click start (Windows). Needs Node.js 22.13+ (https://nodejs.org)
cd /d "%~dp0"
where node >nul 2>nul || (echo Node.js is not installed. Get it from https://nodejs.org & pause & exit /b 1)
if not exist data\exampro.db (echo First run: creating demo data... & node --no-warnings server\seed.js)
start "" http://localhost:3000
node --no-warnings server\index.js
pause
