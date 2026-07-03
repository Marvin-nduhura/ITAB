import { useState, useEffect, useCallback } from 'react';
import { Plus, Pencil, Trash2, Tag, ImagePlus, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Modal } from '../ui/Modal';
import { Input, Textarea } from '../ui/Input';
import { FileUpload, type UploadedFile } from '../ui/FileUpload';
import { useAuthStore } from '../../store/authStore';
import { propertyUnitsApi } from '../../lib/api';
import { amenityIcons } from '../../lib/utils';
import { formatCurrency } from '../../lib/utils';
import type { Property, PropertyUnit } from '../../types';
import toast from 'react-hot-toast';

// ─── Unit form draft ──────────────────────────────────────────────────────────
interface UnitFormState {
  unitName: string;
  description: string;
  floorNumber: string;
  bedrooms: string;
  bathrooms: string;
  squareFootage: string;
  rentPrice: string;
  deposit: string;
  availableFrom: string;
  photos: string[];
  uploadedFiles: UploadedFile[];
  amenities: string[];
}

const EMPTY_UNIT_FORM: UnitFormState = {
  unitName: '', description: '', floorNumber: '', bedrooms: '1', bathrooms: '1',
  squareFootage: '', rentPrice: '', deposit: '', availableFrom: '',
  photos: [], uploadedFiles: [], amenities: [],
};

function unitToForm(u: PropertyUnit): UnitFormState {
  return {
    unitName: u.unitName, description: u.description || '', floorNumber: u.floorNumber ? String(u.floorNumber) : '',
    bedrooms: String(u.bedrooms), bathrooms: String(u.bathrooms),
    squareFootage: u.squareFootage ? String(u.squareFootage) : '',
    rentPrice: String(u.rentPrice), deposit: u.deposit ? String(u.deposit) : '',
    availableFrom: u.availableFrom || '',
    photos: u.photos, uploadedFiles: [], amenities: u.amenities,
  };
}

function statusBadgeVariant(status: PropertyUnit['status']): 'green' | 'blue' | 'yellow' {
  if (status === 'available') return 'green';
  if (status === 'rented') return 'blue';
  return 'yellow';
}

function statusLabel(status: PropertyUnit['status']): string {
  if (status === 'available') return 'Available';
  if (status === 'rented') return 'Rented';
  return 'Maintenance';
}

// ─── Photo mini-carousel ──────────────────────────────────────────────────────
function UnitPhotoCarousel({ photos }: { photos: string[] }) {
  const [idx, setIdx] = useState(0);
  if (photos.length === 0) {
    return (
      <div className="w-full h-32 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center">
        <ImagePlus size={24} className="text-slate-300 dark:text-slate-600" />
      </div>
    );
  }
  return (
    <div className="relative w-full h-32 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800">
      <img src={photos[idx]} alt="" className="w-full h-full object-cover" />
      {photos.length > 1 && (
        <>
          <button onClick={() => setIdx(i => (i - 1 + photos.length) % photos.length)}
            className="absolute left-1 top-1/2 -translate-y-1/2 w-6 h-6 bg-black/40 rounded-full flex items-center justify-center text-white">
            <ChevronLeft size={12} />
          </button>
          <button onClick={() => setIdx(i => (i + 1) % photos.length)}
            className="absolute right-1 top-1/2 -translate-y-1/2 w-6 h-6 bg-black/40 rounded-full flex items-center justify-center text-white">
            <ChevronRight size={12} />
          </button>
        </>
      )}
    </div>
  );
}

// ─── UnitFormModal ────────────────────────────────────────────────────────────
interface UnitFormModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  onSave: (data: UnitFormState) => Promise<void>;
  initial?: UnitFormState;
  saving?: boolean;
}

