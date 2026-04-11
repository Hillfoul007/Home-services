/**
 * Service Worker registration + auto-update handling.
 * Registers /sw.js, listens for SW_UPDATED message, and reloads the page
 * so users always run the latest version.
 */

let _reloadCallback: (() => void) | null = null;

export const setSwReloadCallback = (cb: () => void) => {
  _reloadCallback = cb;
};

/**
 * Register the Laundrify service worker and wire up auto-update.
 * Call once on app start (non-Capacitor only).
 */
export const initializePWAUpdates = (): void => {
  if (!('serviceWorker' in navigator)) return;

  // Listen for the SW_UPDATED message posted by the newly activated SW
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data && event.data.type === 'SW_UPDATED') {
      console.log('[SW] New version active:', event.data.version);
      // Trigger reload — PWAUpdateNotification will handle UI or we reload directly
      if (_reloadCallback) {
        _reloadCallback();
      } else {
        window.location.reload();
      }
    }
  });

  // Register the SW
  navigator.serviceWorker
    .register('/sw.js', { scope: '/' })
    .then((reg) => {
      console.log('[SW] Registered, scope:', reg.scope);

      // If a new SW is already waiting, activate it immediately
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }

      // When a new SW finishes installing, activate it immediately
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            // New SW installed while old one is still in control — skip waiting
            newWorker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      // Periodically check for updates (every 2 minutes)
      setInterval(() => reg.update().catch(() => {}), 2 * 60 * 1000);
    })
    .catch((err) => console.warn('[SW] Registration failed:', err));
};

/** Legacy export kept for any existing callers */
export const cleanupOldServiceWorkers = async (): Promise<void> => {};
export const setupServiceWorkerChangeDetection = (): void => {};
