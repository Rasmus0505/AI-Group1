/**
 * 游戏恢复服务 - 前端API
 */

import apiClient from './api';

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

export interface RecoveryStatusResponse {
  hasAnomalies: boolean;
  recoveryState: GameRecoveryState | null;
  canRecover: boolean;
}

export const gameRecoveryAPI = {
  /**
   * 检查游戏状态异常
   */
  checkStatus: async (sessionId: string): Promise<RecoveryStatusResponse> => {
    const response = await apiClient.get(`/game/${sessionId}/recovery/status`) as any;
    if (response?.code === 200 && response.data) {
      return response.data;
    }
    throw new Error(response?.message || '检查游戏状态失败');
  },

  /**
   * 执行恢复操作
   */
  executeRecovery: async (
    sessionId: string, 
    action: string
  ): Promise<{ success: boolean; message: string; newState?: any }> => {
    const response = await apiClient.post(`/game/${sessionId}/recovery/execute`, {
      action
    }) as any;
    
    return {
      success: response?.code === 200,
      message: response?.message || '恢复操作完成',
      newState: response?.data
    };
  },

  /**
   * 创建游戏快照
   */
  createSnapshot: async (sessionId: string): Promise<{ snapshotId: string }> => {
    const response = await apiClient.post(`/game/${sessionId}/recovery/snapshot`) as any;
    if (response?.code === 200 && response.data) {
      return response.data;
    }
    throw new Error(response?.message || '创建快照失败');
  }
};

export default gameRecoveryAPI;