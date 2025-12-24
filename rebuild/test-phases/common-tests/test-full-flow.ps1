# Full Project Happy-Path Flow Test (Host + Player + Inference + History)
# 适配当前 rebuild/production 工程的端点与数据结构

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Full Project Happy-Path Flow Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# -----------------------------
# 配置区（如需自定义可修改）
# -----------------------------
$baseUrl = "http://localhost:3000"

# 默认账号（可通过环境变量覆盖）
$hostUsername   = if ($env:HOST_USERNAME)   { $env:HOST_USERNAME }   else { "developer" }
$hostPassword   = if ($env:HOST_PASSWORD)   { $env:HOST_PASSWORD }   else { "000000" }
$playerUsername = if ($env:PLAYER_USERNAME) { $env:PLAYER_USERNAME } else { "testuser1" }
$playerPassword = if ($env:PLAYER_PASSWORD) { $env:PLAYER_PASSWORD } else { "Test1234!" }

Write-Host "Using baseUrl: $baseUrl" -ForegroundColor Gray
Write-Host "Host user   : $hostUsername" -ForegroundColor Gray
Write-Host "Player user : $playerUsername" -ForegroundColor Gray
Write-Host ""

function Invoke-Api {
  param(
    [Parameter(Mandatory=$true)][string]$Method,
    [Parameter(Mandatory=$true)][string]$Path,
    [Parameter()][object]$Body,
    [Parameter()][string]$Token,
    [switch]$AllowError
  )

  $url = "$baseUrl$Path"
  $headers = @{ "Content-Type" = "application/json" }
  if ($Token) {
    $headers["Authorization"] = "Bearer $Token"
  }

  $params = @{
    Method      = $Method
    Uri         = $url
    Headers     = $headers
    ErrorAction = "Stop"
  }

  if ($Body) {
    $json = $Body | ConvertTo-Json -Depth 10
    $params["Body"] = $json
  }

  try {
    $resp = Invoke-RestMethod @params
    return $resp
  } catch {
    if ($AllowError) {
      Write-Host "  ⚠ API call failed but allowed: $Method $Path" -ForegroundColor Yellow
      Write-Host "    $($_.Exception.Message)" -ForegroundColor DarkYellow
      return $null
    }
    throw
  }
}

function Assert-Condition {
  param(
    [Parameter(Mandatory=$true)]$Condition,
    [Parameter(Mandatory=$true)][string]$Message
  )
  if (-not $Condition) {
    Write-Host "✗ $Message" -ForegroundColor Red
    throw $Message
  } else {
    Write-Host "✓ $Message" -ForegroundColor Green
  }
}

$global:sessionId = $null
$global:roomId    = $null

