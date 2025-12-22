# Phase 5 自动化验收：主持人初始化设定
param(
  [string]$BaseUrl = "http://localhost:3000"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " 第五阶段测试：主持人初始化设定 " -ForegroundColor Cyan
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
    Write-Host "✗ $Title 失败：" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    throw
  }
}

# 1. 健康检查
Test-Step "1.1 检查后端健康状态 ($BaseUrl/health)" {
  $resp = Invoke-WebRequest -Uri "$BaseUrl/health" -UseBasicParsing
  if ($resp.StatusCode -ne 200) {
    throw "Health check failed with status code $($resp.StatusCode)"
  }
}

# 2. 登录 / 注册测试用户
$global:TestToken = $null
Test-Step "2.1 获取测试用户 Token" {
  $loginBody = @{
    username = "testuser_phase5"
    password = "Test1234!"
  } | ConvertTo-Json

  try {
    $loginResp = Invoke-WebRequest -Uri "$BaseUrl/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -UseBasicParsing
  }
  catch {
    Write-Host "登录失败，尝试注册测试用户..." -ForegroundColor DarkYellow
    $registerBody = @{
      username = "testuser_phase5"
      password = "Test1234!"
      email    = "testuser_phase5@example.com"
    } | ConvertTo-Json
    Invoke-WebRequest -Uri "$BaseUrl/api/auth/register" -Method Post -Body $registerBody -ContentType "application/json" -UseBasicParsing | Out-Null
    $loginResp = Invoke-WebRequest -Uri "$BaseUrl/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -UseBasicParsing
  }

  $loginJson = $loginResp.Content | ConvertFrom-Json
  if (-not $loginJson.data -or -not $loginJson.data.token) {
    throw "登录响应中未找到 data.token 字段"
  }
  $global:TestToken = $loginJson.data.token
}

if (-not $global:TestToken) {
  Write-Host "未获取到 token，无法继续" -ForegroundColor Red
  exit 1
}

# 3. 创建房间
$global:TestRoomId = $null
Test-Step "3.1 创建测试房间" {
  $roomBody = @{
    name       = "Phase5 Host Config Room"
    maxPlayers = 4
  } | ConvertTo-Json
  $headers = @{ Authorization = "Bearer $($global:TestToken)" }
  $roomResp = Invoke-WebRequest -Uri "$BaseUrl/api/rooms/create" -Method Post -Body $roomBody -Headers $headers -ContentType "application/json" -UseBasicParsing
  $roomJson = $roomResp.Content | ConvertFrom-Json
  $global:TestRoomId = $roomJson.data.room_id
  if (-not $global:TestRoomId) { throw "创建房间响应中未找到 room_id" }
}

$authHeaders = @{
  Authorization = "Bearer $($global:TestToken)"
  "Content-Type" = "application/json"
}

# 4. API 配置
Test-Step "4.1 更新 API 配置" {
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

# 5. 规则
Test-Step "4.2 更新规则" {
  $body = @{ gameRules = "这是测试规则" } | ConvertTo-Json
  Invoke-WebRequest -Uri "$BaseUrl/api/rooms/$($global:TestRoomId)/host-config/rules" -Method Post -Headers $authHeaders -Body $body -UseBasicParsing | Out-Null
}

# 6. 玩家配置
Test-Step "4.3 更新玩家配置" {
  $body = @{
    totalDecisionEntities = 4
    humanPlayerCount = 2
    aiPlayerCount = 2
    decisionTimeLimit = 5
    timeoutStrategy = "auto_submit"
  } | ConvertTo-Json
  Invoke-WebRequest -Uri "$BaseUrl/api/rooms/$($global:TestRoomId)/host-config/players" -Method Post -Headers $authHeaders -Body $body -UseBasicParsing | Out-Null
}

# 7. 验证与完成
Test-Step "4.4 标记验证通过" {
  $body = @{ status = "validated"; message = "ok" } | ConvertTo-Json
  Invoke-WebRequest -Uri "$BaseUrl/api/rooms/$($global:TestRoomId)/host-config/validate" -Method Post -Headers $authHeaders -Body $body -UseBasicParsing | Out-Null
}

Test-Step "4.5 完成主持人配置" {
  Invoke-WebRequest -Uri "$BaseUrl/api/rooms/$($global:TestRoomId)/host-config/complete" -Method Post -Headers $authHeaders -UseBasicParsing | Out-Null
}

# 8. 获取配置快照
Test-Step "4.6 获取配置快照" {
  $resp = Invoke-WebRequest -Uri "$BaseUrl/api/rooms/$($global:TestRoomId)/host-config" -Method Get -Headers $authHeaders -UseBasicParsing
  $json = $resp.Content | ConvertFrom-Json
  if (-not $json.data.initializationCompleted) {
    throw "初始化未完成"
  }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "🎉 第五阶段测试通过" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green

