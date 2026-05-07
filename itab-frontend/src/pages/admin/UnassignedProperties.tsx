import { useState } from 'react';
import { motion } from 'framer-motion';
import { Building2, UserCheck, MapPin, Bed, Bath } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { EmptyState } from '../../components/ui/EmptyState';
import { usePropertyStore } from '../../store/propertyStore';
import { mockUsers } from '../../lib/mockData';
import { formatCurrency } from '../../lib/utils';
import toast from 'react-hot-toast';

export function UnassignedProperties() {
  const { properties, updateProperty } = usePropertyStore();
  const [selected, setSelected] = useState<string | null>(null);
  const [assignTo, setAssignTo] = useState('');

  // Properties with no manager assigned
  const unassigned = properties.filter(p => !p.managerId && p.status !== 'rejected');
  const managers = mockUsers.filter(u => u.role === 'property_manager');

  const handleAssign = () => {
    if (!selected || !assignTo) { toast.error('Select a manager'); return; }
    const manager = managers.find(m => m.id === assignTo);
    if (!manager) return;
    updateProperty(selected, {
      managerId: manager.id,
      managerName: `${manager.firstName} ${manager.lastName}`,
      status: 'pending_vetting',
    });
    setSelected(null);
    setAssignTo('');
    toast.success(`Property assigned to ${manager.firstName} ${manager.lastName}!`);
  };

  const selectedProp = properties.find(p => p.id === selected);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Unassigned Properties</h1>
        <p className="text-sm text-slate-500 mt-0.5">{unassigned.length} properties waiting for a manager</p>
      </div>

      {unassigned.length === 0 ? (
        <EmptyState icon={<Building2 size={28} />} title="All properties are assigned" description="Properties added by landlords without a manager will appear here." />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {unassigned.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden">
              <img src={p.photos[0]} alt={p.title} className="w-full h-36 object-cover"
                onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=400'; }} />
              <div className="p-4">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm line-clamp-1">{p.title}</h3>
                <div className="flex items-center gap-1 mt-1 text-xs text-slate-400"><MapPin size={11} />{p.district}</div>
                <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
                  {p.bedrooms > 0 && <span><Bed size={11} className="inline mr-0.5" />{p.bedrooms}</span>}
                  {p.bathrooms > 0 && <span><Bath size={11} className="inline mr-0.5" />{p.bathrooms}</span>}
                  <Badge variant="yellow" className="ml-auto">Unassigned</Badge>
                </div>
                <div className="flex items-center justify-between mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                  <p className="font-bold text-primary-600 text-sm">{formatCurrency(p.rentPrice)}/mo</p>
                  <Button size="sm" icon={<UserCheck size={13} />} onClick={() => setSelected(p.id)}>Assign</Button>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      <Modal open={!!selected} onClose={() => { setSelected(null); setAssignTo(''); }} title="Assign Property Manager"
        footer={<><Button variant="secondary" onClick={() => { setSelected(null); setAssignTo(''); }}>Cancel</Button><Button onClick={handleAssign} icon={<UserCheck size={14} />}>Assign Manager</Button></>}>
        {selectedProp && (
          <div className="space-y-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
              <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{selectedProp.title}</p>
              <p className="text-xs text-slate-400">{selectedProp.address}</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Select Property Manager</label>
              <div className="space-y-2">
                {managers.map(m => (
                  <button key={m.id} onClick={() => setAssignTo(m.id)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${assignTo === m.id ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'}`}>
                    <div className="w-9 h-9 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center text-primary-600 font-bold text-sm flex-shrink-0">
                      {m.firstName[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{m.firstName} {m.lastName}</p>
                      <p className="text-xs text-slate-400">{m.email} · {m.phone}</p>
                    </div>
                    {assignTo === m.id && <span className="ml-auto text-primary-600">✓</span>}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
