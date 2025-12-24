import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Typography,
  Space,
  Tag,
  Timeline,
  Button,
  Progress,
  Alert,
  Spin,
  message,
  Divider,
} from 'antd';
import {
  PlayCircleOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  RightOutlined,
  ArrowLeftOutlined as ArrowLeft,
  ExclamationCircleOutlined,
} from '@ant-design/icons';
import { gameAPI } from '../services/game';
import apiClient from '../services/api';
import { wsService } from '../services/websocket';
import { useSocket } from '../hooks/useSocket';
import { useMessageRouter } from '../hooks/useMessageRouter';
import { useAuthStore } from '../stores/authStore';
import { HelpButton } from '../components/HelpButton';
import { GameRecoveryPanel } from '../components/GameRecoveryPanel';

const { Title, Text, Paragraph } = Typography;

interface GameState {
  sessionId: string;
  roomId: string;
  hostId?: string; // 添加hostId字段
  currentRound: number;
  totalRounds: number | null;
  roundStatus: 'decision' | 'review' | 'inference' | 'result' | 'finished';
  gameStatus: 'playing' | 'paused' | 'finished';
  decisionDeadline: string | null;
  gameState: Record<string, unknown> | null;
  inferenceResult: {
    status: string;
    result?: any;
    completedAt?: string;
  } | null;
  activeEvents: Array<{
    id: string;
    eventType: string;
    eventContent: string;
    effectiveRounds: number;
    progress: Record<string, unknown>;
    round: number;
  }>;
  submittedDecisions: number;
  totalPlayers: number;
  updatedAt: string;
}

interface RoundHistory {
  round: number;
  status: string;
  result?: any;
  completedAt?: string;
}

