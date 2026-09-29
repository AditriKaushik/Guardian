// Keeps the app working offline: the app shell is cached on install and
// served cache-first, refreshing the cache in the background when online.
//
// Only same-origin GET requests for app files are ever cached. API calls (any /api/ path, and
// every POST), Razorpay and anything else from another origin are left alone entirely.
const CACHE = 'nanha-school-v3';
const SHELL = [
  './', './index.html', './app.css', './app.js', './config.js',
  './pay.html', './pay.js',
  './fonts/baloo2-devanagari.woff2', './fonts/baloo2-latin.woff2',
  './manifest.webmanifest', './icon.svg', './icon-maskable.svg',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

function cacheable(url) {
  return url.origin === location.origin && !url.pathname.includes('/api/');
}

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;             // POSTs (all API calls) go straight to the network
  const url = new URL(req.url);
  if (!cacheable(url)) return;                  // Razorpay, the API, other origins: not touched
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        const noStore = /no-store/i.test(res.headers.get('Cache-Control') || '');
        if (res.ok && res.type === 'basic' && !noStore) {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
