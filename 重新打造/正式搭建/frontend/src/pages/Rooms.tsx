import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Form, Input, InputNumber, Space, Tag, message, Row, Col, Empty } from 'antd';
import { roomAPI, RoomSummary } from '../services/rooms';
import { wsService } from '../services/websocket';
import { useAuthStore } from '../stores/authStore';
import RoomCard from '../components/RoomCard';
import { useSocket } from '../hooks/useSocket';
import { useMessageRouter } from '../hooks/useMessageRouter';

function Rooms() {
  const { token } = useAuthStore();
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

    wsService.on('player_joined', refresh);
    wsService.on('player_left', refresh);
    wsService.on('system_message', handleSystemMessage);
    wsService.on('error', handleError);

    return () => {
      wsService.off('player_joined', refresh);
      wsService.off('player_left', refresh);
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

  return (
    <Space direction="vertical" size="large" style={{ width: '100%' }}>
      <Card title="创建房间">
        <Form form={form} layout="inline" initialValues={{ maxPlayers: 4 }}>
          <Form.Item name="name" rules={[{ required: true, message: '请输入房间名称' }]}>
            <Input placeholder="房间名称" style={{ width: 200 }} />
          </Form.Item>
          <Form.Item name="maxPlayers" rules={[{ required: true, message: '请输入人数上限' }]}>
            <InputNumber min={2} max={10} placeholder="人数上限" />
          </Form.Item>
          <Form.Item name="password">
            <Input.Password placeholder="房间密码（可选）" style={{ width: 200 }} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" onClick={handleCreate} loading={createLoading}>
              创建
            </Button>
          </Form.Item>
        </Form>
      </Card>

      <Card
        title="房间列表"
        extra={
          <Space>
            <Tag
              color={
                socketStatus === 'connected'
                  ? 'green'
                  : socketStatus === 'connecting'
                    ? 'orange'
                    : 'red'
              }
            >
              WebSocket：
              {socketStatus === 'connected'
                ? '已连接'
                : socketStatus === 'connecting'
                  ? '连接中'
                  : '未连接'}
            </Tag>
            <Tag color="blue">卡片视图</Tag>
          </Space>
        }
      >
        {rooms.length === 0 ? (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="暂无房间" />
        ) : (
          <Row gutter={[16, 16]}>
            {rooms.map(room => (
              <Col key={room.id} xs={24} sm={12} md={8} lg={6}>
                <RoomCard
                  room={room}
                  onJoin={handleJoin}
                  onLeave={handleLeave}
                  loading={actionRoomId === room.id || loading}
                />
              </Col>
            ))}
          </Row>
        )}
      </Card>
    </Space>
  );
}

export default Rooms;
