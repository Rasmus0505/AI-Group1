<#
.SYNOPSIS
将 Docker 卷数据迁移到项目本地目录

.DESCRIPTION
此脚本将现有的 Docker 命名卷数据迁移到项目的本地 data 目录中，
以便数据可以随项目一起迁移。

.NOTES
- 运行前请确保 Docker 容器已停止
- 需要管理员权限
#>

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Docker 数据迁移脚本" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 获取脚本所在目录（scripts 目录），然后获取父目录（backend 目录）
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$BackendDir = Split-Path -Parent $ScriptDir
$DataDir = Join-Path $BackendDir "data"
$PostgresDir = Join-Path $DataDir "postgres"
$RedisDir = Join-Path $DataDir "redis"

Write-Host "项目目录: $BackendDir" -ForegroundColor DarkGray
Write-Host "数据目录: $DataDir" -ForegroundColor DarkGray
Write-Host ""

# 检查 Docker 是否运行
Write-Host "[1/4] 检查 Docker 状态..." -ForegroundColor Yellow
try {
    docker info | Out-Null
    Write-Host "✓ Docker 正在运行" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker 未运行，请先启动 Docker Desktop" -ForegroundColor Red
    exit 1
}
Write-Host ""

# 检查容器是否已停止
Write-Host "[2/4] 检查容器状态..." -ForegroundColor Yellow
$postgresRunning = docker ps -a --filter "name=game-postgres" --format "{{.Status}}" | Select-String -Pattern "Up"
$redisRunning = docker ps -a --filter "name=game-redis" --format "{{.Status}}" | Select-String -Pattern "Up"

if ($postgresRunning -or $redisRunning) {
    Write-Host "⚠ 检测到容器正在运行，正在停止..." -ForegroundColor Yellow
    docker-compose -f (Join-Path $BackendDir "docker-compose.yml") down
    Start-Sleep -Seconds 2
    Write-Host "✓ 容器已停止" -ForegroundColor Green
} else {
    Write-Host "✓ 容器已停止" -ForegroundColor Green
}
Write-Host ""

# 检查 Docker 卷是否存在
Write-Host "[3/4] 检查 Docker 卷..." -ForegroundColor Yellow
$postgresVolume = docker volume ls --filter "name=backend_postgres_data" --format "{{.Name}}"
$redisVolume = docker volume ls --filter "name=backend_redis_data" --format "{{.Name}}"

if (-not $postgresVolume -and -not $redisVolume) {
    Write-Host "⚠ 未找到现有的 Docker 卷，将创建新的数据目录" -ForegroundColor Yellow
    Write-Host ""
    
    # 创建数据目录
    if (-not (Test-Path $PostgresDir)) {
        New-Item -ItemType Directory -Path $PostgresDir -Force | Out-Null
        Write-Host "✓ 创建 PostgreSQL 数据目录: $PostgresDir" -ForegroundColor Green
    }
    
    if (-not (Test-Path $RedisDir)) {
        New-Item -ItemType Directory -Path $RedisDir -Force | Out-Null
        Write-Host "✓ 创建 Redis 数据目录: $RedisDir" -ForegroundColor Green
    }
    
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "数据目录已创建，可以启动容器了" -ForegroundColor Cyan
    Write-Host "========================================" -ForegroundColor Cyan
    exit 0
}

# 创建数据目录
Write-Host "创建数据目录..." -ForegroundColor DarkGray
if (-not (Test-Path $PostgresDir)) {
    New-Item -ItemType Directory -Path $PostgresDir -Force | Out-Null
}
if (-not (Test-Path $RedisDir)) {
    New-Item -ItemType Directory -Path $RedisDir -Force | Out-Null
}
Write-Host "✓ 数据目录已创建" -ForegroundColor Green
Write-Host ""

# 迁移 PostgreSQL 数据
Write-Host "[4/4] 迁移数据..." -ForegroundColor Yellow
if ($postgresVolume) {
    Write-Host "迁移 PostgreSQL 数据..." -ForegroundColor DarkGray
    try {
        # 使用临时容器复制数据
        docker run --rm `
            -v backend_postgres_data:/source:ro `
            -v "${PostgresDir}:/target" `
            alpine sh -c "cd /source && tar czf /target/backup.tar.gz . && cd /target && tar xzf backup.tar.gz && rm backup.tar.gz"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ PostgreSQL 数据迁移成功" -ForegroundColor Green
        } else {
            Write-Host "✗ PostgreSQL 数据迁移失败" -ForegroundColor Red
        }
    } catch {
        Write-Host "✗ PostgreSQL 数据迁移出错: $_" -ForegroundColor Red
    }
} else {
    Write-Host "⚠ 未找到 PostgreSQL 卷，跳过迁移" -ForegroundColor Yellow
}

# 迁移 Redis 数据
if ($redisVolume) {
    Write-Host "迁移 Redis 数据..." -ForegroundColor DarkGray
    try {
        # 使用临时容器复制数据
        docker run --rm `
            -v backend_redis_data:/source:ro `
            -v "${RedisDir}:/target" `
            alpine sh -c "cd /source && tar czf /target/backup.tar.gz . && cd /target && tar xzf backup.tar.gz && rm backup.tar.gz"
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Redis 数据迁移成功" -ForegroundColor Green
        } else {
            Write-Host "✗ Redis 数据迁移失败" -ForegroundColor Red
        }
    } catch {
        Write-Host "✗ Redis 数据迁移出错: $_" -ForegroundColor Red
    }
} else {
    Write-Host "⚠ 未找到 Redis 卷，跳过迁移" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "迁移完成！" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "数据已迁移到:" -ForegroundColor Green
Write-Host "  PostgreSQL: $PostgresDir" -ForegroundColor Gray
Write-Host "  Redis:      $RedisDir" -ForegroundColor Gray
Write-Host ""
Write-Host "下一步:" -ForegroundColor Yellow
Write-Host "  1. 检查 docker-compose.yml 已使用本地目录" -ForegroundColor Gray
Write-Host "  2. 运行: docker-compose up -d" -ForegroundColor Gray
Write-Host "  3. 验证数据是否正常" -ForegroundColor Gray
Write-Host ""
Write-Host "注意: 旧的 Docker 卷可以保留作为备份，或使用以下命令删除:" -ForegroundColor Yellow
Write-Host "  docker volume rm backend_postgres_data backend_redis_data" -ForegroundColor Gray
Write-Host ""

