import { useState } from 'react';
import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  Home, Heart, Search, FileText, LogOut, Bell, Scale,
  CheckCircle2, X, Plus, Trash2, RefreshCw, DollarSign, Smartphone, Banknote, Info,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { usePropertyStore } from '../../store/propertyStore';
import { useAuthStore } from '../../store/authStore';
import { useDataStore } from '../../store/dataStore';
import { noticesApi, paymentsApi } from '../../lib/api';
import { formatCurrency, formatDate, amenityIcons, DISTRICTS } from '../../lib/utils';
import { downloadLease } from '../../lib/download';
import toast from 'react-hot-toast';

interface SavedSearch {
  id: string;
  name: string;
  filters: { district?: string; type?: string; minPrice?: number; maxPrice?: number; bedrooms?: number };
  alertEnabled: boolean;
  createdAt: string;
}

export function TenantPortal() {
  const { properties } = usePropertyStore();
  const { user } = useAuthStore();
  const { payments: allPayments } = useDataStore();
  const navigate = useNavigate();

  const [tab, setTab] = useState<'lease' | 'favorites' | 'searches' | 'compare' | 'moveout' | 'renewal'>('lease');
  const [favorites, setFavorites] = useState<string[]>([]);
  const [savedSearches, setSavedSearches] = useState<SavedSearch[]>([]);
  const [compareList, setCompareList] = useState<string[]>([]);
  const [showAddSearch, setShowAddSearch] = useState(false);
  const [showMoveout, setShowMoveout] = useState(false);
  const [newSearch, setNewSearch] = useState({ name: '', district: '', type: '', minPrice: '', maxPrice: '', bedrooms: '' });
  const [moveoutForm, setMoveoutForm] = useState({ date: '', reason: '', notes: '' });
  const [moveoutLoading, setMoveoutLoading] = useState(false);

  const [renewalForm, setRenewalForm] = useState({ preferredTerm: '12', proposedRent: '', notes: '' });
  const [renewalLoading, setRenewalLoading] = useState(false);
  const [renewalSubmitted, setRenewalSubmitted] = useState(false);

  // ── Inline Pay Rent modal state (mirrors PaymentsPage modal) ──────────────
  const [showPayModal, setShowPayModal] = useState(false);
  const [payMethod, setPayMethod] = useState<'mtn_momo' | 'airtel_money' | 'card' | 'cash'>('mtn_momo');
  const [payPhone, setPayPhone] = useState(user?.phone || '');
  const [payLoading, setPayLoading] = useState(false);
  const [awaitingPin, setAwaitingPin] = useState(false);
  const [payRef, setPayRef] = useState('');
  const [payTimedOut, setPayTimedOut] = useState(false);

  const favoriteProperties = properties.filter(p => favorites.includes(p.id));
  const compareProperties  = properties.filter(p => compareList.includes(p.id));

  // Find the property this tenant is renting
  const currentProperty = properties.find(
    p => p.tenantId === user?.id && p.status === 'rented'
  ) ?? properties.find(p => p.status === 'rented') ?? null;

  // Compute real outstanding balance from payment history
  const now = new Date();
  const currentPeriod = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const periodPayments = allPayments.filter(p =>
    (p.type === 'rent' || p.type === 'rent_partial') &&
    p.propertyId === currentProperty?.id &&
    p.rentPeriod === currentPeriod &&
    p.status === 'completed'
  );
  const paidThisMonth   = periodPayments.reduce((s, p) => s + p.amount, 0);
  const inspCredit      = periodPayments.find(p => (p.inspectionCreditApplied ?? 0) > 0)?.inspectionCreditApplied ?? 0;
  const monthlyRent     = currentProperty?.rentPrice ?? 0;
  const totalDue        = Math.max(0, monthlyRent - inspCredit);
  const outstandingBalance = Math.max(0, totalDue - paidThisMonth);

  const periodLabel = new Date(currentPeriod + '-01').toLocaleDateString('en-UG', { month: 'long', year: 'numeric' });

  // ── Pay Rent handler ──────────────────────────────────────────────────────
  const handlePayRent = async () => {
    if (!currentProperty) { toast.error('No active lease found'); return; }
    if ((payMethod === 'mtn_momo' || payMethod === 'airtel_money') && !payPhone.trim()) {
      toast.error('Enter your phone number to receive the PIN prompt'); return;
    }
    if (outstandingBalance <= 0) { toast('Rent is fully paid for ' + periodLabel + '! 🎉'); return; }

    setPayLoading(true);
    try {
      const ref = `${payMethod === 'mtn_momo' ? 'MTN' : payMethod === 'airtel_money' ? 'AIR' : payMethod === 'cash' ? 'CASH' : 'CARD'}-${Date.now()}`;

      // Cash payment — record directly as completed, no PIN needed
      if (payMethod === 'cash') {
        await paymentsApi.payRent({
          propertyId: currentProperty.id,
          propertyTitle: currentProperty.title,
          amount: outstandingBalance,
          method: 'cash',
          reference: ref,
          rentPeriod: currentPeriod,
          isPartial: false,
          landlordId: currentProperty.landlordId,
          status: 'completed',
        });
        setPayLoading(false);
        setShowPayModal(false);
        toast.success(`✅ Cash payment of ${formatCurrency(outstandingBalance)} recorded for ${periodLabel}!`);
        return;
      }

      if (payMethod === 'mtn_momo') {
        await paymentsApi.initMTN({ amount: outstandingBalance, phone: payPhone, type: 'rent', propertyId: currentProperty.id, reference: ref });
      } else if (payMethod === 'airtel_money') {
        await paymentsApi.initAirtel({ amount: outstandingBalance, phone: payPhone, type: 'rent', propertyId: currentProperty.id, reference: ref });
      }

      // Record as pending — callback updates to completed
      await paymentsApi.payRent({
        propertyId: currentProperty.id,
        propertyTitle: currentProperty.title,
        amount: outstandingBalance,
        method: payMethod,
        reference: ref,
        rentPeriod: currentPeriod,
        isPartial: false,
        landlordId: currentProperty.landlordId,
        status: payMethod === 'card' ? 'completed' : 'pending',
      });

      setPayLoading(false);

      if (payMethod === 'card') {
        setShowPayModal(false);
        toast.success(`🎉 Rent of ${formatCurrency(outstandingBalance)} paid for ${periodLabel}!`);
        return;
      }

      setPayRef(ref);
      setAwaitingPin(true);
      setPayTimedOut(false);

      const result = await paymentsApi.pollStatus(ref, { intervalMs: 3000, maxAttempts: 20 });
      setAwaitingPin(false);

      if (result.status === 'completed') {
        setShowPayModal(false);
        toast.success(`🎉 Rent of ${formatCurrency(outstandingBalance)} paid for ${periodLabel}!`);
      } else {
        setPayTimedOut(true);
        toast.error('❌ Payment failed — PIN not confirmed. Check your phone balance and try again.');
      }
    } catch {
      setPayLoading(false);
      setAwaitingPin(false);
      toast.error('❌ Payment failed. Check your connection or phone balance and try again.');
    }
  };

  const removeFavorite = (id: string) => {
    setFavorites(prev => prev.filter(f => f !== id));
    toast('Removed from favorites');
  };

  const addToCompare = (id: string) => {
    if (compareList.length >= 4) { toast.error('You can compare up to 4 properties'); return; }
    if (!compareList.includes(id)) setCompareList(prev => [...prev, id]);
  };

  const removeFromCompare = (id: string) => setCompareList(prev => prev.filter(c => c !== id));

  const saveSearch = () => {
    if (!newSearch.name.trim()) { toast.error('Give your search a name'); return; }
    const ss: SavedSearch = {
      id: `ss_${Date.now()}`, name: newSearch.name,
      filters: {
        district: newSearch.district || undefined,
        type: newSearch.type || undefined,
        minPrice: newSearch.minPrice ? Number(newSearch.minPrice) : undefined,
        maxPrice: newSearch.maxPrice ? Number(newSearch.maxPrice) : undefined,
        bedrooms: newSearch.bedrooms ? Number(newSearch.bedrooms) : undefined,
      },
      alertEnabled: true, createdAt: new Date().toISOString(),
    };
    setSavedSearches(prev => [ss, ...prev]);
    setShowAddSearch(false);
    setNewSearch({ name: '', district: '', type: '', minPrice: '', maxPrice: '', bedrooms: '' });
    toast.success('Search saved! You\'ll be notified when matching properties are listed.');
  };

  const handleMoveout = async () => {
    if (!moveoutForm.date || !moveoutForm.reason) { toast.error('Please fill all required fields'); return; }
    setMoveoutLoading(true);
    try {
      // Send a notice to the manager about move-out
      await noticesApi.send({
        propertyId: currentProperty?.id || '',
        propertyTitle: currentProperty?.title || '',
        tenantId: user?.id || '',
        tenantName: `${user?.firstName} ${user?.lastName}`,
        type: 'general',
        subject: `Move-Out Notice — ${moveoutForm.date}`,
        body: `I am submitting my move-out notice. Planned move-out date: ${moveoutForm.date}.\nReason: ${moveoutForm.reason}.\n${moveoutForm.notes ? `Additional notes: ${moveoutForm.notes}` : ''}`,
        requiresAcknowledgement: true,
      });
    } catch { /* offline — will sync */ }
    setMoveoutLoading(false);
    setShowMoveout(false);
    toast.success('Move-out notice submitted! Your property manager has been notified.');
  };

  const handleRenewalRequest = async () => {
    if (!renewalForm.preferredTerm) { toast.error('Please select a preferred lease term'); return; }
    setRenewalLoading(true);
    try {
      await noticesApi.send({
        propertyId: currentProperty?.id || '',
        propertyTitle: currentProperty?.title || '',
        tenantId: user?.id || '',
        tenantName: `${user?.firstName} ${user?.lastName}`,
        type: 'lease_renewal',
        subject: `Lease Renewal Request — ${renewalForm.preferredTerm} months`,
        body: `I would like to request a lease renewal for ${renewalForm.preferredTerm} months.${renewalForm.proposedRent ? `\nProposed rent: UGX ${renewalForm.proposedRent}` : ''}${renewalForm.notes ? `\nNotes: ${renewalForm.notes}` : ''}`,
        requiresAcknowledgement: false,
      });
    } catch { /* offline */ }
    setRenewalLoading(false);
    setRenewalSubmitted(true);
    toast.success('Renewal request submitted! Your property manager will respond within 5 business days.');
  };

  const tabs = [
    { key: 'lease',   label: 'My Lease',          icon: <Home size={15} /> },
    { key: 'renewal', label: 'Renewal Request',    icon: <RefreshCw size={15} /> },
    { key: 'favorites', label: `Favorites (${favorites.length})`, icon: <Heart size={15} /> },
    { key: 'searches', label: 'Saved Searches',    icon: <Search size={15} /> },
    { key: 'compare', label: 'Compare',            icon: <Scale size={15} /> },
    { key: 'moveout', label: 'Move Out',           icon: <LogOut size={15} /> },
  ] as const;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">My Tenant Portal</h1>
        <p className="text-sm text-slate-500 mt-0.5">Manage your lease, favorites, and searches</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 overflow-x-auto">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${tab === t.key ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100' : 'text-slate-500'}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {/* ── My Lease ─────────────────────────────────────────────────── */}
      {tab === 'lease' && (
        <div className="space-y-4">
          {currentProperty ? (
            <>
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden">
                <img src={currentProperty.photos[0]} alt={currentProperty.title} className="w-full h-40 object-cover" />
                <div className="p-5">
                  <h2 className="font-bold text-slate-900 dark:text-slate-100">{currentProperty.title}</h2>
                  <p className="text-sm text-slate-400 mt-0.5">{currentProperty.address}</p>
                  <div className="grid grid-cols-2 gap-3 mt-4 text-sm">
                    {[
                      { label: 'Monthly Rent', value: formatCurrency(currentProperty.rentPrice) },
                      { label: 'Lease Start', value: currentProperty.leaseStart ? formatDate(currentProperty.leaseStart) : '—' },
                      { label: 'Lease End', value: currentProperty.leaseEnd ? formatDate(currentProperty.leaseEnd) : '—' },
                      { label: 'Manager', value: currentProperty.managerName || '—' },
                    ].map(row => (
                      <div key={row.label} className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                        <p className="text-xs text-slate-400">{row.label}</p>
                        <p className="font-semibold text-slate-900 dark:text-slate-100 mt-0.5">{row.value}</p>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button variant="secondary" className="flex-1" icon={<FileText size={14} />} onClick={() => {
                      if (currentProperty) {
                        downloadLease({
                          tenantName: `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'Tenant',
                          propertyTitle: currentProperty.title,
                          address: currentProperty.address,
                          rentAmount: currentProperty.rentPrice,
                          depositAmount: currentProperty.deposit,
                          leaseStart: currentProperty.leaseStart || new Date().toISOString(),
                          leaseEnd: currentProperty.leaseEnd || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
                          managerName: currentProperty.managerName || 'Property Manager',
                        });
                      }
                    }}>
                      Download Lease
                    </Button>
                    <Button variant="danger" className="flex-1" icon={<LogOut size={14} />} onClick={() => setShowMoveout(true)}>
                      Submit Move-Out Notice
                    </Button>
                  </div>
                </div>
              </div>
              {/* Current balance */}
              <div className={`bg-white dark:bg-slate-800 rounded-2xl shadow-card border p-5 ${outstandingBalance > 0 ? 'border-red-200 dark:border-red-900/40' : 'border-green-200 dark:border-green-900/40'}`}>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-3">
                  Current Rent Balance — <span className="text-slate-500 font-normal text-sm">{periodLabel}</span>
                </h3>
                <div className="flex items-center justify-between mb-3">
                  <div>
                    {outstandingBalance > 0 ? (
                      <>
                        <p className="text-2xl font-bold text-red-500">{formatCurrency(outstandingBalance)}</p>
                        <p className="text-xs text-slate-400">Outstanding this month</p>
                      </>
                    ) : (
                      <>
                        <p className="text-2xl font-bold text-green-600">✓ Fully Paid</p>
                        <p className="text-xs text-slate-400">{formatCurrency(paidThisMonth)} paid for {periodLabel}</p>
                      </>
                    )}
                  </div>
                  <Button
                    onClick={() => outstandingBalance > 0 ? setShowPayModal(true) : toast('Rent is fully paid for ' + periodLabel + '! 🎉')}
                    variant={outstandingBalance > 0 ? 'gold' : 'secondary'}
                    icon={<CheckCircle2 size={14} />}
                  >
                    {outstandingBalance > 0 ? 'Pay Now' : 'All Paid ✓'}
                  </Button>
                </div>
                {/* Progress bar */}
                {monthlyRent > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>Paid: {formatCurrency(paidThisMonth)}</span>
                      <span>Total: {formatCurrency(totalDue)}</span>
                    </div>
                    <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-700 ${outstandingBalance <= 0 ? 'bg-green-500' : 'bg-amber-400'}`}
                        style={{ width: `${Math.min(100, Math.round((paidThisMonth / totalDue) * 100))}%` }}
                      />
                    </div>
                    {inspCredit > 0 && (
                      <p className="text-xs text-green-600 flex items-center gap-1">
                        <CheckCircle2 size={11} /> {formatCurrency(inspCredit)} inspection credit applied
                      </p>
                    )}
                  </div>
                )}
              </div>
            </>
          ) : (
            <EmptyState icon={<Home size={28} />} title="No active lease" description="You don't have an active lease. Browse properties to find your next home." action={<Button onClick={() => navigate('/search')}>Browse Properties</Button>} />
          )}
        </div>
      )}

      {/* ── Favorites ────────────────────────────────────────────────── */}
      {tab === 'favorites' && (
        favoriteProperties.length === 0 ? (
          <EmptyState icon={<Heart size={28} />} title="No saved favorites" description="Heart any property to save it here for later." action={<Button onClick={() => navigate('/search')}>Browse Properties</Button>} />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {favoriteProperties.map((p, i) => (
              <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden">
                <div className="relative h-36">
                  <img src={p.photos[0]} alt={p.title} className="w-full h-full object-cover" />
                  <button onClick={() => removeFavorite(p.id)}
                    className="absolute top-2 right-2 w-7 h-7 bg-white/90 rounded-full flex items-center justify-center hover:bg-red-50 transition-colors">
                    <X size={14} className="text-red-500" />
                  </button>
                </div>
                <div className="p-4">
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm line-clamp-1">{p.title}</h3>
                  <p className="text-xs text-slate-400">{p.district}</p>
                  <div className="flex items-center justify-between mt-3">
                    <p className="font-bold text-primary-600">{formatCurrency(p.rentPrice)}/mo</p>
                    <div className="flex gap-1.5">
                      <Button size="sm" variant="secondary" onClick={() => addToCompare(p.id)}>Compare</Button>
                      <Button size="sm" onClick={() => navigate(`/properties/${p.id}`)}>View</Button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )
      )}

      {/* ── Saved Searches ───────────────────────────────────────────── */}
      {tab === 'searches' && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <Button icon={<Plus size={15} />} onClick={() => setShowAddSearch(true)}>Save New Search</Button>
          </div>
          {savedSearches.length === 0 ? (
            <EmptyState icon={<Search size={28} />} title="No saved searches" description="Save your search filters to get notified when matching properties are listed." />
          ) : (
            <div className="space-y-3">
              {savedSearches.map((ss, i) => (
                <motion.div key={ss.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                  className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{ss.name}</h3>
                        {ss.alertEnabled && <Badge variant="green"><Bell size={10} /> Alerts On</Badge>}
                      </div>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        {ss.filters.district && <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">{ss.filters.district}</span>}
                        {ss.filters.type && <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full capitalize">{ss.filters.type}</span>}
                        {ss.filters.bedrooms && <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">{ss.filters.bedrooms}+ beds</span>}
                        {ss.filters.maxPrice && <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">Max {formatCurrency(ss.filters.maxPrice)}</span>}
                      </div>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <Button size="sm" variant="secondary" onClick={() => navigate(`/search?saved=${ss.id}`)}>Search</Button>
                      <button onClick={() => setSavedSearches(prev => prev.filter(s => s.id !== ss.id))}
                        className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Compare ──────────────────────────────────────────────────── */}
      {tab === 'compare' && (
        <div className="space-y-4">
          {compareProperties.length < 2 ? (
            <EmptyState icon={<Scale size={28} />} title="Add properties to compare" description="Add at least 2 properties from your favorites or search results to compare side by side." action={<Button onClick={() => setTab('favorites')}>Go to Favorites</Button>} />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[600px]">
                <thead>
                  <tr>
                    <td className="p-3 font-semibold text-slate-500 text-xs uppercase tracking-wider w-32">Feature</td>
                    {compareProperties.map(p => (
                      <td key={p.id} className="p-3">
                        <div className="relative">
                          <img src={p.photos[0]} alt={p.title} className="w-full h-28 object-cover rounded-xl mb-2" />
                          <button onClick={() => removeFromCompare(p.id)}
                            className="absolute top-1 right-1 w-6 h-6 bg-white/90 rounded-full flex items-center justify-center">
                            <X size={12} className="text-red-500" />
                          </button>
                          <p className="font-bold text-slate-900 dark:text-slate-100 text-xs line-clamp-2">{p.title}</p>
                        </div>
                      </td>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { label: 'Rent/Month', getValue: (p: typeof compareProperties[0]) => formatCurrency(p.rentPrice) },
                    { label: 'Deposit', getValue: (p: typeof compareProperties[0]) => formatCurrency(p.deposit) },
                    { label: 'Bedrooms', getValue: (p: typeof compareProperties[0]) => `${p.bedrooms} bed` },
                    { label: 'Bathrooms', getValue: (p: typeof compareProperties[0]) => `${p.bathrooms} bath` },
                    { label: 'Size', getValue: (p: typeof compareProperties[0]) => p.squareFootage ? `${p.squareFootage} m²` : '—' },
                    { label: 'District', getValue: (p: typeof compareProperties[0]) => p.district },
                    { label: 'Type', getValue: (p: typeof compareProperties[0]) => p.type },
                    { label: 'Amenities', getValue: (p: typeof compareProperties[0]) => p.amenities.slice(0, 3).map(a => amenityIcons[a] || '✨').join(' ') + (p.amenities.length > 3 ? ` +${p.amenities.length - 3}` : '') },
                  ].map(row => (
                    <tr key={row.label} className="border-t border-slate-100 dark:border-slate-700">
                      <td className="p-3 text-xs font-semibold text-slate-500">{row.label}</td>
                      {compareProperties.map(p => (
                        <td key={p.id} className="p-3 text-sm text-slate-700 dark:text-slate-300">{row.getValue(p)}</td>
                      ))}
                    </tr>
                  ))}
                  <tr className="border-t border-slate-100 dark:border-slate-700">
                    <td className="p-3" />
                    {compareProperties.map(p => (
                      <td key={p.id} className="p-3">
                        <Button size="sm" className="w-full" onClick={() => navigate(`/properties/${p.id}`)}>View</Button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── Renewal Request ──────────────────────────────────────────── */}
      {tab === 'renewal' && (
        <div className="space-y-4 max-w-lg">
          {renewalSubmitted ? (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-green-200 dark:border-green-800 p-6 text-center space-y-4">
              <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-2xl flex items-center justify-center mx-auto">
                <CheckCircle2 size={28} className="text-green-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100">Renewal Request Submitted</h3>
                <p className="text-sm text-slate-500 mt-1">Your property manager will review your request and respond within 5 business days.</p>
              </div>
              <Button variant="secondary" onClick={() => setRenewalSubmitted(false)}>Submit Another Request</Button>
            </div>
          ) : (
            <>
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4">
                <p className="font-semibold text-green-800 dark:text-green-300 text-sm flex items-center gap-2">
                  <RefreshCw size={15} /> Request Lease Renewal
                </p>
                <p className="text-xs text-green-700 dark:text-green-400 mt-1">
                  Submit a renewal request to your property manager. They will review and respond with the new lease terms.
                </p>
              </div>

              {currentProperty && (
                <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-4">
                  <p className="text-xs text-slate-400 mb-1">Current lease</p>
                  <p className="font-semibold text-slate-900 dark:text-slate-100">{currentProperty.title}</p>
                  <div className="flex gap-4 mt-2 text-xs text-slate-500">
                    <span>Expires: <strong>{currentProperty.leaseEnd ? formatDate(currentProperty.leaseEnd) : '—'}</strong></span>
                    <span>Rent: <strong>{formatCurrency(currentProperty.rentPrice)}/mo</strong></span>
                  </div>
                </div>
              )}

              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5 space-y-4">
                <Select
                  label="Preferred Lease Term *"
                  value={renewalForm.preferredTerm}
                  onChange={e => setRenewalForm(f => ({ ...f, preferredTerm: e.target.value }))}
                  options={[
                    { value: '6',  label: '6 months' },
                    { value: '12', label: '12 months (1 year)' },
                    { value: '24', label: '24 months (2 years)' },
                    { value: '36', label: '36 months (3 years)' },
                  ]}
                />
                <Input
                  label="Proposed Monthly Rent (optional)"
                  type="number"
                  placeholder={currentProperty ? String(currentProperty.rentPrice) : 'Current rent'}
                  value={renewalForm.proposedRent}
                  onChange={e => setRenewalForm(f => ({ ...f, proposedRent: e.target.value }))}
                  hint="Leave blank to accept the manager's proposed rent"
                  icon={<DollarSign size={14} />}
                />
                <Textarea
                  label="Additional Notes (optional)"
                  placeholder="Any special requests or conditions for the renewal..."
                  value={renewalForm.notes}
                  onChange={e => setRenewalForm(f => ({ ...f, notes: e.target.value }))}
                  rows={3}
                />
                <Button
                  className="w-full"
                  size="lg"
                  loading={renewalLoading}
                  onClick={handleRenewalRequest}
                  icon={<RefreshCw size={15} />}
                >
                  Submit Renewal Request
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Move Out ─────────────────────────────────────────────────── */}
      {tab === 'moveout' && (        <div className="space-y-4 max-w-lg">
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
            <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">Before you submit a move-out notice</p>
            <ul className="mt-2 space-y-1 text-xs text-amber-700 dark:text-amber-400 list-disc list-inside">
              <li>Ensure all outstanding rent is paid</li>
              <li>Give at least 30 days notice as per your lease</li>
              <li>Arrange a move-out inspection with your manager</li>
              <li>Your deposit will be refunded after deductions are assessed</li>
            </ul>
          </div>
          <Button className="w-full" size="lg" variant="danger" icon={<LogOut size={16} />} onClick={() => setShowMoveout(true)}>
            Submit Move-Out Notice
          </Button>
        </div>
      )}

      {/* Save Search Modal */}
      <Modal open={showAddSearch} onClose={() => setShowAddSearch(false)} title="Save Search"
        footer={<><Button variant="secondary" onClick={() => setShowAddSearch(false)}>Cancel</Button><Button onClick={saveSearch} icon={<Bell size={14} />}>Save & Enable Alerts</Button></>}>
        <div className="space-y-4">
          <Input label="Search Name *" placeholder="e.g. 2BR in Kampala under 1.5M" value={newSearch.name} onChange={e => setNewSearch(f => ({ ...f, name: e.target.value }))} />
          <div className="grid grid-cols-2 gap-3">
            <Select label="District" value={newSearch.district} onChange={e => setNewSearch(f => ({ ...f, district: e.target.value }))}
              options={[{ value: '', label: 'Any' }, ...DISTRICTS.map(d => ({ value: d, label: d }))]} />
            <Select label="Property Type" value={newSearch.type} onChange={e => setNewSearch(f => ({ ...f, type: e.target.value }))}
              options={[{ value: '', label: 'Any' }, { value: 'apartment', label: 'Apartment' }, { value: 'house', label: 'House' }, { value: 'commercial', label: 'Commercial' }]} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Min Price (UGX)" type="number" placeholder="0" value={newSearch.minPrice} onChange={e => setNewSearch(f => ({ ...f, minPrice: e.target.value }))} />
            <Input label="Max Price (UGX)" type="number" placeholder="Any" value={newSearch.maxPrice} onChange={e => setNewSearch(f => ({ ...f, maxPrice: e.target.value }))} />
          </div>
          <Input label="Min Bedrooms" type="number" placeholder="Any" value={newSearch.bedrooms} onChange={e => setNewSearch(f => ({ ...f, bedrooms: e.target.value }))} />
        </div>
      </Modal>

      {/* Move-Out Modal */}
      <Modal open={showMoveout} onClose={() => setShowMoveout(false)} title="Submit Move-Out Notice"
        footer={<><Button variant="secondary" onClick={() => setShowMoveout(false)}>Cancel</Button><Button variant="danger" loading={moveoutLoading} onClick={handleMoveout} icon={<LogOut size={14} />}>Submit Notice</Button></>}>
        <div className="space-y-4">
          <Input label="Move-Out Date *" type="date" value={moveoutForm.date} onChange={e => setMoveoutForm(f => ({ ...f, date: e.target.value }))}
            hint="Must be at least 30 days from today" min={new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]} />
          <Select label="Reason for Moving *" value={moveoutForm.reason} onChange={e => setMoveoutForm(f => ({ ...f, reason: e.target.value }))}
            options={[
              { value: '', label: 'Select reason...' },
              { value: 'relocating', label: 'Relocating to another area' },
              { value: 'buying', label: 'Buying my own property' },
              { value: 'affordability', label: 'Rent is too high' },
              { value: 'property_issues', label: 'Issues with the property' },
              { value: 'personal', label: 'Personal reasons' },
              { value: 'other', label: 'Other' },
            ]} />
          <Textarea label="Additional Notes" placeholder="Any additional information for your property manager..." value={moveoutForm.notes} onChange={e => setMoveoutForm(f => ({ ...f, notes: e.target.value }))} />
        </div>
      </Modal>

      {/* ── Pay Rent Modal ────────────────────────────────────────────── */}
      <Modal
        open={showPayModal}
        onClose={awaitingPin ? () => {} : () => { setShowPayModal(false); setAwaitingPin(false); setPayTimedOut(false); }}
        title={`Pay Rent — ${periodLabel}`}
        size="sm"
        footer={
          awaitingPin ? (
            <div className="w-full flex flex-col items-center gap-2 py-1">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Waiting for PIN confirmation...</span>
              </div>
              {payTimedOut && (
                <Button size="sm" variant="secondary" onClick={() => { setAwaitingPin(false); setPayTimedOut(false); }}>
                  Try Again
                </Button>
              )}
            </div>
          ) : (
            <>
              <Button variant="secondary" onClick={() => setShowPayModal(false)}>Cancel</Button>
              <Button loading={payLoading} onClick={handlePayRent} icon={<Banknote size={14} />}>
                Pay {formatCurrency(outstandingBalance)}
              </Button>
            </>
          )
        }
      >
        <div className="space-y-4">
          {/* PIN awaiting state */}
          {awaitingPin && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-3 p-5 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700 rounded-2xl text-center">
              <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <div>
                <p className="font-bold text-primary-800 dark:text-primary-300">Check your phone!</p>
                <p className="text-sm text-primary-600 dark:text-primary-400 mt-1">
                  A {payMethod === 'mtn_momo' ? 'MTN MoMo' : 'Airtel Money'} prompt was sent to <strong>{payPhone}</strong>.
                </p>
                <p className="text-sm text-primary-600 dark:text-primary-400 mt-1">
                  Enter your PIN to pay <strong>{formatCurrency(outstandingBalance)}</strong>.
                </p>
                <p className="text-xs text-slate-400 mt-2">ref: {payRef}</p>
              </div>
            </motion.div>
          )}

          {!awaitingPin && (
            <>
              {/* Summary */}
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-2">
                <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{currentProperty?.title}</p>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Period</span><span className="font-medium">{periodLabel}</span>
                </div>
                <div className="flex justify-between text-xs text-slate-500">
                  <span>Monthly rent</span><span>{formatCurrency(monthlyRent)}</span>
                </div>
                {inspCredit > 0 && (
                  <div className="flex justify-between text-xs text-green-600">
                    <span>Inspection credit</span><span>-{formatCurrency(inspCredit)}</span>
                  </div>
                )}
                {paidThisMonth > 0 && (
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Already paid</span><span>-{formatCurrency(paidThisMonth)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-sm text-slate-900 dark:text-slate-100 border-t border-slate-200 dark:border-slate-600 pt-2">
                  <span>Paying now</span><span className="text-green-600">{formatCurrency(outstandingBalance)}</span>
                </div>
              </div>

              {/* Method selector */}
              <div>
                <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Payment method</p>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'mtn_momo'     as const, label: 'MTN MoMo',    color: 'bg-yellow-400' },
                    { value: 'airtel_money' as const, label: 'Airtel Money', color: 'bg-red-500'    },
                    { value: 'card'         as const, label: 'Card',         color: 'bg-blue-500'   },
                    { value: 'cash'         as const, label: 'Cash',         color: 'bg-green-600'  },
                  ].map(m => (
                    <button key={m.value} onClick={() => setPayMethod(m.value)}
                      className={`p-3 rounded-xl border-2 text-center transition-all ${payMethod === m.value ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-600'}`}>
                      <div className={`w-6 h-6 ${m.color} rounded-full mx-auto mb-1`} />
                      <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{m.label}</p>
                    </button>
                  ))}
                </div>
              </div>

              {/* Phone input for mobile money */}
              {(payMethod === 'mtn_momo' || payMethod === 'airtel_money') && (
                <Input
                  label={`${payMethod === 'mtn_momo' ? 'MTN' : 'Airtel'} Phone Number`}
                  type="tel"
                  placeholder="07XX XXX XXX"
                  value={payPhone}
                  onChange={e => setPayPhone(e.target.value)}
                  icon={<Smartphone size={15} />}
                  hint="You will receive a PIN prompt on this number"
                />
              )}

              {/* Card note */}
              {payMethod === 'card' && (
                <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-xs text-blue-700 dark:text-blue-400 flex gap-2">
                  <Info size={14} className="flex-shrink-0 mt-0.5" />
                  Card payments are processed securely. You'll be charged {formatCurrency(outstandingBalance)}.
                </div>
              )}

              {/* Cash note */}
              {payMethod === 'cash' && (
                <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-xs text-green-700 dark:text-green-400 flex gap-2">
                  <Banknote size={14} className="flex-shrink-0 mt-0.5" />
                  Cash payment will be recorded immediately as completed.
                </div>
              )}
            </>
          )}
        </div>
      </Modal>
    </div>
  );
}
