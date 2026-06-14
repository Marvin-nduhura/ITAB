import axios from 'axios';
import type { ApiResponse, PropertyLocationConflict } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token — read from Zustand persist store (single source of truth)
api.interceptors.request.use(config => {
  try {
    const raw = localStorage.getItem('itab_auth');
    if (raw) {
      const parsed = JSON.parse(raw) as { state?: { token?: string } };
      const token = parsed?.state?.token;
      if (token) config.headers.Authorization = `Bearer ${token}`;
    }
  } catch { /* ignore parse errors */ }
  return config;
});

// Handle 401 — clear auth token and redirect to login.
// All other store data is in-memory only (no localStorage), so nothing else to clear.
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      try {
        localStorage.removeItem('itab_auth');
      } catch { /* ignore */ }
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  login:         (data: { email: string; password: string }) => api.post<ApiResponse<{ token: string; user: unknown }>>('/auth/login', data),
  register:      (data: unknown) => api.post<ApiResponse<{ token: string; user: unknown }>>('/auth/register', data),
  checkEmail:    (email: string) => api.get<ApiResponse<{ exists: boolean }>>('/auth/check-email', { params: { email } }),
  forgotPassword:(data: { email: string }) => api.post('/auth/forgot-password', data),
  resetPassword: (data: { token: string; password: string }) => api.post('/auth/reset-password', data),
  me:            () => api.get<ApiResponse<unknown>>('/auth/me'),
  updateProfile: (data: unknown) => api.put('/auth/profile', data),
  deleteAccount: () => api.delete<ApiResponse<{ deleted: boolean }>>('/auth/account'),
};

// ─── Properties ──────────────────────────────────────────────────────────────
export const propertiesApi = {
  list:    (params?: Record<string, unknown>) => api.get<ApiResponse<unknown[]>>('/properties', { params }),
  get:     (id: string) => api.get<ApiResponse<unknown>>(`/properties/${id}`),
  create:  (data: unknown) => api.post<ApiResponse<unknown>>('/properties', data),
  update:  (id: string, data: unknown) => api.put<ApiResponse<unknown>>(`/properties/${id}`, data),
  delete:  (id: string) => api.delete(`/properties/${id}`),
  feature: (id: string) => api.patch(`/properties/${id}/feature`),
  assignManager: (id: string, data: { managerId: string | null; managerName?: string }) =>
    api.patch<ApiResponse<unknown>>(`/properties/${id}/manager`, data),
  uploadPhotos: (id: string, files: FormData) => api.post(`/properties/${id}/photos`, files, { headers: { 'Content-Type': 'multipart/form-data' } }),
};

export const propertyConflictsApi = {
  list: (status?: string) =>
    api.get<ApiResponse<PropertyLocationConflict[]>>('/property-conflicts', { params: status ? { status } : {} }),
  resolve: (id: string, data: { status: 'confirmed_duplicate' | 'not_duplicate'; adminNotes?: string }) =>
    api.patch<ApiResponse<PropertyLocationConflict>>(`/property-conflicts/${id}`, data),
};

// ─── Inspections ─────────────────────────────────────────────────────────────
export const inspectionsApi = {
  list:     (params?: Record<string, unknown>) => api.get<ApiResponse<unknown[]>>('/inspections', { params }),
  get:      (id: string) => api.get<ApiResponse<unknown>>(`/inspections/${id}`),
  book:     (data: unknown) => api.post<ApiResponse<unknown>>('/inspections', data),
  pay:      (id: string, data: unknown) => api.post(`/inspections/${id}/pay`, data),
  confirm:  (id: string) => api.patch(`/inspections/${id}/confirm`),
  cancel:   (id: string) => api.patch(`/inspections/${id}/cancel`),
  reschedule:(id: string, data: unknown) => api.patch(`/inspections/${id}/reschedule`, data),
  noShow:   (id: string) => api.patch(`/inspections/${id}/no-show`),
};

