# All Phases Combined Test Script (PowerShell)
# Runs all test phases from Phase 1/2 through Phase 15
# Order: Phase 1/2 -> Phase 3 -> Phase 4 -> ... -> Phase 15
$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "All Phases Combined Test (Phase 1-15)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Set environment variables for tests that need them (e.g., Phase 6)
if (-not $env:ADMIN_USERNAME) {
  $env:ADMIN_USERNAME = 'developer'
}
if (-not $env:ADMIN_DEFAULT_PASSWORD) {
  $env:ADMIN_DEFAULT_PASSWORD = "000000"
}
Write-Host "Environment variables set:" -ForegroundColor Gray
Write-Host "  ADMIN_USERNAME: $env:ADMIN_USERNAME" -ForegroundColor Gray
Write-Host "  ADMIN_DEFAULT_PASSWORD: $env:ADMIN_DEFAULT_PASSWORD" -ForegroundColor Gray
Write-Host ""

$scriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$parentDir  = Split-Path $scriptRoot -Parent

# Define all test phases in order
$phase1_2    = Join-Path $scriptRoot "test-phase1-2.ps1"
# Find phase scripts by name under the parent directory
$phase3     = Get-ChildItem -Path $parentDir -Recurse -Filter "test-phase3.ps1" | Select-Object -First 1 -ExpandProperty FullName
$phase4     = Get-ChildItem -Path $parentDir -Recurse -Filter "test-phase4.ps1" | Select-Object -First 1 -ExpandProperty FullName
$phase5     = Get-ChildItem -Path $parentDir -Recurse -Filter "test-phase5.ps1" | Select-Object -First 1 -ExpandProperty FullName
$phase6     = Get-ChildItem -Path $parentDir -Recurse -Filter "test-phase6.ps1" | Select-Object -First 1 -ExpandProperty FullName
$phase7     = Get-ChildItem -Path $parentDir -Recurse -Filter "test-phase7.ps1" | Select-Object -First 1 -ExpandProperty FullName
$phase8     = Get-ChildItem -Path $parentDir -Recurse -Filter "test-phase8.ps1" | Select-Object -First 1 -ExpandProperty FullName
$phase9     = Get-ChildItem -Path $parentDir -Recurse -Filter "test-phase9.ps1" | Select-Object -First 1 -ExpandProperty FullName
$phase10    = Get-ChildItem -Path $parentDir -Recurse -Filter "test-phase10.ps1" | Select-Object -First 1 -ExpandProperty FullName
$phase11    = Get-ChildItem -Path $parentDir -Recurse -Filter "test-phase11.ps1" | Select-Object -First 1 -ExpandProperty FullName
$phase12    = Get-ChildItem -Path $parentDir -Recurse -Filter "test-phase12.ps1" | Select-Object -First 1 -ExpandProperty FullName
$phase13    = Get-ChildItem -Path $parentDir -Recurse -Filter "test-phase13.ps1" | Select-Object -First 1 -ExpandProperty FullName
$phase14    = Get-ChildItem -Path $parentDir -Recurse -Filter "test-phase14.ps1" | Select-Object -First 1 -ExpandProperty FullName
$phase15    = Get-ChildItem -Path $parentDir -Recurse -Filter "test-phase15.ps1" | Select-Object -First 1 -ExpandProperty FullName

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
        $tempScript = Join-Path $env:TEMP "phase-wrapper-$(Get-Random).ps1"
        
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

# Define all phases with labels and paths
$phaseLabels = @(
    "Phase 1/2 Continuous Test (Foundation + Auth)",
    "Phase 3 Room Basic Flow Test",
    "Phase 4 WebSocket Minimal Real-time Subsystem",
    "Phase 5 Host Configuration",
    "Phase 6 Game Core Decision Flow",
    "Phase 7 Host Review Functionality",
    "Phase 8 AI Inference Engine Integration",
    "Phase 9 Multi-round Event Progress Tracking",
    "Phase 10 Game State Management",
    "Phase 11 Game History",
    "Phase 12 Trade System",
    "Phase 13 Game Save/Restore",
    "Phase 14 Game History Detail",
    "Phase 15 (Final Phase)"
)

$phasePaths = @($phase1_2, $phase3, $phase4, $phase5, $phase6, $phase7, $phase8, $phase9, $phase10, $phase11, $phase12, $phase13, $phase14, $phase15)

# Track statistics
$totalPhases = $phaseLabels.Length
$passedPhases = 0
$failedPhases = 0
$skippedPhases = 0
$startTime = Get-Date

Write-Host "Starting test execution at: $startTime" -ForegroundColor Gray
Write-Host "Total phases to run: $totalPhases" -ForegroundColor Gray
Write-Host ""

