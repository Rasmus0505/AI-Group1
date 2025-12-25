import { useState, useEffect, useCallback, useRef } from 'react';

interface UseDecisionTimerOptions {
  /** 截止时间（ISO 字符串） */
  deadline: string | null;
  /** 是否启用 */
  enabled?: boolean;
  /** 紧急阈值（秒），低于此值触发紧急回调 */
  urgentThreshold?: number;
  /** 紧急回调 */
  onUrgent?: (remainingSeconds: number) => void;
  /** 超时回调 */
  onTimeout?: () => void;
}

interface DecisionTimerState {
  /** 剩余秒数 */
  remainingSeconds: number;
  /** 格式化的剩余时间（MM:SS） */
  formattedTime: string;
  /** 是否已超时 */
  isTimeout: boolean;
  /** 是否紧急（低于阈值） */
  isUrgent: boolean;
  /** 进度百分比（0-100） */
  progressPercent: number;
}

/**
 * useDecisionTimer - 决策倒计时 Hook
 * 
 * 功能：
 * - 实时倒计时显示
 * - 紧急状态检测
 * - 超时处理
 * - 进度百分比计算
 */
export function useDecisionTimer(options: UseDecisionTimerOptions): DecisionTimerState {
  const {
    deadline,
    enabled = true,
    urgentThreshold = 60,
    onUrgent,
    onTimeout,
  } = options;

  const [state, setState] = useState<DecisionTimerState>({
    remainingSeconds: 0,
    formattedTime: '--:--',
    isTimeout: false,
    isUrgent: false,
    progressPercent: 100,
  });

  const initialSecondsRef = useRef<number>(0);
  const urgentTriggeredRef = useRef<boolean>(false);
  const timeoutTriggeredRef = useRef<boolean>(false);

  // 格式化时间
  const formatTime = useCallback((seconds: number): string => {
    if (seconds <= 0) return '00:00';
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }, []);

  // 计算剩余时间
  const calculateRemaining = useCallback((): number => {
    if (!deadline) return -1; // 返回 -1 表示没有 deadline
    const end = new Date(deadline).getTime();
    const now = Date.now();
    const diff = Math.floor((end - now) / 1000);
    return Math.max(0, diff);
  }, [deadline]);

  // 初始化
  useEffect(() => {
    if (!deadline || !enabled) {
      setState({
        remainingSeconds: 0,
        formattedTime: '--:--',
        isTimeout: false,
        isUrgent: false,
        progressPercent: 100,
      });
      urgentTriggeredRef.current = false;
      timeoutTriggeredRef.current = false;
      return;
    }

    // 计算初始剩余时间
    const initial = calculateRemaining();
    
    // 如果 deadline 已经过期很久（超过 5 秒），可能是旧数据，不触发超时
    // 等待服务器推送新的 deadline
    if (initial <= 0) {
      setState({
        remainingSeconds: 0,
        formattedTime: '等待中...',
        isTimeout: false, // 不立即标记为超时，等待服务器更新
        isUrgent: false,
        progressPercent: 0,
      });
      urgentTriggeredRef.current = false;
      timeoutTriggeredRef.current = false;
      return;
    }
    
    initialSecondsRef.current = initial;
    urgentTriggeredRef.current = false;
    timeoutTriggeredRef.current = false;

    // 更新状态
    const updateState = () => {
      const remaining = calculateRemaining();
      const isTimeout = remaining <= 0;
      const isUrgent = remaining > 0 && remaining <= urgentThreshold;
      const progressPercent = initialSecondsRef.current > 0
        ? Math.max(0, Math.min(100, (remaining / initialSecondsRef.current) * 100))
        : 0;

      setState({
        remainingSeconds: remaining,
        formattedTime: formatTime(remaining),
        isTimeout,
        isUrgent,
        progressPercent,
      });

      // 触发紧急回调（只触发一次）
      if (isUrgent && !urgentTriggeredRef.current) {
        urgentTriggeredRef.current = true;
        onUrgent?.(remaining);
      }

      // 触发超时回调（只触发一次）
      if (isTimeout && !timeoutTriggeredRef.current) {
        timeoutTriggeredRef.current = true;
        onTimeout?.();
      }
    };

    // 立即更新一次
    updateState();

    // 每秒更新
    const timer = setInterval(updateState, 1000);

    return () => clearInterval(timer);
  }, [deadline, enabled, urgentThreshold, calculateRemaining, formatTime, onUrgent, onTimeout]);

  return state;
}

/**
 * 格式化剩余时间为人类可读格式
 */
export function formatRemainingTime(seconds: number): string {
  if (seconds <= 0) return '已超时';
  if (seconds < 60) return `${seconds} 秒`;
  if (seconds < 3600) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return s > 0 ? `${m} 分 ${s} 秒` : `${m} 分钟`;
  }
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  return m > 0 ? `${h} 小时 ${m} 分` : `${h} 小时`;
}

export default useDecisionTimer;
