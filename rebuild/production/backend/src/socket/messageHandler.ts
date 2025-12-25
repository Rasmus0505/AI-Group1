import { Server } from 'socket.io';
import { AuthedSocket } from './authSocket';
import { logger } from '../utils/logger';

interface ChatMessagePayload {
  roomId: string;
  message: string;
}

export const registerMessageHandler = (io: Server, socket: AuthedSocket): void => {
  socket.on('chat_message', (payload: ChatMessagePayload, ack?: () => void) => {
    if (!payload?.roomId || !payload?.message) return;
    const data = {
      roomId: payload.roomId,
      from: socket.username || socket.userId,
      message: payload.message,
      ts: Date.now(),
    };
    io.to(payload.roomId).emit('chat_message', data);
    ack?.();
    logger.info(`chat_message to room ${payload.roomId} from ${socket.userId}: ${payload.message}`);
  });
};


