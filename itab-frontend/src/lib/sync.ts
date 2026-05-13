/**
 * Offline sync engine.
 *
 * When the user is offline, writes are queued in IndexedDB.
 * When they come back online:
 *   1. Process the queue (oldest first).
 *   2. On conflict (409), the backend wins — discard the local change.
 *   3. On success, remove the item from the queue.
 *   4. After the queue is clear, trigger a full data re-fetch.
 */

import { getPendingSyncItems, updateSyncItem, removeSyncItem } from './db';
import { api } from './api';
import { useUIStore } from '../store/uiStore';

// ─── Entity → API route mapping ───────────────────────────────────────────────
const ENTITY_ROUTES: Record<string, { create?: string; update?: string; delete?: string }> = {
  property:          { create: '/properties',          update: '/properties/:id',          delete: '/properties/:id' },
  inspection:        { create: '/inspections',          update: '/inspections/:id',          delete: '/inspections/:id' },
  payment:           { create: '/payments/rent',        update: '/payments/:id',             delete: '/payments/:id' },
  transaction:       { create: '/transactions',         update: '/transactions/:id',         delete: '/transactions/:id' },
  maintenance:       { create: '/maintenance',          update: '/maintenance/:id',          delete: '/maintenance/:id' },
  payout:            { update: '/payouts/:id/process',  delete: '/payouts/:id' },
  vendor:            { create: '/vendors',              update: '/vendors/:id',              delete: '/vendors/:id' },
  vendor_job:        { create: '/vendor-jobs',          update: '/vendor-jobs/:id',          delete: '/vendor-jobs/:id' },
  contract:          { create: '/contracts',            update: '/contracts/:id',            delete: '/contracts/:id' },
  document:          { create: '/documents',            update: '/documents/:id',            delete: '/documents/:id' },
  notice:            { create: '/notices',              update: '/notices/:id',              delete: '/notices/:id' },
  dispute:           { create: '/disputes',             update: '/disputes/:id',             delete: '/disputes/:id' },
  announcement:      { create: '/announcements',        update: '/announcements/:id',        delete: '/announcements/:id' },
  notification:      { update: '/notifications/:id/read' },
  user:              { update: '/users/:id',            delete: '/users/:id' },
  agent_application: { create: '/agent-applications',  update: '/agent-applications/:id',   delete: '/agent-applications/:id' },
  audit_log:         { create: '/audit-logs' },
  payment_preference:{ create: '/payment-preferences',  update: '/payment-preferences' },
};

function resolveRoute(template: string, id?: string): string {
  if (!id) return template;
  return template.replace(':id', id);
}

export async function processSyncQueue(): Promise<void> {
  const items = await getPendingSyncItems();
  if (items.length === 0) return;

  useUIStore.getState().setSyncPending(items.length);

  for (const item of items) {
    try {
      await updateSyncItem(item.id, { status: 'syncing' });

      const routes = ENTITY_ROUTES[item.entity];
      const id = (item.data as Record<string, unknown>).id as string | undefined;

      if (!routes) {
        // Unknown entity — skip
        await removeSyncItem(item.id);
        continue;
      }

      switch (item.operation) {
        case 'create': {
          const route = routes.create;
          if (route) await api.post(route, item.data);
          break;
        }
        case 'update': {
          const route = routes.update;
          if (route && id) await api.put(resolveRoute(route, id), item.data);
          break;
        }
        case 'delete': {
          const route = routes.delete;
          if (route && id) await api.delete(resolveRoute(route, id));
          break;
        }
      }

      await removeSyncItem(item.id);
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status;

      if (status === 409) {
        // Conflict — backend wins, discard local change
        await removeSyncItem(item.id);
        console.warn(`[sync] Conflict on ${item.entity} — backend version kept`);
      } else {
        const retryCount = item.retryCount + 1;
        if (retryCount >= 5) {
          await updateSyncItem(item.id, { status: 'failed', retryCount });
        } else {
          await updateSyncItem(item.id, { status: 'pending', retryCount });
        }
      }
    }
  }

  const remaining = await getPendingSyncItems();
  useUIStore.getState().setSyncPending(remaining.length);
}

export function registerServiceWorker(): void {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.addEventListener('message', event => {
      if (event.data?.type === 'SYNC_QUEUE') {
        processSyncQueue();
      }
    });
  }
}

export function setupOnlineOfflineListeners(): void {
  const { setOnline } = useUIStore.getState();

  window.addEventListener('online', async () => {
    setOnline(true);
    await processSyncQueue();
  });

  window.addEventListener('offline', () => {
    setOnline(false);
  });
}
