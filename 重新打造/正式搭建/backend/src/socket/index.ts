import { Server } from 'socket.io';
import { logger } from '../utils/logger';
import { socketAuthMiddleware, AuthedSocket } from './authSocket';
import { registerRoomHandlers } from './roomHandlers';
import { registerGameHandler } from './gameHandler';
import { registerMessageHandler } from './messageHandler';
import { removePlayerFromRoom, getRoomState } from '../services/roomStateService';

export const initSocketServer = (io: Server): void => {
  // Global auth middleware for all socket connections
  io.use(socketAuthMiddleware);

  io.on('connection', (rawSocket) => {
    const socket = rawSocket as AuthedSocket;
    logger.info(`WebSocket client connected: ${socket.id}`);

    // Register room-related events
    registerRoomHandlers(io, socket);
    registerGameHandler(io, socket);
    registerMessageHandler(io, socket);

    // 客户端可在重连后请求重新加入房间，并获取最新状态
    socket.on('rejoin_rooms', async (payload: { roomIds: string[] }, ack?: (data: unknown) => void) => {
      const roomIds = payload?.roomIds || [];
      const joined: Array<{ roomId: string; state: unknown }> = [];
      for (const roomId of roomIds) {
        socket.join(roomId);
        const state = await getRoomState(roomId);
        joined.push({ roomId, state });
        io.to(roomId).emit('player_joined', {
          roomId,
          userId: socket.userId,
          username: socket.username,
          rejoined: true,
        });
        io.to(roomId).emit('game_state_update', state);
      }
      ack?.({ joined });
    });

    socket.on('disconnect', async (reason) => {
      logger.info(`WebSocket client disconnected: ${socket.id}, reason=${reason}`);

      // 利用 Socket.io 内建心跳检测，断线时自动清理 Redis 中的在线状态
      if (!socket.userId) return;

      const joinedRooms = Array.from(socket.rooms).filter((id) => id !== socket.id);
      for (const roomId of joinedRooms) {
        try {
          const state = await removePlayerFromRoom(roomId, socket.userId);
          io.to(roomId).emit('player_left', {
            roomId,
            userId: socket.userId,
            username: socket.username,
          });
          io.to(roomId).emit('game_state_update', state);
        } catch (error) {
          logger.warn(
            `Failed to clean up room state on disconnect for room ${roomId}, user ${socket.userId}`,
            error
          );
        }
      }
    });
  });
};


