import { create } from 'zustand';
import { persist } from 'zustand/middleware';

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
        localStorage.setItem('token', token);
        set({ token, user: mappedUser, isAuthenticated: true });
      },
      logout: () => {
        localStorage.removeItem('token');
        set({ token: null, user: null, isAuthenticated: false });
      },
      setUser: (user: User) => {
        set({ user });
      },
      checkAuth: () => {
        const token = localStorage.getItem('token');
        if (token) {
          set({ token, isAuthenticated: true });
          return true;
        }
        return false;
      },
    }),
    {
      name: 'auth-storage',
    }
  )
);
