/**
 * User store — Render PostgreSQL is the ONLY source of truth.
 * No localStorage persistence. Data is loaded fresh from the backend on every
 * authenticated session via useBackendSync.
 */
import { create } from 'zustand';
import type { User, UserRole } from '../types';
import type { FullUserPermissions } from '../types/permissions';
import { generateId } from '../lib/utils';
import { usersApi, auditLogsApi } from '../lib/api';
import { apiSend } from '../lib/apiCall';

// ─── Default permissions per role — now in lib/defaultPermissions.ts ─────────
export { DEFAULT_PERMISSIONS as DEFAULT_ROLE_PERMISSIONS } from '../lib/defaultPermissions';

export type AuditAction =
  | 'user_suspended' | 'user_banned' | 'user_unsuspended' | 'user_invited' | 'user_registered'
  | 'kyc_approved' | 'kyc_rejected'
  | 'agent_approved' | 'agent_rejected'
  | 'dispute_raised' | 'dispute_resolved' | 'dispute_dismissed'
  | 'transaction_retried' | 'transaction_refunded'
  | 'property_created' | 'property_approved' | 'property_rejected'
  | 'inspection_booked'
  | 'maintenance_submitted'
  | 'payout_processed'
  | 'fee_config_updated' | 'announcement_sent'
  | 'login' | 'logout' | 'settings_changed';

export interface AuditLog {
  id: string;
  action: AuditAction;
  performedBy: string;       // user id
  performedByName: string;
  performedByRole: string;
  targetId?: string;         // user/property/transaction id affected
  targetName?: string;
  description: string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}

export interface AgentApplication {
  id: string;
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role?: string;              // 'agent' | 'property_manager' | 'landlord'
  nationalIdNumber?: string;
  nationalIdDoc?: string;     // base64 data URL of the National ID photo
  additionalDocs?: { name: string; dataUrl: string; type: string }[];
  experience: string;
  districts: string[];
  motivation: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote?: string;
  createdAt: string;
  reviewedAt?: string;
}

interface UserStore {
  users: User[];
  auditLogs: AuditLog[];
  agentApplications: AgentApplication[];

  // Sync setter (called by useBackendSync)
  setUsers: (users: User[]) => void;

  suspendUser: (id: string, reason: string, performedBy?: { id: string; name: string; role: string }) => void;
  banUser: (id: string, reason: string, performedBy?: { id: string; name: string; role: string }) => void;
  unsuspendUser: (id: string, performedBy?: { id: string; name: string; role: string }) => void;
  approveKYC: (id: string, performedBy?: { id: string; name: string; role: string }) => void;
  rejectKYC: (id: string, performedBy?: { id: string; name: string; role: string }) => void;
  updateUser: (id: string, updates: Partial<User>) => void;
  addUser: (user: User) => void;
  getUserById: (id: string) => User | undefined;
  isSuspended: (email: string) => { suspended: boolean; reason?: string };

  // New permission/district/role management
  updateUserPermissions: (id: string, permissions: FullUserPermissions) => void;
  updateUserDistricts: (id: string, districts: string[]) => void;
  changeUserRole: (id: string, role: UserRole) => void;
  getPendingApprovals: () => User[];
  approveUser: (id: string, performedBy?: { id: string; name: string; role: string }) => void;
  rejectUserApproval: (id: string, reason: string, performedBy?: { id: string; name: string; role: string }) => void;
  removeUser: (id: string) => void;

  // Audit logs
  addAuditLog: (log: Omit<AuditLog, 'id' | 'createdAt'>) => void;

  // Agent applications
  submitAgentApplication: (app: Omit<AgentApplication, 'id' | 'status' | 'createdAt'> | AgentApplication) => void;
  approveAgentApplication: (id: string, adminNote: string, performedBy: { id: string; name: string; role: string }) => void;
  rejectAgentApplication: (id: string, adminNote: string, performedBy: { id: string; name: string; role: string }) => void;
}

