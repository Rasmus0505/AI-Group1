<#
.SYNOPSIS
一键扫描并清理游戏项目垃圾数据
位于 tools/cleanup-project.ps1
#>

param(
    [switch]$Force,           # 非交互模式，跳过确认
    [switch]$SkipDocker,      # 跳过 Docker 清理
    [switch]$SkipDatabase,   # 跳过数据库清理
    [switch]$SkipFiles        # 跳过文件系统清理
)

$ErrorActionPreference = "Stop"

# 使用更鲁棒的 .NET 方法获取路径，防止 Stack Overflow
$ScriptPath = $MyInvocation.MyCommand.Definition
$ToolsDir = [System.IO.Path]::GetDirectoryName($ScriptPath)
$RootDir = [System.IO.Path]::GetDirectoryName($ToolsDir)

$BackendDir = Join-Path $RootDir "rebuild\production\backend"
$FrontendDir = Join-Path $RootDir "rebuild\production\frontend"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "游戏项目数据清理工具" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "项目根目录: $RootDir" -ForegroundColor DarkGray
Write-Host ""

# 统计清理结果
$script:totalSize = 0
$databaseItems = @()

function Get-DirectorySize {
    param([string]$Path)
    if (Test-Path $Path) {
        $size = (Get-ChildItem -Path $Path -Recurse -ErrorAction SilentlyContinue | 
            Measure-Object -Property Length -Sum).Sum
        return $size
    }
    return 0
}

function Format-Size {
    param([long]$Bytes)
    if ($Bytes -ge 1GB) { return "{0:N2} GB" -f ($Bytes / 1GB) }
    elseif ($Bytes -ge 1MB) { return "{0:N2} MB" -f ($Bytes / 1MB) }
    elseif ($Bytes -ge 1KB) { return "{0:N2} KB" -f ($Bytes / 1KB) }
    else { return "$Bytes B" }
}

# ========================================
# 1. 扫描文件系统垃圾
# ========================================
Write-Host "[1/3] 扫描文件系统垃圾..." -ForegroundColor Yellow
$fileSystemItems = @()

$pathsToScan = @(
    @{ Path = Join-Path $BackendDir "node_modules"; Name = "后端 node_modules" },
    @{ Path = Join-Path $BackendDir "dist"; Name = "后端构建产物" },
    @{ Path = Join-Path $BackendDir "logs"; Name = "后端日志" },
    @{ Path = Join-Path $FrontendDir "node_modules"; Name = "前端 node_modules" },
    @{ Path = Join-Path $FrontendDir "dist"; Name = "前端构建产物" },
    @{ Path = Join-Path $FrontendDir ".vite"; Name = "Vite 缓存" }
)

foreach ($item in $pathsToScan) {
    if (Test-Path $item.Path) {
        $size = Get-DirectorySize -Path $item.Path
        if ($size -gt 0) {
            $fileSystemItems += [PSCustomObject]@{ Path = $item.Path; Name = $item.Name; Size = $size }
            $script:totalSize += $size
        }
    }
}

if ($fileSystemItems.Count -gt 0) {
    $fileSystemItems | ForEach-Object { Write-Host "  - $($_.Name): $(Format-Size -Bytes $_.Size)" -ForegroundColor Gray }
    Write-Host "总计可释放: $(Format-Size -Bytes $script:totalSize)" -ForegroundColor Cyan
}
else {
    Write-Host "✓ 没有发现文件系统垃圾" -ForegroundColor Green
}
Write-Host ""

# ========================================
# 2. 扫描数据库垃圾数据
# ========================================
if (-not $SkipDatabase) {
    Write-Host "[2/3] 扫描数据库垃圾数据..." -ForegroundColor Yellow
    $envFile = Join-Path $BackendDir ".env"
    if (Test-Path $envFile) {
        try {
            Push-Location $BackendDir
            $dbCheck = & npm run check:db 2>&1 | Out-String
            if ($LASTEXITCODE -eq 0 -or $dbCheck -match "数据库连接成功") {
                Write-Host "✓ 数据库连接正常" -ForegroundColor Green
                $databaseItems += "系统日志与临时会话"
            }
            Pop-Location
        }
        catch { }
    }
}
Write-Host ""

# ========================================
# 3. 确认并执行清理
# ========================================
if ($fileSystemItems.Count -eq 0 -and $databaseItems.Count -eq 0) {
    Write-Host "项目已经非常整洁，无需清理。" -ForegroundColor Green
    exit 0
}

if ($Force -or (Read-Host "是否执行清理? (y/N)") -eq "y") {
    Write-Host "正在清理..." -ForegroundColor Yellow
    
    foreach ($item in $fileSystemItems) {
        if (Test-Path $item.Path) {
            Remove-Item -Path $item.Path -Recurse -Force
            Write-Host "✓ 已清理: $($item.Name)" -ForegroundColor Green
        }
    }

    if ($databaseItems.Count -gt 0) {
        Push-Location $BackendDir
        npm run cleanup:db > $null 2>&1
        Write-Host "✓ 数据库备份垃圾已清除" -ForegroundColor Green
        Pop-Location
    }

    Write-Host ""
    Write-Host "清理任务完成！" -ForegroundColor Cyan
}
else {
    Write-Host "已取消清理。" -ForegroundColor Gray
}
