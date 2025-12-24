# 🚀 紧急实现计划

## 📅 第一阶段：核心缺失功能 (1-2天)

### 1. Fog of War 情报系统
**优先级：P0**
**文件：** `frontend/src/components/OpponentIntel.tsx`

```typescript
interface IntelData {
  value: number;
  confidence: number; // 0-1
  lastUpdated: string;
  source: 'public_signal' | 'private_leak' | 'historical_model';
}

// 根据置信度显示不同的信息
const renderIntelValue = (intel: IntelData) => {
  if (intel.confidence >= 0.7) return intel.value.toLocaleString();
  if (intel.confidence >= 0.4) return `${Math.floor(intel.value * 0.8)}k-${Math.floor(intel.value * 1.2)}k`;
  return "???";
};
```

### 2. 多频道聊天系统
**优先级：P0**
**文件：** `frontend/src/components/ChatSystem.tsx`

需要添加：
- 频道切换标签页
- 私聊窗口管理
- 未读消息提示
- 联盟频道创建

### 3. 交易系统基础
**优先级：P1**
**文件：** `frontend/src/components/TradePanel.tsx`

```typescript
interface TradeRequest {
  id: string;
  fromPlayer: string;
  toPlayer: string;
  offer: ResourceBundle;
  request: ResourceBundle;
  status: 'pending' | 'accepted' | 'rejected' | 'expired';
  expiresAt: string;
}
```

## 📅 第二阶段：规则引擎完善 (2-3天)

### 4. 规则状态管理
**优先级：P1**
**文件：** `frontend/src/engine/RuleManager.ts`

需要完善：
- 规则冲突检测算法
- Modifier优先级排序
- 规则效果叠加计算

### 5. 存档系统集成
**优先级：P1**
**文件：** `backend/src/services/SaveGameService.ts`

需要实现：
- 规则状态序列化
- 游戏状态快照
- 回滚机制

### 6. 决策验证器
**优先级：P1**
**文件：** `frontend/src/components/DecisionValidator.tsx`

需要实现：
- 实时成本计算
- 规则约束检查
- 风险评估提示

## 📅 第三阶段：用户体验优化 (1-2天)

### 7. 抽屉式导航
**优先级：P2**

将以下功能改为抽屉/模态框：
- 交易面板 (`TradeDrawer.tsx`)
- 任务面板 (`TaskDrawer.tsx`)
- 存档面板 (`SaveDrawer.tsx`)

### 8. 流式文本优化
**优先级：P2**
**文件：** `frontend/src/components/NarrativeFeed.tsx`

需要增强：
- 关键词高亮 (数字、百分比、专有名词)
- 打字速度控制
- 暂停/继续功能

### 9. 财务计算增强
**优先级：P2**
**文件：** `frontend/src/components/FinancialPanel.tsx`

需要添加：
- 实时预算预览
- 被动/主动损益分离
- 现金流预测图表

## 🎯 实现优先级矩阵

| 功能 | 用户影响 | 实现难度 | 优先级 | 预计工时 |
|------|----------|----------|--------|----------|
| Fog of War | 高 | 中 | P0 | 4h |
| 多频道聊天 | 高 | 高 | P0 | 8h |
| 交易系统 | 中 | 高 | P1 | 12h |
| 规则冲突检测 | 中 | 中 | P1 | 6h |
| 存档集成 | 低 | 中 | P1 | 4h |
| 抽屉导航 | 中 | 低 | P2 | 6h |
| 流式文本 | 低 | 低 | P2 | 3h |
| 财务增强 | 中 | 中 | P2 | 5h |

## 📋 检查清单

### 完成标准
- [ ] 所有P0功能实现并测试通过
- [ ] Requirements文档中的核心需求满足率达到90%
- [ ] Rule Architecture Plan中的Phase 1-3完全实现
- [ ] 多人游戏测试通过
- [ ] 用户手册更新完成

### 质量标准
- [ ] TypeScript类型定义完整
- [ ] 单元测试覆盖率>70%
- [ ] ESLint检查通过
- [ ] 性能测试通过(支持8人同时游戏)
- [ ] 错误处理完善

## 🚀 快速启动建议

1. **立即开始Fog of War实现** - 这是最影响游戏体验的功能
2. **并行开发多频道聊天** - 这是多人游戏的核心需求
3. **规则引擎完善可以分步进行** - 不阻塞其他功能开发
4. **UI优化放在最后** - 功能完整性优先于美观性

## 📞 需要决策的问题

1. **交易系统复杂度** - 是否需要支持复杂的多方交易？
2. **规则编辑器范围** - 主持人可以修改哪些规则？
3. **AI规则理解测试** - 是否需要自动化测试？
4. **移动端支持** - 是否需要响应式设计？

---

**预计总工时：48-60小时**
**建议团队规模：2-3人**
**完成时间：1-2周**