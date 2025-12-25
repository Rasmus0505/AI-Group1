# Phase 15 Automated Acceptance: Strategy Analysis System
param(
    [string]$BaseUrl = "http://localhost:3000"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Phase 15 Test: Strategy Analysis System " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$global:Token = $null

function Test-Step {
    param([string]$Title, [scriptblock]$Action)
    Write-Host ""
    Write-Host "==> $Title" -ForegroundColor Yellow
    try { & $Action; Write-Host "✔ $Title" -ForegroundColor Green }
    catch { Write-Host "✗ $Title failed: $($_.Exception.Message)" -ForegroundColor Red; throw }
}

Test-Step "1. Login" {
    $body = @{ username = "testuser_trade1"; password = "test123456" } | ConvertTo-Json
    $resp = Invoke-WebRequest -Uri "$BaseUrl/api/auth/login" -Method Post -Body $body -ContentType "application/json" -UseBasicParsing
    $json = $resp.Content | ConvertFrom-Json
    $global:Token = $json.data.token
}

Test-Step "2. Get User Strategies" {
    $headers = @{ Authorization = "Bearer $global:Token" }
    $resp = Invoke-WebRequest -Uri "$BaseUrl/api/user/strategies" -Method Get -Headers $headers -UseBasicParsing
    $json = $resp.Content | ConvertFrom-Json
    Write-Host "  Registered Strategies: $($json.data.strategies.Count)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Phase 15 test completed" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
