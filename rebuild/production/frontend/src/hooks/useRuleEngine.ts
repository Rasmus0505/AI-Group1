/**
 * useRuleEngine Hook
 * React 集成三层规则架构
 */

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { RuleManager } from '../engine/RuleManager';
import type {
  RuleState,
  ScenarioConfig,
  TemporaryModifier,
  HexagramDefinition,
  RuleChangeEvent,
} from '../engine/types/rules';

interface UseRuleEngineOptions {
  scenario?: ScenarioConfig;
  onRuleChange?: (event: RuleChangeEvent) => void;
}

interface UseRuleEngineReturn {
  // 状态
  state: RuleState;
  currentRound: number;
  activeModifiers: ReadonlyArray<TemporaryModifier>;
  currentHexagram: HexagramDefinition | undefined;
  
  // 操作
  advanceRound: () => void;
  addModifier: (modifierId: string, duration?: number) => TemporaryModifier | null;
  removeModifier: (instanceId: string) => boolean;
  applyHexagram: (hexagram: HexagramDefinition) => void;
  clearHexagram: () => void;
  setScenario: (scenario: ScenarioConfig) => void;
  
  // 计算
  computePassiveIncome: (items: { name: string; amount: number }[]) => number;
  computePassiveExpense: (items: { name: string; amount: number }[]) => number;
  validateDecision: (cash: number, cost: number) => { valid: boolean; reason?: string };
  checkBankruptcy: (cash: number) => boolean;
  getModifiersForAttribute: (attr: string) => TemporaryModifier[];
  
  // 序列化
  exportState: () => RuleState;
  importState: (state: RuleState) => void;
  reset: () => void;
}

export function useRuleEngine(options: UseRuleEngineOptions = {}): UseRuleEngineReturn {
  const { scenario, onRuleChange } = options;
  
  // 使用 ref 保持 RuleManager 实例稳定
  const managerRef = useRef<RuleManager | null>(null);
  if (!managerRef.current) {
    managerRef.current = new RuleManager(scenario);
  }
  const manager = managerRef.current;

  // 状态同步
  const [state, setState] = useState<RuleState>(() => manager.getState());

  // 监听规则变化
  useEffect(() => {
    const unsubscribe = manager.subscribe((event) => {
      setState(manager.getState());
      onRuleChange?.(event);
    });
    return unsubscribe;
  }, [manager, onRuleChange]);

  // 操作方法
  const advanceRound = useCallback(() => {
    manager.advanceRound();
    setState(manager.getState());
  }, [manager]);

  const addModifier = useCallback(
    (modifierId: string, duration?: number) => {
      const result = manager.addModifier(modifierId, duration);
      setState(manager.getState());
      return result;
    },
    [manager]
  );

  const removeModifier = useCallback(
    (instanceId: string) => {
      const result = manager.removeModifier(instanceId);
      setState(manager.getState());
      return result;
    },
    [manager]
  );

  const applyHexagram = useCallback(
    (hexagram: HexagramDefinition) => {
      manager.applyHexagram(hexagram);
      setState(manager.getState());
    },
    [manager]
  );

  const clearHexagram = useCallback(() => {
    manager.clearHexagram();
    setState(manager.getState());
  }, [manager]);

  const setScenario = useCallback(
    (newScenario: ScenarioConfig) => {
      manager.setScenario(newScenario);
      setState(manager.getState());
    },
    [manager]
  );

  // 计算方法
  const computePassiveIncome = useCallback(
    (items: { name: string; amount: number }[]) => manager.computePassiveIncome(items),
    [manager]
  );

  const computePassiveExpense = useCallback(
    (items: { name: string; amount: number }[]) => manager.computePassiveExpense(items),
    [manager]
  );

  const validateDecision = useCallback(
    (cash: number, cost: number) => manager.validateDecision(cash, cost),
    [manager]
  );

  const checkBankruptcy = useCallback(
    (cash: number) => manager.checkBankruptcy(cash),
    [manager]
  );

  const getModifiersForAttribute = useCallback(
    (attr: string) => manager.getModifiersForAttribute(attr),
    [manager]
  );

  // 序列化方法
  const exportState = useCallback(() => manager.exportState(), [manager]);

  const importState = useCallback(
    (newState: RuleState) => {
      manager.importState(newState);
      setState(manager.getState());
    },
    [manager]
  );

  const reset = useCallback(() => {
    manager.reset();
    setState(manager.getState());
  }, [manager]);

  // 派生状态
  const currentRound = useMemo(() => state.currentRound, [state.currentRound]);
  const activeModifiers = useMemo(() => state.activeModifiers, [state.activeModifiers]);
  const currentHexagram = useMemo(() => state.currentHexagram, [state.currentHexagram]);

  return {
    state,
    currentRound,
    activeModifiers,
    currentHexagram,
    advanceRound,
    addModifier,
    removeModifier,
    applyHexagram,
    clearHexagram,
    setScenario,
    computePassiveIncome,
    computePassiveExpense,
    validateDecision,
    checkBankruptcy,
    getModifiersForAttribute,
    exportState,
    importState,
    reset,
  };
}

export default useRuleEngine;
