import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import prisma from '../utils/db';
import { logger } from '../utils/logger';
import { io } from '../server';
import redis from '../utils/redis';

const router = Router();

// helpers
const parsePositiveInt = (value: any, fallback: number) => {
  const n = Number(value);
  if (Number.isNaN(n) || n <= 0) return fallback;
  return Math.floor(n);
};

export const ensureRoomHost = async (roomId: string, userId: string) => {
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) {
    throw new AppError('房间不存在', 404);
  }
  if (room.hostId !== userId) {
    throw new AppError('只有房主可以操作主持人配置', 403);
  }
  return room;
};

const getOrCreateHostConfig = async (roomId: string, userId: string) => {
  const existing = await prisma.hostConfig.findUnique({ where: { roomId } });
  if (existing) return existing;
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room) throw new AppError('房间不存在', 404);

  // Default DeepSeek configuration tuned for "Every Wall is a Door"
  const defaultBodyTemplate = {
    model: 'deepseek-chat',
    messages: [
      {
        role: 'system',
        content:
          'You are the narrative and rules engine for a multiplayer business simulation game called "Every Wall is a Door" (凡墙皆是门). ' +
          'The game has multiple entities (A, B, C, D...), each representing a company with a Chinese name. ' +
          'Time is advanced in quarterly rounds (each round ≈ one quarter, four rounds ≈ one year). In each round: ' +
          'players submit text decisions for their entities; you update each entity state (cash balance, passive income, passive expense, market share, reputation, innovation, etc.) ' +
          'STRICTLY following the rules: player decisions FIRST (if an entity gives no decision this round, only apply passive income/expense and ongoing events, NEVER invent proactive actions), ' +
          'cross-entity effects must be considered (one entity decision can affect others and the market), ' +
          'you classify events as positive / negative / neutral and allow multi-round events, ' +
          'you are inspired by an underlying I-Ching hexagram for randomness and narrative flavor but you must keep business logic realistic, ' +
          'you MUST NOT initiate cooperation between entities on your own and MUST NOT replace players decisions. ' +
          'At the end of each round you MUST produce: (1) a coherent narrative, (2) a structured per-entity panel with updated attributes and deltas, ' +
          '(3) a leaderboard with scores (e.g. profit, market share), (4) three short cards for risk, opportunity and current benefit, and (5) a list of achievements for key decisions.'
      },
      {
        role: 'user',
        content: '{{prompt}}'
      }
    ],
    temperature: 0.7,
    max_tokens: 2000,
    stream: false
  };

  return prisma.hostConfig.create({
    data: {
      roomId,
      createdBy: userId,
      apiConfig: {},
      apiProvider: 'deepseek',
      apiEndpoint: 'https://api.deepseek.com/v1/chat/completions',
      apiHeaders: {
        'Content-Type': 'application/json'
      },
      apiBodyTemplate: defaultBodyTemplate,
      totalDecisionEntities: room.maxPlayers,
      humanPlayerCount: Math.max(room.currentPlayers, 1),
      aiPlayerCount: 0,
      decisionTimeLimit: 4,
      timeoutStrategy: 'auto_submit',
    },
  });
};

const toHostConfigResponse = (cfg: any) => ({
  id: cfg.id,
  roomId: cfg.roomId,
  apiProvider: cfg.apiProvider,
  apiEndpoint: cfg.apiEndpoint,
  apiHeaders: cfg.apiHeaders,
  apiBodyTemplate: cfg.apiBodyTemplate,
  apiConfig: cfg.apiConfig,
  gameRules: cfg.gameRules,
  totalDecisionEntities: cfg.totalDecisionEntities,
  humanPlayerCount: cfg.humanPlayerCount,
  aiPlayerCount: cfg.aiPlayerCount,
  decisionTimeLimit: cfg.decisionTimeLimit,
  timeoutStrategy: cfg.timeoutStrategy,
  validationStatus: cfg.validationStatus,
  validationMessage: cfg.validationMessage,
  validatedAt: cfg.validatedAt,
  configurationCompletedAt: cfg.configurationCompletedAt,
  initializationCompleted: cfg.initializationCompleted,
  createdAt: cfg.createdAt,
  updatedAt: cfg.updatedAt,
});

