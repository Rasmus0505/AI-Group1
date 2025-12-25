# 🔧 Git合并冲突解决指南

## 📋 冲突概览

当前分支 `郄晚` 与 `main` 分支存在以下冲突：

### 冲突文件：
1. `rebuild/production/backend/src/services/aiService.ts`
2. `rebuild/production/frontend/src/pages/GameSession.tsx`
3. `rebuild/production/frontend/src/pages/Rooms.tsx`
4. `docs/backend&frontend/后端功能说明.md` (删除冲突)
5. `docs/frontend/前端文件功能说明.md` (删除冲突)

## 🛠️ 逐步解决方案

### 步骤1: 开始合并
```bash
git checkout 郄晚
git merge origin/main
```

### 步骤2: 解决 aiService.ts 冲突

**冲突位置1 - 超时配置 (第86-93行):**
```typescript
<<<<<<< HEAD
private defaultRetries = 3;
private defaultTimeout = 60000; // 60秒超时
private initTimeout = 300000; // 初始化任务5分钟超时，与前端保持一致
=======
private defaultRetries = 5;  // 增加重试次数
private defaultTimeout = 120000; // 120秒超时（增加到2分钟）
>>>>>>> origin/main
```

**推荐解决方案:**
```typescript
private defaultRetries = 5;  // 增加重试次数（采用main分支的改进）
private defaultTimeout = 120000; // 120秒超时（采用main分支的改进）
private initTimeout = 300000; // 初始化任务5分钟超时，与前端保持一致（保留你的改进）
```

**冲突位置2 - 请求配置 (第396-407行):**
```typescript
<<<<<<< HEAD
timeout: timeout || this.defaultTimeout,
=======
timeout: this.defaultTimeout,
// 使用自定义 Agent 增加连接稳定性
// 验证状态码
validateStatus: (status) => status >= 200 && status < 300,
>>>>>>> origin/main
```

**推荐解决方案:**
```typescript
timeout: timeout || this.defaultTimeout,  // 保留你的灵活超时参数
// 使用自定义 Agent 增加连接稳定性（采用main分支的改进）
// 验证状态码
validateStatus: (status) => status >= 200 && status < 300,
```

### 步骤3: 解决 GameSession.tsx 冲突

**冲突位置1 - 超时检查逻辑 (第297-306行):**
```typescript
<<<<<<< HEAD
// 检查是否超时（仅限制玩家提交，主持人不受此限制）
const isHost = session.hostId && user?.id && session.hostId === user.id;
if (isTimeout && !isHost) {
=======
// 检查是否超时（仅限制玩家提交，主持人提交给AI不受此限制）
if (isTimeout) {
>>>>>>> origin/main
```

**推荐解决方案 (保留你的主持人权限逻辑):**
```typescript
// 检查是否超时（仅限制玩家提交，主持人不受此限制）
const isHost = session.hostId && user?.id && session.hostId === user.id;
if (isTimeout && !isHost) {
```

**冲突位置2 - 界面布局 (第535-633行):**
保留你的版本，因为包含了重要的功能改进（高级视图按钮、帮助按钮等）

### 步骤4: 解决 Rooms.tsx 冲突

**冲突位置1 - 导入语句 (第12-17行):**
```typescript
<<<<<<< HEAD
import { HelpButton } from '../components/HelpButton';
=======
import UserRegistryPanel from '../components/UserRegistryPanel';
import OnlineRoomsPanel from '../components/OnlineRoomsPanel';
>>>>>>> origin/main
```

**推荐解决方案 (合并两者):**
```typescript
import { HelpButton } from '../components/HelpButton';
import UserRegistryPanel from '../components/UserRegistryPanel';
import OnlineRoomsPanel from '../components/OnlineRoomsPanel';
```

**冲突位置2 - 界面布局:**
需要合并两个版本的界面改进

### 步骤5: 解决文档删除冲突

对于被删除的文档文件，建议：
```bash
# 删除这些文件，因为它们已经被新的文档结构替代
git rm "docs/backend&frontend/后端功能说明.md"
git rm "docs/frontend/前端文件功能说明.md"
```

## 🎯 完整解决流程

### 1. 开始合并
```bash
cd AI-Group1
git checkout 郄晚
git merge origin/main
```

### 2. 编辑冲突文件
使用文本编辑器打开每个冲突文件，按照上述建议解决冲突

### 3. 标记解决完成
```bash
git add rebuild/production/backend/src/services/aiService.ts
git add rebuild/production/frontend/src/pages/GameSession.tsx
git add rebuild/production/frontend/src/pages/Rooms.tsx
git rm "docs/backend&frontend/后端功能说明.md"
git rm "docs/frontend/前端文件功能说明.md"
```

### 4. 完成合并
```bash
git commit -m "解决与main分支的合并冲突

- 合并aiService.ts的超时配置改进
- 保留GameSession.tsx的主持人权限逻辑
- 合并Rooms.tsx的新组件导入
- 删除过时的文档文件"
```

## 💡 关键决策说明

### aiService.ts
- **采用main分支的重试次数增加** (5次重试更稳定)
- **采用main分支的默认超时增加** (120秒更合理)
- **保留你的初始化超时配置** (5分钟对AI初始化很重要)
- **合并连接稳定性改进**

### GameSession.tsx
- **保留你的主持人权限逻辑** (这是重要的功能改进)
- **保留你的界面改进** (高级视图、帮助按钮等)

### Rooms.tsx
- **合并所有组件导入** (保持功能完整性)
- **需要仔细合并界面布局**

## ⚠️ 注意事项

1. **测试合并后的代码** - 确保所有功能正常工作
2. **检查TypeScript编译** - 确保没有类型错误
3. **验证关键功能** - 特别是AI初始化和主持人权限
4. **更新文档** - 如果有新的功能变化

## 🚀 合并后建议

合并完成后，建议：
1. 运行完整的测试套件
2. 验证AI初始化功能
3. 测试主持人权限功能
4. 检查新增的局域网功能是否正常

这样的合并策略既保留了你的重要改进，又采纳了main分支的稳定性提升。