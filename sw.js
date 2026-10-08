/* منبر الهلال — يخلي الموقع يشتغل كتطبيق ويفتح بسرعة حتى مع نت ضعيف */
const CACHE = "mnbr-202610080809";
const CORE = ["./", "./index.html", "./videos.html", "./founding.html", "./play.html", "./manifest.webmanifest",
  "./assets/logo.png", "./assets/icon-192.png",
  "./assets/fonts/ExpoArabic-Book.woff", "./assets/fonts/ExpoArabic-Bold.woff"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener("fetch", (e) => {
  const req = e.request;
  const url = new URL(req.url);
  if (req.method !== "GET" || url.origin !== location.origin) return;
  const fresh = url.pathname.includes("/data/") || req.mode === "navigate" || /\.(html|js|css)$/.test(url.pathname);
  if (fresh) {
    // البيانات والصفحات: من النت أولاً، ولو النت مقطوع من النسخة المحفوظة
    e.respondWith(fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }).catch(() => caches.match(req, { ignoreSearch: true })));
  } else {
    // الصور والخطوط: من المحفوظ أولاً (أسرع)
    // نحفظ بس اللي تحمّل صح — عشان صورة فشلت مرة ما تنحفظ فاشلة للأبد
    e.respondWith(caches.match(req).then((hit) => (hit && hit.ok ? hit : fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    }))));
  }
});
