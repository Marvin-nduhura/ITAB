import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Briefcase, CheckCircle2, Star, MapPin,
  DollarSign, Wrench, TrendingUp, Edit2, Save, Plus, X, Clock, Smartphone,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Modal } from '../../components/ui/Modal';
import { Input, Select, Textarea } from '../../components/ui/Input';
import { StatCard } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Avatar } from '../../components/ui/Avatar';
import { useAuthStore } from '../../store/authStore';
import { useVendorStore } from '../../store/vendorStore';
import { usePaymentStore } from '../../store/paymentStore';
import { paymentsApi } from '../../lib/api';
import { formatCurrency, formatDate } from '../../lib/utils';
import type { VendorCategory } from '../../types';
import toast from 'react-hot-toast';

const categoryLabels: Record<VendorCategory, string> = {
  plumber: 'Plumber', electrician: 'Electrician', cleaner: 'Cleaner',
  mason: 'Mason', gardener: 'Gardener', garbage_collector: 'Garbage Collector',
  security: 'Security', painter: 'Painter', carpenter: 'Carpenter',
  welder: 'Welder', other: 'Other',
};

function StarRating({ rating, interactive = false, onChange }: { rating: number; interactive?: boolean; onChange?: (r: number) => void }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map(s => (
        <button key={s} type="button"
          disabled={!interactive}
          onClick={() => interactive && onChange?.(s)}
          onMouseEnter={() => interactive && setHover(s)}
          onMouseLeave={() => interactive && setHover(0)}
          className={interactive ? 'cursor-pointer transition-transform hover:scale-110' : 'cursor-default'}>
          <Star size={interactive ? 24 : 14}
            className={s <= (hover || Math.round(rating)) ? 'text-amber-400 fill-amber-400' : 'text-slate-300 dark:text-slate-600'} />
        </button>
      ))}
      {!interactive && <span className="text-xs text-slate-500 ml-1">{rating.toFixed(1)}</span>}
    </div>
  );
}

