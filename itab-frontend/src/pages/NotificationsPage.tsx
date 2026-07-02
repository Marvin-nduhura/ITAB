import { motion } from 'framer-motion';
import { Bell, CheckCheck } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { EmptyState } from '../components/ui/EmptyState';
import { useNotificationStore } from '../store/notificationStore';
import { timeAgo } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

export function NotificationsPage() {
  const { notifications, markRead, markAllRead, unreadCount } = useNotificationStore();
  const navigate = useNavigate();

  const typeColors: Record<string, 'blue' | 'green' | 'yellow' | 'red' | 'purple'> = {
    payment: 'green', inspection: 'blue', maintenance: 'yellow', payout: 'purple', system: 'red', alert: 'red', message: 'blue',
  };

  const typeEmoji: Record<string, string> = {
    payment: '💳', inspection: '🏠', maintenance: '🔧', payout: '💰', system: '⚙️', alert: '🚨', message: '💬',
  };

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100">Notifications</h1>
          <p className="text-sm text-slate-500 mt-0.5">{unreadCount} unread</p>
        </div>
        {unreadCount > 0 && (
          <Button variant="secondary" size="sm" icon={<CheckCheck size={15} />} onClick={markAllRead}>Mark all read</Button>
        )}
      </div>

      {notifications.length === 0 ? (
        <EmptyState icon={<Bell size={28} />} title="No notifications" description="You're all caught up! Notifications will appear here." />
      ) : (
        <div className="space-y-2">
          {notifications.map((n, i) => (
            <motion.div key={n.id} initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
              onClick={() => { markRead(n.id); if (n.actionUrl) navigate(n.actionUrl); }}
              className={`flex items-start gap-4 p-4 rounded-2xl border cursor-pointer transition-all hover:shadow-card ${!n.isRead ? 'bg-primary-50 dark:bg-primary-900/10 border-primary-100 dark:border-primary-800' : 'bg-white dark:bg-slate-800 border-slate-100 dark:border-slate-700'}`}>
              <div className="w-10 h-10 rounded-xl bg-white dark:bg-slate-700 shadow-sm flex items-center justify-center text-lg flex-shrink-0">
                {typeEmoji[n.type] || '🔔'}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{n.title}</p>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Badge variant={typeColors[n.type] || 'gray'}>{n.type}</Badge>
                    {!n.isRead && <div className="w-2 h-2 bg-primary-500 rounded-full" />}
                  </div>
                </div>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">{n.body}</p>
                <p className="text-xs text-slate-400 mt-1.5">{timeAgo(n.createdAt)}</p>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
