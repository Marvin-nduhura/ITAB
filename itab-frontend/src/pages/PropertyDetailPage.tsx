import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, MapPin, Bed, Bath, Square, Heart, Share2, Calendar, Phone, MessageSquare, Star, ChevronLeft, ChevronRight, CheckCircle2, Navigation, ClipboardCheck, XCircle, AlertTriangle, Eye, QrCode } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input, Textarea } from '../components/ui/Input';
import { QRCodeDisplay } from '../components/ui/QRCodeDisplay';
import { useAuthStore } from '../store/authStore';
import { usePropertyStore } from '../store/propertyStore';
import { useGeolocation } from '../hooks/useGeolocation';
import { formatCurrency, propertyStatusConfig, amenityIcons, INSPECTION_FEE } from '../lib/utils';
import { canDo } from '../lib/rbac';
import toast from 'react-hot-toast';
import { GoogleMap, useJsApiLoader, Marker, Circle } from '@react-google-maps/api';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' };

export function PropertyDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  // ── ALL hooks must be called before any conditional return ──────────────
  const { properties, updateProperty } = usePropertyStore();
  const { position, status: geoStatus, getLocation } = useGeolocation();
  const { isLoaded: mapsLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY });
  const [photoIdx, setPhotoIdx] = useState(0);
  const [isFavorite, setIsFavorite] = useState(false);
  const [showBookModal, setShowBookModal] = useState(false);
  const [showPayModal, setShowPayModal] = useState(false);
  const [showQRModal, setShowQRModal] = useState(false);
  const [bookingDate, setBookingDate] = useState('');
  const [bookingTime, setBookingTime] = useState('');
  const [payMethod, setPayMethod] = useState<'mtn_momo' | 'airtel_money' | 'cash'>('mtn_momo');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [vettingChecks, setVettingChecks] = useState({
    photosClean: false,
    rentReasonable: false,
    ownershipDocVerified: false,
    landlordContactVerified: false,
    addressVerified: false,
    amenitiesAccurate: false,
  });
  const [vettingNotes, setVettingNotes] = useState('');
  const [vettingLoading, setVettingLoading] = useState(false);

  // ── Now safe to do conditional logic ────────────────────────────────────
  const property = properties.find(p => p.id === id);
  if (!property) return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-3xl">🏠</div>
      <p className="font-semibold text-slate-700 dark:text-slate-300">Property not found</p>
      <p className="text-sm text-slate-400">This property may have been removed or the link is invalid.</p>
      <Button onClick={() => navigate('/properties')}>Back to Properties</Button>
    </div>
  );

  const allChecked = Object.values(vettingChecks).every(Boolean);
  const canVet = canDo.vetProperty(user);
  const isPendingVetting = property.status === 'pending_vetting';
  const isDraft = property.status === 'draft';
  const isOwner = user && (
    user.role === 'admin' ||
    (user.role === 'property_manager' && (property.managerId === user.id || !property.managerId)) ||
    (user.role === 'landlord' && (property.landlordId === user.id || !property.landlordId)) ||
    (user.role === 'agent' && (property.managerId === user.id || !property.managerId))
  );

  const handleApprove = async () => {
    if (!allChecked) { toast.error('Complete all vetting checks before approving'); return; }
    setVettingLoading(true);
    await new Promise(r => setTimeout(r, 800));
    updateProperty(property.id, { status: 'published' });
    setVettingLoading(false);
    toast.success('✅ Property approved and published!');
  };

  const handleReject = async () => {
    if (!vettingNotes.trim()) { toast.error('Please add rejection notes for the submitter'); return; }
    setVettingLoading(true);
    await new Promise(r => setTimeout(r, 800));
    updateProperty(property.id, { status: 'rejected' });
    setVettingLoading(false);
    toast.error('Property rejected. Submitter has been notified.');
  };

  const handleRequestChanges = async () => {
    if (!vettingNotes.trim()) { toast.error('Please describe what changes are needed'); return; }
    setVettingLoading(true);
    await new Promise(r => setTimeout(r, 800));
    setVettingLoading(false);
    toast('Changes requested. Submitter has been notified.', { icon: '📝' });
  };

  const sc = propertyStatusConfig[property.status] || { label: property.status, color: 'badge-gray' };

  const handleBookInspection = () => {
    if (!user) { toast('Please sign in to book an inspection', { icon: '🔒' }); navigate('/login'); return; }
    setShowBookModal(true);
  };

  const handleConfirmBooking = () => {
    if (!bookingDate || !bookingTime) { toast.error('Please select a date and time'); return; }
    setShowBookModal(false);
    setShowPayModal(true);
  };

  const handlePayment = async () => {
    if (payMethod !== 'cash' && !phone) { toast.error('Please enter your phone number'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 1500));
    setLoading(false);
    setShowPayModal(false);
    toast.success('🎉 Inspection booked! Check your email for confirmation.');
  };

  const toggleFavorite = () => {
    if (!user) { toast('Sign in to save favorites', { icon: '🔒' }); return; }
    setIsFavorite(!isFavorite);
    toast(isFavorite ? 'Removed from favorites' : '❤️ Added to favorites!');
  };

  const share = () => {
    const url = window.location.href;
    if (navigator.share) navigator.share({ title: property.title, url });
    else { navigator.clipboard.writeText(url); toast.success('Link copied!'); }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Back */}
      <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
        <ArrowLeft size={16} /> Back to properties
      </button>

      {/* ── Status banners for non-published states ─────────────────────── */}
      {isDraft && (
        <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl">
          <Eye size={18} className="text-slate-500 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-slate-700 dark:text-slate-300 text-sm">Draft — Not visible to tenants</p>
            <p className="text-xs text-slate-400 mt-0.5">This property is saved as a draft. Submit it for approval when ready.</p>
          </div>
          {isOwner && (
            <Button size="sm" onClick={() => { updateProperty(property.id, { status: 'pending_vetting' }); toast.success('Submitted for vetting!'); }}>
              Submit for Approval
            </Button>
          )}
        </div>
      )}

      {isPendingVetting && !canVet && (
        <div className="flex items-start gap-3 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-2xl">
          <AlertTriangle size={18} className="text-yellow-600 mt-0.5 flex-shrink-0" />
          <div>
            <p className="font-semibold text-yellow-800 dark:text-yellow-300 text-sm">Pending Vetting</p>
            <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-0.5">This property is under review by a property manager. It will be published once approved.</p>
          </div>
        </div>
      )}

      {property.status === 'rejected' && (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
          <XCircle size={18} className="text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-red-800 dark:text-red-300 text-sm">Rejected</p>
            <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">This property was rejected. Please review the feedback and resubmit.</p>
          </div>
          {isOwner && (
            <Button size="sm" variant="secondary" onClick={() => { updateProperty(property.id, { status: 'draft' }); toast('Moved back to draft. Edit and resubmit.'); }}>
              Edit & Resubmit
            </Button>
          )}
        </div>
      )}

      {/* ── Vetting panel (managers/admins only, when pending) ──────────── */}
      {canVet && isPendingVetting && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border-2 border-yellow-300 dark:border-yellow-700 overflow-hidden">
          <div className="flex items-center gap-3 px-5 py-4 bg-yellow-50 dark:bg-yellow-900/20 border-b border-yellow-200 dark:border-yellow-800">
            <ClipboardCheck size={20} className="text-yellow-600" />
            <div>
              <p className="font-bold text-yellow-800 dark:text-yellow-300">Property Vetting Checklist</p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400">Complete all checks before approving or rejecting this property</p>
            </div>
            <Badge variant="yellow" className="ml-auto">Pending Review</Badge>
          </div>
          <div className="p-5 space-y-4">
            {/* Checklist */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                { key: 'photosClean' as const,           label: 'Photos are clear and accurate',           desc: 'At least 3 good quality photos' },
                { key: 'rentReasonable' as const,        label: 'Rent price is reasonable for the area',   desc: 'Compare with similar properties' },
                { key: 'ownershipDocVerified' as const,  label: 'Ownership document verified',             desc: 'Title deed or agreement of sale' },
                { key: 'landlordContactVerified' as const,label: 'Landlord contact verified',              desc: 'Phone number confirmed' },
                { key: 'addressVerified' as const,       label: 'Address and location verified',           desc: 'Map pin matches actual location' },
                { key: 'amenitiesAccurate' as const,     label: 'Amenities are accurately listed',         desc: 'No false claims' },
              ].map(item => (
                <label key={item.key}
                  className={`flex items-start gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${vettingChecks[item.key] ? 'border-green-400 bg-green-50 dark:bg-green-900/20' : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'}`}>
                  <div
                    onClick={() => setVettingChecks(c => ({ ...c, [item.key]: !c[item.key] }))}
                    className={`w-5 h-5 rounded-md border-2 flex items-center justify-center flex-shrink-0 mt-0.5 transition-all ${vettingChecks[item.key] ? 'bg-green-500 border-green-500' : 'border-slate-300 dark:border-slate-600'}`}>
                    {vettingChecks[item.key] && <CheckCircle2 size={12} className="text-white" />}
                  </div>
                  <div>
                    <p className={`text-sm font-medium ${vettingChecks[item.key] ? 'text-green-800 dark:text-green-300' : 'text-slate-700 dark:text-slate-300'}`}>{item.label}</p>
                    <p className="text-xs text-slate-400">{item.desc}</p>
                  </div>
                </label>
              ))}
            </div>

            {/* Progress */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                <div className="h-full bg-green-500 rounded-full transition-all duration-500"
                  style={{ width: `${(Object.values(vettingChecks).filter(Boolean).length / 6) * 100}%` }} />
              </div>
              <span className="text-xs font-semibold text-slate-600 dark:text-slate-400">
                {Object.values(vettingChecks).filter(Boolean).length}/6 checks
              </span>
            </div>

            {/* Notes */}
            <Textarea label="Vetting Notes / Feedback" placeholder="Add notes for the submitter (required for rejection or change requests)..."
              value={vettingNotes} onChange={e => setVettingNotes(e.target.value)} rows={3} />

            {/* Actions */}
            <div className="flex gap-3 flex-wrap">
              <Button loading={vettingLoading} onClick={handleApprove} disabled={!allChecked}
                icon={<CheckCircle2 size={15} />} className="flex-1">
                ✅ Approve & Publish
              </Button>
              <Button variant="secondary" loading={vettingLoading} onClick={handleRequestChanges}
                icon={<AlertTriangle size={15} />}>
                Request Changes
              </Button>
              <Button variant="danger" loading={vettingLoading} onClick={handleReject}
                icon={<XCircle size={15} />}>
                Reject
              </Button>
            </div>

            {!allChecked && (
              <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                <AlertTriangle size={12} />
                Complete all 6 checks to enable the Approve button
              </p>
            )}
          </div>
        </motion.div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Photos + Details */}
        <div className="lg:col-span-2 space-y-5">
          {/* Photo gallery */}
          <div className="relative rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-800">
            <motion.img
              key={photoIdx}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              src={property.photos[photoIdx]}
              alt={property.title}
              className="w-full h-72 sm:h-96 object-cover"
            />
            {property.photos.length > 1 && (
              <>
                <button onClick={() => setPhotoIdx(i => (i - 1 + property.photos.length) % property.photos.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 dark:bg-slate-800/90 rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform">
                  <ChevronLeft size={18} />
                </button>
                <button onClick={() => setPhotoIdx(i => (i + 1) % property.photos.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/90 dark:bg-slate-800/90 rounded-full flex items-center justify-center shadow-md hover:scale-110 transition-transform">
                  <ChevronRight size={18} />
                </button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {property.photos.map((_, i) => (
                    <button key={i} onClick={() => setPhotoIdx(i)} className={`w-2 h-2 rounded-full transition-all ${i === photoIdx ? 'bg-white w-4' : 'bg-white/50'}`} />
                  ))}
                </div>
              </>
            )}
            {/* Thumbnails */}
            {property.photos.length > 1 && (
              <div className="absolute bottom-3 right-3 flex gap-1.5">
                {property.photos.slice(0, 4).map((photo, i) => (
                  <button key={i} onClick={() => setPhotoIdx(i)}
                    className={`w-10 h-10 rounded-lg overflow-hidden border-2 transition-all ${i === photoIdx ? 'border-white' : 'border-transparent opacity-70'}`}>
                    <img src={photo} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
            {property.isFeatured && (
              <div className="absolute top-3 left-3 flex items-center gap-1 bg-gold-500 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                <Star size={10} fill="white" /> Featured
              </div>
            )}
          </div>

          {/* Title & Status */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <Badge variant={sc.color.replace('badge-', '') as 'green'}>{sc.label}</Badge>
                  <Badge variant="gray">{property.type}</Badge>
                </div>
                <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{property.title}</h1>
                <div className="flex items-center gap-1 mt-1 text-slate-400 text-sm">
                  <MapPin size={14} /><span>{property.address}, {property.district}</span>
                </div>
              </div>
              <div className="flex gap-2 flex-shrink-0">
                <button onClick={toggleFavorite} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <Heart size={16} className={isFavorite ? 'fill-red-500 text-red-500' : 'text-slate-400'} />
                </button>
                <button onClick={share} className="w-9 h-9 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors">
                  <Share2 size={16} className="text-slate-400" />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
              {property.bedrooms > 0 && <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400"><Bed size={16} /><span>{property.bedrooms} Bedrooms</span></div>}
              {property.bathrooms > 0 && <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400"><Bath size={16} /><span>{property.bathrooms} Bathrooms</span></div>}
              {property.squareFootage && <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400"><Square size={16} /><span>{property.squareFootage} m²</span></div>}
            </div>
          </div>

          {/* Description */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5">
            <h2 className="font-bold text-slate-900 dark:text-slate-100 mb-3">Description</h2>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{property.description}</p>
          </div>

          {/* Amenities */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5">
            <h2 className="font-bold text-slate-900 dark:text-slate-100 mb-3">Amenities</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {property.amenities.map(a => (
                <div key={a} className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/50 text-sm text-slate-700 dark:text-slate-300">
                  <CheckCircle2 size={14} className="text-green-500 flex-shrink-0" />
                  <span>{amenityIcons[a]} {a.replace(/_/g, ' ')}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Virtual Tour (YouTube embed) — shown if property has a tour URL) */}
          {property.tourUrl && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5">
              <h2 className="font-bold text-slate-900 dark:text-slate-100 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5 text-red-500" viewBox="0 0 24 24" fill="currentColor"><path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/></svg>
                Virtual Tour
              </h2>
              <div className="relative w-full" style={{ paddingBottom: '56.25%' }}>
                <iframe
                  className="absolute inset-0 w-full h-full rounded-xl"
                  src={`https://www.youtube.com/embed/${property.tourUrl.split('v=')[1]?.split('&')[0] || property.tourUrl.split('youtu.be/')[1]?.split('?')[0] || ''}`}
                  title="Virtual Tour"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              </div>
            </div>
          )}

          {/* Map */}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-bold text-slate-900 dark:text-slate-100">Location</h2>
              <div className="flex items-center gap-2">
                {/* Distance badge */}
                {position && (() => {
                  const R = 6371;
                  const dLat = (property.latitude - position.lat) * Math.PI / 180;
                  const dLng = (property.longitude - position.lng) * Math.PI / 180;
                  const a = Math.sin(dLat/2)**2 + Math.cos(position.lat*Math.PI/180)*Math.cos(property.latitude*Math.PI/180)*Math.sin(dLng/2)**2;
                  const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
                  return (
                    <span className="text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2.5 py-1 rounded-full font-medium">
                      📍 {dist < 1 ? `${Math.round(dist * 1000)}m` : `${dist.toFixed(1)}km`} from you
                    </span>
                  );
                })()}
                {/* Get my location */}
                <button
                  onClick={getLocation}
                  disabled={geoStatus === 'loading'}
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-medium transition-all disabled:opacity-50"
                >
                  {geoStatus === 'loading'
                    ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    : <Navigation size={12} />}
                  {geoStatus === 'loading' ? 'Locating…' : 'My Location'}
                </button>
                {/* Directions */}
                <a
                  href={`https://www.google.com/maps/dir/${position ? `${position.lat},${position.lng}` : ''}/${property.latitude},${property.longitude}`}
                  target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 font-medium transition-all"
                >
                  <MapPin size={12} /> Directions
                </a>
              </div>
            </div>
            <div className="h-64 rounded-xl overflow-hidden">
              {/* Guard: only render map when we have valid coordinates */}
              {(property.latitude && property.longitude && !isNaN(property.latitude) && !isNaN(property.longitude)) ? (
                mapsLoaded ? (
                  <GoogleMap
                    mapContainerStyle={MAP_CONTAINER_STYLE}
                    center={{ lat: property.latitude, lng: property.longitude }}
                    zoom={15}
                    options={{ streetViewControl: false, mapTypeControl: false, scrollwheel: false }}
                  >
                    <Marker position={{ lat: property.latitude, lng: property.longitude }} />
                    {position && (
                      <>
                        <Marker
                          position={{ lat: position.lat, lng: position.lng }}
                          icon={{ path: google.maps.SymbolPath.CIRCLE, scale: 7, fillColor: '#2563eb', fillOpacity: 1, strokeColor: 'white', strokeWeight: 2 }}
                        />
                        <Circle
                          center={{ lat: position.lat, lng: position.lng }}
                          radius={position.accuracy || 50}
                          options={{ strokeColor: '#2563eb', strokeOpacity: 0.4, strokeWeight: 1, fillColor: '#2563eb', fillOpacity: 0.1 }}
                        />
                      </>
                    )}
                  </GoogleMap>
                ) : (
                  <div className="h-full flex items-center justify-center bg-slate-100 dark:bg-slate-700">
                    <span className="w-6 h-6 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
                  </div>
                )
              ) : (
                /* No coordinates — show a placeholder with a pin-on-map prompt */
                <div className="h-full bg-slate-100 dark:bg-slate-700 rounded-xl flex flex-col items-center justify-center gap-3 text-slate-400">
                  <MapPin size={32} className="text-slate-300 dark:text-slate-600" />
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400">No location set</p>
                    <p className="text-xs text-slate-400 mt-0.5">Edit this property to add a map pin</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right: Booking card */}
        <div className="space-y-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card-lg border border-slate-100 dark:border-slate-700 p-5 sticky top-24">
            <div className="mb-4">
              <p className="text-3xl font-bold text-primary-600">{formatCurrency(property.rentPrice)}</p>
              <p className="text-sm text-slate-400">per month</p>
              <p className="text-sm text-slate-500 mt-1">Deposit: <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(property.deposit)}</span></p>
            </div>

            {/* Inspection fee info */}
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 mb-4">
              <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">📋 Inspection Fee</p>
              <p className="text-xs text-amber-700 dark:text-amber-400">
                <strong>{formatCurrency(INSPECTION_FEE)}</strong> (non-refundable). This amount will be credited toward your first rent if you take the property.
              </p>
            </div>

            <div className="space-y-2.5">
              {property.status === 'published' && (
                <Button className="w-full" size="lg" icon={<Calendar size={16} />} onClick={handleBookInspection}>
                  Book Inspection
                </Button>
              )}
              <Button variant="secondary" className="w-full" icon={<MessageSquare size={16} />}
                onClick={() => { if (!user) { navigate('/login'); return; } navigate('/messages'); }}>
                Message Manager
              </Button>
              {property.managerName && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                  <div className="w-9 h-9 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center text-primary-600 font-bold text-sm">
                    {property.managerName[0]}
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{property.managerName}</p>
                    <p className="text-xs text-slate-400">Property Manager</p>
                  </div>
                  <a href="tel:+256700000002" className="ml-auto p-2 rounded-xl bg-primary-50 dark:bg-primary-900/30 text-primary-600">
                    <Phone size={14} />
                  </a>
                </div>
              )}
            </div>

            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-2 text-xs text-slate-500">
              <div className="flex justify-between"><span>Management fee</span><span>{property.managementFeePercent}%</span></div>
              <div className="flex justify-between"><span>Available from</span><span>{property.availableFrom}</span></div>
              <div className="flex justify-between"><span>Views</span><span>{property.viewCount}</span></div>
            </div>

            {/* QR Code for "For Rent" sign */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={() => setShowQRModal(true)}
                className="w-full flex items-center justify-center gap-2 py-2 rounded-xl border border-dashed border-slate-300 dark:border-slate-600 text-xs text-slate-500 hover:border-primary-400 hover:text-primary-600 transition-colors"
              >
                <QrCode size={14} /> Generate QR Code for "For Rent" Sign
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Book Inspection Modal */}
      <Modal open={showBookModal} onClose={() => setShowBookModal(false)} title="Book Inspection"
        footer={<><Button variant="secondary" onClick={() => setShowBookModal(false)}>Cancel</Button><Button onClick={handleConfirmBooking}>Continue to Payment</Button></>}>
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">{property.title}</p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">{property.address}</p>
          </div>
          <Input label="Preferred Date" type="date" value={bookingDate} onChange={e => setBookingDate(e.target.value)} min={new Date().toISOString().split('T')[0]} />
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
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3">
            <p className="text-xs text-amber-700 dark:text-amber-400">
              ⚠️ Inspection fee of <strong>{formatCurrency(INSPECTION_FEE)}</strong> is required to confirm your booking. This fee is <strong>non-refundable</strong> but will be credited toward your first rent if you take the property.
            </p>
          </div>
        </div>
      </Modal>

      {/* Payment Modal */}
      <Modal open={showPayModal} onClose={() => setShowPayModal(false)} title="Pay Inspection Fee"
        footer={<><Button variant="secondary" onClick={() => setShowPayModal(false)}>Cancel</Button><Button loading={loading} onClick={handlePayment} variant="gold">Pay {formatCurrency(INSPECTION_FEE)}</Button></>}>
        <div className="space-y-4">
          <div className="text-center py-2">
            <p className="text-3xl font-bold text-slate-900 dark:text-slate-100">{formatCurrency(INSPECTION_FEE)}</p>
            <p className="text-sm text-slate-400 mt-1">Inspection fee (non-refundable)</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Payment Method</label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { value: 'mtn_momo', label: 'MTN MoMo', color: 'bg-yellow-400' },
                { value: 'airtel_money', label: 'Airtel Money', color: 'bg-red-500' },
                { value: 'cash', label: 'Cash', color: 'bg-green-500' },
              ].map(m => (
                <button key={m.value} onClick={() => setPayMethod(m.value as typeof payMethod)}
                  className={`p-3 rounded-xl border-2 text-center transition-all ${payMethod === m.value ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-600'}`}>
                  <div className={`w-6 h-6 ${m.color} rounded-full mx-auto mb-1`} />
                  <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{m.label}</p>
                </button>
              ))}
            </div>
          </div>
          {payMethod !== 'cash' && (
            <Input label={`${payMethod === 'mtn_momo' ? 'MTN' : 'Airtel'} Phone Number`} type="tel" placeholder="07XX XXX XXX" value={phone} onChange={e => setPhone(e.target.value)} />
          )}
          {payMethod === 'cash' && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3">
              <p className="text-xs text-green-700 dark:text-green-400">💵 Pay cash to the property manager at the time of inspection. Your booking will be confirmed pending cash payment.</p>
            </div>
          )}
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3 text-xs text-slate-500 space-y-1">
            <div className="flex justify-between"><span>Inspection fee</span><span className="font-semibold">{formatCurrency(INSPECTION_FEE)}</span></div>
            <div className="flex justify-between text-green-600"><span>Credit if you take property</span><span>-{formatCurrency(INSPECTION_FEE)}</span></div>
            <div className="flex justify-between font-semibold text-slate-700 dark:text-slate-300 pt-1 border-t border-slate-200 dark:border-slate-600"><span>Effective first rent</span><span>{formatCurrency(property.rentPrice - INSPECTION_FEE)}</span></div>
          </div>
        </div>
      </Modal>

      {/* Property QR Code Modal */}
      <Modal
        open={showQRModal}
        onClose={() => setShowQRModal(false)}
        title="Property QR Code"
        size="lg"
        footer={
          <div className="flex gap-2 w-full">
            <Button
              variant="secondary"
              className="flex-1"
              onClick={() => {
                // Open a print-friendly version
                const printUrl = `${window.location.origin}/properties/${property.id}`;
                const win = window.open('', '_blank', 'width=800,height=600');
                if (win) {
                  win.document.write(`
                    <!DOCTYPE html>
                    <html>
                    <head>
                      <title>${property.title} — ITAB Property Services</title>
                      <style>
                        * { box-sizing: border-box; margin: 0; padding: 0; }
                        body { font-family: Arial, sans-serif; color: #1e293b; padding: 32px; background: #fff; }
                        .header { display: flex; align-items: center; gap: 16px; margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #2563eb; }
                        .logo { width: 48px; height: 48px; background: #2563eb; border-radius: 12px; display: flex; align-items: center; justify-content: center; color: white; font-weight: 900; font-size: 18px; }
                        .title { font-size: 22px; font-weight: 700; }
                        .subtitle { font-size: 13px; color: #64748b; margin-top: 2px; }
                        .layout { display: grid; grid-template-columns: 1fr 200px; gap: 24px; }
                        .photo { width: 100%; height: 200px; object-fit: cover; border-radius: 12px; margin-bottom: 16px; }
                        .price { font-size: 28px; font-weight: 800; color: #2563eb; }
                        .price-sub { font-size: 13px; color: #64748b; }
                        .details { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 16px 0; }
                        .detail { background: #f8fafc; border-radius: 8px; padding: 10px; }
                        .detail-label { font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; }
                        .detail-value { font-size: 14px; font-weight: 600; margin-top: 2px; }
                        .amenities { display: flex; flex-wrap: wrap; gap: 6px; margin: 12px 0; }
                        .amenity { background: #eff6ff; color: #1d4ed8; border-radius: 20px; padding: 4px 10px; font-size: 12px; }
                        .desc { font-size: 13px; color: #475569; line-height: 1.6; margin: 12px 0; }
                        .qr-section { text-align: center; }
                        .qr-label { font-size: 11px; color: #64748b; margin-top: 8px; }
                        .scan-text { font-size: 12px; color: #2563eb; font-weight: 600; margin-top: 4px; }
                        .footer { margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8; text-align: center; }
                        .badge { display: inline-block; background: #dcfce7; color: #166534; border-radius: 20px; padding: 3px 10px; font-size: 12px; font-weight: 600; margin-bottom: 8px; }
                        @media print { body { padding: 16px; } }
                      </style>
                    </head>
                    <body>
                      <div class="header">
                        <div class="logo">IT</div>
                        <div>
                          <div class="title">ITAB Property Services</div>
                          <div class="subtitle">Uganda's Premier Property Platform</div>
                        </div>
                      </div>
                      <div class="layout">
                        <div>
                          <span class="badge">For Rent</span>
                          <div class="price">${formatCurrency(property.rentPrice)}<span style="font-size:16px;font-weight:400;color:#64748b">/month</span></div>
                          <div class="price-sub">Deposit: ${formatCurrency(property.deposit)}</div>
                          <h2 style="font-size:18px;font-weight:700;margin:12px 0 4px">${property.title}</h2>
                          <p style="font-size:13px;color:#64748b">📍 ${property.address}, ${property.district}</p>
                          <div class="details">
                            ${property.bedrooms > 0 ? `<div class="detail"><div class="detail-label">Bedrooms</div><div class="detail-value">${property.bedrooms}</div></div>` : ''}
                            ${property.bathrooms > 0 ? `<div class="detail"><div class="detail-label">Bathrooms</div><div class="detail-value">${property.bathrooms}</div></div>` : ''}
                            ${property.squareFootage ? `<div class="detail"><div class="detail-label">Size</div><div class="detail-value">${property.squareFootage} m²</div></div>` : ''}
                            <div class="detail"><div class="detail-label">Type</div><div class="detail-value" style="text-transform:capitalize">${property.type}</div></div>
                            <div class="detail"><div class="detail-label">Available</div><div class="detail-value">${property.availableFrom}</div></div>
                            ${property.managerName ? `<div class="detail"><div class="detail-label">Manager</div><div class="detail-value">${property.managerName}</div></div>` : ''}
                          </div>
                          <div class="amenities">
                            ${property.amenities.map(a => `<span class="amenity">${a.replace(/_/g, ' ')}</span>`).join('')}
                          </div>
                          <div class="desc">${property.description}</div>
                          <p style="font-size:12px;color:#2563eb;font-weight:600">📋 Inspection fee: UGX 100,000 (credited to first rent)</p>
                        </div>
                        <div class="qr-section">
                          <img src="${window.location.origin}/properties/${property.id}" style="display:none" />
                          <div id="qr-placeholder" style="width:180px;height:180px;background:#f1f5f9;border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:12px;color:#64748b;border:2px dashed #cbd5e1">
                            QR Code<br/>(scan to view)
                          </div>
                          <div class="qr-label">Scan to view full listing</div>
                          <div class="scan-text">${printUrl}</div>
                        </div>
                      </div>
                      <div class="footer">
                        ITAB Property Services · itab.ug · Generated ${new Date().toLocaleDateString('en-UG')}
                      </div>
                    </body>
                    </html>
                  `);
                  win.document.close();
                  setTimeout(() => win.print(), 500);
                }
              }}
            >
              🖨️ Print Property Card
            </Button>
            <Button variant="secondary" onClick={() => setShowQRModal(false)}>Close</Button>
          </div>
        }
      >
        <div className="space-y-4">
          {/* Property summary card */}
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-600">
            {/* Photo */}
            <img
              src={property.photos[0]}
              alt={property.title}
              className="w-full h-36 object-cover"
              onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=800'; }}
            />
            <div className="p-4 space-y-3">
              {/* Title + price */}
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-tight">{property.title}</h3>
                  <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                    <MapPin size={10} /> {property.address}, {property.district}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="font-bold text-primary-600 text-base">{formatCurrency(property.rentPrice)}</p>
                  <p className="text-xs text-slate-400">per month</p>
                </div>
              </div>

              {/* Key stats */}
              <div className="grid grid-cols-4 gap-2">
                {[
                  { label: 'Beds',    value: property.bedrooms > 0 ? String(property.bedrooms) : '—' },
                  { label: 'Baths',   value: property.bathrooms > 0 ? String(property.bathrooms) : '—' },
                  { label: 'Size',    value: property.squareFootage ? `${property.squareFootage}m²` : '—' },
                  { label: 'Deposit', value: formatCurrency(property.deposit) },
                ].map(s => (
                  <div key={s.label} className="bg-white dark:bg-slate-800 rounded-xl p-2 text-center">
                    <p className="text-xs text-slate-400">{s.label}</p>
                    <p className="text-xs font-bold text-slate-900 dark:text-slate-100 mt-0.5 truncate">{s.value}</p>
                  </div>
                ))}
              </div>

              {/* Amenities */}
              {property.amenities.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {property.amenities.slice(0, 6).map(a => (
                    <span key={a} className="text-xs bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2 py-0.5 rounded-full">
                      {amenityIcons[a] || '✨'} {a.replace(/_/g, ' ')}
                    </span>
                  ))}
                  {property.amenities.length > 6 && (
                    <span className="text-xs text-slate-400">+{property.amenities.length - 6} more</span>
                  )}
                </div>
              )}

              {/* Manager + inspection fee */}
              <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-200 dark:border-slate-600">
                {property.managerName && <span>👔 {property.managerName}</span>}
                <span className="text-green-600 font-medium">📋 Inspection: {formatCurrency(INSPECTION_FEE)}</span>
              </div>
            </div>
          </div>

          {/* QR code */}
          <div className="flex flex-col items-center gap-2">
            <p className="text-xs text-slate-500 dark:text-slate-400 text-center">
              Scan to open the full property listing with photos, map, and booking
            </p>
            <QRCodeDisplay
              value={`${window.location.origin}/properties/${property.id}`}
              size={200}
              label={`${property.title} · ${formatCurrency(property.rentPrice)}/mo · ${property.district}`}
              downloadFileName={`property-qr-${property.id}`}
            />
            <p className="text-xs text-slate-400 font-mono break-all text-center max-w-xs">
              {window.location.origin}/properties/{property.id}
            </p>
          </div>
        </div>
      </Modal>
    </div>
  );
}
