import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Settings2, Save, AlertCircle, CheckCircle2, DollarSign,
  Percent, Building2, Smartphone, CreditCard, Shield,
  TrendingUp, Info,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Input, Select } from '../../components/ui/Input';
import { Card } from '../../components/ui/Card';
import { usePaymentStore } from '../../store/paymentStore';
import { formatCurrency } from '../../lib/utils';
import toast from 'react-hot-toast';
import { platformSettingsApi } from '../../lib/api';

// ─── Types ────────────────────────────────────────────────────────────────────

interface FeeConfig {
  inspectionFee: number;
  managementFeeMin: number;
  managementFeeMax: number;
  managementFeeDefault: number;
  itabPlatformFee: number;
  latePaymentFee: number;
  payoutThreshold: number;
  payoutDay: number;
}

type PaymentMethodOption = 'mtn_momo' | 'airtel_money' | 'bank';

interface CompanyAccounts {
  primaryMethod: PaymentMethodOption;
  primaryMtnPhone: string;
  primaryAirtelPhone: string;
  primaryBankName: string;
  primaryAccountNumber: string;
  primaryAccountName: string;
  secondaryMethod: PaymentMethodOption;
  secondaryMtnPhone: string;
  secondaryAirtelPhone: string;
  secondaryBankName: string;
  secondaryAccountNumber: string;
  secondaryAccountName: string;
  transferFrequency: 'weekly' | 'monthly' | 'manual';
}

// ─── Defaults ─────────────────────────────────────────────────────────────────

const DEFAULT_FEES: FeeConfig = {
  inspectionFee: 100_000,
  managementFeeMin: 8,
  managementFeeMax: 12,
  managementFeeDefault: 10,
  itabPlatformFee: 2,
  latePaymentFee: 5,
  payoutThreshold: 50_000,
  payoutDay: 5,
};

const DEFAULT_ACCOUNTS: CompanyAccounts = {
  primaryMethod: 'mtn_momo',
  primaryMtnPhone: '',
  primaryAirtelPhone: '',
  primaryBankName: '',
  primaryAccountNumber: '',
  primaryAccountName: '',
  secondaryMethod: 'mtn_momo',
  secondaryMtnPhone: '',
  secondaryAirtelPhone: '',
  secondaryBankName: '',
  secondaryAccountNumber: '',
  secondaryAccountName: '',
  transferFrequency: 'weekly',
};

const STORAGE_KEY_FEES = 'itab_fee_config';
const STORAGE_KEY_ACCOUNTS = 'itab_company_accounts';

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? { ...fallback, ...JSON.parse(raw) } : fallback;
  } catch {
    return fallback;
  }
}

function num(v: unknown, fallback: number): number {
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function str(v: unknown, fallback: string): string {
  return typeof v === 'string' ? v : fallback;
}

function feeConfigFromApi(raw: Record<string, unknown> | null | undefined): FeeConfig {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_FEES };
  return {
    inspectionFee: num(raw.inspectionFee, DEFAULT_FEES.inspectionFee),
    managementFeeMin: num(raw.managementFeeMin, DEFAULT_FEES.managementFeeMin),
    managementFeeMax: num(raw.managementFeeMax, DEFAULT_FEES.managementFeeMax),
    managementFeeDefault: num(raw.managementFeeDefault, DEFAULT_FEES.managementFeeDefault),
    itabPlatformFee: num(raw.itabPlatformFee, DEFAULT_FEES.itabPlatformFee),
    latePaymentFee: num(raw.latePaymentFee, DEFAULT_FEES.latePaymentFee),
    payoutThreshold: num(raw.payoutThreshold, DEFAULT_FEES.payoutThreshold),
    payoutDay: num(raw.payoutDay, DEFAULT_FEES.payoutDay),
  };
}

