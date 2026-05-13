import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Bell, AlertTriangle, FileText, CheckCircle2, Clock, X,
  Send, ChevronDown, ChevronUp, Info, Home, RefreshCw,
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Modal } from '../components/ui/Modal';
import { Input, Select, Textarea } from '../components/ui/Input';
import { EmptyState } from '../components/ui/EmptyState';
import { Avatar } from '../components/ui/Avatar';
import { useAuthStore } from '../store/authStore';
import { useUserStore } from '../store/userStore';
import { useDataStore } from '../store/dataStore';
import { noticesApi } from '../lib/api';
import { apiSend } from '../lib/apiCall';
import { formatDate, timeAgo } from '../lib/utils';
import type { TenantNotice, NoticeType } from '../types';
import toast from 'react-hot-toast';

// ─── Notice type config ───────────────────────────────────────────────────────
const noticeTypeConfig: Record<NoticeType, {
  label: string;
  icon: React.ReactNode;
  color: string;
  iconBg: string;
  badgeVariant: 'red' | 'orange' | 'green' | 'blue' | 'yellow' | 'gray';
}> = {
  eviction: {
    label: 'Eviction Notice',
    icon: <AlertTriangle size={16} />,
    color: 'text-red-600',
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    badgeVariant: 'red',
  },
  rent_arrears: {
    label: 'Rent Arrears',
    icon: <AlertTriangle size={16} />,
    color: 'text-orange-600',
    iconBg: 'bg-orange-100 dark:bg-orange-900/30',
    badgeVariant: 'orange',
  },
  lease_renewal: {
    label: 'Lease Renewal',
    icon: <RefreshCw size={16} />,
    color: 'text-green-600',
    iconBg: 'bg-green-100 dark:bg-green-900/30',
    badgeVariant: 'green',
  },
  lease_termination: {
    label: 'Lease Termination',
    icon: <X size={16} />,
    color: 'text-red-600',
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    badgeVariant: 'red',
  },
  inspection_notice: {
    label: 'Inspection Notice',
    icon: <Home size={16} />,
    color: 'text-blue-600',
    iconBg: 'bg-blue-100 dark:bg-blue-900/30',
    badgeVariant: 'blue',
  },
  maintenance_notice: {
    label: 'Maintenance Notice',
    icon: <Info size={16} />,
    color: 'text-yellow-600',
    iconBg: 'bg-yellow-100 dark:bg-yellow-900/30',
    badgeVariant: 'yellow',
  },
  rent_increase: {
    label: 'Rent Increase',
    icon: <AlertTriangle size={16} />,
    color: 'text-orange-600',
    iconBg: 'bg-orange-100 dark:bg-orange-900/30',
    badgeVariant: 'orange',
  },
  general: {
    label: 'General Notice',
    icon: <Bell size={16} />,
    color: 'text-slate-600',
    iconBg: 'bg-slate-100 dark:bg-slate-700',
    badgeVariant: 'gray',
  },
};

// ─── Notice status config ─────────────────────────────────────────────────────
const noticeStatusConfig = {
  unread:       { label: 'Unread',       variant: 'yellow' as const },
  read:         { label: 'Read',         variant: 'gray'   as const },
  acknowledged: { label: 'Acknowledged', variant: 'green'  as const },
  disputed:     { label: 'Disputed',     variant: 'red'    as const },
};

// ─── Role label helper ────────────────────────────────────────────────────────
const roleLabels: Record<string, string> = {
  property_manager: 'Property Manager',
  landlord: 'Landlord',
  admin: 'Admin',
};

// ─── Dispute Modal ────────────────────────────────────────────────────────────
interface DisputeModalProps {
  open: boolean;
  onClose: () => void;
  notice: TenantNotice | null;
  onSubmit: (noticeId: string, response: string) => void;
}

