@echo off
chcp 65001 >nul 2>&1
title AI游戏 - 本地开发模式
color 0A

echo ========================================
echo AI游戏 - 本地开发模式 (localhost)
echo ========================================
echo.

REM Switch to the directory where this batch file is located
cd /d "%~dp0"
echo Current directory: %CD%
echo.

REM Check if PowerShell script exists
if not exist "tools\run-local.ps1" (
    echo [ERROR] tools\run-local.ps1 not found!
    pause
    exit /b 1
)

echo [INFO] Starting local development environment...
echo.

REM Execute PowerShell script
powershell -NoProfile -ExecutionPolicy Bypass -Command "& { $ErrorActionPreference = 'Stop'; try { & '%~dp0tools\run-local.ps1' } catch { Write-Host \"[ERROR] Script failed: $_\" -ForegroundColor Red; exit 1 } }"

set EXIT_CODE=%ERRORLEVEL%

echo.
if %EXIT_CODE% EQU 0 (
    echo [OK] Local development environment started!
) else (
    echo [ERROR] Failed with code: %EXIT_CODE%
)
echo.
pause
