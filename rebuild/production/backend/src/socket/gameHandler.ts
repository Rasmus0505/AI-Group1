import { Server } from 'socket.io';
import { AuthedSocket } from './authSocket';
import { logger } from '../utils/logger';
import { saveSessionState, getSessionState } from '../services/roomStateService';

interface RoundStageChangedPayload {
  sessionId: string;
  round: number;
  stage: string;
}

interface DecisionStatusUpdatePayload {
  sessionId: string;
  userId: string;
  status: string;
  details?: Record<string, unknown>;
}

// 简化版游戏处理器：广播回合阶段、决策状态，并落盘会话状态快照
export const registerGameHandler = (io: Server, socket: AuthedSocket): void => {
  // 回合阶段切换
  socket.on('round_stage_changed', async (payload: RoundStageChangedPayload, ack?: () => void) => {
    try {
      if (!payload?.sessionId) return;
      await saveSessionState(payload.sessionId, { lastStage: payload.stage, round: payload.round });
      io.to(payload.sessionId).emit('round_stage_changed', payload);
      if (ack) ack();
    } catch (error) {
      logger.error('round_stage_changed handler error', error);
      socket.emit('error', { code: 'ROUND_STAGE_FAILED', message: '回合阶段更新失败' });
    }
  });

  // 决策状态更新
  socket.on(
    'decision_status_update',
    async (payload: DecisionStatusUpdatePayload, ack?: () => void) => {
      try {
        if (!payload?.sessionId) return;
        io.to(payload.sessionId).emit('decision_status_update', payload);
        if (ack) ack();
      } catch (error) {
        logger.error('decision_status_update handler error', error);
        socket.emit('error', { code: 'DECISION_STATUS_FAILED', message: '决策状态更新失败' });
      }
    }
  );

  // 推演开始/完成通知
  socket.on('inference_started', (payload: { sessionId: string; info?: string }, ack?: () => void) => {
    if (!payload?.sessionId) return;
    io.to(payload.sessionId).emit('inference_started', payload);
    if (ack) ack?.();
  });

  socket.on(
    'inference_completed',
    (payload: { sessionId: string; result?: Record<string, unknown> }, ack?: () => void) => {
      if (!payload?.sessionId) return;
      io.to(payload.sessionId).emit('inference_completed', payload);
      ack?.();
    }
  );

  // 重连后同步会话状态
  socket.on('session_sync', async (payload: { sessionId: string }, ack?: (state: unknown) => void) => {
    try {
      if (!payload?.sessionId) return;
      const state = await getSessionState(payload.sessionId);
      socket.emit('session_state', state);
      ack?.(state);
    } catch (error) {
      logger.error('session_sync handler error', error);
      socket.emit('error', { code: 'SESSION_SYNC_FAILED', message: '会话状态同步失败' });
    }
  });

  // 获取增量更新
  socket.on('get_session_deltas', async (payload: { sessionId: string; fromVersion: number }, ack?: (deltas: unknown) => void) => {
    try {
      if (!payload?.sessionId) return;
      const deltas = await getSessionDeltas(payload.sessionId, payload.fromVersion);
      socket.emit('session_deltas', { sessionId: payload.sessionId, deltas });
      ack?.(deltas);
    } catch (error) {
      logger.error('get_session_deltas handler error', error);
      socket.emit('error', { code: 'GET_DELTAS_FAILED', message: '获取增量更新失败' });
    }
  });

  // Handle ping events for latency measurement
  socket.on('ping', (callback) => {
    if (typeof callback === 'function') {
      callback();
    }
  });

  // Alternative ping-pong implementation with timestamp
  socket.on('ping_with_timestamp', (timestamp: number, callback) => {
    if (typeof callback === 'function') {
      callback({ timestamp });
    }
  });
};


