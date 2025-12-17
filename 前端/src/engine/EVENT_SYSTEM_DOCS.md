# 长周期事件监控系统文档

## 概述

长周期事件监控系统用于管理需要多个回合才能完成的游戏事件。系统会自动跟踪事件进度，定期显示进度更新，并在事件完成时生成特殊的系统提示注入到 AI 模型的 Context 中。

---

## 核心概念

### 1. OngoingEvent 类

代表一个正在进行的事件。

**构造函数参数：**
```javascript
new OngoingEvent(id, description, totalRounds, completionPrompt)
```

| 参数 | 类型 | 说明 |
|-----|------|------|
| `id` | string | 事件的唯一标识符（如 'cultivation', 'market_research'） |
| `description` | string | 事件描述（如 '修炼内功'） |
| `totalRounds` | number | 事件需要多少个回合才能完成 |
| `completionPrompt` | string | 事件完成时提示 AI 的指令（可选） |

**主要属性：**
- `id`: 事件ID
- `description`: 事件描述
- `totalRounds`: 总回合数
- `currentRound`: 当前进度回合（0 到 totalRounds）
- `isCompleted`: 事件是否已完成
- `completionPrompt`: 完成后的提示词指令

**主要方法：**
- `updateProgress()`: 增加进度，返回是否已完成
- `getProgressText()`: 获取进度显示文本（如 "[进行中] 修炼内功：进度 2/5"）
- `getProgress()`: 获取进度百分比

---

### 2. EventManager 类

全局事件管理器，用于管理所有活跃和已完成的事件。

**主要方法：**

#### 创建和管理事件
```javascript
// 创建并添加事件
eventManager.createAndAddEvent(id, description, totalRounds, completionPrompt)

// 直接添加已创建的事件
eventManager.addEvent(event)
```

#### 获取事件信息
```javascript
// 获取活跃事件列表
eventManager.getActiveEvents()

// 获取已完成事件列表
eventManager.getCompletedEvents()

// 获取事件摘要（包含进度百分比）
eventManager.getEventSummary()
```

#### 核心更新函数
```javascript
const updateResult = eventManager.updateEvents()
```

返回对象结构：
```javascript
{
    progressUpdates: Array,      // 进行中事件的进度文本数组
    completedEvents: Array,      // 本回合完成的事件数组
    hasSystemPrompts: boolean    // 是否有新的系统提示待注入
}
```

#### 获取系统提示
```javascript
// 获取待注入的系统提示数组
const prompts = eventManager.getSystemPrompts()

// 清空系统提示（注入后调用）
eventManager.clearSystemPrompts()
```

---

## 集成流程

### 步骤 1: 初始化事件

在游戏开始时创建所需的长周期事件：

```javascript
import { eventManager } from './eventSystem.js'

// 创建一个 5 回合的"修炼内功"事件
eventManager.createAndAddEvent(
    'cultivation',
    '修炼内功',
    5,
    '请根据当前的创新属性，推演修炼成果。'
)
```

### 步骤 2: 每回合更新事件

在玩家每次做出决策后调用更新函数：

```javascript
import { eventManager, generateProgressOutput } from './eventSystem.js'

// 更新所有事件进度
const updateResult = eventManager.updateEvents()

// 生成进度显示文本（用于输出到UI）
const progressText = generateProgressOutput(updateResult)

// 添加到游戏历史记录
gameState.history.push({
    id: Date.now(),
    type: 'system',
    text: progressText
})
```

### 步骤 3: 注入系统提示到 AI Context

获取系统提示并发送给 AI 模型：

```javascript
import { sendAction } from './api.js'

// 获取事件系统的系统提示
const systemPrompts = eventManager.getSystemPrompts()

// 发送给后端，系统提示将被注入到 AI 的 Context 中
const response = await sendAction(playerAction, systemPrompts)

// 注入后清空提示（防止重复）
eventManager.clearSystemPrompts()
```

---

## 完整示例

### 创建一个完整的回合流程

```javascript
import { eventManager, generateProgressOutput } from './eventSystem.js'
import { processDecision } from './gameLogic.js'
import { sendAction } from './api.js'

async function handleGameRound(state, playerDecision) {
    // 1. 处理玩家决策，更新属性和状态
    let newState = processDecision(state, playerDecision)

    // 2. 更新所有事件进度
    const updateResult = eventManager.updateEvents()

    // 3. 生成进度显示文本
    const progressText = generateProgressOutput(updateResult)
    
    // 4. 添加进度到历史记录
    if (progressText) {
        newState.history.push({
            id: Date.now(),
            type: 'system',
            text: progressText
        })
    }

    // 5. 获取系统提示（完成事件会生成提示）
    const systemPrompts = eventManager.getSystemPrompts()

    // 6. 发送到 AI，系统提示将被注入
    const response = await sendAction(playerDecision, systemPrompts)

    // 7. 清空系统提示（防止重复）
    eventManager.clearSystemPrompts()

    return response
}
```

