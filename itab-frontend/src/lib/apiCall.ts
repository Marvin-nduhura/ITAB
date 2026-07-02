/**
 * apiCall — wraps every write operation with:
 * 1. Online: call backend immediately, return result
 * 2. Offline: queue to IndexedDB sync queue, return null
 * 3. Error: log and return null (local state already updated optimistically)
 *
 * Usage:
 *   const result = await apiCall('property', 'create', () => propertiesApi.create(data), data);
 */

import { addToSyncQueue } from './db';
import { useUIStore } from '../store/uiStore';

export async function apiCall<T>(
  entity: string,
  operation: 'create' | 'update' | 'delete',
  apiFn: () => Promise<{ data: { data: T } }>,
  offlineData?: Record<string, unknown>
): Promise<T | null> {
  const isOnline = useUIStore.getState().isOnline;

  if (!isOnline) {
    // Queue for later sync
    if (offlineData) {
      await addToSyncQueue({ entity, operation, data: offlineData });
    }
    return null;
  }

  try {
    const res = await apiFn();
    return res.data?.data ?? null;
  } catch (err: unknown) {
    const status = (err as { response?: { status?: number } })?.response?.status;
    // Network error — queue for retry
    if (!status && offlineData) {
      await addToSyncQueue({ entity, operation, data: offlineData });
    }
    console.warn(`[apiCall] ${entity}.${operation} failed:`, err);
    return null;
  }
}

/** Fire-and-forget API call — doesn't block UI, doesn't queue offline */
export async function apiSend(apiFn: () => Promise<unknown>): Promise<void> {
  const isOnline = useUIStore.getState().isOnline;
  if (!isOnline) return;
  try { await apiFn(); } catch { /* silent */ }
}
