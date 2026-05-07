import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, MapPin, SlidersHorizontal, X, Bed, Bath, Heart, Map, Grid3X3, Navigation, Crosshair, ArrowUpDown } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Input } from '../components/ui/Input';
import { useAuthStore } from '../store/authStore';
import { usePropertyStore } from '../store/propertyStore';
import { useGeolocation } from '../hooks/useGeolocation';
import { formatCurrency, amenityIcons, DISTRICTS, INSPECTION_FEE } from '../lib/utils';
import { filterPropertiesForUser } from '../lib/rbac';
import { MapContainer, TileLayer, Marker, Popup, Circle } from 'react-leaflet';
import L from 'leaflet';
import toast from 'react-hot-toast';

delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png', iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png', shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png' });

export function SearchPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuthStore();
  const { properties: allProperties, customPropertyTypes, customDistricts } = usePropertyStore();
  // Guests and tenants see published only; other roles see their relevant properties
  const properties = filterPropertiesForUser(allProperties, user);
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
    if (!user) { toast('Sign in to save favorites', { icon: '🔒' }); return; }
    setFavorites(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
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
            <p className="font-semibold text-primary-800 dark:text-primary-300 text-sm">Sign up to unlock more features</p>
            <p className="text-xs text-primary-600 dark:text-primary-400 mt-0.5">Save favorites, book inspections, and pay rent online</p>
          </div>
          <Button size="sm" onClick={() => navigate('/register')}>Sign up free</Button>
        </div>
      )}

      {viewMode === 'map' ? (
        <div className="h-[600px] rounded-2xl overflow-hidden shadow-card border border-slate-100 dark:border-slate-700">
          <MapContainer center={position ? [position.lat, position.lng] : [0.3476, 32.5825]} zoom={12} style={{ height: '100%', width: '100%' }}>
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>' />
            {/* User location */}
            {position && (
              <>
                <Marker position={[position.lat, position.lng]}
                  icon={L.divIcon({ className: '', html: `<div style="width:20px;height:20px;background:#2563eb;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(37,99,235,0.5)"></div>`, iconSize: [20, 20], iconAnchor: [10, 10] })}>
                  <Popup><strong>📍 You are here</strong><br /><span style={{fontSize:'11px'}}>{position.address}</span></Popup>
                </Marker>
                {nearMeActive && (
                  <Circle center={[position.lat, position.lng]} radius={nearMeRadius * 1000}
                    pathOptions={{ color: '#2563eb', fillColor: '#2563eb', fillOpacity: 0.08, weight: 2, dashArray: '6 4' }} />
                )}
              </>
            )}
            {sorted.map(p => (
              <Marker key={p.id} position={[p.latitude, p.longitude]}>
                <Popup>
                  <div className="min-w-[200px]">
                    <img src={p.photos[0]} alt={p.title} className="w-full h-24 object-cover rounded-lg mb-2" />
                    <p className="font-bold text-sm">{p.title}</p>
                    <p className="text-xs text-slate-500">{p.address}</p>
                    <p className="font-bold text-primary-600 mt-1">{formatCurrency(p.rentPrice)}/mo</p>
                    <button onClick={() => navigate(`/properties/${p.id}`)} className="mt-2 w-full bg-primary-600 text-white text-xs py-1.5 rounded-lg font-medium">View Details</button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {sorted.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => navigate(`/properties/${p.id}`)}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden cursor-pointer hover:shadow-card-lg hover:-translate-y-1 transition-all duration-300 group">
              <div className="relative h-44 overflow-hidden">
                <img src={p.photos[0]} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                <button onClick={e => { e.stopPropagation(); toggleFav(p.id); }}
                  className="absolute top-3 right-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center hover:scale-110 transition-transform">
                  <Heart size={14} className={favorites.has(p.id) ? 'fill-red-500 text-red-500' : 'text-slate-500'} />
                </button>
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
