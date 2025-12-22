# 前五阶段联合测试脚本 (PowerShell)
# 顺序：阶段1/2 -> 阶段3 -> 阶段4 -> 阶段5（主持人配置）
$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "前五阶段联合测试" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$phase12 = Join-Path $scriptRoot "test-phase1-2.ps1"
$phase3 = Join-Path $scriptRoot "..\\已完成3阶段测试\\test-phase3.ps1"
$phase4 = Join-Path $scriptRoot "..\\已完成4阶段测试\\test-phase4.ps1"
$phase5 = Join-Path $scriptRoot "..\\5阶段测试\\test-phase5.ps1"

function Invoke-TestScript {
    param(
        [string]$path
    )
    $runner = Get-Command pwsh -ErrorAction SilentlyContinue
    if (-not $runner) {
        $runner = Get-Command powershell -ErrorAction SilentlyContinue
    }
    if (-not $runner) {
        Write-Host "✗ 未找到可用的 PowerShell 可执行程序（pwsh/powershell）。" -ForegroundColor Red
        exit 1
    }

    & $runner.Source -NoLogo -NoProfile -ExecutionPolicy Bypass -File $path
    return $LASTEXITCODE
}

function Run-Phase {
    param(
        [string]$label,
        [string]$path
    )

    if (-not (Test-Path $path)) {
        Write-Host "✗ 找不到脚本：$path" -ForegroundColor Red
        exit 1
    }

    Write-Host "=== 开始 $label ===" -ForegroundColor Magenta
    $exitCode = Invoke-TestScript -path $path
    if ($exitCode -is [array]) { $exitCode = $exitCode[-1] }
    [int]$exitCodeInt = $exitCode
    if ($exitCodeInt -ne 0) {
        Write-Host "✗ $label 失败（退出码 $exitCode），已中断后续阶段" -ForegroundColor Red
        exit $exitCodeInt
    }
    Write-Host "=== 结束 $label ===" -ForegroundColor Magenta
    Write-Host ""
}

Run-Phase -label "阶段1/2 连续测试" -path $phase12
Run-Phase -label "阶段3 房间基础流测试" -path $phase3
Run-Phase -label "阶段4 WebSocket 最小实时子系统" -path $phase4
Run-Phase -label "阶段5 主持人配置" -path $phase5

Write-Host "========================================" -ForegroundColor Green
Write-Host "🎉 前五阶段联合测试全部通过！" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

