import { useEffect, lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'react-hot-toast';
import { AppLayout } from './components/layout/AppLayout';
import { PageLoader } from './components/ui/EmptyState';
import { InstallPrompt } from './components/pwa/InstallPrompt';
import { useAuthStore } from './store/authStore';
import { useUIStore, applyTheme } from './store/uiStore';
import { useNotificationStore } from './store/notificationStore';
import { registerServiceWorker, setupOnlineOfflineListeners } from './lib/sync';
import { mockNotifications } from './lib/mockData';
import { canAccessRoute } from './lib/rbac';

// Lazy-loaded pages
const LandingPage      = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));
const PublicPropertyPage = lazy(() => import('./pages/PublicPropertyPage').then(m => ({ default: m.PublicPropertyPage })));
const RaiseDisputePage = lazy(() => import('./pages/RaiseDisputePage').then(m => ({ default: m.RaiseDisputePage })));
const AuditLogsPage    = lazy(() => import('./pages/admin/AuditLogsPage').then(m => ({ default: m.AuditLogsPage })));
const AgentApplicationsPage = lazy(() => import('./pages/admin/AgentApplicationsPage').then(m => ({ default: m.AgentApplicationsPage })));
const LoginPage       = lazy(() => import('./pages/auth/LoginPage').then(m => ({ default: m.LoginPage })));
const RegisterPage    = lazy(() => import('./pages/auth/RegisterPage').then(m => ({ default: m.RegisterPage })));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage').then(m => ({ default: m.ForgotPasswordPage })));
const DashboardPage   = lazy(() => import('./pages/DashboardPage').then(m => ({ default: m.DashboardPage })));
const PropertiesPage  = lazy(() => import('./pages/PropertiesPage').then(m => ({ default: m.PropertiesPage })));
const PropertyDetailPage = lazy(() => import('./pages/PropertyDetailPage').then(m => ({ default: m.PropertyDetailPage })));
const SearchPage      = lazy(() => import('./pages/SearchPage').then(m => ({ default: m.SearchPage })));
const InspectionsPage = lazy(() => import('./pages/InspectionsPage').then(m => ({ default: m.InspectionsPage })));
const PaymentsPage    = lazy(() => import('./pages/PaymentsPage').then(m => ({ default: m.PaymentsPage })));
const MaintenancePage = lazy(() => import('./pages/MaintenancePage').then(m => ({ default: m.MaintenancePage })));
const PayoutsPage     = lazy(() => import('./pages/PayoutsPage').then(m => ({ default: m.PayoutsPage })));
const MessagesPage    = lazy(() => import('./pages/MessagesPage').then(m => ({ default: m.MessagesPage })));
const AnalyticsPage   = lazy(() => import('./pages/AnalyticsPage').then(m => ({ default: m.AnalyticsPage })));
const UsersPage       = lazy(() => import('./pages/UsersPage').then(m => ({ default: m.UsersPage })));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage').then(m => ({ default: m.NotificationsPage })));
const SettingsPage    = lazy(() => import('./pages/SettingsPage').then(m => ({ default: m.SettingsPage })));
// New role-specific pages
const AdminFees         = lazy(() => import('./pages/admin/AdminFees').then(m => ({ default: m.AdminFees })));
const AdminDisputes     = lazy(() => import('./pages/admin/AdminDisputes').then(m => ({ default: m.AdminDisputes })));
const AdminAnnouncements= lazy(() => import('./pages/admin/AdminAnnouncements').then(m => ({ default: m.AdminAnnouncements })));
const UnassignedProperties = lazy(() => import('./pages/admin/UnassignedProperties').then(m => ({ default: m.UnassignedProperties })));
const VettingQueue      = lazy(() => import('./pages/admin/VettingQueue').then(m => ({ default: m.VettingQueue })));
const VendorsPage       = lazy(() => import('./pages/VendorsPage').then(m => ({ default: m.VendorsPage })));
const VendorPortal      = lazy(() => import('./pages/vendor/VendorPortal').then(m => ({ default: m.VendorPortal })));
const TransactionsPage  = lazy(() => import('./pages/TransactionsPage').then(m => ({ default: m.TransactionsPage })));
const VendorContractsPage = lazy(() => import('./pages/VendorContractsPage').then(m => ({ default: m.VendorContractsPage })));
const AgentPortal       = lazy(() => import('./pages/agent/AgentPortal').then(m => ({ default: m.AgentPortal })));
const LandlordPortal    = lazy(() => import('./pages/landlord/LandlordPortal').then(m => ({ default: m.LandlordPortal })));
const TenantPortal      = lazy(() => import('./pages/tenant/TenantPortal').then(m => ({ default: m.TenantPortal })));
const GuestPage         = lazy(() => import('./pages/GuestPage').then(m => ({ default: m.GuestPage })));
const NoticesPage       = lazy(() => import('./pages/NoticesPage').then(m => ({ default: m.NoticesPage })));
const DocumentsPage     = lazy(() => import('./pages/DocumentsPage').then(m => ({ default: m.DocumentsPage })));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 5 * 60 * 1000, retry: 2, refetchOnWindowFocus: false },
  },
});

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

