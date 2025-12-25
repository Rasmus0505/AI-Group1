# 第八阶段测试说明

## 测试范围

本测试脚本验证第八阶段（AI推演引擎集成）的所有核心功能：

1. **AI API调用封装** - AI服务封装和请求构建
2. **AI Prompt构建** - 根据游戏规则、事件、决策构建Prompt
3. **异步推演处理** - 异步执行AI推演，不阻塞请求
4. **推演结果存储** - 使用Redis存储推演结果
5. **获取推演结果API** - `GET /api/game/{sessionId}/round/{round}/inference-result`
6. **推演进度推送** - WebSocket实时推送推演进度

## 运行测试

### 前置条件

1. 确保后端服务正在运行（`http://localhost:3000`）
2. 确保数据库已初始化并运行迁移
3. 确保 Docker 服务（PostgreSQL + Redis）正在运行

### 运行方式

在 PowerShell 中执行：

```powershell
cd "rebuild\test-phases\phase8-tests"
.\test-phase8.ps1
```

### 测试流程

1. **健康检查** - 验证后端服务可用
2. **创建测试用户** - 创建主持人用户和玩家用户
3. **创建房间** - 创建测试房间并完成主持人配置（包括AI API配置）
4. **玩家加入** - 玩家加入房间
5. **开始游戏** - 主持人开始游戏，创建会话
6. **提交决策** - 玩家提交决策
7. **提交AI推演** - 测试提交给AI推演API
8. **获取推演结果** - 测试获取推演结果API
9. **权限验证** - 验证玩家可以查看推演结果

## 注意事项

### 关于AI API配置

测试脚本会配置一个模拟的AI API端点。在实际使用中：

- **开发环境**：可以使用真实的AI API（如OpenAI、Anthropic等）
- **测试环境**：可以使用Mock服务或测试API
- **如果AI API未配置或不可用**：推演会失败，但API端点已正确实现

### 关于推演状态

推演可能处于以下状态：
- `processing` - 正在处理中
- `completed` - 已完成
- `failed` - 失败（通常是AI API配置问题）

### 关于异步处理

推演是异步执行的：
- 提交推演后立即返回，不等待完成
- 通过WebSocket推送进度更新
- 可以通过API轮询获取结果

## 预期结果

所有测试步骤应该显示 `✔` 标记，表示测试通过。

如果某些步骤显示警告，这是预期的，因为：
- API 端点已正确实现
- 当AI API正确配置时，功能将正常工作
- 推演进度会通过WebSocket实时推送

## 故障排除

### 后端服务未运行

```
Error: 无法连接到 http://localhost:3000
```

**解决方案**: 确保后端服务正在运行，可以通过 `run-dev.bat` 启动。

### AI推演失败

```
Error: AI API call failed
```

**解决方案**: 
1. 检查主持人配置中的AI API端点是否正确
2. 检查API密钥和请求头配置
3. 确认AI API服务可用

### 推演结果不存在

```
Error: 推演结果不存在
```

**解决方案**: 
1. 确保已提交推演（调用 submit-to-ai API）
2. 等待推演完成（可能需要几秒到几分钟）
3. 检查Redis服务是否正常运行

## 相关文档

- [开发流程指南](../../requirements/开发流程指南.md) - 第八阶段详细说明
- [API 文档](../../production/backend/src/routes/game.ts) - 后端 API 实现
- [AI服务文档](../../production/backend/src/services/aiService.ts) - AI服务实现

