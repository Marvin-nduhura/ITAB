import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Property } from '../types';
import { generateId } from '../lib/utils';
import { propertiesApi } from '../lib/api';
import { apiCall } from '../lib/apiCall';

interface PropertyStore {
  properties: Property[];
  customAmenities: string[];
  customPropertyTypes: string[];
  customDistricts: string[];
  lastSyncedAt: string | null;

  // Sync setter — called by useBackendSync (backend → store)
  setProperties: (props: Property[]) => void;

  // CRUD — optimistic update + backend call
  addProperty:    (p: Omit<Property, 'id' | 'createdAt' | 'updatedAt' | 'viewCount'> | Property) => Promise<Property>;
  updateProperty: (id: string, updates: Partial<Property>) => void;
  deleteProperty: (id: string) => void;
  addPhoto:       (propertyId: string, photoUrl: string) => void;
  removePhoto:    (propertyId: string, photoUrl: string) => void;
  incrementViews: (id: string) => void;
  setLastSynced:  () => void;

  addCustomAmenity:     (name: string) => void;
  addCustomPropertyType:(name: string) => void;
  addCustomDistrict:    (name: string) => void;
}

export const usePropertyStore = create<PropertyStore>()(
  persist(
    (set, get) => ({
      properties: [],
      customAmenities: [],
      customPropertyTypes: [],
      customDistricts: [],
      lastSyncedAt: null,

      setProperties: (props) => set({ properties: props, lastSyncedAt: new Date().toISOString() }),

      // ── Add property ──────────────────────────────────────────────────────
      addProperty: async (data) => {
        // If data already has an id (from backend sync), upsert it
        if ('id' in data && data.id) {
          const existing = get().properties.find(p => p.id === data.id);
          if (existing) {
            set(s => ({ properties: s.properties.map(p => p.id === data.id ? { ...p, ...(data as Property) } : p) }));
          } else {
            set(s => ({ properties: [data as Property, ...s.properties] }));
          }
          return data as Property;
        }

        // New property — optimistic local id
        const now = new Date().toISOString();
        const tempId = `p_${generateId()}`;
        const newProp: Property = {
          ...(data as Omit<Property, 'id' | 'createdAt' | 'updatedAt' | 'viewCount'>),
          id: tempId,
          latitude:  (data.latitude  && !isNaN(data.latitude))  ? data.latitude  : 0,
          longitude: (data.longitude && !isNaN(data.longitude)) ? data.longitude : 0,
          viewCount: 0,
          createdAt: now,
          updatedAt: now,
        };

        // Optimistic update
        set(s => ({ properties: [newProp, ...s.properties] }));

        // Backend call
        const saved = await apiCall<Property>(
          'property', 'create',
          () => propertiesApi.create(newProp) as Promise<{ data: { data: Property } }>,
          newProp as unknown as Record<string, unknown>
        );

        if (saved && saved.id !== tempId) {
          // Replace temp id with real backend id
          set(s => ({
            properties: s.properties.map(p => p.id === tempId ? { ...p, ...saved } : p),
          }));
          return saved;
        }
        return newProp;
      },

      // ── Update property ───────────────────────────────────────────────────
      updateProperty: async (id, updates) => {
        // Optimistic update — synchronous for UI
        set(s => ({
          properties: s.properties.map(p =>
            p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
          ),
        }));

        // Backend call — fire and forget
        const current = get().properties.find(p => p.id === id);
        if (!current) return;
        apiCall<Property>(
          'property', 'update',
          () => propertiesApi.update(id, { ...current, ...updates }) as Promise<{ data: { data: Property } }>,
          { id, ...updates }
        );
      },

      // ── Delete property ───────────────────────────────────────────────────
      deleteProperty: (id) => {
        set(s => ({ properties: s.properties.filter(p => p.id !== id) }));
        apiCall('property', 'delete', () => propertiesApi.delete(id) as Promise<{ data: { data: unknown } }>, { id });
      },

      addPhoto: (propertyId, photoUrl) => {
        set(s => ({
          properties: s.properties.map(p =>
            p.id === propertyId ? { ...p, photos: [...p.photos, photoUrl] } : p
          ),
        }));
      },

      removePhoto: (propertyId, photoUrl) => {
        set(s => ({
          properties: s.properties.map(p =>
            p.id === propertyId ? { ...p, photos: p.photos.filter(ph => ph !== photoUrl) } : p
          ),
        }));
      },

      incrementViews: (id) => {
        set(s => ({
          properties: s.properties.map(p =>
            p.id === id ? { ...p, viewCount: p.viewCount + 1 } : p
          ),
        }));
      },

      setLastSynced: () => set({ lastSyncedAt: new Date().toISOString() }),

      addCustomAmenity: (name) => {
        const key = name.toLowerCase().replace(/\s+/g, '_');
        if (!get().customAmenities.includes(key)) set(s => ({ customAmenities: [...s.customAmenities, key] }));
      },
      addCustomPropertyType: (name) => {
        const key = name.toLowerCase().replace(/\s+/g, '_');
        if (!get().customPropertyTypes.includes(key)) set(s => ({ customPropertyTypes: [...s.customPropertyTypes, key] }));
      },
      addCustomDistrict: (name) => {
        const trimmed = name.trim();
        if (trimmed && !get().customDistricts.includes(trimmed)) set(s => ({ customDistricts: [...s.customDistricts, trimmed] }));
      },
    }),
    {
      name: 'itab_properties',
      partialize: (s) => ({
        properties: s.properties,
        customAmenities: s.customAmenities,
        customPropertyTypes: s.customPropertyTypes,
        customDistricts: s.customDistricts,
        lastSyncedAt: s.lastSyncedAt,
      }),
      merge: (persisted: unknown, current) => {
        const p = persisted as Partial<PropertyStore>;
        const sanitize = (props: Property[]) => props.map(prop => ({
          ...prop,
          latitude:  (prop.latitude  && !isNaN(prop.latitude))  ? prop.latitude  : 0,
          longitude: (prop.longitude && !isNaN(prop.longitude)) ? prop.longitude : 0,
        }));
        return {
          ...current,
          properties: sanitize(p.properties || []),
          customAmenities: p.customAmenities || [],
          customPropertyTypes: p.customPropertyTypes || [],
          customDistricts: p.customDistricts || [],
          lastSyncedAt: p.lastSyncedAt || null,
        };
      },
    }
  )
);
