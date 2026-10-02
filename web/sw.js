// Keeps the app working offline: the app shell is cached on install and served cache-first,
// refreshing the cache in the background when online. Not used inside the Android shell, which
// serves these files itself.
//
// Only same-origin GET requests for app files are ever cached. API calls (any /api/ path, and
// every POST), Razorpay and anything else from another origin are left alone entirely.
// Voice clips (audio/*.mp3) and lesson pictures (img/real/*.webp) are not precached: each is
// cached the first time it is used.
const CACHE = 'nanha-school-v5';
const SHELL = [
  './', './index.html', './app.css', './config.js',
  './js/core/ns.js', './js/core/store.js', './js/core/voice.js', './js/core/sfx.js', './js/core/rewards.js',
  './js/core/billing.js', './js/core/ui.js',
  './js/content/lessons.js', './js/content/rhymes.js', './js/modules/learn.js',
  './pay.html', './pay.js',
  './fonts/baloo2-devanagari.woff2', './fonts/baloo2-latin.woff2',
  './manifest.webmanifest', './icon.svg', './icon-maskable.svg',
];
// Activities and content written alongside the core. Cached when present; a missing one never
// stops the app from installing.
const OPTIONAL = [
  './js/content/routine.js', './js/content/stories.js', './js/content/careers.js', './js/content/focus.js',
  './js/brain/brain.js',
  './js/modules/routine.js', './js/modules/garden.js', './js/modules/stories.js', './js/modules/dreams.js',
  './js/modules/focus.js', './js/modules/buddy.js',
  './audio/manifest.json',
  './js/core/ai.js', './js/content/images.js', './js/brain/knowledge.js',
  './js/content/future.js', './js/content/robo.js',
  './js/modules/robo.js', './js/modules/future.js', './js/modules/magic.js',
  './js/modules/trace.js', './js/modules/draw.js', './js/modules/music.js', './js/modules/puzzle.js',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL).then(() =>
    Promise.all(OPTIONAL.map(f => cache.add(f).catch(() => {}))))));
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
  // Voice clips and lesson pictures (img/real/…): cache-first, fetched whole (no Range) the first
  // time they are needed and kept — never precached, never re-downloaded.
  if (/\/audio\/.+\.(mp3|m4a|ogg|opus|wav)$/i.test(url.pathname) || /\/img\/.+\.(webp|png|jpe?g|avif|svg)$/i.test(url.pathname)) {
    event.respondWith(
      caches.open(CACHE).then(cache => cache.match(url.href).then(hit => hit || fetch(url.href).then(res => {
        if (res.ok && res.status === 200 && res.type === 'basic') cache.put(url.href, res.clone());
        return res;
      })))
    );
    return;
  }
  event.respondWith(
    caches.match(req).then(cached => {
      const network = fetch(req).then(res => {
        const noStore = /no-store/i.test(res.headers.get('Cache-Control') || '');
        if (res.ok && res.status === 200 && res.type === 'basic' && !noStore) {
          const copy = res.clone();
          caches.open(CACHE).then(cache => cache.put(req, copy));
        }
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});
