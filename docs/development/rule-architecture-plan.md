# 《凡墙皆是门》三层规则架构开发修缮计划

## 一、手册优化建议 ✅ 已完成

### host_manual.md 已优化内容

1. ✅ **三层规则架构说明** - 新增第3节详细说明 Core/Scenario/Temporary 规则
2. ✅ **规则配置界面指引** - 更新第2节，简化 API 配置流程
3. ✅ **卦象系统说明** - 新增第5节说明年度起卦机制
4. ✅ **成就系统管理** - 新增第5节说明成就触发和查看
5. ✅ **评审阶段权限** - 更新第4节明确主持人权限

### player_manual.md 已优化内容

1. ✅ **规则可视化说明** - 新增第3.1节说明规则状态栏
2. ✅ **财务面板说明** - 新增第3.2节和第5节详细说明
3. ✅ **决策输入规范** - 新增第6节说明有效/无效决策
4. ✅ **破产机制说明** - 新增第5.4节详细说明
5. ✅ **术语统一** - 全文使用"现金/资金"替代"HP/生命值"

## 二、三层规则架构设计

### 1. 底层核心逻辑 (Immutable Core)
- 内容: 现金流断裂判定、回合制流程、主体不可代操原则、排行榜更新逻辑
- 实现: 写入 System Prompt
- 状态: 绝对不可违背

### 2. 环境与场景规则 (Default Scenario)
- 内容: 初始资金、背景故事、行业特征、被动收支公式
- 实现: JSON 配置文件
- 状态: 本局游戏内稳定

### 3. 动态博弈规则 (Mutable/Temporary)
- 内容: 周易卦象修正、成就奖励、突发事件限制
- 实现: Context Injection
- 状态: 随回合变化，有有效期

## 三、开发修缮计划

### Phase 1: 规则引擎基础 ✅ 已完成
- [x] `engine/types/rules.ts` - 三层规则类型定义
- [x] `engine/ModifierRegistry.ts` - Modifier 注册表（卦象/事件/成就）
- [x] `engine/RuleManager.ts` - 规则管理器类
- [x] `hooks/useRuleEngine.ts` - React Hook 集成
- [x] `engine/configs/coreRules.json` - 核心规则配置
- [x] `engine/configs/scenarios/` - 场景配置示例

### Phase 2: Prompt 组装器 ✅ 已完成
- [x] `backend/services/PromptBuilder.ts` - 三层规则 Prompt 组装器
  - 固定头部：核心规则 (Immutable Core)
  - 动态背景：临时规则 (Mutable/Temporary)
  - 主体状态、玩家决策、执行指令

### Phase 3: 规则可视化 ✅ 已完成
- [x] `components/RuleStatusBar.tsx` - 规则状态栏（显示 Buffs/Debuffs）
- [x] `components/DecisionValidator.tsx` - 实时决策验证

### Phase 4: 存档兼容 🔄 待实现
- [ ] RuleManager.exportState() / importState() 已实现
- [ ] 需要与后端存档系统集成


## 四、已创建文件清单

### 前端 (frontend/src/)
```
engine/
├── types/
│   └── rules.ts              # 三层规则类型定义
├── configs/
│   ├── coreRules.json        # 核心规则配置
│   └── scenarios/
│       ├── default.json      # 默认场景
│       └── tech-startup.json # 科技创业场景
├── ModifierRegistry.ts       # Modifier 注册表
└── RuleManager.ts            # 规则管理器

hooks/
└── useRuleEngine.ts          # React Hook

components/
├── RuleStatusBar.tsx         # 规则状态栏
└── DecisionValidator.tsx     # 决策验证器
```

### 后端 (backend/src/)
```
services/
└── PromptBuilder.ts          # Prompt 组装器
```

## 五、使用示例

### 1. 在 GameSession 中使用 useRuleEngine
```tsx
import { useRuleEngine } from '../hooks/useRuleEngine';

const GameSession = () => {
  const {
    state,
    activeModifiers,
    currentHexagram,
    addModifier,
    applyHexagram,
    validateDecision,
  } = useRuleEngine();

  // 应用卦象
  const handleHexagramChange = (hexagram) => {
    applyHexagram(hexagram);
  };

  // 验证决策
  const handleDecisionSubmit = (cash, cost) => {
    const result = validateDecision(cash, cost);
    if (!result.valid) {
      alert(result.reason);
      return;
    }
    // 提交决策...
  };

  return (
    <div>
      <RuleStatusBar
        activeModifiers={activeModifiers}
        currentHexagram={currentHexagram}
        currentRound={state.currentRound}
      />
      {/* ... */}
    </div>
  );
};
```

### 2. 在后端使用 PromptBuilder
```typescript
import { promptBuilder } from './services/PromptBuilder';

const prompt = promptBuilder.buildInferencePrompt({
  currentRound: 3,
  coreRules: { /* ... */ },
  scenario: { /* ... */ },
  activeModifiers: [ /* ... */ ],
  currentHexagram: { /* ... */ },
  entityStates: [ /* ... */ ],
  decisions: [ /* ... */ ],
});

// 发送给 AI
const result = await aiService.callAI(config, prompt);
```

## 六、后续优化建议

1. **规则冲突检测** - 当多个 Modifier 影响同一属性时，需要明确优先级和叠加规则
2. **规则版本控制** - 支持规则配置的版本管理，便于回滚
3. **规则编辑器** - 为主持人提供可视化的规则编辑界面
4. **规则模板市场** - 允许用户分享和下载场景配置
5. **AI 规则理解度测试** - 定期测试 AI 对规则的理解和遵守程度
