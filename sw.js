// Mantém o app funcionando sem internet depois da primeira visita.
// Estratégia "rede primeiro": online sempre busca a versão nova; offline usa a cópia salva.
const CACHE = 'cubo-3d-v2';
const PRECACHE = [
  './',
  'index.html',
  'styles.css',
  'app.js',
  'cube3d.js',
  'vendor/three/three.min.js',
  'vendor/three/OrbitControls.js',
  'vendor/cubejs/async.js',
  'manifest.webmanifest',
  'favicon.ico',
  'icons/icon.svg',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'icons/apple-touch-icon.png',
  'icons/favicon-32.png',
  'vendor/cubejs/worker.js',
  'vendor/cubejs/cube.js',
  'vendor/cubejs/solve.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(request)
      .then((response) => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then((cache) => cache.put(request, copy));
        }
        return response;
      })
      .catch(() => caches.match(request, { ignoreSearch: true })
        .then((cached) => cached || (request.mode === 'navigate' ? caches.match('index.html') : undefined))
        .then((cached) => cached || Response.error()))
  );
});
