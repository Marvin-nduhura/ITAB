import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, Ban, CheckCircle2, Plus, UserX, UserCheck, AlertTriangle, X, Mail, Send, Copy, Link } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { Avatar } from '../components/ui/Avatar';
import { Modal } from '../components/ui/Modal';
import { Input, Select, Textarea } from '../components/ui/Input';
import { useUserStore } from '../store/userStore';
import { useAuthStore } from '../store/authStore';
import { roleLabels, formatDate, generateId } from '../lib/utils';
import { isAdmin } from '../lib/rbac';
import toast from 'react-hot-toast';
import type { User, UserRole } from '../types';

export function UsersPage() {
  const { users, suspendUser, unsuspendUser, approveKYC, rejectKYC } = useUserStore();
  const { user } = useAuthStore();

  // Hard guard — only admin can manage users
  if (!isAdmin(user)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-3">
        <div className="w-16 h-16 bg-red-100 dark:bg-red-900/30 rounded-2xl flex items-center justify-center text-3xl">🚫</div>
        <p className="font-semibold text-slate-700 dark:text-slate-300">Access Denied</p>
        <p className="text-sm text-slate-400">Only administrators can manage users.</p>
      </div>
    );
  }
  const [search, setSearch] = useState('');
  const [filterRole, setFilterRole] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  // Suspend modal state
  const [suspendTarget, setSuspendTarget] = useState<User | null>(null);
  const [suspendReason, setSuspendReason] = useState('');
  const [suspendLoading, setSuspendLoading] = useState(false);

  // Invite modal state
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteForm, setInviteForm] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    role: 'tenant' as UserRole,
    message: '',
  });
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [inviteSent, setInviteSent] = useState(false);

  const filtered = users.filter(u => {
    const q = search.toLowerCase();
    const matchQ = !q || `${u.firstName} ${u.lastName} ${u.email}`.toLowerCase().includes(q);
    const matchRole = !filterRole || u.role === filterRole;
    const matchStatus = !filterStatus
      || (filterStatus === 'suspended' && u.isSuspended)
      || (filterStatus === 'active' && !u.isSuspended)
      || (filterStatus === 'pending_kyc' && u.kycStatus === 'submitted');
    return matchQ && matchRole && matchStatus;
  });

  const suspendedCount = users.filter(u => u.isSuspended).length;
  const pendingKYCCount = users.filter(u => u.kycStatus === 'submitted').length;

  const roleVariant = (role: string): 'red' | 'purple' | 'blue' | 'green' | 'yellow' | 'gray' => {
    const m: Record<string, 'red' | 'purple' | 'blue' | 'green' | 'yellow' | 'gray'> = {
      admin: 'red', property_manager: 'purple', landlord: 'blue', tenant: 'green', agent: 'yellow', vendor: 'orange' as 'yellow',
    };
    return m[role] || 'gray';
  };

  const handleSuspend = async () => {
    if (!suspendTarget) return;
    if (!suspendReason.trim()) { toast.error('Please provide a reason for suspension'); return; }
    setSuspendLoading(true);
    await new Promise(r => setTimeout(r, 600));
    suspendUser(suspendTarget.id, suspendReason.trim());
    setSuspendLoading(false);
    setSuspendTarget(null);
    setSuspendReason('');
    toast.success(`${suspendTarget.firstName} ${suspendTarget.lastName} has been suspended. They will not be able to log in.`);
  };

  const handleUnsuspend = async (u: User) => {
    await new Promise(r => setTimeout(r, 400));
    unsuspendUser(u.id);
    toast.success(`${u.firstName} ${u.lastName}'s account has been reactivated.`);
  };

  const handleApproveKYC = (u: User) => {
    approveKYC(u.id);
    toast.success(`${u.firstName}'s KYC approved! They are now verified.`);
  };

  const handleRejectKYC = (u: User) => {
    rejectKYC(u.id);
    toast(`${u.firstName}'s KYC rejected.`, { icon: '❌' });
  };

  // ── Invite handlers ──────────────────────────────────────────────────────
  const generateInviteLink = () => {
    const token = generateId();
    const base = window.location.origin;
    const params = new URLSearchParams({
      invite: token,
      role: inviteForm.role,
      email: inviteForm.email,
      firstName: inviteForm.firstName,
      lastName: inviteForm.lastName,
    });
    return `${base}/register?${params.toString()}`;
  };

  const handleSendInvite = async () => {
    if (!inviteForm.email.trim()) { toast.error('Email address is required'); return; }
    if (!inviteForm.firstName.trim()) { toast.error('First name is required'); return; }
    setInviteLoading(true);
    await new Promise(r => setTimeout(r, 1000));

    const link = generateInviteLink();
    setInviteLink(link);
    setInviteSent(true);
    setInviteLoading(false);

    // In production: send email via API. For now show the link.
    toast.success(`Invitation prepared for ${inviteForm.email}!`);
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(inviteLink);
    toast.success('Invite link copied to clipboard!');
  };

  const handleShareViaEmail = () => {
    const subject = encodeURIComponent('You are invited to join ITAB Property Services');
    const body = encodeURIComponent(
      `Hello ${inviteForm.firstName},\n\n` +
      `You have been invited to join ITAB Property Services as a ${roleLabels[inviteForm.role]}.\n\n` +
      (inviteForm.message ? `Message from admin:\n${inviteForm.message}\n\n` : '') +
      `Click the link below to create your account:\n${inviteLink}\n\n` +
      `This link will pre-fill your registration details.\n\n` +
      `Best regards,\nITAB Property Services`
    );
    window.open(`mailto:${inviteForm.email}?subject=${subject}&body=${body}`);
  };

  const handleShareViaWhatsApp = () => {
    const text = encodeURIComponent(
      `Hello ${inviteForm.firstName}! You've been invited to join ITAB Property Services as a ${roleLabels[inviteForm.role]}. ` +
      `Click here to create your account: ${inviteLink}`
    );
    window.open(`https://wa.me/?text=${text}`);
  };

  const resetInviteModal = () => {
    setShowInviteModal(false);
    setInviteForm({ firstName: '', lastName: '', email: '', phone: '', role: 'tenant', message: '' });
    setInviteLink('');
    setInviteSent(false);
  };

  const SUSPEND_REASONS = [
    'Fraudulent activity detected',
    'Multiple payment failures',
    'Violation of terms of service',
    'Suspicious account behaviour',
    'Reported by another user',
    'Non-payment of outstanding fees',
    'Other (specify below)',
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Users</h1>
          <p className="text-sm text-slate-500 mt-0.5">{users.length} total · {suspendedCount} suspended · {pendingKYCCount} pending KYC</p>
        </div>
        <Button icon={<Plus size={16} />} onClick={() => setShowInviteModal(true)}>Invite User</Button>
      </div>

      {/* Alert for pending KYC */}
      <AnimatePresence>
        {pendingKYCCount > 0 && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl">
            <AlertTriangle size={18} className="text-amber-600 flex-shrink-0" />
            <p className="text-sm text-amber-700 dark:text-amber-300">
              <strong>{pendingKYCCount} user{pendingKYCCount > 1 ? 's' : ''}</strong> submitted KYC documents awaiting your review.
            </p>
            <Button size="sm" variant="secondary" className="ml-auto" onClick={() => setFilterStatus('pending_kyc')}>
              Review Now
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-4">
        <div className="flex gap-3 flex-wrap">
          <div className="flex-1 min-w-48">
            <Input placeholder="Search by name or email..." icon={<Search size={15} />} value={search} onChange={e => setSearch(e.target.value)} />
          </div>
          <Select value={filterRole} onChange={e => setFilterRole(e.target.value)}
            options={[{ value: '', label: 'All Roles' }, { value: 'admin', label: 'Admin' }, { value: 'property_manager', label: 'Property Manager' }, { value: 'landlord', label: 'Landlord' }, { value: 'tenant', label: 'Tenant' }, { value: 'agent', label: 'Agent' }, { value: 'vendor', label: 'Vendor' }]} />
          <Select value={filterStatus} onChange={e => setFilterStatus(e.target.value)}
            options={[{ value: '', label: 'All Status' }, { value: 'active', label: 'Active' }, { value: 'suspended', label: 'Suspended' }, { value: 'pending_kyc', label: 'Pending KYC' }]} />
          {(search || filterRole || filterStatus) && (
            <Button variant="ghost" size="sm" icon={<X size={14} />} onClick={() => { setSearch(''); setFilterRole(''); setFilterStatus(''); }}>
              Clear
            </Button>
          )}
        </div>
        <p className="text-xs text-slate-400 mt-2">{filtered.length} of {users.length} users</p>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50">
                {['User', 'Role', 'Phone', 'KYC', 'Status', 'Joined', 'Actions'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {filtered.map((u, i) => (
                <motion.tr key={u.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}
                  className={`hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${u.isSuspended ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar name={`${u.firstName} ${u.lastName}`} src={u.avatar} size="sm" />
                        {u.isSuspended && (
                          <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 bg-red-500 rounded-full border-2 border-white dark:border-slate-800 flex items-center justify-center">
                            <Ban size={8} className="text-white" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-slate-100">{u.firstName} {u.lastName}</p>
                        <p className="text-xs text-slate-400">{u.email}</p>
                        {u.isSuspended && u.suspendedReason && (
                          <p className="text-xs text-red-500 mt-0.5 max-w-[180px] truncate">🚫 {u.suspendedReason}</p>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3"><Badge variant={roleVariant(u.role)}>{roleLabels[u.role] || u.role}</Badge></td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{u.phone || '—'}</td>
                  <td className="px-4 py-3">
                    <Badge variant={u.kycStatus === 'approved' ? 'green' : u.kycStatus === 'rejected' ? 'red' : u.kycStatus === 'submitted' ? 'yellow' : 'gray'}>
                      {u.kycStatus}
                    </Badge>
                  </td>
                  <td className="px-4 py-3">
                    {u.isSuspended
                      ? <Badge variant="red" dot>Suspended</Badge>
                      : u.isVerified
                        ? <Badge variant="green" dot>Active</Badge>
                        : <Badge variant="gray" dot>Unverified</Badge>}
                  </td>
                  <td className="px-4 py-3 text-slate-400 text-xs whitespace-nowrap">{formatDate(u.createdAt)}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5 flex-wrap">
                      {/* KYC actions */}
                      {u.kycStatus === 'submitted' && (
                        <>
                          <Button size="sm" icon={<CheckCircle2 size={12} />} onClick={() => handleApproveKYC(u)}>Approve</Button>
                          <Button size="sm" variant="secondary" icon={<X size={12} />} onClick={() => handleRejectKYC(u)}>Reject</Button>
                        </>
                      )}
                      {/* Suspend / Unsuspend */}
                      {u.role !== 'admin' && (
                        u.isSuspended ? (
                          <Button size="sm" variant="secondary" icon={<UserCheck size={12} />}
                            className="text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-900/20"
                            onClick={() => handleUnsuspend(u)}>
                            Unsuspend
                          </Button>
                        ) : (
                          <Button size="sm" variant="danger" icon={<UserX size={12} />}
                            onClick={() => { setSuspendTarget(u); setSuspendReason(''); }}>
                            Suspend
                          </Button>
                        )
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Suspend Confirmation Modal */}
      <Modal
        open={!!suspendTarget}
        onClose={() => { setSuspendTarget(null); setSuspendReason(''); }}
        title="Suspend User Account"
        size="md"
        footer={
          <>
            <Button variant="secondary" onClick={() => { setSuspendTarget(null); setSuspendReason(''); }}>Cancel</Button>
            <Button variant="danger" loading={suspendLoading} onClick={handleSuspend} icon={<UserX size={14} />}>
              Suspend Account
            </Button>
          </>
        }
      >
        {suspendTarget && (
          <div className="space-y-4">
            {/* User info */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
              <Avatar name={`${suspendTarget.firstName} ${suspendTarget.lastName}`} size="md" />
              <div>
                <p className="font-semibold text-slate-900 dark:text-slate-100">{suspendTarget.firstName} {suspendTarget.lastName}</p>
                <p className="text-xs text-slate-400">{suspendTarget.email} · {roleLabels[suspendTarget.role]}</p>
              </div>
            </div>

            {/* Warning */}
            <div className="flex items-start gap-2.5 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
              <AlertTriangle size={15} className="text-red-600 mt-0.5 flex-shrink-0" />
              <div className="text-xs text-red-700 dark:text-red-400 space-y-1">
                <p className="font-semibold">This will immediately:</p>
                <ul className="list-disc list-inside space-y-0.5">
                  <li>Block the user from logging in</li>
                  <li>Show them a suspension notice when they try to sign in</li>
                  <li>Prevent them from making payments or bookings</li>
                </ul>
                <p className="mt-1">You can unsuspend them at any time.</p>
              </div>
            </div>

            {/* Reason selector */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Reason for suspension *
              </label>
              <div className="space-y-1.5">
                {SUSPEND_REASONS.map(r => (
                  <button key={r} onClick={() => setSuspendReason(r)}
                    className={`w-full text-left px-3 py-2 rounded-xl border text-sm transition-all ${suspendReason === r ? 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300' : 'border-slate-200 dark:border-slate-600 text-slate-700 dark:text-slate-300 hover:border-slate-300'}`}>
                    {suspendReason === r ? '● ' : '○ '}{r}
                  </button>
                ))}
              </div>
              {suspendReason === 'Other (specify below)' && (
                <Textarea
                  className="mt-2"
                  placeholder="Describe the reason for suspension..."
                  value={suspendReason === 'Other (specify below)' ? '' : suspendReason}
                  onChange={e => setSuspendReason(e.target.value || 'Other (specify below)')}
                  rows={3}
                />
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* ── Invite User Modal ─────────────────────────────────────────── */}
      <Modal
        open={showInviteModal}
        onClose={resetInviteModal}
        title="Invite User"
        size="md"
        footer={
          inviteSent ? (
            <Button variant="secondary" onClick={resetInviteModal}>Done</Button>
          ) : (
            <>
              <Button variant="secondary" onClick={resetInviteModal}>Cancel</Button>
              <Button loading={inviteLoading} onClick={handleSendInvite} icon={<Send size={14} />}>
                Generate Invite
              </Button>
            </>
          )
        }
      >
        {!inviteSent ? (
          <div className="space-y-4">
            <div className="p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl">
              <p className="text-xs text-primary-700 dark:text-primary-300">
                Fill in the details below to generate a personalised invite link. The invited person will receive a link that pre-fills their registration form.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Input
                label="First Name *"
                placeholder="e.g. Sarah"
                value={inviteForm.firstName}
                onChange={e => setInviteForm(f => ({ ...f, firstName: e.target.value }))}
              />
              <Input
                label="Last Name"
                placeholder="e.g. Nakato"
                value={inviteForm.lastName}
                onChange={e => setInviteForm(f => ({ ...f, lastName: e.target.value }))}
              />
            </div>

            <Input
              label="Email Address *"
              type="email"
              placeholder="user@example.com"
              value={inviteForm.email}
              onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
              icon={<Mail size={15} />}
            />

            <Input
              label="Phone Number (optional)"
              type="tel"
              placeholder="07XX XXX XXX"
              value={inviteForm.phone}
              onChange={e => setInviteForm(f => ({ ...f, phone: e.target.value }))}
            />

            <Select
              label="Role *"
              value={inviteForm.role}
              onChange={e => setInviteForm(f => ({ ...f, role: e.target.value as UserRole }))}
              options={[
                { value: 'tenant',           label: 'Tenant – Looking for property' },
                { value: 'landlord',          label: 'Landlord – Property owner' },
                { value: 'property_manager',  label: 'Property Manager' },
                { value: 'agent',             label: 'Agent' },
                { value: 'vendor',            label: 'Vendor / Service Provider' },
              ]}
            />

            <Textarea
              label="Personal Message (optional)"
              placeholder="Add a personal note to the invitation..."
              value={inviteForm.message}
              onChange={e => setInviteForm(f => ({ ...f, message: e.target.value }))}
              rows={3}
            />
          </div>
        ) : (
          /* ── Invite generated ── */
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
              <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-800 dark:text-green-300">Invite link generated!</p>
                <p className="text-xs text-green-600 dark:text-green-400">
                  For {inviteForm.firstName} {inviteForm.lastName} as {roleLabels[inviteForm.role]}
                </p>
              </div>
            </div>

            {/* Link display */}
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Invite Link</label>
              <div className="flex gap-2">
                <div className="flex-1 px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-700 text-xs text-slate-600 dark:text-slate-300 font-mono truncate border border-slate-200 dark:border-slate-600">
                  {inviteLink}
                </div>
                <Button size="sm" variant="secondary" icon={<Copy size={13} />} onClick={handleCopyLink}>
                  Copy
                </Button>
              </div>
            </div>

            {/* Share options */}
            <div>
              <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Share via</p>
              <div className="grid grid-cols-3 gap-2">
                <button
                  onClick={handleShareViaEmail}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <Mail size={20} className="text-blue-600" />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Email</span>
                </button>
                <button
                  onClick={handleShareViaWhatsApp}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <svg className="w-5 h-5" fill="#25D366" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">WhatsApp</span>
                </button>
                <button
                  onClick={handleCopyLink}
                  className="flex flex-col items-center gap-1.5 p-3 rounded-xl border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
                >
                  <Link size={20} className="text-slate-500" />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Copy Link</span>
                </button>
              </div>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
              <p className="text-xs text-amber-700 dark:text-amber-400">
                ⚠️ This link pre-fills the registration form. The user still needs to set their own password. The link expires after 7 days.
              </p>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
