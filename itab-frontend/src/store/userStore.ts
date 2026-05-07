import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User } from '../types';
import { mockUsers } from '../lib/mockData';

interface UserStore {
  users: User[];
  suspendUser: (id: string, reason: string) => void;
  unsuspendUser: (id: string) => void;
  approveKYC: (id: string) => void;
  rejectKYC: (id: string) => void;
  updateUser: (id: string, updates: Partial<User>) => void;
  getUserById: (id: string) => User | undefined;
  isSuspended: (email: string) => { suspended: boolean; reason?: string };
}

export const useUserStore = create<UserStore>()(
  persist(
    (set, get) => ({
      users: mockUsers,

      suspendUser: (id, reason) => {
        set(s => ({
          users: s.users.map(u =>
            u.id === id
              ? { ...u, isSuspended: true, suspendedReason: reason, suspendedAt: new Date().toISOString() }
              : u
          ),
        }));
      },

      unsuspendUser: (id) => {
        set(s => ({
          users: s.users.map(u =>
            u.id === id
              ? { ...u, isSuspended: false, suspendedReason: undefined, suspendedAt: undefined }
              : u
          ),
        }));
      },

      approveKYC: (id) => {
        set(s => ({
          users: s.users.map(u =>
            u.id === id ? { ...u, kycStatus: 'approved', isVerified: true } : u
          ),
        }));
      },

      rejectKYC: (id) => {
        set(s => ({
          users: s.users.map(u =>
            u.id === id ? { ...u, kycStatus: 'rejected' } : u
          ),
        }));
      },

      updateUser: (id, updates) => {
        set(s => ({
          users: s.users.map(u =>
            u.id === id ? { ...u, ...updates, updatedAt: new Date().toISOString() } : u
          ),
        }));
      },

      getUserById: (id) => get().users.find(u => u.id === id),

      isSuspended: (email) => {
        const user = get().users.find(u => u.email === email);
        if (!user) return { suspended: false };
        return { suspended: !!user.isSuspended, reason: user.suspendedReason };
      },
    }),
    {
      name: 'itab_users',
      partialize: (s) => ({ users: s.users }),
      merge: (persisted: unknown, current) => {
        const p = persisted as Partial<UserStore>;
        const persistedUsers = p.users || [];
        // Merge: persisted state overrides mock data (preserves suspensions etc.)
        return {
          ...current,
          users: mockUsers.map(mu => {
            const saved = persistedUsers.find(pu => pu.id === mu.id);
            return saved ? { ...mu, ...saved } : mu;
          }),
        };
      },
    }
  )
);
