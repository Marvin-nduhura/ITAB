import { useState, useEffect, useCallback } from 'react';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

export type InstallState = 'idle' | 'available' | 'installing' | 'installed' | 'unsupported';

export interface UsePWAInstallReturn {
  installState: InstallState;
  isInstalled: boolean;
  canInstall: boolean;
  platform: 'ios' | 'android' | 'desktop' | 'unknown';
  install: () => Promise<void>;
  dismiss: () => void;
}

function detectPlatform(): 'ios' | 'android' | 'desktop' | 'unknown' {
  const ua = navigator.userAgent.toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return 'ios';
  if (/android/.test(ua)) return 'android';
  if (/windows|macintosh|linux/.test(ua)) return 'desktop';
  return 'unknown';
}

function isRunningStandalone(): boolean {
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as unknown as { standalone?: boolean }).standalone === true ||
    document.referrer.startsWith('android-app://')
  );
}

export function usePWAInstall(): UsePWAInstallReturn {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  // Start as unsupported — only upgrade to available if we actually get a prompt
  const [installState, setInstallState] = useState<InstallState>('unsupported');
  const platform = detectPlatform();

  useEffect(() => {
    // Check dismissal first
    const dismissed = localStorage.getItem('pwa_install_dismissed');
    if (dismissed) {
      const age = Date.now() - Number(dismissed);
      if (age < 7 * 24 * 60 * 60 * 1000) return; // still dismissed
      localStorage.removeItem('pwa_install_dismissed');
    }

    if (isRunningStandalone()) {
      setInstallState('installed');
      return;
    }

    // Only show on actual iOS mobile devices
    if (platform === 'ios') {
      const isActualIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) &&
        !/windows phone/i.test(navigator.userAgent);
      if (isActualIOS) setInstallState('available');
      return;
    }

    // For all other platforms, only show if browser fires beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      setInstallState('available');
    };
    window.addEventListener('beforeinstallprompt', handler);

    const installedHandler = () => setInstallState('installed');
    window.addEventListener('appinstalled', installedHandler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('appinstalled', installedHandler);
    };
  }, []);

  const install = useCallback(async () => {
    if (platform === 'ios') return;
    if (!deferredPrompt) return;
    setInstallState('installing');
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    setInstallState(outcome === 'accepted' ? 'installed' : 'available');
    setDeferredPrompt(null);
  }, [deferredPrompt, platform]);

  const dismiss = useCallback(() => {
    setInstallState('unsupported');
    localStorage.setItem('pwa_install_dismissed', String(Date.now()));
  }, []);

  return {
    installState,
    isInstalled: installState === 'installed',
    canInstall: installState === 'available',
    platform,
    install,
    dismiss,
  };
}
