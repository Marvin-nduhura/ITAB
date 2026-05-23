import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, Building2, DollarSign, Calendar, Users, Scale, Receipt, AlertCircle, RefreshCw } from 'lucide-react';
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

// Simple bar chart component
function BarChart({ data, label }: { data: { label: string; value: number; color: string }[]; label: string }) {
  const max = Math.max(...data.map(d => d.value));
  return (
    <div>
      <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">{label}</p>
      <div className="flex items-end gap-2 h-32">
        {data.map(d => (
          <div key={d.label} className="flex-1 flex flex-col items-center gap-1">
            <p className="text-xs text-slate-500 font-medium">{d.value}</p>
            <div className="w-full rounded-t-lg transition-all duration-500" style={{ height: `${(d.value / max) * 100}%`, backgroundColor: d.color }} />
            <p className="text-xs text-slate-400 truncate w-full text-center">{d.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsPage() {
  const { user } = useAuthStore();
  const { properties: allProperties } = usePropertyStore();
  const { users } = useUserStore();
  const { transactions, getPlatformRevenue } = usePaymentStore();
  const { disputes } = useDisputeStore();
  const { payouts } = useDataStore();
  const isAdminUser = user?.role === 'admin';

  // Backend analytics stats
  const [apiStats, setApiStats] = useState<{
    totalProperties: number; vacantProperties: number; occupiedProperties: number;
    totalTenants: number; pendingMaintenance: number; monthlyRevenue: number;
    pendingPayouts: number; inspectionFeeRevenue: number; conversionRate: number;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = async () => {
    setRefreshing(true);
    try {
      const res = await analyticsApi.dashboard();
      const d = (res.data as { data: typeof apiStats }).data;
      if (d) setApiStats(d);
    } catch { /* keep local */ }
    finally { setRefreshing(false); }
  };

  useEffect(() => { fetchStats(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Scope analytics to properties this user manages/owns
  const properties = filterPropertiesForUser(allProperties, user);

  const stats = apiStats ?? {
    totalProperties:      properties.length,
    vacantProperties:     properties.filter(p => p.status === 'published').length,
    occupiedProperties:   properties.filter(p => p.status === 'rented').length,
    monthlyRevenue:       0,
    conversionRate:       properties.length > 0 ? Math.round((properties.filter(p => p.status === 'rented').length / properties.length) * 100) : 0,
    inspectionFeeRevenue: 0,
    pendingPayouts:       payouts.filter(p => p.status === 'pending').length,
    totalTenants:         users.filter(u => u.role === 'tenant').length,
    pendingMaintenance:   0,
  };

  const platformRevenue = getPlatformRevenue();
  const totalTransactionVolume = transactions.filter(t => t.type === 'rent_payment' && t.status === 'completed').reduce((s, t) => s + t.amount, 0);
  const failedTransactions = transactions.filter(t => t.status === 'failed').length;
  const openDisputes = disputes.filter(d => d.status === 'open' || d.status === 'under_review').length;
  const activeUsers = users.filter(u => !u.isSuspended).length;
  const pendingKYC = users.filter(u => u.kycStatus === 'submitted').length;

  const monthlyRevenue = [
    { label: 'Oct', value: 2800000, color: '#3b82f6' },
    { label: 'Nov', value: 3100000, color: '#3b82f6' },
    { label: 'Dec', value: 2900000, color: '#3b82f6' },
    { label: 'Jan', value: 3400000, color: '#3b82f6' },
    { label: 'Feb', value: 3200000, color: '#3b82f6' },
    { label: 'Mar', value: 3600000, color: '#2563eb' },
  ];

  const propertyTypes = [
    { label: 'Apartment', value: properties.filter(p => p.type === 'apartment').length, color: '#8b5cf6' },
    { label: 'House',     value: properties.filter(p => p.type === 'house').length,     color: '#10b981' },
    { label: 'Commercial',value: properties.filter(p => p.type === 'commercial').length,color: '#f59e0b' },
    { label: 'Land',      value: properties.filter(p => p.type === 'land').length || 1, color: '#ef4444' },
  ];

  const inspectionConversion = [
    { label: 'Viewed', value: 100, color: '#e2e8f0' },
    { label: 'Signed Up', value: 45, color: '#93c5fd' },
    { label: 'Booked', value: 28, color: '#60a5fa' },
    { label: 'Paid Fee', value: 20, color: '#3b82f6' },
    { label: 'Leased', value: 12, color: '#1d4ed8' },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Analytics</h1>
        <p className="text-sm text-slate-500 mt-0.5">Business performance overview</p>
      </div>
      <Button size="sm" variant="secondary" icon={<RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />} onClick={fetchStats} disabled={refreshing}>Refresh</Button>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Revenue" value={formatCurrency(stats.monthlyRevenue)} icon={<DollarSign className="w-6 h-6 text-green-600" />} iconBg="bg-green-100 dark:bg-green-900/30" trend={{ value: 8, label: 'vs last month' }} />
        <StatCard title="Occupancy Rate" value={`${Math.round((stats.occupiedProperties / (stats.totalProperties || 1)) * 100)}%`} icon={<Building2 className="w-6 h-6 text-primary-600" />} iconBg="bg-primary-100 dark:bg-primary-900/30" trend={{ value: 3, label: 'vs last month' }} />
        <StatCard title="Conversion Rate" value={`${stats.conversionRate}%`} subtitle="Guest → Tenant" icon={<TrendingUp className="w-6 h-6 text-purple-600" />} iconBg="bg-purple-100 dark:bg-purple-900/30" />
        <StatCard title="Inspection Revenue" value={formatCurrency(stats.inspectionFeeRevenue)} icon={<Calendar className="w-6 h-6 text-gold-500" />} iconBg="bg-yellow-100 dark:bg-yellow-900/30" />
      </div>

      {/* Admin-only platform-wide stats */}
      {isAdminUser && (
        <div className="space-y-4">
          <h2 className="font-bold text-slate-900 dark:text-slate-100">Platform-Wide Overview</h2>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StatCard title="Platform Revenue" value={formatCurrency(platformRevenue)} subtitle="ITAB fees collected" icon={<Receipt className="w-6 h-6 text-primary-600" />} iconBg="bg-primary-100 dark:bg-primary-900/30" />
            <StatCard title="Transaction Volume" value={formatCurrency(totalTransactionVolume)} subtitle="Total rent processed" icon={<DollarSign className="w-6 h-6 text-green-600" />} iconBg="bg-green-100 dark:bg-green-900/30" />
            <StatCard title="Active Users" value={activeUsers} subtitle={`${pendingKYC} pending KYC`} icon={<Users className="w-6 h-6 text-blue-600" />} iconBg="bg-blue-100 dark:bg-blue-900/30" />
            <StatCard title="Open Disputes" value={openDisputes} subtitle={failedTransactions > 0 ? `${failedTransactions} failed txns` : 'All transactions OK'} icon={<Scale className="w-6 h-6 text-red-500" />} iconBg="bg-red-100 dark:bg-red-900/30" />
          </div>

          {/* User breakdown */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5">
            <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-4">Users by Role</h3>
            <div className="space-y-3">
              {(['admin', 'property_manager', 'landlord', 'tenant', 'agent', 'vendor'] as const).map(role => {
                const count = users.filter(u => u.role === role).length;
                const suspended = users.filter(u => u.role === role && u.isSuspended).length;
                const colors: Record<string, string> = {
                  admin: 'bg-red-500', property_manager: 'bg-purple-500', landlord: 'bg-blue-500',
                  tenant: 'bg-green-500', agent: 'bg-yellow-500', vendor: 'bg-orange-500',
                };
                return (
                  <div key={role} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${colors[role]} flex-shrink-0`} />
                    <p className="text-sm text-slate-700 dark:text-slate-300 w-36 capitalize">{role.replace('_', ' ')}</p>
                    <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                      <motion.div initial={{ width: 0 }} animate={{ width: `${(count / (users.length || 1)) * 100}%` }} transition={{ duration: 0.6 }}
                        className={`h-full rounded-full ${colors[role]}`} />
                    </div>
                    <p className="text-sm font-bold text-slate-900 dark:text-slate-100 w-8 text-right">{count}</p>
                    {suspended > 0 && <p className="text-xs text-red-500">({suspended} suspended)</p>}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Failed transactions alert */}
          {failedTransactions > 0 && (
            <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
              <AlertCircle size={18} className="text-red-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="font-semibold text-red-800 dark:text-red-300 text-sm">{failedTransactions} failed transaction{failedTransactions !== 1 ? 's' : ''} need attention</p>
                <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">Go to Transactions page, filter by "Failed" to retry or refund them.</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5">
          <BarChart data={monthlyRevenue.map(d => ({ ...d, value: Math.round(d.value / 1000) }))} label="Monthly Revenue (UGX thousands)" />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5">
          <BarChart data={propertyTypes} label="Properties by Type" />
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Inspection-to-Lease Funnel</p>
          <div className="space-y-2">
            {inspectionConversion.map((d, i) => (
              <div key={d.label} className="flex items-center gap-3">
                <p className="text-xs text-slate-500 w-16 text-right">{d.label}</p>
                <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-6 overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${d.value}%` }} transition={{ delay: 0.3 + i * 0.1, duration: 0.6 }}
                    className="h-full rounded-full flex items-center justify-end pr-2" style={{ backgroundColor: d.color }}>
                    <span className="text-xs font-bold text-white">{d.value}%</span>
                  </motion.div>
                </div>
              </div>
            ))}
          </div>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4">Property Status Distribution</p>
          <div className="space-y-3">
            {[
              { label: 'Published', count: properties.filter(p => p.status === 'published').length,       color: 'bg-green-500',  total: properties.length || 1 },
              { label: 'Rented',    count: properties.filter(p => p.status === 'rented').length,          color: 'bg-blue-500',   total: properties.length || 1 },
              { label: 'Draft',     count: properties.filter(p => p.status === 'draft').length,           color: 'bg-slate-400',  total: properties.length || 1 },
              { label: 'Pending',   count: properties.filter(p => p.status === 'pending_vetting').length, color: 'bg-yellow-500', total: properties.length || 1 },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-3">
                <div className={`w-3 h-3 rounded-full ${s.color} flex-shrink-0`} />
                <p className="text-sm text-slate-700 dark:text-slate-300 w-20">{s.label}</p>
                <div className="flex-1 bg-slate-100 dark:bg-slate-700 rounded-full h-2">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${(s.count / s.total) * 100}%` }} transition={{ duration: 0.6 }}
                    className={`h-full rounded-full ${s.color}`} />
                </div>
                <p className="text-sm font-bold text-slate-900 dark:text-slate-100 w-6 text-right">{s.count}</p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* Top Properties */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700">
        <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-bold text-slate-900 dark:text-slate-100">Top Properties by Views</h2>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {properties.sort((a, b) => b.viewCount - a.viewCount).slice(0, 5).map((p, i) => (
            <div key={p.id} className="flex items-center gap-4 px-5 py-3.5">
              <span className="text-lg font-bold text-slate-300 dark:text-slate-600 w-6">#{i + 1}</span>
              <img src={p.photos[0]} alt={p.title} className="w-10 h-10 rounded-xl object-cover" />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">{p.title}</p>
                <p className="text-xs text-slate-400">{p.district}</p>
              </div>
              <div className="text-right">
                <p className="font-bold text-slate-900 dark:text-slate-100">{p.viewCount}</p>
                <p className="text-xs text-slate-400">views</p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
