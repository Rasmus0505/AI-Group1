# 凡墙皆是门 - AI文字交互式游戏

## 项目结构

```
正式搭建/
├── backend/          # 后端项目
│   ├── src/         # 源代码
│   ├── prisma/      # Prisma schema和迁移
│   └── logs/        # 日志文件
└── frontend/         # 前端项目
    └── src/         # 源代码
```

## 快速开始

### 后端

1. 安装依赖
```bash
cd backend
npm install
```

2. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件，配置数据库和Redis连接
```

3. 启动数据库（Docker）
```bash
docker-compose up -d
```

4. 运行数据库迁移
```bash
npm run prisma:migrate
```

5. 启动开发服务器
```bash
npm run dev
```

### 前端

1. 安装依赖
```bash
cd frontend
npm install
```

2. 配置环境变量
```bash
cp .env.example .env
```

3. 启动开发服务器
```bash
npm run dev
```

## 开发任务清单

### 第一阶段：项目基础搭建 ✅

- [x] 后端项目初始化
- [x] 前端项目初始化
- [x] 基础工具和配置

### 第二阶段：用户认证系统

- [ ] 后端开发
- [ ] 前端开发
- [ ] 联调测试

## 技术栈

### 后端
- Node.js + Express + TypeScript
- Prisma ORM (PostgreSQL)
- Redis
- Socket.io (WebSocket)
- JWT认证

### 前端
- React + TypeScript
- Vite
- Zustand (状态管理)
- Ant Design (UI组件)
- React Router (路由)
- Socket.io-client (WebSocket)

## 架构设计

### 后端架构

#### Socket处理器架构（必须采纳）
```
backend/src/socket/
├── roomHandler.ts    # 房间加入/离开/匹配逻辑
├── gameHandler.ts    # 回合切换/博弈逻辑校验/计时器
├── messageHandler.ts # 消息路由和广播
└── index.ts          # Socket.io初始化
```

#### 状态同步机制（必须采纳）
- **后端驱动**：所有状态变更在后端计算，前端仅发送动作
- **Redis状态存储**：活跃房间状态存储在Redis，历史数据存储在PostgreSQL
- **断线重连**：从Redis读取快照恢复游戏状态

### 前端架构

#### Hooks层封装（建议采纳）
```
frontend/src/hooks/
├── useSocket.ts      # Socket连接管理
├── useGameLoop.ts    # 游戏循环逻辑
├── useRoom.ts        # 房间相关逻辑
└── useGameState.ts   # 游戏状态管理
```

#### 组件拆分优化（建议采纳）
- GameBoard（游戏主面板）与Sidebar（侧边栏）分离
- 使用React.memo避免频繁Socket更新导致整页重绘
- 状态隔离，每个组件只订阅需要的数据

