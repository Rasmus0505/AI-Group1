/**
 * 规则管理器 (RuleManager)
 * 管理三层规则架构：Core / Scenario / Temporary
 * 核心原则：让代码逻辑管数值，AI管演绎
 */

import type {
  CoreRules,
  ScenarioConfig,
  TemporaryModifier,
  RuleState,
  RuleChangeEvent,
  HexagramDefinition,
} from './types/rules';
import { DEFAULT_CORE_RULES, DEFAULT_SCENARIO } from './types/rules';
import { ModifierRegistry } from './ModifierRegistry';

type RuleChangeListener = (event: RuleChangeEvent) => void;

export class RuleManager {
  private state: RuleState;
  private listeners: Set<RuleChangeListener> = new Set();
  private modifierRegistry: ModifierRegistry;

  constructor(
    scenario: ScenarioConfig = DEFAULT_SCENARIO,
    core: CoreRules = DEFAULT_CORE_RULES
  ) {
    this.modifierRegistry = ModifierRegistry.getInstance();
    this.state = {
      core,
      scenario,
      activeModifiers: [],
      currentRound: 0,
    };
  }

  // ============ 状态访问 ============

  getState(): Readonly<RuleState> {
    return this.state;
  }

  getCoreRules(): Readonly<CoreRules> {
    return this.state.core;
  }

  getScenario(): Readonly<ScenarioConfig> {
    return this.state.scenario;
  }

  getActiveModifiers(): ReadonlyArray<TemporaryModifier> {
    return this.state.activeModifiers;
  }

  getCurrentRound(): number {
    return this.state.currentRound;
  }

  getCurrentHexagram(): HexagramDefinition | undefined {
    return this.state.currentHexagram;
  }


  // ============ 回合管理 ============

  /** 推进到下一回合 */
  advanceRound(): void {
    this.state.currentRound += 1;
    this.tickModifiers();
  }

  /** 设置当前回合 */
  setRound(round: number): void {
    this.state.currentRound = round;
  }

  // ============ Modifier 管理 ============

  /** 添加 Modifier（必须是已注册的） */
  addModifier(modifierId: string, durationOverride?: number): TemporaryModifier | null {
    const modifier = this.modifierRegistry.createModifier(
      modifierId,
      this.state.currentRound,
      durationOverride !== undefined ? { defaultDuration: durationOverride } : undefined
    );

    if (!modifier) {
      console.warn(`[RuleManager] 无法添加未注册的 Modifier: ${modifierId}`);
      return null;
    }

    // 检查是否可叠加
    if (!modifier.stackable) {
      const existing = this.state.activeModifiers.find(
        (m) => m.id.startsWith(modifierId)
      );
      if (existing) {
        console.warn(`[RuleManager] Modifier ${modifierId} 不可叠加，已存在`);
        return null;
      }
    }

    this.state.activeModifiers.push(modifier);
    this.state.activeModifiers.sort((a, b) => (b.priority ?? 0) - (a.priority ?? 0));

    this.emit({
      type: 'modifier_added',
      payload: modifier,
      timestamp: Date.now(),
    });

    return modifier;
  }

  /** 移除指定 Modifier */
  removeModifier(instanceId: string): boolean {
    const index = this.state.activeModifiers.findIndex((m) => m.id === instanceId);
    if (index === -1) return false;

    const removed = this.state.activeModifiers.splice(index, 1)[0];
    this.emit({
      type: 'modifier_removed',
      payload: removed,
      timestamp: Date.now(),
    });

    return true;
  }

  /** 回合结束时更新 Modifier 持续时间 */
  private tickModifiers(): void {
    const expired: TemporaryModifier[] = [];
    
    this.state.activeModifiers = this.state.activeModifiers.filter((modifier) => {
      if (modifier.duration === -1) return true; // 永久效果
      modifier.duration -= 1;
      if (modifier.duration <= 0) {
        expired.push(modifier);
        return false;
      }
      return true;
    });

    expired.forEach((m) => {
      this.emit({
        type: 'modifier_expired',
        payload: m,
        timestamp: Date.now(),
      });
    });
  }

  /** 获取影响特定属性的所有 Modifier */
  getModifiersForAttribute(attribute: string): TemporaryModifier[] {
    return this.state.activeModifiers.filter((m) =>
      m.affectedAttributes.includes(attribute)
    );
  }

