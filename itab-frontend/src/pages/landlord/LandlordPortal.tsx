import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  DollarSign, TrendingDown, Download, Edit2,
  CheckCircle2, FileText, Scale,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { StatCard } from '../../components/ui/Card';
import { usePropertyStore } from '../../store/propertyStore';
import { useAuthStore } from '../../store/authStore';
import { mockPayouts } from '../../lib/mockData';
import { formatCurrency, formatDate } from '../../lib/utils';
import { downloadStatement } from '../../lib/download';
import toast from 'react-hot-toast';

interface PayoutDetails {
  method: 'mtn_momo' | 'airtel_money' | 'bank';
  phone: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
}

export function LandlordPortal() {
  const { user } = useAuthStore();
  const { properties } = usePropertyStore();
  const [showPayoutModal, setShowPayoutModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [showStatementModal, setShowStatementModal] = useState(false);
  const [disputeText, setDisputeText] = useState('');
  const [disputeAmount, setDisputeAmount] = useState('');
  const [payoutDetails, setPayoutDetails] = useState<PayoutDetails>({
    method: 'mtn_momo', phone: user?.phone || '', bankName: '', accountNumber: '', accountName: '',
  });

  // Landlord's properties
  const myProperties = properties.filter(p => p.landlordId === user?.id);
  const myPayouts = mockPayouts.filter(p => p.landlordId === user?.id || p.landlordId === 'u3'); // demo fallback

  // Financial summary
  const totalGross = myPayouts.reduce((s, p) => s + p.grossRent, 0);
  const totalMgmtFee = myPayouts.reduce((s, p) => s + p.managementFee, 0);
  const totalItabFee = myPayouts.reduce((s, p) => s + p.itabFee, 0);
  const totalNet = myPayouts.reduce((s, p) => s + p.netAmount, 0);

  const handleSavePayoutDetails = async () => {
    await new Promise(r => setTimeout(r, 600));
    setShowPayoutModal(false);
    toast.success('Payout details updated successfully!');
  };

  const handleRaiseDispute = async () => {
    if (!disputeText.trim()) { toast.error('Please describe the dispute'); return; }
    await new Promise(r => setTimeout(r, 600));
    setShowDisputeModal(false);
    setDisputeText('');
    setDisputeAmount('');
    toast.success('Dispute raised! Admin will review within 2 business days.');
  };

  const handleDownloadStatement = (period: string) => {
    downloadStatement({
      landlordName: `${user?.firstName} ${user?.lastName}`,
      period,
      properties: myProperties.map(p => ({
        title: p.title,
        grossRent: p.rentPrice,
        managementFee: Math.round(p.rentPrice * p.managementFeePercent / 100),
        itabFee: Math.round(p.rentPrice * p.itabFeePercent / 100),
        netPayout: Math.round(p.rentPrice * (1 - p.managementFeePercent / 100 - p.itabFeePercent / 100)),
      })),
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Landlord Portal</h1>
          <p className="text-sm text-slate-500 mt-0.5">Your property income overview</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Edit2 size={15} />} onClick={() => setShowPayoutModal(true)}>
            Payout Details
          </Button>
          <Button variant="secondary" icon={<Scale size={15} />} onClick={() => setShowDisputeModal(true)}>
            Raise Dispute
          </Button>
        </div>
      </div>

      {/* Financial Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="Gross Rent Collected" value={formatCurrency(totalGross)}
          icon={<DollarSign className="w-6 h-6 text-green-600" />} iconBg="bg-green-100 dark:bg-green-900/30" />
        <StatCard title="Management Fees" value={formatCurrency(totalMgmtFee)}
          subtitle="Paid to manager"
          icon={<TrendingDown className="w-6 h-6 text-orange-600" />} iconBg="bg-orange-100 dark:bg-orange-900/30" />
        <StatCard title="ITAB Platform Fees" value={formatCurrency(totalItabFee)}
          icon={<TrendingDown className="w-6 h-6 text-red-600" />} iconBg="bg-red-100 dark:bg-red-900/30" />
        <StatCard title="Net Payout Received" value={formatCurrency(totalNet)}
          icon={<CheckCircle2 className="w-6 h-6 text-primary-600" />} iconBg="bg-primary-100 dark:bg-primary-900/30" />
      </div>

      {/* My Properties */}
      <div>
        <h2 className="font-bold text-slate-900 dark:text-slate-100 mb-3">My Properties</h2>
        <div className="space-y-3">
          {myProperties.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5">
              <div className="flex items-center gap-4">
                <img src={p.photos[0]} alt={p.title} className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                  onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=200'; }} />
                <div className="flex-1 min-w-0">
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{p.title}</h3>
                  <p className="text-xs text-slate-400">{p.address}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge variant={p.status === 'rented' ? 'blue' : p.status === 'published' ? 'green' : 'gray'}>
                      {p.status === 'rented' ? 'Occupied' : p.status === 'published' ? 'Vacant' : p.status}
                    </Badge>
                    {p.managerName && <span className="text-xs text-slate-400">Manager: {p.managerName}</span>}
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-primary-600">{formatCurrency(p.rentPrice)}</p>
                  <p className="text-xs text-slate-400">per month</p>
                  <p className="text-xs text-slate-400 mt-0.5">Mgmt: {p.managementFeePercent}%</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Payout History */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-bold text-slate-900 dark:text-slate-100">Payout History</h2>
          <Button variant="secondary" size="sm" icon={<FileText size={14} />} onClick={() => setShowStatementModal(true)}>
            Download Statement
          </Button>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 dark:bg-slate-800/50">
                  {['Property', 'Gross Rent', 'Mgmt Fee', 'ITAB Fee', 'Net Payout', 'Method', 'Status', 'Date'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {myPayouts.map((p, i) => (
                  <motion.tr key={p.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.04 }}
                    className="hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-300 max-w-[140px] truncate">{p.propertyTitle}</td>
                    <td className="px-4 py-3 font-semibold">{formatCurrency(p.grossRent)}</td>
                    <td className="px-4 py-3 text-orange-500">-{formatCurrency(p.managementFee)}</td>
                    <td className="px-4 py-3 text-red-500">-{formatCurrency(p.itabFee)}</td>
                    <td className="px-4 py-3 font-bold text-green-600">{formatCurrency(p.netAmount)}</td>
                    <td className="px-4 py-3 text-slate-500 capitalize text-xs">{p.method.replace('_', ' ')}</td>
                    <td className="px-4 py-3"><Badge variant={p.status === 'completed' ? 'green' : 'yellow'}>{p.status}</Badge></td>
                    <td className="px-4 py-3 text-slate-400 text-xs">{p.processedAt ? formatDate(p.processedAt) : formatDate(p.scheduledDate)}</td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Update Payout Details Modal */}
      <Modal open={showPayoutModal} onClose={() => setShowPayoutModal(false)} title="Update Payout Details"
        footer={<><Button variant="secondary" onClick={() => setShowPayoutModal(false)}>Cancel</Button><Button onClick={handleSavePayoutDetails} icon={<CheckCircle2 size={14} />}>Save Details</Button></>}>
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              ⚠️ Changes apply to the next scheduled payout. Verify your details carefully.
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Payout Method</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'mtn_momo', label: 'MTN MoMo', color: 'bg-yellow-400' },
                { value: 'airtel_money', label: 'Airtel Money', color: 'bg-red-500' },
                { value: 'bank', label: 'Bank Transfer', color: 'bg-blue-500' },
              ].map(m => (
                <button key={m.value} onClick={() => setPayoutDetails(d => ({ ...d, method: m.value as PayoutDetails['method'] }))}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${payoutDetails.method === m.value ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-600'}`}>
                  <div className={`w-6 h-6 ${m.color} rounded-full mx-auto mb-1`} />
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{m.label}</p>
                </button>
              ))}
            </div>
          </div>
          {payoutDetails.method !== 'bank' ? (
            <Input label={`${payoutDetails.method === 'mtn_momo' ? 'MTN' : 'Airtel'} Phone Number`}
              type="tel" placeholder="07XX XXX XXX"
              value={payoutDetails.phone} onChange={e => setPayoutDetails(d => ({ ...d, phone: e.target.value }))} />
          ) : (
            <div className="space-y-3">
              <Input label="Bank Name" placeholder="e.g. Stanbic Bank Uganda"
                value={payoutDetails.bankName} onChange={e => setPayoutDetails(d => ({ ...d, bankName: e.target.value }))} />
              <Input label="Account Number" placeholder="e.g. 9030012345678"
                value={payoutDetails.accountNumber} onChange={e => setPayoutDetails(d => ({ ...d, accountNumber: e.target.value }))} />
              <Input label="Account Name" placeholder="Full name as on bank account"
                value={payoutDetails.accountName} onChange={e => setPayoutDetails(d => ({ ...d, accountName: e.target.value }))} />
            </div>
          )}
        </div>
      </Modal>

      {/* Raise Dispute Modal */}
      <Modal open={showDisputeModal} onClose={() => setShowDisputeModal(false)} title="Raise a Dispute"
        footer={<><Button variant="secondary" onClick={() => setShowDisputeModal(false)}>Cancel</Button><Button variant="danger" onClick={handleRaiseDispute} icon={<Scale size={14} />}>Submit Dispute</Button></>}>
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
            <p className="text-xs text-blue-700 dark:text-blue-400">
              Disputes are reviewed by ITAB admin within 2 business days. You will be notified of the outcome.
            </p>
          </div>
          <Select label="Dispute Type" options={[
            { value: 'management_fee', label: 'Incorrect Management Fee' },
            { value: 'payout_amount', label: 'Wrong Payout Amount' },
            { value: 'missing_payout', label: 'Missing Payout' },
            { value: 'other', label: 'Other' },
          ]} />
          <Input label="Amount in Dispute (UGX)" type="number" placeholder="e.g. 150000"
            value={disputeAmount} onChange={e => setDisputeAmount(e.target.value)} />
          <Textarea label="Description" placeholder="Describe the issue in detail. Include dates, amounts, and any evidence..."
            value={disputeText} onChange={e => setDisputeText(e.target.value)} />
        </div>
      </Modal>

      {/* Download Statement Modal */}
      <Modal open={showStatementModal} onClose={() => setShowStatementModal(false)} title="Download Statement"
        footer={<Button variant="secondary" onClick={() => setShowStatementModal(false)}>Close</Button>}>
        <div className="space-y-3">
          <p className="text-sm text-slate-500">Select a period to download your financial statement (PDF).</p>
          {['April 2024', 'March 2024', 'February 2024', 'January 2024', 'Q1 2024 (Jan–Mar)', 'Full Year 2024'].map(period => (
            <button key={period} onClick={() => { handleDownloadStatement(period); setShowStatementModal(false); }}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
              <div className="flex items-center gap-3">
                <FileText size={16} className="text-primary-600" />
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{period}</span>
              </div>
              <Download size={15} className="text-slate-400" />
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
