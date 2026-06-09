
/**
 * AgentApplicationsPage — admin view of all landlord/agent/property_manager
 * applications submitted during registration.
 *
 * Data source: GET /api/agent-applications (Render PostgreSQL, admin only).
 * Documents (nationalIdDoc + additionalDocs) are base64 data-URLs stored
 * directly in the agent_applications table and returned by the API.
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Briefcase, CheckCircle2, XCircle, MapPin, FileText,
  Download, Eye, X, RefreshCw, Upload, Camera, RotateCcw,
  AlertCircle,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { Avatar } from '../../components/ui/Avatar';
import { useAuthStore as _useAuthStore } from '../../store/authStore';
import { agentApplicationsApi } from '../../lib/api';
import { timeAgo, roleLabels } from '../../lib/utils';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────
interface AdditionalDoc {
  name: string;
  dataUrl: string;
  type: string;
}

interface Application {
  id: string;
  userId?: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  role?: string;
  nationalIdNumber?: string;
  nationalIdDoc?: string;
  additionalDocs?: AdditionalDoc[];
  experience: string;
  districts: string[];
  motivation: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNote?: string;
  createdAt: string;
  reviewedAt?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => resolve(e.target?.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function isImageUrl(url: string, name: string): boolean {
  return /^data:image\//i.test(url) || /\.(jpg|jpeg|png|gif|webp|svg)$/i.test(name);
}

function isPdfUrl(url: string, name: string): boolean {
  return /^data:application\/pdf/i.test(url) || /\.pdf$/i.test(name);
}

function isWordDoc(url: string, name: string): boolean {
  return /^data:application\/(msword|vnd\.openxmlformats|vnd\.ms-word)/i.test(url)
    || /\.(doc|docx)$/i.test(name);
}

/** Friendly label derived from MIME type or filename. */
function docTypeLabel(url: string, name: string): string {
  if (isImageUrl(url, name)) return 'Image';
  if (isPdfUrl(url, name))   return 'PDF';
  if (isWordDoc(url, name))  return 'Word Document';
  return 'Document';
}

