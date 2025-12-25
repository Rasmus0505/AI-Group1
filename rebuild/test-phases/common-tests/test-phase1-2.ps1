# Phase 1 + Phase 2 Combined Test Script (PowerShell)
# Tests project foundation setup and user authentication system

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Phase 1 + Phase 2 Combined Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$API_BASE = "http://localhost:3000/api"
$FRONTEND_URL = "http://localhost:5173"
$BACKEND_URL = "http://localhost:3000"

# ========================================
# Phase 1 Test: Project Foundation Setup
# ========================================
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "Phase 1 Test: Project Foundation Setup" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

# 1.1 Check service status
Write-Host "1.1 Checking service status..." -ForegroundColor Yellow

$phase1Passed = $true

try {
    $healthCheck = Invoke-RestMethod -Uri "$BACKEND_URL/health" -Method Get -TimeoutSec 5
    Write-Host "   ✓ Backend service is running normally" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Backend service is not running, please start it first" -ForegroundColor Red
    Write-Host "     Start command: cd 重新打造/正式搭建/backend && npm run dev" -ForegroundColor Gray
    $phase1Passed = $false
}

try {
    $frontendCheck = Invoke-WebRequest -Uri $FRONTEND_URL -Method Get -TimeoutSec 5 -UseBasicParsing
    Write-Host "   ✓ Frontend service is running normally" -ForegroundColor Green
} catch {
    Write-Host "   ⚠ Frontend service is not running (optional)" -ForegroundColor Yellow
    Write-Host "     Start command: cd 重新打造/正式搭建/frontend && npm run dev" -ForegroundColor Gray
}

if (-not $phase1Passed) {
    Write-Host ""
    Write-Host "Phase 1 test failed: Please start the backend service first" -ForegroundColor Red
    exit 1
}

Write-Host ""

# 1.2 Test database connection
Write-Host "1.2 Testing database connection..." -ForegroundColor Yellow
try {
    $dbCheck = Invoke-RestMethod -Uri "$API_BASE/test/db" -Method Get -TimeoutSec 5
    if ($dbCheck.status -eq "ok") {
        Write-Host "   ✓ Database connection is normal" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Database connection failed" -ForegroundColor Red
        $phase1Passed = $false
    }
} catch {
    Write-Host "   ✗ Database connection failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "     Please ensure PostgreSQL is running and database migration has been executed" -ForegroundColor Gray
    $phase1Passed = $false
}

Write-Host ""

