# 第一阶段测试文件

本目录包含第一阶段的测试文件和脚本。

## 文件说明

- `第一阶段测试说明.md` - 详细的测试说明文档
- `快速测试指南.md` - 5分钟快速测试指南
- `test-phase1.sh` - Linux/Mac 自动化测试脚本
- `test-phase1.ps1` - Windows PowerShell 自动化测试脚本
- `README.md` - 本文件

## 快速开始

### 方法1：快速测试（推荐）
查看 `快速测试指南.md` 进行5分钟快速测试。

### 方法2：详细测试
查看 `第一阶段测试说明.md` 了解详细的测试步骤。

### 方法3：自动化测试
运行测试脚本：
```bash
# Windows
.\test-phase1.ps1

# Linux/Mac
chmod +x test-phase1.sh
./test-phase1.sh
```

## 测试内容

第一阶段测试包括：
- 后端服务器启动和健康检查
- 数据库连接测试（PostgreSQL）
- Redis连接测试
- 前端服务器启动和路由测试
- WebSocket连接测试
- 代码质量检查
- Docker容器状态检查

## 注意事项

- 运行测试前，确保已启动所有必要的服务
- 确保已安装所有依赖
- 确保 Docker 容器正在运行
- 确保环境变量配置正确

