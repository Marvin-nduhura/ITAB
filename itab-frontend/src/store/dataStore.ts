/**
 * useDataStore — lightweight Zustand store for entities that don't have
 * dedicated stores. Populated by useBackendSync on every sync cycle.
 * Persisted locally so the app works offline.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Inspection,
  Payment,
  PlatformTransaction,
  MaintenanceRequest,
  Payout,
  VendorJob,
  TenantNotice,
  Dispute,
  Conversation,
  Message,
} from '../types';
import type { Document } from './documentStore';

interface DataStore {
  // ── Entity collections ──────────────────────────────────────────────────────
  inspections: Inspection[];
  payments: Payment[];
  transactions: PlatformTransaction[];
  maintenance: MaintenanceRequest[];
  payouts: Payout[];
  vendorJobs: VendorJob[];
  documents: Document[];
  notices: TenantNotice[];
  disputes: Dispute[];
  announcements: unknown[];
  agentApplications: unknown[];
  auditLogs: unknown[];
  conversations: Conversation[];
  messages: Record<string, Message[]>; // keyed by conversationId

  // ── Setters ─────────────────────────────────────────────────────────────────
  setInspections: (items: Inspection[]) => void;
  setPayments: (items: Payment[]) => void;
  setTransactions: (items: PlatformTransaction[]) => void;
  setMaintenance: (items: MaintenanceRequest[]) => void;
  setPayouts: (items: Payout[]) => void;
  setVendorJobs: (items: VendorJob[]) => void;
  setDocuments: (items: Document[]) => void;
  setNotices: (items: TenantNotice[]) => void;
  setDisputes: (items: Dispute[]) => void;
  setAnnouncements: (items: unknown[]) => void;
  setAgentApplications: (items: unknown[]) => void;
  setAuditLogs: (items: unknown[]) => void;
  setConversations: (items: Conversation[]) => void;
  setMessages: (convId: string, msgs: Message[]) => void;
  addMessage: (convId: string, msg: Message) => void;
}

export const useDataStore = create<DataStore>()(
  persist(
    (set) => ({
      // ── Initial state ────────────────────────────────────────────────────────
      inspections: [],
      payments: [],
      transactions: [],
      maintenance: [],
      payouts: [],
      vendorJobs: [],
      documents: [],
      notices: [],
      disputes: [],
      announcements: [],
      agentApplications: [],
      auditLogs: [],
      conversations: [],
      messages: {},

      // ── Setters ──────────────────────────────────────────────────────────────
      setInspections:      (items) => set({ inspections: items }),
      setPayments:         (items) => set({ payments: items }),
      setTransactions:     (items) => set({ transactions: items }),
      setMaintenance:      (items) => set({ maintenance: items }),
      setPayouts:          (items) => set({ payouts: items }),
      setVendorJobs:       (items) => set({ vendorJobs: items }),
      setDocuments:        (items) => set({ documents: items }),
      setNotices:          (items) => set({ notices: items }),
      setDisputes:         (items) => set({ disputes: items }),
      setAnnouncements:    (items) => set({ announcements: items }),
      setAgentApplications:(items) => set({ agentApplications: items }),
      setAuditLogs:        (items) => set({ auditLogs: items }),
      setConversations:    (items) => set({ conversations: items }),

      setMessages: (convId, msgs) =>
        set((s) => ({ messages: { ...s.messages, [convId]: msgs } })),

      addMessage: (convId, msg) =>
        set((s) => ({
          messages: {
            ...s.messages,
            [convId]: [...(s.messages[convId] ?? []), msg],
          },
        })),
    }),
    {
      name: 'itab_data',
      // Persist everything — backend will overwrite on next sync
      partialize: (s) => ({
        inspections:      s.inspections,
        payments:         s.payments,
        transactions:     s.transactions,
        maintenance:      s.maintenance,
        payouts:          s.payouts,
        vendorJobs:       s.vendorJobs,
        documents:        s.documents,
        notices:          s.notices,
        disputes:         s.disputes,
        announcements:    s.announcements,
        agentApplications:s.agentApplications,
        auditLogs:        s.auditLogs,
        conversations:    s.conversations,
        messages:         s.messages,
      }),
    }
  )
);
