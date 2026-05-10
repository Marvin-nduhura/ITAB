import { useState } from 'react';
import { motion } from 'framer-motion';
import { Briefcase, CheckCircle2, XCircle, MapPin } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Textarea } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { Avatar } from '../../components/ui/Avatar';
import { useUserStore, type AgentApplication } from '../../store/userStore';
import { useAuthStore } from '../../store/authStore';
import { timeAgo, formatDate } from '../../lib/utils';
import toast from 'react-hot-toast';

export function AgentApplicationsPage() {
  const { agentApplications, approveAgentApplication, rejectAgentApplication } = useUserStore();
  const { user } = useAuthStore();
  const [selected, setSelected] = useState<AgentApplication | null>(null);
  const [adminNote, setAdminNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [filterStatus, setFilterStatus] = useState<'pending' | 'approved' | 'rejected' | ''>('');

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
    toast.success(`Agent application approved! ${selected!.firstName} can now operate as an agent.`);
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Agent Applications</h1>
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
        <EmptyState icon={<Briefcase size={28} />} title="No applications" description="Agent applications will appear here." />
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
                      <Badge variant={app.status === 'approved' ? 'green' : app.status === 'rejected' ? 'red' : 'yellow'}>
                        {app.status === 'pending' ? 'Pending Review' : app.status === 'approved' ? 'Approved' : 'Rejected'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">{app.email} · {app.phone}</p>
                    <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                      <MapPin size={11} />
                      <span>{app.districts.join(', ')}</span>
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 mt-2 line-clamp-2">
                      <strong>Experience:</strong> {app.experience}
                    </p>
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
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      <Modal open={!!selected} onClose={() => { setSelected(null); setAdminNote(''); }} title="Review Agent Application" size="lg"
        footer={
          <div className="flex gap-2 w-full">
            <Button variant="danger" loading={loading} icon={<XCircle size={14} />} onClick={handleReject}>Reject</Button>
            <Button loading={loading} icon={<CheckCircle2 size={14} />} onClick={handleApprove}>Approve</Button>
          </div>
        }>
        {selected && (
          <div className="space-y-4">
            {/* Applicant info */}
            <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
              <Avatar name={`${selected.firstName} ${selected.lastName}`} size="md" />
              <div>
                <p className="font-bold text-slate-900 dark:text-slate-100">{selected.firstName} {selected.lastName}</p>
                <p className="text-xs text-slate-400">{selected.email} · {selected.phone}</p>
                <p className="text-xs text-slate-400">Applied {formatDate(selected.createdAt)}</p>
              </div>
            </div>

            {/* Details */}
            <div className="space-y-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-700/50 rounded-xl">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Districts of Operation</p>
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

            <Textarea
              label="Admin Note * (required for both approval and rejection)"
              placeholder="e.g. 'Approved — strong experience in Kampala market' or 'Rejected — insufficient experience, reapply after 6 months'"
              value={adminNote}
              onChange={e => setAdminNote(e.target.value)}
              rows={3}
            />
          </div>
        )}
      </Modal>
    </div>
  );
}
