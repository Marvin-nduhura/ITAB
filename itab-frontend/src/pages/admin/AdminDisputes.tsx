import { useState } from 'react';
import { motion } from 'framer-motion';
import { Scale, CheckCircle2, XCircle, Clock, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { Avatar } from '../../components/ui/Avatar';
import { useDisputeStore } from '../../store/disputeStore';
import { useAuthStore } from '../../store/authStore';
import { useUserStore } from '../../store/userStore';
import { formatDate, timeAgo, formatCurrency } from '../../lib/utils';
import toast from 'react-hot-toast';
import type { Dispute, DisputeStatus } from '../../types';

const typeLabels: Record<string, string> = {
  management_fee: 'Management Fee', payout_amount: 'Payout Amount',
  property_condition: 'Property Condition', lease_terms: 'Lease Terms',
  payment_dispute: 'Payment Dispute', harassment: 'Harassment',
  fraud: 'Fraud', other: 'Other',
};

const statusConfig: Record<DisputeStatus, { label: string; variant: 'yellow' | 'blue' | 'green' | 'gray'; icon: React.ReactNode }> = {
  open:         { label: 'Open',         variant: 'yellow', icon: <AlertCircle size={14} className="text-yellow-500" /> },
  under_review: { label: 'Under Review', variant: 'blue',   icon: <Clock size={14} className="text-blue-500" /> },
  resolved:     { label: 'Resolved',     variant: 'green',  icon: <CheckCircle2 size={14} className="text-green-500" /> },
  dismissed:    { label: 'Dismissed',    variant: 'gray',   icon: <XCircle size={14} className="text-slate-400" /> },
};

export function AdminDisputes() {
  const { disputes, updateDisputeStatus } = useDisputeStore();
  const { user } = useAuthStore();
  const { addAuditLog } = useUserStore();
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [resolution, setResolution] = useState('');
  const [filterStatus, setFilterStatus] = useState<DisputeStatus | ''>('');

  const filtered = disputes.filter(d => !filterStatus || d.status === filterStatus);
  const openCount = disputes.filter(d => d.status === 'open').length;

  const handleUpdate = (status: DisputeStatus) => {
    if ((status === 'resolved') && !resolution.trim()) {
      toast.error('Enter a resolution before resolving');
      return;
    }
    updateDisputeStatus(selected!.id, status, resolution, user ? { id: user.id, name: `${user.firstName} ${user.lastName}` } : undefined);
    addAuditLog({
      action: status === 'resolved' ? 'dispute_resolved' : 'dispute_dismissed',
      performedBy: user?.id || '',
      performedByName: user ? `${user.firstName} ${user.lastName}` : 'Admin',
      performedByRole: user?.role || 'admin',
      targetId: selected!.id,
      targetName: selected!.subject,
      description: `Dispute "${selected!.subject}" ${status}. ${resolution ? `Resolution: ${resolution}` : ''}`,
    });
    setSelected(null);
    setResolution('');
    toast.success(`Dispute ${status === 'resolved' ? 'resolved' : status === 'dismissed' ? 'dismissed' : 'updated'}!`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Dispute Resolution</h1>
          <p className="text-sm text-slate-500 mt-0.5">{openCount} open dispute{openCount !== 1 ? 's' : ''} awaiting review</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit overflow-x-auto">
        {([['', 'All'], ['open', 'Open'], ['under_review', 'Under Review'], ['resolved', 'Resolved'], ['dismissed', 'Dismissed']] as const).map(([val, label]) => (
          <button key={val} onClick={() => setFilterStatus(val as DisputeStatus | '')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${filterStatus === val ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100' : 'text-slate-500'}`}>
            {label}
            {val === 'open' && openCount > 0 && (
              <span className="ml-1.5 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">{openCount}</span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Scale size={28} />} title="No disputes found" description="Disputes raised by users will appear here." />
      ) : (
        <div className="space-y-3">
          {filtered.map((d, i) => {
            const sc = statusConfig[d.status];
            return (
              <motion.div key={d.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {sc.icon}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{d.subject}</h3>
                        <Badge variant={sc.variant}>{sc.label}</Badge>
                        <Badge variant="gray">{typeLabels[d.type] || d.type}</Badge>
                      </div>
                      {d.propertyTitle && <p className="text-xs text-slate-400 mt-0.5">📍 {d.propertyTitle}</p>}
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500 flex-wrap">
                        <span>By: <strong>{d.raisedByName}</strong> ({d.raisedByRole})</span>
                        {d.againstName && <span>Against: <strong>{d.againstName}</strong> ({d.againstRole})</span>}
                        {d.amount && <span className="text-red-500 font-semibold">{formatCurrency(d.amount)} in dispute</span>}
                      </div>
                      <p className="text-xs text-slate-500 mt-2 line-clamp-2">{d.description}</p>
                      {d.resolution && (
                        <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <p className="text-xs text-green-700 dark:text-green-400">
                            <strong>Resolution:</strong> {d.resolution}
                            {d.resolvedByName && <span className="text-green-500"> — by {d.resolvedByName}</span>}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <p className="text-xs text-slate-400">{timeAgo(d.createdAt)}</p>
                    {d.status !== 'resolved' && d.status !== 'dismissed' && (
                      <Button size="sm" onClick={() => { setSelected(d); setResolution(''); }}>Review</Button>
                    )}
                    {d.status === 'open' && (
                      <Button size="sm" variant="secondary" icon={<RefreshCw size={12} />}
                        onClick={() => { updateDisputeStatus(d.id, 'under_review'); toast('Marked as under review'); }}>
                        Start Review
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      <Modal open={!!selected} onClose={() => { setSelected(null); setResolution(''); }} title="Review Dispute" size="lg"
        footer={
          <div className="flex gap-2 w-full flex-wrap">
            <Button variant="secondary" onClick={() => { updateDisputeStatus(selected!.id, 'under_review'); setSelected(null); toast('Marked as under review'); }}>
              Mark Under Review
            </Button>
            <Button variant="danger" onClick={() => handleUpdate('dismissed')}>Dismiss</Button>
            <Button onClick={() => handleUpdate('resolved')} icon={<CheckCircle2 size={14} />}>Resolve</Button>
          </div>
        }>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                <p className="text-xs text-slate-400 mb-1">Raised By</p>
                <div className="flex items-center gap-2">
                  <Avatar name={selected.raisedByName} size="sm" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{selected.raisedByName}</p>
                    <p className="text-xs text-slate-400 capitalize">{selected.raisedByRole.replace('_', ' ')}</p>
                  </div>
                </div>
              </div>
              {selected.againstName && (
                <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                  <p className="text-xs text-slate-400 mb-1">Against</p>
                  <div className="flex items-center gap-2">
                    <Avatar name={selected.againstName} size="sm" />
                    <div>
                      <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{selected.againstName}</p>
                      <p className="text-xs text-slate-400 capitalize">{selected.againstRole?.replace('_', ' ')}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl space-y-1.5 text-sm">
              {selected.propertyTitle && <div className="flex justify-between"><span className="text-slate-500">Property</span><span className="font-semibold">{selected.propertyTitle}</span></div>}
              <div className="flex justify-between"><span className="text-slate-500">Type</span><span className="font-semibold">{typeLabels[selected.type]}</span></div>
              {selected.amount && <div className="flex justify-between"><span className="text-slate-500">Amount in Dispute</span><span className="font-bold text-red-500">{formatCurrency(selected.amount)}</span></div>}
              <div className="flex justify-between"><span className="text-slate-500">Filed</span><span>{formatDate(selected.createdAt)}</span></div>
            </div>
            <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Description</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{selected.description}</p>
            </div>
            {selected.evidence && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                <p className="text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">Evidence Provided</p>
                <p className="text-sm text-amber-700 dark:text-amber-400">{selected.evidence}</p>
              </div>
            )}
            <Textarea label="Resolution / Admin Decision *" placeholder="Describe the resolution, action taken, or reason for dismissal..."
              value={resolution} onChange={e => setResolution(e.target.value)} rows={3} />
          </div>
        )}
      </Modal>
    </div>
  );
}
