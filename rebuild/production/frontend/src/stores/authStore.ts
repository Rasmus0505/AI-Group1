import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  clearAuthSession,
  getStoredToken,
  isTokenExpired,
  setStoredToken,
} from '../utils/authSession';

interface User {
  id?: string;
  userId?: string;
  username: string;
  nickname?: string;
  avatarUrl?: string;
  level?: number;
  experience?: number;
}

interface AuthState {
  isAuthenticated: boolean;
  user: User | null;
  token: string | null;
  login: (token: string, user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
  checkAuth: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, _get) => ({
      isAuthenticated: false,
      user: null,
      token: null,
      login: (token: string, user: User) => {
        const mappedUser: User = {
          ...user,
          userId: user.userId ?? user.id,
        };
        setStoredToken(token);
        set({ token, user: mappedUser, isAuthenticated: true });
      },
      logout: () => {
        clearAuthSession();
        set({ token: null, user: null, isAuthenticated: false });
      },
      setUser: (user: User) => {
        set({ user });
      },
      checkAuth: () => {
        const token = getStoredToken();
        if (token && !isTokenExpired(token)) {
          set({ token, isAuthenticated: true });
          return true;
        }
        clearAuthSession();
        set({ token: null, user: null, isAuthenticated: false });
        return false;
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
