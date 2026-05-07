import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ClipboardCheck, Eye, CheckCircle2, XCircle, Clock, MapPin, Bed, Bath, AlertTriangle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { usePropertyStore } from '../../store/propertyStore';
import { formatCurrency, formatDate } from '../../lib/utils';

export function VettingQueue() {
  const navigate = useNavigate();
  const { properties, updateProperty } = usePropertyStore();
  const [filter, setFilter] = useState<'pending_vetting' | 'draft' | 'rejected' | 'all'>('pending_vetting');

  const queue = properties.filter(p => {
    if (filter === 'all') return ['pending_vetting', 'draft', 'rejected'].includes(p.status);
    return p.status === filter;
  });

  const pendingCount = properties.filter(p => p.status === 'pending_vetting').length;
  const draftCount   = properties.filter(p => p.status === 'draft').length;
  const rejectedCount= properties.filter(p => p.status === 'rejected').length;

  const quickApprove = (id: string) => {
    updateProperty(id, { status: 'published' });
  };

  const quickReject = (id: string) => {
    updateProperty(id, { status: 'rejected' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Vetting Queue</h1>
          <p className="text-sm text-slate-500 mt-0.5">Review and approve property submissions</p>
        </div>
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300 rounded-xl text-sm font-semibold">
            <AlertTriangle size={14} />
            {pendingCount} awaiting review
          </div>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending Vetting', count: pendingCount,  color: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300', icon: <Clock size={18} /> },
          { label: 'Draft',           count: draftCount,    color: 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300',         icon: <ClipboardCheck size={18} /> },
          { label: 'Rejected',        count: rejectedCount, color: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-300',              icon: <XCircle size={18} /> },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl p-4 flex items-center gap-3 ${s.color}`}>
            {s.icon}
            <div>
              <p className="text-2xl font-bold">{s.count}</p>
              <p className="text-xs font-medium">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
        {([
          ['pending_vetting', `Pending (${pendingCount})`],
          ['draft',           `Drafts (${draftCount})`],
          ['rejected',        `Rejected (${rejectedCount})`],
          ['all',             'All'],
        ] as const).map(([val, label]) => (
          <button key={val} onClick={() => setFilter(val)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${filter === val ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* Queue list */}
      {queue.length === 0 ? (
        <EmptyState
          icon={<ClipboardCheck size={28} />}
          title={filter === 'pending_vetting' ? 'No properties pending vetting' : 'Nothing here'}
          description={filter === 'pending_vetting' ? 'All submitted properties have been reviewed.' : 'No properties match this filter.'}
        />
      ) : (
        <div className="space-y-3">
          {queue.map((p, i) => (
            <motion.div key={p.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden">
              <div className="flex items-start gap-4 p-5">
                {/* Thumbnail */}
                <img
                  src={p.photos[0]}
                  alt={p.title}
                  className="w-20 h-20 rounded-xl object-cover flex-shrink-0"
                  onError={e => { (e.target as HTMLImageElement).src = 'https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=200'; }}
                />

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{p.title}</h3>
                    <Badge variant={p.status === 'pending_vetting' ? 'yellow' : p.status === 'rejected' ? 'red' : 'gray'}>
                      {p.status === 'pending_vetting' ? 'Pending Vetting' : p.status === 'rejected' ? 'Rejected' : 'Draft'}
                    </Badge>
                    {p.isFeatured && <Badge variant="yellow">⭐ Featured</Badge>}
                  </div>

                  <div className="flex items-center gap-1 text-xs text-slate-400 mb-2">
                    <MapPin size={11} />{p.address}, {p.district}
                  </div>

                  <div className="flex items-center gap-4 text-xs text-slate-500 flex-wrap">
                    {p.bedrooms > 0 && <span className="flex items-center gap-1"><Bed size={11} />{p.bedrooms} bed</span>}
                    {p.bathrooms > 0 && <span className="flex items-center gap-1"><Bath size={11} />{p.bathrooms} bath</span>}
                    <span className="font-semibold text-primary-600">{formatCurrency(p.rentPrice)}/mo</span>
                    <span className="capitalize">{p.type.replace(/_/g, ' ')}</span>
                    <span>{p.photos.length} photo{p.photos.length !== 1 ? 's' : ''}</span>
                    <span>Submitted {formatDate(p.createdAt)}</span>
                  </div>

                  {p.managerName && (
                    <p className="text-xs text-slate-400 mt-1">Manager: <span className="font-medium">{p.managerName}</span></p>
                  )}
                  {p.landlordName && (
                    <p className="text-xs text-slate-400">Landlord: <span className="font-medium">{p.landlordName}</span></p>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <Button size="sm" icon={<Eye size={13} />} onClick={() => navigate(`/properties/${p.id}`)}>
                    Full Review
                  </Button>
                  {p.status === 'pending_vetting' && (
                    <>
                      <Button size="sm" variant="secondary" icon={<CheckCircle2 size={13} />}
                        onClick={() => { quickApprove(p.id); }}
                        className="text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-900/20">
                        Quick Approve
                      </Button>
                      <Button size="sm" variant="danger" icon={<XCircle size={13} />}
                        onClick={() => quickReject(p.id)}>
                        Reject
                      </Button>
                    </>
                  )}
                  {p.status === 'rejected' && (
                    <Button size="sm" variant="secondary"
                      onClick={() => updateProperty(p.id, { status: 'pending_vetting' })}>
                      Re-queue
                    </Button>
                  )}
                  {p.status === 'draft' && (
                    <Button size="sm" variant="secondary"
                      onClick={() => updateProperty(p.id, { status: 'pending_vetting' })}>
                      Move to Queue
                    </Button>
                  )}
                </div>
              </div>

              {/* Amenities preview */}
              {p.amenities.length > 0 && (
                <div className="px-5 pb-4 flex flex-wrap gap-1.5">
                  {p.amenities.slice(0, 6).map(a => (
                    <span key={a} className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full capitalize">
                      {a.replace(/_/g, ' ')}
                    </span>
                  ))}
                  {p.amenities.length > 6 && <span className="text-xs text-slate-400">+{p.amenities.length - 6} more</span>}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

