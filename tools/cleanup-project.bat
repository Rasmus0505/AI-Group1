@echo off
chcp 65001 >nul
REM 一键清理项目垃圾数据（双击运行）

REM 切换到当前批处理所在目录（项目根目录）
cd /d "%~dp0"

REM 显示提示
echo ========================================
echo 游戏项目数据清理工具
echo ========================================
echo.
echo 正在执行清理...
echo.

REM 使用 PowerShell 执行清理脚本，自动确认
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0cleanup-project.ps1" -Force

echo.
echo ========================================
echo 清理完成！
echo ========================================
echo.
pause

