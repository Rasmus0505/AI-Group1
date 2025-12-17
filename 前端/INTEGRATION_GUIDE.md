# 长周期事件监控系统 - 集成指南

## 📁 文件结构

```
src/
├── engine/
│   ├── eventSystem.js              # ✨ 核心系统 - 事件管理器和类定义
│   ├── gameLogic.js                # ✏️ 已修改 - 集成事件更新逻辑
│   ├── api.js                      # ✏️ 已修改 - 添加系统提示参数
│   ├── eventSystemExamples.js      # 📖 完整使用示例
│   ├── EVENT_SYSTEM_DOCS.md        # 📚 详细文档
│   ├── QUICK_REFERENCE.md          # ⚡ 快速参考
│   └── ...其他文件
│
└── components/
    ├── EventMonitor/
    │   ├── EventMonitor.jsx        # 🎨 React UI 组件
    │   └── EventMonitor.module.css # 🎨 样式表
    └── ...其他组件
```

---

## 🚀 快速集成步骤

### 步骤 1: 导入必要的模块

在你的主要游戏组件或服务中导入：

```javascript
import { eventManager, generateProgressOutput } from './engine/eventSystem.js'
import { processDecision, updateGameEvents } from './engine/gameLogic.js'
import { sendAction } from './engine/api.js'
```

### 步骤 2: 初始化游戏时创建事件

```javascript
function initializeGame() {
    // 创建一个长周期事件
    eventManager.createAndAddEvent(
        'initial_event',
        '初始挑战',
        3,
        '初始挑战完成！请根据结果评估公司的应对能力。'
    )

    // ... 其他初始化代码
}
```

### 步骤 3: 处理玩家决策时更新事件

```javascript
async function handlePlayerAction(state, action) {
    // 1. 处理决策
    let newState = processDecision(state, action)

    // 2. 更新事件进度
    const eventUpdate = eventManager.updateEvents()

    // 3. 添加进度显示到历史
    if (eventUpdate.progressUpdates.length > 0) {
        newState.history.push({
            id: Date.now(),
            type: 'system',
            text: eventUpdate.progressUpdates.join('\n')
        })
    }

    // 4. 获取系统提示（事件完成时生成）
    const systemPrompts = eventManager.getSystemPrompts()

    // 5. 发送给 AI，系统提示会被注入
    const response = await sendAction(action, systemPrompts)

    // 6. 清空提示防止重复
    eventManager.clearSystemPrompts()

    // 7. 返回新状态
    return {
        state: newState,
        options: response.options
    }
}
```

### 步骤 4: 在 UI 中显示事件进度

使用提供的 React 组件：

```jsx
import { EventMonitor, AdvancedEventPanel } from './components/EventMonitor/EventMonitor'

function GameDashboard() {
    return (
        <div className="dashboard">
            {/* 简单事件监控面板 */}
            <EventMonitor />

            {/* 或者使用高级面板 */}
            <AdvancedEventPanel />

            {/* 其他游戏内容 */}
        </div>
    )
}
```

---

## 📖 常见集成场景

### 场景 1: 在特定条件下触发事件

```javascript
import { eventManager } from './engine/eventSystem.js'

function processDecision(state, decision) {
    // ... 处理决策逻辑 ...

    // 如果资金不足，触发融资事件
    if (newAttributes.cash < 200) {
        eventManager.createAndAddEvent(
            'emergency_fundraising',
            '紧急融资',
            4,
            '融资成功！请评估资金注入对公司的影响，包括股权稀释和战略方向的改变。'
        )
    }

    return newState
}
```

### 场景 2: 事件完成后触发链式事件

```javascript
const updateResult = eventManager.updateEvents()

// 检查完成的事件
for (const completedEvent of updateResult.completedEvents) {
    if (completedEvent.id === 'cultivation') {
        // 修炼完成，触发展示结果事件
        eventManager.createAndAddEvent(
            'show_cultivation_results',
            '展示修炼结果',
            2,
            '展示修炼对公司创新力的具体提升。'
        )
    }
}
```

### 场景 3: 根据游戏状态动态调整事件

