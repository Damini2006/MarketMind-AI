const CACHE_NAME = 'marketmind-v2';
const STATIC_CACHE = 'marketmind-static-v2';
const API_CACHE = 'marketmind-api-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/favicon.svg',
];

// Install: cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== STATIC_CACHE && k !== API_CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Helper: should we skip caching this URL?
function shouldSkipCache(url) {
  const path = url.pathname;
  // Never cache Vite HMR or pre-bundled deps
  if (path.includes('/.vite/')) return true;
  // Never cache HMR websocket or hot updates
  if (url.protocol === 'ws:' || url.protocol === 'wss:') return true;
  // In development: skip caching source modules so updates are live
  if (url.hostname === '127.0.0.1' || url.hostname === 'localhost') {
    if (path.startsWith('/src/') || path.startsWith('/@') || path.includes('?t=') || path.includes('?v=')) {
      return true;
    }
  }
  return false;
}

// Fetch: network-first for API and dev modules, cache-first for static
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests and non-http(s)
  if (request.method !== 'GET') return;
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  // Skip caching for Vite dev modules — always go to network
  if (shouldSkipCache(url)) {
    event.respondWith(fetch(request));
    return;
  }

  // API requests: network-first with cache fallback
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(API_CACHE).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  // Static assets: cache-first (only for production-built files in /assets/)
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        // Only cache successful responses for truly static assets
        if (response.ok) {
          const clone = response.clone();
          caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
        }
        return response;
      });
    }).catch(() => {
      // Offline fallback: return cached index.html for navigation requests
      if (request.mode === 'navigate') {
        return caches.match('/index.html');
      }
    })
  );
});

// Push notifications
self.addEventListener('push', (event) => {
  const data = event.data?.json() || { title: 'MarketMind AI', body: 'You have a new notification' };
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/favicon.svg',
      badge: '/favicon.svg',
      data: data.url || '/dashboard',
    })
  );
});

// Notification click: navigate to relevant page
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then((windowClients) => {
      const url = event.notification.data || '/dashboard';
      for (const client of windowClients) {
        if (client.url.includes(url) && 'focus' in client) return client.focus();
      }
      return clients.openWindow(url);
    })
  );
});
