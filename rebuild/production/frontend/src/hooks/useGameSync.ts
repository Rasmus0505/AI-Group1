import { useEffect, useState, useCallback, useRef } from 'react';
import { message } from 'antd';
import { wsService } from '../services/websocket';
import { gameAPI } from '../services/game';
import type { TurnResultDTO, TurnAchievement } from '../types/turnResult';

export type GamePhase = 'READING' | 'DECIDING' | 'RESOLVING';
export type RoundStatus = 'decision' | 'review' | 'inference' | 'result' | 'finished';

interface GameSyncState {
  /** 当前回合 */
  currentRound: number;
  /** 回合状态 */
  roundStatus: RoundStatus;
  /** 决策截止时间 */
  decisionDeadline: string | null;
  /** 游戏状态 */
  gameStatus: 'playing' | 'paused' | 'finished';
  /** 推演结果 */
  turnResult: TurnResultDTO | null;
  /** 完整游戏状态 */
  gameState: Record<string, unknown> | null;
  /** 已提交决策数 */
  submittedDecisions: number;
  /** 总玩家数 */
  totalPlayers: number;
  /** 新解锁的成就 */
  newAchievements: TurnAchievement[];
  /** 是否正在加载 */
  loading: boolean;
  /** 错误信息 */
  error: string | null;
}

interface UseGameSyncOptions {
  /** 会话ID */
  sessionId: string;
  /** 是否自动刷新 */
  autoRefresh?: boolean;
  /** 刷新间隔（毫秒） */
  refreshInterval?: number;
  /** 阶段变化回调 */
  onPhaseChange?: (phase: GamePhase, roundStatus: RoundStatus) => void;
  /** 推演完成回调 */
  onInferenceComplete?: (result: TurnResultDTO) => void;
  /** 成就解锁回调 */
  onAchievementUnlock?: (achievements: TurnAchievement[]) => void;
  /** 超时回调 */
  onTimeout?: () => void;
}

/**
 * useGameSync - 游戏状态实时同步 Hook
 * 
 * 功能：
 * - 订阅 WebSocket 事件（phase_changed, decision_submitted, intel_updated 等）
 * - 自动刷新游戏状态
 * - 断线重连后自动同步
 * - 超时检测和处理
 */
