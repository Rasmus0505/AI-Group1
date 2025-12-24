import { useEffect, useMemo, useState, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Input, Button, Tag, List, message,
  Row, Col, Avatar, Progress, Divider, Spin, Space
} from 'antd';
import { UserOutlined } from '@ant-design/icons';
import {
  Users, Zap, Coins, Trophy,
  Target, MessageSquare, Send, RefreshCw,
  Clock, History, ArrowRight, Activity, Info, ArrowLeft,
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
  const [displayNarrative] = useState('欢迎来到游戏，正在等待第一回合开始...');
  const [recommendedOptions, setRecommendedOptions] = useState<Array<{
    option_id: string;
    text: string;
    expected_effect: string;
    category: string;
  }>>([]);

  const [turnResult, setTurnResult] = useState<TurnResultDTO | null>(null);
  const [gameState, setGameState] = useState<any>(null); // 完整的游戏状态（包含 players、currentHexagram 等）
  // 新增：成就队列
  const [pendingAchievements, setPendingAchievements] = useState<TurnAchievement[]>([]);

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

  const loadSession = useMemo(
    () => async () => {
      if (!sessionId) return;
      try {
        const data = await gameAPI.getSession(sessionId);
        setSession(data);


        // 如果是主持人，跳转到游戏状态页面
        if (data.hostId && user?.id && data.hostId === user.id) {
          navigate(`/game/${sessionId}/state`, { replace: true });
        }
      } catch (err) {
        message.error('获取会话信息失败');
      }
    },
    [sessionId, user?.id, navigate]
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
      } catch {
        // 推演结果是增量能力，失败时静默忽略
        setTurnResult(null);
        setGameState(null);
      }
    },
    [sessionId]
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

    const loadOptions = async () => {
      try {
        const data = await gameAPI.getDecisionOptions(sessionId, session.currentRound);
        setRecommendedOptions(data.options || []);
      } catch (err) {
        // Silently fail - options are optional
        setRecommendedOptions([]);
      }
    };

    loadOptions();
  }, [sessionId, session?.currentRound, session?.roundStatus]);

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

    wsService.on('decision_status_update', handleDecisionStatusUpdate);
    wsService.on('game_state_update', handleGameStateUpdate);
    wsService.on('achievement_unlocked', handleAchievementUnlocked);

    return () => {
      wsService.setActiveSession(null);
      wsService.off('decision_status_update', handleDecisionStatusUpdate);
      wsService.off('game_state_update', handleGameStateUpdate);
      wsService.off('achievement_unlocked', handleAchievementUnlocked);
    };
  }, [sessionId, loadDecisions, loadTurnResult, navigate, handleAchievementUnlock]);

  const handleSubmitDecision = async () => {
    if (!sessionId || !session) return;

    // 检查是否超时（仅限制玩家提交，主持人提交给AI不受此限制）
    if (isTimeout) {
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



  return (
    <div className="game-shell">
      <div className="game-container">
        {/* 顶部状态栏 */}
        <header className="status-bar">
          <div className="status-group" style={{ marginLeft: 0 }}>
            <div className="status-chip">
              <div className="flex flex-col">
                <span className="text-[11px] text-slate-500 uppercase tracking-wider">当前回合</span>
                <span className="text-lg font-bold text-slate-900">ROUND {session.currentRound}</span>
              </div>
              <Divider type="vertical" className="h-8 border-slate-200" style={{ marginRight: 8 }} />
              <div className="flex flex-row items-center">
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

            <Divider type="vertical" className="h-8 border-slate-200" style={{ margin: '0 16px' }} />

            <div className="flex items-center gap-2">
              <Button
                ghost
                icon={<ArrowLeft size={16} />}
                onClick={() => navigate(-1)}
              >
                返回
              </Button>
              <Button
                ghost
                icon={<ArrowRight className="rotate-180" size={16} />}
                onClick={() => navigate('/rooms')}
              >
                退出
              </Button>
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
            <div className="status-chip" style={{ gap: 6, display: 'flex', alignItems: 'center' }}>
              <div
                style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  backgroundColor: socketStatus === 'connected' ? '#4ade80' : '#ef4444',
                  boxShadow: socketStatus === 'connected' ? '0 0 8px #4ade80' : '0 0 8px #ef4444',
                  flexShrink: 0,
                }}
              />
              <span className="text-sm font-medium">{socketStatus === 'connected' ? 'LIVE' : 'OFFLINE'}</span>
            </div>


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
                {/* 玩家信息卡片 */}
                <div className="p-4 rounded-xl border border-slate-200 bg-gradient-to-br from-white to-slate-50 shadow-sm">
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                    <Avatar
                      size={56}
                      src={user?.avatarUrl}
                      icon={!user?.avatarUrl && <UserOutlined />}
                      style={{
                        border: '2px solid white',
                        boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                        backgroundColor: user?.avatarUrl ? undefined : '#d1d5db'
                      }}
                    />
                    <div style={{ textAlign: 'center', width: '100%' }}>
                      <div style={{ fontWeight: 'bold', fontSize: 18, color: '#0f172a' }}>{user?.username}</div>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 4 }}>
                        <Tag color="gold" className="m-0">LV.{user?.level || 1}</Tag>
                        <span style={{ fontSize: 12, color: '#64748b' }}>参与者</span>
                      </div>
                    </div>
                  </div>

                  {/* 动态资源显示 */}
                  {Object.keys(playerAttributes).length > 0 ? (
                    <div className="space-y-2 pt-3 border-t border-slate-100">
                      {Object.entries(playerAttributes).map(([key, value]) => {
                        const numValue: number = typeof value === 'string' ? parseFloat(value) || 0 : (typeof value === 'number' ? value : 0);
                        const isMoney = key.includes('金钱') || key.includes('money') || key.includes('元');
                        const isPercentage = key.includes('level') || key.includes('Level') || key.includes('等级');
                        const maxValue = isPercentage ? 100 : (isMoney ? Math.max(10000, numValue * 2) : Math.max(100, numValue * 2));
                        const percent = Math.max(0, Math.min(100, (numValue / maxValue) * 100));

                        return (
                          <div key={key} className="flex items-center justify-between py-2 px-3 bg-white rounded-lg border border-slate-100 hover:border-slate-200 transition-colors">
                            <span className="flex items-center gap-2 text-sm text-slate-600">
                              {isMoney ? (
                                <Coins size={16} className="text-amber-500" />
                              ) : (
                                <Zap size={16} className="text-blue-500" />
                              )}
                              {key}
                            </span>
                            <span className="font-semibold text-slate-900">
                              {typeof value === 'string' ? value : numValue.toLocaleString()}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-sm text-slate-400 py-6 text-center border-t border-slate-100 mt-3">
                      等待游戏状态同步...
                    </div>
                  )}
                </div>

                {/* 其他玩家进度 */}
                <div className="space-y-3">
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px', backgroundColor: 'white', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: 14, fontWeight: 500, color: '#334155', whiteSpace: 'nowrap' }}>其他玩家进度：</span>
                    {decisions.find(d => d.userId === user?.userId)?.status === 'submitted' ? (
                      <Tag color="success" icon={<Send size={12} className="mr-1" />}>已提交</Tag>
                    ) : (
                      <Tag color="warning" icon={<Clock size={12} className="mr-1" />}>未提交</Tag>
                    )}
                  </div>
                  <div className="space-y-2">
                    {decisions.length > 0 ? (
                      decisions.map((item) => (
                        <div key={item.playerIndex} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px', backgroundColor: 'white', borderRadius: 8, border: '1px solid #e2e8f0' }}>
                          <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, borderRadius: 4, backgroundColor: '#e2e8f0', fontSize: 12, fontWeight: 'bold', color: '#475569', border: '1px solid #cbd5e1', flexShrink: 0 }}>
                            P{item.playerIndex}
                          </span>
                          <span style={{ fontSize: 14, fontWeight: 500, color: '#334155', whiteSpace: 'nowrap' }}>
                            {item.userId === user?.userId ? '我 (本人)：' : `玩家 ${item.playerIndex}：`}
                          </span>
                          {item.status === 'submitted' ? (
                            <Tag color="success" icon={<Send size={12} className="mr-1" />}>已提交</Tag>
                          ) : (
                            <Tag color="warning" icon={<Clock size={12} className="mr-1" />}>未提交</Tag>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-slate-400 py-4 text-center bg-white rounded-lg border border-slate-200">
                        暂无玩家决策信息
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </GlassCard>

            <GlassCard className="card-panel h-full">
              <div className="card-header-line">
                <div className="card-title-sm flex items-center gap-2">
                  <History size={16} /> 系统控制
                </div>
              </div>
              <div className="flex flex-col gap-2 items-center">
                <Button type="text" icon={<History size={16} />} onClick={() => navigate(`/game/${sessionId}/saves`)}>
                  存档管理
                </Button>
                <Button type="text" icon={<RefreshCw size={16} />} onClick={loadSession}>
                  刷新状态
                </Button>
              </div>
            </GlassCard>
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
                  <span className="text-xs text-slate-500">{decisionText.length} / 500</span>
                </div>
                <TextArea
                  rows={10}
                  value={decisionText}
                  onChange={e => setDecisionText(e.target.value)}
                  placeholder={getPlaceholderText()}
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
                            height: 'auto',
                            padding: '8px 12px',
                          }}
                          onClick={() => setDecisionText(option.text)}
                        >
                          <div style={{ textAlign: 'left', width: '100%' }}>
                            <div style={{ fontWeight: 500, marginBottom: 4 }}>{option.text}</div>
                            <div style={{ fontSize: '12px', color: '#6b7280', opacity: 0.8, whiteSpace: 'normal', wordBreak: 'break-word' }}>
                              {option.expected_effect}
                            </div>
                          </div>
                        </Button>
                      ))}
                    </Space>
                  </div>
                )}
                <div className="decision-actions" style={{ marginTop: 32 }}>
                  <Button
                    type="default"
                    size="middle"
                    className="border-none font-bold text-slate-900 bg-lime-300 hover:bg-lime-200 hover:-translate-y-1 shadow-[0_4px_14px_rgba(163,230,53,0.3)] hover:shadow-[0_6px_20px_rgba(163,230,53,0.5)] transition-all duration-300 rounded-full px-6 min-w-[120px]"
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
              <div className="space-y-3">
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

            <GlassCard className="card-panel h-full">
              <div className="card-header-line">
                <div className="card-title-sm flex items-center gap-2">
                  <Info size={16} /> 大事纪
                </div>
              </div>
              <div className="text-xs text-slate-500 space-y-3">
                <div className="text-center py-4 text-slate-400">
                  暂无大事纪记录
                </div>
              </div>
            </GlassCard>
          </Col>
        </Row>

        {/* 成就弹窗管理器 */}
        <AchievementManager
          achievements={pendingAchievements}
          onAllClosed={handleAchievementsClosed}
        />
      </div>
    </div>
  );
}

export default GameSessionPage;

