import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, SlidersHorizontal, X, Bed, Bath, Heart, Map, Grid3X3, Navigation, Crosshair, ArrowUpDown } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { useAuthStore } from '../store/authStore';
import { usePropertyStore } from '../store/propertyStore';
import { propertiesApi } from '../lib/api';
import { useGeolocation } from '../hooks/useGeolocation';
import { formatCurrency, amenityIcons, DISTRICTS, INSPECTION_FEE } from '../lib/utils';
import { filterPropertiesForUser } from '../lib/rbac';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow, Circle } from '@react-google-maps/api';
import toast from 'react-hot-toast';

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || '';
const MAP_CONTAINER_STYLE = { width: '100%', height: '100%' };

export function SearchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const { properties: allProperties, customPropertyTypes, customDistricts, setProperties } = usePropertyStore();
  // Guests and tenants see published only; other roles see their relevant properties
  const properties = filterPropertiesForUser(allProperties, user);
  const isGuest = !user;

  // Safety net: if store is empty when we land here (direct navigation), fetch public properties
  useEffect(() => {
    if (allProperties.length === 0) {
      propertiesApi.list()
        .then(res => {
          const data = (res.data as { data: unknown[] }).data;
          if (Array.isArray(data) && data.length > 0) setProperties(data as Parameters<typeof setProperties>[0]);
        })
        .catch(() => {});
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const [query, setQuery] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'map'>(searchParams.get('view') === 'map' ? 'map' : 'grid');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [filters, setFilters] = useState({ type: '', minPrice: '', maxPrice: '', bedrooms: '', district: '', amenities: [] as string[] });
  const allTypes = ['apartment', 'house', 'commercial', 'land', ...customPropertyTypes];
  const allDistricts = [...DISTRICTS, ...customDistricts];
  const { position, status: geoStatus, getLocation } = useGeolocation();
  const [nearMeRadius, setNearMeRadius] = useState(5); // km
  const [nearMeActive, setNearMeActive] = useState(false);
  const [sortBy, setSortBy] = useState<'newest' | 'price_asc' | 'price_desc' | 'largest' | 'nearest'>('newest');
  const [selectedPropertyId, setSelectedPropertyId] = useState<string | null>(null);

  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_MAPS_API_KEY });
  // Haversine distance in km
  const haversine = (lat1: number, lng1: number, lat2: number, lng2: number) => {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

  const filtered = properties.filter(p => {
    if (p.status !== 'published') return false;
    const q = query.toLowerCase();
    const matchQ = !q || p.title.toLowerCase().includes(q) || p.address.toLowerCase().includes(q) || p.district.toLowerCase().includes(q);
    const matchType = !filters.type || p.type === filters.type;
    const matchMin = !filters.minPrice || p.rentPrice >= Number(filters.minPrice);
    const matchMax = !filters.maxPrice || p.rentPrice <= Number(filters.maxPrice);
    const matchBed = !filters.bedrooms || p.bedrooms >= Number(filters.bedrooms);
    const matchDist = !filters.district || p.district === filters.district;
    const matchAmen = filters.amenities.length === 0 || filters.amenities.every(a => p.amenities.includes(a));
    // Near me filter
    const matchNear = !nearMeActive || !position
      ? true
      : haversine(position.lat, position.lng, p.latitude, p.longitude) <= nearMeRadius;
    return matchQ && matchType && matchMin && matchMax && matchBed && matchDist && matchAmen && matchNear;
  });

  // Sort results
  const sorted = [...filtered].sort((a, b) => {
    switch (sortBy) {
      case 'price_asc':  return a.rentPrice - b.rentPrice;
      case 'price_desc': return b.rentPrice - a.rentPrice;
      case 'largest':    return (b.squareFootage || 0) - (a.squareFootage || 0);
      case 'nearest':
        if (!position) return 0;
        return haversine(position.lat, position.lng, a.latitude, a.longitude)
             - haversine(position.lat, position.lng, b.latitude, b.longitude);
      case 'newest':
      default:
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    }
  });

  const toggleFav = (id: string) => {
    if (!user) { toast('Sign in to save favorites', { icon: '🔒' }); navigate('/login'); return; }
    setFavorites(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  };

  const handleShare = (e: React.MouseEvent, p: { id: string; title: string }) => {
    e.stopPropagation();
    const url = `${window.location.origin}/browse/${p.id}`;
    if (navigator.share) {
      navigator.share({ title: p.title, url }).catch(() => {});
    } else {
      navigator.clipboard.writeText(url).then(() => toast.success('Link copied!'));
    }
  };

  const toggleAmenity = (a: string) => {
    setFilters(f => ({ ...f, amenities: f.amenities.includes(a) ? f.amenities.filter(x => x !== a) : [...f.amenities, a] }));
  };

  return (
    <div className="space-y-4">
      {/* Search bar */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-4">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by location, property name..."
              className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
            {query && <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"><X size={16} /></button>}
          </div>
          <Button variant="secondary" icon={<SlidersHorizontal size={16} />} onClick={() => setShowFilters(!showFilters)}>
            Filters {(filters.type || filters.minPrice || filters.district || filters.amenities.length > 0) && <span className="w-2 h-2 bg-primary-500 rounded-full" />}
          </Button>
          {/* Near Me button */}
          <button
            onClick={() => {
              if (!nearMeActive) {
                getLocation();
                setNearMeActive(true);
                toast.success('Showing properties near you');
              } else {
                setNearMeActive(false);
              }
            }}
            className={`flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all ${nearMeActive ? 'bg-primary-600 text-white border-primary-600' : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
          >
            {geoStatus === 'loading' ? <span className="w-3 h-3 border-2 border-current border-t-transparent rounded-full animate-spin" /> : <Navigation size={14} />}
            <span className="hidden sm:inline">Near Me</span>
          </button>
          <div className="flex items-center bg-slate-100 dark:bg-slate-700 rounded-xl p-1 gap-0.5">
            <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-white dark:bg-slate-600 shadow-sm' : 'text-slate-400'}`}><Grid3X3 size={16} /></button>
            <button onClick={() => setViewMode('map')} className={`p-2 rounded-lg transition-colors ${viewMode === 'map' ? 'bg-white dark:bg-slate-600 shadow-sm' : 'text-slate-400'}`}><Map size={16} /></button>
          </div>
        </div>

        {/* Filters panel */}
        <AnimatePresence>
          {showFilters && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
              <div className="pt-4 mt-4 border-t border-slate-100 dark:border-slate-700 space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <select value={filters.type} onChange={e => setFilters(f => ({ ...f, type: e.target.value }))}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm">
                    <option value="">Any Type</option>
                    {allTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                  </select>
                  <select value={filters.district} onChange={e => setFilters(f => ({ ...f, district: e.target.value }))}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm">
                    <option value="">Any District</option>
                    {allDistricts.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                  <Input placeholder="Min price (UGX)" type="number" value={filters.minPrice} onChange={e => setFilters(f => ({ ...f, minPrice: e.target.value }))} />
                  <Input placeholder="Max price (UGX)" type="number" value={filters.maxPrice} onChange={e => setFilters(f => ({ ...f, maxPrice: e.target.value }))} />
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Amenities</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(amenityIcons).map(([key, icon]) => (
                      <button key={key} onClick={() => toggleAmenity(key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all ${filters.amenities.includes(key) ? 'bg-primary-600 text-white border-primary-600' : 'border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:border-primary-400'}`}>
                        {icon} {key.replace('_', ' ')}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="flex items-center justify-between flex-wrap gap-3">
                  {nearMeActive && position && (
                    <div className="flex items-center gap-3">
                      <Crosshair size={14} className="text-primary-600 flex-shrink-0" />
                      <span className="text-xs text-slate-600 dark:text-slate-400">Radius:</span>
                      <input type="range" min="1" max="50" value={nearMeRadius} onChange={e => setNearMeRadius(Number(e.target.value))} className="w-24 accent-primary-600" />
                      <span className="text-xs font-semibold text-primary-600 w-12">{nearMeRadius} km</span>
                    </div>
                  )}
                  <Button variant="ghost" size="sm" onClick={() => { setFilters({ type: '', minPrice: '', maxPrice: '', bedrooms: '', district: '', amenities: [] }); setNearMeActive(false); }}>Clear all</Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-3">
        <p className="text-sm text-slate-500 dark:text-slate-400">{sorted.length} properties found</p>
        <div className="flex items-center gap-2">
          <ArrowUpDown size={14} className="text-slate-400" />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as typeof sortBy)}
            className="text-sm px-3 py-1.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
          >
            <option value="newest">Newest first</option>
            <option value="price_asc">Price: Low to High</option>
            <option value="price_desc">Price: High to Low</option>
            <option value="largest">Largest first</option>
            <option value="nearest">Nearest to me</option>
          </select>
        </div>
      </div>

      {/* Guest CTA */}
      {!user && (
        <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-2xl p-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-primary-800 dark:text-primary-300 text-sm">👋 Browsing as guest</p>
            <p className="text-xs text-primary-600 dark:text-primary-400 mt-0.5">
              You can view listings and share them. Sign up to book inspections, save favorites, and pay rent online.
            </p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <Button size="sm" variant="secondary" onClick={() => navigate('/login')}>Sign In</Button>
            <Button size="sm" onClick={() => navigate('/register')}>Sign Up Free</Button>
          </div>
        </div>
      )}

      {viewMode === 'map' ? (
        <div className="h-[600px] rounded-2xl overflow-hidden shadow-card border border-slate-100 dark:border-slate-700">
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={MAP_CONTAINER_STYLE}
              center={position ? { lat: position.lat, lng: position.lng } : { lat: 0.3476, lng: 32.5825 }}
              zoom={12}
              options={{ streetViewControl: false, mapTypeControl: false }}
            >
              {/* User location */}
              {position && (
                <>
                  <Marker
                    position={{ lat: position.lat, lng: position.lng }}
                    icon={{ path: google.maps.SymbolPath.CIRCLE, scale: 8, fillColor: '#2563eb', fillOpacity: 1, strokeColor: 'white', strokeWeight: 2 }}
                  />
                  {nearMeActive && (
                    <Circle
                      center={{ lat: position.lat, lng: position.lng }}
                      radius={nearMeRadius * 1000}
                      options={{ strokeColor: '#2563eb', strokeOpacity: 0.6, strokeWeight: 2, fillColor: '#2563eb', fillOpacity: 0.08 }}
                    />
                  )}
                </>
              )}
              {/* Property markers */}
              {sorted.map(p => (
                <Marker
                  key={p.id}
                  position={{ lat: p.latitude, lng: p.longitude }}
                  onClick={() => setSelectedPropertyId(p.id)}
                />
              ))}
              {/* Info window for selected property */}
              {selectedPropertyId && (() => {
                const p = sorted.find(x => x.id === selectedPropertyId);
                if (!p) return null;
                return (
                  <InfoWindow
                    position={{ lat: p.latitude, lng: p.longitude }}
                    onCloseClick={() => setSelectedPropertyId(null)}
                  >
                    <div style={{ minWidth: 200 }}>
                      {p.photos[0] && <img src={p.photos[0]} alt={p.title} style={{ width: '100%', height: 80, objectFit: 'cover', borderRadius: 8, marginBottom: 6 }} />}
                      <p style={{ fontWeight: 700, fontSize: 13 }}>{p.title}</p>
                      <p style={{ fontSize: 11, color: '#64748b' }}>{p.address}</p>
                      <p style={{ fontWeight: 700, color: '#2563eb', marginTop: 4 }}>{formatCurrency(p.rentPrice)}/mo</p>
                      <button onClick={() => navigate(isGuest ? `/browse/${p.id}` : `/properties/${p.id}`)}
                        style={{ marginTop: 8, width: '100%', background: '#2563eb', color: 'white', fontSize: 12, padding: '6px 0', borderRadius: 8, border: 'none', cursor: 'pointer', fontWeight: 600 }}>
                        {isGuest ? 'View Listing' : 'View Details'}
                      </button>
                    </div>
                  </InfoWindow>
                );
              })()}
            </GoogleMap>
          ) : (
            <div className="h-full flex items-center justify-center bg-slate-100 dark:bg-slate-800">
              <span className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {sorted.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => navigate(isGuest ? `/browse/${p.id}` : `/properties/${p.id}`)}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden cursor-pointer hover:shadow-card-lg hover:-translate-y-1 transition-all duration-300 group">
              <div className="relative h-44 overflow-hidden">
                <img src={p.photos[0]} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                {/* Guests see share button; authenticated users see favorites heart */}
                {isGuest ? (
                  <button
                    onClick={e => handleShare(e, p)}
                    className="absolute top-3 right-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center hover:scale-110 transition-transform"
                    title="Share this property"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-slate-500"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>
                  </button>
                ) : (
                  <button onClick={e => { e.stopPropagation(); toggleFav(p.id); }}
                    className="absolute top-3 right-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center hover:scale-110 transition-transform">
                    <Heart size={14} className={favorites.has(p.id) ? 'fill-red-500 text-red-500' : 'text-slate-500'} />
                  </button>
                )}
                <div className="absolute bottom-3 left-3">
                  <p className="text-white font-bold text-lg drop-shadow">{formatCurrency(p.rentPrice)}<span className="text-xs font-normal">/mo</span></p>
                </div>
              </div>
              <div className="p-4">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm line-clamp-1">{p.title}</h3>
                <div className="flex items-center gap-1 mt-1 text-slate-400 text-xs"><MapPin size={11} /><span className="truncate">{p.district}</span></div>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  {p.bedrooms > 0 && <span className="flex items-center gap-1"><Bed size={11} />{p.bedrooms}</span>}
                  {p.bathrooms > 0 && <span className="flex items-center gap-1"><Bath size={11} />{p.bathrooms}</span>}
                  <Badge variant="gray" className="ml-auto">{p.type}</Badge>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
                  <p className="text-xs text-green-600 font-medium">💡 {formatCurrency(INSPECTION_FEE)} inspection fee credited to first rent</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
