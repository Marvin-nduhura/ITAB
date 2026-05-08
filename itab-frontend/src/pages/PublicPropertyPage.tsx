import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useState } from 'react';
import { ArrowLeft, MapPin, Bed, Bath, Square, LogIn, UserPlus, Calendar, Phone, CheckCircle2, Star } from 'lucide-react';
import { usePropertyStore } from '../store/propertyStore';
import { formatCurrency, amenityIcons } from '../lib/utils';
import { Badge } from '../components/ui/Badge';
import toast from 'react-hot-toast';

export function PublicPropertyPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { properties } = usePropertyStore();
  const [photoIdx, setPhotoIdx] = useState(0);

  const property = properties.find(p => p.id === id && p.status === 'published');

  if (!property) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center gap-4 p-8">
        <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-2xl flex items-center justify-center text-3xl">🏠</div>
        <p className="font-semibold text-slate-700 dark:text-slate-300">Property not found</p>
        <button onClick={() => navigate('/')} className="text-sm text-primary-600 hover:underline">← Back to listings</button>
      </div>
    );
  }

  const handleLockedAction = (msg: string) => {
    toast(msg + ' — please sign in or create an account.', { icon: '🔒', duration: 4000 });
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      {/* Nav */}
      <header className="sticky top-0 z-50 bg-white/90 dark:bg-slate-900/90 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 shadow-sm">
        <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between gap-4">
          <button onClick={() => navigate('/')} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
            <ArrowLeft size={16} /> Back to listings
          </button>
          <img src="/logo.png" alt="ITAB" className="h-8 w-auto object-contain" />
          <div className="flex items-center gap-2">
            <button onClick={() => navigate('/login')} className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <LogIn size={15} /> <span className="hidden sm:inline">Sign In</span>
            </button>
            <button onClick={() => navigate('/register')} className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white transition-colors">
              <UserPlus size={15} /> Sign Up
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 py-8 space-y-6">
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
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {property.photos.map((_, i) => (
                    <button key={i} onClick={() => setPhotoIdx(i)}
                      className={`w-2 h-2 rounded-full transition-all ${i === photoIdx ? 'bg-white w-4' : 'bg-white/50'}`} />
                  ))}
                </div>
              )}
              {property.isFeatured && (
                <div className="absolute top-3 left-3 flex items-center gap-1 bg-amber-400 text-white text-xs font-bold px-2.5 py-1 rounded-full">
                  <Star size={10} fill="white" /> Featured
                </div>
              )}
            </div>

            {/* Title */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant="green">Available</Badge>
                    <Badge variant="gray" className="capitalize">{property.type}</Badge>
                  </div>
                  <h1 className="text-xl font-bold text-slate-900 dark:text-slate-100">{property.title}</h1>
                  <div className="flex items-center gap-1 mt-1 text-slate-400 text-sm">
                    <MapPin size={14} /><span>{property.address}, {property.district}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-4 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                {property.bedrooms > 0 && <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400"><Bed size={16} /><span>{property.bedrooms} Bedrooms</span></div>}
                {property.bathrooms > 0 && <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400"><Bath size={16} /><span>{property.bathrooms} Bathrooms</span></div>}
                {property.squareFootage && <div className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400"><Square size={16} /><span>{property.squareFootage} m²</span></div>}
              </div>
            </div>

            {/* Description */}
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
              <h2 className="font-bold text-slate-900 dark:text-slate-100 mb-3">Description</h2>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">{property.description}</p>
            </div>

            {/* Amenities */}
            {property.amenities.length > 0 && (
              <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 p-5">
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
            )}

            {/* Sign-up prompt */}
            <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-2xl p-5">
              <h3 className="font-bold text-primary-800 dark:text-primary-300 mb-1">Want to book an inspection?</h3>
              <p className="text-sm text-primary-600 dark:text-primary-400 mb-4">
                Create a free account to book inspections, save this property, and pay rent online.
              </p>
              <div className="flex gap-3 flex-wrap">
                <button onClick={() => navigate('/register')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-semibold transition-colors">
                  <UserPlus size={15} /> Create Free Account
                </button>
                <button onClick={() => navigate('/login')}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl border border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300 text-sm font-semibold hover:bg-primary-100 dark:hover:bg-primary-900/40 transition-colors">
                  <LogIn size={15} /> Sign In
                </button>
              </div>
            </div>
          </div>

          {/* Right: Booking card */}
          <div className="space-y-4">
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 p-5 sticky top-24">
              <div className="mb-4">
                <p className="text-3xl font-bold text-primary-600">{formatCurrency(property.rentPrice)}</p>
                <p className="text-sm text-slate-400">per month</p>
                <p className="text-sm text-slate-500 mt-1">Deposit: <span className="font-semibold text-slate-700 dark:text-slate-300">{formatCurrency(property.deposit)}</span></p>
              </div>

              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-3 mb-4">
                <p className="text-xs font-semibold text-amber-800 dark:text-amber-300 mb-1">📋 Inspection Fee</p>
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  UGX 100,000 (credited toward first rent if you take the property)
                </p>
              </div>

              <div className="space-y-2.5">
                <button
                  onClick={() => handleLockedAction('Book an inspection')}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm transition-colors"
                >
                  <Calendar size={16} /> Book Inspection
                </button>
                <button
                  onClick={() => handleLockedAction('Message the property manager')}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-semibold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <Phone size={16} /> Contact Manager
                </button>
              </div>

              <p className="text-xs text-slate-400 text-center mt-4">
                🔒 Sign in required to book or contact
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
