import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Input, Button, Tag, List, message,
  Row, Col, Avatar, Progress, Divider, Spin
} from 'antd';
import {
  Users, Zap, Coins, Trophy,
  Target, MessageSquare, Send, RefreshCw,
  Clock, History, ArrowRight, Activity, Info
} from 'lucide-react';
import { gameAPI, GameSessionSummary, DecisionSummary } from '../services/game';
import { useAuthStore } from '../stores/authStore';
import { wsService } from '../services/websocket';
import { useSocket } from '../hooks/useSocket';
import { useMessageRouter } from '../hooks/useMessageRouter';
import { GlassCard } from '../components/GlassCard';

const { TextArea } = Input;

function formatRemaining(deadline?: string | null): string {
  if (!deadline) return '--:--';
  const end = new Date(deadline).getTime();
  const now = Date.now();
  const diff = end - now;
  if (diff <= 0) return '00:00';
  const seconds = Math.floor(diff / 1000);
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

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

  const isTimeout = useMemo(() => {
    if (!session?.decisionDeadline) return false;
    return currentTime > new Date(session.decisionDeadline).getTime();
  }, [session?.decisionDeadline, currentTime]);

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

  useEffect(() => {
    if (!sessionId) return;
    loadSession();
  }, [sessionId, loadSession]);

  useEffect(() => {
    loadDecisions();
  }, [loadDecisions]);

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

      // 当回合进入结果阶段时，自动跳转到推演结果页
      if (payload.roundStatus === 'result' && sessionId && payload.currentRound) {
        navigate(`/game/${sessionId}/round/${payload.currentRound}/inference`);
      }
    };

    wsService.on('decision_status_update', handleDecisionStatusUpdate);
    wsService.on('game_state_update', handleGameStateUpdate);

    return () => {
      wsService.setActiveSession(null);
      wsService.off('decision_status_update', handleDecisionStatusUpdate);
      wsService.off('game_state_update', handleGameStateUpdate);
    };
  }, [sessionId, loadDecisions]);

  const handleSubmitDecision = async () => {
    if (!sessionId || !session) return;
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
    } catch (err) {
      message.error('提交决策失败');
    } finally {
      setSubmitting(false);
    }
  };

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
          <div className="status-group" style={{ marginLeft: 16 }}>
            <Button
              ghost
              icon={<ArrowRight className="rotate-180" size={16} />}
              onClick={() => navigate('/rooms')}
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
            </div>
          </div>

          <div className="status-group">
            <div className="status-chip">
              <span className="text-[11px] text-slate-500 uppercase tracking-wider">剩余时间</span>
              <span className={`text-xl font-mono font-bold ${isTimeout ? 'text-rose-500' : 'text-emerald-500'}`}>
                {formatRemaining(session.decisionDeadline)}
              </span>
            </div>
            <div className="status-chip">
              <div className={`w-2 h-2 rounded-full ${socketStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_8px_#10b981_,_0_0_16px_#10b981]' : 'bg-rose-500'}`} />
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
              <div className="p-3 rounded-lg border border-slate-200 bg-white shadow-sm">
                <div className="flex flex-col items-center text-center gap-2 mb-3">
                  <Avatar size={52} src={user?.avatarUrl} />
                  <div className="flex flex-col gap-1 items-center">
                    <div className="font-bold text-base leading-tight text-slate-900">{user?.username}</div>
                    <div className="attr-row justify-center">
                      <Tag color="gold">LV.{user?.level || 1}</Tag>
                      <span className="attr-muted">生存者</span>
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg border border-slate-200">
                    <span className="flex items-center gap-2 text-sm text-slate-700">
                      <Coins size={16} className="text-amber-500" /> 金币
                    </span>
                    <span className="font-bold text-slate-900">2,450</span>
                  </div>
                  <div className="flex flex-col gap-1 px-3 py-2 bg-gray-50 rounded-lg border border-slate-200">
                    <span className="flex items-center gap-2 text-sm text-slate-700">
                      <Zap size={16} className="text-blue-500" /> 能量
                    </span>
                    <Progress percent={85} size="small" strokeColor="#60a5fa" showInfo={false} />
                  </div>
                </div>
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
                  placeholder="作为这片废土的幸存者，你接下来打算怎么做？描述你的精确意图..."
                  className="decision-input"
                  style={{ flex: 1 }}
                />
                <div className="decision-actions">
                  <Button
                    type="primary"
                    size="middle"
                    className="cta-compact"
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
              <div className="card-header-line">
                <div className="card-title-sm flex items-center gap-2">
                  <Trophy size={16} className="text-amber-500" /> 全局排行
                </div>
              </div>
              <List
                className="list-tight"
                size="small"
                dataSource={[1, 2, 3]}
                renderItem={(pos) => (
                  <div className="flex items-center gap-3 py-1">
                    <span className={`text-lg font-black ${pos === 1 ? 'text-amber-500' : 'text-slate-400'}`}>0{pos}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${100 - pos * 20}%` }} />
                    </div>
                  </div>
                )}
              />
            </GlassCard>

            <GlassCard className="card-panel h-full">
              <div className="card-header-line">
                <div className="card-title-sm flex items-center gap-2">
                  <Target size={16} className="text-rose-500" /> 当前挑战
                </div>
              </div>
              <div className="space-y-3">
                <div className="p-3 bg-gray-50 rounded-lg border border-slate-200">
                  <div className="text-sm font-bold mb-1 text-slate-900">主线：建立据点</div>
                  <Progress
                    percent={45}
                    size="small"
                    strokeColor="#6366f1"
                    trailColor="rgba(0,0,0,0.06)"
                    strokeWidth={10}
                    style={{ marginTop: 4 }}
                  />
                  <div className="text-[11px] text-slate-500 mt-1 uppercase">奖励：+500 信用额度</div>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg border border-slate-200 opacity-80">
                  <div className="text-sm font-bold mb-1 text-slate-900">支线：寻找水源</div>
                  <Tag color="default">未激活</Tag>
                </div>
                <Button block type="link" size="small" onClick={() => navigate(`/game/${sessionId}/tasks`)}>查看全部任务</Button>
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
      </div>
    </div>
  );
}

export default GameSessionPage;

