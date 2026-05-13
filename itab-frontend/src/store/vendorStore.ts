import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Vendor, VendorJob, VendorRating } from '../types';
import { generateId } from '../lib/utils';
import { vendorsApi, vendorJobsApi } from '../lib/api';
import { apiCall, apiSend } from '../lib/apiCall';

interface VendorStore {
  vendors: Vendor[];
  jobs: VendorJob[];
  ratings: VendorRating[];

  // Sync setters — called by useBackendSync
  setVendors: (vendors: Vendor[]) => void;
  setJobs:    (jobs: VendorJob[]) => void;

  // Vendor CRUD
  addVendor:     (v: Omit<Vendor, 'id' | 'rating' | 'totalRatings' | 'totalJobs' | 'completedJobs' | 'joinedAt'>) => Promise<Vendor>;
  updateVendor:  (id: string, updates: Partial<Vendor>) => Promise<void>;
  suspendVendor: (id: string) => Promise<void>;
  unsuspendVendor:(id: string) => Promise<void>;
  verifyVendor:  (id: string) => Promise<void>;

  // Job management
  assignJob:   (job: Omit<VendorJob, 'id' | 'createdAt' | 'updatedAt'>) => Promise<VendorJob>;
  updateJob:   (id: string, updates: Partial<VendorJob>) => Promise<void>;
  acceptJob:   (id: string) => Promise<void>;
  startJob:    (id: string) => Promise<void>;
  completeJob: (id: string, actualCost: number, notes: string) => Promise<void>;
  cancelJob:   (id: string) => Promise<void>;

  // Ratings
  rateVendor: (vendorId: string, jobId: string, ratedBy: string, ratedByName: string, rating: number, comment: string) => Promise<void>;

  // Queries
  getVendorById:       (id: string) => Vendor | undefined;
  getVendorsByCategory:(category: string) => Vendor[];
  getJobsByVendor:     (vendorId: string) => VendorJob[];
  getJobsByMaintenance:(maintenanceId: string) => VendorJob[];
  getAvailableVendors: (category?: string) => Vendor[];
}

