# Environment configuration quick setup script
# Used to create .env file (if it doesn't exist)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Environment Configuration Quick Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$envFile = ".env"
$envExample = ".env.example"

# Check if .env file exists
if (Test-Path $envFile) {
    Write-Host "[OK] .env file already exists, skipping creation" -ForegroundColor Green
    Write-Host ""
    # Validate .env file format and DATABASE_URL
    try {
        $envContent = Get-Content $envFile -Raw
        # Check for common issues: unmatched quotes, invalid characters
        if ($envContent -match '\\"[^"]*$' -or $envContent -match '[^=]"[^=]*"[^=]') {
            Write-Host "[WARN] .env file may have formatting issues. If Docker fails, try deleting .env and re-running this script." -ForegroundColor Yellow
        }
        # Check DATABASE_URL format
        if ($envContent -match 'DATABASE_URL\s*=') {
            $dbUrlMatch = [regex]::Match($envContent, 'DATABASE_URL\s*=\s*"([^"]+)"')
            if ($dbUrlMatch.Success) {
                $dbUrl = $dbUrlMatch.Groups[1].Value
                if ($dbUrl -notmatch 'postgresql://game_user:game_password@localhost:5432/game_db') {
                    Write-Host "[WARN] DATABASE_URL does not match expected format." -ForegroundColor Yellow
                    Write-Host "  Expected: postgresql://game_user:game_password@localhost:5432/game_db?schema=public" -ForegroundColor Gray
                    Write-Host "  Found: $dbUrl" -ForegroundColor Gray
                }
            }
        }
    } catch {
        Write-Host "[WARN] Could not validate .env file format." -ForegroundColor Yellow
    }
    exit 0
}

# If .env.example exists, use it as template
if (Test-Path $envExample) {
    Write-Host "[OK] Found .env.example template file" -ForegroundColor Green
    Write-Host ""
}

# Check if docker-compose.yml exists
$useDocker = $false
if (Test-Path "docker-compose.yml") {
    $useDocker = $true
    Write-Host "[OK] Detected docker-compose.yml, will use Docker configuration" -ForegroundColor Green
}

Write-Host ""
Write-Host "Creating .env file..." -ForegroundColor Yellow

# Generate JWT Secret (random string)
$jwtSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })
$jwtRefreshSecret = -join ((48..57) + (65..90) + (97..122) | Get-Random -Count 32 | ForEach-Object { [char]$_ })

# Create .env file content
# If .env.example exists, read it as template first
if (Test-Path $envExample) {
    Write-Host "Creating .env file from .env.example..." -ForegroundColor DarkGray
    $envContent = Get-Content $envExample -Raw
    
    # Replace JWT Secret (if template has placeholders)
    $envContent = $envContent -replace 'JWT_SECRET="your-secret-key-change-this-in-production"', "JWT_SECRET=`"$jwtSecret`""
    $envContent = $envContent -replace 'JWT_REFRESH_SECRET="your-refresh-secret-key-change-this-in-production"', "JWT_REFRESH_SECRET=`"$jwtRefreshSecret`""
}
else {
    # If no .env.example, use default configuration
    $envContent = @"
# Database configuration
DATABASE_URL="postgresql://game_user:game_password@localhost:5432/game_db?schema=public"

# Redis configuration
REDIS_URL="redis://localhost:6379"

# Server configuration
PORT=3000
NODE_ENV=development

# JWT configuration (auto-generated)
JWT_SECRET="$jwtSecret"
JWT_REFRESH_SECRET="$jwtRefreshSecret"
JWT_EXPIRES_IN="1h"
JWT_REFRESH_EXPIRES_IN="7d"

# Frontend URL
FRONTEND_URL="http://localhost:5173"

# Password reset configuration
RESET_PASSWORD_TOKEN_EXPIRES_IN="1h"

# File upload configuration
UPLOAD_DIR="./uploads"
MAX_FILE_SIZE=5242880

# Admin account configuration (optional)
ADMIN_USERNAME="developer"
ADMIN_DEFAULT_PASSWORD="000000"
"@
}

# Write to file
# Ensure proper line endings and encoding (UTF-8 without BOM)
$envFilePath = Join-Path (Get-Location) $envFile
$utf8NoBom = New-Object System.Text.UTF8Encoding $false
# Normalize line endings to CRLF for Windows compatibility
$lines = $envContent -split "`r?`n"
$cleanContent = $lines -join "`r`n"
[System.IO.File]::WriteAllText($envFilePath, $cleanContent, $utf8NoBom)

Write-Host "[OK] .env file created" -ForegroundColor Green
Write-Host ""

# Check Docker container status
if ($useDocker) {
    Write-Host "Checking Docker container status..." -ForegroundColor Yellow
    $containers = docker ps -a --format "{{.Names}}" 2>$null
    
    if ($containers -match "game-postgres") {
        $postgresRunning = docker ps --format "{{.Names}}" | Select-String "game-postgres"
        if ($postgresRunning) {
            Write-Host "[OK] PostgreSQL container is running" -ForegroundColor Green
        }
        else {
            Write-Host "[WARN] PostgreSQL container exists but is not running" -ForegroundColor Yellow
            Write-Host "  Start command: docker-compose up -d postgres" -ForegroundColor Gray
        }
    }
    else {
        Write-Host "[WARN] PostgreSQL container does not exist" -ForegroundColor Yellow
        Write-Host "  Start command: docker-compose up -d postgres" -ForegroundColor Gray
    }
    
    if ($containers -match "game-redis") {
        $redisRunning = docker ps --format "{{.Names}}" | Select-String "game-redis"
        if ($redisRunning) {
            Write-Host "[OK] Redis container is running" -ForegroundColor Green
        }
        else {
            Write-Host "[WARN] Redis container exists but is not running" -ForegroundColor Yellow
            Write-Host "  Start command: docker-compose up -d redis" -ForegroundColor Gray
        }
    }
    else {
        Write-Host "[WARN] Redis container does not exist (optional)" -ForegroundColor Yellow
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Next Steps" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Start database service (if using Docker):" -ForegroundColor Yellow
Write-Host "   docker-compose up -d postgres redis" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Run database migration:" -ForegroundColor Yellow
Write-Host "   npm run prisma:migrate" -ForegroundColor Gray
Write-Host ""
Write-Host "3. Verify configuration:" -ForegroundColor Yellow
Write-Host "   npm run check:db" -ForegroundColor Gray
Write-Host ""
Write-Host "4. Re-run tests:" -ForegroundColor Yellow
Write-Host "   cd ../../test-phases/common-tests" -ForegroundColor Gray
Write-Host "   .\test-phase1-2.ps1" -ForegroundColor Gray
Write-Host ""

