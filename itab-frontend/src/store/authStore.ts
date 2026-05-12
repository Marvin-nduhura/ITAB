import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, UserRole } from '../types';
import { api } from '../lib/api';

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  setAuth: (user: User, token: string) => void;
  logout: () => void;
  updateUser: (updates: Partial<User>) => void;
  hasRole: (...roles: UserRole[]) => boolean;
  syncWithBackend: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setAuth: (user, token) => {
        localStorage.setItem('itab_token', token);
        set({ user, token, isAuthenticated: true });
      },

      logout: () => {
        localStorage.removeItem('itab_token');
        localStorage.removeItem('itab_user');
        set({ user: null, token: null, isAuthenticated: false });
      },

      updateUser: (updates) => {
        const current = get().user;
        if (current) set({ user: { ...current, ...updates } });
      },

      hasRole: (...roles) => {
        const user = get().user;
        if (!user) return false;
        return roles.includes(user.role);
      },

      syncWithBackend: async () => {
        const { token, isAuthenticated } = get();
        if (!isAuthenticated || !token) return;
        try {
          const res = await api.get('/auth/me');
          const freshUser = res.data?.data as User;
          if (freshUser) {
            set({ user: freshUser });
          }
        } catch {
          // Backend unavailable — keep local state, no action needed
        }
      },
    }),
    {
      name: 'itab_auth',
      partialize: state => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
);