function companyAccountsFromApi(raw: Record<string, unknown> | null | undefined): CompanyAccounts {
  if (!raw || typeof raw !== 'object') return { ...DEFAULT_ACCOUNTS };
  return {
    primaryMethod: (['mtn_momo', 'airtel_money', 'bank'] as const).includes(raw.primaryMethod as PaymentMethodOption)
      ? (raw.primaryMethod as PaymentMethodOption)
      : DEFAULT_ACCOUNTS.primaryMethod,
    primaryMtnPhone: str(raw.primaryMtnPhone, DEFAULT_ACCOUNTS.primaryMtnPhone),
    primaryAirtelPhone: str(raw.primaryAirtelPhone, DEFAULT_ACCOUNTS.primaryAirtelPhone),
    primaryBankName: str(raw.primaryBankName, DEFAULT_ACCOUNTS.primaryBankName),
    primaryAccountNumber: str(raw.primaryAccountNumber, DEFAULT_ACCOUNTS.primaryAccountNumber),
    primaryAccountName: str(raw.primaryAccountName, DEFAULT_ACCOUNTS.primaryAccountName),
    secondaryMethod: (['mtn_momo', 'airtel_money', 'bank'] as const).includes(raw.secondaryMethod as PaymentMethodOption)
      ? (raw.secondaryMethod as PaymentMethodOption)
      : DEFAULT_ACCOUNTS.secondaryMethod,
    secondaryMtnPhone: str(raw.secondaryMtnPhone, DEFAULT_ACCOUNTS.secondaryMtnPhone),
    secondaryAirtelPhone: str(raw.secondaryAirtelPhone, DEFAULT_ACCOUNTS.secondaryAirtelPhone),
    secondaryBankName: str(raw.secondaryBankName, DEFAULT_ACCOUNTS.secondaryBankName),
    secondaryAccountNumber: str(raw.secondaryAccountNumber, DEFAULT_ACCOUNTS.secondaryAccountNumber),
    secondaryAccountName: str(raw.secondaryAccountName, DEFAULT_ACCOUNTS.secondaryAccountName),
    transferFrequency: (['weekly', 'monthly', 'manual'] as const).includes(raw.transferFrequency as CompanyAccounts['transferFrequency'])
      ? (raw.transferFrequency as CompanyAccounts['transferFrequency'])
      : DEFAULT_ACCOUNTS.transferFrequency,
  };
}

function isFeeConfigEmpty(api: Record<string, unknown>): boolean {
  return !api || Object.keys(api).length === 0;
}

function isCompanyAccountsEffectivelyEmpty(api: Record<string, unknown>): boolean {
  if (!api || Object.keys(api).length === 0) return true;
  const a = companyAccountsFromApi(api);
  return (
    !a.primaryMtnPhone &&
    !a.primaryAirtelPhone &&
    !a.primaryBankName &&
    !a.primaryAccountNumber
  );
}

// ─── Method options ───────────────────────────────────────────────────────────

const METHOD_OPTIONS = [
  { value: 'mtn_momo', label: 'MTN MoMo' },
  { value: 'airtel_money', label: 'Airtel Money' },
  { value: 'bank', label: 'Bank Transfer' },
];

const FREQUENCY_OPTIONS = [
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'manual', label: 'Manual' },
];

// ─── Sub-components ───────────────────────────────────────────────────────────