function GameStatePage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const socketStatus = useSocket();
  const { user } = useAuthStore();
  useMessageRouter();

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [history, setHistory] = useState<RoundHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [isHost, setIsHost] = useState(false);
  const [recoveryPanelVisible, setRecoveryPanelVisible] = useState(false);

  const loadGameState = async () => {
    if (!sessionId) return;
    try {
      setLoading(true);
      const data = await gameAPI.getGameState(sessionId);
      setGameState(data);
      
      // 检查是否是主持人（直接使用返回的hostId）
      if (data.hostId && user?.id) {
        setIsHost(data.hostId === user.id);
      } else {
        setIsHost(false);
      }
    } catch (err: any) {
      const errorMessage = err?.message || err?.response?.data?.message || '获取游戏状态失败';
      message.error(errorMessage);
      console.error('Failed to load game state:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadHistory = async () => {
    if (!sessionId) return;
    try {
      // 使用正确的API获取游戏历史记录
      // apiClient interceptor returns response.data, so response is { code, message, data: {...} }
      const response = await apiClient.get(`/game/${sessionId}/history`) as any;
      if (response && response.code === 200 && response.data && response.data.history) {
        setHistory(response.data.history);
      }
    } catch (err: any) {
      // 历史记录加载失败不影响主功能
      console.error('Failed to load history:', err);
    }
  };

  const handleNextRound = async () => {
    if (!sessionId || !gameState) return;
    try {
      await gameAPI.nextRound(sessionId, gameState.currentRound);
      message.success('已进入下一回合');
      loadGameState();
      loadHistory();
    } catch (err: any) {
      message.error(err?.response?.data?.message || '进入下一回合失败');
    }
  };

  useEffect(() => {
    if (!sessionId) return;
    wsService.setActiveSession(sessionId);

    // 加入房间以接收 WebSocket 广播事件
    // 注意：后端使用 io.to(roomId).emit() 广播事件，所以前端必须加入房间
    if (gameState?.roomId) {
      wsService.trackRoom(gameState.roomId);
      wsService.send('join_room', { roomId: gameState.roomId });
    }

    const handleRoundChanged = (payload: unknown) => {
      if (
        !payload ||
        typeof payload !== 'object' ||
        !('sessionId' in payload) ||
        (payload as { sessionId?: string }).sessionId !== sessionId
      ) {
        return;
      }
      message.info('回合已切换');
      loadGameState();
      loadHistory();
    };

    const handleStageChanged = (payload: unknown) => {
      if (
        !payload ||
        typeof payload !== 'object' ||
        !('sessionId' in payload) ||
        (payload as { sessionId?: string }).sessionId !== sessionId
      ) {
        return;
      }
      const stageData = payload as { stage?: string; previousStage?: string };
      message.info(`阶段切换: ${stageData.previousStage} → ${stageData.stage}`);
      loadGameState();
    };

    const handleGameFinished = (payload: unknown) => {
      if (
        !payload ||
        typeof payload !== 'object' ||
        !('sessionId' in payload) ||
        (payload as { sessionId?: string }).sessionId !== sessionId
      ) {
        return;
      }
      message.success('游戏已结束');
      loadGameState();
    };

    const handleTimeLimitAdjusted = (payload: unknown) => {
      if (
        !payload ||
        typeof payload !== 'object' ||
        !('sessionId' in payload) ||
        (payload as { sessionId?: string }).sessionId !== sessionId
      ) {
        return;
      }
      const adjustData = payload as { additionalMinutes?: number };
      message.info(`主持人已延长时限${adjustData.additionalMinutes || 0}分钟`);
      loadGameState();
    };

    wsService.on('round_changed', handleRoundChanged);
    wsService.on('stage_changed', handleStageChanged);
    wsService.on('game_finished', handleGameFinished);
    wsService.on('time_limit_adjusted', handleTimeLimitAdjusted);

    // 初始加载
    loadGameState();
    loadHistory();

    // 定期刷新
    const refreshInterval = setInterval(() => {
      loadGameState();
    }, 3000); // 从5秒改为3秒，提高刷新频率

    return () => {
      // 离开房间
      if (gameState?.roomId) {
        wsService.untrackRoom(gameState.roomId);
      }
      wsService.off('round_changed', handleRoundChanged);
      wsService.off('stage_changed', handleStageChanged);
      wsService.off('game_finished', handleGameFinished);
      wsService.off('time_limit_adjusted', handleTimeLimitAdjusted);
      clearInterval(refreshInterval);
    };
  }, [sessionId, gameState?.roomId]);

  if (loading && !gameState) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text>加载游戏状态...</Text>
        </div>
      </div>
    );
  }

  if (!gameState) {
    return (
      <Card>
        <Alert message="无法加载游戏状态" type="error" />
      </Card>
    );
  }

  const getStageLabel = (stage: string): string => {
    const labels: Record<string, string> = {
      decision: '决策阶段',
      review: '审核阶段',
      inference: '推演阶段',
      result: '结果阶段',
      finished: '已结束',
    };
    return labels[stage] || stage;
  };

  const getStageColor = (stage: string): string => {
    const colors: Record<string, string> = {
      decision: 'blue',
      review: 'orange',
      inference: 'purple',
      result: 'green',
      finished: 'default',
    };
    return colors[stage] || 'default';
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', minHeight: '100vh' }}>
      <div style={{ marginBottom: '16px' }}>
        <Button
          onClick={() => navigate('/rooms')}
        >
          回到房间列表
        </Button>
      </div>
      <Card style={{ maxHeight: '80vh', overflowY: 'auto' }}>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* 游戏状态概览 */}
          <div>
            <Title level={3}>游戏状态</Title>
            <Space wrap>
              <Tag color={socketStatus === 'connected' ? 'green' : 'red'}>
                WebSocket: {socketStatus === 'connected' ? '已连接' : '未连接'}
              </Tag>
              <Tag>会话: {gameState.sessionId}</Tag>
              <Tag>当前回合: {gameState.currentRound}</Tag>
              {gameState.totalRounds && (
                <Tag>总回合数: {gameState.totalRounds}</Tag>
              )}
              <Tag color={getStageColor(gameState.roundStatus)}>
                {getStageLabel(gameState.roundStatus)}
              </Tag>
              <Tag color={gameState.gameStatus === 'finished' ? 'red' : 'green'}>
                {gameState.gameStatus === 'finished' ? '已结束' : '进行中'}
              </Tag>
            </Space>
          </div>

          {/* 回合进度 */}
          {gameState.totalRounds && (
            <div>
              <Text strong>回合进度:</Text>
              <Progress
                percent={Math.round((gameState.currentRound / gameState.totalRounds) * 100)}
                status={gameState.gameStatus === 'finished' ? 'success' : 'active'}
                style={{ marginTop: 8 }}
              />
            </div>
          )}

          {/* 决策提交状态 */}
          {gameState.roundStatus === 'decision' && (
            <Alert
              message={`决策提交: ${gameState.submittedDecisions}/${gameState.totalPlayers}`}
              type="info"
              showIcon
              description={
                isHost
                  ? '作为主持人，你可以在下方点击"进入审核阶段"按钮开始审核决策'
                  : '等待所有玩家提交决策或倒计时结束'
              }
            />
          )}

          {/* 主持人提示：进入审核阶段 */}
          {isHost && gameState.roundStatus === 'decision' && (
            <Card>
              <Space direction="vertical" style={{ width: '100%' }}>
                <Text strong>主持人操作</Text>
                <Text type="secondary">
                  所有玩家已提交决策或倒计时已结束，你可以进入审核阶段开始审核。
                </Text>
                <Space>
                  <Button
                    type="primary"
                    size="large"
                    onClick={async () => {
                      try {
                        await gameAPI.startReview(sessionId!);
                        message.success('已进入审核阶段');
                        // 刷新状态
                        await loadGameState();
                        navigate(`/game/${sessionId}/review`);
                      } catch (err: any) {
                        message.error(err?.response?.data?.message || '进入审核阶段失败');
                        // 即使失败也刷新状态
                        loadGameState();
                      }
                    }}
                  >
                    进入审核阶段
                  </Button>
                  <Button
                    onClick={async () => {
                      try {
                        const additionalMinutes = 5; // 默认延长5分钟
                        await gameAPI.adjustTimeLimit(sessionId!, additionalMinutes);
                        message.success(`时限已延长${additionalMinutes}分钟`);
                        loadGameState();
                      } catch (err: any) {
                        message.error(err?.response?.data?.message || '调整时限失败');
                      }
                    }}
                  >
                    延长5分钟
                  </Button>
                  <Button
                    onClick={async () => {
                      try {
                        const additionalMinutes = 10; // 延长10分钟
                        await gameAPI.adjustTimeLimit(sessionId!, additionalMinutes);
                        message.success(`时限已延长${additionalMinutes}分钟`);
                        loadGameState();
                      } catch (err: any) {
                        message.error(err?.response?.data?.message || '调整时限失败');
                      }
                    }}
                  >
                    延长10分钟
                  </Button>
                </Space>
              </Space>
            </Card>
          )}

          {/* 推演结果 */}
          {gameState.roundStatus === 'result' && gameState.inferenceResult?.result && (
            <Card title="本轮推演结果" size="small">
              {gameState.inferenceResult.result.narrative && (
                <Paragraph style={{ whiteSpace: 'pre-wrap' }}>
                  {gameState.inferenceResult.result.narrative}
                </Paragraph>
              )}
              <Button
                type="link"
                onClick={() => navigate(`/game/${sessionId}/round/${gameState.currentRound}/inference`)}
              >
                查看详细结果 →
              </Button>
            </Card>
          )}

          {/* 主持人操作 */}
          {isHost && gameState.roundStatus === 'result' && gameState.gameStatus !== 'finished' && (
            <Card>
              <Space>
                <Text strong>主持人操作:</Text>
                <Button
                  type="primary"
                  icon={<RightOutlined />}
                  onClick={handleNextRound}
                >
                  进入下一回合
                </Button>
              </Space>
            </Card>
          )}

          {/* 游戏结束提示 */}
          {gameState.gameStatus === 'finished' && (
            <Alert
              message="游戏已结束"
              description={`游戏在第 ${gameState.currentRound} 回合结束`}
              type="success"
              showIcon
            />
          )}

          <Divider />

          {/* 回合历史 */}
          <div>
            <Title level={4}>回合历史</Title>
            <Timeline
              items={history.map(item => ({
                dot:
                  item.status === 'completed' ? (
                    <CheckCircleOutlined style={{ fontSize: '16px' }} />
                  ) : item.status === 'processing' ? (
                    <ClockCircleOutlined style={{ fontSize: '16px' }} />
                  ) : (
                    <PlayCircleOutlined style={{ fontSize: '16px' }} />
                  ),
                color:
                  item.status === 'completed'
                    ? 'green'
                    : item.status === 'failed'
                    ? 'red'
                    : 'blue',
                children: (
                  <>
                    <Text strong>第 {item.round} 回合</Text>
                    <br />
                    <Text type="secondary">
                      状态: {item.status === 'completed' ? '已完成' : item.status === 'failed' ? '失败' : '未知'}
                    </Text>
                    {item.completedAt && (
                      <>
                        <br />
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          完成时间: {new Date(item.completedAt).toLocaleString()}
                        </Text>
                      </>
                    )}
                  </>
                ),
              }))}
            />
          </div>

          {/* 活跃事件 */}
          {gameState.activeEvents.length > 0 && (
            <div>
              <Title level={4}>活跃事件</Title>
              <Space direction="vertical" style={{ width: '100%' }}>
                {gameState.activeEvents.map(event => (
                  <Card key={event.id} size="small">
                    <Space>
                      <Tag>{event.eventType}</Tag>
                      <Text>{event.eventContent}</Text>
                    </Space>
                  </Card>
                ))}
              </Space>
            </div>
          )}

          {/* 快速导航 */}
          <Divider />
          <Space>
            <HelpButton />
            <Button 
              danger 
              icon={<ExclamationCircleOutlined />}
              onClick={() => setRecoveryPanelVisible(true)}
              disabled={!isHost}
            >
              游戏恢复
            </Button>
            {isHost && gameState.roundStatus === 'decision' && (
              <Button
                type="primary"
                size="large"
                onClick={async () => {
                  try {
                    await gameAPI.startReview(sessionId!);
                    message.success('已进入审核阶段');
                    // 刷新状态
                    await loadGameState();
                    navigate(`/game/${sessionId}/review`);
                  } catch (err: any) {
                    message.error(err?.response?.data?.message || '进入审核阶段失败');
                    // 即使失败也刷新状态
                    loadGameState();
                  }
                }}
              >
                进入审核阶段
              </Button>
            )}
            {isHost && gameState.roundStatus === 'review' && (
              <Button type="primary" onClick={() => navigate(`/game/${sessionId}/review`)}>
                审核页面
              </Button>
            )}
            <Button onClick={() => navigate(`/game/${sessionId}/events`)}>
              事件进度
            </Button>
            {gameState.roundStatus === 'result' && (
              <Button
                onClick={() =>
                  navigate(`/game/${sessionId}/round/${gameState.currentRound}/inference`)
                }
              >
                推演结果
              </Button>
            )}
          </Space>
        </Space>
      </Card>

      {/* 游戏恢复面板 */}
      <GameRecoveryPanel
        sessionId={sessionId || ''}
        visible={recoveryPanelVisible}
        onClose={() => setRecoveryPanelVisible(false)}
        onRecoveryComplete={() => {
          loadGameState();
          loadHistory();
        }}
      />
    </div>
  );
}

export default GameStatePage;

