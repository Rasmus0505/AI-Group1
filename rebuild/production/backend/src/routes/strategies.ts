import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import prisma from '../utils/db';
import { AppError } from '../middleware/errorHandler';

const router = Router();

/**
 * GET /api/user/strategies
 * 获取用户策略列表
 */
router.get(
  '/strategies',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      if (!userId) throw new AppError('Unauthorized', 401);

      const { page = 1, limit = 10, sortBy = 'winRate', order = 'desc' } = req.query;
      const pageNum = Number(page) || 1;
      const limitNum = Number(limit) || 10;
      const skip = (pageNum - 1) * limitNum;

      const orderBy: any = {};
      if (sortBy === 'winRate') {
        orderBy.winRate = order === 'asc' ? 'asc' : 'desc';
      } else if (sortBy === 'averageScore') {
        orderBy.averageScore = order === 'asc' ? 'asc' : 'desc';
      } else if (sortBy === 'totalGames') {
        orderBy.totalGames = order === 'asc' ? 'asc' : 'desc';
      } else {
        orderBy.createdAt = 'desc';
      }

      const [strategies, total] = await Promise.all([
        prisma.strategy.findMany({
          where: { userId },
          orderBy,
          skip,
          take: limitNum,
        }),
        prisma.strategy.count({ where: { userId } }),
      ]);

      res.json({
        code: 200,
        data: {
          strategies: strategies.map(s => ({
            id: s.id,
            userId: s.userId,
            sessionId: s.sessionId,
            strategyName: s.strategyName,
            description: s.description,
            strategyData: s.strategyData,
            effectiveness: s.effectiveness,
            winRate: s.winRate,
            averageScore: s.averageScore,
            totalGames: s.totalGames,
            totalWins: s.totalWins,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
          })),
          pagination: {
            page: pageNum,
            limit: limitNum,
            total,
            totalPages: Math.ceil(total / limitNum),
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/user/strategies/:strategyId/analysis
 * 获取策略分析详情
 */
router.get(
  '/strategies/:strategyId/analysis',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { strategyId } = req.params;
      if (!userId) throw new AppError('Unauthorized', 401);

      const strategy = await prisma.strategy.findUnique({
        where: { id: strategyId },
      });

      if (!strategy) throw new AppError('策略不存在', 404);
      if (strategy.userId !== userId) {
        throw new AppError('无权访问此策略', 403);
      }

      // 计算策略统计数据
      const analysis = {
        id: strategy.id,
        strategyName: strategy.strategyName,
        description: strategy.description,
        strategyData: strategy.strategyData,
        effectiveness: strategy.effectiveness,
        statistics: {
          winRate: strategy.winRate || 0,
          averageScore: strategy.averageScore || 0,
          totalGames: strategy.totalGames,
          totalWins: strategy.totalWins,
          totalLosses: strategy.totalGames - strategy.totalWins,
        },
        trends: {
          // 可以添加趋势分析数据
          recentPerformance: strategy.effectiveness as any,
        },
        createdAt: strategy.createdAt,
        updatedAt: strategy.updatedAt,
      };

      res.json({
        code: 200,
        data: analysis,
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/user/strategies
 * 创建或更新策略
 */
router.post(
  '/strategies',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      if (!userId) throw new AppError('Unauthorized', 401);

      const {
        strategyName,
        description,
        strategyData,
        sessionId,
        effectiveness,
        winRate,
        averageScore,
        totalGames,
        totalWins,
      } = req.body || {};

      if (!strategyName || !strategyData) {
        throw new AppError('策略名称和数据不能为空', 400);
      }

      const strategy = await prisma.strategy.create({
        data: {
          userId,
          sessionId: sessionId || null,
          strategyName,
          description: description || null,
          strategyData: strategyData as any,
          effectiveness: effectiveness ? (effectiveness as any) : null,
          winRate: winRate || null,
          averageScore: averageScore || null,
          totalGames: totalGames || 0,
          totalWins: totalWins || 0,
        },
      });

      res.json({
        code: 200,
        message: '策略已保存',
        data: {
          id: strategy.id,
          userId: strategy.userId,
          sessionId: strategy.sessionId,
          strategyName: strategy.strategyName,
          description: strategy.description,
          strategyData: strategy.strategyData,
          effectiveness: strategy.effectiveness,
          winRate: strategy.winRate,
          averageScore: strategy.averageScore,
          totalGames: strategy.totalGames,
          totalWins: strategy.totalWins,
          createdAt: strategy.createdAt,
          updatedAt: strategy.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/user/strategies/:strategyId
 * 更新策略
 */
router.put(
  '/strategies/:strategyId',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { strategyId } = req.params;
      if (!userId) throw new AppError('Unauthorized', 401);

      const strategy = await prisma.strategy.findUnique({
        where: { id: strategyId },
      });

      if (!strategy) throw new AppError('策略不存在', 404);
      if (strategy.userId !== userId) {
        throw new AppError('无权修改此策略', 403);
      }

      const {
        strategyName,
        description,
        strategyData,
        effectiveness,
        winRate,
        averageScore,
        totalGames,
        totalWins,
      } = req.body || {};

      const updated = await prisma.strategy.update({
        where: { id: strategyId },
        data: {
          strategyName: strategyName || strategy.strategyName,
          description: description !== undefined ? description : strategy.description,
          strategyData: strategyData ? (strategyData as any) : strategy.strategyData,
          effectiveness: effectiveness ? (effectiveness as any) : strategy.effectiveness,
          winRate: winRate !== undefined ? winRate : strategy.winRate,
          averageScore: averageScore !== undefined ? averageScore : strategy.averageScore,
          totalGames: totalGames !== undefined ? totalGames : strategy.totalGames,
          totalWins: totalWins !== undefined ? totalWins : strategy.totalWins,
        },
      });

      res.json({
        code: 200,
        message: '策略已更新',
        data: {
          id: updated.id,
          userId: updated.userId,
          sessionId: updated.sessionId,
          strategyName: updated.strategyName,
          description: updated.description,
          strategyData: updated.strategyData,
          effectiveness: updated.effectiveness,
          winRate: updated.winRate,
          averageScore: updated.averageScore,
          totalGames: updated.totalGames,
          totalWins: updated.totalWins,
          updatedAt: updated.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

