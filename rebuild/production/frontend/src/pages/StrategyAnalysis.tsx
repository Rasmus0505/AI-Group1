import { useEffect, useState } from 'react';
import {
  Card,
  Table,
  Typography,
  Space,
  Tag,
  Button,
  Modal,
  message,
  Statistic,
  Row,
  Col,
  Progress,
  Descriptions,
  Empty,
  Spin,
} from 'antd';
import {
  ReloadOutlined,
  EyeOutlined,
  TrophyOutlined,
} from '@ant-design/icons';
import { strategyAPI, Strategy, StrategyAnalysis } from '../services/strategy';

const { Title } = Typography;

const StrategyAnalysisPage = () => {
  const [strategies, setStrategies] = useState<Strategy[]>([]);
  const [loading, setLoading] = useState(false);
  const [analysisModalVisible, setAnalysisModalVisible] = useState(false);
  const [selectedAnalysis, setSelectedAnalysis] = useState<StrategyAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 10,
    total: 0,
    totalPages: 0,
  });

  useEffect(() => {
    loadStrategies();
  }, []);

  const loadStrategies = async (page: number = 1) => {
    setLoading(true);
    try {
      const data = await strategyAPI.getStrategies(page, pagination.limit, 'winRate', 'desc');
      setStrategies(data.strategies);
      setPagination(data.pagination);
    } catch (error: any) {
      message.error('加载策略列表失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleViewAnalysis = async (strategyId: string) => {
    setAnalysisLoading(true);
    setAnalysisModalVisible(true);
    try {
      const analysis = await strategyAPI.getStrategyAnalysis(strategyId);
      setSelectedAnalysis(analysis);
    } catch (error: any) {
      message.error('获取策略分析失败: ' + (error.response?.data?.message || error.message));
      setAnalysisModalVisible(false);
    } finally {
      setAnalysisLoading(false);
    }
  };

  const columns = [
    {
      title: '策略名称',
      dataIndex: 'strategyName',
      key: 'strategyName',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      render: (text: string | null) => text || '-',
    },
    {
      title: '胜率',
      dataIndex: 'winRate',
      key: 'winRate',
      render: (rate: number | null) => (
        <Tag color={rate && rate > 0.6 ? 'success' : rate && rate > 0.4 ? 'warning' : 'default'}>
          {rate ? `${(rate * 100).toFixed(1)}%` : 'N/A'}
        </Tag>
      ),
      sorter: (a: Strategy, b: Strategy) => (a.winRate || 0) - (b.winRate || 0),
    },
    {
      title: '平均得分',
      dataIndex: 'averageScore',
      key: 'averageScore',
      render: (score: number | null) => score?.toFixed(2) || 'N/A',
      sorter: (a: Strategy, b: Strategy) => (a.averageScore || 0) - (b.averageScore || 0),
    },
    {
      title: '总游戏数',
      dataIndex: 'totalGames',
      key: 'totalGames',
      sorter: (a: Strategy, b: Strategy) => a.totalGames - b.totalGames,
    },
    {
      title: '总胜利数',
      dataIndex: 'totalWins',
      key: 'totalWins',
    },
    {
      title: '操作',
      key: 'action',
      render: (_: any, record: Strategy) => (
        <Button
          type="link"
          icon={<EyeOutlined />}
          onClick={() => handleViewAnalysis(record.id)}
        >
          查看分析
        </Button>
      ),
    },
  ];

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto' }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={3}>
              <TrophyOutlined /> 策略分析
            </Title>
            <Button icon={<ReloadOutlined />} onClick={() => loadStrategies(pagination.page)} loading={loading}>
              刷新
            </Button>
          </div>

          <Spin spinning={loading}>
            {strategies.length === 0 ? (
              <Empty description="暂无策略数据" />
            ) : (
              <Table
                columns={columns}
                dataSource={strategies}
                rowKey="id"
                pagination={{
                  current: pagination.page,
                  pageSize: pagination.limit,
                  total: pagination.total,
                  onChange: (page) => loadStrategies(page),
                }}
              />
            )}
          </Spin>
        </Space>
      </Card>

      <Modal
        title="策略分析详情"
        open={analysisModalVisible}
        onCancel={() => {
          setAnalysisModalVisible(false);
          setSelectedAnalysis(null);
        }}
        footer={[
          <Button key="close" onClick={() => setAnalysisModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={800}
      >
        <Spin spinning={analysisLoading}>
          {selectedAnalysis && (
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <Row gutter={16}>
                <Col span={6}>
                  <Statistic
                    title="胜率"
                    value={selectedAnalysis.statistics.winRate * 100}
                    precision={1}
                    suffix="%"
                    valueStyle={{ color: selectedAnalysis.statistics.winRate > 0.6 ? '#3f8600' : '#cf1322' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="平均得分"
                    value={selectedAnalysis.statistics.averageScore}
                    precision={2}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="总游戏数"
                    value={selectedAnalysis.statistics.totalGames}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="总胜利数"
                    value={selectedAnalysis.statistics.totalWins}
                  />
                </Col>
              </Row>

              <Progress
                percent={selectedAnalysis.statistics.winRate * 100}
                status={selectedAnalysis.statistics.winRate > 0.6 ? 'success' : 'active'}
                format={(percent) => `胜率: ${percent?.toFixed(1)}%`}
              />

              <Descriptions title="策略信息" bordered column={1}>
                <Descriptions.Item label="策略名称">{selectedAnalysis.strategyName}</Descriptions.Item>
                <Descriptions.Item label="描述">{selectedAnalysis.description || '无'}</Descriptions.Item>
                <Descriptions.Item label="总失败数">{selectedAnalysis.statistics.totalLosses}</Descriptions.Item>
                <Descriptions.Item label="创建时间">
                  {new Date(selectedAnalysis.createdAt).toLocaleString('zh-CN')}
                </Descriptions.Item>
                <Descriptions.Item label="更新时间">
                  {new Date(selectedAnalysis.updatedAt).toLocaleString('zh-CN')}
                </Descriptions.Item>
              </Descriptions>
            </Space>
          )}
        </Spin>
      </Modal>
    </div>
  );
};

export default StrategyAnalysisPage;

