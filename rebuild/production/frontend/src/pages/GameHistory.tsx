import { useEffect, useMemo, useState } from 'react';
import {
  Card,
  Table,
  Typography,
  Space,
  Tag,
  Button,
  Modal,
  message,
  Popconfirm,
  Statistic,
  Row,
  Col,
  Select,
  Tabs,
  Badge,
} from 'antd';
import {
  DeleteOutlined,
  EyeOutlined,
  ReloadOutlined,
  ArrowLeftOutlined,
} from '@ant-design/icons';
import { gameAPI } from '../services/game';
import { useNavigate } from 'react-router-dom';
// 使用原生Date格式化，避免dayjs依赖
const formatDate = (dateString: string) => {
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

const { Text } = Typography;

interface HistoryItem {
  id: string;
  sessionId: string;
  roomId: string;
  roomName: string;
  hostName: string;
  currentRound: number;
  totalRounds: number | null;
  status: string;
  roundStatus: string;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

interface HistoryDetail {
  id: string;
  sessionId: string;
  roomId: string;
  roomName: string;
  hostName: string;
  currentRound: number;
  totalRounds: number | null;
  status: string;
  roundStatus: string;
  gameState: Record<string, unknown> | null;
  roundResults: Array<{
    round: number;
    status: string;
    result?: any;
    completedAt?: string;
  }>;
  actions: Array<any>;
  events: Array<any>;
  gameRules: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
}

interface HonorMedal {
  id: string;
  sessionId: string;
  roomName: string;
  hostName: string;
  round: number;
  title: string;
  description: string;
  entityName: string;
  hexagramName?: string;
  hexagramOmen?: string;
  category: 'wealth' | 'strategy' | 'survival' | 'other';
}

function GameHistoryPage() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });
  const [statistics, setStatistics] = useState<any>(null);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [detailData, setDetailData] = useState<HistoryDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'history' | 'honor'>('history');
  const [honors, setHonors] = useState<HonorMedal[]>([]);
  const [honorLoading, setHonorLoading] = useState(false);

  const loadHistory = async (page = 1, status?: string) => {
    try {
      setLoading(true);
      const data = await gameAPI.getGameHistory(page, 10, status);
      setHistory(data.history);
      setPagination(data.pagination);
    } catch (err: any) {
      message.error(err?.response?.data?.message || '获取游戏历史失败');
    } finally {
      setLoading(false);
    }
  };

  const loadStatistics = async () => {
    try {
      const data = await gameAPI.getGameHistoryStatistics();
      setStatistics(data);
    } catch (err: any) {
      console.error('Failed to load statistics:', err);
    }
  };

  const handleViewDetail = async (sessionId: string) => {
    try {
      setDetailLoading(true);
      setDetailModalVisible(true);
      const data = await gameAPI.getGameHistoryDetail(sessionId);
      setDetailData(data);
    } catch (err: any) {
      message.error(err?.response?.data?.message || '获取历史详情失败');
      setDetailModalVisible(false);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDelete = async (sessionId: string) => {
    try {
      await gameAPI.deleteGameHistory(sessionId);
      message.success('删除成功');
      loadHistory(pagination.page, statusFilter);
      loadStatistics();
    } catch (err: any) {
      message.error(err?.response?.data?.message || '删除失败');
    }
  };

  const handleBatchDelete = async () => {
    if (selectedRows.length === 0) {
      message.warning('请选择要删除的记录');
      return;
    }

    try {
      await gameAPI.batchDeleteGameHistory(selectedRows);
      message.success(`已删除 ${selectedRows.length} 条记录`);
      setSelectedRows([]);
      loadHistory(pagination.page, statusFilter);
      loadStatistics();
    } catch (err: any) {
      message.error(err?.response?.data?.message || '批量删除失败');
    }
  };

  useEffect(() => {
    loadHistory(1, statusFilter);
    loadStatistics();
    
    // 添加定时刷新，每15秒刷新一次历史记录
    const refreshInterval = setInterval(() => {
      loadHistory(pagination.page, statusFilter);
      loadStatistics();
    }, 15000);

    return () => {
      clearInterval(refreshInterval);
    };
  }, [statusFilter, pagination.page]);

  const inferMedalCategory = (title: string, description: string): HonorMedal['category'] => {
    const text = `${title}${description}`;
    if (/[资财富利润收益现现金估值]/.test(text)) return 'wealth';
    if (/[策略博弈布局误导情报埋伏]/.test(text)) return 'strategy';
    if (/[生存危机破产起死回生现金流断裂]/.test(text)) return 'survival';
    return 'other';
  };

  const buildHonorWall = useMemo(
    () => async () => {
      // 仅在需要时加载，避免每次进入页面都全量扫描
      if (honorLoading) return;
      try {
        setHonorLoading(true);
        const finishedSessions = history.filter(item => item.status === 'finished');
        const medals: HonorMedal[] = [];

        await Promise.all(
          finishedSessions.map(async (item) => {
            try {
              const detail = await gameAPI.getGameHistoryDetail(item.sessionId);
              (detail.roundResults || []).forEach(roundResult => {
                const result: any = roundResult.result;
                const ui = result?.uiTurnResult;
                if (!ui || !ui.achievements || ui.achievements.length === 0) return;

                ui.achievements.forEach((ach: any, idx: number) => {
                  const entity =
                    ui.perEntityPanel?.find((p: any) => p.id === ach.entityId) || null;
                  const entityName = entity?.name || `主体 ${ach.entityId}`;
                  const category = inferMedalCategory(ach.title || '', ach.description || '');

                  medals.push({
                    id: `${item.sessionId}-${roundResult.round}-${ach.id || idx}`,
                    sessionId: item.sessionId,
                    roomName: item.roomName,
                    hostName: item.hostName,
                    round: roundResult.round,
                    title: ach.title || '未命名成就',
                    description: ach.description || '',
                    entityName,
                    hexagramName: ui.hexagram?.name,
                    hexagramOmen: ui.hexagram?.omen,
                    category,
                  });
                });
              });
            } catch {
              // 单个会话失败不影响整体荣誉墙
            }
          })
        );

        // 按时间与重要程度排序：先回合数，再财富/策略/生存/其他
        const weight = (cat: HonorMedal['category']) =>
          cat === 'wealth' ? 3 : cat === 'strategy' ? 2 : cat === 'survival' ? 1 : 0;

        medals.sort((a, b) => {
          if (b.round !== a.round) return b.round - a.round;
          return weight(b.category) - weight(a.category);
        });

        setHonors(medals);
      } finally {
        setHonorLoading(false);
      }
    },
    [history, honorLoading]
  );

  const handleTabChange = (key: string) => {
    if (key === 'honor') {
      setActiveTab('honor');
      if (honors.length === 0) {
        buildHonorWall();
      }
    } else {
      setActiveTab('history');
    }
  };

  const columns = [
    {
      title: '房间名称',
      dataIndex: 'roomName',
      key: 'roomName',
    },
    {
      title: '主持人',
      dataIndex: 'hostName',
      key: 'hostName',
    },
    {
      title: '回合数',
      key: 'rounds',
      render: (record: HistoryItem) => (
        <Text>
          {record.currentRound}
          {record.totalRounds && ` / ${record.totalRounds}`}
        </Text>
      ),
    },
    {
      title: '状态',
      key: 'status',
      render: (record: HistoryItem) => (
        <Space>
          <Tag color={getStatusColor(record.status)}>
            {getStatusLabel(record.status)}
          </Tag>
          {record.roundStatus && (
            <Tag color={getRoundStatusColor(record.roundStatus)}>
              {getRoundStatusLabel(record.roundStatus)}
            </Tag>
          )}
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (text: string) => formatDate(text),
    },
    {
      title: '结束时间',
      dataIndex: 'finishedAt',
      key: 'finishedAt',
      render: (text: string | null) => (text ? formatDate(text) : '-'),
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: HistoryItem) => (
        <Space>
          <Button
            type="link"
            icon={<EyeOutlined />}
            onClick={() => handleViewDetail(record.sessionId)}
          >
            查看
          </Button>
          <Popconfirm
            title="确定要删除这条历史记录吗？"
            onConfirm={() => handleDelete(record.sessionId)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="link" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  const renderHonorWall = () => {
    return (
      <div style={{ marginTop: 16 }}>
        <Row gutter={[16, 16]}>
          {honors.map((medal) => {
            const borderColor =
              medal.category === 'wealth'
                ? '#fbbf24'
                : medal.category === 'strategy'
                ? '#9ca3af'
                : medal.category === 'survival'
                ? '#92400e'
                : '#6b7280';
            const gradientBg =
              medal.category === 'wealth'
                ? 'linear-gradient(135deg, #0f172a, #020617)'
                : medal.category === 'strategy'
                ? 'linear-gradient(135deg, #020617, #111827)'
                : medal.category === 'survival'
                ? 'linear-gradient(135deg, #111827, #020617)'
                : 'linear-gradient(135deg, #020617, #020617)';

            return (
              <Col key={medal.id} xs={24} sm={12} md={8}>
                <div
                  style={{
                    borderRadius: 16,
                    border: `1px solid ${borderColor}`,
                    padding: 16,
                    background: gradientBg,
                    boxShadow: `0 0 24px rgba(0,0,0,0.45)`,
                    color: '#e5e7eb',
                    position: 'relative',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      inset: 0,
                      opacity: 0.18,
                      backgroundImage:
                        'radial-gradient(circle at 0 0, rgba(248,250,252,0.25), transparent 55%)',
                      pointerEvents: 'none',
                    }}
                  />
                  <div style={{ position: 'relative', zIndex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: 8,
                      }}
                    >
                      <span
                        style={{
                          fontSize: 10,
                          textTransform: 'uppercase',
                          letterSpacing: 2,
                          color: '#9ca3af',
                        }}
                      >
                        Wall of Honor
                      </span>
                      <Badge
                        color={borderColor}
                        text={
                          medal.category === 'wealth'
                            ? '财富勋章'
                            : medal.category === 'strategy'
                            ? '策略勋章'
                            : medal.category === 'survival'
                            ? '生存勋章'
                            : '特别纪念'
                        }
                      />
                    </div>
                    <div style={{ marginBottom: 8 }}>
                      <div
                        style={{
                          fontSize: 16,
                          fontWeight: 700,
                          color: '#f9fafb',
                          lineHeight: 1.3,
                        }}
                      >
                        {medal.title}
                      </div>
                      <div
                        style={{
                          marginTop: 4,
                          fontSize: 11,
                          color: '#9ca3af',
                        }}
                      >
                        {medal.description || '——'}
                      </div>
                    </div>
                    <div
                      style={{
                        marginTop: 8,
                        paddingTop: 6,
                        borderTop: '1px dashed rgba(148,163,184,0.4)',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 4,
                        fontSize: 11,
                        color: '#e5e7eb',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>主体</span>
                        <span style={{ fontWeight: 500 }}>{medal.entityName}</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>时间线</span>
                        <span>
                          {medal.round ? `第 ${medal.round} 回合` : '未知回合'} ·{' '}
                          {medal.roomName}
                        </span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>主持人</span>
                        <span>{medal.hostName}</span>
                      </div>
                      {medal.hexagramName && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span>卦象</span>
                          <span>
                            {medal.hexagramName}
                            {medal.hexagramOmen ? ` · ${medal.hexagramOmen}` : ''}
                          </span>
                        </div>
                      )}
                    </div>
                    <div
                      style={{
                        marginTop: 10,
                        display: 'flex',
                        justifyContent: 'flex-end',
                      }}
                    >
                      <Button
                        type="primary"
                        size="small"
                        onClick={() =>
                          navigate(`/game/${medal.sessionId}/round/${medal.round}/inference`)
                        }
                      >
                        回看该回合推演
                      </Button>
                    </div>
                  </div>
                </div>
              </Col>
            );
          })}
        </Row>
        {honors.length === 0 && !honorLoading && (
          <div style={{ marginTop: 24, textAlign: 'center', color: '#6b7280', fontSize: 12 }}>
            暂无可展示的勋章。完成几局完整对局后，这里会变成你的商业史诗馆。
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <Card>
        <Space direction="vertical" style={{ width: '100%' }} size="large">
          {/* 返回按钮 */}
          <Button 
            type="primary" 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate(-1)} 
            style={{ alignSelf: 'flex-start' }}
          >
            返回
          </Button>
          {/* 统计信息 */}
          {statistics && (
            <Card title="统计信息" size="small">
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic title="总游戏数" value={statistics.totalGames} />
                </Col>
                <Col span={6}>
                  <Statistic title="已完成" value={statistics.finishedGames} />
                </Col>
                <Col span={6}>
                  <Statistic title="进行中" value={statistics.playingGames} />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="平均回合数"
                    value={statistics.averageRounds}
                    precision={2}
                  />
                </Col>
              </Row>
            </Card>
          )}

          <Tabs activeKey={activeTab} onChange={handleTabChange}>
            <Tabs.TabPane tab="历史列表" key="history">
              <Space direction="vertical" style={{ width: '100%' }} size="middle">
                {/* 筛选和操作 */}
                <Space>
                  <Select
                    placeholder="筛选状态"
                    allowClear
                    style={{ width: 150 }}
                    value={statusFilter}
                    onChange={setStatusFilter}
                  >
                    <Select.Option value="finished">已完成</Select.Option>
                    <Select.Option value="playing">进行中</Select.Option>
                    <Select.Option value="paused">已暂停</Select.Option>
                  </Select>
                  <Button
                    icon={<ReloadOutlined />}
                    onClick={() => {
                      loadHistory(pagination.page, statusFilter);
                      loadStatistics();
                    }}
                  >
                    刷新
                  </Button>
                  {selectedRows.length > 0 && (
                    <Popconfirm
                      title={`确定要删除选中的 ${selectedRows.length} 条记录吗？`}
                      onConfirm={handleBatchDelete}
                      okText="确定"
                      cancelText="取消"
                    >
                      <Button danger icon={<DeleteOutlined />}>
                        批量删除 ({selectedRows.length})
                      </Button>
                    </Popconfirm>
                  )}
                </Space>

                {/* 历史记录表格 */}
                <Table
                  columns={columns}
                  dataSource={history}
                  loading={loading}
                  rowKey="id"
                  rowSelection={{
                    selectedRowKeys: selectedRows,
                    onChange: (keys) => setSelectedRows(keys as string[]),
                  }}
                  pagination={{
                    current: pagination.page,
                    pageSize: pagination.limit,
                    total: pagination.total,
                    showTotal: (total) => `共 ${total} 条`,
                    onChange: (page) => loadHistory(page, statusFilter),
                  }}
                />
              </Space>
            </Tabs.TabPane>
            <Tabs.TabPane
              tab={
                <span>
                  荣誉墙
                  {honorLoading && (
                    <span style={{ marginLeft: 6, fontSize: 10, color: '#6b7280' }}>
                      构建中...
                    </span>
                  )}
                </span>
              }
              key="honor"
            >
              {renderHonorWall()}
            </Tabs.TabPane>
          </Tabs>
        </Space>
      </Card>

      {/* 详情弹窗 */}
      <Modal
        title="游戏历史详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        {detailLoading ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <Text>加载中...</Text>
          </div>
        ) : detailData ? (
          <Space direction="vertical" style={{ width: '100%' }} size="middle">
            <div>
              <Text strong>房间名称:</Text> <Text>{detailData.roomName}</Text>
            </div>
            <div>
              <Text strong>主持人:</Text> <Text>{detailData.hostName}</Text>
            </div>
            <div>
              <Text strong>回合数:</Text>{' '}
              <Text>
                {detailData.currentRound}
                {detailData.totalRounds && ` / ${detailData.totalRounds}`}
              </Text>
            </div>
            <div>
              <Text strong>状态:</Text>{' '}
              <Tag color={getStatusColor(detailData.status)}>
                {getStatusLabel(detailData.status)}
              </Tag>
            </div>
            {detailData.gameRules && (
              <div>
                <Text strong>游戏规则:</Text>
                <div style={{ marginTop: 8, padding: 8, background: '#f5f5f5' }}>
                  <Text style={{ whiteSpace: 'pre-wrap' }}>
                    {detailData.gameRules}
                  </Text>
                </div>
              </div>
            )}
            {detailData.roundResults && detailData.roundResults.length > 0 && (
              <div>
                <Text strong>回合结果:</Text>
                <div style={{ marginTop: 8 }}>
                  {detailData.roundResults.map((result, index) => (
                    <Card key={index} size="small" style={{ marginBottom: 8 }}>
                      <Text strong>第 {result.round} 回合</Text>
                      <br />
                      <Text type="secondary">状态: {result.status}</Text>
                      {result.result?.narrative && (
                        <>
                          <br />
                          <Text style={{ whiteSpace: 'pre-wrap', fontSize: '12px' }}>
                            {result.result.narrative.substring(0, 200)}...
                          </Text>
                        </>
                      )}
                    </Card>
                  ))}
                </div>
              </div>
            )}
            <div>
              <Text strong>创建时间:</Text>{' '}
              <Text>{formatDate(detailData.createdAt)}</Text>
            </div>
            {detailData.finishedAt && (
              <div>
                <Text strong>结束时间:</Text>{' '}
                <Text>{formatDate(detailData.finishedAt)}</Text>
              </div>
            )}
          </Space>
        ) : null}
      </Modal>
    </div>
  );
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    finished: '已完成',
    playing: '进行中',
    paused: '已暂停',
  };
  return labels[status] || status;
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    finished: 'green',
    playing: 'blue',
    paused: 'orange',
  };
  return colors[status] || 'default';
}

function getRoundStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    decision: '决策',
    review: '审核',
    inference: '推演',
    result: '结果',
    finished: '结束',
  };
  return labels[status] || status;
}

function getRoundStatusColor(status: string): string {
  const colors: Record<string, string> = {
    decision: 'blue',
    review: 'orange',
    inference: 'purple',
    result: 'green',
    finished: 'default',
  };
  return colors[status] || 'default';
}

export default GameHistoryPage;

