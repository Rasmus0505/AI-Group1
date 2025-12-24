import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, Descriptions, Space, Spin, Tag, Button, message } from 'antd';
import { roomAPI, RoomSummary } from '../services/rooms';
import { wsService } from '../services/websocket';
import { useAuthStore } from '../stores/authStore';
import { useSocket } from '../hooks/useSocket';
import { useMessageRouter } from '../hooks/useMessageRouter';

const statusColor: Record<string, string> = {
  waiting: 'blue',
  playing: 'green',
  closed: 'default',
};

interface RoomRealtimeState {
  roomId: string;
  players?: string[]; // 添加可选标记，因为可能为undefined
  status: string;
}

function WaitingRoom() {
  const { roomId } = useParams<{ roomId: string }>();
  const { token, user } = useAuthStore();
  const navigate = useNavigate();
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [realtimeState, setRealtimeState] = useState<RoomRealtimeState | null>(null);
  const [hostSetupHovered, setHostSetupHovered] = useState(false);
  const [startGameHovered, setStartGameHovered] = useState(false);
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
        const result = await roomAPI.list({ limit: 200 });
        setRooms(result.rooms);
      } catch (err) {
        message.error(getErrMsg(err, '获取房间信息失败'));
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
    if (!token || !roomId) return;

    const refresh = () => loadRooms();

    const handleGameStateUpdate = (state: unknown) => {
      if (
        state &&
        typeof state === 'object' &&
        'roomId' in state &&
        (state as { roomId?: string }).roomId === roomId
      ) {
        const safeState = state as RoomRealtimeState;
        setRealtimeState(safeState);
        
        // 如果游戏状态变为playing且有sessionId，自动跳转到游戏页面
        if (
          safeState.status === 'playing' &&
          'sessionId' in state &&
          (state as { sessionId?: string }).sessionId
        ) {
          const sessionId = (state as { sessionId?: string }).sessionId;
          if (sessionId) {
            message.success('游戏已开始，正在跳转...');
            setTimeout(() => {
              navigate(`/game/${sessionId}`);
            }, 500);
          }
        }
      }
    };

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

    wsService.trackRoom(roomId);
    wsService.send('join_room', { roomId });
    wsService.send('sync_state', { roomId });

    const handleGameStarted = (payload: unknown) => {
      if (
        payload &&
        typeof payload === 'object' &&
        'roomId' in payload &&
        (payload as { roomId?: string }).roomId === roomId &&
        'sessionId' in payload &&
        (payload as { sessionId?: string }).sessionId
      ) {
        const sessionId = (payload as { sessionId?: string }).sessionId;
        if (sessionId) {
          message.success('游戏已开始，正在跳转...');
          setTimeout(() => {
            navigate(`/game/${sessionId}`);
          }, 500);
        }
      }
    };

    wsService.on('player_joined', refresh);
    wsService.on('player_left', refresh);
    wsService.on('system_message', handleSystemMessage);
    wsService.on('game_state_update', handleGameStateUpdate);
    wsService.on('game_started', handleGameStarted);
    wsService.on('error', handleError);

    return () => {
      // 不要自动离开房间，因为用户可能只是暂时离开页面
      // 只在用户明确点击"离开房间"按钮时才离开
      // wsService.send('leave_room', { roomId });
      wsService.untrackRoom(roomId);
      wsService.off('player_joined', refresh);
      wsService.off('player_left', refresh);
      wsService.off('system_message', handleSystemMessage);
      wsService.off('game_state_update', handleGameStateUpdate);
      wsService.off('game_started', handleGameStarted);
      wsService.off('error', handleError);
    };
  }, [token, roomId, loadRooms]);

  const currentRoom = rooms.find(r => r.id === roomId);

  if (!roomId) {
    return <Card>房间 ID 缺失</Card>;
  }

  return (
    <Spin spinning={loading && !currentRoom}>
      <Space direction="vertical" size="large" style={{ width: '100%', padding: '24px 24px' }}>
        <Button onClick={() => navigate('/rooms')} style={{ marginLeft: 0 }}>返回房间列表</Button>
        <Card
          title={`房间等待中：${currentRoom?.name || roomId}`}
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
              {currentRoom?.hostId === user?.userId && (
                <>
                  <Button 
                    type="primary" 
                    onClick={() => navigate(`/rooms/${roomId}/host-setup`)}
                    onMouseEnter={() => setHostSetupHovered(true)}
                    onMouseLeave={() => setHostSetupHovered(false)}
                    style={{ 
                      background: hostSetupHovered ? '#40a9ff' : '#1890ff',
                      color: '#fff', 
                      border: '1px solid #1890ff',
                      transition: 'all 0.3s ease',
                      transform: hostSetupHovered ? 'translateY(-2px)' : 'translateY(0)',
                      boxShadow: hostSetupHovered ? '0 8px 16px rgba(24, 144, 255, 0.4)' : '0 2px 8px rgba(24, 144, 255, 0.2)',
                    }}
                  >
                    主持人配置
                  </Button>
                  <Button
                    type="default"
                    onClick={() => navigate(`/rooms/${roomId}/host-setup`)}
                    onMouseEnter={() => setStartGameHovered(true)}
                    onMouseLeave={() => setStartGameHovered(false)}
                    style={{
                      transition: 'all 0.3s ease',
                      transform: startGameHovered ? 'translateY(-2px)' : 'translateY(0)',
                      boxShadow: startGameHovered ? '0 8px 16px rgba(0, 0, 0, 0.15)' : '0 2px 8px rgba(0, 0, 0, 0.06)',
                    }}
                  >
                    开始游戏（通过主持人页）
                  </Button>
                </>
              )}
            </Space>
          }
        >
          {currentRoom ? (
            <Descriptions column={1} size="small" bordered>
              <Descriptions.Item label="房间名">{currentRoom.name}</Descriptions.Item>
              <Descriptions.Item label="人数">
                {realtimeState && realtimeState.players
                  ? `${realtimeState.players.length}/${currentRoom.maxPlayers}`
                  : `${currentRoom.currentPlayers}/${currentRoom.maxPlayers}`}
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={statusColor[realtimeState?.status || currentRoom.status] || 'default'}>
                  {realtimeState?.status || currentRoom.status}
                </Tag>
              </Descriptions.Item>
            </Descriptions>
          ) : (
            <div>未找到房间，可能已被关闭或尚未加载。</div>
          )}
        </Card>
      </Space>
    </Spin>
  );
}

export default WaitingRoom;
