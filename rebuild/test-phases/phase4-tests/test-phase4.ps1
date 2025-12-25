param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$FrontendUrl = "http://localhost:5173"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Phase 4 Test: WebSocket Real-time Communication Basics (Minimal Subset)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

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

$ErrorActionPreference = "Stop"

# 1. Health check
Test-Step "1.1 Check backend health status ($BaseUrl/health)" {
  $resp = Invoke-WebRequest -Uri "$BaseUrl/health" -UseBasicParsing
  if ($resp.StatusCode -ne 200) {
    throw "Health check failed with status code $($resp.StatusCode)"
  }
}

# 2. Get or create test user and login
$global:TestToken = $null

Test-Step "2.1 Login with test account to get JWT" {
  $loginBody = @{
    username = "testuser_phase4"
    password = "Test1234!"
  } | ConvertTo-Json

  try {
    $loginResp = Invoke-WebRequest -Uri "$BaseUrl/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -UseBasicParsing
  }
  catch {
    # If login fails, try registering then login
    Write-Host "Login failed, attempting to register test user..." -ForegroundColor DarkYellow

    $registerBody = @{
      username = "testuser_phase4"
      password = "Test1234!"
    } | ConvertTo-Json

    Invoke-WebRequest -Uri "$BaseUrl/api/auth/register" -Method Post -Body $registerBody -ContentType "application/json" -UseBasicParsing | Out-Null

    $loginResp = Invoke-WebRequest -Uri "$BaseUrl/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -UseBasicParsing
  }

  $loginJson = $loginResp.Content | ConvertFrom-Json
  # Backend login API response structure: { code, message, data: { token, user } }
  if (-not $loginJson.data -or -not $loginJson.data.token) {
    throw "data.token field not found in login response"
  }
  $global:TestToken = $loginJson.data.token
}

if (-not $global:TestToken) {
  Write-Host "Failed to obtain test token, cannot continue WebSocket testing." -ForegroundColor Red
  exit 1
}

# 3. Create test room
$global:TestRoomId = $null

Test-Step "3.1 Create test room" {
  $roomBody = @{
    name       = "Phase4 Auto Test Room"
    maxPlayers = 4
  } | ConvertTo-Json

  $headers = @{ Authorization = "Bearer $($global:TestToken)" }

  $roomResp = Invoke-WebRequest -Uri "$BaseUrl/api/rooms/create" -Method Post -Body $roomBody -Headers $headers -ContentType "application/json" -UseBasicParsing
  $roomJson = $roomResp.Content | ConvertFrom-Json
  $global:TestRoomId = $roomJson.data.room_id

  if (-not $global:TestRoomId) {
    throw "room_id not found in create room response"
  }
}

Write-Host ""
Write-Host "Next, it is recommended to open the frontend in a browser to observe Rooms / WaitingRoom real-time effects:" -ForegroundColor Cyan
Write-Host "  $FrontendUrl" -ForegroundColor Cyan
Write-Host "(Script will continue to complete basic API connectivity verification, not strongly dependent on browser)" -ForegroundColor DarkGray

# 4. Verify room REST API is available
Test-Step "4.1 Verify room list API is available" {
  $headers = @{ Authorization = "Bearer $($global:TestToken)" }
  $listResp = Invoke-WebRequest -Uri "$BaseUrl/api/rooms/list" -Headers $headers -UseBasicParsing
  if ($listResp.StatusCode -ne 200) {
    throw "Room list API returned status code $($listResp.StatusCode)"
  }
}

# 5. Prompt for manual WebSocket verification (PowerShell does not have built-in Socket.io client)
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " WebSocket Minimal Subsystem Verification Instructions (Manual Steps)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "- Please ensure you are logged in as test user in the frontend: testuser_phase4 / Test1234!" -ForegroundColor Yellow
Write-Host "- Execute the following scenarios in the browser:" -ForegroundColor Yellow
Write-Host "  1) Open /rooms page, confirm 'Phase4 Auto Test Room' appears in the room list" -ForegroundColor Yellow
Write-Host "  2) Join room in one browser tab, observe if another tab /rooms automatically refreshes (player_joined)" -ForegroundColor Yellow
Write-Host "  3) Refresh or close tab in WaitingRoom page, then observe player count changes on the other side (player_left + game_state_update)" -ForegroundColor Yellow
Write-Host ""
Write-Host "If all the above scenarios work normally, then 'Phase 4 Minimal Real-time Subsystem' passes basic acceptance." -ForegroundColor Green

exit 0
