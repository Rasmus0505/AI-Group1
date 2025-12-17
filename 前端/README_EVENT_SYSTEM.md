# 🎯 长周期事件监控系统 - 完整实现

> 一个完整的事件管理系统，用于处理需要多个游戏回合才能完成的事件。系统自动跟踪进度，显示进度更新，并在事件完成时提示 AI 模型推演结果。

## 📋 快速导航

| 文档 | 用途 | 链接 |
|-----|------|------|
| 🚀 快速开始 | 5分钟了解系统 | [QUICK_REFERENCE.md](./src/engine/QUICK_REFERENCE.md) |
| 📚 详细文档 | 完整功能说明 | [EVENT_SYSTEM_DOCS.md](./src/engine/EVENT_SYSTEM_DOCS.md) |
| 🔌 集成指南 | 如何集成到项目 | [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) |
| 📖 实现总结 | 已完成功能清单 | [SYSTEM_SUMMARY.md](./SYSTEM_SUMMARY.md) |
| 💡 代码示例 | 完整使用示例 | [eventSystemExamples.js](./src/engine/eventSystemExamples.js) |

---

## ⚡ 5分钟快速开始

### 1️⃣ 创建事件

```javascript
import { eventManager } from './engine/eventSystem.js'

// 创建一个 5 回合的"修炼内功"事件
eventManager.createAndAddEvent(
    'cultivation',      // 事件ID
    '修炼内功',        // 事件描述
    5,                 // 总回合数
    '根据创新属性推演修炼结果' // AI提示词
)
```

### 2️⃣ 每回合更新

```javascript
// 在玩家做出决策后调用
const updateResult = eventManager.updateEvents()

// 获取进度文本
const progressText = generateProgressOutput(updateResult)
console.log(progressText)
// 输出: "[进行中] 修炼内功：进度 1/5"
```

### 3️⃣ 发送给 AI

```javascript
// 获取系统提示（事件完成时生成）
const systemPrompts = eventManager.getSystemPrompts()

// 发送给后端，AI会根据提示推演结果
await sendAction(playerAction, systemPrompts)

// 清空提示防止重复
eventManager.clearSystemPrompts()
```

### 4️⃣ 显示 UI

```jsx
import { EventMonitor } from './components/EventMonitor/EventMonitor'

// 在组件中显示
<EventMonitor />
```

**完成！** 系统已集成。

---

## 🎯 核心功能

### ✅ 事件管理
- 创建、追踪、完成事件
- 自动进度计算
- 支持多个并发事件

### ✅ 进度显示
- 文本进度信息（"[进行中] 事件：2/5"）
- 进度百分比
- 步骤指示器

### ✅ AI 集成
- 事件完成时自动生成 System Prompt
- 系统提示注入到 AI Context
- AI 根据提示推演结果

### ✅ 用户界面
- React 组件（即插即用）
- 响应式设计
- 现代化风格

---

## 📁 项目结构

```
前端/
├── src/
│   ├── engine/
│   │   ├── eventSystem.js              ⭐ 核心系统
│   │   ├── gameLogic.js                ✏️ 已修改
│   │   ├── api.js                      ✏️ 已修改
│   │   ├── eventSystemExamples.js      📖 示例代码
│   │   ├── EVENT_SYSTEM_DOCS.md        📚 详细文档
│   │   └── QUICK_REFERENCE.md          ⚡ 快速参考
│   │
│   └── components/
│       └── EventMonitor/
│           ├── EventMonitor.jsx        🎨 UI 组件
│           └── EventMonitor.module.css 🎨 样式
│
├── INTEGRATION_GUIDE.md                🔌 集成指南
├── SYSTEM_SUMMARY.md                   📋 实现总结
└── README.md                           (本文件)
```

---

## 🚀 工作原理

```
玩家决策
   ↓
processDecision()        [处理决策，更新属性]
   ↓
updateEvents()           [更新事件进度 +1]
   ↓
Check Progress           [检查是否完成]
   ├─ 未完成 → 显示进度文本
   └─ 已完成 → 生成系统提示
   ↓
sendAction() + prompts   [发送给 AI，注入系统提示]
   ↓
AI 推演                  [AI 根据系统提示生成响应]
   ↓
返回结果
```

---

## 💡 常见使用场景

### 场景 1: 长期修炼
```javascript
eventManager.createAndAddEvent(
    'cultivation',
    '修炼内功',
    5,
    '请根据当前创新属性，推演修炼对公司的影响。'
)
```

### 场景 2: 市场调研
```javascript
eventManager.createAndAddEvent(
    'research',
    '市场调研',
    3,
    '调研完成！请评估市场机会。'
)
```

### 场景 3: 融资谈判
```javascript
eventManager.createAndAddEvent(
    'fundraising',
    '融资谈判',
    4,
    '谈判完成。请评估融资成功的影响。'
)
```

---

## 📊 API 速查表

### EventManager 主要方法

```javascript
// 创建并添加事件
eventManager.createAndAddEvent(id, description, totalRounds, completionPrompt)

// 更新事件进度（每回合调用）
const result = eventManager.updateEvents()

// 获取活跃事件
eventManager.getActiveEvents()

// 获取已完成事件
eventManager.getCompletedEvents()

// 获取系统提示
eventManager.getSystemPrompts()

// 清空系统提示
eventManager.clearSystemPrompts()

// 获取事件摘要（用于UI）
eventManager.getEventSummary()

// 检查是否有活跃事件
eventManager.hasActiveEvents()

// 重置系统
eventManager.reset()
```

