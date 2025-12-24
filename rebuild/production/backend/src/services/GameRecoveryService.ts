/**
 * 游戏恢复服务
 * 处理AI中断、推演失败等异常情况的纠错机制
 */

import prisma from '../utils/db';
import redis from '../utils/redis';
import { logger } from '../utils/logger';
import { io } from '../server';
import { AppError } from '../middleware/errorHandler';

export interface GameRecoveryState {
  sessionId: string;
  currentRound: number;
  roundStatus: 'decision' | 'review' | 'inference' | 'result' | 'finished';
  lastValidState?: any;
  errorInfo?: {
    type: 'ai_timeout' | 'ai_error' | 'network_error' | 'data_corruption' | 'unknown';
    message: string;
    timestamp: string;
    attemptCount: number;
  };
  recoveryOptions: Array<{
    id: string;
    name: string;
    description: string;
    riskLevel: 'low' | 'medium' | 'high';
  }>;
}

export class GameRecoveryService {
  private static instance: GameRecoveryService;
  private recoveryTimeout = 300000; // 5分钟

  private constructor() {}

  static getInstance(): GameRecoveryService {
    if (!GameRecoveryService.instance) {
      GameRecoveryService.instance = new GameRecoveryService();
    }
    return GameRecoveryService.instance;
  }

  /**
   * 检测游戏状态异常
   */
  async detectGameStateAnomalies(sessionId: string): Promise<GameRecoveryState | null> {
    try {
      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: { room: true }
      });

      if (!session) {
        throw new AppError('游戏会话不存在', 404);
      }

      const now = new Date();
      const anomalies: GameRecoveryState['recoveryOptions'] = [];

      // 检查推演超时
      if (session.roundStatus === 'inference') {
        const inferenceStartTime = session.updatedAt;
        const timeDiff = now.getTime() - inferenceStartTime.getTime();
        
        if (timeDiff > this.recoveryTimeout) {
          anomalies.push({
            id: 'inference_timeout',
            name: '推演超时',
            description: 'AI推演已超过5分钟，可能需要重试或跳过',
            riskLevel: 'medium'
          });
        }
      }

      // 检查决策阶段超时
      if (session.roundStatus === 'decision' && session.decisionDeadline) {
        const deadline = new Date(session.decisionDeadline);
        if (now > deadline) {
          const decisions = await prisma.playerAction.count({
            where: {
              sessionId,
              round: session.currentRound,
              status: 'submitted'
            }
          });

          if (decisions === 0) {
            anomalies.push({
              id: 'no_decisions',
              name: '无玩家决策',
              description: '决策时限已过但无玩家提交决策',
              riskLevel: 'high'
            });
          }
        }
      }

      // 检查推演结果缺失
      if (session.roundStatus === 'result') {
        const resultKey = `inference:result:${sessionId}:${session.currentRound}`;
        const result = await redis.get(resultKey);
        
        if (!result) {
          anomalies.push({
            id: 'missing_result',
            name: '推演结果缺失',
            description: '游戏状态显示已完成推演，但结果数据缺失',
            riskLevel: 'high'
          });
        }
      }

      // 检查数据一致性
      const gameState = session.gameState as any;
      if (gameState && gameState.players) {
        const players = gameState.players;
        const brokenPlayers = players.filter((p: any) => p.cash < 0 && !p.broken);
        
        if (brokenPlayers.length > 0) {
          anomalies.push({
            id: 'data_inconsistency',
            name: '数据不一致',
            description: `发现${brokenPlayers.length}个玩家现金为负但未标记为破产`,
            riskLevel: 'medium'
          });
        }
      }

      if (anomalies.length === 0) {
        return null; // 无异常
      }

      // 获取最后有效状态
      const lastValidState = await this.getLastValidGameState(sessionId);

