/**
 * useBackendSync — keeps ALL frontend stores in sync with the Render PostgreSQL database.
 *
 * Strategy:
 * 1. On mount (and on reconnect), fetch fresh data from the backend via bulkSync.
 * 2. Overwrite local Zustand stores — backend is always source of truth.
 * 3. If the backend is unreachable, the app continues with cached local data.
 * 4. When the user comes back online, re-sync immediately.
 * 5. Poll every 30 seconds while online and authenticated.
 *
 * No localStorage is used for data — only the Zustand persist middleware
 * writes to localStorage as a cache, and the backend always wins on next sync.
 */

import { useEffect, useRef, useCallback } from 'react';
import { useAuthStore } from '../store/authStore';
import { usePropertyStore } from '../store/propertyStore';
import { useNotificationStore } from '../store/notificationStore';
import { useUIStore } from '../store/uiStore';
import { useDataStore } from '../store/dataStore';
import { useVendorStore } from '../store/vendorStore';
import { useUserStore } from '../store/userStore';
import { usePaymentStore } from '../store/paymentStore';
import { useDocumentStore } from '../store/documentStore';
import { useDisputeStore } from '../store/disputeStore';
import {
  syncApi,
  propertiesApi,
  usersApi,
  auditLogsApi,
  agentApplicationsApi,
  messagesApi,
  contractsApi,
} from '../lib/api';
import type {
  Property,
  Inspection,
  Payment,
  PlatformTransaction,
  MaintenanceRequest,
  Payout,
  Vendor,
  VendorJob,
  TenantNotice,
  Dispute,
  Notification,
  Conversation,
  Message,
  User,
} from '../types';
import type { Document } from '../store/documentStore';

const SYNC_INTERVAL_MS = 30_000;

