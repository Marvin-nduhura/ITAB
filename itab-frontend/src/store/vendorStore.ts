import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Vendor, VendorJob, VendorRating } from '../types';
import { mockVendors, mockVendorJobs } from '../lib/mockData';
import { generateId } from '../lib/utils';

interface VendorStore {
  vendors: Vendor[];
  jobs: VendorJob[];
  ratings: VendorRating[];

  // Vendor CRUD
  addVendor: (v: Omit<Vendor, 'id' | 'rating' | 'totalRatings' | 'totalJobs' | 'completedJobs' | 'joinedAt'>) => Vendor;
  updateVendor: (id: string, updates: Partial<Vendor>) => void;
  suspendVendor: (id: string) => void;
  unsuspendVendor: (id: string) => void;
  verifyVendor: (id: string) => void;

  // Job management
  assignJob: (job: Omit<VendorJob, 'id' | 'createdAt' | 'updatedAt'>) => VendorJob;
  updateJob: (id: string, updates: Partial<VendorJob>) => void;
  acceptJob: (id: string) => void;
  startJob: (id: string) => void;
  completeJob: (id: string, actualCost: number, notes: string) => void;
  cancelJob: (id: string) => void;

  // Ratings
  rateVendor: (vendorId: string, jobId: string, ratedBy: string, ratedByName: string, rating: number, comment: string) => void;

  // Queries
  getVendorById: (id: string) => Vendor | undefined;
  getVendorsByCategory: (category: string) => Vendor[];
  getJobsByVendor: (vendorId: string) => VendorJob[];
  getJobsByMaintenance: (maintenanceId: string) => VendorJob[];
  getAvailableVendors: (category?: string) => Vendor[];
}

export const useVendorStore = create<VendorStore>()(
  persist(
    (set, get) => ({
      vendors: mockVendors,
      jobs: mockVendorJobs,
      ratings: [],

      addVendor: (data) => {
        const vendor: Vendor = {
          ...data,
          id: `v_${generateId()}`,
          rating: 0,
          totalRatings: 0,
          totalJobs: 0,
          completedJobs: 0,
          joinedAt: new Date().toISOString(),
        };
        set(s => ({ vendors: [vendor, ...s.vendors] }));
        return vendor;
      },

      updateVendor: (id, updates) => {
        set(s => ({ vendors: s.vendors.map(v => v.id === id ? { ...v, ...updates } : v) }));
      },

      suspendVendor: (id) => {
        set(s => ({ vendors: s.vendors.map(v => v.id === id ? { ...v, isSuspended: true, isActive: false } : v) }));
      },

      unsuspendVendor: (id) => {
        set(s => ({ vendors: s.vendors.map(v => v.id === id ? { ...v, isSuspended: false, isActive: true } : v) }));
      },

      verifyVendor: (id) => {
        set(s => ({ vendors: s.vendors.map(v => v.id === id ? { ...v, isVerified: true } : v) }));
      },

      assignJob: (data) => {
        const job: VendorJob = {
          ...data,
          id: `j_${generateId()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set(s => ({
          jobs: [job, ...s.jobs],
          vendors: s.vendors.map(v => v.id === data.vendorId
            ? { ...v, totalJobs: v.totalJobs + 1, availability: 'busy' as const }
            : v
          ),
        }));
        return job;
      },

      updateJob: (id, updates) => {
        set(s => ({
          jobs: s.jobs.map(j => j.id === id ? { ...j, ...updates, updatedAt: new Date().toISOString() } : j),
        }));
      },

      acceptJob: (id) => {
        set(s => ({
          jobs: s.jobs.map(j => j.id === id ? { ...j, status: 'accepted' as const, updatedAt: new Date().toISOString() } : j),
        }));
      },

      startJob: (id) => {
        set(s => ({
          jobs: s.jobs.map(j => j.id === id ? { ...j, status: 'in_progress' as const, updatedAt: new Date().toISOString() } : j),
        }));
      },

      completeJob: (id, actualCost, notes) => {
        const job = get().jobs.find(j => j.id === id);
        if (!job) return;
        set(s => ({
          jobs: s.jobs.map(j => j.id === id ? {
            ...j, status: 'completed' as const, actualCost, vendorNotes: notes,
            completedDate: new Date().toISOString(), updatedAt: new Date().toISOString(),
          } : j),
          vendors: s.vendors.map(v => v.id === job.vendorId
            ? { ...v, completedJobs: v.completedJobs + 1, availability: 'available' as const }
            : v
          ),
        }));
      },

      cancelJob: (id) => {
        const job = get().jobs.find(j => j.id === id);
        if (!job) return;
        set(s => ({
          jobs: s.jobs.map(j => j.id === id ? { ...j, status: 'cancelled' as const, updatedAt: new Date().toISOString() } : j),
          vendors: s.vendors.map(v => v.id === job.vendorId
            ? { ...v, totalJobs: Math.max(0, v.totalJobs - 1), availability: 'available' as const }
            : v
          ),
        }));
      },

      rateVendor: (vendorId, jobId, ratedBy, ratedByName, rating, comment) => {
        const newRating: VendorRating = {
          id: `r_${generateId()}`,
          vendorId, jobId, ratedBy, ratedByName, rating, comment,
          createdAt: new Date().toISOString(),
        };
        set(s => {
          const vendor = s.vendors.find(v => v.id === vendorId);
          if (!vendor) return s;
          const allRatings = [...s.ratings, newRating].filter(r => r.vendorId === vendorId);
          const avgRating = allRatings.reduce((sum, r) => sum + r.rating, 0) / allRatings.length;
          return {
            ratings: [...s.ratings, newRating],
            vendors: s.vendors.map(v => v.id === vendorId
              ? { ...v, rating: Math.round(avgRating * 10) / 10, totalRatings: allRatings.length }
              : v
            ),
          };
        });
      },

      getVendorById: (id) => get().vendors.find(v => v.id === id),
      getVendorsByCategory: (category) => get().vendors.filter(v => v.category === category && v.isActive && !v.isSuspended),
      getJobsByVendor: (vendorId) => get().jobs.filter(j => j.vendorId === vendorId),
      getJobsByMaintenance: (maintenanceId) => get().jobs.filter(j => j.maintenanceRequestId === maintenanceId),
      getAvailableVendors: (category) => get().vendors.filter(v =>
        v.isActive && !v.isSuspended && (!category || v.category === category)
      ),
    }),
    {
      name: 'itab_vendors',
      partialize: (s) => ({
        vendors: s.vendors.filter(v => v.id.startsWith('v_')), // only persist user-added
        jobs: s.jobs.filter(j => j.id.startsWith('j_')),
        ratings: s.ratings,
      }),
      merge: (persisted: unknown, current) => {
        const p = persisted as Partial<VendorStore>;
        return {
          ...current,
          vendors: [
            ...(p.vendors || []),
            ...mockVendors.filter(mv => !(p.vendors || []).find(pv => pv.id === mv.id)),
          ],
          jobs: [
            ...(p.jobs || []),
            ...mockVendorJobs.filter(mj => !(p.jobs || []).find(pj => pj.id === mj.id)),
          ],
          ratings: p.ratings || [],
        };
      },
    }
  )
);
