import apiClient from './api';

export interface Strategy {
  id: string;
  userId: string;
  sessionId: string | null;
  strategyName: string;
  description: string | null;
  strategyData: Record<string, unknown>;
  effectiveness: Record<string, unknown> | null;
  winRate: number | null;
  averageScore: number | null;
  totalGames: number;
  totalWins: number;
  createdAt: string;
  updatedAt: string;
}

export interface StrategyAnalysis {
  id: string;
  strategyName: string;
  description: string | null;
  strategyData: Record<string, unknown>;
  effectiveness: Record<string, unknown> | null;
  statistics: {
    winRate: number;
    averageScore: number;
    totalGames: number;
    totalWins: number;
    totalLosses: number;
  };
  trends: {
    recentPerformance: Record<string, unknown>;
  };
  createdAt: string;
  updatedAt: string;
}

export const strategyAPI = {
  getStrategies: async (
    page: number = 1,
    limit: number = 10,
    sortBy: string = 'winRate',
    order: string = 'desc'
  ): Promise<{
    strategies: Strategy[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> => {
    const params: Record<string, string> = {
      page: String(page),
      limit: String(limit),
      sortBy,
      order,
    };
    const response = await apiClient.get('/user/strategies', { params });
    return response.data.data;
  },

  getStrategyAnalysis: async (strategyId: string): Promise<StrategyAnalysis> => {
    const response = await apiClient.get(`/user/strategies/${strategyId}/analysis`);
    return response.data.data;
  },

  createStrategy: async (payload: {
    strategyName: string;
    description?: string;
    strategyData: Record<string, unknown>;
    sessionId?: string;
    effectiveness?: Record<string, unknown>;
    winRate?: number;
    averageScore?: number;
    totalGames?: number;
    totalWins?: number;
  }): Promise<Strategy> => {
    const response = await apiClient.post('/user/strategies', payload);
    return response.data.data;
  },

  updateStrategy: async (
    strategyId: string,
    payload: {
      strategyName?: string;
      description?: string;
      strategyData?: Record<string, unknown>;
      effectiveness?: Record<string, unknown>;
      winRate?: number;
      averageScore?: number;
      totalGames?: number;
      totalWins?: number;
    }
  ): Promise<Strategy> => {
    const response = await apiClient.put(`/user/strategies/${strategyId}`, payload);
    return response.data.data;
  },
};

