/* الواجهة الجديدة (v2) — هيدر مبسّط + قائمة سفلية بخمس أقسام
   كل صفحة تحدد نفسها عبر <body data-page="..."> و data-section="home|matches|play|hilal|media" */
(function () {
  const PAGE = document.body.dataset.page || "home";
  const SECTION = document.body.dataset.section || PAGE;

  // الخمس أقسام الرئيسية — كل قسم فيه عدة صفحات تحته
  const TABS = [
    { id: "home", label: "الرئيسية", icon: "home", href: "index.html" },
    { id: "matches", label: "المباريات", icon: "ball", href: "matches.html" },
    { id: "play", label: "العب", icon: "whistle", href: "play.html" },
    { id: "hilal", label: "الهلال", icon: "star", href: "stats.html" },
    { id: "media", label: "ميديا", icon: "img", href: "designs.html" }
  ];

  // تحت كل قسم تطلع تبويبات ثانوية (chip row) — من غيرها القائمة السفلية ما تكفي للكل
  const SUB = {
    matches: [["matches", "كل المباريات", "matches.html"], ["matchday", "مركز المباراة", "matchday.html"], ["standings", "الترتيب", "standings.html"]],
    play: [["play", "العب", "play.html"]],
    hilal: [["stats", "الإحصائيات", "stats.html"], ["youth", "الفئات السنية", "youth.html"], ["occasions", "المناسبات", "occasions.html"], ["founding", "التأسيس", "founding.html"]],
    media: [["designs", "التصاميم", "designs.html"], ["videos", "فيديو", "videos.html"], ["news", "الأخبار", "news.html"]]
  };

  const TITLES = {
    home: "الرئيسية", matches: "المباريات", matchday: "مركز المباراة", standings: "الترتيب", play: "العب مع منبر",
    stats: "إحصائيات اللاعبين", youth: "الفئات السنية", occasions: "مناسبات الهلال", founding: "ذكرى التأسيس",
    designs: "التصاميم", videos: "فيديو", news: "الأخبار", admin: "لوحة التحكم"
  };

  // تحميل أيقونات v2
  (function () {
    const s = document.createElement("script"); s.src = "assets/v2/icons.js?v=1"; s.async = false;
    document.head.appendChild(s);
    s.onload = () => window.ICON.inject();
  })();

  // PWA
  (function () {
    const h = document.head;
    if (!h.querySelector('link[rel="manifest"]')) h.insertAdjacentHTML("beforeend",
      '<link rel="manifest" href="manifest.webmanifest"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="منبر الهلال">');
    const s = document.createElement("script"); s.src = "assets/pwa.js?v=2"; s.defer = true; h.appendChild(s);
  })();

  function nav() {
    const subs = SUB[SECTION];
    const subRow = subs && subs.length > 1 ? `<nav class="v2-sub" aria-label="تبويبات القسم">${subs.map(([id, l, href]) => `<a href="${href}"${id === PAGE ? ' aria-current="page"' : ""}>${l}</a>`).join("")}</nav>` : "";
    return `<header class="v2-top">
  <div class="v2-top-in">
    <a class="v2-brand" href="index.html" aria-label="منبر الهلال — الرئيسية">
      <span class="v2-logo" aria-hidden="true"></span>
      <span class="v2-brand-t"><b>منبر الهلال</b><em>${TITLES[PAGE] || ""}</em></span>
    </a>
    <div class="v2-top-actions">
      <button type="button" class="v2-ib" data-push aria-label="فعّل التنبيهات" hidden><svg width="22" height="22" aria-hidden="true"><use href="#i2-bell"/></svg></button>
      <a class="v2-ib" href="matchday.html" aria-label="مركز المباراة"><svg width="22" height="22" aria-hidden="true"><use href="#i2-live"/></svg></a>
    </div>
  </div>
  ${subRow}
</header>`;
  }

  function tabbar() {
    return `<nav class="v2-tabs" aria-label="التنقل الرئيسي">
      ${TABS.map((t) => `<a href="${t.href}"${t.id === SECTION ? ' aria-current="page" class="on"' : ""}><svg aria-hidden="true"><use href="#i2-${t.icon}"/></svg><span>${t.label}</span></a>`).join("")}
    </nav>`;
  }

  // ادراج الهيدر مكان السكربت
  document.currentScript.insertAdjacentHTML("afterend", nav());

  window.LAYOUT = {
    foot() {
      const html = `
<section class="v2-sponsors" id="sponsors" hidden aria-label="رعاة منبر الهلال">
  <div class="v2-wrap"><h2><svg width="18" height="18" aria-hidden="true"><use href="#i2-star"/></svg>رعاة منبر الهلال</h2></div>
  <div class="sp-marquee"><div class="sp-track" id="spList"></div></div>
</section>
<section class="v2-follow" aria-label="تابعنا">
  <div class="v2-wrap"><h2>تابعنا</h2><div class="social" hidden></div></div>
</section>
<footer class="v2-foot">
  <div class="v2-wrap">
    <span class="v2-fb"><span class="v2-logo" aria-hidden="true"></span>منبر الهلال · المركز الرياضي</span>
    <span class="v2-fup"><span class="v2-dot"></span><span id="updated">جاري التحديث…</span></span>
  </div>
</footer>
${tabbar()}
<dialog id="lightbox" aria-label="عرض التصميم" class="v2-lb">
  <div class="v2-lb-in">
    <div class="v2-lb-top"><b id="lbTitle"></b><button type="button" id="lbClose" aria-label="إغلاق"><svg width="18" height="18" aria-hidden="true"><use href="#i2-close"/></svg></button></div>
    <img id="lbImg" alt="">
    <div class="v2-lb-act">
      <a id="lbDownload" class="v2-btn primary" download><svg width="16" height="16" aria-hidden="true"><use href="#i2-download"/></svg>تحميل</a>
      <button type="button" id="lbShare" class="v2-btn"><svg width="16" height="16" aria-hidden="true"><use href="#i2-share"/></svg>مشاركة</button>
      <a id="lbWa" class="v2-btn" target="_blank" rel="noopener">واتساب</a>
      <a id="lbX" class="v2-btn" target="_blank" rel="noopener">X</a>
    </div>
  </div>
</dialog>`;
      document.currentScript.insertAdjacentHTML("beforebegin", html);
    }
  };
})();
