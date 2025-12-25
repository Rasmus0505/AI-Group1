import { Button, Space, Typography } from 'antd';
import { UserOutlined, TeamOutlined } from '@ant-design/icons';
import { RoomSummary } from '../services/rooms';

interface RoomCardProps {
  room: RoomSummary;
  onJoin: (roomId: string) => void;
  onLeave: (roomId: string) => void;
  onClose?: (roomId: string) => void;
  onKillGame?: (roomId: string) => void;
  onResume?: (roomId: string) => void;
  isHost?: boolean;
  loading?: boolean;
}

export function RoomCard({
  room,
  onJoin,
  onLeave,
  onClose,
  onKillGame,
  onResume,
  isHost,
  loading,
}: RoomCardProps) {
  const hostLabel = room.hostName || room.hostId || '未知房主';
  const isFull = room.currentPlayers >= room.maxPlayers;
  const isPlaying = room.status === 'playing';
  const isJoined = room.isJoined ?? false; // 检查用户是否在房间中
  const createdAt = new Date(room.createdAt).toLocaleString();

  // 按钮禁用逻辑：只有不在房间中且房间已满时才禁用
  // 已在房间的用户始终可以进入（即使显示满人）
  const isJoinDisabled = !isJoined && (isFull || (isPlaying && !isJoined));

  // 按钮文字逻辑
  const getButtonText = () => {
    if (isJoined) return '进入房间'; // 已在房间的用户显示"进入房间"
    if (isPlaying) return '进行中';
    if (isFull) return '已满';
    return '加入';
  };

  return (
    <div className="room-card">
      <div className="room-top">
        <Typography.Text className="room-name" ellipsis title={room.name}>
          {room.name}
        </Typography.Text>
        <span className={`room-status ${room.status}`}>{room.status}</span>
      </div>

      <div className="room-meta">
        <Space size={6}>
          <TeamOutlined />
          <Typography.Text>
            人数：{room.currentPlayers}/{room.maxPlayers}
          </Typography.Text>
        </Space>
        <Space size={6}>
          <UserOutlined />
          <Typography.Text>房主：{hostLabel}</Typography.Text>
        </Space>
        <Typography.Text className="room-footer">创建时间：{createdAt}</Typography.Text>
      </div>

      <div className="room-actions">
        {/* 如果用户在房间中且游戏进行中，优先显示继续游戏按钮 */}
        {isJoined && isPlaying ? (
          <Button
            type="primary"
            size="small"
            loading={loading}
            onClick={() => {
              console.log('继续游戏点击:', {
                roomId: room.id,
                isJoined,
                isPlaying,
                status: room.status,
                hasOnResume: !!onResume
              });
              if (onResume) {
                onResume(room.id);
              }
            }}
            style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
          >
            继续游戏
          </Button>
        ) : (
          <Button
            className="btn-dark"
            size="small"
            disabled={isJoinDisabled}
            loading={loading}
            onClick={() => {
              console.log('房间卡片点击:', {
                roomId: room.id,
                isJoined,
                isPlaying,
                status: room.status,
                isFull,
                disabled: isJoinDisabled
              });
              onJoin(room.id);
            }}
          >
            {getButtonText()}
          </Button>
        )}
        
        {isJoined && (
          <Button className="btn-light" size="small" danger={false} loading={loading} onClick={() => onLeave(room.id)}>
            离开
          </Button>
        )}
        {isHost && isPlaying && onKillGame && (
          <Button className="btn-light" size="small" danger loading={loading} onClick={() => onKillGame(room.id)} title="终止进行中的游戏">
            终止
          </Button>
        )}
        {isHost && onClose && !isPlaying && (
          <Button className="btn-light" size="small" danger={false} loading={loading} onClick={() => onClose(room.id)}>
            关闭
          </Button>
        )}
      </div>
    </div>
  );
}

export default RoomCard;
