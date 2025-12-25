@echo off
chcp 65001 >nul
echo ========================================
echo   双API测试服务器启动脚本
echo ========================================
echo.

cd /d "%~dp0"

echo 检查依赖...
if not exist "node_modules" (
    echo 首次运行，安装依赖中...
    npm install
    echo.
)

echo 启动服务器...
echo.
node server.js

pause
