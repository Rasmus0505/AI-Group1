import { Router } from 'express';
import { authenticateToken, AuthRequest } from '../middleware/auth';
import prisma from '../utils/db';
import { AppError } from '../middleware/errorHandler';
import { io } from '../server';

const router = Router();

// 确保用户在房间中
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
 * GET /api/game/:sessionId/tasks
 * 获取任务列表
 */
router.get(
  '/:sessionId/tasks',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { sessionId } = req.params;
      if (!userId) throw new AppError('Unauthorized', 401);

      const { status, taskType } = req.query;

      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
      });
      if (!session) throw new AppError('游戏会话不存在', 404);

      await ensureRoomMembership(session.roomId, userId);

      const where: any = { sessionId };
      if (status) {
        where.status = status;
      }
      if (taskType) {
        where.taskType = taskType;
      }

      const tasks = await prisma.task.findMany({
        where,
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

      // 获取用户的任务进度
      const taskProgresses = await prisma.taskProgress.findMany({
        where: {
          userId,
          taskId: { in: tasks.map(t => t.id) },
        },
      });

      const progressMap = new Map(
        taskProgresses.map(p => [p.taskId, p])
      );

      const tasksWithProgress = tasks.map(task => {
        const progress = progressMap.get(task.id);
        return {
          id: task.id,
          sessionId: task.sessionId,
          title: task.title,
          description: task.description,
          taskType: task.taskType,
          difficulty: task.difficulty,
          requirements: task.requirements,
          rewards: task.rewards,
          status: task.status,
          progress: progress?.progress || task.progress,
          userProgress: progress ? {
            status: progress.status,
            progress: progress.progress,
            completedAt: progress.completedAt,
          } : null,
          createdBy: task.createdBy,
          creator: task.creator,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
          expiresAt: task.expiresAt,
          completedAt: task.completedAt,
        };
      });

      res.json({
        code: 200,
        data: {
          sessionId,
          tasks: tasksWithProgress,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * GET /api/game/:sessionId/tasks/:taskId
 * 获取任务详情
 */
router.get(
  '/:sessionId/tasks/:taskId',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { sessionId, taskId } = req.params;
      if (!userId) throw new AppError('Unauthorized', 401);

      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
      });
      if (!session) throw new AppError('游戏会话不存在', 404);

      await ensureRoomMembership(session.roomId, userId);

      const task = await prisma.task.findUnique({
        where: { id: taskId },
        include: {
          creator: {
            select: {
              id: true,
              username: true,
              nickname: true,
            },
          },
        },
      });

      if (!task) throw new AppError('任务不存在', 404);
      if (task.sessionId !== sessionId) {
        throw new AppError('任务不属于此会话', 400);
      }

      // 获取用户的任务进度
      const userProgress = await prisma.taskProgress.findUnique({
        where: {
          taskId_userId: {
            taskId,
            userId,
          },
        },
      });

      res.json({
        code: 200,
        data: {
          id: task.id,
          sessionId: task.sessionId,
          title: task.title,
          description: task.description,
          taskType: task.taskType,
          difficulty: task.difficulty,
          requirements: task.requirements,
          rewards: task.rewards,
          status: task.status,
          progress: task.progress,
          userProgress: userProgress ? {
            status: userProgress.status,
            progress: userProgress.progress,
            completedAt: userProgress.completedAt,
            updatedAt: userProgress.updatedAt,
          } : null,
          createdBy: task.createdBy,
          creator: task.creator,
          createdAt: task.createdAt,
          updatedAt: task.updatedAt,
          expiresAt: task.expiresAt,
          completedAt: task.completedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * POST /api/game/:sessionId/tasks
 * 创建任务（主持人专用）
 */
router.post(
  '/:sessionId/tasks',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { sessionId } = req.params;
      if (!userId) throw new AppError('Unauthorized', 401);

      const {
        title,
        description,
        taskType,
        difficulty,
        requirements,
        rewards,
        expiresAt,
      } = req.body || {};

      if (!title || !taskType) {
        throw new AppError('任务标题和类型不能为空', 400);
      }

      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: { room: true },
      });
      if (!session) throw new AppError('游戏会话不存在', 404);

      await ensureRoomHost(session.roomId, userId);

      const task = await prisma.task.create({
        data: {
          sessionId,
          title,
          description: description || null,
          taskType,
          difficulty: difficulty || 'normal',
          requirements: requirements || {},
          rewards: rewards || null,
          createdBy: userId,
          expiresAt: expiresAt ? new Date(expiresAt) : null,
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
      });

      // 广播任务创建通知
      io.to(session.roomId).emit('task_created', {
        sessionId,
        taskId: task.id,
        title: task.title,
        taskType: task.taskType,
        createdAt: task.createdAt,
      });

      res.json({
        code: 200,
        message: '任务已创建',
        data: {
          id: task.id,
          sessionId: task.sessionId,
          title: task.title,
          description: task.description,
          taskType: task.taskType,
          difficulty: task.difficulty,
          requirements: task.requirements,
          rewards: task.rewards,
          status: task.status,
          createdBy: task.createdBy,
          creator: task.creator,
          createdAt: task.createdAt,
          expiresAt: task.expiresAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * PUT /api/game/:sessionId/tasks/:taskId/progress
 * 更新任务进度
 */
router.put(
  '/:sessionId/tasks/:taskId/progress',
  authenticateToken,
  async (req: AuthRequest, res, next) => {
    try {
      const userId = req.userId;
      const { sessionId, taskId } = req.params;
      if (!userId) throw new AppError('Unauthorized', 401);

      const { progress, status } = req.body || {};

      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
      });
      if (!session) throw new AppError('游戏会话不存在', 404);

      await ensureRoomMembership(session.roomId, userId);

      const task = await prisma.task.findUnique({
        where: { id: taskId },
      });

      if (!task) throw new AppError('任务不存在', 404);
      if (task.sessionId !== sessionId) {
        throw new AppError('任务不属于此会话', 400);
      }

      // 检查任务是否已完成
      const isCompleted = checkTaskCompletion(task, progress || {});

      // 更新或创建任务进度
      const taskProgress = await prisma.taskProgress.upsert({
        where: {
          taskId_userId: {
            taskId,
            userId,
          },
        },
        update: {
          progress: (progress || {}) as any,
          status: isCompleted ? 'completed' : (status || 'in_progress'),
          completedAt: isCompleted ? new Date() : undefined,
          updatedAt: new Date(),
        },
        create: {
          taskId,
          userId,
          progress: (progress || {}) as any,
          status: isCompleted ? 'completed' : 'in_progress',
          completedAt: isCompleted ? new Date() : undefined,
        },
      });

      // 如果任务完成，更新任务状态并广播
      if (isCompleted && task.status !== 'completed') {
        await prisma.task.update({
          where: { id: taskId },
          data: {
            status: 'completed',
            completedAt: new Date(),
          },
        });

        io.to(session.roomId).emit('task_completed', {
          sessionId,
          taskId,
          userId,
          completedAt: taskProgress.completedAt,
        });
      }

      // 广播任务进度更新
      io.to(session.roomId).emit('task_progress_updated', {
        sessionId,
        taskId,
        userId,
        progress: taskProgress.progress,
        status: taskProgress.status,
      });

      res.json({
        code: 200,
        message: '任务进度已更新',
        data: {
          taskId,
          userId,
          progress: taskProgress.progress,
          status: taskProgress.status,
          completedAt: taskProgress.completedAt,
          updatedAt: taskProgress.updatedAt,
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

/**
 * 检查任务是否完成
 */
function checkTaskCompletion(
  task: { requirements: any; progress: any },
  userProgress: Record<string, unknown>
): boolean {
  const requirements = task.requirements as Record<string, unknown>;
  if (!requirements || typeof requirements !== 'object') {
    return false;
  }

  // 检查所有要求是否满足
  for (const [key, value] of Object.entries(requirements)) {
    const progressValue = (userProgress[key] as number) || 0;
    const requiredValue = (value as number) || 0;

    if (progressValue < requiredValue) {
      return false;
    }
  }

  return true;
}

export default router;

