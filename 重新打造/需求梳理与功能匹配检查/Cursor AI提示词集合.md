# Cursor AI提示词集合 - 2天MVP快速开发

## 使用说明
1. 复制对应的提示词到Cursor AI
2. 根据实际情况调整参数
3. 迭代优化生成的代码
4. 遇到错误时，将错误信息也提供给AI修复

---

## 一、项目初始化

### 1.1 后端项目骨架

```
创建一个Express + TypeScript后端项目，要求：

技术栈：
- Express.js框架
- TypeScript
- Prisma ORM（PostgreSQL数据库）
- Redis（使用ioredis）
- Socket.io（WebSocket）
- jsonwebtoken（JWT认证）
- bcrypt（密码加密）
- dotenv（环境变量）

项目结构：
src/
  ├── routes/          # 路由文件
  │   ├── auth.ts      # 认证路由
  │   ├── rooms.ts     # 房间路由
  │   └── game.ts      # 游戏路由
  ├── controllers/     # 控制器
  ├── services/        # 业务逻辑
  ├── middleware/      # 中间件（JWT认证）
  ├── models/          # Prisma模型
  ├── utils/           # 工具函数
  ├── websocket/       # WebSocket处理
  └── server.ts        # 入口文件

功能要求：
- JWT认证中间件
- 错误处理中间件
- CORS配置
- 环境变量配置
- 数据库连接（Prisma）
- Redis连接
- Socket.io服务器集成

生成完整的项目结构和基础代码。
```

### 1.2 前端项目骨架

```
创建一个React + Vite + TypeScript前端项目，要求：

技术栈：
- React 18
- Vite
- TypeScript
- React Router v6
- Zustand（状态管理）
- Axios（HTTP客户端）
- Socket.io-client（WebSocket）
- Ant Design（UI组件库）

项目结构：
src/
  ├── pages/           # 页面组件
  │   ├── Login.tsx
  │   ├── Register.tsx
  │   ├── Home.tsx
  │   ├── RoomList.tsx
  │   ├── RoomDetail.tsx
  │   ├── HostConfig.tsx
  │   └── Game.tsx
  ├── components/      # 通用组件
  ├── stores/          # Zustand状态管理
  ├── services/        # API服务
  ├── hooks/           # 自定义Hooks
  ├── utils/           # 工具函数
  └── App.tsx          # 主组件

功能要求：
- 路由配置（React Router）
- Zustand store结构
- Axios拦截器（Token管理）
- Socket.io客户端封装
- Ant Design主题配置
- 环境变量配置

生成完整的项目结构和基础代码。
```

---

## 二、用户认证系统

### 2.1 后端 - 用户模型和认证API

```
实现用户认证系统，要求：

1. Prisma模型：
model User {
  id        String   @id @default(uuid())
  username  String   @unique
  email     String   @unique
  password  String   // bcrypt加密后的密码
  nickname  String?
  level     Int      @default(1)
  experience Int     @default(0)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
}

2. API路由：
- POST /api/auth/register
  请求体：{ username, email, password, nickname }
  返回：{ code: 200, data: { user_id, token } }
  
- POST /api/auth/login
  请求体：{ username, password }
  返回：{ code: 200, data: { user_id, token, user_info } }
  
- GET /api/user/info
  需要JWT认证
  返回：{ code: 200, data: { user_id, username, nickname, level, experience } }

3. 功能要求：
- 密码使用bcrypt加密（10轮）
- JWT token包含user_id和username
- Token有效期24小时
- 注册时验证用户名和邮箱唯一性
- 登录时验证密码
- 统一的错误响应格式：{ code, message, data }

生成完整的控制器、服务和路由代码。
```

### 2.2 前端 - 登录注册页面