// ─── Full-screen document viewer ─────────────────────────────────────────────
function DocViewer({ dataUrl, name, onClose }: { dataUrl: string; name: string; onClose: () => void }) {
  const isImg   = isImageUrl(dataUrl, name);
  const isPdf   = isPdfUrl(dataUrl, name);
  const typeLabel = docTypeLabel(dataUrl, name);
  return (
    <div className="fixed inset-0 z-[500] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-4xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate max-w-xs">{name}</p>
            <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 px-2 py-0.5 rounded-full flex-shrink-0">{typeLabel}</span>
          </div>
          <div className="flex items-center gap-2">
            <a href={dataUrl} download={name}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium transition-colors">
              <Download size={13} /> Download
            </a>
            <button onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <X size={18} className="text-slate-500" />
            </button>
          </div>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-auto p-4 flex items-center justify-center bg-slate-50 dark:bg-slate-900 min-h-0">
          {isImg ? (
            <img src={dataUrl} alt={name}
              className="max-w-full max-h-[80vh] object-contain rounded-xl shadow-lg" />
          ) : isPdf ? (
            <iframe src={dataUrl} title={name} className="w-full h-[80vh] rounded-xl border-0" />
          ) : (
            <div className="text-center py-16">
              <FileText size={56} className="mx-auto text-slate-300 mb-4" />
              <p className="text-slate-500 text-sm mb-1">Preview not available for <strong>{typeLabel}</strong> files.</p>
              <p className="text-slate-400 text-xs mb-4">Download the file to open it with the appropriate application.</p>
              <a href={dataUrl} download={name}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors">
                <Download size={14} /> Download to view
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Single document row ──────────────────────────────────────────────────────
interface DocRowProps {
  dataUrl?: string;
  name: string;
  label: string;
  onView: () => void;
  onReplace: (dataUrl: string, name: string) => void;
}
function DocRow({ dataUrl, name, label, onView, onReplace }: DocRowProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef  = useRef<HTMLInputElement>(null);
  const isImg   = dataUrl ? isImageUrl(dataUrl, name) : false;
  const isPdf   = dataUrl ? isPdfUrl(dataUrl, name) : false;
  const typeLabel = dataUrl ? docTypeLabel(dataUrl, name) : '';

  const handleFile = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    try {
      const url = await fileToDataUrl(files[0]);
      onReplace(url, files[0].name);
      toast.success('Document replaced — click "Save Changes" to confirm.');
    } catch { toast.error('Could not read file.'); }
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
        <div className="flex items-center gap-1.5 flex-shrink-0">
          <input ref={fileRef} type="file" accept="image/*,application/pdf,.pdf,.doc,.docx" className="hidden"
            onChange={e => handleFile(e.target.files)} />
          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={e => handleFile(e.target.files)} />
          <button type="button"
            onClick={() => { if (fileRef.current) { fileRef.current.value = ''; fileRef.current.click(); } }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 text-xs font-medium hover:bg-primary-100 transition-colors border border-primary-200 dark:border-primary-700">
            <Upload size={11} /> Upload
          </button>
          <button type="button"
            onClick={() => { if (camRef.current) { camRef.current.value = ''; camRef.current.click(); } }}
            className="flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-300 text-xs font-medium hover:bg-emerald-100 transition-colors border border-emerald-200 dark:border-emerald-700">
            <Camera size={11} /> Camera
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 hover:border-primary-300 transition-colors">
      {/* Thumbnail + label — click to view */}
      <button type="button" onClick={onView}
        className="flex items-center gap-2.5 flex-1 min-w-0 text-left group">
        <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-slate-700 flex items-center justify-center border border-slate-200 dark:border-slate-600">
          {isImg
            ? <img src={dataUrl} alt={name} className="w-full h-full object-cover" />
            : isPdf
              ? <span className="text-xs font-bold text-red-600">PDF</span>
              : <FileText size={20} className="text-slate-400" />}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</p>
          <p className="text-xs text-slate-400 truncate">{name || typeLabel}</p>
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mr-1">
          <Eye size={13} className="text-primary-600" />
          <span className="text-xs text-primary-600 font-medium">View</span>
        </div>
      </button>

      {/* Replace buttons */}
      <div className="flex items-center gap-1 flex-shrink-0">
        <input ref={fileRef} type="file" accept="image/*,application/pdf,.pdf,.doc,.docx" className="hidden"
          onChange={e => handleFile(e.target.files)} />
        <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden"
          onChange={e => handleFile(e.target.files)} />
        <button type="button" title="Replace document"
          onClick={() => { if (fileRef.current) { fileRef.current.value = ''; fileRef.current.click(); } }}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-primary-600">
          <Upload size={13} />
        </button>
        <button type="button" title="Take photo"
          onClick={() => { if (camRef.current) { camRef.current.value = ''; camRef.current.click(); } }}
          className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-400 hover:text-emerald-600">
          <Camera size={13} />
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function AgentApplicationsPage() {
  const { } = _useAuthStore(); // reserved

  // ── Local state — single source of truth, fetched directly from backend ──
  const [apps, setApps]           = useState<Application[]>([]);
  const [loading, setLoading]     = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]         = useState<string | null>(null);

  const fetchApplications = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    setError(null);
    try {
      const res = await agentApplicationsApi.list();
      const data = (res.data as { data: Application[] }).data;
      if (Array.isArray(data)) {
        setApps(data);
      } else {
        setError('Unexpected response from server.');
      }
    } catch (err: unknown) {
      const ax = err as { response?: { status?: number; data?: { message?: string } } };
      if (ax.response?.status === 403) {
        setError('You do not have permission to view applications.');
      } else {
        setError('Could not load applications. Check your connection.');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fetch on mount — useEffect, not useMemo
  useEffect(() => {
    fetchApplications();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Filter ───────────────────────────────────────────────────────────────
  const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected' | ''>('');
  const filtered     = apps.filter(a => !filterStatus || a.status === filterStatus);
  const pendingCount = apps.filter(a => a.status === 'pending').length;

  // ── Review modal ─────────────────────────────────────────────────────────
  const [selected, setSelected]   = useState<Application | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [acting, setActing]       = useState(false);

  // Document viewer
  const [viewingDoc, setViewingDoc] = useState<{ dataUrl: string; name: string } | null>(null);

  // Edited docs (pending save)
  const [editedNationalId, setEditedNationalId] = useState<{ dataUrl: string; name: string } | null>(null);
  const [editedAdditionalDocs, setEditedAdditionalDocs] = useState<{ idx: number; dataUrl: string; name: string }[]>([]);
  const [savingDocs, setSavingDocs] = useState(false);

  const hasPendingDocEdits = !!editedNationalId || editedAdditionalDocs.length > 0;

  const openReview = (app: Application) => {
    setSelected(app);
    setAdminNote('');
    setEditedNationalId(null);
    setEditedAdditionalDocs([]);
  };

  // ── Approve ───────────────────────────────────────────────────────────────
  const handleApprove = async () => {
    if (!selected) return;
    if (!adminNote.trim()) { toast.error('Add a note before approving'); return; }
    setActing(true);
    try {
      const res = await agentApplicationsApi.approve(selected.id, adminNote);
      const updated = (res.data as { data: Application }).data;
      setApps(prev => prev.map(a => a.id === selected.id ? { ...a, ...updated } : a));
      const roleLabel = roleLabels[selected.role as keyof typeof roleLabels] || selected.role || 'applicant';
      toast.success(`Application approved! ${selected.firstName} can now operate as a ${roleLabel}.`);
      setSelected(null);
    } catch {
      toast.error('Could not approve. Please try again.');
    } finally {
      setActing(false);
    }
  };

  // ── Reject ────────────────────────────────────────────────────────────────
  const handleReject = async () => {
    if (!selected) return;
    if (!adminNote.trim()) { toast.error('Provide a reason for rejection'); return; }
    setActing(true);
    try {
      const res = await agentApplicationsApi.reject(selected.id, adminNote);
      const updated = (res.data as { data: Application }).data;
      setApps(prev => prev.map(a => a.id === selected.id ? { ...a, ...updated } : a));
      toast('Application rejected. Applicant will be notified.', { icon: '❌' });
      setSelected(null);
    } catch {
      toast.error('Could not reject. Please try again.');
    } finally {
      setActing(false);
    }
  };

  // ── Save replaced documents ───────────────────────────────────────────────
  const handleSaveDocs = async () => {
    if (!selected) return;
    setSavingDocs(true);
    try {
      const payload: { nationalIdDoc?: string; additionalDocs?: AdditionalDoc[] } = {};
      if (editedNationalId) {
        payload.nationalIdDoc = editedNationalId.dataUrl;
      }
      if (editedAdditionalDocs.length > 0) {
        const base: AdditionalDoc[] = selected.additionalDocs ? [...selected.additionalDocs] : [];
        editedAdditionalDocs.forEach(({ idx, dataUrl, name }) => {
          base[idx] = { name, dataUrl, type: 'document' };
        });
        payload.additionalDocs = base;
      }
      const res = await agentApplicationsApi.updateDocs(selected.id, payload);
      const updated = (res.data as { data: Application }).data;
      setApps(prev => prev.map(a => a.id === selected.id ? { ...a, ...updated } : a));
      setSelected(updated);
      setEditedNationalId(null);
      setEditedAdditionalDocs([]);
      toast.success('Documents updated successfully.');
    } catch {
      toast.error('Could not save documents. Please try again.');
    } finally {
      setSavingDocs(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
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
        <Button size="sm" variant="secondary"
          icon={<RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />}
          onClick={() => fetchApplications(true)}
          disabled={refreshing || loading}>
          Refresh
        </Button>
      </div>

      {/* Error state */}
      {error && (
        <div className="flex items-start gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
          <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800 dark:text-red-300 text-sm">{error}</p>
            <button onClick={() => fetchApplications()} className="text-xs text-red-600 underline mt-1">Try again</button>
          </div>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && !error && (
        <div className="space-y-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 p-5 animate-pulse">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-200 dark:bg-slate-700 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-slate-200 dark:bg-slate-700 rounded w-48" />
                  <div className="h-3 bg-slate-100 dark:bg-slate-700 rounded w-64" />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Filter tabs */}
      {!loading && !error && (
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
          {([['', 'All'], ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']] as const).map(
            ([val, label]) => (
              <button key={val} onClick={() => setFilterStatus(val as typeof filterStatus)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${
                  filterStatus === val
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
                }`}>
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
      )}

      {/* Application list */}
      {!loading && !error && filtered.length === 0 && (
        <EmptyState icon={<Briefcase size={28} />} title="No applications"
          description="Applications from landlords, agents, and property managers will appear here." />
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((app, i) => (
            <motion.div key={app.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5">
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
                      <Badge variant={app.status === 'approved' ? 'green' : app.status === 'rejected' ? 'red' : 'yellow'}>
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
                          <CheckCircle2 size={11} /> National ID attached
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

      {/* ── Review / View modal ─────────────────────────────────────────────── */}
      {selected && (
        <Modal open onClose={() => setSelected(null)}
          title={`${selected.status === 'pending' ? 'Review' : 'View'} — ${selected.firstName} ${selected.lastName}`}
          size="lg">
          <div className="space-y-5 max-h-[75vh] overflow-y-auto pr-1">

            {/* Info grid */}
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><span className="text-slate-500">Role: </span>
                <span className="font-medium capitalize">
                  {roleLabels[selected.role as keyof typeof roleLabels] || selected.role}
                </span>
              </div>
              <div><span className="text-slate-500">Email: </span>
                <span className="font-medium">{selected.email}</span>
              </div>
              <div><span className="text-slate-500">Phone: </span>
                <span className="font-medium">{selected.phone || '—'}</span>
              </div>
              <div><span className="text-slate-500">Applied: </span>
                <span className="font-medium">{timeAgo(selected.createdAt)}</span>
              </div>
              <div className="col-span-2"><span className="text-slate-500">Districts: </span>
                <span className="font-medium">{selected.districts.join(', ')}</span>
              </div>
              {selected.nationalIdNumber && (
                <div className="col-span-2"><span className="text-slate-500">National ID No: </span>
                  <span className="font-medium font-mono">{selected.nationalIdNumber}</span>
                </div>
              )}
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

            {/* Documents */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Documents</p>
                {hasPendingDocEdits && (
                  <Button size="sm" loading={savingDocs} icon={<RotateCcw size={12} />}
                    onClick={handleSaveDocs}>
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
                  onView={() => {
                    const url = editedNationalId?.dataUrl ?? selected.nationalIdDoc;
                    if (url) setViewingDoc({ dataUrl: url, name: editedNationalId?.name ?? 'National ID' });
                    else toast.error('No National ID document was uploaded.');
                  }}
                  onReplace={(dataUrl, name) => setEditedNationalId({ dataUrl, name })}
                />

                {/* Additional docs */}
                {(selected.additionalDocs ?? []).map((doc, idx) => {
                  const edited = editedAdditionalDocs.find(e => e.idx === idx);
                  return (
                    <DocRow
                      key={idx}
                      dataUrl={edited?.dataUrl ?? doc.dataUrl}
                      name={edited?.name ?? doc.name}
                      label={doc.name || `Document ${idx + 1}`}
                      onView={() => {
                        const url = edited?.dataUrl ?? doc.dataUrl;
                        if (url) setViewingDoc({ dataUrl: url, name: edited?.name ?? doc.name });
                        else toast.error('Document file not available.');
                      }}
                      onReplace={(dataUrl, name) => {
                        setEditedAdditionalDocs(prev => {
                          const next = prev.filter(e => e.idx !== idx);
                          return [...next, { idx, dataUrl, name }];
                        });
                      }}
                    />
                  );
                })}

                {!selected.nationalIdDoc && (!selected.additionalDocs || selected.additionalDocs.length === 0) && (
                  <p className="text-xs text-slate-400 italic py-2 text-center">
                    No documents were submitted with this application.
                  </p>
                )}
              </div>

              {hasPendingDocEdits && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-2 flex items-center gap-1">
                  <Upload size={11} /> Unsaved document changes — click "Save Changes" above.
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
                <Button variant="secondary" className="flex-1" onClick={() => setSelected(null)}>
                  Cancel
                </Button>
                <Button variant="danger" className="flex-1" loading={acting} onClick={handleReject}>
                  Reject
                </Button>
                <Button className="flex-1" loading={acting} onClick={handleApprove}>
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
    </div>
  );
}