  /** 计算属性的最终乘数 */
  computeMultiplier(attribute: string): number {
    const modifiers = this.getModifiersForAttribute(attribute);
    return modifiers.reduce((acc, m) => acc * (m.multiplier ?? 1), 1);
  }

  /** 计算属性的固定加成 */
  computeFlatBonus(attribute: string): number {
    const modifiers = this.getModifiersForAttribute(attribute);
    return modifiers.reduce((acc, m) => acc + (m.flatBonus ?? 0), 0);
  }


  // ============ 卦象系统 ============

  /** 应用卦象效果 */
  applyHexagram(hexagram: HexagramDefinition): void {
    // 移除旧卦象的 Modifier
    if (this.state.currentHexagram) {
      this.state.activeModifiers = this.state.activeModifiers.filter(
        (m) => m.source !== 'hexagram'
      );
    }

    this.state.currentHexagram = hexagram;

    // 添加新卦象的 Modifier
    const hexagramModifierId = `HEX_${hexagram.id.toUpperCase()}`;
    if (this.modifierRegistry.isRegistered(hexagramModifierId)) {
      this.addModifier(hexagramModifierId, hexagram.defaultDuration);
    }

    this.emit({
      type: 'hexagram_changed',
      payload: hexagram,
      timestamp: Date.now(),
    });
  }

  /** 清除当前卦象 */
  clearHexagram(): void {
    if (!this.state.currentHexagram) return;

    this.state.activeModifiers = this.state.activeModifiers.filter(
      (m) => m.source !== 'hexagram'
    );
    this.state.currentHexagram = undefined;

    this.emit({
      type: 'hexagram_changed',
      payload: null,
      timestamp: Date.now(),
    });
  }

  // ============ 场景管理 ============

  /** 切换场景 */
  setScenario(scenario: ScenarioConfig): void {
    this.state.scenario = scenario;
    this.emit({
      type: 'scenario_changed',
      payload: scenario,
      timestamp: Date.now(),
    });
  }

  // ============ 财务计算 ============

  /** 计算主体的被动收入（应用 Modifier） */
  computePassiveIncome(baseItems: { name: string; amount: number }[]): number {
    const multiplier = this.computeMultiplier('被动收入');
    const flatBonus = this.computeFlatBonus('被动收入');
    const base = baseItems.reduce((sum, item) => sum + item.amount, 0);
    return Math.round(base * multiplier + flatBonus);
  }

  /** 计算主体的被动支出（应用 Modifier） */
  computePassiveExpense(baseItems: { name: string; amount: number }[]): number {
    const multiplier = this.computeMultiplier('被动支出');
    const flatBonus = this.computeFlatBonus('被动支出');
    const base = baseItems.reduce((sum, item) => sum + item.amount, 0);
    return Math.round(base * multiplier + flatBonus);
  }

  /** 检查是否破产 */
  checkBankruptcy(cash: number): boolean {
    return cash < this.state.core.bankruptcyThreshold;
  }

  // ============ 决策验证 ============

  /** 验证决策是否合法 */
  validateDecision(
    entityCash: number,
    decisionCost: number
  ): { valid: boolean; reason?: string } {
    const remainingCash = entityCash - decisionCost;
    
    if (remainingCash < this.state.core.bankruptcyThreshold) {
      return {
        valid: false,
        reason: `[规则触发] 现金流不足，此决策将导致立即破产（剩余: ${remainingCash}）`,
      };
    }

    return { valid: true };
  }

  // ============ 事件监听 ============

  subscribe(listener: RuleChangeListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private emit(event: RuleChangeEvent): void {
    this.listeners.forEach((listener) => listener(event));
  }

  // ============ 序列化 ============

  /** 导出状态（用于存档） */
  exportState(): RuleState {
    return JSON.parse(JSON.stringify(this.state));
  }

  /** 导入状态（用于读档） */
  importState(state: RuleState): void {
    this.state = JSON.parse(JSON.stringify(state));
  }

  /** 重置到初始状态 */
  reset(): void {
    this.state = {
      core: DEFAULT_CORE_RULES,
      scenario: DEFAULT_SCENARIO,
      activeModifiers: [],
      currentRound: 0,
    };
  }
}

export default RuleManager;
