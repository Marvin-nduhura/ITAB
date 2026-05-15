import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Textarea } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { usePropertyStore } from '../../store/propertyStore';
import { propertyConflictsApi } from '../../lib/api';
import type { PropertyLocationConflict } from '../../types';
import { formatDate } from '../../lib/utils';
import toast from 'react-hot-toast';

export function PropertyLocationConflicts() {
  const navigate = useNavigate();
  const { properties } = usePropertyStore();
  const [conflicts, setConflicts] = useState<PropertyLocationConflict[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'all'>('pending');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await propertyConflictsApi.list(filter === 'all' ? 'all' : 'pending');
      setConflicts((res.data.data as PropertyLocationConflict[]) || []);
    } catch {
      toast.error('Could not load location conflicts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [filter]);

  const resolve = async (id: string, status: 'confirmed_duplicate' | 'not_duplicate') => {
    setSavingId(id);
    try {
      await propertyConflictsApi.resolve(id, { status, adminNotes: notes[id] });
      toast.success(status === 'confirmed_duplicate' ? 'Marked as duplicate' : 'Marked as not duplicate');
      await load();
    } catch {
      toast.error('Could not save decision');
    } finally {
      setSavingId(null);
    }
  };

  const pendingCount = conflicts.filter(c => c.status === 'pending').length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Location Conflicts</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Listings with the same or very close map pins. Review and decide if they are duplicates.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant={filter === 'pending' ? 'primary' : 'secondary'} size="sm" onClick={() => setFilter('pending')}>
            Pending {pendingCount > 0 && `(${pendingCount})`}
          </Button>
          <Button variant={filter === 'all' ? 'primary' : 'secondary'} size="sm" onClick={() => setFilter('all')}>
            All
          </Button>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-slate-500">Loading…</p>
      ) : conflicts.length === 0 ? (
        <EmptyState
          icon={<CheckCircle2 size={28} />}
          title="No conflicts to review"
          description="When two properties share the same pin or are within ~50m, they appear here."
        />
      ) : (
        <div className="space-y-4">
          {conflicts.map(c => (
            <Card key={c.id}>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-amber-500" />
                  <div>
                    <p className="font-semibold text-slate-900 dark:text-slate-100">
                      {c.propertyIds.length} properties in conflict
                    </p>
                    <p className="text-xs text-slate-400">
                      {c.reason === 'exact_pin' ? 'Exact same pin' : 'Within ~50m'} ·{' '}
                      {c.minDistanceMeters < 1 ? '0m' : `${Math.round(c.minDistanceMeters)}m`} · {formatDate(c.createdAt)}
                    </p>
                  </div>
                </div>
                <Badge variant={c.status === 'pending' ? 'yellow' : c.status === 'confirmed_duplicate' ? 'red' : 'green'}>
                  {c.status.replace(/_/g, ' ')}
                </Badge>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                {c.propertyIds.map(pid => {
                  const p = properties.find(x => x.id === pid);
                  if (!p) {
                    return (
                      <div key={pid} className="p-3 rounded-xl border border-slate-200 dark:border-slate-600 text-sm text-slate-500">
                        {pid} (sync properties to see details)
                      </div>
                    );
                  }
                  return (
                    <button
                      key={pid}
                      type="button"
                      onClick={() => navigate(`/properties/${pid}`)}
                      className="p-3 rounded-xl border border-slate-200 dark:border-slate-600 text-left hover:border-primary-400 transition-colors"
                    >
                      <p className="font-medium text-slate-900 dark:text-slate-100 text-sm">{p.title}</p>
                      <p className="text-xs text-slate-400 flex items-center gap-1 mt-1">
                        <MapPin size={11} /> {p.address}, {p.district}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        Added by {p.createdByName || 'Unknown'} · {p.status}
                      </p>
                    </button>
                  );
                })}
              </div>

              {c.status === 'pending' && (
                <>
                  <Textarea
                    label="Admin notes (optional)"
                    placeholder="Why these are or are not duplicates…"
                    value={notes[c.id] || ''}
                    onChange={e => setNotes(n => ({ ...n, [c.id]: e.target.value }))}
                  />
                  <div className="flex flex-wrap gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="danger"
                      loading={savingId === c.id}
                      icon={<XCircle size={14} />}
                      onClick={() => resolve(c.id, 'confirmed_duplicate')}
                    >
                      Same property (duplicate)
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      loading={savingId === c.id}
                      icon={<CheckCircle2 size={14} />}
                      onClick={() => resolve(c.id, 'not_duplicate')}
                    >
                      Different properties (OK)
                    </Button>
                  </div>
                </>
              )}
              {c.adminNotes && c.status !== 'pending' && (
                <p className="text-sm text-slate-500 mt-2">Notes: {c.adminNotes}</p>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
