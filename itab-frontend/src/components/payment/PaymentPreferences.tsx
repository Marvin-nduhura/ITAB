/**
 * Reusable payment preferences panel — used by landlords, vendors, managers.
 * Each user sets their preferred method for RECEIVING money.
 */
import { useState } from 'react';
import { CheckCircle2, CreditCard, Smartphone, Building2, Save } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { usePaymentStore } from '../../store/paymentStore';
import toast from 'react-hot-toast';

interface Props {
  userId: string;
  userType: 'user' | 'vendor';
  label?: string;
}

const METHODS = [
  { value: 'mtn_momo',     label: 'MTN MoMo',     color: 'bg-yellow-400', icon: <Smartphone size={16} /> },
  { value: 'airtel_money', label: 'Airtel Money',  color: 'bg-red-500',    icon: <Smartphone size={16} /> },
  { value: 'card',         label: 'Visa / Card',   color: 'bg-blue-500',   icon: <CreditCard size={16} /> },
  { value: 'bank',         label: 'Bank Transfer', color: 'bg-green-600',  icon: <Building2 size={16} /> },
];

export function PaymentPreferences({ userId, userType, label = 'Payment Preferences' }: Props) {
  const { getPreference, setPreference } = usePaymentStore();
  const saved = getPreference(userId);

  const [method, setMethod] = useState<string>(saved?.preferredMethod || 'mtn_momo');
  const [mtnPhone, setMtnPhone] = useState(saved?.mtnPhone || '');
  const [airtelPhone, setAirtelPhone] = useState(saved?.airtelPhone || '');
  const [bankName, setBankName] = useState(saved?.bankName || '');
  const [accountNumber, setAccountNumber] = useState(saved?.bankAccountNumber || '');
  const [accountName, setAccountName] = useState(saved?.bankAccountName || '');
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    if (method === 'mtn_momo' && !mtnPhone) { toast.error('Enter your MTN phone number'); return; }
    if (method === 'airtel_money' && !airtelPhone) { toast.error('Enter your Airtel phone number'); return; }
    if (method === 'bank' && (!bankName || !accountNumber || !accountName)) { toast.error('Fill all bank details'); return; }

    setSaving(true);
    await new Promise(r => setTimeout(r, 600));
    setPreference({ userId, userType, preferredMethod: method as 'mtn_momo' | 'airtel_money' | 'card' | 'bank', mtnPhone, airtelPhone, bankName, bankAccountNumber: accountNumber, bankAccountName: accountName });
    setSaving(false);
    toast.success('Payment preferences saved! All future payouts will use this method.');
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{label}</h3>
        {saved && <span className="text-xs text-green-600 flex items-center gap-1"><CheckCircle2 size={12} /> Saved</span>}
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400">
        Choose how you want to receive payments. This applies to all payouts sent to you through ITAB.
      </p>

      {/* Method selector */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {METHODS.map(m => (
          <button key={m.value} type="button" onClick={() => setMethod(m.value)}
            className={`p-3 rounded-xl border-2 text-center transition-all ${method === m.value ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'}`}>
            <div className={`w-8 h-8 ${m.color} rounded-full mx-auto mb-1.5 flex items-center justify-center text-white`}>
              {m.icon}
            </div>
            <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{m.label}</p>
          </button>
        ))}
      </div>

      {/* Method-specific fields */}
      {method === 'mtn_momo' && (
        <Input label="MTN MoMo Phone Number" type="tel" placeholder="07XX XXX XXX"
          value={mtnPhone} onChange={e => setMtnPhone(e.target.value)}
          hint="Payments will be sent to this MTN number" />
      )}
      {method === 'airtel_money' && (
        <Input label="Airtel Money Phone Number" type="tel" placeholder="07XX XXX XXX"
          value={airtelPhone} onChange={e => setAirtelPhone(e.target.value)}
          hint="Payments will be sent to this Airtel number" />
      )}
      {method === 'card' && (
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
          <p className="text-xs text-blue-700 dark:text-blue-400">
            💳 Card payouts are processed via bank transfer to the card's linked account. Please provide bank details below.
          </p>
        </div>
      )}
      {(method === 'bank' || method === 'card') && (
        <div className="space-y-3">
          <Input label="Bank Name" placeholder="e.g. Stanbic Bank Uganda, Centenary Bank"
            value={bankName} onChange={e => setBankName(e.target.value)} />
          <Input label="Account Number" placeholder="e.g. 9030012345678"
            value={accountNumber} onChange={e => setAccountNumber(e.target.value)} />
          <Input label="Account Name" placeholder="Full name as registered with the bank"
            value={accountName} onChange={e => setAccountName(e.target.value)} />
        </div>
      )}

      <Button loading={saving} onClick={handleSave} icon={<Save size={14} />} className="w-full">
        Save Payment Preferences
      </Button>
    </div>
  );
}
