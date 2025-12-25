# Phase 3 Test Script (PowerShell)
# Goal: Room system basic flow (create/list/join/leave)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Phase 3 Test: Room System Basics" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$API_BASE = "http://localhost:3000/api"

# 0. Health check
Write-Host "0. Health check..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$API_BASE/../health" -Method Get -TimeoutSec 5
    Write-Host "   ✓ Backend health check passed" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Backend not started, please run backend first" -ForegroundColor Red
    Write-Host "     Start command: cd 重新打造/正式搭建/backend && npm run dev" -ForegroundColor Gray
    exit 1
}

Write-Host ""

# Prepare test data
$user1 = "room_tester_$(Get-Random -Minimum 1000 -Maximum 9999)"
$user2 = "room_tester_b_$(Get-Random -Minimum 1000 -Maximum 9999)"
$password = "password123"
$token1 = $null
$token2 = $null
$roomId = $null

function Register-User {
    param($username)
    $body = @{ username = $username; password = $password } | ConvertTo-Json
    return Invoke-RestMethod -Uri "$API_BASE/auth/register" -Method Post -Body $body -ContentType "application/json"
}

function Login-User {
    param($username)
    $body = @{ username = $username; password = $password } | ConvertTo-Json
    return Invoke-RestMethod -Uri "$API_BASE/auth/login" -Method Post -Body $body -ContentType "application/json"
}

# 1. Register user A
Write-Host "1. Registering user A..." -ForegroundColor Yellow
try {
    $resp = Register-User $user1
    if ($resp.data.token) {
        $token1 = $resp.data.token
        Write-Host "   ✓ Registration successful: $user1" -ForegroundColor Green
    } else { throw "Registration response missing token" }
} catch {
    Write-Host "   ✗ User A registration failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 2. Register user B
Write-Host "2. Registering user B..." -ForegroundColor Yellow
try {
    $resp = Register-User $user2
    if ($resp.data.token) {
        $token2 = $resp.data.token
        Write-Host "   ✓ Registration successful: $user2" -ForegroundColor Green
    } else { throw "Registration response missing token" }
} catch {
    Write-Host "   ✗ User B registration failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 3. Login user A (host)
Write-Host "3. Logging in user A..." -ForegroundColor Yellow
try {
    $resp = Login-User $user1
    $token1 = $resp.data.token
    Write-Host "   ✓ Login successful: $user1" -ForegroundColor Green
} catch {
    Write-Host "   ✗ User A login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 4. Login user B (joiner)
Write-Host "4. Logging in user B..." -ForegroundColor Yellow
try {
    $resp = Login-User $user2
    $token2 = $resp.data.token
    Write-Host "   ✓ Login successful: $user2" -ForegroundColor Green
} catch {
    Write-Host "   ✗ User B login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 5. User A creates room
Write-Host "5. Creating room..." -ForegroundColor Yellow
try {
    $headersA = @{ "Authorization" = "Bearer $token1" }
    $body = @{
        name = "TestRoom_$(Get-Random -Minimum 1000 -Maximum 9999)"
        max_players = 4
        game_mode = "competitive"
    } | ConvertTo-Json

    $resp = Invoke-RestMethod -Uri "$API_BASE/rooms/create" -Method Post -Headers $headersA -Body $body -ContentType "application/json"
    $roomId = $resp.data.room_id
    if (-not $roomId) { throw "Response did not return room_id" }
    Write-Host "   ✓ Room created successfully: $roomId" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Room creation failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# 6. Get room list
Write-Host "6. Getting room list..." -ForegroundColor Yellow
try {
    $headersA = @{ "Authorization" = "Bearer $token1" }
    $resp = Invoke-RestMethod -Uri "$API_BASE/rooms/list" -Method Get -Headers $headersA
    $total = $resp.data.total
    Write-Host "   ✓ Room list returned, total: $total" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Failed to get room list: $($_.Exception.Message)" -ForegroundColor Red
}

# 7. User B joins room
Write-Host "7. User B joining room..." -ForegroundColor Yellow
try {
    $headersB = @{ "Authorization" = "Bearer $token2" }
    $resp = Invoke-RestMethod -Uri "$API_BASE/rooms/$roomId/join" -Method Post -Headers $headersB -ContentType "application/json"
    Write-Host "   ✓ Join successful" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Failed to join room: $($_.Exception.Message)" -ForegroundColor Red
}

# 8. User B leaves room
Write-Host "8. User B leaving room..." -ForegroundColor Yellow
try {
    $headersB = @{ "Authorization" = "Bearer $token2" }
    $resp = Invoke-RestMethod -Uri "$API_BASE/rooms/$roomId/leave" -Method Post -Headers $headersB -ContentType "application/json"
    Write-Host "   ✓ Leave successful" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Failed to leave room: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test completed" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "User A: $user1 | User B: $user2 | Room ID: $roomId" -ForegroundColor Gray
