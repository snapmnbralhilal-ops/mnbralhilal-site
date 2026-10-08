/* تثبيت منبر الهلال كتطبيق على الجوال */
(function () {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
  }
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (standalone) return;

  const KEY = "mnbr-install-dismissed";
  let dismissed = 0;
  try { dismissed = +localStorage.getItem(KEY) || 0; } catch (e) {}
  if (Date.now() - dismissed < 7 * 86400000) return; // لو سكّره، ما نزعجه أسبوع

  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua) && !window.MSStream;
  const isMobile = isIOS || /Android/.test(ua);
  if (!isMobile) return;

  const bar = document.createElement("div");
  bar.className = "install-bar";
  bar.innerHTML = `<img src="assets/icon-192.png" alt="" width="40" height="40">
    <div><b>ثبّت تطبيق منبر الهلال</b><small>على شاشتك الرئيسية بضغطة</small></div>
    <button type="button" class="ib-go">تثبيت</button>
    <button type="button" class="ib-x" aria-label="إغلاق">✕</button>`;
  const close = () => { bar.remove(); try { localStorage.setItem(KEY, Date.now()); } catch (e) {} };
  bar.querySelector(".ib-x").onclick = close;

  let deferred = null;
  window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); deferred = e; show(); });
  window.addEventListener("appinstalled", () => bar.remove());

  bar.querySelector(".ib-go").onclick = async () => {
    if (deferred) { deferred.prompt(); await deferred.userChoice.catch(() => {}); deferred = null; bar.remove(); return; }
    // آيفون: ما فيه زر تثبيت تلقائي، نشرح الطريقة
    const tip = document.createElement("div");
    tip.className = "install-tip";
    tip.innerHTML = `<div class="it-card"><b>ثبّت منبر الهلال على الآيفون</b>
      <ol><li>اضغط زر <b>المشاركة</b> <span class="it-ico">⬆︎</span> تحت في سفاري</li>
      <li>انزل واختر <b>«إضافة إلى الشاشة الرئيسية»</b></li><li>اضغط <b>إضافة</b> ✓</li></ol>
      <button type="button" class="lb-btn primary">تمام</button></div>`;
    tip.onclick = (ev) => { if (ev.target === tip || ev.target.tagName === "BUTTON") tip.remove(); };
    document.body.appendChild(tip);
  };

  let shown = false;
  function show() { if (shown) return; shown = true; setTimeout(() => document.body.appendChild(bar), 2500); }
  if (isIOS) show(); // الآيفون ما يرسل beforeinstallprompt
})();
