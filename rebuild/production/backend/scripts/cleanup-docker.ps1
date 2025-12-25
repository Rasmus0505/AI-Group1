<#
.SYNOPSIS
清理 Docker 无用数据

.DESCRIPTION
清理未使用的 Docker 镜像、容器和卷，释放磁盘空间

.NOTES
- 会保留正在使用的镜像和容器
- 会删除未使用的镜像、停止的容器和未使用的卷
#>

param(
    [switch]$Force  # 非交互模式，跳过确认
)

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Docker 清理工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 显示当前磁盘使用情况
Write-Host "[1/5] 检查当前 Docker 磁盘使用情况..." -ForegroundColor Yellow
docker system df
Write-Host ""

# 确认操作（除非使用 -Force 参数）
if (-not $Force) {
    Write-Host "将执行以下清理操作:" -ForegroundColor Yellow
    Write-Host "  1. 删除未使用的镜像" -ForegroundColor Gray
    Write-Host "  2. 删除停止的容器" -ForegroundColor Gray
    Write-Host "  3. 删除未使用的卷" -ForegroundColor Gray
    Write-Host "  4. 清理构建缓存" -ForegroundColor Gray
    Write-Host ""

    $confirm = Read-Host "是否继续? (y/N)"
    if ($confirm -ne "y" -and $confirm -ne "Y") {
        Write-Host "已取消操作" -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Host "非交互模式：将自动执行清理操作" -ForegroundColor Yellow
    Write-Host ""
}

Write-Host ""

# 1. 删除未使用的镜像
Write-Host "[2/5] 删除未使用的镜像..." -ForegroundColor Yellow
$unusedImages = docker images --filter "dangling=true" -q
if ($unusedImages) {
    docker rmi $unusedImages 2>&1 | Out-Null
    Write-Host "✓ 已删除未使用的镜像" -ForegroundColor Green
} else {
    Write-Host "✓ 没有未使用的镜像" -ForegroundColor Green
}

# 2. 删除停止的容器
Write-Host "[3/5] 删除停止的容器..." -ForegroundColor Yellow
$stoppedContainers = docker ps -a --filter "status=exited" -q
if ($stoppedContainers) {
    docker rm $stoppedContainers 2>&1 | Out-Null
    Write-Host "✓ 已删除停止的容器" -ForegroundColor Green
} else {
    Write-Host "✓ 没有停止的容器" -ForegroundColor Green
}

# 3. 删除未使用的卷
Write-Host "[4/5] 删除未使用的卷..." -ForegroundColor Yellow
$unusedVolumes = docker volume ls -q --filter "dangling=true"
if ($unusedVolumes) {
    docker volume rm $unusedVolumes 2>&1 | Out-Null
    Write-Host "✓ 已删除未使用的卷" -ForegroundColor Green
} else {
    Write-Host "✓ 没有未使用的卷" -ForegroundColor Green
}

# 4. 清理构建缓存
Write-Host "[5/5] 清理构建缓存..." -ForegroundColor Yellow
docker builder prune -f 2>&1 | Out-Null
Write-Host "✓ 已清理构建缓存" -ForegroundColor Green

Write-Host ""

# 显示清理后的磁盘使用情况
Write-Host "清理后的 Docker 磁盘使用情况:" -ForegroundColor Cyan
docker system df
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "清理完成！" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "提示: 如果需要更彻底的清理（包括未使用的镜像），可以运行:" -ForegroundColor Yellow
Write-Host "  docker system prune -a" -ForegroundColor Gray
Write-Host ""
Write-Host "注意: docker system prune -a 会删除所有未使用的镜像，包括可能需要的镜像" -ForegroundColor Yellow
Write-Host ""

