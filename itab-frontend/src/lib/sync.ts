/**
 * Offline sync engine.
 *
 * When the user is offline, writes are queued in IndexedDB.
 * When they come back online:
 *   1. Process the queue (oldest first).
 *   2. On conflict (409), the backend wins — discard the local change.
 *   3. On success, remove the item from the queue.
 *   4. After the queue is clear, trigger a full data re-fetch so the UI
 *      reflects the latest server state across all devices.
 */

import { getPendingSyncItems, updateSyncItem, removeSyncItem } from './db';
import { api } from './api';
import { useUIStore } from '../store/uiStore';

export async function processSyncQueue(): Promise<void> {
  const items = await getPendingSyncItems();
  if (items.length === 0) return;

  useUIStore.getState().setSyncPending(items.length);

  for (const item of items) {
    try {
      await updateSyncItem(item.id, { status: 'syncing' });

      switch (item.operation) {
        case 'create':
          await api.post(`/${item.entity}`, item.data);
          break;
        case 'update':
          await api.put(`/${item.entity}/${(item.data as Record<string, unknown>).id}`, item.data);
          break;
        case 'delete':
          await api.delete(`/${item.entity}/${(item.data as Record<string, unknown>).id}`);
          break;
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
    // Process any queued writes first, then the useBackendSync hook
    // will re-fetch fresh data via its isOnline effect.
    await processSyncQueue();
  });

  window.addEventListener('offline', () => {
    setOnline(false);
  });
}
