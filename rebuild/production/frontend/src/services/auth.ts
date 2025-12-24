import apiClient from './api';

export interface RegisterData {
  username: string;
  password: string;
}

export interface LoginData {
  username: string;
  password: string;
}

export interface User {
  id: string;
  username: string;
  nickname?: string;
  avatarUrl?: string;
  level: number;
  experience: number;
}

export interface AuthResponse {
  token: string;
  user: User;
}

export const authAPI = {
  register: async (data: RegisterData): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/register', data);
    // Backend returns { code, message, data: { token, user } }
    return response.data;
  },

  login: async (data: LoginData): Promise<AuthResponse> => {
    const response = await apiClient.post('/auth/login', data);
    // Backend returns { code, message, data: { token, user } }
    return response.data;
  },

  refreshToken: async (): Promise<{ token: string }> => {
    const response = await apiClient.post('/auth/refresh');
    return response.data;
  },

  resetPassword: async (token: string, newPassword: string): Promise<void> => {
    await apiClient.post('/auth/reset-password', { token, newPassword });
  },
};

export const userAPI = {
  getUserInfo: async (): Promise<User> => {
    const response = await apiClient.get('/user/info');
    return response.data;
  },

  updateUserInfo: async (data: { nickname?: string }): Promise<User> => {
    const response = await apiClient.put('/user/info', data);
    return response.data;
  },

  uploadAvatar: async (file: File): Promise<User> => {
    const formData = new FormData();
    formData.append('avatar', file);
    const response = await apiClient.post('/user/avatar', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};
