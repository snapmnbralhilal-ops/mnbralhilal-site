/* تنبيهات منبر الهلال — أي زر فيه data-push يصير زر تفعيل/إيقاف التنبيهات */
(function () {
  const btns = [...document.querySelectorAll("[data-push]")];
  if (!btns.length) return;
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
  // الآيفون: التنبيهات تشتغل بس بعد تثبيت الموقع على الشاشة الرئيسية (iOS 16.4+)
  if (!supported && !(isIOS && !standalone)) return;

  let API = null;
  const b64 = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
  const api = async () => API || (API = await fetch("data/live.json?t=" + Date.now()).then((r) => r.json()).then((j) => j.url.replace(/\/live$/, "")));
  const reg = () => navigator.serviceWorker.register("sw.js").then(() => navigator.serviceWorker.ready);

  const LABEL = { on: "التنبيهات مفعّلة — اضغط للإيقاف", busy: "جاري…", denied: "التنبيهات مقفلة من إعدادات المتصفح", off: "فعّل تنبيهات المباريات والأهداف" };
  function paint(state) {
    btns.forEach((b) => {
      // زر الأيقونة (الجرس في الهيدر): ما نغيّر محتواه، ونخفيه لو التنبيهات مقفلة
      if (b.dataset.push === "icon") {
        b.hidden = state === "denied";
        b.classList.toggle("on", state === "on");
        b.disabled = state === "busy";
        b.title = LABEL[state] || ""; b.setAttribute("aria-label", LABEL[state] || "");
        return;
      }
      b.hidden = state === "denied";
      b.classList.toggle("on", state === "on");
      b.disabled = state === "busy";
      b.textContent = state === "on" ? "🔔 التنبيهات مفعّلة — اضغط للإيقاف" : state === "busy" ? "جاري…" : state === "denied" ? "🔕 التنبيهات مقفلة من إعدادات المتصفح" : "🔔 فعّل تنبيهات المباريات والأهداف";
    });
  }
  function tip(text) {
    // رسالة عائمة لزر الجرس (بدل ما تنحشر جوا الهيدر)
    let toast = document.getElementById("pushToast");
    if (!toast) { toast = document.createElement("div"); toast.id = "pushToast"; toast.className = "push-toast"; toast.setAttribute("role", "status"); document.body.appendChild(toast); }
    toast.textContent = text; toast.classList.add("show");
    clearTimeout(tip._t); tip._t = setTimeout(() => toast.classList.remove("show"), 6000);
  }

  async function current() {
    if (!supported) return "off";
    if (Notification.permission === "denied") return "denied";
    const r = await navigator.serviceWorker.getRegistration();
    const s = r && (await r.pushManager.getSubscription());
    return s ? "on" : "off";
  }

  async function toggle() {
    if (isIOS && !standalone) {
      tip("على الآيفون: ثبّت منبر الهلال على الشاشة الرئيسية أول (زر المشاركة ⬆︎ ← إضافة إلى الشاشة الرئيسية)، وافتحه من هناك وفعّل التنبيهات.");
      return;
    }
    const st = await current();
    if (st === "denied") { tip("فعّل الإشعارات لهذا الموقع من إعدادات المتصفح، وبعدها اضغط الزر مرة ثانية."); return; }
    paint("busy");
    try {
      const r = await reg();
      const base = await api();
      if (st === "on") {
        const s = await r.pushManager.getSubscription();
        if (s) { await fetch(base + "/push/unsub", { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify(s.toJSON()) }).catch(() => {}); await s.unsubscribe(); }
        paint("off"); tip("وقّفنا التنبيهات.");
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") { paint(perm === "denied" ? "denied" : "off"); return; }
      const { key } = await fetch(base + "/push/key").then((x) => x.json());
      const s = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
      const res = await fetch(base + "/push/sub", { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify(s.toJSON()) });
      if (!res.ok) throw new Error("sub");
      paint("on"); tip("تمام ✅ بنرسل لك: قبل المباراة بساعة، كل هدف للهلال، ونهاية المباراة.");
    } catch (e) {
      paint(await current().catch(() => "off")); tip("ما قدرنا نفعّل التنبيهات — جرّب مرة ثانية.");
    }
  }

  btns.forEach((b) => (b.onclick = toggle));
  current().then(paint).catch(() => paint("off"));
})();
