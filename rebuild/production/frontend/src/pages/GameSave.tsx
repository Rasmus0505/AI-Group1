import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  List,
  Typography,
  Space,
  Tag,
  Button,
  Modal,
  message,
  Popconfirm,
  Input,
  Form,
  Empty,
  Spin,
} from 'antd';
import {
  SaveOutlined,
  DeleteOutlined,
  ReloadOutlined,
  RollbackOutlined,
  HistoryOutlined,
} from '@ant-design/icons';
import { gameAPI } from '../services/game';

const { Title, Text } = Typography;
const { TextArea } = Input;

interface GameSaveItem {
  id: string;
  sessionId: string;
  saveName: string | null;
  description: string | null;
  isAutoSave: boolean;
  createdAt: string;
  creator: {
    id: string;
    username: string;
    nickname: string | null;
  };
}

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

const GameSave = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [saves, setSaves] = useState<GameSaveItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [saveModalVisible, setSaveModalVisible] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    if (sessionId) {
      loadSaves();
    }
  }, [sessionId]);

  const loadSaves = async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const data = await gameAPI.getGameSaves(sessionId);
      setSaves(data.saves);
    } catch (error: any) {
      message.error('加载存档列表失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (values: { saveName?: string; description?: string }) => {
    if (!sessionId) return;
    try {
      await gameAPI.saveGame(sessionId, values);
      message.success('游戏已保存');
      setSaveModalVisible(false);
      form.resetFields();
      loadSaves();
    } catch (error: any) {
      message.error('保存失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleRestore = async (saveId: string, saveName: string | null) => {
    if (!sessionId) return;
    Modal.confirm({
      title: '恢复存档',
      content: `确定要恢复到存档"${saveName || '未命名存档'}"吗？当前游戏进度将被覆盖。`,
      okText: '确定',
      cancelText: '取消',
      onOk: async () => {
        try {
          await gameAPI.restoreGame(sessionId, saveId);
          message.success('游戏已恢复到指定存档点');
          // 刷新页面或导航到游戏状态页面
          navigate(`/game/${sessionId}/state`);
        } catch (error: any) {
          message.error('恢复失败: ' + (error.response?.data?.message || error.message));
        }
      },
    });
  };

  const handleDelete = async (saveId: string) => {
    if (!sessionId) return;
    try {
      await gameAPI.deleteGameSave(sessionId, saveId);
      message.success('存档已删除');
      loadSaves();
    } catch (error: any) {
      message.error('删除失败: ' + (error.response?.data?.message || error.message));
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      padding: '40px 24px',
      background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #312e81 100%)',
      fontFamily: "'Inter', sans-serif"
    }}>
      <style>{`
        .glass-card {
          background: rgba(255, 255, 255, 0.05);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 16px;
          box-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.37);
        }
        .ant-card-head { border-bottom: 1px solid rgba(255, 255, 255, 0.1) !important; color: white !important; }
        .ant-list-item-meta-title { color: #e2e8f0 !important; }
        .ant-list-item-meta-description { color: #94a3b8 !important; }
        .ant-typography { color: #f8fafc !important; }
        .ant-btn-primary { background: #6366f1; border: none; box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4); }
        .ant-btn-primary:hover { background: #4f46e5; }
        .save-item:hover { background: rgba(255, 255, 255, 0.02); transition: 0.3s; }
      `}</style>

      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <Card className="glass-card" bordered={false}>
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Title level={2} style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '12px' }}>
                <HistoryOutlined style={{ color: '#818cf8' }} /> 游戏存档管理
              </Title>
              <Space>
                <Button
                  ghost
                  icon={<ReloadOutlined />}
                  onClick={loadSaves}
                  loading={loading}
                  style={{ color: '#94a3b8', borderColor: '#334155' }}
                >
                  刷新
                </Button>
                <Button
                  type="primary"
                  size="large"
                  icon={<SaveOutlined />}
                  onClick={() => setSaveModalVisible(true)}
                >
                  立刻存档
                </Button>
              </Space>
            </div>

            <Spin spinning={loading}>
              {saves.length === 0 ? (
                <Empty
                  image={Empty.PRESENTED_IMAGE_SIMPLE}
                  description={<Text style={{ color: '#64748b' }}>空间寂静... 尚未发现任何时空存档</Text>}
                />
              ) : (
                <List
                  dataSource={saves}
                  renderItem={(save) => (
                    <List.Item
                      className="save-item"
                      style={{ padding: '20px', borderRadius: '12px' }}
                      actions={[
                        <Button
                          key="restore"
                          type="link"
                          style={{ color: '#818cf8', fontWeight: 600 }}
                          icon={<RollbackOutlined />}
                          onClick={() => handleRestore(save.id, save.saveName)}
                        >
                          恢复此进度
                        </Button>,
                        <Popconfirm
                          key="delete"
                          title="确认抹除？"
                          description="此操作将永久删除该存档，不可撤销。"
                          onConfirm={() => handleDelete(save.id)}
                          okText="确认"
                          cancelText="取消"
                        >
                          <Button type="link" danger icon={<DeleteOutlined />}>
                            删除
                          </Button>
                        </Popconfirm>,
                      ]}
                    >
                      <List.Item.Meta
                        avatar={
                          <div style={{
                            width: '48px',
                            height: '48px',
                            background: save.isAutoSave ? 'rgba(56, 189, 248, 0.1)' : 'rgba(34, 197, 94, 0.1)',
                            borderRadius: '12px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}>
                            {save.isAutoSave ?
                              <ReloadOutlined style={{ color: '#38bdf8', fontSize: '20px' }} /> :
                              <SaveOutlined style={{ color: '#4ade80', fontSize: '20px' }} />
                            }
                          </div>
                        }
                        title={
                          <Space>
                            <Text strong style={{ fontSize: '16px' }}>{save.saveName || '未命名归档'}</Text>
                            {save.isAutoSave ? (
                              <Tag color="processing" bordered={false}>系统自动</Tag>
                            ) : (
                              <Tag color="success" bordered={false}>玩家手动</Tag>
                            )}
                          </Space>
                        }
                        description={
                          <Space direction="vertical" size={0}>
                            {save.description && <Text style={{ color: '#cbd5e1' }}>{save.description}</Text>}
                            <div style={{ marginTop: '8px', display: 'flex', gap: '20px', fontSize: '12px' }}>
                              <span><Text type="secondary">时空记录点:</Text> {formatDate(save.createdAt)}</span>
                              <span><Text type="secondary">记录者:</Text> <span style={{ color: '#818cf8' }}>{save.creator.nickname || save.creator.username}</span></span>
                            </div>
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              )}
            </Spin>
          </Space>
        </Card>
      </div>

      <Modal
        title={<span style={{ color: '#1e293b' }}>保存当前时空进度</span>}
        open={saveModalVisible}
        onCancel={() => {
          setSaveModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okText="确认保存"
        cancelText="取消"
        centered
      >
        <Form form={form} onFinish={handleSave} layout="vertical">
          <Form.Item
            name="saveName"
            label="存档名称"
            rules={[{ max: 100, message: '存档名称不能超过100个字符' }]}
          >
            <Input placeholder="例如：决战前夕 / 第一回合结束" />
          </Form.Item>
          <Form.Item
            name="description"
            label="详细描述"
            rules={[{ max: 500, message: '存档描述不能超过500个字符' }]}
          >
            <TextArea
              rows={4}
              placeholder="记录当前的资源状况或战略重点..."
              showCount
              maxLength={500}
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default GameSave;

