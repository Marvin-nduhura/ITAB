import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Briefcase, Plus, Star, Phone, Mail, MapPin, CheckCircle2,
  Wrench, Ban, UserCheck, Search, X,
  Hammer, Zap, Droplets, Paintbrush, Scissors, Trash2, Shield,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input, Select, Textarea } from '../components/ui/Input';
import { Avatar } from '../components/ui/Avatar';
import { EmptyState } from '../components/ui/EmptyState';
import { useVendorStore } from '../store/vendorStore';
import { useAuthStore } from '../store/authStore';
import { formatDate, formatCurrency } from '../lib/utils';
import { canDo } from '../lib/rbac';
import type { Vendor, VendorCategory } from '../types';
import toast from 'react-hot-toast';

// ─── Category config ──────────────────────────────────────────────────────────
const categoryConfig: Record<VendorCategory, { label: string; icon: React.ReactNode; color: string }> = {
  plumber:           { label: 'Plumber',           icon: <Droplets size={16} />,  color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600' },
  electrician:       { label: 'Electrician',       icon: <Zap size={16} />,       color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-600' },
  cleaner:           { label: 'Cleaner',           icon: <Scissors size={16} />,  color: 'bg-green-100 dark:bg-green-900/30 text-green-600' },
  mason:             { label: 'Mason',             icon: <Hammer size={16} />,    color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600' },
  gardener:          { label: 'Gardener',          icon: <Scissors size={16} />,  color: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600' },
  garbage_collector: { label: 'Garbage Collector', icon: <Trash2 size={16} />,   color: 'bg-slate-100 dark:bg-slate-700 text-slate-600' },
  security:          { label: 'Security',          icon: <Shield size={16} />,    color: 'bg-red-100 dark:bg-red-900/30 text-red-600' },
  painter:           { label: 'Painter',           icon: <Paintbrush size={16} />,color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600' },
  carpenter:         { label: 'Carpenter',         icon: <Hammer size={16} />,    color: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600' },
  welder:            { label: 'Welder',            icon: <Wrench size={16} />,    color: 'bg-gray-100 dark:bg-gray-700 text-gray-600' },
  other:             { label: 'Other',             icon: <Briefcase size={16} />, color: 'bg-slate-100 dark:bg-slate-700 text-slate-600' },
};

// ─── Star rating display ──────────────────────────────────────────────────────
function StarRating({ rating, size = 14 }: { rating: number; size?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <Star key={s} size={size}
          className={s <= Math.round(rating) ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-600'} />
      ))}
      <span className="text-xs text-slate-500 ml-1">{rating.toFixed(1)}</span>
    </div>
  );
}

// ─── Vendor Card ──────────────────────────────────────────────────────────────
interface VendorCardProps {
  vendor: Vendor;
  onView: (v: Vendor) => void;
  onSuspend?: (v: Vendor) => void;
  onUnsuspend?: (v: Vendor) => void;
  canManage: boolean;
  selectMode?: boolean;
  onSelect?: (v: Vendor) => void;
}

function VendorCard({ vendor, onView, onSuspend, onUnsuspend, canManage, selectMode, onSelect }: VendorCardProps) {
  const cfg = categoryConfig[vendor.category];
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={`bg-white dark:bg-slate-800 rounded-2xl shadow-card border transition-all ${vendor.isSuspended ? 'border-red-200 dark:border-red-900/30 opacity-70' : 'border-slate-100 dark:border-slate-700 hover:shadow-card-lg hover:-translate-y-0.5'} ${selectMode ? 'cursor-pointer' : ''}`}
      onClick={selectMode && onSelect ? () => onSelect(vendor) : undefined}
    >
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Avatar + category icon */}
          <div className="relative flex-shrink-0">
            <Avatar name={`${vendor.firstName} ${vendor.lastName}`} src={vendor.avatar} size="lg" />
            <div className={`absolute -bottom-1 -right-1 w-7 h-7 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800 ${cfg.color}`}>
              {cfg.icon}
            </div>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                  {vendor.firstName} {vendor.lastName}
                  {vendor.isVerified && <CheckCircle2 size={13} className="inline ml-1 text-green-500" />}
                </h3>
                <p className="text-xs text-slate-400">{cfg.label}</p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <Badge variant={vendor.isSuspended ? 'red' : vendor.availability === 'available' ? 'green' : vendor.availability === 'busy' ? 'yellow' : 'gray'} dot>
                  {vendor.isSuspended ? 'Suspended' : vendor.availability}
                </Badge>
              </div>
            </div>

            <StarRating rating={vendor.rating} />

            <div className="flex items-center gap-3 mt-2 text-xs text-slate-500 flex-wrap">
              <span className="flex items-center gap-1"><MapPin size={11} />{vendor.district}</span>
              <span className="flex items-center gap-1"><Briefcase size={11} />{vendor.completedJobs} jobs done</span>
              {vendor.dailyRate && <span>{formatCurrency(vendor.dailyRate)}/day</span>}
            </div>

            {/* Skills */}
            <div className="flex flex-wrap gap-1 mt-2">
              {vendor.skills.slice(0, 3).map(s => (
                <span key={s} className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">{s}</span>
              ))}
              {vendor.skills.length > 3 && <span className="text-xs text-slate-400">+{vendor.skills.length - 3}</span>}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
          {selectMode ? (
            <Button size="sm" className="flex-1" onClick={() => onSelect?.(vendor)}>
              Select {vendor.firstName}
            </Button>
          ) : (
            <>
              <Button size="sm" variant="secondary" className="flex-1" onClick={() => onView(vendor)}>View Profile</Button>
              <a href={`tel:${vendor.phone}`} className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs font-medium transition-colors">
                <Phone size={13} /> Call
              </a>
              {canManage && (
                vendor.isSuspended
                  ? <Button size="sm" variant="secondary" icon={<UserCheck size={12} />} onClick={() => onUnsuspend?.(vendor)} className="text-green-600">Unsuspend</Button>
                  : <Button size="sm" variant="danger" icon={<Ban size={12} />} onClick={() => onSuspend?.(vendor)}>Suspend</Button>
              )}
            </>
          )}
        </div>
      </div>
    </motion.div>
  );
}

// ─── Add Vendor Modal ─────────────────────────────────────────────────────────
function AddVendorModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { addVendor } = useVendorStore();
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', phone: '',
    category: 'plumber' as VendorCategory, district: 'Kampala',
    bio: '', dailyRate: '', hourlyRate: '', skillInput: '',
  });
  const [skills, setSkills] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  const addSkill = () => {
    const s = form.skillInput.trim();
    if (s && !skills.includes(s)) { setSkills(prev => [...prev, s]); }
    setForm(f => ({ ...f, skillInput: '' }));
  };

  const handleSave = async () => {
    if (!form.firstName || !form.lastName || !form.phone) { toast.error('Name and phone are required'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 800));
    addVendor({
      firstName: form.firstName, lastName: form.lastName,
      email: form.email, phone: form.phone,
      category: form.category, skills,
      bio: form.bio, district: form.district,
      isActive: true, isVerified: false, isSuspended: false,
      dailyRate: form.dailyRate ? Number(form.dailyRate) : undefined,
      hourlyRate: form.hourlyRate ? Number(form.hourlyRate) : undefined,
      availability: 'available',
    });
    setLoading(false);
    onClose();
    toast.success('Vendor registered successfully!');
  };

  return (
    <Modal open={open} onClose={onClose} title="Register New Vendor" size="lg"
      footer={<><Button variant="secondary" onClick={onClose}>Cancel</Button><Button loading={loading} onClick={handleSave}>Register Vendor</Button></>}>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Input label="First Name *" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} placeholder="e.g. Peter" />
          <Input label="Last Name *" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} placeholder="e.g. Mugisha" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Phone *" type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="07XX XXX XXX" />
          <Input label="Email" type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="vendor@email.com" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Select label="Category *" value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value as VendorCategory }))}
            options={Object.entries(categoryConfig).map(([v, c]) => ({ value: v, label: c.label }))} />
          <Input label="District" value={form.district} onChange={e => setForm(f => ({ ...f, district: e.target.value }))} placeholder="e.g. Kampala" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Input label="Daily Rate (UGX)" type="number" value={form.dailyRate} onChange={e => setForm(f => ({ ...f, dailyRate: e.target.value }))} placeholder="e.g. 80000" />
          <Input label="Hourly Rate (UGX)" type="number" value={form.hourlyRate} onChange={e => setForm(f => ({ ...f, hourlyRate: e.target.value }))} placeholder="e.g. 15000" />
        </div>
        <Textarea label="Bio / Description" value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))} placeholder="Describe the vendor's experience and specialties..." rows={3} />
        <div>
          <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Skills</label>
          <div className="flex gap-2">
            <Input placeholder="e.g. Pipe fitting, Drain unblocking..." value={form.skillInput}
              onChange={e => setForm(f => ({ ...f, skillInput: e.target.value }))}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }} />
            <Button variant="secondary" size="sm" onClick={addSkill} icon={<Plus size={14} />}>Add</Button>
          </div>
          {skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {skills.map(s => (
                <span key={s} className="inline-flex items-center gap-1 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 text-xs px-2.5 py-1 rounded-full border border-primary-200 dark:border-primary-700">
                  {s}
                  <button onClick={() => setSkills(prev => prev.filter(x => x !== s))} className="hover:text-red-500">×</button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ─── Vendor Profile Modal ─────────────────────────────────────────────────────
function VendorProfileModal({ vendor, open, onClose }: { vendor: Vendor | null; open: boolean; onClose: () => void }) {
  const { getJobsByVendor } = useVendorStore();
  if (!vendor) return null;
  const cfg = categoryConfig[vendor.category];
  const jobs = getJobsByVendor(vendor.id);

  return (
    <Modal open={open} onClose={onClose} title="Vendor Profile" size="lg"
      footer={<Button variant="secondary" onClick={onClose}>Close</Button>}>
      <div className="space-y-5">
        {/* Header */}
        <div className="flex items-start gap-4">
          <div className="relative flex-shrink-0">
            <Avatar name={`${vendor.firstName} ${vendor.lastName}`} size="xl" />
            <div className={`absolute -bottom-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center border-2 border-white dark:border-slate-800 ${cfg.color}`}>
              {cfg.icon}
            </div>
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-slate-900 dark:text-slate-100 text-lg">{vendor.firstName} {vendor.lastName}</h2>
              {vendor.isVerified && <Badge variant="green"><CheckCircle2 size={11} /> Verified</Badge>}
              {vendor.isSuspended && <Badge variant="red">Suspended</Badge>}
            </div>
            <p className="text-sm text-slate-500">{cfg.label} · {vendor.district}</p>
            <StarRating rating={vendor.rating} size={16} />
            <p className="text-xs text-slate-400 mt-1">{vendor.totalRatings} ratings · {vendor.completedJobs} jobs completed</p>
          </div>
        </div>

        {/* Contact */}
        <div className="grid grid-cols-2 gap-3">
          <a href={`tel:${vendor.phone}`} className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <Phone size={15} className="text-primary-600" />
            <div>
              <p className="text-xs text-slate-400">Phone</p>
              <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{vendor.phone}</p>
            </div>
          </a>
          {vendor.email && (
            <a href={`mailto:${vendor.email}`} className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <Mail size={15} className="text-primary-600" />
              <div>
                <p className="text-xs text-slate-400">Email</p>
                <p className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">{vendor.email}</p>
              </div>
            </a>
          )}
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            { label: 'Total Jobs', value: vendor.totalJobs },
            { label: 'Completed', value: vendor.completedJobs },
            { label: 'Rating', value: `${vendor.rating}/5` },
          ].map(s => (
            <div key={s.label} className="text-center p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
              <p className="text-xl font-bold text-slate-900 dark:text-slate-100">{s.value}</p>
              <p className="text-xs text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Rates */}
        {(vendor.dailyRate || vendor.hourlyRate) && (
          <div className="flex gap-3">
            {vendor.dailyRate && (
              <div className="flex-1 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl text-center">
                <p className="text-sm font-bold text-primary-700 dark:text-primary-300">{formatCurrency(vendor.dailyRate)}</p>
                <p className="text-xs text-primary-500">per day</p>
              </div>
            )}
            {vendor.hourlyRate && (
              <div className="flex-1 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl text-center">
                <p className="text-sm font-bold text-primary-700 dark:text-primary-300">{formatCurrency(vendor.hourlyRate)}</p>
                <p className="text-xs text-primary-500">per hour</p>
              </div>
            )}
          </div>
        )}

        {/* Bio */}
        {vendor.bio && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1.5">About</p>
            <p className="text-sm text-slate-600 dark:text-slate-400">{vendor.bio}</p>
          </div>
        )}

        {/* Skills */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Skills</p>
          <div className="flex flex-wrap gap-1.5">
            {vendor.skills.map(s => (
              <span key={s} className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-full">{s}</span>
            ))}
          </div>
        </div>

        {/* Recent jobs */}
        {jobs.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Recent Jobs</p>
            <div className="space-y-2">
              {jobs.slice(0, 3).map(j => (
                <div key={j.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{j.title}</p>
                    <p className="text-xs text-slate-400">{j.propertyTitle}</p>
                  </div>
                  <Badge variant={j.status === 'completed' ? 'green' : j.status === 'in_progress' ? 'blue' : 'yellow'}>
                    {j.status.replace('_', ' ')}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        <p className="text-xs text-slate-400">Member since {formatDate(vendor.joinedAt)}</p>
      </div>
    </Modal>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function VendorsPage() {
  const { user } = useAuthStore();
  const { vendors, suspendVendor, unsuspendVendor, verifyVendor } = useVendorStore();
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterAvailability, setFilterAvailability] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [viewVendor, setViewVendor] = useState<Vendor | null>(null);

  const canManage = canDo.manageVendors(user);

  const filtered = vendors.filter(v => {
    const q = search.toLowerCase();
    const matchQ = !q || `${v.firstName} ${v.lastName} ${v.skills.join(' ')} ${v.category}`.toLowerCase().includes(q);
    const matchCat = !filterCategory || v.category === filterCategory;
    const matchAvail = !filterAvailability || v.availability === filterAvailability || (filterAvailability === 'active' && !v.isSuspended);
    return matchQ && matchCat && matchAvail;
  });

  const availableCount = vendors.filter(v => v.availability === 'available' && !v.isSuspended).length;
  const busyCount = vendors.filter(v => v.availability === 'busy').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Vendors</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {vendors.length} registered · {availableCount} available · {busyCount} on a job
          </p>
        </div>
        {canManage && (
          <Button icon={<Plus size={16} />} onClick={() => setShowAddModal(true)}>Register Vendor</Button>
        )}
      </div>

      {/* Category quick-filter pills */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setFilterCategory('')}
          className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${!filterCategory ? 'bg-primary-600 text-white border-primary-600' : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-primary-400'}`}>
          All
        </button>
        {Object.entries(categoryConfig).map(([key, cfg]) => (
          <button key={key} onClick={() => setFilterCategory(filterCategory === key ? '' : key)}
            className={`flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${filterCategory === key ? 'bg-primary-600 text-white border-primary-600' : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-primary-400'}`}>
            {cfg.icon} {cfg.label}
          </button>
        ))}
      </div>

      {/* Search + filters */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-4">
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-48">
            <Input placeholder="Search by name, skill, category..." icon={<Search size={15} />} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterAvailability} onChange={e => setFilterAvailability(e.target.value)}
            options={[{ value: '', label: 'All Status' }, { value: 'available', label: 'Available' }, { value: 'busy', label: 'Busy' }, { value: 'unavailable', label: 'Unavailable' }]} />
          {(search || filterCategory || filterAvailability) && (
            <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={() => { setSearch(''); setFilterCategory(''); setFilterAvailability(''); }}>Clear</Button>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-2">{filtered.length} vendors found</p>
      </div>

      {/* Vendor grid */}
      {filtered.length === 0 ? (
        <EmptyState icon={<Briefcase size={28} />} title="No vendors found"
          description="Register vendors to assign them to maintenance jobs."
          action={canManage ? <Button onClick={() => setShowAddModal(true)} icon={<Plus size={14} />}>Register Vendor</Button> : undefined} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((v, i) => (
            <motion.div key={v.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <VendorCard
                vendor={v}
                onView={setViewVendor}
                onSuspend={v => { suspendVendor(v.id); toast.success(`${v.firstName} suspended`); }}
                onUnsuspend={v => { unsuspendVendor(v.id); toast.success(`${v.firstName} reactivated`); }}
                canManage={!!canManage}
              />
              {canManage && !v.isVerified && !v.isSuspended && (
                <button onClick={() => { verifyVendor(v.id); toast.success(`${v.firstName} verified!`); }}
                  className="w-full mt-1 text-xs text-primary-600 hover:text-primary-700 font-medium py-1">
                  ✓ Mark as Verified
                </button>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Modals */}
      <AddVendorModal open={showAddModal} onClose={() => setShowAddModal(false)} />
      <VendorProfileModal vendor={viewVendor} open={!!viewVendor} onClose={() => setViewVendor(null)} />
    </div>
  );
}
