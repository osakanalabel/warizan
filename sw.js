// オフラインで使えるようにする。ファイルを足したら PRECACHE に足して、
// CACHE_NAME のばんごうを上げること（上げないと古いファイルが残る）。

const CACHE_NAME = 'warizan-v5';

const PRECACHE = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/style.css',
  './src/app.js',
  './src/storage.js',
  './src/core/problem.js',
  './src/core/steps.js',
  './src/core/judge.js',
  './src/core/stats.js',
  './src/core/titles.js',
  './src/core/rng.js',
  './src/ui/grid.js',
  './src/ui/keypad.js',
  './src/ui/screens.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.match(request).then((hit) => {
      if (hit) return hit;
      return fetch(request)
        .then((response) => {
          if (response && response.ok && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => {
          // オフラインで見つからないときは、画面だけは出す
          if (request.mode === 'navigate') return caches.match('./index.html');
          return Response.error();
        });
    }),
  );
});
