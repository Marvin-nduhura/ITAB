import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Calculator, MapPin, Building2, Search } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Input, Select } from '../components/ui/Input';
import { formatCurrency } from '../lib/utils';

// ── Mortgage Calculator ───────────────────────────────────────────────────────
function MortgageCalculator() {
  const [form, setForm] = useState({ price: '', downPayment: '20', rate: '18', years: '20' });
  const set = (k: keyof typeof form, v: string) => setForm(f => ({ ...f, [k]: v }));

  const price = Number(form.price) || 0;
  const down = (price * Number(form.downPayment)) / 100;
  const principal = price - down;
  const monthlyRate = Number(form.rate) / 100 / 12;
  const n = Number(form.years) * 12;
  const monthly = principal > 0 && monthlyRate > 0
    ? (principal * monthlyRate * Math.pow(1 + monthlyRate, n)) / (Math.pow(1 + monthlyRate, n) - 1)
    : 0;
  const totalPaid = monthly * n;
  const totalInterest = totalPaid - principal;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-6 space-y-5">
      <div className="flex items-center gap-2">
        <Calculator size={20} className="text-primary-600" />
        <h2 className="font-bold text-slate-900 dark:text-slate-100">Mortgage Calculator</h2>
      </div>
      <p className="text-sm text-slate-500">Estimate your monthly mortgage payments for buying property in Uganda.</p>
      <div className="grid grid-cols-2 gap-4">
        <Input label="Property Price (UGX)" type="number" placeholder="e.g. 150,000,000" value={form.price} onChange={e => set('price', e.target.value)} />
        <Input label="Down Payment (%)" type="number" min="5" max="100" value={form.downPayment} onChange={e => set('downPayment', e.target.value)} hint={`= ${formatCurrency(down)}`} />
        <Input label="Annual Interest Rate (%)" type="number" step="0.5" value={form.rate} onChange={e => set('rate', e.target.value)} hint="Uganda avg: 18–22%" />
        <Select label="Loan Term" value={form.years} onChange={e => set('years', e.target.value)}
          options={[{ value: '5', label: '5 years' }, { value: '10', label: '10 years' }, { value: '15', label: '15 years' }, { value: '20', label: '20 years' }, { value: '25', label: '25 years' }]} />
      </div>
      {monthly > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-2xl p-5 space-y-3">
          <div className="text-center">
            <p className="text-xs text-primary-600 dark:text-primary-400 font-medium uppercase tracking-wider">Monthly Payment</p>
            <p className="text-4xl font-bold text-primary-700 dark:text-primary-300 mt-1">{formatCurrency(Math.round(monthly))}</p>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-3 border-t border-primary-200 dark:border-primary-700">
            {[
              { label: 'Loan Amount', value: formatCurrency(principal) },
              { label: 'Total Interest', value: formatCurrency(Math.round(totalInterest)) },
              { label: 'Total Cost', value: formatCurrency(Math.round(totalPaid + down)) },
            ].map(r => (
              <div key={r.label} className="text-center">
                <p className="text-xs text-primary-500 dark:text-primary-400">{r.label}</p>
                <p className="text-sm font-bold text-primary-700 dark:text-primary-300 mt-0.5">{r.value}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}

// ── Neighborhood Guides ───────────────────────────────────────────────────────
const neighborhoods = [
  {
    name: 'Kololo', district: 'Kampala', type: 'Upscale Residential',
    avgRent: '2,000,000 – 8,000,000 UGX',
    highlights: ['Embassies & diplomats', 'Top restaurants & cafes', 'Close to city center', 'Excellent security'],
    schools: ['Kampala International School', 'Aga Khan Primary'],
    hospitals: ['International Hospital Kampala', 'Case Medical Centre'],
    transport: 'Boda bodas, taxis, Uber available. 10 min to CBD.',
    rating: 4.8,
  },
  {
    name: 'Ntinda', district: 'Kampala', type: 'Middle-Class Residential',
    avgRent: '800,000 – 2,500,000 UGX',
    highlights: ['Family-friendly', 'Good schools nearby', 'Shopping malls', 'Quiet neighborhoods'],
    schools: ['Ntinda Parents School', 'St. Joseph\'s Primary'],
    hospitals: ['Ntinda Medical Centre', 'Mulago Hospital (nearby)'],
    transport: 'Taxis and boda bodas. 20 min to CBD.',
    rating: 4.3,
  },
  {
    name: 'Entebbe', district: 'Entebbe', type: 'Airport & Lakeside',
    avgRent: '700,000 – 3,000,000 UGX',
    highlights: ['Near airport', 'Lake Victoria views', 'Peaceful environment', 'Expat community'],
    schools: ['Entebbe Parents School', 'Kitante Primary'],
    hospitals: ['Entebbe Hospital', 'Victoria Medical Centre'],
    transport: 'Taxis to Kampala (45 min). Airport shuttle available.',
    rating: 4.5,
  },
  {
    name: 'Bukoto', district: 'Kampala', type: 'Young Professionals',
    avgRent: '500,000 – 1,500,000 UGX',
    highlights: ['Vibrant nightlife', 'Affordable', 'Close to Nakawa', 'Good internet connectivity'],
    schools: ['Bukoto Primary School', 'Nakawa Secondary'],
    hospitals: ['Nakawa Health Centre', 'Mulago Hospital'],
    transport: 'Excellent boda boda coverage. 15 min to CBD.',
    rating: 4.0,
  },
];

function NeighborhoodGuides() {
  const [selected, setSelected] = useState<typeof neighborhoods[0] | null>(null);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <MapPin size={20} className="text-primary-600" />
        <h2 className="font-bold text-slate-900 dark:text-slate-100">Neighborhood Guides</h2>
      </div>
      <p className="text-sm text-slate-500">Explore Kampala's neighborhoods to find the right area for you.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {neighborhoods.map((n, i) => (
          <motion.div key={n.name} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }}
            onClick={() => setSelected(selected?.name === n.name ? null : n)}
            className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5 cursor-pointer hover:shadow-card-lg hover:-translate-y-0.5 transition-all">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-bold text-slate-900 dark:text-slate-100">{n.name}</h3>
                <p className="text-xs text-slate-400">{n.district} · {n.type}</p>
              </div>
              <div className="flex items-center gap-1 text-amber-500 text-sm font-bold">
                ⭐ {n.rating}
              </div>
            </div>
            <p className="text-xs text-primary-600 dark:text-primary-400 mt-2 font-medium">{n.avgRent}/month</p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              {n.highlights.slice(0, 3).map(h => (
                <span key={h} className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-full">{h}</span>
              ))}
            </div>
            {selected?.name === n.name && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-2 text-xs text-slate-600 dark:text-slate-400">
                <p><strong>🏫 Schools:</strong> {n.schools.join(', ')}</p>
                <p><strong>🏥 Hospitals:</strong> {n.hospitals.join(', ')}</p>
                <p><strong>🚌 Transport:</strong> {n.transport}</p>
              </motion.div>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ── Main Guest Page ───────────────────────────────────────────────────────────
export function GuestPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'calculator' | 'neighborhoods'>('calculator');

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Property Tools</h1>
          <p className="text-sm text-slate-500 mt-0.5">Free tools to help you make the right property decision</p>
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" icon={<Search size={15} />} onClick={() => navigate('/search')}>Browse Properties</Button>
          <Button onClick={() => navigate('/register')}>Sign Up Free</Button>
        </div>
      </div>

      {/* Guest CTA */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-700 rounded-2xl p-6 text-white">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-bold text-lg">Ready to find your next home?</h2>
            <p className="text-primary-100 text-sm mt-1">Sign up to book inspections, save favorites, pay rent online, and more.</p>
            <div className="flex gap-2 mt-4">
              <Button variant="secondary" onClick={() => navigate('/register')} className="bg-white text-primary-700 hover:bg-primary-50">
                Create Free Account
              </Button>
              <Button variant="ghost" onClick={() => navigate('/login')} className="text-white hover:bg-primary-500">
                Sign In
              </Button>
            </div>
          </div>
          <Building2 size={48} className="text-primary-300 flex-shrink-0 hidden sm:block" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
        {([['calculator', '🧮 Mortgage Calculator'], ['neighborhoods', '🗺️ Neighborhood Guides']] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${tab === key ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100' : 'text-slate-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'calculator' && <MortgageCalculator />}
      {tab === 'neighborhoods' && <NeighborhoodGuides />}
    </div>
  );
}