export function useGameSync(options: UseGameSyncOptions) {
  const {
    sessionId,
    autoRefresh = true,
    refreshInterval = 30000,
    onPhaseChange,
    onInferenceComplete,
    onAchievementUnlock,
    onTimeout,
  } = options;

  const [state, setState] = useState<GameSyncState>({
    currentRound: 1,
    roundStatus: 'decision',
    decisionDeadline: null,
    gameStatus: 'playing',
    turnResult: null,
    gameState: null,
    submittedDecisions: 0,
    totalPlayers: 0,
    newAchievements: [],
    loading: true,
    error: null,
  });

  const prevRoundStatusRef = useRef<RoundStatus | null>(null);
  const timeoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 将 roundStatus 映射为 GamePhase
  const mapToPhase = useCallback((roundStatus: RoundStatus): GamePhase => {
    switch (roundStatus) {
      case 'decision':
        return 'DECIDING';
      case 'review':
      case 'inference':
        return 'RESOLVING';
      case 'result':
      case 'finished':
        return 'READING';
      default:
        return 'READING';
    }
  }, []);

  // 加载游戏状态
  const loadGameState = useCallback(async () => {
    if (!sessionId) return;

    try {
      const gameState = await gameAPI.getGameState(sessionId);
      
      setState(prev => ({
        ...prev,
        currentRound: gameState.currentRound,
        roundStatus: gameState.roundStatus,
        decisionDeadline: gameState.decisionDeadline,
        gameStatus: gameState.gameStatus,
        gameState: gameState.gameState,
        submittedDecisions: gameState.submittedDecisions,
        totalPlayers: gameState.totalPlayers,
        loading: false,
        error: null,
      }));

      // 检查阶段变化
      if (prevRoundStatusRef.current !== gameState.roundStatus) {
        const newPhase = mapToPhase(gameState.roundStatus);
        onPhaseChange?.(newPhase, gameState.roundStatus);
        prevRoundStatusRef.current = gameState.roundStatus;
      }

      // 如果有推演结果，加载它
      if (gameState.inferenceResult?.result) {
        const result = gameState.inferenceResult.result as any;
        const turnResult: TurnResultDTO | undefined = result.uiTurnResult || result;
        
        if (turnResult) {
          setState(prev => ({ ...prev, turnResult }));
          
          // 检查新成就
          if (turnResult.achievements && turnResult.achievements.length > 0) {
            setState(prev => ({
              ...prev,
              newAchievements: turnResult.achievements,
            }));
            onAchievementUnlock?.(turnResult.achievements);
          }
        }
      }
    } catch (error: any) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message || '加载游戏状态失败',
      }));
    }
  }, [sessionId, mapToPhase, onPhaseChange, onAchievementUnlock]);

  // 加载推演结果
  const loadTurnResult = useCallback(async (round?: number) => {
    if (!sessionId) return;

    try {
      const targetRound = round || state.currentRound;
      const result = await gameAPI.getInferenceResult(sessionId, targetRound);
      
      if (result.status === 'completed' && result.result) {
        const turnResult: TurnResultDTO | undefined = 
          result.result.uiTurnResult || (result.result as any);
        
        if (turnResult) {
          setState(prev => ({ ...prev, turnResult }));
          onInferenceComplete?.(turnResult);
        }
      }
    } catch {
      // 静默失败，推演结果可能还不存在
    }
  }, [sessionId, state.currentRound, onInferenceComplete]);

  // 清除成就（显示后调用）
  const clearAchievements = useCallback(() => {
    setState(prev => ({ ...prev, newAchievements: [] }));
  }, []);

  // 手动刷新
  const refresh = useCallback(() => {
    loadGameState();
  }, [loadGameState]);

  // 设置超时检测
  useEffect(() => {
    if (!state.decisionDeadline || state.roundStatus !== 'decision') {
      if (timeoutTimerRef.current) {
        clearTimeout(timeoutTimerRef.current);
        timeoutTimerRef.current = null;
      }
      return;
    }

    const deadline = new Date(state.decisionDeadline).getTime();
    const now = Date.now();
    const remaining = deadline - now;

    if (remaining <= 0) {
      onTimeout?.();
      return;
    }

    // 设置超时定时器
    timeoutTimerRef.current = setTimeout(() => {
      onTimeout?.();
      message.warning('决策时间已到！');
    }, remaining);

    return () => {
      if (timeoutTimerRef.current) {
        clearTimeout(timeoutTimerRef.current);
      }
    };
  }, [state.decisionDeadline, state.roundStatus, onTimeout]);

  // WebSocket 事件监听
  useEffect(() => {
    if (!sessionId) return;

    // 设置活动会话
    wsService.setActiveSession(sessionId);

    // 游戏状态更新
    const handleGameStateUpdate = (payload: any) => {
      setState(prev => ({
        ...prev,
        currentRound: payload.currentRound ?? prev.currentRound,
        roundStatus: payload.roundStatus ?? prev.roundStatus,
        decisionDeadline: payload.decisionDeadline ?? prev.decisionDeadline,
        gameStatus: payload.status ?? prev.gameStatus,
      }));

      // 检查阶段变化
      if (payload.roundStatus && prevRoundStatusRef.current !== payload.roundStatus) {
        const newPhase = mapToPhase(payload.roundStatus);
        onPhaseChange?.(newPhase, payload.roundStatus);
        prevRoundStatusRef.current = payload.roundStatus;
      }

      // 如果进入结果阶段，加载推演结果
      if (payload.roundStatus === 'result') {
        loadTurnResult(payload.currentRound);
      }
    };

    // 决策状态更新
    const handleDecisionStatusUpdate = () => {
      // 刷新游戏状态以获取最新的提交数
      loadGameState();
    };

    // 阶段变化
    const handleStageChanged = (payload: any) => {
      if (payload.stage) {
        const newPhase = mapToPhase(payload.stage);
        onPhaseChange?.(newPhase, payload.stage);
      }
    };

    // 推演完成
    const handleInferenceCompleted = (payload: any) => {
      loadTurnResult(payload.round);
    };

    // 成就解锁
    const handleAchievementUnlocked = (payload: any) => {
      if (payload.achievement) {
        setState(prev => ({
          ...prev,
          newAchievements: [...prev.newAchievements, payload.achievement],
        }));
        onAchievementUnlock?.([payload.achievement]);
      }
    };

    // 情报更新
    const handleIntelUpdated = () => {
      loadGameState();
    };

    // 注册事件监听
    wsService.on('game_state_update', handleGameStateUpdate);
    wsService.on('decision_status_update', handleDecisionStatusUpdate);
    wsService.on('stage_changed', handleStageChanged);
    wsService.on('round_stage_changed', handleStageChanged);
    wsService.on('inference_completed', handleInferenceCompleted);
    wsService.on('achievement_unlocked', handleAchievementUnlocked);
    wsService.on('intel_updated', handleIntelUpdated);

    // 初始加载
    loadGameState();

    return () => {
      wsService.setActiveSession(null);
      wsService.off('game_state_update', handleGameStateUpdate);
      wsService.off('decision_status_update', handleDecisionStatusUpdate);
      wsService.off('stage_changed', handleStageChanged);
      wsService.off('round_stage_changed', handleStageChanged);
      wsService.off('inference_completed', handleInferenceCompleted);
      wsService.off('achievement_unlocked', handleAchievementUnlocked);
      wsService.off('intel_updated', handleIntelUpdated);
    };
  }, [sessionId, loadGameState, loadTurnResult, mapToPhase, onPhaseChange, onAchievementUnlock]);

  // 自动刷新
  useEffect(() => {
    if (!autoRefresh || !sessionId) return;

    const timer = setInterval(() => {
      loadGameState();
    }, refreshInterval);

    return () => clearInterval(timer);
  }, [autoRefresh, sessionId, refreshInterval, loadGameState]);

  return {
    ...state,
    phase: mapToPhase(state.roundStatus),
    refresh,
    loadTurnResult,
    clearAchievements,
  };
}

export default useGameSync;
