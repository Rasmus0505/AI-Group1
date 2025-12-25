import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  List,
  Progress,
  Tag,
  Typography,
  Space,
  Alert,
  Spin,
  message,
  Button,
} from 'antd';
import { ArrowLeft } from 'lucide-react';
import { gameAPI } from '../services/game';
import { wsService } from '../services/websocket';
import { useSocket } from '../hooks/useSocket';
import { useMessageRouter } from '../hooks/useMessageRouter';

const { Title, Text } = Typography;

interface ActiveEvent {
  id: string;
  sessionId: string;
  round: number;
  eventType: string;
  eventContent: string;
  effectiveRounds: number;
  progress: Record<string, unknown>;
  isCompleted: boolean;
  progressPercentage: number;
  createdAt: string;
  updatedAt: string;
  creator: {
    id: string;
    username: string;
    nickname?: string;
  };
}

interface ActiveEventsResponse {
  sessionId: string;
  currentRound: number;
  events: ActiveEvent[];
}

function EventProgressPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const socketStatus = useSocket();
  useMessageRouter();

  const [eventsData, setEventsData] = useState<ActiveEventsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const loadActiveEvents = async () => {
    if (!sessionId) return;
    try {
      setLoading(true);
      const data = await gameAPI.getActiveEvents(sessionId);
      setEventsData(data);
    } catch (err: any) {
      message.error(err?.response?.data?.message || '获取活跃事件失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionId) return;
    wsService.setActiveSession(sessionId);

    const handleEventProgressUpdated = (payload: unknown) => {
      if (
        !payload ||
        typeof payload !== 'object' ||
        !('sessionId' in payload) ||
        (payload as { sessionId?: string }).sessionId !== sessionId
      ) {
        return;
      }
      loadActiveEvents();
    };

    const handleEventCompleted = (payload: unknown) => {
      if (
        !payload ||
        typeof payload !== 'object' ||
        !('sessionId' in payload) ||
        (payload as { sessionId?: string }).sessionId !== sessionId
      ) {
        return;
      }
      message.success('事件已完成');
      loadActiveEvents();
    };

    wsService.on('event_progress_updated', handleEventProgressUpdated);
    wsService.on('event_completed', handleEventCompleted);

    // 初始加载
    loadActiveEvents();

    // 定期刷新
    const refreshInterval = setInterval(loadActiveEvents, 5000);

    return () => {
      wsService.off('event_progress_updated', handleEventProgressUpdated);
      wsService.off('event_completed', handleEventCompleted);
      clearInterval(refreshInterval);
    };
  }, [sessionId]);

  if (loading && !eventsData) {
    return (
      <div style={{ padding: '24px', textAlign: 'center' }}>
        <Spin size="large" />
        <div style={{ marginTop: 16 }}>
          <Text>加载事件进度...</Text>
        </div>
      </div>
    );
  }

  if (!eventsData) {
    return (
      <Card>
        <Alert message="无法加载事件数据" type="error" />
      </Card>
    );
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Button
              ghost
              icon={<ArrowLeft size={16} />}
              onClick={() => navigate(-1)}
              style={{ marginRight: 16 }}
            >
              返回
            </Button>
            <Title level={3}>多回合事件进度</Title>
            <Space>
              <Tag color={socketStatus === 'connected' ? 'green' : 'red'}>
                WebSocket: {socketStatus === 'connected' ? '已连接' : '未连接'}
              </Tag>
              <Tag>会话: {eventsData.sessionId}</Tag>
              <Tag>当前回合: {eventsData.currentRound}</Tag>
            </Space>
          </div>

          {eventsData.events.length === 0 ? (
            <Alert message="当前没有活跃事件" type="info" />
          ) : (
            <List
              dataSource={eventsData.events}
              renderItem={(event: ActiveEvent) => (
                <List.Item>
                  <Card
                    style={{ width: '100%' }}
                    title={
                      <Space>
                        <Text strong>{event.eventContent}</Text>
                        <Tag color={getEventTypeColor(event.eventType)}>
                          {getEventTypeLabel(event.eventType)}
                        </Tag>
                        {event.isCompleted && <Tag color="green">已完成</Tag>}
                      </Space>
                    }
                    extra={
                      <Text type="secondary">
                        创建于第 {event.round} 回合
                      </Text>
                    }
                  >
                    <Space direction="vertical" style={{ width: '100%' }} size="middle">
                      <div>
                        <Text strong>进度:</Text>
                        <Progress
                          percent={event.progressPercentage}
                          status={event.isCompleted ? 'success' : 'active'}
                          style={{ marginTop: 8 }}
                        />
                        {event.progress && typeof event.progress === 'object' && (
                          <Text type="secondary" style={{ display: 'block', marginTop: 4 }}>
                            {(() => {
                              const progress = event.progress as {
                                current?: number;
                                total?: number;
                                lastUpdatedRound?: number;
                              };
                              if (
                                progress.current !== undefined &&
                                progress.total !== undefined
                              ) {
                                return `回合进度: ${progress.current}/${progress.total}`;
                              }
                              return '';
                            })()}
                          </Text>
                        )}
                      </div>

                      <div>
                        <Text strong>有效回合数:</Text>
                        <Text> {event.effectiveRounds} 回合</Text>
                      </div>

                      {event.progress &&
                        typeof event.progress === 'object' &&
                        (event.progress as { lastUpdatedRound?: number }).lastUpdatedRound && (
                          <div>
                            <Text strong>上次更新:</Text>
                            <Text> 第 {(event.progress as { lastUpdatedRound: number }).lastUpdatedRound} 回合</Text>
                          </div>
                        )}

                      <div>
                        <Text strong>创建者:</Text>
                        <Text> {event.creator.nickname || event.creator.username}</Text>
                      </div>

                      <div>
                        <Text type="secondary" style={{ fontSize: '12px' }}>
                          创建时间: {new Date(event.createdAt).toLocaleString()}
                        </Text>
                        {event.updatedAt !== event.createdAt && (
                          <Text type="secondary" style={{ fontSize: '12px', display: 'block' }}>
                            更新时间: {new Date(event.updatedAt).toLocaleString()}
                          </Text>
                        )}
                      </div>
                    </Space>
                  </Card>
                </List.Item>
              )}
            />
          )}
        </Space>
      </Card>
    </div>
  );
}

function getEventTypeLabel(eventType: string): string {
  const labels: Record<string, string> = {
    single_round: '单回合事件',
    multi_round: '多回合事件',
    rule: '临时规则',
  };
  return labels[eventType] || eventType;
}

function getEventTypeColor(eventType: string): string {
  const colors: Record<string, string> = {
    single_round: 'blue',
    multi_round: 'orange',
    rule: 'purple',
  };
  return colors[eventType] || 'default';
}

export default EventProgressPage;

