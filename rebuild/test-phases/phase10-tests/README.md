# 第十阶段测试说明

## 测试范围

本测试脚本验证第十阶段（游戏状态同步和回合管理）的所有核心功能：

1. **获取游戏状态API** - `GET /api/game/{sessionId}/state`
2. **进入下一回合API** - `POST /api/game/{sessionId}/round/{round}/next`
3. **获取游戏历史API** - `GET /api/game/{sessionId}/history`
4. **游戏状态WebSocket推送** - 实时推送状态变化
5. **回合阶段切换通知** - stage_changed, round_changed, game_finished
6. **状态持久化** - 游戏状态保存在数据库中
7. **权限验证** - 玩家可以查看，但只有主持人可以进入下一回合

## 运行测试

### 前置条件

1. 确保后端服务正在运行（`http://localhost:3000`）
2. 确保数据库已初始化并运行迁移
3. 确保 Docker 服务（PostgreSQL + Redis）正在运行

### 运行方式

在 PowerShell 中执行：

```powershell
cd "rebuild\test-phases\phase10-tests"
.\test-phase10.ps1
```

### 测试流程

1. **健康检查** - 验证后端服务可用
2. **创建测试用户** - 创建主持人用户和玩家用户
3. **创建房间** - 创建测试房间并完成主持人配置（设置总回合数为3）
4. **开始游戏** - 主持人开始游戏，创建会话
5. **获取游戏状态** - 测试获取游戏状态API
6. **获取游戏历史** - 测试获取游戏历史API
7. **权限验证** - 验证玩家可以查看但无法进入下一回合

## 注意事项

### 关于游戏状态

游戏状态包含：
- `currentRound` - 当前回合数
- `totalRounds` - 总回合数（可选）
- `roundStatus` - 回合状态（decision, review, inference, result, finished）
- `gameStatus` - 游戏状态（playing, paused, finished）
- `submittedDecisions` - 已提交的决策数
- `totalPlayers` - 总玩家数
- `inferenceResult` - 推演结果（如果有）
- `activeEvents` - 活跃事件列表

### 关于回合切换

进入下一回合的条件：
- 当前阶段必须是 `result`
- 当前回合号必须匹配
- 只有主持人可以执行

### 关于游戏结束

游戏结束条件：
- 达到总回合数（`currentRound >= totalRounds`）
- 游戏状态更新为 `finished`
- 广播 `game_finished` WebSocket事件

### 关于WebSocket通知

游戏状态变化时会发送以下WebSocket事件：
- `stage_changed` - 阶段切换（decision → review → inference → result）
- `round_changed` - 回合切换（进入下一回合）
- `game_finished` - 游戏结束

## 预期结果

所有测试步骤应该显示 `✔` 标记，表示测试通过。

## 故障排除

### 后端服务未运行

```
Error: 无法连接到 http://localhost:3000
```

**解决方案**: 确保后端服务正在运行，可以通过 `run-dev.bat` 启动。

### 无法进入下一回合

```
Error: 当前阶段不是结果阶段，无法进入下一回合
```

**解决方案**: 
1. 确保游戏已进入 `result` 阶段
2. 需要先完成推演流程（decision → review → inference → result）

### 权限错误

```
Error: 403 Forbidden
```

**解决方案**: 确保测试用户是房间的主持人（hostId）。

## 相关文档

- [开发流程指南](../../requirements/开发流程指南.md) - 第十阶段详细说明
- [API 文档](../../production/backend/src/routes/game.ts) - 后端 API 实现

