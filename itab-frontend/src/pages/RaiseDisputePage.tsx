import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Scale, CheckCircle2, AlertCircle, Clock, Plus, Search, X } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Select, Textarea, Input } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuthStore } from '../store/authStore';
import { useDisputeStore } from '../store/disputeStore';
import { usePropertyStore } from '../store/propertyStore';
import { useUserStore } from '../store/userStore';
import { timeAgo, roleLabels } from '../lib/utils';
import { formatCurrency } from '../lib/utils';
import toast from 'react-hot-toast';
import type { DisputeType, User } from '../types';

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

// ─── User search autocomplete ─────────────────────────────────────────────────
interface UserSearchProps {
  excludeId?: string;
  onSelect: (user: User) => void;
  onClear: () => void;
  selected: User | null;
}

function UserSearch({ excludeId, onSelect, onClear, selected }: UserSearchProps) {
  const { users } = useUserStore();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const suggestions = query.trim().length >= 1
    ? users.filter(u => {
        if (u.id === excludeId) return false;
        const full = `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase();
        return full.includes(query.toLowerCase());
      }).slice(0, 6)
    : [];

  const handleSelect = (u: User) => {
    onSelect(u);
    setQuery('');
    setOpen(false);
  };

  const handleClear = () => {
    onClear();
    setQuery('');
    setOpen(false);
  };

  return (
    <div ref={wrapRef} className="relative">
      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
        Against (who is this dispute against?) <span className="text-slate-400 font-normal">optional</span>
      </label>

      {selected ? (
        /* Selected user chip */
        <div className="flex items-center gap-3 p-3 rounded-xl border-2 border-primary-400 bg-primary-50 dark:bg-primary-900/20">
          <Avatar name={`${selected.firstName} ${selected.lastName}`} src={selected.avatar} size="sm" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {selected.firstName} {selected.lastName}
            </p>
            <p className="text-xs text-slate-400 capitalize">
              {roleLabels[selected.role] || selected.role} · {selected.email}
            </p>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="p-1.5 rounded-lg hover:bg-primary-100 dark:hover:bg-primary-900/40 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0"
            title="Remove"
          >
            <X size={15} />
          </button>
        </div>
      ) : (
        /* Search input */
        <div className="relative">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input
            type="text"
            value={query}
            onChange={e => { setQuery(e.target.value); setOpen(true); }}
            onFocus={() => setOpen(true)}
            placeholder="Type a name or email to search…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
          />
          {query && (
            <button
              type="button"
              onClick={() => { setQuery(''); setOpen(false); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      {/* Dropdown suggestions */}
      <AnimatePresence>
        {open && suggestions.length > 0 && !selected && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-2xl shadow-card-lg border border-slate-100 dark:border-slate-700 overflow-hidden"
          >
            {suggestions.map((u, i) => (
              <button
                key={u.id}
                type="button"
                onClick={() => handleSelect(u)}
                className={`w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700/60 transition-colors ${i > 0 ? 'border-t border-slate-100 dark:border-slate-700' : ''}`}
              >
                {/* Avatar with online indicator */}
                <div className="relative flex-shrink-0">
                  <Avatar
                    name={`${u.firstName} ${u.lastName}`}
                    src={u.avatar}
                    size="sm"
                  />
                  {u.isVerified && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-2 border-white dark:border-slate-800" />
                  )}
                  {u.isSuspended && (
                    <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-800" />
                  )}
                </div>

                {/* Name + role + email */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                      {u.firstName} {u.lastName}
                    </p>
                    {u.isSuspended && (
                      <span className="text-xs text-red-500 font-medium flex-shrink-0">Suspended</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-xs text-slate-400 truncate">{u.email}</span>
                    <span className="text-slate-300 dark:text-slate-600">·</span>
                    <span className="text-xs text-primary-600 dark:text-primary-400 font-medium capitalize flex-shrink-0">
                      {roleLabels[u.role] || u.role}
                    </span>
                  </div>
                </div>
              </button>
            ))}

            {/* "Not in system" option */}
            <div className="px-4 py-2.5 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-700/30">
              <p className="text-xs text-slate-400">
                Can't find them? You can still submit — describe who it's against in the description.
              </p>
            </div>
          </motion.div>
        )}

        {/* No results hint */}
        {open && query.trim().length >= 2 && suggestions.length === 0 && !selected && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 px-4 py-3"
          >
            <p className="text-sm text-slate-400">No users found for "<strong>{query}</strong>"</p>
            <p className="text-xs text-slate-400 mt-0.5">Describe who it's against in the description field.</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function RaiseDisputePage() {
  const { user } = useAuthStore();
  const { raiseDispute, getDisputesByUser } = useDisputeStore();
  const { properties } = usePropertyStore();
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [selectedAgainst, setSelectedAgainst] = useState<User | null>(null);
  const [form, setForm] = useState({
    type: '' as DisputeType | '',
    subject: '',
    description: '',
    evidence: '',
    propertyId: '',
    amount: '',
  });

  const myDisputes = user ? getDisputesByUser(user.id) : [];
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const resetModal = () => {
    setShowModal(false);
    setSelectedAgainst(null);
    setForm({ type: '', subject: '', description: '', evidence: '', propertyId: '', amount: '' });
  };

  const handleSubmit = async () => {
    if (!form.type) { toast.error('Select a dispute type'); return; }
    if (!form.subject.trim()) { toast.error('Enter a subject'); return; }
    if (!form.description.trim() || form.description.length < 30) {
      toast.error('Provide a detailed description (at least 30 characters)');
      return;
    }

    setLoading(true);

    const selectedProperty = properties.find(p => p.id === form.propertyId);

    await raiseDispute({
      type: form.type as DisputeType,
      raisedById: user!.id,
      raisedByName: `${user!.firstName} ${user!.lastName}`,
      raisedByRole: user!.role,
      againstId: selectedAgainst?.id,
      againstName: selectedAgainst ? `${selectedAgainst.firstName} ${selectedAgainst.lastName}` : undefined,
      againstRole: selectedAgainst?.role,
      propertyId: form.propertyId || undefined,
      propertyTitle: selectedProperty?.title || undefined,
      subject: form.subject,
      description: form.description,
      evidence: form.evidence || undefined,
      amount: form.amount ? Number(form.amount) : undefined,
    });

    setLoading(false);
    resetModal();
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
                    {d.againstName && (
                      <p className="text-xs text-slate-500 mt-0.5">
                        Against: <strong>{d.againstName}</strong>
                        {d.againstRole && <span className="text-slate-400 capitalize"> · {d.againstRole.replace('_', ' ')}</span>}
                      </p>
                    )}
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
      <Modal open={showModal} onClose={resetModal} title="Raise a Dispute" size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={resetModal}>Cancel</Button>
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

          {/* User search autocomplete */}
          <UserSearch
            excludeId={user?.id}
            selected={selectedAgainst}
            onSelect={setSelectedAgainst}
            onClear={() => setSelectedAgainst(null)}
          />

          <Input
            label="Amount in Dispute (UGX, optional)"
            type="number"
            placeholder="e.g. 270000"
            value={form.amount}
            onChange={e => set('amount', e.target.value)}
          />

          <Textarea
            label="Detailed Description *"
            placeholder="Describe the issue in detail. Include dates, amounts, and what happened..."
            value={form.description}
            onChange={e => set('description', e.target.value)}
            rows={4}
          />

          <Textarea
            label="Evidence / Supporting Information (optional)"
            placeholder="Describe any evidence you have (screenshots, receipts, messages, etc.)"
            value={form.evidence}
            onChange={e => set('evidence', e.target.value)}
            rows={2}
          />
        </div>
      </Modal>
    </div>
  );
}
