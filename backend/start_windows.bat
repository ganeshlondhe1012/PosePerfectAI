@echo off
setlocal EnableExtensions
cd /d %~dp0
if not exist .venv\Scripts\python.exe (
  echo [PosePerfect] Backend environment not found. Run setup_windows.bat first.
  exit /b 1
)
if not exist models\pose_landmarker_lite.task (
  echo [PosePerfect] MediaPipe model not found. Run setup_windows.bat first.
  exit /b 1
)
.venv\Scripts\python.exe run.py
exit /b %ERRORLEVEL%
