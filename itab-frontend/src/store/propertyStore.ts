import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Property } from '../types';
import { mockProperties } from '../lib/mockData';
import { generateId } from '../lib/utils';

interface PropertyStore {
  properties: Property[];
  customAmenities: string[];       // user-defined amenities
  customPropertyTypes: string[];   // user-defined property types
  customDistricts: string[];       // user-defined districts

  addProperty: (p: Omit<Property, 'id' | 'createdAt' | 'updatedAt' | 'viewCount'>) => Property;
  updateProperty: (id: string, updates: Partial<Property>) => void;
  deleteProperty: (id: string) => void;
  addPhoto: (propertyId: string, photoUrl: string) => void;
  removePhoto: (propertyId: string, photoUrl: string) => void;
  incrementViews: (id: string) => void;

  addCustomAmenity: (name: string) => void;
  addCustomPropertyType: (name: string) => void;
  addCustomDistrict: (name: string) => void;
}

export const usePropertyStore = create<PropertyStore>()(
  persist(
    (set, get) => ({
      properties: mockProperties,
      customAmenities: [],
      customPropertyTypes: [],
      customDistricts: [],

      addProperty: (data) => {
        const now = new Date().toISOString();
        const newProp: Property = {
          ...data,
          id: `p_${generateId()}`,
          // Sanitize coordinates — NaN crashes Leaflet
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
      // Don't persist mock data on first load — only persist user-added data
      partialize: (s) => ({
        // Only persist properties that were user-created (id starts with p_)
        properties: s.properties.filter(p => p.id.startsWith('p_')),
        customAmenities: s.customAmenities,
        customPropertyTypes: s.customPropertyTypes,
        customDistricts: s.customDistricts,
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
          properties: [
            ...sanitize(p.properties || []),
            ...mockProperties.filter(mp => !(p.properties || []).find(pp => pp.id === mp.id)),
          ],
          customAmenities: p.customAmenities || [],
          customPropertyTypes: p.customPropertyTypes || [],
          customDistricts: p.customDistricts || [],
        };
      },
    }
  )
);
