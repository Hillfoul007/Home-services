const CACHE_NAME = "laundrify-v7";
const STATIC_CACHE = "laundrify-static-v7";

const urlsToCache = [
  "/",
  "/manifest.json",
  "/laundrify-exact-icon.svg?v=4",
];

// Install service worker
self.addEventListener("install", (event) => {

  console.log("Service Worker: Installing v6...");

  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log("Service Worker: Caching app shell");
      return cache.addAll(urlsToCache);
    }),
  );
  // Don't force immediate activation - wait for user confirmation
  // self.skipWaiting(); // Commented out to prevent aggressive updates
});

// Activate service worker
self.addEventListener("activate", (event) => {
  console.log("Service Worker: Activating v7...");
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME && cacheName !== STATIC_CACHE) {
            console.log("Service Worker: Deleting old cache:", cacheName);
            return caches.delete(cacheName);
          }
        }),
      );
    }),
  );
  // Don't immediately claim control - let user decide when to update
  // self.clients.claim(); // Commented out to prevent aggressive updates
});

// Fetch event
self.addEventListener("fetch", (event) => {
  // Skip chrome-extension requests and other non-http requests
  if (!event.request.url.startsWith("http")) {
    return;
  }

  // Don't interfere with API requests at all - let them pass through normally
  if (
    event.request.url.includes("/api/") ||
    event.request.url.includes("onrender.com") ||
    event.request.url.includes("localhost:3001") ||
    event.request.url.includes("railway.app") ||
    event.request.method !== "GET"
  ) {
    // Let these requests pass through without any service worker intervention
    return;
  }

  // Handle static assets with caching
  if (
    event.request.url.includes("/assets/") ||
    event.request.url.includes("/static/") ||
    event.request.url.match(/\.(js|css|png|jpg|jpeg|svg|ico|woff|woff2)$/)
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }

        return fetch(event.request)
          .then((response) => {
            // Cache successful responses for static assets
            if (response.status === 200) {
              const responseClone = response.clone();
              caches.open(STATIC_CACHE).then((cache) => {
                cache.put(event.request, responseClone);
              });
            }
            return response;
          })
          .catch(() => {
            return new Response("Asset not available offline", {
              status: 503,
              statusText: "Service Unavailable",
            });
          });
      }),
    );
    return;
  }

  // Handle regular navigation requests
  event.respondWith(
    caches.match(event.request).then((response) => {
      // Return cached version or fetch from network
      return (
        response ||
        fetch(event.request).catch(() => {
          // Return cached index.html for SPA routing
          return caches.match("/").then((indexResponse) => {
            return (
              indexResponse ||
              new Response("Page not available offline", {
                status: 503,
                statusText: "Service Unavailable",
              })
            );
          });
        })
      );
    }),
  );
});

// Push event handler
self.addEventListener("push", (event) => {
  console.log("Push event received:", event);

  const options = {
    body: event.data
      ? event.data.text()
      : "New notification from Laundrify",
    icon: "/icons/icon-192x192.png",
    badge: "/icons/icon-72x72.png",
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      {
        action: "view",
        title: "View Details",
        icon: "/laundrify-exact-icon.svg",
      },
      {
        action: "close",
        title: "Close",
        icon: "/laundrify-exact-icon.svg",
      },
    ],
  };

  event.waitUntil(self.registration.showNotification("Laundrify", options));
});

// Notification click handler
self.addEventListener("notificationclick", (event) => {
  console.log("Notification click received.");

  event.notification.close();

  if (event.action === "view") {
    event.waitUntil(clients.openWindow("/"));
  }
});

// Background sync
self.addEventListener("sync", (event) => {
  if (event.tag === "background-sync") {
    event.waitUntil(doBackgroundSync());
  }
});

function doBackgroundSync() {
  // Handle background sync tasks
  return Promise.resolve();
}

// Handle messages from the app
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    console.log('Service Worker: Received SKIP_WAITING message');
    self.skipWaiting();
  }
});
