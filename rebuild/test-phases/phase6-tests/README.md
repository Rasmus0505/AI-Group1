# 第六阶段测试说明：游戏核心决策流程 + 管理员工具

本目录用于第六阶段「游戏核心机制 - 决策流程」及其补充的管理员工具能力的自动化验收，脚本为 `test-phase6.ps1`。

## 测试内容概览

1. 后端健康检查（`/health`）  
2. 使用测试账号 `testuser_phase6` 登录 / 注册并获取 JWT  
3. 创建测试房间  
4. 通过已有的主持人配置接口完成基础配置（人数 / 决策时限 / 规则）  
5. 调用 `POST /api/game/{roomId}/start` 开始游戏并创建 `GameSession`  
6. 调用 `GET /api/game/{sessionId}` 获取会话信息，确认状态为 `playing`  
7. 调用 `POST /api/game/{sessionId}/decision` 提交当前回合决策  
8. 调用 `GET /api/game/{sessionId}/round/1/decisions` 查询决策状态，验证至少存在一条记录  
9. 使用默认开发者账号 `developer / 000000` 登录，获取管理员 Token  
10. 调用 `GET /api/admin/users` 查询在册用户列表，验证响应结构正确  
11. 调用 `GET /api/admin/rooms` 查询在线/活跃房间列表，验证响应结构正确  
12. 调用 `POST /api/admin/rooms/{roomId}/close` 强制关闭本次测试房间，验证房间状态更新为 `closed`  

## 使用方法

### 1. 启动后端服务

```powershell
cd "重新打造/正式搭建/backend"
npm run dev
```

### 2. （可选）启动前端服务

```powershell
cd "重新打造/正式搭建/frontend"
npm run dev
```

### 3. 运行第六阶段测试脚本

```powershell
cd "重新打造/各阶段测试用/6阶段测试"
.\test-phase6.ps1
```

## 预期结果

- 控制台逐步输出每个测试步骤的状态：  
  - 绿色 `✔` 表示通过  
  - 红色 `✗` 表示失败并中断后续步骤  
- 所有步骤通过后，会看到：

```text
========================================
🎉 第六阶段测试通过
========================================
```

## 失败排查建议

1. **健康检查失败**  
   - 检查后端是否运行：访问 `http://localhost:3000/health`  
   - 检查端口是否被占用  

2. **登录/注册失败**  
   - 检查数据库连接与迁移是否完成  
   - 查看后端日志获取具体错误信息  

3. **开始游戏失败**  
   - 确认主持人配置是否已完成：相关接口应能正常返回，并且 `initializationCompleted = true`  

4. **无法获取会话/决策状态**  
   - 检查 `POST /api/game/{roomId}/start` 是否成功返回 `sessionId`  
   - 检查对应路由是否已在后端正确挂载（`/api/game/*`）  

## 手动联调建议

1. 使用测试账号登录前端，创建房间并完成主持人配置。  
2. 根据后续 UI 设计，进入游戏页面（例如 `/game/{sessionId}`），尝试提交一条决策。  
3. 观察决策列表、倒计时、WebSocket 事件（可配合浏览器控制台）是否与脚本行为一致。  


