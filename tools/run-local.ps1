<# 
  本地开发模式启动器 - 使用 localhost
  Located in tools/run-local.ps1
#>

param()

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "DEV LAUNCHER: 本地开发模式 (localhost)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Locate backend/frontend directories
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$RootDir = Split-Path -Parent $ScriptDir
$BackendPath = Join-Path $RootDir "rebuild\production\backend"
$FrontendPath = Join-Path $RootDir "rebuild\production\frontend"

if (-not (Test-Path $BackendPath) -or -not (Test-Path $FrontendPath)) {
    Write-Host "ERROR: backend or frontend folder not found." -ForegroundColor Red
    Write-Host "Expected paths:" -ForegroundColor Red
    Write-Host "  Backend:  $BackendPath" -ForegroundColor Red
    Write-Host "  Frontend: $FrontendPath" -ForegroundColor Red
    exit 1
}

Write-Host "Script directory : $ScriptDir" -ForegroundColor DarkGray
Write-Host "Backend directory: $BackendPath" -ForegroundColor DarkGray
Write-Host "Frontend directory: $FrontendPath" -ForegroundColor DarkGray
Write-Host ""

function Test-CommandExists {
    param([Parameter(Mandatory = $true)][string]$Name)
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Invoke-InDirectory {
    param(
        [Parameter(Mandatory = $true)][string]$Path,
        [Parameter(Mandatory = $true)][scriptblock]$ScriptBlock
    )
    Push-Location $Path
    try { & $ScriptBlock }
    finally { Pop-Location }
}

### 1. Check Node.js
Write-Host "[1/7] Checking Node.js..." -ForegroundColor Yellow
if (-not (Test-CommandExists -Name "node")) {
    Write-Host "ERROR: Node.js not found. Please install Node.js (>= 18)." -ForegroundColor Red
    exit 1
} else {
    $nodeVersion = node -v
    Write-Host "Node.js version: $nodeVersion" -ForegroundColor Green
}
Write-Host ""

### 2. Force cleanup: Kill conflicting processes
Write-Host "[2/7] Force releasing ports 3000, 5173..." -ForegroundColor Yellow
$conflictPorts = @(3000, 5173)
foreach ($port in $conflictPorts) {
    $processes = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique
    if ($processes) {
        foreach ($procId in $processes) {
            Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
            Write-Host "   [OK] Port $port released (PID: $procId)" -ForegroundColor Gray
        }
    }
}
Stop-Process -Name "node", "tsx" -Force -ErrorAction SilentlyContinue 2>$null
Write-Host "   [OK] Cleaned up residual Node runtime state" -ForegroundColor Gray
Start-Sleep -Seconds 1
Write-Host ""

### 3. Start Docker services
Write-Host "[3/7] Starting Docker services..." -ForegroundColor Yellow
if (Test-Path (Join-Path $BackendPath "docker-compose.yml")) {
    if (-not (Test-CommandExists -Name "docker")) {
        Write-Host "Docker not found. Please make sure DB and Redis are running manually." -ForegroundColor Yellow
    } else {
        Invoke-InDirectory -Path $BackendPath -ScriptBlock {
            $composeCmd = $null
            & docker compose version *> $null
            if ($LASTEXITCODE -eq 0) { $composeCmd = "docker compose" }
            elseif (Get-Command "docker-compose" -ErrorAction SilentlyContinue) { $composeCmd = "docker-compose" }

            if (-not $composeCmd) {
                Write-Host "Cannot find 'docker compose'. Please start DB/Redis manually." -ForegroundColor Yellow
            } else {
                Write-Host "Running: $composeCmd up -d" -ForegroundColor DarkGray
                iex "$composeCmd up -d"
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "Docker containers started (Postgres + Redis)." -ForegroundColor Green
                    Write-Host "Waiting for PostgreSQL to be ready..." -ForegroundColor Cyan
                    $maxWait = 30; $waited = 0; $ready = $false
                    while ($waited -lt $maxWait -and -not $ready) {
                        Start-Sleep -Seconds 1; $waited++
                        $containerRunning = docker ps --format "{{.Names}}" | Select-String "game-postgres"
                        if ($containerRunning) {
                            $testResult = docker exec game-postgres psql -U game_user -d game_db -c "SELECT 1;" 2>&1
                            if ($LASTEXITCODE -eq 0) { $ready = $true; Write-Host "PostgreSQL is ready!" -ForegroundColor Green }
                        }
                        if (-not $ready -and $waited % 5 -eq 0) { Write-Host "Waiting... ($waited/$maxWait)" -ForegroundColor DarkGray }
                    }
                    if (-not $ready) { Write-Host "WARNING: Database may not be fully ready." -ForegroundColor Yellow }
                }
            }
        }
    }
}
Write-Host ""