// ─── Payments ────────────────────────────────────────────────────────────────
export const paymentsApi = {
  list:        (params?: Record<string, unknown>) => api.get<ApiResponse<unknown[]>>('/payments', { params }),
  get:         (id: string) => api.get<ApiResponse<unknown>>(`/payments/${id}`),
  payRent:     (data: unknown) => api.post<ApiResponse<unknown>>('/payments/rent', data),
  initMTN:     (data: unknown) => api.post<ApiResponse<unknown>>('/payments/mtn/initiate', data),
  initAirtel:  (data: unknown) => api.post<ApiResponse<unknown>>('/payments/airtel/initiate', data),
  checkStatus: (ref: string) => api.get<ApiResponse<unknown>>(`/payments/status/${ref}`),
  receipt:     (id: string) => api.get(`/payments/${id}/receipt`, { responseType: 'blob' }),
};

// ─── Maintenance ─────────────────────────────────────────────────────────────
export const maintenanceApi = {
  list:    (params?: Record<string, unknown>) => api.get<ApiResponse<unknown[]>>('/maintenance', { params }),
  get:     (id: string) => api.get<ApiResponse<unknown>>(`/maintenance/${id}`),
  create:  (data: unknown) => api.post<ApiResponse<unknown>>('/maintenance', data),
  update:  (id: string, data: unknown) => api.put(`/maintenance/${id}`, data),
  assign:  (id: string, vendorId: string) => api.patch(`/maintenance/${id}/assign`, { vendorId }),
  complete:(id: string) => api.patch(`/maintenance/${id}/complete`),
};

// ─── Payouts ─────────────────────────────────────────────────────────────────
export const payoutsApi = {
  list:    (params?: Record<string, unknown>) => api.get<ApiResponse<unknown[]>>('/payouts', { params }),
  process: (id: string) => api.post(`/payouts/${id}/process`),
  retry:   (id: string) => api.post(`/payouts/${id}/retry`),
};

// ─── Users ───────────────────────────────────────────────────────────────────
export const usersApi = {
  list:              (params?: Record<string, unknown>) => api.get<ApiResponse<unknown[]>>('/users', { params }),
  get:               (id: string) => api.get<ApiResponse<unknown>>(`/users/${id}`),
  update:            (id: string, data: unknown) => api.put(`/users/${id}`, data),
  delete:            (id: string) => api.delete<ApiResponse<{ deleted: boolean }>>(`/users/${id}`),
  suspend:           (id: string, reason?: string) => api.patch(`/users/${id}/suspend`, { reason }),
  unsuspend:         (id: string) => api.patch(`/users/${id}/unsuspend`),
  approve:           (id: string) => api.patch(`/users/${id}/approve`),
  rejectApproval:    (id: string, reason: string) => api.patch(`/users/${id}/reject-approval`, { reason }),
  pending:           () => api.get<ApiResponse<unknown[]>>('/users/pending'),
  setPermissions:    (id: string, permissions: unknown) => api.patch(`/users/${id}/permissions`, { permissions }),
  resetPermissions:  (id: string) => api.delete<ApiResponse<unknown>>(`/users/${id}/permissions`),
  setDistricts:      (id: string, districts: string[]) => api.patch(`/users/${id}/districts`, { districts }),
  changeRole:        (id: string, role: string) => api.patch(`/users/${id}/role`, { role }),
};

// ─── Auth (extended) ─────────────────────────────────────────────────────────
export const authGoogleApi = {
  loginOrRegister: (data: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string;
    role?: string;
    phone?: string;
    intent?: 'register' | 'login';
    kycSubmitted?: boolean;
  }) =>
    api.post<ApiResponse<{ user: unknown; token: string; requiresApproval: boolean }>>('/auth/google', data),
};

// ─── Messages ────────────────────────────────────────────────────────────────
export const messagesApi = {
  conversations: () => api.get<ApiResponse<unknown[]>>('/messages/conversations'),
  messages:      (convId: string) => api.get<ApiResponse<unknown[]>>(`/messages/${convId}`),
  send:          (convId: string, content: string) => api.post(`/messages/${convId}`, { content }),
  startConv:     (data: unknown) => api.post<ApiResponse<unknown>>('/messages/conversations', data),
};

