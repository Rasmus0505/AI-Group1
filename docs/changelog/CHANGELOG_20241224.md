# 代码修改说明 - 2024年12月24日

## 概述

本次更新重点：
1. 局域网多玩家联机功能实现
2. AI 服务网络连接稳定性优化
3. WebSocket 增量同步与延迟检测

---

## 一、局域网联机功能

### 1.1 后端服务器改造

**文件**: `rebuild/production/backend/src/server.ts`

- 服务器绑定 `0.0.0.0` 允许局域网访问
- CORS 配置开放，开发环境允许所有来源
- 新增 `getLocalIpAddress()` 函数获取本机局域网 IP
- 启动时输出局域网访问地址
- 集成 UDP 广播服务用于服务器发现
- 生产环境下托管前端静态文件（支持单端口部署）

### 1.2 UDP 广播服务（新增）

**文件**: `rebuild/production/backend/src/utils/udpBroadcast.ts`

- 每 5 秒向局域网广播服务器信息（端口 41234）
- 响应客户端的 `DISCOVER_SERVER` 请求
- 广播内容包含服务器名称、端口、版本等信息

### 1.3 前端服务器配置页面（新增）

**文件**: `rebuild/production/frontend/src/pages/ServerConfig.tsx`

- 手动输入服务器 IP 和端口
- 自动发现局域网内的游戏服务器
- 连接测试功能
- 配置保存到本地存储

### 1.4 前端 UDP 发现服务（新增）

**文件**: `rebuild/production/frontend/src/services/udpDiscovery.ts`

- 浏览器环境下通过 HTTP 探测常见局域网地址
- 支持手动添加服务器
- 自动清理过期服务器记录

### 1.5 启动脚本改造

**文件**: `tools/run-dev.ps1`

- 自动检测本机局域网 IP（排除虚拟网卡）
- 自动生成前端 `.env` 文件，配置正确的后端地址
- 启动完成后输出局域网访问地址

---

## 二、WebSocket 增强

### 2.1 增量同步机制

**文件**: `rebuild/production/backend/src/services/roomStateService.ts`

- 新增 `calculateDelta()` 计算状态差异
- 新增 `getSessionDeltas()` 获取指定版本后的增量更新
- 保留最近 10 个增量更新记录

**文件**: `rebuild/production/backend/src/socket/gameHandler.ts`

- 新增 `get_session_deltas` 事件处理
- 新增 `ping` / `ping_with_timestamp` 事件用于延迟检测

### 2.2 前端 WebSocket 服务增强

**文件**: `rebuild/production/frontend/src/services/websocket.ts`

- 支持动态设置服务器地址
- 延迟检测（每 5 秒 ping 一次）
- 连接状态监听器机制
- 增量更新请求与应用

### 2.3 连接状态组件（新增）

**文件**: `rebuild/production/frontend/src/components/ConnectionStatus.tsx`

- 显示连接状态（已连接/连接中/未连接）
- 显示实时延迟（绿色 <100ms / 黄色 <300ms / 红色 ≥300ms）

---

## 三、AI 服务网络稳定性优化

**文件**: `rebuild/production/backend/src/services/aiService.ts`

- 新增 HTTP/HTTPS Agent，启用 keep-alive 连接复用
- 超时时间 60s → 120s
- 重试次数 3 次 → 5 次
- 新增 `ECONNRESET`、`EPIPE`、`EPROTO` 等网络错误识别
- 网络错误使用更长的退避时间（3s 起步，最长 30s）

---

## 四、其他改动

### 4.1 前端配置

**文件**: `rebuild/production/frontend/vite.config.ts`
- 添加 `host: '0.0.0.0'` 允许局域网访问

**文件**: `rebuild/production/frontend/.env.example`
- 注释改为英文

**文件**: `rebuild/production/frontend/src/App.tsx`
- 添加 `/server-config` 路由

**文件**: `rebuild/production/frontend/src/pages/Home.tsx`
- 添加"服务器配置"按钮
- 添加连接状态组件

---

## 五、修改文件清单

### 后端

| 文件 | 类型 | 说明 |
|------|------|------|
| `src/server.ts` | 修改 | 局域网绑定、UDP 广播集成 |
| `src/services/aiService.ts` | 修改 | 网络稳定性优化 |
| `src/services/roomStateService.ts` | 修改 | 增量同步机制 |
| `src/socket/gameHandler.ts` | 修改 | 增量更新与 ping 事件 |
| `src/utils/udpBroadcast.ts` | 新增 | UDP 广播服务 |

### 前端

| 文件 | 类型 | 说明 |
|------|------|------|
| `src/App.tsx` | 修改 | 添加服务器配置路由 |
| `src/pages/Home.tsx` | 修改 | 添加配置入口和状态组件 |
| `src/pages/ServerConfig.tsx` | 新增 | 服务器配置页面 |
| `src/services/websocket.ts` | 修改 | 动态地址、延迟检测 |
| `src/services/udpDiscovery.ts` | 新增 | 服务器发现服务 |
| `src/components/ConnectionStatus.tsx` | 新增 | 连接状态组件 |
| `vite.config.ts` | 修改 | 允许局域网访问 |
| `.env.example` | 修改 | 注释英文化 |

### 脚本

| 文件 | 说明 |
|------|------|
| `tools/run-dev.ps1` | 自动检测 IP、生成前端配置 |

### 其他

| 操作 | 说明 |
|------|------|
| 删除 `docs/**/*.pdf` | 清理 PDF 文件 |

---

## 六、使用说明

### 6.1 局域网联机

1. 主机运行 `run-dev.bat` 启动服务
2. 启动完成后会显示局域网访问地址
3. 其他玩家访问显示的前端地址（如 `http://192.168.1.100:5173`）
4. 如需手动配置，访问"服务器配置"页面

### 6.2 连接状态

- 登录后首页右上角显示连接状态和延迟
- 绿色表示延迟良好（<100ms）
- 黄色表示延迟一般（100-300ms）
- 红色表示延迟较高（>300ms）

---

**修改日期**: 2024年12月24日
