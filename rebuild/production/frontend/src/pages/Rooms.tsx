import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Form, Input, InputNumber, Tag, message, Empty } from 'antd';
import { ArrowLeftOutlined, TeamOutlined, EyeOutlined } from '@ant-design/icons';
import { roomAPI, RoomSummary } from '../services/rooms';
import { wsService } from '../services/websocket';
import { useAuthStore } from '../stores/authStore';
import RoomCard from '../components/RoomCard';
import { useSocket } from '../hooks/useSocket';
import { useMessageRouter } from '../hooks/useMessageRouter';
import { gameAPI } from '../services/game';
import { HelpButton } from '../components/HelpButton';
import UserRegistryPanel from '../components/UserRegistryPanel';
import OnlineRoomsPanel from '../components/OnlineRoomsPanel';

function Rooms() {
  const { token, user } = useAuthStore();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [actionRoomId, setActionRoomId] = useState<string | null>(null);
  const [userPanelOpen, setUserPanelOpen] = useState(false);
  const [roomsPanelOpen, setRoomsPanelOpen] = useState(false);
  const [form] = Form.useForm();
  const socketStatus = useSocket();
  useMessageRouter();

  const getErrMsg = (error: unknown, fallback: string) => {
    if (typeof error === 'object' && error && 'response' in error) {
      const resp = (error as { response?: { data?: { message?: string } } }).response;
      if (resp?.data?.message) return resp.data.message;
    }
    if (error instanceof Error) return error.message;
    return fallback;
  };

  const loadRooms = useMemo(
    () => async () => {
      setLoading(true);
      try {
        const result = await roomAPI.list({ limit: 50 });
        setRooms(result.rooms);
      } catch (err) {
        message.error(getErrMsg(err, '获取房间列表失败'));
      } finally {
        setLoading(false);
      }
    },
    []
  );

  useEffect(() => {
    loadRooms();
    // 添加定时刷新，每10秒刷新一次房间列表
    const refreshInterval = setInterval(() => {
      loadRooms();
    }, 10000);

    return () => {
      clearInterval(refreshInterval);
    };
  }, [loadRooms]);

  useEffect(() => {
    if (!token) return;

    const refresh = () => loadRooms();

    const handleSystemMessage = (payload: unknown) => {
      refresh();
      if (
        payload &&
        typeof payload === 'object' &&
        'message' in payload &&
        (payload as { message?: string }).message
      ) {
        message.info((payload as { message?: string }).message as string);
      }
    };

    const handleError = (payload: unknown) => {
      if (
        payload &&
        typeof payload === 'object' &&
        'message' in payload &&
        (payload as { message?: string }).message
      ) {
        message.error((payload as { message?: string }).message as string);
      }
    };

    // 问题4修复：监听房间人数变化事件，实时更新
    const handlePlayerJoined = (payload: unknown) => {
      if (payload && typeof payload === 'object' && 'roomId' in payload) {
        const roomId = (payload as { roomId: string }).roomId;
        // 更新对应房间的人数
        setRooms(prevRooms =>
          prevRooms.map(room =>
            room.id === roomId
              ? { ...room, currentPlayers: Math.min(room.currentPlayers + 1, room.maxPlayers) }
              : room
          )
        );
      }
      refresh(); // 也刷新完整列表以确保数据同步
    };

    const handlePlayerLeft = (payload: unknown) => {
      if (payload && typeof payload === 'object' && 'roomId' in payload) {
        const roomId = (payload as { roomId: string }).roomId;
        // 更新对应房间的人数
        setRooms(prevRooms =>
          prevRooms.map(room =>
            room.id === roomId
              ? { ...room, currentPlayers: Math.max(room.currentPlayers - 1, 0) }
              : room
          )
        );
      }
      refresh(); // 也刷新完整列表以确保数据同步
    };

    wsService.on('player_joined', handlePlayerJoined);
    wsService.on('player_left', handlePlayerLeft);
    wsService.on('system_message', handleSystemMessage);
    wsService.on('error', handleError);

    return () => {
      wsService.off('player_joined', handlePlayerJoined);
      wsService.off('player_left', handlePlayerLeft);
      wsService.off('system_message', handleSystemMessage);
      wsService.off('error', handleError);
    };
  }, [token, loadRooms]);

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setCreateLoading(true);
      await roomAPI.create({
        name: values.name,
        maxPlayers: values.maxPlayers,
        password: values.password,
      });
      message.success('房间创建成功');
      form.resetFields();
      loadRooms();
    } catch (err) {
      if (typeof err === 'object' && err && 'errorFields' in err) return;
      message.error(getErrMsg(err, '创建房间失败'));
    } finally {
      setCreateLoading(false);
    }
  };

  const handleJoin = async (roomId: string) => {
    setActionRoomId(roomId);
    try {
      await roomAPI.join(roomId);
      message.success('加入房间成功');
      wsService.trackRoom(roomId);
      loadRooms();
      navigate(`/rooms/${roomId}/wait`);
    } catch (err) {
      message.error(getErrMsg(err, '加入房间失败'));
    } finally {
      setActionRoomId(null);
    }
  };

  const handleLeave = async (roomId: string) => {
    setActionRoomId(roomId);
    try {
      await roomAPI.leave(roomId);
      message.success('已离开房间');
      wsService.untrackRoom(roomId);
      loadRooms();
    } catch (err) {
      message.error(getErrMsg(err, '离开房间失败'));
    } finally {
      setActionRoomId(null);
    }
  };

  const handleClose = async (roomId: string) => {
    setActionRoomId(roomId);
    try {
      await roomAPI.close(roomId);
      message.success('房间已关闭');
      loadRooms();
    } catch (err) {
      message.error(getErrMsg(err, '关闭房间失败'));
    } finally {
      setActionRoomId(null);
    }
  };

  const handleKillGame = async (roomId: string) => {
    setActionRoomId(roomId);
    try {
      await roomAPI.killGame(roomId);
      message.success('游戏已终止');
      wsService.untrackRoom(roomId);
      loadRooms();
    } catch (err) {
      message.error(getErrMsg(err, '终止游戏失败'));
    } finally {
      setActionRoomId(null);
    }
  };

  const handleResume = async (roomId: string) => {
    console.log('尝试继续游戏，房间ID:', roomId);
    setActionRoomId(roomId);
    try {
      console.log('调用 getActiveSessionByRoom API...');
      
      // 显示加载提示
      const hideLoading = message.loading('正在定位游戏会话...', 0);
      
      const session = await gameAPI.getActiveSessionByRoom(roomId);
      console.log('获取到游戏会话:', session);
      
      hideLoading();
      message.success('已定位到进行中的对局，正在进入战场');
      navigate(`/game/${session.sessionId}`);
    } catch (err) {
      console.error('继续游戏失败:', err);
      
      // 提供更详细的错误信息
      let errorMessage = '无法继续游戏';
      
      if (err && typeof err === 'object' && 'response' in err) {
        const response = (err as any).response;
        if (response?.status === 404) {
          errorMessage = '当前房间没有进行中的对局，可能游戏已结束或尚未开始';
        } else if (response?.status === 403) {
          errorMessage = '您没有权限访问此游戏会话';
        } else if (response?.data?.message) {
          errorMessage = response.data.message;
        }
      } else if (err instanceof Error) {
        errorMessage = err.message;
      }
      
      message.error(errorMessage);
      
      // 建议用户刷新房间列表
      message.info('建议刷新房间列表获取最新状态', 3);
      
      // 自动刷新房间列表
      setTimeout(() => {
        loadRooms();
      }, 1000);
    } finally {
      setActionRoomId(null);
    }
  };

  return (
    <div className="rooms-shell">
      <div className="grid-lines" />
      <div className="rooms-content">
        <div className="rooms-header" style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <Button
              type="text"
              icon={<ArrowLeftOutlined />}
              onClick={() => navigate('/')}
            >
              返回
            </Button>
            <h1 className="rooms-title" style={{ margin: 0 }}>游戏房间</h1>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <HelpButton />
            <Button
              size="small"
              icon={<TeamOutlined />}
              onClick={() => setUserPanelOpen(true)}
              style={{ fontSize: 12 }}
            >
              在册用户
            </Button>
            <Button
              size="small"
              icon={<EyeOutlined />}
              onClick={() => setRoomsPanelOpen(true)}
              style={{ fontSize: 12 }}
            >
              在线房间
            </Button>
          </div>
        </div>
        <div className="card-plate">
          <div className="rooms-header" style={{ marginBottom: 16 }}>
            <div className="rooms-title">创建房间</div>
          </div>
          <Form form={form} layout="inline" className="create-room">
            <Form.Item name="name" rules={[{ required: true, message: '请输入房间名称' }]}>
              <Input placeholder="房间名称" style={{ width: 220 }} autoComplete="off" />
            </Form.Item>
            <Form.Item name="maxPlayers" rules={[{ required: true, message: '请输入人数上限' }]}>
              <InputNumber min={2} max={10} placeholder="房间上限人数" style={{ width: 160 }} autoComplete="off" />
            </Form.Item>
            <Form.Item name="password">
              <Input.Password placeholder="房间密码（可选）" style={{ width: 220, borderRadius: '14px' }} autoComplete="new-password" />
            </Form.Item>
            <Form.Item>
              <Button type="primary" onClick={handleCreate} loading={createLoading} style={{ height: 40, paddingInline: 20, background: 'rgba(200, 235, 200, 0.3)', color: '#0f172a', border: '1px solid rgba(127, 201, 127, 0.15)', fontSize: '16px', fontWeight: 600 }}>
                创建
              </Button>
            </Form.Item>
          </Form>
        </div>

        <div className="card-plate">
          <div className="rooms-header">
            <div className="rooms-title">房间列表</div>
            <div className="status-badges">
              <Tag
                style={{ borderRadius: 999, paddingInline: 12 }}
                color={
                  socketStatus === 'connected'
                    ? 'green'
                    : socketStatus === 'connecting'
                      ? 'orange'
                      : 'red'
                }
              >
                WebSocket：{socketStatus === 'connected' ? '已连接' : socketStatus === 'connecting' ? '连接中' : '未连接'}
              </Tag>
              <Tag color="blue" style={{ borderRadius: 999, paddingInline: 12 }}>
                卡片视图
              </Tag>
            </div>
          </div>

          {rooms.length === 0 ? (
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无房间" />
          ) : (
            <div className="rooms-grid">
              {rooms.map(room => (
                <RoomCard
                  key={room.id}
                  room={room}
                  onJoin={handleJoin}
                  onLeave={handleLeave}
                  onClose={handleClose}
                  onKillGame={handleKillGame}
                  onResume={handleResume}
                  isHost={room.hostId === user?.userId}
                  loading={actionRoomId === room.id || loading}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <UserRegistryPanel open={userPanelOpen} onClose={() => setUserPanelOpen(false)} />
      <OnlineRoomsPanel open={roomsPanelOpen} onClose={() => setRoomsPanelOpen(false)} />
    </div>
  );
}

export default Rooms;
