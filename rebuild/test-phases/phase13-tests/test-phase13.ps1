# Phase 13 Automated Acceptance: Game Save & Restore
param(
  [string]$BaseUrl = "http://localhost:3000"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Phase 13 Test: Game Save & Restore " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$ErrorActionPreference = "Stop"

function Test-Step {
  param(
    [string]$Title,
    [scriptblock]$Action
  )
  Write-Host ""
  Write-Host "==> $Title" -ForegroundColor Yellow
  try {
    & $Action
    Write-Host "✔ $Title" -ForegroundColor Green
  }
  catch {
    Write-Host "✗ $Title failed:" -ForegroundColor Red
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
    throw
  }
}

# 1. Prepare Session (Reuse login/room logic from Phase 12)
$global:Token = $null
$global:RoomId = $null
$global:SessionId = $null
$global:SaveId = $null

Test-Step "1. Login as Admin/Developer" {
  $body = @{ username = "testuser_trade1"; password = "test123456" } | ConvertTo-Json
  $resp = Invoke-WebRequest -Uri "$BaseUrl/api/auth/login" -Method Post -Body $body -ContentType "application/json" -UseBasicParsing
  $json = $resp.Content | ConvertFrom-Json
  $global:Token = $json.data.token
}

Test-Step "2. Get Active Session" {
  # We assume a session was created in Phase 12 or we create a new one
  $headers = @{ Authorization = "Bearer $global:Token" }
  $resp = Invoke-WebRequest -Uri "$BaseUrl/api/game/history" -Method Get -Headers $headers -UseBasicParsing
  $json = $resp.Content | ConvertFrom-Json
  if ($json.data.history.Count -gt 0) {
    $global:SessionId = $json.data.history[0].sessionId
    Write-Host "  Found Session ID: $global:SessionId" -ForegroundColor Gray
  }
  else {
    throw "No active session found for testing. Run Phase 12 tests first."
  }
}

# 2. Test Manual Save
Test-Step "3. Create Manual Save" {
  $headers = @{ Authorization = "Bearer $global:Token" }
  $body = @{
    saveName    = "Manual Test Save"
    description = "A test save at session start"
  } | ConvertTo-Json

  $resp = Invoke-WebRequest -Uri "$BaseUrl/api/game/$global:SessionId/save" -Method Post -Headers $headers -Body $body -ContentType "application/json" -UseBasicParsing
  $json = $resp.Content | ConvertFrom-Json
  $global:SaveId = $json.data.id
  Write-Host "  Save Created: $global:SaveId" -ForegroundColor Gray
}

# 3. Test List Saves
Test-Step "4. List Game Saves" {
  $headers = @{ Authorization = "Bearer $global:Token" }
  $resp = Invoke-WebRequest -Uri "$BaseUrl/api/game/$global:SessionId/saves" -Method Get -Headers $headers -UseBasicParsing
  $json = $resp.Content | ConvertFrom-Json
  
  if ($json.data.saves.Count -eq 0) {
    throw "No saves found in list"
  }
  Write-Host "  Found $($json.data.saves.Count) save(s)" -ForegroundColor Gray
}

# 4. Test Restore
Test-Step "5. Restore from Save" {
  $headers = @{ Authorization = "Bearer $global:Token" }
  $resp = Invoke-WebRequest -Uri "$BaseUrl/api/game/$global:SessionId/restore/$global:SaveId" -Method Post -Headers $headers -UseBasicParsing
  $json = $resp.Content | ConvertFrom-Json
  
  if ($json.code -ne 200) {
    throw "Restore failed: $($json.message)"
  }
  Write-Host "  Restore successful" -ForegroundColor Gray
}

# 5. Test Delete Save
Test-Step "6. Delete Save" {
  $headers = @{ Authorization = "Bearer $global:Token" }
  $resp = Invoke-WebRequest -Uri "$BaseUrl/api/game/$global:SessionId/saves/$global:SaveId" -Method Delete -Headers $headers -UseBasicParsing
  $json = $resp.Content | ConvertFrom-Json
  
  if ($json.code -ne 200) {
    throw "Delete failed"
  }
  Write-Host "  Delete successful" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Phase 13 test completed" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