```
创建用户认证页面，要求：

1. 登录页面（Login.tsx）：
- 使用Ant Design的Form组件
- 字段：用户名、密码
- "记住我"复选框
- 登录按钮（loading状态）
- 跳转注册页链接
- 调用POST /api/auth/login
- Token存储到localStorage
- 登录成功后跳转到/home

2. 注册页面（Register.tsx）：
- 使用Ant Design的Form组件
- 字段：用户名、邮箱、密码、确认密码、昵称
- 实时表单验证：
  - 用户名：3-20字符，字母数字下划线
  - 邮箱：格式验证
  - 密码：至少8位，包含字母和数字
  - 确认密码：与密码一致
- 注册按钮（loading状态）
- 调用POST /api/auth/register
- 注册成功后自动登录并跳转

3. 使用Zustand创建authStore：
- isAuthenticated: boolean
- user: User | null
- token: string | null
- login函数
- logout函数
- checkAuth函数（检查localStorage中的token）

生成完整的组件代码和状态管理。
```

---

## 三、房间系统

### 3.1 后端 - 房间模型和API

```
实现房间管理系统，要求：

1. Prisma模型：
model Room {
  id            String   @id @default(uuid())
  name          String
  creatorId     String
  hostId        String   // 主持人ID，默认等于creatorId
  maxPlayers    Int
  currentPlayers Int     @default(0)
  status        String   @default("waiting") // waiting, configuring, playing, finished
  password      String?  // 可选密码（bcrypt加密）
  createdAt     DateTime @default(now())
  startedAt     DateTime?
  finishedAt    DateTime?
  players       RoomPlayer[]
  hostConfig    HostConfig?
}

model RoomPlayer {
  id        String   @id @default(uuid())
  roomId    String
  userId    String
  role      String   // host, human_player
  playerIndex Int?    // 决策主体索引
  isHuman   Boolean  @default(true)
  status    String   @default("joined") // joined, ready, playing, left
  joinedAt  DateTime @default(now())
  leftAt    DateTime?
}

2. API路由：
- POST /api/rooms/create
  请求体：{ name, max_players, password? }
  返回：{ code: 200, data: { room_id, room_info } }
  
- GET /api/rooms/list?page=1&limit=20&status=waiting
  返回：{ code: 200, data: { rooms: [], total, page, limit } }
  
- POST /api/rooms/:room_id/join
  请求体：{ password? }
  返回：{ code: 200, data: { room_id, joined: true } }
  
- POST /api/rooms/:room_id/leave
  返回：{ code: 200, message: "已离开房间" }

3. WebSocket事件：
- player_joined: { room_id, user_id, user_info }
- player_left: { room_id, user_id }

4. 功能要求：
- 创建房间时，创建者自动成为主持人并加入房间
- 加入房间时检查密码（如有）
- 检查房间是否已满
- 更新current_players计数
- WebSocket广播玩家加入/离开事件

生成完整的代码。
```

### 3.2 前端 - 房间管理页面

```
创建房间管理页面，要求：

1. 房间列表页面（RoomList.tsx）：
- 使用Ant Design的List组件展示房间卡片
- 每个房间卡片显示：
  - 房间名称
  - 创建者昵称
  - 当前玩家数/最大玩家数
  - 房间状态标签（Tag组件）
  - "加入"按钮
- 顶部筛选栏：
  - 状态筛选（Select组件）
  - 搜索框（房间名称）
- 分页组件（Pagination）
- 刷新按钮
- 调用GET /api/rooms/list
- 点击加入按钮调用POST /api/rooms/:id/join

2. 创建房间页面（CreateRoom.tsx）：
- 使用Ant Design的Form组件
- 字段：房间名称、最大玩家数（2-10）、密码（可选）
- 提交按钮
- 调用POST /api/rooms/create
- 创建成功后跳转到房间详情页

3. 房间等待页面（RoomDetail.tsx）：
- 显示房间信息（名称、状态、配置）
- 玩家列表（List组件）：
  - 玩家头像、昵称、等级
  - 准备状态（Tag）
  - 准备按钮（非准备玩家）
- 主持人操作区域：
  - "进入初始化设定"按钮（未完成配置时显示）
  - "开始游戏"按钮（完成配置后显示）
- WebSocket监听player_joined和player_left事件
- 实时更新玩家列表

4. Zustand store（roomStore）：
- list: Room[]
- currentRoom: Room | null
- loading: boolean
- fetchRoomList函数
- createRoom函数
- joinRoom函数
- leaveRoom函数

生成完整的组件代码。
```

