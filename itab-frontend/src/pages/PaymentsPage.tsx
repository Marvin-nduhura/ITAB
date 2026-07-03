import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard, Download, TrendingUp, Receipt,
  AlertCircle, CheckCircle2, Clock, ChevronDown, ChevronUp,
  Banknote, Smartphone, Plus, Info,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input, Select } from '../components/ui/Input';
import { StatCard } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuthStore } from '../store/authStore';
import { useDataStore } from '../store/dataStore';
import { usePropertyStore } from '../store/propertyStore';
import { formatCurrency, formatDate } from '../lib/utils';
import { downloadPaymentsCSV, downloadReceipt } from '../lib/download';
import { filterPaymentsForUser } from '../lib/rbac';
import type { RentBalance, PaymentMethod } from '../types';
import toast from 'react-hot-toast';

// ─── Partial payment progress bar ────────────────────────────────────────────
function RentProgressBar({ balance }: { balance: RentBalance }) {
  const pct = Math.min(100, Math.round((balance.totalPaid / balance.totalDue) * 100));
  const isOverdue = !balance.isFullyPaid && new Date(balance.dueDate) < new Date();

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500 dark:text-slate-400">
          Paid: <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(balance.totalPaid)}</span>
        </span>
        <span className={`font-semibold ${balance.isFullyPaid ? 'text-green-600' : isOverdue ? 'text-red-500' : 'text-amber-600'}`}>
          {balance.isFullyPaid ? '✓ Fully paid' : `${formatCurrency(balance.balance)} remaining`}
        </span>
      </div>
      <div className="h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className={`h-full rounded-full ${balance.isFullyPaid ? 'bg-green-500' : isOverdue ? 'bg-red-400' : 'bg-amber-400'}`}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-slate-400">
        <span>{pct}% paid</span>
        <span>Total: {formatCurrency(balance.totalDue)}</span>
      </div>
    </div>
  );
}

// ─── Pay Rent Modal ───────────────────────────────────────────────────────────
interface PayRentModalProps {
  open: boolean;
  onClose: () => void;
  balance: RentBalance | null;
}

