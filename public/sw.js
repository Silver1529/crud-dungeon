// public/sw.js
// EDUCATIONAL: service worker minimalista. Cacheia shell + estáticos para
// offline-first; passa requests à API direto para a rede.
const CACHE = 'cruddungeon-v1';
const SHELL = ['/', '/manifest.json'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).catch(() => {}));
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (url.pathname.startsWith('/api/')) return; // API sempre ao vivo
  if (e.request.method !== 'GET') return;

  e.respondWith(
    caches.match(e.request).then(
      (cached) =>
        cached ||
        fetch(e.request)
          .then((res) => {
            if (res.ok && url.origin === self.location.origin) {
              const clone = res.clone();
              caches.open(CACHE).then((c) => c.put(e.request, clone)).catch(() => {});
            }
            return res;
          })
          .catch(() => cached)
    )
  );
});