---

## 四、WebSocket实时通信

### 4.1 后端 - WebSocket服务器

```
实现WebSocket服务器，要求：

1. Socket.io配置：
- 集成到Express服务器
- 使用JWT认证（socket.handshake.auth.token）
- 房间命名空间：/rooms/:roomId
- 游戏命名空间：/game/:sessionId

2. 连接管理：
- 连接时验证JWT token
- 存储连接信息到Redis：ws:{user_id}:connection
- 心跳检测（每30秒ping）
- 自动重连机制

3. 消息类型实现：
- player_joined: 玩家加入房间时广播
- player_left: 玩家离开房间时广播
- game_state_update: 游戏状态更新时推送
- decision_submitted: 玩家提交决策时推送
- decision_status_update: 决策状态更新时推送
- decision_deadline_update: 决策倒计时更新（每秒）
- round_stage_changed: 回合阶段切换时推送
- inference_started: AI推演开始时推送
- inference_completed: AI推演完成时推送
- multi_round_event_progress: 多回合事件进度更新
- error: 错误消息推送

4. 功能要求：
- 消息序列号保证顺序
- 消息去重（相同ID不重复处理）
- 断线重连后同步最新状态

生成完整的WebSocket服务器代码。
```

### 4.2 前端 - WebSocket客户端

```
实现WebSocket客户端封装，要求：

1. WebSocketService类：
```typescript
class WebSocketService {
  private socket: Socket | null = null;
  private reconnectAttempts = 0;
  
  connect(token: string): void
  disconnect(): void
  send(event: string, data: any): void
  on(event: string, callback: Function): void
  private reconnect(): void
  private registerHandlers(): void
}
```

2. 消息处理：
- 连接状态管理（connected, reconnecting）
- 所有消息类型的处理函数
- 消息路由到对应的store更新
- 错误处理和重连

3. 集成到Zustand store：
- websocketStore管理连接状态
- 各功能store监听对应消息类型

4. 使用示例：
- 在组件中useEffect连接WebSocket
- 监听消息并更新UI
- 组件卸载时断开连接

生成完整的WebSocket客户端代码。
```

---

## 五、主持人初始化设定

### 5.1 后端 - 主持人配置API

```
实现主持人配置系统，要求：

1. Prisma模型：
model HostConfig {
  id                    String   @id @default(uuid())
  roomId                String   @unique
  apiConfig             Json     // {provider, endpoint, method, headers, request_body_template}
  gameRules             String?
  totalDecisionEntities Int
  humanPlayerCount      Int
  aiPlayerCount         Int      // 自动计算
  decisionTimeLimit     Int      @default(4) // 分钟
  timeoutStrategy       String   @default("auto_submit") // auto_submit, skip, penalty
  initializationCompleted Boolean @default(false)
  createdAt             DateTime @default(now())
  updatedAt             DateTime @updatedAt
}

2. API路由：
- GET /api/rooms/:room_id/host-config
  返回完整配置信息
  
- POST /api/rooms/:room_id/host-config/api
  请求体：{ provider, endpoint, method, headers, request_body_template }
  保存API配置
  
- POST /api/rooms/:room_id/host-config/rules
  请求体：{ game_rules }
  保存游戏规则
  
- POST /api/rooms/:room_id/host-config/players
  请求体：{ total_decision_entities, human_player_count, decision_time_limit, timeout_strategy }
  保存玩家配置，自动计算ai_player_count
  
- POST /api/rooms/:room_id/host-config/complete
  请求体：{ validate?: boolean }
  完成初始化，设置initialization_completed=true

3. WebSocket事件：
- host_config_updated: 配置更新时推送
- initialization_completed: 完成初始化时推送

4. 功能要求：
- 只有主持人可以修改配置
- 配置验证（确保人类玩家数 <= 决策主体数）
- 完成初始化后才能开始游戏

生成完整的代码。
```

### 5.2 前端 - 主持人配置页面