export const useVendorStore = create<VendorStore>()(
  persist(
    (set, get) => ({
      vendors: [],
      jobs: [],
      ratings: [],

      setVendors: (vendors) => set({ vendors }),
      setJobs:    (jobs)    => set({ jobs }),

      // ── Vendor CRUD ───────────────────────────────────────────────────────
      addVendor: async (data) => {
        const vendor: Vendor = {
          ...data,
          id: `v_${generateId()}`,
          rating: 0, totalRatings: 0, totalJobs: 0, completedJobs: 0,
          joinedAt: new Date().toISOString(),
        };
        set(s => ({ vendors: [vendor, ...s.vendors] }));

        const saved = await apiCall<Vendor>(
          'vendor', 'create',
          () => vendorsApi.create(vendor) as Promise<{ data: { data: Vendor } }>,
          vendor as unknown as Record<string, unknown>
        );
        if (saved && saved.id !== vendor.id) {
          set(s => ({ vendors: s.vendors.map(v => v.id === vendor.id ? { ...v, ...saved } : v) }));
          return saved;
        }
        return vendor;
      },

      updateVendor: async (id, updates) => {
        set(s => ({ vendors: s.vendors.map(v => v.id === id ? { ...v, ...updates } : v) }));
        await apiCall<Vendor>(
          'vendor', 'update',
          () => vendorsApi.update(id, updates) as Promise<{ data: { data: Vendor } }>,
          { id, ...updates }
        );
      },

      suspendVendor: async (id) => {
        set(s => ({ vendors: s.vendors.map(v => v.id === id ? { ...v, isSuspended: true, isActive: false } : v) }));
        await apiSend(() => vendorsApi.update(id, { isSuspended: true, isActive: false }));
      },

      unsuspendVendor: async (id) => {
        set(s => ({ vendors: s.vendors.map(v => v.id === id ? { ...v, isSuspended: false, isActive: true } : v) }));
        await apiSend(() => vendorsApi.update(id, { isSuspended: false, isActive: true }));
      },

      verifyVendor: async (id) => {
        set(s => ({ vendors: s.vendors.map(v => v.id === id ? { ...v, isVerified: true } : v) }));
        await apiSend(() => vendorsApi.update(id, { isVerified: true }));
      },

      // ── Job management ────────────────────────────────────────────────────
      assignJob: async (data) => {
        const job: VendorJob = {
          ...data,
          id: `j_${generateId()}`,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        set(s => ({
          jobs: [job, ...s.jobs],
          vendors: s.vendors.map(v => v.id === data.vendorId
            ? { ...v, totalJobs: v.totalJobs + 1, availability: 'busy' as const } : v
          ),
        }));

        const saved = await apiCall<VendorJob>(
          'vendor_job', 'create',
          () => vendorJobsApi.create(job) as Promise<{ data: { data: VendorJob } }>,
          job as unknown as Record<string, unknown>
        );
        if (saved && saved.id !== job.id) {
          set(s => ({ jobs: s.jobs.map(j => j.id === job.id ? { ...j, ...saved } : j) }));
          return saved;
        }
        return job;
      },

      updateJob: async (id, updates) => {
        set(s => ({ jobs: s.jobs.map(j => j.id === id ? { ...j, ...updates, updatedAt: new Date().toISOString() } : j) }));
        await apiCall<VendorJob>(
          'vendor_job', 'update',
          () => vendorJobsApi.update(id, updates) as Promise<{ data: { data: VendorJob } }>,
          { id, ...updates }
        );
      },

      acceptJob: async (id) => {
        set(s => ({ jobs: s.jobs.map(j => j.id === id ? { ...j, status: 'accepted' as const, updatedAt: new Date().toISOString() } : j) }));
        await apiSend(() => vendorJobsApi.update(id, { status: 'accepted' }));
      },

      startJob: async (id) => {
        set(s => ({ jobs: s.jobs.map(j => j.id === id ? { ...j, status: 'in_progress' as const, updatedAt: new Date().toISOString() } : j) }));
        await apiSend(() => vendorJobsApi.update(id, { status: 'in_progress' }));
      },

      completeJob: async (id, actualCost, notes) => {
        const job = get().jobs.find(j => j.id === id);
        if (!job) return;
        set(s => ({
          jobs: s.jobs.map(j => j.id === id ? {
            ...j, status: 'completed' as const, actualCost, vendorNotes: notes,
            completedDate: new Date().toISOString(), updatedAt: new Date().toISOString(),
          } : j),
          vendors: s.vendors.map(v => v.id === job.vendorId
            ? { ...v, completedJobs: v.completedJobs + 1, availability: 'available' as const } : v
          ),
        }));
        await apiSend(() => vendorJobsApi.update(id, { status: 'completed', actualCost, vendorNotes: notes }));
      },

      cancelJob: async (id) => {
        const job = get().jobs.find(j => j.id === id);
        if (!job) return;
        set(s => ({
          jobs: s.jobs.map(j => j.id === id ? { ...j, status: 'cancelled' as const, updatedAt: new Date().toISOString() } : j),
          vendors: s.vendors.map(v => v.id === job.vendorId
            ? { ...v, totalJobs: Math.max(0, v.totalJobs - 1), availability: 'available' as const } : v
          ),
        }));
        await apiSend(() => vendorJobsApi.update(id, { status: 'cancelled' }));
      },

      // ── Ratings ───────────────────────────────────────────────────────────
      rateVendor: async (vendorId, jobId, ratedBy, ratedByName, rating, comment) => {
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
              ? { ...v, rating: Math.round(avgRating * 10) / 10, totalRatings: allRatings.length } : v
            ),
          };
        });
        await apiSend(() => vendorsApi.rate(vendorId, rating));
      },

      // ── Queries ───────────────────────────────────────────────────────────
      getVendorById:       (id)       => get().vendors.find(v => v.id === id),
      getVendorsByCategory:(category) => get().vendors.filter(v => v.category === category && v.isActive && !v.isSuspended),
      getJobsByVendor:     (vendorId) => get().jobs.filter(j => j.vendorId === vendorId),
      getJobsByMaintenance:(maintenanceId) => get().jobs.filter(j => j.maintenanceRequestId === maintenanceId),
      getAvailableVendors: (category) => get().vendors.filter(v =>
        v.isActive && !v.isSuspended && (!category || v.category === category)
      ),
    }),
    {
      name: 'itab_vendors',
      partialize: (s) => ({ vendors: s.vendors, jobs: s.jobs, ratings: s.ratings }),
      merge: (persisted: unknown, current) => {
        const p = persisted as Partial<VendorStore>;
        return { ...current, vendors: p.vendors || [], jobs: p.jobs || [], ratings: p.ratings || [] };
      },
    }
  )
);