export function useBackendSync() {
  const { isAuthenticated, user, syncWithBackend } = useAuthStore();
  const { setProperties } = usePropertyStore();
  const { setNotifications } = useNotificationStore();
  const { isOnline } = useUIStore();
  const { setVendors, setJobs: setVendorJobsStore } = useVendorStore();
  const { setUsers } = useUserStore();
  const { setTransactions: setPaymentStoreTxs, setContracts } = usePaymentStore();
  const { setDocuments: setDocumentStoreDocs } = useDocumentStore();
  const { setDisputes: setDisputeStoreDis } = useDisputeStore();
  const {
    setInspections,
    setPayments,
    setTransactions,
    setMaintenance,
    setPayouts,
    setVendorJobs,
    setDocuments,
    setNotices,
    setDisputes,
    setAnnouncements,
    setAgentApplications,
    setAuditLogs,
    setConversations,
    setMessages,
  } = useDataStore();

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSyncing = useRef(false);
  const publicFetched = useRef(false);

  function asArray<T>(val: unknown): T[] {
    return Array.isArray(val) ? (val as T[]) : [];
  }

  // Fetch public (published) properties for guests — runs once regardless of auth.
  // This ensures the Search/Landing page shows listings even before login.
  const fetchPublicProperties = useCallback(async () => {
    if (publicFetched.current) return;
    publicFetched.current = true;
    try {
      const res = await propertiesApi.list();
      const props = asArray<Property>((res.data as { data: Property[] }).data);
      if (props.length > 0) setProperties(props);
    } catch {
      // Silent fail — backend unreachable, keep empty store
    }
  }, [setProperties]); // eslint-disable-line react-hooks/exhaustive-deps

  const fullSync = useCallback(async () => {
    if (!isAuthenticated || !isOnline || isSyncing.current) return;
    isSyncing.current = true;

    try {
      // 1. Refresh current user from /auth/me
      await syncWithBackend();

      // 2. Bulk-fetch all shared entities in parallel
      const data = await syncApi.bulkSync();

      if (data.properties)    setProperties(asArray<Property>(data.properties));
      if (data.inspections)   setInspections(asArray<Inspection>(data.inspections));
      if (data.payments)      setPayments(asArray<Payment>(data.payments));
      if (data.transactions)  {
        const txs = asArray<PlatformTransaction>(data.transactions);
        setTransactions(txs);
        setPaymentStoreTxs(txs);
      }
      if (data.maintenance)   setMaintenance(asArray<MaintenanceRequest>(data.maintenance));
      if (data.payouts)       setPayouts(asArray<Payout>(data.payouts));
      if (data.vendors)       setVendors(asArray<Vendor>(data.vendors));
      if (data.vendorJobs)    {
        setVendorJobs(asArray<VendorJob>(data.vendorJobs));
        setVendorJobsStore(asArray<VendorJob>(data.vendorJobs));
      }
      if (data.documents)     {
        setDocuments(asArray<Document>(data.documents));
        setDocumentStoreDocs(asArray<Document>(data.documents));
      }
      if (data.notices)       setNotices(asArray<TenantNotice>(data.notices));
      if (data.disputes)      {
        setDisputes(asArray<Dispute>(data.disputes));
        setDisputeStoreDis(asArray<Dispute>(data.disputes));
      }
      if (data.announcements) setAnnouncements(asArray<unknown>(data.announcements));
      if (data.notifications) setNotifications(asArray<Notification>(data.notifications));

      // 3. Sync conversations + messages
      if (data.conversations) {
        const convs = asArray<Conversation>(data.conversations);
        setConversations(convs);

        await Promise.all(
          convs.map(async (conv) => {
            try {
              const res = await messagesApi.messages(conv.id);
              const msgs = asArray<Message>((res.data as { data: Message[] }).data);
              setMessages(conv.id, msgs);
            } catch {
              // Keep cached messages if fetch fails
            }
          })
        );
      }

      // 4. Contracts
      try {
        const contractsRes = await contractsApi.list();
        const contracts = asArray<unknown>((contractsRes.data as { data: unknown[] }).data);
        setContracts(contracts as Parameters<typeof setContracts>[0]);
      } catch { /* keep cached */ }

      // 5. Admin-only: users, audit logs, agent applications
      if (user?.role === 'admin') {
        const [usersRes, auditRes, appsRes] = await Promise.allSettled([
          usersApi.list(),
          auditLogsApi.list(),
          agentApplicationsApi.list(),
        ]);

        if (usersRes.status === 'fulfilled') {
          const users = asArray<User>((usersRes.value.data as { data: User[] }).data);
          setUsers(users);
        }

        if (auditRes.status === 'fulfilled') {
          const logs = asArray<unknown>((auditRes.value.data as { data: unknown[] }).data);
          setAuditLogs(logs);
        }

        if (appsRes.status === 'fulfilled') {
          const apps = asArray<unknown>((appsRes.value.data as { data: unknown[] }).data);
          setAgentApplications(apps);
        }
      }
    } catch {
      // Backend unreachable — keep local cached data
    } finally {
      isSyncing.current = false;
    }
  }, [
    isAuthenticated, isOnline, user?.role,
    syncWithBackend,
    setProperties, setInspections, setPayments, setTransactions,
    setMaintenance, setPayouts, setVendorJobs, setDocuments,
    setNotices, setDisputes, setAnnouncements, setNotifications,
    setConversations, setMessages, setAuditLogs, setAgentApplications,
    setVendors, setVendorJobsStore, setUsers,
    setPaymentStoreTxs, setContracts, setDocumentStoreDocs, setDisputeStoreDis,
  ]);

  // On mount: sync immediately
  useEffect(() => {
    if (isAuthenticated && isOnline) {
      fullSync();
    }
  }, [isAuthenticated]); // eslint-disable-line react-hooks/exhaustive-deps

  // Always fetch public properties on mount — allows guests and unauthenticated
  // users to browse the published listings on the Search/Landing page.
  useEffect(() => {
    if (isOnline) {
      fetchPublicProperties();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When coming back online: sync immediately
  useEffect(() => {
    if (isOnline && isAuthenticated) {
      fullSync();
    }
  }, [isOnline]); // eslint-disable-line react-hooks/exhaustive-deps

  // Periodic background sync while online
  useEffect(() => {
    if (isOnline && isAuthenticated) {
      intervalRef.current = setInterval(fullSync, SYNC_INTERVAL_MS);
    } else {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isOnline, isAuthenticated, fullSync]);

  // Re-sync on tab focus
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && isAuthenticated && isOnline) {
        fullSync();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [isAuthenticated, isOnline, fullSync]);
}
