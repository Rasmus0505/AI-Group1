import { Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

export interface AuthedSocket extends Socket {
  userId?: string;
  username?: string;
}

export const socketAuthMiddleware = (
  socket: AuthedSocket,
  next: (err?: Error) => void
) => {
  try {
    const authToken =
      (socket.handshake.auth && (socket.handshake.auth as { token?: string }).token) ||
      extractTokenFromHeader(socket);

    if (!authToken) {
      const err = new Error('Authentication token required');
      (err as any).data = { code: 'AUTH_REQUIRED', statusCode: 401 };
      return next(err);
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      const err = new Error('JWT secret not configured');
      (err as any).data = { code: 'CONFIG_ERROR', statusCode: 500 };
      return next(err);
    }

    const decoded = jwt.verify(authToken, jwtSecret) as {
      userId: string;
      username: string;
    };

    socket.userId = decoded.userId;
    socket.username = decoded.username;

    return next();
  } catch (error) {
    logger.warn('Socket auth failed', error);
    const err = new Error('Invalid or expired token');
    (err as any).data = { code: 'AUTH_INVALID', statusCode: 401 };
    return next(err);
  }
};

const extractTokenFromHeader = (socket: Socket): string | null => {
  const authHeader =
    (socket.handshake.headers['authorization'] as string | undefined) ||
    (socket.handshake.headers['Authorization'] as string | undefined);

  if (!authHeader) return null;

  const parts = authHeader.split(' ');
  if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
    return parts[1];
  }

  return null;
};