```javascript
import { eventManager } from './engine/eventSystem.js'

function updateDynamicEvents(state) {
    const { attributes } = state

    // 根据不同属性创建对应的事件
    if (attributes.morale < 30) {
        eventManager.createAndAddEvent(
            'morale_crisis',
            '团队危机',
            3,
            '团队士气恢复，请推演这对后续工作效率的影响。'
        )
    }

    if (attributes.innovation > 80) {
        eventManager.createAndAddEvent(
            'breakthrough',
            '创新突破',
            2,
            '重大创新突破！评估这对公司竞争力的影响。'
        )
    }
}
```

### 场景 4: 显示事件完成通知

```javascript
import { EventNotification } from './components/EventMonitor/EventMonitor'

function GameUI() {
    const [notification, setNotification] = useState(null)

    useEffect(() => {
        // 监听事件完成
        const checkForCompletions = () => {
            const completedEvents = eventManager.getCompletedEvents()
            if (completedEvents.length > 0) {
                const lastCompleted = completedEvents[completedEvents.length - 1]
                setNotification(lastCompleted)

                // 3秒后自动隐藏
                setTimeout(() => setNotification(null), 3000)
            }
        }

        const timer = setInterval(checkForCompletions, 1000)
        return () => clearInterval(timer)
    }, [])

    return (
        <>
            <EventNotification notification={notification} />
            {/* 其他 UI */}
        </>
    )
}
```

---

## 🔌 与现有系统的集成

### 与 Dashboard 组件的集成

```jsx
// src/components/Dashboard/Dashboard.jsx
import { EventMonitor } from '../EventMonitor/EventMonitor'

export function Dashboard() {
    return (
        <div className="dashboard">
            <div className="main-content">
                {/* 游戏主要内容 */}
            </div>

            <div className="sidebar">
                <div className="stats-panel">
                    {/* 属性显示 */}
                </div>

                <div className="event-panel">
                    <EventMonitor />  {/* 事件监控面板 */}
                </div>
            </div>
        </div>
    )
}
```

### 与 InputArea 的集成

```jsx
// src/components/InputArea/InputArea.jsx
import { sendAction } from '../../engine/api.js'
import { eventManager } from '../../engine/eventSystem.js'

export function InputArea({ onAction }) {
    const handleSubmit = async (action) => {
        // 获取系统提示
        const systemPrompts = eventManager.getSystemPrompts()

        // 发送给后端
        const response = await sendAction(action, systemPrompts)

        // 清空提示
        eventManager.clearSystemPrompts()

        // 触发回调
        onAction(response)
    }

    return (
        // ... InputArea 的 JSX ...
    )
}
```

### 与 Terminal 的集成

```jsx
// src/components/Terminal/Terminal.jsx
import { eventManager } from '../../engine/eventSystem.js'

export function Terminal({ state }) {
    // 显示事件进度在终端输出中
    const getEventOutput = () => {
        const summary = eventManager.getEventSummary()

        if (summary.activeCount === 0) return ''

        return summary.events
            .map(e => `[Event] ${e.description}: ${e.currentRound}/${e.totalRounds}`)
            .join('\n')
    }

    return (
        <div className="terminal">
            {/* 历史记录 */}
            {state.history.map((msg, idx) => (
                <div key={idx} className={`message message-${msg.type}`}>
                    {msg.text}
                </div>
            ))}

            {/* 事件进度 */}
            {getEventOutput() && (
                <div className="message message-event">
                    {getEventOutput()}
                </div>
            )}
        </div>
    )
}
```

---

## 🛠️ API 响应格式

### 后端应该处理的 API 请求

当客户端调用 `sendAction(action, systemPrompts)` 时，后端收到：

```javascript
{
    "action": {
        "label": "string",
        "customText": "string",
        "effects": {
            "cash": number,
            "morale": number,
            // ...
        }
    },
    "systemPrompts": [
        "【系统提示】玩家的'修炼内功'事件已完成！请根据当前属性推演修炼结果...",
        // ...其他系统提示
    ]
}
```

### 后端建议的处理流程

```python
# 伪代码示例 (Python)
@app.post("/api/action")
def handle_action(data):
    action = data['action']
    system_prompts = data.get('systemPrompts', [])

    # 1. 处理玩家决策
    update_game_state(action)

    # 2. 如果有系统提示，注入到 AI 的 System Prompt 中
    if system_prompts:
        for prompt in system_prompts:
            add_to_system_prompt(prompt)

    # 3. 调用 AI 模型
    ai_response = call_ai_model(
        system_prompt=get_full_system_prompt(),
        user_input=action['customText'],
        game_state=current_game_state
    )

    # 4. 返回响应
    return {
        "state": game_state,
        "options": generate_options(ai_response),
        "narrative": ai_response
    }
```

