import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, ImagePlus, Tag, MapPin, Building2 } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input, Textarea } from '../ui/Input';
import { LocationPicker, type LocationValue } from '../ui/LocationPicker';
import { FileUpload, type UploadedFile } from '../ui/FileUpload';
import { usePropertyStore } from '../../store/propertyStore';
import { useAuthStore } from '../../store/authStore';
import { amenityIcons, DISTRICTS } from '../../lib/utils';
import type { Property } from '../../types';
import toast from 'react-hot-toast';

// Base property types
const BASE_TYPES = ['apartment', 'house', 'commercial', 'land'];

interface Props {
  open: boolean;
  onClose: () => void;
  editProperty?: Property | null;   // if set → edit mode
}

interface FormState {
  title: string;
  description: string;
  type: string;
  customType: string;
  address: string;
  district: string;
  customDistrict: string;
  location: LocationValue | null;   // GPS / map picked location
  latitude: string;
  longitude: string;
  bedrooms: string;
  bathrooms: string;
  squareFootage: string;
  rentPrice: string;
  deposit: string;
  availableFrom: string;
  managementFeePercent: string;
  itabFeePercent: string;
  isFeatured: boolean;
  selectedAmenities: string[];
  customAmenityInput: string;
  photos: string[];
  photoUrlInput: string;
  tourUrl: string;
}

const EMPTY_FORM: FormState = {
  title: '', description: '', type: 'apartment', customType: '',
  address: '', district: 'Kampala', customDistrict: '',
  location: null, latitude: '', longitude: '',
  bedrooms: '1', bathrooms: '1', squareFootage: '',
  rentPrice: '', deposit: '', availableFrom: '',
  managementFeePercent: '10', itabFeePercent: '2',
  isFeatured: false,
  selectedAmenities: [],
  customAmenityInput: '',
  photos: [],
  photoUrlInput: '',
  tourUrl: '',
};

function formFromProperty(p: Property): FormState {
  return {
    title: p.title, description: p.description,
    type: BASE_TYPES.includes(p.type) ? p.type : 'other',
    customType: BASE_TYPES.includes(p.type) ? '' : p.type,
    address: p.address,
    district: DISTRICTS.includes(p.district) ? p.district : 'other',
    customDistrict: DISTRICTS.includes(p.district) ? '' : p.district,
    location: (p.latitude && p.longitude)
      ? { lat: p.latitude, lng: p.longitude, address: p.address }
      : null,
    latitude: String(p.latitude), longitude: String(p.longitude),
    bedrooms: String(p.bedrooms), bathrooms: String(p.bathrooms),
    squareFootage: p.squareFootage ? String(p.squareFootage) : '',
    rentPrice: String(p.rentPrice), deposit: String(p.deposit),
    availableFrom: p.availableFrom,
    managementFeePercent: String(p.managementFeePercent),
    itabFeePercent: String(p.itabFeePercent),
    isFeatured: p.isFeatured,
    selectedAmenities: [...p.amenities],
    customAmenityInput: '',
    photos: [...p.photos],
    photoUrlInput: '',
    tourUrl: p.tourUrl || '',
  };
}

