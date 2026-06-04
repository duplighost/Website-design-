/* LUMA service worker — cache-first offline shell so it runs without a network
 * once visited (great as an installed home-screen app). */
const CACHE = "luma-v3";
const ASSETS = [
  "./",
  "index.html",
  "manifest.webmanifest",
  "assets/icon.svg",
  "css/style.css",
  "js/util.js",
  "js/gl.js",
  "js/shaders.js",
  "js/audio.js",
  "js/input.js",
  "js/director.js",
  "js/particles.js",
  "js/renderer.js",
  "js/app.js",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) =>
      Promise.allSettled(ASSETS.map((u) => c.add(new Request(u, { cache: "reload" }))))
    ).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== location.origin) return;
  e.respondWith(
    caches.match(req).then((hit) =>
      hit ||
      fetch(req).then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy)).catch(() => {});
        return res;
      }).catch(() => hit)
    )
  );
});
