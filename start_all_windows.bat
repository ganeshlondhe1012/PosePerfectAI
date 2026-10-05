@echo off
setlocal EnableExtensions
cd /d %~dp0

if not exist node_modules (
  echo Installing frontend dependencies...
  call npm install
  if errorlevel 1 exit /b 1
)

if not exist backend\.venv\Scripts\python.exe (
  echo Backend environment not found. Running backend setup first...
  call backend\setup_windows.bat
  if errorlevel 1 exit /b 1
) else (
  backend\.venv\Scripts\python.exe -c "import fastapi,uvicorn,numpy,PIL,mediapipe; print('Backend imports OK')" >nul 2>nul
  if errorlevel 1 (
    echo Backend environment exists but is incomplete. Repairing...
    call backend\setup_windows.bat
    if errorlevel 1 exit /b 1
  )
)

start "PosePerfect FastAPI" cmd /k "cd /d "%~dp0backend" && call .venv\Scripts\activate.bat && python run.py"
timeout /t 2 /nobreak >nul
start "PosePerfect Expo" cmd /k "cd /d "%~dp0" && npx expo start"

echo.
echo Frontend and backend are starting in separate windows.
exit /b 0
