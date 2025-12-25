<# 
  Simple dev launcher for backend + frontend
  Located in tools/run-dev.ps1
#>

param()

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "DEV LAUNCHER: backend + frontend" -ForegroundColor Cyan
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
    param(
        [Parameter(Mandatory = $true)]
        [string]$Name
    )
    return [bool](Get-Command $Name -ErrorAction SilentlyContinue)
}

function Invoke-InDirectory {
    param(
        [Parameter(Mandatory = $true)]
        [string]$Path,
        [Parameter(Mandatory = $true)]
        [scriptblock]$ScriptBlock
    )

    Push-Location $Path
    try {
        & $ScriptBlock
    }
    finally {
        Pop-Location
    }
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
Write-Host "[2/7] Force releasing ports 3000, 5173 and cleaning up residual processes..." -ForegroundColor Yellow

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

# Force kill node/tsx processes (only for current user, avoid killing system-level processes)
Stop-Process -Name "node", "tsx" -Force -ErrorAction SilentlyContinue 2>$null
Write-Host "   [OK] Cleaned up residual Node runtime state" -ForegroundColor Gray
Start-Sleep -Seconds 1
Write-Host ""

### 3. Start Docker services (Postgres + Redis) if possible
Write-Host "[3/7] Starting Docker services (if available)..." -ForegroundColor Yellow
if (Test-Path (Join-Path $BackendPath "docker-compose.yml")) {
    if (-not (Test-CommandExists -Name "docker")) {
        Write-Host "Docker not found. Please make sure DB and Redis are running manually." -ForegroundColor Yellow
    } else {
        Invoke-InDirectory -Path $BackendPath -ScriptBlock {
            $composeCmd = $null

            & docker compose version *> $null
            if ($LASTEXITCODE -eq 0) {
                $composeCmd = "docker compose"
            } elseif (Get-Command "docker-compose" -ErrorAction SilentlyContinue) {
                $composeCmd = "docker-compose"
            }

            if (-not $composeCmd) {
                Write-Host "Cannot find 'docker compose' or 'docker-compose'. Please start DB/Redis manually." -ForegroundColor Yellow
            } else {
                Write-Host "Running: $composeCmd up -d" -ForegroundColor DarkGray
                iex "$composeCmd up -d"
                if ($LASTEXITCODE -eq 0) {
                    Write-Host "Docker containers started (Postgres + Redis)." -ForegroundColor Green
                    
                    # Wait for PostgreSQL to be ready
                    Write-Host "Waiting for PostgreSQL to be ready..." -ForegroundColor Cyan
                    $maxWait = 30
                    $waited = 0
                    $ready = $false
                    
                    while ($waited -lt $maxWait -and -not $ready) {
                        Start-Sleep -Seconds 1
                        $waited++
                        
                        # Check if container is running
                        $containerRunning = docker ps --format "{{.Names}}" | Select-String "game-postgres"
                        if ($containerRunning) {
                            # Try to connect to database with correct credentials
                            $result = docker exec game-postgres pg_isready -U game_user -d game_db 2>&1
                            if ($LASTEXITCODE -eq 0) {
                                # Also test actual connection with psql
                                $testResult = docker exec game-postgres psql -U game_user -d game_db -c "SELECT 1;" 2>&1
                                if ($LASTEXITCODE -eq 0) {
                                    $ready = $true
                                    Write-Host "PostgreSQL is ready and accepting connections!" -ForegroundColor Green
                                }
                            }
                        }
                        
                        if (-not $ready -and $waited % 5 -eq 0) {
                            Write-Host "Waiting for database... ($waited/$maxWait seconds)" -ForegroundColor DarkGray
                        }
                    }
                    
                    if (-not $ready) {
                        Write-Host "WARNING: Database may not be fully ready yet." -ForegroundColor Yellow
                        Write-Host "If you see authentication errors, try:" -ForegroundColor Yellow
                        Write-Host "  1. Stop and remove the container: docker-compose down" -ForegroundColor Gray
                        Write-Host "  2. Remove the data volume: Remove-Item -Recurse -Force .\data\postgres" -ForegroundColor Gray
                        Write-Host "  3. Restart: docker-compose up -d postgres" -ForegroundColor Gray
                    }
                } else {
                    Write-Host "WARNING: Docker containers may not have started correctly, please check docker-compose output." -ForegroundColor Yellow
                }
            }
        }
    }
} else {
    Write-Host "backend/docker-compose.yml not found, skip Docker step." -ForegroundColor Yellow
}
Write-Host ""

### 4. Backend env + dependencies + migrations
Write-Host "[4/7] Backend env / deps / migrations..." -ForegroundColor Yellow

Invoke-InDirectory -Path $BackendPath -ScriptBlock {
    # 4.1 Ensure .env exists and is valid
    $envFile = Join-Path (Get-Location) ".env"
    $needsRegeneration = $false
    
    if (Test-Path $envFile) {
        # Validate .env file format
        try {
            $envContent = Get-Content $envFile -Raw -ErrorAction Stop
            # Check for common formatting issues
            if ($envContent -match '\\"[^"]*$' -or $envContent -match '[^=]"[^=]*"[^=]' -or $envContent -match 'admin123456\\"') {
                Write-Host "backend .env file has formatting issues. Regenerating..." -ForegroundColor Yellow
                $needsRegeneration = $true
            } else {
                Write-Host "backend .env already exists. Skip env generation." -ForegroundColor Green
            }
        } catch {
            Write-Host "backend .env file may be corrupted. Regenerating..." -ForegroundColor Yellow
            $needsRegeneration = $true
        }
    } else {
        $needsRegeneration = $true
    }
    
    if ($needsRegeneration) {
        if ($envFile -and (Test-Path $envFile)) {
            # Backup existing file
            $backupFile = "$envFile.backup"
            Copy-Item $envFile $backupFile -ErrorAction SilentlyContinue
            Remove-Item $envFile -Force -ErrorAction SilentlyContinue
            Write-Host "Backed up existing .env to .env.backup" -ForegroundColor Gray
        }
        
        $setupScript = Join-Path (Get-Location) "scripts\setup-env.ps1"
        if (Test-Path $setupScript) {
            Write-Host "Running scripts\setup-env.ps1 to create .env ..." -ForegroundColor Yellow
            powershell -ExecutionPolicy Bypass -File $setupScript
        } else {
            Write-Host "backend .env not found and scripts\setup-env.ps1 missing. Please create backend\.env manually." -ForegroundColor Yellow
        }
    }

    # 4.2 Install backend dependencies
    if (-not (Test-Path "node_modules")) {
        Write-Host "backend node_modules not found, running npm install ..." -ForegroundColor Yellow
        npm install --no-audit --no-fund
    } else {
        Write-Host "backend node_modules exists. Skip npm install." -ForegroundColor Green
    }

    # 4.3 Run Prisma generate and migrations
    Write-Host "Running: npx prisma generate" -ForegroundColor Yellow
    npx prisma generate
    
    Write-Host "Running: Prisma migration (non-interactive)..." -ForegroundColor Yellow
    # Use migrate dev with explicit name and skip-seed to avoid interactive prompts
    # This prevents the y/N prompt that causes issues in batch files
    $migrationName = "auto_migration_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
    npx prisma migrate dev --name $migrationName --skip-seed --skip-generate
    
    # If migrate dev fails (e.g., no schema changes), try migrate deploy for existing migrations
    if ($LASTEXITCODE -ne 0) {
        Write-Host "No new migrations needed, applying existing migrations..." -ForegroundColor DarkGray
        npx prisma migrate deploy
    }
}
Write-Host ""

### 5. Wait for database to be ready
Write-Host "[5/7] Waiting for database to be ready..." -ForegroundColor Yellow
$script:maxRetries = 30
$script:retryCount = 0
$script:dbReady = $false

Invoke-InDirectory -Path $BackendPath -ScriptBlock {
    while ($script:retryCount -lt $script:maxRetries -and -not $script:dbReady) {
        try {
            $result = npm run check:db 2>&1 | Out-String
            if ($LASTEXITCODE -eq 0) {
                $script:dbReady = $true
                Write-Host "Database is ready!" -ForegroundColor Green
            } else {
                $script:retryCount++
                Write-Host "Waiting for database... ($($script:retryCount)/$($script:maxRetries))" -ForegroundColor DarkGray
                Start-Sleep -Seconds 2
            }
        } catch {
            $script:retryCount++
            Write-Host "Waiting for database... ($($script:retryCount)/$($script:maxRetries))" -ForegroundColor DarkGray
            Start-Sleep -Seconds 2
        }
    }
    
    if (-not $script:dbReady) {
        Write-Host "WARNING: Database may not be ready. Continuing anyway..." -ForegroundColor Yellow
    }
}
Write-Host ""

### 6. Seed database with test data
Write-Host "[6/7] Seeding database with test data..." -ForegroundColor Yellow
Invoke-InDirectory -Path $BackendPath -ScriptBlock {
    Write-Host "Running: npm run seed" -ForegroundColor Yellow
    npm run seed
    if ($LASTEXITCODE -eq 0) {
        Write-Host "Database seeded successfully!" -ForegroundColor Green
    } else {
        Write-Host "WARNING: Database seeding may have failed. Check output above." -ForegroundColor Yellow
    }
}
Write-Host ""

### 7. Frontend env + dependencies
Write-Host "[7/8] Frontend env / dependencies..." -ForegroundColor Yellow

# 获取本机局域网IP地址（排除虚拟网卡）
function Get-LocalLanIP {
    $networkAdapters = Get-NetIPAddress -AddressFamily IPv4 | Where-Object {
        $_.IPAddress -notlike "127.*" -and           # 排除本地回环
        $_.IPAddress -notlike "172.*" -and           # 排除所有172网段（Docker/WSL/Hyper-V）
        $_.IPAddress -notlike "198.18.*" -and        # 排除代理软件虚拟网卡
        $_.IPAddress -notlike "169.254.*" -and       # 排除 APIPA
        $_.IPAddress -ne "10.0.0.1" -and             # 排除虚拟网卡常用地址
        $_.PrefixOrigin -ne "WellKnown"              # 排除系统保留地址
    }
    
    # 优先选择 10.x 网段（教室/公司局域网常用，但排除10.0.0.x）
    foreach ($adapter in $networkAdapters) {
        $ip = $adapter.IPAddress
        if ($ip -like "10.*" -and $ip -notlike "10.0.0.*") {
            return $ip
        }
    }
    
    # 其次选择 192.168.x 网段（家庭路由器常用）
    foreach ($adapter in $networkAdapters) {
        $ip = $adapter.IPAddress
        if ($ip -like "192.168.*") {
            return $ip
        }
    }
    
    # 如果没有找到常见网段，返回第一个有效IP
    if ($networkAdapters.Count -gt 0) {
        return $networkAdapters[0].IPAddress
    }
    
    return "localhost"
}

$LocalIP = Get-LocalLanIP
Write-Host "Detected local LAN IP: $LocalIP" -ForegroundColor Cyan

Invoke-InDirectory -Path $FrontendPath -ScriptBlock {
    # 生成前端 .env 文件（每次都重新生成以确保IP正确）
    $envFile = Join-Path (Get-Location) ".env"
    
    Write-Host "Generating frontend .env with LAN IP: $LocalIP" -ForegroundColor Yellow
    
    $envContent = @"
# API配置 - 自动生成，使用本机局域网IP
# Generated at: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')
# Local IP: $LocalIP
VITE_API_BASE_URL=http://${LocalIP}:3000/api
VITE_WS_URL=http://${LocalIP}:3000

# 应用配置
VITE_APP_TITLE=AI文字交互式游戏
VITE_APP_VERSION=1.0.0

# 功能开关
VITE_ENABLE_DEVTOOLS=true
VITE_ENABLE_MOCK=false
"@
    
    $envContent | Out-File -FilePath $envFile -Encoding UTF8 -Force
    Write-Host "Frontend .env created with IP: $LocalIP" -ForegroundColor Green
    
    # 安装前端依赖
    if (-not (Test-Path "node_modules")) {
        Write-Host "frontend node_modules not found, running npm install ..." -ForegroundColor Yellow
        npm install --no-audit --no-fund
    } else {
        Write-Host "frontend node_modules exists. Skip npm install." -ForegroundColor Green
    }
}
Write-Host ""

### 8. Start dev servers
Write-Host "[8/8] Starting backend and frontend dev servers..." -ForegroundColor Yellow

Start-Process powershell -WorkingDirectory $BackendPath -ArgumentList @("-NoExit", "-Command", "npm run dev") | Out-Null
Write-Host "Backend dev server started in new PowerShell window (port 3000 by default)." -ForegroundColor Green

Start-Process powershell -WorkingDirectory $FrontendPath -ArgumentList @("-NoExit", "-Command", "npm run dev") | Out-Null
Write-Host "Frontend dev server started in new PowerShell window (port 5173 by default)." -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "DONE. Check the new PowerShell windows for backend/frontend logs." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "LAN Access URLs (for other computers):" -ForegroundColor Yellow
Write-Host "  Frontend: http://${LocalIP}:5173" -ForegroundColor Green
Write-Host "  Backend:  http://${LocalIP}:3000" -ForegroundColor Green
Write-Host ""
Write-Host "Local Access URLs:" -ForegroundColor Yellow
Write-Host "  Frontend: http://localhost:5173" -ForegroundColor Gray
Write-Host "  Backend:  http://localhost:3000" -ForegroundColor Gray
Write-Host "" -ForegroundColor Cyan
Write-Host "Default Test Accounts:" -ForegroundColor Yellow
Write-Host "  Developer Account: developer / 000000" -ForegroundColor Gray
Write-Host "  Test User 1:       testuser1 / Test1234!" -ForegroundColor Gray
Write-Host "  Test User 2:       testuser2 / Test1234!" -ForegroundColor Gray
Write-Host "  Test User 3:       testuser3 / Test1234!" -ForegroundColor Gray
Write-Host "  Demo Player:       demo_player / demo123" -ForegroundColor Gray
Write-Host "" -ForegroundColor Cyan
Write-Host "Developer Code: wskfz (for admin panels)" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Note: Keep the PowerShell windows open to run the services." -ForegroundColor DarkGray
Write-Host "Closing the windows will stop the corresponding services." -ForegroundColor DarkGray
Write-Host ""
