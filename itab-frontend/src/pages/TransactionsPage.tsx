/**
 * Unified Transactions Page — shows every money movement with sender → receiver.
 * Visible to: Admin (all), Manager (their properties), Landlord (their payouts),
 *             Tenant (their payments), Vendor (their earnings).
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  ArrowRight, Download, TrendingUp, DollarSign,
  Building2, Wrench, Receipt, X, Info, RefreshCw, RotateCcw,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { StatCard } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { Avatar } from '../components/ui/Avatar';
import { Select } from '../components/ui/Input';
import { useAuthStore } from '../store/authStore';
import { usePaymentStore } from '../store/paymentStore';
import { useUserStore } from '../store/userStore';
import { formatCurrency, formatDate } from '../lib/utils';
import { downloadCSV } from '../lib/download';
import toast from 'react-hot-toast';
import type { PlatformTransaction, TransactionType } from '../types';

// ─── Transaction type config ──────────────────────────────────────────────────
const txTypeConfig: Record<TransactionType, { label: string; icon: React.ReactNode; color: string }> = {
  rent_payment:          { label: 'Rent Payment',       icon: <Building2 size={14} />,  color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' },
  inspection_fee:        { label: 'Inspection Fee',     icon: <Receipt size={14} />,    color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600' },
  deposit_payment:       { label: 'Deposit',            icon: <DollarSign size={14} />, color: 'bg-green-100 dark:bg-green-900/30 text-green-600' },
  landlord_payout:       { label: 'Landlord Payout',    icon: <TrendingUp size={14} />, color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' },
  management_fee_payout: { label: 'Management Fee',     icon: <DollarSign size={14} />, color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600' },
  platform_fee:          { label: 'Platform Fee',       icon: <Receipt size={14} />,    color: 'bg-slate-100 dark:bg-slate-700 text-slate-600' },
  vendor_payment:        { label: 'Vendor Payment',     icon: <Wrench size={14} />,     color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' },
  vendor_contract:       { label: 'Contract Payment',   icon: <Wrench size={14} />,     color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600' },
  late_fee:              { label: 'Late Fee',            icon: <Receipt size={14} />,    color: 'bg-red-100 dark:bg-red-900/30 text-red-600' },
  refund:                { label: 'Refund',              icon: <ArrowRight size={14} />, color: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600' },
};

// ─── Transaction row ──────────────────────────────────────────────────────────
function TransactionRow({ tx, currentUserId, isAdmin }: { tx: PlatformTransaction; currentUserId: string; isAdmin: boolean }) {
  const [expanded, setExpanded] = useState(false);
  const { retryTransaction, refundTransaction } = usePaymentStore();
  const { addAuditLog } = useUserStore();
  const cfg = txTypeConfig[tx.type];
  const isReceiving = tx.receiverId === currentUserId;
  const isSending = tx.senderId === currentUserId;

  const handleRetry = () => {
    retryTransaction(tx.id);
    addAuditLog({
      action: 'transaction_retried',
      performedBy: currentUserId,
      performedByName: 'Admin',
      performedByRole: 'admin',
      targetId: tx.id,
      targetName: tx.reference,
      description: `Retried failed transaction ${tx.reference} (${formatCurrency(tx.amount)})`,
    });
    toast.success(`Transaction ${tx.reference} retried successfully`);
  };

  const handleRefund = () => {
    refundTransaction(tx.id);
    addAuditLog({
      action: 'transaction_refunded',
      performedBy: currentUserId,
      performedByName: 'Admin',
      performedByRole: 'admin',
      targetId: tx.id,
      targetName: tx.reference,
      description: `Refunded transaction ${tx.reference} (${formatCurrency(tx.amount)}) to ${tx.senderName}`,
    });
    toast.success(`Refund of ${formatCurrency(tx.amount)} issued to ${tx.senderName}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden"
    >
      <div className="flex items-center gap-4 p-4 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
        onClick={() => setExpanded(!expanded)}>
        {/* Type icon */}
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.color}`}>
          {cfg.icon}
        </div>

        {/* Sender → Receiver */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[120px]">
              {tx.senderName}
            </span>
            <ArrowRight size={14} className="text-slate-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate max-w-[120px]">
              {tx.receiverName}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            <Badge variant="gray" className="text-xs">{cfg.label}</Badge>
            {tx.propertyTitle && <span className="text-xs text-slate-400 truncate max-w-[160px]">{tx.propertyTitle}</span>}
          </div>
        </div>

        {/* Amount + direction indicator */}
        <div className="text-right flex-shrink-0">
          <p className={`text-base font-bold ${isReceiving ? 'text-green-600' : isSending ? 'text-red-500' : 'text-slate-900 dark:text-slate-100'}`}>
            {isReceiving ? '+' : isSending ? '-' : ''}{formatCurrency(tx.amount)}
          </p>
          <p className="text-xs text-slate-400">{formatDate(tx.createdAt)}</p>
          <Badge variant={tx.status === 'completed' ? 'green' : tx.status === 'failed' ? 'red' : tx.status === 'refunded' ? 'purple' : 'yellow'} className="mt-0.5">
            {tx.status}
          </Badge>
          {/* Admin actions for failed transactions */}
          {isAdmin && tx.status === 'failed' && (
            <div className="flex gap-1 mt-1 justify-end">
              <button onClick={e => { e.stopPropagation(); handleRetry(); }}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 text-xs font-medium hover:bg-blue-200 transition-colors">
                <RefreshCw size={10} /> Retry
              </button>
              <button onClick={e => { e.stopPropagation(); handleRefund(); }}
                className="flex items-center gap-1 px-2 py-1 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 text-xs font-medium hover:bg-purple-200 transition-colors">
                <RotateCcw size={10} /> Refund
              </button>
            </div>
          )}
          {/* Admin can also refund completed transactions */}
          {isAdmin && tx.status === 'completed' && (
            <button onClick={e => { e.stopPropagation(); handleRefund(); }}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-400 text-xs font-medium hover:bg-slate-200 transition-colors mt-1">
              <RotateCcw size={10} /> Refund
            </button>
          )}
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
          className="border-t border-slate-100 dark:border-slate-700 px-4 pb-4 pt-3 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {/* Sender */}
            <div className="p-3 bg-red-50 dark:bg-red-900/10 rounded-xl">
              <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1.5">📤 Sender</p>
              <div className="flex items-center gap-2">
                <Avatar name={tx.senderName} size="xs" />
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{tx.senderName}</p>
                  <p className="text-xs text-slate-400 capitalize">{tx.senderRole.replace('_', ' ')}</p>
                  {tx.senderPhone && <p className="text-xs text-slate-400">{tx.senderPhone}</p>}
                  <p className="text-xs text-slate-400 capitalize">via {tx.senderMethod.replace('_', ' ')}</p>
                </div>
              </div>
            </div>
            {/* Receiver */}
            <div className="p-3 bg-green-50 dark:bg-green-900/10 rounded-xl">
              <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1.5">📥 Receiver</p>
              <div className="flex items-center gap-2">
                <Avatar name={tx.receiverName} size="xs" />
                <div>
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{tx.receiverName}</p>
                  <p className="text-xs text-slate-400 capitalize">{tx.receiverRole.replace('_', ' ')}</p>
                  {tx.receiverPhone && <p className="text-xs text-slate-400">{tx.receiverPhone}</p>}
                  <p className="text-xs text-slate-400 capitalize">via {tx.receiverMethod.replace('_', ' ')}</p>
                  {tx.receiverBankDetails?.bankName && (
                    <p className="text-xs text-slate-400">{tx.receiverBankDetails.bankName} · {tx.receiverBankDetails.accountNumber}</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Details */}
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 space-y-1.5 text-xs">
            <div className="flex justify-between"><span className="text-slate-500">Reference</span><span className="font-mono text-slate-700 dark:text-slate-300">{tx.reference}</span></div>
            <div className="flex justify-between"><span className="text-slate-500">Amount</span><span className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(tx.amount)}</span></div>
            {tx.inspectionCreditApplied && <div className="flex justify-between text-green-600"><span>Inspection credit</span><span>-{formatCurrency(tx.inspectionCreditApplied)}</span></div>}
            {tx.rentPeriod && <div className="flex justify-between"><span className="text-slate-500">Rent period</span><span>{tx.rentPeriod}</span></div>}
            <div className="flex justify-between"><span className="text-slate-500">Description</span><span className="text-right max-w-[200px]">{tx.description}</span></div>
            {tx.processedAt && <div className="flex justify-between"><span className="text-slate-500">Processed</span><span>{formatDate(tx.processedAt)}</span></div>}
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function TransactionsPage() {
  const { user } = useAuthStore();
  const { transactions, getPlatformRevenue, getTransactionsByUser } = usePaymentStore();
  const isAdminUser = user?.role === 'admin';
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Filter transactions relevant to this user
  const myTxs = user?.role === 'admin'
    ? transactions
    : getTransactionsByUser(user?.id || '');

  const filtered = myTxs.filter(t => {
    const matchType = !filterType || t.type === filterType;
    const matchStatus = !filterStatus || t.status === filterStatus;
    return matchType && matchStatus;
  });

  // Stats
  const totalReceived = myTxs.filter(t => t.receiverId === user?.id && t.status === 'completed').reduce((s, t) => s + t.amount, 0);
  const totalSent = myTxs.filter(t => t.senderId === user?.id && t.status === 'completed').reduce((s, t) => s + t.amount, 0);
  const platformRevenue = getPlatformRevenue();

  const handleExport = () => {
    downloadCSV(filtered.map(t => ({
      'Reference': t.reference,
      'Type': txTypeConfig[t.type]?.label || t.type,
      'Sender': t.senderName,
      'Sender Role': t.senderRole,
      'Sender Method': t.senderMethod,
      'Receiver': t.receiverName,
      'Receiver Role': t.receiverRole,
      'Receiver Method': t.receiverMethod,
      'Amount (UGX)': t.amount,
      'Status': t.status,
      'Property': t.propertyTitle || '',
      'Description': t.description,
      'Date': t.createdAt,
    })), `transactions-${new Date().toISOString().split('T')[0]}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Transactions</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {filtered.length} transaction{filtered.length !== 1 ? 's' : ''} · every payment has a sender and a receiver
          </p>
        </div>
        <Button variant="secondary" icon={<Download size={15} />} onClick={handleExport}>Export CSV</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        {user?.role !== 'admin' && (
          <>
            <StatCard title="Total Received" value={formatCurrency(totalReceived)}
              icon={<TrendingUp className="w-6 h-6 text-green-600" />} iconBg="bg-green-100 dark:bg-green-900/30" />
            <StatCard title="Total Sent" value={formatCurrency(totalSent)}
              icon={<ArrowRight className="w-6 h-6 text-red-500" />} iconBg="bg-red-100 dark:bg-red-900/30" />
          </>
        )}
        {user?.role === 'admin' && (
          <>
            <StatCard title="Platform Revenue" value={formatCurrency(platformRevenue)}
              subtitle="ITAB fees collected"
              icon={<DollarSign className="w-6 h-6 text-primary-600" />} iconBg="bg-primary-100 dark:bg-primary-900/30" />
            <StatCard title="Total Transactions" value={transactions.length}
              icon={<Receipt className="w-6 h-6 text-purple-600" />} iconBg="bg-purple-100 dark:bg-purple-900/30" />
          </>
        )}
        <StatCard title="This Month" value={formatCurrency(
          myTxs.filter(t => {
            const d = new Date(t.createdAt);
            const now = new Date();
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && t.status === 'completed';
          }).reduce((s, t) => s + t.amount, 0)
        )} icon={<TrendingUp className="w-6 h-6 text-blue-600" />} iconBg="bg-blue-100 dark:bg-blue-900/30" />
      </div>

      {/* Info banner */}
      <div className="flex items-start gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl">
        <Info size={16} className="text-blue-600 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-blue-700 dark:text-blue-300">
          Every transaction shows exactly who sent money and who received it. Click any transaction to see full details including payment method and bank/mobile money details.
        </p>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-4">
        <div className="flex gap-3 flex-wrap">
          <Select value={filterType} onChange={e => setFilterType(e.target.value)}
            options={[
              { value: '', label: 'All Types' },
              { value: 'rent_payment', label: 'Rent Payments' },
              { value: 'inspection_fee', label: 'Inspection Fees' },
              { value: 'landlord_payout', label: 'Landlord Payouts' },
              { value: 'management_fee_payout', label: 'Management Fees' },
              { value: 'platform_fee', label: 'Platform Fees' },
              { value: 'vendor_payment', label: 'Vendor Payments' },
              { value: 'vendor_contract', label: 'Contract Payments' },
            ]} />
          <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            options={[{ value: '', label: 'All Status' }, { value: 'completed', label: 'Completed' }, { value: 'pending', label: 'Pending' }, { value: 'failed', label: 'Failed' }, { value: 'refunded', label: 'Refunded' }]} />
          {(filterType || filterStatus) && (
            <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={() => { setFilterType(''); setFilterStatus(''); }}>Clear</Button>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-2">{filtered.length} results</p>
      </div>

      {/* Transaction list */}
      {filtered.length === 0 ? (
        <EmptyState icon={<Receipt size={28} />} title="No transactions yet"
          description="All money movements through ITAB will appear here with full sender and receiver details." />
      ) : (
        <div className="space-y-2">
          {filtered.map((tx, i) => (
            <motion.div key={tx.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}>
              <TransactionRow tx={tx} currentUserId={user?.id || ''} isAdmin={isAdminUser} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