```
创建主持人初始化设定页面，要求：

1. 页面布局（HostConfig.tsx）：
- 使用Ant Design的Steps组件（3步）
- 步骤1：API配置
- 步骤2：游戏规则
- 步骤3：玩家配置

2. 步骤1 - API配置表单：
- 提供商选择（Select）：DeepSeek（默认）、OpenAI、自定义
- 选择后自动填充默认配置：
  - DeepSeek: endpoint="https://api.deepseek.com/v1/chat/completions"
  - OpenAI: endpoint="https://api.openai.com/v1/chat/completions"
- 请求方法（Select）：POST（默认）
- 请求头编辑器（可添加/删除键值对）
- 请求体模板编辑器（CodeEditor组件，JSON格式）
- "测试连接"按钮（可选）
- "保存"按钮（自动保存）

3. 步骤2 - 游戏规则编辑器：
- 多行文本编辑器（TextArea，支持Markdown）
- 字符计数
- 规则预览（可选）
- "保存"按钮

4. 步骤3 - 玩家配置：
- 决策主体数量（InputNumber，2-20）
- 人类玩家数量（InputNumber，1-{决策主体数}）
- AI玩家数量（只读显示，自动计算）
- 决策时限（InputNumber，1-30分钟，默认4）
- 超时处理策略（Select）：自动提交、跳过、惩罚
- "完成初始化"按钮

5. 功能要求：
- 每步保存后显示成功提示
- 步骤导航（可返回上一步）
- 配置验证提示
- 完成初始化后跳转回房间等待页

生成完整的组件代码。
```

---

## 六、游戏核心机制

### 6.1 后端 - 游戏会话和决策API

```
实现游戏核心机制，要求：

1. Prisma模型：
model GameSession {
  id              String   @id @default(uuid())
  roomId          String   @unique
  currentRound    Int      @default(1)
  totalRounds     Int?
  roundStatus     String   @default("decision") // decision, review, inference, result
  decisionDeadline DateTime?
  gameState       Json?    // 完整游戏状态
  status          String   @default("playing") // playing, paused, finished
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  actions         PlayerAction[]
  events          TemporaryEvent[]
}

model PlayerAction {
  id          String   @id @default(uuid())
  sessionId   String
  userId      String
  playerIndex Int
  round       Int
  actionText  String
  status      String   @default("pending") // pending, submitted, reviewed, inferred
  reviewedBy  String?  // 审核人（主持人）
  reviewedAt  DateTime?
  aiResponse  Json?    // AI推演结果
  result      Json?    // 操作结果
  submittedAt DateTime @default(now())
}

2. API路由：
- POST /api/game/:room_id/start
  功能：
  - 检查初始化是否完成
  - 创建GameSession
  - 根据HostConfig创建决策主体（人类玩家+AI玩家）
  - 初始化游戏状态
  - 设置第一回合决策时限
  - 返回session_id和初始状态
  
- POST /api/game/:session_id/decision
  请求体：{ action_text, round }
  功能：
  - 验证回合是否匹配
  - 验证是否已提交过
  - 创建PlayerAction记录
  - 更新决策状态
  - WebSocket推送decision_submitted
  
- GET /api/game/:session_id/round/:round/decisions
  返回：{ round, round_status, decision_deadline, time_remaining, decisions: [], submitted_count, total_players }
  
- GET /api/game/:session_id/round/:round/decisions/review
  仅主持人可见
  返回所有玩家决策详情

3. 决策时限管理：
- 使用Redis存储定时器
- 定时器到期时：
  - 根据timeout_strategy处理未提交决策
  - 切换回合阶段到review
  - WebSocket推送round_stage_changed

生成完整的代码。
```

### 6.2 前端 - 游戏主界面

