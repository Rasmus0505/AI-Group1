# 长周期事件监控系统 - 快速参考

## 📋 快速开始

### 1. 导入模块
```javascript
import { eventManager, OngoingEvent } from './engine/eventSystem.js'
import { processDecision, updateGameEvents } from './engine/gameLogic.js'
import { sendAction } from './engine/api.js'
```

### 2. 创建事件
```javascript
eventManager.createAndAddEvent(
    'event_id',           // 唯一ID
    '事件名称',            // 描述
    5,                    // 需要5个回合完成
    '完成后的AI提示词'     // 事件完成时提示AI
)
```

### 3. 每回合更新
```javascript
// 在玩家决策后调用
const updateResult = eventManager.updateEvents()

// 获取进度文本
const progressText = generateProgressOutput(updateResult)

// 获取系统提示（发送给AI）
const systemPrompts = eventManager.getSystemPrompts()

// 发送给后端AI
await sendAction(playerAction, systemPrompts)

// 清空提示（防止重复）
eventManager.clearSystemPrompts()
```

---

## 📊 核心数据结构

### OngoingEvent 对象
```javascript
{
    id: string,              // 事件ID
    description: string,     // 事件描述
    totalRounds: number,     // 总回合数
    currentRound: number,    // 当前进度 (0-totalRounds)
    completionPrompt: string,// 完成时的AI提示
    isCompleted: boolean     // 是否已完成
}
```

### updateEvents() 返回值
```javascript
{
    progressUpdates: [        // 进行中事件的进度文本
        "[进行中] 修炼内功：进度 1/5",
        "[进行中] 市场调研：进度 2/3"
    ],
    completedEvents: [        // 本回合完成的事件
        { id: 'cultivation', description: '修炼内功', ... }
    ],
    hasSystemPrompts: boolean // 是否有系统提示待注入
}
```

---

## 🎯 常用方法速查

| 方法 | 说明 | 示例 |
|-----|------|------|
| `createAndAddEvent()` | 创建并添加事件 | `eventManager.createAndAddEvent('id', '名称', 5, '提示')` |
| `updateEvents()` | 更新所有事件进度 | `const result = eventManager.updateEvents()` |
| `getActiveEvents()` | 获取活跃事件列表 | `const events = eventManager.getActiveEvents()` |
| `getCompletedEvents()` | 获取已完成事件列表 | `const done = eventManager.getCompletedEvents()` |
| `getSystemPrompts()` | 获取待注入的系统提示 | `const prompts = eventManager.getSystemPrompts()` |
| `clearSystemPrompts()` | 清空系统提示 | `eventManager.clearSystemPrompts()` |
| `getEventSummary()` | 获取事件摘要（含进度%） | `const summary = eventManager.getEventSummary()` |
| `hasActiveEvents()` | 检查是否有活跃事件 | `if (eventManager.hasActiveEvents()) {...}` |
| `reset()` | 重置管理器 | `eventManager.reset()` |

---

## 🔄 标准事件流程

```
初始化游戏
  └─ 创建长周期事件
       └─ eventManager.createAndAddEvent(...)

每个回合
  ├─ 玩家做出决策
  ├─ processDecision() - 处理决策，更新属性
  ├─ eventManager.updateEvents() - 更新事件进度
  ├─ generateProgressOutput() - 生成进度显示
  ├─ 添加进度到游戏历史
  ├─ eventManager.getSystemPrompts() - 获取系统提示
  ├─ sendAction(..., systemPrompts) - 发送给AI，注入系统提示
  ├─ eventManager.clearSystemPrompts() - 清空提示
  └─ 返回新的游戏状态

事件完成时
  └─ 自动生成系统提示
       └─ AI 会根据提示推演结果
```

---

## 💡 实际例子

### 例子 1: 创建"修炼内功"事件
```javascript
eventManager.createAndAddEvent(
    'cultivation_001',
    '修炼内功',
    5,
    '根据当前创新属性（${innovation}），推演修炼成果对公司的影响。应包括：技术创新提升、员工能力增强、竞争力提升。'
)
```

### 例子 2: 显示事件进度
```javascript
function showEventProgress() {
    const summary = eventManager.getEventSummary()
    console.log(`🎯 进行中事件 (${summary.activeCount} 个)`)
    
    summary.events.forEach(event => {
        const bar = '█'.repeat(Math.round(event.progress/5)) + 
                    '░'.repeat(20 - Math.round(event.progress/5))
        console.log(`${event.description}: [${bar}] ${event.currentRound}/${event.totalRounds}`)
    })
}
```

### 例子 3: 完整的回合处理
```javascript
async function playRound(state, playerAction) {
    // 1. 处理决策
    let newState = processDecision(state, playerAction)

    // 2. 更新事件
    const eventUpdate = eventManager.updateEvents()

    // 3. 添加进度到输出
    if (eventUpdate.progressUpdates.length > 0) {
        newState.history.push({
            type: 'system',
            text: eventUpdate.progressUpdates.join('\n')
        })
    }

    // 4. 发送给AI，包含系统提示
    const prompts = eventManager.getSystemPrompts()
    const response = await sendAction(playerAction, prompts)
    eventManager.clearSystemPrompts()

    return response
}
```

---

## ⚡ 常见错误

❌ **没有调用 updateEvents()**
```javascript
// 错误 - 事件永远不会更新
const state = processDecision(state, action)
```

✅ **正确做法**
```javascript
const state = processDecision(state, action)
eventManager.updateEvents() // ✅ 必须调用
```

---

❌ **没有清空系统提示**
```javascript
// 错误 - 提示会重复发送
const prompts = eventManager.getSystemPrompts()
await sendAction(action, prompts)
// 忘记清空
```

✅ **正确做法**
```javascript
const prompts = eventManager.getSystemPrompts()
await sendAction(action, prompts)
eventManager.clearSystemPrompts() // ✅ 必须清空
```

---

❌ **System Prompt 没有传给 API**
```javascript
// 错误 - AI 收不到完成提示
await sendAction(action) // 漏掉了 systemPrompts 参数
```

✅ **正确做法**
```javascript
// 正确 - System Prompt 被注入到 AI Context
await sendAction(action, eventManager.getSystemPrompts())
```

---

## 📱 UI 集成示例

### React 组件
```jsx
import { eventManager } from './engine/eventSystem.js'

function EventPanel() {
    const summary = eventManager.getEventSummary()

    return (
        <div className="event-panel">
            <h3>🎯 事件跟踪</h3>
            {summary.activeCount === 0 ? (
                <p>暂无进行中的事件</p>
            ) : (
                summary.events.map(event => (
                    <div key={event.id} className="event-item">
                        <p>{event.description}</p>
                        <progress 
                            value={event.progress} 
                            max={100}
                        />
                        <span>{event.currentRound}/{event.totalRounds}</span>
                    </div>
                ))
            )}
        </div>
    )
}
```

---

## 📚 更多信息

详见 [EVENT_SYSTEM_DOCS.md](./EVENT_SYSTEM_DOCS.md)

查看完整示例：[eventSystemExamples.js](./eventSystemExamples.js)
