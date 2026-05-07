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
    } catch {
      const retryCount = item.retryCount + 1;
      if (retryCount >= 5) {
        await updateSyncItem(item.id, { status: 'failed', retryCount });
      } else {
        await updateSyncItem(item.id, { status: 'pending', retryCount });
      }
    }
  }

  const remaining = await getPendingSyncItems();
  useUIStore.getState().setSyncPending(remaining.length);
}

export function registerServiceWorker(): void {
  // vite-plugin-pwa auto-registers the generated SW via virtual:pwa-register.
  // We only need to set up the online/offline listeners and message handler here.
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

  window.addEventListener('online', () => {
    setOnline(true);
    processSyncQueue();
  });

  window.addEventListener('offline', () => {
    setOnline(false);
  });
}
