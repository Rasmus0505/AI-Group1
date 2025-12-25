@echo off
chcp 65001 >nul 2>&1
title Development Environment Launcher
color 0A

echo ========================================
echo Development Environment Launcher
echo ========================================
echo.

REM Switch to the directory where this batch file is located (project root)
cd /d "%~dp0"
echo Current directory: %CD%
echo.

REM Check if PowerShell script exists
if not exist "tools\run-dev.ps1" (
    echo [ERROR] tools\run-dev.ps1 not found!
    echo.
    echo Please make sure you are running this from the project root directory.
    echo Expected path: %CD%\tools\run-dev.ps1
    echo.
    pause
    exit /b 1
)

echo [INFO] Found PowerShell script: tools\run-dev.ps1
echo [INFO] Starting PowerShell script...
echo.

REM Use PowerShell to execute script with error handling
powershell -NoProfile -ExecutionPolicy Bypass -Command "& { $ErrorActionPreference = 'Stop'; try { & '%~dp0tools\run-dev.ps1' } catch { Write-Host \"[ERROR] Script execution failed: $_\" -ForegroundColor Red; exit 1 } }"

set EXIT_CODE=%ERRORLEVEL%

echo.
echo ========================================
if %EXIT_CODE% EQU 0 (
    echo Script completed successfully
) else (
    echo Script failed with error code: %EXIT_CODE%
    echo.
    echo Common issues:
    echo   1. Check if Node.js is installed: node -v
    echo   2. Check if Docker is running (if needed)
    echo   3. Check PowerShell execution policy
    echo   4. Try running manually: powershell -ExecutionPolicy Bypass -File tools\run-dev.ps1
)
echo ========================================
echo.
pause
