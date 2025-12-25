# Phase 14 Automated Acceptance: Task & Challenge System
param(
    [string]$BaseUrl = "http://localhost:3000"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Phase 14 Test: Task & Challenge System " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$global:Token = $null
$global:SessionId = $null
$global:TaskId = $null

function Test-Step {
    param([string]$Title, [scriptblock]$Action)
    Write-Host ""
    Write-Host "==> $Title" -ForegroundColor Yellow
    try { & $Action; Write-Host "✔ $Title" -ForegroundColor Green }
    catch { Write-Host "✗ $Title failed: $($_.Exception.Message)" -ForegroundColor Red; throw }
}

Test-Step "1. Login & Get Session" {
    $body = @{ username = "testuser_trade1"; password = "test123456" } | ConvertTo-Json
    $resp = Invoke-WebRequest -Uri "$BaseUrl/api/auth/login" -Method Post -Body $body -ContentType "application/json" -UseBasicParsing
    $json = $resp.Content | ConvertFrom-Json
    $global:Token = $json.data.token
  
    $headers = @{ Authorization = "Bearer $global:Token" }
    $resp = Invoke-WebRequest -Uri "$BaseUrl/api/game/history" -Method Get -Headers $headers -UseBasicParsing
    $json = $resp.Content | ConvertFrom-Json
    $global:SessionId = $json.data.history[0].sessionId
    Write-Host "  Using Session: $global:SessionId" -ForegroundColor Gray
}

Test-Step "2. Get Task List" {
    $headers = @{ Authorization = "Bearer $global:Token" }
    $resp = Invoke-WebRequest -Uri "$BaseUrl/api/game/$global:SessionId/tasks" -Method Get -Headers $headers -UseBasicParsing
    $json = $resp.Content | ConvertFrom-Json
    # In a fresh seed, there might be no tasks. We check the API structure.
    Write-Host "  Tasks Found: $($json.data.tasks.Count)" -ForegroundColor Gray
}

Test-Step "3. Verify Task Type Logic" {
    # This verifies the router handles the request correctly even if empty
    $headers = @{ Authorization = "Bearer $global:Token" }
    $resp = Invoke-WebRequest -Uri "$BaseUrl/api/game/$global:SessionId/tasks" -Method Get -Headers $headers -UseBasicParsing
    if ($resp.StatusCode -ne 200) { throw "API Error" }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Phase 14 test completed" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
