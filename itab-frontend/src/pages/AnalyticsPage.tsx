import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  TrendingUp, Building2, DollarSign, Users, Scale, Receipt,
  AlertCircle, RefreshCw, Wrench, Calendar, Clock, CheckCircle2,
} from 'lucide-react';
import { StatCard } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { formatCurrency } from '../lib/utils';
import { useAuthStore } from '../store/authStore';
import { usePropertyStore } from '../store/propertyStore';
import { useUserStore } from '../store/userStore';
import { usePaymentStore } from '../store/paymentStore';
import { useDisputeStore } from '../store/disputeStore';
import { useDataStore } from '../store/dataStore';
import { filterPropertiesForUser } from '../lib/rbac';
import { analyticsApi } from '../lib/api';

// ─── Reusable bar chart ──────────────────────────────────────────────────────
function BarChart({ data, label }: { data: { label: string; value: number; color: string }[]; label: string }) {
  const max = Math.max(...data.map(d => d.value), 1);
  return (
    <div>
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">{label}</p>
      <div className="flex items-end gap-2 h-36">
        {data.map(d => (
          <div key={d.label} className="flex-1 flex flex-col items-center gap-1 min-w-0">
            <p className="text-xs text-slate-500 font-medium">{d.value}</p>
            <div className="w-full rounded-t-lg transition-all duration-500" style={{ height: `${(d.value / max) * 100}%`, backgroundColor: d.color }} />
            <p className="text-xs text-slate-400 truncate w-full text-center">{d.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Horizontal progress bar row ─────────────────────────────────────────────
function ProgressRow({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className={`w-3 h-3 rounded-full flex-shrink-0`} style={{ backgroundColor: color }} />
      <p className="text-sm text-slate-700 dark:text-slate-300 w-32 truncate">{label}</p>
      <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${total > 0 ? (count / total) * 100 : 0}%` }}
          transition={{ duration: 0.6 }}
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
        />
      </div>
      <p className="text-sm font-bold text-slate-900 dark:text-slate-100 w-8 text-right">{count}</p>
    </div>
  );
}

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, children, delay = 0 }: { title: string; children: React.ReactNode; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5"
    >
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">{title}</p>
      {children}
    </motion.div>
  );
}

// ─── Types for API responses ──────────────────────────────────────────────────
interface DashboardStats {
  totalProperties: number; vacantProperties: number; occupiedProperties: number;
  totalTenants: number; pendingMaintenance: number; monthlyRevenue: number;
  pendingPayouts: number; inspectionFeeRevenue: number; conversionRate: number;
}
interface MonthlyRevRow { month: string; total: string; rent?: string; inspection?: string; }
interface OccupancyRow  { district: string; total: string; occupied: string; }
interface InspectionStatus { status: string; count: string; }
interface MaintenanceStatus { status: string; count: string; }
interface MaintenancePriority { priority: string; count: string; }
interface UserGrowthRow { month: string; count: string; }
interface UserRoleRow   { role: string; count: string; }
interface KycRow        { kyc_status: string; count: string; }
interface RevenueTypeRow { type: string; total: string; count: string; }
interface TopPropertyRow { property_title: string; total: string; }

export function AnalyticsPage() {
  const { user } = useAuthStore();
  const { properties: allProperties } = usePropertyStore();
  const { users } = useUserStore();
  const { transactions, getPlatformRevenue } = usePaymentStore();
  const { disputes } = useDisputeStore();
  const { payouts, maintenance } = useDataStore();
  const isAdmin = user?.role === 'admin';
  const isManager = user?.role === 'property_manager';

  const properties = filterPropertiesForUser(allProperties, user);

  // ── API state ────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [dashStats,       setDashStats]       = useState<DashboardStats | null>(null);
  const [revenueMonthly,  setRevenueMonthly]  = useState<MonthlyRevRow[]>([]);
  const [occupancyData,   setOccupancyData]   = useState<OccupancyRow[]>([]);
  const [inspStats,       setInspStats]       = useState<{ statuses: InspectionStatus[] } | null>(null);
  const [maintStats,      setMaintStats]      = useState<{ byStatus: MaintenanceStatus[]; byPriority: MaintenancePriority[]; avgResolutionDays: number } | null>(null);
  const [userStats,       setUserStats]       = useState<{ growth: UserGrowthRow[]; byRole: UserRoleRow[]; kycStats: KycRow[] } | null>(null);
  const [revBreakdown,    setRevBreakdown]    = useState<{ byType: RevenueTypeRow[]; topProperties: TopPropertyRow[] } | null>(null);

  const fetchAll = async () => {
    setLoading(true);
    try {
      const calls: Promise<void>[] = [
        analyticsApi.dashboard().then(r => setDashStats((r.data as { data: DashboardStats }).data)).catch(() => {}),
        analyticsApi.revenue().then(r => setRevenueMonthly((r.data as { data: MonthlyRevRow[] }).data || [])).catch(() => {}),
        analyticsApi.occupancy().then(r => setOccupancyData((r.data as { data: OccupancyRow[] }).data || [])).catch(() => {}),
        analyticsApi.inspections().then(r => setInspStats((r.data as { data: typeof inspStats }).data)).catch(() => {}),
        analyticsApi.maintenance().then(r => setMaintStats((r.data as { data: typeof maintStats }).data)).catch(() => {}),
      ];
      if (isAdmin) {
        calls.push(
          analyticsApi.users().then(r => setUserStats((r.data as { data: typeof userStats }).data)).catch(() => {}),
          analyticsApi.revenueBreakdown().then(r => setRevBreakdown((r.data as { data: typeof revBreakdown }).data)).catch(() => {}),
        );
      } else if (isManager) {
        calls.push(
          analyticsApi.revenueBreakdown().then(r => setRevBreakdown((r.data as { data: typeof revBreakdown }).data)).catch(() => {}),
        );
      }
      await Promise.all(calls);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Derived values ─────────────────────────────────────────────────────
  const stats = dashStats ?? {
    totalProperties:    properties.length,
    vacantProperties:   properties.filter(p => p.status === 'published').length,
    occupiedProperties: properties.filter(p => p.status === 'rented').length,
    monthlyRevenue: 0,
    conversionRate: properties.length > 0
      ? Math.round((properties.filter(p => p.status === 'rented').length / properties.length) * 100) : 0,
    inspectionFeeRevenue: 0,
    pendingPayouts: payouts.filter(p => p.status === 'pending').length,
    totalTenants: users.filter(u => u.role === 'tenant').length,
    pendingMaintenance: maintenance.filter(m => !['completed', 'cancelled'].includes(m.status)).length,
  };

  const platformRevenue   = getPlatformRevenue();
  const totalTxVolume     = transactions.filter(t => t.type === 'rent_payment' && t.status === 'completed').reduce((s, t) => s + t.amount, 0);
  const failedTxCount     = transactions.filter(t => t.status === 'failed').length;
  const openDisputes      = disputes.filter(d => d.status === 'open' || d.status === 'under_review').length;
  const activeUsers       = users.filter(u => !u.isSuspended).length;
  const pendingKYC        = users.filter(u => u.kycStatus === 'submitted').length;

  // Revenue chart — real data from backend, fall back to property store
  const revenueChartData = revenueMonthly.length > 0
    ? [...revenueMonthly].reverse().slice(-6).map(r => ({
        label: new Date(r.month).toLocaleString('default', { month: 'short' }),
        value: Math.round(parseInt(r.total) / 1000),
        color: '#2563eb',
      }))
    : [{ label: 'This month', value: Math.round(stats.monthlyRevenue / 1000), color: '#2563eb' }];

  // Occupancy by district
  const occupancyRows = occupancyData
    .filter(r => parseInt(r.total) > 0)
    .sort((a, b) => parseInt(b.total) - parseInt(a.total))
    .slice(0, 8);

  // Property type breakdown (client-side)
  const propTypeColors: Record<string, string> = {
    apartment: '#8b5cf6', house: '#10b981', commercial: '#f59e0b', land: '#ef4444',
  };
  const propertyTypes = ['apartment', 'house', 'commercial', 'land'].map(t => ({
    label: t.charAt(0).toUpperCase() + t.slice(1),
    value: properties.filter(p => p.type === t).length,
    color: propTypeColors[t],
  })).filter(d => d.value > 0);

  // Inspection status (real data)
  const inspStatusColors: Record<string, string> = {
    pending: '#f59e0b', confirmed: '#3b82f6', completed: '#10b981',
    cancelled: '#ef4444', no_show: '#64748b',
  };
  const inspRows = (inspStats?.statuses || []).map(r => ({
    label: r.status.replace('_', ' '),
    count: parseInt(r.count),
    color: inspStatusColors[r.status] || '#94a3b8',
  }));
  const inspTotal = inspRows.reduce((s, r) => s + r.count, 0);

  // Maintenance stats (real data)
  const maintStatusColors: Record<string, string> = {
    submitted: '#f59e0b', assigned: '#3b82f6', in_progress: '#8b5cf6',
    completed: '#10b981', cancelled: '#ef4444',
  };
  const maintRows = (maintStats?.byStatus || []).map(r => ({
    label: r.status.replace('_', ' '),
    count: parseInt(r.count),
    color: maintStatusColors[r.status] || '#94a3b8',
  }));
  const maintTotal = maintRows.reduce((s, r) => s + r.count, 0);

  const maintPriorityColors: Record<string, string> = { urgent: '#ef4444', normal: '#3b82f6', low: '#94a3b8' };
  const maintPriorityRows = (maintStats?.byPriority || []).map(r => ({
    label: r.priority,
    count: parseInt(r.count),
    color: maintPriorityColors[r.priority] || '#94a3b8',
  }));

  // Revenue by type (real data)
  const revTypeColors: Record<string, string> = {
    rent: '#10b981', rent_partial: '#34d399', inspection_fee: '#3b82f6',
    deposit: '#8b5cf6', late_fee: '#ef4444',
  };
  const revTypeRows = (revBreakdown?.byType || []).map(r => ({
    label: r.type.replace('_', ' '),
    value: Math.round(parseInt(r.total) / 1000),
    color: revTypeColors[r.type] || '#94a3b8',
  })).filter(r => r.value > 0).sort((a, b) => b.value - a.value);

  // User growth chart
  const userGrowthChart = userStats
    ? [...(userStats.growth || [])].reverse().slice(-6).map(r => ({
        label: new Date(r.month).toLocaleString('default', { month: 'short' }),
        value: parseInt(r.count),
        color: '#8b5cf6',
      }))
    : [];

  const roleColors: Record<string, string> = {
    admin: '#ef4444', property_manager: '#8b5cf6', landlord: '#3b82f6',
    tenant: '#10b981', agent: '#f59e0b', vendor: '#f97316',
  };
  const userRoleRows = (userStats?.byRole || users.reduce<UserRoleRow[]>((acc, u) => {
    const existing = acc.find(r => r.role === u.role);
    if (existing) existing.count = String(parseInt(existing.count) + 1);
    else acc.push({ role: u.role, count: '1' });
    return acc;
  }, [])).map(r => ({
    label: r.role.replace('_', ' '),
    count: parseInt(r.count),
    color: roleColors[r.role] || '#94a3b8',
  }));
  const totalUsersCount = userRoleRows.reduce((s, r) => s + r.count, 0) || users.length || 1;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Analytics</h1>
          <p className="text-sm text-slate-500 mt-0.5">Live platform performance data</p>
        </div>
        <Button
          size="sm" variant="secondary"
          icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
          onClick={fetchAll} disabled={loading}
        >
          {loading ? 'Refreshing…' : 'Refresh'}
        </Button>
      </div>

      {/* ── KPI row ──────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Monthly Revenue" value={formatCurrency(stats.monthlyRevenue)}
          icon={<DollarSign className="w-6 h-6 text-green-600" />} iconBg="bg-green-100 dark:bg-green-900/30"
          subtitle="Completed payments this month"
        />
        <StatCard
          title="Occupancy Rate"
          value={`${Math.round((stats.occupiedProperties / (stats.totalProperties || 1)) * 100)}%`}
          icon={<Building2 className="w-6 h-6 text-primary-600" />} iconBg="bg-primary-100 dark:bg-primary-900/30"
          subtitle={`${stats.occupiedProperties} of ${stats.totalProperties} rented`}
        />
        <StatCard
          title="Inspection Revenue" value={formatCurrency(stats.inspectionFeeRevenue)}
          icon={<Calendar className="w-6 h-6 text-yellow-500" />} iconBg="bg-yellow-100 dark:bg-yellow-900/30"
          subtitle="Fees collected this month"
        />
        <StatCard
          title="Pending Maintenance" value={stats.pendingMaintenance}
          icon={<Wrench className="w-6 h-6 text-orange-500" />} iconBg="bg-orange-100 dark:bg-orange-900/30"
          subtitle="Open requests"
        />
      </div>

      {/* ── Admin platform-wide stats ─────────────────────────────────────── */}
      {isAdmin && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard
              title="Platform Revenue" value={formatCurrency(platformRevenue)}
              subtitle="ITAB fees collected" icon={<Receipt className="w-6 h-6 text-primary-600" />}
              iconBg="bg-primary-100 dark:bg-primary-900/30"
            />
            <StatCard
              title="Total Tx Volume" value={formatCurrency(totalTxVolume)}
              subtitle="Completed rent payments" icon={<TrendingUp className="w-6 h-6 text-green-600" />}
              iconBg="bg-green-100 dark:bg-green-900/30"
            />
            <StatCard
              title="Active Users" value={activeUsers}
              subtitle={pendingKYC > 0 ? `${pendingKYC} pending KYC` : 'All verified'}
              icon={<Users className="w-6 h-6 text-blue-600" />} iconBg="bg-blue-100 dark:bg-blue-900/30"
            />
            <StatCard
              title="Open Disputes" value={openDisputes}
              subtitle={failedTxCount > 0 ? `${failedTxCount} failed transactions` : 'Transactions healthy'}
              icon={<Scale className="w-6 h-6 text-red-500" />} iconBg="bg-red-100 dark:bg-red-900/30"
            />
          </div>

          {failedTxCount > 0 && (
            <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
              <AlertCircle size={18} className="text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-800 dark:text-red-300 text-sm">
                  {failedTxCount} failed transaction{failedTxCount !== 1 ? 's' : ''} need attention
                </p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                  Go to Transactions → filter by "Failed" to retry or refund.
                </p>
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Charts row 1 ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue trend */}
        <Section title="Monthly Revenue (UGX thousands)" delay={0.05}>
          {revenueChartData.length > 0
            ? <BarChart data={revenueChartData} label="" />
            : <p className="text-sm text-slate-400 text-center py-8">No payment data yet</p>
          }
        </Section>

        {/* Property type mix */}
        <Section title="Properties by Type" delay={0.1}>
          {propertyTypes.length > 0
            ? <BarChart data={propertyTypes} label="" />
            : <p className="text-sm text-slate-400 text-center py-8">No properties yet</p>
          }
        </Section>
      </div>

      {/* ── Charts row 2 ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Property status distribution */}
        <Section title="Property Status" delay={0.15}>
          <div className="space-y-3">
            {[
              { label: 'Published',    status: 'published',      color: '#10b981' },
              { label: 'Rented',       status: 'rented',         color: '#3b82f6' },
              { label: 'Draft',        status: 'draft',          color: '#94a3b8' },
              { label: 'Pending Vetting', status: 'pending_vetting', color: '#f59e0b' },
              { label: 'Maintenance',  status: 'under_maintenance', color: '#f97316' },
            ].map(s => (
              <ProgressRow
                key={s.status}
                label={s.label}
                count={properties.filter(p => p.status === s.status).length}
                total={properties.length || 1}
                color={s.color}
              />
            ))}
          </div>
        </Section>

        {/* District occupancy */}
        <Section title="Occupancy by District" delay={0.2}>
          {occupancyRows.length > 0 ? (
            <div className="space-y-3">
              {occupancyRows.map(r => (
                <div key={r.district} className="flex items-center gap-3">
                  <p className="text-sm text-slate-700 dark:text-slate-300 w-28 truncate">{r.district}</p>
                  <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2 relative">
                    <div
                      className="h-full rounded-full bg-slate-300 dark:bg-slate-600"
                      style={{ width: '100%' }}
                    />
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${(parseInt(r.occupied) / parseInt(r.total)) * 100}%` }}
                      transition={{ duration: 0.6 }}
                      className="h-full rounded-full bg-primary-500 absolute top-0 left-0"
                    />
                  </div>
                  <p className="text-xs text-slate-500 w-16 text-right">
                    {r.occupied}/{r.total} rented
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">No property data yet</p>
          )}
        </Section>
      </div>

      {/* ── Inspection & Maintenance ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Inspection status */}
        <Section title="Inspections by Status" delay={0.25}>
          {inspRows.length > 0 ? (
            <div className="space-y-3">
              {inspRows.map(r => (
                <ProgressRow key={r.label} label={r.label} count={r.count} total={inspTotal || 1} color={r.color} />
              ))}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                <span className="text-xs text-slate-400">Total inspections</span>
                <span className="font-bold text-slate-900 dark:text-slate-100">{inspTotal}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">No inspection data yet</p>
          )}
        </Section>

        {/* Maintenance by status */}
        <Section title="Maintenance by Status" delay={0.3}>
          {maintRows.length > 0 ? (
            <div className="space-y-3">
              {maintRows.map(r => (
                <ProgressRow key={r.label} label={r.label} count={r.count} total={maintTotal || 1} color={r.color} />
              ))}
              {maintStats && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700 flex items-center gap-2">
                  <Clock size={13} className="text-slate-400" />
                  <span className="text-xs text-slate-400">Avg resolution:</span>
                  <span className="text-xs font-bold text-slate-900 dark:text-slate-100">
                    {maintStats.avgResolutionDays > 0 ? `${maintStats.avgResolutionDays} days` : 'N/A'}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">No maintenance data yet</p>
          )}
        </Section>

        {/* Maintenance by priority */}
        <Section title="Maintenance by Priority" delay={0.35}>
          {maintPriorityRows.length > 0 ? (
            <div className="space-y-3">
              {maintPriorityRows.map(r => (
                <ProgressRow key={r.label} label={r.label} count={r.count} total={maintTotal || 1} color={r.color} />
              ))}
            </div>
          ) : (
            <p className="text-sm text-slate-400 text-center py-8">No maintenance data yet</p>
          )}
        </Section>
      </div>

      {/* ── Admin: revenue breakdown + user stats ────────────────────────── */}
      {(isAdmin || isManager) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Revenue by payment type */}
          <Section title="Revenue by Payment Type (UGX thousands)" delay={0.4}>
            {revTypeRows.length > 0
              ? <BarChart data={revTypeRows} label="" />
              : <p className="text-sm text-slate-400 text-center py-8">No revenue data yet</p>
            }
          </Section>

          {/* Top revenue properties */}
          <Section title="Top Earning Properties" delay={0.45}>
            {revBreakdown?.topProperties && revBreakdown.topProperties.length > 0 ? (
              <div className="space-y-3">
                {revBreakdown.topProperties.map((p, i) => (
                  <div key={p.property_title} className="flex items-center gap-3">
                    <span className="text-base font-bold text-slate-300 dark:text-slate-600 w-6">#{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{p.property_title}</p>
                    </div>
                    <p className="text-sm font-bold text-green-600 flex-shrink-0">{formatCurrency(parseInt(p.total))}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-slate-400 text-center py-8">No revenue data yet</p>
            )}
          </Section>
        </div>
      )}

      {/* ── Admin-only: User analytics ────────────────────────────────────── */}
      {isAdmin && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* User growth chart */}
          <Section title="User Registrations (last 6 months)" delay={0.5}>
            {userGrowthChart.length > 0
              ? <BarChart data={userGrowthChart} label="" />
              : <p className="text-sm text-slate-400 text-center py-8">No registration data yet</p>
            }
          </Section>

          {/* Users by role */}
          <Section title="Users by Role" delay={0.55}>
            <div className="space-y-3">
              {userRoleRows.map(r => (
                <ProgressRow key={r.label} label={r.label.replace('_', ' ')} count={r.count} total={totalUsersCount} color={r.color} />
              ))}
              {userStats && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-700">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">KYC Status</p>
                  <div className="flex flex-wrap gap-2">
                    {(userStats.kycStats || []).map(r => (
                      <span key={r.kyc_status} className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                        r.kyc_status === 'approved' ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                        r.kyc_status === 'submitted' ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                        r.kyc_status === 'rejected' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                        'bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400'
                      }`}>
                        {r.kyc_status}: {r.count}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Section>
        </div>
      )}

      {/* ── Top properties by views ───────────────────────────────────────── */}
      {properties.some(p => p.viewCount > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700"
        >
          <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
            <CheckCircle2 size={16} className="text-primary-600" />
            <h2 className="font-bold text-slate-900 dark:text-slate-100 text-sm">Top Properties by Views</h2>
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {[...properties].sort((a, b) => b.viewCount - a.viewCount).slice(0, 5).map((p, i) => (
              <div key={p.id} className="flex items-center gap-4 px-5 py-3.5">
                <span className="text-lg font-bold text-slate-300 dark:text-slate-600 w-6">#{i + 1}</span>
                {p.photos[0]
                  ? <img src={p.photos[0]} alt={p.title} className="w-10 h-10 rounded-xl object-cover flex-shrink-0" />
                  : <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center flex-shrink-0"><Building2 size={14} className="text-slate-400" /></div>
                }
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">{p.title}</p>
                  <p className="text-xs text-slate-400">{p.district}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-slate-900 dark:text-slate-100">{p.viewCount}</p>
                  <p className="text-xs text-slate-400">views</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
