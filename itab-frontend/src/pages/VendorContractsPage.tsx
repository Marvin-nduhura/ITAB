import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Plus, Play, Pause, X, DollarSign, CheckCircle2, RefreshCw } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input, Select, Textarea } from '../components/ui/Input';
import { StatCard } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Avatar } from '../components/ui/Avatar';
import { useAuthStore } from '../store/authStore';
import { useVendorStore } from '../store/vendorStore';
import { usePaymentStore } from '../store/paymentStore';
import { usePropertyStore } from '../store/propertyStore';
import { formatCurrency, formatDate } from '../lib/utils';
import type { ContractType } from '../types';
import toast from 'react-hot-toast';

const contractTypeLabels: Record<ContractType, string> = {
  monthly_retainer: 'Monthly Retainer',
  per_job: 'Per Job',
  annual: 'Annual Contract',
};

const contractTypeDesc: Record<ContractType, string> = {
  monthly_retainer: 'Fixed monthly payment regardless of jobs done',
  per_job: 'Payment per completed job',
  annual: 'Annual lump sum or installment contract',
};

export function VendorContractsPage() {
  const { user } = useAuthStore();
  const { vendors } = useVendorStore();
  const { contracts, createContract, updateContract, cancelContract, processContractPayment } = usePaymentStore();
  const { properties } = usePropertyStore();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    vendorId: '',
    propertyId: '',
    type: 'monthly_retainer' as ContractType,
    description: '',
    amount: '',
    startDate: '',
    endDate: '',
    paymentMethod: 'mtn_momo',
  });
  const [loading, setLoading] = useState(false);

  const canManage = user && ['admin', 'property_manager'].includes(user.role);

  // Filter contracts relevant to this user
  const myContracts = user?.role === 'admin'
    ? contracts
    : user?.role === 'property_manager'
      ? contracts.filter(c => c.managerId === user.id)
      : user?.role === 'vendor'
        ? contracts.filter(c => c.vendorId === vendors.find(v => v.email === user.email || v.userId === user.id)?.id)
        : contracts;

  const activeContracts = myContracts.filter(c => c.status === 'active');
  const totalMonthlyValue = activeContracts.filter(c => c.type === 'monthly_retainer').reduce((s, c) => s + c.amount, 0);
  const totalPaid = myContracts.reduce((s, c) => s + c.totalPaid, 0);

  const handleCreate = async () => {
    if (!form.vendorId || !form.propertyId || !form.amount || !form.description) {
      toast.error('Please fill all required fields');
      return;
    }
    const vendor = vendors.find(v => v.id === form.vendorId);
    const property = properties.find(p => p.id === form.propertyId);
    if (!vendor || !property) return;

    setLoading(true);
    createContract({
      vendorId: vendor.id,
      vendorName: `${vendor.firstName} ${vendor.lastName}`,
      propertyId: property.id,
      propertyTitle: property.title,
      managerId: user?.id || '',
      type: form.type,
      description: form.description,
      amount: Number(form.amount),
      currency: 'UGX',
      startDate: form.startDate || new Date().toISOString().split('T')[0],
      endDate: form.endDate || undefined,
      status: 'active',
      paymentMethod: form.paymentMethod as 'mtn_momo' | 'airtel_money' | 'bank',
      nextPaymentDate: form.type === 'monthly_retainer'
        ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
        : undefined,
    });
    setLoading(false);
    setShowCreateModal(false);
    setForm({ vendorId: '', propertyId: '', type: 'monthly_retainer', description: '', amount: '', startDate: '', endDate: '', paymentMethod: 'mtn_momo' });
    toast.success(`Contract created with ${vendor.firstName}!`);
  };

  const handleProcessPayment = async (contractId: string) => {
    setPayingId(contractId);
    const tx = processContractPayment(contractId);
    setPayingId(null);
    if (tx) {
      toast.success(`Payment of ${formatCurrency(tx.amount)} sent to ${tx.receiverName} via ${tx.receiverMethod.replace('_', ' ')}!`);
    }
  };

  const statusVariant = (s: string): 'green' | 'yellow' | 'gray' | 'red' => {
    const m: Record<string, 'green' | 'yellow' | 'gray' | 'red'> = { active: 'green', paused: 'yellow', completed: 'gray', cancelled: 'red' };
    return m[s] || 'gray';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Vendor Contracts</h1>
          <p className="text-sm text-slate-500 mt-0.5">{activeContracts.length} active · {myContracts.length} total</p>
        </div>
        {canManage && (
          <Button icon={<Plus size={16} />} onClick={() => setShowCreateModal(true)}>New Contract</Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Active Contracts" value={activeContracts.length}
          icon={<FileText className="w-6 h-6 text-primary-600" />} iconBg="bg-primary-100 dark:bg-primary-900/30" />
        <StatCard title="Monthly Retainer Value" value={formatCurrency(totalMonthlyValue)}
          subtitle="Per month"
          icon={<RefreshCw className="w-6 h-6 text-blue-600" />} iconBg="bg-blue-100 dark:bg-blue-900/30" />
        <StatCard title="Total Paid Out" value={formatCurrency(totalPaid)}
          icon={<CheckCircle2 className="w-6 h-6 text-green-600" />} iconBg="bg-green-100 dark:bg-green-900/30" />
      </div>

      {/* Contract list */}
      {myContracts.length === 0 ? (
        <EmptyState icon={<FileText size={28} />} title="No contracts yet"
          description="Create contracts with vendors for recurring services like cleaning, security, or gardening."
          action={canManage ? <Button onClick={() => setShowCreateModal(true)} icon={<Plus size={14} />}>Create Contract</Button> : undefined} />
      ) : (
        <div className="space-y-3">
          {myContracts.map((c, i) => {
            const vendor = vendors.find(v => v.id === c.vendorId);
            return (
              <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5">
                <div className="flex items-start gap-4">
                  {vendor && <Avatar name={`${vendor.firstName} ${vendor.lastName}`} size="md" className="flex-shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div>
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{c.vendorName}</h3>
                        <p className="text-xs text-slate-400">{c.propertyTitle}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <Badge variant={statusVariant(c.status)}>{c.status}</Badge>
                        <Badge variant="blue">{contractTypeLabels[c.type]}</Badge>
                      </div>
                    </div>

                    <p className="text-sm text-slate-600 dark:text-slate-400 mt-2">{c.description}</p>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                      <div>
                        <p className="text-xs text-slate-400">Amount</p>
                        <p className="text-sm font-bold text-primary-600">{formatCurrency(c.amount)}</p>
                        <p className="text-xs text-slate-400">{c.type === 'monthly_retainer' ? '/month' : c.type === 'annual' ? '/year' : '/job'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Total Paid</p>
                        <p className="text-sm font-semibold text-green-600">{formatCurrency(c.totalPaid)}</p>
                        <p className="text-xs text-slate-400">{c.paymentsCount} payments</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Start Date</p>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatDate(c.startDate)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Payment via</p>
                        <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 capitalize">{c.paymentMethod.replace('_', ' ')}</p>
                      </div>
                    </div>

                    {c.nextPaymentDate && c.status === 'active' && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                        📅 Next payment due: {formatDate(c.nextPaymentDate)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Actions */}
                {canManage && c.status === 'active' && (
                  <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex-wrap">
                    <Button size="sm" loading={payingId === c.id} icon={<DollarSign size={13} />}
                      onClick={() => handleProcessPayment(c.id)}>
                      Pay Now
                    </Button>
                    <Button size="sm" variant="secondary" icon={<Pause size={13} />}
                      onClick={() => { updateContract(c.id, { status: 'paused' }); toast('Contract paused'); }}>
                      Pause
                    </Button>
                    <Button size="sm" variant="danger" icon={<X size={13} />}
                      onClick={() => { cancelContract(c.id); toast('Contract cancelled'); }}>
                      Cancel
                    </Button>
                  </div>
                )}
                {canManage && c.status === 'paused' && (
                  <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                    <Button size="sm" variant="secondary" icon={<Play size={13} />}
                      onClick={() => { updateContract(c.id, { status: 'active' }); toast.success('Contract resumed'); }}>
                      Resume
                    </Button>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Create Contract Modal */}
      <Modal open={showCreateModal} onClose={() => setShowCreateModal(false)} title="Create Vendor Contract" size="lg"
        footer={<><Button variant="secondary" onClick={() => setShowCreateModal(false)}>Cancel</Button><Button loading={loading} onClick={handleCreate} icon={<FileText size={14} />}>Create Contract</Button></>}>
        <div className="space-y-4">
          {/* Vendor selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Select Vendor *</label>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {vendors.filter(v => v.isActive && !v.isSuspended).map(v => (
                <button key={v.id} onClick={() => setForm(f => ({ ...f, vendorId: v.id }))}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 text-left transition-all ${form.vendorId === v.id ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'}`}>
                  <Avatar name={`${v.firstName} ${v.lastName}`} size="sm" />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{v.firstName} {v.lastName}</p>
                    <p className="text-xs text-slate-400 capitalize">{v.category.replace('_', ' ')} · {v.district}</p>
                  </div>
                  {form.vendorId === v.id && <CheckCircle2 size={16} className="ml-auto text-primary-600" />}
                </button>
              ))}
            </div>
          </div>

          {/* Property selector */}
          <Select label="Property *" value={form.propertyId} onChange={e => setForm(f => ({ ...f, propertyId: e.target.value }))}
            options={[{ value: '', label: 'Select property...' }, ...properties.filter(p => p.status !== 'rejected').map(p => ({ value: p.id, label: p.title }))]} />

          {/* Contract type */}
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Contract Type *</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.entries(contractTypeLabels) as [ContractType, string][]).map(([type, label]) => (
                <button key={type} onClick={() => setForm(f => ({ ...f, type }))}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${form.type === type ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-600'}`}>
                  <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{contractTypeDesc[type]}</p>
                </button>
              ))}
            </div>
          </div>

          <Textarea label="Description *" placeholder="e.g. Monthly compound cleaning and grass cutting"
            value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} />

          <div className="grid grid-cols-2 gap-3">
            <Input label={`Amount (UGX) *`} type="number" placeholder="e.g. 150000"
              value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
              hint={form.type === 'monthly_retainer' ? 'Per month' : form.type === 'annual' ? 'Per year' : 'Per job'} />
            <Select label="Payment Method" value={form.paymentMethod} onChange={e => setForm(f => ({ ...f, paymentMethod: e.target.value }))}
              options={[{ value: 'mtn_momo', label: 'MTN MoMo' }, { value: 'airtel_money', label: 'Airtel Money' }, { value: 'bank', label: 'Bank Transfer' }]} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Input label="Start Date" type="date" value={form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value }))} />
            <Input label="End Date (optional)" type="date" value={form.endDate} onChange={e => setForm(f => ({ ...f, endDate: e.target.value }))} hint="Leave blank for open-ended" />
          </div>
        </div>
      </Modal>
    </div>
  );
}
