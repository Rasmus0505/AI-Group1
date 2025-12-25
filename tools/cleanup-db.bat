@echo off
chcp 65001 >nul
REM 清理数据库过期数据 (Launch from tools/)

cd /d "%~dp0..\rebuild\production\backend"

echo ========================================
echo 正在清理数据库过期记录...
echo ========================================

call npm run cleanup:db

echo.
pause