```
创建游戏主界面，要求：

1. 页面布局（Game.tsx）：
- 顶部状态栏：
  - 当前回合数
  - 回合阶段显示（Steps组件）
  - 决策倒计时（圆形进度条+数字）
  - 退出游戏按钮
  
- 左侧面板：玩家信息
  - 当前玩家卡片（高亮）
  - 其他玩家列表
  - 每个玩家显示决策状态（已提交/未提交图标）
  
- 中间面板：游戏主区域
  - 决策阶段：决策输入框（TextArea）+ 提交按钮
  - 审核阶段（仅主持人）：决策审核列表
  - 推演阶段：加载提示
  - 结果阶段：AI剧情展示（打字机效果）
  
- 右侧面板：
  - 排名面板（List组件）
  - 决策状态面板（显示所有玩家决策状态）
  - 多回合事件进度面板（事件列表+进度条）

2. 决策倒计时组件：
- 使用Ant Design的Progress组件（type="circle"）
- 显示剩余时间（MM:SS格式）
- 剩余30秒时变红色警告
- 实时更新（每秒）

3. 决策输入组件：
- TextArea（多行输入）
- 提交按钮（已提交后禁用）
- 已提交提示（Tag组件）
- Ctrl+Enter快捷键提交

4. 决策状态显示：
- 所有玩家列表
- 每个玩家显示：
  - 头像、昵称
  - 决策状态图标（CheckCircle/ClockCircle）
  - 提交时间（悬停显示）

5. Zustand store（gameStore）：
- currentSession: GameSession | null
- gameState: GameState | null
- decisions: Decision[]
- roundStatus: string
- decisionDeadline: Date | null
- timeRemaining: number

生成完整的组件代码。
```

---

## 七、AI推演引擎

### 7.1 后端 - AI推演服务

```
实现AI推演引擎，要求：

1. AI服务封装（aiService.ts）：
```typescript
class AIService {
  async callAI(config: ApiConfig, prompt: string): Promise<AIResponse>
  private buildRequest(config: ApiConfig, prompt: string): RequestConfig
  private parseResponse(response: any): AIResponse
}
```

2. Prompt构建函数（promptBuilder.ts）：
```typescript
function buildInferencePrompt(params: {
  gameRules: string;
  gameState: GameState;
  decisions: Decision[];
  activeEvents: MultiRoundEvent[]; // 包含进度信息
  temporaryRules: Rule[];
  round: number;
}): string
```

Prompt模板：
```
{gameRules}

活跃的多回合事件（需要特别关注）：
{activeEvents}
每个事件包含：
- 事件内容：{event_content}
- 当前进度：{current_progress}/{target_progress} ({progress_percentage}%)
- 事件状态：{status}
- 进度历史：{progress_history}
- 最后更新回合：{last_updated_round}

重要提醒：如果存在多回合事件，必须在推演中考虑这些事件的当前进度，并在剧情中体现事件的发展状态。每回合都要更新事件进度，确保事件线程不会丢失。

当前游戏状态：
{gameState}

玩家操作：
{decisions}

临时规则：
{temporaryRules}

请根据上述信息推演结果：
1. 操作是否合法
2. 操作成功概率
3. 操作结果描述
4. 对游戏状态的影响
5. 对多回合事件进度的影响（如有）
6. 生成生动的剧情描述

要求：
- 严格遵循游戏规则
- 如果存在多回合事件，必须在推演中体现事件进度，并更新事件状态
- 结果要符合游戏逻辑
- 剧情要有趣味性
```

3. API路由：
- POST /api/game/:session_id/round/:round/submit-to-ai
  请求体：{ decision_ids?, temporary_events?, temporary_rules? }
  功能：
  - 验证主持人权限
  - 收集所有决策（如未指定decision_ids，则收集所有已审核决策）
  - 自动获取所有活跃的多回合事件及其进度
  - 创建临时事件/规则记录
  - 构建AI推演Prompt（包含事件进度）
  - 调用AI API
  - 解析AI响应
  - 更新游戏状态
  - 更新多回合事件进度
  - 更新PlayerAction状态
  - WebSocket推送inference_started和inference_completed
  - 返回推演结果

4. 异步处理：
- 使用Redis队列管理AI任务
- 立即返回"processing"状态
- 后台异步处理
- 完成后WebSocket推送结果

生成完整的代码。
```

### 7.2 前端 - AI剧情展示

