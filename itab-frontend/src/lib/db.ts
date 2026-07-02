// IndexedDB wrapper for offline-first functionality
import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { Property, Inspection, Payment, MaintenanceRequest, Notification, SyncQueueItem } from '../types';

interface ITABSchema extends DBSchema {
  properties:   { key: string; value: Property;           indexes: { 'by-status': string; 'by-district': string } };
  inspections:  { key: string; value: Inspection;         indexes: { 'by-tenant': string; 'by-property': string } };
  payments:     { key: string; value: Payment;            indexes: { 'by-tenant': string; 'by-type': string } };
  maintenance:  { key: string; value: MaintenanceRequest; indexes: { 'by-property': string; 'by-status': string } };
  notifications:{ key: string; value: Notification;       indexes: { 'by-read': string } };
  syncQueue:    { key: string; value: SyncQueueItem;      indexes: { 'by-status': string } };
  cache:        { key: string; value: { key: string; data: unknown; timestamp: number } };
}

let db: IDBPDatabase<ITABSchema> | null = null;

export async function getDB(): Promise<IDBPDatabase<ITABSchema>> {
  if (db) return db;
  db = await openDB<ITABSchema>('itab-db', 1, {
    upgrade(database) {
      // Properties
      const propStore = database.createObjectStore('properties', { keyPath: 'id' });
      propStore.createIndex('by-status',   'status');
      propStore.createIndex('by-district', 'district');

      // Inspections
      const inspStore = database.createObjectStore('inspections', { keyPath: 'id' });
      inspStore.createIndex('by-tenant',   'tenantId');
      inspStore.createIndex('by-property', 'propertyId');

      // Payments
      const payStore = database.createObjectStore('payments', { keyPath: 'id' });
      payStore.createIndex('by-tenant', 'tenantId');
      payStore.createIndex('by-type',   'type');

      // Maintenance
      const maintStore = database.createObjectStore('maintenance', { keyPath: 'id' });
      maintStore.createIndex('by-property', 'propertyId');
      maintStore.createIndex('by-status',   'status');

      // Notifications
      const notifStore = database.createObjectStore('notifications', { keyPath: 'id' });
      notifStore.createIndex('by-read', 'isRead');

      // Sync queue
      const syncStore = database.createObjectStore('syncQueue', { keyPath: 'id' });
      syncStore.createIndex('by-status', 'status');

      // Generic cache
      database.createObjectStore('cache', { keyPath: 'key' });
    },
  });
  return db;
}

// ─── Generic helpers ─────────────────────────────────────────────────────────
export async function dbGet<T>(store: keyof ITABSchema, id: string): Promise<T | undefined> {
  const database = await getDB();
  return database.get(store as 'properties', id) as Promise<T | undefined>;
}

export async function dbGetAll<T>(store: keyof ITABSchema): Promise<T[]> {
  const database = await getDB();
  return database.getAll(store as 'properties') as Promise<T[]>;
}

export async function dbPut<T>(store: keyof ITABSchema, value: T): Promise<void> {
  const database = await getDB();
  await database.put(store as 'properties', value as never);
}

export async function dbPutMany<T>(store: keyof ITABSchema, values: T[]): Promise<void> {
  const database = await getDB();
  const tx = database.transaction(store as 'properties', 'readwrite');
  await Promise.all([...values.map(v => tx.store.put(v as never)), tx.done]);
}

export async function dbDelete(store: keyof ITABSchema, id: string): Promise<void> {
  const database = await getDB();
  await database.delete(store as 'properties', id);
}

export async function dbClear(store: keyof ITABSchema): Promise<void> {
  const database = await getDB();
  await database.clear(store as 'properties');
}

// ─── Cache helpers ───────────────────────────────────────────────────────────
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function cacheSet(key: string, data: unknown): Promise<void> {
  const database = await getDB();
  await database.put('cache', { key, data, timestamp: Date.now() });
}

export async function cacheGet<T>(key: string): Promise<T | null> {
  const database = await getDB();
  const entry = await database.get('cache', key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL) {
    await database.delete('cache', key);
    return null;
  }
  return entry.data as T;
}

// ─── Sync queue ──────────────────────────────────────────────────────────────
export async function addToSyncQueue(item: Omit<SyncQueueItem, 'id' | 'timestamp' | 'retryCount' | 'status'>): Promise<void> {
  const database = await getDB();
  const queueItem: SyncQueueItem = {
    ...item,
    id: `sync_${Date.now()}_${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
    retryCount: 0,
    status: 'pending',
  };
  await database.put('syncQueue', queueItem);
}

export async function getPendingSyncItems(): Promise<SyncQueueItem[]> {
  const database = await getDB();
  const all = await database.getAll('syncQueue');
  return all.filter(item => item.status === 'pending' || item.status === 'failed');
}

export async function updateSyncItem(id: string, updates: Partial<SyncQueueItem>): Promise<void> {
  const database = await getDB();
  const item = await database.get('syncQueue', id);
  if (item) await database.put('syncQueue', { ...item, ...updates });
}

export async function removeSyncItem(id: string): Promise<void> {
  const database = await getDB();
  await database.delete('syncQueue', id);
}
