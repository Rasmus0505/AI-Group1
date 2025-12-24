import { useState, useEffect } from 'react';
import { Drawer, List, Tag, Progress, Empty, Spin, Collapse, Badge } from 'antd';
import { CheckCircleOutlined, ClockCircleOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { Target } from 'lucide-react';
import { gameAPI } from '../services/game';

interface Task {
  id: string;
  title: string;
  description: string;
  type: 'main' | 'side' | 'hidden';
  status: 'active' | 'completed' | 'failed';
  progress: number;
  maxProgress: number;
  reward?: string;
  deadline?: number;
  createdAt: string;
}

interface TaskDrawerProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
}

export function TaskDrawer({ open, onClose, sessionId }: TaskDrawerProps) {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && sessionId) {
      loadTasks();
    }
  }, [open, sessionId]);

  const loadTasks = async () => {
    setLoading(true);
    try {
      const data = await gameAPI.getTasks(sessionId);
      // 映射 API 返回的数据到本地 Task 类型
      const mappedTasks: Task[] = (data.tasks || []).map(t => {
        // 从 progress 对象中提取进度值
        const progressObj = t.progress as Record<string, number> || {};
        const currentProgress = progressObj.current || progressObj.value || 0;
        const maxProgress = progressObj.max || progressObj.target || 100;
        
        return {
          id: t.id,
          title: t.title,
          description: t.description || '',
          type: (t.taskType === 'main' || t.taskType === 'side' || t.taskType === 'hidden' 
            ? t.taskType 
            : 'side') as 'main' | 'side' | 'hidden',
          status: (t.status === 'active' || t.status === 'completed' || t.status === 'failed'
            ? t.status
            : 'active') as 'active' | 'completed' | 'failed',
          progress: currentProgress,
          maxProgress: maxProgress,
          reward: t.rewards ? JSON.stringify(t.rewards) : undefined,
          deadline: t.expiresAt ? new Date(t.expiresAt).getTime() : undefined,
          createdAt: t.createdAt,
        };
      });
      setTasks(mappedTasks);
    } catch {
      // 静默处理
    } finally {
      setLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
      case 'failed':
        return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
      default:
        return <ClockCircleOutlined style={{ color: '#1890ff' }} />;
    }
  };

  const getTypeTag = (type: string) => {
    const config: Record<string, { color: string; text: string }> = {
      main: { color: 'gold', text: '主线' },
      side: { color: 'blue', text: '支线' },
      hidden: { color: 'purple', text: '隐藏' },
    };
    const { color, text } = config[type] || { color: 'default', text: type };
    return <Tag color={color}>{text}</Tag>;
  };

  const activeTasks = tasks.filter(t => t.status === 'active');
  const completedTasks = tasks.filter(t => t.status === 'completed');
  const failedTasks = tasks.filter(t => t.status === 'failed');

  return (
    <Drawer
      title={
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Target size={18} /> 任务追踪
          {activeTasks.length > 0 && <Badge count={activeTasks.length} />}
        </span>
      }
      placement="right"
      width={400}
      open={open}
      onClose={onClose}
    >
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : tasks.length === 0 ? (
        <Empty description="暂无任务" />
      ) : (
        <Collapse defaultActiveKey={['active']} ghost>
          {activeTasks.length > 0 && (
            <Collapse.Panel header={`进行中 (${activeTasks.length})`} key="active">
              <List
                dataSource={activeTasks}
                renderItem={task => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={getStatusIcon(task.status)}
                      title={
                        <span>
                          {task.title} {getTypeTag(task.type)}
                        </span>
                      }
                      description={
                        <>
                          <div style={{ marginBottom: 8 }}>{task.description}</div>
                          <Progress
                            percent={Math.round((task.progress / task.maxProgress) * 100)}
                            size="small"
                            format={() => `${task.progress}/${task.maxProgress}`}
                          />
                          {task.reward && (
                            <div style={{ fontSize: 12, color: '#52c41a', marginTop: 4 }}>
                              奖励: {task.reward}
                            </div>
                          )}
                          {task.deadline && (
                            <div style={{ fontSize: 12, color: '#ff4d4f', marginTop: 4 }}>
                              截止: 第{task.deadline}回合
                            </div>
                          )}
                        </>
                      }
                    />
                  </List.Item>
                )}
              />
            </Collapse.Panel>
          )}

          {completedTasks.length > 0 && (
            <Collapse.Panel header={`已完成 (${completedTasks.length})`} key="completed">
              <List
                dataSource={completedTasks}
                renderItem={task => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={getStatusIcon(task.status)}
                      title={<span style={{ color: '#52c41a' }}>{task.title} {getTypeTag(task.type)}</span>}
                      description={task.description}
                    />
                  </List.Item>
                )}
              />
            </Collapse.Panel>
          )}

          {failedTasks.length > 0 && (
            <Collapse.Panel header={`已失败 (${failedTasks.length})`} key="failed">
              <List
                dataSource={failedTasks}
                renderItem={task => (
                  <List.Item>
                    <List.Item.Meta
                      avatar={getStatusIcon(task.status)}
                      title={<span style={{ color: '#ff4d4f', textDecoration: 'line-through' }}>{task.title}</span>}
                      description={task.description}
                    />
                  </List.Item>
                )}
              />
            </Collapse.Panel>
          )}
        </Collapse>
      )}
    </Drawer>
  );
}

export default TaskDrawer;