```
实现AI剧情展示组件，要求：

1. 剧情展示组件（NarrativeDisplay.tsx）：
- 使用打字机效果（逐字显示）
- 使用requestAnimationFrame实现流畅动画
- 支持暂停/继续
- 自动滚动到底部
- 剧情文本样式区分：
  - 场景描述：普通文本
  - 事件：高亮显示
  - 结果：加粗显示

2. 推演结果展示：
- 显示每个玩家的操作结果
- 显示游戏状态变化
- 显示资源变化动画

3. 推演进度显示：
- 加载状态（Spin组件）
- 进度提示（"AI正在推演中..."）
- 预估时间显示

生成完整的组件代码。
```

---

## 八、多回合事件进度跟踪

### 8.1 后端 - 事件进度管理

```
实现多回合事件进度跟踪，要求：

1. Prisma模型：
model TemporaryEvent {
  id              String   @id @default(uuid())
  sessionId       String
  round           Int      // 生效回合
  eventType       String   // single_round, multi_round
  eventContent    String
  effectiveRounds Int      // 有效回合数
  progress        Json     // {current, target, progress_percentage, status, progress_history, last_updated_round}
  createdBy       String   // 创建人（主持人）
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  completedAt     DateTime?
}

progress JSON结构：
{
  "current": 0,
  "target": 100,
  "progress_percentage": 0,
  "status": "active", // active, completed, failed
  "progress_history": [
    {
      "round": 1,
      "progress": 0,
      "description": "事件开始",
      "updated_at": "2024-01-01T12:00:00Z"
    }
  ],
  "last_updated_round": 1
}

2. API路由：
- POST /api/game/:session_id/round/:round/temporary-event
  请求体：{
    event_type: "multi_round",
    event_content: "突然发生地震...",
    effective_rounds: 3,
    progress?: { current: 0, target: 100 } // 可选，多回合事件可设置初始进度
  }
  功能：
  - 创建事件记录
  - 初始化进度（如未提供则默认0）
  - 返回event_id和progress
  
- PUT /api/game/:session_id/events/:event_id/progress
  请求体：{
    progress: { current: 50, description?: "事件进展到一半" },
    auto_update: false // 是否自动更新
  }
  功能：
  - 更新事件进度
  - 计算progress_percentage
  - 添加到progress_history
  - 更新last_updated_round
  - 如果progress达到target，设置status为completed
  - WebSocket推送multi_round_event_progress
  
- GET /api/game/:session_id/events/active
  返回所有status="active"的多回合事件及其完整进度信息

3. AI推演集成：
在buildInferencePrompt函数中：
- 自动调用getActiveEvents获取所有活跃事件
- 将事件进度信息包含在Prompt中
- AI返回结果后，解析事件进度更新
- 调用updateEventProgress更新进度

4. WebSocket事件：
- multi_round_event_progress: 进度更新时推送
- multi_round_event_completed: 事件完成/失败时推送

5. 事件完成判定：
- 进度达到100%时自动标记completed
- 超过effective_rounds未完成时标记failed

生成完整的代码。
```

### 8.2 前端 - 事件进度显示

```
实现多回合事件进度显示，要求：

1. 事件进度面板组件（MultiRoundEventPanel.tsx）：
- 显示在游戏主界面右侧
- 标题："多回合事件"
- 事件列表（List组件）

2. 事件卡片组件（EventCard.tsx）：
每个事件显示：
- 事件内容（文本描述）
- 进度条（Progress组件）：
  - 显示当前进度/目标进度
  - 显示百分比
  - 根据状态变色（进行中-蓝色，已完成-绿色，失败-红色）
- 事件状态标签（Tag组件）
- 最后更新回合数
- "查看详情"按钮（展开进度历史）

3. 事件详情弹窗（EventDetailModal.tsx）：
- 事件完整描述
- 进度条（大尺寸）
- 进度历史时间线（Timeline组件）：
  - 显示每回合的进度变化
  - 显示进度描述
  - 显示更新时间
- 关闭按钮

4. 进度更新动画：
- 进度条数值变化动画（数字滚动）
- 进度更新提示（Notification）
- 事件完成/失败提示（Modal）

5. WebSocket集成：
- 监听multi_round_event_progress消息
- 实时更新事件进度
- 监听multi_round_event_completed消息
- 显示完成/失败提示

6. Zustand store（eventStore）：
- activeEvents: MultiRoundEvent[]
- loading: boolean
- fetchActiveEvents函数
- updateEventProgress函数

生成完整的组件代码。
```

