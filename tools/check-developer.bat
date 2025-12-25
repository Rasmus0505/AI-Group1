@echo off
chcp 65001 >nul
REM 开发者账号诊断和修复 (Launch from tools/)

cd /d "%~dp0..\rebuild\production\backend"

echo ========================================
echo 开发者账号诊断和修复
echo ========================================
echo.

call npm run check:developer

echo.
pause