function DisputeModal({ open, onClose, notice, onSubmit }: DisputeModalProps) {
  const [response, setResponse] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!notice || !response.trim()) {
      toast.error('Please provide your dispute reason');
      return;
    }
    setLoading(true);
    onSubmit(notice.id, response.trim());
    setResponse('');
    setLoading(false);
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Dispute Notice"
      size="md"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            variant="danger"
            loading={loading}
            icon={<Send size={14} />}
            onClick={handleSubmit}
            disabled={!response.trim()}
          >
            Submit Dispute
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {notice && (
          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
            <p className="text-xs text-slate-500 mb-1">Disputing notice:</p>
            <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{notice.subject}</p>
            <p className="text-xs text-slate-400 mt-0.5">Issued by {notice.issuedBy} · {timeAgo(notice.createdAt)}</p>
          </div>
        )}
        <Textarea
          label="Your dispute reason"
          placeholder="Explain why you are disputing this notice. Be specific and include any relevant details or evidence..."
          value={response}
          onChange={e => setResponse(e.target.value)}
          rows={5}
        />
        <div className="flex items-start gap-2.5 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
          <Info size={14} className="text-amber-600 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-700 dark:text-amber-400">
            Your dispute will be reviewed by the property manager or landlord. You will be notified of the outcome.
          </p>
        </div>
      </div>
    </Modal>
  );
}

// ─── Compose Notice Modal ─────────────────────────────────────────────────────
interface ComposeModalProps {
  open: boolean;
  onClose: () => void;
  onSend: (notice: Omit<TenantNotice, 'id' | 'status' | 'createdAt'>) => void;
}


function ComposeModal({ open, onClose, onSend }: ComposeModalProps) {
  const { user } = useAuthStore();
  const { users } = useUserStore();
  const tenants = users.filter(u => u.role === 'tenant').map(u => ({
    id: u.id,
    name: `${u.firstName} ${u.lastName}`,
    property: 'Property',
  }));
  const effectiveTenants = tenants.length > 0 ? tenants : [
    { id: 'u4', name: 'Grace Apio', property: '1-Bedroom Apartment in Entebbe' },
  ];
  const [tenantId, setTenantId] = useState(effectiveTenants[0]?.id || 'u4');
  const [noticeType, setNoticeType] = useState<NoticeType>('general');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('');
  const [responseDeadline, setResponseDeadline] = useState('');
  const [requiresAck, setRequiresAck] = useState(false);
  const [loading, setLoading] = useState(false);

  const selectedTenant = effectiveTenants.find(t => t.id === tenantId) || effectiveTenants[0];

  const handleSend = async () => {
    if (!subject.trim() || !body.trim()) {
      toast.error('Subject and body are required');
      return;
    }
    setLoading(true);
    onSend({
      propertyId: 'p6',
      propertyTitle: selectedTenant.property,
      tenantId: selectedTenant.id,
      tenantName: selectedTenant.name,
      issuedBy: user ? `${user.firstName} ${user.lastName}` : 'Manager',
      issuedByRole: (user?.role as 'property_manager' | 'landlord' | 'admin') || 'property_manager',
      type: noticeType,
      subject: subject.trim(),
      body: body.trim(),
      effectiveDate: effectiveDate || undefined,
      responseDeadline: responseDeadline || undefined,
      requiresAcknowledgement: requiresAck,
    });
    setLoading(false);
    // Reset
    setSubject('');
    setBody('');
    setEffectiveDate('');
    setResponseDeadline('');
    setRequiresAck(false);
    setNoticeType('general');
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Send Notice to Tenant"
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button
            loading={loading}
            icon={<Send size={14} />}
            onClick={handleSend}
            disabled={!subject.trim() || !body.trim()}
          >
            Send Notice
          </Button>
        </>
      }
    >
      <div className="space-y-5">
        {/* Tenant selector */}
        <Select
          label="Send to Tenant"
          value={tenantId}
          onChange={e => setTenantId(e.target.value)}
          options={effectiveTenants.map(t => ({ value: t.id, label: `${t.name} — ${t.property}` }))}
        />

        {/* Notice type */}
        <Select
          label="Notice Type"
          value={noticeType}
          onChange={e => setNoticeType(e.target.value as NoticeType)}
          options={Object.entries(noticeTypeConfig).map(([value, cfg]) => ({
            value,
            label: cfg.label,
          }))}
        />

        {/* Subject */}
        <Input
          label="Subject"
          placeholder="e.g. Overdue Rent — April 2024"
          value={subject}
          onChange={e => setSubject(e.target.value)}
          icon={<FileText size={14} />}
        />

        {/* Body */}
        <Textarea
          label="Notice Body"
          placeholder="Write the full notice text here..."
          value={body}
          onChange={e => setBody(e.target.value)}
          rows={6}
        />

        {/* Dates */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Effective Date (optional)"
            type="date"
            value={effectiveDate}
            onChange={e => setEffectiveDate(e.target.value)}
          />
          <Input
            label="Response Deadline (optional)"
            type="date"
            value={responseDeadline}
            onChange={e => setResponseDeadline(e.target.value)}
          />
        </div>

        {/* Requires acknowledgement */}
        <label className="flex items-center gap-3 cursor-pointer select-none">
          <div
            onClick={() => setRequiresAck(v => !v)}
            className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all ${
              requiresAck
                ? 'bg-primary-600 border-primary-600'
                : 'border-slate-300 dark:border-slate-600'
            }`}
          >
            {requiresAck && <CheckCircle2 size={12} className="text-white" />}
          </div>
          <div>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-300">Requires Acknowledgement</p>
            <p className="text-xs text-slate-400">Tenant must acknowledge receipt of this notice</p>
          </div>
        </label>

        {/* Preview badge */}
        <div className="flex items-center gap-2 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${noticeTypeConfig[noticeType].iconBg}`}>
            <span className={noticeTypeConfig[noticeType].color}>
              {noticeTypeConfig[noticeType].icon}
            </span>
          </div>
          <div>
            <p className="text-xs text-slate-500">Preview type</p>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{noticeTypeConfig[noticeType].label}</p>
          </div>
        </div>
      </div>
    </Modal>
  );
}

