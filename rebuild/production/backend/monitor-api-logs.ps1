# Real-time API log monitoring script
# Usage: .\monitor-api-logs.ps1

$logFile = Join-Path $PSScriptRoot "logs\combined.log"

if (-not (Test-Path $logFile)) {
    Write-Host "Log file not found: $logFile" -ForegroundColor Red
    Write-Host "Please ensure the backend service is running" -ForegroundColor Yellow
    exit 1
}

Write-Host ("=" * 70) -ForegroundColor Cyan
Write-Host "Real-time API Log Monitoring" -ForegroundColor Green
Write-Host "Log file: $logFile" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop monitoring" -ForegroundColor Gray
Write-Host ("=" * 70) -ForegroundColor Cyan
Write-Host ""

# Show last 20 relevant log lines
$lastLines = Get-Content $logFile -Tail 50 | Where-Object { 
    $_ -match "AI|inference|API|prompt|Submitting|Starting|Calling|completed|failed|decision|Decision" 
} | Select-Object -Last 20

if ($lastLines) {
    Write-Host "Recent logs:" -ForegroundColor Yellow
    foreach ($line in $lastLines) {
        $color = if ($line -match "error|failed") { "Red" }
                 elseif ($line -match "success|completed") { "Green" }
                 elseif ($line -match "warn") { "Yellow" }
                 else { "White" }
        Write-Host $line -ForegroundColor $color
    }
    Write-Host ""
}

Write-Host "Starting real-time monitoring..." -ForegroundColor Green
Write-Host ""

# Real-time monitoring
Get-Content $logFile -Wait -Tail 0 | ForEach-Object {
    if ($_ -match "AI|inference|API|prompt|Submitting|Starting|Calling|completed|failed|error|decision|Decision|submitted|submission") {
        $color = if ($_ -match "error|failed") { "Red" }
                 elseif ($_ -match "success|completed") { "Green" }
                 elseif ($_ -match "warn") { "Yellow" }
                 elseif ($_ -match "info") { "Cyan" }
                 else { "White" }
        
        $timestamp = Get-Date -Format "HH:mm:ss"
        Write-Host "[$timestamp] " -NoNewline -ForegroundColor Gray
        Write-Host $_ -ForegroundColor $color
    }
}
