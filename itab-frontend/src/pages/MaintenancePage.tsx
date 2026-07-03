import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Wrench, Plus, AlertCircle, Clock, CheckCircle2, UserCheck, Star, Phone, RotateCcw, XCircle, ArrowLeft, Smartphone, DollarSign } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input, Select, Textarea } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { Avatar } from '../components/ui/Avatar';
import { FileUpload, type UploadedFile } from '../components/ui/FileUpload';
import { useAuthStore } from '../store/authStore';
import { useVendorStore } from '../store/vendorStore';
import { useDataStore } from '../store/dataStore';
import { usePropertyStore } from '../store/propertyStore';
import { usePaymentStore } from '../store/paymentStore';
import { maintenanceApi, paymentsApi } from '../lib/api';
import { formatDate, formatCurrency, maintenanceStatusConfig } from '../lib/utils';
import { filterMaintenanceForUser, canDo } from '../lib/rbac';
import type { MaintenanceRequest, VendorCategory } from '../types';
import toast from 'react-hot-toast';

// Category icons for vendor filter
const categoryLabels: Record<VendorCategory, string> = {
  plumber: '🔧 Plumber', electrician: '⚡ Electrician', cleaner: '🧹 Cleaner',
  mason: '🧱 Mason', gardener: '🌿 Gardener', garbage_collector: '🗑️ Garbage Collector',
  security: '🔒 Security', painter: '🎨 Painter', carpenter: '🪚 Carpenter',
  welder: '🔩 Welder', other: '🛠️ Other',
};

