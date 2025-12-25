# Phase 2 Test Script (PowerShell)
# Tests user authentication system

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Phase 2 Test: User Authentication System" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$API_BASE = "http://localhost:3000/api"
$FRONTEND_URL = "http://localhost:5173"

# Check service status
Write-Host "1. Checking service status..." -ForegroundColor Yellow

try {
    $healthCheck = Invoke-RestMethod -Uri "$API_BASE/../health" -Method Get -TimeoutSec 5
    Write-Host "   ✓ Backend service is running normally" -ForegroundColor Green
} catch {
    Write-Host "   ✗ Backend service is not running, please start it first" -ForegroundColor Red
    exit 1
}

try {
    $frontendCheck = Invoke-WebRequest -Uri $FRONTEND_URL -Method Get -TimeoutSec 5 -UseBasicParsing
    Write-Host "   ✓ Frontend service is running normally" -ForegroundColor Green
} catch {
    Write-Host "   ⚠ Frontend service is not running (optional)" -ForegroundColor Yellow
}

Write-Host ""

# Test data
$testUsername = "testuser_$(Get-Random -Minimum 1000 -Maximum 9999)"
$testEmail = "test_$(Get-Random -Minimum 1000 -Maximum 9999)@example.com"
$testPassword = "password123"
$token = $null

# Test 1: User registration
Write-Host "2. Testing user registration..." -ForegroundColor Yellow
try {
    $registerData = @{
        username = $testUsername
        email = $testEmail
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
        Write-Host "     Email: $testEmail" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ Registration failed: $($registerResponse.message)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   ✗ Registration failed: $($_.Exception.Message)" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $responseBody = $reader.ReadToEnd()
        Write-Host "     Response: $responseBody" -ForegroundColor Gray
    }
    exit 1
}

Write-Host ""

# Test 2: User login
Write-Host "3. Testing user login..." -ForegroundColor Yellow
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
        exit 1
    }
} catch {
    Write-Host "   ✗ Login failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 3: Get user info
Write-Host "4. Testing get user info..." -ForegroundColor Yellow
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
        Write-Host "     Email: $($userInfoResponse.data.email)" -ForegroundColor Gray
    } else {
        Write-Host "   ✗ Get user info failed" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "   ✗ Get user info failed: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 4: Update user info
Write-Host "5. Testing update user info..." -ForegroundColor Yellow
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
Write-Host "6. Testing token refresh..." -ForegroundColor Yellow
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

# Test 6: Forgot password
Write-Host "7. Testing forgot password..." -ForegroundColor Yellow
try {
    $forgotPasswordData = @{
        email = $testEmail
    } | ConvertTo-Json

    $forgotPasswordResponse = Invoke-RestMethod -Uri "$API_BASE/auth/forgot-password" `
        -Method Post `
        -Body $forgotPasswordData `
        -ContentType "application/json"

    if ($forgotPasswordResponse.code -eq 200) {
        Write-Host "   ✓ Forgot password request successful" -ForegroundColor Green
        if ($forgotPasswordResponse.resetToken) {
            Write-Host "     Reset Token: $($forgotPasswordResponse.resetToken)" -ForegroundColor Gray
        }
    } else {
        Write-Host "   ✗ Forgot password request failed" -ForegroundColor Red
    }
} catch {
    Write-Host "   ✗ Forgot password request failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 7: Unauthorized access
Write-Host "8. Testing unauthorized access..." -ForegroundColor Yellow
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

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test completed!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Test account information:" -ForegroundColor Yellow
Write-Host "  Username: $testUsername" -ForegroundColor Gray
Write-Host "  Email: $testEmail" -ForegroundColor Gray
Write-Host "  Password: $testPassword" -ForegroundColor Gray
Write-Host ""
Write-Host "Please perform manual testing in the frontend interface:" -ForegroundColor Yellow
Write-Host "  1. Visit $FRONTEND_URL/login to test login" -ForegroundColor Gray
Write-Host "  2. Visit $FRONTEND_URL/register to test registration" -ForegroundColor Gray
Write-Host "  3. Test route guards and token expiration handling" -ForegroundColor Gray
Write-Host ""
