import React, { useState, useEffect } from 'react';
import { 
  Modal, 
  Alert, 
  Button, 
  Space, 
  List, 
  Tag, 
  Typography, 
  Divider,
  message,
  Spin,
  Popconfirm
} from 'antd';
import { 
  ExclamationCircleOutlined,
  ReloadOutlined,
  RollbackOutlined,
  FastForwardOutlined,
  SaveOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { gameRecoveryAPI, GameRecoveryState } from '../services/gameRecovery';

const { Title, Paragraph } = Typography;

interface GameRecoveryPanelProps {
  sessionId: string;
  visible: boolean;
  onClose: () => void;
  onRecoveryComplete?: () => void;
}

const RECOVERY_ACTIONS = {
  retry_inference: {
    name: '重试AI推演',
    description: '清除当前推演结果，重新提交给AI',
    icon: <ReloadOutlined />,
    confirmText: '确定要重试AI推演吗？这将清除当前的推演结果。'
  },
  reset_to_decision: {
    name: '重置到决策阶段',
    description: '回到决策阶段，允许玩家重新提交决策',
    icon: <RollbackOutlined />,
    confirmText: '确定要重置到决策阶段吗？玩家需要重新提交决策。'
  },
  skip_round: {
    name: '跳过当前回合',
    description: '跳过当前回合，直接进入下一回合',
    icon: <FastForwardOutlined />,
    confirmText: '确定要跳过当前回合吗？这个操作不可撤销。'
  },
  rollback_round: {
    name: '回滚到上一回合',
    description: '回滚到上一回合的结果状态',
    icon: <RollbackOutlined />,
    confirmText: '确定要回滚到上一回合吗？当前回合的所有数据将丢失。'
  },
  force_next_round: {
    name: '强制进入下一回合',
    description: '创建默认结果并进入下一回合',
    icon: <FastForwardOutlined />,
    confirmText: '确定要强制进入下一回合吗？将使用默认结果。'
  },
  fix_data_inconsistency: {
    name: '修复数据不一致',
    description: '自动修复检测到的数据不一致问题',
    icon: <WarningOutlined />,
    confirmText: '确定要修复数据不一致问题吗？'
  }
};

export const GameRecoveryPanel: React.FC<GameRecoveryPanelProps> = ({
  sessionId,
  visible,
  onClose,
  onRecoveryComplete
}) => {
  const [loading, setLoading] = useState(false);
  const [executing, setExecuting] = useState(false);
  const [recoveryState, setRecoveryState] = useState<GameRecoveryState | null>(null);
  const [canRecover, setCanRecover] = useState(false);

  const loadRecoveryStatus = async () => {
    if (!visible || !sessionId) return;
    
    setLoading(true);
    try {
      const status = await gameRecoveryAPI.checkStatus(sessionId);
      setRecoveryState(status.recoveryState);
      setCanRecover(status.canRecover);
    } catch (error: any) {
      message.error(error.message || '检查游戏状态失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecoveryStatus();
  }, [visible, sessionId]);

  const handleRecoveryAction = async (actionId: string) => {
    if (!sessionId) return;
    
    setExecuting(true);
    try {
      const result = await gameRecoveryAPI.executeRecovery(sessionId, actionId);
      
      if (result.success) {
        message.success(result.message);
        onRecoveryComplete?.();
        onClose();
      } else {
        message.error(result.message);
      }
    } catch (error: any) {
      message.error(error.message || '恢复操作失败');
    } finally {
      setExecuting(false);
    }
  };

  const handleCreateSnapshot = async () => {
    if (!sessionId) return;
    
    try {
      const result = await gameRecoveryAPI.createSnapshot(sessionId);
      message.success(`快照创建成功: ${result.snapshotId}`);
    } catch (error: any) {
      message.error(error.message || '创建快照失败');
    }
  };

  const getRiskColor = (riskLevel: string) => {
    switch (riskLevel) {
      case 'low': return 'green';
      case 'medium': return 'orange';
      case 'high': return 'red';
      default: return 'default';
    }
  };

  return (
    <Modal
      title={
        <Space>
          <ExclamationCircleOutlined style={{ color: '#faad14' }} />
          <span>游戏恢复控制台</span>
        </Space>
      }
      open={visible}
      onCancel={onClose}
      width={800}
      footer={[
        <Button key="refresh" icon={<ReloadOutlined />} onClick={loadRecoveryStatus}>
          刷新状态
        </Button>,
        <Button key="snapshot" icon={<SaveOutlined />} onClick={handleCreateSnapshot}>
          创建快照
        </Button>,
        <Button key="close" onClick={onClose}>
          关闭
        </Button>
      ]}
    >
      <Spin spinning={loading}>
        {!canRecover && (
          <Alert
            message="权限不足"
            description="只有主持人可以执行游戏恢复操作"
            type="warning"
            showIcon
            style={{ marginBottom: 16 }}
          />
        )}

        {!recoveryState ? (
          <Alert
            message="游戏状态正常"
            description="未检测到需要恢复的异常状态"
            type="success"
            showIcon
          />
        ) : (
          <div>
            <Alert
              message="检测到游戏异常"
              description={`当前回合: ${recoveryState.currentRound}, 状态: ${recoveryState.roundStatus}`}
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
            />

            <Title level={4}>检测到的问题</Title>
            <List
              dataSource={recoveryState.recoveryOptions}
              renderItem={(option) => (
                <List.Item>
                  <List.Item.Meta
                    title={
                      <Space>
                        <span>{option.name}</span>
                        <Tag color={getRiskColor(option.riskLevel)}>
                          {option.riskLevel === 'low' ? '低风险' : 
                           option.riskLevel === 'medium' ? '中风险' : '高风险'}
                        </Tag>
                      </Space>
                    }
                    description={option.description}
                  />
                </List.Item>
              )}
            />

            {canRecover && (
              <>
                <Divider />
                <Title level={4}>恢复操作</Title>
                <Paragraph type="secondary">
                  请根据问题类型选择合适的恢复操作。高风险操作可能导致数据丢失，请谨慎选择。
                </Paragraph>

                <Space direction="vertical" style={{ width: '100%' }}>
                  {recoveryState.recoveryOptions.map((option) => {
                    const actions = getRecommendedActions(option.id);
                    return actions.map((actionId) => {
                      const action = RECOVERY_ACTIONS[actionId as keyof typeof RECOVERY_ACTIONS];
                      if (!action) return null;

                      return (
                        <Popconfirm
                          key={actionId}
                          title="确认恢复操作"
                          description={action.confirmText}
                          onConfirm={() => handleRecoveryAction(actionId)}
                          okText="确认"
                          cancelText="取消"
                        >
                          <Button
                            block
                            icon={action.icon}
                            loading={executing}
                            style={{ textAlign: 'left', height: 'auto', padding: '12px 16px' }}
                          >
                            <div>
                              <div style={{ fontWeight: 500 }}>{action.name}</div>
                              <div style={{ fontSize: '12px', color: '#666', marginTop: 4 }}>
                                {action.description}
                              </div>
                            </div>
                          </Button>
                        </Popconfirm>
                      );
                    });
                  })}
                </Space>
              </>
            )}

            {recoveryState.errorInfo && (
              <>
                <Divider />
                <Title level={4}>错误详情</Title>
                <Alert
                  message={`错误类型: ${recoveryState.errorInfo.type}`}
                  description={
                    <div>
                      <div>错误信息: {recoveryState.errorInfo.message}</div>
                      <div>发生时间: {new Date(recoveryState.errorInfo.timestamp).toLocaleString()}</div>
                      <div>重试次数: {recoveryState.errorInfo.attemptCount}</div>
                    </div>
                  }
                  type="error"
                  showIcon
                />
              </>
            )}
          </div>
        )}
      </Spin>
    </Modal>
  );
};

// 根据问题类型推荐恢复操作
function getRecommendedActions(problemId: string): string[] {
  switch (problemId) {
    case 'inference_timeout':
      return ['retry_inference', 'skip_round', 'force_next_round'];
    case 'no_decisions':
      return ['reset_to_decision', 'skip_round'];
    case 'missing_result':
      return ['retry_inference', 'rollback_round'];
    case 'data_inconsistency':
      return ['fix_data_inconsistency'];
    default:
      return ['retry_inference', 'reset_to_decision'];
  }
}

export default GameRecoveryPanel;