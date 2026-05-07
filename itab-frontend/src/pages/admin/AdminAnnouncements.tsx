import { useState } from 'react';
import { motion } from 'framer-motion';
import { Megaphone, Send, Users, Building2, User, Trash2 } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input, Textarea, Select } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatDate } from '../../lib/utils';
import toast from 'react-hot-toast';

interface Announcement {
  id: string;
  title: string;
  body: string;
  audience: 'all' | 'tenants' | 'landlords' | 'managers' | 'agents';
  channel: 'in_app' | 'email' | 'sms' | 'all';
  sentAt: string;
  recipientCount: number;
}

const mockAnnouncements: Announcement[] = [
  {
    id: 'a1', title: 'Platform Maintenance Notice',
    body: 'ITAB will undergo scheduled maintenance on Saturday April 6, 2024 from 2:00 AM to 4:00 AM EAT. The platform will be unavailable during this time.',
    audience: 'all', channel: 'all', sentAt: '2024-04-01T10:00:00Z', recipientCount: 247,
  },
  {
    id: 'a2', title: 'New Partial Rent Payment Feature',
    body: 'You can now pay your rent in installments! Pay what you can now and top up later. Visit the Payments section to get started.',
    audience: 'tenants', channel: 'in_app', sentAt: '2024-03-20T09:00:00Z', recipientCount: 89,
  },
];

const audienceOptions = [
  { value: 'all', label: 'All Users', icon: <Users size={14} /> },
  { value: 'tenants', label: 'Tenants Only', icon: <User size={14} /> },
  { value: 'landlords', label: 'Landlords Only', icon: <Building2 size={14} /> },
  { value: 'managers', label: 'Property Managers', icon: <Building2 size={14} /> },
  { value: 'agents', label: 'Agents Only', icon: <User size={14} /> },
];

export function AdminAnnouncements() {
  const [announcements, setAnnouncements] = useState(mockAnnouncements);
  const [form, setForm] = useState({ title: '', body: '', audience: 'all', channel: 'in_app' });
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!form.title.trim() || !form.body.trim()) { toast.error('Title and message are required'); return; }
    setSending(true);
    await new Promise(r => setTimeout(r, 1000));
    const newAnn: Announcement = {
      id: `a_${Date.now()}`, title: form.title, body: form.body,
      audience: form.audience as Announcement['audience'],
      channel: form.channel as Announcement['channel'],
      sentAt: new Date().toISOString(),
      recipientCount: form.audience === 'all' ? 247 : form.audience === 'tenants' ? 89 : form.audience === 'landlords' ? 34 : 18,
    };
    setAnnouncements(prev => [newAnn, ...prev]);
    setForm({ title: '', body: '', audience: 'all', channel: 'in_app' });
    setSending(false);
    toast.success(`📢 Announcement sent to ${newAnn.recipientCount} users!`);
  };

  const audienceVariant = (a: string): 'blue' | 'green' | 'purple' | 'yellow' | 'gray' => {
    const m: Record<string, 'blue' | 'green' | 'purple' | 'yellow' | 'gray'> = {
      all: 'blue', tenants: 'green', landlords: 'purple', managers: 'yellow', agents: 'gray',
    };
    return m[a] || 'gray';
  };

  return (
    <div className="space-y-6 max-w-4xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Announcements</h1>
        <p className="text-sm text-slate-500 mt-0.5">Broadcast messages to platform users</p>
      </div>

      {/* Compose */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-6 space-y-4">
        <h2 className="font-bold text-slate-900 dark:text-slate-100 flex items-center gap-2">
          <Megaphone size={18} className="text-primary-600" /> New Announcement
        </h2>
        <Input label="Title" placeholder="e.g. Platform Maintenance Notice" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} />
        <Textarea label="Message" placeholder="Write your announcement here..." value={form.body} onChange={e => setForm(f => ({ ...f, body: e.target.value }))} />
        <div className="grid grid-cols-2 gap-4">
          <Select label="Audience" value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))}
            options={audienceOptions.map(o => ({ value: o.value, label: o.label }))} />
          <Select label="Channel" value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))}
            options={[
              { value: 'in_app', label: 'In-App Only' },
              { value: 'email', label: 'Email Only' },
              { value: 'sms', label: 'SMS Only' },
              { value: 'all', label: 'All Channels (In-App + Email + SMS)' },
            ]} />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Will be sent to: <strong className="text-slate-700 dark:text-slate-300">
              {form.audience === 'all' ? '~247 users' : form.audience === 'tenants' ? '~89 tenants' : form.audience === 'landlords' ? '~34 landlords' : '~18 users'}
            </strong>
          </p>
          <Button loading={sending} onClick={handleSend} icon={<Send size={15} />}>Send Announcement</Button>
        </div>
      </div>

      {/* History */}
      <div>
        <h2 className="font-bold text-slate-900 dark:text-slate-100 mb-3">Sent Announcements</h2>
        {announcements.length === 0 ? (
          <EmptyState icon={<Megaphone size={28} />} title="No announcements yet" description="Sent announcements will appear here." />
        ) : (
          <div className="space-y-3">
            {announcements.map((a, i) => (
              <motion.div key={a.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
                className="bg-white dark:bg-slate-800 rounded-2xl shadow-card border border-slate-100 dark:border-slate-700 p-5">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">{a.title}</h3>
                      <Badge variant={audienceVariant(a.audience)}>{a.audience}</Badge>
                      <Badge variant="gray">{a.channel.replace('_', ' ')}</Badge>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{a.body}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <span>{formatDate(a.sentAt)}</span>
                      <span>·</span>
                      <span className="text-green-600 font-medium">✓ Sent to {a.recipientCount} users</span>
                    </div>
                  </div>
                  <button onClick={() => { setAnnouncements(prev => prev.filter(x => x.id !== a.id)); toast.success('Deleted'); }}
                    className="p-2 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-500 transition-colors flex-shrink-0">
                    <Trash2 size={15} />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
