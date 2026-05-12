import { useState } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, CheckCircle2, XCircle, MapPin, FileText, Image, Download, Eye, X } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { Avatar } from '../../components/ui/Avatar';
import { useUserStore, type AgentApplication } from '../../store/userStore';
import { useAuthStore } from '../../store/authStore';
import { timeAgo, formatDate, roleLabels } from '../../lib/utils';
import toast from 'react-hot-toast';

// ─── Document viewer ──────────────────────────────────────────────────────────
function DocViewer({ dataUrl, name, onClose }: { dataUrl: string; name: string; onClose: () => void }) {
  const isImage = dataUrl.startsWith('data:image') || /\.(jpg|jpeg|png|gif|webp)$/i.test(name);
  const isPdf = dataUrl.startsWith('data:application/pdf') || name.toLowerCase().endsWith('.pdf');

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-3xl bg-white dark:bg-slate-800 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-700">
          <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm truncate">{name}</p>
          <div className="flex items-center gap-2">
            <a
              href={dataUrl}
              download={name}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-medium transition-colors"
            >
              <Download size={13} /> Download
            </a>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
              <X size={18} className="text-slate-500" />
            </button>
          </div>
        </div>
        {/* Content */}
        <div className="max-h-[75vh] overflow-auto p-4 flex items-center justify-center bg-slate-50 dark:bg-slate-900">
          {isImage ? (
            <img src={dataUrl} alt={name} className="max-w-full max-h-[70vh] object-contain rounded-xl shadow" />
          ) : isPdf ? (
            <iframe src={dataUrl} title={name} className="w-full h-[70vh] rounded-xl" />
          ) : (
            <div className="text-center py-12">
              <FileText size={48} className="mx-auto text-slate-300 mb-3" />
              <p className="text-slate-500 text-sm">Preview not available for this file type.</p>
              <a href={dataUrl} download={name}
                className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary-600 text-white text-sm font-medium hover:bg-primary-700 transition-colors">
                <Download size={14} /> Download to view
              </a>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Document thumbnail ───────────────────────────────────────────────────────
function DocThumb({ dataUrl, name, label, onClick }: { dataUrl?: string; name: string; label: string; onClick: () => void }) {
  const isImage = dataUrl && (dataUrl.startsWith('data:image') || /\.(jpg|jpeg|png|gif|webp)$/i.test(name));

  if (!dataUrl) {
    return (
      <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 border border-dashed border-slate-300 dark:border-slate-600">
        <FileText size={16} className="text-slate-400 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="text-xs text-slate-400">Not provided</p>
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onClick}
      className="group flex items-center gap-2.5 p-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600 hover:border-primary-400 hover:shadow-sm transition-all text-left w-full"
    >
      {/* Thumbnail or icon */}
      <div className="w-10 h-10 rounded-lg overflow-hidden flex-shrink-0 bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
        {isImage ? (
          <img src={dataUrl} alt={name} className="w-full h-full object-cover" />
        ) : (
          <FileText size={18} className="text-slate-400" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{label}</p>
        <p className="text-xs text-slate-400 truncate">{name}</p>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
        <Eye size={13} className="text-primary-600" />
        <span className="text-xs text-primary-600 font-medium">View</span>
      </div>
    </button>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function AgentApplicationsPage() {
  const { agentApplications, approveAgentApplication, rejectAgentApplication } = useUserStore();
  const { user } = useAuthStore();
  const [selected, setSelected] = useState<AgentApplication | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected' | ''>('');
  const [viewingDoc, setViewingDoc] = useState<{ dataUrl: string; name: string } | null>(null);

  const filtered = agentApplications.filter(a => !filterStatus || a.status === filterStatus);
  const pendingCount = agentApplications.filter(a => a.status === 'pending').length;

  const handleApprove = async () => {
    if (!adminNote.trim()) { toast.error('Add a note before approving'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    approveAgentApplication(selected!.id, adminNote, {
      id: user!.id,
      name: `${user!.firstName} ${user!.lastName}`,
      role: user!.role,
    });
    setLoading(false);
    setSelected(null);
    setAdminNote('');
    const roleLabel = roleLabels[selected!.role as keyof typeof roleLabels] || selected!.role || 'applicant';
    toast.success(`Application approved! ${selected!.firstName} can now operate as a ${roleLabel}.`);
  };

  const handleReject = async () => {
    if (!adminNote.trim()) { toast.error('Provide a reason for rejection'); return; }
    setLoading(true);
    await new Promise(r => setTimeout(r, 600));
    rejectAgentApplication(selected!.id, adminNote, {
      id: user!.id,
      name: `${user!.firstName} ${user!.lastName}`,
      role: user!.role,
    });
    setLoading(false);
    setSelected(null);
    setAdminNote('');
    toast(`Application rejected. Applicant will be notified.`, { icon: '❌' });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Applications</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {pendingCount} pending application{pendingCount !== 1 ? 's' : ''} awaiting review
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
        {([['', 'All'], ['pending', 'Pending'], ['approved', 'Approved'], ['rejected', 'Rejected']] as const).map(([val, label]) => (
          <button key={val} onClick={() => setFilterStatus(val as typeof filterStatus)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${filterStatus === val ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100' : 'text-slate-500'}`}>
            {label}
            {val === 'pending' && pendingCount > 0 && (
              <span className="ml-1.5 bg-amber-500 text-white text-xs rounded-full px-1.5 py-0.5">{pendingCount}</span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={<Briefcase size={28} />} title="No applications" description="Applications from landlords, agents, and property managers will appear here." />
      ) : (
        <div className="space-y-3">
          {filtered.map((app, i) => (
            <motion.div key={app.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  <Avatar name={`${app.firstName} ${app.lastName}`} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-900 dark:text-slate-100">{app.firstName} {app.lastName}</h3>
                      {app.role && (
                        <Badge variant="blue" className="capitalize">{roleLabels[app.role as keyof typeof roleLabels] || app.role}</Badge>
                      )}
                      <Badge variant={app.status === 'approved' ? 'green' : app.status === 'rejected' ? 'red' : 'yellow'}>
                        {app.status === 'pending' ? 'Pending Review' : app.status === 'approved' ? 'Approved' : 'Rejected'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{app.email} · {app.phone}</p>
                    <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                      <MapPin size={11} />
                      <span className="truncate">{app.districts.join(', ')}</span>
                    </div>
                    {/* Document count indicator */}
                    <div className="flex items-center gap-2 mt-2">
                      {app.nationalIdDoc ? (
                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                          <CheckCircle2 size={11} /> National ID
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-xs text-slate-400">
                          <XCircle size={11} /> No National ID
                        </span>
                      )}
                      {app.additionalDocs && app.additionalDocs.length > 0 && (
                        <span className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400">
                          <FileText size={11} /> {app.additionalDocs.length} additional doc{app.additionalDocs.length !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    {app.adminNote && (
                      <div className={`mt-2 p-2 rounded-lg text-xs ${app.status === 'approved' ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400'}`}>
                        <strong>Admin note:</strong> {app.adminNote}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 flex-shrink-0">
                  <p className="text-xs text-slate-400">{timeAgo(app.createdAt)}</p>
                  {app.status === 'pending' && (
                    <Button size="sm" onClick={() => { setSelected(app); setAdminNote(''); }}>Review</Button>
                  )}
                  {app.status !== 'pending' && (
                    <Button size="sm" variant="secondary" onClick={() => { setSelected(app); setAdminNote(app.adminNote || ''); }}>
                      View
                    </Button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* ── Review Modal ──────────────────────────────────────────────── */}
      <Modal
        open={!!selected}
        onClose={() => { setSelected(null); setAdminNote(''); }}
        title="Review Application"
        size="lg"
        footer={
          selected?.status === 'pending' ? (
            <div className="flex gap-2 w-full">
              <Button variant="danger" loading={loading} icon={<XCircle size={14} />} onClick={handleReject}>Reject</Button>
              <Button loading={loading} icon={<CheckCircle2 size={14} />} onClick={handleApprove}>Approve</Button>
            </div>
          ) : (
            <Button variant="secondary" onClick={() => setSelected(null)}>Close</Button>
          )
        }
      >
        {selected && (
          <div className="space-y-4">
            {/* Applicant info */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
              <Avatar name={`${selected.firstName} ${selected.lastName}`} size="md" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-slate-900 dark:text-slate-100">{selected.firstName} {selected.lastName}</p>
                  {selected.role && (
                    <Badge variant="blue" className="capitalize">{roleLabels[selected.role as keyof typeof roleLabels] || selected.role}</Badge>
                  )}
                </div>
                <p className="text-xs text-slate-400">{selected.email} · {selected.phone}</p>
                <p className="text-xs text-slate-400">Applied {formatDate(selected.createdAt)}</p>
              </div>
            </div>

            {/* ── Documents section ── */}
            <div>
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 flex items-center gap-2">
                <FileText size={15} className="text-primary-600" />
                Submitted Documents
              </p>
              <div className="space-y-2">
                {/* National ID */}
                <DocThumb
                  dataUrl={selected.nationalIdDoc}
                  name="national-id.jpg"
                  label={`National ID${selected.nationalIdNumber ? ` — ${selected.nationalIdNumber}` : ''}`}
                  onClick={() => selected.nationalIdDoc && setViewingDoc({ dataUrl: selected.nationalIdDoc, name: `National ID — ${selected.nationalIdNumber || selected.firstName}` })}
                />

                {/* Additional docs */}
                {selected.additionalDocs && selected.additionalDocs.length > 0 ? (
                  selected.additionalDocs.map((doc, idx) => (
                    <DocThumb
                      key={idx}
                      dataUrl={doc.dataUrl}
                      name={doc.name}
                      label={`Additional Document ${idx + 1} — ${doc.name}`}
                      onClick={() => setViewingDoc({ dataUrl: doc.dataUrl, name: doc.name })}
                    />
                  ))
                ) : (
                  <div className="flex items-center gap-2 p-2.5 rounded-xl bg-slate-50 dark:bg-slate-700/50 border border-dashed border-slate-200 dark:border-slate-600">
                    <Image size={15} className="text-slate-400 flex-shrink-0" />
                    <p className="text-xs text-slate-400">No additional documents submitted</p>
                  </div>
                )}
              </div>
            </div>

            {/* Application details */}
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Districts</p>
                <div className="flex flex-wrap gap-1.5">
                  {selected.districts.map(d => (
                    <span key={d} className="text-xs bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-2.5 py-1 rounded-full font-medium">{d}</span>
                  ))}
                </div>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Experience</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{selected.experience}</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Motivation</p>
                <p className="text-sm text-slate-700 dark:text-slate-300">{selected.motivation}</p>
              </div>
            </div>

            {/* Admin note */}
            {selected.status === 'pending' ? (
              <Textarea
                label="Admin Decision Note * (required)"
                placeholder="e.g. 'Approved — valid National ID, strong experience in Kampala market' or 'Rejected — National ID photo is blurry, please resubmit'"
                value={adminNote}
                onChange={e => setAdminNote(e.target.value)}
                rows={3}
              />
            ) : selected.adminNote ? (
              <div className={`p-3 rounded-xl border text-sm ${selected.status === 'approved' ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-700 dark:text-green-400' : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800 text-red-700 dark:text-red-400'}`}>
                <p className="font-semibold mb-0.5">Admin Decision</p>
                <p>{selected.adminNote}</p>
              </div>
            ) : null}
          </div>
        )}
      </Modal>

      {/* ── Full-screen document viewer ───────────────────────────────── */}
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
