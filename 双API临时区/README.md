# 双API临时区

## 概述

这是一个独立的测试区域，用于验证双API架构方案，不影响现有production代码。

## 核心流程

```
【初始化】
主持人点击初始化 → 剧情API生成背景故事 → 显示给所有玩家
                                      ↓
                            主持人触发解析API
                                      ↓
                            解析API提取初始数据 → 显示给所有玩家
                                      ↓
                            玩家提交首回合决策

【回合循环】
┌─────────────────────────────────────────────────────────────────────┐
│  主持人发送：上回合数值解析输出 + 玩家决策 + 固定提示词              │
│                              ↓                                      │
│  剧情API生成本回合剧情 → 同时显示给主持人和玩家                      │
│                              ↓                                      │
│  主持人手动触发解析API（发送：剧情文本 + 固定解析提示词）            │
│                              ↓                                      │
│  解析API输出 → 同时显示给主持人和玩家（原始文本 + 结构化数据）       │
│                              ↓                                      │
│  玩家提交决策 → 主持人收集所有决策                                   │
│                              ↓                                      │
│  回到循环开始（数值解析输出 + 玩家决策 → 剧情API）                   │
└─────────────────────────────────────────────────────────────────────┘
```

**关键点：剧情API收到的是"数值解析输出 + 玩家决策"，而不是上回合剧情，这样剧情和数值才能保持一致。**

## 文件结构

```
双API临时区/
├── backend/
│   ├── narrativeApi.ts      # 剧情推演API服务
│   ├── parserApi.ts         # 数据解析API服务
│   └── routes.ts            # 测试路由
├── frontend/
│   ├── NarrativeDisplay.tsx # 玩家剧情展示组件
│   ├── DualApiConfig.tsx    # 主持人双API配置组件
│   ├── HostControlPanel.tsx # 主持人控制面板
│   └── hooks/
│       └── useDualApi.ts    # 双API调用hook
└── README.md
```

## 最小改动清单

### 后端（2个文件）
1. `narrativeApi.ts` - 接收提示词，调用AI，返回纯文本剧情
2. `parserApi.ts` - 接收剧情文本，解析/生成面板数据JSON

### 前端（3个组件）
1. `NarrativeDisplay.tsx` - 玩家视图下方的大文本展示区
2. `DualApiConfig.tsx` - 主持人配置界面的第二个API key输入
3. `HostControlPanel.tsx` - 主持人手动控制推演流程

## 使用方式

1. 主持人在配置界面填入两个API key（可以相同）
2. 主持人编写/修改提示词，点击"生成剧情"
3. 剧情文本显示在所有玩家的文本区
4. 主持人点击"解析数据"，系统自动填充面板
5. 玩家提交决策，主持人汇总后进入下一轮

## 集成到现有项目

### Step 1: 后端集成

在 `backend/src/server.ts` 中添加路由：

```typescript
import dualApiRoutes from '../../双API临时区/backend/routes';

// 在其他路由之后添加
app.use('/api/dual', dualApiRoutes);
```

### Step 2: 前端集成

在玩家游戏页面中添加剧情展示组件：

```tsx
import NarrativeDisplay from '../../双API临时区/frontend/NarrativeDisplay';

// 在玩家视图的下方添加
<NarrativeDisplay
  narrative={currentNarrative}
  isLoading={narrativeLoading}
  error={narrativeError}
  round={currentRound}
  onRetry={handleRetryNarrative}
/>
```

在主持人配置页面中添加双API配置：

```tsx
import DualApiConfig from '../../双API临时区/frontend/DualApiConfig';

// 在配置表单中添加
<DualApiConfig
  narrativeConfig={narrativeConfig}
  parserConfig={parserConfig}
  onNarrativeConfigChange={setNarrativeConfig}
  onParserConfigChange={setParserConfig}
/>
```

### Step 3: 主持人控制面板

在主持人游戏界面中添加控制面板：

```tsx
import HostControlPanel from '../../双API临时区/frontend/HostControlPanel';

<HostControlPanel
  narrativeConfig={narrativeConfig}
  parserConfig={parserConfig}
  entities={gameEntities}
  currentRound={currentRound}
  previousNarrative={lastRoundNarrative}
  playerDecisions={collectedDecisions}
  onNarrativeGenerated={handleNarrativeReady}
  onPanelDataParsed={handlePanelDataReady}
/>
```

## API端点

| 端点 | 方法 | 描述 |
|------|------|------|
| `/api/dual/init` | POST | 游戏初始化（生成背景+解析数据） |
| `/api/dual/narrative` | POST | 生成回合剧情文本 |
| `/api/dual/parse` | POST | 解析剧情为面板数据 |
| `/api/dual/full-round` | POST | 完整回合（生成+解析） |

## 默认提示词

所有提示词已固定在 `backend/defaultPrompts.ts` 中，无需前端自定义。

### 初始化提示词
```
这是一场商业竞争博弈游戏，有3个主体在有限市场资源下寻求相对更优的发展，
故事背景为零售行业，请尽可能生动地生成一篇长篇幅的背景故事作为游戏基础。
```

### 回合推演提示词
```
推演本回合所有决策造成的影响，推演下一回合剧情走向，各主体的资金变动计算公式由你制定。
计算本回合被动收益和被动支出结果和一次性收益支出结果，并更新下回合被动收益支出预算和一次性收益支出预算，并计算当前资金额度。
记住主体本轮决策内容，展示各决策与事件如何导致下面推演结果，展现连锁反应或逻辑。
检测本回合推演有无玩家解锁新成就。
```

### 数据解析提示词
解析API会将剧情文本转换为以下结构化数据：
- `perEntityPanel` - 各主体面板（现金、属性、被动收支、变化量）
- `leaderboard` - 排行榜
- `events` - 事件列表
- `options` - 下回合决策选项
- `ledger` - 财务核算
- `hexagram` - 卦象
- `achievements` - 成就
- `cashFlowWarning` - 现金流警告

## 优势

- ✅ 不改动现有数据库结构
- ✅ 不改动现有游戏流程
- ✅ 主持人手动控制每一步
- ✅ 两个API完全独立
- ✅ 可以独立测试，不影响现有功能
- ✅ 即使解析失败，剧情仍可展示
- ✅ 解析API始终返回原始文本，便于调试

## 解析API输出说明

解析API的响应包含以下字段：
- `rawText`: 解析API的原始输出文本（始终返回）
- `parseSuccess`: JSON解析是否成功
- `panelData`: 解析后的结构化数据（仅在解析成功时有效）

即使JSON解析失败，`rawText`也会返回，方便主持人查看AI的原始输出并手动处理。
