import apiClient from './api';

export interface AdminUser {
  id: string;
  username: string;
  nickname?: string | null;
  status: string;
  createdAt: string;
  lastLoginAt?: string | null;
  online: boolean;
  room?: {
    id: string;
    name: string;
    status: string;
  } | null;
}

export interface AdminUserListResult {
  users: AdminUser[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminRoom {
  id: string;
  name: string;
  status: string;
  maxPlayers: number;
  currentPlayers: number;
  createdAt: string;
  startedAt?: string | null;
  finishedAt?: string | null;
  host?: {
    id?: string;
    username?: string;
    nickname?: string | null;
  } | null;
}

export interface AdminRoomListResult {
  rooms: AdminRoom[];
  total: number;
  page: number;
  limit: number;
}

export const adminAPI = {
  listUsers: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<AdminUserListResult> => {
    const response = await apiClient.get('/admin/users', { params });
    return response.data;
  },

  freezeUser: async (userId: string): Promise<void> => {
    await apiClient.post(`/admin/users/${userId}/freeze`);
  },

  unfreezeUser: async (userId: string): Promise<void> => {
    await apiClient.post(`/admin/users/${userId}/unfreeze`);
  },

  deleteUser: async (userId: string): Promise<void> => {
    await apiClient.delete(`/admin/users/${userId}`);
  },

  listRooms: async (params?: {
    page?: number;
    limit?: number;
    status?: string;
  }): Promise<AdminRoomListResult> => {
    const response = await apiClient.get('/admin/rooms', { params });
    return response.data;
  },

  closeRoom: async (roomId: string): Promise<void> => {
    await apiClient.post(`/admin/rooms/${roomId}/close`);
  },
};