export function MaintenancePage() {
  const { user } = useAuthStore();
  const { vendors, assignJob, completeJob, rateVendor, getJobsByMaintenance } = useVendorStore();
  const { maintenance: allMaintenance, setMaintenance } = useDataStore();
  const { properties: allProperties } = usePropertyStore();
  const { payVendor } = usePaymentStore();
  const [, setRefreshing] = useState(false);

  // Fetch fresh from Render DB on mount
  const fetchMaintenance = useCallback(async () => {
    setRefreshing(true);
    try {
      const [maintRes] = await Promise.allSettled([
        maintenanceApi.list(),
        import('../lib/api').then(m => m.vendorsApi.list()),
        import('../lib/api').then(m => m.vendorJobsApi.list()),
      ]);
      if (maintRes.status === 'fulfilled') {
        const data = (maintRes.value.data as { data: MaintenanceRequest[] }).data;
        if (Array.isArray(data)) setMaintenance(data);
      }
    } catch { /* keep cached */ }
    finally { setRefreshing(false); }
  }, [setMaintenance]);

  useEffect(() => { fetchMaintenance(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Always derive from store
  const requests = filterMaintenanceForUser(allMaintenance, user, allProperties);
  const [showNewModal, setShowNewModal] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState<MaintenanceRequest | null>(null);
  const [showCompleteModal, setShowCompleteModal] = useState<MaintenanceRequest | null>(null);
  const [showRateModal, setShowRateModal] = useState<{ request: MaintenanceRequest; jobId: string; vendorId: string; vendorName: string } | null>(null);
  const [showRevertModal, setShowRevertModal] = useState<{ request: MaintenanceRequest; targetStatus: MaintenanceRequest['status']; label: string } | null>(null);
  const [loading, setLoading] = useState(false);

  // Pay vendor modal state
  const [showPayVendorModal, setShowPayVendorModal] = useState<{
    vendorId: string; vendorName: string; jobId: string;
    propertyTitle: string; amount: number; description: string;
  } | null>(null);
  const [vendorPhone, setVendorPhone] = useState('');
  const [vendorPayMethod, setVendorPayMethod] = useState<'mtn_momo' | 'airtel_money' | 'cash'>('mtn_momo');
  const [vendorPayLoading, setVendorPayLoading] = useState(false);
  const [vendorAwaitingPin, setVendorAwaitingPin] = useState(false);
  const [vendorPayRef, setVendorPayRef] = useState('');
  const [vendorPayTimedOut, setVendorPayTimedOut] = useState(false);
  // New request form
  const [form, setForm] = useState({ title: '', description: '', priority: 'normal' });
  const [photos, setPhotos] = useState<UploadedFile[]>([]);

  // Assign form
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [assignNotes, setAssignNotes] = useState('');
  const [assignDate, setAssignDate] = useState('');
  const [estimatedCost, setEstimatedCost] = useState('');
  const [vendorCategoryFilter, setVendorCategoryFilter] = useState('');

  // Complete form
  const [actualCost, setActualCost] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');

  // Rate form
  const [ratingValue, setRatingValue] = useState(5);
  const [ratingComment, setRatingComment] = useState('');

  const priorityIcon = (p: string) => {
    if (p === 'urgent') return <AlertCircle size={16} className="text-red-500" />;
    if (p === 'normal') return <Clock size={16} className="text-blue-500" />;
    return <CheckCircle2 size={16} className="text-green-500" />;
  };

  const statusVariant = (s: string): 'yellow' | 'blue' | 'purple' | 'green' | 'gray' => {
    const m: Record<string, 'yellow' | 'blue' | 'purple' | 'green' | 'gray'> = {
      submitted: 'yellow', assigned: 'blue', in_progress: 'purple', completed: 'green', cancelled: 'gray',
    };
    return m[s] || 'gray';
  };

  const handleSubmitRequest = async () => {
    if (!form.title || !form.description) { toast.error('Please fill all fields'); return; }
    setLoading(true);
    try {
      // Find the user's rented property
      const rentedProp = allProperties.find(p => p.tenantId === user?.id && p.status === 'rented');
      await maintenanceApi.create({
        propertyId: rentedProp?.id || 'p6',
        propertyTitle: rentedProp?.title || 'My Property',
        title: form.title, description: form.description,
        priority: form.priority, photos: photos.map(p => p.dataUrl),
      });
      await fetchMaintenance();
      toast.success('Maintenance request submitted!');
    } catch {
      toast.error('Failed to submit. Please check your connection.');
    } finally {
      setLoading(false);
      setShowNewModal(false);
      setForm({ title: '', description: '', priority: 'normal' });
      setPhotos([]);
    }
  };

  const handleAssign = async () => {
    if (!selectedVendorId || !showAssignModal) { toast.error('Select a vendor'); return; }
    const vendor = vendors.find(v => v.id === selectedVendorId);
    if (!vendor) return;
    setLoading(true);
    try {
      await maintenanceApi.assign(showAssignModal.id, vendor.id);
      assignJob({
        vendorId: vendor.id,
        vendorName: `${vendor.firstName} ${vendor.lastName}`,
        maintenanceRequestId: showAssignModal.id,
        propertyTitle: showAssignModal.propertyTitle,
        propertyAddress: '',
        title: showAssignModal.title,
        description: showAssignModal.description,
        status: 'assigned',
        scheduledDate: assignDate || undefined,
        estimatedCost: estimatedCost ? Number(estimatedCost) : undefined,
        managerNotes: assignNotes || undefined,
        photos: [],
      });
      await fetchMaintenance();
      toast.success(`Assigned to ${vendor.firstName} ${vendor.lastName}!`);
    } catch {
      toast.error('Failed to assign vendor');
    } finally {
      setLoading(false);
      setShowAssignModal(null);
      setSelectedVendorId('');
      setAssignNotes('');
      setAssignDate('');
      setEstimatedCost('');
    }
  };

  const handleComplete = async () => {
    if (!showCompleteModal) return;
    const jobs = getJobsByMaintenance(showCompleteModal.id);
    const job = jobs[0];
    if (job) completeJob(job.id, Number(actualCost) || 0, completionNotes);
    try {
      await maintenanceApi.update(showCompleteModal.id, { status: 'completed', actualCost: Number(actualCost) || undefined });
      await fetchMaintenance();
    } catch { /* keep local */ }
    const vendorId   = showCompleteModal.vendorId;
    const vendorName = showCompleteModal.vendorName;
    const jobId      = job?.id || '';
    const costAmount = Number(actualCost) || 0;
    const propTitle  = showCompleteModal.propertyTitle;
    const reqTitle   = showCompleteModal.title;

    setShowCompleteModal(null);
    setActualCost('');
    setCompletionNotes('');
    toast.success('Request marked as completed!');

    // Pre-fill vendor phone from vendor store if available
    const vendorObj = vendors.find(v => v.id === vendorId);
    if (vendorObj?.phone) setVendorPhone(vendorObj.phone);

    // Open pay-vendor modal if there's an amount and a vendor
    if (vendorId && vendorName && costAmount > 0) {
      setTimeout(() => {
        setShowPayVendorModal({
          vendorId, vendorName, jobId,
          propertyTitle: propTitle,
          amount: costAmount,
          description: `Payment for: ${reqTitle} at ${propTitle}`,
        });
        // After a short delay, prompt to rate too
        if (jobId) {
          setTimeout(() => {
            setShowRateModal({ request: showCompleteModal, jobId, vendorId, vendorName });
          }, 2000);
        }
      }, 400);
    } else if (vendorId && vendorName && jobId) {
      setTimeout(() => {
        setShowRateModal({ request: showCompleteModal, jobId, vendorId, vendorName });
      }, 500);
    }
  };

  // Handle vendor payment via mobile money or cash
  const handlePayVendor = async () => {
    if (!showPayVendorModal) return;
    if ((vendorPayMethod === 'mtn_momo' || vendorPayMethod === 'airtel_money') && !vendorPhone.trim()) {
      toast.error('Enter the vendor\'s mobile money phone number'); return;
    }

    setVendorPayLoading(true);
    try {
      const ref = `${vendorPayMethod === 'mtn_momo' ? 'MTN' : vendorPayMethod === 'airtel_money' ? 'AIR' : 'CASH'}-VND-${Date.now()}`;

      // Cash — record directly, no PIN/USSD needed
      if (vendorPayMethod === 'cash') {
        payVendor({
          vendorId: showPayVendorModal.vendorId,
          vendorName: showPayVendorModal.vendorName,
          jobId: showPayVendorModal.jobId,
          propertyTitle: showPayVendorModal.propertyTitle,
          amount: showPayVendorModal.amount,
          description: showPayVendorModal.description,
          managerId: user?.id || '',
          managerName: `${user?.firstName} ${user?.lastName}`,
          paymentMethod: 'cash',
          receiverPhone: '',
        });
        setVendorPayLoading(false);
        setShowPayVendorModal(null);
        setVendorPhone('');
        toast.success(`✅ Cash payment of ${formatCurrency(showPayVendorModal.amount)} recorded for ${showPayVendorModal.vendorName}!`);
        return;
      }

      // Initiate mobile money push to vendor's phone
      if (vendorPayMethod === 'mtn_momo') {
        await paymentsApi.initMTN({ amount: showPayVendorModal.amount, phone: vendorPhone, type: 'vendor_payment', reference: ref });
      } else {
        await paymentsApi.initAirtel({ amount: showPayVendorModal.amount, phone: vendorPhone, type: 'vendor_payment', reference: ref });
      }

      // Record the transaction in the payment store (creates audit trail)
      payVendor({
        vendorId: showPayVendorModal.vendorId,
        vendorName: showPayVendorModal.vendorName,
        jobId: showPayVendorModal.jobId,
        propertyTitle: showPayVendorModal.propertyTitle,
        amount: showPayVendorModal.amount,
        description: showPayVendorModal.description,
        managerId: user?.id || '',
        managerName: `${user?.firstName} ${user?.lastName}`,
        paymentMethod: vendorPayMethod,
        receiverPhone: vendorPhone,
      });

      setVendorPayLoading(false);
      setVendorPayRef(ref);
      setVendorAwaitingPin(true);
      setVendorPayTimedOut(false);

      // Poll for callback confirmation
      const result = await paymentsApi.pollStatus(ref, { intervalMs: 3000, maxAttempts: 20 });
      setVendorAwaitingPin(false);

      if (result.status === 'completed') {
        setShowPayVendorModal(null);
        setVendorPhone('');
        toast.success(`✅ ${formatCurrency(showPayVendorModal.amount)} sent to ${showPayVendorModal.vendorName} via ${vendorPayMethod === 'mtn_momo' ? 'MTN MoMo' : 'Airtel Money'}!`);
      } else {
        setVendorPayTimedOut(true);
        toast.error('Payment not confirmed. The vendor should check their phone.');
      }
    } catch {
      setVendorPayLoading(false);
      setVendorAwaitingPin(false);
      toast.error('Payment failed. Please try again.');
    }
  };

  const handleRate = async () => {
    if (!showRateModal) return;
    rateVendor(showRateModal.vendorId, showRateModal.jobId, user?.id || '', `${user?.firstName} ${user?.lastName}`, ratingValue, ratingComment);
    setShowRateModal(null);
    setRatingValue(5);
    setRatingComment('');
    toast.success('Vendor rated! Thank you for your feedback.');
  };

  // Status change — writes to backend then refreshes
  const changeStatus = async (id: string, newStatus: MaintenanceRequest['status'], label: string) => {
    try {
      await maintenanceApi.update(id, { status: newStatus });
      await fetchMaintenance();
      toast.success(`Marked as ${label}`);
    } catch {
      toast.error('Failed to update status. Please try again.');
    }
  };

  // Revert / cancel from the confirmation modal
  const handleRevert = async () => {
    if (!showRevertModal) return;
    const { request, targetStatus, label } = showRevertModal;
    setShowRevertModal(null);
    await changeStatus(request.id, targetStatus, label);
  };

  const availableVendors = vendors.filter(v =>
    v.isActive && !v.isSuspended &&
    (!vendorCategoryFilter || v.category === vendorCategoryFilter)
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Maintenance</h1>
          <p className="text-sm text-slate-500 mt-0.5">{requests.length} requests</p>
        </div>
        {canDo.submitMaintenance(user) && (
          <Button icon={<Plus size={16} />} onClick={() => setShowNewModal(true)}>New Request</Button>
        )}      </div>

      {/* Status summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Submitted', count: requests.filter(m => m.status === 'submitted').length, color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300' },
          { label: 'In Progress', count: requests.filter(m => m.status === 'in_progress').length, color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300' },
          { label: 'Completed', count: requests.filter(m => m.status === 'completed').length, color: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300' },
          { label: 'Urgent', count: requests.filter(m => m.priority === 'urgent').length, color: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl p-4 ${s.color}`}>
            <p className="text-2xl font-bold">{s.count}</p>
            <p className="text-sm font-medium mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {requests.length === 0 ? (
        <EmptyState icon={<Wrench size={28} />} title="No maintenance requests" description="Submit a request when something needs fixing." action={canDo.submitMaintenance(user) ? <Button onClick={() => setShowNewModal(true)}>New Request</Button> : undefined} />
      ) : (
        <div className="space-y-3">
          {requests.map((m, i) => (
            <motion.div key={m.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {priorityIcon(m.priority)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{m.title}</h3>
                      <Badge variant={m.priority === 'urgent' ? 'red' : m.priority === 'normal' ? 'blue' : 'green'}>{m.priority}</Badge>
                      <Badge variant={statusVariant(m.status)}>{maintenanceStatusConfig[m.status]?.label}</Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{m.propertyTitle}</p>
                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 line-clamp-2">{m.description}</p>

                    {/* Assigned vendor info */}
                    {m.vendorName && (
                      <div className="flex items-center gap-2 mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                        <Avatar name={m.vendorName} size="xs" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-blue-700 dark:text-blue-300">🔧 {m.vendorName}</p>
                          {m.estimatedCost && <p className="text-xs text-blue-500">Est. {formatCurrency(m.estimatedCost)}</p>}
                        </div>
                        {(() => {
                          const vendor = vendors.find(v => v.id === m.vendorId);
                          return vendor ? (
                            <a href={`tel:${vendor.phone}`} className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/40 text-blue-600">
                              <Phone size={12} />
                            </a>
                          ) : null;
                        })()}
                      </div>
                    )}

                    {m.actualCost && (
                      <p className="text-xs text-green-600 mt-1">✓ Actual cost: {formatCurrency(m.actualCost)}</p>
                    )}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-slate-400">{formatDate(m.createdAt)}</p>
                </div>
              </div>

              {/* Manager / Admin / Landlord actions */}
              {canDo.manageMaintenance(user) && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex gap-2 flex-wrap items-center">

                  {/* submitted → assign vendor */}
                  {m.status === 'submitted' && (
                    <Button size="sm" icon={<UserCheck size={13} />} onClick={() => setShowAssignModal(m)}>
                      Assign Vendor
                    </Button>
                  )}

                  {/* submitted / assigned → mark in progress */}
                  {(m.status === 'submitted' || m.status === 'assigned') && (
                    <Button size="sm" variant="secondary" onClick={() => changeStatus(m.id, 'in_progress', 'In Progress')}>
                      Mark In Progress
                    </Button>
                  )}

                  {/* assigned / in_progress → mark complete */}
                  {(m.status === 'assigned' || m.status === 'in_progress') && (
                    <Button size="sm" icon={<CheckCircle2 size={13} />} onClick={() => setShowCompleteModal(m)}>
                      Mark Complete
                    </Button>
                  )}

                  {/* completed → revert to in_progress */}
                  {m.status === 'completed' && (
                    <Button size="sm" variant="secondary" icon={<RotateCcw size={13} />}
                      onClick={() => setShowRevertModal({ request: m, targetStatus: 'in_progress', label: 'In Progress' })}>
                      Revert to In Progress
                    </Button>
                  )}

                  {/* in_progress → revert to assigned */}
                  {m.status === 'in_progress' && (
                    <Button size="sm" variant="secondary" icon={<ArrowLeft size={13} />}
                      onClick={() => setShowRevertModal({ request: m, targetStatus: 'assigned', label: 'Assigned' })}>
                      Revert to Assigned
                    </Button>
                  )}

                  {/* assigned → revert to submitted (unassign) */}
                  {m.status === 'assigned' && (
                    <Button size="sm" variant="secondary" icon={<ArrowLeft size={13} />}
                      onClick={() => setShowRevertModal({ request: m, targetStatus: 'submitted', label: 'Submitted' })}>
                      Unassign
                    </Button>
                  )}

                  {/* submitted / assigned → cancel */}
                  {(m.status === 'submitted' || m.status === 'assigned') && (
                    <Button size="sm" variant="danger" icon={<XCircle size={13} />}
                      onClick={() => setShowRevertModal({ request: m, targetStatus: 'cancelled', label: 'Cancelled' })}>
                      Cancel
                    </Button>
                  )}

                  {/* cancelled → reopen */}
                  {m.status === 'cancelled' && (
                    <Button size="sm" variant="secondary" icon={<RotateCcw size={13} />}
                      onClick={() => changeStatus(m.id, 'submitted', 'Submitted (Reopened)')}>
                      Reopen
                    </Button>
                  )}
                </div>
              )}

              {/* Tenant: rate completed job */}
              {user?.role === 'tenant' && m.status === 'completed' && m.vendorId && (
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                  <Button size="sm" variant="secondary" icon={<Star size={13} />}
                    onClick={() => {
                      const jobs = getJobsByMaintenance(m.id);
                      const job = jobs[0];
                      if (job) setShowRateModal({ request: m, jobId: job.id, vendorId: m.vendorId!, vendorName: m.vendorName! });
                    }}>
                    Rate {m.vendorName}
                  </Button>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* ── New Request Modal ─────────────────────────────────────────── */}
      <Modal open={showNewModal} onClose={() => setShowNewModal(false)} title="Submit Maintenance Request"
        footer={<><Button variant="secondary" onClick={() => setShowNewModal(false)}>Cancel</Button><Button loading={loading} onClick={handleSubmitRequest}>Submit Request</Button></>}>
        <div className="space-y-4">
          <Input label="Issue Title" placeholder="e.g. Leaking tap in bathroom" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
          <Textarea label="Description" placeholder="Describe the issue in detail..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <Select label="Priority" value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
            options={[{ value: 'low', label: 'Low – Not urgent' }, { value: 'normal', label: 'Normal – Fix when possible' }, { value: 'urgent', label: '🚨 Urgent – Needs immediate attention' }]} />
          <FileUpload label="Photos (optional)" accept="image/*" multiple maxFiles={5} maxSizeMB={10}
            value={photos} onChange={setPhotos} showCamera hint="Take a photo or upload from your device." />
        </div>
      </Modal>

      {/* ── Assign Vendor Modal ───────────────────────────────────────── */}
      <Modal open={!!showAssignModal} onClose={() => { setShowAssignModal(null); setSelectedVendorId(''); }} title="Assign Vendor" size="lg"
        footer={<><Button variant="secondary" onClick={() => setShowAssignModal(null)}>Cancel</Button><Button loading={loading} onClick={handleAssign} disabled={!selectedVendorId} icon={<UserCheck size={14} />}>Assign Vendor</Button></>}>
        {showAssignModal && (
          <div className="space-y-4">
            {/* Request summary */}
            <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
              <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{showAssignModal.title}</p>
              <p className="text-xs text-slate-400">{showAssignModal.propertyTitle} · {showAssignModal.priority} priority</p>
            </div>

            {/* Category filter */}
            <Select label="Filter by skill category" value={vendorCategoryFilter}
              onChange={e => { setVendorCategoryFilter(e.target.value); setSelectedVendorId(''); }}
              options={[{ value: '', label: 'All Categories' }, ...Object.entries(categoryLabels).map(([v, l]) => ({ value: v, label: l }))]} />

            {/* Vendor list */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Select Vendor ({availableVendors.length} available)
              </label>
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {availableVendors.length === 0 ? (
                  <p className="text-sm text-slate-400 text-center py-4">No vendors available in this category</p>
                ) : availableVendors.map(v => (
                  <button key={v.id} onClick={() => setSelectedVendorId(v.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${selectedVendorId === v.id ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'}`}>
                    <Avatar name={`${v.firstName} ${v.lastName}`} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{v.firstName} {v.lastName}</p>
                        {v.isVerified && <CheckCircle2 size={12} className="text-green-500" />}
                        <Badge variant={v.availability === 'available' ? 'green' : 'yellow'} className="ml-auto">{v.availability}</Badge>
                      </div>
                      <p className="text-xs text-slate-400">{categoryLabels[v.category]} · {v.district}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <div className="flex items-center gap-0.5">
                          {[1,2,3,4,5].map(s => <Star key={s} size={10} className={s <= Math.round(v.rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-300'} />)}
                        </div>
                        <span className="text-xs text-slate-400">{v.rating} · {v.completedJobs} jobs</span>
                        {v.dailyRate && <span className="text-xs text-slate-400 ml-auto">{formatCurrency(v.dailyRate)}/day</span>}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input label="Scheduled Date" type="date" value={assignDate} onChange={e => setAssignDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
              <Input label="Estimated Cost (UGX)" type="number" placeholder="e.g. 50000" value={estimatedCost} onChange={e => setEstimatedCost(e.target.value)} />
            </div>
            <Textarea label="Notes for Vendor" placeholder="Any specific instructions..." value={assignNotes} onChange={e => setAssignNotes(e.target.value)} rows={2} />
          </div>
        )}
      </Modal>

      {/* ── Complete Job Modal ────────────────────────────────────────── */}
      <Modal open={!!showCompleteModal} onClose={() => setShowCompleteModal(null)} title="Mark as Completed"
        footer={<><Button variant="secondary" onClick={() => setShowCompleteModal(null)}>Cancel</Button><Button onClick={handleComplete} icon={<CheckCircle2 size={14} />}>Mark Complete</Button></>}>
        {showCompleteModal && (
          <div className="space-y-4">
            <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
              <p className="font-semibold text-green-800 dark:text-green-300 text-sm">{showCompleteModal.title}</p>
              {showCompleteModal.vendorName && <p className="text-xs text-green-600 dark:text-green-400">Completed by: {showCompleteModal.vendorName}</p>}
            </div>
            <Input label="Actual Cost (UGX)" type="number" placeholder="Enter the final cost" value={actualCost} onChange={e => setActualCost(e.target.value)} />
            <Textarea label="Completion Notes" placeholder="Describe what was done..." value={completionNotes} onChange={e => setCompletionNotes(e.target.value)} rows={3} />
          </div>
        )}
      </Modal>

      {/* ── Pay Vendor Modal ──────────────────────────────────────────── */}
      <Modal
        open={!!showPayVendorModal}
        onClose={vendorAwaitingPin ? undefined : () => { setShowPayVendorModal(null); setVendorPhone(''); setVendorAwaitingPin(false); }}
        title="Pay Vendor"
        size="sm"
        footer={
          vendorAwaitingPin ? (
            <div className="w-full flex flex-col items-center gap-2 py-1">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Waiting for PIN confirmation...</span>
              </div>
              {vendorPayTimedOut && (
                <Button size="sm" variant="secondary" onClick={() => { setVendorAwaitingPin(false); setVendorPayTimedOut(false); }}>
                  Try Again
                </Button>
              )}
            </div>
          ) : (
            <>
              <Button variant="secondary" onClick={() => { setShowPayVendorModal(null); setVendorPhone(''); }}>
                Skip (Pay Later)
              </Button>
              <Button loading={vendorPayLoading} onClick={handlePayVendor} icon={<DollarSign size={14} />}>
                Pay {showPayVendorModal ? formatCurrency(showPayVendorModal.amount) : ''}
              </Button>
            </>
          )
        }
      >
        {showPayVendorModal && (
          <div className="space-y-4">
            {/* Awaiting PIN */}
            {vendorAwaitingPin && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-3 p-5 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700 rounded-2xl text-center">
                <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                <div>
                  <p className="font-bold text-primary-800 dark:text-primary-300">Sending payment...</p>
                  <p className="text-sm text-primary-600 dark:text-primary-400 mt-1">
                    {vendorPayMethod === 'mtn_momo' ? 'MTN MoMo' : 'Airtel Money'} prompt sent to <strong>{vendorPhone}</strong>.
                  </p>
                  <p className="text-sm text-primary-600 dark:text-primary-400 mt-1">
                    The vendor must accept <strong>{formatCurrency(showPayVendorModal.amount)}</strong> on their phone.
                  </p>
                  <p className="text-xs text-slate-400 mt-2">ref: {vendorPayRef}</p>
                </div>
              </motion.div>
            )}

            {!vendorAwaitingPin && (
              <>
                {/* Summary */}
                <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-700 rounded-xl p-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={showPayVendorModal.vendorName} size="md" />
                    <div>
                      <p className="font-bold text-slate-900 dark:text-slate-100">{showPayVendorModal.vendorName}</p>
                      <p className="text-xs text-slate-500">{showPayVendorModal.description}</p>
                    </div>
                  </div>
                  <p className="text-2xl font-bold text-green-600 mt-3">{formatCurrency(showPayVendorModal.amount)}</p>
                  <p className="text-xs text-slate-400">Job payment · {showPayVendorModal.propertyTitle}</p>
                </div>

                {/* Method */}
                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Send via</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'mtn_momo' as const,    label: 'MTN MoMo',    color: 'bg-yellow-400' },
                      { value: 'airtel_money' as const, label: 'Airtel Money', color: 'bg-red-500' },
                      { value: 'cash' as const,         label: 'Cash',         color: 'bg-green-600' },
                    ].map(m => (
                      <button key={m.value} onClick={() => setVendorPayMethod(m.value)}
                        className={`p-3 rounded-xl border-2 text-center transition-all ${vendorPayMethod === m.value ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-600'}`}>
                        <div className={`w-7 h-7 ${m.color} rounded-full mx-auto mb-1`} />
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{m.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                {(vendorPayMethod === 'mtn_momo' || vendorPayMethod === 'airtel_money') && (
                <Input
                  label="Vendor's Phone Number"
                  type="tel"
                  placeholder="07XX XXX XXX"
                  value={vendorPhone}
                  onChange={e => setVendorPhone(e.target.value)}
                  icon={<Smartphone size={15} />}
                  hint="The vendor will receive a mobile money credit on this number"
                />
                )}

                {vendorPayMethod === 'cash' && (
                  <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-xs text-green-700 dark:text-green-400">
                    💵 Cash payment will be recorded immediately as completed. No phone number needed.
                  </div>
                )}

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-xs text-blue-700 dark:text-blue-400">
                  💡 The vendor's phone number is pre-filled from their profile if available. Payment goes directly to their mobile money wallet.
                </div>
              </>
            )}
          </div>
        )}
      </Modal>

      {/* ── Rate Vendor Modal ─────────────────────────────────────────── */}
      <Modal open={!!showRateModal} onClose={() => setShowRateModal(null)} title="Rate Vendor"
        footer={<><Button variant="secondary" onClick={() => setShowRateModal(null)}>Skip</Button><Button onClick={handleRate} icon={<Star size={14} />}>Submit Rating</Button></>}>
        {showRateModal && (
          <div className="space-y-4">
            <div className="text-center py-2">
              <Avatar name={showRateModal.vendorName} size="xl" className="mx-auto mb-3" />
              <p className="font-bold text-slate-900 dark:text-slate-100">{showRateModal.vendorName}</p>
              <p className="text-sm text-slate-400">How was the service?</p>
            </div>
            {/* Star selector */}
            <div className="flex items-center justify-center gap-2">
              {[1, 2, 3, 4, 5].map(s => (
                <button key={s} onClick={() => setRatingValue(s)}
                  className="transition-transform hover:scale-125">
                  <Star size={32} className={s <= ratingValue ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-600'} />
                </button>
              ))}
            </div>
            <p className="text-center text-sm font-medium text-slate-600 dark:text-slate-400">
              {['', 'Poor', 'Fair', 'Good', 'Very Good', 'Excellent'][ratingValue]}
            </p>
            <Textarea label="Comment (optional)" placeholder="Tell us about your experience..." value={ratingComment} onChange={e => setRatingComment(e.target.value)} rows={3} />
          </div>
        )}
      </Modal>

      {/* ── Revert / Cancel Confirmation Modal ───────────────────────── */}
      <Modal
        open={!!showRevertModal}
        onClose={() => setShowRevertModal(null)}
        title={showRevertModal?.targetStatus === 'cancelled' ? 'Cancel Request?' : 'Revert Status?'}
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setShowRevertModal(null)}>Keep Current</Button>
            <Button
              variant={showRevertModal?.targetStatus === 'cancelled' ? 'danger' : 'secondary'}
              icon={showRevertModal?.targetStatus === 'cancelled' ? <XCircle size={14} /> : <RotateCcw size={14} />}
              onClick={handleRevert}
            >
              {showRevertModal?.targetStatus === 'cancelled' ? 'Yes, Cancel' : `Revert to ${showRevertModal?.label}`}
            </Button>
          </>
        }
      >
        {showRevertModal && (
          <div className="space-y-3">
            <div className={`p-3 rounded-xl border ${showRevertModal.targetStatus === 'cancelled' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'}`}>
              <p className={`text-sm font-semibold ${showRevertModal.targetStatus === 'cancelled' ? 'text-red-800 dark:text-red-300' : 'text-amber-800 dark:text-amber-300'}`}>
                {showRevertModal.targetStatus === 'cancelled'
                  ? '⚠️ This will cancel the maintenance request.'
                  : `↩️ This will move the request back to "${showRevertModal.label}".`}
              </p>
              <p className={`text-xs mt-1 ${showRevertModal.targetStatus === 'cancelled' ? 'text-red-600 dark:text-red-400' : 'text-amber-600 dark:text-amber-400'}`}>
                {showRevertModal.targetStatus === 'cancelled'
                  ? 'The vendor will be notified. You can reopen it later if needed.'
                  : 'You can always move it forward again. No data will be lost.'}
              </p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{showRevertModal.request.title}</p>
              <p className="text-xs text-slate-400 mt-0.5">{showRevertModal.request.propertyTitle}</p>
              <div className="flex items-center gap-2 mt-1.5">
                <Badge variant={statusVariant(showRevertModal.request.status)}>
                  {maintenanceStatusConfig[showRevertModal.request.status]?.label}
                </Badge>
                <span className="text-xs text-slate-400">→</span>
                <Badge variant={statusVariant(showRevertModal.targetStatus)}>
                  {showRevertModal.label}
                </Badge>
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
