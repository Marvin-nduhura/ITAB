import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Calendar, CheckCircle2, XCircle, Clock, AlertCircle,
  Download, ThumbsDown, ThumbsUp, Info, Building2, QrCode,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { EmptyState } from '../components/ui/EmptyState';
import { QRCodeDisplay } from '../components/ui/QRCodeDisplay';
import { useAuthStore } from '../store/authStore';
import { useDataStore } from '../store/dataStore';
import { inspectionsApi } from '../lib/api';
import { formatCurrency, formatDate, inspectionStatusConfig, INSPECTION_FEE } from '../lib/utils';
import { downloadReceipt } from '../lib/download';
import { filterInspectionsForUser } from '../lib/rbac';
import type { Inspection } from '../types';
import toast from 'react-hot-toast';

// ─── Decline Lease Modal ──────────────────────────────────────────────────────
interface DeclineModalProps {
  open: boolean;
  inspection: Inspection | null;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

function DeclineLeaseModal({ open, inspection, onClose, onConfirm }: DeclineModalProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  const presetReasons = [
    'The space was too small for my needs',
    'The rent is higher than my budget',
    'The location doesn\'t suit me',
    'The condition of the property was not as expected',
    'I found a better property elsewhere',
    'Other reason',
  ];

  const handleConfirm = async () => {
    if (!reason.trim()) { toast.error('Please select or enter a reason'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setLoading(false);
    onConfirm(reason);
    setReason('');
  };

  return (
    <Modal open={open} onClose={onClose} title="Decline Lease" size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="danger" loading={loading} onClick={handleConfirm} icon={<ThumbsDown size={14} />}>
            Confirm Decline
          </Button>
        </>
      }
    >
      {inspection && (
        <div className="space-y-4">
          {/* Property info */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
            <div className="w-10 h-10 bg-primary-100 dark:bg-primary-900/30 rounded-xl flex items-center justify-center flex-shrink-0">
              <Building2 size={18} className="text-primary-600" />
            </div>
            <div>
              <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{inspection.propertyTitle}</p>
              <p className="text-xs text-slate-400">{inspection.propertyAddress}</p>
            </div>
          </div>

          {/* Fee notice */}
          <div className="flex items-start gap-2.5 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
            <Info size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-amber-700 dark:text-amber-400 space-y-1">
              <p className="font-semibold">Inspection fee is non-refundable</p>
              <p>The {formatCurrency(INSPECTION_FEE)} inspection fee you paid will <strong>not</strong> be refunded or credited since you are not taking this property.</p>
              <p className="text-amber-600 dark:text-amber-500 font-medium">✓ The property will remain available for other tenants.</p>
            </div>
          </div>

          {/* Reason */}
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Reason for declining (required)</p>
            <div className="space-y-2">
              {presetReasons.map(r => (
                <button key={r} onClick={() => setReason(r)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border text-sm transition-all ${reason === r ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-slate-300 dark:hover:border-slate-500'}`}>
                  {reason === r ? '● ' : '○ '}{r}
                </button>
              ))}
            </div>
            {reason === 'Other reason' && (
              <textarea
                className="mt-2 w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm resize-none"
                rows={3}
                placeholder="Please describe your reason..."
                onChange={e => setReason(e.target.value === '' ? 'Other reason' : e.target.value)}
              />
            )}
          </div>
        </div>
      )}
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function InspectionsPage() {
  const { user } = useAuthStore();
  const navigate = useNavigate();
  const { inspections: allInspections } = useDataStore();
  // Only show inspections this user is allowed to see
  const [inspections, setInspections] = useState<Inspection[]>(() => filterInspectionsForUser(allInspections, user));
  const [selected, setSelected] = useState<Inspection | null>(null);
  const [showDetail, setShowDetail] = useState(false);
  const [showDeclineModal, setShowDeclineModal] = useState(false);
  const [declineTarget, setDeclineTarget] = useState<Inspection | null>(null);
  const [tab, setTab] = useState<'upcoming' | 'past' | 'declined'>('upcoming');
  const [showQR, setShowQR] = useState(false);

  const upcoming = inspections.filter(i => ['pending', 'confirmed'].includes(i.status));
  const past = inspections.filter(i => ['completed', 'cancelled', 'no_show'].includes(i.status) && !i.leaseDeclined);
  const declined = inspections.filter(i => i.leaseDeclined);

  const list = tab === 'upcoming' ? upcoming : tab === 'past' ? past : declined;

  const statusIcon = (insp: Inspection) => {
    if (insp.leaseDeclined) return <ThumbsDown size={16} className="text-slate-400" />;
    if (insp.status === 'confirmed') return <CheckCircle2 size={16} className="text-green-500" />;
    if (insp.status === 'cancelled' || insp.status === 'no_show') return <XCircle size={16} className="text-red-500" />;
    if (insp.status === 'completed') return <CheckCircle2 size={16} className="text-blue-500" />;
    return <Clock size={16} className="text-yellow-500" />;
  };

  const handleConfirm = async (id: string) => {
    setInspections(prev => prev.map(i => i.id === id ? { ...i, status: 'confirmed' as const } : i));
    try { await inspectionsApi.confirm(id); } catch { /* queued offline */ }
    toast.success('Inspection confirmed! Tenant has been notified.');
  };

  const handleCancel = async (id: string) => {
    setInspections(prev => prev.map(i => i.id === id ? { ...i, status: 'cancelled' as const } : i));
    try { await inspectionsApi.cancel(id); } catch { /* queued offline */ }
    toast('Inspection cancelled. Fee is non-refundable.', { icon: '⚠️' });
  };

  const handleNoShow = async (id: string) => {
    setInspections(prev => prev.map(i =>
      i.id === id ? { ...i, status: 'no_show' as const, noShowCount: i.noShowCount + 1 } : i
    ));
    try { await inspectionsApi.noShow(id); } catch { /* queued offline */ }
    toast.error('Tenant marked as no-show. Property remains available.');
  };

  const handleDeclineLease = (insp: Inspection) => {
    setDeclineTarget(insp);
    setShowDeclineModal(true);
  };

  const confirmDecline = (reason: string) => {
    if (!declineTarget) return;
    setInspections(prev => prev.map(i =>
      i.id === declineTarget.id
        ? {
            ...i,
            leaseDeclined: true,
            leaseDeclinedReason: reason,
            leaseDeclinedAt: new Date().toISOString(),
            // Property status stays 'published' — handled by property store in real app
          }
        : i
    ));
    setShowDeclineModal(false);
    setDeclineTarget(null);
    toast('Lease declined. The property is still available for other tenants.', {
      icon: '🏠',
      duration: 5000,
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Inspections</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {upcoming.length} upcoming · {past.length} completed · {declined.length} declined
          </p>
        </div>
        {user?.role === 'tenant' && (
          <Button icon={<Calendar size={16} />} onClick={() => navigate('/search')}>
            Find Properties
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit overflow-x-auto">
        {([
          { key: 'upcoming', label: 'Upcoming', count: upcoming.length },
          { key: 'past',     label: 'Completed', count: past.length },
          { key: 'declined', label: 'Declined', count: declined.length },
        ] as const).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${tab === t.key ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            {t.label}
            {t.count > 0 && (
              <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${tab === t.key ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300' : 'bg-slate-200 dark:bg-slate-600 text-slate-500'}`}>
                {t.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Declined tab info banner */}
      <AnimatePresence>
        {tab === 'declined' && declined.length > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl">
            <Info size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p className="font-semibold">Properties remain available</p>
              <p className="text-xs mt-0.5 text-blue-600 dark:text-blue-400">
                When you decline a lease after inspection, the property stays published and available for other tenants to book. Your inspection fee is non-refundable.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      {list.length === 0 ? (
        <EmptyState
          icon={<Calendar size={28} />}
          title={tab === 'upcoming' ? 'No upcoming inspections' : tab === 'past' ? 'No completed inspections' : 'No declined leases'}
          description={tab === 'upcoming' ? 'Book an inspection from any property listing.' : 'Inspections you complete will appear here.'}
        />
      ) : (
        <div className="space-y-3">
          {list.map((insp, i) => {
            const sc = inspectionStatusConfig[insp.status];
            const isDeclined = !!insp.leaseDeclined;

            return (
              <motion.div key={insp.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className={`bg-white dark:bg-slate-800 rounded-2xl shadow-card border transition-all ${isDeclined ? 'border-slate-200 dark:border-slate-700 opacity-80' : 'border-slate-100 dark:border-slate-700'}`}>

                <div className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      {statusIcon(insp)}
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm truncate">{insp.propertyTitle}</h3>
                        <p className="text-xs text-slate-400 mt-0.5">{insp.propertyAddress}</p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <span className="text-xs text-slate-500 flex items-center gap-1">
                            <Calendar size={11} />{formatDate(insp.scheduledDate)} at {insp.scheduledTime}
                          </span>
                          {isDeclined
                            ? <Badge variant="gray">Lease Declined</Badge>
                            : <Badge variant={sc.color.replace('badge-', '') as 'blue'}>{sc.label}</Badge>}
                          {insp.feePaid
                            ? <Badge variant="green">Fee Paid ✓</Badge>
                            : <Badge variant="yellow">Fee Pending</Badge>}
                        </div>

                        {/* Declined reason */}
                        {isDeclined && insp.leaseDeclinedReason && (
                          <p className="text-xs text-slate-400 mt-2 italic">
                            Reason: "{insp.leaseDeclinedReason}"
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{formatCurrency(insp.feeAmount)}</p>
                      <div className="flex gap-1.5">
                        {insp.feePaid && (
                          <Button size="sm" variant="secondary" icon={<QrCode size={13} />}
                            onClick={() => { setSelected(insp); setShowQR(true); }}>
                            QR
                          </Button>
                        )}
                        <Button size="sm" variant="secondary" onClick={() => { setSelected(insp); setShowDetail(true); }}>
                          Details
                        </Button>
                      </div>
                    </div>
                  </div>

                  {/* Inspection fee credit notice — only if not declined */}
                  {insp.feePaid && !insp.creditApplied && !isDeclined && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                      <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1.5">
                        <CheckCircle2 size={12} />
                        {formatCurrency(INSPECTION_FEE)} inspection fee will be credited toward first rent if you take this property.
                      </p>
                    </div>
                  )}

                  {/* Fee forfeited notice — declined */}
                  {isDeclined && insp.feePaid && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                      <p className="text-xs text-slate-400 flex items-center gap-1.5">
                        <Info size={11} />
                        Inspection fee of {formatCurrency(INSPECTION_FEE)} was forfeited (non-refundable). Property is still available.
                      </p>
                    </div>
                  )}

                  {/* Tenant actions — completed inspection, not yet declined */}
                  {user?.role === 'tenant' && insp.status === 'completed' && !isDeclined && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex gap-2 flex-wrap">
                      <Button size="sm" icon={<ThumbsUp size={13} />}
                        onClick={() => toast.success('Great! Contact the manager to sign the lease.')}>
                        Take This Property
                      </Button>
                      <Button size="sm" variant="secondary" icon={<ThumbsDown size={13} />}
                        onClick={() => handleDeclineLease(insp)}>
                        Decline Lease
                      </Button>
                    </div>
                  )}

                  {/* Manager actions */}
                  {user?.role === 'property_manager' && insp.status === 'pending' && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex gap-2 flex-wrap">
                      <Button size="sm" onClick={() => handleConfirm(insp.id)} icon={<CheckCircle2 size={13} />}>
                        Confirm
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => handleCancel(insp.id)} icon={<XCircle size={13} />}>
                        Cancel
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => handleNoShow(insp.id)} icon={<AlertCircle size={13} />}>
                        No Show
                      </Button>
                    </div>
                  )}

                  {/* Manager: mark completed */}
                  {user?.role === 'property_manager' && insp.status === 'confirmed' && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex gap-2">
                      <Button size="sm" icon={<CheckCircle2 size={13} />}
                        onClick={async () => {
                          setInspections(prev => prev.map(i => i.id === insp.id ? { ...i, status: 'completed' as const } : i));
                          try { await inspectionsApi.confirm(insp.id); } catch { /* offline */ }
                          toast.success('Inspection marked as completed.');
                        }}>
                        Mark Completed
                      </Button>
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Detail Modal */}
      <Modal open={showDetail} onClose={() => setShowDetail(false)} title="Inspection Details"
        footer={<Button variant="secondary" onClick={() => setShowDetail(false)}>Close</Button>}>
        {selected && (
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-2.5 text-sm">
              {[
                { label: 'Property', value: selected.propertyTitle },
                { label: 'Address', value: selected.propertyAddress },
                { label: 'Date', value: formatDate(selected.scheduledDate) },
                { label: 'Time', value: selected.scheduledTime },
                { label: 'Tenant', value: selected.tenantName },
              ].map(row => (
                <div key={row.label} className="flex justify-between gap-4">
                  <span className="text-slate-500 flex-shrink-0">{row.label}</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 text-right">{row.value}</span>
                </div>
              ))}
              <div className="flex justify-between">
                <span className="text-slate-500">Status</span>
                {selected.leaseDeclined
                  ? <Badge variant="gray">Lease Declined</Badge>
                  : <Badge variant={inspectionStatusConfig[selected.status].color.replace('badge-', '') as 'blue'}>{inspectionStatusConfig[selected.status].label}</Badge>}
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Inspection Fee</span>
                <span className="font-semibold">{formatCurrency(selected.feeAmount)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Fee Paid</span>
                <span className={selected.feePaid ? 'text-green-600 font-semibold' : 'text-yellow-600 font-semibold'}>
                  {selected.feePaid ? 'Yes' : 'Pending'}
                </span>
              </div>
              {selected.paymentMethod && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Payment Method</span>
                  <span className="font-semibold capitalize">{selected.paymentMethod.replace('_', ' ')}</span>
                </div>
              )}
              {selected.paymentRef && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Reference</span>
                  <span className="font-mono text-xs">{selected.paymentRef}</span>
                </div>
              )}
              {selected.leaseDeclined && (
                <>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Declined On</span>
                    <span className="font-semibold">{selected.leaseDeclinedAt ? formatDate(selected.leaseDeclinedAt) : '—'}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-slate-500 flex-shrink-0">Reason</span>
                    <span className="text-slate-700 dark:text-slate-300 text-right italic text-xs">{selected.leaseDeclinedReason}</span>
                  </div>
                </>
              )}
            </div>

            {/* Credit notice */}
            {selected.feePaid && !selected.creditApplied && !selected.leaseDeclined && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3">
                <p className="text-xs text-green-700 dark:text-green-400 font-medium">
                  ✅ Inspection fee of {formatCurrency(INSPECTION_FEE)} will be credited toward first rent if you sign a lease.
                </p>
              </div>
            )}

            {/* Forfeited notice */}
            {selected.leaseDeclined && (
              <div className="bg-slate-50 dark:bg-slate-700/50 border border-slate-200 dark:border-slate-600 rounded-xl p-3">
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  🏠 This property is still available for other tenants to book and inspect.
                </p>
              </div>
            )}

            {selected.feePaid && (
              <Button variant="secondary" className="w-full" icon={<Download size={15} />}
                onClick={() => downloadReceipt({
                  reference: selected.paymentRef || `INSP-${selected.id}`,
                  type: 'Inspection Fee',
                  propertyTitle: selected.propertyTitle,
                  tenantName: selected.tenantName,
                  amount: selected.feeAmount,
                  method: (selected.paymentMethod || 'cash').replace(/_/g, ' '),
                  date: selected.createdAt,
                })}>
                Download Receipt
              </Button>
            )}
          </div>
        )}
      </Modal>

      {/* Decline Lease Modal */}
      <DeclineLeaseModal
        open={showDeclineModal}
        inspection={declineTarget}
        onClose={() => { setShowDeclineModal(false); setDeclineTarget(null); }}
        onConfirm={confirmDecline}
      />

      {/* QR Code Modal */}
      <Modal
        open={showQR}
        onClose={() => setShowQR(false)}
        title="Inspection QR Code"
        size="sm"
        footer={<Button variant="secondary" onClick={() => setShowQR(false)}>Close</Button>}
      >
        {selected && (
          <div className="space-y-4 text-center">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Show this QR code at the property to confirm your inspection booking.
            </p>
            <div className="flex justify-center">
              <QRCodeDisplay
                value={JSON.stringify({
                  inspectionId: selected.id,
                  property: selected.propertyTitle,
                  tenant: selected.tenantName,
                  date: selected.scheduledDate,
                  time: selected.scheduledTime,
                  ref: selected.paymentRef || `INSP-${selected.id}`,
                })}
                size={220}
                label={`${selected.propertyTitle} · ${selected.scheduledDate} at ${selected.scheduledTime}`}
                downloadFileName={`inspection-${selected.id}`}
              />
            </div>
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 text-xs text-slate-500 space-y-1 text-left">
              <div className="flex justify-between"><span>Inspection ID</span><span className="font-mono">{selected.id}</span></div>
              <div className="flex justify-between"><span>Property</span><span className="font-semibold text-slate-700 dark:text-slate-300 text-right max-w-[160px] truncate">{selected.propertyTitle}</span></div>
              <div className="flex justify-between"><span>Date & Time</span><span>{selected.scheduledDate} at {selected.scheduledTime}</span></div>
              {selected.paymentRef && <div className="flex justify-between"><span>Payment Ref</span><span className="font-mono">{selected.paymentRef}</span></div>}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
