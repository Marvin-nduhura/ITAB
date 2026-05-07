import { Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { useUIStore } from '../../store/uiStore';
import { motion, AnimatePresence } from 'framer-motion';
import { WifiOff, RefreshCw } from 'lucide-react';

export function AppLayout() {
  const { isOnline, syncPending } = useUIStore();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <Sidebar />

      {/* Main content */}
      <div className="lg:pl-64 flex flex-col min-h-screen">
        {/* Offline banner */}
        <AnimatePresence>
          {!isOnline && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="bg-amber-500 text-white text-center text-sm py-2 px-4 font-medium flex items-center justify-center gap-2"
            >
              <WifiOff size={14} />
              You're offline. Changes will sync when you reconnect.
            </motion.div>
          )}
        </AnimatePresence>

        <Header />

        <main className="flex-1 p-4 sm:p-6 max-w-7xl mx-auto w-full">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Outlet />
          </motion.div>
        </main>
      </div>

      {/* Sync indicator */}
      <AnimatePresence>
        {syncPending > 0 && isOnline && (
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 20 }}
            className="fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-white dark:bg-slate-800 shadow-card-lg rounded-full px-4 py-2 text-sm font-medium border border-slate-200 dark:border-slate-700"
          >
            <RefreshCw size={14} className="animate-spin text-primary-600" />
            <span className="text-slate-700 dark:text-slate-300">Syncing {syncPending} item{syncPending > 1 ? 's' : ''}...</span>
          </motion.div>
        )}
      </AnimatePresence>

      <Toaster
        position="top-right"
        toastOptions={{
          duration: 4000,
          style: {
            borderRadius: '12px',
            background: 'var(--toast-bg, #fff)',
            color: 'var(--toast-color, #0f172a)',
            boxShadow: '0 10px 40px -10px rgba(0,0,0,0.15)',
            border: '1px solid rgba(0,0,0,0.06)',
            fontSize: '14px',
          },
        }}
      />
    </div>
  );
}
