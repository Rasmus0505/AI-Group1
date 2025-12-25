# Phase 7 Automated Test with Auto-wait for Backend
param(
  [string]$BaseUrl = "http://localhost:3000",
  [int]$MaxWaitSeconds = 60
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Phase 7 Test: Host Review Functionality " -ForegroundColor Cyan
Write-Host " (Auto-wait for backend service) " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$ErrorActionPreference = "Stop"

# Wait for backend service to be ready
Write-Host "`n等待后端服务启动..." -ForegroundColor Yellow
$waitAttempts = 0
$maxWaitAttempts = $MaxWaitSeconds / 2
$backendReady = $false

while ($waitAttempts -lt $maxWaitAttempts -and -not $backendReady) {
  try {
    $healthResp = Invoke-WebRequest -Uri "$BaseUrl/health" -UseBasicParsing -TimeoutSec 2 -ErrorAction Stop
    if ($healthResp.StatusCode -eq 200) {
      $backendReady = $true
      Write-Host "✓ 后端服务已就绪" -ForegroundColor Green
    }
  }
  catch {
    $waitAttempts++
    if ($waitAttempts -lt $maxWaitAttempts) {
      Write-Host "  等待中... ($waitAttempts/$maxWaitAttempts)" -ForegroundColor Gray
      Start-Sleep -Seconds 2
    }
  }
}

if (-not $backendReady) {
  Write-Host "`n✗ 后端服务启动超时" -ForegroundColor Red
  Write-Host "请确保后端服务正在运行：" -ForegroundColor Yellow
  Write-Host "  1. 在项目根目录双击 run-dev.bat" -ForegroundColor Gray
  Write-Host "  2. 或手动启动: cd rebuild\production\backend && npm run dev" -ForegroundColor Gray
  Write-Host "`n然后重新运行此测试脚本。" -ForegroundColor Yellow
  exit 1
}

# Run the actual test
Write-Host "`n开始运行测试...`n" -ForegroundColor Green
& "$PSScriptRoot\test-phase7.ps1" -BaseUrl $BaseUrl