// ─── Notice Card (Tenant view) ────────────────────────────────────────────────
interface NoticeCardProps {
  notice: TenantNotice;
  onMarkRead: (id: string) => void;
  onAcknowledge: (id: string) => void;
  onDispute: (notice: TenantNotice) => void;
  index: number;
}

function NoticeCard({ notice, onMarkRead, onAcknowledge, onDispute, index }: NoticeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const cfg = noticeTypeConfig[notice.type];
  const statusCfg = noticeStatusConfig[notice.status];
  const isUnread = notice.status === 'unread';
  const canAcknowledge = notice.requiresAcknowledgement && notice.status === 'read';
  const canDispute = notice.status !== 'disputed' && notice.status !== 'acknowledged';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className={`bg-white dark:bg-slate-800 rounded-2xl shadow-card border transition-all ${
        isUnread
          ? 'border-primary-200 dark:border-primary-800'
          : 'border-slate-100 dark:border-slate-700'
      }`}
    >
      {/* Card header */}
      <div className="p-5">
        <div className="flex items-start gap-4">
          {/* Type icon */}
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.iconBg}`}>
            <span className={cfg.color}>{cfg.icon}</span>
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-tight">
                  {notice.subject}
                </h3>
                {isUnread && (
                  <span className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0 mt-0.5" />
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
                {notice.requiresAcknowledgement && notice.status !== 'acknowledged' && notice.status !== 'disputed' && (
                  <Badge variant="orange">Requires Action</Badge>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Avatar name={notice.issuedBy} size="xs" />
              <span className="text-xs text-slate-500">
                {notice.issuedBy}
                <span className="text-slate-400"> · {roleLabels[notice.issuedByRole] || notice.issuedByRole}</span>
              </span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className="text-xs text-slate-400">{timeAgo(notice.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Expand/collapse toggle */}
      <button
        onClick={() => {
          setExpanded(v => !v);
          if (isUnread) onMarkRead(notice.id);
        }}
        className="w-full flex items-center justify-between px-5 py-2.5 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        <span>{expanded ? 'Hide details' : 'View full notice'}</span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {/* Expanded body */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4">
              {/* Body text */}
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                  {notice.body}
                </p>
              </div>

              {/* Dates */}
              {(notice.effectiveDate || notice.responseDeadline) && (
                <div className="grid grid-cols-2 gap-3">
                  {notice.effectiveDate && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
                      <p className="text-xs text-blue-500 font-medium mb-0.5">Effective Date</p>
                      <p className="text-sm font-bold text-blue-700 dark:text-blue-300">
                        {formatDate(notice.effectiveDate)}
                      </p>
                    </div>
                  )}
                  {notice.responseDeadline && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
                      <p className="text-xs text-amber-500 font-medium mb-0.5">Response Deadline</p>
                      <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
                        {formatDate(notice.responseDeadline)}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Tenant response (if disputed) */}
              {notice.tenantResponse && (
                <div className="border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
                  <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1.5">Your Dispute Response</p>
                  <p className="text-sm text-red-700 dark:text-red-300 whitespace-pre-line">{notice.tenantResponse}</p>
                </div>
              )}

              {/* Action buttons */}
              <div className="flex items-center gap-2 flex-wrap pt-1">
                {notice.status === 'unread' && (
                  <Button
                    size="sm"
                    variant="secondary"
                    icon={<CheckCircle2 size={13} />}
                    onClick={() => onMarkRead(notice.id)}
                  >
                    Mark as Read
                  </Button>
                )}
                {canAcknowledge && (
                  <Button
                    size="sm"
                    variant="primary"
                    icon={<CheckCircle2 size={13} />}
                    onClick={() => onAcknowledge(notice.id)}
                  >
                    Acknowledge
                  </Button>
                )}
                {canDispute && (
                  <Button
                    size="sm"
                    variant="danger"
                    icon={<AlertTriangle size={13} />}
                    onClick={() => onDispute(notice)}
                  >
                    Dispute
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Sent Notice Card (Manager/Landlord view) ─────────────────────────────────
interface SentNoticeCardProps {
  notice: TenantNotice;
  index: number;
}

function SentNoticeCard({ notice, index }: SentNoticeCardProps) {
  const [expanded, setExpanded] = useState(false);
  const cfg = noticeTypeConfig[notice.type];
  const statusCfg = noticeStatusConfig[notice.status];

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700"
    >
      <div className="p-5">
        <div className="flex items-start gap-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${cfg.iconBg}`}>
            <span className={cfg.color}>{cfg.icon}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm leading-tight">
                {notice.subject}
              </h3>
              <div className="flex items-center gap-2 flex-shrink-0">
                <Badge variant={cfg.badgeVariant}>{cfg.label}</Badge>
                <Badge variant={statusCfg.variant}>{statusCfg.label}</Badge>
              </div>
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <Avatar name={notice.tenantName} size="xs" />
              <span className="text-xs text-slate-500">
                To: <span className="font-medium">{notice.tenantName}</span>
              </span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className="text-xs text-slate-400">{notice.propertyTitle}</span>
              <span className="text-slate-300 dark:text-slate-600">·</span>
              <span className="text-xs text-slate-400">{timeAgo(notice.createdAt)}</span>
            </div>
          </div>
        </div>
      </div>

      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-5 py-2.5 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors"
      >
        <span>{expanded ? 'Hide details' : 'View notice'}</span>
        {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4">
              <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4">
                <p className="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                  {notice.body}
                </p>
              </div>
              {(notice.effectiveDate || notice.responseDeadline) && (
                <div className="grid grid-cols-2 gap-3">
                  {notice.effectiveDate && (
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3">
                      <p className="text-xs text-blue-500 font-medium mb-0.5">Effective Date</p>
                      <p className="text-sm font-bold text-blue-700 dark:text-blue-300">
                        {formatDate(notice.effectiveDate)}
                      </p>
                    </div>
                  )}
                  {notice.responseDeadline && (
                    <div className="bg-amber-50 dark:bg-amber-900/20 rounded-xl p-3">
                      <p className="text-xs text-amber-500 font-medium mb-0.5">Response Deadline</p>
                      <p className="text-sm font-bold text-amber-700 dark:text-amber-300">
                        {formatDate(notice.responseDeadline)}
                      </p>
                    </div>
                  )}
                </div>
              )}
              {notice.tenantResponse && (
                <div className="border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20 rounded-xl p-4">
                  <p className="text-xs font-semibold text-red-600 dark:text-red-400 mb-1.5">
                    Tenant Dispute Response
                  </p>
                  <p className="text-sm text-red-700 dark:text-red-300 whitespace-pre-line">
                    {notice.tenantResponse}
                  </p>
                </div>
              )}
              <div className="flex items-center gap-3 text-xs text-slate-400 pt-1">
                {notice.requiresAcknowledgement && (
                  <span className="flex items-center gap-1">
                    <Clock size={11} />
                    Requires acknowledgement
                  </span>
                )}
                {notice.acknowledgedAt && (
                  <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                    <CheckCircle2 size={11} />
                    Acknowledged {timeAgo(notice.acknowledgedAt)}
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function NoticesPage() {
  const { user } = useAuthStore();
  const isTenant = user?.role === 'tenant';
  const isManager = user?.role === 'property_manager' || user?.role === 'landlord' || user?.role === 'admin';
  const { notices: allNotices } = useDataStore();

  // Tenant state — only show notices addressed to this tenant
  const [notices, setNotices] = useState<TenantNotice[]>(
    allNotices.filter(n => n.tenantId === user?.id || user?.role === 'admin')
  );
  const [activeTab, setActiveTab] = useState<'all' | 'unread' | 'action'>('all');
  const [disputeNotice, setDisputeNotice] = useState<TenantNotice | null>(null);
  const [showDisputeModal, setShowDisputeModal] = useState(false);

  // Manager state
  const [showComposeModal, setShowComposeModal] = useState(false);
  const [sentNotices, setSentNotices] = useState<TenantNotice[]>(allNotices);

  // ── Tenant handlers ──────────────────────────────────────────────────────
  const handleMarkRead = (id: string) => {
    setNotices(prev =>
      prev.map(n => n.id === id && n.status === 'unread'
        ? { ...n, status: 'read', readAt: new Date().toISOString() } : n
      )
    );
    apiSend(() => noticesApi.markRead(id));
  };

  const handleAcknowledge = (id: string) => {
    setNotices(prev =>
      prev.map(n => n.id === id
        ? { ...n, status: 'acknowledged', acknowledgedAt: new Date().toISOString() } : n
      )
    );
    apiSend(() => noticesApi.acknowledge(id));
    toast.success('Notice acknowledged');
  };

  const handleOpenDispute = (notice: TenantNotice) => {
    setDisputeNotice(notice);
    setShowDisputeModal(true);
  };

  const handleSubmitDispute = (noticeId: string, response: string) => {
    setNotices(prev =>
      prev.map(n => n.id === noticeId
        ? { ...n, status: 'disputed', tenantResponse: response } : n
      )
    );
    toast.success('Dispute submitted. The manager will review your response.');
  };

  // ── Manager handlers ─────────────────────────────────────────────────────
  const handleSendNotice = async (notice: Omit<TenantNotice, 'id' | 'status' | 'createdAt'>) => {
    try {
      const res = await noticesApi.send(notice);
      const saved = (res.data as { data: TenantNotice }).data;
      setSentNotices(prev => [saved, ...prev]);
      toast.success(`Notice sent to ${notice.tenantName}`);
    } catch {
      // Offline — add locally
      const newNotice: TenantNotice = {
        ...notice, id: `tn${Date.now()}`, status: 'unread', createdAt: new Date().toISOString(),
      };
      setSentNotices(prev => [newNotice, ...prev]);
      toast.success(`Notice saved (will sync when online)`);
    }
  };

  // ── Filtered notices (tenant) ────────────────────────────────────────────
  const unreadCount = notices.filter(n => n.status === 'unread').length;
  const actionCount = notices.filter(n => n.requiresAcknowledgement && n.status !== 'acknowledged' && n.status !== 'disputed').length;

  const filteredNotices = notices.filter(n => {
    if (activeTab === 'unread') return n.status === 'unread';
    if (activeTab === 'action') return n.requiresAcknowledgement && n.status !== 'acknowledged' && n.status !== 'disputed';
    return true;
  });

  const tabs = [
    { key: 'all',    label: 'All',             count: notices.length },
    { key: 'unread', label: 'Unread',           count: unreadCount },
    { key: 'action', label: 'Requires Action',  count: actionCount },
  ] as const;

  // ── Tenant View ──────────────────────────────────────────────────────────
  if (isTenant) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Notices</h1>
            <p className="text-sm text-slate-500 mt-0.5">Official notices from your property manager or landlord</p>
          </div>
          {unreadCount > 0 && (
            <Badge variant="yellow" dot>{unreadCount} unread</Badge>
          )}
        </div>

        {/* Tab bar */}
        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === tab.key
                  ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-slate-100 shadow-sm'
                  : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full font-bold ${
                  activeTab === tab.key
                    ? 'bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300'
                    : 'bg-slate-200 dark:bg-slate-700 text-slate-500'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Notice list */}
        {filteredNotices.length === 0 ? (
          <EmptyState
            icon={<Bell size={28} />}
            title={activeTab === 'unread' ? 'No unread notices' : activeTab === 'action' ? 'No action required' : 'No notices yet'}
            description={
              activeTab === 'unread'
                ? "You're all caught up!"
                : activeTab === 'action'
                ? 'All notices have been acknowledged or resolved.'
                : 'Official notices from your property manager will appear here.'
            }
          />
        ) : (
          <div className="space-y-4">
            {filteredNotices.map((notice, i) => (
              <NoticeCard
                key={notice.id}
                notice={notice}
                index={i}
                onMarkRead={handleMarkRead}
                onAcknowledge={handleAcknowledge}
                onDispute={handleOpenDispute}
              />
            ))}
          </div>
        )}

        {/* Dispute modal */}
        <DisputeModal
          open={showDisputeModal}
          onClose={() => { setShowDisputeModal(false); setDisputeNotice(null); }}
          notice={disputeNotice}
          onSubmit={handleSubmitDispute}
        />
      </div>
    );
  }

  // ── Manager / Landlord / Admin View ─────────────────────────────────────
  if (isManager) {
    return (
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Notices</h1>
            <p className="text-sm text-slate-500 mt-0.5">Send and manage official notices to tenants</p>
          </div>
          <Button icon={<Send size={15} />} onClick={() => setShowComposeModal(true)}>
            Send Notice
          </Button>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Total Sent',     value: sentNotices.length,                                                                                  color: 'text-blue-600',   bg: 'bg-blue-100 dark:bg-blue-900/30',   icon: <FileText size={18} className="text-blue-600" /> },
            { label: 'Unread',         value: sentNotices.filter(n => n.status === 'unread').length,                                               color: 'text-yellow-600', bg: 'bg-yellow-100 dark:bg-yellow-900/30', icon: <Bell size={18} className="text-yellow-600" /> },
            { label: 'Acknowledged',   value: sentNotices.filter(n => n.status === 'acknowledged').length,                                         color: 'text-green-600',  bg: 'bg-green-100 dark:bg-green-900/30',  icon: <CheckCircle2 size={18} className="text-green-600" /> },
            { label: 'Disputed',       value: sentNotices.filter(n => n.status === 'disputed').length,                                             color: 'text-red-600',    bg: 'bg-red-100 dark:bg-red-900/30',      icon: <AlertTriangle size={18} className="text-red-600" /> },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.07 }}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-4 flex items-center gap-3"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${stat.bg}`}>
                {stat.icon}
              </div>
              <div>
                <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-slate-500">{stat.label}</p>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Sent notices history */}
        <div>
          <h2 className="font-bold text-slate-900 dark:text-slate-100 text-base mb-3">Sent Notices</h2>
          {sentNotices.length === 0 ? (
            <EmptyState
              icon={<Send size={28} />}
              title="No notices sent yet"
              description="Use the Send Notice button to compose and send official notices to your tenants."
              action={
                <Button icon={<Send size={14} />} onClick={() => setShowComposeModal(true)}>
                  Send First Notice
                </Button>
              }
            />
          ) : (
            <div className="space-y-4">
              {sentNotices.map((notice, i) => (
                <SentNoticeCard key={notice.id} notice={notice} index={i} />
              ))}
            </div>
          )}
        </div>

        {/* Compose modal */}
        <ComposeModal
          open={showComposeModal}
          onClose={() => setShowComposeModal(false)}
          onSend={handleSendNotice}
        />
      </div>
    );
  }

  // Fallback for other roles
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Notices</h1>
        <p className="text-sm text-slate-500 mt-0.5">Official notices and communications</p>
      </div>
      <EmptyState
        icon={<Bell size={28} />}
        title="No notices available"
        description="Notices relevant to your role will appear here."
      />
    </div>
  );
}
