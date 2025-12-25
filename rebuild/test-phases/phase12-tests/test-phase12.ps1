# Phase 12 Automated Acceptance: Trade Functionality
param(
  [string]$BaseUrl = "http://localhost:3000"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Phase 12 Test: Trade Functionality " -ForegroundColor Cyan
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
      }
      catch {
        Write-Host "  (Could not read response body: $($_.Exception.Message))" -ForegroundColor Gray
      }
    }
    
    throw
  }
}

# 1. Health check
Test-Step "1.1 Check backend health status (http://localhost:3000/health)" {
  $resp = Invoke-WebRequest -Uri "$BaseUrl/health" -UseBasicParsing
  if ($resp.StatusCode -ne 200) {
    throw "Health check failed with status $($resp.StatusCode)"
  }
}

# 2. Create test users
$global:User1Token = $null
$global:User2Token = $null
$global:User1Id = $null
$global:User2Id = $null

Test-Step "2.1 Get user Token (testuser_trade1)" {
  $body = @{
    username = "testuser_trade1"
    password = "test123456"
  } | ConvertTo-Json

  try {
    $resp = Invoke-WebRequest -Uri "$BaseUrl/api/auth/register" -Method Post -Body $body -ContentType "application/json" -UseBasicParsing
  }
  catch {
    # User might already exist, try login
    $loginBody = @{
      username = "testuser_trade1"
      password = "test123456"
    } | ConvertTo-Json
    $resp = Invoke-WebRequest -Uri "$BaseUrl/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -UseBasicParsing
  }

  $json = $resp.Content | ConvertFrom-Json
  $global:User1Token = $json.data.token
  $global:User1Id = $json.data.user.id
  Write-Host "  User1 ID: $global:User1Id" -ForegroundColor Gray
}

Test-Step "2.2 Get user Token (testuser_trade2)" {
  $body = @{
    username = "testuser_trade2"
    password = "test123456"
  } | ConvertTo-Json

  try {
    $resp = Invoke-WebRequest -Uri "$BaseUrl/api/auth/register" -Method Post -Body $body -ContentType "application/json" -UseBasicParsing
  }
  catch {
    # User might already exist, try login
    $loginBody = @{
      username = "testuser_trade2"
      password = "test123456"
    } | ConvertTo-Json
    $resp = Invoke-WebRequest -Uri "$BaseUrl/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -UseBasicParsing
  }

  $json = $resp.Content | ConvertFrom-Json
  $global:User2Token = $json.data.token
  $global:User2Id = $json.data.user.id
  Write-Host "  User2 ID: $global:User2Id" -ForegroundColor Gray
}

# 3. Create room and start game
$global:RoomId = $null
$global:SessionId = $null

Test-Step "3.1 Create room (User1)" {
  $headers = @{ Authorization = "Bearer $global:User1Token" }
  $body = @{
    name       = "Trade Test Room"
    maxPlayers = 4
    password   = ""
  } | ConvertTo-Json

  $resp = Invoke-WebRequest -Uri "$BaseUrl/api/rooms/create" -Method Post -Headers $headers -Body $body -ContentType "application/json" -UseBasicParsing
  $json = $resp.Content | ConvertFrom-Json
  $global:RoomId = $json.data.room.id
  Write-Host "  Room ID: $global:RoomId" -ForegroundColor Gray
}

Test-Step "3.2 User2 join room" {
  $headers = @{ Authorization = "Bearer $global:User2Token" }
  $null = Invoke-WebRequest -Uri "$BaseUrl/api/rooms/$global:RoomId/join" -Method Post -Headers $headers -UseBasicParsing
  Write-Host "  User2 joined room" -ForegroundColor Gray
}

Test-Step "3.3 Start game (User1 as host)" {
  $headers = @{ Authorization = "Bearer $global:User1Token" }
  
  # Configure host
  $configBody = @{
    apiProvider           = "openai"
    apiEndpoint           = "https://api.openai.com/v1/chat/completions"
    apiHeaders            = @{
      "Authorization" = "Bearer test-key"
    }
    apiBodyTemplate       = @{
      model    = "gpt-3.5-turbo"
      messages = @()
    }
    gameRules             = "Test game rules"
    totalDecisionEntities = 3
    humanPlayerCount      = 2
    aiPlayerCount         = 0
    decisionTimeLimit     = 5
    timeoutStrategy       = "auto_submit"
  } | ConvertTo-Json -Depth 10

  $resp = Invoke-WebRequest -Uri "$BaseUrl/api/rooms/$global:RoomId/host-config" -Method Post -Headers $headers -Body $configBody -ContentType "application/json" -UseBasicParsing
  
  # Complete host configuration
  $resp = Invoke-WebRequest -Uri "$BaseUrl/api/rooms/$global:RoomId/host-config/complete" -Method Post -Headers $headers -UseBasicParsing
  
  # Start game
  $resp = Invoke-WebRequest -Uri "$BaseUrl/api/game/$global:RoomId/start" -Method Post -Headers $headers -UseBasicParsing
  $json = $resp.Content | ConvertFrom-Json
  $global:SessionId = $json.data.session.id
  Write-Host "  Session ID: $global:SessionId" -ForegroundColor Gray
}

