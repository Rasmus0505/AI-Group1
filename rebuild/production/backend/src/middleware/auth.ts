import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from './errorHandler';

class AuthError extends Error implements AppError {
  statusCode?: number;
  code?: string;

  constructor(message: string, statusCode = 401, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'AuthError';
  }
}

export interface AuthRequest extends Request {
  userId?: string;
  username?: string;
}

export const authenticateToken = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    throw new AuthError('Authentication token required', 401);
  }

  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new AuthError('JWT secret not configured', 500);
  }

  try {
    const decoded = jwt.verify(token, jwtSecret) as { userId: string; username: string };
    req.userId = decoded.userId;
    req.username = decoded.username;
    next();
  } catch (error) {
    throw new AuthError('Invalid or expired token', 401);
  }
};

