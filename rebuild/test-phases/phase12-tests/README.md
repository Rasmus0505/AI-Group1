# Phase 12 测试说明

## 测试内容

本测试脚本用于验证第十二阶段（资源交易功能）的实现。

## 测试功能

1. **用户创建和认证**
   - 创建两个测试用户（testuser_trade1 和 testuser_trade2）
   - 获取用户认证令牌

2. **游戏会话准备**
   - 创建游戏房间
   - 用户加入房间
   - 配置主机设置
   - 启动游戏会话

3. **交易功能测试**
   - 发起交易请求
   - 获取交易列表
   - 接受交易
   - 拒绝交易
   - 取消交易

4. **错误处理测试**
   - 自我交易错误
   - 重复交易错误

## 运行测试

### 前置条件

1. 确保后端服务正在运行（http://localhost:3000）
2. 确保数据库已迁移（包含 Trade 模型）
3. 确保 Redis 服务正在运行

### 执行测试

在 PowerShell 中运行：

```powershell
cd rebuild/test-phases/phase12-tests
.\test-phase12.ps1
```

### 预期结果

所有测试步骤应该通过（✔），包括：

- ✓ 健康检查
- ✓ 用户创建和认证
- ✓ 房间创建和游戏启动
- ✓ 交易请求和响应
- ✓ 交易列表查询
- ✓ 错误处理

## 注意事项

1. 测试会创建测试用户和房间，可能会在数据库中留下测试数据
2. 如果测试用户已存在，脚本会自动尝试登录
3. 确保游戏会话处于 "playing" 状态才能发起交易
4. 交易有过期时间（默认5分钟），过期后无法响应

## API 端点测试

- `POST /api/game/:sessionId/trade/request` - 发起交易
- `POST /api/game/:sessionId/trade/:tradeId/respond` - 响应交易
- `GET /api/game/:sessionId/trade/list` - 获取交易列表
- `DELETE /api/game/:sessionId/trade/:tradeId` - 取消交易

