// Service Worker - Estrategia Cache First (sin async/await)
const NOMBRE_CACHE = 'geo-pwa-v1';

const ARCHIVOS_PRECACHE = [
  './',
  './index.html',
  './styles.css',
  './geo-helper.js',
  './app.js',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(NOMBRE_CACHE)
      .then((cache) => cache.addAll(ARCHIVOS_PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((nombres) => Promise.all(
        nombres
          .filter((nombre) => nombre !== NOMBRE_CACHE)
          .map((nombre) => caches.delete(nombre))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  // Solo se cachean recursos del mismo origen (el enlace a OpenStreetMap no pasa por aquí)
  if (new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(event.request)
      .then((respuestaCache) => {
        if (respuestaCache) {
          return respuestaCache;
        }
        return fetch(event.request)
          .then((respuestaRed) => {
            if (respuestaRed && respuestaRed.status === 200 && respuestaRed.type === 'basic') {
              const copia = respuestaRed.clone();
              caches.open(NOMBRE_CACHE).then((cache) => cache.put(event.request, copia));
            }
            return respuestaRed;
          });
      })
      .catch(() => caches.match('./index.html'))
  );
});