### 4. Backend env + dependencies + migrations
Write-Host "[4/7] Backend env / deps / migrations..." -ForegroundColor Yellow
Invoke-InDirectory -Path $BackendPath -ScriptBlock {
    $envFile = Join-Path (Get-Location) ".env"
    if (-not (Test-Path $envFile)) {
        $setupScript = Join-Path (Get-Location) "scripts\setup-env.ps1"
        if (Test-Path $setupScript) {
            Write-Host "Running setup-env.ps1..." -ForegroundColor Yellow
            powershell -ExecutionPolicy Bypass -File $setupScript
        }
    } else {
        Write-Host "backend .env exists." -ForegroundColor Green
    }

    if (-not (Test-Path "node_modules")) {
        Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
        npm install --no-audit --no-fund
    } else {
        Write-Host "backend node_modules exists." -ForegroundColor Green
    }

    Write-Host "Running: npx prisma generate" -ForegroundColor Yellow
    npx prisma generate
    
    Write-Host "Running: Prisma migration..." -ForegroundColor Yellow
    $migrationName = "auto_migration_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    npx prisma migrate dev --name $migrationName --skip-seed --skip-generate
    if ($LASTEXITCODE -ne 0) { npx prisma migrate deploy }
}
Write-Host ""

### 5. Wait for database
Write-Host "[5/7] Waiting for database..." -ForegroundColor Yellow
$script:maxRetries = 30; $script:retryCount = 0; $script:dbReady = $false
Invoke-InDirectory -Path $BackendPath -ScriptBlock {
    while ($script:retryCount -lt $script:maxRetries -and -not $script:dbReady) {
        try {
            npm run check:db 2>&1 | Out-Null
            if ($LASTEXITCODE -eq 0) { $script:dbReady = $true; Write-Host "Database is ready!" -ForegroundColor Green }
            else { $script:retryCount++; Start-Sleep -Seconds 2 }
        } catch { $script:retryCount++; Start-Sleep -Seconds 2 }
    }
}
Write-Host ""

### 6. Seed database
Write-Host "[6/7] Seeding database..." -ForegroundColor Yellow
Invoke-InDirectory -Path $BackendPath -ScriptBlock {
    npm run seed
    if ($LASTEXITCODE -eq 0) { Write-Host "Database seeded!" -ForegroundColor Green }
}
Write-Host ""

### 7. Frontend env + dependencies (本地模式：固定 localhost)
Write-Host "[7/8] Frontend env / dependencies (localhost mode)..." -ForegroundColor Yellow

$LocalIP = "localhost"
Write-Host "Using localhost for local development" -ForegroundColor Cyan

Invoke-InDirectory -Path $FrontendPath -ScriptBlock {
    $envFile = Join-Path (Get-Location) ".env"
    
    $envContent = @"
# API配置 - 本地开发模式
# Generated at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
# Mode: localhost (local development)
VITE_API_BASE_URL=http://localhost:3000/api
VITE_WS_URL=http://localhost:3000

# 应用配置
VITE_APP_TITLE=AI文字交互式游戏
VITE_APP_VERSION=1.0.0

# 功能开关
VITE_ENABLE_DEVTOOLS=true
VITE_ENABLE_MOCK=false
"@
    
    $envContent | Out-File -FilePath $envFile -Encoding UTF8 -Force
    Write-Host "Frontend .env created (localhost mode)" -ForegroundColor Green
    
    if (-not (Test-Path "node_modules")) {
        Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
        npm install --no-audit --no-fund
    } else {
        Write-Host "frontend node_modules exists." -ForegroundColor Green
    }
}
Write-Host ""

### 8. Start dev servers
Write-Host "[8/8] Starting dev servers..." -ForegroundColor Yellow

Start-Process powershell -WorkingDirectory $BackendPath -ArgumentList @("-NoExit", "-Command", "npm run dev") | Out-Null
Write-Host "Backend started (port 3000)" -ForegroundColor Green

Start-Process powershell -WorkingDirectory $FrontendPath -ArgumentList @("-NoExit", "-Command", "npm run dev") | Out-Null
Write-Host "Frontend started (port 5173)" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "本地开发模式启动完成！" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "访问地址:" -ForegroundColor Yellow
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Green
Write-Host "  Backend:  http://localhost:3000" -ForegroundColor Green
Write-Host ""
Write-Host "测试账号:" -ForegroundColor Yellow
Write-Host "  Developer: developer / 000000" -ForegroundColor Gray
Write-Host "  Test User: testuser1 / Test1234!" -ForegroundColor Gray
Write-Host ""
Write-Host "Developer Code: wskfz" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