# Execute all phase scripts sequentially
for ($i = 0; $i -lt $phaseLabels.Length; $i++) {
    $label = $phaseLabels[$i]
    $path  = $phasePaths[$i]

    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "[$($i + 1)/$totalPhases] $label" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan

    if (-not $path -or -not (Test-Path $path)) {
        Write-Host "⚠ Script not found: $path" -ForegroundColor Yellow
        Write-Host "  Skipping this phase..." -ForegroundColor Yellow
        $skippedPhases++
        Write-Host ""
        continue
    }

    Write-Host "Script path: $path" -ForegroundColor Gray
    Write-Host ""
    
    # For Phase 6, pass environment variables explicitly
    $isPhase6 = ($i -eq 4)  # Phase 6 is index 4 (0-based)
    if ($isPhase6 -and $env:ADMIN_USERNAME) {
        Write-Host "  Passing environment variables to Phase 6..." -ForegroundColor Gray
    }
    
    $phaseStartTime = Get-Date
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
        $phaseDuration = (Get-Date) - $phaseStartTime
        
        if ($exitCodeInt -ne 0) {
            Write-Host "✗ $label failed (exit code $exitCodeInt)" -ForegroundColor Red
            Write-Host "  Duration: $($phaseDuration.TotalSeconds.ToString('F2')) seconds" -ForegroundColor Gray
            Write-Host "  For detailed error information, run the test script directly:" -ForegroundColor Yellow
            Write-Host "    $path" -ForegroundColor Gray
            $failedPhases++
            
            # Ask user if they want to continue
            Write-Host ""
            Write-Host "Phase failed. Options:" -ForegroundColor Yellow
            Write-Host "  [C]ontinue to next phase" -ForegroundColor Gray
            Write-Host "  [S]top and exit" -ForegroundColor Gray
            Write-Host "  [R]etry this phase" -ForegroundColor Gray
            $choice = Read-Host "Your choice (C/S/R, default: C)"
            
            if ($choice -eq 'S' -or $choice -eq 's') {
                Write-Host "Test execution stopped by user." -ForegroundColor Yellow
                exit $exitCodeInt
            } elseif ($choice -eq 'R' -or $choice -eq 'r') {
                Write-Host "Retrying phase..." -ForegroundColor Yellow
                $i--  # Retry this phase
                continue
            }
        } else {
            Write-Host "✔ $label passed" -ForegroundColor Green
            Write-Host "  Duration: $($phaseDuration.TotalSeconds.ToString('F2')) seconds" -ForegroundColor Gray
            $passedPhases++
        }
    } catch {
        $phaseDuration = (Get-Date) - $phaseStartTime
        Write-Host "✗ $label failed with exception: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "  Duration: $($phaseDuration.TotalSeconds.ToString('F2')) seconds" -ForegroundColor Gray
        Write-Host "  For detailed error information, run the test script directly:" -ForegroundColor Yellow
        Write-Host "    $path" -ForegroundColor Gray
        $failedPhases++
        
        # Ask user if they want to continue
        Write-Host ""
        Write-Host "Phase failed with exception. Options:" -ForegroundColor Yellow
        Write-Host "  [C]ontinue to next phase" -ForegroundColor Gray
        Write-Host "  [S]top and exit" -ForegroundColor Gray
        $choice = Read-Host "Your choice (C/S, default: C)"
        
        if ($choice -eq 'S' -or $choice -eq 's') {
            Write-Host "Test execution stopped by user." -ForegroundColor Yellow
            exit 1
        }
    }
    Write-Host ""
}

# Calculate total duration
$endTime = Get-Date
$totalDuration = $endTime - $startTime

# Print summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Execution Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Total phases:     $totalPhases" -ForegroundColor White
Write-Host "Passed:           $passedPhases" -ForegroundColor Green
Write-Host "Failed:           $failedPhases" -ForegroundColor $(if ($failedPhases -eq 0) { "Green" } else { "Red" })
Write-Host "Skipped:          $skippedPhases" -ForegroundColor Yellow
Write-Host "Total duration:   $($totalDuration.TotalMinutes.ToString('F2')) minutes" -ForegroundColor White
Write-Host "Start time:       $startTime" -ForegroundColor Gray
Write-Host "End time:         $endTime" -ForegroundColor Gray
Write-Host "========================================" -ForegroundColor Cyan

if ($failedPhases -eq 0 -and $skippedPhases -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "All phases tests passed successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    exit 0
} elseif ($failedPhases -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Yellow
    Write-Host "All executed phases passed (some were skipped)." -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Yellow
    exit 0
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "Some phases failed. Please review the errors above." -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    exit 1
}

