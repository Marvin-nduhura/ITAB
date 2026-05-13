import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Property } from '../types';
import { generateId } from '../lib/utils';

interface PropertyStore {
  properties: Property[];
  customAmenities: string[];
  customPropertyTypes: string[];
  customDistricts: string[];
  lastSyncedAt: string | null;

  addProperty: (p: Omit<Property, 'id' | 'createdAt' | 'updatedAt' | 'viewCount'> | Property) => Property;
  updateProperty: (id: string, updates: Partial<Property>) => void;
  deleteProperty: (id: string) => void;
  addPhoto: (propertyId: string, photoUrl: string) => void;
  removePhoto: (propertyId: string, photoUrl: string) => void;
  incrementViews: (id: string) => void;
  setLastSynced: () => void;

  setProperties: (props: Property[]) => void;
  addCustomAmenity: (name: string) => void;
  addCustomPropertyType: (name: string) => void;
  addCustomDistrict: (name: string) => void;
}

export const usePropertyStore = create<PropertyStore>()(
  persist(
    (set, get) => ({
      properties: [],
      customAmenities: [],
      customPropertyTypes: [],
      customDistricts: [],
      lastSyncedAt: null,

      addProperty: (data) => {
        // If the data already has an id (coming from backend sync), use it as-is
        if ('id' in data && data.id) {
          const existing = get().properties.find(p => p.id === data.id);
          if (existing) {
            // Update existing with backend data
            set(s => ({
              properties: s.properties.map(p => p.id === data.id ? { ...p, ...(data as Property) } : p),
            }));
            return data as Property;
          }
          // Add new property from backend
          set(s => ({ properties: [data as Property, ...s.properties] }));
          return data as Property;
        }
        // New property created locally
        const now = new Date().toISOString();
        const newProp: Property = {
          ...(data as Omit<Property, 'id' | 'createdAt' | 'updatedAt' | 'viewCount'>),
          id: `p_${generateId()}`,
          latitude:  (data.latitude && !isNaN(data.latitude))  ? data.latitude  : 0,
          longitude: (data.longitude && !isNaN(data.longitude)) ? data.longitude : 0,
          viewCount: 0,
          createdAt: now,
          updatedAt: now,
        };
        set(s => ({ properties: [newProp, ...s.properties] }));
        return newProp;
      },

      updateProperty: (id, updates) => {
        set(s => ({
          properties: s.properties.map(p =>
            p.id === id ? { ...p, ...updates, updatedAt: new Date().toISOString() } : p
          ),
        }));
      },

      deleteProperty: (id) => {
        set(s => ({ properties: s.properties.filter(p => p.id !== id) }));
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

      setLastSynced: () => {
        set({ lastSyncedAt: new Date().toISOString() });
      },

      setProperties: (props: Property[]) => set({ properties: props, lastSyncedAt: new Date().toISOString() }),

      addCustomAmenity: (name) => {
        const key = name.toLowerCase().replace(/\s+/g, '_');
        if (!get().customAmenities.includes(key)) {
          set(s => ({ customAmenities: [...s.customAmenities, key] }));
        }
      },

      addCustomPropertyType: (name) => {
        const key = name.toLowerCase().replace(/\s+/g, '_');
        if (!get().customPropertyTypes.includes(key)) {
          set(s => ({ customPropertyTypes: [...s.customPropertyTypes, key] }));
        }
      },

      addCustomDistrict: (name) => {
        const trimmed = name.trim();
        if (trimmed && !get().customDistricts.includes(trimmed)) {
          set(s => ({ customDistricts: [...s.customDistricts, trimmed] }));
        }
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
