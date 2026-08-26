const CACHE_NAME = 'eurohouse-assets-v3';
const INSTALL_ASSETS = ['/manifest.json', '/icon-192.png', '/icon-512.png', '/apple-touch-icon.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(INSTALL_ASSETS)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  const path = new URL(request.url).pathname;
  if (!INSTALL_ASSETS.includes(path)) {
    event.respondWith(fetch(request));
    return;
  }

  event.respondWith(caches.match(request).then((cached) => cached || fetch(request)));
});
