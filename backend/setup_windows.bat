@echo off
setlocal EnableExtensions EnableDelayedExpansion
cd /d %~dp0

echo.
echo ========================================================
echo PosePerfect AI - Windows backend setup v10
echo ========================================================
echo.

set "PYTHON_EXE="
py -3.12 -c "import sys; print(sys.executable)" >nul 2>nul
if not errorlevel 1 set "PYTHON_EXE=py -3.12"

if not defined PYTHON_EXE (
  echo [PosePerfect] Python 3.12 was not found.
  echo [PosePerfect] Install Python 3.12 x64 from python.org and rerun setup_windows.bat.
  exit /b 1
)

echo [PosePerfect] Using Python: %PYTHON_EXE%
%PYTHON_EXE% --version
if errorlevel 1 exit /b 1

if not exist .venv\Scripts\python.exe (
  echo [PosePerfect] Creating virtual environment...
  %PYTHON_EXE% -m venv .venv
  if errorlevel 1 (
    echo [PosePerfect] Failed to create the virtual environment.
    exit /b 1
  )
) else (
  echo [PosePerfect] Reusing existing virtual environment.
)

.venv\Scripts\python.exe tools\setup_backend.py
if errorlevel 1 (
  echo.
  echo ========================================================
  echo Backend setup FAILED.
  echo ========================================================
  exit /b 1
)

echo.
echo ========================================================
echo Backend setup completed successfully.
echo ========================================================
exit /b 0
