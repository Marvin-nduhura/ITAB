import { useState } from 'react';
import { motion } from 'framer-motion';
import { Scale, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { Avatar } from '../../components/ui/Avatar';
import { formatDate, timeAgo } from '../../lib/utils';
import toast from 'react-hot-toast';

type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'dismissed';
type DisputeType = 'management_fee' | 'payout_amount' | 'property_condition' | 'lease_terms' | 'other';

interface Dispute {
  id: string;
  type: DisputeType;
  status: DisputeStatus;
  raisedBy: string;
  raisedByRole: string;
  against: string;
  againstRole: string;
  propertyTitle: string;
  subject: string;
  description: string;
  amount?: number;
  resolution?: string;
  createdAt: string;
  updatedAt: string;
}

const mockDisputes: Dispute[] = [
  {
    id: 'd1', type: 'management_fee', status: 'open',
    raisedBy: 'John Ssemakula', raisedByRole: 'Landlord',
    against: 'Sarah Nakato', againstRole: 'Property Manager',
    propertyTitle: '1-Bedroom Apartment in Entebbe',
    subject: 'Management fee charged incorrectly',
    description: 'The management fee deducted was 15% but the agreed rate was 10%. I have been overcharged for the last 3 months.',
    amount: 270000,
    createdAt: '2024-04-01T00:00:00Z', updatedAt: '2024-04-01T00:00:00Z',
  },
  {
    id: 'd2', type: 'payout_amount', status: 'under_review',
    raisedBy: 'John Ssemakula', raisedByRole: 'Landlord',
    against: 'Sarah Nakato', againstRole: 'Property Manager',
    propertyTitle: '3-Bedroom Apartment in Kololo',
    subject: 'Payout not received for March',
    description: 'I have not received my payout for March 2024. The tenant paid on March 1st but I have not received anything.',
    amount: 2250000,
    createdAt: '2024-04-05T00:00:00Z', updatedAt: '2024-04-06T00:00:00Z',
  },
  {
    id: 'd3', type: 'property_condition', status: 'resolved',
    raisedBy: 'Grace Apio', raisedByRole: 'Tenant',
    against: 'Sarah Nakato', againstRole: 'Property Manager',
    propertyTitle: '1-Bedroom Apartment in Entebbe',
    subject: 'Property not as described',
    description: 'The property listing said it had backup power but there is no generator or solar system.',
    resolution: 'Manager agreed to install a solar backup system within 30 days. Tenant accepted resolution.',
    createdAt: '2024-03-10T00:00:00Z', updatedAt: '2024-03-20T00:00:00Z',
  },
];

const typeLabels: Record<DisputeType, string> = {
  management_fee: 'Management Fee', payout_amount: 'Payout Amount',
  property_condition: 'Property Condition', lease_terms: 'Lease Terms', other: 'Other',
};

const statusConfig: Record<DisputeStatus, { label: string; variant: 'yellow' | 'blue' | 'green' | 'gray'; icon: React.ReactNode }> = {
  open:         { label: 'Open',         variant: 'yellow', icon: <AlertCircle size={14} className="text-yellow-500" /> },
  under_review: { label: 'Under Review', variant: 'blue',   icon: <Clock size={14} className="text-blue-500" /> },
  resolved:     { label: 'Resolved',     variant: 'green',  icon: <CheckCircle2 size={14} className="text-green-500" /> },
  dismissed:    { label: 'Dismissed',    variant: 'gray',   icon: <XCircle size={14} className="text-slate-400" /> },
};

export function AdminDisputes() {
  const [disputes, setDisputes] = useState(mockDisputes);
  const [selected, setSelected] = useState<Dispute | null>(null);
  const [resolution, setResolution] = useState('');
  const [filterStatus, setFilterStatus] = useState<DisputeStatus | ''>('');

  const filtered = disputes.filter(d => !filterStatus || d.status === filterStatus);

  const updateStatus = (id: string, status: DisputeStatus, res?: string) => {
    setDisputes(prev => prev.map(d => d.id === id ? { ...d, status, resolution: res || d.resolution, updatedAt: new Date().toISOString() } : d));
    setSelected(null);
    setResolution('');
    toast.success(`Dispute ${status === 'resolved' ? 'resolved' : status === 'dismissed' ? 'dismissed' : 'updated'}!`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Dispute Resolution</h1>
          <p className="text-sm text-slate-500 mt-0.5">{disputes.filter(d => d.status === 'open').length} open disputes</p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit overflow-x-auto">
        {([['', 'All'], ['open', 'Open'], ['under_review', 'Under Review'], ['resolved', 'Resolved'], ['dismissed', 'Dismissed']] as const).map(([val, label]) => (
          <button key={val} onClick={() => setFilterStatus(val as DisputeStatus | '')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${filterStatus === val ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100' : 'text-slate-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Scale size={28} />} title="No disputes found" description="All disputes will appear here." />
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
                        <Badge variant="gray">{typeLabels[d.type]}</Badge>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{d.propertyTitle}</p>
                      <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                        <span>By: <strong>{d.raisedBy}</strong> ({d.raisedByRole})</span>
                        <span>Against: <strong>{d.against}</strong> ({d.againstRole})</span>
                        {d.amount && <span className="text-red-500 font-semibold">UGX {d.amount.toLocaleString()}</span>}
                      </div>
                      <p className="text-xs text-slate-500 mt-2 line-clamp-2">{d.description}</p>
                      {d.resolution && (
                        <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                          <p className="text-xs text-green-700 dark:text-green-400"><strong>Resolution:</strong> {d.resolution}</p>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-2 flex-shrink-0">
                    <p className="text-xs text-slate-400">{timeAgo(d.createdAt)}</p>
                    {d.status !== 'resolved' && d.status !== 'dismissed' && (
                      <Button size="sm" onClick={() => setSelected(d)}>Review</Button>
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
          <div className="flex gap-2 w-full">
            <Button variant="secondary" onClick={() => updateStatus(selected!.id, 'under_review')}>Mark Under Review</Button>
            <Button variant="danger" onClick={() => updateStatus(selected!.id, 'dismissed')}>Dismiss</Button>
            <Button onClick={() => { if (!resolution.trim()) { toast.error('Enter a resolution'); return; } updateStatus(selected!.id, 'resolved', resolution); }}
              icon={<CheckCircle2 size={14} />}>Resolve</Button>
          </div>
        }>
        {selected && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                <p className="text-xs text-slate-400 mb-1">Raised By</p>
                <div className="flex items-center gap-2">
                  <Avatar name={selected.raisedBy} size="sm" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{selected.raisedBy}</p>
                    <p className="text-xs text-slate-400">{selected.raisedByRole}</p>
                  </div>
                </div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                <p className="text-xs text-slate-400 mb-1">Against</p>
                <div className="flex items-center gap-2">
                  <Avatar name={selected.against} size="sm" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{selected.against}</p>
                    <p className="text-xs text-slate-400">{selected.againstRole}</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl space-y-1 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Property</span><span className="font-semibold">{selected.propertyTitle}</span></div>
              <div className="flex justify-between"><span className="text-slate-500">Type</span><span className="font-semibold">{typeLabels[selected.type]}</span></div>
              {selected.amount && <div className="flex justify-between"><span className="text-slate-500">Amount in Dispute</span><span className="font-bold text-red-500">UGX {selected.amount.toLocaleString()}</span></div>}
              <div className="flex justify-between"><span className="text-slate-500">Filed</span><span>{formatDate(selected.createdAt)}</span></div>
            </div>
            <div className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 rounded-xl">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Description</p>
              <p className="text-sm text-slate-700 dark:text-slate-300">{selected.description}</p>
            </div>
            <Textarea label="Resolution / Admin Decision" placeholder="Describe the resolution, action taken, or reason for dismissal..."
              value={resolution} onChange={e => setResolution(e.target.value)} />
          </div>
        )}
      </Modal>
    </div>
  );
}
