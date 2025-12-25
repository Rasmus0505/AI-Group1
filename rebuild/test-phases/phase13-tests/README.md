# 第十三阶段测试说明

## 测试范围

本测试脚本验证第十三阶段（游戏存档功能）的所有核心功能：

1. **手动保存游戏** - `POST /api/game/{sessionId}/save`
2. **获取存档列表** - `GET /api/game/{sessionId}/saves`
3. **恢复游戏存档** - `POST /api/game/{sessionId}/restore/{saveId}`
4. **删除游戏存档** - `DELETE /api/game/{sessionId}/saves/{saveId}`
5. **权限验证** - 非主持人用户无法恢复/删除存档
6. **自动存档** - 每回合推演完成后自动保存（在推演流程中自动触发）

## 运行测试

### 前置条件

1. 确保后端服务正在运行（`http://localhost:3000`）
2. 确保数据库已初始化并运行迁移（包含 GameSave 模型）
3. 确保 Docker 服务（PostgreSQL + Redis）正在运行

### 运行方式

在 PowerShell 中执行：

```powershell
cd "rebuild\test-phases\phase13-tests"
.\test-phase13.ps1
```

### 测试流程

1. **健康检查** - 验证后端服务可用
2. **创建测试用户** - 创建主持人用户和玩家用户
3. **创建房间** - 创建测试房间并完成主持人配置
4. **玩家加入** - 玩家加入房间
5. **开始游戏** - 主持人开始游戏，创建会话
6. **提交决策** - 玩家提交决策
7. **手动保存** - 测试手动保存游戏存档
8. **获取存档列表** - 测试获取存档列表
9. **自动命名存档** - 测试不提供存档名称时的自动命名
10. **权限验证** - 验证非主持人无法恢复/删除存档
11. **删除存档** - 测试删除存档功能

## 注意事项

### 关于自动存档

自动存档功能在每回合 AI 推演完成后自动触发，不需要手动调用。测试脚本主要验证手动存档功能。

要测试自动存档，需要：
1. 完成一个完整的推演流程（提交决策 → 审核 → 推演）
2. 推演完成后，系统会自动创建一个名为 "自动存档-第X回合" 的存档

### 存档数据

存档包含完整的游戏状态快照：
- 会话基本信息（回合、状态、游戏状态等）
- 所有决策记录
- 活跃事件
- 活跃交易
- 所有回合的推演结果（从 Redis 恢复）

### 测试数据

测试脚本会创建以下测试用户：
- `testuser_phase13_host` - 主持人用户
- `testuser_phase13_player` - 玩家用户

如果这些用户已存在，脚本会自动登录；如果不存在，会自动注册。

## 预期结果

所有测试步骤应该显示 `✔` 标记，表示测试通过。

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
3. **重要**: 确保已运行数据库迁移，包含 GameSave 模型

### Prisma 客户端错误

```
Error: 类型"PrismaClient"上不存在属性"gameSave"
```

**解决方案**: 运行数据库迁移和 Prisma 客户端生成：
```powershell
cd rebuild\production\backend
npx prisma migrate dev --name add_game_save
npx prisma generate
```

### 权限错误

```
Error: 403 Forbidden
```

**解决方案**: 确保测试用户是房间的主持人（hostId）。

## 相关文档

- [开发流程指南](../../requirements/开发流程指南.md) - 第十三阶段详细说明
- [API 文档](../../production/backend/src/routes/game.ts) - 后端 API 实现

