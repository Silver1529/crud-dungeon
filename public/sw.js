// public/sw.js
// EDUCATIONAL: Service Worker NETWORK-FIRST. Sempre tenta a rede; só usa o
// cache se estiver offline. Isso evita o "deploy não atualiza" — o problema
// clássico de SW cache-first onde browsers ficam servindo versão antiga
// indefinidamente mesmo após o servidor ter atualizado.
//
// Estratégia:
// - install: skipWaiting (ativa imediatamente, sem esperar abas fecharem)
// - activate: claim + apaga caches antigos
// - fetch: network-first, fallback pro cache só em falha de rede
const CACHE = 'cruddungeon-v3';

self.addEventListener('install', () => {
  // EDUCATIONAL: skipWaiting força o SW novo a ativar imediatamente,
  // mesmo que o antigo ainda esteja controlando abas abertas.
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    // Apaga TODO cache que não seja o atual — invalida v1, v2, etc.
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // API sempre direto na rede, sem tocar no cache
  if (url.pathname.startsWith('/api/')) return;
  if (e.request.method !== 'GET') return;
  // Chunks do Next (immutable hashed assets) podem usar cache normal do browser
  if (url.pathname.startsWith('/_next/static/')) return;

  e.respondWith((async () => {
    try {
      const fresh = await fetch(e.request, { cache: 'no-cache' });
      if (fresh.ok && url.origin === self.location.origin) {
        const clone = fresh.clone();
        caches.open(CACHE).then((c) => c.put(e.request, clone)).catch(() => {});
      }
      return fresh;
    } catch {
      const cached = await caches.match(e.request);
      if (cached) return cached;
      // Última tentativa — falha graciosa
      return new Response('offline', { status: 503, statusText: 'Offline' });
    }
  })());
});

// EDUCATIONAL: permite que o cliente force update via postMessage.
self.addEventListener('message', (e) => {
  if (e.data === 'SKIP_WAITING') self.skipWaiting();
});
