// Laundrify Service Worker — v2.58
// Auto-updates: on new deploy, takes control immediately and tells all clients to reload.

const CACHE_VERSION = 'laundrify-v2.58';
const STATIC_CACHE = `${CACHE_VERSION}-static`;

// ── Install: skip waiting so this SW activates right away ─────────────────────
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(['/']).catch(() => {}))
  );
});

// ── Activate: delete old caches + claim all clients + notify to reload ─────────
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE)
            .map((key) => caches.delete(key))
        )
      ),
      self.clients.claim(),
    ]).then(() => {
      // Tell every open tab: new version active → reload
      return self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clients) => {
          clients.forEach((client) => {
            client.postMessage({ type: 'SW_UPDATED', version: CACHE_VERSION });
          });
        });
    })
  );
});

// ── Fetch: network-first for app shell, cache-first for assets ────────────────
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  // Skip cross-origin requests (API, socket.io, etc.)
  if (url.origin !== self.location.origin) return;

  // Network-first for JS, CSS, HTML
  if (
    url.pathname.endsWith('.js') ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.html') ||
    url.pathname === '/' ||
    url.pathname === '/index.html'
  ) {
    event.respondWith(
      fetch(request)
        .then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(request, clone));
          }
          return res;
        })
        .catch(() =>
          caches.match(request).then((cached) => cached || fetch(request))
        )
    );
    return;
  }

  // Cache-first for images and fonts
  if (url.pathname.match(/\.(png|jpg|jpeg|svg|gif|webp|ico|woff2?|ttf)$/)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((res) => {
          if (res && res.ok) {
            const clone = res.clone();
            caches.open(STATIC_CACHE).then((c) => c.put(request, clone));
          }
          return res;
        });
      })
    );
  }
});

// ── Message: handle client requests ──────────────────────────────────────────
// IMPORTANT: Do NOT return `true` from this listener unless you explicitly call
// event.ports[0].postMessage() — otherwise Chrome throws
// "message channel closed before a response was received".
self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'SKIP_WAITING') {
    // skipWaiting() is async — wrap in waitUntil so the SW stays alive
    event.waitUntil(self.skipWaiting());
    return;
  }

  if (event.data.type === 'GET_VERSION') {
    // Respond only when a MessageChannel port is provided
    if (event.ports && event.ports[0]) {
      event.ports[0].postMessage({ version: CACHE_VERSION });
    }
    return;
  }

  // Unknown message types — explicitly ignore (no return true, no port leak)
});
