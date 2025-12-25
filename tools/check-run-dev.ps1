# Quick diagnostic script to check why run-dev.bat might not work

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Run-Dev Diagnostic Check" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Check 1: PowerShell execution policy
Write-Host "1. Checking PowerShell execution policy..." -ForegroundColor Yellow
$execPolicy = Get-ExecutionPolicy
Write-Host "   Current policy: $execPolicy" -ForegroundColor $(if ($execPolicy -eq "Restricted") { "Red" } else { "Green" })
if ($execPolicy -eq "Restricted") {
    Write-Host "   WARNING: Execution policy is Restricted. This may prevent scripts from running." -ForegroundColor Yellow
    Write-Host "   Solution: Run as Administrator: Set-ExecutionPolicy RemoteSigned" -ForegroundColor Gray
}
Write-Host ""

# Check 2: File existence
Write-Host "2. Checking required files..." -ForegroundColor Yellow
$scriptPath = Join-Path $PSScriptRoot "..\tools\run-dev.ps1"
$batPath = Join-Path $PSScriptRoot "..\run-dev.bat"

if (Test-Path $scriptPath) {
    Write-Host "   [OK] run-dev.ps1 exists: $scriptPath" -ForegroundColor Green
} else {
    Write-Host "   [FAIL] run-dev.ps1 not found: $scriptPath" -ForegroundColor Red
}

if (Test-Path $batPath) {
    Write-Host "   [OK] run-dev.bat exists: $batPath" -ForegroundColor Green
} else {
    Write-Host "   [FAIL] run-dev.bat not found: $batPath" -ForegroundColor Red
}
Write-Host ""

# Check 3: Node.js
Write-Host "3. Checking Node.js..." -ForegroundColor Yellow
try {
    $nodeVersion = node -v 2>&1
    Write-Host "   [OK] Node.js version: $nodeVersion" -ForegroundColor Green
} catch {
    Write-Host "   [FAIL] Node.js not found. Please install Node.js >= 18" -ForegroundColor Red
}
Write-Host ""

# Check 4: Docker (optional)
Write-Host "4. Checking Docker (optional)..." -ForegroundColor Yellow
try {
    $dockerVersion = docker --version 2>&1
    Write-Host "   [OK] Docker: $dockerVersion" -ForegroundColor Green
} catch {
    Write-Host "   [WARN] Docker not found (optional, but needed for database)" -ForegroundColor Yellow
}
Write-Host ""

# Check 5: Directory structure
Write-Host "5. Checking directory structure..." -ForegroundColor Yellow
$rootDir = Split-Path -Parent $PSScriptRoot
$backendPath = Join-Path $rootDir "rebuild\production\backend"
$frontendPath = Join-Path $rootDir "rebuild\production\frontend"

if (Test-Path $backendPath) {
    Write-Host "   [OK] Backend directory exists: $backendPath" -ForegroundColor Green
} else {
    Write-Host "   [FAIL] Backend directory not found: $backendPath" -ForegroundColor Red
}

if (Test-Path $frontendPath) {
    Write-Host "   [OK] Frontend directory exists: $frontendPath" -ForegroundColor Green
} else {
    Write-Host "   [FAIL] Frontend directory not found: $frontendPath" -ForegroundColor Red
}
Write-Host ""

# Check 6: Try to run the script
Write-Host "6. Testing script execution..." -ForegroundColor Yellow
if (Test-Path $scriptPath) {
    try {
        Write-Host "   Attempting to load script..." -ForegroundColor Gray
        $scriptContent = Get-Content $scriptPath -Raw -ErrorAction Stop
        Write-Host "   [OK] Script file can be read" -ForegroundColor Green
    } catch {
        Write-Host "   [FAIL] Cannot read script file: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "   [SKIP] Script file not found" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Diagnostic Complete" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "If all checks pass, try running:" -ForegroundColor Yellow
Write-Host "  .\run-dev.bat" -ForegroundColor White
Write-Host ""
Write-Host "Or directly:" -ForegroundColor Yellow
Write-Host "  powershell -ExecutionPolicy Bypass -File .\tools\run-dev.ps1" -ForegroundColor White
Write-Host ""


