@echo off
setlocal

cd /d "%~dp0"

where npm >nul 2>nul
if errorlevel 1 (
  echo [EE Tool] npm was not found. Please install Node.js first:
  echo https://nodejs.org/
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [EE Tool] Installing dependencies. This only needs to run the first time.
  call npm install
  if errorlevel 1 (
    echo [EE Tool] npm install failed.
    pause
    exit /b 1
  )
)

echo [EE Tool] Starting local website...
echo [EE Tool] Browser URL: http://127.0.0.1:5173
start "" "http://127.0.0.1:5173"
call npm run dev -- --port 5173

pause