---

## 九、主持人审核功能

### 9.1 后端 - 审核和提交推演API

```
实现主持人审核功能，要求：

1. API路由：
- GET /api/game/:session_id/round/:round/decisions/review
  仅主持人可见
  返回所有玩家决策详情（包括决策内容）
  
- POST /api/game/:session_id/round/:round/submit-to-ai
  请求体：{
    decision_ids?: string[], // 可选，不传则提交所有已审核决策
    temporary_events?: [{
      event_type: "single_round" | "multi_round",
      event_content: string,
      effective_rounds: number,
      progress?: { current: number, target: number }
    }],
    temporary_rules?: [{
      rule_type: "single_round" | "multi_round",
      rule_content: string,
      effective_rounds: number,
      priority: number
    }]
  }
  功能：
  - 验证主持人权限
  - 收集所有决策（如未指定decision_ids，则收集所有status="submitted"的决策）
  - 自动获取所有活跃的多回合事件及其进度（重要！）
  - 创建临时事件/规则记录
  - 构建AI推演Prompt（包含事件进度）
  - 调用AI推演服务
  - 更新游戏状态
  - 更新多回合事件进度
  - WebSocket推送inference_started
  - 返回inference_id

2. 临时规则模型：
model TemporaryRule {
  id              String   @id @default(uuid())
  sessionId       String
  round           Int
  ruleType        String
  ruleContent     String
  effectiveRounds Int
  priority        Int
  createdAt       DateTime @default(now())
}

生成完整的代码。
```

### 9.2 前端 - 主持人审核界面

```
创建主持人审核界面，要求：

1. 审核界面（ReviewPanel.tsx）：
显示在游戏主界面中间（审核阶段）

2. 决策审核列表：
- 使用Ant Design的Table组件
- 列：玩家、决策内容、提交时间、审核状态
- 批量选择复选框
- "批量审核"按钮

3. 临时事件添加区域：
- 折叠面板（Collapse）
- 表单字段：
  - 事件类型（Radio）：单回合/多回合
  - 事件内容（TextArea）
  - 有效回合数（InputNumber，多回合事件时显示）
  - 初始进度设置（多回合事件时显示）：
    - 当前进度（InputNumber）
    - 目标进度（InputNumber，默认100）
  - "添加事件"按钮
- 已添加事件列表：
  - 显示事件内容、类型、进度（如有）
  - "删除"按钮

4. 临时规则添加区域：
- 类似临时事件的表单
- 优先级设置（InputNumber）

5. 提交推演区域：
- 配置摘要显示：
  - 决策数量
  - 临时事件数量（显示多回合事件及其进度）
  - 临时规则数量
- "提交给AI推演"按钮
- 确认对话框（Modal）

6. 功能要求：
- 实时显示活跃的多回合事件及其进度
- 提交前显示配置预览
- 提交后显示推演进度

生成完整的组件代码。
```

---

## 十、WebSocket消息完善

### 10.1 后端 - 所有消息类型

```
实现所有WebSocket消息类型，要求：

1. 决策相关消息：
- decision_submitted: 玩家提交决策时推送
- decision_status_update: 决策状态变化时推送（每秒更新）
- decision_deadline_update: 决策倒计时更新（每秒推送）

2. 回合相关消息：
- round_stage_changed: 回合阶段切换时推送

3. AI推演消息：
- inference_started: AI推演开始时推送
- inference_completed: AI推演完成时推送（包含结果）

4. 事件进度消息：
- multi_round_event_progress: 事件进度更新时推送
- multi_round_event_completed: 事件完成/失败时推送

5. 消息格式示例：
```javascript
// decision_submitted
{
  type: "decision_submitted",
  session_id: "uuid",
  round: 1,
  player_index: 1,
  player_name: "玩家1",
  submitted_at: "2024-01-01T12:00:00Z"
}

