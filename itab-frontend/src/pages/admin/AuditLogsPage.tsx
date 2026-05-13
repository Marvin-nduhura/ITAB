import { useState } from 'react';
import { motion } from 'framer-motion';
import { Shield, Search, Download, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { Avatar } from '../../components/ui/Avatar';
import { useUserStore, type AuditAction } from '../../store/userStore';
import { useDataStore } from '../../store/dataStore';
import { timeAgo, formatDate } from '../../lib/utils';
import { downloadCSV } from '../../lib/download';

const actionConfig: Record<AuditAction, { label: string; color: string }> = {
  user_suspended:       { label: 'User Suspended',       color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
  user_banned:          { label: 'User Banned',          color: 'bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-300' },
  user_unsuspended:     { label: 'User Reactivated',     color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
  user_invited:         { label: 'User Invited',         color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  kyc_approved:         { label: 'KYC Approved',         color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
  kyc_rejected:         { label: 'KYC Rejected',         color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
  agent_approved:       { label: 'Agent Approved',       color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
  agent_rejected:       { label: 'Agent Rejected',       color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
  dispute_raised:       { label: 'Dispute Raised',       color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' },
  dispute_resolved:     { label: 'Dispute Resolved',     color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
  dispute_dismissed:    { label: 'Dispute Dismissed',    color: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400' },
  transaction_retried:  { label: 'Transaction Retried',  color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  transaction_refunded: { label: 'Transaction Refunded', color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400' },
  property_approved:    { label: 'Property Approved',    color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' },
  property_rejected:    { label: 'Property Rejected',    color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400' },
  fee_config_updated:   { label: 'Fee Config Updated',   color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400' },
  announcement_sent:    { label: 'Announcement Sent',    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' },
  login:                { label: 'Login',                color: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400' },
  logout:               { label: 'Logout',               color: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400' },
  settings_changed:     { label: 'Settings Changed',     color: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400' },
};

export function AuditLogsPage() {
  const { auditLogs: localLogs } = useUserStore();
  const { auditLogs: backendLogs } = useDataStore();
  // Backend logs are the source of truth; fall back to local if not yet synced
  const auditLogs = (backendLogs.length > 0 ? backendLogs : localLogs) as typeof localLogs;
  const [search, setSearch] = useState('');
  const [filterAction, setFilterAction] = useState('');

  const filtered = auditLogs.filter(log => {
    const q = search.toLowerCase();
    const matchQ = !q || log.performedByName.toLowerCase().includes(q) || log.description.toLowerCase().includes(q) || (log.targetName || '').toLowerCase().includes(q);
    const matchAction = !filterAction || log.action === filterAction;
    return matchQ && matchAction;
  });

  const handleExport = () => {
    downloadCSV(filtered.map(l => ({
      'Date': formatDate(l.createdAt),
      'Action': actionConfig[l.action]?.label || l.action,
      'Performed By': l.performedByName,
      'Role': l.performedByRole,
      'Target': l.targetName || '',
      'Description': l.description,
    })), `audit-logs-${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Audit Logs</h1>
          <p className="text-sm text-slate-500 mt-0.5">Complete record of all admin actions on the platform</p>
        </div>
        <Button variant="secondary" icon={<Download size={15} />} onClick={handleExport}>Export CSV</Button>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-4">
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-48">
            <Input placeholder="Search by name, action, or description..." icon={<Search size={15} />} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterAction} onChange={e => setFilterAction(e.target.value)}
            options={[
              { value: '', label: 'All Actions' },
              { value: 'user_suspended', label: 'User Suspended' },
              { value: 'user_banned', label: 'User Banned' },
              { value: 'user_unsuspended', label: 'User Reactivated' },
              { value: 'kyc_approved', label: 'KYC Approved' },
              { value: 'kyc_rejected', label: 'KYC Rejected' },
              { value: 'agent_approved', label: 'Agent Approved' },
              { value: 'agent_rejected', label: 'Agent Rejected' },
              { value: 'dispute_resolved', label: 'Dispute Resolved' },
              { value: 'transaction_retried', label: 'Transaction Retried' },
              { value: 'transaction_refunded', label: 'Transaction Refunded' },
              { value: 'property_approved', label: 'Property Approved' },
            ]}
          />
          {(search || filterAction) && (
            <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={() => { setSearch(''); setFilterAction(''); }}>Clear</Button>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-2">{filtered.length} log entries</p>
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Shield size={28} />} title="No audit logs yet"
          description="All admin actions (suspensions, KYC approvals, dispute resolutions, etc.) will be recorded here." />
      ) : (
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50">
                  {['Time', 'Action', 'Performed By', 'Target', 'Description'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {filtered.map((log, i) => {
                  const cfg = actionConfig[log.action];
                  return (
                    <motion.tr key={log.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-4 py-3 text-xs text-slate-400 whitespace-nowrap">
                        <p>{timeAgo(log.createdAt)}</p>
                        <p className="text-slate-300 dark:text-slate-600">{formatDate(log.createdAt)}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${cfg?.color || 'bg-slate-100 text-slate-600'}`}>
                          {cfg?.label || log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <Avatar name={log.performedByName} size="xs" />
                          <div>
                            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{log.performedByName}</p>
                            <p className="text-xs text-slate-400 capitalize">{log.performedByRole.replace('_', ' ')}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-slate-600 dark:text-slate-400">{log.targetName || '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 max-w-xs">{log.description}</td>
                    </motion.tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
