const CACHE_NAME = "little-lantern-shell-v1";
const MAX_CACHED_FILE_BYTES = 20 * 1024 * 1024;

self.addEventListener("install", event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(["./", "./manifest.webmanifest", "./icons/icon-192.png", "./icons/icon-512.png"]);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate", event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(name => name.startsWith("little-lantern-") && name !== CACHE_NAME).map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === "navigate") {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE_NAME);
      try {
        const response = await fetch(request);
        if (response.ok) await cache.put("./", response.clone());
        return response;
      } catch {
        return (await cache.match(request)) || (await cache.match("./"));
      }
    })());
    return;
  }

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    const size = Number(response.headers.get("content-length")) || 0;
    if (response.ok && size <= MAX_CACHED_FILE_BYTES) {
      event.waitUntil(cache.put(request, response.clone()));
    }
    return response;
  })());
});
