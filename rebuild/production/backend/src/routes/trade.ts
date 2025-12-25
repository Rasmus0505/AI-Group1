import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import prisma from '../utils/db';
import redis from '../utils/redis';

const router = Router();

/**
 * POST /api/game/:sessionId/trade/request
 * 发起交易请求
 */
router.post(
  '/:sessionId/trade/request',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { sessionId } = req.params;
      const { targetId, offer, request, expiresInMinutes = 5 } = req.body;

      if (!userId) throw new AppError('Unauthorized', 401);
      if (!targetId || !offer || !request) {
        throw new AppError('请提供目标用户、提供的资源和请求的资源', 400);
      }

      // 验证会话存在且正在进行
      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: {
          room: {
            include: {
              players: {
                where: {
                  status: { not: 'left' },
                },
              },
            },
          },
        },
      });

      if (!session) throw new AppError('游戏会话不存在', 404);
      if (session.status !== 'playing') {
        throw new AppError('只能在游戏进行中发起交易', 400);
      }

      // 验证用户和目标用户都在游戏中
      const initiatorPlayer = session.room.players.find(p => p.userId === userId);
      const targetPlayer = session.room.players.find(p => p.userId === targetId);

      if (!initiatorPlayer) throw new AppError('您未参与此游戏', 403);
      if (!targetPlayer) throw new AppError('目标用户未参与此游戏', 400);
      if (userId === targetId) throw new AppError('不能与自己交易', 400);

      // 检查是否有待处理的交易
      const existingTrade = await prisma.trade.findFirst({
        where: {
          sessionId,
          round: session.currentRound,
          initiatorId: userId,
          targetId,
          status: 'pending',
        },
      });

      if (existingTrade) {
        throw new AppError('您已向该用户发起过交易请求，请等待响应', 400);
      }

      // 创建交易
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + expiresInMinutes);

      const trade = await prisma.trade.create({
        data: {
          sessionId,
          round: session.currentRound,
          initiatorId: userId,
          targetId,
          resources: {
            offer,
            request,
          },
          status: 'pending',
          expiresAt,
        },
        include: {
          initiator: {
            select: {
              id: true,
              username: true,
              nickname: true,
            },
          },
          target: {
            select: {
              id: true,
              username: true,
              nickname: true,
            },
          },
        },
      });

      // 发送WebSocket通知
      const { io } = require('../server');
      if (io) {
        io.to(sessionId).emit('trade_requested', {
          tradeId: trade.id,
          sessionId,
          round: session.currentRound,
          initiator: {
            id: trade.initiator.id,
            username: trade.initiator.username,
            nickname: trade.initiator.nickname,
          },
          target: {
            id: trade.target.id,
            username: trade.target.username,
            nickname: trade.target.nickname,
          },
          resources: trade.resources,
          expiresAt: trade.expiresAt,
        });
      }

      // 设置过期任务（Redis）
      const expireKey = `trade: expire:${trade.id} `;
      await redis.setex(
        expireKey,
        expiresInMinutes * 60,
        JSON.stringify({ tradeId: trade.id, sessionId })
      );

      res.json({
        code: 200,
        message: '交易请求已发送',
        data: {
          trade: {
            id: trade.id,
            sessionId: trade.sessionId,
            round: trade.round,
            initiator: trade.initiator,
            target: trade.target,
            resources: trade.resources,
            status: trade.status,
            expiresAt: trade.expiresAt,
            createdAt: trade.createdAt,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/game/:sessionId/trade/:tradeId/respond
 * 响应交易请求（接受/拒绝）
 */
router.post(
  '/:sessionId/trade/:tradeId/respond',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { sessionId, tradeId } = req.params;
      const { action } = req.body; // 'accept' or 'reject'

      if (!userId) throw new AppError('Unauthorized', 401);
      if (!action || !['accept', 'reject'].includes(action)) {
        throw new AppError('请提供有效的操作：accept 或 reject', 400);
      }

      // 获取交易
      const trade = await prisma.trade.findUnique({
        where: { id: tradeId },
        include: {
          session: {
            include: {
              room: {
                include: {
                  players: {
                    where: {
                      status: { not: 'left' },
                    },
                  },
                },
              },
            },
          },
          initiator: {
            select: {
              id: true,
              username: true,
              nickname: true,
            },
          },
          target: {
            select: {
              id: true,
              username: true,
              nickname: true,
            },
          },
        },
      });

      if (!trade) throw new AppError('交易不存在', 404);
      if (trade.sessionId !== sessionId) {
        throw new AppError('交易会话ID不匹配', 400);
      }
      if (trade.targetId !== userId) {
        throw new AppError('您无权响应此交易', 403);
      }
      if (trade.status !== 'pending') {
        throw new AppError('交易已处理，无法再次响应', 400);
      }

      // 检查是否过期
      if (new Date() > trade.expiresAt) {
        await prisma.trade.update({
          where: { id: tradeId },
          data: { status: 'expired' },
        });
        throw new AppError('交易已过期', 400);
      }

      // 更新交易状态
      const updatedTrade = await prisma.trade.update({
        where: { id: tradeId },
        data: {
          status: action === 'accept' ? 'accepted' : 'rejected',
          respondedAt: new Date(),
        },
        include: {
          initiator: {
            select: {
              id: true,
              username: true,
              nickname: true,
            },
          },
          target: {
            select: {
              id: true,
              username: true,
              nickname: true,
            },
          },
        },
      });

      // 删除过期任务
      await redis.del(`trade: expire:${tradeId} `);

      // 发送WebSocket通知
      const { io } = require('../server');
      if (io) {
        io.to(sessionId).emit('trade_responded', {
          tradeId: updatedTrade.id,
          sessionId,
          round: updatedTrade.round,
          status: updatedTrade.status,
          initiator: updatedTrade.initiator,
          target: updatedTrade.target,
          respondedAt: updatedTrade.respondedAt,
        });
      }

      res.json({
        code: 200,
        message: action === 'accept' ? '交易已接受' : '交易已拒绝',
        data: {
          trade: {
            id: updatedTrade.id,
            sessionId: updatedTrade.sessionId,
            round: updatedTrade.round,
            initiator: updatedTrade.initiator,
            target: updatedTrade.target,
            resources: updatedTrade.resources,
            status: updatedTrade.status,
            respondedAt: updatedTrade.respondedAt,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/game/:sessionId/trade/list
 * 获取交易列表
 */
router.get(
  '/:sessionId/trade/list',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { sessionId } = req.params;
      const { status, round } = req.query;

      if (!userId) throw new AppError('Unauthorized', 401);

      // 验证会话存在
      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: {
          room: {
            include: {
              players: {
                where: {
                  userId,
                  status: { not: 'left' },
                },
              },
            },
          },
        },
      });

      if (!session) throw new AppError('游戏会话不存在', 404);
      if (session.room.players.length === 0) {
        throw new AppError('您未参与此游戏', 403);
      }

      // 构建查询条件
      const where: any = {
        sessionId,
      };

      if (round) {
        where.round = Number(round);
      } else {
        where.round = session.currentRound;
      }

      if (status) {
        where.status = status;
      }

      // 只返回与当前用户相关的交易
      where.OR = [
        { initiatorId: userId },
        { targetId: userId },
      ];

      // 获取交易列表
      const trades = await prisma.trade.findMany({
        where,
        include: {
          initiator: {
            select: {
              id: true,
              username: true,
              nickname: true,
            },
          },
          target: {
            select: {
              id: true,
              username: true,
              nickname: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      res.json({
        code: 200,
        data: {
          trades: trades.map(trade => ({
            id: trade.id,
            sessionId: trade.sessionId,
            round: trade.round,
            initiator: trade.initiator,
            target: trade.target,
            resources: trade.resources,
            status: trade.status,
            expiresAt: trade.expiresAt,
            respondedAt: trade.respondedAt,
            createdAt: trade.createdAt,
            updatedAt: trade.updatedAt,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/game/:sessionId/trade/:tradeId
 * 取消交易（仅发起者可取消）
 */
router.delete(
  '/:sessionId/trade/:tradeId',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { sessionId, tradeId } = req.params;

      if (!userId) throw new AppError('Unauthorized', 401);

      // 获取交易
      const trade = await prisma.trade.findUnique({
        where: { id: tradeId },
      });

      if (!trade) throw new AppError('交易不存在', 404);
      if (trade.sessionId !== sessionId) {
        throw new AppError('交易会话ID不匹配', 400);
      }
      if (trade.initiatorId !== userId) {
        throw new AppError('只有发起者可以取消交易', 403);
      }
      if (trade.status !== 'pending') {
        throw new AppError('只能取消待处理的交易', 400);
      }

      // 更新交易状态
      await prisma.trade.update({
        where: { id: tradeId },
        data: { status: 'cancelled' },
      });

      // 删除过期任务
      await redis.del(`trade: expire:${tradeId} `);

      // 发送WebSocket通知
      const { io } = require('../server');
      if (io) {
        io.to(sessionId).emit('trade_cancelled', {
          tradeId,
          sessionId,
          round: trade.round,
        });
      }

      res.json({
        code: 200,
        message: '交易已取消',
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;

