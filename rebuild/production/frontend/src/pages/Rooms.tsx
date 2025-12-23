import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Form, Input, InputNumber, Space, Tag, message, Empty } from 'antd';
import { roomAPI, RoomSummary } from '../services/rooms';
import { wsService } from '../services/websocket';
import { useAuthStore } from '../stores/authStore';
import RoomCard from '../components/RoomCard';
import { useSocket } from '../hooks/useSocket';
import { useMessageRouter } from '../hooks/useMessageRouter';

function Rooms() {
  const { token, user } = useAuthStore();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [actionRoomId, setActionRoomId] = useState<string | null>(null);
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

  return (
    <div className="rooms-shell">
      <div className="grid-lines" />
      <div className="rooms-content">
        <div className="card-plate">
          <div className="rooms-header" style={{ marginBottom: 16 }}>
            <div className="rooms-title">创建房间</div>
          </div>
          <Form form={form} layout="inline" className="create-room" initialValues={{ maxPlayers: 4 }}>
            <Form.Item name="name" rules={[{ required: true, message: '请输入房间名称' }]}>
              <Input placeholder="房间名称" style={{ width: 220 }} />
            </Form.Item>
            <Form.Item name="maxPlayers" rules={[{ required: true, message: '请输入人数上限' }]}>
              <InputNumber min={2} max={10} placeholder="人数上限" />
            </Form.Item>
            <Form.Item name="password">
              <Input.Password placeholder="房间密码（可选）" style={{ width: 220 }} />
            </Form.Item>
            <Form.Item>
              <Button type="primary" onClick={handleCreate} loading={createLoading} style={{ height: 40, paddingInline: 20 }}>
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
                  isHost={room.hostId === user?.userId}
                  loading={actionRoomId === room.id || loading}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Rooms;
