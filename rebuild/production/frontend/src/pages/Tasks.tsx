import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Card,
  List,
  Typography,
  Space,
  Tag,
  Button,
  Modal,
  message,
  Form,
  Input,
  Select,
  Progress,
  Empty,
  Spin,
  Descriptions,
} from 'antd';
import {
  PlusOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import { gameAPI } from '../services/game';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Option } = Select;

interface Task {
  id: string;
  title: string;
  description: string | null;
  taskType: string;
  difficulty: string;
  requirements: Record<string, unknown>;
  rewards: Record<string, unknown> | null;
  status: string;
  progress: Record<string, unknown>;
  userProgress: {
    status: string;
    progress: Record<string, unknown>;
    completedAt: string | null;
  } | null;
  creator: {
    id: string;
    username: string;
    nickname: string | null;
  } | null;
  createdAt: string;
  expiresAt: string | null;
  completedAt: string | null;
}

const Tasks = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);
  const [createModalVisible, setCreateModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [form] = Form.useForm();

  useEffect(() => {
    if (sessionId) {
      loadTasks();
    }
  }, [sessionId]);

  const loadTasks = async () => {
    if (!sessionId) return;
    setLoading(true);
    try {
      const data = await gameAPI.getTasks(sessionId);
      setTasks(data.tasks);
    } catch (error: any) {
      message.error('加载任务列表失败: ' + (error.response?.data?.message || error.message));
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (values: any) => {
    if (!sessionId) return;
    try {
      await gameAPI.createTask(sessionId, values);
      message.success('任务已创建');
      setCreateModalVisible(false);
      form.resetFields();
      loadTasks();
    } catch (error: any) {
      message.error('创建失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const handleViewDetail = async (taskId: string) => {
    if (!sessionId) return;
    try {
      const task = await gameAPI.getTaskDetail(sessionId, taskId);
      setSelectedTask(task as any);
      setDetailModalVisible(true);
    } catch (error: any) {
      message.error('获取任务详情失败: ' + (error.response?.data?.message || error.message));
    }
  };

  const calculateProgress = (task: Task): number => {
    if (!task.userProgress) return 0;
    if (task.userProgress.status === 'completed') return 100;

    const requirements = task.requirements;
    const progress = task.userProgress.progress;

    if (!requirements || typeof requirements !== 'object') return 0;

    let total = 0;
    let completed = 0;

    for (const [key, value] of Object.entries(requirements)) {
      const required = (value as number) || 0;
      const current = (progress[key] as number) || 0;
      total += required;
      completed += Math.min(current, required);
    }

    return total > 0 ? Math.round((completed / total) * 100) : 0;
  };

  const getStatusTag = (task: Task) => {
    if (task.userProgress?.status === 'completed') {
      return <Tag color="success" icon={<CheckCircleOutlined />}>已完成</Tag>;
    }
    if (task.status === 'completed') {
      return <Tag color="default">已结束</Tag>;
    }
    if (task.status === 'expired') {
      return <Tag color="error">已过期</Tag>;
    }
    return <Tag color="processing" icon={<ClockCircleOutlined />}>进行中</Tag>;
  };

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      <Card>
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Title level={3}>任务/挑战</Title>
            <Space>
              <Button icon={<ReloadOutlined />} onClick={loadTasks} loading={loading}>
                刷新
              </Button>
              <Button
                type="primary"
                icon={<PlusOutlined />}
                onClick={() => setCreateModalVisible(true)}
              >
                创建任务
              </Button>
            </Space>
          </div>

          <Spin spinning={loading}>
            {tasks.length === 0 ? (
              <Empty description="暂无任务" />
            ) : (
              <List
                dataSource={tasks}
                renderItem={(task) => {
                  const progressPercent = calculateProgress(task);
                  return (
                    <List.Item
                      actions={[
                        <Button type="link" onClick={() => handleViewDetail(task.id)}>
                          查看详情
                        </Button>,
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <Space>
                            <Text strong>{task.title}</Text>
                            {getStatusTag(task)}
                            <Tag>{task.taskType}</Tag>
                            <Tag color={task.difficulty === 'easy' ? 'green' : task.difficulty === 'hard' ? 'red' : 'blue'}>
                              {task.difficulty}
                            </Tag>
                          </Space>
                        }
                        description={
                          <Space direction="vertical" size="small" style={{ width: '100%' }}>
                            {task.description && <Text type="secondary">{task.description}</Text>}
                            {task.userProgress && (
                              <Progress
                                percent={progressPercent}
                                status={task.userProgress.status === 'completed' ? 'success' : 'active'}
                                size="small"
                              />
                            )}
                            <Text type="secondary" style={{ fontSize: '12px' }}>
                              创建时间: {new Date(task.createdAt).toLocaleString('zh-CN')}
                            </Text>
                          </Space>
                        }
                      />
                    </List.Item>
                  );
                }}
              />
            )}
          </Spin>
        </Space>
      </Card>

      <Modal
        title="创建任务"
        open={createModalVisible}
        onCancel={() => {
          setCreateModalVisible(false);
          form.resetFields();
        }}
        onOk={() => form.submit()}
        okText="创建"
        cancelText="取消"
      >
        <Form form={form} onFinish={handleCreate} layout="vertical">
          <Form.Item name="title" label="任务标题" rules={[{ required: true, message: '请输入任务标题' }]}>
            <Input placeholder="请输入任务标题" />
          </Form.Item>
          <Form.Item name="description" label="任务描述">
            <TextArea rows={3} placeholder="请输入任务描述（可选）" />
          </Form.Item>
          <Form.Item name="taskType" label="任务类型" rules={[{ required: true, message: '请选择任务类型' }]}>
            <Select placeholder="请选择任务类型">
              <Option value="daily">日常任务</Option>
              <Option value="achievement">成就任务</Option>
              <Option value="challenge">挑战任务</Option>
              <Option value="event">事件任务</Option>
            </Select>
          </Form.Item>
          <Form.Item name="difficulty" label="难度" initialValue="normal">
            <Select>
              <Option value="easy">简单</Option>
              <Option value="normal">普通</Option>
              <Option value="hard">困难</Option>
              <Option value="expert">专家</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="任务详情"
        open={detailModalVisible}
        onCancel={() => {
          setDetailModalVisible(false);
          setSelectedTask(null);
        }}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>,
        ]}
        width={600}
      >
        {selectedTask && (
          <Descriptions column={1} bordered>
            <Descriptions.Item label="任务标题">{selectedTask.title}</Descriptions.Item>
            <Descriptions.Item label="任务描述">{selectedTask.description || '无'}</Descriptions.Item>
            <Descriptions.Item label="任务类型">{selectedTask.taskType}</Descriptions.Item>
            <Descriptions.Item label="难度">{selectedTask.difficulty}</Descriptions.Item>
            <Descriptions.Item label="状态">{getStatusTag(selectedTask)}</Descriptions.Item>
            {selectedTask.userProgress && (
              <>
                <Descriptions.Item label="进度">
                  <Progress
                    percent={calculateProgress(selectedTask)}
                    status={selectedTask.userProgress.status === 'completed' ? 'success' : 'active'}
                  />
                </Descriptions.Item>
                <Descriptions.Item label="完成时间">
                  {selectedTask.userProgress.completedAt
                    ? new Date(selectedTask.userProgress.completedAt).toLocaleString('zh-CN')
                    : '未完成'}
                </Descriptions.Item>
              </>
            )}
            <Descriptions.Item label="创建时间">
              {new Date(selectedTask.createdAt).toLocaleString('zh-CN')}
            </Descriptions.Item>
            {selectedTask.expiresAt && (
              <Descriptions.Item label="过期时间">
                {new Date(selectedTask.expiresAt).toLocaleString('zh-CN')}
              </Descriptions.Item>
            )}
          </Descriptions>
        )}
      </Modal>
    </div>
  );
};

export default Tasks;

