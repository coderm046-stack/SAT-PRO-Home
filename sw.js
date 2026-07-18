// ─────────────────────────────────────────────────────────────────────────────
// SAT V2.0 — Service Worker  (network-first, auto-update)
// Bump the version string below whenever you update index.html so the
// browser detects the change, installs the new SW, and serves fresh files.
// ─────────────────────────────────────────────────────────────────────────────
const VERSION    = 'sat-pro-v1.0';          // ← change this on every new release
const CACHE_NAME = `attendance-${VERSION}`;

const PRECACHE = [
  './index.html',
  './manifest.json',
  './icon-192x192.png',
  './icon-512x512.png',
  './apple-touch-icon.png',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css',
  'https://cdnjs.cloudflare.com/ajax/libs/dexie/3.2.4/dexie.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.28/jspdf.plugin.autotable.min.js',
];

// ── INSTALL: pre-cache core assets, skip waiting immediately ─────────────────
self.addEventListener('install', event => {
  self.skipWaiting();           // activate the new SW right away
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(
          PRECACHE.map(url => new Request(url, { cache: 'reload' }))
        )
      )
      .catch(err => console.warn('[SW] Pre-cache error (non-fatal):', err))
  );
});

// ── ACTIVATE: delete every old cache, claim all clients ─────────────────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(k => k !== CACHE_NAME)   // keep only the current cache
          .map(k => caches.delete(k))
      ))
      .then(() => self.clients.claim())     // take control of all open tabs
  );
});

// ── MESSAGE: allow pages to trigger skipWaiting manually ────────────────────
self.addEventListener('message', event => {
  if (event.data?.type === 'SKIP_WAITING') self.skipWaiting();
});

// ── FETCH: network-first strategy ───────────────────────────────────────────
//  1. Try the network.
//  2. Cache a fresh copy of every successful response.
//  3. If the network fails (offline), serve from cache.
//  index.html is NEVER served from cache when the network is available,
//  so updated app code is always delivered.
self.addEventListener('fetch', event => {
  // Only handle GET requests; skip cross-origin non-CDN requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then(networkResponse => {
        // Store a fresh copy (only for same-origin + CDN responses)
        if (
          networkResponse.ok &&
          (networkResponse.type === 'basic' || networkResponse.type === 'cors')
        ) {
          const toCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, toCache));
        }
        return networkResponse;
      })
      .catch(() => {
        // Network unavailable — fall back to cache
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // Offline fallback for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
      })
  );
});
