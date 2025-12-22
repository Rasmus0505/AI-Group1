# 第四阶段测试：WebSocket 实时通信基础（最小子集）

本目录用于第四阶段“WebSocket 实时通信基础（最小实时子系统）”的测试与验收。

> 目标：验证后端 Socket.io + Redis 房间状态、以及前端 Rooms / WaitingRoom 页面对最小消息集（`player_joined` / `player_left` / `game_state_update` / `system_message` / `error`）的集成情况。

---

## 一、前置条件

在执行本目录脚本前，请确保：

- 已完成并通过：
  - 第一阶段测试（基础环境及数据库连通）
  - 第二阶段测试（用户注册 / 登录 / JWT）
  - 第三阶段测试（房间创建 / 列表 / 加入 / 离开）
- 已按项目 `README` 启动后端服务：
  - 后端：`cd 重新打造/正式搭建/backend && npm run dev`
- 数据库迁移已执行完毕。
- Redis 服务已可用（可选但推荐，用于房间实时状态）。

可选但推荐：

- 启动前端服务：`cd 重新打造/正式搭建/frontend && npm run dev`
  - 便于在浏览器中直观观察 Rooms / WaitingRoom 页面上的实时效果。

---

## 二、脚本说明

### 2.1 `test-phase4.ps1`

PowerShell 脚本，用于快速验证第四阶段的关键接口与基础流程：

主要步骤：

1. **检查后端健康状态**
   - 调用 `GET /health`，确认后端正常运行。
2. **使用测试账号登录并获取 JWT**
   - 尝试使用 `testuser_phase4 / Test1234!` 登录。
   - 若账号不存在，会自动注册后再登录。
3. **创建测试房间**
   - 调用 `POST /api/rooms/create` 创建名为 `Phase4 Auto Test Room` 的测试房间。
4. **验证房间列表接口**
   - 调用 `GET /api/rooms/list`，确认接口正常返回。
5. **提示手工验证 WebSocket 行为**
   - 由于 PowerShell 不内置 Socket.io 客户端，脚本会给出在浏览器中手工验证 WebSocket 最小子系统的建议步骤。

---

## 三、使用方法

在项目根目录打开 PowerShell 7（pwsh）：

```powershell
cd 重新打造/各阶段测试用/4阶段测试
pwsh ./test-phase4.ps1
```

可选参数：

- `-BaseUrl`：后端服务地址（默认 `http://localhost:3000`）
- `-FrontendUrl`：前端服务地址（默认 `http://localhost:5173`），仅用于脚本中的提示信息。

示例：

```powershell
pwsh ./test-phase4.ps1 -BaseUrl "http://localhost:3000" -FrontendUrl "http://localhost:5173"
```

---

## 四、期望现象（通过标准）

1. 脚本输出：
   - `1.1 检查后端健康状态` 步骤通过。
   - `2.1 使用测试账号登录获取 JWT` 步骤通过。
   - `3.1 创建测试房间` 步骤通过。
   - `4.1 验证房间列表接口可用` 步骤通过。
   - 脚本以退出码 `0` 结束。

2. 浏览器中（建议至少打开两个标签页，使用同一测试账号登录）：
   - `/rooms` 页面能看到 `Phase4 Auto Test Room`。
   - 在一个标签中进入房间等待页 `/rooms/:roomId/wait`，另一个标签的房间列表人数实时更新（`player_joined`）。
   - 关闭或离开等待页后，另一个标签的房间人数减少（`player_left` + `game_state_update`）。
   - 在等待页中可以看到人数与房间状态信息由实时数据驱动（`game_state_update`）。

若以上现象都能观察到，即认为**第四阶段最小实时子系统通过基础验收**。

---

## 五、与其他阶段的关系

- 第一 ~ 三阶段脚本负责：
  - 环境与数据库连通性
  - 用户认证体系
  - 房间 REST 接口（创建 / 列表 / 加入 / 离开）
- 第四阶段脚本在此基础上，侧重验证：
  - WebSocket 连接与认证是否正常。
  - 房间人数与状态是否能通过最小消息集进行实时同步。

后续若扩展完整的实时消息体系（决策流程、AI 推演等），可以在本目录继续追加更细粒度的自动化测试脚本。


