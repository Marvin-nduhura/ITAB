import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, MapPin, Bed, Bath, Heart, LogIn, UserPlus, Building2, X, SlidersHorizontal, ArrowRight } from 'lucide-react';
import { usePropertyStore } from '../store/propertyStore';
import { formatCurrency, DISTRICTS } from '../lib/utils';
import { Badge } from '../components/ui/Badge';
import toast from 'react-hot-toast';

export function LandingPage() {
  const navigate = useNavigate();
  const { properties: allProperties } = usePropertyStore();
  const published = allProperties.filter(p => p.status === 'published');

  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [favorites] = useState<Set<string>>(new Set());

  const filtered = published.filter(p => {
    const q = query.toLowerCase();
    const matchQ = !q || p.title.toLowerCase().includes(q) || p.address.toLowerCase().includes(q) || p.district.toLowerCase().includes(q);
    const matchType = !typeFilter || p.type === typeFilter;
    const matchDist = !districtFilter || p.district === districtFilter;
    return matchQ && matchType && matchDist;
  });

  const handleFav = (_id: string) => {
    toast('Sign in to save favorites', { icon: '🔒' });
    navigate('/login');
  };

  const handleAction = (msg: string) => {
    toast(msg, { icon: '🔒', duration: 3000 });
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* ── Top nav ─────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          {/* Logo */}
          <div className="flex items-center gap-2.5 flex-shrink-0">
            <img src="/logo.png" alt="ITAB" className="h-9 w-auto object-contain" />
          </div>

          {/* Search bar (desktop) */}
          <div className="hidden md:flex flex-1 max-w-md relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Search by location or property name…"
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
            {query && <button onClick={() => setQuery('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"><X size={14} /></button>}
          </div>

          {/* Auth buttons */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => navigate('/login')}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <LogIn size={15} /> <span className="hidden sm:inline">Sign In</span>
            </button>
            <button
              onClick={() => navigate('/register')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white transition-colors shadow-sm"
            >
              <UserPlus size={15} /> <span>Sign Up</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────── */}
      <section className="bg-gradient-to-br from-primary-700 via-primary-600 to-blue-600 text-white py-14 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
            <h1 className="text-3xl sm:text-4xl font-extrabold leading-tight mb-3">
              Find Your Perfect Property in Uganda
            </h1>
            <p className="text-primary-100 text-base sm:text-lg mb-8">
              Browse hundreds of verified properties across Kampala and beyond. No account needed to explore.
            </p>

            {/* Mobile search */}
            <div className="md:hidden relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Search properties…"
                className="w-full pl-11 pr-4 py-3.5 rounded-2xl border-0 bg-white text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-white/50 text-sm shadow-lg"
              />
            </div>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                onClick={() => navigate('/register')}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl bg-white text-primary-700 font-bold text-sm hover:bg-primary-50 transition-colors shadow-lg"
              >
                Get Started Free <ArrowRight size={16} />
              </button>
              <button
                onClick={() => navigate('/login')}
                className="flex items-center gap-2 px-6 py-3 rounded-2xl border-2 border-white/40 text-white font-semibold text-sm hover:bg-white/10 transition-colors"
              >
                Sign In
              </button>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Filters ─────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-5">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium transition-all ${showFilters ? 'bg-primary-600 text-white border-primary-600' : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 bg-white dark:bg-slate-800 hover:border-primary-400'}`}
          >
            <SlidersHorizontal size={15} /> Filters
            {(typeFilter || districtFilter) && <span className="w-2 h-2 bg-white rounded-full" />}
          </button>

          {showFilters && (
            <>
              <select
                value={typeFilter}
                onChange={e => setTypeFilter(e.target.value)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Any Type</option>
                {['apartment', 'house', 'commercial', 'land'].map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
              <select
                value={districtFilter}
                onChange={e => setDistrictFilter(e.target.value)}
                className="px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              >
                <option value="">Any District</option>
                {DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
              {(typeFilter || districtFilter) && (
                <button
                  onClick={() => { setTypeFilter(''); setDistrictFilter(''); }}
                  className="text-xs text-slate-400 hover:text-red-500 transition-colors"
                >
                  Clear filters
                </button>
              )}
            </>
          )}

          <p className="ml-auto text-sm text-slate-400">{filtered.length} properties found</p>
        </div>
      </div>

      {/* ── Property grid ───────────────────────────────────────────────── */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pb-16">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <Building2 size={48} className="mx-auto text-slate-300 dark:text-slate-600 mb-4" />
            <p className="text-slate-500 font-medium">No properties match your search</p>
            <button onClick={() => { setQuery(''); setTypeFilter(''); setDistrictFilter(''); }} className="mt-3 text-sm text-primary-600 hover:underline">Clear search</button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
            {filtered.map((p, i) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-300 group"
              >
                {/* Photo */}
                <div className="relative h-48 overflow-hidden" onClick={() => navigate(`/browse/${p.id}`)}>
                  <img
                    src={p.photos[0]}
                    alt={p.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent" />
                  {/* Favorite */}
                  <button
                    onClick={e => { e.stopPropagation(); handleFav(p.id); }}
                    className="absolute top-3 right-3 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center hover:scale-110 transition-transform shadow"
                  >
                    <Heart size={14} className={favorites.has(p.id) ? 'fill-red-500 text-red-500' : 'text-slate-500'} />
                  </button>
                  {p.isFeatured && (
                    <div className="absolute top-3 left-3 bg-amber-400 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                      ⭐ Featured
                    </div>
                  )}
                  <div className="absolute bottom-3 left-3">
                    <p className="text-white font-bold text-lg drop-shadow">
                      {formatCurrency(p.rentPrice)}<span className="text-xs font-normal">/mo</span>
                    </p>
                  </div>
                </div>

                {/* Info */}
                <div className="p-4" onClick={() => navigate(`/browse/${p.id}`)}>
                  <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm line-clamp-1">{p.title}</h3>
                  <div className="flex items-center gap-1 mt-1 text-slate-400 text-xs">
                    <MapPin size={11} /><span className="truncate">{p.district}</span>
                  </div>
                  <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                    {p.bedrooms > 0 && <span className="flex items-center gap-1"><Bed size={11} />{p.bedrooms} bed</span>}
                    {p.bathrooms > 0 && <span className="flex items-center gap-1"><Bath size={11} />{p.bathrooms} bath</span>}
                    <Badge variant="gray" className="ml-auto capitalize">{p.type}</Badge>
                  </div>
                </div>

                {/* CTA footer */}
                <div className="px-4 pb-4 flex gap-2">
                  <button
                    onClick={() => navigate(`/browse/${p.id}`)}
                    className="flex-1 py-2 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold transition-colors"
                  >
                    View Details
                  </button>
                  <button
                    onClick={() => handleAction('Sign in to book an inspection')}
                    className="flex-1 py-2 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                  >
                    Book Inspection
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Sign-up CTA banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mt-12 bg-gradient-to-r from-primary-600 to-blue-600 rounded-2xl p-8 text-white text-center"
        >
          <h2 className="text-xl font-bold mb-2">Ready to take the next step?</h2>
          <p className="text-primary-100 text-sm mb-6">
            Create a free account to book inspections, save favorites, pay rent online, and manage your property.
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <button
              onClick={() => navigate('/register')}
              className="px-6 py-3 rounded-2xl bg-white text-primary-700 font-bold text-sm hover:bg-primary-50 transition-colors shadow"
            >
              Create Free Account
            </button>
            <button
              onClick={() => navigate('/login')}
              className="px-6 py-3 rounded-2xl border-2 border-white/40 text-white font-semibold text-sm hover:bg-white/10 transition-colors"
            >
              Sign In
            </button>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
