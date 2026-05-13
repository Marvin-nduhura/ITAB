import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Plus, Send, Eye, CheckCircle2, Clock,
  DollarSign, Star, Building2,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { StatCard } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { usePropertyStore } from '../../store/propertyStore';
import { useAuthStore } from '../../store/authStore';
import { usePaymentStore } from '../../store/paymentStore';
import { PropertyFormModal } from '../../components/property/PropertyFormModal';
import { formatCurrency, formatDate, propertyStatusConfig } from '../../lib/utils';
import toast from 'react-hot-toast';

export function AgentPortal() {
  const { user } = useAuthStore();
  const { properties, updateProperty } = usePropertyStore();
  const navigate = useNavigate();
  const [showAddModal, setShowAddModal] = useState(false);
  const [_showClaimPool, setShowClaimPool] = useState(false);
  const [tab, setTab] = useState<'my_listings' | 'commissions' | 'pool'>('my_listings');
  const transactions = usePaymentStore(s => s.transactions);

  const myProperties = properties.filter(p =>
    p.managerId === user?.id ||
    (!p.managerId && p.id.startsWith('p_'))
  );

  const unassignedPool = properties.filter(p => !p.managerId && p.status !== 'rejected');

  const agentIncoming = useMemo(() => {
    if (!user?.id) return [];
    return transactions.filter(
      t => t.receiverId === user.id && ['completed', 'processing', 'pending'].includes(t.status)
    );
  }, [transactions, user?.id]);

  const totalCommission = agentIncoming.reduce((s, t) => s + t.amount, 0);
  const paidCommission = agentIncoming.filter(t => t.status === 'completed').reduce((s, t) => s + t.amount, 0);
  const pendingCommission = agentIncoming.filter(t => t.status === 'pending' || t.status === 'processing').reduce((s, t) => s + t.amount, 0);

  const submitForApproval = (propertyId: string) => {
    updateProperty(propertyId, { status: 'pending_vetting' });
    toast.success('Property submitted for manager approval!');
  };

  const claimProperty = (propertyId: string) => {
    updateProperty(propertyId, { managerId: user?.id, managerName: `${user?.firstName} ${user?.lastName}` });
    setShowClaimPool(false);
    toast.success('Property claimed! You are now responsible for this listing.');
  };

  const statusVariant = (s: string): 'blue' | 'green' | 'yellow' | 'red' | 'gray' | 'purple' => {
    const m: Record<string, 'blue' | 'green' | 'yellow' | 'red' | 'gray' | 'purple'> = {
      published: 'green', rented: 'blue', draft: 'gray', pending_vetting: 'yellow', rejected: 'red',
    };
    return m[s] || 'gray';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Agent Portal</h1>
          <p className="text-sm text-slate-500 mt-0.5">Manage your listings and track commissions</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setShowAddModal(true)}>New Listing</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard title="My Listings" value={myProperties.length}
          icon={<Building2 className="w-6 h-6 text-primary-600" />} iconBg="bg-primary-100 dark:bg-primary-900/30" />
        <StatCard title="Total Commission" value={formatCurrency(totalCommission)}
          icon={<DollarSign className="w-6 h-6 text-green-600" />} iconBg="bg-green-100 dark:bg-green-900/30" />
        <StatCard title="Paid Out" value={formatCurrency(paidCommission)}
          icon={<CheckCircle2 className="w-6 h-6 text-blue-600" />} iconBg="bg-blue-100 dark:bg-blue-900/30" />
        <StatCard title="Pending" value={formatCurrency(pendingCommission)}
          icon={<Clock className="w-6 h-6 text-yellow-600" />} iconBg="bg-yellow-100 dark:bg-yellow-900/30" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
        {([['my_listings', 'My Listings'], ['commissions', 'Commissions'], ['pool', `Unassigned Pool (${unassignedPool.length})`]] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${tab === key ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100' : 'text-slate-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* My Listings */}
      {tab === 'my_listings' && (
        myProperties.length === 0 ? (
          <EmptyState icon={<Building2 size={28} />} title="No listings yet"
            description="Create your first property listing to get started."
            action={<Button onClick={() => setShowAddModal(true)} icon={<Plus size={15} />}>Create Listing</Button>} />
        ) : (
          <div className="space-y-3">
            {myProperties.map((p, i) => {
              const sc = propertyStatusConfig[p.status] || { label: p.status, color: 'badge-gray' };
              return (
                <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1 min-w-0">
                      <img src={p.photos[0]} alt={p.title} className="w-14 h-14 rounded-xl object-cover flex-shrink-0"
                        onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=200'; }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{p.title}</h3>
                          <Badge variant={statusVariant(p.status)}>{sc.label}</Badge>
                          {p.status === 'rejected' && (
                            <Badge variant="red">Needs update</Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">{p.address} · {formatCurrency(p.rentPrice)}/mo</p>
                        {p.status === 'rejected' && (
                          <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                            This listing was not approved. Update the details and resubmit for vetting.
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 flex-shrink-0">
                      <Button size="sm" variant="secondary" icon={<Eye size={12} />} onClick={() => navigate(`/properties/${p.id}`)}>View</Button>
                      {p.status === 'draft' && (
                        <Button size="sm" icon={<Send size={12} />} onClick={() => submitForApproval(p.id)}>Submit</Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )
      )}

      {/* Commissions — from synced platform transactions (Render-backed store) */}
      {tab === 'commissions' && (
        agentIncoming.length === 0 ? (
          <EmptyState
            icon={<DollarSign size={28} />}
            title="No commission activity yet"
            description="Payments where you are the recipient will appear here after they sync from the server."
          />
        ) : (
          <div className="space-y-3">
            {agentIncoming.map((c, i) => (
              <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${c.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30'}`}>
                    {c.status === 'completed' ? <CheckCircle2 size={18} className="text-green-600" /> : <Clock size={18} className="text-yellow-600" />}
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{c.propertyTitle || c.description}</p>
                    <p className="text-xs text-slate-400">{c.type.replace(/_/g, ' ')} · {formatDate(c.createdAt)}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">{formatCurrency(c.amount)}</p>
                  <Badge variant={c.status === 'completed' ? 'green' : 'yellow'}>{c.status}</Badge>
                </div>
              </motion.div>
            ))}
          </div>
        )
      )}

      {/* Unassigned Pool */}
      {tab === 'pool' && (
        unassignedPool.length === 0 ? (
          <EmptyState icon={<Building2 size={28} />} title="No unassigned properties" description="Properties added by landlords without a manager will appear here for you to claim." />
        ) : (
          <div className="space-y-3">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-4 text-sm text-blue-700 dark:text-blue-300">
              💡 Claim a property to become its responsible agent. You'll earn commission when a lease is signed.
            </div>
            {unassignedPool.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <img src={p.photos[0]} alt={p.title} className="w-12 h-12 rounded-xl object-cover"
                    onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=200'; }} />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{p.title}</p>
                    <p className="text-xs text-slate-400">{p.district} · {formatCurrency(p.rentPrice)}/mo</p>
                  </div>
                </div>
                <Button size="sm" icon={<Star size={13} />} onClick={() => claimProperty(p.id)}>Claim</Button>
              </motion.div>
            ))}
          </div>
        )
      )}

      {/* Add Property Modal */}
      <PropertyFormModal open={showAddModal} onClose={() => setShowAddModal(false)} />
    </div>
  );
}
