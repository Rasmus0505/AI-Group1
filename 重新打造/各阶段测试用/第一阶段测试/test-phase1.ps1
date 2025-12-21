# 第一阶段自动化测试脚本 (PowerShell)
# 使用方法: .\test-phase1.ps1

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "第一阶段：项目基础搭建 - 自动化测试" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host ""

# 测试计数
$script:PASSED = 0
$script:FAILED = 0

# 测试函数
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [int]$ExpectedStatus = 200
    )
    
    Write-Host "测试 $Name... " -NoNewline
    
    try {
        $response = Invoke-WebRequest -Uri $Url -UseBasicParsing -ErrorAction Stop
        $httpCode = $response.StatusCode
        
        if ($httpCode -eq $ExpectedStatus) {
            Write-Host "✓ 通过" -ForegroundColor Green
            Write-Host "  响应: $($response.Content)" -ForegroundColor Gray
            $script:PASSED++
            return $true
        } else {
            Write-Host "✗ 失败" -ForegroundColor Red
            Write-Host "  期望状态码: $ExpectedStatus, 实际: $httpCode" -ForegroundColor Red
            $script:FAILED++
            return $false
        }
    } catch {
        Write-Host "✗ 失败" -ForegroundColor Red
        Write-Host "  错误: $($_.Exception.Message)" -ForegroundColor Red
        $script:FAILED++
        return $false
    }
}

# 检查端口是否监听
function Test-Port {
    param(
        [string]$Name,
        [int]$Port
    )
    
    Write-Host "检查 $Name (端口 $Port)... " -NoNewline
    
    try {
        $connection = Test-NetConnection -ComputerName localhost -Port $Port -WarningAction SilentlyContinue -ErrorAction Stop
        if ($connection.TcpTestSucceeded) {
            Write-Host "✓ 运行中" -ForegroundColor Green
            $script:PASSED++
            return $true
        } else {
            Write-Host "✗ 未运行" -ForegroundColor Red
            $script:FAILED++
            return $false
        }
    } catch {
        Write-Host "✗ 未运行" -ForegroundColor Red
        $script:FAILED++
        return $false
    }
}

Write-Host "1. 检查服务状态" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Test-Port "后端服务器" 3000
Test-Port "前端服务器" 5173
Test-Port "PostgreSQL" 5432
Test-Port "Redis" 6379
Write-Host ""

Write-Host "2. 测试后端接口" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Test-Endpoint "健康检查" "http://localhost:3000/health" 200
Test-Endpoint "数据库连接" "http://localhost:3000/api/test/db" 200
Test-Endpoint "Redis连接" "http://localhost:3000/api/test/redis" 200
Write-Host ""

Write-Host "3. 检查代码质量" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Push-Location "..\..\正式搭建\backend"
try {
    $null = npm run lint 2>&1
    Write-Host "✓ 后端代码质量检查通过" -ForegroundColor Green
    $script:PASSED++
} catch {
    Write-Host "⚠ 后端代码质量检查有警告" -ForegroundColor Yellow
}
Pop-Location

Push-Location "..\..\正式搭建\frontend"
try {
    $null = npm run lint 2>&1
    Write-Host "✓ 前端代码质量检查通过" -ForegroundColor Green
    $script:PASSED++
} catch {
    Write-Host "⚠ 前端代码质量检查有警告" -ForegroundColor Yellow
}
Pop-Location
Write-Host ""

Write-Host "4. 检查Docker容器" -ForegroundColor Yellow
Write-Host "----------------------------------------" -ForegroundColor Gray
Push-Location "..\..\正式搭建\backend"
$containers = docker ps --format "{{.Names}}"
if ($containers -match "game-postgres") {
    Write-Host "✓ PostgreSQL容器运行中" -ForegroundColor Green
    $script:PASSED++
} else {
    Write-Host "✗ PostgreSQL容器未运行" -ForegroundColor Red
    $script:FAILED++
}

if ($containers -match "game-redis") {
    Write-Host "✓ Redis容器运行中" -ForegroundColor Green
    $script:PASSED++
} else {
    Write-Host "✗ Redis容器未运行" -ForegroundColor Red
    $script:FAILED++
}
Pop-Location
Write-Host ""

Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "测试结果汇总" -ForegroundColor Cyan
Write-Host "==========================================" -ForegroundColor Cyan
Write-Host "通过: $script:PASSED" -ForegroundColor Green
Write-Host "失败: $script:FAILED" -ForegroundColor Red
Write-Host ""

if ($script:FAILED -eq 0) {
    Write-Host "✓ 所有测试通过！第一阶段完成！" -ForegroundColor Green
    exit 0
} else {
    Write-Host "✗ 部分测试失败，请检查并修复问题" -ForegroundColor Red
    exit 1
}

