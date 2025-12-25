import { useState, useEffect } from 'react';
import { Drawer, Button, List, Tag, message, Empty, Spin, InputNumber, Select, Space } from 'antd';
import { SwapOutlined, SendOutlined, CheckOutlined, CloseOutlined } from '@ant-design/icons';
import { requestTrade, respondToTrade, getTradeList, Trade } from '../services/trade';

interface TradeDrawerProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  currentUserId?: string;
  players: Array<{ id: string; name: string }>;
}

export function TradeDrawer({ open, onClose, sessionId, currentUserId, players }: TradeDrawerProps) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // 新交易表单
  const [targetPlayer, setTargetPlayer] = useState<string>('');
  const [offerType, setOfferType] = useState<string>('金钱');
  const [offerAmount, setOfferAmount] = useState<number>(1000);
  const [requestType, setRequestType] = useState<string>('市场份额');
  const [requestAmount, setRequestAmount] = useState<number>(5);

  const resourceTypes = ['金钱', '市场份额', '品牌声誉', '创新能力', '影响力'];

  useEffect(() => {
    if (open && sessionId) {
      loadTrades();
    }
  }, [open, sessionId]);

  const loadTrades = async () => {
    setLoading(true);
    try {
      const response = await getTradeList(sessionId);
      setTrades(response.data?.trades || []);
    } catch {
      // 静默处理
    } finally {
      setLoading(false);
    }
  };

  const handleCreateTrade = async () => {
    if (!targetPlayer) {
      message.warning('请选择交易对象');
      return;
    }
    setCreating(true);
    try {
      await requestTrade(sessionId, {
        targetId: targetPlayer,
        offer: { [offerType]: offerAmount },
        request: { [requestType]: requestAmount },
      });
      message.success('交易请求已发送');
      loadTrades();
      // 重置表单
      setTargetPlayer('');
      setOfferAmount(1000);
      setRequestAmount(5);
    } catch (err: any) {
      message.error(err?.response?.data?.message || '发送交易请求失败');
    } finally {
      setCreating(false);
    }
  };

  const handleRespondTrade = async (tradeId: string, accept: boolean) => {
    try {
      await respondToTrade(sessionId, tradeId, accept ? 'accept' : 'reject');
      message.success(accept ? '已接受交易' : '已拒绝交易');
      loadTrades();
    } catch (err: any) {
      message.error(err?.response?.data?.message || '操作失败');
    }
  };

  const getStatusTag = (status: string) => {
    const config: Record<string, { color: string; text: string }> = {
      pending: { color: 'processing', text: '待处理' },
      accepted: { color: 'success', text: '已接受' },
      rejected: { color: 'error', text: '已拒绝' },
      expired: { color: 'default', text: '已过期' },
    };
    const { color, text } = config[status] || { color: 'default', text: status };
    return <Tag color={color}>{text}</Tag>;
  };

  const otherPlayers = players.filter(p => p.id !== currentUserId);

  return (
    <Drawer
      title={<><SwapOutlined /> 交易中心</>}
      placement="right"
      width={400}
      open={open}
      onClose={onClose}
    >
      {/* 发起新交易 */}
      <div style={{ marginBottom: 24, padding: 16, background: '#fafafa', borderRadius: 8 }}>
        <h4 style={{ marginBottom: 12 }}>发起新交易</h4>
        <Space direction="vertical" style={{ width: '100%' }} size="small">
          <Select
            placeholder="选择交易对象"
            style={{ width: '100%' }}
            value={targetPlayer || undefined}
            onChange={setTargetPlayer}
            options={otherPlayers.map(p => ({ value: p.id, label: p.name }))}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <Select value={offerType} onChange={setOfferType} style={{ flex: 1 }}>
              {resourceTypes.map(t => <Select.Option key={t} value={t}>{t}</Select.Option>)}
            </Select>
            <InputNumber value={offerAmount} onChange={v => setOfferAmount(v || 0)} min={0} style={{ width: 100 }} />
          </div>
          <div style={{ textAlign: 'center', color: '#999' }}>换取 ↓</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Select value={requestType} onChange={setRequestType} style={{ flex: 1 }}>
              {resourceTypes.map(t => <Select.Option key={t} value={t}>{t}</Select.Option>)}
            </Select>
            <InputNumber value={requestAmount} onChange={v => setRequestAmount(v || 0)} min={0} style={{ width: 100 }} />
          </div>
          <Button type="primary" icon={<SendOutlined />} onClick={handleCreateTrade} loading={creating} block>
            发送交易请求
          </Button>
        </Space>
      </div>

      {/* 交易列表 */}
      <h4>交易记录</h4>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : trades.length === 0 ? (
        <Empty description="暂无交易记录" />
      ) : (
        <List
          dataSource={trades}
          renderItem={trade => {
            const offerStr = Object.entries(trade.resources?.offer || {}).map(([k, v]) => `${v} ${k}`).join(', ');
            const requestStr = Object.entries(trade.resources?.request || {}).map(([k, v]) => `${v} ${k}`).join(', ');
            return (
              <List.Item
                actions={
                  trade.status === 'pending' && trade.target?.id === currentUserId
                    ? [
                        <Button size="small" type="primary" icon={<CheckOutlined />} onClick={() => handleRespondTrade(trade.id, true)}>接受</Button>,
                        <Button size="small" danger icon={<CloseOutlined />} onClick={() => handleRespondTrade(trade.id, false)}>拒绝</Button>,
                      ]
                    : undefined
                }
              >
                <List.Item.Meta
                  title={<>{trade.initiator?.nickname || trade.initiator?.username} → {trade.target?.nickname || trade.target?.username} {getStatusTag(trade.status)}</>}
                  description={`提供 ${offerStr || '无'} 换取 ${requestStr || '无'}`}
                />
              </List.Item>
            );
          }}
        />
      )}
    </Drawer>
  );
}

export default TradeDrawer;