      return {
        sessionId,
        currentRound: session.currentRound,
        roundStatus: session.roundStatus as 'decision' | 'review' | 'inference' | 'result' | 'finished',
        lastValidState,
        recoveryOptions: anomalies
      };

    } catch (error: any) {
      logger.error('Failed to detect game state anomalies', {
        sessionId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * 执行游戏恢复操作
   */
  async executeRecovery(
    sessionId: string, 
    recoveryAction: string, 
    hostId: string
  ): Promise<{ success: boolean; message: string; newState?: any }> {
    try {
      // 验证主持人权限
      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: { room: true }
      });

      if (!session || session.room.hostId !== hostId) {
        throw new AppError('只有主持人可以执行恢复操作', 403);
      }

      logger.info(`Executing recovery action: ${recoveryAction}`, { sessionId, hostId });

      switch (recoveryAction) {
        case 'retry_inference':
          return await this.retryInference(sessionId);
          
        case 'skip_round':
          return await this.skipCurrentRound(sessionId);
          
        case 'rollback_round':
          return await this.rollbackToPreviousRound(sessionId);
          
        case 'force_next_round':
          return await this.forceNextRound(sessionId);
          
        case 'reset_to_decision':
          return await this.resetToDecisionPhase(sessionId);
          
        case 'fix_data_inconsistency':
          return await this.fixDataInconsistency(sessionId);
          
        default:
          throw new AppError('未知的恢复操作', 400);
      }

    } catch (error: any) {
      logger.error('Recovery operation failed', {
        sessionId,
        recoveryAction,
        error: error.message
      });
      
      return {
        success: false,
        message: error.message || '恢复操作失败'
      };
    }
  }

  /**
   * 重试AI推演
   */
  private async retryInference(sessionId: string): Promise<{ success: boolean; message: string }> {
    try {
      // 清除之前的推演结果
      const resultKey = `inference:result:${sessionId}`;
      await redis.del(`${resultKey}:*`);

      // 重置游戏状态为审核阶段
      const session = await prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          roundStatus: 'review',
          updatedAt: new Date()
        }
      });

      // 通知前端状态变化
      io.to(session.roomId).emit('game_state_update', {
        sessionId,
        roundStatus: 'review',
        message: '主持人已重置推演，请重新提交给AI'
      });

      logger.info('Inference retry prepared', { sessionId });

      return {
        success: true,
        message: '已重置到审核阶段，请重新提交给AI推演'
      };

    } catch (error: any) {
      throw new Error(`重试推演失败: ${error.message}`);
    }
  }

  /**
   * 跳过当前回合
   */
  private async skipCurrentRound(sessionId: string): Promise<{ success: boolean; message: string }> {
    try {
      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId }
      });

      if (!session) {
        throw new Error('游戏会话不存在');
      }

      // 更新到下一回合
      const nextRound = session.currentRound + 1;
      const newDeadline = new Date(Date.now() + 5 * 60 * 1000); // 5分钟后

      await prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          currentRound: nextRound,
          roundStatus: 'decision',
          decisionDeadline: newDeadline,
          updatedAt: new Date()
        }
      });

      // 通知前端
      io.to(session.roomId).emit('round_changed', {
        sessionId,
        previousRound: session.currentRound,
        currentRound: nextRound,
        roundStatus: 'decision'
      });

      logger.info('Round skipped', { sessionId, skippedRound: session.currentRound, nextRound });

      return {
        success: true,
        message: `已跳过第${session.currentRound}回合，进入第${nextRound}回合`
      };

    } catch (error: any) {
      throw new Error(`跳过回合失败: ${error.message}`);
    }
  }

  /**
   * 回滚到上一回合
   */
  private async rollbackToPreviousRound(sessionId: string): Promise<{ success: boolean; message: string }> {
    try {
      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId }
      });

      if (!session || session.currentRound <= 1) {
        throw new Error('无法回滚到上一回合');
      }

      const previousRound = session.currentRound - 1;
      
      // 恢复上一回合的游戏状态
      const lastValidState = await this.getLastValidGameState(sessionId, previousRound);
      
      await prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          currentRound: previousRound,
          roundStatus: 'result',
          gameState: lastValidState,
          updatedAt: new Date()
        }
      });

      // 删除当前回合的决策记录
      await prisma.playerAction.deleteMany({
        where: {
          sessionId,
          round: session.currentRound
        }
      });

      // 通知前端
      io.to(session.roomId).emit('game_state_update', {
        sessionId,
        currentRound: previousRound,
        roundStatus: 'result',
        message: '已回滚到上一回合'
      });

      logger.info('Game rolled back', { sessionId, fromRound: session.currentRound, toRound: previousRound });

      return {
        success: true,
        message: `已回滚到第${previousRound}回合`
      };

    } catch (error: any) {
      throw new Error(`回滚失败: ${error.message}`);
    }
  }

  /**
   * 强制进入下一回合
   */
  private async forceNextRound(sessionId: string): Promise<{ success: boolean; message: string }> {
    try {
      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId }
      });

      if (!session) {
        throw new Error('游戏会话不存在');
      }

      const nextRound = session.currentRound + 1;
      const newDeadline = new Date(Date.now() + 5 * 60 * 1000);

      // 创建默认的推演结果
      const defaultResult = {
        sessionId,
        round: session.currentRound,
        status: 'completed',
        result: {
          narrative: `第${session.currentRound}回合因技术问题被跳过，游戏继续进行。`,
          outcomes: [],
          events: []
        },
        completedAt: new Date().toISOString()
      };

      // 保存默认结果
      const resultKey = `inference:result:${sessionId}:${session.currentRound}`;
      await redis.set(resultKey, JSON.stringify(defaultResult), 'EX', 86400);

      // 更新游戏状态
      await prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          currentRound: nextRound,
          roundStatus: 'decision',
          decisionDeadline: newDeadline,
          updatedAt: new Date()
        }
      });

      // 通知前端
      io.to(session.roomId).emit('round_changed', {
        sessionId,
        previousRound: session.currentRound,
        currentRound: nextRound,
        roundStatus: 'decision'
      });

      logger.info('Forced to next round', { sessionId, fromRound: session.currentRound, toRound: nextRound });

      return {
        success: true,
        message: `已强制进入第${nextRound}回合`
      };

    } catch (error: any) {
      throw new Error(`强制进入下一回合失败: ${error.message}`);
    }
  }

  /**
   * 重置到决策阶段
   */
  private async resetToDecisionPhase(sessionId: string): Promise<{ success: boolean; message: string }> {
    try {
      const newDeadline = new Date(Date.now() + 5 * 60 * 1000);

      const session = await prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          roundStatus: 'decision',
          decisionDeadline: newDeadline,
          updatedAt: new Date()
        }
      });

      // 通知前端
      io.to(session.roomId).emit('game_state_update', {
        sessionId,
        roundStatus: 'decision',
        decisionDeadline: newDeadline.toISOString(),
        message: '已重置到决策阶段'
      });

      logger.info('Reset to decision phase', { sessionId });

      return {
        success: true,
        message: '已重置到决策阶段，玩家可以重新提交决策'
      };

    } catch (error: any) {
      throw new Error(`重置到决策阶段失败: ${error.message}`);
    }
  }

  /**
   * 修复数据不一致问题
   */
  private async fixDataInconsistency(sessionId: string): Promise<{ success: boolean; message: string }> {
    try {
      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId }
      });

      if (!session || !session.gameState) {
        throw new Error('无法获取游戏状态');
      }

      const gameState = session.gameState as any;
      let fixedCount = 0;

      if (gameState.players && Array.isArray(gameState.players)) {
        gameState.players.forEach((player: any) => {
          // 修复破产状态
          if (player.cash < 0 && !player.broken) {
            player.broken = true;
            player.bankruptReason = '现金流断裂';
            fixedCount++;
          }

          // 修复属性范围
          if (player.attributes) {
            Object.keys(player.attributes).forEach(key => {
              if (player.attributes[key] < 0) {
                player.attributes[key] = 0;
                fixedCount++;
              }
              if (player.attributes[key] > 100) {
                player.attributes[key] = 100;
                fixedCount++;
              }
            });
          }
        });
      }

      // 保存修复后的状态
      await prisma.gameSession.update({
        where: { id: sessionId },
        data: {
          gameState,
          updatedAt: new Date()
        }
      });

      // 通知前端
      io.to(session.roomId).emit('game_state_update', {
        sessionId,
        gameState,
        message: '数据不一致问题已修复'
      });

      logger.info('Data inconsistency fixed', { sessionId, fixedCount });

      return {
        success: true,
        message: `已修复${fixedCount}个数据不一致问题`
      };

    } catch (error: any) {
      throw new Error(`修复数据不一致失败: ${error.message}`);
    }
  }

  /**
   * 获取最后有效的游戏状态
   */
  private async getLastValidGameState(sessionId: string, round?: number): Promise<any> {
    try {
      // 尝试从Redis获取推演结果
      const targetRound = round || await this.getLastCompletedRound(sessionId);
      const resultKey = `inference:result:${sessionId}:${targetRound}`;
      const result = await redis.get(resultKey);
      
      if (result) {
        const parsed = JSON.parse(result);
        return parsed.result;
      }

      // 从数据库获取
      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId }
      });

      return session?.gameState || null;

    } catch (error: any) {
      logger.warn('Failed to get last valid game state', {
        sessionId,
        error: error.message
      });
      return null;
    }
  }

  /**
   * 获取最后完成的回合数
   */
  private async getLastCompletedRound(sessionId: string): Promise<number> {
    const session = await prisma.gameSession.findUnique({
      where: { id: sessionId }
    });

    if (!session) return 1;

    // 如果当前回合状态是result，说明当前回合已完成
    if (session.roundStatus === 'result') {
      return session.currentRound;
    }

    // 否则返回上一回合
    return Math.max(1, session.currentRound - 1);
  }

  /**
   * 创建游戏状态快照
   */
  async createGameSnapshot(sessionId: string): Promise<string> {
    try {
      const session = await prisma.gameSession.findUnique({
        where: { id: sessionId },
        include: {
          room: true,
          events: true
        }
      });

      if (!session) {
        throw new Error('游戏会话不存在');
      }

      // Get actions separately to avoid circular reference
      const actions = await prisma.playerAction.findMany({
        where: { 
          sessionId,
          round: { lte: session.currentRound || 1 } 
        }
      });

      const snapshot = {
        sessionId,
        timestamp: new Date().toISOString(),
        gameSession: session,
        gameState: session.gameState,
        currentRound: session.currentRound,
        roundStatus: session.roundStatus,
        actions
      };

      const snapshotId = `snapshot:${sessionId}:${Date.now()}`;
      await redis.set(snapshotId, JSON.stringify(snapshot), 'EX', 86400 * 7); // 保存7天

      logger.info('Game snapshot created', { sessionId, snapshotId });

      return snapshotId;

    } catch (error: any) {
      logger.error('Failed to create game snapshot', {
        sessionId,
        error: error.message
      });
      throw error;
    }
  }
}

export const gameRecoveryService = GameRecoveryService.getInstance();