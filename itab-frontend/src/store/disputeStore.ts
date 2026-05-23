/**
 * Dispute store — Render DB is the ONLY source of truth.
 * No localStorage persistence. Data is loaded fresh from the backend on every
 * authenticated session via useBackendSync.
 */
import { create } from 'zustand';
import type { Dispute, DisputeStatus } from '../types';
import { generateId } from '../lib/utils';
import { disputesApi } from '../lib/api';
import { apiCall, apiSend } from '../lib/apiCall';

interface DisputeStore {
  disputes: Dispute[];

  // Sync setter — called by useBackendSync
  setDisputes: (disputes: Dispute[]) => void;

  // CRUD
  raiseDispute:       (dispute: Omit<Dispute, 'id' | 'status' | 'createdAt' | 'updatedAt'>) => Promise<Dispute>;
  updateDisputeStatus:(id: string, status: DisputeStatus, resolution?: string, resolvedBy?: { id: string; name: string }) => Promise<void>;

  // Queries
  getDisputesByUser: (userId: string) => Dispute[];
}

export const useDisputeStore = create<DisputeStore>()(
  (set, get) => ({
    disputes: [],

    setDisputes: (disputes) => set({ disputes }),

    raiseDispute: async (data) => {
      const dispute: Dispute = {
        ...data,
        id: `d_${generateId()}`,
        status: 'open',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      // Optimistic
      set(s => ({ disputes: [dispute, ...s.disputes] }));

      const saved = await apiCall<Dispute>(
        'dispute', 'create',
        () => disputesApi.raise(dispute) as Promise<{ data: { data: Dispute } }>,
        dispute as unknown as Record<string, unknown>
      );
      if (saved && saved.id !== dispute.id) {
        set(s => ({ disputes: s.disputes.map(d => d.id === dispute.id ? { ...d, ...saved } : d) }));
        return saved;
      }
      return dispute;
    },

    updateDisputeStatus: async (id, status, resolution, resolvedBy) => {
      set(s => ({
        disputes: s.disputes.map(d =>
          d.id === id ? {
            ...d, status,
            resolution: resolution || d.resolution,
            resolvedById: resolvedBy?.id,
            resolvedByName: resolvedBy?.name,
            resolvedAt: (status === 'resolved' || status === 'dismissed') ? new Date().toISOString() : d.resolvedAt,
            updatedAt: new Date().toISOString(),
          } : d
        ),
      }));

      if (status === 'resolved' && resolution) {
        await apiSend(() => disputesApi.resolve(id, resolution));
      } else if (status === 'dismissed') {
        await apiSend(() => disputesApi.dismiss(id));
      }
    },

    getDisputesByUser: (userId) =>
      get().disputes.filter(d => d.raisedById === userId || d.againstId === userId),
  })
);