---

## 📊 数据持久化

### 保存事件状态

```javascript
import { eventManager } from './engine/eventSystem.js'

function saveGameState(state) {
    const saveData = {
        ...state,
        activeEvents: eventManager.getActiveEvents().map(e => ({
            id: e.id,
            description: e.description,
            currentRound: e.currentRound,
            totalRounds: e.totalRounds,
            completionPrompt: e.completionPrompt,
            isCompleted: e.isCompleted
        })),
        completedEvents: eventManager.getCompletedEvents().map(e => ({
            id: e.id,
            description: e.description,
            completionPrompt: e.completionPrompt
        }))
    }

    localStorage.setItem('gameState', JSON.stringify(saveData))
}
```

### 恢复事件状态

```javascript
import { eventManager } from './engine/eventSystem.js'

function loadGameState() {
    const saveData = JSON.parse(localStorage.getItem('gameState'))

    // 恢复活跃事件
    for (const eventData of saveData.activeEvents) {
        eventManager.createAndAddEvent(
            eventData.id,
            eventData.description,
            eventData.totalRounds,
            eventData.completionPrompt
        )

        // 恢复进度
        const event = eventManager.getActiveEvents().find(e => e.id === eventData.id)
        event.currentRound = eventData.currentRound
    }

    return saveData
}
```

---

## ⚙️ 调试技巧

### 在控制台查看事件状态

```javascript
// 在浏览器开发者工具中执行
import { eventManager } from './engine/eventSystem.js'

// 查看活跃事件
console.table(eventManager.getActiveEvents())

// 查看已完成事件
console.table(eventManager.getCompletedEvents())

// 查看事件摘要
console.log(eventManager.getEventSummary())

// 查看待注入的系统提示
console.log(eventManager.getSystemPrompts())
```

### 手动测试事件完成

```javascript
// 跳过进度直接完成事件
import { eventManager } from './engine/eventSystem.js'

const events = eventManager.getActiveEvents()
if (events.length > 0) {
    // 直接设置进度为完成
    events[0].currentRound = events[0].totalRounds

    // 然后调用更新
    const result = eventManager.updateEvents()
    console.log('已完成事件:', result.completedEvents)
}
```

---

## ✅ 集成检查清单

- [ ] 已导入 `eventSystem.js`、`gameLogic.js`、`api.js`
- [ ] 在游戏初始化时调用 `eventManager.createAndAddEvent()`
- [ ] 在处理玩家决策后调用 `eventManager.updateEvents()`
- [ ] 将系统提示通过 `sendAction(..., systemPrompts)` 发送给后端
- [ ] 调用 `eventManager.clearSystemPrompts()` 防止重复
- [ ] 在 UI 中显示事件进度（使用 `EventMonitor` 或自定义）
- [ ] 后端正确处理 `systemPrompts` 参数并注入到 AI Context
- [ ] 测试事件完成触发正确的 AI 提示
- [ ] 测试游戏状态保存/加载（如果支持）

---

## 🚨 常见问题排查

### Q: 系统提示没有注入到 AI
**A:** 检查：
1. 是否调用了 `eventManager.updateEvents()`
2. 是否将 `systemPrompts` 传给了 `sendAction()`
3. 后端是否正确读取了 `systemPrompts` 参数

### Q: 事件没有更新进度
**A:** 检查：
1. 是否每个回合都调用了 `updateEvents()`
2. 是否正确处理了返回的 `updateResult`

### Q: 进度显示重复出现
**A:** 检查：
1. 是否调用了 `clearSystemPrompts()`
2. 是否多次调用了 `updateEvents()`

---

## 📞 支持

查看详细文档：[EVENT_SYSTEM_DOCS.md](./EVENT_SYSTEM_DOCS.md)
查看快速参考：[QUICK_REFERENCE.md](./QUICK_REFERENCE.md)
查看代码示例：[eventSystemExamples.js](./eventSystemExamples.js)
