const CACHE_NAME = 'analitica-360-v2';
const STATIC_ASSETS = [
  '/',
  '/manifest.json',
  '/favicon.svg',
  '/icon-192.png',
  '/icon-512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Solo peticiones GET
  if (req.method !== 'GET') return;

  // No interceptar llamadas a la API backend ni proveedores de autenticación
  if (
    url.pathname.startsWith('/api/') ||
    url.hostname.includes('clerk') ||
    url.hostname !== self.location.hostname
  ) {
    return;
  }

  // Navegación HTML (Network First con fallback a caché y página offline)
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => {
        const cached = await caches.match(req);
        if (cached) return cached;
        const indexCached = await caches.match('/');
        if (indexCached) return indexCached;
        return new Response(
          '<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Analítica 360 - Sin conexión</title><body style="font-family:system-ui,-apple-system,sans-serif;background:#080C14;color:#F1F5F9;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px;text-align:center"><div><h2 style="color:#00E5C9;margin-bottom:8px">Analítica 360</h2><p style="color:#94A3B8">Sin conexión a internet. Los datos se sincronizarán al reconectarte.</p></div></body></html>',
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } }
        );
      })
    );
    return;
  }

  // Recursos estáticos (Stale-While-Revalidate para imágenes, iconos y fuentes)
  if (url.pathname.match(/\.(png|svg|ico|jpg|jpeg|webp|woff2|woff|ttf|css)$/)) {
    event.respondWith(
      caches.match(req).then((hit) => {
        const fetchPromise = fetch(req)
          .then((networkRes) => {
            if (networkRes.ok) {
              const copy = networkRes.clone();
              void caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
            }
            return networkRes;
          })
          .catch(() => hit);
        return hit || fetchPromise;
      })
    );
    return;
  }

  // Resto de peticiones: Red primero con fallback a caché
  event.respondWith(
    fetch(req).catch(() => caches.match(req))
  );
});
