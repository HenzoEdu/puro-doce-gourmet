const CACHE_NAME = "puro-doce-v10";
const urlsToCache = [
  "./",
  "./index.html?v=10",
  "./style.css?v=10",
  "./app.js?v=10",
  "./manifest.json?v=10",
  "./assets/logo.png?v=10",
  "./assets/icon-192.png?v=10",
  "./assets/icon-512.png?v=10",
  "./assets/apple-touch-icon.png?v=10"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  event.respondWith(caches.match(event.request).then((response) => response || fetch(event.request).then((networkResponse) => {
    const responseClone = networkResponse.clone();
    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
    return networkResponse;
  }).catch(() => caches.match("./index.html?v=10"))));
});