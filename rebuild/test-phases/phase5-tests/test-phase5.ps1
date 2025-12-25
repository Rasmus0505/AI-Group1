# Phase 5 Automated Acceptance: Host Initialization Configuration
param(
  [string]$BaseUrl = "http://localhost:3000"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Phase 5 Test: Host Initialization Configuration " -ForegroundColor Cyan
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
    Write-Host $_.Exception.Message -ForegroundColor Red
    throw
  }
}

# 1. Health check
Test-Step "1.1 Check backend health status ($BaseUrl/health)" {
  $resp = Invoke-WebRequest -Uri "$BaseUrl/health" -UseBasicParsing
  if ($resp.StatusCode -ne 200) {
    throw "Health check failed with status code $($resp.StatusCode)"
  }
}

# 2. Login / Register test user
$global:TestToken = $null
Test-Step "2.1 Get test user Token" {
  $loginBody = @{
    username = "testuser_phase5"
    password = "Test1234!"
  } | ConvertTo-Json

  try {
    $loginResp = Invoke-WebRequest -Uri "$BaseUrl/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -UseBasicParsing
  }
  catch {
    Write-Host "Login failed, attempting to register test user..." -ForegroundColor DarkYellow
    $registerBody = @{
      username = "testuser_phase5"
      password = "Test1234!"
    } | ConvertTo-Json
    Invoke-WebRequest -Uri "$BaseUrl/api/auth/register" -Method Post -Body $registerBody -ContentType "application/json" -UseBasicParsing | Out-Null
    $loginResp = Invoke-WebRequest -Uri "$BaseUrl/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -UseBasicParsing
  }

  $loginJson = $loginResp.Content | ConvertFrom-Json
  if (-not $loginJson.data -or -not $loginJson.data.token) {
    throw "data.token field not found in login response"
  }
  $global:TestToken = $loginJson.data.token
}

if (-not $global:TestToken) {
  Write-Host "Failed to obtain token, cannot continue" -ForegroundColor Red
  exit 1
}

# 3. Create room
$global:TestRoomId = $null
Test-Step "3.1 Create test room" {
  $roomBody = @{
    name       = "Phase5 Host Config Room"
    maxPlayers = 4
  } | ConvertTo-Json
  $headers = @{ Authorization = "Bearer $($global:TestToken)" }
  $roomResp = Invoke-WebRequest -Uri "$BaseUrl/api/rooms/create" -Method Post -Body $roomBody -Headers $headers -ContentType "application/json" -UseBasicParsing
  $roomJson = $roomResp.Content | ConvertFrom-Json
  $global:TestRoomId = $roomJson.data.room_id
  if (-not $global:TestRoomId) { throw "room_id not found in create room response" }
}

$authHeaders = @{
  Authorization = "Bearer $($global:TestToken)"
  "Content-Type" = "application/json"
}

# 4. API configuration
Test-Step "4.1 Update API configuration" {
  $body = @{
    apiProvider = "openai"
    apiEndpoint = "https://api.example.com/predict"
    apiHeaders = @{
      Authorization = "Bearer demo"
    }
    apiBodyTemplate = @{
      prompt = "test prompt"
      temperature = 0.7
    }
  } | ConvertTo-Json
  Invoke-WebRequest -Uri "$BaseUrl/api/rooms/$($global:TestRoomId)/host-config/api" -Method Post -Headers $authHeaders -Body $body -UseBasicParsing | Out-Null
}

# 5. Rules
Test-Step "4.2 Update rules" {
  $body = @{ gameRules = "This is a test rule" } | ConvertTo-Json
  Invoke-WebRequest -Uri "$BaseUrl/api/rooms/$($global:TestRoomId)/host-config/rules" -Method Post -Headers $authHeaders -Body $body -UseBasicParsing | Out-Null
}

# 6. Player configuration
Test-Step "4.3 Update player configuration" {
  $body = @{
    totalDecisionEntities = 4
    humanPlayerCount = 2
    aiPlayerCount = 2
    decisionTimeLimit = 5
    timeoutStrategy = "auto_submit"
  } | ConvertTo-Json
  Invoke-WebRequest -Uri "$BaseUrl/api/rooms/$($global:TestRoomId)/host-config/players" -Method Post -Headers $authHeaders -Body $body -UseBasicParsing | Out-Null
}

# 7. Verification and completion
Test-Step "4.4 Mark validation passed" {
  $body = @{ status = "validated"; message = "ok" } | ConvertTo-Json
  Invoke-WebRequest -Uri "$BaseUrl/api/rooms/$($global:TestRoomId)/host-config/validate" -Method Post -Headers $authHeaders -Body $body -UseBasicParsing | Out-Null
}

Test-Step "4.5 Complete host configuration" {
  Invoke-WebRequest -Uri "$BaseUrl/api/rooms/$($global:TestRoomId)/host-config/complete" -Method Post -Headers $authHeaders -UseBasicParsing | Out-Null
}

# 8. Get configuration snapshot
Test-Step "4.6 Get configuration snapshot" {
  $resp = Invoke-WebRequest -Uri "$BaseUrl/api/rooms/$($global:TestRoomId)/host-config" -Method Get -Headers $authHeaders -UseBasicParsing
  $json = $resp.Content | ConvertFrom-Json
  if (-not $json.data.initializationCompleted) {
    throw "Initialization not completed"
  }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Phase 5 test passed" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
