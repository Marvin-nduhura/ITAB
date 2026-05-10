import { useState } from 'react';
import { motion } from 'framer-motion';
import { Scale, CheckCircle2, AlertCircle, Clock, Plus } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input, Select, Textarea } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuthStore } from '../store/authStore';
import { useDisputeStore } from '../store/disputeStore';
import { usePropertyStore } from '../store/propertyStore';
import { timeAgo } from '../lib/utils';
import { formatCurrency } from '../lib/utils';
import toast from 'react-hot-toast';
import type { DisputeType } from '../types';

const DISPUTE_TYPES: { value: DisputeType; label: string; desc: string }[] = [
  { value: 'management_fee',    label: 'Management Fee',      desc: 'Incorrect fee deducted from rent' },
  { value: 'payout_amount',     label: 'Payout Amount',       desc: 'Wrong or missing payout' },
  { value: 'property_condition',label: 'Property Condition',  desc: 'Property not as described or damaged' },
  { value: 'lease_terms',       label: 'Lease Terms',         desc: 'Disagreement on lease conditions' },
  { value: 'payment_dispute',   label: 'Payment Dispute',     desc: 'Payment not received or incorrect amount' },
  { value: 'harassment',        label: 'Harassment',          desc: 'Harassment or inappropriate behaviour' },
  { value: 'fraud',             label: 'Fraud',               desc: 'Suspected fraudulent activity' },
  { value: 'other',             label: 'Other',               desc: 'Any other issue not listed above' },
];

const statusConfig = {
  open:         { label: 'Open',         variant: 'yellow' as const, icon: <AlertCircle size={13} className="text-yellow-500" /> },
  under_review: { label: 'Under Review', variant: 'blue' as const,   icon: <Clock size={13} className="text-blue-500" /> },
  resolved:     { label: 'Resolved',     variant: 'green' as const,  icon: <CheckCircle2 size={13} className="text-green-500" /> },
  dismissed:    { label: 'Dismissed',    variant: 'gray' as const,   icon: null },
};

