/**
 * Auth store — persists ONLY the JWT token and current user to localStorage
 * under the key 'itab_auth'. This is the single localStorage dependency in
 * the entire app; all other data comes from the Render PostgreSQL backend.
 */
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
        // Token is stored only in Zustand persist (localStorage via middleware).
        // The api.ts interceptor reads from the store's persisted state key.
        set({ user, token, isAuthenticated: true });
      },

      logout: () => {
        // Only clear the auth token — all other data is in-memory only.
        try {
          localStorage.removeItem('itab_auth');
        } catch { /* ignore */ }
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
