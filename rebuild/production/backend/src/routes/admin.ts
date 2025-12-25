import express from 'express';
import prisma from '../utils/db';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import { AppError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = express.Router();

// 简单的开发者校验：通过环境变量或硬编码的管理员用户名
// Support multiple developer usernames (for compatibility)
const isAdminUser = (req: AuthRequest) => {
  const adminUsername = process.env.ADMIN_USERNAME || 'developer';
  // Support multiple developer usernames: env variable, default 'developer', and legacy '开发者账号'
  const adminUsernames = [
    adminUsername,
    'developer',
    '开发者账号', // Legacy support for old data
  ];
  return req.username ? adminUsernames.includes(req.username) : false;
};

const requireAdmin = (req: AuthRequest) => {
  if (!isAdminUser(req)) {
    throw new AppError('只有开发者可以访问此接口', 403);
  }
};

/**
 * GET /api/admin/users
 * 查询在册用户列表
 */
router.get('/users', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    requireAdmin(req);

    const page = Number(req.query.page ?? 1) || 1;
    const limit = Number(req.query.limit ?? 20) || 20;
    const status = (req.query.status as string | undefined) || undefined; // active / frozen / all

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          username: true,
          nickname: true,
          status: true,
          createdAt: true,
          lastLoginAt: true,
          roomPlayers: {
            where: { status: { not: 'left' } },
            select: {
              room: {
                select: {
                  id: true,
                  name: true,
                  status: true,
                },
              },
            },
          },
        },
      }),
      prisma.user.count({ where }),
    ]);

    const items = users.map(u => {
      const activeRoom = u.roomPlayers[0]?.room;
      return {
        id: u.id,
        username: u.username,
        nickname: u.nickname,
        status: u.status,
        createdAt: u.createdAt,
        lastLoginAt: u.lastLoginAt,
        // 简化：是否在线先用 lastLoginAt 非空近似；如需更精确可接入 Socket/会话状态
        online: !!u.lastLoginAt,
        room: activeRoom
          ? {
            id: activeRoom.id,
            name: activeRoom.name,
            status: activeRoom.status,
          }
          : null,
      };
    });

    res.json({
      code: 200,
      data: {
        users: items,
        total,
        page,
        limit,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/users/:userId/freeze
 * 冻结/拉黑用户
 */
router.post('/users/:userId/freeze', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    requireAdmin(req);
    const { userId } = req.params;

    const user = await prisma.user.update({
      where: { id: userId },
      data: { status: 'frozen' },
      select: { id: true, username: true, status: true },
    });

    res.json({
      code: 200,
      message: '用户已冻结',
      data: user,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/users/:userId/unfreeze
 * 解冻用户
 */
router.post('/users/:userId/unfreeze', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    requireAdmin(req);
    const { userId } = req.params;

    const user = await prisma.user.update({
      where: { id: userId },
      data: { status: 'active' },
      select: { id: true, username: true, status: true },
    });

    res.json({
      code: 200,
      message: '用户已解冻',
      data: user,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * DELETE /api/admin/users/:userId
 * 物理删除用户
 */
router.delete('/users/:userId', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    requireAdmin(req);
    const { userId } = req.params;

    // 简单保护：不允许删除当前登录管理员自己
    if (req.userId === userId) {
      throw new AppError('Cannot delete the currently logged-in developer account', 400);
    }

    // 检查用户是否存在
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, username: true },
    });

    if (!user) {
      throw new AppError('用户不存在', 404);
    }

    // 使用事务处理删除，确保数据一致性
    // 注意：必须按照正确的顺序删除，避免外键约束冲突
    await prisma.$transaction(async (tx) => {
      // 1. 先删除该用户创建的临时事件（TemporaryEvent）
      //    这些事件可能关联到游戏会话，需要先删除
      await tx.temporaryEvent.deleteMany({
        where: { createdBy: userId },
      });

      // 2. 删除该用户的游戏操作记录（PlayerAction）
      //    这些操作关联到游戏会话和用户
      await tx.playerAction.deleteMany({
        where: { userId },
      });

      // 3. 删除该用户创建的主机配置（HostConfig）
      //    主机配置关联到房间，需要先删除
      await tx.hostConfig.deleteMany({
        where: { createdBy: userId },
      });

      // 4. 删除该用户在其他房间的参与记录（RoomPlayer）
      //    必须在删除房间之前删除，因为房间删除会级联删除 RoomPlayer
      await tx.roomPlayer.deleteMany({
        where: { userId },
      });

      // 5. 处理该用户作为 host 但不是 creator 的房间
      //    需要先转移 hostId 或删除房间
      const roomsAsHost = await tx.room.findMany({
        where: {
          hostId: userId,
          creatorId: { not: userId }, // 只处理不是创建者的房间
        },
        select: { id: true },
      });

      if (roomsAsHost.length > 0) {
        // 选项1: 将 hostId 转移给 creator（如果 creator 存在）
        // 选项2: 直接删除这些房间
        // 这里选择删除房间，因为 host 被删除后房间应该关闭
        await tx.room.deleteMany({
          where: {
            hostId: userId,
            creatorId: { not: userId },
          },
        });
      }

      // 6. 删除该用户创建或拥有的所有房间
      //    这会级联删除 RoomPlayer, HostConfig, GameSession 等
      await tx.room.deleteMany({
        where: {
          OR: [
            { creatorId: userId },
            { hostId: userId },
          ],
        },
      });

      // 7. 最后删除用户本身
      await tx.user.delete({
        where: { id: userId },
      });
    }, {
      timeout: 30000, // 30秒超时，防止长时间锁定
    });

    res.json({
      code: 200,
      message: '用户已删除',
      data: { id: userId },
    });
  } catch (error: any) {
    const userIdToLog = req.params.userId || 'unknown';
    // 改进错误处理，提供更详细的错误信息
    if (error.code === 'P2003') {
      // Prisma 外键约束错误
      logger.error(`删除用户失败 - 外键约束违反: ${error.meta?.field_name || 'unknown'}`, {
        userId: userIdToLog,
        error: error.message,
        meta: error.meta,
      });
      throw new AppError(
        `删除用户失败：存在关联数据。请先处理该用户创建的房间和相关数据。`,
        400,
        'FOREIGN_KEY_CONSTRAINT'
      );
    } else if (error.code === 'P2025') {
      // Prisma 记录不存在错误
      logger.error(`删除用户失败 - 记录不存在: ${userIdToLog}`, {
        userId: userIdToLog,
        error: error.message,
      });
      throw new AppError('用户不存在或已被删除', 404, 'RECORD_NOT_FOUND');
    } else {
      // 其他错误
      logger.error(`删除用户失败: ${error.message}`, {
        userId: userIdToLog,
        error: error.message,
        stack: error.stack,
        code: error.code,
      });
    }
    next(error);
  }
});

/**
 * GET /api/admin/rooms
 * 查询在线/活跃房间列表
 */
router.get('/rooms', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    requireAdmin(req);

    const page = Number(req.query.page ?? 1) || 1;
    const limit = Number(req.query.limit ?? 20) || 20;
    const status = (req.query.status as string | undefined) || undefined; // waiting/playing/closed/all

    const where: any = {};
    if (status && status !== 'all') {
      where.status = status;
    } else if (!status) {
      where.status = { in: ['waiting', 'playing'] };
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
          createdAt: true,
          startedAt: true,
          finishedAt: true,
          host: {
            select: {
              id: true,
              username: true,
              nickname: true,
            },
          },
        },
      }),
      prisma.room.count({ where }),
    ]);

    const items = rooms.map(room => ({
      id: room.id,
      name: room.name,
      status: room.status,
      maxPlayers: room.maxPlayers,
      currentPlayers: room.currentPlayers,
      createdAt: room.createdAt,
      startedAt: room.startedAt,
      finishedAt: room.finishedAt,
      host: {
        id: room.host?.id,
        username: room.host?.username,
        nickname: room.host?.nickname,
      },
    }));

    res.json({
      code: 200,
      data: {
        rooms: items,
        total,
        page,
        limit,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/admin/rooms/:roomId/close
 * 开发者强制关闭房间
 */
router.post('/rooms/:roomId/close', authenticateToken, async (req: AuthRequest, res, next) => {
  try {
    requireAdmin(req);
    const { roomId } = req.params;

    const room = await prisma.room.findUnique({ where: { id: roomId } });
    if (!room) {
      throw new AppError('房间不存在', 404);
    }

    if (room.status === 'closed' || room.status === 'finished') {
      res.json({
        code: 200,
        message: '房间已关闭',
        data: { room_id: roomId, status: room.status },
      });
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

    res.json({
      code: 200,
      message: '房间已关闭',
      data: { room_id: roomId, status: 'closed' },
    });
  } catch (error) {
    next(error);
  }
});

export default router;


