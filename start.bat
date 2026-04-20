@echo off
echo Starting Interview App...
echo.
echo Killing any existing node processes on port 3000...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :3000 ^| findstr LISTENING') do (
    taskkill /F /PID %%a 2>nul
)
echo.
echo Starting server on port 3002...
cd /d "%~dp0"
node server.js
