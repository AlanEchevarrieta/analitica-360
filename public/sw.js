const CACHE = 'analitica-360-v1'
const OFFLINE_MSG =
  'Sin conexión — los datos se sincronizarán cuando vuelvas a conectarte'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) =>
      cache.addAll(['/', '/manifest.json', '/icon-192.png', '/icon-512.png', '/favicon.svg']),
    ),
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
    ),
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return

  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req).catch(async () => {
        const cached = await caches.match('/')
        if (cached) return cached
        return new Response(
          `<!doctype html><html lang="es"><meta charset="utf-8"><title>Sin conexión</title><body style="font-family:Inter,system-ui,sans-serif;background:#080C14;color:#F1F5F9;display:flex;min-height:100vh;align-items:center;justify-content:center;margin:0;padding:24px;text-align:center"><p>${OFFLINE_MSG}</p></body></html>`,
          { headers: { 'Content-Type': 'text/html; charset=utf-8' } },
        )
      }),
    )
    return
  }

  event.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit
      return fetch(req)
        .then((res) => {
          if (res.ok && req.url.startsWith(self.location.origin)) {
            const copy = res.clone()
            void caches.open(CACHE).then((cache) => cache.put(req, copy))
          }
          return res
        })
        .catch(() => new Response(OFFLINE_MSG, { status: 503, statusText: 'Offline' }))
    }),
  )
})
