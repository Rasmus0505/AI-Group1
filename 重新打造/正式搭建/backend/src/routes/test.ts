import { Router } from 'express';
import prisma from '../utils/db';
import redis from '../utils/redis';
import { logger } from '../utils/logger';

const router = Router();

/**
 * GET /api/test/db
 * 测试数据库连接
 */
router.get('/test/db', async (req, res) => {
  try {
    await prisma.$connect();
    logger.info('Database connection test: success');
    res.json({ 
      status: 'ok', 
      message: 'Database connected',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Database connection test failed:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error.message || 'Database connection failed'
    });
  }
});

/**
 * GET /api/test/redis
 * 测试Redis连接
 */
router.get('/test/redis', async (req, res) => {
  try {
    const result = await redis.ping();
    logger.info('Redis connection test: success');
    res.json({ 
      status: 'ok', 
      message: 'Redis connected',
      ping: result,
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Redis connection test failed:', error);
    res.status(500).json({ 
      status: 'error', 
      message: error.message || 'Redis connection failed'
    });
  }
});

/**
 * GET /api/test/websocket
 * 测试WebSocket连接信息
 */
router.get('/test/websocket', (req, res) => {
  res.json({
    status: 'ok',
    message: 'WebSocket server is running',
    endpoint: process.env.FRONTEND_URL || 'http://localhost:5173',
    timestamp: new Date().toISOString()
  });
});

export default router;

