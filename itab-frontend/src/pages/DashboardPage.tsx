import { motion } from 'framer-motion';
import {
  Building2, Users, Wrench, DollarSign, TrendingUp, Calendar,
  AlertCircle, CheckCircle2, Clock, Home, Star, Briefcase, CreditCard, Bell,
} from 'lucide-react';
import { StatCard } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Button } from '../components/ui/Button';
import { useAuthStore } from '../store/authStore';
import { usePropertyStore } from '../store/propertyStore';
import { useVendorStore } from '../store/vendorStore';
import { useDataStore } from '../store/dataStore';
import {
  formatCurrency, formatDate,
  propertyStatusConfig, inspectionStatusConfig,
} from '../lib/utils';
import {
  filterPropertiesForUser, filterInspectionsForUser,
  filterMaintenanceForUser, filterPaymentsForUser,
} from '../lib/rbac';
import { useNavigate } from 'react-router-dom';

const container = { hidden: {}, show: { transition: { staggerChildren: 0.07 } } };
const item = { hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0 } };

export function DashboardPage() {
  const { user } = useAuthStore();
  const { properties: allProperties } = usePropertyStore();
  const { vendors, jobs } = useVendorStore();
  const { inspections: allInspections, maintenance: allMaintenance, payments: allPayments, notices: allNotices } = useDataStore();
  const navigate = useNavigate();

  const properties    = filterPropertiesForUser(allProperties, user);
  const myInspections = filterInspectionsForUser(allInspections, user);
  const myMaintenance = filterMaintenanceForUser(allMaintenance, user);
  const myPayments    = filterPaymentsForUser(allPayments, user);

  const myVendor = vendors.find(v => v.email === user?.email || v.userId === user?.id);
  const myJobs   = jobs.filter(j => j.vendorId === myVendor?.id);

  const stats = {
    totalProperties:    properties.length,
    vacantProperties:   properties.filter(p => p.status === 'published').length,
    occupiedProperties: properties.filter(p => p.status === 'rented').length,
    pendingVetting:     properties.filter(p => p.status === 'pending_vetting').length,
    totalTenants:       myInspections.filter(i => i.feePaid).length,
    pendingMaintenance: myMaintenance.filter(m => !['completed', 'cancelled'].includes(m.status)).length,
    monthlyRevenue:     myPayments.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0),
    pendingPayouts:     1,
    inspectionFeeRevenue: myPayments.filter(p => p.type === 'inspection_fee' && p.status === 'completed').reduce((s, p) => s + p.amount, 0),
    conversionRate:     35,
    outstandingBalance: 0, // computed from payments in real usage
    unreadNotices:      allNotices.filter(n => n.tenantId === user?.id && n.status === 'unread').length,
    pendingJobs:        myJobs.filter(j => j.status === 'assigned').length,
    activeJobs:         myJobs.filter(j => j.status === 'in_progress').length,
    completedJobs:      myJobs.filter(j => j.status === 'completed').length,
    totalEarnings:      myJobs.filter(j => j.status === 'completed').reduce((s, j) => s + (j.actualCost || 0), 0),
    vendorRating:       myVendor?.rating || 0,
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  const role = user?.role;

  const renderStats = () => {
    if (role === 'vendor') {
      return (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div variants={item}><StatCard title="Pending Jobs"    value={stats.pendingJobs}   icon={<Clock        className="w-6 h-6 text-amber-600"  />} iconBg="bg-amber-100 dark:bg-amber-900/30"  /></motion.div>
          <motion.div variants={item}><StatCard title="Active Jobs"     value={stats.activeJobs}    icon={<Wrench       className="w-6 h-6 text-blue-600"   />} iconBg="bg-blue-100 dark:bg-blue-900/30"    /></motion.div>
          <motion.div variants={item}><StatCard title="Completed Jobs"  value={stats.completedJobs} icon={<CheckCircle2 className="w-6 h-6 text-green-600"  />} iconBg="bg-green-100 dark:bg-green-900/30"  /></motion.div>
          <motion.div variants={item}><StatCard title="Total Earnings"  value={formatCurrency(stats.totalEarnings)} icon={<DollarSign className="w-6 h-6 text-yellow-600" />} iconBg="bg-yellow-100 dark:bg-yellow-900/30" /></motion.div>
          <motion.div variants={item}><StatCard title="My Rating"       value={`${stats.vendorRating.toFixed(1)} ★`} icon={<Star className="w-6 h-6 text-amber-500" />} iconBg="bg-amber-100 dark:bg-amber-900/30" /></motion.div>
          <motion.div variants={item}><StatCard title="Availability"    value={myVendor?.availability || 'Unknown'} icon={<Briefcase className="w-6 h-6 text-purple-600" />} iconBg="bg-purple-100 dark:bg-purple-900/30" /></motion.div>
        </motion.div>
      );
    }

    if (role === 'tenant') {
      return (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div variants={item}><StatCard title="My Properties"    value={properties.filter(p => p.tenantId === user?.id).length} icon={<Home className="w-6 h-6 text-primary-600" />} iconBg="bg-primary-100 dark:bg-primary-900/30" /></motion.div>
          <motion.div variants={item}><StatCard title="Outstanding Rent" value={formatCurrency(stats.outstandingBalance)} subtitle={stats.outstandingBalance > 0 ? 'Balance due' : 'All paid!'} icon={<CreditCard className="w-6 h-6 text-amber-600" />} iconBg="bg-amber-100 dark:bg-amber-900/30" /></motion.div>
          <motion.div variants={item}><StatCard title="Inspections"      value={myInspections.length} icon={<Calendar className="w-6 h-6 text-blue-600" />} iconBg="bg-blue-100 dark:bg-blue-900/30" /></motion.div>
          <motion.div variants={item}><StatCard title="Unread Notices"   value={stats.unreadNotices} icon={<Bell className="w-6 h-6 text-red-500" />} iconBg="bg-red-100 dark:bg-red-900/30" /></motion.div>
          <motion.div variants={item}><StatCard title="Maintenance"      value={stats.pendingMaintenance} subtitle="Open requests" icon={<Wrench className="w-6 h-6 text-orange-600" />} iconBg="bg-orange-100 dark:bg-orange-900/30" /></motion.div>
          <motion.div variants={item}><StatCard title="Total Paid"       value={formatCurrency(stats.monthlyRevenue)} icon={<TrendingUp className="w-6 h-6 text-green-600" />} iconBg="bg-green-100 dark:bg-green-900/30" /></motion.div>
        </motion.div>
      );
    }

    if (role === 'landlord') {
      return (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div variants={item}><StatCard title="My Properties"  value={stats.totalProperties} subtitle={`${stats.occupiedProperties} rented`} icon={<Building2 className="w-6 h-6 text-primary-600" />} iconBg="bg-primary-100 dark:bg-primary-900/30" /></motion.div>
          <motion.div variants={item}><StatCard title="Vacant"         value={stats.vacantProperties} icon={<Home className="w-6 h-6 text-amber-600" />} iconBg="bg-amber-100 dark:bg-amber-900/30" /></motion.div>
          <motion.div variants={item}><StatCard title="Monthly Income" value={formatCurrency(stats.monthlyRevenue)} icon={<DollarSign className="w-6 h-6 text-green-600" />} iconBg="bg-green-100 dark:bg-green-900/30" trend={{ value: 8, label: 'vs last month' }} /></motion.div>
          <motion.div variants={item}><StatCard title="Pending Payouts" value={stats.pendingPayouts} icon={<Clock className="w-6 h-6 text-blue-600" />} iconBg="bg-blue-100 dark:bg-blue-900/30" /></motion.div>
        </motion.div>
      );
    }

    if (role === 'agent') {
      return (
        <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <motion.div variants={item}><StatCard title="My Listings"  value={stats.totalProperties} icon={<Building2 className="w-6 h-6 text-primary-600" />} iconBg="bg-primary-100 dark:bg-primary-900/30" /></motion.div>
          <motion.div variants={item}><StatCard title="Inspections"  value={myInspections.length} icon={<Calendar className="w-6 h-6 text-blue-600" />} iconBg="bg-blue-100 dark:bg-blue-900/30" /></motion.div>
          <motion.div variants={item}><StatCard title="Conversions"  value={`${stats.conversionRate}%`} icon={<TrendingUp className="w-6 h-6 text-green-600" />} iconBg="bg-green-100 dark:bg-green-900/30" /></motion.div>
          <motion.div variants={item}><StatCard title="Commission"   value={formatCurrency(stats.monthlyRevenue * 0.05)} icon={<DollarSign className="w-6 h-6 text-yellow-600" />} iconBg="bg-yellow-100 dark:bg-yellow-900/30" /></motion.div>
        </motion.div>
      );
    }

    // Admin / Property Manager
    return (
      <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <motion.div variants={item}><StatCard title="Total Properties"   value={stats.totalProperties}   subtitle={`${stats.vacantProperties} vacant`} icon={<Building2 className="w-6 h-6 text-primary-600" />} iconBg="bg-primary-100 dark:bg-primary-900/30" trend={{ value: 12, label: 'this month' }} /></motion.div>
        <motion.div variants={item}><StatCard title="Active Tenants"     value={stats.totalTenants}      icon={<Users className="w-6 h-6 text-green-600" />} iconBg="bg-green-100 dark:bg-green-900/30" trend={{ value: 5, label: 'this month' }} /></motion.div>
        <motion.div variants={item}><StatCard title="Monthly Revenue"    value={formatCurrency(stats.monthlyRevenue)} icon={<DollarSign className="w-6 h-6 text-yellow-600" />} iconBg="bg-yellow-100 dark:bg-yellow-900/30" trend={{ value: 8, label: 'vs last month' }} /></motion.div>
        <motion.div variants={item}><StatCard title="Pending Maintenance" value={stats.pendingMaintenance} icon={<Wrench className="w-6 h-6 text-orange-600" />} iconBg="bg-orange-100 dark:bg-orange-900/30" /></motion.div>
        <motion.div variants={item}><StatCard title="Inspection Revenue" value={formatCurrency(stats.inspectionFeeRevenue)} icon={<Calendar className="w-6 h-6 text-purple-600" />} iconBg="bg-purple-100 dark:bg-purple-900/30" /></motion.div>
        <motion.div variants={item}><StatCard title="Pending Payouts"    value={stats.pendingPayouts}    icon={<Clock className="w-6 h-6 text-blue-600" />} iconBg="bg-blue-100 dark:bg-blue-900/30" /></motion.div>
        <motion.div variants={item}><StatCard title="Occupancy Rate"     value={stats.totalProperties > 0 ? `${Math.round((stats.occupiedProperties / stats.totalProperties) * 100)}%` : '0%'} icon={<Home className="w-6 h-6 text-teal-600" />} iconBg="bg-teal-100 dark:bg-teal-900/30" trend={{ value: 3, label: 'vs last month' }} /></motion.div>
        <motion.div variants={item}><StatCard title="Pending Vetting"    value={stats.pendingVetting}    icon={<AlertCircle className="w-6 h-6 text-amber-600" />} iconBg="bg-amber-100 dark:bg-amber-900/30" /></motion.div>
      </motion.div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
          {greeting()}, {user?.firstName} 👋
        </h1>
        <p className="text-slate-500 dark:text-slate-400 text-sm mt-0.5">
          {role === 'tenant'           && "Here's your tenancy overview for today."}
          {role === 'landlord'         && "Here's your property income overview."}
          {role === 'vendor'           && "Here's your job queue and earnings."}
          {role === 'agent'            && "Here's your listings and commission overview."}
          {(role === 'admin' || role === 'property_manager') && "Here's what's happening across your properties today."}
        </p>
      </motion.div>

      {/* Role-specific stat cards */}
      {renderStats()}

      {/* Quick-action banners */}
      {role === 'tenant' && stats.outstandingBalance > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl">
          <div className="flex items-center gap-3">
            <AlertCircle size={18} className="text-amber-600 flex-shrink-0" />
            <div>
              <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">Outstanding rent balance</p>
              <p className="text-xs text-amber-600 dark:text-amber-400">{formatCurrency(stats.outstandingBalance)} due</p>
            </div>
          </div>
          <Button size="sm" onClick={() => navigate('/payments')}>Pay Now</Button>
        </motion.div>
      )}

      {role === 'tenant' && stats.unreadNotices > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl">
          <div className="flex items-center gap-3">
            <Bell size={18} className="text-blue-600 flex-shrink-0" />
            <p className="text-sm text-blue-700 dark:text-blue-300">
              You have <strong>{stats.unreadNotices} unread notice{stats.unreadNotices > 1 ? 's' : ''}</strong> from your property manager.
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => navigate('/notices')}>View Notices</Button>
        </motion.div>
      )}

      {(role === 'admin' || role === 'property_manager') && stats.pendingVetting > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl">
          <div className="flex items-center gap-3">
            <AlertCircle size={18} className="text-yellow-600 flex-shrink-0" />
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              <strong>{stats.pendingVetting} propert{stats.pendingVetting > 1 ? 'ies' : 'y'}</strong> awaiting vetting approval.
            </p>
          </div>
          <Button size="sm" variant="secondary" onClick={() => navigate('/admin/vetting')}>Review Now</Button>
        </motion.div>
      )}

      {role === 'vendor' && stats.pendingJobs > 0 && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-between gap-4 p-4 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-2xl">
          <div className="flex items-center gap-3">
            <Briefcase size={18} className="text-primary-600 flex-shrink-0" />
            <p className="text-sm text-primary-700 dark:text-primary-300">
              You have <strong>{stats.pendingJobs} new job assignment{stats.pendingJobs > 1 ? 's' : ''}</strong> waiting for your response.
            </p>
          </div>
          <Button size="sm" onClick={() => navigate('/vendor')}>View Jobs</Button>
        </motion.div>
      )}

      {/* Content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Properties */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="lg:col-span-2">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
              <h2 className="font-bold text-slate-900 dark:text-slate-100">Recent Properties</h2>
              <button onClick={() => navigate('/properties')} className="text-sm text-primary-600 hover:text-primary-700 font-medium">View all</button>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {properties.slice(0, 4).map(p => {
                const sc = propertyStatusConfig[p.status] || { label: p.status, color: 'badge-gray' };
                return (
                  <div key={p.id} onClick={() => navigate(`/properties/${p.id}`)}
                    className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors">
                    <img src={p.photos[0]} alt={p.title} className="w-12 h-12 rounded-xl object-cover flex-shrink-0"
                      onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800'; }} />
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">{p.title}</p>
                      <p className="text-xs text-slate-400 truncate">{p.address}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{formatCurrency(p.rentPrice)}</p>
                      <Badge variant={sc.color.replace('badge-', '') as 'blue'}>{sc.label}</Badge>
                    </div>
                  </div>
                );
              })}
              {properties.length === 0 && (
                <div className="px-5 py-8 text-center text-sm text-slate-400">No properties yet.</div>
              )}
            </div>
          </div>
        </motion.div>

        {/* Right column */}
        <div className="space-y-6">
          {/* Upcoming Inspections */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                <h2 className="font-bold text-slate-900 dark:text-slate-100">Inspections</h2>
                <button onClick={() => navigate('/inspections')} className="text-sm text-primary-600 font-medium">View all</button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {myInspections.slice(0, 3).map(insp => {
                  const sc = inspectionStatusConfig[insp.status];
                  return (
                    <div key={insp.id} className="px-5 py-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{insp.propertyTitle}</p>
                          <p className="text-xs text-slate-400">{insp.tenantName} · {formatDate(insp.scheduledDate)}</p>
                        </div>
                        <Badge variant={sc.color.replace('badge-', '') as 'blue'}>{sc.label}</Badge>
                      </div>
                    </div>
                  );
                })}
                {myInspections.length === 0 && (
                  <div className="px-5 py-6 text-center text-sm text-slate-400">No inspections.</div>
                )}
              </div>
            </div>
          </motion.div>

          {/* Maintenance */}
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700">
              <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                <h2 className="font-bold text-slate-900 dark:text-slate-100">Maintenance</h2>
                <button onClick={() => navigate('/maintenance')} className="text-sm text-primary-600 font-medium">View all</button>
              </div>
              <div className="divide-y divide-slate-100 dark:divide-slate-700">
                {myMaintenance.slice(0, 3).map(m => (
                  <div key={m.id} className="px-5 py-3.5 flex items-start gap-3">
                    {m.priority === 'urgent'
                      ? <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
                      : <CheckCircle2 className="w-4 h-4 text-blue-500 mt-0.5 flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">{m.title}</p>
                      <p className="text-xs text-slate-400">{m.propertyTitle}</p>
                    </div>
                    <Badge variant={m.priority === 'urgent' ? 'red' : 'blue'}>{m.priority}</Badge>
                  </div>
                ))}
                {myMaintenance.length === 0 && (
                  <div className="px-5 py-6 text-center text-sm text-slate-400">No maintenance requests.</div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      </div>

      {/* Recent Payments */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
            <h2 className="font-bold text-slate-900 dark:text-slate-100">Recent Payments</h2>
            <button onClick={() => navigate('/payments')} className="text-sm text-primary-600 font-medium">View all</button>
          </div>
          {myPayments.length === 0 ? (
            <div className="px-5 py-8 text-center text-sm text-slate-400">No payment history yet.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50">
                    {['Tenant', 'Property', 'Type', 'Amount', 'Status', 'Date'].map(h => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {myPayments.slice(0, 5).map(p => (
                    <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={p.tenantName || 'Unknown'} size="xs" />
                          <span className="font-medium text-slate-900 dark:text-slate-100 text-xs">{p.tenantName || '—'}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3 text-slate-500 dark:text-slate-400 text-xs max-w-[140px] truncate">{p.propertyTitle}</td>
                      <td className="px-5 py-3"><Badge variant="blue">{p.type.replace(/_/g, ' ')}</Badge></td>
                      <td className="px-5 py-3 font-bold text-slate-900 dark:text-slate-100 text-xs">{formatCurrency(p.amount)}</td>
                      <td className="px-5 py-3">
                        <Badge variant={p.status === 'completed' ? 'green' : p.status === 'failed' ? 'red' : 'yellow'}>
                          {p.status}
                        </Badge>
                      </td>
                      <td className="px-5 py-3 text-slate-400 text-xs whitespace-nowrap">{p.paidAt ? formatDate(p.paidAt) : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
