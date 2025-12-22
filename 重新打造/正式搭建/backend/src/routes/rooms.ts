import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import prisma from '../utils/db';
import { logger } from '../utils/logger';
import { io } from '../server';

const router = Router();

// helpers
const parsePositiveInt = (value: any, fallback: number) => {
  const n = Number(value);
  if (Number.isNaN(n) || n <= 0) return fallback;
  return Math.floor(n);
};

const ensureRoomHost = async (roomId: string, userId: string) => {
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

  return prisma.hostConfig.create({
    data: {
      roomId,
      createdBy: userId,
      apiConfig: {},
      apiProvider: null,
      apiEndpoint: null,
      apiHeaders: null,
      apiBodyTemplate: null,
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
router.get('/list', async (req, res, next) => {
  try {
    const page = parsePositiveInt(req.query.page, 1);
    const limit = parsePositiveInt(req.query.limit, 20);
    const status = req.query.status as string | undefined;

    const where = status ? { status: status.toString() } : {};
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

    const withHostName = rooms.map(room => {
      const { host, ...rest } = room;
      return {
        ...rest,
        hostName: host?.nickname || host?.username || '',
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

    const { roomId } = req.params;
    const { password } = req.body || {};

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) throw new AppError('房间不存在', 404);

    if (room.password && room.password !== password) {
      throw new AppError('房间密码错误', 403);
    }

    if (room.currentPlayers >= room.maxPlayers) {
      throw new AppError('房间已满员', 403);
    }

    const existing = await prisma.roomPlayer.findFirst({
      where: { roomId, userId },
    });

    if (existing && existing.status !== 'left') {
      throw new AppError('已在房间中', 400);
    }

    if (existing) {
      await prisma.roomPlayer.update({
        where: { id: existing.id },
        data: { status: 'joined', role: existing.role ?? 'human_player' },
      });
    } else {
      await prisma.roomPlayer.create({
        data: {
          roomId,
          userId,
          role: 'human_player',
          status: 'joined',
          isHuman: true,
        },
      });
    }

    await prisma.room.update({
      where: { id: roomId },
      data: { currentPlayers: { increment: 1 } },
    });

    try {
      io.to(roomId).emit('player_joined', { roomId, userId });
    } catch (emitErr) {
      logger.warn('emit player_joined failed', emitErr);
    }

    res.json({ code: 200, message: '加入房间成功' });
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
    if (human + ai !== total) throw new AppError('totalDecisionEntities 必须等于人类+AI数量', 400);
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
      if (human + ai !== total)
        throw new AppError('totalDecisionEntities 必须等于人类+AI数量', 400);
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
