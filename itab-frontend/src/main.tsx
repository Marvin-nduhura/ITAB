import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import { GoogleOAuthProvider } from '@react-oauth/google'
import './index.css'
import App from './App.tsx'

const GOOGLE_CLIENT_ID = '182672984991-9asmi83o6g44lm3fk9hsfpobkn2ukdlp.apps.googleusercontent.com';

// In development, unregister any stale service workers that could block UI
if (import.meta.env.DEV) {
  navigator.serviceWorker?.getRegistrations().then(registrations => {
    registrations.forEach(r => r.unregister());
  });
}

const updateSW = registerSW({
  onNeedRefresh() {
    if (confirm('A new version of ITAB is available. Update now?')) {
      updateSW(true)
    }
  },
  onOfflineReady() {
    console.log('[PWA] App is ready to work offline')
  },
  onRegistered(r) {
    console.log('[PWA] Service worker registered:', r?.scope)
  },
  onRegisterError(error) {
    console.error('[PWA] Service worker registration failed:', error)
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  </StrictMode>,
)
