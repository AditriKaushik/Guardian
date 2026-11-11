// Market Compass service worker: app shell works offline; live data is always fetched fresh first.
const CACHE = "market-compass-v1";
const SHELL = ["./", "index.html", "app.js", "style.css", "manifest.webmanifest", "icon.svg", "icon-192.png", "icon-512.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL))); self.skipWaiting(); });
self.addEventListener("activate", e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k.startsWith("market-compass-") && k !== CACHE).map(k => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", e => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== location.origin) return;
  const live = url.pathname.endsWith(".json");
  if (live) {  // network first, cached copy only if offline
    e.respondWith(fetch(e.request).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(url.pathname, cp)); return r; })
      .catch(() => caches.match(url.pathname)));
  } else {     // shell: cache first, refresh in background
    e.respondWith(caches.match(e.request).then(hit => {
      const net = fetch(e.request).then(r => { const cp = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cp)); return r; }).catch(() => hit);
      return hit || net;
    }));
  }
});
