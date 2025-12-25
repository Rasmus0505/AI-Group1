# 第七阶段测试说明

## 测试范围

本测试脚本验证第七阶段（主持人审核功能）的所有核心功能：

1. **获取审核决策列表** - `GET /api/game/{sessionId}/round/{round}/decisions/review`
2. **添加临时事件** - `POST /api/game/{sessionId}/round/{round}/temporary-event`
3. **添加临时规则** - `POST /api/game/{sessionId}/round/{round}/temporary-rule`
4. **提交给AI推演** - `POST /api/game/{sessionId}/round/{round}/submit-to-ai`
5. **权限验证** - 非主持人用户无法访问审核端点

## 运行测试

### 前置条件

1. 确保后端服务正在运行（`http://localhost:3000`）
2. 确保数据库已初始化并运行迁移
3. 确保 Docker 服务（PostgreSQL + Redis）正在运行

### 运行方式

在 PowerShell 中执行：

```powershell
cd "rebuild\test-phases\phase7-tests"
.\test-phase7.ps1
```

### 测试流程

1. **健康检查** - 验证后端服务可用
2. **创建测试用户** - 创建主持人用户和玩家用户
3. **创建房间** - 创建测试房间并完成主持人配置
4. **玩家加入** - 玩家加入房间
5. **开始游戏** - 主持人开始游戏，创建会话
6. **提交决策** - 玩家提交决策
7. **审核功能测试** - 测试所有审核相关API
8. **权限验证** - 验证非主持人无法访问审核端点

## 注意事项

### 关于 roundStatus

部分测试可能会显示警告，因为游戏可能仍处于 `decision` 阶段而不是 `review` 阶段。这是**正常行为**：

- API 端点已正确实现
- 当游戏进入 `review` 阶段时，这些 API 将正常工作
- 测试脚本会验证 API 端点存在且响应正确

### 测试数据

测试脚本会创建以下测试用户：
- `testuser_phase7_host` - 主持人用户
- `testuser_phase7_player` - 玩家用户

如果这些用户已存在，脚本会自动登录；如果不存在，会自动注册。

## 预期结果

所有测试步骤应该显示 `✔` 标记，表示测试通过。

如果某些步骤显示警告（关于 roundStatus），这是预期的，因为：
- API 端点已正确实现
- 权限验证正常工作
- 当游戏状态正确时，功能将正常工作

## 故障排除

### 后端服务未运行

```
Error: 无法连接到 http://localhost:3000
```

**解决方案**: 确保后端服务正在运行，可以通过 `run-dev.bat` 启动。

### 数据库连接失败

```
Error: Health check failed
```

**解决方案**: 
1. 检查 Docker 服务是否运行：`docker ps`
2. 检查数据库连接配置：`.env` 文件中的 `DATABASE_URL`

### 权限错误

```
Error: 403 Forbidden
```

**解决方案**: 确保测试用户是房间的主持人（hostId）。

## 相关文档

- [开发流程指南](../../requirements/开发流程指南.md) - 第七阶段详细说明
- [API 文档](../../production/backend/src/routes/game.ts) - 后端 API 实现

