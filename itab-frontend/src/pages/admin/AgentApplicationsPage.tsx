
import { useState, useMemo, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  Briefcase, CheckCircle2, XCircle, MapPin, FileText,
  Download, Eye, X, RefreshCw, Upload, Camera, RotateCcw,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { Avatar } from '../../components/ui/Avatar';
import { useUserStore, type AgentApplication } from '../../store/userStore';
import { useAuthStore } from '../../store/authStore';
import { useDataStore } from '../../store/dataStore';
import { agentApplicationsApi } from '../../lib/api';
import { timeAgo, roleLabels } from '../../lib/utils';
import toast from 'react-hot-toast';

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ─── Full-screen document viewer ─────────────────────────────────────────────
function DocViewer({ dataUrl, name, onClose }: { dataUrl: string; name: string; onClose: () => void }) {
  const isImage = /^data:image|\.(?:jpg|jpeg|png|gif|webp)$/i.test(dataUrl + name);
  const isPdf   = /^data:application\/pdf|\.pdf$/i.test(dataUrl + name);
  return (
    <div className="fixed inset-0 z-[400] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-700">
          <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate max-w-xs">{name}</p>
          <div className="flex items-center gap-2">
            <a
              href={dataUrl}
              download={name}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium transition-colors"
            >
              <Download size={13} /> Download
            </a>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
            >
              <X size={18} className="text-slate-500" />
            </button>
          </div>
        </div>
        <div className="max-h-[80vh] overflow-auto p-4 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
          {isImage ? (
            <img src={dataUrl} alt={name} className="max-w-full max-h-[75vh] object-contain rounded-xl shadow-lg" />
          ) : isPdf ? (
            <iframe src={dataUrl} title={name} className="w-full h-[75vh] rounded-xl border-0" />
          ) : (
            <div className="text-center py-16">
              <FileText size={56} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 text-sm mb-4">Preview not available for this file type.</p>
              <a
                href={dataUrl}
                download={name}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors"
              >
                <Download size={14} /> Download to view
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Document row with view + approve/reject actions ─────────────────────────
interface DocRowProps {
  dataUrl?: string;
  name: string;
  label: string;
  decision?: 'approved' | 'rejected';
  onView: () => void;
  onApprove: () => void;
  onReject: () => void;
  onReplace: (dataUrl: string, name: string) => void;
  canAct: boolean;
}
function DocRow({ dataUrl, name, label, decision, onView, onApprove, onReject, onReplace, canAct }: DocRowProps) {
  const fileRef  = useRef<HTMLInputElement>(null);
  const camRef   = useRef<HTMLInputElement>(null);
  const isImage  = dataUrl && /^data:image|\.(?:jpg|jpeg|png|gif|webp)$/i.test(dataUrl + name);

  const handleFile = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const url = await fileToDataUrl(files[0]);
      onReplace(url, files[0].name);
      toast.success('Document replaced — save to confirm.');
    } catch {
      toast.error('Could not read file.');
    }
  };

  if (!dataUrl) {
    return (
      <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-dashed border-slate-300 dark:border-slate-600">
        <div className="flex items-center gap-2 min-w-0">
          <FileText size={16} className="text-slate-400 flex-shrink-0" />
          <div>
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <p className="text-xs text-slate-400">Not provided</p>
          </div>
        </div>
        {canAct && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <input ref={fileRef} type="file" accept="image/*,application/pdf,.pdf,.doc,.docx" className="hidden"
              onChange={e => handleFile(e.target.files)} />
            <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={e => handleFile(e.target.files)} />
            <button type="button" onClick={() => { if (fileRef.current) { fileRef.current.value=''; fileRef.current.click(); }}}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 text-xs font-medium hover:bg-primary-100 transition-colors border border-primary-200 dark:border-primary-700">
              <Upload size={11} /> Upload
            </button>
            <button type="button" onClick={() => { if (camRef.current) { camRef.current.value=''; camRef.current.click(); }}}
              className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-xs font-medium hover:bg-emerald-100 transition-colors border border-emerald-200 dark:border-emerald-700">
              <Camera size={11} /> Camera
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-between gap-3 p-3 rounded-xl border transition-colors ${
      decision === 'approved' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700' :
      decision === 'rejected' ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700' :
      'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600'
    }`}>
      {/* Thumbnail + label */}
      <button
        type="button"
        onClick={onView}
        className="flex items-center gap-2.5 flex-1 min-w-0 text-left group"
      >
        <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-slate-700 flex items-center justify-center border border-slate-200 dark:border-slate-600">
          {isImage
            ? <img src={dataUrl} alt={name} className="w-full h-full object-cover" />
            : <FileText size={18} className="text-slate-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</p>
          <p className="text-xs text-slate-400 truncate">{name}</p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mr-1">
          <Eye size={12} className="text-primary-600" />
          <span className="text-xs text-primary-600 font-medium">View</span>
        </div>
      </button>

      {/* Status badge */}
      {decision && (
        <Badge variant={decision === 'approved' ? 'green' : 'red'} className="flex-shrink-0 text-xs">
          {decision === 'approved' ? '✓ Approved' : '✗ Rejected'}
        </Badge>
      )}

      {/* Actions */}
      <div className="flex items-center gap-1 flex-shrink-0">
        {/* Replace / re-upload */}
        <input ref={fileRef} type="file" accept="image/*,application/pdf,.pdf,.doc,.docx" className="hidden"
          onChange={e => handleFile(e.target.files)} />
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => handleFile(e.target.files)} />
        <button type="button" title="Replace document"
          onClick={() => { if (fileRef.current) { fileRef.current.value=''; fileRef.current.click(); }}}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-primary-600">
          <Upload size={13} />
        </button>
        <button type="button" title="Take photo"
          onClick={() => { if (camRef.current) { camRef.current.value=''; camRef.current.click(); }}}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-emerald-600">
          <Camera size={13} />
        </button>
        {canAct && (
          <>
            <button type="button" title="Approve document"
              onClick={onApprove}
              className="p-1.5 rounded-lg hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors text-slate-400 hover:text-green-600">
              <CheckCircle2 size={14} />
            </button>
            <button type="button" title="Reject document"
              onClick={onReject}
              className="p-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors text-slate-400 hover:text-red-500">
              <XCircle size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function AgentApplicationsPage() {
  const { agentApplications, approveAgentApplication, rejectAgentApplication } = useUserStore();
  const { agentApplications: backendApps, setAgentApplications } = useDataStore();
  const { user } = useAuthStore();

  const [refreshing, setRefreshing] = useState(false);

  const fetchApplications = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await agentApplicationsApi.list();
      const apps = (res.data as { data: AgentApplication[] }).data;
      if (Array.isArray(apps)) setAgentApplications(apps);
    } catch { /* keep cached */ }
    finally { setRefreshing(false); }
  }, [setAgentApplications]);

  useMemo(() => { fetchApplications(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Merge store + backend apps, backend wins
  const allApps = useMemo(() => {
    const map = new Map<string, AgentApplication>();
    (backendApps as AgentApplication[]).forEach(raw => { if (raw?.id) map.set(raw.id, raw); });
    agentApplications.forEach(a => { if (a?.id && !map.has(a.id)) map.set(a.id, a); });
    return [...map.values()].sort(
      (x, y) => new Date(y.createdAt || 0).getTime() - new Date(x.createdAt || 0).getTime()
    );
  }, [backendApps, agentApplications]);

  // ── Modal state ──────────────────────────────────────────────────────────
  const [selected, setSelected]       = useState<AgentApplication | null>(null);
  const [adminNote, setAdminNote]     = useState('');
  const [loading, setLoading]         = useState(false);
  const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected' | ''>('');
  const [viewingDoc, setViewingDoc]   = useState<{ dataUrl: string; name: string } | null>(null);

  // Per-doc decisions (local, shown as badges until saved)
  const [docDecisions, setDocDecisions] = useState<Record<string, 'approved' | 'rejected'>>({});

  // Edited docs (admin replaced a file — pending save)
  const [editedNationalId, setEditedNationalId] = useState<{ dataUrl: string; name: string } | null>(null);
  const [editedAdditionalDocs, setEditedAdditionalDocs] = useState<
    { idx: number; dataUrl: string; name: string }[]
  >([]);
  const [savingDocs, setSavingDocs] = useState(false);

  // Doc-level reject reason modal
  const [docRejectModal, setDocRejectModal] = useState<{ key: string; label: string } | null>(null);
  const [docRejectNote, setDocRejectNote]   = useState('');

  const filtered     = allApps.filter(a => !filterStatus || a.status === filterStatus);
  const pendingCount = allApps.filter(a => a.status === 'pending').length;

  const openReview = (app: AgentApplication) => {
    setSelected(app);
    setAdminNote('');
    setDocDecisions({});
    setEditedNationalId(null);
    setEditedAdditionalDocs([]);
  };

  // ── Approve / Reject application ─────────────────────────────────────────
  const handleApprove = async () => {
    if (!adminNote.trim()) { toast.error('Add a note before approving'); return; }
    setLoading(true);
    try {
      const res = await agentApplicationsApi.approve(selected!.id, adminNote);
      const updated = (res.data as { data: AgentApplication }).data;
      if (updated?.id) {
        const { agentApplications: da } = useDataStore.getState();
        const has = da.some(r => (r as AgentApplication).id === updated.id);
        setAgentApplications(
          has ? da.map(r => ((r as AgentApplication).id === updated.id ? updated : r)) : [updated, ...da]
        );
      }
    } catch { /* offline */ }
    approveAgentApplication(selected!.id, adminNote, {
      id: user!.id,
      name: `${user!.firstName} ${user!.lastName}`,
      role: user!.role,
    });
    setLoading(false);
    const roleLabel = roleLabels[selected!.role as keyof typeof roleLabels] || selected!.role || 'applicant';
    toast.success(`Application approved! ${selected!.firstName} can now operate as a ${roleLabel}.`);
    setSelected(null);
  };

  const handleReject = async () => {
    if (!adminNote.trim()) { toast.error('Provide a reason for rejection'); return; }
    setLoading(true);
    try {
      const res = await agentApplicationsApi.reject(selected!.id, adminNote);
      const updated = (res.data as { data: AgentApplication }).data;
      if (updated?.id) {
        const { agentApplications: da } = useDataStore.getState();
        const has = da.some(r => (r as AgentApplication).id === updated.id);
        setAgentApplications(
          has ? da.map(r => ((r as AgentApplication).id === updated.id ? updated : r)) : [updated, ...da]
        );
      }
    } catch { /* offline */ }
    rejectAgentApplication(selected!.id, adminNote, {
      id: user!.id,
      name: `${user!.firstName} ${user!.lastName}`,
      role: user!.role,
    });
    setLoading(false);
    toast('Application rejected. Applicant will be notified.', { icon: '❌' });
    setSelected(null);
  };

  // ── Save replaced documents to backend ───────────────────────────────────
  const handleSaveDocs = async () => {
    if (!selected) return;
    setSavingDocs(true);
    try {
      const payload: { nationalIdDoc?: string; additionalDocs?: { name: string; dataUrl: string; type: string }[] } = {};
      if (editedNationalId) {
        payload.nationalIdDoc = editedNationalId.dataUrl;
      }
      if (editedAdditionalDocs.length > 0) {
        const base = selected.additionalDocs ? [...selected.additionalDocs] : [];
        editedAdditionalDocs.forEach(({ idx, dataUrl, name }) => {
          base[idx] = { name, dataUrl, type: 'document' };
        });
        payload.additionalDocs = base;
      }
      const res = await agentApplicationsApi.updateDocs(selected.id, payload);
      const updated = (res.data as { data: AgentApplication }).data;
      if (updated?.id) {
        const { agentApplications: da } = useDataStore.getState();
        const has = da.some(r => (r as AgentApplication).id === updated.id);
        setAgentApplications(
          has ? da.map(r => ((r as AgentApplication).id === updated.id ? updated : r)) : [updated, ...da]
        );
        setSelected(updated);
      }
      setEditedNationalId(null);
      setEditedAdditionalDocs([]);
      toast.success('Documents updated successfully.');
    } catch {
      toast.error('Could not save documents. Please try again.');
    } finally {
      setSavingDocs(false);
    }
  };

  const hasPendingDocEdits = !!editedNationalId || editedAdditionalDocs.length > 0;

  // ── Per-doc approve ───────────────────────────────────────────────────────
  const approveDoc = (key: string) => {
    setDocDecisions(prev => ({ ...prev, [key]: 'approved' }));
    toast.success('Document marked as approved.');
  };

  // ── Per-doc reject (opens reason modal) ──────────────────────────────────
  const rejectDoc = (key: string, label: string) => {
    setDocRejectModal({ key, label });
    setDocRejectNote('');
  };

  const confirmDocReject = () => {
    if (!docRejectModal) return;
    setDocDecisions(prev => ({ ...prev, [docRejectModal.key]: 'rejected' }));
    toast('Document marked as rejected.', { icon: '❌' });
    setDocRejectModal(null);
    setDocRejectNote('');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Applications</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {pendingCount} pending application{pendingCount !== 1 ? 's' : ''} awaiting review
          </p>
        </div>
        <Button
          size="sm"
          variant="secondary"
          icon={<RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />}
          onClick={fetchApplications}
          disabled={refreshing}
        >
          Refresh
        </Button>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
        {([['', 'All'], ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']] as const).map(
          ([val, label]) => (
            <button
              key={val}
              onClick={() => setFilterStatus(val as typeof filterStatus)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                filterStatus === val
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {label}
              {val === 'pending' && pendingCount > 0 && (
                <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">
                  {pendingCount}
                </span>
              )}
            </button>
          )
        )}
      </div>

      {/* Application list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<Briefcase size={28} />}
          title="No applications"
          description="Applications from landlords, agents, and property managers will appear here."
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((app, i) => (
            <motion.div
              key={app.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Avatar name={`${app.firstName} ${app.lastName}`} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-900 dark:text-slate-100">
                        {app.firstName} {app.lastName}
                      </h3>
                      {app.role && (
                        <Badge variant="blue" className="capitalize">
                          {roleLabels[app.role as keyof typeof roleLabels] || app.role}
                        </Badge>
                      )}
                      <Badge
                        variant={
                          app.status === 'approved' ? 'green' :
                          app.status === 'rejected' ? 'red' : 'yellow'
                        }
                      >
                        {app.status === 'pending' ? 'Pending Review' :
                         app.status === 'approved' ? 'Approved' : 'Rejected'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{app.email} · {app.phone}</p>
                    <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                      <MapPin size={11} />
                      <span className="truncate">{app.districts.join(', ')}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-2">
                      {app.nationalIdDoc ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <CheckCircle2 size={11} /> National ID
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-red-500">
                          <XCircle size={11} /> No National ID
                        </span>
                      )}
                      {app.additionalDocs && app.additionalDocs.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                          <FileText size={11} />
                          {app.additionalDocs.length} additional doc{app.additionalDocs.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {app.adminNote && (
                      <div className={`mt-2 p-2 rounded-lg text-xs ${
                        app.status === 'approved'
                          ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                          : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
                      }`}>
                        <strong>Admin note:</strong> {app.adminNote}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <p className="text-xs text-slate-400">{timeAgo(app.createdAt)}</p>
                  {app.status === 'pending' ? (
                    <Button size="sm" onClick={() => openReview(app)}>Review</Button>
                  ) : (
                    <Button size="sm" variant="secondary" onClick={() => openReview(app)}>View</Button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Review / View modal ─────────────────────────────────────────── */}
      {selected && (
        <Modal
          open
          onClose={() => setSelected(null)}
          title={`${selected.status === 'pending' ? 'Review' : 'View'} Application — ${selected.firstName} ${selected.lastName}`}
          size="lg"
        >
          <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">

            {/* Applicant info grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <span className="text-slate-500">Role: </span>
                <span className="font-medium capitalize">
                  {roleLabels[selected.role as keyof typeof roleLabels] || selected.role}
                </span>
              </div>
              <div>
                <span className="text-slate-500">Email: </span>
                <span className="font-medium">{selected.email}</span>
              </div>
              <div>
                <span className="text-slate-500">Phone: </span>
                <span className="font-medium">{selected.phone || '—'}</span>
              </div>
              <div>
                <span className="text-slate-500">Applied: </span>
                <span className="font-medium">{timeAgo(selected.createdAt)}</span>
              </div>
              <div className="col-span-2">
                <span className="text-slate-500">Districts: </span>
                <span className="font-medium">{selected.districts.join(', ')}</span>
              </div>
            </div>

            {/* Experience */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Experience</p>
              <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                {selected.experience}
              </p>
            </div>

            {/* Motivation */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Motivation</p>
              <p className="text-sm text-slate-700 dark:text-slate-300 bg-slate-50 dark:bg-slate-700/50 rounded-xl p-3">
                {selected.motivation}
              </p>
            </div>

            {/* Documents section */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                  Documents
                </p>
                {hasPendingDocEdits && (
                  <Button
                    size="sm"
                    loading={savingDocs}
                    icon={<RotateCcw size={12} />}
                    onClick={handleSaveDocs}
                  >
                    Save Changes
                  </Button>
                )}
              </div>

              <div className="space-y-2">
                {/* National ID */}
                <DocRow
                  dataUrl={editedNationalId?.dataUrl ?? selected.nationalIdDoc}
                  name={editedNationalId?.name ?? 'national_id'}
                  label="National ID"
                  decision={docDecisions['national_id']}
                  onView={() => {
                    const url = editedNationalId?.dataUrl ?? selected.nationalIdDoc;
                    if (url) setViewingDoc({ dataUrl: url, name: editedNationalId?.name ?? 'National ID' });
                  }}
                  onApprove={() => approveDoc('national_id')}
                  onReject={() => rejectDoc('national_id', 'National ID')}
                  onReplace={(dataUrl, name) => setEditedNationalId({ dataUrl, name })}
                  canAct={selected.status === 'pending'}
                />

                {/* Additional docs */}
                {(selected.additionalDocs ?? []).map((doc, idx) => {
                  const key = `additional_${idx}`;
                  const edited = editedAdditionalDocs.find(e => e.idx === idx);
                  return (
                    <DocRow
                      key={idx}
                      dataUrl={edited?.dataUrl ?? doc.dataUrl}
                      name={edited?.name ?? doc.name}
                      label={doc.name || `Document ${idx + 1}`}
                      decision={docDecisions[key]}
                      onView={() => {
                        const url = edited?.dataUrl ?? doc.dataUrl;
                        if (url) setViewingDoc({ dataUrl: url, name: edited?.name ?? doc.name });
                      }}
                      onApprove={() => approveDoc(key)}
                      onReject={() => rejectDoc(key, doc.name || `Document ${idx + 1}`)}
                      onReplace={(dataUrl, name) => {
                        setEditedAdditionalDocs(prev => {
                          const next = prev.filter(e => e.idx !== idx);
                          return [...next, { idx, dataUrl, name }];
                        });
                      }}
                      canAct={selected.status === 'pending'}
                    />
                  );
                })}

                {/* No docs at all */}
                {!selected.nationalIdDoc && (!selected.additionalDocs || selected.additionalDocs.length === 0) && (
                  <p className="text-xs text-slate-400 italic py-2">No documents submitted.</p>
                )}
              </div>

              {hasPendingDocEdits && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                  <Upload size={11} /> You have unsaved document changes — click "Save Changes" above.
                </p>
              )}
            </div>

            {/* Admin note */}
            {selected.status === 'pending' ? (
              <Textarea
                label="Admin Note *"
                placeholder="Add a note (required for both approval and rejection)..."
                rows={3}
                value={adminNote}
                onChange={e => setAdminNote(e.target.value)}
              />
            ) : selected.adminNote ? (
              <div className={`p-3 rounded-xl text-sm ${
                selected.status === 'approved'
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                  : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300'
              }`}>
                <strong>Admin note:</strong> {selected.adminNote}
              </div>
            ) : null}

            {/* Action buttons */}
            {selected.status === 'pending' && (
              <div className="flex gap-3 pt-2">
                <Button
                  variant="secondary"
                  className="flex-1"
                  onClick={() => setSelected(null)}
                >
                  Cancel
                </Button>
                <Button
                  variant="danger"
                  className="flex-1"
                  loading={loading}
                  onClick={handleReject}
                >
                  Reject
                </Button>
                <Button
                  className="flex-1"
                  loading={loading}
                  onClick={handleApprove}
                >
                  Approve
                </Button>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* Full-screen document viewer */}
      {viewingDoc && (
        <DocViewer
          dataUrl={viewingDoc.dataUrl}
          name={viewingDoc.name}
          onClose={() => setViewingDoc(null)}
        />
      )}

      {/* Per-doc reject reason modal */}
      {docRejectModal && (
        <Modal
          open
          onClose={() => setDocRejectModal(null)}
          title={`Reject — ${docRejectModal.label}`}
          size="sm"
        >
          <div className="space-y-4">
            <Textarea
              label="Rejection reason (optional)"
              placeholder="Explain why this document is not acceptable..."
              rows={3}
              value={docRejectNote}
              onChange={e => setDocRejectNote(e.target.value)}
            />
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setDocRejectModal(null)}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                className="flex-1"
                onClick={confirmDocReject}
              >
                Reject Document
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