function AccountFields({
  prefix,
  method,
  values,
  onChange,
}: {
  prefix: 'primary' | 'secondary';
  method: PaymentMethodOption;
  values: CompanyAccounts;
  onChange: (field: keyof CompanyAccounts, value: string) => void;
}) {
  if (method === 'mtn_momo') {
    return (
      <Input
        label="Company MTN MoMo Number"
        placeholder="e.g. 0772 000 000"
        value={values[`${prefix}MtnPhone`]}
        onChange={e => onChange(`${prefix}MtnPhone`, e.target.value)}
        icon={<Smartphone className="w-4 h-4" />}
      />
    );
  }
  if (method === 'airtel_money') {
    return (
      <Input
        label="Company Airtel Money Number"
        placeholder="e.g. 0752 000 000"
        value={values[`${prefix}AirtelPhone`]}
        onChange={e => onChange(`${prefix}AirtelPhone`, e.target.value)}
        icon={<Smartphone className="w-4 h-4" />}
      />
    );
  }
  // bank
  return (
    <div className="space-y-3">
      <Input
        label="Bank Name"
        placeholder="e.g. Stanbic Bank Uganda"
        value={values[`${prefix}BankName`]}
        onChange={e => onChange(`${prefix}BankName`, e.target.value)}
        icon={<Building2 className="w-4 h-4" />}
      />
      <Input
        label="Account Number"
        placeholder="e.g. 9030012345678"
        value={values[`${prefix}AccountNumber`]}
        onChange={e => onChange(`${prefix}AccountNumber`, e.target.value)}
        icon={<CreditCard className="w-4 h-4" />}
      />
      <Input
        label="Account Name"
        placeholder="e.g. ITAB Property Services Ltd"
        value={values[`${prefix}AccountName`]}
        onChange={e => onChange(`${prefix}AccountName`, e.target.value)}
        icon={<Building2 className="w-4 h-4" />}
      />
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AdminFees() {
  const [activeTab, setActiveTab] = useState<'fees' | 'accounts'>('fees');
  const [fees, setFees] = useState<FeeConfig>(DEFAULT_FEES);
  const [companyAccounts, setCompanyAccounts] = useState<CompanyAccounts>(DEFAULT_ACCOUNTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const getPlatformRevenue = usePaymentStore(s => s.getPlatformRevenue);
  const platformRevenue = getPlatformRevenue();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await platformSettingsApi.get();
        const d = res.data.data;
        let nextFees = feeConfigFromApi(d.feeConfig as Record<string, unknown>);
        let nextAccounts = companyAccountsFromApi(d.companyAccounts as Record<string, unknown>);
        const legacyFees = loadFromStorage(STORAGE_KEY_FEES, DEFAULT_FEES);
        const legacyAccounts = loadFromStorage(STORAGE_KEY_ACCOUNTS, DEFAULT_ACCOUNTS);
        if (isFeeConfigEmpty(d.feeConfig as Record<string, unknown>) && JSON.stringify(legacyFees) !== JSON.stringify(DEFAULT_FEES)) {
          nextFees = { ...DEFAULT_FEES, ...legacyFees };
        }
        if (isCompanyAccountsEffectivelyEmpty(d.companyAccounts as Record<string, unknown>)) {
          const hasLegacy =
            legacyAccounts.primaryMtnPhone ||
            legacyAccounts.primaryAirtelPhone ||
            legacyAccounts.primaryBankName ||
            legacyAccounts.primaryAccountNumber;
          if (hasLegacy) nextAccounts = { ...DEFAULT_ACCOUNTS, ...legacyAccounts };
        }
        if (!cancelled) {
          setFees(nextFees);
          setCompanyAccounts(nextAccounts);
        }
      } catch {
        if (!cancelled) {
          toast.error('Could not load settings from server. Showing cached copy if available.');
          setFees(loadFromStorage(STORAGE_KEY_FEES, DEFAULT_FEES));
          setCompanyAccounts(loadFromStorage(STORAGE_KEY_ACCOUNTS, DEFAULT_ACCOUNTS));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // ── Helpers ────────────────────────────────────────────────────────────────

  function updateFee(field: keyof FeeConfig, value: number) {
    setFees(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  function updateAccount(field: keyof CompanyAccounts, value: string) {
    setCompanyAccounts(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  }

  // ── Save handlers ──────────────────────────────────────────────────────────

  async function handleSaveFees() {
    setSaving(true);
    try {
      await platformSettingsApi.put({ feeConfig: fees });
      localStorage.setItem(STORAGE_KEY_FEES, JSON.stringify(fees));
      setSaved(true);
      toast.success('Fee configuration saved to server');
      setTimeout(() => setSaved(false), 3000);
    } catch {
      toast.error('Failed to save fee configuration. Check your connection and permissions.');
    } finally {
      setSaving(false);
    }
  }

  async function handleSaveAccounts() {
    setSaving(true);
    try {
      await platformSettingsApi.put({ companyAccounts });
      localStorage.setItem(STORAGE_KEY_ACCOUNTS, JSON.stringify(companyAccounts));
      setSaved(true);
      toast.success('Company accounts saved to server');
      setTimeout(() => setSaved(false), 3000);
    } catch {
      toast.error('Failed to save company accounts. Check your connection and permissions.');
    } finally {
      setSaving(false);
    }
  }

  // ── Preview calc ───────────────────────────────────────────────────────────
  const sampleRent = 800_000;
  const itabCut = Math.round(sampleRent * fees.itabPlatformFee / 100);
  const mgmtCut = Math.round(sampleRent * fees.managementFeeDefault / 100);
  const landlordNet = sampleRent - itabCut - mgmtCut;

  // ── Next transfer date ─────────────────────────────────────────────────────
  function nextTransferDate() {
    const now = new Date();
    if (companyAccounts.transferFrequency === 'weekly') {
      const next = new Date(now);
      next.setDate(now.getDate() + (7 - now.getDay()));
      return next.toLocaleDateString('en-UG', { weekday: 'long', day: 'numeric', month: 'short' });
    }
    if (companyAccounts.transferFrequency === 'monthly') {
      const next = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      return next.toLocaleDateString('en-UG', { day: 'numeric', month: 'long', year: 'numeric' });
    }
    return 'On demand';
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-slate-200 dark:bg-slate-700 rounded-lg" />
        <div className="h-40 bg-slate-100 dark:bg-slate-800 rounded-2xl" />
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center">
          <Settings2 className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">Fee Configuration</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">Manage platform fees and company payment accounts</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('fees')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === 'fees'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <Percent className="w-4 h-4" />
            Fee Configuration
          </span>
        </button>
        <button
          onClick={() => setActiveTab('accounts')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
            activeTab === 'accounts'
              ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <span className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Company Accounts
            <span className="px-1.5 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 text-xs rounded-md font-semibold">
              ITAB Company
            </span>
          </span>
        </button>
      </div>

      {/* ── TAB: Fee Configuration ─────────────────────────────────────────── */}
      {activeTab === 'fees' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-5"
        >
          {/* Inspection Fee */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <DollarSign className="w-4 h-4 text-primary-600 dark:text-primary-400" />
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">Inspection Fee</h2>
            </div>
            <div className="max-w-xs">
              <Input
                label="Inspection Fee (UGX)"
                type="number"
                value={fees.inspectionFee}
                onChange={e => updateFee('inspectionFee', Number(e.target.value))}
                hint="One-time fee paid by tenant before viewing a property"
              />
            </div>
          </Card>

          {/* Management Fees */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <Percent className="w-4 h-4 text-purple-600 dark:text-purple-400" />
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">Management Fees</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Input
                label="Minimum (%)"
                type="number"
                min={0}
                max={100}
                value={fees.managementFeeMin}
                onChange={e => updateFee('managementFeeMin', Number(e.target.value))}
              />
              <Input
                label="Maximum (%)"
                type="number"
                min={0}
                max={100}
                value={fees.managementFeeMax}
                onChange={e => updateFee('managementFeeMax', Number(e.target.value))}
              />
              <Input
                label="Default (%)"
                type="number"
                min={0}
                max={100}
                value={fees.managementFeeDefault}
                onChange={e => updateFee('managementFeeDefault', Number(e.target.value))}
                hint="Applied when no custom rate is set"
              />
            </div>
          </Card>

          {/* ITAB Platform Fee */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">ITAB Platform Fee</h2>
              <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs rounded-full font-medium">
                Platform Revenue
              </span>
            </div>
            <div className="max-w-xs">
              <Input
                label="Platform Fee (%)"
                type="number"
                min={0}
                max={100}
                value={fees.itabPlatformFee}
                onChange={e => updateFee('itabPlatformFee', Number(e.target.value))}
                hint="Deducted from every rent transaction into ITAB company accounts"
              />
            </div>
          </Card>

          {/* Late Payment Fee */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <AlertCircle className="w-4 h-4 text-red-500" />
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">Late Payment Fee</h2>
            </div>
            <div className="max-w-xs">
              <Input
                label="Late Payment Penalty (%)"
                type="number"
                min={0}
                max={100}
                value={fees.latePaymentFee}
                onChange={e => updateFee('latePaymentFee', Number(e.target.value))}
                hint="Applied when rent is paid after the due date"
              />
            </div>
          </Card>

          {/* Payout Settings */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <CreditCard className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">Payout Settings</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 max-w-md">
              <Input
                label="Minimum Payout Threshold (UGX)"
                type="number"
                value={fees.payoutThreshold}
                onChange={e => updateFee('payoutThreshold', Number(e.target.value))}
                hint="Minimum balance before a payout is triggered"
              />
              <Input
                label="Payout Day of Month"
                type="number"
                min={1}
                max={28}
                value={fees.payoutDay}
                onChange={e => updateFee('payoutDay', Number(e.target.value))}
                hint="Day each month payouts are processed"
              />
            </div>
          </Card>

          {/* Fee Calculation Preview */}
          <Card className="border-2 border-dashed border-slate-200 dark:border-slate-600">
            <div className="flex items-center gap-2 mb-4">
              <Info className="w-4 h-4 text-slate-500" />
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">Fee Calculation Preview</h2>
              <span className="text-xs text-slate-400">based on {formatCurrency(sampleRent)} sample rent</span>
            </div>
            <div className="space-y-2">
              {[
                { label: 'Gross Rent', value: sampleRent, color: 'text-slate-700 dark:text-slate-300' },
                { label: `ITAB Platform Fee (${fees.itabPlatformFee}%)`, value: -itabCut, color: 'text-green-600 dark:text-green-400' },
                { label: `Management Fee (${fees.managementFeeDefault}%)`, value: -mgmtCut, color: 'text-purple-600 dark:text-purple-400' },
                { label: 'Landlord Net Payout', value: landlordNet, color: 'text-blue-600 dark:text-blue-400 font-semibold' },
              ].map(row => (
                <div key={row.label} className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-700 last:border-0">
                  <span className="text-sm text-slate-600 dark:text-slate-400">{row.label}</span>
                  <span className={`text-sm font-medium ${row.color}`}>
                    {row.value < 0 ? `- ${formatCurrency(Math.abs(row.value))}` : formatCurrency(row.value)}
                  </span>
                </div>
              ))}
            </div>
          </Card>

          {/* Save */}
          <div className="flex justify-end">
            <Button
              onClick={handleSaveFees}
              loading={saving}
              icon={saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              variant={saved ? 'secondary' : 'primary'}
            >
              {saved ? 'Saved' : 'Save Fee Configuration'}
            </Button>
          </div>
        </motion.div>
      )}

      {/* ── TAB: Company Accounts ──────────────────────────────────────────── */}
      {activeTab === 'accounts' && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.2 }}
          className="space-y-5"
        >
          {/* Admin responsibility notice */}
          <div className="flex gap-3 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl">
            <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">Admin Representative — ITAB Property Services</p>
              <p className="text-sm text-blue-700 dark:text-blue-400">
                The Admin user (you) is the designated representative of ITAB Property Services. Platform fees collected
                from all transactions are deposited into these company accounts. You are responsible for managing these
                funds on behalf of the company.
              </p>
            </div>
          </div>

          {/* What this section is */}
          <div className="flex gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl">
            <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-800 dark:text-amber-300">
              These are <strong>ITAB Property Services company accounts</strong>. All platform fees (2% on every
              transaction) are deposited here. This is separate from your personal accounts.
            </p>
          </div>

          {/* Platform Revenue Summary */}
          <Card>
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
              <h2 className="font-semibold text-slate-900 dark:text-slate-100">Platform Revenue Summary</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                <p className="text-xs text-green-700 dark:text-green-400 font-medium mb-1">This Month</p>
                <p className="text-lg font-bold text-green-800 dark:text-green-300">{formatCurrency(platformRevenue)}</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">All Time</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-200">{formatCurrency(platformRevenue)}</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-1">Next Transfer</p>
                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{nextTransferDate()}</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mb-2">Transfer Frequency</p>
                <Select
                  options={FREQUENCY_OPTIONS}
                  value={companyAccounts.transferFrequency}
                  onChange={e => updateAccount('transferFrequency', e.target.value)}
                />
              </div>
            </div>
          </Card>

          {/* Primary Collection Account */}
          <Card className="border-2 border-primary-200 dark:border-primary-800">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center">
                <Shield className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-slate-900 dark:text-slate-100">Primary Collection Account</h2>
                  <span className="px-2 py-0.5 bg-primary-600 text-white text-xs rounded-full font-bold tracking-wide">
                    PRIMARY
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Main account where ITAB platform fees are deposited
                </p>
              </div>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <Shield className="w-3.5 h-3.5" />
                <span>Secure Company Account</span>
              </div>
            </div>

            <div className="space-y-4">
              <Select
                label="Payment Method"
                options={METHOD_OPTIONS}
                value={companyAccounts.primaryMethod}
                onChange={e => updateAccount('primaryMethod', e.target.value)}
              />
              <AccountFields
                prefix="primary"
                method={companyAccounts.primaryMethod}
                values={companyAccounts}
                onChange={updateAccount}
              />
            </div>
          </Card>

          {/* Secondary / Backup Account */}
          <Card>
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                <CreditCard className="w-5 h-5 text-slate-500 dark:text-slate-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold text-slate-900 dark:text-slate-100">Secondary / Backup Account</h2>
                  <span className="px-2 py-0.5 bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 text-xs rounded-full font-medium">
                    OPTIONAL
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Fallback account if the primary is unavailable
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <Select
                label="Payment Method"
                options={METHOD_OPTIONS}
                value={companyAccounts.secondaryMethod}
                onChange={e => updateAccount('secondaryMethod', e.target.value)}
              />
              <AccountFields
                prefix="secondary"
                method={companyAccounts.secondaryMethod}
                values={companyAccounts}
                onChange={updateAccount}
              />
            </div>
          </Card>

          {/* Save */}
          <div className="flex justify-end">
            <Button
              onClick={handleSaveAccounts}
              loading={saving}
              icon={saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
              variant={saved ? 'secondary' : 'primary'}
            >
              {saved ? 'Saved' : 'Save Company Accounts'}
            </Button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
