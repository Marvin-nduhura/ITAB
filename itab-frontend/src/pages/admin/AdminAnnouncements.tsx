import { useState } from 'react';
import { motion } from 'framer-motion';
import { Megaphone, Send, Users, Building2, User } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input, Textarea, Select } from '../../components/ui/Input';
import { EmptyState } from '../../components/ui/EmptyState';
import { useDataStore } from '../../store/dataStore';
import { announcementsApi } from '../../lib/api';
import { formatDate } from '../../lib/utils';
import toast from 'react-hot-toast';

interface Announcement {
  id: string;
  title: string;
  body: string;
  targetRoles: string[];
  sentByName: string;
  createdAt: string;
}

const audienceOptions = [
  { value: 'all',              label: 'All Users',          icon: <Users size={14} /> },
  { value: 'tenant',           label: 'Tenants Only',       icon: <User size={14} /> },
  { value: 'landlord',         label: 'Landlords Only',     icon: <Building2 size={14} /> },
  { value: 'property_manager', label: 'Property Managers',  icon: <Building2 size={14} /> },
  { value: 'agent',            label: 'Agents Only',        icon: <User size={14} /> },
];

export function AdminAnnouncements() {
  const { announcements: rawAnnouncements, setAnnouncements } = useDataStore();
  const announcements = rawAnnouncements as Announcement[];
  const [form, setForm] = useState({ title: '', body: '', audience: 'all' });
  const [sending, setSending] = useState(false);

  const handleSend = async () => {
    if (!form.title.trim() || !form.body.trim()) { toast.error('Title and message are required'); return; }
    setSending(true);
    try {
      const targetRoles = form.audience === 'all' ? [] : [form.audience];
      const res = await announcementsApi.send({ title: form.title, body: form.body, targetRoles });
      const saved = (res.data as { data: Announcement }).data;
      setAnnouncements([saved, ...announcements]);
      setForm({ title: '', body: '', audience: 'all' });
      toast.success(`📢 Announcement sent!`);
    } catch {
      toast.error('Failed to send announcement. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const audienceLabel = (roles: string[]) => {
    if (!roles || roles.length === 0) return 'all';
    return roles[0];
  };

  const audienceVariant = (a: string): 'blue' | 'green' | 'purple' | 'yellow' | 'gray' => {
    const m: Record<string, 'blue' | 'green' | 'purple' | 'yellow' | 'gray'> = {
      all: 'blue', tenant: 'green', landlord: 'purple', property_manager: 'yellow', agent: 'gray',
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
        </div>
        <div className="flex items-center justify-between">
          <p className="text-xs text-slate-400">
            Will be sent to: <strong className="text-slate-700 dark:text-slate-300">
              {form.audience === 'all' ? 'All users' : audienceOptions.find(o => o.value === form.audience)?.label || form.audience}
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
                      <Badge variant={audienceVariant(audienceLabel(a.targetRoles))}>{audienceLabel(a.targetRoles) || 'all'}</Badge>
                    </div>
                    <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-2">{a.body}</p>
                    <div className="flex items-center gap-3 mt-2 text-xs text-slate-400">
                      <span>{formatDate(a.createdAt)}</span>
                      {a.sentByName && <><span>·</span><span className="text-green-600 font-medium">✓ Sent by {a.sentByName}</span></>}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
