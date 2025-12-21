#!/bin/bash

# 第一阶段自动化测试脚本
# 使用方法: chmod +x test-phase1.sh && ./test-phase1.sh

echo "=========================================="
echo "第一阶段：项目基础搭建 - 自动化测试"
echo "=========================================="
echo ""

# 颜色定义
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 测试计数
PASSED=0
FAILED=0

# 测试函数
test_endpoint() {
    local name=$1
    local url=$2
    local expected_status=$3
    
    echo -n "测试 $name... "
    
    response=$(curl -s -w "\n%{http_code}" "$url")
    http_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | sed '$d')
    
    if [ "$http_code" == "$expected_status" ]; then
        echo -e "${GREEN}✓ 通过${NC}"
        echo "  响应: $body"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ 失败${NC}"
        echo "  期望状态码: $expected_status, 实际: $http_code"
        echo "  响应: $body"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

# 检查服务是否运行
check_service() {
    local name=$1
    local port=$2
    
    echo -n "检查 $name (端口 $port)... "
    
    if nc -z localhost $port 2>/dev/null; then
        echo -e "${GREEN}✓ 运行中${NC}"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ 未运行${NC}"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

echo "1. 检查服务状态"
echo "----------------------------------------"
check_service "后端服务器" 3000
check_service "前端服务器" 5173
check_service "PostgreSQL" 5432
check_service "Redis" 6379
echo ""

echo "2. 测试后端接口"
echo "----------------------------------------"
test_endpoint "健康检查" "http://localhost:3000/health" 200
test_endpoint "数据库连接" "http://localhost:3000/api/test/db" 200
test_endpoint "Redis连接" "http://localhost:3000/api/test/redis" 200
echo ""

echo "3. 检查代码质量"
echo "----------------------------------------"
cd ../../正式搭建/backend
if npm run lint > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 后端代码质量检查通过${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${YELLOW}⚠ 后端代码质量检查有警告${NC}"
fi

cd ../frontend
if npm run lint > /dev/null 2>&1; then
    echo -e "${GREEN}✓ 前端代码质量检查通过${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${YELLOW}⚠ 前端代码质量检查有警告${NC}"
fi
cd ../../各阶段测试用/第一阶段测试
echo ""

echo "4. 检查Docker容器"
echo "----------------------------------------"
cd ../../正式搭建/backend
if docker ps | grep -q "game-postgres"; then
    echo -e "${GREEN}✓ PostgreSQL容器运行中${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗ PostgreSQL容器未运行${NC}"
    FAILED=$((FAILED + 1))
fi

if docker ps | grep -q "game-redis"; then
    echo -e "${GREEN}✓ Redis容器运行中${NC}"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗ Redis容器未运行${NC}"
    FAILED=$((FAILED + 1))
fi
cd ../../各阶段测试用/第一阶段测试
echo ""

echo "=========================================="
echo "测试结果汇总"
echo "=========================================="
echo -e "${GREEN}通过: $PASSED${NC}"
echo -e "${RED}失败: $FAILED${NC}"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ 所有测试通过！第一阶段完成！${NC}"
    exit 0
else
    echo -e "${RED}✗ 部分测试失败，请检查并修复问题${NC}"
    exit 1
fi

