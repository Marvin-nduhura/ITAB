import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Shield, Search, Download, X, ChevronLeft, ChevronRight, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { Avatar } from '../../components/ui/Avatar';
import { auditLogsApi } from '../../lib/api';
import { timeAgo, formatDate } from '../../lib/utils';
import { downloadCSV } from '../../lib/download';

// Extended action config — covers both client-logged and server-logged events
const actionConfig: Record<string, { label: string; color: string }> = {
  // User management
  user_suspended:        { label: 'User Suspended',        color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
  user_banned:           { label: 'User Banned',           color: 'bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-300' },
  user_unsuspended:      { label: 'User Reactivated',      color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
  user_invited:          { label: 'User Invited',          color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  user_registered:       { label: 'User Registered',       color: 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400' },
  // KYC & approvals
  kyc_approved:          { label: 'KYC Approved',          color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
  kyc_rejected:          { label: 'KYC Rejected',          color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
  agent_approved:        { label: 'Agent / User Approved', color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
  agent_rejected:        { label: 'Agent / User Rejected', color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
  // Properties
  property_created:      { label: 'Property Created',      color: 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400' },
  property_approved:     { label: 'Property Approved',     color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
  property_rejected:     { label: 'Property Rejected',     color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
  // Inspections
  inspection_booked:     { label: 'Inspection Booked',     color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  // Maintenance
  maintenance_submitted: { label: 'Maintenance Submitted', color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' },
  // Payments & payouts
  payout_processed:      { label: 'Payout Processed',      color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400' },
  transaction_retried:   { label: 'Transaction Retried',   color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  transaction_refunded:  { label: 'Transaction Refunded',  color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' },
  // Disputes
  dispute_raised:        { label: 'Dispute Raised',        color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' },
  dispute_resolved:      { label: 'Dispute Resolved',      color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
  dispute_dismissed:     { label: 'Dispute Dismissed',     color: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400' },
  // Platform
  fee_config_updated:    { label: 'Fee Config Updated',    color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' },
  announcement_sent:     { label: 'Announcement Sent',     color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  settings_changed:      { label: 'Settings Changed',      color: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400' },
  // Auth
  login:                 { label: 'Login',                 color: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400' },
  logout:                { label: 'Logout',                color: 'bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400' },
};

const ACTION_GROUPS = [
  { label: 'User Management', actions: ['user_suspended','user_banned','user_unsuspended','user_invited','user_registered','kyc_approved','kyc_rejected','agent_approved','agent_rejected'] },
  { label: 'Properties',      actions: ['property_created','property_approved','property_rejected'] },
  { label: 'Inspections',     actions: ['inspection_booked'] },
  { label: 'Maintenance',     actions: ['maintenance_submitted'] },
  { label: 'Payments',        actions: ['payout_processed','transaction_retried','transaction_refunded'] },
  { label: 'Disputes',        actions: ['dispute_raised','dispute_resolved','dispute_dismissed'] },
  { label: 'Platform',        actions: ['fee_config_updated','announcement_sent','settings_changed'] },
  { label: 'Auth',            actions: ['login','logout'] },
];

interface LogEntry {
  id: string;
  action: string;
  performedBy: string;
  performedByName: string;
  performedByRole: string;
  targetId?: string;
  targetName?: string;
  description: string;
  createdAt: string;
}

const PAGE_SIZE = 50;

export function AuditLogsPage() {
  const [logs, setLogs]           = useState<LogEntry[]>([]);
  const [total, setTotal]         = useState(0);
  const [loading, setLoading]     = useState(false);
  const [page, setPage]           = useState(0);

  // Filters
  const [search,       setSearch]       = useState('');
  const [filterAction, setFilterAction] = useState('');
  const [dateFrom,     setDateFrom]     = useState('');
  const [dateTo,       setDateTo]       = useState('');

  const fetchLogs = useCallback(async (pageNum: number) => {
    setLoading(true);
    try {
      const params: Record<string, unknown> = {
        limit: PAGE_SIZE,
        offset: pageNum * PAGE_SIZE,
      };
      if (filterAction) params.action = filterAction;
      if (dateFrom)     params.from   = dateFrom;
      if (dateTo)       params.to     = dateTo;

      const res = await auditLogsApi.list(params);
      const data = (res.data as { data: LogEntry[]; total?: number });
      setLogs(data.data || []);
      setTotal(data.total ?? (data.data || []).length);
    } catch {
      // keep existing
    } finally {
      setLoading(false);
    }
  }, [filterAction, dateFrom, dateTo]);

  useEffect(() => {
    setPage(0);
    fetchLogs(0);
  }, [filterAction, dateFrom, dateTo]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetchLogs(page);
  }, [page]); // eslint-disable-line react-hooks/exhaustive-deps

  // Client-side text search on loaded page
  const filtered = logs.filter(log => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      log.performedByName.toLowerCase().includes(q) ||
      log.description.toLowerCase().includes(q) ||
      (log.targetName || '').toLowerCase().includes(q) ||
      log.action.toLowerCase().includes(q)
    );
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const hasFilters = search || filterAction || dateFrom || dateTo;

  const clearFilters = () => {
    setSearch('');
    setFilterAction('');
    setDateFrom('');
    setDateTo('');
  };

  const handleExport = () => {
    downloadCSV(filtered.map(l => ({
      'Date':          formatDate(l.createdAt),
      'Action':        actionConfig[l.action]?.label || l.action,
      'Performed By':  l.performedByName,
      'Role':          l.performedByRole,
      'Target':        l.targetName || '',
      'Description':   l.description,
    })), `audit-logs-${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Audit Logs</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Complete record of all actions on the platform · {total} total entries
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="secondary" size="sm"
            icon={<RefreshCw size={14} className={loading ? 'animate-spin' : ''} />}
            onClick={() => fetchLogs(page)} disabled={loading}
          >
            Refresh
          </Button>
          <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={handleExport}>
            Export CSV
          </Button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-4 space-y-3">
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-48">
            <Input
              placeholder="Search name, description, target…"
              icon={<Search size={15} />}
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Select
            value={filterAction}
            onChange={e => setFilterAction(e.target.value)}
            options={[
              { value: '', label: 'All Actions' },
              ...ACTION_GROUPS.flatMap(g => [
                { value: `__group_${g.label}`, label: `── ${g.label} ──`, disabled: true },
                ...g.actions.map(a => ({ value: a, label: actionConfig[a]?.label || a })),
              ]),
            ]}
          />
        </div>

        {/* Date range */}
        <div className="flex gap-3 flex-wrap items-center">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>From</span>
            <input
              type="date"
              value={dateFrom}
              onChange={e => setDateFrom(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-slate-100"
            />
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>To</span>
            <input
              type="date"
              value={dateTo}
              onChange={e => setDateTo(e.target.value)}
              className="px-3 py-2 text-sm bg-slate-50 dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-slate-900 dark:text-slate-100"
            />
          </div>
          {hasFilters && (
            <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={clearFilters}>
              Clear filters
            </Button>
          )}
        </div>

        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Showing {filtered.length} of {total} log entries
            {page > 0 && ` · page ${page + 1} of ${totalPages}`}
          </p>
          {/* Action legend chips */}
          <div className="flex flex-wrap gap-1.5 justify-end">
            {Object.entries(actionConfig).slice(0, 6).map(([key, cfg]) => (
              <button
                key={key}
                onClick={() => setFilterAction(filterAction === key ? '' : key)}
                className={`text-xs px-2 py-0.5 rounded-full border transition-all ${
                  filterAction === key
                    ? cfg.color + ' border-transparent font-semibold'
                    : 'border-slate-200 dark:border-slate-600 text-slate-500 hover:border-slate-300'
                }`}
              >
                {cfg.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Table */}
      {loading && logs.length === 0 ? (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-10 text-center">
          <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-slate-400">Loading audit logs…</p>
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={<Shield size={28} />}
          title="No logs found"
          description={hasFilters ? 'Try adjusting your filters.' : 'Admin actions will be recorded here automatically.'}
        />
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
                  {['Time', 'Action', 'Performed By', 'Target', 'Description'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map((log, i) => {
                  const cfg = actionConfig[log.action];
                  return (
                    <motion.tr
                      key={log.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.01 }}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                        <p className="font-medium text-slate-600 dark:text-slate-400">{timeAgo(log.createdAt)}</p>
                        <p className="text-slate-300 dark:text-slate-600 mt-0.5">{formatDate(log.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${cfg?.color || 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400'}`}>
                          {cfg?.label || log.action.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={log.performedByName} size="xs" />
                          <div>
                            <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm whitespace-nowrap">
                              {log.performedByName}
                            </p>
                            <p className="text-xs text-slate-400 capitalize">
                              {log.performedByRole?.replace('_', ' ')}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400 max-w-[140px] truncate">
                        {log.targetName || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-xs">
                        {log.description}
                      </td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <p className="text-xs text-slate-400">
                Page {page + 1} of {totalPages} · {total} total
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary" size="sm"
                  icon={<ChevronLeft size={14} />}
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0 || loading}
                >
                  Prev
                </Button>
                <Button
                  variant="secondary" size="sm"
                  onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                  disabled={page >= totalPages - 1 || loading}
                >
                  Next <ChevronRight size={14} />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