export const useUserStore = create<UserStore>()(
  (set, get) => ({
    users: [],
    auditLogs: [],
    agentApplications: [],

    // ── Sync setter ───────────────────────────────────────────────────────
    setUsers: (users) => set({ users }),

    suspendUser: (id, reason, performedBy) => {
      set(s => ({
        users: s.users.map(u =>
          u.id === id
            ? { ...u, isSuspended: true, suspendedReason: reason, suspendedAt: new Date().toISOString() }
            : u
        ),
      }));
      // Persist to Render DB
      apiSend(() => usersApi.suspend(id, reason));
      if (performedBy) {
        const target = get().users.find(u => u.id === id);
        get().addAuditLog({
          action: 'user_suspended',
          performedBy: performedBy.id,
          performedByName: performedBy.name,
          performedByRole: performedBy.role,
          targetId: id,
          targetName: target ? `${target.firstName} ${target.lastName}` : id,
          description: `Suspended user. Reason: ${reason}`,
          metadata: { reason },
        });
      }
    },

    banUser: (id, reason, performedBy) => {
      set(s => ({
        users: s.users.map(u =>
          u.id === id
            ? { ...u, isSuspended: true, suspendedReason: `[BANNED] ${reason}`, suspendedAt: new Date().toISOString(), isVerified: false }
            : u
        ),
      }));
      apiSend(() => usersApi.suspend(id, `[BANNED] ${reason}`));
      if (performedBy) {
        const target = get().users.find(u => u.id === id);
        get().addAuditLog({
          action: 'user_banned',
          performedBy: performedBy.id,
          performedByName: performedBy.name,
          performedByRole: performedBy.role,
          targetId: id,
          targetName: target ? `${target.firstName} ${target.lastName}` : id,
          description: `Permanently banned user. Reason: ${reason}`,
          metadata: { reason },
        });
      }
    },

    unsuspendUser: (id, performedBy) => {
      set(s => ({
        users: s.users.map(u =>
          u.id === id
            ? { ...u, isSuspended: false, suspendedReason: undefined, suspendedAt: undefined }
            : u
        ),
      }));
      apiSend(() => usersApi.unsuspend(id));
      if (performedBy) {
        const target = get().users.find(u => u.id === id);
        get().addAuditLog({
          action: 'user_unsuspended',
          performedBy: performedBy.id,
          performedByName: performedBy.name,
          performedByRole: performedBy.role,
          targetId: id,
          targetName: target ? `${target.firstName} ${target.lastName}` : id,
          description: `Reactivated user account`,
        });
      }
    },

    approveKYC: (id, performedBy) => {
      set(s => ({
        users: s.users.map(u =>
          u.id === id ? { ...u, kycStatus: 'approved', isVerified: true } : u
        ),
      }));
      apiSend(() => usersApi.update(id, { kycStatus: 'approved' }));
      if (performedBy) {
        const target = get().users.find(u => u.id === id);
        get().addAuditLog({
          action: 'kyc_approved',
          performedBy: performedBy.id,
          performedByName: performedBy.name,
          performedByRole: performedBy.role,
          targetId: id,
          targetName: target ? `${target.firstName} ${target.lastName}` : id,
          description: `KYC approved`,
        });
      }
    },

    rejectKYC: (id, performedBy) => {
      set(s => ({
        users: s.users.map(u =>
          u.id === id ? { ...u, kycStatus: 'rejected' } : u
        ),
      }));
      apiSend(() => usersApi.update(id, { kycStatus: 'rejected' }));
      if (performedBy) {
        const target = get().users.find(u => u.id === id);
        get().addAuditLog({
          action: 'kyc_rejected',
          performedBy: performedBy.id,
          performedByName: performedBy.name,
          performedByRole: performedBy.role,
          targetId: id,
          targetName: target ? `${target.firstName} ${target.lastName}` : id,
          description: `KYC rejected`,
        });
      }
    },

    updateUser: (id, updates) => {
      set(s => ({
        users: s.users.map(u =>
          u.id === id ? { ...u, ...updates, updatedAt: new Date().toISOString() } : u
        ),
      }));
    },

    addUser: (user) => {
      set(s => ({
        users: [user, ...s.users.filter(u => u.id !== user.id && u.email !== user.email)],
      }));
    },

    getUserById: (id) => get().users.find(u => u.id === id),

    isSuspended: (email) => {
      const user = get().users.find(u => u.email === email);
      if (!user) return { suspended: false };
      return { suspended: !!user.isSuspended, reason: user.suspendedReason };
    },

    updateUserPermissions: (id, permissions) => {
      set(s => ({
        users: s.users.map(u =>
          u.id === id ? { ...u, permissions, updatedAt: new Date().toISOString() } : u
        ),
      }));
      apiSend(() => usersApi.setPermissions(id, permissions));
    },

    updateUserDistricts: (id, districts) => {
      set(s => ({
        users: s.users.map(u =>
          u.id === id ? { ...u, restrictedDistricts: districts, updatedAt: new Date().toISOString() } : u
        ),
      }));
      apiSend(() => usersApi.setDistricts(id, districts));
    },

    changeUserRole: (id, role) => {
      set(s => ({
        users: s.users.map(u =>
          u.id === id ? { ...u, role, updatedAt: new Date().toISOString() } : u
        ),
      }));
      apiSend(() => usersApi.changeRole(id, role));
    },

    getPendingApprovals: () => {
      return get().users.filter(u => u.approvalStatus === 'pending');
    },

    approveUser: (id, performedBy) => {
      set(s => ({
        users: s.users.map(u =>
          u.id === id
            ? { ...u, approvalStatus: 'approved', kycStatus: 'approved', isVerified: true, updatedAt: new Date().toISOString() }
            : u
        ),
      }));
      apiSend(() => usersApi.approve(id));
      if (performedBy) {
        const target = get().users.find(u => u.id === id);
        get().addAuditLog({
          action: 'agent_approved',
          performedBy: performedBy.id,
          performedByName: performedBy.name,
          performedByRole: performedBy.role,
          targetId: id,
          targetName: target ? `${target.firstName} ${target.lastName}` : id,
          description: `User approved`,
        });
      }
    },

    rejectUserApproval: (id, reason, performedBy) => {
      set(s => ({
        users: s.users.map(u =>
          u.id === id
            ? { ...u, approvalStatus: 'rejected', notes: reason, updatedAt: new Date().toISOString() }
            : u
        ),
      }));
      apiSend(() => usersApi.rejectApproval(id, reason));
      if (performedBy) {
        const target = get().users.find(u => u.id === id);
        get().addAuditLog({
          action: 'agent_rejected',
          performedBy: performedBy.id,
          performedByName: performedBy.name,
          performedByRole: performedBy.role,
          targetId: id,
          targetName: target ? `${target.firstName} ${target.lastName}` : id,
          description: `User approval rejected. Reason: ${reason}`,
          metadata: { reason },
        });
      }
    },

    removeUser: (id) => {
      set(s => ({ users: s.users.filter(u => u.id !== id) }));
      apiSend(() => usersApi.delete(id));
    },

    addAuditLog: (log) => {
      const entry: AuditLog = {
        ...log,
        id: `audit_${generateId()}`,
        createdAt: new Date().toISOString(),
      };
      set(s => ({ auditLogs: [entry, ...s.auditLogs] }));
      // Persist to Render DB
      apiSend(() => auditLogsApi.log({
        action: log.action,
        performedByName: log.performedByName,
        performedByRole: log.performedByRole,
        targetId: log.targetId,
        targetName: log.targetName,
        description: log.description,
        metadata: log.metadata,
      }));
    },

    submitAgentApplication: (app) => {
      const base = app as Omit<AgentApplication, 'id' | 'status' | 'createdAt'> &
        Partial<Pick<AgentApplication, 'id' | 'status' | 'createdAt'>>;
      const newApp: AgentApplication = {
        ...base,
        id: base.id ?? `app_${generateId()}`,
        status: base.status ?? 'pending',
        createdAt: base.createdAt ?? new Date().toISOString(),
      };
      set(s => ({
        agentApplications: [
          newApp,
          ...s.agentApplications.filter(a => a.id !== newApp.id),
        ],
      }));
    },

    approveAgentApplication: (id, adminNote, performedBy) => {
      set(s => ({
        agentApplications: s.agentApplications.map(a =>
          a.id === id ? { ...a, status: 'approved', adminNote, reviewedAt: new Date().toISOString() } : a
        ),
      }));
      get().addAuditLog({
        action: 'agent_approved',
        performedBy: performedBy.id,
        performedByName: performedBy.name,
        performedByRole: performedBy.role,
        targetId: id,
        description: `Agent application approved. Note: ${adminNote}`,
        metadata: { adminNote },
      });
    },

    rejectAgentApplication: (id, adminNote, performedBy) => {
      set(s => ({
        agentApplications: s.agentApplications.map(a =>
          a.id === id ? { ...a, status: 'rejected', adminNote, reviewedAt: new Date().toISOString() } : a
        ),
      }));
      get().addAuditLog({
        action: 'agent_rejected',
        performedBy: performedBy.id,
        performedByName: performedBy.name,
        performedByRole: performedBy.role,
        targetId: id,
        description: `Agent application rejected. Reason: ${adminNote}`,
        metadata: { adminNote },
      });
    },
  })
);
