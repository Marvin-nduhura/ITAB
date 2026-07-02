/**
 * usePageData — fetches fresh data from the Render backend on every page mount.
 * Render PostgreSQL is the single source of truth.
 * Zustand stores are write-through caches only — backend always wins.
 *
 * Usage:
 *   const { loading, refresh } = usePageData(['properties', 'inspections']);
 *   const { loading, refresh } = usePageData(['all']); // fetch everything
 */

import { useEffect, useCallback, useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { usePropertyStore } from '../store/propertyStore';
import { useDataStore } from '../store/dataStore';
import { useUserStore } from '../store/userStore';
import { useNotificationStore } from '../store/notificationStore';
import { useDocumentStore } from '../store/documentStore';
import { useDisputeStore } from '../store/disputeStore';
import { usePaymentStore } from '../store/paymentStore';
import { useVendorStore } from '../store/vendorStore';
import {
  propertiesApi, inspectionsApi, paymentsApi, transactionsApi,
  maintenanceApi, payoutsApi, vendorsApi, vendorJobsApi,
  documentsApi, noticesApi, disputesApi, announcementsApi,
  notificationsApi, messagesApi, usersApi, auditLogsApi,
  agentApplicationsApi, contractsApi,
} from '../lib/api';
import type {
  Property, Inspection, Payment, PlatformTransaction,
  MaintenanceRequest, Payout, Vendor, VendorJob,
  TenantNotice, Dispute, Notification, Conversation,
} from '../types';
import type { Document } from '../store/documentStore';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function safe<T>(p: Promise<any>): Promise<T | null> {
  return p.then((r: { data?: { data?: T } }) => r.data?.data ?? null).catch(() => null);
}

export function usePageData(sections: string[] = ['all']) {
  const { user, isAuthenticated } = useAuthStore();
  const [loading, setLoading] = useState(false);

  const { setProperties } = usePropertyStore();
  const {
    setInspections, setPayments, setTransactions, setMaintenance,
    setPayouts, setVendorJobs, setDocuments, setNotices, setDisputes,
    setAnnouncements, setAgentApplications, setAuditLogs, setConversations,
  } = useDataStore();
  const { setUsers } = useUserStore();
  const { setNotifications } = useNotificationStore();
  const { setDocuments: setDocStoreDocs } = useDocumentStore();
  const { setDisputes: setDisputeStoreDis } = useDisputeStore();
  const { setTransactions: setPaymentStoreTxs, setContracts } = usePaymentStore();
  const { setVendors, setJobs: setVendorJobsStore } = useVendorStore();

  const fetchAll = useCallback(async () => {
    if (!isAuthenticated || !user) return;
    setLoading(true);

    const all = sections.includes('all');
    const needs = (s: string) => all || sections.includes(s);

    try {
      const fetches: Promise<unknown>[] = [];

      if (needs('properties')) {
        fetches.push(safe<Property[]>(propertiesApi.list()).then(d => { if (d) setProperties(d); }));
      }
      if (needs('inspections')) {
        fetches.push(safe<Inspection[]>(inspectionsApi.list()).then(d => { if (d) setInspections(d); }));
      }
      if (needs('payments')) {
        fetches.push(safe<Payment[]>(paymentsApi.list()).then(d => { if (d) setPayments(d); }));
      }
      if (needs('transactions')) {
        fetches.push(safe<PlatformTransaction[]>(transactionsApi.list()).then(d => {
          if (d) { setTransactions(d); setPaymentStoreTxs(d); }
        }));
      }
      if (needs('maintenance')) {
        fetches.push(safe<MaintenanceRequest[]>(maintenanceApi.list()).then(d => { if (d) setMaintenance(d); }));
      }
      if (needs('payouts')) {
        fetches.push(safe<Payout[]>(payoutsApi.list()).then(d => { if (d) setPayouts(d); }));
      }
      if (needs('vendors')) {
        fetches.push(safe<Vendor[]>(vendorsApi.list()).then(d => { if (d) setVendors(d); }));
      }
      if (needs('vendorJobs')) {
        fetches.push(safe<VendorJob[]>(vendorJobsApi.list()).then(d => {
          if (d) { setVendorJobs(d); setVendorJobsStore(d); }
        }));
      }
      if (needs('documents')) {
        fetches.push(safe<Document[]>(documentsApi.list()).then(d => {
          if (d) { setDocuments(d); setDocStoreDocs(d); }
        }));
      }
      if (needs('notices')) {
        fetches.push(safe<TenantNotice[]>(noticesApi.list()).then(d => { if (d) setNotices(d); }));
      }
      if (needs('disputes')) {
        fetches.push(safe<Dispute[]>(disputesApi.list()).then(d => {
          if (d) { setDisputes(d); setDisputeStoreDis(d); }
        }));
      }
      if (needs('announcements')) {
        fetches.push(safe<unknown[]>(announcementsApi.list()).then(d => { if (d) setAnnouncements(d); }));
      }
      if (needs('notifications')) {
        fetches.push(safe<Notification[]>(notificationsApi.list()).then(d => { if (d) setNotifications(d); }));
      }
      if (needs('conversations')) {
        fetches.push(safe<Conversation[]>(messagesApi.conversations()).then(d => { if (d) setConversations(d); }));
      }
      if (needs('contracts')) {
        fetches.push(safe<unknown[]>(contractsApi.list()).then(d => {
          if (d) setContracts(d as Parameters<typeof setContracts>[0]);
        }));
      }

      // Admin-only
      if (user.role === 'admin') {
        if (needs('users') || needs('all')) {
          fetches.push(safe<unknown[]>(usersApi.list()).then(d => {
            if (d) setUsers(d as Parameters<typeof setUsers>[0]);
          }));
        }
        if (needs('auditLogs') || needs('all')) {
          fetches.push(safe<unknown[]>(auditLogsApi.list()).then(d => { if (d) setAuditLogs(d); }));
        }
        if (needs('agentApplications') || needs('all')) {
          fetches.push(safe<unknown[]>(agentApplicationsApi.list()).then(d => { if (d) setAgentApplications(d); }));
        }
      }

      await Promise.allSettled(fetches);
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id, user?.role]);

  useEffect(() => {
    fetchAll();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { loading, refresh: fetchAll };
}
