import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Card, Button, List, Input, Space, Tag, message, Modal, Divider, Typography } from 'antd';
import {
  gameAPI,
  ReviewDecisions,
  ReviewDecisionSummary,
} from '../services/game';
import { useAuthStore } from '../stores/authStore';
import { wsService } from '../services/websocket';
import { useSocket } from '../hooks/useSocket';
import { useMessageRouter } from '../hooks/useMessageRouter';

const { TextArea } = Input;
const { Title, Text } = Typography;
function HostReviewPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  useAuthStore(); // 预留，如需权限判断可获取 user
  const socketStatus = useSocket();
  useMessageRouter();

  const [reviewData, setReviewData] = useState<ReviewDecisions | null>(null);
  const [loading, setLoading] = useState(false);
  const [eventModalVisible, setEventModalVisible] = useState(false);
  const [ruleModalVisible, setRuleModalVisible] = useState(false);
  const [submitModalVisible, setSubmitModalVisible] = useState(false);

  // 临时事件表单
  const [eventType, setEventType] = useState<'single_round' | 'multi_round'>('single_round');
  const [eventContent, setEventContent] = useState('');
  const [eventRounds, setEventRounds] = useState(1);

  // 临时规则表单
  const [ruleContent, setRuleContent] = useState('');
  const [ruleRounds, setRuleRounds] = useState(1);

  const renderJson = (value: unknown): string => String(JSON.stringify(value ?? '', null, 2));

  const loadReviewData = async (round?: number) => {
    if (!sessionId) return;

    try {
      setLoading(true);

      // 规范化回合号，避免传入对象导致 [object Object]
      let targetRound = Number(round ?? reviewData?.round);
      if (!Number.isFinite(targetRound) || targetRound <= 0) {
        const session = await gameAPI.getSession(sessionId);
        targetRound = session.currentRound;
      }

      const data = await gameAPI.getReviewDecisions(sessionId, targetRound);
      setReviewData(data);
    } catch (err: any) {
      message.error(err?.response?.data?.message || err?.message || '获取审核数据失败');
      console.error('Failed to load review data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!sessionId) return;
    // 初始加载
    loadReviewData();
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId) return;
    wsService.setActiveSession(sessionId);

    const handleRoundStageChanged = (payload: unknown) => {
      if (
        !payload ||
        typeof payload !== 'object' ||
        !('sessionId' in payload) ||
        (payload as { sessionId?: string }).sessionId !== sessionId
      ) {
        return;
      }
      // 重新加载审核数据
      loadReviewData();
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
      const stageData = payload as { stage?: string; round?: number };
      // 如果阶段变为review，重新加载数据
      if (stageData.stage === 'review') {
        loadReviewData(stageData.round);
      }
    };

    const reload = () => loadReviewData();

    wsService.on('round_stage_changed', handleRoundStageChanged);
    wsService.on('stage_changed', handleStageChanged);
    wsService.on('temporary_event_added', reload);
    wsService.on('temporary_rule_added', reload);
    wsService.on('inference_started', (payload: any) => {
      message.info('AI推演已开始');
      if (sessionId && payload?.round) {
        // 跳转到推演结果页，便于主持人查看进度
        window.setTimeout(() => {
          window.location.href = `/game/${sessionId}/round/${payload.round}/inference`;
        }, 300);
      }
    });
    wsService.on('inference_completed', (payload: any) => {
      if (sessionId && payload?.round) {
        message.success('AI推演完成，正在打开结果页');
        window.setTimeout(() => {
          window.location.href = `/game/${sessionId}/round/${payload.round}/inference`;
        }, 200);
      }
    });

    return () => {
      wsService.off('round_stage_changed', handleRoundStageChanged);
      wsService.off('stage_changed', handleStageChanged);
      wsService.off('temporary_event_added', reload);
      wsService.off('temporary_rule_added', reload);
      wsService.off('inference_started', () => {});
      wsService.off('inference_completed', () => {});
    };
  }, [sessionId]);

  const handleAddEvent = async () => {
    if (!sessionId || !reviewData) return;
    if (!eventContent.trim()) {
      message.error('事件内容不能为空');
      return;
    }

    try {
      setLoading(true);
      await gameAPI.addTemporaryEvent(sessionId, reviewData.round, {
        eventType,
        eventContent: eventContent.trim(),
        effectiveRounds: eventType === 'multi_round' ? eventRounds : undefined,
      });
      message.success('临时事件已添加');
      setEventModalVisible(false);
      setEventContent('');
      setEventRounds(1);
      loadReviewData();
    } catch (err: any) {
      message.error(err?.response?.data?.message || '添加临时事件失败');
    } finally {
      setLoading(false);
    }
  };

  const handleAddRule = async () => {
    if (!sessionId || !reviewData) return;
    if (!ruleContent.trim()) {
      message.error('规则内容不能为空');
      return;
    }

    try {
      setLoading(true);
      await gameAPI.addTemporaryRule(sessionId, reviewData.round, {
        ruleContent: ruleContent.trim(),
        effectiveRounds: ruleRounds,
      });
      message.success('临时规则已添加');
      setRuleModalVisible(false);
      setRuleContent('');
      setRuleRounds(1);
      loadReviewData();
    } catch (err: any) {
      message.error(err?.response?.data?.message || '添加临时规则失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitToAI = async () => {
    if (!sessionId || !reviewData) return;

    try {
      setLoading(true);
      await gameAPI.submitToAI(sessionId, reviewData.round);
      message.success('已提交给AI推演，正在跳转到推演结果/进度页');
      // 跳转到推演结果页，便于实时查看进度
      window.setTimeout(() => {
        window.location.href = `/game/${sessionId}/round/${reviewData.round}/inference`;
      }, 200);
      setSubmitModalVisible(false);
    } catch (err: any) {
      message.error(err?.response?.data?.message || '提交推演失败');
    } finally {
      setLoading(false);
    }
  };

  if (!reviewData) {
    return <Card loading>加载中...</Card>;
  }

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div>
            <Title level={3}>主持人审核</Title>
            <Space>
              <Tag color={socketStatus === 'connected' ? 'green' : 'red'}>
                WebSocket: {socketStatus === 'connected' ? '已连接' : '未连接'}
              </Tag>
              <Tag>回合: {reviewData.round}</Tag>
              <Tag color={reviewData.timedOut ? 'red' : 'green'}>
                {reviewData.timedOut ? '已超时' : '进行中'}
              </Tag>
            </Space>
          </div>

          <Divider />

          <Card title="决策列表" extra={<Button onClick={() => loadReviewData()}>刷新</Button>}>
            <List
              dataSource={reviewData.actions}
              loading={loading}
              renderItem={(action: ReviewDecisionSummary) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space>
                        <Text strong>玩家 {action.playerIndex}</Text>
                        <Text type="secondary">({action.username})</Text>
                        <Tag color={action.status === 'submitted' ? 'blue' : 'green'}>
                          {action.status}
                        </Tag>
                        {action.hostModified && <Tag color="orange">已修改</Tag>}
                      </Space>
                    }
                    description={
                      <div>
                        {action.actionText && (
                          <div>
                            <Text strong>决策内容:</Text>
                            <Text>{action.actionText}</Text>
                          </div>
                        )}
                        {Boolean(action.selectedOptionIds) && (
                          <div>
                            <Text strong>选项ID:</Text>
                            <Text code>{renderJson(action.selectedOptionIds)}</Text>
                          </div>
                        )}
                        {Boolean(action.hostModification) && (
                          <div>
                            <Text strong>主持人修改:</Text>
                            <Text code>{renderJson(action.hostModification)}</Text>
                          </div>
                        )}
                        <div>
                          <Text type="secondary">
                            提交时间: {new Date(action.submittedAt).toLocaleString()}
                          </Text>
                        </div>
                      </div>
                    }
                  />
                </List.Item>
              )}
            />
          </Card>

          <Card title="操作">
            <Space>
              <Button type="primary" onClick={() => setEventModalVisible(true)}>
                添加临时事件
              </Button>
              <Button type="primary" onClick={() => setRuleModalVisible(true)}>
                添加临时规则
              </Button>
              <Button
                type="primary"
                danger
                onClick={() => setSubmitModalVisible(true)}
                disabled={reviewData.actions.length === 0}
              >
                提交给AI推演
              </Button>
            </Space>
          </Card>
        </Space>
      </Card>

      {/* 添加临时事件弹窗 */}
      <Modal
        title="添加临时事件"
        open={eventModalVisible}
        onOk={handleAddEvent}
        onCancel={() => {
          setEventModalVisible(false);
          setEventContent('');
          setEventRounds(1);
        }}
        confirmLoading={loading}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong>事件类型:</Text>
            <Space style={{ marginTop: 8, marginLeft: 24 }}>
              <Button
                type={eventType === 'single_round' ? 'primary' : 'default'}
                onClick={() => setEventType('single_round')}
              >
                单回合事件
              </Button>
              <Button
                type={eventType === 'multi_round' ? 'primary' : 'default'}
                onClick={() => setEventType('multi_round')}
              >
                多回合事件
              </Button>
            </Space>
          </div>
          {eventType === 'multi_round' && (
            <div>
              <Text strong>有效回合数:</Text>
              <Input
                type="number"
                min={1}
                value={eventRounds}
                onChange={e => setEventRounds(Number(e.target.value) || 1)}
                style={{ marginTop: 8 }}
              />
            </div>
          )}
          <div>
            <Text strong>事件内容:</Text>
            <TextArea
              rows={6}
              value={eventContent}
              onChange={e => setEventContent(e.target.value)}
              placeholder="请输入事件内容..."
              style={{ marginTop: 8 }}
            />
          </div>
        </Space>
      </Modal>

      {/* 添加临时规则弹窗 */}
      <Modal
        title="添加临时规则"
        open={ruleModalVisible}
        onOk={handleAddRule}
        onCancel={() => {
          setRuleModalVisible(false);
          setRuleContent('');
          setRuleRounds(1);
        }}
        confirmLoading={loading}
      >
        <Space direction="vertical" style={{ width: '100%' }} size="middle">
          <div>
            <Text strong>有效回合数:</Text>
            <Input
              type="number"
              min={1}
              value={ruleRounds}
              onChange={e => setRuleRounds(Number(e.target.value) || 1)}
              style={{ marginTop: 8 }}
            />
          </div>
          <div>
            <Text strong>规则内容:</Text>
            <TextArea
              rows={6}
              value={ruleContent}
              onChange={e => setRuleContent(e.target.value)}
              placeholder="请输入规则内容..."
              style={{ marginTop: 8 }}
            />
          </div>
        </Space>
      </Modal>

      {/* 提交推演确认弹窗 */}
      <Modal
        title="提交给AI推演"
        open={submitModalVisible}
        onOk={handleSubmitToAI}
        onCancel={() => setSubmitModalVisible(false)}
        confirmLoading={loading}
        okText="确认提交"
        cancelText="取消"
      >
        <Text>确认要将当前回合的所有决策提交给AI进行推演吗？</Text>
        <br />
        <Text type="secondary">
          提交后，系统将收集所有决策、活跃事件和规则，并调用AI API进行推演。
        </Text>
      </Modal>
    </div>
  );
}

export default HostReviewPage;