function UnitFormModal({ open, onClose, title, onSave, initial, saving }: UnitFormModalProps) {
  const [form, setForm] = useState<UnitFormState>(initial || EMPTY_UNIT_FORM);
  useEffect(() => { setForm(initial || EMPTY_UNIT_FORM); }, [initial, open]);

  const set = (key: keyof UnitFormState, value: unknown) => setForm(f => ({ ...f, [key]: value }));

  const allAmenities = amenityIcons as Record<string, string>;
  const toggleAmenity = (key: string) => setForm(f => ({
    ...f,
    amenities: f.amenities.includes(key) ? f.amenities.filter(a => a !== key) : [...f.amenities, key],
  }));

  const handleSubmit = async () => {
    if (!form.unitName.trim()) { toast.error('Unit name is required'); return; }
    if (!form.rentPrice || Number(form.rentPrice) <= 0) { toast.error('Rent price is required'); return; }
    await onSave(form);
  };

  return (
    <Modal open={open} onClose={onClose} size="xl" title={title}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button loading={saving} onClick={handleSubmit}>Save Unit</Button>
        </div>
      }
    >
      <div className="space-y-3">
        <Input label="Unit Name *" placeholder='e.g. "Unit A", "Room 101", "Shop 5"'
          value={form.unitName} onChange={e => set('unitName', e.target.value)} />
        <Textarea label="Description (optional)" placeholder="Brief description..."
          value={form.description} onChange={e => set('description', e.target.value)} />
        <div className="grid grid-cols-3 gap-2">
          <Input label="Floor #" type="number" min="0" placeholder="e.g. 2"
            value={form.floorNumber} onChange={e => set('floorNumber', e.target.value)} />
          <Input label="Bedrooms" type="number" min="0"
            value={form.bedrooms} onChange={e => set('bedrooms', e.target.value)} />
          <Input label="Bathrooms" type="number" min="0"
            value={form.bathrooms} onChange={e => set('bathrooms', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input label="Rent Price (UGX) *" type="number" min="0"
            value={form.rentPrice} onChange={e => set('rentPrice', e.target.value)} />
          <Input label="Deposit (UGX)" type="number" min="0" placeholder="Defaults to 2× rent"
            value={form.deposit} onChange={e => set('deposit', e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Input label="Size (m²)" type="number" min="0"
            value={form.squareFootage} onChange={e => set('squareFootage', e.target.value)} />
          <Input label="Available From" type="date"
            value={form.availableFrom} onChange={e => set('availableFrom', e.target.value)} />
        </div>

        {/* Photos */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <ImagePlus size={11} /> Unit Photos
          </p>
          <FileUpload accept="image/*" multiple maxFiles={6} maxSizeMB={8} showCamera
            value={form.uploadedFiles}
            onChange={files => set('uploadedFiles', files)}
            hint="Add photos for this unit" />
        </div>

        {/* Amenities */}
        <div>
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1">
            <Tag size={11} /> Unit Amenities
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
            {Object.entries(allAmenities).map(([key, icon]) => {
              const isSelected = form.amenities.includes(key);
              return (
                <button key={key} type="button" onClick={() => toggleAmenity(key)}
                  className={`flex items-center gap-1.5 p-2 rounded-lg border text-xs font-medium transition-all text-left ${isSelected ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300'}`}>
                  <span className="flex-shrink-0">{icon}</span>
                  <span className="truncate capitalize">{key.replace(/_/g, ' ')}</span>
                  {isSelected && <span className="ml-auto text-primary-500 flex-shrink-0">✓</span>}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Main UnitsSection ────────────────────────────────────────────────────────
interface UnitsSectionProps {
  property: Property;
  isOwner: boolean;
}

export function UnitsSection({ property, isOwner }: UnitsSectionProps) {
  const { user } = useAuthStore();
  const [units, setUnits] = useState<PropertyUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingUnit, setEditingUnit] = useState<PropertyUnit | null>(null);
  const [modalSaving, setModalSaving] = useState(false);
  const [bookingUnit, setBookingUnit] = useState<PropertyUnit | null>(null);
  const [showBookModal, setShowBookModal] = useState(false);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');

  const fetchUnits = useCallback(async () => {
    setLoading(true);
    try {
      const res = await propertyUnitsApi.list(property.id);
      setUnits((res.data?.data as PropertyUnit[]) || []);
    } catch {
      // silent — backend may not have units yet
    } finally {
      setLoading(false);
    }
  }, [property.id]);

  useEffect(() => { fetchUnits(); }, [fetchUnits]);

  const availableCount = units.filter(u => u.status === 'available').length;
  const rentedCount = units.filter(u => u.status === 'rented').length;
  const totalRent = units.reduce((sum, u) => sum + u.rentPrice, 0);

  const handleAddUnit = async (data: UnitFormState) => {
    setModalSaving(true);
    try {
      const photos = data.uploadedFiles.length > 0 ? data.uploadedFiles.map(f => f.dataUrl) : data.photos;
      const payload = {
        unitName: data.unitName,
        description: data.description || undefined,
        floorNumber: data.floorNumber ? parseInt(data.floorNumber) : undefined,
        bedrooms: parseInt(data.bedrooms) || 0,
        bathrooms: parseInt(data.bathrooms) || 0,
        squareFootage: data.squareFootage ? parseInt(data.squareFootage) : undefined,
        rentPrice: parseInt(data.rentPrice),
        deposit: data.deposit ? parseInt(data.deposit) : parseInt(data.rentPrice) * 2,
        availableFrom: data.availableFrom || undefined,
        photos,
        amenities: data.amenities,
      };
      const res = await propertyUnitsApi.create(property.id, payload);
      const created = res.data?.data as PropertyUnit;
      if (created) setUnits(prev => [...prev, created]);
      toast.success('Unit added');
      setShowAddModal(false);
    } catch {
      toast.error('Failed to add unit');
    } finally {
      setModalSaving(false);
    }
  };

  const handleEditUnit = async (data: UnitFormState) => {
    if (!editingUnit) return;
    setModalSaving(true);
    try {
      const photos = data.uploadedFiles.length > 0 ? data.uploadedFiles.map(f => f.dataUrl) : data.photos;
      const payload = {
        unitName: data.unitName,
        description: data.description || undefined,
        floorNumber: data.floorNumber ? parseInt(data.floorNumber) : undefined,
        bedrooms: parseInt(data.bedrooms) || 0,
        bathrooms: parseInt(data.bathrooms) || 0,
        squareFootage: data.squareFootage ? parseInt(data.squareFootage) : undefined,
        rentPrice: parseInt(data.rentPrice),
        deposit: data.deposit ? parseInt(data.deposit) : parseInt(data.rentPrice) * 2,
        availableFrom: data.availableFrom || undefined,
        photos,
        amenities: data.amenities,
      };
      const res = await propertyUnitsApi.update(property.id, editingUnit.id, payload);
      const updated = res.data?.data as PropertyUnit;
      if (updated) setUnits(prev => prev.map(u => u.id === editingUnit.id ? updated : u));
      toast.success('Unit updated');
      setEditingUnit(null);
    } catch {
      toast.error('Failed to update unit');
    } finally {
      setModalSaving(false);
    }
  };

  const handleDeleteUnit = async (unit: PropertyUnit) => {
    if (!confirm(`Delete unit "${unit.unitName}"?`)) return;
    try {
      await propertyUnitsApi.delete(property.id, unit.id);
      setUnits(prev => prev.filter(u => u.id !== unit.id));
      toast.success('Unit deleted');
    } catch {
      toast.error('Failed to delete unit');
    }
  };

  const handleBookUnit = (unit: PropertyUnit) => {
    if (!user) { toast('Sign in to book', { icon: '🔒' }); return; }
    setBookingUnit(unit);
    setBookingDate('');
    setBookingTime('');
    setShowBookModal(true);
  };

  const handleConfirmBooking = () => {
    if (!bookingDate || !bookingTime) { toast.error('Select a date and time'); return; }
    toast.success(`🎉 Inspection booked for ${bookingUnit?.unitName}!`);
    setShowBookModal(false);
    setBookingUnit(null);
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-36 h-5 bg-slate-100 dark:bg-slate-700 rounded animate-pulse" />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {[1, 2].map(i => (
            <div key={i} className="h-40 bg-slate-100 dark:bg-slate-700 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-slate-100">
              Units ({availableCount} available / {units.length} total)
            </h2>
            {units.length === 0 && (
              <p className="text-xs text-slate-400 mt-0.5">No units added yet</p>
            )}
          </div>
          {isOwner && (
            <Button size="sm" variant="secondary" icon={<Plus size={14} />} onClick={() => setShowAddModal(true)}>
              Add Unit
            </Button>
          )}
        </div>

        {/* Unit grid */}
        {units.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {units.map(unit => (
              <div key={unit.id} className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden bg-slate-50 dark:bg-slate-700/30">
                {/* Photo carousel */}
                <UnitPhotoCarousel photos={unit.photos} />

                <div className="p-3 space-y-2">
                  {/* Name + badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-sm text-slate-900 dark:text-slate-100">{unit.unitName}</span>
                        {unit.floorNumber != null && (
                          <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 px-1.5 py-0.5 rounded-full">
                            Floor {unit.floorNumber}
                          </span>
                        )}
                      </div>
                    </div>
                    <Badge variant={statusBadgeVariant(unit.status)}>{statusLabel(unit.status)}</Badge>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-3 text-xs text-slate-500">
                    {unit.bedrooms > 0 && <span>🛏 {unit.bedrooms}</span>}
                    {unit.bathrooms > 0 && <span>🚿 {unit.bathrooms}</span>}
                    {unit.squareFootage && <span>📐 {unit.squareFootage}m²</span>}
                  </div>

                  {/* Rent */}
                  <p className="text-base font-bold text-primary-600">{formatCurrency(unit.rentPrice)}<span className="text-xs font-normal text-slate-400">/mo</span></p>

                  {/* Amenities chips */}
                  {unit.amenities.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {unit.amenities.slice(0, 4).map(a => (
                        <span key={a} className="text-xs bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full">
                          {(amenityIcons as Record<string, string>)[a] || '✨'} {a.replace(/_/g, ' ')}
                        </span>
                      ))}
                      {unit.amenities.length > 4 && (
                        <span className="text-xs text-slate-400">+{unit.amenities.length - 4} more</span>
                      )}
                    </div>
                  )}

                  {/* Rented info */}
                  {unit.status === 'rented' && unit.tenantName && (
                    <p className="text-xs text-slate-500">
                      Tenant: <span className="font-medium text-slate-700 dark:text-slate-300">{unit.tenantName}</span>
                      {unit.leaseStart && ` · ${unit.leaseStart}`}
                      {unit.leaseEnd && ` – ${unit.leaseEnd}`}
                    </p>
                  )}

                  {/* Action buttons */}
                  <div className="flex gap-2 pt-1">
                    {unit.status === 'available' && user?.role === 'tenant' && property.status === 'published' && (
                      <Button size="sm" className="flex-1" onClick={() => handleBookUnit(unit)}>
                        Book This Unit
                      </Button>
                    )}
                    {isOwner && (
                      <>
                        <button onClick={() => setEditingUnit(unit)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 text-xs text-slate-600 dark:text-slate-400 transition-colors">
                          <Pencil size={12} /> Edit
                        </button>
                        <button onClick={() => handleDeleteUnit(unit)}
                          className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-red-200 dark:border-red-800 hover:bg-red-50 dark:hover:bg-red-900/20 text-xs text-red-500 transition-colors">
                          <Trash2 size={12} /> Delete
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary footer */}
        {units.length > 0 && (
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex flex-wrap gap-4 text-xs text-slate-500">
            <span>Available: <strong className="text-green-600">{availableCount}</strong></span>
            <span>Rented: <strong className="text-blue-600">{rentedCount}</strong></span>
            <span>Total unit rent: <strong className="text-primary-600">{formatCurrency(totalRent)}</strong></span>
          </div>
        )}
      </div>

      {/* Add Unit Modal */}
      <UnitFormModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        title="Add Unit"
        onSave={handleAddUnit}
        saving={modalSaving}
      />

      {/* Edit Unit Modal */}
      <UnitFormModal
        open={!!editingUnit}
        onClose={() => setEditingUnit(null)}
        title={`Edit: ${editingUnit?.unitName || ''}`}
        onSave={handleEditUnit}
        initial={editingUnit ? unitToForm(editingUnit) : undefined}
        saving={modalSaving}
      />

      {/* Book Unit Inspection Modal */}
      <Modal open={showBookModal} onClose={() => setShowBookModal(false)} title="Book Unit Inspection"
        footer={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => setShowBookModal(false)}>Cancel</Button>
            <Button onClick={handleConfirmBooking}>Confirm Booking</Button>
          </div>
        }
      >
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3">
            <p className="font-semibold text-blue-800 dark:text-blue-300 text-sm">{bookingUnit?.unitName}</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">{property.title} · {property.address}</p>
          </div>
          <Input label="Preferred Date" type="date" value={bookingDate}
            onChange={e => setBookingDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Preferred Time</label>
            <div className="grid grid-cols-3 gap-2">
              {['09:00', '10:00', '11:00', '14:00', '15:00', '16:00'].map(t => (
                <button key={t} onClick={() => setBookingTime(t)}
                  className={`py-2 rounded-xl text-sm font-medium border transition-all ${bookingTime === t ? 'bg-primary-600 text-white border-primary-600' : 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-primary-400'}`}>
                  {t}
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>
    </>
  );
}