export function PropertyFormModal({ open, onClose, editProperty }: Props) {
  const { user } = useAuthStore();
  const { addProperty, updateProperty, customAmenities, customPropertyTypes, customDistricts,
          addCustomAmenity, addCustomPropertyType, addCustomDistrict } = usePropertyStore();

  const isEdit = !!editProperty;
  const allowCustomTypeDistrict = user?.role !== 'agent';
  const [form, setForm] = useState<FormState>(() => editProperty ? formFromProperty(editProperty) : EMPTY_FORM);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [step, setStep] = useState(1);
  const [saving, setSaving] = useState(false);

  // Reset when modal opens/closes
  const handleClose = () => {
    setForm(editProperty ? formFromProperty(editProperty) : EMPTY_FORM);
    setStep(1);
    onClose();
  };

  const set = (key: keyof FormState, value: unknown) =>
    setForm(f => ({ ...f, [key]: value }));

  // ── Amenity helpers ──────────────────────────────────────────────────────
  const allAmenities = { ...amenityIcons, ...Object.fromEntries(customAmenities.map(a => [a, '✨'])) };

  const toggleAmenity = (key: string) => {
    setForm(f => ({
      ...f,
      selectedAmenities: f.selectedAmenities.includes(key)
        ? f.selectedAmenities.filter(a => a !== key)
        : [...f.selectedAmenities, key],
    }));
  };

  const handleAddCustomAmenity = () => {
    const val = form.customAmenityInput.trim();
    if (!val) return;
    const key = val.toLowerCase().replace(/\s+/g, '_');
    addCustomAmenity(val);
    setForm(f => ({
      ...f,
      selectedAmenities: f.selectedAmenities.includes(key) ? f.selectedAmenities : [...f.selectedAmenities, key],
      customAmenityInput: '',
    }));
    toast.success(`Amenity "${val}" added!`);
  };

  // ── Photo helpers ────────────────────────────────────────────────────────
  const handleAddPhotoUrl = () => {
    const url = form.photoUrlInput.trim();
    if (!url) return;
    setForm(f => ({ ...f, photos: [...f.photos, url], photoUrlInput: '' }));
  };

  const removePhoto = (url: string) => {
    setForm(f => ({ ...f, photos: f.photos.filter(p => p !== url) }));
  };

  // ── Custom type / district ───────────────────────────────────────────────
  const handleAddCustomType = () => {
    const val = form.customType.trim();
    if (!val) return;
    const key = val.toLowerCase().replace(/\s+/g, '_');
    addCustomPropertyType(val);
    // Auto-select the newly added type
    setForm(f => ({ ...f, type: key, customType: '' }));
    toast.success(`Property type "${val}" added and selected!`);
  };

  const handleAddCustomDistrict = () => {
    const val = form.customDistrict.trim();
    if (!val) return;
    addCustomDistrict(val);
    // Auto-select the newly added district
    setForm(f => ({ ...f, district: val, customDistrict: '' }));
    toast.success(`District "${val}" added and selected!`);
  };

  // ── Resolve final type / district ────────────────────────────────────────
  const resolvedType = form.type === 'other' ? form.customType.toLowerCase().replace(/\s+/g, '_') : form.type;
  const resolvedDistrict = form.district === 'other' ? form.customDistrict.trim() : form.district;

  // ── Validation ───────────────────────────────────────────────────────────
  const validate = () => {
    if (!form.title.trim()) { toast.error('Property title is required'); return false; }
    if (!resolvedType) { toast.error('Select or enter a property type'); return false; }
    if (!form.address.trim()) { toast.error('Address is required'); return false; }
    if (!resolvedDistrict) { toast.error('Select or enter a district'); return false; }
    if (!form.rentPrice || Number(form.rentPrice) <= 0) { toast.error('Enter a valid rent price'); return false; }
    return true;
  };

  // ── Save ─────────────────────────────────────────────────────────────────
  const handleSave = async (status: 'draft' | 'published' | 'pending_vetting') => {
    if (!validate()) return;
    setSaving(true);

    const payload = {
      title: form.title.trim(),
      description: form.description.trim(),
      type: resolvedType as Property['type'],
      status,
      address: form.address.trim(),
      district: resolvedDistrict,
      latitude: form.location?.lat ?? (parseFloat(form.latitude) || 0.3476),
      longitude: form.location?.lng ?? (parseFloat(form.longitude) || 32.5825),
      bedrooms: parseInt(form.bedrooms) || 0,
      bathrooms: parseInt(form.bathrooms) || 0,
      squareFootage: form.squareFootage ? parseInt(form.squareFootage) : undefined,
      rentPrice: parseInt(form.rentPrice),
      deposit: parseInt(form.deposit) || parseInt(form.rentPrice) * 2,
      availableFrom: form.availableFrom || new Date().toISOString().split('T')[0],
      photos: uploadedFiles.length > 0
        ? [...uploadedFiles.map(f => f.dataUrl), ...form.photos.filter(p => p.startsWith('http'))]
        : form.photos.length > 0
          ? form.photos
          : ['https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800'],
      amenities: form.selectedAmenities,
      managementFeePercent: parseFloat(form.managementFeePercent) || 10,
      itabFeePercent: parseFloat(form.itabFeePercent) || 2,
      isFeatured: form.isFeatured,
      tourUrl: form.tourUrl.trim() || undefined,
      managerId:
        user?.role === 'property_manager' || user?.role === 'agent'
          ? user.id
          : undefined,
      managerName:
        user?.role === 'property_manager' || user?.role === 'agent'
          ? `${user.firstName} ${user.lastName}`
          : undefined,
      landlordId: user?.role === 'landlord' ? user.id : undefined,
      landlordName: user?.role === 'landlord' ? `${user.firstName} ${user.lastName}` : undefined,
      createdById: user?.id,
      createdByName: user ? `${user.firstName} ${user.lastName}`.trim() : undefined,
      createdByRole: user?.role,
    };

    if (isEdit && editProperty) {
      updateProperty(editProperty.id, payload);
      toast.success('Property updated!');
    } else {
      addProperty(payload);
      toast.success(status === 'draft' ? 'Saved as draft!' : '🎉 Property published!');
    }

    setSaving(false);
    handleClose();
  };

  // ── All property types (base + custom) ───────────────────────────────────
  const allTypes = [...BASE_TYPES, ...customPropertyTypes];
  const allDistricts = [...DISTRICTS, ...customDistricts];

  const steps = ['Basic Info', 'Details', 'Amenities', 'Photos'];

  return (
    <Modal open={open} onClose={handleClose} size="xl"
      title={isEdit ? `Edit: ${editProperty?.title}` : 'Add New Property'}
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="flex gap-2">
            {step > 1 && <Button variant="secondary" onClick={() => setStep(s => s - 1)}>← Back</Button>}
          </div>
          <div className="flex gap-2">
            {step < 4 ? (
              <Button onClick={() => setStep(s => s + 1)}>Next →</Button>
            ) : (
              <>
                {!isEdit && (
                  <Button variant="secondary" loading={saving} onClick={() => handleSave('draft')}>Save Draft</Button>
                )}
                <Button loading={saving} onClick={() => handleSave(
                  isEdit ? (editProperty!.status as 'draft' | 'published' | 'pending_vetting') :
                  (user?.role === 'property_manager' ? 'published' : 'pending_vetting')
                )}>
                  {isEdit ? 'Save Changes' : user?.role === 'property_manager' ? '🚀 Publish' : 'Submit for Approval'}
                </Button>
              </>
            )}
          </div>
        </div>
      }
    >
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6">
        {steps.map((label, i) => (
          <div key={label} className="flex items-center gap-2 flex-1">
            <button onClick={() => setStep(i + 1)} className="flex items-center gap-2 group">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${step > i + 1 ? 'bg-green-500 text-white' : step === i + 1 ? 'bg-primary-600 text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                {step > i + 1 ? '✓' : i + 1}
              </div>
              <span className={`text-xs font-medium hidden sm:block ${step === i + 1 ? 'text-primary-600' : 'text-slate-400'}`}>{label}</span>
            </button>
            {i < steps.length - 1 && <div className={`flex-1 h-0.5 ${step > i + 1 ? 'bg-green-400' : 'bg-slate-200 dark:bg-slate-700'}`} />}
          </div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={step} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} transition={{ duration: 0.2 }}>

          {/* ── Step 1: Basic Info ─────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <Input label="Property Title *" placeholder="e.g. 3-Bedroom Apartment in Kololo"
                value={form.title} onChange={e => set('title', e.target.value)} />
              <Textarea label="Description" placeholder="Describe the property — location highlights, condition, nearby amenities..."
                value={form.description} onChange={e => set('description', e.target.value)} />

              {/* Property Type */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  Property Type *
                </label>
                <div className="flex gap-2">
                  <select value={form.type} onChange={e => set('type', e.target.value)}
                    className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm">
                    {allTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                    {allowCustomTypeDistrict && <option value="other">+ Other (custom)</option>}
                  </select>
                </div>
                {allowCustomTypeDistrict && form.type === 'other' && (
                  <div className="flex gap-2 mt-2">
                    <Input placeholder="Enter custom property type" value={form.customType}
                      onChange={e => set('customType', e.target.value)}
                      icon={<Building2 size={15} />} />
                    <Button size="sm" variant="secondary" onClick={handleAddCustomType} icon={<Plus size={14} />}>Save</Button>
                  </div>
                )}
              </div>

              {/* District */}
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                  District *
                </label>
                <select value={form.district} onChange={e => set('district', e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm">
                  {allDistricts.map(d => <option key={d} value={d}>{d}</option>)}
                  {allowCustomTypeDistrict && <option value="other">+ Other (custom)</option>}
                </select>
                {allowCustomTypeDistrict && form.district === 'other' && (
                  <div className="flex gap-2 mt-2">
                    <Input placeholder="Enter district name" value={form.customDistrict}
                      onChange={e => set('customDistrict', e.target.value)}
                      icon={<MapPin size={15} />} />
                    <Button size="sm" variant="secondary" onClick={handleAddCustomDistrict} icon={<Plus size={14} />}>Save</Button>
                  </div>
                )}
              </div>

              <Input label="Full Address *" placeholder="Plot number, street name, area"
                value={form.address} onChange={e => set('address', e.target.value)} />

              {/* Location picker — GPS + map */}
              <LocationPicker
                label="Pin Location on Map"
                hint="Use GPS to auto-fill coordinates, or tap the map to place the pin manually. This powers the map view for tenants."
                value={form.location}
                onChange={(loc) => {
                  set('location', loc);
                  // Auto-fill address if empty
                  if (!form.address && loc.address) set('address', loc.address);
                }}
                onClear={() => set('location', null)}
              />
            </div>
          )}

          {/* ── Step 2: Details ────────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <Input label="Bedrooms" type="number" min="0" placeholder="0"
                  value={form.bedrooms} onChange={e => set('bedrooms', e.target.value)} />
                <Input label="Bathrooms" type="number" min="0" placeholder="0"
                  value={form.bathrooms} onChange={e => set('bathrooms', e.target.value)} />
                <Input label="Size (m²)" type="number" min="0" placeholder="e.g. 120"
                  value={form.squareFootage} onChange={e => set('squareFootage', e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Input label="Monthly Rent (UGX) *" type="number" min="0" placeholder="e.g. 1,500,000"
                  value={form.rentPrice} onChange={e => set('rentPrice', e.target.value)} />
                <Input label="Deposit (UGX)" type="number" min="0" placeholder="Defaults to 2× rent"
                  value={form.deposit} onChange={e => set('deposit', e.target.value)} />
              </div>
              <Input label="Available From" type="date"
                value={form.availableFrom} onChange={e => set('availableFrom', e.target.value)} />
              <Input
                label="Virtual Tour URL (optional)"
                type="url"
                placeholder="https://www.youtube.com/watch?v=..."
                value={form.tourUrl}
                onChange={e => set('tourUrl', e.target.value)}
                hint="YouTube video URL for a virtual walkthrough"
              />
              <div className="grid grid-cols-2 gap-3">
                <Input label="Management Fee %" type="number" min="0" max="30" step="0.5"
                  value={form.managementFeePercent} onChange={e => set('managementFeePercent', e.target.value)}
                  hint="Typically 8–12%" />
                <Input label="ITAB Platform Fee %" type="number" min="0" max="10" step="0.5"
                  value={form.itabFeePercent} onChange={e => set('itabFeePercent', e.target.value)} />
              </div>
              <label className="flex items-center gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-600 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors">
                <input type="checkbox" checked={form.isFeatured} onChange={e => set('isFeatured', e.target.checked)}
                  className="w-4 h-4 rounded text-primary-600" />
                <div>
                  <p className="text-sm font-medium text-slate-900 dark:text-slate-100">⭐ Featured Listing</p>
                  <p className="text-xs text-slate-400">Highlighted at the top of search results</p>
                </div>
              </label>
            </div>
          )}

          {/* ── Step 3: Amenities ──────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Select all that apply. Can't find one? Add your own below.
              </p>

              {/* Preset amenities */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {Object.entries(allAmenities).map(([key, icon]) => {
                  const isSelected = form.selectedAmenities.includes(key);
                  return (
                    <button key={key} type="button" onClick={() => toggleAmenity(key)}
                      className={`flex items-center gap-2 p-2.5 rounded-xl border-2 text-sm font-medium transition-all text-left ${isSelected ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300' : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-slate-300 dark:hover:border-slate-500'}`}>
                      <span className="text-base flex-shrink-0">{icon}</span>
                      <span className="truncate capitalize">{key.replace(/_/g, ' ')}</span>
                      {isSelected && <span className="ml-auto text-primary-500 flex-shrink-0">✓</span>}
                    </button>
                  );
                })}
              </div>

              {/* Add custom amenity */}
              <div className="border-t border-slate-100 dark:border-slate-700 pt-4">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <Tag size={12} /> Add Custom Amenity
                </p>
                <div className="flex gap-2">
                  <Input placeholder="e.g. Solar panels, Borehole, Servant quarters, DSTV..."
                    value={form.customAmenityInput}
                    onChange={e => set('customAmenityInput', e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomAmenity(); } }}
                    hint="Type any amenity not listed above and press Enter or click Add" />
                  <Button variant="secondary" onClick={handleAddCustomAmenity} icon={<Plus size={15} />}
                    disabled={!form.customAmenityInput.trim()}>Add</Button>
                </div>
              </div>

              {/* Selected summary */}
              {form.selectedAmenities.length > 0 && (
                <div className="bg-primary-50 dark:bg-primary-900/20 rounded-xl p-3">
                  <p className="text-xs font-semibold text-primary-700 dark:text-primary-300 mb-2">
                    {form.selectedAmenities.length} amenities selected:
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {form.selectedAmenities.map(a => (
                      <span key={a} className="inline-flex items-center gap-1 bg-white dark:bg-slate-800 border border-primary-200 dark:border-primary-700 text-primary-700 dark:text-primary-300 text-xs px-2.5 py-1 rounded-full">
                        {allAmenities[a] || '✨'} {a.replace(/_/g, ' ')}
                        <button onClick={() => toggleAmenity(a)} className="ml-0.5 hover:text-red-500 transition-colors">×</button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ── Step 4: Photos ─────────────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Add photos from your device, take a photo with your camera, or paste image URLs. First photo is the cover image.
              </p>

              {/* FileUpload component — handles drag-drop, browse, camera */}
              <FileUpload
                accept="image/*"
                multiple
                maxFiles={10}
                maxSizeMB={10}
                showCamera
                value={uploadedFiles}
                onChange={files => {
                  setUploadedFiles(files);
                  set('photos', files.map(f => f.dataUrl));
                }}
                hint="Drag & drop, browse from device, or take a photo with your camera. First photo becomes the cover."
              />

              {/* Or paste URL */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <ImagePlus size={12} /> Or add by URL
                </p>
                <div className="flex gap-2">
                  <Input placeholder="https://example.com/photo.jpg"
                    value={form.photoUrlInput}
                    onChange={e => set('photoUrlInput', e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && handleAddPhotoUrl()} />
                  <Button variant="secondary" onClick={handleAddPhotoUrl} icon={<Plus size={15} />}>Add</Button>
                </div>
              </div>

              {/* URL-added photos */}
              {form.photos.filter(p => p.startsWith('http')).length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">URL Photos</p>
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                    {form.photos.filter(p => p.startsWith('http')).map((url, i) => (
                      <div key={url} className="relative group aspect-square rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700">
                        <img src={url} alt={`Photo ${i + 1}`} className="w-full h-full object-cover"
                          onError={e => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/200?text=Error'; }} />
                        <button onClick={() => removePhoto(url)}
                          className="absolute top-1 right-1 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600">
                          <X size={12} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {uploadedFiles.length === 0 && form.photos.filter(p => p.startsWith('http')).length === 0 && (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
                  <p className="text-xs text-amber-700 dark:text-amber-400">
                    ⚠️ No photos added. A default placeholder will be used. Properties with photos get 80% more views.
                  </p>
                </div>
              )}
            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </Modal>
  );
}
