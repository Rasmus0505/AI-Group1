@echo off
chcp 65001 >nul
REM Prisma Studio (Launch from tools/)

cd /d "%~dp0..\rebuild\production\backend"

echo ========================================
echo 正在启动 Prisma Studio (数据库管理界面)...
echo ========================================

npx prisma studio

pause
