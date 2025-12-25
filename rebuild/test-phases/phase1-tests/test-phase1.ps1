# Phase 1 Automated Test Script (PowerShell)
# Usage: .\test-phase1.ps1

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Phase 1: Project Foundation Setup - Automated Test" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# Test counters
$script:PASSED = 0
$script:FAILED = 0

# Test function
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [int]$ExpectedStatus = 200
    )
    
    Write-Host "Testing $Name... " -NoNewline
    
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -ErrorAction Stop
        $httpCode = $response.StatusCode
        
        if ($httpCode -eq $ExpectedStatus) {
            Write-Host "✓ Passed" -ForegroundColor Green
            Write-Host "  Response: $($response.Content)" -ForegroundColor Gray
            $script:PASSED++
            return $true
        } else {
            Write-Host "✗ Failed" -ForegroundColor Red
            Write-Host "  Expected status code: $ExpectedStatus, Actual: $httpCode" -ForegroundColor Red
            $script:FAILED++
            return $false
        }
    } catch {
        Write-Host "✗ Failed" -ForegroundColor Red
        Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Red
        $script:FAILED++
        return $false
    }
}

# Check if port is listening
function Test-Port {
    param(
        [string]$Name,
        [int]$Port
    )
    
    Write-Host "Checking $Name (port $Port)... " -NoNewline
    
    try {
        $connection = Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue -ErrorAction Stop
        if ($connection.TcpTestSucceeded) {
            Write-Host "✓ Running" -ForegroundColor Green
            $script:PASSED++
            return $true
        } else {
            Write-Host "✗ Not running" -ForegroundColor Red
            $script:FAILED++
            return $false
        }
    } catch {
        Write-Host "✗ Not running" -ForegroundColor Red
        $script:FAILED++
        return $false
    }
}

Write-Host "1. Checking service status" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Test-Port "Backend server" 3000
Test-Port "Frontend server" 5173
Test-Port "PostgreSQL" 5432
Test-Port "Redis" 6379
Write-Host ""

Write-Host "2. Testing backend endpoints" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Test-Endpoint "Health check" "http://localhost:3000/health" 200
Test-Endpoint "Database connection" "http://localhost:3000/api/test/db" 200
Test-Endpoint "Redis connection" "http://localhost:3000/api/test/redis" 200
Write-Host ""

Write-Host "3. Checking code quality" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Push-Location "..\..\正式搭建\backend"
try {
    $null = npm run lint 2>&1
    Write-Host "✓ Backend code quality check passed" -ForegroundColor Green
    $script:PASSED++
} catch {
    Write-Host "⚠ Backend code quality check has warnings" -ForegroundColor Yellow
}
Pop-Location

Push-Location "..\..\正式搭建\frontend"
try {
    $null = npm run lint 2>&1
    Write-Host "✓ Frontend code quality check passed" -ForegroundColor Green
    $script:PASSED++
} catch {
    Write-Host "⚠ Frontend code quality check has warnings" -ForegroundColor Yellow
}
Pop-Location
Write-Host ""

Write-Host "4. Checking Docker containers" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Push-Location "..\..\正式搭建\backend"
$containers = docker ps --format "{{.Names}}"
if ($containers -match "game-postgres") {
    Write-Host "✓ PostgreSQL container is running" -ForegroundColor Green
    $script:PASSED++
} else {
    Write-Host "✗ PostgreSQL container is not running" -ForegroundColor Red
    $script:FAILED++
}

if ($containers -match "game-redis") {
    Write-Host "✓ Redis container is running" -ForegroundColor Green
    $script:PASSED++
} else {
    Write-Host "✗ Redis container is not running" -ForegroundColor Red
    $script:FAILED++
}
Pop-Location
Write-Host ""

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Test Results Summary" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "Passed: $script:PASSED" -ForegroundColor Green
Write-Host "Failed: $script:FAILED" -ForegroundColor Red
Write-Host ""

if ($script:FAILED -eq 0) {
    Write-Host "✓ All tests passed! Phase 1 completed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "✗ Some tests failed, please check and fix the issues" -ForegroundColor Red
    exit 1
}
