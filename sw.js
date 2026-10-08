/* منبر الهلال — يخلي الموقع يشتغل كتطبيق ويفتح بسرعة حتى مع نت ضعيف */
const CACHE = "mnbr-202610081200";
const CORE = ["./", "./index.html", "./videos.html", "./founding.html", "./play.html", "./matchday.html", "./stats.html", "./manifest.webmanifest",
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

/* تنبيهات الجوال: هدف للهلال، قبل المباراة بساعة، نهاية المباراة */
self.addEventListener("push", (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "منبر الهلال 💙", {
    body: d.body || "", icon: "assets/icon-192.png", badge: "assets/icon-192.png", dir: "rtl", lang: "ar",
    tag: d.tag || undefined, data: { url: d.url || "./" }
  }));
});
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || "./", self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
    for (const c of list) if (c.url.split("#")[0] === url.split("#")[0] && "focus" in c) { c.navigate(url).catch(() => {}); return c.focus(); }
    return self.clients.openWindow(url);
  }));
});
