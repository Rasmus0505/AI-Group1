# 《凡墙皆是门》三层规则架构开发修缮计划

**最后更新：** 2025-12-25  
**当前状态：** Phase 1-3 已完成，Phase 4 待实现  
**下一步：** 规则冲突检测和存档系统集成

## 实现状态总览

### ✅ 已完成功能
- 三层规则类型定义和架构设计
- ModifierRegistry 和 RuleManager 核心引擎
- PromptBuilder 三层规则组装器
- 基础规则可视化组件
- 手册文档优化完成

### 🟡 部分完成功能
- RuleStatusBar 组件 (基础实现，需增强交互)
- DecisionValidator 组件 (基础实现，需实时验证)
- 存档系统接口 (已定义，需与后端集成)

### ❌ 待实现功能
- 规则冲突检测算法
- 规则编辑器界面
- AI规则理解度测试
- 完整的存档兼容性

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

## 六、紧急实现计划 🚀 新增

### Phase 4.1: 规则冲突检测 (优先级: P0)
**预计工时：** 6小时  
**负责文件：** `frontend/src/engine/ConflictResolver.ts`

```typescript
interface RuleConflict {
  conflictType: 'override' | 'stack' | 'multiply';
  affectedAttribute: string;
  conflictingModifiers: Modifier[];
  resolution: 'priority' | 'sum' | 'max' | 'min';
}

class ConflictResolver {
  detectConflicts(modifiers: Modifier[]): RuleConflict[];
  resolveConflicts(conflicts: RuleConflict[]): ResolvedModifier[];
  calculateFinalValue(baseValue: number, modifiers: ResolvedModifier[]): number;
}
```

### Phase 4.2: 实时规则验证 (优先级: P1)
**预计工时：** 4小时  
**负责文件：** `frontend/src/components/DecisionValidator.tsx`

需要实现：
- 决策成本实时计算
- 规则约束检查 (如：卦象限制、事件影响)
- 风险评估和警告提示
- 可行性验证 (现金流、资源限制)

### Phase 4.3: 规则状态持久化 (优先级: P1)
**预计工时：** 8小时  
**涉及文件：** 
- `backend/src/services/RuleStateService.ts`
- `frontend/src/engine/RuleManager.ts`

```typescript
interface RuleStateSnapshot {
  timestamp: string;
  gameRound: number;
  coreRules: CoreRules;
  activeModifiers: Modifier[];
  currentHexagram: Hexagram;
  playerStates: PlayerState[];
  eventHistory: GameEvent[];
}

// 存档时保存规则状态
const saveRuleState = async (sessionId: string): Promise<string> => {
  const snapshot = ruleManager.exportState();
  return await saveGameService.saveRuleSnapshot(sessionId, snapshot);
};

// 读档时恢复规则状态
const loadRuleState = async (sessionId: string, snapshotId: string): Promise<void> => {
  const snapshot = await saveGameService.loadRuleSnapshot(sessionId, snapshotId);
  ruleManager.importState(snapshot);
};
```

### Phase 4.4: 规则编辑器 (优先级: P2)
**预计工时：** 12小时  
**负责文件：** `frontend/src/components/RuleEditor.tsx`

主持人可编辑的规则范围：
- 临时事件的创建和修改
- 卦象效果的调整
- 成就奖励的自定义
- 场景规则的微调 (初始资金、被动收支等)

**不可编辑的核心规则：**
- 现金流断裂判定
- 回合制流程
- 主体不可代操原则

## 七、质量保证计划

### 7.1 规则一致性测试
```typescript
// 测试规则引擎的一致性
describe('Rule Engine Consistency', () => {
  test('应该正确处理规则冲突', () => {
    const modifiers = [
      { type: 'hexagram', effect: { cash: '+20%' } },
      { type: 'event', effect: { cash: '-10%' } }
    ];
    const result = conflictResolver.resolveConflicts(modifiers);
    expect(result.finalEffect.cash).toBe('+8%'); // (1.2 * 0.9 - 1) * 100%
  });
  
  test('应该正确验证决策可行性', () => {
    const decision = { cost: 50000, type: 'investment' };
    const playerState = { cash: 45000, creditLimit: 10000 };
    const validation = decisionValidator.validate(decision, playerState);
    expect(validation.valid).toBe(true); // 45000 + 10000 > 50000
  });
});
```

### 7.2 AI规则理解度监控
```typescript
interface RuleComplianceReport {
  sessionId: string;
  round: number;
  expectedRules: string[];
  aiResponse: string;
  complianceScore: number; // 0-1
  violations: RuleViolation[];
}

// 监控AI是否正确理解和应用规则
const monitorAICompliance = (prompt: string, response: string): RuleComplianceReport => {
  // 分析AI响应是否违反了规则
  // 计算规则遵守度评分
  // 生成改进建议
};
```

## 八、性能优化建议

### 8.1 规则计算优化
- 使用缓存避免重复计算
- 批量处理规则更新
- 异步加载规则配置

### 8.2 内存管理
- 及时清理过期的Modifier
- 限制规则历史记录数量
- 优化规则状态序列化

## 九、后续扩展规划

### 9.1 规则市场 (Phase 5)
- 用户自定义规则模板
- 规则模板分享和下载
- 社区评分和推荐系统

### 9.2 高级规则引擎 (Phase 6)
- 条件触发规则
- 动态规则生成
- 机器学习规则优化

---

**总预计工时：** 30小时  
**建议完成时间：** 1周  
**关键里程碑：** 规则冲突检测 → 实时验证 → 存档集成 → 编辑器界面
