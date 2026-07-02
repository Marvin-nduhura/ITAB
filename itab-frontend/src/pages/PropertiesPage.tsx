import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Grid3X3, List, MapPin, Bed, Bath, Heart, Share2, Eye, Star, Pencil, Trash2, MoreVertical } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input, Select } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { Modal } from '../components/ui/Modal';
import { PropertyFormModal } from '../components/property/PropertyFormModal';
import { useAuthStore } from '../store/authStore';
import { usePropertyStore } from '../store/propertyStore';
import { formatCurrency, propertyStatusConfig, amenityIcons, DISTRICTS } from '../lib/utils';
import { filterPropertiesForUser, canDo } from '../lib/rbac';
import type { Property } from '../types';
import toast from 'react-hot-toast';

type ViewMode = 'grid' | 'list';

export function PropertiesPage() {
  const { user } = useAuthStore();
  const { properties: allProperties, deleteProperty, customPropertyTypes, customDistricts } = usePropertyStore();
  const navigate = useNavigate();

  // Apply role-based property filter — each role only sees what they're allowed to
  const properties = filterPropertiesForUser(allProperties, user);

  const [view, setView] = useState<ViewMode>('grid');
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDistrict, setFilterDistrict] = useState('');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const [showAddModal, setShowAddModal] = useState(false);
  const [editProperty, setEditProperty] = useState<Property | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<Property | null>(null);
  const [openMenu, setOpenMenu] = useState<string | null>(null);

  const canAdd = canDo.addProperty(user);

  // Use centralised RBAC helper for edit permission
  const canEdit = (p: Property) => canDo.editProperty(user, p);

  // All types for filter (base + custom)
  const allTypes = ['apartment', 'house', 'commercial', 'land', ...customPropertyTypes];
  const allDistricts = [...DISTRICTS, ...customDistricts];

  const filtered = properties.filter(p => {
    const q = search.toLowerCase();
    const matchSearch = !q || p.title.toLowerCase().includes(q) || p.address.toLowerCase().includes(q) || p.district.toLowerCase().includes(q);
    const matchType = !filterType || p.type === filterType;
    const matchStatus = !filterStatus || p.status === filterStatus;
    const matchDistrict = !filterDistrict || p.district === filterDistrict;
    return matchSearch && matchType && matchStatus && matchDistrict;
  });

  const toggleFavorite = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user) { toast('Sign in to save favorites', { icon: '🔒' }); return; }
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); toast('Removed from favorites'); }
      else { next.add(id); toast.success('Added to favorites!'); }
      return next;
    });
  };

  const shareProperty = (p: Property, e: React.MouseEvent) => {
    e.stopPropagation();
    const url = `${window.location.origin}/properties/${p.id}`;
    if (navigator.share) {
      navigator.share({ title: p.title, text: `${p.title} – ${formatCurrency(p.rentPrice)}/mo`, url });
    } else {
      navigator.clipboard.writeText(url);
      toast.success('Link copied!');
    }
  };

  const handleDelete = () => {
    if (!deleteConfirm) return;
    deleteProperty(deleteConfirm.id);
    toast.success('Property deleted');
    setDeleteConfirm(null);
  };

  const statusVariant = (s: string): 'blue' | 'green' | 'yellow' | 'red' | 'gray' | 'purple' => {
    const m: Record<string, 'blue' | 'green' | 'yellow' | 'red' | 'gray' | 'purple'> = {
      published: 'green', rented: 'blue', draft: 'gray', pending_vetting: 'yellow', rejected: 'red', under_maintenance: 'red',
    };
    return m[s] || 'gray';
  };

  // All amenity icons including custom ones
  const allAmenityIcons: Record<string, string> = { ...amenityIcons };

  return (
    <div className="space-y-6" onClick={() => setOpenMenu(null)}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Properties</h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">{filtered.length} of {properties.length} properties</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate('/search?view=map')}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
            <MapPin size={15} /> Map View
          </button>
          {canAdd && (
            <Button onClick={() => setShowAddModal(true)} icon={<Plus size={16} />}>Add Property</Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <div className="lg:col-span-2">
            <Input placeholder="Search by name, address, district..." value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <select value={filterType} onChange={e => setFilterType(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm">
            <option value="">All Types</option>
            {allTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
          </select>
          <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            options={[{ value: '', label: 'All Status' }, { value: 'published', label: 'Published' }, { value: 'rented', label: 'Rented' }, { value: 'draft', label: 'Draft' }, { value: 'pending_vetting', label: 'Pending' }, { value: 'under_maintenance', label: 'Maintenance' }]} />
          <select value={filterDistrict} onChange={e => setFilterDistrict(e.target.value)}
            className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm">
            <option value="">All Districts</option>
            {allDistricts.map(d => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
        <div className="flex items-center justify-between mt-3">
          <p className="text-xs text-slate-400">{filtered.length} results</p>
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-700 rounded-xl p-1">
            <button onClick={() => setView('grid')} className={`p-1.5 rounded-lg transition-colors ${view === 'grid' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-slate-100' : 'text-slate-400'}`}><Grid3X3 size={15} /></button>
            <button onClick={() => setView('list')} className={`p-1.5 rounded-lg transition-colors ${view === 'list' ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-slate-100' : 'text-slate-400'}`}><List size={15} /></button>
          </div>
        </div>
      </div>

      {/* Properties */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<svg width={28} height={28} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v18M3 9h18M3 15h18"/></svg>}
          title="No properties found"
          description="Try adjusting your filters or add a new property."
          action={canAdd ? <Button onClick={() => setShowAddModal(true)} icon={<Plus size={15} />}>Add Property</Button> : undefined}
        />
      ) : view === 'grid' ? (
        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((p, i) => (
            <motion.div key={p.id} layout initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => navigate(`/properties/${p.id}`)}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden cursor-pointer hover:shadow-card-lg hover:-translate-y-1 transition-all duration-300 group">

              {/* Image */}
              <div className="relative h-48 overflow-hidden">
                <img src={p.photos[0]} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800'; }} />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
                {p.isFeatured && (
                  <div className="absolute top-3 left-3 flex items-center gap-1 bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                    <Star size={10} fill="white" /> Featured
                  </div>
                )}
                <div className="absolute top-3 right-3 flex gap-1.5">
                  <button onClick={e => toggleFavorite(p.id, e)} className="w-8 h-8 bg-white/90 dark:bg-slate-800/90 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-sm">
                    <Heart size={14} className={favorites.has(p.id) ? 'fill-red-500 text-red-500' : 'text-slate-500'} />
                  </button>
                  <button onClick={e => shareProperty(p, e)} className="w-8 h-8 bg-white/90 dark:bg-slate-800/90 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-sm">
                    <Share2 size={14} className="text-slate-500" />
                  </button>
                  {/* Edit/Delete menu */}
                  {canEdit(p) && (
                    <div className="relative" onClick={e => e.stopPropagation()}>
                      <button onClick={e => { e.stopPropagation(); setOpenMenu(openMenu === p.id ? null : p.id); }}
                        className="w-8 h-8 bg-white/90 dark:bg-slate-800/90 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow-sm">
                        <MoreVertical size={14} className="text-slate-500" />
                      </button>
                      <AnimatePresence>
                        {openMenu === p.id && (
                          <motion.div initial={{ opacity: 0, scale: 0.9, y: -4 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9 }}
                            className="absolute right-0 top-full mt-1 w-36 bg-white dark:bg-slate-800 rounded-xl shadow-card-lg border border-slate-100 dark:border-slate-700 overflow-hidden z-10">
                            <button onClick={() => { setEditProperty(p); setOpenMenu(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                              <Pencil size={14} /> Edit
                            </button>
                            <button onClick={() => { setDeleteConfirm(p); setOpenMenu(null); }}
                              className="w-full flex items-center gap-2 px-3 py-2.5 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                              <Trash2 size={14} /> Delete
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
                <div className="absolute bottom-3 left-3">
                  <Badge variant={statusVariant(p.status)}>{propertyStatusConfig[p.status]?.label || p.status}</Badge>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-tight line-clamp-1">{p.title}</h3>
                <div className="flex items-center gap-1 mt-1 text-slate-400 text-xs">
                  <MapPin size={11} /><span className="truncate">{p.address}</span>
                </div>
                <div className="flex items-center gap-3 mt-2.5 text-xs text-slate-500 dark:text-slate-400">
                  {p.bedrooms > 0 && <span className="flex items-center gap-1"><Bed size={12} />{p.bedrooms} bed</span>}
                  {p.bathrooms > 0 && <span className="flex items-center gap-1"><Bath size={12} />{p.bathrooms} bath</span>}
                  {p.squareFootage && <span>{p.squareFootage} m²</span>}
                  <span className="flex items-center gap-1 ml-auto"><Eye size={12} />{p.viewCount}</span>
                </div>
                {/* Amenities */}
                {p.amenities.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2.5">
                    {p.amenities.slice(0, 4).map(a => (
                      <span key={a} className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">
                        {allAmenityIcons[a] || '✨'} {a.replace(/_/g, ' ')}
                      </span>
                    ))}
                    {p.amenities.length > 4 && <span className="text-xs text-slate-400">+{p.amenities.length - 4} more</span>}
                  </div>
                )}
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                  <div>
                    <p className="text-lg font-bold text-primary-600">{formatCurrency(p.rentPrice)}</p>
                    <p className="text-xs text-slate-400">per month · {p.type.replace(/_/g, ' ')}</p>
                  </div>
                  <Button size="sm" onClick={e => { e.stopPropagation(); navigate(`/properties/${p.id}`); }}>View</Button>
                </div>
              </div>
            </motion.div>
          ))}
        </motion.div>
      ) : (
        /* List view */
        <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="divide-y divide-slate-100 dark:divide-slate-700">
            {filtered.map(p => (
              <div key={p.id} onClick={() => navigate(`/properties/${p.id}`)}
                className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 cursor-pointer transition-colors">
                <img src={p.photos[0]} alt={p.title} className="w-16 h-16 rounded-xl object-cover flex-shrink-0"
                  onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800'; }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{p.title}</h3>
                    {p.isFeatured && <Badge variant="yellow"><Star size={10} /> Featured</Badge>}
                    <Badge variant={statusVariant(p.status)}>{propertyStatusConfig[p.status]?.label || p.status}</Badge>
                  </div>
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1"><MapPin size={10} />{p.address} · {p.district}</p>
                  <div className="flex items-center gap-3 mt-1 text-xs text-slate-500">
                    {p.bedrooms > 0 && <span>{p.bedrooms} bed</span>}
                    {p.bathrooms > 0 && <span>{p.bathrooms} bath</span>}
                    {p.squareFootage && <span>{p.squareFootage} m²</span>}
                    <span className="capitalize text-slate-400">{p.type.replace(/_/g, ' ')}</span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0 flex items-center gap-3">
                  <div>
                    <p className="font-bold text-primary-600">{formatCurrency(p.rentPrice)}</p>
                    <p className="text-xs text-slate-400">per month</p>
                  </div>
                  {canEdit(p) && (
                    <div className="flex gap-1.5" onClick={e => e.stopPropagation()}>
                      <button onClick={() => setEditProperty(p)}
                        className="p-2 rounded-xl hover:bg-primary-50 dark:hover:bg-primary-900/20 text-slate-400 hover:text-primary-600 transition-colors">
                        <Pencil size={15} />
                      </button>
                      <button onClick={() => setDeleteConfirm(p)}
                        className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors">
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      <PropertyFormModal
        open={showAddModal || !!editProperty}
        onClose={() => { setShowAddModal(false); setEditProperty(null); }}
        editProperty={editProperty}
      />

      {/* Delete Confirm Modal */}
      <Modal open={!!deleteConfirm} onClose={() => setDeleteConfirm(null)} title="Delete Property"
        footer={
          <>
            <Button variant="secondary" onClick={() => setDeleteConfirm(null)}>Cancel</Button>
            <Button variant="danger" onClick={handleDelete} icon={<Trash2 size={15} />}>Delete</Button>
          </>
        }>
        <div className="space-y-3">
          <p className="text-slate-600 dark:text-slate-400">
            Are you sure you want to delete <strong className="text-slate-900 dark:text-slate-100">"{deleteConfirm?.title}"</strong>?
          </p>
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-3">
            <p className="text-xs text-red-700 dark:text-red-400">⚠️ This action cannot be undone. All associated data will be removed.</p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