### 游戏初始化

```javascript
import { eventManager } from './eventSystem.js'

function initializeGame() {
    // 创建初始事件
    eventManager.createAndAddEvent(
        'event_1',
        '修炼内功',
        5,
        '请根据修炼成果推演对公司创新力的影响。'
    )

    eventManager.createAndAddEvent(
        'event_2',
        '市场调研',
        3,
        '调研结果显示市场对我们的产品很感兴趣，请推演商机。'
    )

    // 返回初始状态
    return {
        turn: 1,
        attributes: {...},
        activeEvents: [],
        systemPrompts: [],
        history: []
    }
}
```

---

## UI 显示集成

### 显示事件进度条

```javascript
import { eventManager } from './eventSystem.js'

function renderEventProgress() {
    const summary = eventManager.getEventSummary()

    if (summary.activeCount === 0) {
        return <div>暂无正在进行的事件</div>
    }

    return (
        <div>
            <h3>正在进行的事件 ({summary.activeCount})</h3>
            {summary.events.map(event => (
                <div key={event.id}>
                    <p>{event.description}</p>
                    <progress 
                        value={event.currentRound} 
                        max={event.totalRounds}
                    />
                    <span>{event.currentRound}/{event.totalRounds}</span>
                </div>
            ))}
        </div>
    )
}
```

---

## 关键实现细节

### 1. 进度更新逻辑

每回合，`updateEvents()` 函数会：
1. 遍历所有活跃事件
2. 将每个事件的 `currentRound` 增加 1
3. 检查是否达到 `totalRounds`
   - 若达到：标记为完成，生成系统提示，移到已完成列表
   - 若未达到：生成进度文本

### 2. 系统提示注入

当事件完成时，生成的系统提示格式为：
```
【系统提示】玩家的"事件描述"事件已完成！[completionPrompt内容]
```

这条提示会被：
1. 存储在 `eventManager.systemPrompts` 数组中
2. 通过 `sendAction()` API 发送给后端
3. 在后端被注入到 AI 模型的 System Context 中
4. AI 根据提示生成相应的推演结果

### 3. 状态同步

事件状态通过以下方式保持同步：
- `gameState.activeEvents`: 保存当前活跃事件列表（用于持久化和UI）
- `gameState.systemPrompts`: 保存待注入的系统提示（用于 API 调用）
- 每回合在 `processDecision()` 后调用 `updateGameEvents()` 更新

---

## 特殊场景处理

### 场景 1: 游戏暂停/恢复

如果游戏暂停，事件进度不会更新（因为不调用 `updateEvents()`）。恢复时正常继续。

### 场景 2: 快进/回档

- **快进**：可以连续调用 `updateEvents()` 多次来模拟多个回合
- **回档**：需要重新加载游戏状态

### 场景 3: 事件触发新事件

```javascript
const updateResult = eventManager.updateEvents()

// 检查完成的事件
for (const completedEvent of updateResult.completedEvents) {
    if (completedEvent.id === 'cultivation') {
        // 修炼完成后触发新事件
        eventManager.createAndAddEvent(
            'show_results',
            '展示修炼结果',
            2,
            '展示修炼对属性的具体影响。'
        )
    }
}
```

---

## 调试和监控

### 导出事件数据

```javascript
import { eventManager } from './eventSystem.js'

// 获取当前所有事件数据
const eventData = {
    active: eventManager.getActiveEvents(),
    completed: eventManager.getCompletedEvents(),
    pendingPrompts: eventManager.getSystemPrompts()
}

console.log(eventData)
```

### 重置系统

```javascript
eventManager.reset()  // 清空所有事件
```

---

## 错误处理

### 常见问题

**问题**：系统提示没有被注入到 AI
- **原因**：忘记调用 `clearSystemPrompts()` 或没有将 `systemPrompts` 传递给 `sendAction()`
- **解决**：检查 `sendAction()` 调用是否包含 `systemPrompts` 参数

**问题**：事件不更新
- **原因**：没有调用 `updateEvents()`
- **解决**：确保在每个回合结束时调用此函数

**问题**：事件显示重复
- **原因**：没有清空 `systemPrompts`
- **解决**：在使用后立即调用 `clearSystemPrompts()`

---

## 性能考虑

- 事件系统使用数组存储，性能O(n)，其中n是活跃事件数
- 通常游戏中不会有超过 10-20 个同时活跃的事件
- 建议定期清理已完成的事件，或使用 `removeCompletedEvent()` 手动移除

---

## 总结

长周期事件监控系统提供了：
✅ 简洁的事件创建和管理接口
✅ 自动的进度跟踪和更新
✅ 灵活的系统提示注入机制
✅ 完整的事件生命周期管理
✅ 易于集成的 API

通过此系统，可以轻松实现复杂的多回合游戏逻辑，为玩家提供更沉浸式的游戏体验。