try {
  $startTime = Get-Date

  # 1. 基础健康检查
  Write-Host "Step 1: Health check" -ForegroundColor Cyan
  $health = Invoke-Api -Method GET -Path "/health" -Body $null -Token "" -AllowError
  Assert-Condition ($health -ne $null) "后端 /health 可访问"
  Write-Host ""

  # 2. Host / Player 登录
  Write-Host "Step 2: Login host & player" -ForegroundColor Cyan
  $hostResp = Invoke-Api -Method POST -Path "/api/auth/login" -Body @{ username = $hostUsername; password = $hostPassword }
  $hostToken = $hostResp.data.token
  Assert-Condition ($hostToken) "主持人账号登录成功"

  $playerResp = Invoke-Api -Method POST -Path "/api/auth/login" -Body @{ username = $playerUsername; password = $playerPassword } -AllowError
  if (-not $playerResp) {
    Write-Host "  ⚠ 玩家账号登录失败，尝试自动注册..." -ForegroundColor Yellow
    $reg = Invoke-Api -Method POST -Path "/api/auth/register" -Body @{ username = $playerUsername; password = $playerPassword } -AllowError
    $playerResp = Invoke-Api -Method POST -Path "/api/auth/login" -Body @{ username = $playerUsername; password = $playerPassword }
  }
  $playerToken = $playerResp.data.token
  Assert-Condition ($playerToken) "玩家账号登录成功"
  Write-Host ""

  # 3. 主持人创建房间
  Write-Host "Step 3: Create room by host" -ForegroundColor Cyan
  $roomName = "AutoTestRoom-" + (Get-Random)
  $createRoomResp = Invoke-Api -Method POST -Path "/api/rooms/create" -Token $hostToken -Body @{
    name       = $roomName
    maxPlayers = 4
  }
  $roomId = $createRoomResp.data.room_id
  Assert-Condition ($roomId) "房间创建成功：$roomId"

  # 4. 玩家加入房间（必须在游戏开始前加入）
  Write-Host "Step 4: Player joins room" -ForegroundColor Cyan
  $joinResp = Invoke-Api -Method POST -Path "/api/rooms/$roomId/join" -Token $playerToken -Body @{}
  Assert-Condition ($joinResp.code -eq 200) "玩家加入房间成功"
  Write-Host ""

  # 5. 主持人完成基础配置（使用默认 DeepSeek & 蓝本规则，标记初始化完成）
  Write-Host "Step 5: Host config complete (use defaults)" -ForegroundColor Cyan
  # 5.1 获取或创建 host-config（使用默认 DeepSeek 模板与蓝本规则）
  $cfgResp = Invoke-Api -Method GET -Path "/api/rooms/$roomId/host-config" -Token $hostToken -Body $null
  Assert-Condition ($cfgResp.code -eq 200) "获取主持人配置成功（默认蓝本已注入）"

  # 5.2 标记初始化完成
  $completeResp = Invoke-Api -Method POST -Path "/api/rooms/$roomId/host-config/complete" -Token $hostToken -Body @{}
  Assert-Condition ($completeResp.code -eq 200 -and $completeResp.data.initializationCompleted) "主持人初始化配置标记完成"
  Write-Host ""

  # 6. 开始游戏，创建 GameSession
  Write-Host "Step 6: Start game session" -ForegroundColor Cyan
  $startResp = Invoke-Api -Method POST -Path "/api/game/$roomId/start" -Token $hostToken -Body @{}
  Assert-Condition ($startResp.code -eq 200) "开始游戏接口调用成功"
  $session = $startResp.data.session
  $sessionId = $session.id
  Assert-Condition ($sessionId) "获得 GameSessionId：$sessionId"
  Assert-Condition ($session.roundStatus -eq "decision") "当前阶段为决策阶段"
  Write-Host ""

  # 7. 玩家提交第 1 回合决策
  Write-Host "Step 7: Player submit decision (Round 1)" -ForegroundColor Cyan
  $decisionText = "自动化测试决策 - $(Get-Date -Format s)"
  $submitDecisionResp = Invoke-Api -Method POST -Path "/api/game/$sessionId/decision" -Token $playerToken -Body @{
    round      = 1
    actionText = $decisionText
  }
  Assert-Condition ($submitDecisionResp.code -eq 200) "玩家决策提交成功"

  # 验证决策列表中至少有一条记录
  $decisionsResp = Invoke-Api -Method GET -Path "/api/game/$sessionId/round/1/decisions" -Token $playerToken -Body $null
  $actions = $decisionsResp.data.actions
  Assert-Condition ($actions.Count -ge 1) "第 1 回合决策列表中至少存在一条记录"
  Write-Host ""

  # 8. 主持人进入审核阶段并提交给 AI 推演
  Write-Host "Step 8: Host review & submit to AI" -ForegroundColor Cyan
  $reviewResp = Invoke-Api -Method POST -Path "/api/game/$sessionId/start-review" -Token $hostToken -Body @{}
  Assert-Condition ($reviewResp.code -eq 200) "进入审核阶段成功"

  $submitAiResp = Invoke-Api -Method POST -Path "/api/game/$sessionId/round/1/submit-to-ai" -Token $hostToken -Body @{}
  Assert-Condition ($submitAiResp.code -eq 200) "提交给 AI 推演请求发送成功（不代表 AI 一定成功）"
  Write-Host ""

  # 9. 轮询推演结果（容忍 AI 调用失败，但路径必须打通）
  Write-Host "Step 9: Poll inference result (Round 1)" -ForegroundColor Cyan
  $maxWaitSeconds = 60
  $elapsed = 0
  $inferenceStatus = "processing"
  $inferenceData = $null

  while ($elapsed -lt $maxWaitSeconds) {
    Start-Sleep -Seconds 3
    $elapsed += 3
    $infResp = Invoke-Api -Method GET -Path "/api/game/$sessionId/round/1/inference-result" -Token $playerToken -Body $null -AllowError
    if (-not $infResp) {
      continue
    }
    $inferenceStatus = $infResp.data.status
    if ($inferenceStatus -ne "processing") {
      $inferenceData = $infResp.data
      break
    }
    Write-Host "  ... inference still processing ($elapsed s)" -ForegroundColor Gray
  }

  if ($inferenceStatus -eq "completed") {
    Write-Host "✓ 推演完成：status = completed" -ForegroundColor Green
  } elseif ($inferenceStatus -eq "failed") {
    Write-Host "⚠ 推演失败：status = failed（通常是 AI 配置或网络问题，但接口链路已打通）" -ForegroundColor Yellow
  } else {
    Write-Host "⚠ 在 $maxWaitSeconds 秒内未获得最终推演状态（当前：$inferenceStatus）" -ForegroundColor Yellow
  }
  Write-Host ""

  # 10. 检查 GameState 中是否挂载推演结果片段（如果有）
  Write-Host "Step 10: Check game state & uiTurnResult" -ForegroundColor Cyan
  $stateResp = Invoke-Api -Method GET -Path "/api/game/$sessionId/state" -Token $playerToken -Body $null
  Assert-Condition ($stateResp.code -eq 200) "GameState 接口可访问"
  if ($stateResp.data.inferenceResult -and $stateResp.data.inferenceResult.result) {
    $uiTurn = $stateResp.data.inferenceResult.result.uiTurnResult
    if ($uiTurn) {
      Write-Host "✓ GameState 中已包含 uiTurnResult（TurnResultDTO 结构）" -ForegroundColor Green
    } else {
      Write-Host "⚠ GameState 中尚未检测到 uiTurnResult（可能推演失败或 AI 仅返回旧结构）" -ForegroundColor Yellow
    }
  } else {
    Write-Host "⚠ 当前回合无 inferenceResult（可能推演未完成或失败）" -ForegroundColor Yellow
  }
  Write-Host ""

  # 11. 历史记录与荣誉墙前置（至少写入一条历史）
  Write-Host "Step 11: Check game history APIs" -ForegroundColor Cyan
  $historyList = Invoke-Api -Method GET -Path "/api/game/history?page=1&limit=10&status=all" -Token $hostToken -Body $null
  Assert-Condition ($historyList.code -eq 200) "获取游戏历史列表成功"

  # 历史详情端点：/api/game/history/:sessionId
  $historyDetail = Invoke-Api -Method GET -Path "/api/game/history/$sessionId" -Token $hostToken -Body $null -AllowError
  if ($historyDetail) {
    Write-Host "✓ 游戏历史详情接口可访问" -ForegroundColor Green
  } else {
    Write-Host "⚠ 游戏历史详情暂不可用（可能会话尚未结束），但不会影响主链路" -ForegroundColor Yellow
  }
  Write-Host ""

  $endTime = Get-Date
  $duration = $endTime - $startTime
  Write-Host "========================================" -ForegroundColor Cyan
  Write-Host "Full flow test finished in $($duration.TotalSeconds.ToString('F2')) seconds" -ForegroundColor Cyan
  Write-Host "SessionId: $sessionId" -ForegroundColor Gray
  Write-Host "RoomId   : $roomId" -ForegroundColor Gray
  Write-Host "========================================" -ForegroundColor Cyan
  exit 0
}
catch {
  Write-Host ""
  Write-Host "========================================" -ForegroundColor Red
  Write-Host "Full flow test failed: $($_.Exception.Message)" -ForegroundColor Red
  Write-Host "========================================" -ForegroundColor Red
  exit 1
}