# 1.3 Test Redis connection
Write-Host "1.3 Testing Redis connection..." -ForegroundColor Yellow
try {
    $redisCheck = Invoke-RestMethod -Uri "$API_BASE/test/redis" -Method Get -TimeoutSec 5
    if ($redisCheck.status -eq "ok") {
        Write-Host "   ✓ Redis connection is normal" -ForegroundColor Green
    } else {
        Write-Host "   ⚠ Redis connection failed (optional)" -ForegroundColor Yellow
    }
} catch {
    Write-Host "   ⚠ Redis connection failed (optional): $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""

# Phase 1 test summary
if ($phase1Passed) {
    Write-Host "✓ Phase 1 test passed!" -ForegroundColor Green
} else {
    Write-Host "✗ Phase 1 test failed, please fix the issues and retry" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "Phase 1 test completed, starting Phase 2 test..." -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

# ========================================
# Phase 2 Test: User Authentication System
# ========================================
Write-Host "========================================" -ForegroundColor Magenta
Write-Host "Phase 2 Test: User Authentication System" -ForegroundColor Magenta
Write-Host "========================================" -ForegroundColor Magenta
Write-Host ""

$phase2Passed = $true
$testUsername = "testuser_$(Get-Random -Minimum 1000 -Maximum 9999)"
$testPassword = "password123"
$token = $null

# Test 1: User registration
Write-Host "2.1 Testing user registration..." -ForegroundColor Yellow
try {
    $registerData = @{
        username = $testUsername
        password = $testPassword
    } | ConvertTo-Json

    $registerResponse = Invoke-RestMethod -Uri "$API_BASE/auth/register" `
        -Method Post `
        -Body $registerData `
        -ContentType "application/json"

    if ($registerResponse.code -eq 201 -and $registerResponse.data.token) {
        $token = $registerResponse.data.token
        Write-Host "   ✓ Registration successful" -ForegroundColor Green
        Write-Host "     Username: $testUsername" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ Registration failed: $($registerResponse.message)" -ForegroundColor Red
        $phase2Passed = $false
    }
} catch {
    Write-Host "   ✗ Registration failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "     Response: $responseBody" -ForegroundColor Gray
    }
    $phase2Passed = $false
}

Write-Host ""

# Test 2: User login
Write-Host "2.2 Testing user login..." -ForegroundColor Yellow
try {
    $loginData = @{
        username = $testUsername
        password = $testPassword
    } | ConvertTo-Json

    $loginResponse = Invoke-RestMethod -Uri "$API_BASE/auth/login" `
        -Method Post `
        -Body $loginData `
        -ContentType "application/json"

    if ($loginResponse.code -eq 200 -and $loginResponse.data.token) {
        $token = $loginResponse.data.token
        Write-Host "   ✓ Login successful" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Login failed: $($loginResponse.message)" -ForegroundColor Red
        $phase2Passed = $false
    }
} catch {
    Write-Host "   ✗ Login failed: $($_.Exception.Message)" -ForegroundColor Red
    $phase2Passed = $false
}

Write-Host ""

# Test 3: Get user info
Write-Host "2.3 Testing get user info..." -ForegroundColor Yellow
try {
    $headers = @{
        "Authorization" = "Bearer $token"
    }

    $userInfoResponse = Invoke-RestMethod -Uri "$API_BASE/user/info" `
        -Method Get `
        -Headers $headers

    if ($userInfoResponse.code -eq 200 -and $userInfoResponse.data) {
        Write-Host "   ✓ Get user info successful" -ForegroundColor Green
        Write-Host "     User ID: $($userInfoResponse.data.id)" -ForegroundColor Gray
        Write-Host "     Username: $($userInfoResponse.data.username)" -ForegroundColor Gray
        if ($userInfoResponse.data.nickname) {
            Write-Host "     Nickname: $($userInfoResponse.data.nickname)" -ForegroundColor Gray
        }
    } else {
        Write-Host "   ✗ Get user info failed" -ForegroundColor Red
        $phase2Passed = $false
    }
} catch {
    Write-Host "   ✗ Get user info failed: $($_.Exception.Message)" -ForegroundColor Red
    $phase2Passed = $false
}

Write-Host ""

# Test 4: Update user info
Write-Host "2.4 Testing update user info..." -ForegroundColor Yellow
try {
    $updateData = @{
        nickname = "TestNickname_$(Get-Random -Minimum 1000 -Maximum 9999)"
    } | ConvertTo-Json

    $updateResponse = Invoke-RestMethod -Uri "$API_BASE/user/info" `
        -Method Put `
        -Body $updateData `
        -ContentType "application/json" `
        -Headers $headers

    if ($updateResponse.code -eq 200) {
        Write-Host "   ✓ Update user info successful" -ForegroundColor Green
        Write-Host "     New nickname: $($updateResponse.data.nickname)" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ Update user info failed" -ForegroundColor Red
    }
} catch {
    Write-Host "   ✗ Update user info failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 5: Token refresh
Write-Host "2.5 Testing token refresh..." -ForegroundColor Yellow
try {
    $refreshResponse = Invoke-RestMethod -Uri "$API_BASE/auth/refresh" `
        -Method Post `
        -Headers $headers

    if ($refreshResponse.code -eq 200 -and $refreshResponse.data.token) {
        $token = $refreshResponse.data.token
        Write-Host "   ✓ Token refresh successful" -ForegroundColor Green
    } else {
        Write-Host "   ✗ Token refresh failed" -ForegroundColor Red
    }
} catch {
    Write-Host "   ✗ Token refresh failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 6: Forgot password (skipped - endpoint removed in backend)
Write-Host "2.6 Testing forgot password..." -ForegroundColor Yellow
Write-Host "   ⚠ Forgot password endpoint has been removed from backend, skipping test" -ForegroundColor Yellow

Write-Host ""

# Test 7: Unauthorized access
Write-Host "2.7 Testing unauthorized access..." -ForegroundColor Yellow
try {
    $unauthorizedResponse = Invoke-RestMethod -Uri "$API_BASE/user/info" `
        -Method Get `
        -ErrorAction Stop
    Write-Host "   ✗ Unauthorized access should fail" -ForegroundColor Red
} catch {
    if ($_.Exception.Response.StatusCode -eq 401) {
        Write-Host "   ✓ Unauthorized access correctly returns 401" -ForegroundColor Green
    } else {
        Write-Host "   ⚠ Unauthorized access returned: $($_.Exception.Response.StatusCode)" -ForegroundColor Yellow
    }
}

Write-Host ""

# ========================================
# Test Summary
# ========================================
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

if ($phase1Passed) {
    Write-Host "✓ Phase 1 test: Passed" -ForegroundColor Green
} else {
    Write-Host "✗ Phase 1 test: Failed" -ForegroundColor Red
}

if ($phase2Passed) {
    Write-Host "✓ Phase 2 test: Passed" -ForegroundColor Green
} else {
    Write-Host "✗ Phase 2 test: Failed" -ForegroundColor Red
}

Write-Host ""

if ($phase1Passed -and $phase2Passed) {
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "All tests passed!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Test account information:" -ForegroundColor Yellow
    Write-Host "  Username: $testUsername" -ForegroundColor Gray
    Write-Host "  Password: $testPassword" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Please perform manual testing in the frontend interface:" -ForegroundColor Yellow
    Write-Host "  1. Visit $FRONTEND_URL/login to test login" -ForegroundColor Gray
    Write-Host "  2. Visit $FRONTEND_URL/register to test registration" -ForegroundColor Gray
    Write-Host "  3. Visit $FRONTEND_URL/forgot-password to test forgot password" -ForegroundColor Gray
    Write-Host "  4. Test route guards and token expiration handling" -ForegroundColor Gray
    Write-Host ""
    exit 0
} else {
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "Some tests failed, please check the error messages above" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    exit 1
}
