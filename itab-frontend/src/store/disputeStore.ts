import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Dispute, DisputeStatus } from '../types';
import { generateId } from '../lib/utils';

interface DisputeStore {
  disputes: Dispute[];
  raiseDispute: (dispute: Omit<Dispute, 'id' | 'status' | 'createdAt' | 'updatedAt'>) => Dispute;
  updateDisputeStatus: (id: string, status: DisputeStatus, resolution?: string, resolvedBy?: { id: string; name: string }) => void;
  getDisputesByUser: (userId: string) => Dispute[];
}

// Seed mock disputes
const seedDisputes: Dispute[] = [
  {
    id: 'd1', type: 'management_fee', status: 'open',
    raisedById: 'u3', raisedByName: 'John Ssemakula', raisedByRole: 'landlord',
    againstId: 'u2', againstName: 'Sarah Nakato', againstRole: 'property_manager',
    propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe',
    subject: 'Management fee charged incorrectly',
    description: 'The management fee deducted was 15% but the agreed rate was 10%. I have been overcharged for the last 3 months.',
    amount: 270000,
    createdAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 9 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'd2', type: 'payout_amount', status: 'under_review',
    raisedById: 'u3', raisedByName: 'John Ssemakula', raisedByRole: 'landlord',
    againstId: 'u2', againstName: 'Sarah Nakato', againstRole: 'property_manager',
    propertyId: 'p1', propertyTitle: '3-Bedroom Apartment in Kololo',
    subject: 'Payout not received for March',
    description: 'I have not received my payout for March 2024. The tenant paid on March 1st but I have not received anything.',
    amount: 2250000,
    createdAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: 'd3', type: 'property_condition', status: 'resolved',
    raisedById: 'u4', raisedByName: 'Grace Apio', raisedByRole: 'tenant',
    againstId: 'u2', againstName: 'Sarah Nakato', againstRole: 'property_manager',
    propertyId: 'p6', propertyTitle: '1-Bedroom Apartment in Entebbe',
    subject: 'Property not as described — no backup power',
    description: 'The property listing said it had backup power but there is no generator or solar system installed.',
    resolution: 'Manager agreed to install a solar backup system within 30 days. Tenant accepted resolution.',
    resolvedByName: 'Admin ITAB',
    createdAt: new Date(Date.now() - 20 * 24 * 60 * 60 * 1000).toISOString(),
    updatedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
    resolvedAt: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
  },
];

export const useDisputeStore = create<DisputeStore>()(
  persist(
    (set, get) => ({
      disputes: seedDisputes,

      raiseDispute: (data) => {
        const dispute: Dispute = {
          ...data,
          id: `d_${generateId()}`,
          status: 'open',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set(s => ({ disputes: [dispute, ...s.disputes] }));
        return dispute;
      },

      updateDisputeStatus: (id, status, resolution, resolvedBy) => {
        set(s => ({
          disputes: s.disputes.map(d =>
            d.id === id
              ? {
                  ...d,
                  status,
                  resolution: resolution || d.resolution,
                  resolvedById: resolvedBy?.id,
                  resolvedByName: resolvedBy?.name,
                  resolvedAt: (status === 'resolved' || status === 'dismissed') ? new Date().toISOString() : d.resolvedAt,
                  updatedAt: new Date().toISOString(),
                }
              : d
          ),
        }));
      },

      getDisputesByUser: (userId) =>
        get().disputes.filter(d => d.raisedById === userId || d.againstId === userId),
    }),
    {
      name: 'itab_disputes',
      partialize: (s) => ({ disputes: s.disputes }),
      merge: (persisted: unknown, current) => {
        const p = persisted as Partial<DisputeStore>;
        return { ...current, disputes: p.disputes?.length ? p.disputes : seedDisputes };
      },
    }
  )
);