---

## 🎨 UI 组件

### EventMonitor (简单面板)
- 显示所有活跃事件
- 进度条动画
- 事件完成提示

### AdvancedEventPanel (高级面板)
- 选项卡切换
- 详细事件信息
- 进度估计

### MiniEventIndicator (迷你指示)
- 角落显示活跃事件数
- 紧凑设计

### EventNotification (完成通知)
- 弹出式事件完成提示
- 支持自动隐藏

---

## 📚 学习路径

### 初学者
1. 阅读本 README
2. 查看 [QUICK_REFERENCE.md](./src/engine/QUICK_REFERENCE.md)
3. 复制示例代码并运行

### 中级用户
1. 深入阅读 [EVENT_SYSTEM_DOCS.md](./src/engine/EVENT_SYSTEM_DOCS.md)
2. 查看 [eventSystemExamples.js](./src/engine/eventSystemExamples.js)
3. 尝试高级用法

### 高级用户
1. 阅读源码 [eventSystem.js](./src/engine/eventSystem.js)
2. 查看 [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md)
3. 自定义和扩展系统

---

## ✅ 检查清单

集成到项目时检查：

- [ ] 已导入 `eventSystem.js`
- [ ] 已导入修改后的 `gameLogic.js`
- [ ] 已导入修改后的 `api.js`
- [ ] 在游戏初始化时创建事件
- [ ] 在玩家决策后调用 `updateEvents()`
- [ ] 将系统提示通过 `sendAction()` 发送给后端
- [ ] 后端正确处理 `systemPrompts` 参数
- [ ] UI 中集成了事件监控组件
- [ ] 测试事件完成流程
- [ ] 查看浏览器控制台验证系统提示

---

## 🐛 故障排查

### 问题：事件没有更新
**检查**:
- 是否每回合都调用了 `updateEvents()`
- 事件是否已创建

### 问题：系统提示没有注入
**检查**:
- `getSystemPrompts()` 是否返回了提示
- 是否将提示传给了 `sendAction()`
- 后端是否正确读取了参数

### 问题：进度显示重复
**检查**:
- 是否调用了 `clearSystemPrompts()`
- 是否多次调用了 `updateEvents()`

📖 更多问题见 [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md#-常见问题排查)

---

## 🔧 技术栈

- **前端**: React + JavaScript
- **样式**: CSS Modules
- **架构**: 事件驱动
- **集成**: API + System Prompts

---

## 📞 文件速查

| 需要... | 查看文件 |
|--------|---------|
| 快速开始 | [QUICK_REFERENCE.md](./src/engine/QUICK_REFERENCE.md) |
| 详细API文档 | [EVENT_SYSTEM_DOCS.md](./src/engine/EVENT_SYSTEM_DOCS.md) |
| 如何集成 | [INTEGRATION_GUIDE.md](./INTEGRATION_GUIDE.md) |
| 代码示例 | [eventSystemExamples.js](./src/engine/eventSystemExamples.js) |
| 系统源码 | [eventSystem.js](./src/engine/eventSystem.js) |
| UI 组件 | [EventMonitor.jsx](./src/components/EventMonitor/EventMonitor.jsx) |
| 完整功能清单 | [SYSTEM_SUMMARY.md](./SYSTEM_SUMMARY.md) |

---

## ✨ 系统特色

✅ **开箱即用** - 完整的系统，无需复杂配置
✅ **高度灵活** - 支持任意回合数和自定义提示词
✅ **文档完整** - 详尽的文档、快速参考和代码示例
✅ **UI 现代** - 响应式 React 组件，设计精美
✅ **易于扩展** - 清晰的架构，易于二次开发
✅ **性能优化** - O(n) 时间复杂度，支持大量并发事件

---

## 🎓 学习资源

### 文档
- 📖 [快速参考](./src/engine/QUICK_REFERENCE.md) - 5分钟入门
- 📚 [详细文档](./src/engine/EVENT_SYSTEM_DOCS.md) - 完整功能说明
- 🔌 [集成指南](./INTEGRATION_GUIDE.md) - 集成到项目

### 代码
- 💡 [示例代码](./src/engine/eventSystemExamples.js) - 9个完整例子
- 🎨 [UI组件](./src/components/EventMonitor/EventMonitor.jsx) - React 组件

### 参考
- 📋 [实现总结](./SYSTEM_SUMMARY.md) - 完整功能清单
- 💬 [本 README](./README.md) - 系统概览

---

## 🚀 立即开始

### 第1步：创建事件
```javascript
import { eventManager } from './engine/eventSystem.js'
eventManager.createAndAddEvent('event1', '我的事件', 3, '完成提示')
```

### 第2步：更新进度
```javascript
eventManager.updateEvents()
```

### 第3步：显示UI
```jsx
<EventMonitor />
```

**就是这样！** ✨

---

## 📄 许可证

本系统为项目内部实现，遵循项目许可证。

---

## 🙏 感谢

感谢所有使用和反馈本系统的开发者！

---

**版本**: 1.0
**最后更新**: 2025年12月17日
**状态**: ✅ 生产就绪

---

**现在就开始使用吧！** → [QUICK_REFERENCE.md](./src/engine/QUICK_REFERENCE.md)