// ─── Analytics ───────────────────────────────────────────────────────────────
export const analyticsApi = {
  dashboard:        () => api.get<ApiResponse<unknown>>('/analytics/dashboard'),
  revenue:          (params?: Record<string, unknown>) => api.get<ApiResponse<unknown>>('/analytics/revenue', { params }),
  occupancy:        () => api.get<ApiResponse<unknown>>('/analytics/occupancy'),
  inspections:      () => api.get<ApiResponse<unknown>>('/analytics/inspections'),
  maintenance:      () => api.get<ApiResponse<unknown>>('/analytics/maintenance'),
  users:            () => api.get<ApiResponse<unknown>>('/analytics/users'),
  revenueBreakdown: () => api.get<ApiResponse<unknown>>('/analytics/revenue-breakdown'),
};

// ─── Vendors ─────────────────────────────────────────────────────────────────
export const vendorsApi = {
  list:   () => api.get<ApiResponse<unknown[]>>('/vendors'),
  create: (data: unknown) => api.post<ApiResponse<unknown>>('/vendors', data),
  update: (id: string, data: unknown) => api.put(`/vendors/${id}`, data),
  rate:   (id: string, rating: number) => api.patch(`/vendors/${id}/rate`, { rating }),
};

// ─── Notifications ────────────────────────────────────────────────────────────
export const notificationsApi = {
  list:        (params?: Record<string, unknown>) => api.get<ApiResponse<unknown[]>>('/notifications', { params }),
  markRead:    (id: string) => api.patch(`/notifications/${id}/read`),
  markAllRead: () => api.patch('/notifications/read-all'),
};

// ─── Transactions ─────────────────────────────────────────────────────────────
export const transactionsApi = {
  list:   (params?: Record<string, unknown>) => api.get<ApiResponse<unknown[]>>('/transactions', { params }),
  retry:  (id: string) => api.post(`/transactions/${id}/retry`),
  refund: (id: string) => api.post(`/transactions/${id}/refund`),
};

// ─── Vendor Jobs ──────────────────────────────────────────────────────────────
export const vendorJobsApi = {
  list:   (params?: Record<string, unknown>) => api.get<ApiResponse<unknown[]>>('/vendor-jobs', { params }),
  create: (data: unknown) => api.post<ApiResponse<unknown>>('/vendor-jobs', data),
  update: (id: string, data: unknown) => api.put(`/vendor-jobs/${id}`, data),
};

// ─── Contracts ────────────────────────────────────────────────────────────────
export const contractsApi = {
  list:   (params?: Record<string, unknown>) => api.get<ApiResponse<unknown[]>>('/contracts', { params }),
  create: (data: unknown) => api.post<ApiResponse<unknown>>('/contracts', data),
  update: (id: string, data: unknown) => api.put(`/contracts/${id}`, data),
};

// ─── Documents ────────────────────────────────────────────────────────────────
export const documentsApi = {
  list:    (params?: Record<string, unknown>) => api.get<ApiResponse<unknown[]>>('/documents', { params }),
  upload:  (data: unknown) => api.post<ApiResponse<unknown>>('/documents', data),
  approve: (id: string, notes?: string) => api.patch(`/documents/${id}/approve`, { notes }),
  reject:  (id: string, notes: string) => api.patch(`/documents/${id}/reject`, { notes }),
  delete:  (id: string) => api.delete(`/documents/${id}`),
};

// ─── Notices ──────────────────────────────────────────────────────────────────
export const noticesApi = {
  list:        (params?: Record<string, unknown>) => api.get<ApiResponse<unknown[]>>('/notices', { params }),
  send:        (data: unknown) => api.post<ApiResponse<unknown>>('/notices', data),
  acknowledge: (id: string) => api.patch(`/notices/${id}/acknowledge`),
  markRead:    (id: string) => api.patch(`/notices/${id}/read`),
};