# 4. Test trade functionality
$global:TradeId = $null

Test-Step "4.1 Request trade (User1 -> User2)" {
  $headers = @{ Authorization = "Bearer $global:User1Token" }
  $body = @{
    targetId         = $global:User2Id
    offer            = @{
      gold = 100
      wood = 50
    }
    request          = @{
      food  = 200
      stone = 30
    }
    expiresInMinutes = 5
  } | ConvertTo-Json -Depth 10

  $resp = Invoke-WebRequest -Uri "$BaseUrl/api/game/$global:SessionId/trade/request" -Method Post -Headers $headers -Body $body -ContentType "application/json" -UseBasicParsing
  $json = $resp.Content | ConvertFrom-Json
  
  if (-not $json.data -or -not $json.data.trade) {
    throw "Trade request response structure is incorrect"
  }
  
  $global:TradeId = $json.data.trade.id
  Write-Host "  Trade ID: $global:TradeId" -ForegroundColor Gray
  Write-Host "  Status: $($json.data.trade.status)" -ForegroundColor Gray
}

Test-Step "4.2 Get trade list (User2)" {
  $headers = @{ Authorization = "Bearer $global:User2Token" }
  $resp = Invoke-WebRequest -Uri "$BaseUrl/api/game/$global:SessionId/trade/list" -Method Get -Headers $headers -UseBasicParsing
  $json = $resp.Content | ConvertFrom-Json
  
  if (-not $json.data -or -not $json.data.trades) {
    throw "Trade list response structure is incorrect"
  }
  
  $tradeCount = $json.data.trades.Count
  Write-Host "  Found $tradeCount trade(s)" -ForegroundColor Gray
  
  if ($tradeCount -gt 0) {
    $firstTrade = $json.data.trades[0]
    Write-Host "  First trade: $($firstTrade.id) (Status: $($firstTrade.status))" -ForegroundColor Gray
  }
}

Test-Step "4.3 Accept trade (User2)" {
  if (-not $global:TradeId) {
    Write-Host "  No trade ID available, skipping" -ForegroundColor Yellow
    return
  }
  
  $headers = @{ Authorization = "Bearer $global:User2Token" }
  $body = @{
    action = "accept"
  } | ConvertTo-Json

  $resp = Invoke-WebRequest -Uri "$BaseUrl/api/game/$global:SessionId/trade/$global:TradeId/respond" -Method Post -Headers $headers -Body $body -ContentType "application/json" -UseBasicParsing
  $json = $resp.Content | ConvertFrom-Json
  
  if (-not $json.data -or -not $json.data.trade) {
    throw "Trade response structure is incorrect"
  }
  
  if ($json.data.trade.status -ne "accepted") {
    throw "Trade status should be 'accepted' but got '$($json.data.trade.status)'"
  }
  
  Write-Host "  Trade accepted successfully" -ForegroundColor Gray
}

Test-Step "4.4 Get trade list after acceptance" {
  $headers = @{ Authorization = "Bearer $global:User1Token" }
  $resp = Invoke-WebRequest -Uri "$BaseUrl/api/game/$global:SessionId/trade/list" -Method Get -Headers $headers -UseBasicParsing
  $json = $resp.Content | ConvertFrom-Json
  
  $acceptedTrades = $json.data.trades | Where-Object { $_.status -eq "accepted" }
  Write-Host "  Found $($acceptedTrades.Count) accepted trade(s)" -ForegroundColor Gray
}

# 5. Test trade rejection
$global:TradeId2 = $null

Test-Step "5.1 Request another trade (User2 -> User1)" {
  $headers = @{ Authorization = "Bearer $global:User2Token" }
  $body = @{
    targetId         = $global:User1Id
    offer            = @{
      food = 150
    }
    request          = @{
      gold = 50
    }
    expiresInMinutes = 5
  } | ConvertTo-Json -Depth 10

  $resp = Invoke-WebRequest -Uri "$BaseUrl/api/game/$global:SessionId/trade/request" -Method Post -Headers $headers -Body $body -ContentType "application/json" -UseBasicParsing
  $json = $resp.Content | ConvertFrom-Json
  $global:TradeId2 = $json.data.trade.id
  Write-Host "  Trade ID: $global:TradeId2" -ForegroundColor Gray
}