function PayRentModal({ open, onClose, balance }: PayRentModalProps) {
  const [payMethod, setPayMethod] = useState<PaymentMethod>('mtn_momo');
  const [phone, setPhone] = useState('');
  const [amountInput, setAmountInput] = useState('');
  const [payMode, setPayMode] = useState<'full' | 'partial' | 'advance'>('full');
  const [advanceMonths, setAdvanceMonths] = useState(2);
  const [loading, setLoading] = useState(false);
  const [awaitingPin, setAwaitingPin] = useState(false);
  const [payRef, setPayRef] = useState('');
  const [pinTimeout, setPinTimeout] = useState(false);

  if (!balance) return null;

  const remaining = balance.balance;
  const monthlyRent = balance.totalDue;

  // Advance payment: discount tiers
  const advanceDiscounts: Record<number, number> = { 2: 0, 3: 2, 6: 5, 12: 10 };
  const advanceDiscount = advanceDiscounts[advanceMonths] ?? 0;
  const advanceTotal = Math.round(monthlyRent * advanceMonths * (1 - advanceDiscount / 100));
  const advanceSaving = Math.round(monthlyRent * advanceMonths) - advanceTotal;

  // Months covered by advance payment
  const getAdvanceMonths = () => {
    const months: string[] = [];
    const base = new Date(balance.rentPeriod + '-01');
    // Start from next unpaid month
    for (let i = 0; i < advanceMonths; i++) {
      const d = new Date(base);
      d.setMonth(d.getMonth() + i + (balance.isFullyPaid ? 1 : 0));
      months.push(d.toLocaleDateString('en-UG', { month: 'long', year: 'numeric' }));
    }
    return months;
  };

  const amountToPay = payMode === 'full'
    ? remaining
    : payMode === 'advance'
      ? advanceTotal
      : Math.min(Number(amountInput) || 0, remaining);

  const isValid = amountToPay > 0;
  const isPartialPayment = payMode === 'partial' && amountToPay < remaining;

  const handlePay = async () => {
    if (!isValid) { toast.error('Enter a valid amount'); return; }
    if ((payMethod === 'mtn_momo' || payMethod === 'airtel_money') && !phone) {
      toast.error('Enter your phone number to receive the PIN prompt'); return;
    }
    setLoading(true);
    try {
      const { paymentsApi } = await import('../lib/api');
      const ref = `${payMethod === 'mtn_momo' ? 'MTN' : payMethod === 'airtel_money' ? 'AIR' : payMethod === 'cash' ? 'CASH' : 'CARD'}-${Date.now()}`;

      // Cash — record directly as completed, no PIN/USSD needed
      if (payMethod === 'cash') {
        const rentPeriodStr = payMode === 'advance'
          ? (() => {
              const months = getAdvanceMonths();
              return months.length > 1 ? `${months[0]} – ${months[months.length - 1]}` : balance.rentPeriod;
            })()
          : balance.rentPeriod;
        await paymentsApi.payRent({
          propertyId: balance.propertyId,
          propertyTitle: balance.propertyTitle,
          amount: amountToPay,
          method: 'cash',
          reference: ref,
          rentPeriod: rentPeriodStr,
          isPartial: isPartialPayment,
          status: 'completed',
        });
        setLoading(false);
        onClose();
        const pLabel = balance.rentPeriod
          ? new Date(balance.rentPeriod + '-01').toLocaleDateString('en-UG', { month: 'long', year: 'numeric' })
          : balance.rentPeriod;
        if (payMode === 'advance') {
          const months = getAdvanceMonths();
          const range = months.length > 1 ? `${months[0]} – ${months[months.length - 1]}` : months[0];
          toast.success(`✅ Cash payment of ${formatCurrency(amountToPay)} recorded for ${range}!`);
        } else {
          toast.success(`✅ Cash payment of ${formatCurrency(amountToPay)} recorded for ${pLabel}!`);
        }
        return;
      }

      if (payMethod === 'mtn_momo') {
        await paymentsApi.initMTN({ amount: amountToPay, phone, type: 'rent', propertyId: balance.propertyId, reference: ref });
      } else if (payMethod === 'airtel_money') {
        await paymentsApi.initAirtel({ amount: amountToPay, phone, type: 'rent', propertyId: balance.propertyId, reference: ref });
      }

      if (payMethod === 'mtn_momo' || payMethod === 'airtel_money') {
        // Build rent period string: for advance, show "2024-07 to 2024-09" range
        const rentPeriodStr = payMode === 'advance'
          ? (() => {
              const months = getAdvanceMonths();
              if (months.length <= 1) return balance.rentPeriod;
              // Store as human label so it's readable everywhere
              return `${months[0]} – ${months[months.length - 1]}`;
            })()
          : balance.rentPeriod;

        // Record payment as pending — callback will update to completed
        await paymentsApi.payRent({
          propertyId: balance.propertyId,
          propertyTitle: balance.propertyTitle,
          amount: amountToPay,
          method: payMethod,
          reference: ref,
          rentPeriod: rentPeriodStr,
          isPartial: isPartialPayment,
          status: 'pending',
        });
        setLoading(false);
        setPayRef(ref);
        setAwaitingPin(true);
        setPinTimeout(false);

        // Poll for payment confirmation from mobile money callback
        const result = await paymentsApi.pollStatus(ref, { intervalMs: 3000, maxAttempts: 20 });
        setAwaitingPin(false);
        if (result.status === 'completed') {
          onClose();
          // Build human-readable period label
          const pLabel = balance.rentPeriod
            ? new Date(balance.rentPeriod + '-01').toLocaleDateString('en-UG', { month: 'long', year: 'numeric' })
            : balance.rentPeriod;
          if (payMode === 'advance') {
            const months = getAdvanceMonths();
            const range = months.length > 1
              ? `${months[0]} – ${months[months.length - 1]}`
              : months[0];
            toast.success(`🎉 ${advanceMonths} month${advanceMonths > 1 ? 's' : ''} paid in advance! (${range})${advanceDiscount > 0 ? ` You saved ${formatCurrency(advanceSaving)}!` : ''}`);
          } else if (isPartialPayment) {
            toast.success(`✅ Partial payment of ${formatCurrency(amountToPay)} confirmed for ${pLabel}! Remaining: ${formatCurrency(remaining - amountToPay)}`);
          } else {
            toast.success(`🎉 Rent fully paid for ${pLabel}!`);
          }
        } else {
          setPinTimeout(true);
          toast.error('Payment not confirmed yet. Check your phone and try again if needed.');
        }
      } else {
        // Card — record as completed directly
        const rentPeriodStr = payMode === 'advance'
          ? (() => {
              const months = getAdvanceMonths();
              return months.length > 1 ? `${months[0]} – ${months[months.length - 1]}` : balance.rentPeriod;
            })()
          : balance.rentPeriod;
        await paymentsApi.payRent({
          propertyId: balance.propertyId,
          propertyTitle: balance.propertyTitle,
          amount: amountToPay,
          method: payMethod,
          reference: ref,
          rentPeriod: rentPeriodStr,
          isPartial: isPartialPayment,
        });
        setLoading(false);
        onClose();
        toast.success(`🎉 Payment of ${formatCurrency(amountToPay)} processed!`);
      }
    } catch {
      setLoading(false);
      toast.error('Payment failed. Please check your connection and try again.');
    }
  };

  const periodLabel = balance.rentPeriod
    ? new Date(balance.rentPeriod + '-01').toLocaleDateString('en-UG', { month: 'long', year: 'numeric' })
    : '';

  return (
    <Modal open={open} onClose={awaitingPin ? undefined : onClose} title="Pay Rent" size="md"
      footer={
        awaitingPin ? (
          <div className="w-full flex flex-col items-center gap-2 py-2">
            <div className="flex items-center gap-3">
              <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Waiting for your PIN confirmation...</span>
            </div>
            {pinTimeout && (
              <Button size="sm" variant="secondary" onClick={() => { setAwaitingPin(false); setPinTimeout(false); }}>
                Try Again
              </Button>
            )}
          </div>
        ) : (
          <>
            <Button variant="secondary" onClick={onClose}>Cancel</Button>
            <Button
              loading={loading}
              onClick={handlePay}
              disabled={!isValid}
              variant={payMode === 'advance' ? 'gold' : isPartialPayment ? 'secondary' : 'gold'}
              icon={<Banknote size={15} />}
            >
              {payMode === 'advance'
                ? `Pay ${formatCurrency(advanceTotal)} (${advanceMonths} months)`
                : isPartialPayment
                  ? `Pay ${formatCurrency(amountToPay)} (Partial)`
                  : `Pay ${formatCurrency(amountToPay)} (Full)`}
            </Button>
          </>
        )
      }
    >
      <div className="space-y-5">
        {/* Awaiting PIN confirmation */}
        {awaitingPin && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center gap-3 p-5 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700 rounded-2xl text-center">
            <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
            <div>
              <p className="font-bold text-primary-800 dark:text-primary-300">Check your phone!</p>
              <p className="text-sm text-primary-600 dark:text-primary-400 mt-1">
                A {payMethod === 'mtn_momo' ? 'MTN MoMo' : 'Airtel Money'} USSD prompt has been sent to <strong>{phone}</strong>.
              </p>
              <p className="text-sm text-primary-600 dark:text-primary-400 mt-1">
                Enter your mobile money PIN to confirm the payment of <strong>{formatCurrency(amountToPay)}</strong>.
              </p>
              <p className="text-xs text-primary-400 mt-2">Waiting for confirmation · ref: {payRef}</p>
            </div>
          </motion.div>
        )}

        {/* Payment timed out notice */}
        {pinTimeout && !awaitingPin && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-xs text-amber-700 dark:text-amber-400 text-center">
            ⏱ Payment not confirmed within 60 seconds. Please try again or check your balance.
          </motion.div>
        )}

        {/* Property & period — hidden while awaiting PIN */}
        {!awaitingPin && (
        <div className="space-y-5">
        {/* Property & period */}
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-2xl p-4 space-y-3">
          <div>
            <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{balance.propertyTitle}</p>
            <p className="text-xs text-slate-400 mt-0.5">Current period: {periodLabel}</p>
          </div>
          <RentProgressBar balance={balance} />
          {balance.inspectionCredit > 0 && (
            <div className="flex items-center gap-2 text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 rounded-xl px-3 py-2">
              <CheckCircle2 size={12} />
              Inspection credit of {formatCurrency(balance.inspectionCredit)} already applied
            </div>
          )}
        </div>

        {/* Payment mode selector */}
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Payment option</p>
          <div className="grid grid-cols-3 gap-2">
            {[
              { key: 'full' as const,    label: 'Pay Balance',    sub: formatCurrency(remaining),   color: 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' },
              { key: 'partial' as const, label: 'Pay Portion',    sub: 'Custom amount',             color: 'border-amber-500 bg-amber-50 dark:bg-amber-900/20' },
              { key: 'advance' as const, label: 'Pay Advance',    sub: 'Multiple months',           color: 'border-green-500 bg-green-50 dark:bg-green-900/20' },
            ].map(opt => (
              <button key={opt.key} onClick={() => setPayMode(opt.key)}
                className={`p-3 rounded-xl border-2 text-center transition-all ${payMode === opt.key ? opt.color : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'}`}>
                <p className="text-xs font-bold text-slate-900 dark:text-slate-100">{opt.label}</p>
                <p className="text-xs text-slate-500 mt-0.5">{opt.sub}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Partial amount input */}
        <AnimatePresence>
          {payMode === 'partial' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
              <Input
                label="Amount to pay (UGX)"
                type="number"
                placeholder={`Max: ${remaining.toLocaleString()}`}
                value={amountInput}
                onChange={e => setAmountInput(e.target.value)}
                hint={`Remaining after this payment: ${formatCurrency(Math.max(0, remaining - (Number(amountInput) || 0)))}`}
                icon={<Banknote size={15} />}
              />
              <div className="flex gap-2 mt-2 flex-wrap">
                {[0.25, 0.5, 0.75].map(frac => {
                  const amt = Math.round(remaining * frac);
                  return (
                    <button key={frac} onClick={() => setAmountInput(String(amt))}
                      className="px-3 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
                      {Math.round(frac * 100)}% — {formatCurrency(amt)}
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Advance payment options */}
        <AnimatePresence>
          {payMode === 'advance' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="space-y-3">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300">How many months in advance?</p>
              <div className="grid grid-cols-4 gap-2">
                {[2, 3, 6, 12].map(m => {
                  const disc = advanceDiscounts[m] ?? 0;
                  return (
                    <button key={m} onClick={() => setAdvanceMonths(m)}
                      className={`p-3 rounded-xl border-2 text-center transition-all ${advanceMonths === m ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'}`}>
                      <p className="text-sm font-bold text-slate-900 dark:text-slate-100">{m}</p>
                      <p className="text-xs text-slate-500">months</p>
                      {disc > 0 && <p className="text-xs text-green-600 font-semibold mt-0.5">{disc}% off</p>}
                    </button>
                  );
                })}
              </div>

              {/* Months covered */}
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 space-y-2">
                <p className="text-xs font-semibold text-green-700 dark:text-green-300">Months covered:</p>
                <div className="flex flex-wrap gap-1.5">
                  {getAdvanceMonths().map(m => (
                    <span key={m} className="text-xs bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 px-2.5 py-1 rounded-full font-medium">
                      {m}
                    </span>
                  ))}
                </div>
                <div className="pt-2 border-t border-green-200 dark:border-green-700 space-y-1 text-xs">
                  <div className="flex justify-between text-slate-500">
                    <span>{advanceMonths} × {formatCurrency(monthlyRent)}</span>
                    <span>{formatCurrency(monthlyRent * advanceMonths)}</span>
                  </div>
                  {advanceDiscount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Discount ({advanceDiscount}%)</span>
                      <span>-{formatCurrency(advanceSaving)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold text-green-700 dark:text-green-300 pt-1 border-t border-green-200 dark:border-green-700">
                    <span>Total</span>
                    <span>{formatCurrency(advanceTotal)}</span>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Partial payment notice */}
        {isPartialPayment && amountToPay > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex items-start gap-2.5 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
            <Info size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
            <div className="text-xs text-amber-700 dark:text-amber-400">
              <p className="font-semibold">Partial payment</p>
              <p className="mt-0.5">You'll still owe <strong>{formatCurrency(remaining - amountToPay)}</strong> after this payment.</p>
            </div>
          </motion.div>
        )}

        {/* Payment method */}
        <div>
          <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Payment method</p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { value: 'mtn_momo',     label: 'MTN MoMo',    color: 'bg-yellow-400' },
              { value: 'airtel_money', label: 'Airtel Money', color: 'bg-red-500'    },
              { value: 'card',         label: 'Card',         color: 'bg-blue-500'   },
              { value: 'cash',         label: 'Cash',         color: 'bg-green-600'  },
            ].map(m => (
              <button key={m.value} onClick={() => setPayMethod(m.value as PaymentMethod)}
                className={`p-3 rounded-xl border-2 text-center transition-all ${payMethod === m.value ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-600'}`}>
                <div className={`w-6 h-6 ${m.color} rounded-full mx-auto mb-1`} />
                <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{m.label}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Phone / card details */}
        {(payMethod === 'mtn_momo' || payMethod === 'airtel_money') && (
          <Input
            label={`${payMethod === 'mtn_momo' ? 'MTN' : 'Airtel'} Phone Number`}
            type="tel" placeholder="07XX XXX XXX"
            value={phone} onChange={e => setPhone(e.target.value)}
            icon={<Smartphone size={15} />}
          />
        )}
        {payMethod === 'card' && (
          <div className="space-y-3">
            <Input label="Card Number" placeholder="1234 5678 9012 3456" />
            <div className="grid grid-cols-2 gap-3">
              <Input label="Expiry" placeholder="MM/YY" />
              <Input label="CVV" placeholder="123" />
            </div>
          </div>
        )}

        {/* Summary */}
        <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 space-y-1.5 text-xs">
          <div className="flex justify-between text-slate-500"><span>Monthly rent</span><span>{formatCurrency(monthlyRent)}</span></div>
          {balance.inspectionCredit > 0 && <div className="flex justify-between text-green-600"><span>Inspection credit</span><span>-{formatCurrency(balance.inspectionCredit)}</span></div>}
          {payMode !== 'advance' && <div className="flex justify-between text-slate-500"><span>Already paid</span><span>{formatCurrency(balance.totalPaid)}</span></div>}
          {payMode === 'advance' && advanceDiscount > 0 && <div className="flex justify-between text-green-600"><span>Advance discount ({advanceDiscount}%)</span><span>-{formatCurrency(advanceSaving)}</span></div>}
          <div className="flex justify-between font-bold text-slate-900 dark:text-slate-100 pt-1.5 border-t border-slate-200 dark:border-slate-600">
            <span>Paying now</span>
            <span className={payMode === 'advance' ? 'text-green-600' : isPartialPayment ? 'text-amber-600' : 'text-green-600'}>{formatCurrency(amountToPay)}</span>
          </div>
          {isPartialPayment && amountToPay > 0 && (
            <div className="flex justify-between text-red-500"><span>Still owed after</span><span>{formatCurrency(remaining - amountToPay)}</span></div>
          )}
        </div>
      </div>
      )} {/* end !awaitingPin */}
      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function PaymentsPage() {
  const { user } = useAuthStore();
  const { payments: allPayments } = useDataStore();
  const { properties: allProperties } = usePropertyStore();
  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedBalance, setSelectedBalance] = useState<RentBalance | null>(null);
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [expandedBalance, setExpandedBalance] = useState<string | null>(null);

  // Filter payments to only what this user is allowed to see
  const visiblePayments = filterPaymentsForUser(allPayments, user, allProperties);

  // ── Build rent balances from the tenant's rented property + payment history ─
  // This is what powers the "Pay Rent" button and balance cards.
  const visibleBalances: RentBalance[] = (() => {
    if (user?.role !== 'tenant') return [];

    // Find the property this tenant is renting
    const rentedProp = allProperties.find(
      p => p.tenantId === user.id && p.status === 'rented'
    );
    if (!rentedProp) return [];

    // Current month period "YYYY-MM"
    const now = new Date();
    const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const dueDate = new Date(now.getFullYear(), now.getMonth(), 5).toISOString(); // due on the 5th

    // All completed rent payments for this period
    const periodPayments = visiblePayments.filter(p =>
      (p.type === 'rent' || p.type === 'rent_partial') &&
      p.propertyId === rentedProp.id &&
      p.rentPeriod === currentPeriod
    );

    const totalPaid = periodPayments
      .filter(p => p.status === 'completed')
      .reduce((s, p) => s + p.amount, 0);

    // Find inspection credit (first month only — if an inspection fee was paid and credited)
    const inspCredit = periodPayments.find(p => p.inspectionCreditApplied && p.inspectionCreditApplied > 0)
      ?.inspectionCreditApplied ?? 0;

    const totalDue = rentedProp.rentPrice - inspCredit;
    const balance  = Math.max(0, totalDue - totalPaid);

    const rentBalance: RentBalance = {
      id: `bal-${rentedProp.id}-${currentPeriod}`,
      propertyId:     rentedProp.id,
      propertyTitle:  rentedProp.title,
      tenantId:       user.id,
      rentPeriod:     currentPeriod,
      totalDue,
      totalPaid,
      balance,
      inspectionCredit: inspCredit,
      isFullyPaid: balance <= 0,
      dueDate,
      payments: periodPayments,
      lateFeeApplied: 0,
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    };

    return [rentBalance];
  })();

  const filtered = visiblePayments.filter(p => {
    const matchType = !filterType || p.type === filterType || (filterType === 'rent' && p.type === 'rent_partial');
    const matchStatus = !filterStatus || p.status === filterStatus;
    return matchType && matchStatus;
  });

  const totalPaid       = visiblePayments.filter(p => p.status === 'completed').reduce((s, p) => s + p.amount, 0);
  const totalOutstanding= visibleBalances.filter(b => !b.isFullyPaid).reduce((s, b) => s + b.balance, 0);
  const inspectionRevenue = visiblePayments.filter(p => p.type === 'inspection_fee' && p.status === 'completed').reduce((s, p) => s + p.amount, 0);

  const openPayModal = (balance: RentBalance) => {
    setSelectedBalance(balance);
    setShowPayModal(true);
  };

  // Open the pay modal — use existing balance or create one from the rented property
  const handlePayRentClick = () => {
    const unpaid = visibleBalances.find(b => !b.isFullyPaid);
    if (unpaid) { openPayModal(unpaid); return; }
    if (visibleBalances.length > 0) { openPayModal(visibleBalances[0]); return; }
    // No rented property found — guide tenant
    import('react-hot-toast').then(m => m.default.error('No active lease found. Book a property first.'));
  };

  const statusVariant = (s: string): 'green' | 'yellow' | 'red' | 'blue' | 'purple' => {
    const m: Record<string, 'green' | 'yellow' | 'red' | 'blue' | 'purple'> = {
      completed: 'green', pending: 'yellow', failed: 'red', processing: 'blue', refunded: 'purple',
    };
    return m[s] || 'gray' as 'green';
  };

  const typeLabel = (t: string) => {
    const m: Record<string, string> = {
      rent: 'Rent', rent_partial: 'Partial Rent', inspection_fee: 'Inspection Fee',
      deposit: 'Deposit', late_fee: 'Late Fee',
    };
    return m[t] || t;
  };

  const typeVariant = (t: string): 'blue' | 'purple' | 'green' | 'yellow' | 'gray' => {
    const m: Record<string, 'blue' | 'purple' | 'green' | 'yellow' | 'gray'> = {
      rent: 'blue', rent_partial: 'yellow', inspection_fee: 'purple',
      deposit: 'green', late_fee: 'red' as 'gray',
    };
    return m[t] || 'gray';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Payments</h1>
          <p className="text-sm text-slate-500 mt-0.5">Track all your transactions and rent balances</p>
        </div>
        {user?.role === 'tenant' && (
          <Button icon={<CreditCard size={16} />} onClick={handlePayRentClick}>
            Pay Rent
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Paid" value={formatCurrency(totalPaid)}
          icon={<TrendingUp className="w-6 h-6 text-green-600" />} iconBg="bg-green-100 dark:bg-green-900/30" />
        <StatCard title="Outstanding Balance" value={formatCurrency(totalOutstanding)}
          subtitle={totalOutstanding > 0 ? 'Partial payments pending' : 'All clear!'}
          icon={<AlertCircle className="w-6 h-6 text-amber-600" />} iconBg="bg-amber-100 dark:bg-amber-900/30" />
        <StatCard title="Inspection Fees" value={formatCurrency(inspectionRevenue)}
          icon={<Receipt className="w-6 h-6 text-purple-600" />} iconBg="bg-purple-100 dark:bg-purple-900/30" />
      </div>

      {/* ── Rent Balances (tenant view) ─────────────────────────────────── */}
      {user?.role === 'tenant' && (
        <div className="space-y-3">
          {/* Deposit status */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-900 dark:text-slate-100 text-base">Security Deposit</h2>
              <Badge variant="green">Held in Escrow</Badge>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                <p className="text-xs text-slate-400">Deposit Paid</p>
                <p className="font-bold text-slate-900 dark:text-slate-100 mt-0.5">{formatCurrency(1800000)}</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                <p className="text-xs text-slate-400">Property</p>
                <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5 text-xs truncate">1-Bedroom Apt, Entebbe</p>
              </div>
            </div>
            <p className="text-xs text-slate-400 mt-3">
              💡 Your deposit is held securely and will be refunded within 14 days of move-out, minus any deductions for damages.
            </p>
          </div>
          <h2 className="font-bold text-slate-900 dark:text-slate-100 text-base">Monthly Rent Balances</h2>
          {visibleBalances.map((balance, i) => {
            const isExpanded = expandedBalance === balance.id;
            const isOverdue = !balance.isFullyPaid && new Date(balance.dueDate) < new Date();
            const periodLabel = new Date(balance.rentPeriod + '-01').toLocaleDateString('en-UG', { month: 'long', year: 'numeric' });

            return (
              <motion.div key={balance.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
                className={`bg-white dark:bg-slate-800 rounded-2xl shadow-card border transition-all ${balance.isFullyPaid ? 'border-green-100 dark:border-green-900/30' : isOverdue ? 'border-red-200 dark:border-red-900/30' : 'border-amber-200 dark:border-amber-900/30'}`}>

                {/* Header row */}
                <div className="p-5">
                  <div className="flex items-start justify-between gap-4 mb-4">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${balance.isFullyPaid ? 'bg-green-100 dark:bg-green-900/30' : isOverdue ? 'bg-red-100 dark:bg-red-900/30' : 'bg-amber-100 dark:bg-amber-900/30'}`}>
                        {balance.isFullyPaid
                          ? <CheckCircle2 size={18} className="text-green-600" />
                          : isOverdue
                            ? <AlertCircle size={18} className="text-red-500" />
                            : <Clock size={18} className="text-amber-600" />}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">{periodLabel}</p>
                        <p className="text-xs text-slate-400">{balance.propertyTitle}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      {balance.isFullyPaid
                        ? <Badge variant="green">Paid ✓</Badge>
                        : isOverdue
                          ? <Badge variant="red">Overdue</Badge>
                          : <Badge variant="yellow">Partial</Badge>}
                      {!balance.isFullyPaid && (
                        <Button size="sm" icon={<Plus size={13} />} onClick={() => openPayModal(balance)}>
                          Pay
                        </Button>
                      )}
                    </div>
                  </div>

                  <RentProgressBar balance={balance} />

                  {balance.inspectionCredit > 0 && (
                    <p className="text-xs text-green-600 dark:text-green-400 mt-2 flex items-center gap-1.5">
                      <CheckCircle2 size={11} />
                      {formatCurrency(balance.inspectionCredit)} inspection credit applied
                    </p>
                  )}
                </div>

                {/* Expand/collapse payment history */}
                <button
                  onClick={() => setExpandedBalance(isExpanded ? null : balance.id)}
                  className="w-full flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors rounded-b-2xl"
                >
                  <span>{balance.payments.length} payment{balance.payments.length !== 1 ? 's' : ''} this month</span>
                  {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden">
                      <div className="px-5 pb-4 space-y-2">
                        {balance.payments.map(p => (
                          <div key={p.id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                            <div className="flex items-center gap-2">
                              <div className="w-7 h-7 bg-slate-100 dark:bg-slate-700 rounded-lg flex items-center justify-center">
                                <Banknote size={13} className="text-slate-500" />
                              </div>
                              <div>
                                <p className="text-xs font-medium text-slate-700 dark:text-slate-300 capitalize">{p.method.replace('_', ' ')}</p>
                                <p className="text-xs text-slate-400">{p.paidAt ? formatDate(p.paidAt) : '—'} · {p.reference}</p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-green-600">+{formatCurrency(p.amount)}</p>
                              <Badge variant="green" className="text-xs">paid</Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Transaction History ─────────────────────────────────────────── */}
      <div>
        <h2 className="font-bold text-slate-900 dark:text-slate-100 text-base mb-3">Transaction History</h2>

        {/* Filters */}
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-4 mb-4">
          <div className="flex gap-3 flex-wrap">
            <Select value={filterType} onChange={e => setFilterType(e.target.value)}
              options={[
                { value: '', label: 'All Types' },
                { value: 'rent', label: 'Rent (incl. partial)' },
                { value: 'inspection_fee', label: 'Inspection Fee' },
                { value: 'deposit', label: 'Deposit' },
                { value: 'late_fee', label: 'Late Fee' },
              ]} />
            <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
              options={[
                { value: '', label: 'All Status' },
                { value: 'completed', label: 'Completed' },
                { value: 'pending', label: 'Pending' },
                { value: 'failed', label: 'Failed' },
              ]} />
            <Button variant="secondary" size="sm" icon={<Download size={14} />} onClick={() => {
              downloadPaymentsCSV(filtered.map(p => ({
                reference: p.reference, type: p.type, propertyTitle: p.propertyTitle,
                amount: p.amount, method: p.method, status: p.status,
                tenantName: p.tenantName, rentPeriod: p.rentPeriod, paidAt: p.paidAt,
              })));
            }}>
              Export
            </Button>
          </div>
        </div>

        {filtered.length === 0 ? (
          <EmptyState icon={<CreditCard size={28} />} title="No transactions found" description="Your payment history will appear here." />
        ) : (
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 dark:bg-slate-800/50">
                    {['Reference', 'Type', 'Property', 'Period', 'Amount', 'Method', 'Status', 'Date', ''].map(h => (
                      <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {filtered.map((p, i) => (
                    <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                      className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                      <td className="px-4 py-3 font-mono text-xs text-slate-500">{p.reference}</td>
                      <td className="px-4 py-3">
                        <Badge variant={typeVariant(p.type)}>{typeLabel(p.type)}</Badge>
                      </td>
                      <td className="px-4 py-3 text-slate-700 dark:text-slate-300 max-w-[140px] truncate">{p.propertyTitle}</td>
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">
                        {p.rentPeriod
                          ? new Date(p.rentPeriod + '-01').toLocaleDateString('en-UG', { month: 'long', year: 'numeric' })
                          : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <div>
                          <p className="font-bold text-slate-900 dark:text-slate-100">{formatCurrency(p.amount)}</p>
                          {p.inspectionCreditApplied ? (
                            <p className="text-xs text-green-600">-{formatCurrency(p.inspectionCreditApplied)} credit</p>
                          ) : p.isPartial ? (
                            <p className="text-xs text-amber-500">partial payment</p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-slate-500 capitalize text-xs whitespace-nowrap">{p.method.replace(/_/g, ' ')}</td>
                      <td className="px-4 py-3"><Badge variant={statusVariant(p.status)}>{p.status}</Badge></td>
                      <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{p.paidAt ? formatDate(p.paidAt) : '—'}</td>
                      <td className="px-4 py-3">
                        <Button size="sm" variant="ghost" icon={<Download size={13} />} onClick={() => {
                          downloadReceipt({
                            reference: p.reference,
                            type: p.type.replace(/_/g, ' '),
                            propertyTitle: p.propertyTitle,
                            tenantName: p.tenantName,
                            amount: p.amount,
                            method: p.method.replace(/_/g, ' '),
                            date: p.paidAt || p.createdAt,
                            inspectionCredit: p.inspectionCreditApplied,
                            rentPeriod: p.rentPeriod,
                            isPartial: p.isPartial,
                          });
                        }}>
                          Receipt
                        </Button>
                      </td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Pay Rent Modal */}
      <PayRentModal
        open={showPayModal}
        onClose={() => { setShowPayModal(false); setSelectedBalance(null); }}
        balance={selectedBalance}
      />
    </div>
  );
}