/**
 * POST /api/rooms/create
 * 创建房间
 */
router.post('/create', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const { name, max_players, maxPlayers, game_mode, gameMode, password } = req.body || {};
    const userId = req.userId;
    if (!userId) throw new AppError('Unauthorized', 401);

    // Verify user exists in database
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('用户不存在，请重新登录', 401);
    }

    const roomName = (name || '').trim();
    if (!roomName) throw new AppError('房间名称不能为空', 400);

    const maxP = parsePositiveInt(max_players ?? maxPlayers, 4);
    if (maxP < 2 || maxP > 10) throw new AppError('人数上限需在2-10之间', 400);

    const mode = (game_mode || gameMode || 'competitive').toString();

    const room = await prisma.room.create({
      data: {
        name: roomName,
        maxPlayers: maxP,
        currentPlayers: 1,
        status: 'waiting',
        creatorId: userId,
        hostId: userId,
        password: password || null,
      },
    });

    await prisma.roomPlayer.create({
      data: {
        roomId: room.id,
        userId,
        role: 'host',
        status: 'joined',
        isHuman: true,
      },
    });

    res.status(201).json({
      code: 201,
      message: '房间创建成功',
      data: {
        room_id: room.id,
        room: {
          ...room,
          game_mode: mode,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rooms/list
 * 获取房间列表
 */
router.get('/list', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId; // 获取当前用户ID，用于判断是否在房间中
    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 20);
    const status = req.query.status as string | undefined;

    let where: { status?: any } = {};
    if (!status) {
      // 默认只展示活跃房间，避免已关闭/历史房间挤占列表
      where = { status: { in: ['waiting', 'playing'] } };
    } else if (status === 'all') {
      where = {};
    } else {
      where = { status: status.toString() };
    }
    const [rooms, total] = await Promise.all([
      prisma.room.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          name: true,
          status: true,
          maxPlayers: true,
          currentPlayers: true,
          hostId: true,
          createdAt: true,
          host: {
            select: {
              nickname: true,
              username: true,
            },
          },
        },
      }),
      prisma.room.count({ where }),
    ]);

    // 获取用户在所有房间中的参与状态
    const roomIds = rooms.map(r => r.id);
    const userMemberships = userId
      ? await prisma.roomPlayer.findMany({
        where: {
          roomId: { in: roomIds },
          userId,
          status: { not: 'left' },
        },
        select: {
          roomId: true,
          status: true,
        },
      })
      : [];

    const membershipMap = new Map(
      userMemberships.map(m => [m.roomId, m.status])
    );

    const withHostName = rooms.map(room => {
      const { host, ...rest } = room;
      return {
        ...rest,
        hostName: host?.nickname || host?.username || '',
        isJoined: userId ? membershipMap.has(room.id) : false, // 问题2修复：返回用户是否在房间中
      };
    });

    res.json({
      code: 200,
      data: { rooms: withHostName, total, page, limit },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/rooms/:roomId/join
 * 加入房间
 */
router.post('/:roomId/join', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError('Unauthorized', 401);

    // Verify user exists in database
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new AppError('用户不存在，请重新登录', 401);
    }

    const { roomId } = req.params;
    const { password } = req.body || {};

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new AppError('房间不存在', 404);

    // 检查玩家是否之前参与过该房间
    const existing = await prisma.roomPlayer.findFirst({
      where: { roomId, userId },
    });

    // 如果用户已经在房间中（未离开），直接返回成功
    if (existing && existing.status !== 'left') {
      res.json({ code: 200, message: '已在房间中' });
      return;
    }

    // 修复：playing状态的房间，只允许之前参与过的玩家重新加入
    if (room.status === 'playing') {
      if (!existing) {
        // 新玩家不允许加入进行中的房间
        throw new AppError('游戏进行中的房间不允许新玩家加入', 403);
      }
      // 之前参与过的玩家可以重新加入，继续下面的逻辑
    }

    if (room.password && room.password !== password) {
      throw new AppError('房间密码错误', 403);
    }

    // 检查房间是否已满（但如果是重新加入的玩家，不计入满员限制）
    if (!existing && room.currentPlayers >= room.maxPlayers) {
      throw new AppError('房间已满员', 403);
    }

    // User rejoining the room (was previously left) or new user
    if (existing) {
      // Rejoin: update status and increment currentPlayers
      // (currentPlayers was decremented when user left)
      await prisma.roomPlayer.update({
        where: { id: existing.id },
        data: { status: 'joined', role: existing.role ?? 'human_player' },
      });
      await prisma.room.update({
        where: { id: roomId },
        data: { currentPlayers: { increment: 1 } },
      });
    } else {
      // New user: create record and increment currentPlayers
      await prisma.roomPlayer.create({
        data: {
          roomId,
          userId,
          role: 'human_player',
          status: 'joined',
          isHuman: true,
        },
      });
      await prisma.room.update({
        where: { id: roomId },
        data: { currentPlayers: { increment: 1 } },
      });
    }

    try {
      io.to(roomId).emit('player_joined', { roomId, userId });
    } catch (emitErr) {
      logger.warn('emit player_joined failed', emitErr);
    }

    res.json({ code: 200, message: '加入房间成功' });
    return;
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/rooms/:roomId/leave
 * 离开房间
 */
router.post('/:roomId/leave', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError('Unauthorized', 401);
    const { roomId } = req.params;

    const membership = await prisma.roomPlayer.findFirst({
      where: { roomId, userId, status: { not: 'left' } },
    });
    if (!membership) {
      throw new AppError('不在房间中', 400);
    }

    await prisma.roomPlayer.update({
      where: { id: membership.id },
      data: { status: 'left' },
    });

    await prisma.room.update({
      where: { id: roomId },
      data: {
        currentPlayers: { decrement: 1 },
      },
    });

    try {
      io.to(roomId).emit('player_left', { roomId, userId });
    } catch (emitErr) {
      logger.warn('emit player_left failed', emitErr);
    }

    res.json({ code: 200, message: '离开房间成功' });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/rooms/:roomId/close
 * 关闭房间（软删除）：仅房主可操作，房间从默认列表中隐藏
 */
router.post('/:roomId/close', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError('Unauthorized', 401);
    const { roomId } = req.params;

    const room = await ensureRoomHost(roomId, userId);

    // 已关闭/已结束的房间幂等处理
    if (room.status === 'closed' || room.status === 'finished') {
      res.json({ code: 200, message: '房间已关闭', data: { room_id: roomId, status: room.status } });
      return;
    }

    const now = new Date();

    await prisma.$transaction([
      prisma.roomPlayer.updateMany({
        where: { roomId, status: { not: 'left' } },
        data: { status: 'left', leftAt: now },
      }),
      prisma.room.update({
        where: { id: roomId },
        data: {
          status: 'closed',
          finishedAt: now,
          currentPlayers: 0,
        },
      }),
      prisma.gameSession.updateMany({
        where: { roomId },
        data: { status: 'finished' },
      }),
    ]);

    try {
      io.to(roomId).emit('system_message', {
        roomId,
        message: '房间已被房主关闭',
        from: 'system',
      });
      io.to(roomId).emit('game_state_update', {
        roomId,
        status: 'closed',
      });
    } catch (emitErr) {
      logger.warn('emit room closed events failed', emitErr);
    }

    res.json({ code: 200, message: '房间已关闭', data: { room_id: roomId, status: 'closed' } });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/rooms/:roomId/kill-game
 * 终止进行中的游戏（仅房主可操作）
 */
router.post('/:roomId/kill-game', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId;
    if (!userId) throw new AppError('Unauthorized', 401);
    const { roomId } = req.params;

    const room = await ensureRoomHost(roomId, userId);

    // 只有进行中的房间才能终止
    if (room.status !== 'playing') {
      throw new AppError('房间未在进行中，无法终止游戏', 400);
    }

    // 查找并终止游戏会话
    const session = await prisma.gameSession.findUnique({
      where: { roomId },
    });

    // 执行事务：更新游戏会话和房间状态
    const transactionOps: any[] = [
      // 将房间状态改回等待中
      prisma.room.update({
        where: { id: roomId },
        data: {
          status: 'waiting',
        },
      }),
    ];

    // 如果有会话，添加更新会话的操作
    if (session) {
      transactionOps.push(
        prisma.gameSession.update({
          where: { id: session.id },
          data: {
            status: 'finished',
            roundStatus: 'finished',
          },
        })
      );
    }

    await prisma.$transaction(transactionOps);

    // 清理Redis中的推演任务和结果
    if (session) {
      try {
        const roundKeys = await redis.keys(`inference:*:${session.id}:*`);
        if (roundKeys.length > 0) {
          await redis.del(...roundKeys);
        }
      } catch (redisErr) {
        logger.warn('Failed to clean up Redis keys:', redisErr);
      }
    }

    // 广播游戏终止通知
    try {
      io.to(roomId).emit('system_message', {
        roomId,
        message: '游戏已被房主终止',
        from: 'system',
      });
      io.to(roomId).emit('game_state_update', {
        roomId,
        status: 'waiting',
      });
      if (session) {
        io.to(roomId).emit('game_finished', {
          sessionId: session.id,
          reason: 'terminated_by_host',
        });
      }
    } catch (emitErr) {
      logger.warn('emit game killed events failed', emitErr);
    }

    res.json({
      code: 200,
      message: '游戏已终止',
      data: { room_id: roomId, status: 'waiting' },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/rooms/:roomId/reset-game
 * 重置房间：清空该房间的游戏会话及相关数据（仅房主可操作）
 */
router.post('/:roomId/reset-game', authenticateToken, async (req: AuthRequest, res, next): Promise<void> => {
  try {
    const userId = req.userId;
    if (!userId) {
      throw new AppError('Unauthorized', 401);
    }
    const { roomId } = req.params;

    // 验证房主权限
    await ensureRoomHost(roomId, userId);

    // 查找当前会话
    const session = await prisma.gameSession.findUnique({
      where: { roomId },
      select: { id: true },
    });

    // 如果没有会话，仅将房间状态复位
    if (!session) {
      await prisma.room.update({
        where: { id: roomId },
        data: {
          status: 'waiting',
        },
      });

      io.to(roomId).emit('system_message', {
        roomId,
        message: '房间已重置（无进行中的会话）',
        from: 'system',
      });
      io.to(roomId).emit('game_state_update', {
        roomId,
        status: 'waiting',
      });

      res.json({ code: 200, message: '房间已重置', data: { room_id: roomId, status: 'waiting' } });
      return;
    }

    const sessionId = session.id;

    // 事务删除会话相关数据
    await prisma.$transaction([
      prisma.playerAction.deleteMany({ where: { sessionId } }),
      prisma.temporaryEvent.deleteMany({ where: { sessionId } }),
      prisma.trade.deleteMany({ where: { sessionId } }),
      prisma.task.deleteMany({ where: { sessionId } }),
      prisma.gameSave.deleteMany({ where: { sessionId } }),
      prisma.gameSession.deleteMany({ where: { id: sessionId } }),
      prisma.room.update({
        where: { id: roomId },
        data: {
          status: 'waiting',
          startedAt: null,
          finishedAt: null,
        },
      }),
    ]);

    // 清理 Redis 推演缓存
    try {
      const keys = await redis.keys(`inference:*:${sessionId}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } catch (redisErr) {
      logger.warn('Failed to clean up Redis keys on reset', redisErr);
    }

    // 广播重置通知
    try {
      io.to(roomId).emit('system_message', {
        roomId,
        message: '房间已被重置，所有游戏数据已清空',
        from: 'system',
      });
      io.to(roomId).emit('game_state_update', {
        roomId,
        status: 'waiting',
      });
      io.to(roomId).emit('game_finished', {
        sessionId,
        reason: 'reset_by_host',
      });
    } catch (emitErr) {
      logger.warn('emit room reset events failed', emitErr);
    }

    res.json({ code: 200, message: '房间已重置，游戏数据已清空', data: { room_id: roomId, status: 'waiting' } });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/rooms/:roomId/host-config
 * 获取主持人配置
 */
router.get('/:roomId/host-config', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId;
    const { roomId } = req.params;
    if (!userId) throw new AppError('Unauthorized', 401);

    await ensureRoomHost(roomId, userId);
    const cfg = await getOrCreateHostConfig(roomId, userId);

    res.json({ code: 200, data: toHostConfigResponse(cfg) });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/rooms/:roomId/host-config
 * 保存综合配置（一次性提交）
 */
router.post('/:roomId/host-config', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId;
    const { roomId } = req.params;
    if (!userId) throw new AppError('Unauthorized', 401);
    const {
      apiProvider,
      apiEndpoint,
      apiHeaders,
      apiBodyTemplate,
      gameRules,
      totalDecisionEntities,
      humanPlayerCount,
      aiPlayerCount,
      decisionTimeLimit,
      timeoutStrategy,
    } = req.body || {};

    await ensureRoomHost(roomId, userId);

    const total = Number(totalDecisionEntities ?? humanPlayerCount + aiPlayerCount);
    const human = Number(humanPlayerCount ?? 0);
    const ai = Number(aiPlayerCount ?? 0);
    const timeLimit = Number(decisionTimeLimit ?? 4);
    if (total <= 0 || human < 0 || ai < 0) throw new AppError('人数配置不合法', 400);
    if (human + ai > total) throw new AppError('人类+AI数量不能超过总决策实体数', 400);
    if (timeLimit <= 0) throw new AppError('决策时限必须大于0', 400);

    const cfg = await getOrCreateHostConfig(roomId, userId);
    const updated = await prisma.hostConfig.update({
      where: { id: cfg.id },
      data: {
        apiProvider: apiProvider ?? cfg.apiProvider,
        apiEndpoint: apiEndpoint ?? cfg.apiEndpoint,
        apiHeaders: apiHeaders ?? cfg.apiHeaders,
        apiBodyTemplate: apiBodyTemplate ?? cfg.apiBodyTemplate,
        apiConfig: {
          ...(cfg.apiConfig as object),
          provider: apiProvider ?? (cfg.apiConfig as any)?.provider,
          endpoint: apiEndpoint ?? (cfg.apiConfig as any)?.endpoint,
          headers: apiHeaders ?? (cfg.apiConfig as any)?.headers,
          bodyTemplate: apiBodyTemplate ?? (cfg.apiConfig as any)?.bodyTemplate,
        },
        gameRules: gameRules ?? cfg.gameRules,
        totalDecisionEntities: total,
        humanPlayerCount: human,
        aiPlayerCount: ai,
        decisionTimeLimit: timeLimit,
        timeoutStrategy: timeoutStrategy ?? cfg.timeoutStrategy,
        validationStatus: 'pending',
        validationMessage: null,
      },
    });

    // 同步更新房间的 maxPlayers
    await prisma.room.update({
      where: { id: roomId },
      data: { maxPlayers: total },
    });

    res.json({ code: 200, message: '主持人配置已保存', data: toHostConfigResponse(updated) });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/rooms/:roomId/host-config/api
 * 更新 API 配置
 */
router.post('/:roomId/host-config/api', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    const userId = req.userId;
    const { roomId } = req.params;
    if (!userId) throw new AppError('Unauthorized', 401);
    const { apiProvider, apiEndpoint, apiHeaders, apiBodyTemplate } = req.body || {};

    await ensureRoomHost(roomId, userId);
    const cfg = await getOrCreateHostConfig(roomId, userId);

    const updated = await prisma.hostConfig.update({
      where: { id: cfg.id },
      data: {
        apiProvider: apiProvider ?? cfg.apiProvider,
        apiEndpoint: apiEndpoint ?? cfg.apiEndpoint,
        apiHeaders: apiHeaders ?? cfg.apiHeaders,
        apiBodyTemplate: apiBodyTemplate ?? cfg.apiBodyTemplate,
        apiConfig: {
          ...(cfg.apiConfig as object),
          provider: apiProvider ?? (cfg.apiConfig as any)?.provider,
          endpoint: apiEndpoint ?? (cfg.apiConfig as any)?.endpoint,
          headers: apiHeaders ?? (cfg.apiConfig as any)?.headers,
          bodyTemplate: apiBodyTemplate ?? (cfg.apiConfig as any)?.bodyTemplate,
        },
        validationStatus: 'pending',
        validationMessage: null,
      },
    });

    res.json({ code: 200, message: 'API 配置已更新', data: toHostConfigResponse(updated) });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/rooms/:roomId/host-config/rules
 * 更新游戏规则
 */
router.post(
  '/:roomId/host-config/rules',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { roomId } = req.params;
      if (!userId) throw new AppError('Unauthorized', 401);
      const { gameRules } = req.body || {};

      await ensureRoomHost(roomId, userId);
      const cfg = await getOrCreateHostConfig(roomId, userId);
      const updated = await prisma.hostConfig.update({
        where: { id: cfg.id },
        data: {
          gameRules: gameRules ?? cfg.gameRules,
          validationStatus: 'pending',
          validationMessage: null,
        },
      });

      res.json({ code: 200, message: '规则已更新', data: toHostConfigResponse(updated) });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/rooms/:roomId/host-config/players
 * 更新玩家/实体配置
 */
router.post(
  '/:roomId/host-config/players',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { roomId } = req.params;
      if (!userId) throw new AppError('Unauthorized', 401);
      const {
        totalDecisionEntities,
        humanPlayerCount,
        aiPlayerCount,
        decisionTimeLimit,
        timeoutStrategy,
      } = req.body || {};

      await ensureRoomHost(roomId, userId);
      const total = Number(totalDecisionEntities ?? humanPlayerCount + aiPlayerCount);
      const human = Number(humanPlayerCount ?? 0);
      const ai = Number(aiPlayerCount ?? 0);
      const timeLimit = Number(decisionTimeLimit ?? 4);
      if (total <= 0 || human < 0 || ai < 0) throw new AppError('人数配置不合法', 400);
      if (human + ai > total)
        throw new AppError('人类+AI数量不能超过总决策实体数', 400);
      if (timeLimit <= 0) throw new AppError('决策时限必须大于0', 400);

      const cfg = await getOrCreateHostConfig(roomId, userId);
      const updated = await prisma.hostConfig.update({
        where: { id: cfg.id },
        data: {
          totalDecisionEntities: total,
          humanPlayerCount: human,
          aiPlayerCount: ai,
          decisionTimeLimit: timeLimit,
          timeoutStrategy: timeoutStrategy ?? cfg.timeoutStrategy,
          validationStatus: 'pending',
          validationMessage: null,
        },
      });

      // 同步更新房间的 maxPlayers
      await prisma.room.update({
        where: { id: roomId },
        data: { maxPlayers: total },
      });

      res.json({ code: 200, message: '玩家配置已更新', data: toHostConfigResponse(updated) });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/rooms/:roomId/host-config/validate
 * 标记验证状态
 */
router.post(
  '/:roomId/host-config/validate',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { roomId } = req.params;
      if (!userId) throw new AppError('Unauthorized', 401);
      const { status, message } = req.body || {};

      await ensureRoomHost(roomId, userId);
      const cfg = await getOrCreateHostConfig(roomId, userId);
      const updated = await prisma.hostConfig.update({
        where: { id: cfg.id },
        data: {
          validationStatus: status ?? 'validated',
          validationMessage: message ?? null,
          validatedAt: new Date(),
        },
      });

      res.json({ code: 200, message: '验证状态已更新', data: toHostConfigResponse(updated) });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/rooms/:roomId/host-config/complete
 * 完成主持人配置
 */
router.post(
  '/:roomId/host-config/complete',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { roomId } = req.params;
      if (!userId) throw new AppError('Unauthorized', 401);

      await ensureRoomHost(roomId, userId);
      const cfg = await getOrCreateHostConfig(roomId, userId);

      // 检查初始化数据是否已保存到 Redis
      const initKey = `game:init:${roomId}`;
      const initDataStr = await redis.get(initKey);
      
      if (!initDataStr) {
        // Redis 中没有数据，说明主持人没有生成或保存初始化数据
        throw new AppError('请先生成并保存游戏初始化数据', 400);
      }

      // 验证数据完整性
      let initData: any = null;
      try {
        initData = JSON.parse(initDataStr);
      } catch (e) {
        throw new AppError('初始化数据格式错误，请重新生成并保存', 400);
      }

      if (!initData.backgroundStory || !initData.entities || initData.entities.length === 0) {
        throw new AppError('初始化数据不完整，请重新生成并保存', 400);
      }

      const updated = await prisma.hostConfig.update({
        where: { id: cfg.id },
        data: {
          initializationCompleted: true,
          configurationCompletedAt: new Date(),
        },
      });

      res.json({ code: 200, message: '主持人初始化已完成', data: toHostConfigResponse(updated) });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
