import { Server } from 'socket.io';
import { AuthedSocket } from './authSocket';
import { logger } from '../utils/logger';
import prisma from '../utils/db';
import {
  addPlayerToRoom,
  getRoomState,
  removePlayerFromRoom,
} from '../services/roomStateService';

interface JoinRoomPayload {
  roomId: string;
}

interface LeaveRoomPayload {
  roomId: string;
}

interface SystemBroadcastPayload {
  roomId: string;
  message: string;
}

interface SyncStatePayload {
  roomId: string;
}

const emitError = (
  socket: AuthedSocket,
  code: string,
  message: string,
  details?: unknown
): void => {
  socket.emit('error', {
    code,
    message,
    details,
  });
};

export const registerRoomHandlers = (io: Server, socket: AuthedSocket): void => {
  socket.on('join_room', async (payload: JoinRoomPayload | string, ack?: (data?: unknown) => void) => {
    try {
      const roomId = typeof payload === 'string' ? payload : payload?.roomId;
      if (!roomId) return;
      if (!socket.userId) {
        emitError(socket, 'AUTH_REQUIRED', '需要登录才能加入房间');
        return;
      }

      const room = await prisma.room.findUnique({ where: { id: roomId } });
      if (!room) {
        emitError(socket, 'ROOM_NOT_FOUND', '房间不存在');
        return;
      }

      logger.info(
        `Socket ${socket.id} joining room ${roomId} (userId=${socket.userId})`
      );

      socket.join(roomId);

      const state = await addPlayerToRoom(roomId, socket.userId);

      const payloadJoined = {
        roomId,
        userId: socket.userId,
        username: socket.username,
      };
      io.to(roomId).emit('player_joined', payloadJoined);
      io.to(roomId).emit('game_state_update', state);
      ack?.({ roomId, state });
    } catch (error) {
      logger.error('join_room handler error', error);
      emitError(socket, 'JOIN_ROOM_FAILED', '加入房间失败', {
        roomId: (payload as JoinRoomPayload)?.roomId ?? payload,
      });
    }
  });

  socket.on('leave_room', async (payload: LeaveRoomPayload | string, ack?: (data?: unknown) => void) => {
    try {
      const roomId = typeof payload === 'string' ? payload : payload?.roomId;
      if (!roomId || !socket.userId) return;

      logger.info(
        `Socket ${socket.id} leaving room ${roomId} (userId=${socket.userId})`
      );

      socket.leave(roomId);

      const state = await removePlayerFromRoom(roomId, socket.userId);

      const payloadLeft = {
        roomId,
        userId: socket.userId,
        username: socket.username,
      };
      io.to(roomId).emit('player_left', payloadLeft);
      io.to(roomId).emit('game_state_update', state);
      ack?.({ roomId, state });
    } catch (error) {
      logger.error('leave_room handler error', error);
      emitError(socket, 'LEAVE_ROOM_FAILED', '离开房间失败', {
        roomId: (payload as LeaveRoomPayload)?.roomId ?? payload,
      });
    }
  });

  socket.on('system_broadcast', async (payload: SystemBroadcastPayload) => {
    try {
      const { roomId, message } = payload || {};
      if (!roomId || !message) return;

      logger.info(
        `System broadcast to room ${roomId} by socket ${socket.id}: ${message}`
      );

      io.to(roomId).emit('system_message', {
        roomId,
        message,
        from: 'system',
      });
    } catch (error) {
      logger.error('system_broadcast handler error', error);
      emitError(socket, 'SYSTEM_BROADCAST_FAILED', '系统消息发送失败');
    }
  });

  socket.on('sync_state', async (payload: SyncStatePayload | string) => {
    try {
      const roomId = typeof payload === 'string' ? payload : payload?.roomId;
      if (!roomId) return;

      const state = await getRoomState(roomId);
      socket.emit('game_state_update', state);
    } catch (error) {
      logger.error('sync_state handler error', error);
      emitError(socket, 'SYNC_STATE_FAILED', '同步房间状态失败');
    }
  });

  // 心跳事件（可由前端定期发送），用于记录最近活动时间
  socket.on('heartbeat', () => {
    if (!socket.userId) return;
    logger.debug?.(
      `Heartbeat from user ${socket.userId} on socket ${socket.id} at ${new Date().toISOString()}`
    );
  });
};



