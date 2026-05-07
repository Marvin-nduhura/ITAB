import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText, Upload, Download, CheckCircle2, Clock, XCircle,
  Shield, Home, User, AlertTriangle, Eye, Trash2, Plus, Search,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Textarea } from '../components/ui/Input';
import { FileUpload, type UploadedFile } from '../components/ui/FileUpload';
import { Avatar } from '../components/ui/Avatar';
import { EmptyState } from '../components/ui/EmptyState';
import { useAuthStore } from '../store/authStore';
import { useDocumentStore, type DocCategory, type Document } from '../store/documentStore';
import { useUserStore } from '../store/userStore';
import { formatDate, roleLabels } from '../lib/utils';
import toast from 'react-hot-toast';

const categoryConfig: Record<DocCategory, { label: string; icon: React.ReactNode; color: string }> = {
  kyc:       { label: 'KYC / Identity',  icon: <Shield size={16} />,   color: 'text-blue-600' },
  lease:     { label: 'Lease Documents', icon: <Home size={16} />,     color: 'text-green-600' },
  ownership: { label: 'Ownership Docs',  icon: <FileText size={16} />, color: 'text-purple-600' },
  other:     { label: 'Other Documents', icon: <User size={16} />,     color: 'text-slate-600' },
};

const statusConfig = {
  approved: { label: 'Approved',  variant: 'green'  as const },
  pending:  { label: 'Pending',   variant: 'yellow' as const },
  rejected: { label: 'Rejected',  variant: 'red'    as const },
  expired:  { label: 'Expired',   variant: 'gray'   as const },
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function DocumentsPage() {
  const { user } = useAuthStore();
  const { approveKYC, rejectKYC } = useUserStore();
  const { documents, addDocument, approveDocument, rejectDocument, deleteDocument, getDocsByOwner } = useDocumentStore();

  const isAdmin = user?.role === 'admin' || user?.role === 'property_manager';

  // Admin sees all docs; others see only their own
  const visibleDocs = isAdmin ? documents : getDocsByOwner(user?.id || '');

  const [activeCategory, setActiveCategory] = useState<DocCategory | 'all' | 'pending'>('all');
  const [searchQuery, setSearchQuery]       = useState('');
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [viewDoc, setViewDoc]               = useState<Document | null>(null);
  const [reviewDoc, setReviewDoc]           = useState<Document | null>(null);
  const [rejectNotes, setRejectNotes]       = useState('');
  const [approveNotes, setApproveNotes]     = useState('');
  const [reviewLoading, setReviewLoading]   = useState(false);
  const [uploadFiles, setUploadFiles]       = useState<UploadedFile[]>([]);
  const [uploadCategory, setUploadCategory] = useState<DocCategory>('kyc');
  const [uploadName, setUploadName]         = useState('');
  const [uploading, setUploading]           = useState(false);

  const filtered = visibleDocs.filter(d => {
    const matchCat = activeCategory === 'all' ? true
      : activeCategory === 'pending' ? d.status === 'pending'
      : d.category === activeCategory;
    const matchQ = !searchQuery || d.name.toLowerCase().includes(searchQuery.toLowerCase())
      || d.ownerName.toLowerCase().includes(searchQuery.toLowerCase());
    return matchCat && matchQ;
  });

  const pendingCount = visibleDocs.filter(d => d.status === 'pending').length;

  // ── Upload ────────────────────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!uploadName.trim()) { toast.error('Please enter a document name'); return; }
    if (uploadFiles.length === 0) { toast.error('Please select a file to upload'); return; }
    setUploading(true);
    await new Promise(r => setTimeout(r, 1200));
    addDocument({
      ownerId:   user?.id || '',
      ownerName: `${user?.firstName} ${user?.lastName}`,
      ownerRole: user?.role || '',
      name:      uploadName.trim(),
      category:  uploadCategory,
      fileUrl:   uploadFiles[0].dataUrl,
      fileType:  uploadFiles[0].file.type,
      fileSize:  uploadFiles[0].file.size,
    });
    setUploading(false);
    setShowUploadModal(false);
    setUploadFiles([]);
    setUploadName('');
    toast.success('Document uploaded! It will be reviewed by the admin shortly.');
  };

  // ── Admin: Approve ────────────────────────────────────────────────────────
  const handleApprove = async () => {
    if (!reviewDoc) return;
    setReviewLoading(true);
    await new Promise(r => setTimeout(r, 800));
    approveDocument(reviewDoc.id, `${user?.firstName} ${user?.lastName}`, approveNotes || undefined);
    // If it is a KYC doc, also update the user's KYC status
    if (reviewDoc.category === 'kyc') {
      approveKYC(reviewDoc.ownerId);
    }
    setReviewLoading(false);
    setReviewDoc(null);
    setApproveNotes('');
    toast.success(`Document approved! ${reviewDoc.ownerName} has been notified.`);
  };

  // ── Admin: Reject ─────────────────────────────────────────────────────────
  const handleReject = async () => {
    if (!reviewDoc) return;
    if (!rejectNotes.trim()) { toast.error('Please provide a reason for rejection'); return; }
    setReviewLoading(true);
    await new Promise(r => setTimeout(r, 800));
    rejectDocument(reviewDoc.id, `${user?.firstName} ${user?.lastName}`, rejectNotes.trim());
    if (reviewDoc.category === 'kyc') {
      rejectKYC(reviewDoc.ownerId);
    }
    setReviewLoading(false);
    setReviewDoc(null);
    setRejectNotes('');
    toast(`Document rejected. ${reviewDoc.ownerName} has been notified.`, { icon: '❌' });
  };

  const tabs = [
    { key: 'all'      as const, label: 'All',          count: visibleDocs.length },
    { key: 'pending'  as const, label: 'Pending Review', count: pendingCount },
    { key: 'kyc'      as const, label: 'KYC',           count: visibleDocs.filter(d => d.category === 'kyc').length },
    { key: 'lease'    as const, label: 'Lease',         count: visibleDocs.filter(d => d.category === 'lease').length },
    { key: 'ownership'as const, label: 'Ownership',     count: visibleDocs.filter(d => d.category === 'ownership').length },
    { key: 'other'    as const, label: 'Other',         count: visibleDocs.filter(d => d.category === 'other').length },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Documents</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isAdmin ? `${visibleDocs.length} total · ` : ''}{pendingCount} pending review
          </p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setShowUploadModal(true)}>
          Upload Document
        </Button>
      </div>

      {/* Pending alert */}
      <AnimatePresence>
        {pendingCount > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center justify-between gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl">
            <div className="flex items-center gap-3">
              <Clock size={18} className="text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-300">
                <strong>{pendingCount} document{pendingCount > 1 ? 's' : ''}</strong>{' '}
                {isAdmin ? 'awaiting your review.' : 'pending admin review. You\'ll be notified once approved.'}
              </p>
            </div>
            {isAdmin && (
              <Button size="sm" onClick={() => setActiveCategory('pending')}>Review Now</Button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-4 space-y-3">
        {/* Search (admin only) */}
        {isAdmin && (
          <div className="relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search by document name or user..."
              className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>
        )}
        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-700 rounded-xl p-1 overflow-x-auto">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveCategory(tab.key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${activeCategory === tab.key ? 'bg-white dark:bg-slate-600 shadow-sm text-slate-900 dark:text-slate-100' : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}>
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-semibold ${activeCategory === tab.key ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300' : 'bg-slate-200 dark:bg-slate-600 text-slate-500'}`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Document list */}
      {filtered.length === 0 ? (
        <EmptyState
          icon={<FileText size={28} />}
          title={activeCategory === 'pending' ? 'No pending documents' : 'No documents'}
          description={activeCategory === 'pending' ? 'All documents have been reviewed.' : 'Upload KYC documents, lease agreements, or other files.'}
          action={activeCategory !== 'pending' ? <Button icon={<Upload size={15} />} onClick={() => setShowUploadModal(true)}>Upload Document</Button> : undefined}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((doc, i) => {
            const catCfg    = categoryConfig[doc.category];
            const statusCfg = statusConfig[doc.status];
            const isExpired = doc.expiresAt && new Date(doc.expiresAt) < new Date();
            const isPending = doc.status === 'pending';

            return (
              <motion.div key={doc.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                className={`bg-white dark:bg-slate-800 rounded-2xl shadow-card border transition-all ${isPending && isAdmin ? 'border-amber-200 dark:border-amber-800' : 'border-slate-100 dark:border-slate-700'}`}>
                <div className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Category icon */}
                    <div className="w-10 h-10 bg-slate-100 dark:bg-slate-700 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className={catCfg.color}>{catCfg.icon}</span>
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{doc.name}</h3>
                          <div className="flex items-center gap-2 mt-1 flex-wrap text-xs text-slate-400">
                            <span>{catCfg.label}</span>
                            <span>·</span>
                            <span>{formatFileSize(doc.fileSize)}</span>
                            <span>·</span>
                            <span>Uploaded {formatDate(doc.uploadedAt)}</span>
                          </div>
                          {/* Admin: show who submitted */}
                          {isAdmin && (
                            <div className="flex items-center gap-2 mt-1.5">
                              <Avatar name={doc.ownerName} size="xs" />
                              <span className="text-xs text-slate-500">
                                {doc.ownerName}
                                <span className="text-slate-400"> · {roleLabels[doc.ownerRole] || doc.ownerRole}</span>
                              </span>
                            </div>
                          )}
                          {doc.expiresAt && (
                            <p className={`text-xs mt-1 ${isExpired ? 'text-red-500' : 'text-slate-400'}`}>
                              {isExpired ? '⚠️ Expired' : '📅 Expires'}: {formatDate(doc.expiresAt)}
                            </p>
                          )}
                          {/* Admin notes */}
                          {doc.adminNotes && (
                            <p className={`text-xs mt-1 italic ${doc.status === 'rejected' ? 'text-red-500' : 'text-slate-400'}`}>
                              {doc.status === 'rejected' ? '❌ ' : '✅ '}{doc.adminNotes}
                            </p>
                          )}
                          {doc.reviewedBy && (
                            <p className="text-xs text-slate-400 mt-0.5">
                              Reviewed by {doc.reviewedBy} · {doc.reviewedAt ? formatDate(doc.reviewedAt) : ''}
                            </p>
                          )}
                        </div>

                        {/* Status badge */}
                        <Badge variant={isExpired ? 'red' : statusCfg.variant}>
                          {isExpired ? 'Expired' : statusCfg.label}
                        </Badge>
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => setViewDoc(doc)}
                        className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-colors" title="View">
                        <Eye size={15} />
                      </button>
                      {doc.fileUrl && (
                        <button onClick={() => { const a = document.createElement('a'); a.href = doc.fileUrl; a.download = doc.name; a.click(); }}
                          className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600 transition-colors" title="Download">
                          <Download size={15} />
                        </button>
                      )}
                      {(isAdmin || doc.ownerId === user?.id) && (
                        <button onClick={() => { deleteDocument(doc.id); toast('Document removed'); }}
                          className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors" title="Delete">
                          <Trash2 size={15} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Admin review actions — only for pending docs */}
                  {isAdmin && isPending && (
                    <div className="mt-3 pt-3 border-t border-amber-100 dark:border-amber-900/30 flex items-center gap-2">
                      <span className="text-xs text-amber-600 dark:text-amber-400 flex-1">⏳ Awaiting your review</span>
                      <Button size="sm" icon={<CheckCircle2 size={13} />}
                        onClick={() => { setReviewDoc(doc); setApproveNotes(''); setRejectNotes(''); }}>
                        Review
                      </Button>
                    </div>
                  )}

                  {/* Status footer for non-pending */}
                  {doc.status === 'approved' && !isPending && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center gap-1.5 text-xs text-green-600 dark:text-green-400">
                      <CheckCircle2 size={12} /> Document verified and approved
                    </div>
                  )}
                  {doc.status === 'rejected' && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 flex items-center gap-1.5 text-xs text-red-500">
                      <AlertTriangle size={12} /> Rejected — please upload a corrected version
                    </div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* ── Upload Modal ──────────────────────────────────────────────────── */}
      <Modal open={showUploadModal} onClose={() => { setShowUploadModal(false); setUploadFiles([]); setUploadName(''); }}
        title="Upload Document" size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setShowUploadModal(false); setUploadFiles([]); setUploadName(''); }}>Cancel</Button>
            <Button loading={uploading} onClick={handleUpload} icon={<Upload size={14} />}>Upload</Button>
          </>
        }>
        <div className="space-y-4">
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
            <p className="text-xs text-blue-700 dark:text-blue-300">Accepted: PDF, JPG, PNG, DOCX. Max 10MB.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Category *</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(categoryConfig) as [DocCategory, typeof categoryConfig[DocCategory]][]).map(([key, cfg]) => (
                <button key={key} type="button" onClick={() => setUploadCategory(key)}
                  className={`flex items-center gap-2 p-3 rounded-xl border-2 text-left transition-all ${uploadCategory === key ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-600 hover:border-slate-300'}`}>
                  <span className={cfg.color}>{cfg.icon}</span>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{cfg.label}</span>
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Document Name *</label>
            <input type="text" placeholder="e.g. National ID Front, Lease Agreement..."
              value={uploadName} onChange={e => setUploadName(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
          </div>
          <FileUpload accept="image/*,.pdf,.doc,.docx" multiple={false} maxFiles={1} maxSizeMB={10}
            value={uploadFiles} onChange={setUploadFiles} showCamera />
        </div>
      </Modal>

      {/* ── View Document Modal ───────────────────────────────────────────── */}
      <Modal open={!!viewDoc} onClose={() => setViewDoc(null)} title={viewDoc?.name || 'Document'} size="md"
        footer={<Button variant="secondary" onClick={() => setViewDoc(null)}>Close</Button>}>
        {viewDoc && (
          <div className="space-y-4">
            <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 space-y-2.5 text-sm">
              {[
                { label: 'Name',      value: viewDoc.name },
                { label: 'Submitted by', value: `${viewDoc.ownerName} (${roleLabels[viewDoc.ownerRole] || viewDoc.ownerRole})` },
                { label: 'Category',  value: categoryConfig[viewDoc.category].label },
                { label: 'Status',    value: statusConfig[viewDoc.status].label },
                { label: 'File Type', value: viewDoc.fileType },
                { label: 'File Size', value: formatFileSize(viewDoc.fileSize) },
                { label: 'Uploaded',  value: formatDate(viewDoc.uploadedAt) },
                ...(viewDoc.expiresAt ? [{ label: 'Expires', value: formatDate(viewDoc.expiresAt) }] : []),
                ...(viewDoc.reviewedBy ? [{ label: 'Reviewed by', value: `${viewDoc.reviewedBy} · ${viewDoc.reviewedAt ? formatDate(viewDoc.reviewedAt) : ''}` }] : []),
                ...(viewDoc.adminNotes ? [{ label: 'Admin Notes', value: viewDoc.adminNotes }] : []),
              ].map(row => (
                <div key={row.label} className="flex justify-between gap-4">
                  <span className="text-slate-500 flex-shrink-0">{row.label}</span>
                  <span className="font-semibold text-slate-900 dark:text-slate-100 text-right">{row.value}</span>
                </div>
              ))}
            </div>
            {viewDoc.fileUrl && viewDoc.fileType.startsWith('image/') && (
              <img src={viewDoc.fileUrl} alt={viewDoc.name} className="w-full rounded-xl border border-slate-200 dark:border-slate-600" />
            )}
            {viewDoc.fileUrl && (
              <Button variant="secondary" className="w-full" icon={<Download size={15} />}
                onClick={() => { const a = document.createElement('a'); a.href = viewDoc.fileUrl; a.download = viewDoc.name; a.click(); }}>
                Download Document
              </Button>
            )}
          </div>
        )}
      </Modal>

      {/* ── Admin Review Modal ────────────────────────────────────────────── */}
      <Modal open={!!reviewDoc} onClose={() => { setReviewDoc(null); setRejectNotes(''); setApproveNotes(''); }}
        title="Review Document" size="md"
        footer={
          <div className="flex gap-2 w-full">
            <Button variant="secondary" onClick={() => { setReviewDoc(null); setRejectNotes(''); setApproveNotes(''); }} className="flex-1">
              Cancel
            </Button>
            <Button variant="danger" loading={reviewLoading} icon={<XCircle size={14} />}
              onClick={handleReject} disabled={!rejectNotes.trim()} className="flex-1">
              Reject
            </Button>
            <Button loading={reviewLoading} icon={<CheckCircle2 size={14} />}
              onClick={handleApprove} className="flex-1">
              Approve
            </Button>
          </div>
        }>
        {reviewDoc && (
          <div className="space-y-4">
            {/* Document summary */}
            <div className="flex items-start gap-3 p-4 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
              <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center flex-shrink-0 border border-slate-200 dark:border-slate-600">
                <span className={categoryConfig[reviewDoc.category].color}>{categoryConfig[reviewDoc.category].icon}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{reviewDoc.name}</p>
                <p className="text-xs text-slate-400 mt-0.5">{categoryConfig[reviewDoc.category].label} · {formatFileSize(reviewDoc.fileSize)}</p>
                <div className="flex items-center gap-2 mt-1.5">
                  <Avatar name={reviewDoc.ownerName} size="xs" />
                  <span className="text-xs text-slate-500">
                    {reviewDoc.ownerName} · {roleLabels[reviewDoc.ownerRole] || reviewDoc.ownerRole}
                  </span>
                </div>
              </div>
            </div>

            {/* Preview if image */}
            {reviewDoc.fileUrl && reviewDoc.fileType.startsWith('image/') && (
              <img src={reviewDoc.fileUrl} alt={reviewDoc.name} className="w-full rounded-xl border border-slate-200 dark:border-slate-600 max-h-48 object-contain bg-slate-100 dark:bg-slate-700" />
            )}

            {/* Approve note */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Approval Note (optional)
              </label>
              <input type="text" placeholder="e.g. Document verified and valid."
                value={approveNotes} onChange={e => setApproveNotes(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm" />
            </div>

            {/* Reject reason */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">
                Rejection Reason <span className="text-red-500">*</span> <span className="text-xs text-slate-400 font-normal">(required to reject)</span>
              </label>
              <Textarea placeholder="e.g. Document is blurry. Please upload a clearer scan."
                value={rejectNotes} onChange={e => setRejectNotes(e.target.value)} rows={3} />
            </div>

            {/* KYC note */}
            {reviewDoc.category === 'kyc' && (
              <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl">
                <Shield size={14} className="text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  This is a KYC document. Approving it will also update <strong>{reviewDoc.ownerName}</strong>'s KYC status to <strong>Approved</strong> and mark them as verified.
                  Rejecting will set their KYC status to <strong>Rejected</strong>.
                </p>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
