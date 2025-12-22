import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface AppErrorShape extends Error {
  statusCode?: number;
  code?: string;
}

// 兼容原先将 AppError 当作构造函数使用的场景
export class AppError extends Error implements AppErrorShape {
  statusCode?: number;
  code?: string;

  constructor(message: string, statusCode = 500, code?: string) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.name = 'AppError';
  }
}

export const errorHandler = (
  err: AppErrorShape,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  logger.error({
    error: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  res.status(statusCode).json({
    code: statusCode,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack }),
  });
};
