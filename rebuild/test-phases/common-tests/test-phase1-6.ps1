# First Six Phases Combined Test Script (PowerShell)
# Order: Phase 1/2 -> Phase 3 -> Phase 4 -> Phase 5 -> Phase 6 (Game Core Decision Flow)
$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "First Six Phases Combined Test" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set environment variables for Phase 6 test (developer account)
# Default username is 'developer'
if (-not $env:ADMIN_USERNAME) {
  $env:ADMIN_USERNAME = 'developer'
}
if (-not $env:ADMIN_DEFAULT_PASSWORD) {
  $env:ADMIN_DEFAULT_PASSWORD = "000000"
}
Write-Host "Environment variables set for Phase 6:" -ForegroundColor Gray
Write-Host "  ADMIN_USERNAME: $env:ADMIN_USERNAME" -ForegroundColor Gray
Write-Host "  ADMIN_DEFAULT_PASSWORD: $env:ADMIN_DEFAULT_PASSWORD" -ForegroundColor Gray
Write-Host ""

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$parentDir  = Split-Path $scriptRoot -Parent

$phase12    = Join-Path $scriptRoot "test-phase1-2.ps1"
# Find phase scripts by name under the parent directory to avoid hard-coding Chinese folder names
$phase3     = Get-ChildItem -Path $parentDir -Recurse -Filter "test-phase3.ps1" | Select-Object -First 1 -ExpandProperty FullName
$phase4     = Get-ChildItem -Path $parentDir -Recurse -Filter "test-phase4.ps1" | Select-Object -First 1 -ExpandProperty FullName
$phase5     = Get-ChildItem -Path $parentDir -Recurse -Filter "test-phase5.ps1" | Select-Object -First 1 -ExpandProperty FullName
$phase6     = Get-ChildItem -Path $parentDir -Recurse -Filter "test-phase6.ps1" | Select-Object -First 1 -ExpandProperty FullName

function Invoke-TestScript {
    param(
        [string]$path,
        [switch]$passEnvVars
    )
    $runner = Get-Command pwsh -ErrorAction SilentlyContinue
    if (-not $runner) {
        $runner = Get-Command powershell -ErrorAction SilentlyContinue
    }
    if (-not $runner) {
        Write-Host "✗ No available PowerShell executable found (pwsh/powershell)." -ForegroundColor Red
        exit 1
    }

    if ($passEnvVars -and $env:ADMIN_USERNAME) {
        # Pass environment variables using a wrapper script file with Base64 encoding
        # This method safely handles UTF-8 characters including Chinese
        $tempScript = Join-Path $env:TEMP "phase6-wrapper-$(Get-Random).ps1"
        
        # Encode username to Base64 for safe storage in script
        $usernameBytes = [System.Text.Encoding]::UTF8.GetBytes($env:ADMIN_USERNAME)
        $usernameBase64 = [System.Convert]::ToBase64String($usernameBytes)
        $passwordValue = if ($env:ADMIN_DEFAULT_PASSWORD) { $env:ADMIN_DEFAULT_PASSWORD } else { "000000" }
        
        # Escape path for use in script (replace single quotes)
        $escapedPath = $path -replace "'", "''"
        
        # Create wrapper script content
        $wrapperContent = @"
# Temporary wrapper script to pass environment variables
`$bytes = [System.Convert]::FromBase64String('$usernameBase64')
`$env:ADMIN_USERNAME = [System.Text.Encoding]::UTF8.GetString(`$bytes)
`$env:ADMIN_DEFAULT_PASSWORD = '$passwordValue'
& '$escapedPath'
exit `$LASTEXITCODE
"@
        
        # Write wrapper script with UTF-8 encoding (no BOM for compatibility)
        $utf8NoBom = New-Object System.Text.UTF8Encoding $false
        [System.IO.File]::WriteAllText($tempScript, $wrapperContent, $utf8NoBom)
        
        try {
            & $runner.Source -NoLogo -NoProfile -ExecutionPolicy Bypass -File $tempScript
            $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { $LASTEXITCODE }
        } catch {
            # If exception occurs, exit code should be non-zero
            $exitCode = 1
            throw
        } finally {
            # Clean up temporary script
            if (Test-Path $tempScript) {
                Remove-Item $tempScript -Force -ErrorAction SilentlyContinue
            }
        }
        return [int]$exitCode
    } else {
        # Normal execution without environment variables
        try {
            & $runner.Source -NoLogo -NoProfile -ExecutionPolicy Bypass -File $path
            $exitCode = if ($null -eq $LASTEXITCODE) { 0 } else { $LASTEXITCODE }
        } catch {
            # If exception occurs, exit code should be non-zero
            $exitCode = 1
            throw
        }
        return [int]$exitCode
    }
}

# Execute six phase scripts sequentially (avoid custom functions to prevent function scope issues)
$phaseLabels = @(
    "Phase 1/2 Continuous Test",
    "Phase 3 Room Basic Flow Test",
    "Phase 4 WebSocket Minimal Real-time Subsystem",
    "Phase 5 Host Configuration",
    "Phase 6 Game Core Decision Flow"
)

$phasePaths = @($phase12, $phase3, $phase4, $phase5, $phase6)

for ($i = 0; $i -lt $phaseLabels.Length; $i++) {
    $label = $phaseLabels[$i]
    $path  = $phasePaths[$i]

    if (-not (Test-Path $path)) {
        Write-Host "✗ Script not found: $path" -ForegroundColor Red
        exit 1
    }

    Write-Host "=== Starting $label ===" -ForegroundColor Magenta
    
    # For Phase 6, pass environment variables explicitly
    $isPhase6 = ($i -eq ($phaseLabels.Length - 1))
    if ($isPhase6 -and $env:ADMIN_USERNAME) {
        Write-Host "  Passing environment variables to Phase 6..." -ForegroundColor Gray
    }
    
    try {
        $exitCode = Invoke-TestScript -path $path -passEnvVars:$isPhase6
        
        # Ensure exitCode is an integer
        if ($exitCode -is [array]) { 
            $exitCode = if ($exitCode.Length -gt 0) { $exitCode[-1] } else { 0 }
        }
        if ($null -eq $exitCode) {
            $exitCode = 0
        }
        
        $exitCodeInt = [int]$exitCode
        
        if ($exitCodeInt -ne 0) {
            Write-Host "✗ $label failed (exit code $exitCodeInt), subsequent phases aborted" -ForegroundColor Red
            Write-Host "  For detailed error information, run the test script directly:" -ForegroundColor Yellow
            Write-Host "    $path" -ForegroundColor Gray
            exit $exitCodeInt
        }
    } catch {
        Write-Host "✗ $label failed with exception: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "  For detailed error information, run the test script directly:" -ForegroundColor Yellow
        Write-Host "    $path" -ForegroundColor Gray
        exit 1
    }
    Write-Host "=== Completed $label ===" -ForegroundColor Magenta
    Write-Host ""
}

Write-Host "========================================" -ForegroundColor Green
Write-Host "All first six phases tests passed." -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green


