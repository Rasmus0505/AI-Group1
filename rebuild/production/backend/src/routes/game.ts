import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import prisma from '../utils/db';
import { AppError } from '../middleware/errorHandler';
import { io } from '../server';
import { aiService, InferenceRequest, AIConfig } from '../services/aiService';
import { gameRecoveryService } from '../services/GameRecoveryService';
import redis from '../utils/redis';
import { logger } from '../utils/logger';

const router = Router();

// 获取房间内玩家成员关系
const ensureRoomMembership = async (roomId: string, userId: string) => {
  const membership = await prisma.roomPlayer.findFirst({
    where: {
      roomId,
      userId,
      status: { not: 'left' },
    },
  });
  if (!membership) {
    throw new AppError('用户不在房间中', 403);
  }
  return membership;
};

// 确保用户是房间主持人
const ensureRoomHost = async (roomId: string, userId: string) => {
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) {
    throw new AppError('房间不存在', 404);
  }
  if (room.hostId !== userId) {
    throw new AppError('只有主持人可以执行此操作', 403);
  }
  return room;
};

/**
 * POST /api/game/:roomId/generate-init
 * 生成游戏初始化数据（AI生成背景故事、主体状态、卦象等）
 */
router.post('/:roomId/generate-init', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId;
    const { roomId } = req.params;
    if (!userId) throw new AppError('Unauthorized', 401);

    // 确保用户是主持人
    await ensureRoomHost(roomId, userId);

    const { entityCount, gameMode, initialCash, industryTheme } = req.body;

    if (!entityCount || entityCount < 2) {
      throw new AppError('主体数量至少为2', 400);
    }

    // 获取主持人配置
    const hostConfig = await prisma.hostConfig.findUnique({ where: { roomId } });
    if (!hostConfig || !hostConfig.apiEndpoint) {
      throw new AppError('请先配置 AI API', 400);
    }

    const aiConfig: AIConfig = {
      provider: hostConfig.apiProvider || null,
      endpoint: hostConfig.apiEndpoint || null,
      headers: (hostConfig.apiHeaders as Record<string, unknown>) || null,
      bodyTemplate: (hostConfig.apiBodyTemplate as Record<string, unknown>) || null,
    };

    logger.info(`Generating game init for room ${roomId}`, {
      entityCount,
      gameMode,
      initialCash,
      apiEndpoint: aiConfig.endpoint,
      hasApiKey: !!(aiConfig.headers && (aiConfig.headers as any).Authorization)
    });

    try {
      const initResult = await aiService.initializeGame(aiConfig, {
        entityCount,
        gameMode: gameMode || 'multi_control',
        initialCash: initialCash || 1000000,
        gameRules: hostConfig.gameRules || undefined,
        industryTheme,
      });

      logger.info(`Game init generated successfully for room ${roomId}`, {
        hasBackgroundStory: !!initResult.backgroundStory,
        entitiesCount: initResult.entities?.length || 0,
        hasHexagram: !!initResult.yearlyHexagram
      });

      res.json({
        code: 200,
        message: '游戏初始化数据生成成功',
        data: initResult,
      });
    } catch (aiError: any) {
      logger.error(`AI service error for room ${roomId}`, {
        error: aiError.message,
        stack: aiError.stack,
        aiConfig: {
          provider: aiConfig.provider,
          endpoint: aiConfig.endpoint,
          hasHeaders: !!aiConfig.headers,
          hasBodyTemplate: !!aiConfig.bodyTemplate
        }
      });

      // 根据AI错误类型提供更具体的错误信息
      let errorMessage = '生成初始化数据失败';
      if (aiError.message?.includes('timeout') || aiError.code === 'ETIMEDOUT') {
        errorMessage = 'AI API调用超时，请检查网络连接或稍后重试';
      } else if (aiError.message?.includes('401') || aiError.message?.includes('Unauthorized')) {
        errorMessage = 'API密钥无效，请检查AI API配置';
      } else if (aiError.message?.includes('404')) {
        errorMessage = 'API端点不存在，请检查端点地址配置';
      } else if (aiError.message?.includes('429')) {
        errorMessage = 'API调用频率超限，请稍后重试';
      } else if (aiError.message?.includes('500')) {
        errorMessage = 'AI服务器内部错误，请稍后重试';
      } else if (aiError.message) {
        errorMessage = aiError.message;
      }

      throw new AppError(errorMessage, 500);
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/game/:roomId/save-init
 * 保存游戏初始化数据
 */
router.post('/:roomId/save-init', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId;
    const { roomId } = req.params;
    if (!userId) throw new AppError('Unauthorized', 401);

    await ensureRoomHost(roomId, userId);

    const initData = req.body;
    if (!initData || !initData.backgroundStory || !initData.entities) {
      throw new AppError('初始化数据不完整', 400);
    }

    // 保存到 Redis（临时存储，游戏开始时会写入数据库）
    const key = `game:init:${roomId}`;
    await redis.set(key, JSON.stringify(initData), 'EX', 86400); // 24小时过期

    logger.info(`Game init data saved for room ${roomId}`);

    res.json({
      code: 200,
      message: '初始化数据已保存',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/game/:roomId/init
 * 获取已保存的游戏初始化数据
 */
router.get('/:roomId/init', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId;
    const { roomId } = req.params;
    if (!userId) throw new AppError('Unauthorized', 401);

    await ensureRoomMembership(roomId, userId);

    const key = `game:init:${roomId}`;
    const data = await redis.get(key);

    if (!data) {
      res.json({
        code: 200,
        data: null,
      });
      return;
    }

    res.json({
      code: 200,
      data: JSON.parse(data),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/game/:roomId/start
 * 开始游戏，创建或返回当前房间的 GameSession
 */
router.post('/:roomId/start', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId;
    const { roomId } = req.params;
    if (!userId) throw new AppError('Unauthorized', 401);

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new AppError('房间不存在', 404);
    if (room.hostId !== userId) throw new AppError('只有房主可以开始游戏', 403);

    const hostConfig = await prisma.hostConfig.findUnique({ where: { roomId } });
    if (!hostConfig || !hostConfig.initializationCompleted) {
      throw new AppError('主持人配置未完成，无法开始游戏', 400);
    }

    // 从 Redis 获取游戏初始化数据
    const initKey = `game:init:${roomId}`;
    const initDataStr = await redis.get(initKey);
    let gameInitData: any = null;
    if (initDataStr) {
      try {
        gameInitData = JSON.parse(initDataStr);
        logger.info(`Loaded game init data for room ${roomId} at game start`, {
          hasBackgroundStory: !!gameInitData?.backgroundStory,
          entitiesCount: gameInitData?.entities?.length || 0,
          hasHexagram: !!gameInitData?.yearlyHexagram,
        });
      } catch (e) {
        logger.warn(`Failed to parse game init data for room ${roomId}`, { error: e });
      }
    }

    // 检查初始化数据是否存在且完整
    if (!gameInitData || !gameInitData.backgroundStory || !gameInitData.entities || gameInitData.entities.length === 0) {
      throw new AppError('游戏初始化数据不存在或已过期，请主持人重新生成并保存初始化数据', 400);
    }

    // 构建初始 gameState（包含初始化数据）
    const initialGameState = gameInitData ? {
      backgroundStory: gameInitData.backgroundStory,
      entities: gameInitData.entities,
      yearlyHexagram: gameInitData.yearlyHexagram,
      initialOptions: gameInitData.initialOptions,
      cashFormula: gameInitData.cashFormula,
      currentHexagram: gameInitData.yearlyHexagram, // 当前卦象初始为年度卦象
      players: gameInitData.entities?.map((entity: any, index: number) => ({
        id: entity.id,
        name: entity.name,
        cash: entity.cash,
        attributes: entity.attributes || {},
        passiveIncome: entity.passiveIncome || 0,
        passiveExpense: entity.passiveExpense || 0,
        backstory: entity.backstory,
        playerIndex: index,
      })) || [],
    } : null;

    // 如果已存在会话且处于进行中，直接返回
    let session = await prisma.gameSession.findUnique({ where: { roomId } });
    const now = new Date();
    const decisionMinutes = hostConfig.decisionTimeLimit || 4;
    const deadline = new Date(now.getTime() + decisionMinutes * 60 * 1000);

    if (!session) {
      session = await prisma.gameSession.create({
        data: {
          roomId,
          currentRound: 1,
          roundStatus: 'decision',
          status: 'playing',
          decisionDeadline: deadline,
          gameState: initialGameState as any, // 写入初始化数据
        },
      });
    } else if (session.status === 'finished') {
      // 游戏已结束，重新开始新游戏
      // 1. 清理旧的推演结果（Redis）
      const oldSessionId = session.id;
      for (let round = 1; round <= session.currentRound; round++) {
        const resultKey = `inference:result:${oldSessionId}:${round}`;
        const progressKey = `inference:progress:${oldSessionId}:${round}`;
        await redis.del(resultKey);
        await redis.del(progressKey);
      }
      
      // 2. 清理旧的玩家决策
      await prisma.playerAction.deleteMany({
        where: { sessionId: oldSessionId },
      });
      
      // 3. 清理旧的临时事件
      await prisma.temporaryEvent.deleteMany({
        where: { sessionId: oldSessionId },
      });

      // 4. 清理 AI 对话历史
      await prisma.aIConversationHistory.deleteMany({
        where: { sessionId: oldSessionId },
      });

      // 5. 重置会话状态，重新开始
      session = await prisma.gameSession.update({
        where: { id: session.id },
        data: {
          currentRound: 1,
          roundStatus: 'decision',
          status: 'playing',
          decisionDeadline: deadline,
          gameState: initialGameState as any, // 重新写入初始化数据
          updatedAt: now,
        },
      });

      logger.info(`Game restarted for room ${roomId}`, {
        sessionId: session.id,
        previousRound: session.currentRound,
      });
    } else if (session.status !== 'playing') {
      // 暂停状态，继续游戏
      session = await prisma.gameSession.update({
        where: { id: session.id },
        data: {
          status: 'playing',
          roundStatus: 'decision',
          decisionDeadline: deadline,
          ...(session.gameState ? {} : { gameState: initialGameState as any }),
        },
      });
    } else {
      // 会话已存在且正在进行中，检查是否需要更新 deadline
      // 如果当前是决策阶段且 deadline 已过期或为空，则更新 deadline
      if (session.roundStatus === 'decision') {
        const currentDeadline = session.decisionDeadline ? new Date(session.decisionDeadline) : null;
        if (!currentDeadline || currentDeadline < now) {
          // deadline 已过期或为空，更新为新的 deadline
          session = await prisma.gameSession.update({
            where: { id: session.id },
            data: {
              decisionDeadline: deadline,
            },
          });
        }
      }
    }

    // 标记房间状态为 playing
    if (room.status !== 'playing') {
      await prisma.room.update({
        where: { id: roomId },
        data: { status: 'playing', startedAt: now },
      });
    }

    // 通过 WebSocket 广播回合阶段变化和游戏状态
    io.to(roomId).emit('round_stage_changed', {
      sessionId: session.id,
      round: session.currentRound,
      stage: session.roundStatus,
    });
    io.to(roomId).emit('game_state_update', {
      roomId,
      sessionId: session.id,
      currentRound: session.currentRound,
      roundStatus: session.roundStatus,
      decisionDeadline: session.decisionDeadline,
      status: session.status,
    });
    // 发送游戏开始事件，通知所有玩家跳转
    io.to(roomId).emit('game_started', {
      roomId,
      sessionId: session.id,
      currentRound: session.currentRound,
      roundStatus: session.roundStatus,
    });

    res.json({
      code: 200,
      message: '游戏已开始',
      data: {
        session: {
          id: session.id,
          roomId,
          currentRound: session.currentRound,
          roundStatus: session.roundStatus,
          decisionDeadline: session.decisionDeadline,
          status: session.status,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/game/by-room/:roomId/active-session
 * 根据房间ID获取当前进行中的游戏会话（用于“继续游戏”入口）
 */
router.get(
  '/by-room/:roomId/active-session',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      if (!userId) throw new AppError('Unauthorized', 401);

      const { roomId } = req.params;

      const room = await prisma.room.findUnique({ where: { id: roomId } });
      if (!room) {
        throw new AppError('房间不存在', 404);
      }

      // 允许之前参与过游戏的玩家继续游戏（即使他们暂时离开了房间）
      // 只要他们在 roomPlayer 表中有记录，就允许继续游戏
      const membership = await prisma.roomPlayer.findFirst({
        where: {
          roomId,
          userId,
        },
      });
      if (!membership) {
        throw new AppError('你当前不在该房间中，无法继续游戏', 403);
      }
      
      // 如果玩家之前离开了房间，自动将其状态更新为 joined，允许重新参与
      // 注意：这里只更新状态，不更新 currentPlayers，因为玩家应该通过 /api/rooms/:roomId/join 重新加入
      // 但如果玩家直接访问游戏会话页面，我们也允许他们继续游戏
      if (membership.status === 'left') {
        await prisma.roomPlayer.update({
          where: { id: membership.id },
          data: { status: 'joined' },
        });
        // 同步更新房间人数（因为之前离开时已经减过了）
        await prisma.room.update({
          where: { id: roomId },
          data: { currentPlayers: { increment: 1 } },
        });
      }

      const session = await prisma.gameSession.findUnique({
        where: { roomId },
      });

      if (!session || session.status !== 'playing') {
        throw new AppError('当前房间没有正在进行的对局', 404);
      }

      res.json({
        code: 200,
        data: {
          sessionId: session.id,
          roomId: session.roomId,
          currentRound: session.currentRound,
          roundStatus: session.roundStatus,
          decisionDeadline: session.decisionDeadline,
          status: session.status,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/game/history
 * 获取游戏历史记录列表（当前用户参与的）
 * 注意：必须在 /:sessionId 之前定义，避免路由冲突
 */
router.get(
  '/history',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      if (!userId) throw new AppError('Unauthorized', 401);

      const { page = 1, limit = 10, status } = req.query;
      const pageNum = Number(page) || 1;
      const limitNum = Number(limit) || 10;
      const skip = (pageNum - 1) * limitNum;

      // 获取用户参与的所有游戏会话（通过RoomPlayer关联）
      const where: any = {
        room: {
          players: {
            some: {
              userId,
              status: { not: 'left' },
            },
          },
        },
      };

      if (status) {
        where.status = status;
      }

      const [sessions, total] = await Promise.all([
        prisma.gameSession.findMany({
          where,
          include: {
            room: {
              include: {
                host: {
                  select: {
                    id: true,
                    username: true,
                    nickname: true,
                  },
                },
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip,
          take: limitNum,
        }),
        prisma.gameSession.count({ where }),
      ]);

      const history = sessions.map(session => ({
        id: session.id,
        sessionId: session.id,
        roomId: session.roomId,
        roomName: session.room.name,
        hostName: session.room.host.nickname || session.room.host.username,
        currentRound: session.currentRound,
        totalRounds: session.totalRounds,
        status: session.status,
        roundStatus: session.roundStatus,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
        finishedAt: session.status === 'finished' ? session.updatedAt : null,
      }));

      res.json({
        code: 200,
        data: {
          history,
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
 * GET /api/game/history/statistics
 * 获取游戏历史统计
 * 注意：必须在 /history/:sessionId 之前定义
 */
router.get(
  '/history/statistics',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      if (!userId) throw new AppError('Unauthorized', 401);

      // 获取用户参与的所有游戏会话
      const allSessions = await prisma.gameSession.findMany({
        where: {
          room: {
            players: {
              some: {
                userId,
                status: { not: 'left' },
              },
            },
          },
        },
        include: {
          room: true,
        },
      });

      const totalGames = allSessions.length;
      const finishedGames = allSessions.filter(s => s.status === 'finished').length;
      const playingGames = allSessions.filter(s => s.status === 'playing').length;
      const totalRounds = allSessions.reduce((sum, s) => sum + s.currentRound, 0);
      const averageRounds = totalGames > 0 ? (totalRounds / totalGames).toFixed(2) : 0;

      // 按状态统计
      const byStatus = {
        finished: finishedGames,
        playing: playingGames,
        paused: allSessions.filter(s => s.status === 'paused').length,
      };

      // 按月份统计（最近6个月）
      const monthlyStats: Record<string, number> = {};
      const now = new Date();
      for (let i = 5; i >= 0; i--) {
        const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        monthlyStats[monthKey] = allSessions.filter(s => {
          const sessionDate = new Date(s.createdAt);
          return (
            sessionDate.getFullYear() === date.getFullYear() &&
            sessionDate.getMonth() === date.getMonth()
          );
        }).length;
      }

      res.json({
        code: 200,
        data: {
          totalGames,
          finishedGames,
          playingGames,
          totalRounds,
          averageRounds: Number(averageRounds),
          byStatus,
          monthlyStats,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/game/history/:sessionId
 * 获取游戏历史详情
 */
router.get(
  '/history/:sessionId',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { sessionId } = req.params;
      if (!userId) throw new AppError('Unauthorized', 401);

      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: {
          room: {
            include: {
              host: {
                select: {
                  id: true,
                  username: true,
                  nickname: true,
                },
              },
              hostConfig: true,
            },
          },
          actions: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  nickname: true,
                },
              },
            },
            orderBy: [{ round: 'asc' }, { submittedAt: 'asc' }],
          },
          events: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!session) throw new AppError('游戏历史不存在', 404);

      // 检查用户是否参与过此游戏
      const membership = await prisma.roomPlayer.findFirst({
        where: {
          roomId: session.roomId,
          userId,
        },
      });
      if (!membership) {
        throw new AppError('您未参与此游戏', 403);
      }

      // 获取所有回合的推演结果
      const roundResults: Array<{
        round: number;
        status: string;
        result?: any;
        completedAt?: string;
      }> = [];

      for (let round = 1; round <= session.currentRound; round++) {
        const resultKey = `inference:result:${sessionId}:${round}`;
        const resultData = await redis.get(resultKey);
        
        if (resultData) {
          const result = JSON.parse(resultData);
          roundResults.push({
            round,
            status: result.status,
            result: result.result,
            completedAt: result.completedAt,
          });
        }
      }

      res.json({
        code: 200,
        data: {
          id: session.id,
          sessionId: session.id,
          roomId: session.roomId,
          roomName: session.room.name,
          hostName: session.room.host.nickname || session.room.host.username,
          currentRound: session.currentRound,
          totalRounds: session.totalRounds,
          status: session.status,
          roundStatus: session.roundStatus,
          gameState: session.gameState,
          roundResults,
          actions: session.actions,
          events: session.events,
          gameRules: session.room.hostConfig?.gameRules,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          finishedAt: session.status === 'finished' ? session.updatedAt : null,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/game/history/batch
 * 批量删除游戏历史
 * 注意：必须在 /history/:sessionId 之前定义，避免路由冲突
 */
router.delete(
  '/history/batch',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { sessionIds } = req.body || {};
      if (!userId) throw new AppError('Unauthorized', 401);

      if (!Array.isArray(sessionIds) || sessionIds.length === 0) {
        throw new AppError('请提供要删除的游戏历史ID列表', 400);
      }

      // 获取所有会话并验证权限
      const sessions = await prisma.gameSession.findMany({
        where: {
          id: { in: sessionIds },
        },
        include: { room: true },
      });

      // 验证用户是每个游戏的主持人
      for (const session of sessions) {
        await ensureRoomHost(session.roomId, userId);
      }

      // 删除推演结果（Redis）
      for (const session of sessions) {
        for (let round = 1; round <= session.currentRound; round++) {
          await redis.del(`inference:result:${session.id}:${round}`);
          await redis.del(`inference:task:${session.id}:${round}`);
        }
      }

      // 批量删除游戏会话
      await prisma.gameSession.deleteMany({
        where: {
          id: { in: sessionIds },
        },
      });

      res.json({
        code: 200,
        message: `已删除 ${sessions.length} 条游戏历史`,
        data: {
          deletedCount: sessions.length,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/game/history/:sessionId
 * 删除游戏历史（仅主持人可删除）
 */
router.delete(
  '/history/:sessionId',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { sessionId } = req.params;
      if (!userId) throw new AppError('Unauthorized', 401);

      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: { room: true },
      });

      if (!session) throw new AppError('游戏历史不存在', 404);

      // 只有主持人可以删除
      await ensureRoomHost(session.roomId, userId);

      // 删除推演结果（Redis）
      for (let round = 1; round <= session.currentRound; round++) {
        await redis.del(`inference:result:${sessionId}:${round}`);
        await redis.del(`inference:task:${sessionId}:${round}`);
      }

      // 删除游戏会话（级联删除相关数据）
      await prisma.gameSession.delete({
        where: { id: sessionId },
      });

      res.json({
        code: 200,
        message: '游戏历史已删除',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/game/:sessionId
 * 获取会话基本信息
 */
router.get('/:sessionId', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId;
    const { sessionId } = req.params;
    if (!userId) throw new AppError('Unauthorized', 401);

    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: { room: true },
    });
    if (!session) throw new AppError('游戏会话不存在', 404);

    // 确认用户在房间中
    await ensureRoomMembership(session.roomId, userId);

    // 获取游戏规则（从房间的 hostConfig）
    const hostConfig = await prisma.hostConfig.findUnique({
      where: { roomId: session.roomId },
      select: { gameRules: true },
    });

    res.json({
      code: 200,
      data: {
        sessionId: session.id,
        roomId: session.roomId,
        hostId: session.room.hostId, // 添加hostId，方便前端判断是否是主持人
        currentRound: session.currentRound,
        roundStatus: session.roundStatus,
        decisionDeadline: session.decisionDeadline,
        status: session.status,
        gameRules: hostConfig?.gameRules || null, // 添加游戏规则
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/game/:sessionId/round/:round/decision-options
 * 获取AI生成的决策选项
 */
router.get(
  '/:sessionId/round/:round/decision-options',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { sessionId, round } = req.params;
      const roundNum = parseInt(round, 10);

      if (!userId) throw new AppError('Unauthorized', 401);
      if (isNaN(roundNum) || roundNum < 1) {
        throw new AppError('Invalid round number', 400);
      }

      // Verify session exists
      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: {
          room: {
            include: {
              hostConfig: true,
            },
          },
        },
      });

      if (!session) throw new AppError('游戏会话不存在', 404);

      // Verify user is in room
      const membership = await ensureRoomMembership(session.roomId, userId);

      // Verify session is in decision phase
      if (session.roundStatus !== 'decision') {
        throw new AppError('当前阶段不允许获取决策选项', 400);
      }

      // Get host config
      const hostConfig = session.room.hostConfig;
      if (!hostConfig || !hostConfig.apiEndpoint) {
        throw new AppError('AI配置未完成，无法生成决策选项', 400);
      }

      // Get current user info
      const currentUser = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          username: true,
          nickname: true,
        },
      });

      // Get player's previous actions
      const playerActions = await prisma.playerAction.findMany({
        where: {
          sessionId,
          userId,
          round: { lt: roundNum },
        },
        orderBy: { round: 'desc' },
        take: 3,
      });

      // Get other players info
      const roomPlayers = await prisma.roomPlayer.findMany({
        where: {
          roomId: session.roomId,
          status: { not: 'left' },
          userId: { not: userId },
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nickname: true,
            },
          },
        },
      });

      // Get active events
      const activeEvents = await prisma.temporaryEvent.findMany({
        where: {
          sessionId,
          round: { lte: roundNum },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Get game state
      const gameState = session.gameState as Record<string, unknown> | null;

      // Prepare AI config
      const aiConfig: AIConfig = {
        provider: hostConfig.apiProvider || null,
        endpoint: hostConfig.apiEndpoint || null,
        headers: (hostConfig.apiHeaders as Record<string, unknown>) || null,
        bodyTemplate: (hostConfig.apiBodyTemplate as Record<string, unknown>) || null,
      };

      // Generate options
      const options = await aiService.generateDecisionOptions(
        aiConfig,
        hostConfig.gameRules || '',
        gameState,
        {
          playerIndex: membership.playerIndex || 0,
          username: currentUser?.username || req.username || 'Unknown',
          nickname: currentUser?.nickname || undefined,
          recentDecisions: playerActions.map(action => ({
            round: action.round,
            actionText: action.actionText || undefined,
          })),
        },
        roomPlayers.map(rp => ({
          playerIndex: rp.playerIndex || 0,
          username: rp.user.username,
          resources: undefined, // Can be extended with actual resource data
          attributes: undefined, // Can be extended with actual attribute data
        })),
        activeEvents.map(event => ({
          eventType: event.eventType,
          eventContent: event.eventContent,
          effectiveRounds: event.effectiveRounds,
        }))
      );

      res.json({
        code: 200,
        data: {
          round: roundNum,
          options: options,
          generatedAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/game/:sessionId/decision
 * 提交当前回合决策
 */
router.post('/:sessionId/decision', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId;
    const { sessionId } = req.params;
    if (!userId) throw new AppError('Unauthorized', 401);

    const { round, actionText, selectedOptionIds, actionType, actionData } = req.body || {};

    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
    });
    if (!session) throw new AppError('游戏会话不存在', 404);

    const effectiveRound = typeof round === 'number' && round > 0 ? round : session.currentRound;

    // 校验用户在房间中
    const membership = await ensureRoomMembership(session.roomId, userId);

    logger.info(`Decision submission received`, {
      sessionId,
      userId,
      round: effectiveRound,
      hasActionText: !!actionText,
      hasSelectedOptions: !!selectedOptionIds,
      hasActionData: !!actionData,
      actionType: actionType || 'none',
    });

    if (session.status !== 'playing') {
      throw new AppError('当前会话未处于进行中状态，无法提交决策', 400);
    }
    if (session.roundStatus !== 'decision') {
      throw new AppError('当前阶段不允许提交决策', 400);
    }

    const now = new Date();
    if (session.decisionDeadline && now > session.decisionDeadline) {
      throw new AppError('当前回合决策已超时', 400);
    }

    if (!actionText && !actionData && !selectedOptionIds) {
      throw new AppError('决策内容不能为空', 400);
    }

    const existing = await prisma.playerAction.findFirst({
      where: {
        sessionId,
        userId,
        round: effectiveRound,
      },
    });

    const payloadData: any = {
      selectedOptionIds: selectedOptionIds ?? undefined,
      actionText: actionText ?? '',
      actionType: actionType ?? null,
      actionData: actionData ?? null,
      status: 'submitted',
      submittedAt: now,
    };

    let action;
    if (existing) {
      logger.info(`Updating existing decision`, {
        sessionId,
        userId,
        round: effectiveRound,
        actionId: existing.id,
      });
      action = await prisma.playerAction.update({
        where: { id: existing.id },
        data: payloadData,
      });
    } else {
      logger.info(`Creating new decision`, {
        sessionId,
        userId,
        round: effectiveRound,
        playerIndex: membership.playerIndex ?? 0,
      });
      action = await prisma.playerAction.create({
        data: {
          sessionId,
          userId,
          playerIndex: membership.playerIndex ?? 0,
          round: effectiveRound,
          selectedOptionIds: selectedOptionIds ?? null,
          actionText: actionText ?? '',
          actionType: actionType ?? null,
          actionData: actionData ?? null,
          status: 'submitted',
        },
      });
    }

    logger.info(`Decision submitted successfully`, {
      sessionId,
      userId,
      round: effectiveRound,
      actionId: action.id,
      status: action.status,
    });

    // 通知房间内其他玩家决策状态更新
    io.to(session.roomId).emit('decision_status_update', {
      sessionId,
      userId,
      round: effectiveRound,
      status: action.status,
    });

    res.json({
      code: 200,
      message: '决策已提交',
      data: {
        id: action.id,
        sessionId: action.sessionId,
        userId: action.userId,
        round: action.round,
        status: action.status,
        submittedAt: action.submittedAt,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/game/:sessionId/start-review
 * 进入审核阶段（主持人专用）
 */
router.post('/:sessionId/start-review', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId;
    const { sessionId } = req.params;
    if (!userId) throw new AppError('Unauthorized', 401);

    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: { room: true },
    });
    if (!session) throw new AppError('游戏会话不存在', 404);

    // 确保用户是主持人
    await ensureRoomHost(session.roomId, userId);

    // 确保当前阶段是 decision
    if (session.roundStatus !== 'decision') {
      throw new AppError(`当前阶段是 ${session.roundStatus}，无法进入审核阶段`, 400);
    }

    // 更新为 review 阶段
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        roundStatus: 'review',
      },
    });

    // 广播阶段切换通知
    io.to(session.roomId).emit('round_stage_changed', {
      sessionId,
      round: session.currentRound,
      stage: 'review',
    });

    // 同步游戏状态给所有客户端（玩家页面依赖 game_state_update）
    io.to(session.roomId).emit('game_state_update', {
      roomId: session.roomId,
      sessionId,
      currentRound: session.currentRound,
      roundStatus: 'review',
      decisionDeadline: session.decisionDeadline,
      status: session.status,
    });

    io.to(session.roomId).emit('stage_changed', {
      sessionId,
      round: session.currentRound,
      stage: 'review',
      previousStage: 'decision',
    });

    logger.info(`Game session ${sessionId} entered review phase`, {
      sessionId,
      round: session.currentRound,
      userId,
    });

    res.json({
      code: 200,
      message: '已进入审核阶段',
      data: {
        sessionId,
        round: session.currentRound,
        roundStatus: 'review',
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/game/:sessionId/round/:round/decisions
 * 获取某一回合的所有决策状态
 */
router.get(
  '/:sessionId/round/:round/decisions',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { sessionId, round } = req.params;
      if (!userId) throw new AppError('Unauthorized', 401);

      const roundNumber = Number(round);
      if (!Number.isFinite(roundNumber) || roundNumber <= 0) {
        throw new AppError('无效的回合号', 400);
      }

      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
      });
      if (!session) throw new AppError('游戏会话不存在', 404);

      await ensureRoomMembership(session.roomId, userId);

      const actions = await prisma.playerAction.findMany({
        where: {
          sessionId,
          round: roundNumber,
        },
        orderBy: { submittedAt: 'asc' },
      });

      const now = new Date();
      const isTimeout = !!(session.decisionDeadline && now > session.decisionDeadline);

      res.json({
        code: 200,
        data: {
          sessionId,
          round: roundNumber,
          decisionDeadline: session.decisionDeadline,
          timedOut: isTimeout,
          actions: actions.map(action => ({
            id: action.id,
            userId: action.userId,
            playerIndex: action.playerIndex,
            status: action.status,
            submittedAt: action.submittedAt,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/game/:sessionId/round/:round/decisions/review
 * 获取审核决策列表（主持人专用）
 */
router.get(
  '/:sessionId/round/:round/decisions/review',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { sessionId, round } = req.params;
      if (!userId) throw new AppError('Unauthorized', 401);

      const roundNumber = Number(round);
      if (!Number.isFinite(roundNumber) || roundNumber <= 0) {
        throw new AppError('无效的回合号', 400);
      }

      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: { room: true },
      });
      if (!session) throw new AppError('游戏会话不存在', 404);

      // 确保用户是主持人
      await ensureRoomHost(session.roomId, userId);

      // 获取所有决策，包含详细信息
      const actions = await prisma.playerAction.findMany({
        where: {
          sessionId,
          round: roundNumber,
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nickname: true,
            },
          },
        },
        orderBy: { submittedAt: 'asc' },
      });

      const now = new Date();
      const isTimeout = !!(session.decisionDeadline && now > session.decisionDeadline);

      res.json({
        code: 200,
        data: {
          sessionId,
          round: roundNumber,
          decisionDeadline: session.decisionDeadline,
          timedOut: isTimeout,
          actions: actions.map(action => ({
            id: action.id,
            userId: action.userId,
            playerIndex: action.playerIndex,
            username: action.user.username,
            nickname: action.user.nickname,
            actionText: action.actionText,
            selectedOptionIds: action.selectedOptionIds,
            actionType: action.actionType,
            actionData: action.actionData,
            status: action.status,
            hostModified: action.hostModified,
            hostModification: action.hostModification,
            submittedAt: action.submittedAt,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/game/:sessionId/round/:round/temporary-event
 * 添加临时事件（主持人专用）
 */
router.post(
  '/:sessionId/round/:round/temporary-event',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { sessionId, round } = req.params;
      if (!userId) throw new AppError('Unauthorized', 401);

      const { eventType, eventContent, effectiveRounds } = req.body || {};

      if (!eventType || !eventContent) {
        throw new AppError('事件类型和内容不能为空', 400);
      }

      if (eventType !== 'single_round' && eventType !== 'multi_round') {
        throw new AppError('事件类型必须是 single_round 或 multi_round', 400);
      }

      const roundNumber = Number(round);
      if (!Number.isFinite(roundNumber) || roundNumber <= 0) {
        throw new AppError('无效的回合号', 400);
      }

      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: { room: true },
      });
      if (!session) throw new AppError('游戏会话不存在', 404);

      // 确保用户是主持人
      await ensureRoomHost(session.roomId, userId);

      // 确保当前阶段是 review
      if (session.roundStatus !== 'review') {
        throw new AppError('当前阶段不是审核阶段，无法添加临时事件', 400);
      }

      const effectiveRoundsNum = eventType === 'multi_round' 
        ? (Number(effectiveRounds) || 1)
        : 1;

      const event = await prisma.temporaryEvent.create({
        data: {
          sessionId,
          round: roundNumber,
          eventType,
          eventContent,
          effectiveRounds: effectiveRoundsNum,
          progress: eventType === 'multi_round' ? { current: roundNumber, total: effectiveRoundsNum } : {},
          createdBy: userId,
        },
      });

      // 广播临时事件添加通知
      io.to(session.roomId).emit('temporary_event_added', {
        sessionId,
        round: roundNumber,
        eventId: event.id,
        eventType: event.eventType,
        eventContent: event.eventContent,
      });

      res.json({
        code: 200,
        message: '临时事件已添加',
        data: {
          id: event.id,
          sessionId: event.sessionId,
          round: event.round,
          eventType: event.eventType,
          eventContent: event.eventContent,
          effectiveRounds: event.effectiveRounds,
          progress: event.progress,
          createdAt: event.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/game/:sessionId/round/:round/temporary-rule
 * 添加临时规则（主持人专用）
 * 注意：临时规则也使用 TemporaryEvent 存储，eventType 为 'rule'
 */
router.post(
  '/:sessionId/round/:round/temporary-rule',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { sessionId, round } = req.params;
      if (!userId) throw new AppError('Unauthorized', 401);

      const { ruleContent, effectiveRounds } = req.body || {};

      if (!ruleContent) {
        throw new AppError('规则内容不能为空', 400);
      }

      const roundNumber = Number(round);
      if (!Number.isFinite(roundNumber) || roundNumber <= 0) {
        throw new AppError('无效的回合号', 400);
      }

      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: { room: true },
      });
      if (!session) throw new AppError('游戏会话不存在', 404);

      // 确保用户是主持人
      await ensureRoomHost(session.roomId, userId);

      // 确保当前阶段是 review
      if (session.roundStatus !== 'review') {
        throw new AppError('当前阶段不是审核阶段，无法添加临时规则', 400);
      }

      const effectiveRoundsNum = Number(effectiveRounds) || 1;

      // 使用 TemporaryEvent 存储规则，eventType 为 'rule'
      const rule = await prisma.temporaryEvent.create({
        data: {
          sessionId,
          round: roundNumber,
          eventType: 'rule', // 使用 'rule' 作为规则类型
          eventContent: ruleContent,
          effectiveRounds: effectiveRoundsNum,
          progress: { current: roundNumber, total: effectiveRoundsNum },
          createdBy: userId,
        },
      });

      // 广播临时规则添加通知
      io.to(session.roomId).emit('temporary_rule_added', {
        sessionId,
        round: roundNumber,
        ruleId: rule.id,
        ruleContent: rule.eventContent,
      });

      res.json({
        code: 200,
        message: '临时规则已添加',
        data: {
          id: rule.id,
          sessionId: rule.sessionId,
          round: rule.round,
          ruleContent: rule.eventContent,
          effectiveRounds: rule.effectiveRounds,
          createdAt: rule.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/game/:sessionId/round/:round/submit-to-ai
 * 提交给AI推演（主持人专用）
 */
router.post(
  '/:sessionId/round/:round/submit-to-ai',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { sessionId, round } = req.params;
      if (!userId) throw new AppError('Unauthorized', 401);

      const roundNumber = Number(round);
      if (!Number.isFinite(roundNumber) || roundNumber <= 0) {
        throw new AppError('无效的回合号', 400);
      }

      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: {
          room: {
            include: {
              hostConfig: true,
            },
          },
        },
      });
      if (!session) throw new AppError('游戏会话不存在', 404);

      // 确保用户是主持人
      await ensureRoomHost(session.roomId, userId);

      // 确保当前阶段是 review
      if (session.roundStatus !== 'review') {
        throw new AppError('当前阶段不是审核阶段，无法提交推演', 400);
      }

      const hostConfig = session.room.hostConfig;
      if (!hostConfig || !hostConfig.apiEndpoint) {
        throw new AppError('主持人配置未完成，无法提交推演', 400);
      }

      // 验证API配置
      logger.info(`Submitting to AI for session ${sessionId}, round ${roundNumber}`, {
        endpoint: hostConfig.apiEndpoint,
        provider: hostConfig.apiProvider,
        hasHeaders: !!hostConfig.apiHeaders,
        hasBodyTemplate: !!hostConfig.apiBodyTemplate,
      });

      // 获取所有决策
      const actions = await prisma.playerAction.findMany({
        where: {
          sessionId,
          round: roundNumber,
          status: { in: ['submitted', 'reviewed'] },
        },
        include: {
          user: {
            select: {
              id: true,
              username: true,
              nickname: true,
            },
          },
        },
        orderBy: { submittedAt: 'asc' },
      });

      logger.info(`Found ${actions.length} decisions for session ${sessionId}, round ${roundNumber}`, {
        actions: actions.map(a => ({
          playerIndex: a.playerIndex,
          username: a.user.username,
          hasActionText: !!a.actionText,
          hasSelectedOptions: !!a.selectedOptionIds,
        })),
      });

      // 获取活跃的多回合事件及其进度
      const activeEvents = await prisma.temporaryEvent.findMany({
        where: {
          sessionId,
          eventType: { in: ['multi_round', 'rule'] },
          completedAt: null,
        },
        orderBy: { createdAt: 'asc' },
      });

      // 从 Redis 获取游戏初始化数据
      const initKey = `game:init:${session.roomId}`;
      const initDataStr = await redis.get(initKey);
      let gameInitData = null;
      if (initDataStr) {
        try {
          gameInitData = JSON.parse(initDataStr);
          logger.info(`Loaded game init data for room ${session.roomId}`, {
            hasBackgroundStory: !!gameInitData?.backgroundStory,
            entitiesCount: gameInitData?.entities?.length || 0,
            hasHexagram: !!gameInitData?.yearlyHexagram,
          });
        } catch (e) {
          logger.warn(`Failed to parse game init data for room ${session.roomId}`, { error: e });
        }
      } else {
        logger.warn(`No game init data found for room ${session.roomId}`);
      }

      // 构建推演数据
      const inferenceData = {
        sessionId,
        round: roundNumber,
        decisions: actions.map(action => ({
          playerIndex: action.playerIndex,
          username: action.user.username,
          nickname: action.user.nickname,
          actionText: action.actionText,
          selectedOptionIds: action.selectedOptionIds,
          actionType: action.actionType,
          actionData: action.actionData,
          hostModified: action.hostModified,
          hostModification: action.hostModification,
        })),
        activeEvents: activeEvents.map(event => ({
          id: event.id,
          eventType: event.eventType,
          eventContent: event.eventContent,
          effectiveRounds: event.effectiveRounds,
          progress: event.progress,
          round: event.round,
        })),
        gameRules: hostConfig.gameRules || '',
        currentRound: session.currentRound,
        // 传入游戏初始化数据（主体名称、背景故事、卦象等）
        gameInitData: gameInitData ? {
          backgroundStory: gameInitData.backgroundStory,
          entities: gameInitData.entities,
          yearlyHexagram: gameInitData.yearlyHexagram,
        } : undefined,
      };

      // 更新会话状态为 inference
      await prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          roundStatus: 'inference',
        },
      });

      // 广播推演开始通知
      io.to(session.roomId).emit('inference_started', {
        sessionId,
        round: roundNumber,
        inferenceData,
      });

      // 异步执行AI推演（不阻塞响应）
      const aiConfig = {
        provider: hostConfig.apiProvider || null,
        endpoint: hostConfig.apiEndpoint,
        headers: (hostConfig.apiHeaders && typeof hostConfig.apiHeaders === 'object') 
          ? (hostConfig.apiHeaders as Record<string, unknown>) 
          : null,
        bodyTemplate: (hostConfig.apiBodyTemplate && typeof hostConfig.apiBodyTemplate === 'object')
          ? (hostConfig.apiBodyTemplate as Record<string, unknown>)
          : null,
      };

      // 验证配置完整性
      if (!aiConfig.endpoint) {
        throw new AppError('API端点未配置', 400);
      }

      logger.info(`AI Config prepared for session ${sessionId}, round ${roundNumber}`, {
        endpoint: aiConfig.endpoint,
        provider: aiConfig.provider,
        hasHeaders: !!aiConfig.headers,
        hasBodyTemplate: !!aiConfig.bodyTemplate,
        headersKeys: aiConfig.headers ? Object.keys(aiConfig.headers) : [],
        bodyTemplateKeys: aiConfig.bodyTemplate ? Object.keys(aiConfig.bodyTemplate) : [],
      });

      // 将推演任务加入Redis队列（异步处理）
      const inferenceTask = {
        sessionId,
        round: roundNumber,
        roomId: session.roomId,
        inferenceData: inferenceData as InferenceRequest,
        aiConfig,
        createdAt: new Date().toISOString(),
      };

      // 使用Redis存储推演任务
      await redis.setex(
        `inference:task:${sessionId}:${roundNumber}`,
        3600, // 1小时过期
        JSON.stringify(inferenceTask)
      );

      // 立即启动异步推演（不等待完成）
      performInferenceAsync(sessionId, roundNumber, session.roomId, inferenceData as InferenceRequest, aiConfig).catch(
        error => {
          logger.error(`Async inference failed for session ${sessionId}, round ${roundNumber}:`, error);
          // 广播推演失败通知
          io.to(session.roomId).emit('inference_failed', {
            sessionId,
            round: roundNumber,
            error: error.message || '推演失败',
          });
        }
      );

      res.json({
        code: 200,
        message: '已提交给AI推演，正在处理中...',
        data: {
          sessionId,
          round: roundNumber,
          status: 'processing',
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/game/:sessionId/round/:round/inference-result
 * 获取推演结果
 */
router.get(
  '/:sessionId/round/:round/inference-result',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { sessionId, round } = req.params;
      if (!userId) throw new AppError('Unauthorized', 401);

      const roundNumber = Number(round);
      if (!Number.isFinite(roundNumber) || roundNumber <= 0) {
        throw new AppError('无效的回合号', 400);
      }

      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
      });
      if (!session) throw new AppError('游戏会话不存在', 404);

      await ensureRoomMembership(session.roomId, userId);

      // 从Redis获取推演结果
      const resultKey = `inference:result:${sessionId}:${roundNumber}`;
      const resultData = await redis.get(resultKey);

      if (!resultData) {
        // 检查是否还在处理中
        const taskKey = `inference:task:${sessionId}:${roundNumber}`;
        const taskExists = await redis.exists(taskKey);
        
        if (taskExists) {
          return res.json({
            code: 200,
            data: {
              sessionId,
              round: roundNumber,
              status: 'processing',
              message: '推演正在进行中，请稍候...',
            },
          });
        } else {
          throw new AppError('推演结果不存在', 404);
        }
      }

      const result = JSON.parse(resultData);

      return res.json({
        code: 200,
        data: {
          sessionId,
          round: roundNumber,
          status: result.status,
          result: result.result,
          completedAt: result.completedAt,
          error: result.error,
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * 异步执行AI推演
 */
async function performInferenceAsync(
  sessionId: string,
  round: number,
  roomId: string,
  inferenceData: InferenceRequest,
  aiConfig: {
    provider?: string | null;
    endpoint?: string | null;
    headers?: Record<string, unknown> | null;
    bodyTemplate?: Record<string, unknown> | null;
  }
): Promise<void> {
  try {
    // 记录推演开始
    logger.info(`Starting inference for session ${sessionId}, round ${round}`, {
      endpoint: aiConfig.endpoint,
      provider: aiConfig.provider,
      decisionsCount: inferenceData.decisions?.length || 0,
      activeEventsCount: inferenceData.activeEvents?.length || 0,
      hasGameRules: !!inferenceData.gameRules,
    });

    // 验证配置
    if (!aiConfig.endpoint) {
      throw new Error('AI API endpoint not configured');
    }

    // 验证决策数据
    if (!inferenceData.decisions || inferenceData.decisions.length === 0) {
      logger.warn(`No decisions found for session ${sessionId}, round ${round}, proceeding anyway`);
    }

    // 发送推演进度更新
    io.to(roomId).emit('inference_progress', {
      sessionId,
      round,
      progress: 10,
      message: '正在构建推演请求...',
    });

    // 更新多回合事件进度（推演后自动更新）
    await updateEventProgressAfterInference(sessionId, round);

    // 调用AI服务
    logger.info(`Calling AI service for session ${sessionId}, round ${round}`);
    const result = await aiService.performInference(aiConfig, inferenceData);
    logger.info(`AI service returned result for session ${sessionId}, round ${round}`, {
      hasNarrative: !!result.narrative,
      outcomesCount: result.outcomes?.length || 0,
      eventsCount: result.events?.length || 0,
    });

    // 将 AI 原始结果转换为前端 TurnResultDTO（最小可用版本）。
    const uiTurnResult = buildTurnResultDTO(result as any, inferenceData);

    const enhancedResult: any = {
      ...(result as any),
      uiTurnResult,
    };

    // 发送推演进度更新
    io.to(roomId).emit('inference_progress', {
      sessionId,
      round,
      progress: 90,
      message: '正在解析推演结果...',
    });

    // 保存推演结果到Redis
    const resultKey = `inference:result:${sessionId}:${round}`;
    const resultData = {
      sessionId,
      round,
      result: enhancedResult,
      status: 'completed',
      completedAt: new Date().toISOString(),
    };
    await redis.setex(resultKey, 86400, JSON.stringify(resultData)); // 24小时过期

    // 更新会话状态为 result
    const updatedSession = await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        roundStatus: 'result',
        gameState: enhancedResult as any, // 保存推演结果到gameState
      },
      include: {
        room: {
          select: {
            id: true,
            hostId: true,
          },
        },
        actions: {
          where: {
            status: { in: ['submitted', 'reviewed'] },
          },
          include: {
            user: {
              select: {
                id: true,
                username: true,
                nickname: true,
              },
            },
          },
        },
        events: {
          where: {
            completedAt: null,
          },
        },
        trades: {
          where: {
            status: { in: ['pending', 'accepted'] },
          },
        },
      },
    });

    // 自动存档：每回合推演完成后自动保存
    try {
      const autoSaveData = {
        session: {
          id: updatedSession.id,
          roomId: updatedSession.roomId,
          currentRound: updatedSession.currentRound,
          totalRounds: updatedSession.totalRounds,
          roundStatus: updatedSession.roundStatus,
          gameState: updatedSession.gameState,
          status: updatedSession.status,
          decisionDeadline: updatedSession.decisionDeadline,
        },
        actions: updatedSession.actions,
        events: updatedSession.events,
        trades: updatedSession.trades,
        inferenceResults: await Promise.all(
          Array.from({ length: updatedSession.currentRound }, async (_, i) => {
            const roundNum = i + 1;
            const resultKey = `inference:result:${sessionId}:${roundNum}`;
            const resultData = await redis.get(resultKey);
            return resultData ? { round: roundNum, result: JSON.parse(resultData) } : null;
          })
        ).then(results => results.filter(r => r !== null)),
        savedAt: new Date().toISOString(),
      };

      await prisma.gameSave.create({
        data: {
          sessionId,
          saveName: `自动存档-第${round}回合`,
          description: `第${round}回合推演完成后的自动存档`,
          isAutoSave: true,
          saveData: autoSaveData as any,
          createdBy: updatedSession.room.hostId, // 使用房间主持人ID
        },
      });

      logger.info(`Auto-save created for session ${sessionId}, round ${round}`);
    } catch (error) {
      // 自动存档失败不应影响游戏流程
      logger.error(`Failed to create auto-save for session ${sessionId}, round ${round}:`, error);
    }

    // 删除任务标记
    await redis.del(`inference:task:${sessionId}:${round}`);

    // 广播推演完成通知
    io.to(roomId).emit('inference_completed', {
      sessionId,
      round,
      result,
    });

    // 同步游戏状态到 result 阶段（玩家端有的只监听 game_state_update）
    io.to(roomId).emit('game_state_update', {
      roomId,
      sessionId,
      currentRound: round,
      roundStatus: 'result',
      decisionDeadline: updatedSession.decisionDeadline,
      status: updatedSession.status,
    });

    // 广播阶段切换通知
    io.to(roomId).emit('stage_changed', {
      sessionId,
      round,
      stage: 'result',
      previousStage: 'inference',
    });

    // 发送最终进度
    io.to(roomId).emit('inference_progress', {
      sessionId,
      round,
      progress: 100,
      message: '推演完成',
    });

    logger.info(`Inference completed for session ${sessionId}, round ${round}`);
  } catch (error: any) {
    logger.error(`Inference failed for session ${sessionId}, round ${round}:`, error);

    // 保存错误结果
    const resultKey = `inference:result:${sessionId}:${round}`;
    const errorData = {
      sessionId,
      round,
      status: 'failed',
      error: error.message || '推演失败',
      completedAt: new Date().toISOString(),
    };
    await redis.setex(resultKey, 86400, JSON.stringify(errorData));

    // 更新会话状态
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: {
        roundStatus: 'review', // 失败后回到review阶段
      },
    });

    // 删除任务标记
    await redis.del(`inference:task:${sessionId}:${round}`);

    // 构建详细的错误消息
    let errorMessage = error.message || '推演失败';
    
    // 如果是API连接错误，提供更详细的提示
    if (error.message?.includes('API') || error.message?.includes('endpoint') || error.message?.includes('连接')) {
      errorMessage = `AI API连接失败: ${error.message}`;
    } else if (error.message?.includes('密钥') || error.message?.includes('401')) {
      errorMessage = `AI API认证失败: 请检查API密钥配置`;
    } else if (error.message?.includes('404')) {
      errorMessage = `AI API端点不存在: 请检查endpoint配置`;
    }
    
    // 广播推演失败通知
    io.to(roomId).emit('inference_failed', {
      sessionId,
      round,
      error: errorMessage,
      details: error.message,
    });

    throw error;
  }
}

/**
 * 将 AI 返回的原始结构结果转换为前端 TurnResultDTO 兼容格式。
 * 这里用最小可用逻辑：当 Python NarrativeEngine 直接返回 TurnResultDTO 时原样透传；
 * 当仍是旧结构（narrative/outcomes/events）时，尽力映射核心字段。
 */
function buildTurnResultDTO(
  result: any,
  inferenceData: InferenceRequest
): {
  narrative: string;
  events: Array<{
    keyword: string;
    resource: string;
    newValue: number;
    type?: string;
    description?: string;
  }>;
  redactedSegments?: Array<{ start: number; end: number; reason?: string }>;
  perEntityPanel: Array<{
    id: string;
    name: string;
    cash: number;
    marketShare?: number;
    reputation?: number;
    innovation?: number;
    passiveIncome: number;
    passiveExpense: number;
    delta: Record<string, number>;
    broken: boolean;
    achievementsUnlocked: string[];
  }>;
  leaderboard: Array<{
    id: string;
    name: string;
    score: number;
    rank: number;
    rankChange?: number;
  }>;
  riskCard: string;
  opportunityCard: string;
  benefitCard: string;
  achievements: Array<{
    id: string;
    entityId: string;
    title: string;
    description: string;
  }>;
  hexagram?: {
    name: string;
    omen: string;
    lines: Array<'yang' | 'yin'>;
    text: string;
    colorHint?: string;
  };
  options?: Array<{
    id: string;
    title: string;
    description: string;
    expectedDelta?: Record<string, number>;
  }>;
  ledger?: {
    startingCash: number;
    passiveIncome: number;
    passiveExpense: number;
    decisionCost: number;
    balance: number;
  };
  branchingNarratives?: string[];
  nextRoundHints?: string;
  roundTitle?: string;
  cashFlowWarning?: Array<{
    entityId: string;
    message: string;
    severity: 'warning' | 'critical';
  }>;
} {
  // 如果已经是符合契约的结构，直接返回
  if (result && result.narrative && Array.isArray(result.perEntityPanel)) {
    return {
      narrative: result.narrative,
      events: result.events || [],
      redactedSegments: result.redactedSegments || [],
      perEntityPanel: result.perEntityPanel || [],
      leaderboard: result.leaderboard || [],
      riskCard: result.riskCard || '',
      opportunityCard: result.opportunityCard || '',
      benefitCard: result.benefitCard || '',
      achievements: result.achievements || [],
      hexagram: result.hexagram,
      options: result.options,
      ledger: result.ledger,
      branchingNarratives: result.branchingNarratives,
      nextRoundHints: result.nextRoundHints || '',
      roundTitle: result.roundTitle,
      cashFlowWarning: result.cashFlowWarning,
    };
  }

  const narrative = result?.narrative || '';

  // 事件映射：尽量从旧结构提取 keyword/resource/newValue
  const eventsRaw = Array.isArray(result?.events) ? result.events : [];
  const events = eventsRaw
    .map((ev: any, idx: number) => {
      const keyword =
        ev.keyword ||
        ev.trigger_keyword ||
        ev.description ||
        ev.type ||
        `event_${idx + 1}`;
      const resource = ev.resource || 'cash';
      const newValue =
        typeof ev.newValue === 'number'
          ? ev.newValue
          : typeof ev.value === 'number'
          ? ev.value
          : typeof ev.delta === 'number'
          ? ev.delta
          : 0;
      return {
        keyword: String(keyword),
        resource: String(resource),
        newValue,
        type: ev.type || 'mutation',
        description: ev.description || '',
      };
    })
    .slice(0, 10);

  // 主体面板映射：从 outcomes/resources 补齐现金等核心字段
  const outcomesRaw = Array.isArray(result?.outcomes) ? result.outcomes : [];
  const perEntityPanel = outcomesRaw.map((o: any) => {
    const playerIndex = o.playerIndex ?? o.player_id ?? o.id ?? 'P';
    const decision = inferenceData.decisions?.find(
      d => d.playerIndex === o.playerIndex
    );
    const name =
      decision?.nickname ||
      decision?.username ||
      `玩家 ${playerIndex ?? ''}`.trim();
    const resources = (o.resources || {}) as Record<string, any>;
    const cash = Number(resources.cash ?? resources.money ?? 0) || 0;
    const marketShare =
      resources.marketShare !== undefined
        ? Number(resources.marketShare) || 0
        : undefined;
    const reputation =
      resources.reputation !== undefined
        ? Number(resources.reputation) || 0
        : undefined;
    const innovation =
      resources.innovation !== undefined
        ? Number(resources.innovation) || 0
        : undefined;

    return {
      id: String(playerIndex),
      name,
      cash,
      marketShare,
      reputation,
      innovation,
      passiveIncome: Number(resources.passiveIncome ?? 0) || 0,
      passiveExpense: Number(resources.passiveExpense ?? 0) || 0,
      delta: {},
      broken: false,
      achievementsUnlocked: [],
      creditRating: resources.creditRating,
      paletteKey: resources.paletteKey,
      accentColor: resources.accentColor,
    };
  });

  // 排行榜：基于现金和市场份额的简易得分
  const leaderboard = perEntityPanel
    .map((p: { id: string; name: string; cash: number; marketShare?: number; reputation?: number; innovation?: number }) => ({
      id: p.id,
      name: p.name,
      score:
        p.cash +
        (p.marketShare || 0) * 10 +
        (p.reputation || 0) * 1 +
        (p.innovation || 0) * 1,
    }))
    .sort((a: { score: number }, b: { score: number }) => b.score - a.score)
    .map((item: { id: string; name: string; score: number }, idx: number) => ({
      ...item,
      rank: idx + 1,
    }));

  return {
    narrative,
    events,
    redactedSegments:
      result?.redactedSegments || result?.redacted_segments || [],
    perEntityPanel,
    leaderboard,
    riskCard: result?.riskCard || '',
    opportunityCard: result?.opportunityCard || '',
    benefitCard: result?.benefitCard || '',
    achievements: result?.achievements || [],
    hexagram: result?.hexagram,
    options: result?.options,
    ledger: result?.ledger,
    branchingNarratives: result?.branchingNarratives,
    nextRoundHints: result?.nextRoundHints || result?.hints || '',
    roundTitle: result?.roundTitle,
    cashFlowWarning: result?.cashFlowWarning,
  };
}

/**
 * PUT /api/game/:sessionId/events/:eventId/progress
 * 更新事件进度（主持人专用）
 */
router.put(
  '/:sessionId/events/:eventId/progress',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { sessionId, eventId } = req.params;
      if (!userId) throw new AppError('Unauthorized', 401);

      const { progress, currentRound } = req.body || {};

      if (!progress || typeof progress !== 'object') {
        throw new AppError('进度数据无效', 400);
      }

      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: { room: true },
      });
      if (!session) throw new AppError('游戏会话不存在', 404);

      // 确保用户是主持人
      await ensureRoomHost(session.roomId, userId);

      const event = await prisma.temporaryEvent.findUnique({
        where: { id: eventId },
      });
      if (!event) throw new AppError('事件不存在', 404);
      if (event.sessionId !== sessionId) {
        throw new AppError('事件不属于此会话', 400);
      }

      // 更新进度
      const updatedEvent = await prisma.temporaryEvent.update({
        where: { id: eventId },
        data: {
          progress: progress as any,
          updatedAt: new Date(),
        },
      });

      // 检查事件是否完成
      const isCompleted = checkEventCompletion(updatedEvent, currentRound || session.currentRound);
      if (isCompleted && !updatedEvent.completedAt) {
        await prisma.temporaryEvent.update({
          where: { id: eventId },
          data: {
            completedAt: new Date(),
          },
        });
      }

      // 广播事件进度更新
      io.to(session.roomId).emit('event_progress_updated', {
        sessionId,
        eventId,
        progress: updatedEvent.progress,
        completed: isCompleted,
      });

      res.json({
        code: 200,
        message: '事件进度已更新',
        data: {
          id: updatedEvent.id,
          sessionId: updatedEvent.sessionId,
          progress: updatedEvent.progress,
          completed: isCompleted,
          completedAt: isCompleted ? new Date() : null,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/game/:sessionId/events/active
 * 获取活跃事件列表
 */
router.get(
  '/:sessionId/events/active',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { sessionId } = req.params;
      if (!userId) throw new AppError('Unauthorized', 401);

      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
      });
      if (!session) throw new AppError('游戏会话不存在', 404);

      await ensureRoomMembership(session.roomId, userId);

      // 获取所有未完成的事件
      const activeEvents = await prisma.temporaryEvent.findMany({
        where: {
          sessionId,
          completedAt: null,
        },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              nickname: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      // 计算每个事件的完成状态
      const eventsWithStatus = activeEvents.map(event => {
        const isCompleted = checkEventCompletion(event, session.currentRound);
        return {
          id: event.id,
          sessionId: event.sessionId,
          round: event.round,
          eventType: event.eventType,
          eventContent: event.eventContent,
          effectiveRounds: event.effectiveRounds,
          progress: event.progress,
          isCompleted,
          progressPercentage: calculateProgressPercentage(event, session.currentRound),
          createdAt: event.createdAt,
          updatedAt: event.updatedAt,
          creator: event.creator,
        };
      });

      res.json({
        code: 200,
        data: {
          sessionId,
          currentRound: session.currentRound,
          events: eventsWithStatus,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * 检查事件是否完成
 */
function checkEventCompletion(event: { eventType: string; effectiveRounds: number; progress: any; completedAt: Date | null; round: number }, currentRound: number): boolean {
  if (event.completedAt) {
    return true; // 已经标记为完成
  }

  if (event.eventType === 'single_round') {
    // 单回合事件在当前回合后完成
    return currentRound > event.round;
  }

  if (event.eventType === 'multi_round' || event.eventType === 'rule') {
    // 多回合事件根据进度判断
    if (event.progress && typeof event.progress === 'object') {
      const progress = event.progress as { current?: number; total?: number };
      if (progress.current !== undefined && progress.total !== undefined) {
        return progress.current >= progress.total;
      }
    }
    // 如果没有进度信息，根据回合数判断
    return currentRound >= event.round + event.effectiveRounds;
  }

  return false;
}

/**
 * 计算事件进度百分比
 */
function calculateProgressPercentage(event: { eventType: string; effectiveRounds: number; progress: any; round: number }, currentRound: number): number {
  if (event.eventType === 'single_round') {
    return currentRound > event.round ? 100 : 0;
  }

  if (event.eventType === 'multi_round' || event.eventType === 'rule') {
    if (event.progress && typeof event.progress === 'object') {
      const progress = event.progress as { current?: number; total?: number };
      if (progress.current !== undefined && progress.total !== undefined && progress.total > 0) {
        return Math.min(100, Math.round((progress.current / progress.total) * 100));
      }
    }
    // 根据回合数计算
    const roundsElapsed = Math.max(0, currentRound - event.round + 1);
    return Math.min(100, Math.round((roundsElapsed / event.effectiveRounds) * 100));
  }

  return 0;
}

/**
 * 推演后自动更新事件进度
 */
async function updateEventProgressAfterInference(sessionId: string, round: number): Promise<void> {
  try {
    // 获取所有活跃的多回合事件
    const activeEvents = await prisma.temporaryEvent.findMany({
      where: {
        sessionId,
        eventType: { in: ['multi_round', 'rule'] },
        completedAt: null,
      },
    });

    for (const event of activeEvents) {
      const currentProgress = (event.progress as { current?: number; total?: number }) || {};
      const current = (currentProgress.current || event.round);
      const total = event.effectiveRounds;

      // 更新进度（当前回合+1）
      const newProgress = {
        current: Math.min(current + 1, total),
        total: total,
        lastUpdatedRound: round,
      };

      await prisma.temporaryEvent.update({
        where: { id: event.id },
        data: {
          progress: newProgress as any,
          updatedAt: new Date(),
        },
      });

      // 检查是否完成
      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
      });
      if (session && checkEventCompletion({ ...event, progress: newProgress }, session.currentRound)) {
        await prisma.temporaryEvent.update({
          where: { id: event.id },
          data: {
            completedAt: new Date(),
          },
        });

        // 广播事件完成通知
        const room = await prisma.room.findUnique({
          where: { id: session.roomId },
        });
        if (room) {
          io.to(room.id).emit('event_completed', {
            sessionId,
            eventId: event.id,
            eventType: event.eventType,
            eventContent: event.eventContent,
          });
        }
      }
    }
  } catch (error) {
    logger.error(`Failed to update event progress after inference:`, error);
  }
}

/**
 * GET /api/game/:sessionId/state
 * 获取游戏状态（包含当前回合、阶段、历史等）
 */
router.get(
  '/:sessionId/state',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { sessionId } = req.params;
      if (!userId) throw new AppError('Unauthorized', 401);

      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: {
          room: {
            include: {
              hostConfig: true,
            },
          },
          actions: {
            where: {
              status: { in: ['submitted', 'reviewed'] },
            },
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  nickname: true,
                },
              },
            },
            orderBy: { submittedAt: 'asc' },
          },
          events: {
            where: {
              completedAt: null,
            },
            orderBy: { createdAt: 'asc' },
          },
        },
      });
      if (!session) throw new AppError('游戏会话不存在', 404);

      await ensureRoomMembership(session.roomId, userId);

      // 获取推演结果（如果有）
      let inferenceResult = null;
      
      // 根据当前阶段决定获取哪个回合的推演结果
      if (session.roundStatus === 'result' || session.roundStatus === 'inference') {
        // 结果阶段或推演阶段：获取当前回合的推演结果
        const resultKey = `inference:result:${sessionId}:${session.currentRound}`;
        const resultData = await redis.get(resultKey);
        if (resultData) {
          inferenceResult = JSON.parse(resultData);
        }
      } else if (session.roundStatus === 'decision' && session.currentRound > 1) {
        // 决策阶段且不是第一回合：获取上一回合的推演结果作为背景
        const resultKey = `inference:result:${sessionId}:${session.currentRound - 1}`;
        const resultData = await redis.get(resultKey);
        if (resultData) {
          inferenceResult = JSON.parse(resultData);
        }
      }

      res.json({
        code: 200,
        data: {
          sessionId: session.id,
          roomId: session.roomId,
          hostId: session.room.hostId, // 添加hostId，方便前端判断是否是主持人
          currentRound: session.currentRound,
          totalRounds: session.totalRounds,
          roundStatus: session.roundStatus,
          gameStatus: session.status,
          decisionDeadline: session.decisionDeadline,
          gameState: session.gameState,
          inferenceResult,
          activeEvents: session.events.map(event => ({
            id: event.id,
            eventType: event.eventType,
            eventContent: event.eventContent,
            effectiveRounds: event.effectiveRounds,
            progress: event.progress,
            round: event.round,
          })),
          submittedDecisions: session.actions.length,
          totalPlayers: session.room.hostConfig?.totalDecisionEntities || 0,
          updatedAt: session.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/game/:sessionId/round/:round/next
 * 进入下一回合（主持人专用）
 */
router.post(
  '/:sessionId/round/:round/next',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { sessionId, round } = req.params;
      if (!userId) throw new AppError('Unauthorized', 401);

      const roundNumber = Number(round);
      if (!Number.isFinite(roundNumber) || roundNumber <= 0) {
        throw new AppError('无效的回合号', 400);
      }

      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: { room: true },
      });
      if (!session) throw new AppError('游戏会话不存在', 404);

      // 确保用户是主持人
      await ensureRoomHost(session.roomId, userId);

      // 确保当前回合匹配
      if (session.currentRound !== roundNumber) {
        throw new AppError('回合号不匹配', 400);
      }

      // 确保当前阶段是 result
      if (session.roundStatus !== 'result') {
        throw new AppError('当前阶段不是结果阶段，无法进入下一回合', 400);
      }

      // 检查是否达到总回合数
      if (session.totalRounds && session.currentRound >= session.totalRounds) {
        // 游戏结束
        await prisma.gameSession.update({
          where: { id: sessionId },
          data: {
            status: 'finished',
            roundStatus: 'finished',
          },
        });

        // 广播游戏结束通知
        io.to(session.roomId).emit('game_finished', {
          sessionId,
          finalRound: session.currentRound,
        });

        return res.json({
          code: 200,
          message: '游戏已结束',
          data: {
            sessionId,
            status: 'finished',
            finalRound: session.currentRound,
          },
        });
      }

      // 进入下一回合
      const nextRound = session.currentRound + 1;
      
      // 获取主持人配置的决策时限
      const hostConfig = await prisma.hostConfig.findUnique({
        where: { roomId: session.roomId },
        select: { decisionTimeLimit: true },
      });
      const decisionMinutes = hostConfig?.decisionTimeLimit || 4;
      const newDeadline = new Date(Date.now() + decisionMinutes * 60 * 1000);
      
      await prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          currentRound: nextRound,
          roundStatus: 'decision',
          decisionDeadline: newDeadline,
          updatedAt: new Date(),
        },
      });

      // 广播回合切换通知
      io.to(session.roomId).emit('round_changed', {
        sessionId,
        previousRound: roundNumber,
        currentRound: nextRound,
        roundStatus: 'decision',
        decisionDeadline: newDeadline.toISOString(),
      });

      // 广播阶段切换通知
      io.to(session.roomId).emit('stage_changed', {
        sessionId,
        round: nextRound,
        stage: 'decision',
        previousStage: 'result',
        decisionDeadline: newDeadline.toISOString(),
      });

      // 广播游戏状态更新（确保前端能收到新的 deadline）
      io.to(session.roomId).emit('game_state_update', {
        roomId: session.roomId,
        sessionId,
        currentRound: nextRound,
        roundStatus: 'decision',
        decisionDeadline: newDeadline.toISOString(),
        status: session.status,
      });

      return res.json({
        code: 200,
        message: '已进入下一回合',
        data: {
          sessionId,
          previousRound: roundNumber,
          currentRound: nextRound,
          roundStatus: 'decision',
          decisionDeadline: newDeadline.toISOString(),
        },
      });
    } catch (error) {
      return next(error);
    }
  }
);

/**
 * GET /api/game/:sessionId/history
 * 获取游戏历史记录
 */
router.get(
  '/:sessionId/history',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { sessionId } = req.params;
      if (!userId) throw new AppError('Unauthorized', 401);

      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
      });
      if (!session) throw new AppError('游戏会话不存在', 404);

      await ensureRoomMembership(session.roomId, userId);

      // 获取所有回合的推演结果
      const history: Array<{
        round: number;
        status: string;
        result?: any;
        completedAt?: string;
      }> = [];

      for (let round = 1; round <= session.currentRound; round++) {
        const resultKey = `inference:result:${sessionId}:${round}`;
        const resultData = await redis.get(resultKey);
        
        if (resultData) {
          const result = JSON.parse(resultData);
          history.push({
            round,
            status: result.status,
            result: result.result,
            completedAt: result.completedAt,
          });
        } else {
          // 如果结果不存在，至少记录回合号
          history.push({
            round,
            status: 'unknown',
          });
        }
      }

      res.json({
        code: 200,
        data: {
          sessionId,
          currentRound: session.currentRound,
          totalRounds: session.totalRounds,
          history,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// GET /api/game/history 已在前面定义（第126行附近），避免路由冲突

/**
 * GET /api/game/history/:sessionId
 * 获取游戏历史详情
 */
router.get(
  '/history/:sessionId',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { sessionId } = req.params;
      if (!userId) throw new AppError('Unauthorized', 401);

      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: {
          room: {
            include: {
              host: {
                select: {
                  id: true,
                  username: true,
                  nickname: true,
                },
              },
              hostConfig: true,
            },
          },
          actions: {
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  nickname: true,
                },
              },
            },
            orderBy: [{ round: 'asc' }, { submittedAt: 'asc' }],
          },
          events: {
            orderBy: { createdAt: 'asc' },
          },
        },
      });

      if (!session) throw new AppError('游戏历史不存在', 404);

      // 检查用户是否参与过此游戏
      const membership = await prisma.roomPlayer.findFirst({
        where: {
          roomId: session.roomId,
          userId,
        },
      });
      if (!membership) {
        throw new AppError('您未参与此游戏', 403);
      }

      // 获取所有回合的推演结果
      const roundResults: Array<{
        round: number;
        status: string;
        result?: any;
        completedAt?: string;
      }> = [];

      for (let round = 1; round <= session.currentRound; round++) {
        const resultKey = `inference:result:${sessionId}:${round}`;
        const resultData = await redis.get(resultKey);
        
        if (resultData) {
          const result = JSON.parse(resultData);
          roundResults.push({
            round,
            status: result.status,
            result: result.result,
            completedAt: result.completedAt,
          });
        }
      }

      res.json({
        code: 200,
        data: {
          id: session.id,
          sessionId: session.id,
          roomId: session.roomId,
          roomName: session.room.name,
          hostName: session.room.host.nickname || session.room.host.username,
          currentRound: session.currentRound,
          totalRounds: session.totalRounds,
          status: session.status,
          roundStatus: session.roundStatus,
          gameState: session.gameState,
          roundResults,
          actions: session.actions,
          events: session.events,
          gameRules: session.room.hostConfig?.gameRules,
          createdAt: session.createdAt,
          updatedAt: session.updatedAt,
          finishedAt: session.status === 'finished' ? session.updatedAt : null,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/game/history/:sessionId
 * 删除游戏历史（仅主持人可删除）
 */
router.delete(
  '/history/:sessionId',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { sessionId } = req.params;
      if (!userId) throw new AppError('Unauthorized', 401);

      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: { room: true },
      });

      if (!session) throw new AppError('游戏历史不存在', 404);

      // 只有主持人可以删除
      await ensureRoomHost(session.roomId, userId);

      // 删除推演结果（Redis）
      for (let round = 1; round <= session.currentRound; round++) {
        await redis.del(`inference:result:${sessionId}:${round}`);
        await redis.del(`inference:task:${sessionId}:${round}`);
      }

      // 删除游戏会话（级联删除相关数据）
      await prisma.gameSession.delete({
        where: { id: sessionId },
      });

      res.json({
        code: 200,
        message: '游戏历史已删除',
      });
    } catch (error) {
      next(error);
    }
  }
);

// DELETE /api/game/history/batch 已在前面定义（第451行附近），避免路由冲突

/**
 * POST /api/game/:sessionId/save
 * 保存游戏存档（手动存档）
 */
router.post(
  '/:sessionId/save',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { sessionId } = req.params;
      if (!userId) throw new AppError('Unauthorized', 401);

      const { saveName, description } = req.body || {};

      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: {
          room: true,
          actions: {
            where: {
              status: { in: ['submitted', 'reviewed'] },
            },
            include: {
              user: {
                select: {
                  id: true,
                  username: true,
                  nickname: true,
                },
              },
            },
          },
          events: {
            where: {
              completedAt: null,
            },
          },
          trades: {
            where: {
              status: { in: ['pending', 'accepted'] },
            },
          },
        },
      });

      if (!session) throw new AppError('游戏会话不存在', 404);

      await ensureRoomMembership(session.roomId, userId);

      // 构建存档数据
      const saveData = {
        session: {
          id: session.id,
          roomId: session.roomId,
          currentRound: session.currentRound,
          totalRounds: session.totalRounds,
          roundStatus: session.roundStatus,
          gameState: session.gameState,
          status: session.status,
          decisionDeadline: session.decisionDeadline,
        },
        actions: session.actions,
        events: session.events,
        trades: session.trades,
        // 获取所有回合的推演结果
        inferenceResults: await Promise.all(
          Array.from({ length: session.currentRound }, async (_, i) => {
            const round = i + 1;
            const resultKey = `inference:result:${sessionId}:${round}`;
            const resultData = await redis.get(resultKey);
            return resultData ? { round, result: JSON.parse(resultData) } : null;
          })
        ).then(results => results.filter(r => r !== null)),
        savedAt: new Date().toISOString(),
      };

      // 创建存档
      const gameSave = await prisma.gameSave.create({
        data: {
          sessionId,
          saveName: saveName || `第${session.currentRound}回合存档`,
          description: description || null,
          isAutoSave: false,
          saveData: saveData as any,
          createdBy: userId,
        },
      });

      // 广播存档创建通知
      io.to(session.roomId).emit('game_saved', {
        sessionId,
        saveId: gameSave.id,
        saveName: gameSave.saveName,
        createdAt: gameSave.createdAt,
      });

      res.json({
        code: 200,
        message: '游戏已保存',
        data: {
          id: gameSave.id,
          sessionId: gameSave.sessionId,
          saveName: gameSave.saveName,
          description: gameSave.description,
          isAutoSave: gameSave.isAutoSave,
          createdAt: gameSave.createdAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/game/:sessionId/saves
 * 获取游戏存档列表
 */
router.get(
  '/:sessionId/saves',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { sessionId } = req.params;
      if (!userId) throw new AppError('Unauthorized', 401);

      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
      });
      if (!session) throw new AppError('游戏会话不存在', 404);

      await ensureRoomMembership(session.roomId, userId);

      const saves = await prisma.gameSave.findMany({
        where: { sessionId },
        include: {
          creator: {
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
          sessionId,
          saves: saves.map(save => ({
            id: save.id,
            sessionId: save.sessionId,
            saveName: save.saveName,
            description: save.description,
            isAutoSave: save.isAutoSave,
            createdAt: save.createdAt,
            creator: save.creator,
          })),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/game/:sessionId/restore/:saveId
 * 恢复游戏存档
 */
router.post(
  '/:sessionId/restore/:saveId',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { sessionId, saveId } = req.params;
      if (!userId) throw new AppError('Unauthorized', 401);

      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: { room: true },
      });
      if (!session) throw new AppError('游戏会话不存在', 404);

      // 只有主持人可以恢复存档
      await ensureRoomHost(session.roomId, userId);

      const gameSave = await prisma.gameSave.findUnique({
        where: { id: saveId },
      });

      if (!gameSave) throw new AppError('存档不存在', 404);
      if (gameSave.sessionId !== sessionId) {
        throw new AppError('存档不属于此会话', 400);
      }

      const saveData = gameSave.saveData as any;

      // 恢复会话状态
      await prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          currentRound: saveData.session.currentRound,
          roundStatus: saveData.session.roundStatus,
          gameState: saveData.session.gameState,
          status: saveData.session.status,
          decisionDeadline: saveData.session.decisionDeadline
            ? new Date(saveData.session.decisionDeadline)
            : null,
        },
      });

      // 恢复推演结果到 Redis
      if (saveData.inferenceResults && Array.isArray(saveData.inferenceResults)) {
        for (const result of saveData.inferenceResults) {
          if (result && result.round && result.result) {
            const resultKey = `inference:result:${sessionId}:${result.round}`;
            await redis.setex(
              resultKey,
              86400,
              JSON.stringify(result.result)
            );
          }
        }
      }

      // 广播恢复通知
      io.to(session.roomId).emit('game_restored', {
        sessionId,
        saveId: gameSave.id,
        saveName: gameSave.saveName,
        restoredAt: new Date().toISOString(),
      });

      // 广播游戏状态更新
      io.to(session.roomId).emit('game_state_update', {
        roomId: session.roomId,
        sessionId,
        currentRound: saveData.session.currentRound,
        roundStatus: saveData.session.roundStatus,
        decisionDeadline: saveData.session.decisionDeadline,
        status: saveData.session.status,
      });

      res.json({
        code: 200,
        message: '游戏已恢复到指定存档点',
        data: {
          sessionId,
          saveId: gameSave.id,
          saveName: gameSave.saveName,
          restoredAt: new Date().toISOString(),
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * DELETE /api/game/:sessionId/saves/:saveId
 * 删除游戏存档
 */
router.delete(
  '/:sessionId/saves/:saveId',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { sessionId, saveId } = req.params;
      if (!userId) throw new AppError('Unauthorized', 401);

      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: { room: true },
      });
      if (!session) throw new AppError('游戏会话不存在', 404);

      // 只有主持人可以删除存档
      await ensureRoomHost(session.roomId, userId);

      const gameSave = await prisma.gameSave.findUnique({
        where: { id: saveId },
      });

      if (!gameSave) throw new AppError('存档不存在', 404);
      if (gameSave.sessionId !== sessionId) {
        throw new AppError('存档不属于此会话', 400);
      }

      await prisma.gameSave.delete({
        where: { id: saveId },
      });

      // 广播删除通知
      io.to(session.roomId).emit('game_save_deleted', {
        sessionId,
        saveId,
        deletedAt: new Date().toISOString(),
      });

      res.json({
        code: 200,
        message: '存档已删除',
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/game/:sessionId/adjust-time-limit
 * 主持人调整当前回合的时限
 */
router.put('/:sessionId/adjust-time-limit', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId;
    const { sessionId } = req.params;
    const { additionalMinutes } = req.body;
    
    if (!userId) throw new AppError('Unauthorized', 401);
    
    // 获取游戏会话
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: { room: true }
    });
    
    if (!session) throw new AppError('游戏会话不存在', 404);
    
    // 确保用户是主持人
    if (session.room.hostId !== userId) {
      throw new AppError('只有主持人可以调整时限', 403);
    }
    
    // 只能在决策阶段调整时限
    if (session.roundStatus !== 'decision') {
      throw new AppError('只能在决策阶段调整时限', 400);
    }
    
    // 验证参数
    if (!additionalMinutes || additionalMinutes < 1 || additionalMinutes > 60) {
      throw new AppError('延长时间必须在1-60分钟之间', 400);
    }
    
    // 计算新的截止时间
    const currentDeadline = session.decisionDeadline ? new Date(session.decisionDeadline) : new Date();
    const newDeadline = new Date(currentDeadline.getTime() + additionalMinutes * 60 * 1000);
    
    // 更新数据库
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: { decisionDeadline: newDeadline }
    });
    
    // 通过WebSocket广播时限调整
    io.to(session.roomId).emit('time_limit_adjusted', {
      sessionId,
      newDeadline: newDeadline.toISOString(),
      additionalMinutes,
      adjustedBy: userId
    });
    
    res.json({
      code: 200,
      message: `时限已延长${additionalMinutes}分钟`,
      data: {
        newDeadline: newDeadline.toISOString(),
        additionalMinutes
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/game/:sessionId/recovery/status
 * 检查游戏状态异常
 */
router.get('/:sessionId/recovery/status', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId;
    const { sessionId } = req.params;
    
    if (!userId) throw new AppError('Unauthorized', 401);
    
    // 检查用户权限（主持人或参与者）
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: { room: true }
    });
    
    if (!session) throw new AppError('游戏会话不存在', 404);
    
    const isHost = session.room.hostId === userId;
    const membership = await prisma.roomPlayer.findFirst({
      where: { roomId: session.roomId, userId }
    });
    
    if (!isHost && !membership) {
      throw new AppError('无权限访问此游戏', 403);
    }
    
    const recoveryState = await gameRecoveryService.detectGameStateAnomalies(sessionId);
    
    res.json({
      code: 200,
      data: {
        hasAnomalies: !!recoveryState,
        recoveryState,
        canRecover: isHost // 只有主持人可以执行恢复操作
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/game/:sessionId/recovery/execute
 * 执行游戏恢复操作（仅主持人）
 */
router.post('/:sessionId/recovery/execute', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId;
    const { sessionId } = req.params;
    const { action } = req.body;
    
    if (!userId) throw new AppError('Unauthorized', 401);
    
    if (!action) {
      throw new AppError('请指定恢复操作', 400);
    }
    
    const result = await gameRecoveryService.executeRecovery(sessionId, action, userId);
    
    res.json({
      code: result.success ? 200 : 400,
      message: result.message,
      data: result.newState
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/game/:sessionId/recovery/snapshot
 * 创建游戏状态快照（仅主持人）
 */
router.post('/:sessionId/recovery/snapshot', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId;
    const { sessionId } = req.params;
    
    if (!userId) throw new AppError('Unauthorized', 401);
    
    // 确保用户是主持人
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId },
      include: { room: true }
    });
    
    if (!session) throw new AppError('游戏会话不存在', 404);
    if (session.room.hostId !== userId) {
      throw new AppError('只有主持人可以创建快照', 403);
    }
    
    const snapshotId = await gameRecoveryService.createGameSnapshot(sessionId);
    
    res.json({
      code: 200,
      message: '游戏快照创建成功',
      data: { snapshotId }
    });
  } catch (error) {
    next(error);
  }
});

export default router;