export function RaiseDisputePage() {
  const { user } = useAuthStore();
  const { raiseDispute, getDisputesByUser } = useDisputeStore();
  const { properties } = usePropertyStore();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    type: '' as DisputeType | '',
    subject: '',
    description: '',
    evidence: '',
    againstName: '',
    againstRole: '',
    propertyId: '',
    amount: '',
  });

  const myDisputes = user ? getDisputesByUser(user.id) : [];

  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const handleSubmit = async () => {
    if (!form.type) { toast.error('Select a dispute type'); return; }
    if (!form.subject.trim()) { toast.error('Enter a subject'); return; }
    if (!form.description.trim() || form.description.length < 30) { toast.error('Provide a detailed description (at least 30 characters)'); return; }

    setLoading(true);
    await new Promise(r => setTimeout(r, 800));

    const selectedProperty = properties.find(p => p.id === form.propertyId);

    raiseDispute({
      type: form.type as DisputeType,
      raisedById: user!.id,
      raisedByName: `${user!.firstName} ${user!.lastName}`,
      raisedByRole: user!.role,
      againstName: form.againstName || undefined,
      againstRole: form.againstRole || undefined,
      propertyId: form.propertyId || undefined,
      propertyTitle: selectedProperty?.title || undefined,
      subject: form.subject,
      description: form.description,
      evidence: form.evidence || undefined,
      amount: form.amount ? Number(form.amount) : undefined,
    });

    setLoading(false);
    setShowModal(false);
    setForm({ type: '', subject: '', description: '', evidence: '', againstName: '', againstRole: '', propertyId: '', amount: '' });
    toast.success('Dispute submitted! The admin team will review it within 24–48 hours.');
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Disputes</h1>
          <p className="text-sm text-slate-500 mt-0.5">Raise and track disputes with other users or the platform</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setShowModal(true)}>Raise Dispute</Button>
      </div>

      {/* Info banner */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 flex items-start gap-3">
        <Scale size={18} className="text-blue-600 mt-0.5 flex-shrink-0" />
        <div>
          <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">How disputes work</p>
          <p className="text-sm text-blue-700 dark:text-blue-400 mt-0.5">
            Submit a dispute and the ITAB admin team will review it within 24–48 hours. You'll be notified of any updates. All disputes are handled confidentially.
          </p>
        </div>
      </div>

      {/* My disputes */}
      {myDisputes.length === 0 ? (
        <EmptyState
          icon={<Scale size={28} />}
          title="No disputes yet"
          description="If you have an issue with a payment, property, or another user, raise a dispute and our team will help resolve it."
          action={<Button onClick={() => setShowModal(true)} icon={<Plus size={15} />}>Raise a Dispute</Button>}
        />
      ) : (
        <div className="space-y-3">
          <h2 className="font-bold text-slate-900 dark:text-slate-100">My Disputes</h2>
          {myDisputes.map((d, i) => {
            const sc = statusConfig[d.status];
            return (
              <motion.div key={d.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {sc.icon}
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{d.subject}</h3>
                      <Badge variant={sc.variant}>{sc.label}</Badge>
                    </div>
                    {d.propertyTitle && <p className="text-xs text-slate-400 mt-0.5">📍 {d.propertyTitle}</p>}
                    {d.againstName && <p className="text-xs text-slate-500 mt-0.5">Against: <strong>{d.againstName}</strong></p>}
                    {d.amount && <p className="text-xs text-red-500 font-semibold mt-0.5">{formatCurrency(d.amount)} in dispute</p>}
                    <p className="text-xs text-slate-500 mt-2 line-clamp-2">{d.description}</p>
                    {d.resolution && (
                      <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg">
                        <p className="text-xs text-green-700 dark:text-green-400"><strong>Resolution:</strong> {d.resolution}</p>
                      </div>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 flex-shrink-0">{timeAgo(d.createdAt)}</p>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Raise Dispute Modal */}
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Raise a Dispute" size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
            <Button loading={loading} onClick={handleSubmit} icon={<Scale size={14} />}>Submit Dispute</Button>
          </>
        }>
        <div className="space-y-4">
          <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              ⚠️ Please provide as much detail as possible. False or malicious disputes may result in account action.
            </p>
          </div>

          {/* Dispute type */}
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Dispute Type *</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {DISPUTE_TYPES.map(t => (
                <button key={t.value} onClick={() => set('type', t.value)}
                  className={`p-3 rounded-xl border-2 text-left transition-all ${form.type === t.value ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'}`}>
                  <p className={`text-sm font-semibold ${form.type === t.value ? 'text-primary-700 dark:text-primary-300' : 'text-slate-800 dark:text-slate-200'}`}>{t.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{t.desc}</p>
                </button>
              ))}
            </div>
          </div>

          <Input label="Subject *" placeholder="Brief summary of the issue" value={form.subject} onChange={e => set('subject', e.target.value)} />

          {/* Property (optional) */}
          <Select label="Related Property (optional)"
            value={form.propertyId}
            onChange={e => set('propertyId', e.target.value)}
            options={[
              { value: '', label: 'Not property-specific' },
              ...properties.filter(p => p.status !== 'rejected').map(p => ({ value: p.id, label: p.title })),
            ]}
          />

          {/* Against */}
          <div className="grid grid-cols-2 gap-3">
            <Input label="Against (name, optional)" placeholder="e.g. Sarah Nakato" value={form.againstName} onChange={e => set('againstName', e.target.value)} />
            <Select label="Their role"
              value={form.againstRole}
              onChange={e => set('againstRole', e.target.value)}
              options={[
                { value: '', label: 'Select role' },
                { value: 'property_manager', label: 'Property Manager' },
                { value: 'landlord', label: 'Landlord' },
                { value: 'tenant', label: 'Tenant' },
                { value: 'agent', label: 'Agent' },
                { value: 'vendor', label: 'Vendor' },
                { value: 'admin', label: 'Admin / Platform' },
              ]}
            />
          </div>

          <Input label="Amount in Dispute (UGX, optional)" type="number" placeholder="e.g. 270000" value={form.amount} onChange={e => set('amount', e.target.value)} />

          <Textarea label="Detailed Description *" placeholder="Describe the issue in detail. Include dates, amounts, and what happened..." value={form.description} onChange={e => set('description', e.target.value)} rows={4} />

          <Textarea label="Evidence / Supporting Information (optional)" placeholder="Describe any evidence you have (screenshots, receipts, messages, etc.)" value={form.evidence} onChange={e => set('evidence', e.target.value)} rows={2} />
        </div>
      </Modal>
    </div>
  );
}
