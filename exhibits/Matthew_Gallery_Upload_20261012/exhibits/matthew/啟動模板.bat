@echo off
chcp 65001 >nul
cd /d "%~dp0"
where py >nul 2>&1
if not errorlevel 1 (
 py -3 "%~dp0tools\serve.py"
 if errorlevel 1 pause
 exit /b
)
where python >nul 2>&1
if not errorlevel 1 (
 python "%~dp0tools\serve.py"
 if errorlevel 1 pause
 exit /b
)
echo Please install Python 3.9+ and enable Add Python to PATH.
pause
