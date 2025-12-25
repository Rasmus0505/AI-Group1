# Phase 6 Automated Acceptance: Game Core Decision Flow
param(
  [string]$BaseUrl = "http://localhost:3000"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Phase 6 Test: Game Core Decision Flow + Admin Tools " -ForegroundColor Cyan
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
    
    # If it's a web request error, show more details
    if ($_.Exception.Response) {
      $statusCode = $_.Exception.Response.StatusCode
      Write-Host "  HTTP Status Code: $statusCode" -ForegroundColor Red
      
      try {
        $stream = $_.Exception.Response.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
        $responseBody = $reader.ReadToEnd()
        $reader.Close()
        $stream.Close()
        Write-Host "  Response Body: $responseBody" -ForegroundColor Yellow
      } catch {
        Write-Host "  (Could not read response body: $($_.Exception.Message))" -ForegroundColor Gray
      }
    }
    
    Write-Host ""
    Write-Host "Full error details:" -ForegroundColor Red
    Write-Host $_.Exception.ToString() -ForegroundColor Gray
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
Test-Step "2.1 Get test user Token (testuser_phase6)" {
  $loginBody = @{
    username = "testuser_phase6"
    password = "Test1234!"
  } | ConvertTo-Json

  try {
    $loginResp = Invoke-WebRequest -Uri "$BaseUrl/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -UseBasicParsing
  }
  catch {
    Write-Host "Login failed, attempting to register test user..." -ForegroundColor DarkYellow
    $registerBody = @{
      username = "testuser_phase6"
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

$authHeaders = @{
  Authorization = "Bearer $($global:TestToken)"
  "Content-Type" = "application/json"
}

# 3. Create room and complete host configuration (borrowing Phase5 capability)
$global:TestRoomId = $null
Test-Step "3.1 Create test room (for decision flow)" {
  $roomBody = @{
    name       = "Phase6 Game Room"
    maxPlayers = 4
  } | ConvertTo-Json
  $roomResp = Invoke-WebRequest -Uri "$BaseUrl/api/rooms/create" -Method Post -Body $roomBody -Headers $authHeaders -ContentType "application/json" -UseBasicParsing
  $roomJson = $roomResp.Content | ConvertFrom-Json
  $global:TestRoomId = $roomJson.data.room_id
  if (-not $global:TestRoomId) { throw "room_id not found in create room response" }
}

Test-Step "3.2 Configure host parameters (decision time limit, etc.)" {
  $body = @{
    totalDecisionEntities = 4
    humanPlayerCount      = 1
    aiPlayerCount         = 3
    decisionTimeLimit     = 3
    timeoutStrategy       = "auto_submit"
  } | ConvertTo-Json
  Invoke-WebRequest -Uri "$BaseUrl/api/rooms/$($global:TestRoomId)/host-config/players" -Method Post -Headers $authHeaders -Body $body -UseBasicParsing | Out-Null

  $rulesBody = @{ gameRules = "Phase6 Decision Flow Test Rules" } | ConvertTo-Json
  Invoke-WebRequest -Uri "$BaseUrl/api/rooms/$($global:TestRoomId)/host-config/rules" -Method Post -Headers $authHeaders -Body $rulesBody -UseBasicParsing | Out-Null

  $validateBody = @{ status = "validated"; message = "ok" } | ConvertTo-Json
  Invoke-WebRequest -Uri "$BaseUrl/api/rooms/$($global:TestRoomId)/host-config/validate" -Method Post -Headers $authHeaders -Body $validateBody -UseBasicParsing | Out-Null

  Invoke-WebRequest -Uri "$BaseUrl/api/rooms/$($global:TestRoomId)/host-config/complete" -Method Post -Headers $authHeaders -UseBasicParsing | Out-Null
}

# 4. Start game, create GameSession
$global:SessionId = $null
Test-Step "4.1 Start game and create session (POST /api/game/{roomId}/start)" {
  $resp = Invoke-WebRequest -Uri "$BaseUrl/api/game/$($global:TestRoomId)/start" -Method Post -Headers $authHeaders -UseBasicParsing
  $json = $resp.Content | ConvertFrom-Json
  if (-not $json.data -or -not $json.data.session -or -not $json.data.session.id) {
    throw "data.session.id field not found in start game response"
  }
  $global:SessionId = $json.data.session.id
}

Test-Step "4.2 Get session information (GET /api/game/{sessionId})" {
  $resp = Invoke-WebRequest -Uri "$BaseUrl/api/game/$($global:SessionId)" -Method Get -Headers $authHeaders -UseBasicParsing
  $json = $resp.Content | ConvertFrom-Json
  if ($json.data.status -ne "playing") {
    throw "Session status is not playing: $($json.data.status)"
  }
}

# 5. Submit decision and check status
Test-Step "5.1 Submit this round's decision (POST /api/game/{sessionId}/decision)" {
  $body = @{
    round      = 1
    actionText = "This is Phase6 automated test decision content"
  } | ConvertTo-Json
  Invoke-WebRequest -Uri "$BaseUrl/api/game/$($global:SessionId)/decision" -Method Post -Headers $authHeaders -Body $body -UseBasicParsing | Out-Null
}

Test-Step "5.2 Get round 1 decision status (GET /api/game/{sessionId}/round/1/decisions)" {
  $resp = Invoke-WebRequest -Uri "$BaseUrl/api/game/$($global:SessionId)/round/1/decisions" -Method Get -Headers $authHeaders -UseBasicParsing
  $json = $resp.Content | ConvertFrom-Json
  if (-not $json.data.actions -or $json.data.actions.Count -lt 1) {
    throw "No decision records found"
  }
}

# 6. Admin tools and online rooms (using default developer account)
$global:AdminToken = $null
Test-Step "6.1 Login with developer account (default admin account)" {
  # Use environment variables if available, otherwise use default values
  # Default username is 'developer'
  $adminUsername = $env:ADMIN_USERNAME
  if (-not $adminUsername) {
    $adminUsername = 'developer'
    Write-Host "  Using default developer username: developer" -ForegroundColor Gray
  } else {
    Write-Host "  Using ADMIN_USERNAME from environment variable" -ForegroundColor Gray
  }
  
  $adminPassword = $env:ADMIN_DEFAULT_PASSWORD
  if (-not $adminPassword) {
    # Default password from backend
    $adminPassword = "000000"
  }
  
  Write-Host "  Attempting login with username: $adminUsername" -ForegroundColor Gray
  
  $loginBody = @{
    username = $adminUsername
    password = $adminPassword
  } | ConvertTo-Json

  try {
    Write-Host "  Sending login request..." -ForegroundColor Gray
    $loginResp = Invoke-WebRequest -Uri "$BaseUrl/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json; charset=utf-8" -UseBasicParsing
    $loginJson = $loginResp.Content | ConvertFrom-Json
    if (-not $loginJson.data -or -not $loginJson.data.token) {
      Write-Host "  Response: $($loginResp.Content)" -ForegroundColor Yellow
      throw "data.token field not found in developer login response"
    }
    $global:AdminToken = $loginJson.data.token
    Write-Host "  Successfully logged in as developer account" -ForegroundColor Green
  }
  catch {
    Write-Host "  ✗ Developer account login failed" -ForegroundColor Red
    
    # Show detailed error information
    if ($_.Exception.Response) {
      $statusCode = $_.Exception.Response.StatusCode.value__
      Write-Host "  HTTP Status Code: $statusCode" -ForegroundColor Red
      
      try {
        $stream = $_.Exception.Response.GetResponseStream()
        # Use UTF-8 encoding to properly read the response
        $reader = New-Object System.IO.StreamReader($stream, [System.Text.Encoding]::UTF8)
        $responseBody = $reader.ReadToEnd()
        $reader.Close()
        $stream.Close()
        
        Write-Host "  Response Body: $responseBody" -ForegroundColor Yellow
        
        # Try to parse JSON response
        try {
          $errorJson = $responseBody | ConvertFrom-Json
          if ($errorJson.message) {
            Write-Host "  Error Message: $($errorJson.message)" -ForegroundColor Red
          }
          if ($errorJson.code) {
            Write-Host "  Error Code: $($errorJson.code)" -ForegroundColor Red
          }
        } catch {
          # Not JSON, just show raw response
        }
      } catch {
        Write-Host "  (Could not read response body: $($_.Exception.Message))" -ForegroundColor Gray
      }
    }
    
    Write-Host ""
    Write-Host "  Troubleshooting steps:" -ForegroundColor Yellow
    Write-Host "    1. Check if backend server is running" -ForegroundColor Gray
    Write-Host "    2. Check backend logs for 'Default admin user created' or 'Default admin user already exists'" -ForegroundColor Gray
    Write-Host "    3. Verify the admin account exists in database:" -ForegroundColor Gray
    Write-Host "       Run: npm run delete-admin (to delete old account)" -ForegroundColor Gray
    Write-Host "       Then restart backend server (to create new account)" -ForegroundColor Gray
    Write-Host "    4. Try manual login test:" -ForegroundColor Gray
    Write-Host "       `$body = @{username='developer';password='000000'} | ConvertTo-Json" -ForegroundColor Gray
    Write-Host "       Invoke-WebRequest -Uri 'http://localhost:3000/api/auth/login' -Method Post -Body `$body -ContentType 'application/json'" -ForegroundColor Gray
    
    throw
  }
}

if (-not $global:AdminToken) {
  throw "Failed to obtain developer token"
}

$adminHeaders = @{
  Authorization = "Bearer $($global:AdminToken)"
  "Content-Type" = "application/json"
}

Test-Step "6.2 Query registered user list (GET /api/admin/users)" {
  $resp = Invoke-WebRequest -Uri "$BaseUrl/api/admin/users" -Method Get -Headers $adminHeaders -UseBasicParsing
  $json = $resp.Content | ConvertFrom-Json
  if (-not $json.data.users) {
    throw "Registered user list is empty or response structure is incorrect"
  }
}

Test-Step "6.3 Query online room list (GET /api/admin/rooms)" {
  $resp = Invoke-WebRequest -Uri "$BaseUrl/api/admin/rooms" -Method Get -Headers $adminHeaders -UseBasicParsing
  $json = $resp.Content | ConvertFrom-Json
  if (-not $json.data.rooms) {
    throw "Online room list is empty or response structure is incorrect"
  }
}

Test-Step "6.4 Close Phase 6 test room using admin API (POST /api/admin/rooms/{roomId}/close)" {
  if (-not $global:TestRoomId) {
    throw "TestRoomId is not defined, cannot close room"
  }
  $resp = Invoke-WebRequest -Uri "$BaseUrl/api/admin/rooms/$($global:TestRoomId)/close" -Method Post -Headers $adminHeaders -UseBasicParsing
  $json = $resp.Content | ConvertFrom-Json
  if ($json.data.status -ne "closed") {
    throw "Room status was not updated to closed: $($json.data.status)"
  }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "Phase 6 test passed (including admin tools)" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
