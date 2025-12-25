import apiClient from './api';

export interface RoomSummary {
  id: string;
  name: string;
  status: string;
  maxPlayers: number;
  currentPlayers: number;
  hostId: string;
  hostName?: string;
  createdAt: string;
  isJoined?: boolean; // 问题2修复：用户是否在房间中
}

export interface RoomListResult {
  rooms: RoomSummary[];
  total: number;
  page: number;
  limit: number;
}

export interface CreateRoomPayload {
  name: string;
  maxPlayers?: number;
  gameMode?: string;
  password?: string;
}

export interface HostConfig {
  id: string;
  roomId: string;
  apiProvider?: string | null;
  apiEndpoint?: string | null;
  apiHeaders?: Record<string, unknown> | null;
  apiBodyTemplate?: Record<string, unknown> | null;
  apiConfig?: Record<string, unknown> | null;
  gameRules?: string | null;
  totalDecisionEntities: number;
  humanPlayerCount: number;
  aiPlayerCount: number;
  decisionTimeLimit: number;
  timeoutStrategy: string;
  validationStatus?: string;
  validationMessage?: string | null;
  validatedAt?: string | null;
  configurationCompletedAt?: string | null;
  initializationCompleted: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export const roomAPI = {
  list: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<RoomListResult> => {
    const response = await apiClient.get('/rooms/list', { params });
    return response.data;
  },

  create: async (payload: CreateRoomPayload): Promise<{ room_id: string }> => {
    const response = await apiClient.post('/rooms/create', payload);
    return response.data;
  },

  join: async (roomId: string, password?: string): Promise<void> => {
    await apiClient.post(`/rooms/${roomId}/join`, { password });
  },

  leave: async (roomId: string): Promise<void> => {
    await apiClient.post(`/rooms/${roomId}/leave`);
  },

  close: async (roomId: string): Promise<void> => {
    await apiClient.post(`/rooms/${roomId}/close`);
  },

  killGame: async (roomId: string): Promise<void> => {
    await apiClient.post(`/rooms/${roomId}/kill-game`);
  },
};

export const hostConfigAPI = {
  get: async (roomId: string): Promise<HostConfig> => {
    const response = await apiClient.get(`/rooms/${roomId}/host-config`);
    return response.data;
  },

  saveAll: async (roomId: string, payload: Partial<HostConfig>): Promise<HostConfig> => {
    const response = await apiClient.post(`/rooms/${roomId}/host-config`, payload);
    return response.data;
  },

  updateApi: async (
    roomId: string,
    payload: Pick<HostConfig, 'apiProvider' | 'apiEndpoint' | 'apiHeaders' | 'apiBodyTemplate'>
  ): Promise<HostConfig> => {
    const response = await apiClient.post(`/rooms/${roomId}/host-config/api`, payload);
    return response.data;
  },

  updateRules: async (
    roomId: string,
    payload: { gameRules?: string | null }
  ): Promise<HostConfig> => {
    const response = await apiClient.post(`/rooms/${roomId}/host-config/rules`, payload);
    return response.data;
  },

  updatePlayers: async (
    roomId: string,
    payload: Pick<
      HostConfig,
      | 'totalDecisionEntities'
      | 'humanPlayerCount'
      | 'aiPlayerCount'
      | 'decisionTimeLimit'
      | 'timeoutStrategy'
    >
  ): Promise<HostConfig> => {
    const response = await apiClient.post(`/rooms/${roomId}/host-config/players`, payload);
    return response.data;
  },

  validate: async (
    roomId: string,
    payload: { status?: string; message?: string }
  ): Promise<HostConfig> => {
    const response = await apiClient.post(`/rooms/${roomId}/host-config/validate`, payload);
    return response.data;
  },

  complete: async (roomId: string): Promise<HostConfig> => {
    const response = await apiClient.post(`/rooms/${roomId}/host-config/complete`);
    return response.data;
  },
};
