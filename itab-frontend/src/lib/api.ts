import axios from 'axios';
import type { ApiResponse } from '../types';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach token
api.interceptors.request.use(config => {
  const token = localStorage.getItem('itab_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Handle 401
api.interceptors.response.use(
  res => res,
  err => {
    if (err.response?.status === 401) {
      localStorage.removeItem('itab_token');
      localStorage.removeItem('itab_user');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

// ─── Auth ────────────────────────────────────────────────────────────────────
export const authApi = {
  login:         (data: { email: string; password: string }) => api.post<ApiResponse<{ token: string; user: unknown }>>('/auth/login', data),
  register:      (data: unknown) => api.post<ApiResponse<{ token: string; user: unknown }>>('/auth/register', data),
  forgotPassword:(data: { email: string }) => api.post('/auth/forgot-password', data),
  resetPassword: (data: { token: string; password: string }) => api.post('/auth/reset-password', data),
  me:            () => api.get<ApiResponse<unknown>>('/auth/me'),
  updateProfile: (data: unknown) => api.put('/auth/profile', data),
};

// ─── Properties ──────────────────────────────────────────────────────────────
export const propertiesApi = {
  list:    (params?: Record<string, unknown>) => api.get<ApiResponse<unknown[]>>('/properties', { params }),
  get:     (id: string) => api.get<ApiResponse<unknown>>(`/properties/${id}`),
  create:  (data: unknown) => api.post<ApiResponse<unknown>>('/properties', data),
  update:  (id: string, data: unknown) => api.put<ApiResponse<unknown>>(`/properties/${id}`, data),
  delete:  (id: string) => api.delete(`/properties/${id}`),
  feature: (id: string) => api.patch(`/properties/${id}/feature`),
  uploadPhotos: (id: string, files: FormData) => api.post(`/properties/${id}/photos`, files, { headers: { 'Content-Type': 'multipart/form-data' } }),
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
  suspend:           (id: string, reason?: string) => api.patch(`/users/${id}/suspend`, { reason }),
  unsuspend:         (id: string) => api.patch(`/users/${id}/unsuspend`),
  approve:           (id: string) => api.patch(`/users/${id}/approve`),
  rejectApproval:    (id: string, reason: string) => api.patch(`/users/${id}/reject-approval`, { reason }),
  pending:           () => api.get<ApiResponse<unknown[]>>('/users/pending'),
  setPermissions:    (id: string, permissions: unknown) => api.patch(`/users/${id}/permissions`, { permissions }),
  setDistricts:      (id: string, districts: string[]) => api.patch(`/users/${id}/districts`, { districts }),
  changeRole:        (id: string, role: string) => api.patch(`/users/${id}/role`, { role }),
};

// ─── Auth (extended) ─────────────────────────────────────────────────────────
export const authGoogleApi = {
  loginOrRegister: (data: { googleId: string; email: string; firstName: string; lastName: string; avatar?: string; role?: string }) =>
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
  dashboard: () => api.get<ApiResponse<unknown>>('/analytics/dashboard'),
  revenue:   (params?: Record<string, unknown>) => api.get<ApiResponse<unknown>>('/analytics/revenue', { params }),
  occupancy: () => api.get<ApiResponse<unknown>>('/analytics/occupancy'),
};

// ─── Vendors ─────────────────────────────────────────────────────────────────
export const vendorsApi = {
  list:   () => api.get<ApiResponse<unknown[]>>('/vendors'),
  create: (data: unknown) => api.post<ApiResponse<unknown>>('/vendors', data),
  update: (id: string, data: unknown) => api.put(`/vendors/${id}`, data),
  rate:   (id: string, rating: number) => api.patch(`/vendors/${id}/rate`, { rating }),
};
