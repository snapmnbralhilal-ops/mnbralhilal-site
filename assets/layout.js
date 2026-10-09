/* الهيدر والقائمة والفوتر المشتركة لكل صفحات الموقع.
   أي تعديل على القائمة أو الروابط يصير هنا مرة وحدة ويطلع في كل الصفحات.
   كل صفحة تحدد اسمها في <body data-page="...">. */
(function () {
  const PAGE = document.body.dataset.page || "home";

  // روابط القائمة: [المعرّف، الاسم، الرابط، الأيقونة، يظهر في شريط الجوال السفلي؟، رابط أساسي في القائمة؟]
  // الروابط الأساسية (آخر قيمة true) تظهر في القائمة، والباقي تحت "المزيد"
  const NAV = [
    ["home", "الرئيسية", "index.html", "home", true, true],
    ["matches", "المباريات", "matches.html", "cal", true, true],
    ["standings", "الترتيب", "standings.html", "trophy", false, true],
    ["play", "العب", "play.html", "ball", true, true],
    ["designs", "التصاميم", "designs.html", "image", true, true],
    ["videos", "فيديو", "videos.html", "play", true, true],
    ["matchday", "مركز المباراة", "matchday.html", "bolt", false, false],
    ["news", "الأخبار", "news.html", "news", false, false],
    ["stats", "الإحصائيات", "stats.html", "chart", false, false],
    ["youth", "الفئات السنية", "youth.html", "users", false, false],
    ["occasions", "المناسبات", "occasions.html", "history", false, false],
    ["founding", "69 عاماً", "founding.html", "star", false, false],
    ["settings", "الإعدادات", "settings.html", "bell", false, false]
  ];
  const MAIN = NAV.filter((n) => n[5]), MORE = NAV.filter((n) => !n[5]);
  const TITLES = { occasions: "مناسبات الهلال", stats: "إحصائيات اللاعبين", admin: "لوحة التحكم", matchday: "مركز المباراة", play: "العب مع منبر", founding: "ذكرى التأسيس", home: "كرة القدم", matches: "المباريات", standings: "الترتيب", designs: "التصاميم", videos: "فيديو", news: "الأخبار", youth: "الفئات السنية", settings: "الإعدادات" };

  const SPRITE = `<svg width="0" height="0" style="position:absolute" aria-hidden="true">
  <symbol id="i-sun" viewBox="0 0 24 24"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></symbol>
  <symbol id="i-moon" viewBox="0 0 24 24"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></symbol>
  <symbol id="i-bell" viewBox="0 0 24 24"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0"/></symbol>
  <symbol id="i-dots" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol>
  <symbol id="i-home" viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/></symbol>
  <symbol id="i-plane" viewBox="0 0 24 24"><path d="M21 16v-2l-8-5V3.5a1.5 1.5 0 0 0-3 0V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5z" fill="currentColor" stroke="none"/></symbol>
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
      <span class="brand"><b>منبر الهــلال</b><span>MNBRALHILAL</span></span>
    </a>
    <button type="button" class="hd-bell" data-push="icon" hidden aria-label="تنبيهات المباريات والأهداف">${icon("bell")}</button>
    <button type="button" class="hd-theme" id="themeBtn" aria-label="تبديل الستايل بين الفاتح والكحلي" title="فاتح / كحلي"><svg class="i i-moon"><use href="#i-moon"/></svg><svg class="i i-sun"><use href="#i-sun"/></svg></button>
  </div>
  <div class="subnav"><div class="wrap">
    <strong class="sect">${TITLES[PAGE] || ""}</strong>
    <nav class="nav" aria-label="أقسام الموقع">
      ${MAIN.map(([id, name, href]) => `<a href="${href}"${cur(id)}>${name}</a>`).join("")}
      <details class="nav-more${MORE.some((n) => n[0] === PAGE) ? " cur" : ""}"><summary>المزيد${icon("dots")}</summary>
        <div class="nav-more-menu">${MORE.map(([id, name, href, ic]) => `<a href="${href}"${cur(id)}>${icon(ic)}${name}</a>`).join("")}</div>
      </details>
    </nav>
  </div></div>
</header>`;
  document.currentScript.insertAdjacentHTML("afterend", header);

  // تبديل الستايل: فاتح (الافتراضي) أو كحلي، ويتذكر اختيار الزائر
  const THEME_COLOR = { light: "#E4E6EA", dark: "#070B16" };
  const setTheme = (t, anim) => {
    const h = document.documentElement;
    if (anim) { h.classList.add("theme-anim"); setTimeout(() => h.classList.remove("theme-anim"), 450); }
    h.dataset.theme = t;
    try { localStorage.setItem("mnbr-theme", t); } catch (e) {}
    const m = document.querySelector('meta[name="theme-color"]'); if (m) m.content = THEME_COLOR[t] || THEME_COLOR.light;
    const b = document.getElementById("themeBtn"); if (b) b.setAttribute("aria-pressed", t === "dark");
  };
  setTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  document.getElementById("themeBtn").addEventListener("click", () => setTheme(document.documentElement.dataset.theme === "dark" ? "light" : "dark", true));

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
      // زر جرس التنبيهات في الهيدر يشتغل في كل الصفحات
      if (![...document.scripts].some((s) => /push\.js/.test(s.src))) {
        const s = document.createElement("script"); s.src = "assets/push.js?v=202610091700"; s.defer = true; document.body.appendChild(s);
      }
      // ظهور ناعم للأقسام وقت النزول
      if ("IntersectionObserver" in window && !matchMedia("(prefers-reduced-motion: reduce)").matches) {
        const els = [...document.querySelectorAll("main section.box, main .reach, main .v-promo")];
        els.forEach((e) => e.classList.add("rv"));
        const io = new IntersectionObserver((es) => es.forEach((x) => { if (x.isIntersecting) { x.target.classList.add("in"); io.unobserve(x.target); } }), { rootMargin: "0px 0px -6% 0px" });
        els.forEach((e) => io.observe(e));
        setTimeout(() => els.forEach((e) => e.classList.add("in")), 3500);
      }
      // قائمة "المزيد" تنقفل لما تضغط برا
      document.addEventListener("click", (e) => { document.querySelectorAll("details.nav-more[open]").forEach((d) => { if (!d.contains(e.target)) d.open = false; }); });
    }
  };
})();
