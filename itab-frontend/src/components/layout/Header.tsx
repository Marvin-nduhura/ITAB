import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Menu, Bell, Sun, Moon, Monitor, Search, ChevronDown, Wifi, WifiOff } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuthStore } from '../../store/authStore';
import { useUIStore, applyTheme } from '../../store/uiStore';
import { useNotificationStore } from '../../store/notificationStore';
import { Avatar } from '../ui/Avatar';
import { Badge } from '../ui/Badge';
import { InstallButton } from '../pwa/InstallPrompt';
import { timeAgo } from '../../lib/utils';

export function Header() {
  const { user, logout } = useAuthStore();
  const { theme, setTheme, toggleSidebar, isOnline } = useUIStore();
  const { notifications, unreadCount, markRead, markAllRead } = useNotificationStore();
  const navigate = useNavigate();
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const notifsRef  = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking anywhere outside them
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (
        notifsRef.current  && !notifsRef.current.contains(e.target as Node) &&
        profileRef.current && !profileRef.current.contains(e.target as Node)
      ) {
        setShowNotifs(false);
        setShowProfile(false);
      }
    };
    if (showNotifs || showProfile) {
      document.addEventListener('mousedown', handler);
    }
    return () => document.removeEventListener('mousedown', handler);
  }, [showNotifs, showProfile]);

  const themeOptions = [
    { value: 'light' as const, icon: <Sun size={14} />, label: 'Light' },
    { value: 'dark' as const, icon: <Moon size={14} />, label: 'Dark' },
    { value: 'system' as const, icon: <Monitor size={14} />, label: 'System' },
  ];

  const notifTypeColors: Record<string, 'blue' | 'green' | 'yellow' | 'red' | 'purple'> = {
    payment: 'green', inspection: 'blue', maintenance: 'yellow', payout: 'purple', system: 'red',
  };

  return (
    <header className="sticky top-0 z-20 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 px-4 py-3">
      <div className="flex items-center justify-between gap-4">
        {/* Left */}
        <div className="flex items-center gap-3">
          <button onClick={toggleSidebar} className="lg:hidden p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <Menu size={20} className="text-slate-600 dark:text-slate-400" />
          </button>
          {/* Logo — visible on mobile only (sidebar hidden) */}
          <img src="/logo.png" alt="ITAB" className="h-8 w-auto object-contain lg:hidden" />
          <button onClick={() => navigate('/search')} className="hidden sm:flex items-center gap-2 px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 text-sm hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors w-48">
            <Search size={15} />
            <span>Search properties...</span>
          </button>
        </div>

        {/* Right */}
        <div className="flex items-center gap-2">
          {/* Online indicator */}
          <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${isOnline ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'}`}>
            {isOnline ? <Wifi size={12} /> : <WifiOff size={12} />}
            <span className="hidden sm:inline">{isOnline ? 'Online' : 'Offline'}</span>
          </div>

          {/* Install button */}
          <InstallButton className="hidden md:flex" />

          {/* Theme toggle */}
          <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-xl p-1 gap-0.5">
            {themeOptions.map(opt => (
              <button
                key={opt.value}
                onClick={() => { setTheme(opt.value); applyTheme(opt.value); }}
                title={opt.label}
                className={`p-1.5 rounded-lg transition-all duration-200 ${theme === opt.value ? 'bg-white dark:bg-slate-700 shadow-sm text-primary-600 dark:text-primary-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
              >
                {opt.icon}
              </button>
            ))}
          </div>

          {/* Notifications */}
          <div className="relative" ref={notifsRef}>
            <button
              onClick={() => { setShowNotifs(!showNotifs); setShowProfile(false); }}
              className="relative p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Bell size={20} className="text-slate-600 dark:text-slate-400" />
              {unreadCount > 0 && (
                <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            <AnimatePresence>
              {showNotifs && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-card-lg border border-slate-100 dark:border-slate-700 overflow-hidden"
                >
                  <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                    <h3 className="font-semibold text-slate-900 dark:text-slate-100 text-sm">Notifications</h3>
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} className="text-xs text-primary-600 hover:text-primary-700 font-medium">Mark all read</button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700">
                    {notifications.length === 0 ? (
                      <p className="text-center text-sm text-slate-400 py-8">No notifications</p>
                    ) : notifications.slice(0, 10).map(n => (
                      <div
                        key={n.id}
                        onClick={() => { markRead(n.id); if (n.actionUrl) navigate(n.actionUrl); setShowNotifs(false); }}
                        className={`px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${!n.isRead ? 'bg-primary-50/50 dark:bg-primary-900/10' : ''}`}
                      >
                        <div className="flex items-start gap-3">
                          <Badge variant={notifTypeColors[n.type] || 'gray'} className="mt-0.5 flex-shrink-0">{n.type}</Badge>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-900 dark:text-slate-100 leading-tight">{n.title}</p>
                            <p className="text-xs text-slate-500 mt-0.5 line-clamp-2">{n.body}</p>
                            <p className="text-xs text-slate-400 mt-1">{timeAgo(n.createdAt)}</p>
                          </div>
                          {!n.isRead && <div className="w-2 h-2 bg-primary-500 rounded-full mt-1.5 flex-shrink-0" />}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700">
                    <button onClick={() => { navigate('/notifications'); setShowNotifs(false); }} className="text-xs text-primary-600 hover:text-primary-700 font-medium w-full text-center">View all notifications</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Profile */}
          <div className="relative" ref={profileRef}>
            <button
              onClick={() => { setShowProfile(!showProfile); setShowNotifs(false); }}
              className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
            >
              <Avatar name={user ? `${user.firstName} ${user.lastName}` : 'User'} src={user?.avatar} size="sm" />
              <ChevronDown size={14} className="text-slate-400 hidden sm:block" />
            </button>

            <AnimatePresence>
              {showProfile && (
                <motion.div
                  initial={{ opacity: 0, y: 8, scale: 0.95 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="absolute right-0 top-full mt-2 w-52 bg-white dark:bg-slate-800 rounded-2xl shadow-card-lg border border-slate-100 dark:border-slate-700 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                    <p className="font-semibold text-slate-900 dark:text-slate-100 text-sm">{user?.firstName} {user?.lastName}</p>
                    <p className="text-xs text-slate-400 capitalize">{user?.role?.replace('_', ' ')}</p>
                  </div>
                  <div className="p-1.5">
                    {[
                      { label: 'Profile', path: '/settings/profile' },
                      { label: 'Settings', path: '/settings' },
                    ].map(item => (
                      <button key={item.path} onClick={() => { navigate(item.path); setShowProfile(false); }}
                        className="w-full text-left px-3 py-2 rounded-xl text-sm text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                        {item.label}
                      </button>
                    ))}
                    <button onClick={() => { logout(); navigate('/login'); }}
                      className="w-full text-left px-3 py-2 rounded-xl text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors mt-1">
                      Sign out
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

    </header>
  );
}
