import { Router } from 'express';
import prisma from '../utils/db';
import redis from '../utils/redis';
import { logger } from '../utils/logger';
import { aiService, AIConfig } from '../services/aiService';

const router = Router();

/**
 * GET /api/test/db
 * 测试数据库连接
 */
router.get('/test/db', async (_req, res) => {
  try {
    // 尝试执行一个简单的查询来测试连接
    await prisma.$queryRaw`SELECT 1`;
    logger.info('Database connection test: success');
    res.json({ 
      status: 'ok', 
      message: 'Database connected',
      timestamp: new Date().toISOString()
    });
  } catch (error: any) {
    logger.error('Database connection test failed:', error);
    const errorMessage = error.message || 'Database connection failed';
    const errorCode = error.code || 'UNKNOWN';
    res.status(500).json({ 
      status: 'error', 
      message: errorMessage,
      code: errorCode,
      hint: errorCode === 'P1001' ? '无法连接到数据库服务器，请检查DATABASE_URL配置和PostgreSQL服务状态' : 
            errorCode === 'P1003' ? '数据库不存在，请先创建数据库或检查DATABASE_URL' :
            '请检查数据库配置和连接状态'
    });
  }
});

/**
 * GET /api/test/redis
 * 测试Redis连接
 */
router.get('/test/redis', async (_req, res) => {
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
    // Redis是可选的，返回200但标记为警告
    res.status(200).json({ 
      status: 'warning', 
      message: error.message || 'Redis connection failed (optional)',
      note: 'Redis是可选的，不影响核心功能'
    });
  }
});

/**
 * GET /api/test/websocket
 * 测试WebSocket连接信息
 */
router.get('/test/websocket', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'WebSocket server is running',
    endpoint: process.env.FRONTEND_URL || 'http://localhost:5173',
    timestamp: new Date().toISOString()
  });
});

/**
 * POST /api/test/ai
 * 测试AI API连接
 * 可以接受房间ID或直接提供API配置
 */
router.post('/test/ai', async (req, res) => {
  try {
    const { roomId, apiProvider, apiEndpoint, apiHeaders, apiBodyTemplate } = req.body || {};

    let config: AIConfig;

    // 如果提供了房间ID，从HostConfig获取配置
    if (roomId) {
      const hostConfig = await prisma.hostConfig.findUnique({
        where: { roomId },
      });

      if (!hostConfig) {
        res.status(404).json({
          status: 'error',
          message: '房间配置不存在',
          hint: '请先完成主持人配置',
        });
        return;
      }

      if (!hostConfig.apiEndpoint) {
        res.status(400).json({
          status: 'error',
          message: 'API配置不完整',
          hint: '请先配置API端点',
        });
        return;
      }

      config = {
        provider: hostConfig.apiProvider || undefined,
        endpoint: hostConfig.apiEndpoint,
        headers: (hostConfig.apiHeaders as Record<string, string>) || undefined,
        bodyTemplate: (hostConfig.apiBodyTemplate as Record<string, unknown>) || undefined,
      };
    } else if (apiEndpoint) {
      // 直接使用提供的配置
      config = {
        provider: apiProvider || undefined,
        endpoint: apiEndpoint,
        headers: apiHeaders || undefined,
        bodyTemplate: apiBodyTemplate || undefined,
      };
    } else {
      res.status(400).json({
        status: 'error',
        message: '缺少必要参数',
        hint: '请提供 roomId 或 apiEndpoint',
      });
      return;
    }

    // 执行测试调用
    const testPrompt = '这是一个API连接测试。请回复"连接成功"以确认API正常工作。';
    
    logger.info(`Testing AI API connection: ${config.endpoint}`);
    const startTime = Date.now();
    
    try {
      const result = await aiService.callAI(config, testPrompt, 1); // 只尝试1次，快速失败
      const duration = Date.now() - startTime;

      logger.info(`AI API connection test: success (${duration}ms)`);
      
      res.json({
        status: 'ok',
        message: 'AI API连接成功',
        endpoint: config.endpoint,
        provider: config.provider || 'unknown',
        response: result.narrative || '收到响应',
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.error('AI API connection test failed:', error);

      // 分析错误类型
      let errorType = 'unknown';
      let hint = '请检查API配置';

      if (error.response) {
        // HTTP错误响应
        const status = error.response.status;
        const data = error.response.data;

        if (status === 401) {
          errorType = 'authentication';
          hint = 'API密钥无效或已过期，请检查Authorization头';
        } else if (status === 404) {
          errorType = 'not_found';
          hint = 'API端点不存在，请检查endpoint配置';
        } else if (status === 429) {
          errorType = 'rate_limit';
          hint = 'API调用频率超限，请稍后重试';
        } else if (status >= 500) {
          errorType = 'server_error';
          hint = 'API服务器错误，请稍后重试';
        } else {
          errorType = 'http_error';
          hint = `HTTP错误 ${status}: ${JSON.stringify(data)}`;
        }
      } else if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
        errorType = 'connection';
        hint = '无法连接到API服务器，请检查endpoint地址和网络连接';
      } else if (error.code === 'ETIMEDOUT') {
        errorType = 'timeout';
        hint = '连接超时，请检查网络或增加超时时间';
      }

      res.status(500).json({
        status: 'error',
        message: error.message || 'AI API连接失败',
        endpoint: config.endpoint,
        provider: config.provider || 'unknown',
        errorType,
        hint,
        duration: `${duration}ms`,
        timestamp: new Date().toISOString(),
      });
    }
  } catch (error: any) {
    logger.error('AI API test endpoint error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || '测试过程中发生错误',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;

