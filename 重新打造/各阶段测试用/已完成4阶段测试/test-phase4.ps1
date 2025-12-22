param(
  [string]$BaseUrl = "http://localhost:3000",
  [string]$FrontendUrl = "http://localhost:5173"
)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " 第四阶段测试：WebSocket 实时通信基础（最小子集）" -ForegroundColor Cyan
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
    Write-Host "✗ $Title 失败：" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    throw
  }
}

$ErrorActionPreference = "Stop"

# 1. 健康检查
Test-Step "1.1 检查后端健康状态 ($BaseUrl/health)" {
  $resp = Invoke-WebRequest -Uri "$BaseUrl/health" -UseBasicParsing
  if ($resp.StatusCode -ne 200) {
    throw "Health check failed with status code $($resp.StatusCode)"
  }
}

# 2. 获取或创建测试用户并登录
$global:TestToken = $null

Test-Step "2.1 使用测试账号登录获取 JWT" {
  $loginBody = @{
    username = "testuser_phase4"
    password = "Test1234!"
  } | ConvertTo-Json

  try {
    $loginResp = Invoke-WebRequest -Uri "$BaseUrl/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -UseBasicParsing
  }
  catch {
    # 若登录失败，尝试注册后再登录
    Write-Host "登录失败，尝试注册测试用户..." -ForegroundColor DarkYellow

    $registerBody = @{
      username = "testuser_phase4"
      password = "Test1234!"
      email    = "testuser_phase4@example.com"
    } | ConvertTo-Json

    Invoke-WebRequest -Uri "$BaseUrl/api/auth/register" -Method Post -Body $registerBody -ContentType "application/json" -UseBasicParsing | Out-Null

    $loginResp = Invoke-WebRequest -Uri "$BaseUrl/api/auth/login" -Method Post -Body $loginBody -ContentType "application/json" -UseBasicParsing
  }

  $loginJson = $loginResp.Content | ConvertFrom-Json
  # 后端登录接口的返回结构为：{ code, message, data: { token, user } }
  if (-not $loginJson.data -or -not $loginJson.data.token) {
    throw "登录响应中未找到 data.token 字段"
  }
  $global:TestToken = $loginJson.data.token
}

if (-not $global:TestToken) {
  Write-Host "未能获取到测试 token，无法继续进行 WebSocket 测试。" -ForegroundColor Red
  exit 1
}

# 3. 创建测试房间
$global:TestRoomId = $null

Test-Step "3.1 创建测试房间" {
  $roomBody = @{
    name       = "Phase4 Auto Test Room"
    maxPlayers = 4
  } | ConvertTo-Json

  $headers = @{ Authorization = "Bearer $($global:TestToken)" }

  $roomResp = Invoke-WebRequest -Uri "$BaseUrl/api/rooms/create" -Method Post -Body $roomBody -Headers $headers -ContentType "application/json" -UseBasicParsing
  $roomJson = $roomResp.Content | ConvertFrom-Json
  $global:TestRoomId = $roomJson.data.room_id

  if (-not $global:TestRoomId) {
    throw "创建房间响应中未找到 room_id"
  }
}

Write-Host ""
Write-Host "接下来建议在浏览器中打开前端以观察 Rooms / WaitingRoom 实时效果：" -ForegroundColor Cyan
Write-Host "  $FrontendUrl" -ForegroundColor Cyan
Write-Host "(脚本会继续完成基础接口连通性验证，不强依赖浏览器)" -ForegroundColor DarkGray

# 4. 验证房间 REST 接口可用
Test-Step "4.1 验证房间列表接口可用" {
  $listResp = Invoke-WebRequest -Uri "$BaseUrl/api/rooms/list" -UseBasicParsing
  if ($listResp.StatusCode -ne 200) {
    throw "房间列表接口返回状态码 $($listResp.StatusCode)"
  }
}

# 5. 提示手工验证 WebSocket（当前 PowerShell 不内置 Socket.io 客户端）
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " WebSocket 最小子系统验证提示（手工步骤）" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "- 请确保已在前端登录为测试用户：testuser_phase4 / Test1234!" -ForegroundColor Yellow
Write-Host "- 在浏览器中执行以下场景：" -ForegroundColor Yellow
Write-Host "  1) 打开 /rooms 页面，确认房间列表中出现 “Phase4 Auto Test Room”" -ForegroundColor Yellow
Write-Host "  2) 在一个浏览器标签加入房间，观察另一个标签 /rooms 是否自动刷新（player_joined）" -ForegroundColor Yellow
Write-Host "  3) 在 WaitingRoom 页面刷新或关闭标签，再观察另一侧人数变化（player_left + game_state_update）" -ForegroundColor Yellow
Write-Host ""
Write-Host "若上述场景均正常，则认为“第四阶段最小实时子系统”通过基础验收。" -ForegroundColor Green

exit 0


