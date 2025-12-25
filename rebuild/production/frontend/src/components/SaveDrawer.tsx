import { useState, useEffect } from 'react';
import { Drawer, Button, List, Tag, message, Empty, Spin, Input, Popconfirm } from 'antd';
import { SaveOutlined, CloudDownloadOutlined, DeleteOutlined, PlusOutlined } from '@ant-design/icons';
import { gameAPI } from '../services/game';

interface GameSave {
  id: string;
  name: string;
  description?: string;
  round: number;
  createdAt: string;
  createdBy: string;
}

interface SaveDrawerProps {
  open: boolean;
  onClose: () => void;
  sessionId: string;
  currentRound: number;
  isHost: boolean;
}

export function SaveDrawer({ open, onClose, sessionId, currentRound, isHost }: SaveDrawerProps) {
  const [saves, setSaves] = useState<GameSave[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [saveName, setSaveName] = useState('');

  useEffect(() => {
    if (open && sessionId) {
      loadSaves();
    }
  }, [open, sessionId]);

  const loadSaves = async () => {
    setLoading(true);
    try {
      const data = await gameAPI.getGameSaves(sessionId);
      setSaves(data.saves?.map(s => ({
        id: s.id,
        name: s.saveName || '未命名存档',
        description: s.description || undefined,
        round: 0, // API 没有返回 round，需要从其他地方获取
        createdAt: s.createdAt,
        createdBy: s.creator?.username || '未知',
      })) || []);
    } catch {
      // 静默处理
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSave = async () => {
    if (!saveName.trim()) {
      message.warning('请输入存档名称');
      return;
    }
    setCreating(true);
    try {
      await gameAPI.saveGame(sessionId, {
        saveName: saveName.trim(),
        description: `第${currentRound}回合存档`,
      });
      message.success('存档创建成功');
      setSaveName('');
      loadSaves();
    } catch (err: any) {
      message.error(err?.response?.data?.message || '创建存档失败');
    } finally {
      setCreating(false);
    }
  };

  const handleLoadSave = async (saveId: string) => {
    try {
      await gameAPI.restoreGame(sessionId, saveId);
      message.success('存档加载成功，游戏状态已恢复');
      onClose();
    } catch (err: any) {
      message.error(err?.response?.data?.message || '加载存档失败');
    }
  };

  const handleDeleteSave = async (saveId: string) => {
    try {
      await gameAPI.deleteGameSave(sessionId, saveId);
      message.success('存档已删除');
      loadSaves();
    } catch (err: any) {
      message.error(err?.response?.data?.message || '删除存档失败');
    }
  };

  return (
    <Drawer
      title={<><SaveOutlined /> 存档管理</>}
      placement="right"
      width={400}
      open={open}
      onClose={onClose}
    >
      {/* 创建新存档 */}
      {isHost && (
        <div style={{ marginBottom: 24, padding: 16, background: '#fafafa', borderRadius: 8 }}>
          <h4 style={{ marginBottom: 12 }}>创建新存档</h4>
          <Input
            placeholder="存档名称"
            value={saveName}
            onChange={e => setSaveName(e.target.value)}
            style={{ marginBottom: 8 }}
          />
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleCreateSave}
            loading={creating}
            block
          >
            保存当前进度 (第{currentRound}回合)
          </Button>
        </div>
      )}

      {/* 存档列表 */}
      <h4>存档列表</h4>
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}><Spin /></div>
      ) : saves.length === 0 ? (
        <Empty description="暂无存档" />
      ) : (
        <List
          dataSource={saves}
          renderItem={save => (
            <List.Item
              actions={[
                isHost && (
                  <Popconfirm
                    title="确定加载此存档？当前进度将被覆盖"
                    onConfirm={() => handleLoadSave(save.id)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button size="small" icon={<CloudDownloadOutlined />}>加载</Button>
                  </Popconfirm>
                ),
                isHost && (
                  <Popconfirm
                    title="确定删除此存档？"
                    onConfirm={() => handleDeleteSave(save.id)}
                    okText="确定"
                    cancelText="取消"
                  >
                    <Button size="small" danger icon={<DeleteOutlined />} />
                  </Popconfirm>
                ),
              ].filter(Boolean)}
            >
              <List.Item.Meta
                title={<>{save.name} <Tag color="blue">第{save.round}回合</Tag></>}
                description={
                  <>
                    {save.description && <div>{save.description}</div>}
                    <div style={{ fontSize: 12, color: '#999' }}>
                      {new Date(save.createdAt).toLocaleString()}
                    </div>
                  </>
                }
              />
            </List.Item>
          )}
        />
      )}
    </Drawer>
  );
}

export default SaveDrawer;