// ─── Disputes ─────────────────────────────────────────────────────────────────
export const disputesApi = {
  list:    (params?: Record<string, unknown>) => api.get<ApiResponse<unknown[]>>('/disputes', { params }),
  raise:   (data: unknown) => api.post<ApiResponse<unknown>>('/disputes', data),
  resolve: (id: string, resolution: string) => api.patch(`/disputes/${id}/resolve`, { resolution }),
  dismiss: (id: string) => api.patch(`/disputes/${id}/dismiss`),
};

// ─── Announcements ────────────────────────────────────────────────────────────
export const announcementsApi = {
  list: (params?: Record<string, unknown>) => api.get<ApiResponse<unknown[]>>('/announcements', { params }),
  send: (data: unknown) => api.post<ApiResponse<unknown>>('/announcements', data),
};

// ─── Audit Logs ───────────────────────────────────────────────────────────────
export const auditLogsApi = {
  list: (params?: Record<string, unknown>) => api.get<ApiResponse<unknown[]>>('/audit-logs', { params }),
  log:  (data: unknown) => api.post('/audit-logs', data),
};

// ─── Agent Applications ───────────────────────────────────────────────────────
export const agentApplicationsApi = {
  list:             (params?: Record<string, unknown>) => api.get<ApiResponse<unknown[]>>('/agent-applications', { params }),
  getMyApplication: () => api.get<ApiResponse<unknown>>('/agent-applications/my'),
  submit:           (data: unknown) => api.post<ApiResponse<unknown>>('/agent-applications', data),
  approve:          (id: string, adminNote?: string) => api.patch(`/agent-applications/${id}/approve`, { adminNote }),
  reject:           (id: string, adminNote?: string) => api.patch(`/agent-applications/${id}/reject`, { adminNote }),
  updateDocs:       (id: string, data: { nationalIdDoc?: string; additionalDocs?: { name: string; dataUrl: string; type: string }[] }) =>
    api.patch<ApiResponse<unknown>>(`/agent-applications/${id}/docs`, data),
};

// ─── Payment Preferences ──────────────────────────────────────────────────────
export const paymentPreferencesApi = {
  get:  (userId: string) => api.get<ApiResponse<unknown>>(`/payment-preferences/${userId}`),
  save: (data: unknown) => api.post<ApiResponse<unknown>>('/payment-preferences', data),
};

/** Global fee & company account settings (Render Postgres `platform_settings`). */
export const platformSettingsApi = {
  get: () => api.get<ApiResponse<{ feeConfig: Record<string, unknown>; companyAccounts: Record<string, unknown>; updatedAt?: string | null }>>('/platform-settings'),
  put: (data: { feeConfig?: unknown; companyAccounts?: unknown }) =>
    api.put<ApiResponse<{ feeConfig: Record<string, unknown>; companyAccounts: Record<string, unknown>; updatedAt?: string | null }>>('/platform-settings', data),
};

// ─── Bulk Sync ────────────────────────────────────────────────────────────────
// Calls all relevant endpoints in parallel and returns combined data.
// Each key maps to the resolved data array (or null on error).
export const syncApi = {
  bulkSync: async () => {
    const settle = <T>(p: Promise<{ data: ApiResponse<T> }>) =>
      p.then(r => r.data?.data ?? null).catch(() => null);

    const [
      properties,
      inspections,
      payments,
      transactions,
      maintenance,
      payouts,
      vendors,
      vendorJobs,
      documents,
      notices,
      disputes,
      announcements,
      notifications,
      conversations,
    ] = await Promise.all([
      settle(propertiesApi.list()),
      settle(inspectionsApi.list()),
      settle(paymentsApi.list()),
      settle(transactionsApi.list()),
      settle(maintenanceApi.list()),
      settle(payoutsApi.list()),
      settle(vendorsApi.list()),
      settle(vendorJobsApi.list()),
      settle(documentsApi.list()),
      settle(noticesApi.list()),
      settle(disputesApi.list()),
      settle(announcementsApi.list()),
      settle(notificationsApi.list()),
      settle(messagesApi.conversations()),
    ]);

    return {
      properties,
      inspections,
      payments,
      transactions,
      maintenance,
      payouts,
      vendors,
      vendorJobs,
      documents,
      notices,
      disputes,
      announcements,
      notifications,
      conversations,
    };
  },
};
