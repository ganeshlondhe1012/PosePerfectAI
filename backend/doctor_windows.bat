@echo off
setlocal EnableExtensions
cd /d %~dp0
py -3.12 tools\doctor_windows.py
exit /b %ERRORLEVEL%
