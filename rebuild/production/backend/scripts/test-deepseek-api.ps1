# DeepSeek API Connection Test Script
# Test if DeepSeek API configuration is correct

param(
    [string]$BaseUrl = "http://localhost:3000",
    [string]$RoomId = "",
    [string]$ApiKey = ""
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " DeepSeek API Connection Test " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Health check
Write-Host "1. Checking backend service status..." -ForegroundColor Yellow
try {
    $healthCheck = Invoke-RestMethod -Uri "$BaseUrl/health" -Method Get -TimeoutSec 5
    Write-Host "   [OK] Backend service is running" -ForegroundColor Green
} catch {
    Write-Host "   [FAIL] Backend service is not running, please start it first" -ForegroundColor Red
    Write-Host "   Start command: cd rebuild\production\backend && npm run dev" -ForegroundColor Gray
    exit 1
}

Write-Host ""

# 2. Test API connection
Write-Host "2. Testing DeepSeek API connection..." -ForegroundColor Yellow

$testBody = ""

if ($RoomId) {
    # Test using room ID
    Write-Host "   Using room ID: $RoomId" -ForegroundColor Gray
    $testBody = @{
        roomId = $RoomId
    } | ConvertTo-Json
} elseif ($ApiKey) {
    # Test with direct configuration
    Write-Host "   Testing with provided API Key" -ForegroundColor Gray
    $testBody = @{
        apiProvider = "deepseek"
        apiEndpoint = "https://api.deepseek.com/v1/chat/completions"
        apiHeaders = @{
            "Content-Type" = "application/json"
            "Authorization" = "Bearer $ApiKey"
        }
        apiBodyTemplate = @{
            model = "deepseek-chat"
            messages = @(
                @{
                    role = "system"
                    content = "You are a game inference engine. Generate game narratives and results based on player decisions and game rules."
                }
                @{
                    role = "user"
                    content = "{{prompt}}"
                }
            )
            temperature = 0.7
            max_tokens = 2000
        }
    } | ConvertTo-Json -Depth 10
} else {
    Write-Host "   [WARNING] No room ID or API Key provided" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Cyan
    Write-Host "  1. Test with room ID:" -ForegroundColor White
    Write-Host "     .\test-deepseek-api.ps1 -RoomId YOUR_ROOM_ID" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  2. Test with API Key directly:" -ForegroundColor White
    Write-Host "     .\test-deepseek-api.ps1 -ApiKey YOUR_API_KEY" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  3. Specify backend URL:" -ForegroundColor White
    Write-Host "     .\test-deepseek-api.ps1 -BaseUrl http://localhost:3000 -ApiKey YOUR_API_KEY" -ForegroundColor Gray
    exit 1
}

try {
    Write-Host "   Sending test request..." -ForegroundColor Gray
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/test/ai" -Method Post -Body $testBody -ContentType "application/json" -TimeoutSec 60
    
    if ($response.status -eq "ok") {
        Write-Host "   [OK] DeepSeek API connection successful!" -ForegroundColor Green
        Write-Host ""
        Write-Host "   Details:" -ForegroundColor Cyan
        Write-Host "   - Endpoint: $($response.endpoint)" -ForegroundColor White
        Write-Host "   - Provider: $($response.provider)" -ForegroundColor White
        Write-Host "   - Duration: $($response.duration)" -ForegroundColor White
        Write-Host "   - Response: $($response.response)" -ForegroundColor White
        Write-Host ""
        Write-Host "   [OK] API configuration is correct and ready to use!" -ForegroundColor Green
    } else {
        Write-Host "   [FAIL] API connection failed" -ForegroundColor Red
        Write-Host "   Status: $($response.status)" -ForegroundColor Yellow
        Write-Host "   Message: $($response.message)" -ForegroundColor Yellow
        if ($response.hint) {
            Write-Host "   Hint: $($response.hint)" -ForegroundColor Yellow
        }
        exit 1
    }
} catch {
    Write-Host "   [FAIL] Test failed" -ForegroundColor Red
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    
    # Try to parse error response
    if ($_.Exception.Response) {
        try {
            $errorStream = $_.Exception.Response.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($errorStream)
            $errorBody = $reader.ReadToEnd() | ConvertFrom-Json
            $reader.Close()
            $errorStream.Close()
            
            Write-Host ""
            Write-Host "   Error Details:" -ForegroundColor Yellow
            Write-Host "   - Status: $($errorBody.status)" -ForegroundColor White
            Write-Host "   - Message: $($errorBody.message)" -ForegroundColor White
            if ($errorBody.errorType) {
                Write-Host "   - Error Type: $($errorBody.errorType)" -ForegroundColor White
            }
            if ($errorBody.hint) {
                Write-Host "   - Hint: $($errorBody.hint)" -ForegroundColor White
            }
        } catch {
            Write-Host "   (Could not parse error response)" -ForegroundColor Gray
        }
    }
    
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host " Test Completed " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
