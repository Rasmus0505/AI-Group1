import { Server } from 'socket.io';
import { logger } from '../utils/logger';
import { socketAuthMiddleware, AuthedSocket } from './authSocket';
import { registerRoomHandlers } from './roomHandlers';
import { registerGameHandler } from './gameHandler';
import { registerMessageHandler } from './messageHandler';
import { removePlayerFromRoom, getRoomState, addPlayerToRoom } from '../services/roomStateService';

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
      if (!socket.userId) {
        ack?.({ joined });
        return;
      }
      
      for (const roomId of roomIds) {
        socket.join(roomId);
        // Restore player in Redis room state (if not already there)
        await addPlayerToRoom(roomId, socket.userId);
        const state = await getRoomState(roomId);
        joined.push({ roomId, state });
        // Don't emit player_joined for rejoin - this is just reconnecting WebSocket
        // The player is already in the room, we're just restoring the connection
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


