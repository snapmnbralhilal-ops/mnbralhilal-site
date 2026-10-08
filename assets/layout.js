/* الهيدر والقائمة والفوتر المشتركة لكل صفحات الموقع.
   أي تعديل على القائمة أو الروابط يصير هنا مرة وحدة ويطلع في كل الصفحات.
   كل صفحة تحدد اسمها في <body data-page="...">. */
(function () {
  const PAGE = document.body.dataset.page || "home";

  // روابط القائمة: [المعرّف، الاسم، الرابط، الأيقونة، يظهر في شريط الجوال السفلي؟]
  const NAV = [
    ["home", "الرئيسية", "index.html", "home", true],
    ["founding", "69 عاماً", "founding.html", "star", false],
    ["matches", "المباريات", "matches.html", "cal", true],
    ["play", "العب", "play.html", "ball", true],
    ["matchday", "مركز المباراة", "matchday.html", "bolt", false],
    ["standings", "الترتيب", "standings.html", "trophy", false],
    ["designs", "التصاميم", "designs.html", "image", true],
    ["videos", "فيديو", "videos.html", "play", true],
    ["news", "الأخبار", "news.html", "news", false],
    ["youth", "الفئات السنية", "youth.html", "users", false]
  ];
  const TITLES = { admin: "لوحة التحكم", matchday: "مركز المباراة", play: "العب مع منبر", founding: "ذكرى التأسيس", home: "كرة القدم", matches: "المباريات", standings: "الترتيب", designs: "التصاميم", videos: "فيديو", news: "الأخبار", youth: "الفئات السنية" };

  const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="i-home" viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></symbol>
  <symbol id="i-play" viewBox="0 0 24 24"><rect x="2" y="4" width="20" height="16" rx="4"/><path d="m10 9 5 3-5 3z"/></symbol>
  <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></symbol>
  <symbol id="i-trophy" viewBox="0 0 24 24"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4zM17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/></symbol>
  <symbol id="i-users" viewBox="0 0 24 24"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/><circle cx="9" cy="7" r="4"/></symbol>
  <symbol id="i-globe" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></symbol>
  <symbol id="i-news" viewBox="0 0 24 24"><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-2 2zm0 0a2 2 0 0 1-2-2v-9c0-1.1.9-2 2-2h2M18 14h-8M15 18h-5M10 6h8v4h-8z"/></symbol>
  <symbol id="i-cal" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></symbol>
  <symbol id="i-history" viewBox="0 0 24 24"><path d="M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5M12 7v5l4 2"/></symbol>
  <symbol id="i-chart" viewBox="0 0 24 24"><path d="M3 3v18h18M7 16v-4M12 16V8M17 16v-7"/></symbol>
  <symbol id="i-list" viewBox="0 0 24 24"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></symbol>
  <symbol id="i-bolt" viewBox="0 0 24 24"><path d="M13 2 3 14h9l-1 8 10-12h-9l1-8z"/></symbol>
  <symbol id="i-star" viewBox="0 0 24 24"><path d="m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></symbol>
  <symbol id="i-pin" viewBox="0 0 24 24"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></symbol>
  <symbol id="i-ball" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path d="m12 7 4 3-1.5 4.5h-5L8 10zM12 7V2.5M16 10l4.5-1.5M14.5 14.5l2.5 4M9.5 14.5 7 18.5M8 10 3.5 8.5"/></symbol>
  <symbol id="i-image" viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.1-3.1a2 2 0 0 0-2.8 0L6 21"/></symbol>
  <symbol id="i-arrow" viewBox="0 0 24 24"><path d="M15 6l-6 6 6 6"/></symbol>
</svg>`;

  // التطبيق (PWA): ملف التعريف + أيقونة الآيفون + شريط التثبيت — لكل الصفحات من مكان واحد
  (function () {
    const h = document.head;
    if (!h.querySelector('link[rel="manifest"]')) h.insertAdjacentHTML("beforeend",
      '<link rel="manifest" href="manifest.webmanifest"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="منبر الهلال">');
    const s = document.createElement("script"); s.src = "assets/pwa.js?v=2"; s.defer = true; h.appendChild(s);
  })();

  const icon = (n) => `<svg class="i"><use href="#i-${n}"/></svg>`;
  const cur = (id) => (id === PAGE ? ' aria-current="page"' : "");

  const header = `${SPRITE}
<a class="skip" href="#main">تخطَّ إلى المحتوى</a>
<header class="mast">
  <div class="wrap top">
    <a href="index.html" class="brandlink" aria-label="منبر الهلال — الرئيسية">
      <span class="logo" role="img" aria-label="شعار منبر الهلال"></span>
      <span class="brand"><b>منبر الهلال</b><span>MNBRALHILAL</span></span>
    </a>
  </div>
  <div class="subnav"><div class="wrap">
    <strong class="sect">${TITLES[PAGE] || ""}</strong>
    <nav class="nav" aria-label="أقسام الموقع">
      ${NAV.map(([id, name, href]) => `<a href="${href}"${cur(id)}>${name}</a>`).join("")}
    </nav>
  </div></div>
</header>`;
  document.currentScript.insertAdjacentHTML("afterend", header);

  // الجزء السفلي: الرعاة + تابعنا + الفوتر + شريط الجوال + عارض التصاميم
  window.LAYOUT = {
    foot() {
      const html = `
<section class="sponsors" id="sponsors" hidden aria-label="رعاة منبر الهلال">
  <div class="wrap"><h2>${icon("star")}رعاة منبر الهلال</h2></div>
  <div class="sp-marquee"><div class="sp-track" id="spList"></div></div>
</section>
<section class="follow" aria-label="تابعنا">
  <div class="wrap"><h2>تابعنا</h2><div class="social" hidden></div></div>
</section>
<footer>
  <div class="wrap">
    <span class="f-brand"><span class="logo" aria-hidden="true"></span>منبر الهلال · المركز الرياضي</span>
    <nav class="f-links" aria-label="روابط">${NAV.map(([id, name, href]) => `<a href="${href}">${name}</a>`).join("")}</nav>
    <span class="demo"><span class="dot"></span><span id="updated">جاري التحديث…</span></span>
  </div>
</footer>
<nav class="tabbar" aria-label="التنقل السريع">
  ${NAV.filter((n) => n[4]).map(([id, name, href, ic]) => `<a href="${href}"${cur(id)}>${icon(ic)}<span>${name}</span></a>`).join("")}
</nav>
<dialog id="lightbox" aria-label="عرض التصميم">
  <div class="lb-inner">
    <div class="lb-top"><b id="lbTitle"></b><button type="button" id="lbClose" aria-label="إغلاق">✕</button></div>
    <img id="lbImg" alt="">
    <div class="lb-actions">
      <a id="lbDownload" class="lb-btn primary" download>تحميل</a>
      <button type="button" id="lbShare" class="lb-btn">مشاركة</button>
      <a id="lbWa" class="lb-btn" target="_blank" rel="noopener">واتساب</a>
      <a id="lbX" class="lb-btn" target="_blank" rel="noopener">X</a>
    </div>
  </div>
</dialog>`;
      document.currentScript.insertAdjacentHTML("beforebegin", html);
    }
  };
})();
