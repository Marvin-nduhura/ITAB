import { useState } from 'react';
import { motion } from 'framer-motion';
import { DollarSign, CheckCircle2, Clock, XCircle, RefreshCw, Download } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { StatCard } from '../components/ui/Card';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuthStore } from '../store/authStore';
import { useDataStore } from '../store/dataStore';
import { usePropertyStore } from '../store/propertyStore';
import { formatCurrency, formatDate } from '../lib/utils';
import { downloadPayoutReport, downloadStatement } from '../lib/download';
import { filterPayoutsForUser } from '../lib/rbac';
import toast from 'react-hot-toast';

export function PayoutsPage() {
  const { user } = useAuthStore();
  const { payouts: allPayouts } = useDataStore();
  const { properties: allProperties } = usePropertyStore();
  const [loading, setLoading] = useState<string | null>(null);

  const myPayouts = filterPayoutsForUser(allPayouts, user, allProperties);

  const totalPaid = myPayouts.filter(p => p.status === 'completed').reduce((s, p) => s + p.netAmount, 0);
  const totalPending = myPayouts.filter(p => p.status === 'pending').reduce((s, p) => s + p.netAmount, 0);
  const totalFees = myPayouts.reduce((s, p) => s + p.managementFee + p.itabFee, 0);

  const handleProcess = async (id: string) => {
    setLoading(id);
    try {
      const { payoutsApi } = await import('../lib/api');
      if (myPayouts.find(p => p.id === id)?.status === 'failed') {
        await payoutsApi.retry(id);
      } else {
        await payoutsApi.process(id);
      }
      toast.success('Payout processed successfully!');
    } catch {
      toast.error('Failed to process payout. Please try again.');
    } finally {
      setLoading(null);
    }
  };

  const statusVariant = (s: string): 'green' | 'yellow' | 'red' | 'blue' => {
    const m: Record<string, 'green' | 'yellow' | 'red' | 'blue'> = { completed: 'green', pending: 'yellow', failed: 'red', processing: 'blue' };
    return m[s] || 'gray' as 'green';
  };

  const statusIcon = (s: string) => {
    if (s === 'completed') return <CheckCircle2 size={16} className="text-green-500" />;
    if (s === 'failed') return <XCircle size={16} className="text-red-500" />;
    if (s === 'processing') return <RefreshCw size={16} className="text-blue-500 animate-spin" />;
    return <Clock size={16} className="text-yellow-500" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Payouts</h1>
          <p className="text-sm text-slate-500 mt-0.5">Landlord payout management</p>
        </div>
        <Button variant="secondary" icon={<Download size={15} />} onClick={() => downloadPayoutReport(myPayouts)}>Export</Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard title="Total Paid Out" value={formatCurrency(totalPaid)} icon={<CheckCircle2 className="w-6 h-6 text-green-600" />} iconBg="bg-green-100 dark:bg-green-900/30" />
        <StatCard title="Pending Payouts" value={formatCurrency(totalPending)} icon={<Clock className="w-6 h-6 text-yellow-600" />} iconBg="bg-yellow-100 dark:bg-yellow-900/30" />
        <StatCard title="Total Fees Collected" value={formatCurrency(totalFees)} icon={<DollarSign className="w-6 h-6 text-primary-600" />} iconBg="bg-primary-100 dark:bg-primary-900/30" />
      </div>

      {myPayouts.length === 0 ? (
        <EmptyState icon={<DollarSign size={28} />} title="No payouts yet" description="Payouts will appear here once rent is collected." />
      ) : (
        <div className="space-y-3">
          {myPayouts.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {statusIcon(p.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{p.landlordName}</h3>
                      <Badge variant={statusVariant(p.status)}>{p.status}</Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{p.propertyTitle}</p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                      <div>
                        <p className="text-xs text-slate-400">Gross Rent</p>
                        <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(p.grossRent)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Mgmt Fee ({((p.managementFee / p.grossRent) * 100).toFixed(0)}%)</p>
                        <p className="text-sm font-semibold text-red-500">-{formatCurrency(p.managementFee)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">ITAB Fee</p>
                        <p className="text-sm font-semibold text-red-500">-{formatCurrency(p.itabFee)}</p>
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">Net Payout</p>
                        <p className="text-sm font-bold text-green-600">{formatCurrency(p.netAmount)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <span>Scheduled: {formatDate(p.scheduledDate)}</span>
                      {p.processedAt && <span>Processed: {formatDate(p.processedAt)}</span>}
                      {p.reference && <span className="font-mono">{p.reference}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  {p.status === 'pending' && (
                    <Button size="sm" loading={loading === p.id} onClick={() => handleProcess(p.id)}>Process</Button>
                  )}
                  {p.status === 'failed' && (
                    <Button size="sm" variant="secondary" loading={loading === p.id} onClick={() => handleProcess(p.id)} icon={<RefreshCw size={13} />}>Retry</Button>
                  )}
                  <Button size="sm" variant="ghost" icon={<Download size={13} />} onClick={() => {
                      downloadStatement({
                        landlordName: p.landlordName,
                        period: p.scheduledDate,
                        properties: [{ title: p.propertyTitle, grossRent: p.grossRent, managementFee: p.managementFee, itabFee: p.itabFee, netPayout: p.netAmount }],
                      });
                    }}>Statement</Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
