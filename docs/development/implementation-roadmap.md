# 🗺️ 实现路线图

## 📊 当前项目完成度评估

### 核心功能完成度：85%
- ✅ 游戏基础架构 (100%)
- ✅ 用户认证和房间管理 (100%)
- ✅ 回合制游戏流程 (95%)
- ✅ AI推演集成 (90%)
- ✅ WebSocket实时通信 (90%)
- 🟡 规则引擎系统 (70%)
- ❌ 高级交互功能 (40%)

### Requirements文档完成度：75%
- 已实现：11/19 个核心需求
- 部分实现：4/19 个需求
- 待实现：4/19 个需求

### Rule Architecture完成度：80%
- Phase 1-3: 完全实现
- Phase 4: 部分实现，需要完善

## 🎯 下一步实现优先级

### 第一周：核心缺失功能 (P0)

#### Day 1-2: Fog of War 情报系统
**目标：** 实现对手信息的模糊化显示

**实现文件：**
```
frontend/src/components/OpponentIntel.tsx (修改)
frontend/src/types/intelligence.ts (新建)
frontend/src/utils/intelCalculator.ts (新建)
```

**关键功能：**
- 根据置信度显示不同精度的信息
- 信息来源标识 (公开信号/私密泄露/历史模型)
- 动态置信度更新机制

#### Day 3-4: 多频道聊天系统
**目标：** 支持公开、私聊、联盟多种聊天频道

**实现文件：**
```
frontend/src/components/ChatSystem.tsx (重构)
frontend/src/components/PrivateChat.tsx (新建)
frontend/src/components/AllianceChat.tsx (新建)
backend/src/socket/chatHandlers.ts (修改)
```

**关键功能：**
- 频道切换界面
- 私聊窗口管理
- 未读消息提示
- 联盟创建和管理

#### Day 5: 规则冲突检测
**目标：** 实现多个规则修正器的冲突检测和解决

**实现文件：**
```
frontend/src/engine/ConflictResolver.ts (新建)
frontend/src/engine/RuleManager.ts (修改)
```

### 第二周：高级功能实现 (P1)

#### Day 6-8: 交易系统
**目标：** 玩家间资源交易功能

**实现文件：**
```
frontend/src/components/TradePanel.tsx (新建)
frontend/src/components/TradeRequest.tsx (新建)
backend/src/routes/trade.ts (新建)
backend/src/socket/tradeHandlers.ts (新建)
```

**关键功能：**
- 交易请求创建和发送
- 交易确认和拒绝流程
- 资源转移和验证
- 交易历史记录

#### Day 9-10: 抽屉式导航
**目标：** 将独立页面改为抽屉/模态框形式

**实现文件：**
```
frontend/src/components/drawers/TradeDrawer.tsx (新建)
frontend/src/components/drawers/TaskDrawer.tsx (新建)
frontend/src/components/drawers/SaveDrawer.tsx (新建)
```

### 第三周：用户体验优化 (P2)

#### Day 11-12: 财务系统增强
**目标：** 实时预算计算和财务预览

**实现文件：**
```
frontend/src/components/FinancialPanel.tsx (重构)
frontend/src/components/BudgetPreview.tsx (新建)
frontend/src/utils/financialCalculator.ts (新建)
```

#### Day 13-14: 流式文本优化
**目标：** 增强叙述文本的显示效果

**实现文件：**
```
frontend/src/components/NarrativeFeed.tsx (重构)
frontend/src/utils/textHighlighter.ts (新建)
```

#### Day 15: 存档系统集成
**目标：** 规则状态的保存和恢复

**实现文件：**
```
backend/src/services/RuleStateService.ts (新建)
frontend/src/engine/RuleManager.ts (修改)
```

## 🔧 技术实现细节

### 1. Fog of War 实现策略

```typescript
// 情报置信度计算
interface IntelligenceData {
  playerId: string;
  attribute: string;
  value: number;
  confidence: number;
  source: 'public' | 'private' | 'historical';
  lastUpdated: Date;
}

class IntelligenceCalculator {
  calculateDisplayValue(intel: IntelligenceData): string {
    if (intel.confidence >= 0.8) {
      return intel.value.toLocaleString(); // 精确值
    } else if (intel.confidence >= 0.5) {
      const margin = intel.value * 0.2;
      return `${(intel.value - margin).toFixed(0)}k-${(intel.value + margin).toFixed(0)}k`;
    } else if (intel.confidence >= 0.2) {
      return `~${Math.round(intel.value / 10000)}万`; // 粗略估计
    } else {
      return "???"; // 完全未知
    }
  }
}
```

### 2. 多频道聊天架构

```typescript
// 聊天频道管理
interface ChatChannel {
  id: string;
  type: 'public' | 'private' | 'alliance';
  name: string;
  participants: string[];
  unreadCount: number;
  lastMessage?: ChatMessage;
}

class ChatManager {
  private channels: Map<string, ChatChannel> = new Map();
  private activeChannel: string = 'public';
  
  switchChannel(channelId: string): void;
  createPrivateChat(targetPlayerId: string): string;
  createAlliance(name: string, members: string[]): string;
  sendMessage(channelId: string, content: string): void;
}
```

### 3. 规则冲突解决算法

```typescript
// 规则冲突检测和解决
interface ModifierEffect {
  attribute: string;
  operation: 'add' | 'multiply' | 'set' | 'max' | 'min';
  value: number;
  priority: number;
}

class ConflictResolver {
  resolveConflicts(modifiers: ModifierEffect[]): Map<string, number> {
    const grouped = this.groupByAttribute(modifiers);
    const resolved = new Map<string, number>();
    
    for (const [attribute, effects] of grouped) {
      // 按优先级排序
      effects.sort((a, b) => b.priority - a.priority);
      
      // 应用效果
      let finalValue = this.calculateFinalEffect(effects);
      resolved.set(attribute, finalValue);
    }
    
    return resolved;
  }
}
```

## 📋 质量检查清单

### 代码质量
- [ ] TypeScript类型定义完整
- [ ] ESLint检查通过
- [ ] 单元测试覆盖率 > 70%
- [ ] 集成测试通过
- [ ] 性能测试通过

### 功能完整性
- [ ] 所有P0功能实现并测试
- [ ] Requirements文档完成度 > 90%
- [ ] Rule Architecture Plan完全实现
- [ ] 多人游戏测试通过
- [ ] 错误处理完善

### 用户体验
- [ ] 界面响应速度 < 200ms
- [ ] 操作反馈及时
- [ ] 错误提示友好
- [ ] 帮助文档完整
- [ ] 移动端基本可用

## 🚀 发布计划

### Alpha版本 (第一周结束)
- 核心功能完整
- 支持4人同时游戏
- 基础UI完成

### Beta版本 (第二周结束)
- 高级功能实现
- 支持8人同时游戏
- 用户体验优化

### Release版本 (第三周结束)
- 所有功能完成
- 文档完善
- 性能优化完成

## 📞 风险评估

### 高风险项目
1. **多频道聊天系统** - 复杂度高，可能需要额外时间
2. **交易系统** - 涉及资源转移，需要严格测试
3. **规则冲突检测** - 算法复杂，需要大量测试用例

### 缓解策略
1. **分阶段实现** - 先实现基础功能，再添加高级特性
2. **并行开发** - 前后端功能可以并行开发
3. **早期测试** - 每个功能完成后立即进行测试

---

**总预计工时：** 120小时  
**建议团队规模：** 2-3人  
**预计完成时间：** 3周  
**关键成功因素：** 优先级控制、质量保证、及时测试