const CACHE_NAME = "banco-horas-v45";
const APP_SHELL = [
  "./",
  "./index.html",
  "./assets/css/style.css",
  "./assets/js/theme-init.js",
  "./assets/js/calculations.js",
  "./assets/js/repository.js",
  "./assets/js/use-cases.js",
  "./assets/js/runtime-config.js",
  "./assets/js/monitoring.js",
  "./assets/js/time-input.js",
  "./assets/js/vendor/fflate.min.js",
  "./assets/js/forponto-import.js",
  "./assets/js/script.js",
  "./manifest.webmanifest",
  "./assets/images/favicon.webp",
  "./assets/images/apple-touch-icon.png",
  "./assets/images/logo-controladoria-cds.webp",
  "./assets/images/pwa-icon-192.png",
  "./assets/images/pwa-icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET" || new URL(event.request.url).origin !== self.location.origin) return;
  event.respondWith(
    fetch(event.request).then((response) => {
      if (response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
      }
      return response;
    }).catch(() => caches.match(event.request).then((cached) => cached || (event.request.mode === "navigate" ? caches.match("./index.html") : Response.error())))
  );
});