export function VendorPortal() {
  const { user } = useAuthStore();
  const { vendors, jobs, ratings, updateVendor, acceptJob, startJob, completeJob } = useVendorStore();
  const { getTransactionsByVendor } = usePaymentStore();
  const [tab, setTab] = useState<'overview' | 'jobs' | 'profile' | 'earnings'>('overview');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState<string | null>(null);
  const [actualCost, setActualCost] = useState('');
  const [completionNotes, setCompletionNotes] = useState('');
  const [skillInput, setSkillInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Payment collection state — vendor requests payment after job completion
  const [showRequestPayModal, setShowRequestPayModal] = useState<{
    jobId: string; propertyTitle: string; amount: number;
  } | null>(null);
  const [myPhone, setMyPhone] = useState('');
  const [payMethodPref, setPayMethodPref] = useState<'mtn_momo' | 'airtel_money'>('mtn_momo');
  const [awaitingPayment, setAwaitingPayment] = useState(false);
  const [payRef, setPayRef] = useState('');

  // Find this vendor's profile — match by email, userId, or name
  const myVendor = vendors.find(v =>
    v.email === user?.email ||
    v.userId === user?.id ||
    (`${v.firstName} ${v.lastName}`.toLowerCase() === `${user?.firstName} ${user?.lastName}`.toLowerCase())
  ) ?? null; // No fallback — vendor must be properly registered

  const [editForm, setEditForm] = useState({
    bio: myVendor?.bio || '',
    dailyRate: String(myVendor?.dailyRate || ''),
    hourlyRate: String(myVendor?.hourlyRate || ''),
    availability: myVendor?.availability || 'available',
    skills: [...(myVendor?.skills || [])],
  });

  const myJobs = jobs.filter(j => j.vendorId === myVendor?.id);
  const myRatings = ratings.filter(r => r.vendorId === myVendor?.id);
  const pendingJobs = myJobs.filter(j => j.status === 'assigned');
  const activeJobs = myJobs.filter(j => j.status === 'in_progress');
  const completedJobs = myJobs.filter(j => j.status === 'completed');
  const totalEarnings = completedJobs.reduce((s, j) => s + (j.actualCost || 0), 0);

  const handleSaveProfile = async () => {
    if (!myVendor) return;
    setLoading(true);
    await updateVendor(myVendor.id, {
      bio: editForm.bio,
      dailyRate: editForm.dailyRate ? Number(editForm.dailyRate) : undefined,
      hourlyRate: editForm.hourlyRate ? Number(editForm.hourlyRate) : undefined,
      availability: editForm.availability as 'available' | 'busy' | 'unavailable',
      skills: editForm.skills,
    });
    setLoading(false);
    setShowEditModal(false);
    toast.success('Profile updated!');
  };

  const handleComplete = async () => {
    if (!showCompleteModal) return;
    const job = myJobs.find(j => j.id === showCompleteModal);
    const cost = Number(actualCost) || 0;
    completeJob(showCompleteModal, cost, completionNotes);
    setShowCompleteModal(null);
    setActualCost('');
    setCompletionNotes('');
    toast.success('Job marked as completed! The manager will be notified to process your payment.');

    // Open payment-collection modal so vendor can receive payment immediately
    if (job && cost > 0) {
      // Pre-fill vendor's phone from their profile
      if (myVendor?.phone) setMyPhone(myVendor.phone);
      setTimeout(() => {
        setShowRequestPayModal({
          jobId: showCompleteModal,
          propertyTitle: job.propertyTitle || '',
          amount: cost,
        });
      }, 600);
    }
  };

  // Vendor receives mobile money payment — polls for manager's push
  const handleReceivePayment = async () => {
    if (!showRequestPayModal || !myPhone.trim()) {
      toast.error('Enter your mobile money phone number'); return;
    }
    setAwaitingPayment(true);
    const ref = `${payMethodPref === 'mtn_momo' ? 'MTN' : 'AIR'}-VND-${Date.now()}`;
    setPayRef(ref);
    try {
      // Poll — manager's "Pay Vendor" push will fire the callback and update status
      const result = await paymentsApi.pollStatus(ref, { intervalMs: 3000, maxAttempts: 30 });
      setAwaitingPayment(false);
      if (result.status === 'completed') {
        setShowRequestPayModal(null);
        setMyPhone('');
        toast.success(`✅ ${formatCurrency(showRequestPayModal.amount)} received on ${myPhone}!`);
      } else {
        toast('Payment not received yet. Ask the manager to process it — it will arrive on your phone.', { icon: '⏳', duration: 6000 });
        setShowRequestPayModal(null);
      }
    } catch {
      setAwaitingPayment(false);
      toast.error('Could not confirm payment. Contact your manager.');
    }
  };

  const addSkill = () => {
    const s = skillInput.trim();
    if (s && !editForm.skills.includes(s)) {
      setEditForm(f => ({ ...f, skills: [...f.skills, s] }));
    }
    setSkillInput('');
  };

  if (!myVendor) {
    return (
      <EmptyState icon={<Briefcase size={28} />} title="Vendor profile not found"
        description="Your vendor profile hasn't been set up yet. Contact admin to get registered." />
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <Avatar name={`${myVendor.firstName} ${myVendor.lastName}`} size="xl" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">
                {myVendor.firstName} {myVendor.lastName}
              </h1>
              {myVendor.isVerified && <Badge variant="green"><CheckCircle2 size={11} /> Verified</Badge>}
            </div>
            <p className="text-slate-500 text-sm">{categoryLabels[myVendor.category]} · {myVendor.district}</p>
            <StarRating rating={myVendor.rating} />
          </div>
        </div>
        <div className="flex gap-2">
          <Badge variant={myVendor.availability === 'available' ? 'green' : myVendor.availability === 'busy' ? 'yellow' : 'gray'} dot className="text-sm px-3 py-1.5">
            {myVendor.availability}
          </Badge>
          <Button variant="secondary" size="sm" icon={<Edit2 size={14} />} onClick={() => setShowEditModal(true)}>
            Edit Profile
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 overflow-x-auto">
        {([
          ['overview', 'Overview'],
          ['jobs', `Jobs (${myJobs.length})`],
          ['earnings', 'Earnings'],
          ['profile', 'My Profile'],
        ] as const).map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${tab === key ? 'bg-white dark:bg-slate-700 shadow-sm text-slate-900 dark:text-slate-100' : 'text-slate-500'}`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Overview ─────────────────────────────────────────────────── */}
      {tab === 'overview' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <StatCard title="Total Jobs" value={myVendor.totalJobs}
              icon={<Briefcase className="w-6 h-6 text-primary-600" />} iconBg="bg-primary-100 dark:bg-primary-900/30" />
            <StatCard title="Completed" value={myVendor.completedJobs}
              icon={<CheckCircle2 className="w-6 h-6 text-green-600" />} iconBg="bg-green-100 dark:bg-green-900/30" />
            <StatCard title="Rating" value={`${myVendor.rating}/5`} subtitle={`${myVendor.totalRatings} reviews`}
              icon={<Star className="w-6 h-6 text-amber-500" />} iconBg="bg-amber-100 dark:bg-amber-900/30" />
            <StatCard title="Total Earned" value={formatCurrency(totalEarnings)}
              icon={<DollarSign className="w-6 h-6 text-gold-500" />} iconBg="bg-yellow-100 dark:bg-yellow-900/30" />
          </div>

          {/* Pending jobs alert */}
          {pendingJobs.length > 0 && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-4">
              <p className="font-semibold text-amber-800 dark:text-amber-300 text-sm">
                🔔 You have {pendingJobs.length} new job assignment{pendingJobs.length > 1 ? 's' : ''} waiting for your response
              </p>
              <Button size="sm" className="mt-2" onClick={() => setTab('jobs')}>View Jobs</Button>
            </motion.div>
          )}

          {/* Recent ratings */}
          {myRatings.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5">
              <h3 className="font-bold text-slate-900 dark:text-slate-100 mb-3">Recent Reviews</h3>
              <div className="space-y-3">
                {myRatings.slice(0, 3).map(r => (
                  <div key={r.id} className="flex items-start gap-3 pb-3 border-b border-slate-100 dark:border-slate-700 last:border-0 last:pb-0">
                    <Avatar name={r.ratedByName} size="sm" />
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">{r.ratedByName}</p>
                        <StarRating rating={r.rating} />
                      </div>
                      {r.comment && <p className="text-xs text-slate-500 mt-0.5 italic">"{r.comment}"</p>}
                      <p className="text-xs text-slate-400 mt-0.5">{formatDate(r.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Jobs ─────────────────────────────────────────────────────── */}
      {tab === 'jobs' && (
        <div className="space-y-4">
          {/* Job status tabs */}
          {[
            { label: `New (${pendingJobs.length})`, jobs: pendingJobs, color: 'amber' },
            { label: `Active (${activeJobs.length})`, jobs: activeJobs, color: 'blue' },
            { label: `Completed (${completedJobs.length})`, jobs: completedJobs, color: 'green' },
          ].map(section => (
            section.jobs.length > 0 && (
              <div key={section.label}>
                <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm mb-2">{section.label}</h3>
                <div className="space-y-3">
                  {section.jobs.map((j, i) => (
                    <motion.div key={j.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                      className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <h4 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{j.title}</h4>
                          <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                            <MapPin size={11} />{j.propertyTitle} · {j.propertyAddress}
                          </p>
                          <p className="text-sm text-slate-600 dark:text-slate-400 mt-2 line-clamp-2">{j.description}</p>
                          {j.scheduledDate && (
                            <p className="text-xs text-slate-500 mt-1">📅 Scheduled: {formatDate(j.scheduledDate)}</p>
                          )}
                          {j.estimatedCost && (
                            <p className="text-xs text-slate-500">💰 Estimated: {formatCurrency(j.estimatedCost)}</p>
                          )}
                          {j.managerNotes && (
                            <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                              <p className="text-xs text-blue-700 dark:text-blue-300">📝 Manager: {j.managerNotes}</p>
                            </div>
                          )}
                          {j.actualCost && (
                            <p className="text-xs text-green-600 mt-1">✓ Actual cost: {formatCurrency(j.actualCost)}</p>
                          )}
                        </div>
                        <Badge variant={j.status === 'completed' ? 'green' : j.status === 'in_progress' ? 'blue' : j.status === 'accepted' ? 'purple' : 'yellow'}>
                          {j.status.replace('_', ' ')}
                        </Badge>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 mt-3 pt-3 border-t border-slate-100 dark:border-slate-700">
                        {j.status === 'assigned' && (
                          <>
                            <Button size="sm" icon={<CheckCircle2 size={13} />} onClick={() => { acceptJob(j.id); toast.success('Job accepted!'); }}>
                              Accept Job
                            </Button>
                            <Button size="sm" variant="danger" onClick={() => toast('Job declined. Manager will be notified.')}>
                              Decline
                            </Button>
                          </>
                        )}
                        {j.status === 'accepted' && (
                          <Button size="sm" icon={<Wrench size={13} />} onClick={() => { startJob(j.id); toast.success('Job started!'); }}>
                            Start Job
                          </Button>
                        )}
                        {j.status === 'in_progress' && (
                          <Button size="sm" icon={<CheckCircle2 size={13} />} onClick={() => setShowCompleteModal(j.id)}>
                            Mark Complete
                          </Button>
                        )}
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            )
          ))}

          {myJobs.length === 0 && (
            <EmptyState icon={<Briefcase size={28} />} title="No jobs yet"
              description="Jobs assigned to you by property managers will appear here." />
          )}
        </div>
      )}

      {/* ── Earnings ─────────────────────────────────────────────────── */}
      {tab === 'earnings' && (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <StatCard title="Total Earned" value={formatCurrency(totalEarnings)}
              icon={<TrendingUp className="w-6 h-6 text-green-600" />} iconBg="bg-green-100 dark:bg-green-900/30" />
            <StatCard title="Jobs Completed" value={completedJobs.length}
              icon={<CheckCircle2 className="w-6 h-6 text-primary-600" />} iconBg="bg-primary-100 dark:bg-primary-900/30" />
          </div>
          {completedJobs.length === 0 ? (
            <EmptyState icon={<DollarSign size={28} />} title="No earnings yet" description="Complete jobs to see your earnings here." />
          ) : (
            <div className="space-y-3">
              {completedJobs.map((j, i) => {
                // Check if this job has a completed vendor_payment transaction
                const myTxs = myVendor ? getTransactionsByVendor(myVendor.id) : [];
                const jobTx = myTxs.find(t => t.jobId === j.id && t.type === 'vendor_payment');
                const isPaid = jobTx?.status === 'completed';
                const isPending = jobTx?.status === 'pending';

                return (
                  <motion.div key={j.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                    className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{j.title}</p>
                        <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1">
                          <MapPin size={11} />{j.propertyTitle}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">{j.completedDate ? formatDate(j.completedDate) : '—'}</p>
                        {jobTx && (
                          <p className="text-xs text-slate-400 mt-0.5 font-mono">ref: {jobTx.reference}</p>
                        )}
                      </div>
                      <div className="text-right flex-shrink-0 space-y-1">
                        <p className="text-base font-bold text-green-600">
                          {j.actualCost ? formatCurrency(j.actualCost) : '—'}
                        </p>
                        {isPaid ? (
                          <Badge variant="green">✓ Paid</Badge>
                        ) : isPending ? (
                          <Badge variant="yellow">⏳ Payment Pending</Badge>
                        ) : (
                          <Badge variant="gray">Awaiting Payment</Badge>
                        )}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── Profile ───────────────────────────────────────────────────── */}
      {tab === 'profile' && (
        <div className="space-y-4 max-w-lg">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5 space-y-3">
            {[
              { label: 'Full Name', value: `${myVendor.firstName} ${myVendor.lastName}` },
              { label: 'Category', value: categoryLabels[myVendor.category] },
              { label: 'District', value: myVendor.district },
              { label: 'Phone', value: myVendor.phone },
              { label: 'Email', value: myVendor.email || '—' },
              { label: 'Daily Rate', value: myVendor.dailyRate ? formatCurrency(myVendor.dailyRate) : '—' },
              { label: 'Hourly Rate', value: myVendor.hourlyRate ? formatCurrency(myVendor.hourlyRate) : '—' },
              { label: 'Member Since', value: formatDate(myVendor.joinedAt) },
            ].map(row => (
              <div key={row.label} className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                <span className="text-sm text-slate-500">{row.label}</span>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">{row.value}</span>
              </div>
            ))}
          </div>
          {myVendor.bio && (
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">About Me</p>
              <p className="text-sm text-slate-600 dark:text-slate-400">{myVendor.bio}</p>
            </div>
          )}
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Skills</p>
            <div className="flex flex-wrap gap-1.5">
              {myVendor.skills.map(s => (
                <span key={s} className="text-xs bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 px-2.5 py-1 rounded-full border border-primary-200 dark:border-primary-700">{s}</span>
              ))}
            </div>
          </div>
          <Button className="w-full" icon={<Edit2 size={15} />} onClick={() => setShowEditModal(true)}>Edit Profile</Button>
        </div>
      )}

      {/* Edit Profile Modal */}
      <Modal open={showEditModal} onClose={() => setShowEditModal(false)} title="Edit Profile" size="md"
        footer={<><Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button><Button loading={loading} onClick={handleSaveProfile} icon={<Save size={14} />}>Save Changes</Button></>}>
        <div className="space-y-4">
          <Select label="Availability" value={editForm.availability} onChange={e => setEditForm(f => ({ ...f, availability: e.target.value as 'available' | 'busy' | 'unavailable' }))}
            options={[{ value: 'available', label: '🟢 Available' }, { value: 'busy', label: '🟡 Busy' }, { value: 'unavailable', label: '🔴 Unavailable' }]} />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Daily Rate (UGX)" type="number" value={editForm.dailyRate} onChange={e => setEditForm(f => ({ ...f, dailyRate: e.target.value }))} placeholder="e.g. 80000" />
            <Input label="Hourly Rate (UGX)" type="number" value={editForm.hourlyRate} onChange={e => setEditForm(f => ({ ...f, hourlyRate: e.target.value }))} placeholder="e.g. 15000" />
          </div>
          <Textarea label="Bio" value={editForm.bio} onChange={e => setEditForm(f => ({ ...f, bio: e.target.value }))} placeholder="Describe your experience..." rows={3} />
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1.5">Skills</label>
            <div className="flex gap-2">
              <Input placeholder="Add a skill..." value={skillInput} onChange={e => setSkillInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addSkill(); } }} />
              <Button variant="secondary" size="sm" onClick={addSkill} icon={<Plus size={14} />}>Add</Button>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {editForm.skills.map(s => (
                <span key={s} className="inline-flex items-center gap-1 bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 text-xs px-2.5 py-1 rounded-full border border-primary-200 dark:border-primary-700">
                  {s}
                  <button onClick={() => setEditForm(f => ({ ...f, skills: f.skills.filter(x => x !== s) }))} className="hover:text-red-500"><X size={10} /></button>
                </span>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      {/* Complete Job Modal */}
      <Modal open={!!showCompleteModal} onClose={() => setShowCompleteModal(null)} title="Complete Job"
        footer={<><Button variant="secondary" onClick={() => setShowCompleteModal(null)}>Cancel</Button><Button onClick={handleComplete} icon={<CheckCircle2 size={14} />}>Mark Complete</Button></>}>
        <div className="space-y-4">
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl p-3 text-xs text-green-700 dark:text-green-400">
            💡 Once you mark the job complete, the manager will be prompted to pay you via mobile money. Make sure your phone number is correct in your profile.
          </div>
          <Input label="Actual Cost (UGX)" type="number" placeholder="Enter the final cost" value={actualCost} onChange={e => setActualCost(e.target.value)} />
          <Textarea label="Completion Notes" placeholder="Describe what was done, materials used, etc." value={completionNotes} onChange={e => setCompletionNotes(e.target.value)} rows={3} />
        </div>
      </Modal>

      {/* Receive Payment Modal */}
      <Modal
        open={!!showRequestPayModal}
        onClose={awaitingPayment ? () => {} : () => { setShowRequestPayModal(null); setMyPhone(''); setAwaitingPayment(false); }}
        title="Receive Payment"
        size="sm"
        footer={
          awaitingPayment ? (
            <div className="w-full flex flex-col items-center gap-2 py-1">
              <div className="flex items-center gap-3">
                <div className="w-5 h-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-sm font-medium text-slate-700 dark:text-slate-300">Waiting for manager to send payment...</span>
              </div>
            </div>
          ) : (
            <>
              <Button variant="secondary" onClick={() => { setShowRequestPayModal(null); setMyPhone(''); }}>
                Later
              </Button>
              <Button onClick={handleReceivePayment} icon={<Smartphone size={14} />}>
                I'm ready to receive
              </Button>
            </>
          )
        }
      >
        {showRequestPayModal && (
          <div className="space-y-4">
            {awaitingPayment ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="flex flex-col items-center gap-3 p-5 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-700 rounded-2xl text-center">
                <div className="w-12 h-12 border-4 border-primary-500 border-t-transparent rounded-full animate-spin" />
                <div>
                  <p className="font-bold text-primary-800 dark:text-primary-300">Waiting for payment...</p>
                  <p className="text-sm text-primary-600 dark:text-primary-400 mt-1">
                    When the manager sends payment, <strong>{formatCurrency(showRequestPayModal.amount)}</strong> will arrive on <strong>{myPhone}</strong>.
                  </p>
                  <p className="text-xs text-slate-400 mt-2">ref: {payRef}</p>
                </div>
              </motion.div>
            ) : (
              <>
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
                  <p className="font-semibold text-slate-900 dark:text-slate-100">
                    {showRequestPayModal.propertyTitle}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">Job payment due</p>
                  <p className="text-2xl font-bold text-green-600 mt-2">{formatCurrency(showRequestPayModal.amount)}</p>
                </div>

                <div>
                  <p className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Receive via</p>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { value: 'mtn_momo' as const,    label: 'MTN MoMo',    color: 'bg-yellow-400' },
                      { value: 'airtel_money' as const, label: 'Airtel Money', color: 'bg-red-500' },
                    ].map(m => (
                      <button key={m.value} onClick={() => setPayMethodPref(m.value)}
                        className={`p-3 rounded-xl border-2 text-center transition-all ${payMethodPref === m.value ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' : 'border-slate-200 dark:border-slate-600'}`}>
                        <div className={`w-7 h-7 ${m.color} rounded-full mx-auto mb-1`} />
                        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">{m.label}</p>
                      </button>
                    ))}
                  </div>
                </div>

                <Input
                  label="Your Phone Number"
                  type="tel"
                  placeholder="07XX XXX XXX"
                  value={myPhone}
                  onChange={e => setMyPhone(e.target.value)}
                  icon={<Smartphone size={15} />}
                  hint="Payment will be sent to this number once the manager approves"
                />

                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-3 text-xs text-blue-700 dark:text-blue-400 flex items-start gap-2">
                  <Clock size={14} className="flex-shrink-0 mt-0.5" />
                  <span>The manager will process your payment from their dashboard. You'll receive a mobile money notification when it's sent.</span>
                </div>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
