import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Button,
  Table,
  Tag,
  Modal,
  Form,
  InputNumber,
  Input,
  Space,
  message,
  Typography,
  Divider,
  Alert,
} from 'antd';
import {
  SwapOutlined,
  CheckOutlined,
  CloseOutlined,
  DeleteOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { getTradeList, requestTrade, respondToTrade, cancelTrade, Trade } from '../services/trade';
import { useAuthStore } from '../stores/authStore';
import { useSocket } from '../hooks/useSocket';

const { Title, Text } = Typography;

const TradePage: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [requestModalVisible, setRequestModalVisible] = useState(false);
  const [form] = Form.useForm();
  const { socket, connected } = useSocket();

  useEffect(() => {
    if (!sessionId) return;
    loadTrades();
  }, [sessionId]);

  useEffect(() => {
    if (!sessionId || !wsService.connected) return;

    const handleTradeRequested = (data: any) => {
      message.info(`收到交易请求：${data.initiator.nickname || data.initiator.username} 向您发起交易`);
      loadTrades();
    };

    const handleTradeResponded = (data: any) => {
      message.info(`交易${data.status === 'accepted' ? '已接受' : '已拒绝'}`);
      loadTrades();
    };

    const handleTradeCancelled = () => {
      message.info('交易已取消');
      loadTrades();
    };

    wsService.on('trade_requested', handleTradeRequested);
    wsService.on('trade_responded', handleTradeResponded);
    wsService.on('trade_cancelled', handleTradeCancelled);

    return () => {
      wsService.off('trade_requested', handleTradeRequested);
      wsService.off('trade_responded', handleTradeResponded);
      wsService.off('trade_cancelled', handleTradeCancelled);
    };
  }, [sessionId]);

  const loadTrades = async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const response = await getTradeList(sessionId);
      setTrades(response.data.trades);
    } catch (error: any) {
      message.error(error.response?.data?.message || '加载交易列表失败');
    } finally {
      setLoading(false);
    }
  };

  const handleRequestTrade = async (values: any) => {
    if (!sessionId) return;
    try {
      await requestTrade(sessionId, {
        targetId: values.targetId,
        offer: values.offer || {},
        request: values.request || {},
        expiresInMinutes: values.expiresInMinutes || 5,
      });
      message.success('交易请求已发送');
      setRequestModalVisible(false);
      form.resetFields();
      loadTrades();
    } catch (error: any) {
      message.error(error.response?.data?.message || '发起交易失败');
    }
  };

  const handleRespondTrade = async (tradeId: string, action: 'accept' | 'reject') => {
    if (!sessionId) return;
    try {
      await respondToTrade(sessionId, tradeId, action);
      message.success(action === 'accept' ? '交易已接受' : '交易已拒绝');
      loadTrades();
    } catch (error: any) {
      message.error(error.response?.data?.message || '响应交易失败');
    }
  };

  const handleCancelTrade = async (tradeId: string) => {
    if (!sessionId) return;
    Modal.confirm({
      title: '确认取消',
      content: '确定要取消此交易吗？',
      onOk: async () => {
        try {
          await cancelTrade(sessionId, tradeId);
          message.success('交易已取消');
          loadTrades();
        } catch (error: any) {
          message.error(error.response?.data?.message || '取消交易失败');
        }
      },
    });
  };

  const getStatusTag = (status: string) => {
    const statusMap: Record<string, { color: string; text: string }> = {
      pending: { color: 'processing', text: '待处理' },
      accepted: { color: 'success', text: '已接受' },
      rejected: { color: 'error', text: '已拒绝' },
      expired: { color: 'default', text: '已过期' },
      cancelled: { color: 'default', text: '已取消' },
    };
    const config = statusMap[status] || { color: 'default', text: status };
    return <Tag color={config.color}>{config.text}</Tag>;
  };

  const isExpired = (expiresAt: string) => {
    return new Date(expiresAt) < new Date();
  };

  const columns = [
    {
      title: '发起者',
      dataIndex: 'initiator',
      key: 'initiator',
      render: (initiator: Trade['initiator']) => (
        <Text>{initiator.nickname || initiator.username}</Text>
      ),
    },
    {
      title: '目标',
      dataIndex: 'target',
      key: 'target',
      render: (target: Trade['target']) => (
        <Text>{target.nickname || target.username}</Text>
      ),
    },
    {
      title: '提供的资源',
      dataIndex: ['resources', 'offer'],
      key: 'offer',
      render: (offer: any) => (
        <Text>{JSON.stringify(offer)}</Text>
      ),
    },
    {
      title: '请求的资源',
      dataIndex: ['resources', 'request'],
      key: 'request',
      render: (request: any) => (
        <Text>{JSON.stringify(request)}</Text>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status: string, record: Trade) => (
        <Space>
          {getStatusTag(status)}
          {status === 'pending' && isExpired(record.expiresAt) && (
            <Tag color="warning" icon={<ClockCircleOutlined />}>已过期</Tag>
          )}
        </Space>
      ),
    },
    {
      title: '过期时间',
      dataIndex: 'expiresAt',
      key: 'expiresAt',
      render: (expiresAt: string) => (
        <Text type="secondary">
          {new Date(expiresAt).toLocaleString('zh-CN')}
        </Text>
      ),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Trade) => {
        const isInitiator = record.initiator.id === user?.id;
        const isTarget = record.target.id === user?.id;
        const canRespond = isTarget && record.status === 'pending' && !isExpired(record.expiresAt);
        const canCancel = isInitiator && record.status === 'pending';

        return (
          <Space>
            {canRespond && (
              <>
                <Button
                  type="primary"
                  size="small"
                  icon={<CheckOutlined />}
                  onClick={() => handleRespondTrade(record.id, 'accept')}
                >
                  接受
                </Button>
                <Button
                  danger
                  size="small"
                  icon={<CloseOutlined />}
                  onClick={() => handleRespondTrade(record.id, 'reject')}
                >
                  拒绝
                </Button>
              </>
            )}
            {canCancel && (
              <Button
                danger
                size="small"
                icon={<DeleteOutlined />}
                onClick={() => handleCancelTrade(record.id)}
              >
                取消
              </Button>
            )}
          </Space>
        );
      },
    },
  ];

  return (
    <div style={{ padding: '24px' }}>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={2}>
              <SwapOutlined /> 资源交易
            </Title>
            <Button
              type="primary"
              className="btn-strong glow"
              icon={<SwapOutlined />}
              onClick={() => setRequestModalVisible(true)}
            >
              发起交易
            </Button>
          </div>

          <Divider />

          <Table
            columns={columns}
            dataSource={trades}
            loading={loading}
            rowKey="id"
            pagination={{ pageSize: 10 }}
          />
        </Space>
      </Card>

      <Modal
        title="发起交易请求"
        open={requestModalVisible}
        onCancel={() => {
          setRequestModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        width={600}
      >
        <Form form={form} onFinish={handleRequestTrade} layout="vertical">
          <Form.Item
            label="目标用户ID"
            name="targetId"
            rules={[{ required: true, message: '请输入目标用户ID' }]}
          >
            <Input placeholder="请输入目标用户的ID" />
          </Form.Item>

          <Form.Item label="提供的资源（JSON格式）" name="offer">
            <Input.TextArea
              rows={4}
              placeholder='{"gold": 100, "wood": 50}'
            />
          </Form.Item>

          <Form.Item label="请求的资源（JSON格式）" name="request">
            <Input.TextArea
              rows={4}
              placeholder='{"food": 200, "stone": 30}'
            />
          </Form.Item>

          <Form.Item
            label="过期时间（分钟）"
            name="expiresInMinutes"
            initialValue={5}
          >
            <InputNumber min={1} max={60} style={{ width: '100%' }} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TradePage;

