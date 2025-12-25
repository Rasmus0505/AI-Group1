@echo off
chcp 65001 >nul
REM 代码格式化工具 (Launch from tools/)

echo ========================================
echo 代码格式化工具
echo ========================================
echo.

echo [1/2] 格式化后端代码...
cd /d "%~dp0..\rebuild\production\backend"
call npm run format
echo.

echo [2/2] 格式化前端代码...
cd /d "%~dp0..\rebuild\production\frontend"
if exist package.json (
    call npm run format
) else (
    echo 前端未配置或不存在，跳过
)

echo.
echo 格式化完成！
pause