// multi_round_event_progress
{
  type: "multi_round_event_progress",
  session_id: "uuid",
  event_id: "uuid",
  round: 2,
  event_content: "突然发生地震...",
  progress: {
    current: 50,
    target: 100,
    progress_percentage: 50,
    status: "active",
    description: "事件进展到一半",
    last_updated_round: 2
  },
  progress_history: [...]
}
```

6. 消息推送时机：
- 决策提交：立即推送
- 决策状态：定时推送（每秒）
- 倒计时：定时推送（每秒）
- 阶段切换：立即推送
- 推演开始：立即推送
- 推演完成：立即推送
- 事件进度：更新时立即推送

生成完整的WebSocket消息推送代码。
```

### 10.2 前端 - 消息处理

```
实现所有WebSocket消息处理，要求：

1. 消息路由函数：
```typescript
function handleWebSocketMessage(type: string, data: any) {
  switch(type) {
    case 'decision_submitted':
      updateDecisionStatus(data);
      break;
    case 'decision_status_update':
      updateAllDecisionsStatus(data);
      break;
    case 'decision_deadline_update':
      updateCountdown(data);
      break;
    case 'round_stage_changed':
      updateRoundStage(data);
      break;
    case 'inference_started':
      showInferenceLoading(data);
      break;
    case 'inference_completed':
      displayInferenceResult(data);
      break;
    case 'multi_round_event_progress':
      updateEventProgress(data);
      break;
    case 'multi_round_event_completed':
      showEventCompleted(data);
      break;
  }
}
```

2. 各消息类型的处理：
- 更新对应的Zustand store
- 更新UI显示
- 显示通知（如需要）

3. 消息去重：
- 使用消息ID或时间戳去重
- 避免重复处理相同消息

生成完整的消息处理代码。
```

---

## 十一、快速调试提示词

### 11.1 错误修复

```
遇到错误时使用：
"这段代码报错了：[粘贴错误信息]

相关代码：
[粘贴代码]

请分析错误原因并修复。"
```

### 11.2 代码优化

```
"这段代码可以优化吗？请：
1. 提高性能
2. 改善代码结构
3. 添加错误处理
4. 添加类型定义

代码：
[粘贴代码]"
```

### 11.3 功能完善

```
"这个功能需要完善：
1. [功能点1]
2. [功能点2]
3. [功能点3]

当前代码：
[粘贴代码]

请添加这些功能。"
```

---

## 十二、数据库迁移

### 12.1 Prisma迁移

```
生成Prisma迁移文件，要求：

1. 创建所有模型：
- User
- Room
- RoomPlayer
- HostConfig
- GameSession
- PlayerAction
- TemporaryEvent
- TemporaryRule
- GameHistory（可选）

2. 关系定义：
- Room -> RoomPlayer (一对多)
- Room -> HostConfig (一对一)
- Room -> GameSession (一对一)
- GameSession -> PlayerAction (一对多)
- GameSession -> TemporaryEvent (一对多)

3. 索引：
- User.username, User.email
- Room.status
- PlayerAction.sessionId, PlayerAction.round
- TemporaryEvent.sessionId, TemporaryEvent.progress.status

生成Prisma schema和迁移文件。
```

---

## 使用技巧

1. **批量生成**：一次性描述完整功能，让AI生成整个模块
2. **迭代优化**：先生成基础代码，再逐步添加功能
3. **错误修复**：遇到错误直接让AI修复
4. **代码复用**：让AI参考已有代码风格
5. **类型安全**：要求AI生成完整的TypeScript类型定义

---

## 注意事项

1. 生成的代码需要根据实际情况调整
2. 数据库连接字符串需要配置
3. 环境变量需要设置
4. AI API密钥需要配置
5. 每个功能完成后都要测试

---

**文档版本**：v1.0  
**适用场景**：2天MVP快速开发  
**使用工具**：Cursor AI

