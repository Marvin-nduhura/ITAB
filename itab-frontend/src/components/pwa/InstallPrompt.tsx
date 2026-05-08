import { useState, useEffect } from 'react';
import { Download, X, Smartphone, Share, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { usePWAInstall } from '../../hooks/usePWAInstall';
import { Button } from '../ui/Button';

function IOSInstructions({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white dark:bg-slate-800 rounded-3xl shadow-card-lg border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <p className="font-bold text-slate-900 dark:text-slate-100">Install ITAB</p>
          <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
            <X size={18} className="text-slate-400" />
          </button>
        </div>
        <div className="px-5 pb-5 space-y-3">
          {[
            { icon: <Share size={18} className="text-blue-500" />, bg: 'bg-blue-50 dark:bg-blue-900/30', title: 'Tap the Share button', desc: 'Tap the Share icon at the bottom of Safari' },
            { icon: <Plus size={18} className="text-green-500" />, bg: 'bg-green-50 dark:bg-green-900/30', title: 'Add to Home Screen', desc: 'Scroll down and tap "Add to Home Screen"' },
            { icon: <Smartphone size={18} className="text-primary-500" />, bg: 'bg-primary-50 dark:bg-primary-900/30', title: 'Tap Add', desc: 'Tap "Add" in the top right corner' },
          ].map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${step.bg}`}>{step.icon}</div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{step.title}</p>
                <p className="text-xs text-slate-400 mt-0.5">{step.desc}</p>
              </div>
            </div>
          ))}
          <Button className="w-full mt-2" onClick={onClose}>Got it!</Button>
        </div>
      </div>
    </div>
  );
}

export function InstallPrompt() {
  const { canInstall, isInstalled, platform, install, dismiss } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!canInstall || isInstalled) { setShow(false); return; }
    // Only show after 8 seconds to never block initial interaction
    const t = setTimeout(() => setShow(true), 8000);
    return () => clearTimeout(t);
  }, [canInstall, isInstalled]);

  if (!show) return null;

  const handleInstall = async () => {
    if (platform === 'ios') { setShowIOSModal(true); return; }
    setInstalling(true);
    await install();
    setInstalling(false);
  };

  const handleDismiss = () => { setShow(false); dismiss(); };

  return (
    <>
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 20, stiffness: 180 }}
            className="fixed bottom-4 right-4 z-[80] w-72 pointer-events-auto"
            style={{ pointerEvents: 'auto' }}
          >
            <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-card-lg border border-slate-200 dark:border-slate-700 p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <img src="/logo.png" alt="ITAB" className="w-8 h-8 object-contain rounded-lg" />
                  <p className="font-bold text-slate-900 dark:text-slate-100 text-sm">Install ITAB</p>
                </div>
                <button onClick={handleDismiss} className="p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                  <X size={14} className="text-slate-400" />
                </button>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-3">Works offline, fast, native feel.</p>
              <Button className="w-full" size="sm" loading={installing} onClick={handleInstall} icon={<Download size={13} />}>
                {platform === 'ios' ? 'How to Install' : 'Install App'}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showIOSModal && <IOSInstructions onClose={() => setShowIOSModal(false)} />}
      </AnimatePresence>
    </>
  );
}

export function InstallButton({ className }: { className?: string }) {
  const { canInstall, isInstalled, platform, install } = usePWAInstall();
  const [showIOSModal, setShowIOSModal] = useState(false);
  const [installing, setInstalling] = useState(false);

  if (isInstalled) {
    return (
      <div className={`flex items-center gap-2 text-xs text-green-600 dark:text-green-400 font-medium ${className}`}>
        <span className="w-2 h-2 bg-green-500 rounded-full" />
        App installed
      </div>
    );
  }
  if (!canInstall) return null;

  const handleInstall = async () => {
    if (platform === 'ios') { setShowIOSModal(true); return; }
    setInstalling(true);
    await install();
    setInstalling(false);
  };

  return (
    <>
      <button onClick={handleInstall}
        className={`flex items-center gap-2 px-3 py-1.5 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-xs font-semibold transition-all ${className}`}>
        {installing
          ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
          : <Download size={13} />}
        {platform === 'ios' ? 'Add to Home Screen' : 'Install App'}
      </button>
      <AnimatePresence>
        {showIOSModal && <IOSInstructions onClose={() => setShowIOSModal(false)} />}
      </AnimatePresence>
    </>
  );
}
