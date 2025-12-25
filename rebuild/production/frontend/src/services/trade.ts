import api from './api';

export interface TradeResource {
  [key: string]: number | string | boolean;
}

export interface TradeRequest {
  targetId: string;
  offer: TradeResource;
  request: TradeResource;
  expiresInMinutes?: number;
}

export interface Trade {
  id: string;
  sessionId: string;
  round: number;
  initiator: {
    id: string;
    username: string;
    nickname: string;
  };
  target: {
    id: string;
    username: string;
    nickname: string;
  };
  resources: {
    offer: TradeResource;
    request: TradeResource;
  };
  status: 'pending' | 'accepted' | 'rejected' | 'expired' | 'cancelled';
  expiresAt: string;
  respondedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface TradeListResponse {
  code: number;
  data: {
    trades: Trade[];
  };
}

export interface TradeResponse {
  code: number;
  message: string;
  data: {
    trade: Trade;
  };
}

/**
 * 发起交易请求
 */
export const requestTrade = async (
  sessionId: string,
  tradeRequest: TradeRequest
): Promise<TradeResponse> => {
  const response = await api.post(`/game/${sessionId}/trade/request`, tradeRequest);
  return response.data;
};

/**
 * 响应交易请求（接受/拒绝）
 */
export const respondToTrade = async (
  sessionId: string,
  tradeId: string,
  action: 'accept' | 'reject'
): Promise<TradeResponse> => {
  const response = await api.post(`/game/${sessionId}/trade/${tradeId}/respond`, { action });
  return response.data;
};

/**
 * 获取交易列表
 */
export const getTradeList = async (
  sessionId: string,
  options?: {
    status?: string;
    round?: number;
  }
): Promise<TradeListResponse> => {
  const params = new URLSearchParams();
  if (options?.status) params.append('status', options.status);
  if (options?.round) params.append('round', options.round.toString());
  
  const queryString = params.toString();
  const url = `/game/${sessionId}/trade/list${queryString ? `?${queryString}` : ''}`;
  const response = await api.get(url);
  return response.data;
};

/**
 * 取消交易
 */
export const cancelTrade = async (
  sessionId: string,
  tradeId: string
): Promise<{ code: number; message: string }> => {
  const response = await api.delete(`/game/${sessionId}/trade/${tradeId}`);
  return response.data;
};