Test-Step "5.2 Reject trade (User1)" {
  if (-not $global:TradeId2) {
    Write-Host "  No trade ID available, skipping" -ForegroundColor Yellow
    return
  }
  
  $headers = @{ Authorization = "Bearer $global:User1Token" }
  $body = @{
    action = "reject"
  } | ConvertTo-Json

  $resp = Invoke-WebRequest -Uri "$BaseUrl/api/game/$global:SessionId/trade/$global:TradeId2/respond" -Method Post -Headers $headers -Body $body -ContentType "application/json" -UseBasicParsing
  $json = $resp.Content | ConvertFrom-Json
  
  if ($json.data.trade.status -ne "rejected") {
    throw "Trade status should be 'rejected' but got '$($json.data.trade.status)'"
  }
  
  Write-Host "  Trade rejected successfully" -ForegroundColor Gray
}

# 6. Test trade cancellation
$global:TradeId3 = $null

Test-Step "6.1 Request trade for cancellation (User1 -> User2)" {
  $headers = @{ Authorization = "Bearer $global:User1Token" }
  $body = @{
    targetId         = $global:User2Id
    offer            = @{
      gold = 200
    }
    request          = @{
      food = 100
    }
    expiresInMinutes = 5
  } | ConvertTo-Json -Depth 10

  $resp = Invoke-WebRequest -Uri "$BaseUrl/api/game/$global:SessionId/trade/request" -Method Post -Headers $headers -Body $body -ContentType "application/json" -UseBasicParsing
  $json = $resp.Content | ConvertFrom-Json
  $global:TradeId3 = $json.data.trade.id
  Write-Host "  Trade ID: $global:TradeId3" -ForegroundColor Gray
}

Test-Step "6.2 Cancel trade (User1)" {
  if (-not $global:TradeId3) {
    Write-Host "  No trade ID available, skipping" -ForegroundColor Yellow
    return
  }
  
  $headers = @{ Authorization = "Bearer $global:User1Token" }
  $resp = Invoke-WebRequest -Uri "$BaseUrl/api/game/$global:SessionId/trade/$global:TradeId3" -Method Delete -Headers $headers -UseBasicParsing
  $json = $resp.Content | ConvertFrom-Json
  
  if ($json.code -ne 200) {
    throw "Cancel trade failed with code $($json.code)"
  }
  
  Write-Host "  Trade cancelled successfully" -ForegroundColor Gray
}

# 7. Test error cases
Test-Step "7.1 Test self-trade error" {
  $headers = @{ Authorization = "Bearer $global:User1Token" }
  $body = @{
    targetId = $global:User1Id
    offer    = @{ gold = 100 }
    request  = @{ food = 100 }
  } | ConvertTo-Json -Depth 10

  try {
    $null = Invoke-WebRequest -Uri "$BaseUrl/api/game/$global:SessionId/trade/request" -Method Post -Headers $headers -Body $body -ContentType "application/json" -UseBasicParsing
    throw "Should have failed with self-trade error"
  }
  catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
      Write-Host "  Self-trade correctly rejected" -ForegroundColor Gray
    }
    else {
      throw
    }
  }
}

Test-Step "7.2 Test duplicate trade error" {
  $headers = @{ Authorization = "Bearer $global:User1Token" }
  $body = @{
    targetId         = $global:User2Id
    offer            = @{ gold = 100 }
    request          = @{ food = 100 }
    expiresInMinutes = 5
  } | ConvertTo-Json -Depth 10

  # First request should succeed
  $null = Invoke-WebRequest -Uri "$BaseUrl/api/game/$global:SessionId/trade/request" -Method Post -Headers $headers -Body $body -ContentType "application/json" -UseBasicParsing
  
  # Second request should fail
  try {
    $null = Invoke-WebRequest -Uri "$BaseUrl/api/game/$global:SessionId/trade/request" -Method Post -Headers $headers -Body $body -ContentType "application/json" -UseBasicParsing
    throw "Should have failed with duplicate trade error"
  }
  catch {
    if ($_.Exception.Response.StatusCode -eq 400) {
      Write-Host "  Duplicate trade correctly rejected" -ForegroundColor Gray
    }
    else {
      throw
    }
  }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Phase 12 test completed" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

