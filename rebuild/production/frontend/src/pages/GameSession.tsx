import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Input, Button, Tag, List, message,
  Row, Col, Avatar, Progress, Divider, Spin, Space
} from 'antd';
import {
  Users, Zap, Coins, Trophy,
  Target, MessageSquare, Send, RefreshCw,
  Clock, History, ArrowRight, Activity, Info, ArrowLeft,
  Wallet, Save, ListTodo,
} from 'lucide-react';
import { gameAPI, GameSessionSummary, DecisionSummary } from '../services/game';
import { useAuthStore } from '../stores/authStore';
import { wsService } from '../services/websocket';
import { useSocket } from '../hooks/useSocket';
import { useMessageRouter } from '../hooks/useMessageRouter';
import { useDecisionTimer } from '../hooks/useDecisionTimer';
import { GlassCard } from '../components/GlassCard';
import ResourcePanel from '../components/ResourcePanel';
import NarrativeFeed from '../components/NarrativeFeed';
import ChatSystem from '../components/ChatSystem';
import OpponentIntel, { OpponentIntelRecord } from '../components/OpponentIntel';
import LeaderboardPanel from '../components/LeaderboardPanel';
import AssessmentCards from '../components/AssessmentCards';
import HexagramDisplay from '../components/HexagramDisplay';
import { AchievementManager } from '../components/AchievementPopup';
import { HelpButton } from '../components/HelpButton';
import TradeDrawer from '../components/TradeDrawer';
import SaveDrawer from '../components/SaveDrawer';
import TaskDrawer from '../components/TaskDrawer';
import CashFlowChart from '../components/CashFlowChart';
import type { TurnResultDTO, TurnAchievement, TurnHexagram } from '../types/turnResult';

const { TextArea } = Input;

function GameSessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const socketStatus = useSocket();
  useMessageRouter();

  const [session, setSession] = useState<GameSessionSummary | null>(null);
  const [decisions, setDecisions] = useState<DecisionSummary[]>([]);
  const [decisionText, setDecisionText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [recommendedOptions, setRecommendedOptions] = useState<Array<{
    option_id: string;
    text: string;
    expected_effect: string;
    category: string;
  }>>([]);
  const [advancedView, setAdvancedView] = useState(false);
  const [advancedSharedSnippet, setAdvancedSharedSnippet] = useState('');
  const [turnResult, setTurnResult] = useState<TurnResultDTO | null>(null);
  const [gameState, setGameState] = useState<any>(null); // 完整的游戏状态（包含 players、currentHexagram 等）
  // 新增：成就队列
  const [pendingAchievements, setPendingAchievements] = useState<TurnAchievement[]>([]);
  // 新增：抽屉状态
  const [tradeDrawerOpen, setTradeDrawerOpen] = useState(false);
  const [saveDrawerOpen, setSaveDrawerOpen] = useState(false);
  const [taskDrawerOpen, setTaskDrawerOpen] = useState(false);
  // 新增：现金流历史
  const [cashHistory, setCashHistory] = useState<Array<{ round: number; cash: number }>>([]);

  // 使用 useDecisionTimer hook
  const timerState = useDecisionTimer({
    deadline: session?.decisionDeadline || null,
    enabled: session?.roundStatus === 'decision',
    urgentThreshold: 60,
    onUrgent: useCallback((remaining: number) => {
      message.warning(`决策时间紧迫！还剩 ${remaining} 秒`);
    }, []),
    onTimeout: useCallback(() => {
      message.error('决策时间已到！');
    }, []),
  });

  const isTimeout = timerState.isTimeout;

  const getPlaceholderText = useMemo(() => {
    return () => {
      if (!session) return '正在加载...';

      // Check if current stage is not decision phase
      if (session.roundStatus !== 'decision') {
        return '当前非决策阶段，无法提交决策';
      }

      // Calculate remaining time
      const remainingSeconds = session.decisionDeadline
        ? Math.floor((new Date(session.decisionDeadline).getTime() - currentTime) / 1000)
        : 0;

      // Urgent time warning
      if (remainingSeconds > 0 && remainingSeconds < 60) {
        return '时间紧迫！请快速做出决策并提交...';
      }

      // Has recommended options
      if (recommendedOptions.length > 0) {
        return `可以输入自定义决策，或选择下方AI推荐的${recommendedOptions.length}个选项之一`;
      }

      // Default placeholder
      return '描述你的决策行动，越具体越好...';
    };
  }, [session, currentTime, recommendedOptions.length]);

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  // 定期同步会话状态和决策列表（带请求锁防止堆积）
  useEffect(() => {
    if (!sessionId) return;
    
    let isSyncing = false; // 请求锁
    let isDecisionSyncing = false; // 决策同步锁
    
    const syncInterval = setInterval(() => {
      // 会话同步（带锁）
      if (!isSyncing) {
        isSyncing = true;
        (async () => {
          try {
            const data = await gameAPI.getSession(sessionId);
            setSession(data);
            
            if (data.hostId && (user?.userId || user?.id) && data.hostId === (user?.userId || user?.id)) {
              navigate(`/game/${sessionId}/state`, { replace: true });
            }
          } catch (err) {
            console.error('同步会话信息失败:', err);
          } finally {
            isSyncing = false;
          }
        })();
      }
      
      // 决策同步（带锁）
      if (!isDecisionSyncing && session?.currentRound) {
        isDecisionSyncing = true;
        (async () => {
          try {
            const data = await gameAPI.getRoundDecisions(sessionId, session.currentRound);
            setDecisions(data.actions);
          } catch (err) {
            // 忽略初始空数据
          } finally {
            isDecisionSyncing = false;
          }
        })();
      }
    }, 3000); // 每3秒同步一次
    
    return () => clearInterval(syncInterval);
  }, [sessionId, user?.userId, user?.id, navigate, session?.currentRound]);

  const loadSession = useMemo(
    () => async () => {
      if (!sessionId) return;
      try {
        const data = await gameAPI.getSession(sessionId);
        setSession(data);
        
        // 如果是主持人，跳转到游戏状态页面
        if (data.hostId && (user?.userId || user?.id) && data.hostId === (user?.userId || user?.id)) {
          navigate(`/game/${sessionId}/state`, { replace: true });
        }
      } catch (err) {
        message.error('获取会话信息失败');
      }
    },
    [sessionId, user?.userId, user?.id, navigate]
  );

  const loadDecisions = useMemo(
    () => async () => {
      if (!sessionId || !session?.currentRound) return;
      try {
        const data = await gameAPI.getRoundDecisions(sessionId, session.currentRound);
        setDecisions(data.actions);
      } catch (err) {
        // 忽略初始空数据
      }
    },
    [sessionId, session?.currentRound]
  );

  const loadTurnResult = useMemo(
    () => async () => {
      if (!sessionId) return;
      try {
        const state = await gameAPI.getGameState(sessionId);
        setGameState(state.gameState); // 保存完整的游戏状态
        
        const rawResult = state.inferenceResult?.result as any;
        const uiTurn: TurnResultDTO | undefined =
          rawResult?.uiTurnResult || (state.gameState as any)?.uiTurnResult;
        setTurnResult(uiTurn || null);
        
        // 更新现金流历史
        if (uiTurn?.ledger?.balance && session?.currentRound) {
          setCashHistory(prev => {
            const existing = prev.find(h => h.round === session.currentRound);
            if (existing) return prev;
            return [...prev, { round: session.currentRound, cash: uiTurn.ledger?.balance || 0 }].slice(-10);
          });
        }
      } catch {
        // 推演结果是增量能力，失败时静默忽略
        setTurnResult(null);
        setGameState(null);
      }
    },
    [sessionId, session?.currentRound]
  );

  useEffect(() => {
    if (!sessionId) return;
    loadSession();
    // 同步一次当前回合的推演摘要（若已存在）
    loadTurnResult();
  }, [sessionId, loadSession, loadTurnResult]);

  useEffect(() => {
    loadDecisions();
  }, [loadDecisions]);

  // Load recommended decision options
  useEffect(() => {
    if (!sessionId || !session || session.roundStatus !== 'decision') {
      setRecommendedOptions([]);
      return;
    }

    // 第一回合必须等待 gameState 加载完成，以确保使用 initialOptions
    // 避免在 gameState 未加载时调用 API 生成选项导致数据不一致
    if (session.currentRound === 1 && !gameState) {
      // gameState 还未加载，暂不加载选项，等待 gameState 加载完成后再触发
      return;
    }

    const loadOptions = async () => {
      try {
        // 第一回合优先使用 gameState 中的 initialOptions
        if (session.currentRound === 1 && gameState) {
          const gs = gameState as any;
          if (gs.initialOptions && Array.isArray(gs.initialOptions) && gs.initialOptions.length > 0) {
            // 转换 initialOptions 格式以匹配 recommendedOptions 的结构
            const formattedOptions = gs.initialOptions.map((opt: any) => ({
              option_id: opt.id || opt.option_id || String(Math.random()),
              text: opt.text || opt.description || '',
              expected_effect: opt.expected_effect || opt.effect || '',
              category: opt.category || 'general',
            }));
            setRecommendedOptions(formattedOptions);
            return;
          }
        }
        
        // 其他回合或没有 initialOptions 时，调用 API 动态生成
        const data = await gameAPI.getDecisionOptions(sessionId, session.currentRound);
        setRecommendedOptions(data.options || []);
      } catch (err) {
        // Silently fail - options are optional
        setRecommendedOptions([]);
      }
    };

    loadOptions();
  }, [sessionId, session?.currentRound, session?.roundStatus, gameState]);

  // 处理成就解锁（需要在 WebSocket useEffect 之前定义）
  const handleAchievementUnlock = useCallback((achievements: TurnAchievement[]) => {
    setPendingAchievements(prev => [...prev, ...achievements]);
  }, []);

  // 清除已显示的成就
  const handleAchievementsClosed = useCallback(() => {
    setPendingAchievements([]);
  }, []);

  useEffect(() => {
    if (!sessionId) return;
    wsService.setActiveSession(sessionId);

    // 加入房间以接收 WebSocket 广播事件
    // 注意：后端使用 io.to(roomId).emit() 广播事件，所以前端必须加入房间
    if (session?.roomId) {
      wsService.trackRoom(session.roomId);
      wsService.send('join_room', { roomId: session.roomId });
    }

    const handleDecisionStatusUpdate = () => loadDecisions();

    const handleGameStateUpdate = (payload: any) => {
      setSession(prev => (prev ? { ...prev, ...payload } : payload));

      // 决策阶段提示
      if (payload.roundStatus === 'decision') {
        message.info(`第 ${payload.currentRound} 回合决策开始`);
      }

      // 当推演进入 inference / result 阶段时，刷新一次回合结果视图模型
      if (
        (payload.roundStatus === 'inference' || payload.roundStatus === 'result') &&
        sessionId
      ) {
        loadTurnResult();
      }

      // 当回合进入结果阶段时，自动跳转到推演结果页
      if (payload.roundStatus === 'result' && sessionId && payload.currentRound) {
        navigate(`/game/${sessionId}/round/${payload.currentRound}/inference`);
      }
    };

    // 成就解锁事件
    const handleAchievementUnlocked = (payload: any) => {
      if (payload.achievement) {
        handleAchievementUnlock([payload.achievement]);
      } else if (payload.achievements) {
        handleAchievementUnlock(payload.achievements);
      }
    };

    // 时限调整事件
    const handleTimeLimitAdjusted = (payload: any) => {
      if (payload.sessionId === sessionId) {
        setSession(prev => prev ? { 
          ...prev, 
          decisionDeadline: payload.newDeadline 
        } : prev);
        message.info(`时限已延长${payload.additionalMinutes}分钟`);
      }
    };

    // 推演完成事件
    const handleInferenceCompleted = (payload: any) => {
      if (payload.sessionId === sessionId) {
        message.success('AI 推演完成！');
        loadTurnResult();
        loadSession();
      }
    };

    // 推演进度事件
    const handleInferenceProgress = (payload: any) => {
      if (payload.sessionId === sessionId && payload.message) {
        // 可以在这里显示进度提示
        console.log(`推演进度: ${payload.progress}% - ${payload.message}`);
      }
    };

    // 游戏终止事件：主持人终止游戏后，玩家自动返回房间
    const handleGameFinished = (payload: any) => {
      // 检查是否是当前会话的终止事件
      if (payload.sessionId === sessionId || (session?.roomId && payload.roomId === session.roomId)) {
        const reason = payload.reason;
        if (reason === 'terminated_by_host') {
          message.warning('主持人已终止游戏，正在返回房间...');
        } else if (reason === 'reset_by_host') {
          message.warning('主持人已重置房间，正在返回房间...');
        } else {
          message.info('游戏已结束，正在返回房间...');
        }
        // 延迟一小段时间让用户看到提示，然后跳转
        setTimeout(() => {
          if (session?.roomId) {
            navigate(`/rooms/${session.roomId}/waiting`);
          } else {
            navigate('/rooms');
          }
        }, 1500);
      }
    };

    wsService.on('decision_status_update', handleDecisionStatusUpdate);
    wsService.on('game_state_update', handleGameStateUpdate);
    wsService.on('achievement_unlocked', handleAchievementUnlocked);
    wsService.on('time_limit_adjusted', handleTimeLimitAdjusted);
    wsService.on('inference_completed', handleInferenceCompleted);
    wsService.on('inference_progress', handleInferenceProgress);
    wsService.on('game_finished', handleGameFinished);

    return () => {
      wsService.setActiveSession(null);
      // 离开房间
      if (session?.roomId) {
        wsService.untrackRoom(session.roomId);
      }
      wsService.off('decision_status_update', handleDecisionStatusUpdate);
      wsService.off('game_state_update', handleGameStateUpdate);
      wsService.off('achievement_unlocked', handleAchievementUnlocked);
      wsService.off('time_limit_adjusted', handleTimeLimitAdjusted);
      wsService.off('inference_completed', handleInferenceCompleted);
      wsService.off('inference_progress', handleInferenceProgress);
      wsService.off('game_finished', handleGameFinished);
    };
  }, [sessionId, session?.roomId, loadDecisions, loadTurnResult, navigate, handleAchievementUnlock, loadSession]);

  // 键盘快捷键：Ctrl+Enter 提交决策
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        if (session?.roundStatus === 'decision' && decisionText.trim() && !submitting) {
          handleSubmitDecision();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [session?.roundStatus, decisionText, submitting]);

  const handleSubmitDecision = async () => {
    if (!sessionId || !session) return;
    
    // 检查是否超时（仅限制玩家提交，主持人不受此限制）
    const isHost = session.hostId && (user?.userId || user?.id) && session.hostId === (user?.userId || user?.id);
    if (isTimeout && !isHost) {
      message.error('当前回合决策已超时，无法提交');
      return;
    }
    
    if (session.roundStatus !== 'decision') {
      message.error('当前阶段不允许提交决策');
      return;
    }
    
    if (!decisionText.trim()) {
      message.warning('请输入决策内容');
      return;
    }
    setSubmitting(true);
    try {
      await gameAPI.submitDecision(sessionId, {
        round: session.currentRound,
        actionText: decisionText.trim(),
      });
      message.success('决策已提交');
      loadDecisions();
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || '提交决策失败');
    } finally {
      setSubmitting(false);
    }
  };

  // 为高级视图派生一个简单的阶段状态，用于 NarrativeFeed 等组件
  // 注意：必须在早期返回之前调用所有 hooks
  const advancedPhase: 'READING' | 'DECIDING' | 'RESOLVING' = useMemo(() => {
    if (!session) return 'READING';
    return session.roundStatus === 'decision'
      ? 'DECIDING'
      : session.roundStatus === 'result'
      ? 'RESOLVING'
      : 'READING';
  }, [session?.roundStatus]);

  const remainingSecondsNumeric = useMemo(() => {
    if (!session?.decisionDeadline) return 0;
    const end = new Date(session.decisionDeadline).getTime();
    const diff = Math.floor((end - currentTime) / 1000);
    return diff > 0 ? diff : 0;
  }, [session?.decisionDeadline, currentTime]);

  // 获取当前玩家的属性（从 gameState.players[me].attributes）
  const playerAttributes = useMemo(() => {
    if (!gameState || !user?.userId) return {};
    const players = (gameState as any)?.players;
    if (!players || !Array.isArray(players)) return {};
    
    // 找到当前玩家的数据
    const currentPlayer = players.find((p: any) => p.userId === user.userId || p.id === user.userId);
    return currentPlayer?.attributes || {};
  }, [gameState, user?.userId]);

  // 获取当前卦象（从 gameState.currentHexagram）
  const currentHexagram = useMemo(() => {
    if (!gameState) return null;
    return (gameState as any)?.currentHexagram || null;
  }, [gameState]);

  // 获取进行中的事件（从 inferenceResult.events，type 为 ongoing）
  const ongoingEvents = useMemo(() => {
    if (!turnResult?.events) return [];
    return turnResult.events.filter((e: any) => e.type === 'ongoing' || e.status === 'ongoing');
  }, [turnResult?.events]);

  // 获取当前叙事内容（从推演结果中获取）
  const displayNarrative = useMemo(() => {
    // 优先使用 turnResult 中的叙事
    if (turnResult?.narrative) {
      return turnResult.narrative;
    }
    // 其次尝试从 gameState 中获取
    if (gameState) {
      const gs = gameState as any;
      if (gs.narrative) return gs.narrative;
      if (gs.uiTurnResult?.narrative) return gs.uiTurnResult.narrative;
      // 第一回合使用背景故事作为叙事内容
      if (gs.backgroundStory) return gs.backgroundStory;
    }
    // 默认提示
    return '欢迎来到游戏，正在等待第一回合开始...';
  }, [turnResult, gameState]);

  // 解析卦象数据为 TurnHexagram 格式
  const parsedHexagram = useMemo((): TurnHexagram | null => {
    if (!currentHexagram) return null;
    
    // 如果已经是完整格式
    if (typeof currentHexagram === 'object' && currentHexagram.lines) {
      return currentHexagram as TurnHexagram;
    }
    
    // 如果是字符串或简单对象，构造默认格式
    const name = typeof currentHexagram === 'string' 
      ? currentHexagram 
      : (currentHexagram as any)?.name || (currentHexagram as any)?.hexagram || '未知卦';
    
    return {
      name,
      lines: ['yang', 'yin', 'yang', 'yin', 'yang', 'yin'], // 默认六爻
      text: (currentHexagram as any)?.text || (currentHexagram as any)?.description || '',
      omen: (currentHexagram as any)?.omen || 'neutral',
    };
  }, [currentHexagram]);

  // 早期返回必须在所有 hooks 调用之后
  if (!session) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <Spin size="large" />
        <p className="mt-4 text-slate-400">正在同步战场状态...</p>
      </div>
    );
  }

  // 高级视图：基于真实会话状态，组合新的控制台布局
  if (advancedView) {
    // 从 gameState 中获取真实的对手数据（如果有）
    const playersData = (gameState as any)?.players || [];
    const opponentsIntel: OpponentIntelRecord[] = decisions
      .filter(item => item.userId !== user?.userId)
      .map(item => {
        const submitted = item.status === 'submitted';
        
        // 尝试从 gameState.players 中获取真实数据
        const realPlayerData = playersData.find((p: any) => 
          p.userId === item.userId || p.playerIndex === item.playerIndex
        );
        
        const minutesAgo = Math.max(
          1,
          Math.floor(
            (Date.now() - new Date(item.submittedAt || Date.now()).getTime()) / 60_000
          )
        );

        // 如果有真实数据，使用真实数据
        if (realPlayerData) {
          const attrs = realPlayerData.attributes || {};
          const cash = realPlayerData.cash || 0;
          return {
            id: item.userId || String(item.playerIndex),
            name: realPlayerData.name || `玩家 ${item.playerIndex}`,
            status: submitted ? 'thinking' as const : 'online' as const,
            resources: {
              wealth: {
                value: cash,
                min: cash * 0.9,
                max: cash * 1.1,
                confidence: 0.9, // 真实数据，高置信度
                lastUpdatedMinutesAgo: minutesAgo,
                source: 'public_signal' as const, // 来自游戏状态，视为公开信号
              },
              power: {
                value: attrs['市场份额'] || attrs['power'] || 50,
                min: (attrs['市场份额'] || 50) - 10,
                max: (attrs['市场份额'] || 50) + 10,
                confidence: 0.85,
                lastUpdatedMinutesAgo: minutesAgo,
                source: 'public_signal' as const,
              },
              influence: {
                value: attrs['品牌声誉'] || attrs['influence'] || 50,
                min: (attrs['品牌声誉'] || 50) - 10,
                max: (attrs['品牌声誉'] || 50) + 10,
                confidence: 0.85,
                lastUpdatedMinutesAgo: minutesAgo,
                source: 'public_signal' as const,
              },
            },
          };
        }
        
        // 没有真实数据时，显示低置信度的估算值
        return {
          id: item.userId || String(item.playerIndex),
          name: `玩家 ${item.playerIndex}`,
          status: submitted ? 'thinking' as const : 'online' as const,
          resources: {
            wealth: {
              value: 0,
              min: 0,
              max: 0,
              confidence: 0, // 无数据，零置信度
              lastUpdatedMinutesAgo: minutesAgo,
              source: 'historical_model' as const, // 无数据时使用历史模型标记
            },
            power: {
              value: 0,
              min: 0,
              max: 0,
              confidence: 0,
              lastUpdatedMinutesAgo: minutesAgo,
              source: 'historical_model' as const,
            },
            influence: {
              value: 0,
              min: 0,
              max: 0,
              confidence: 0,
              lastUpdatedMinutesAgo: minutesAgo,
              source: 'historical_model' as const,
            },
          },
        };
      });

    const narrativeText = `
当前处于第 ${session.currentRound} 回合，阶段为 ${session.roundStatus}。
请关注队友决策进度与对手情报波动，在正式界面中完成本回合决策提交。
    `;

    return (
      <div className="min-h-screen bg-[#050507] text-slate-100 px-6 py-6">
        <div className="max-w-6xl mx-auto h-screen max-h-[900px] flex flex-col gap-4">
          <header className="flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] uppercase tracking-[0.35em] text-slate-400">
                高级视图控制台
              </span>
              <h1 className="mt-1 text-lg font-semibold text-slate-100">
                游戏会话 {sessionId?.slice(-8)} - 第{session.currentRound}回合
              </h1>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 text-xs text-slate-400 bg-slate-700/50 px-3 py-1 rounded">
                <span className="font-mono">回合 {session.currentRound}</span>
                <span className="h-1 w-1 rounded-full bg-emerald-500 shadow-[0_0_10px_#10b981]" />
                <span className="capitalize">{session.roundStatus}</span>
              </div>
              <Space>
                <HelpButton size="small" type="default" />
                <Button 
                  size="small" 
                  onClick={() => setAdvancedView(false)}
                  className="bg-slate-700 border-slate-600 text-slate-200 hover:bg-slate-600"
                >
                  返回标准视图
                </Button>
                <Button 
                  size="small" 
                  onClick={() => navigate('/rooms')}
                  className="bg-red-700 border-red-600 text-red-100 hover:bg-red-600"
                >
                  退出房间
                </Button>
              </Space>
            </div>
          </header>

          <main className="flex-1 flex flex-col gap-3">
            <div className="flex-1 grid grid-cols-12 gap-3">
              <div className="col-span-3 flex flex-col gap-2">
                <ResourcePanel
                  playerAttributes={playerAttributes}
                  opponents={[]}
                />
                <OpponentIntel
                  opponents={opponentsIntel}
                  onOpenPrivateChannel={id => {
                    // TODO: 在后续版本中接入右侧 ChatSystem 的私聊频道
                    message.info(`准备对 ${id} 发起私聊（占位逻辑）`);
                  }}
                  onProbeIntel={id => {
                    // TODO: 将来可以接入“情报刺探”动作（例如调用后端 trade/intel 接口）
                    message.info(`准备对 ${id} 发起情报刺探（占位逻辑）`);
                  }}
                />
              </div>

              <div className="col-span-6">
                <NarrativeFeed
                  phase={advancedPhase}
                  fullText={narrativeText}
                  totalSeconds={300}
                  remainingSeconds={remainingSecondsNumeric}
                  onShareSnippet={setAdvancedSharedSnippet}
                />
              </div>

              <div className="col-span-3">
                <ChatSystem lastSharedSnippet={advancedSharedSnippet} />
              </div>
            </div>

            <div className="text-[11px] text-slate-500 text-center mt-1">
              此视图为高级信息控制台，当前版本仅用于辅助阅读与观战。
              <span className="ml-1">请在标准界面中完成正式决策提交与确认。</span>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="game-shell" style={{ height: '100vh', overflow: 'hidden' }}>
      <div className="game-container" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
        {/* 顶部状态栏 */}
        <header className="status-bar" style={{ flexShrink: 0 }}>
          <div className="status-group" style={{ marginLeft: 16 }}>
            <Button
              ghost
              icon={<ArrowLeft size={16} />}
              onClick={() => navigate(-1)}
              style={{ marginRight: 8 }}
              title="返回上一页"
            >
              返回
            </Button>
            <Button
              ghost
              icon={<ArrowRight className="rotate-180" size={16} />}
              onClick={() => navigate('/rooms')}
              title="退出游戏回到房间列表"
            >
              退出
            </Button>
            <div className="status-chip">
              <div className="flex flex-col">
                <span className="text-[11px] text-slate-500 uppercase tracking-wider">当前回合</span>
                <span className="text-lg font-bold text-slate-900">ROUND {session.currentRound}</span>
              </div>
              <Divider type="vertical" className="h-8 border-slate-200" style={{ marginRight: 12 }} />
              <div className="flex flex-col">
                <span className="text-[11px] text-slate-500 uppercase tracking-wider">阶段</span>
                <Tag color="cyan" className="m-0 uppercase">{session.roundStatus}</Tag>
              </div>
              {currentHexagram && (
                <>
                  <Divider type="vertical" className="h-8 border-slate-200" />
                  <div className="flex flex-col">
                    <span className="text-[11px] text-slate-500 uppercase tracking-wider">当前卦象</span>
                    <span className="text-lg font-bold text-slate-900">
                      {typeof currentHexagram === 'string' 
                        ? currentHexagram 
                        : (currentHexagram as any)?.name || (currentHexagram as any)?.hexagram || '未知'}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="status-group">
            <div className="status-chip">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider">剩余时间</span>
              <span className={`text-xl font-mono font-bold ${timerState.isTimeout ? 'text-rose-500' : timerState.isUrgent ? 'text-amber-500' : 'text-emerald-500'}`}>
                {timerState.formattedTime}
              </span>
              {timerState.isUrgent && !timerState.isTimeout && (
                <span className="text-[10px] text-amber-500 animate-pulse">紧急!</span>
              )}
            </div>
            <div className="status-chip">
              <div className={`w-2 h-2 rounded-full ${socketStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981_,_0_0_16px_#10b981]' : 'bg-rose-500'}`} />
              <span className="text-sm font-medium">{socketStatus === 'connected' ? 'LIVE' : 'OFFLINE'}</span>
            </div>
            <Button size="small" onClick={() => setAdvancedView(true)}>
              高级视图
            </Button>
            <HelpButton size="small" type="default" />

            {/* 当回合处于结果阶段时，给玩家一个显式入口查看推演结果 */}
            {session.roundStatus === 'result' && (
              <Button
                type="primary"
                size="small"
                onClick={() =>
                  navigate(`/game/${sessionId}/round/${session.currentRound}/inference`)
                }
              >
                查看本回合结果
              </Button>
            )}
          </div>
        </header>

        <div style={{ flex: 1, overflow: 'auto', padding: '20px 0' }}>
          <Row gutter={[20, 20]} style={{ alignItems: 'stretch' }} className="flex-1">
        {/* 左侧栏 - 玩家状态 */}
          <Col span={6} className="col-stack">
            <GlassCard className="card-panel h-full">
            <div className="card-header-line">
              <div className="card-title-sm flex items-center gap-2">
                <Users size={16} /> 玩家情报
              </div>
            </div>

            <div className="space-y-4">
              <div className="p-3 rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col items-center text-center gap-2 mb-3">
                  <Avatar size={52} src={user?.avatarUrl} />
                  <div className="flex flex-col gap-1 items-center">
                    <div className="font-bold text-base leading-tight text-slate-900">{user?.username}</div>
                    <div className="attr-row justify-center">
                      <Tag color="gold">LV.{user?.level || 1}</Tag>
                      <span className="attr-muted">参与者</span>
                    </div>
                  </div>
                </div>
                {/* 动态资源显示 */}
                {Object.keys(playerAttributes).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(playerAttributes).map(([key, value]) => {
                      const numValue: number = typeof value === 'string' ? parseFloat(value) || 0 : (typeof value === 'number' ? value : 0);
                      const isMoney = key.includes('金钱') || key.includes('money') || key.includes('元');
                      const isPercentage = key.includes('level') || key.includes('Level') || key.includes('等级');
                      const maxValue = isPercentage ? 100 : (isMoney ? Math.max(10000, numValue * 2) : Math.max(100, numValue * 2));
                      const percent = Math.max(0, Math.min(100, (numValue / maxValue) * 100));
                      
                      return (
                        <div key={key} className="flex flex-col gap-1 px-3 py-2 bg-gray-50 rounded-lg border border-slate-200">
                          <div className="flex items-center justify-between">
                            <span className="flex items-center gap-2 text-sm text-slate-700">
                              {isMoney ? (
                                <Coins size={16} className="text-amber-500" />
                              ) : (
                                <Zap size={16} className="text-blue-500" />
                              )}
                              {key}
                            </span>
                            <span className="font-bold text-slate-900">
                              {typeof value === 'string' ? value : numValue.toLocaleString()}
                            </span>
                          </div>
                          {!isMoney && (
                            <Progress percent={percent} size="small" strokeColor={isPercentage ? "#60a5fa" : "#6366f1"} showInfo={false} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-xs text-slate-400 py-4 text-center">
                    等待游戏状态同步...
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <div className="text-xs text-slate-500 uppercase tracking-wider">队友进度</div>
                <List
                  dataSource={decisions}
                  renderItem={(item) => (
                    <div className="flex items-center justify-between p-2 bg-gray-50 rounded border border-slate-200 hover:border-indigo-200 transition-all">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded bg-slate-200 flex items-center justify-center text-xs font-bold border border-slate-300 text-slate-800">
                          P{item.playerIndex}
                        </div>
                        <span className="text-sm">
                          {item.userId === user?.userId ? '我 (本人)' : `玩家 ${item.playerIndex}`}
                        </span>
                      </div>
                      {item.status === 'submitted' ? (
                        <Tag color="success" icon={<Send size={12} className="mr-1" />}>已提交</Tag>
                      ) : (
                        <Tag icon={<Clock size={12} className="mr-1" />}>思考中</Tag>
                      )}
                    </div>
                  )}
                />
              </div>
            </div>
          </GlassCard>

            <GlassCard className="card-panel h-full">
              <div className="card-header-line">
                <div className="card-title-sm flex items-center gap-2">
                  <History size={16} /> 系统控制
                </div>
              </div>
              <div className="flex flex-col gap-2 items-start text-left">
                <Button type="text" icon={<History size={16} />} onClick={() => navigate(`/game/${sessionId}/saves`)}>
                  存档管理
                </Button>
                <Button type="text" icon={<RefreshCw size={16} />} onClick={loadSession}>
                  刷新状态
                </Button>
              </div>
            </GlassCard>

            {/* 现金流趋势图 */}
            {cashHistory.length > 0 && (
              <div className="mt-3">
                <CashFlowChart
                  history={cashHistory}
                  passiveIncome={turnResult?.ledger?.passiveIncome || 0}
                  passiveExpense={turnResult?.ledger?.passiveExpense || 0}
                  currentCash={turnResult?.ledger?.balance || 0}
                />
              </div>
            )}
          </Col>

        {/* 中间栏 - 剧情与推演 */}
          <Col span={12} className="h-full">
            <GlassCard className="card-panel flex flex-col h-full">
              <div className="card-header-line">
                <div className="card-title-sm flex items-center gap-2">
                  <Activity size={16} className="text-indigo-500" /> 故事现场
                </div>
              </div>

              <div className="min-h-[260px] p-5 bg-gray-50 rounded-xl mb-3 border border-gray-200">
                <p className="text-slate-700 leading-relaxed">{displayNarrative}</p>
              </div>

              <div className="flex-1 flex flex-col gap-3">
                <div className="flex justify-between items-center">
                  <span className="info-chip">
                    <MessageSquare size={14} /> 决策输入
                  </span>
                  <span className={`text-xs ${decisionText.length > 400 ? 'text-amber-500 font-medium' : 'text-slate-500'}`}>
                    {decisionText.length} / 500
                    {decisionText.length > 0 && decisionText.length < 10 && (
                      <span className="ml-2 text-slate-400">建议输入更详细的描述</span>
                    )}
                  </span>
                </div>
                {/* 快捷短语标签 */}
                <div className="flex flex-wrap gap-2 mb-2">
                  {['投资研发', '扩大市场', '降低成本', '寻求合作', '观望等待', '防御策略'].map(phrase => (
                    <Tag
                      key={phrase}
                      color="blue"
                      style={{ cursor: 'pointer', userSelect: 'none' }}
                      onClick={() => setDecisionText(prev => prev ? `${prev}，${phrase}` : phrase)}
                    >
                      + {phrase}
                    </Tag>
                  ))}
                </div>
                <TextArea
                  rows={10}
                  value={decisionText}
                  onChange={e => setDecisionText(e.target.value)}
                  placeholder={getPlaceholderText()}
                  maxLength={500}
                  className="decision-input"
                  style={{ flex: 1 }}
                />
                {recommendedOptions.length > 0 && (
                  <div className="recommended-options" style={{ marginTop: 8 }}>
                    <div className="text-xs text-slate-500 mb-2" style={{ fontWeight: 500 }}>
                      AI 推荐选项
                    </div>
                    <Space direction="vertical" style={{ width: '100%' }} size="small">
                      {recommendedOptions.map((option) => (
                        <Button
                          key={option.option_id}
                          block
                          style={{ 
                            textAlign: 'left', 
                            height: 'auto', 
                            padding: '8px 12px',
                            whiteSpace: 'normal',
                            wordBreak: 'break-word'
                          }}
                          onClick={() => setDecisionText(option.text)}
                        >
                          <div style={{ fontWeight: 500, marginBottom: 4 }}>{option.text}</div>
                          <div style={{ fontSize: '12px', color: '#6b7280', opacity: 0.8 }}>
                            {option.expected_effect}
                          </div>
                        </Button>
                      ))}
                    </Space>
                  </div>
                )}
                <div className="decision-actions" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="text-xs text-slate-400">
                    提示：按 Ctrl+Enter 快速提交
                  </span>
                  <Button
                    type="primary"
                    size="middle"
                    className="cta-compact btn-strong glow"
                    loading={submitting}
                    onClick={handleSubmitDecision}
                    disabled={isTimeout || session.roundStatus !== 'decision'}
                  >
                    {session.roundStatus === 'decision' ? '提交本回合决策' : '当前非决策阶段'}
                  </Button>
                </div>
              </div>
            </GlassCard>
          </Col>

        {/* 右侧栏 - 统计与任务 */}
          <Col span={6} className="col-stack">
            <GlassCard className="card-panel h-full">
              {turnResult && turnResult.leaderboard.length > 0 ? (
                <LeaderboardPanel
                  entries={turnResult.leaderboard}
                  currentPlayerId={user?.userId}
                  showDetails={false}
                />
              ) : (
                <>
                  <div className="card-header-line">
                    <div className="card-title-sm flex items-center gap-2">
                      <Trophy size={16} className="text-amber-500" /> 全局排行
                    </div>
                  </div>
                  <div className="text-xs text-slate-400 py-6 text-center">
                    等待本回合推演完成后生成排行榜...
                  </div>
                </>
              )}
            </GlassCard>

            {/* 卦象显示 */}
            {parsedHexagram && (
              <GlassCard className="card-panel h-auto mt-3">
                <div className="card-header-line">
                  <div className="card-title-sm flex items-center gap-2">
                    <Activity size={16} className="text-indigo-500" /> 当前卦象
                  </div>
                </div>
                <HexagramDisplay hexagram={parsedHexagram} compact={false} />
              </GlassCard>
            )}

            {turnResult && (
              <GlassCard className="card-panel h-full mt-3">
                <div className="card-header-line">
                  <div className="card-title-sm flex items-center gap-2">
                    <Target size={16} className="text-rose-500" /> 本回合评估
                  </div>
                </div>
                <AssessmentCards
                  riskCard={turnResult.riskCard}
                  opportunityCard={turnResult.opportunityCard}
                  benefitCard={turnResult.benefitCard}
                  direction="vertical"
                  compact={true}
                />
              </GlassCard>
            )}

            <GlassCard className="card-panel h-full">
              <div className="card-header-line">
                <div className="card-title-sm flex items-center gap-2">
                  <Activity size={16} className="text-indigo-500" /> 实时局势/事件跟踪
                </div>
              </div>
              <div className="space-y-3" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {ongoingEvents.length > 0 ? (
                  ongoingEvents.map((event: any, index: number) => {
                    const eventType = event.type || event.eventType || 'neutral';
                    const isPositive = eventType.includes('positive') || eventType.includes('positive') || eventType.includes('机会');
                    const isNegative = eventType.includes('negative') || eventType.includes('风险') || eventType.includes('threat');
                    const color = isPositive ? 'emerald' : isNegative ? 'rose' : 'slate';
                    
                    return (
                      <div key={index} className={`p-3 bg-gray-50 rounded-lg border border-${color}-200`}>
                        <div className="flex items-center justify-between mb-1">
                          <div className={`text-sm font-bold text-${color}-700`}>
                            {event.title || event.description || event.content || '进行中的事件'}
                          </div>
                          <Tag color={isPositive ? 'success' : isNegative ? 'error' : 'default'}>
                            {isPositive ? '正面' : isNegative ? '负面' : '中性'}
                          </Tag>
                        </div>
                        {event.description && (
                          <p className="text-xs text-slate-600 mt-1 leading-relaxed">{event.description}</p>
                        )}
                        {event.progress !== undefined && (
                          <Progress
                            percent={typeof event.progress === 'number' ? event.progress : 0}
                            size="small"
                            strokeColor={isPositive ? "#10b981" : isNegative ? "#ef4444" : "#6366f1"}
                            trailColor="rgba(0,0,0,0.06)"
                            strokeWidth={8}
                            style={{ marginTop: 8 }}
                          />
                        )}
                      </div>
                    );
                  })
                ) : (
                  <div className="text-xs text-slate-400 py-6 text-center">
                    暂无进行中的事件
                  </div>
                )}
              </div>
            </GlassCard>

            {/* 快速操作面板 */}
            <GlassCard className="card-panel h-auto mt-3">
              <div className="card-header-line">
                <div className="card-title-sm flex items-center gap-2">
                  <Target size={16} className="text-blue-500" /> 快速操作
                </div>
              </div>
              <div className="space-y-2">
                <Button 
                  block 
                  size="small" 
                  icon={<RefreshCw size={14} />}
                  onClick={() => {
                    loadSession();
                    loadDecisions();
                    message.success('状态已刷新');
                  }}
                >
                  刷新状态
                </Button>
                <Button 
                  block 
                  size="small" 
                  icon={<Wallet size={14} />}
                  onClick={() => setTradeDrawerOpen(true)}
                >
                  交易中心
                </Button>
                <Button 
                  block 
                  size="small" 
                  icon={<Save size={14} />}
                  onClick={() => setSaveDrawerOpen(true)}
                >
                  存档管理
                </Button>
                <Button 
                  block 
                  size="small" 
                  icon={<ListTodo size={14} />}
                  onClick={() => setTaskDrawerOpen(true)}
                >
                  任务追踪
                </Button>
                <Button 
                  block 
                  size="small" 
                  icon={<History size={14} />}
                  onClick={() => navigate(`/game/${sessionId}/events`)}
                >
                  查看事件进度
                </Button>
                <Button 
                  block 
                  size="small" 
                  icon={<Trophy size={14} />}
                  onClick={() => navigate(`/game/history`)}
                >
                  游戏历史
                </Button>
              </div>
            </GlassCard>

            <GlassCard className="card-panel h-full">
              <div className="card-header-line">
                <div className="card-title-sm flex items-center gap-2">
                  <Info size={16} /> 大事纪
                </div>
              </div>
              <div className="text-xs text-slate-500 space-y-3" style={{ maxHeight: '200px', overflowY: 'auto' }}>
                <div className="text-center py-4 text-slate-400">
                  暂无大事纪记录
                  <br />
                  <span className="text-xs">重要事件将在此显示</span>
                </div>
              </div>
            </GlassCard>
          </Col>
        </Row>
        </div>

        {/* 成就弹窗管理器 */}
        <AchievementManager
          achievements={pendingAchievements}
          onAllClosed={handleAchievementsClosed}
        />

        {/* 抽屉组件 */}
        <TradeDrawer
          open={tradeDrawerOpen}
          onClose={() => setTradeDrawerOpen(false)}
          sessionId={sessionId || ''}
          currentUserId={user?.userId}
          players={decisions.map(d => ({
            id: d.userId || String(d.playerIndex),
            name: `玩家 ${d.playerIndex}`,
          }))}
        />
        <SaveDrawer
          open={saveDrawerOpen}
          onClose={() => setSaveDrawerOpen(false)}
          sessionId={sessionId || ''}
          currentRound={session?.currentRound || 1}
          isHost={session?.hostId === (user?.userId || user?.id)}
        />
        <TaskDrawer
          open={taskDrawerOpen}
          onClose={() => setTaskDrawerOpen(false)}
          sessionId={sessionId || ''}
        />
      </div>
    </div>
  );
}

export default GameSessionPage;

