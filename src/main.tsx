import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import { AppDataProvider } from './AppDataContext';

// Signal to index.html boot watchdog that main JS bundle executed successfully
(window as any).__SHANGRILA_APP_BOOTED__ = true;

// Recover cleanly if a stale cached HTML references a rotated Vite chunk hash after a new deploy
const PRELOAD_RELOAD_KEY = 'shangrila_preload_recovered_at';
window.addEventListener('vite:preloadError', (event) => {
  try {
    const lastReload = Number(sessionStorage.getItem(PRELOAD_RELOAD_KEY) || '0');
    if (Date.now() - lastReload > 15000) {
      event.preventDefault();
      sessionStorage.setItem(PRELOAD_RELOAD_KEY, String(Date.now()));
      window.location.reload();
    }
  } catch {
    // Ignore storage restriction
  }
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppDataProvider>
      <App />
    </AppDataProvider>
  </React.StrictMode>
);

// 🌟 Register Service Worker IMMEDIATELY (never wait for window.load, which stalls if any image/API is slow without VPN) 🌟
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then((registration) => {
        // Trigger a silent background check for newer offline cache builds
        registration.update().catch(() => {});
      })
      .catch((err) => {
        console.warn('ServiceWorker registration warning:', err);
      });
  } else {
    navigator.serviceWorker
      .getRegistrations()
      .then((regs) => {
        regs.forEach((reg) => reg.unregister().catch(() => {}));
      })
      .catch(() => {});
    if ('caches' in window) {
      caches
        .keys()
        .then((keys) => {
          keys.forEach((k) => caches.delete(k).catch(() => {}));
        })
        .catch(() => {});
    }
  }
}