// Role-guarded route — checks both role AND individual permissions
function RoleRoute({ children, path }: { children: React.ReactNode; path: string }) {
  const { user } = useAuthStore();
  if (!user) return <Navigate to="/login" replace />;
  if (!canAccessRoute(user, path)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

// Authenticated users go to dashboard; guests see the landing page
function LandingOrDashboard() {
  const { isAuthenticated } = useAuthStore();
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <LandingPage />;
}
export default function App() {
  const { theme } = useUIStore();
  const { setNotifications } = useNotificationStore();
  const { isAuthenticated, syncWithBackend } = useAuthStore();

  useEffect(() => {
    // Apply theme on mount
    applyTheme(theme);

    // Listen for system theme changes
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = () => { if (theme === 'system') applyTheme('system'); };
    mq.addEventListener('change', handler);

    // Register service worker
    registerServiceWorker();

    // Setup online/offline listeners
    setupOnlineOfflineListeners();

    // Load mock notifications
    setNotifications(mockNotifications);

    // Sync user data from backend if authenticated
    if (isAuthenticated) {
      syncWithBackend();
    }

    return () => mq.removeEventListener('change', handler);
  }, [theme]);

  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-900"><PageLoader /></div>}>
          <Routes>
            {/* ── Public routes (no auth needed) ── */}
            <Route path="/"              element={<LandingOrDashboard />} />
            <Route path="/browse/:id"    element={<PublicPropertyPage />} />

            {/* Public auth routes */}
            <Route path="/login"           element={<PublicRoute><LoginPage /></PublicRoute>} />
            <Route path="/register"        element={<PublicRoute><RegisterPage /></PublicRoute>} />
            <Route path="/forgot-password" element={<PublicRoute><ForgotPasswordPage /></PublicRoute>} />

            {/* Protected app routes */}
            <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
              <Route path="/dashboard"        element={<DashboardPage />} />
              <Route path="/properties"       element={<PropertiesPage />} />
              <Route path="/properties/:id"   element={<PropertyDetailPage />} />
              <Route path="/search"           element={<SearchPage />} />
              <Route path="/inspections"      element={<RoleRoute path="/inspections"><InspectionsPage /></RoleRoute>} />
              <Route path="/payments"         element={<RoleRoute path="/payments"><PaymentsPage /></RoleRoute>} />
              <Route path="/maintenance"      element={<RoleRoute path="/maintenance"><MaintenancePage /></RoleRoute>} />
              <Route path="/payouts"          element={<RoleRoute path="/payouts"><PayoutsPage /></RoleRoute>} />
              <Route path="/messages"         element={<MessagesPage />} />
              <Route path="/analytics"        element={<RoleRoute path="/analytics"><AnalyticsPage /></RoleRoute>} />
              <Route path="/users"            element={<RoleRoute path="/users"><UsersPage /></RoleRoute>} />
              <Route path="/notifications"    element={<NotificationsPage />} />
              <Route path="/settings"         element={<SettingsPage />} />
              <Route path="/settings/profile" element={<SettingsPage />} />
              {/* Alias routes */}
              <Route path="/leases"           element={<RoleRoute path="/payments"><PaymentsPage /></RoleRoute>} />
              <Route path="/favorites"        element={<RoleRoute path="/tenant"><TenantPortal /></RoleRoute>} />
              <Route path="/my-lease"         element={<RoleRoute path="/tenant"><TenantPortal /></RoleRoute>} />
              {/* Role-specific routes */}
              <Route path="/admin/fees"           element={<RoleRoute path="/admin/fees"><AdminFees /></RoleRoute>} />
              <Route path="/admin/disputes"       element={<RoleRoute path="/admin/disputes"><AdminDisputes /></RoleRoute>} />
              <Route path="/admin/announcements"  element={<RoleRoute path="/admin/announcements"><AdminAnnouncements /></RoleRoute>} />
              <Route path="/admin/unassigned"     element={<RoleRoute path="/admin/unassigned"><UnassignedProperties /></RoleRoute>} />
              <Route path="/admin/vetting"        element={<RoleRoute path="/admin/vetting"><VettingQueue /></RoleRoute>} />
              <Route path="/admin/audit"          element={<RoleRoute path="/admin/audit"><AuditLogsPage /></RoleRoute>} />
              <Route path="/admin/agents"         element={<RoleRoute path="/admin/agents"><AgentApplicationsPage /></RoleRoute>} />
              <Route path="/vendors"              element={<RoleRoute path="/vendors"><VendorsPage /></RoleRoute>} />
              <Route path="/vendor"               element={<RoleRoute path="/vendor"><VendorPortal /></RoleRoute>} />
              <Route path="/vendor/profile"       element={<RoleRoute path="/vendor/profile"><VendorPortal /></RoleRoute>} />
              <Route path="/transactions"         element={<RoleRoute path="/transactions"><TransactionsPage /></RoleRoute>} />
              <Route path="/contracts"            element={<RoleRoute path="/contracts"><VendorContractsPage /></RoleRoute>} />
              <Route path="/agent"                element={<RoleRoute path="/agent"><AgentPortal /></RoleRoute>} />
              <Route path="/landlord"             element={<RoleRoute path="/landlord"><LandlordPortal /></RoleRoute>} />
              <Route path="/tenant"               element={<RoleRoute path="/tenant"><TenantPortal /></RoleRoute>} />
              <Route path="/tools"                element={<GuestPage />} />
              <Route path="/notices"              element={<RoleRoute path="/notices"><NoticesPage /></RoleRoute>} />
              <Route path="/documents"            element={<RoleRoute path="/documents"><DocumentsPage /></RoleRoute>} />
              <Route path="/disputes"             element={<RaiseDisputePage />} />
            </Route>

            {/* Catch-all */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
      </BrowserRouter>

      {/* PWA install prompt — shown on all pages */}
      <InstallPrompt />

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: '12px',
            fontSize: '14px',
            fontFamily: 'Inter, system-ui, sans-serif',
          },
        }}
      />
    </QueryClientProvider>
  );
}
