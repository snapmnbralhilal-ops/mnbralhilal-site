/* تنبيهات منبر الهلال — جرس الهيدر لتنبيهات الهلال + دعم تنبيهات مباريات روشن (window.PUSH) */
(function () {
  const ua = navigator.userAgent;
  const isIOS = /iPhone|iPad|iPod/.test(ua);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  const b64 = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
  let API = null;
  const api = async () => API || (API = await fetch("data/live.json?t=" + Date.now()).then((r) => r.json()).then((j) => j.url.replace(/\/live$/, "")));
  const reg = () => navigator.serviceWorker.register("sw.js").then(() => navigator.serviceWorker.ready);

  function tip(text) {
    let toast = document.getElementById("pushToast");
    if (!toast) { toast = document.createElement("div"); toast.id = "pushToast"; toast.className = "push-toast"; toast.setAttribute("role", "status"); document.body.appendChild(toast); }
    toast.textContent = text; toast.classList.add("show");
    clearTimeout(tip._t); tip._t = setTimeout(() => toast.classList.remove("show"), 6000);
  }

  // -------- subscription management --------
  async function current() {
    if (!supported) return { state: "off", sub: null };
    if (Notification.permission === "denied") return { state: "denied", sub: null };
    const r = await navigator.serviceWorker.getRegistration();
    const s = r && (await r.pushManager.getSubscription());
    return s ? { state: "on", sub: s } : { state: "off", sub: null };
  }

  // يرجّع subscription موجودة أو ينشئ وحدة بعد طلب الإذن. يرمي استثناء لو ما قدر.
  async function ensure(opts = {}) {
    if (isIOS && !standalone) {
      tip("على الآيفون: ثبّت منبر الهلال على الشاشة الرئيسية أول (زر المشاركة ⬆︎ ← إضافة إلى الشاشة الرئيسية)، وافتحه من هناك وفعّل التنبيهات.");
      throw new Error("ios-not-standalone");
    }
    if (!supported) { tip("متصفحك ما يدعم الإشعارات."); throw new Error("not-supported"); }
    if (Notification.permission === "denied") {
      tip("فعّل الإشعارات لهذا الموقع من إعدادات المتصفح، وبعدها اضغط الزر مرة ثانية.");
      throw new Error("perm-denied");
    }
    const r = await reg();
    let s = await r.pushManager.getSubscription();
    const base = await api();
    if (!s) {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") throw new Error("perm-" + perm);
      const { key } = await fetch(base + "/push/key").then((x) => x.json());
      s = await r.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64(key) });
      // إنشاء السجل في الـworker. الحارس: hilal=true إلا لو هذا اشتراك جديد لمباراة فقط
      const body = { sub: s.toJSON() };
      if (opts.hilal === false) body.hilal = false;
      const res = await fetch(base + "/push/sub", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error("sub-failed");
    }
    return { sub: s, base };
  }

  async function toggleHilal() {
    if (STATE.perm === "denied") { tip("فعّل الإشعارات لهذا الموقع من إعدادات المتصفح، وبعدها اضغط الزر مرة ثانية."); return; }
    if (isIOS && !standalone) {
      tip("على الآيفون: ثبّت منبر الهلال على الشاشة الرئيسية أول (زر المشاركة ⬆︎ ← إضافة إلى الشاشة الرئيسية)، وافتحه من هناك وفعّل التنبيهات.");
      return;
    }
    paintAll("busy");
    try {
      const base = await api();
      if (STATE.hilal) {
        // إيقاف الهلال فقط؛ لو مافي مباريات أخرى، نلغي الاشتراك كامل
        const st = await current();
        if (st.state === "on") {
          if (STATE.fx.length) {
            await fetch(base + "/push/prefs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sub: st.sub.toJSON(), hilal: false }) });
            tip("وقّفنا تنبيهات الهلال. مباريات روشن اللي اخترتها لسا مفعّلة.");
          } else {
            await fetch(base + "/push/unsub", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sub: st.sub.toJSON() }) }).catch(() => {});
            await st.sub.unsubscribe();
            tip("وقّفنا التنبيهات.");
          }
        }
        await refresh();
        return;
      }
      // تفعيل الهلال
      const { sub } = await ensure({ hilal: true });
      await fetch(base + "/push/prefs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sub: sub.toJSON(), hilal: true }) }).catch(() => {});
      tip("تمام ✅ بنرسل لك: قبل المباراة بساعة، كل هدف للهلال، ونهاية المباراة.");
      await refresh();
    } catch (e) {
      await refresh();
    }
  }

  // -------- UI: جرس الهيدر وأزرار data-push --------
  let STATE = { hilal: false, fx: [], perm: "off" }; // cache
  const LABEL = { on: "التنبيهات مفعّلة — اضغط للإيقاف", busy: "جاري…", denied: "التنبيهات مقفلة من إعدادات المتصفح", off: "فعّل تنبيهات الهلال" };
  function paintAll(force) {
    const st = force || (STATE.perm === "denied" ? "denied" : STATE.hilal ? "on" : "off");
    document.querySelectorAll("[data-push]").forEach((b) => {
      if (b.dataset.push === "icon") {
        b.hidden = st === "denied";
        b.classList.toggle("on", st === "on");
        b.disabled = st === "busy";
        b.title = LABEL[st] || ""; b.setAttribute("aria-label", LABEL[st] || "");
        return;
      }
      b.hidden = st === "denied";
      b.classList.toggle("on", st === "on");
      b.disabled = st === "busy";
      const txt = st === "on" ? "🔔 تنبيهات الهلال مفعّلة — اضغط للإيقاف" : st === "busy" ? "جاري…" : st === "denied" ? "🔕 التنبيهات مقفلة من إعدادات المتصفح" : "🔔 فعّل تنبيهات الهلال";
      // نغيّر النص بس لو اختلف — تغييره يطلق الـMutationObserver تحت ويدخلنا في حلقة لا نهائية تجمّد الصفحة
      if (b.textContent !== txt) b.textContent = txt;
    });
    // أزرار الجرس بجنب مباريات روشن
    document.querySelectorAll("[data-fx-bell]").forEach((b) => {
      const on = STATE.fx.map(String).includes(String(b.dataset.fxId));
      b.classList.toggle("on", on);
      b.setAttribute("aria-label", on ? "إيقاف تنبيهات هذه المباراة" : "تفعيل تنبيهات هذه المباراة");
      b.title = b.getAttribute("aria-label");
    });
  }
  async function refresh() {
    try {
      STATE.perm = Notification.permission;
      const st = await current();
      if (st.state !== "on") { STATE = { hilal: false, fx: [], perm: STATE.perm }; paintAll(); return; }
      const base = await api();
      const r = await fetch(base + "/push/mine", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sub: st.sub.toJSON() }) });
      const j = await r.json();
      STATE.hilal = !!j.hilal;
      STATE.fx = (j.fx || []).map(String);
    } catch (e) { STATE.fx = []; STATE.hilal = false; }
    paintAll();
  }

  // اشتراك/إلغاء مباراة محددة
  async function toggleMatch(meta) {
    // meta: {id, kickoff(ISO), home, away, league}
    try {
      const { sub, base } = await ensure({ hilal: STATE.hilal });  // لو هذا أول تفعيل: hilal سيكون false
      const fid = String(meta.id);
      const on = !STATE.fx.includes(fid);
      const body = { sub: sub.toJSON(), on, fx: { id: fid, kickoff: new Date(meta.kickoff).getTime(), home: meta.home, away: meta.away, league: meta.league || "" } };
      const r = await fetch(base + "/push/match", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      if (!r.ok) throw new Error("match");
      const j = await r.json();
      STATE.fx = (j.fx || []).map(String);
      paintAll();
      tip(on ? `بنرسل لك إشعار لأهداف ${meta.home} × ${meta.away} ونهاية المباراة.` : `وقّفنا تنبيهات ${meta.home} × ${meta.away}.`);
    } catch (e) {
      await refresh();
    }
  }

  // إيقاف شامل
  async function offAll() {
    const st = await current();
    if (st.state !== "on") { STATE = { hilal: false, fx: [], perm: Notification.permission }; paintAll(); return; }
    try {
      const base = await api();
      await fetch(base + "/push/unsub", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sub: st.sub.toJSON() }) }).catch(() => {});
      await st.sub.unsubscribe();
      STATE = { hilal: false, fx: [], perm: Notification.permission };
      paintAll();
      tip("أوقفنا كل التنبيهات.");
    } catch (e) { await refresh(); }
  }

  // تحديث تفضيل الهلال فقط (للـsettings)
  async function setHilal(on) {
    try {
      if (on) {
        const { sub, base } = await ensure({ hilal: true });
        await fetch(base + "/push/prefs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sub: sub.toJSON(), hilal: true }) });
      } else {
        const st = await current();
        if (st.state !== "on") return;
        const base = await api();
        await fetch(base + "/push/prefs", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sub: st.sub.toJSON(), hilal: false }) });
      }
      await refresh();
    } catch (e) { await refresh(); }
  }

  // ربط أزرار data-push (جرس الهيدر) و data-fx-bell (جرس كل مباراة)
  function bind() {
    document.querySelectorAll("[data-push]").forEach((b) => { if (!b._bound) { b._bound = true; b.onclick = toggleHilal; } });
    document.querySelectorAll("[data-fx-bell]").forEach((b) => {
      if (b._bound) return; b._bound = true;
      b.onclick = () => toggleMatch({ id: b.dataset.fxId, kickoff: b.dataset.fxKick, home: b.dataset.fxHome, away: b.dataset.fxAway, league: b.dataset.fxLeague });
    });
  }

  // متاح للسكربتات الأخرى
  window.PUSH = { refresh, bind, toggleMatch, setHilal, offAll, state: () => ({ ...STATE }) };

  // تشغيل أولي
  bind();
  refresh().catch(() => {});
  // أي DOM يتضاف لاحقاً (مثل صفوف المباريات) — ارتبط فيه
  // نتجاهل التغييرات اللي داخل أزرارنا نفسها، ونرسم مرة وحدة بالإطار كحد أقصى
  let moQueued = false;
  const mine = (n) => n.nodeType === 1 ? n.closest?.("[data-push],[data-fx-bell]") : n.parentElement?.closest?.("[data-push],[data-fx-bell]");
  const mo = new MutationObserver((muts) => {
    if (moQueued || muts.every((m) => mine(m.target))) return;
    moQueued = true;
    requestAnimationFrame(() => { moQueued = false; bind(); paintAll(); }); // عيّن حالة الجرس للمباريات الجديدة
  });
  mo.observe(document.body, { childList: true, subtree: true });
})();
