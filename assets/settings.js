/* صفحة الإعدادات — تحكم بتنبيهات الهلال وقائمة مباريات روشن المشترك فيها */
(function () {
  const $ = (id) => document.getElementById(id);
  const togHilal = $("togHilal"), fxList = $("fxList"), fxCount = $("fxCount"), offAll = $("offAll"), note = $("setNote");

  const fTime = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { timeZone: "Asia/Riyadh", weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false });
  const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
  const standalone = window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  let BASE = null;

  async function base() { if (BASE) return BASE; const j = await fetch("data/live.json?t=" + Date.now()).then((r) => r.json()); BASE = j.url.replace(/\/live$/, ""); return BASE; }
  async function currentSub() { const r = await navigator.serviceWorker.getRegistration(); const s = r && (await r.pushManager.getSubscription()); return s ? s.toJSON() : null; }

  async function fetchMine() {
    const sub = await currentSub();
    if (!sub) return { hilal: false, fx: [], details: [], subscribed: false };
    try {
      const b = await base();
      const r = await fetch(b + "/push/mine", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sub }) });
      return await r.json();
    } catch (e) { return { hilal: false, fx: [], details: [], subscribed: false }; }
  }

  function envBlock() {
    const perm = ("Notification" in window) ? Notification.permission : "denied";
    const supported = "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    if (isIOS && !standalone) return "ios";
    if (!supported) return "unsupported";
    if (perm === "denied") return "denied";
    return null;
  }

  function paintBlocked(kind) {
    const msg = {
      ios: "على الآيفون: ثبّت منبر الهلال على الشاشة الرئيسية (زر المشاركة ⬆︎ ← إضافة إلى الشاشة الرئيسية)، وبعدها افتحه من هناك عشان تفعّل التنبيهات.",
      unsupported: "متصفحك ما يدعم التنبيهات. جرّب كروم أو سفاري حديث.",
      denied: "التنبيهات مقفلة من إعدادات المتصفح. فعّلها من إعدادات الموقع لهذا المتصفح، وبعدها حدّث الصفحة."
    }[kind];
    note.textContent = msg;
    togHilal.disabled = true; togHilal.classList.remove("on");
    offAll.disabled = true;
    fxCount.textContent = "—";
    fxList.innerHTML = `<p class="fx-empty">${msg}</p>`;
  }

  async function paint() {
    const blocked = envBlock();
    if (blocked) { paintBlocked(blocked); return; }
    note.textContent = "";
    togHilal.disabled = false; offAll.disabled = false;

    const mine = await fetchMine();
    togHilal.classList.toggle("on", !!mine.hilal);
    togHilal.setAttribute("aria-pressed", !!mine.hilal);
    const n = (mine.details || []).length;
    fxCount.textContent = n ? `${n} مباراة` : "—";

    if (!n) {
      fxList.innerHTML = `<p class="fx-empty">لم تشترك في أي مباراة بعد. افتح <a href="matches.html#today" style="color:var(--royal)">صفحة المباريات</a> واضغط الجرس بجنب مباراة روشن.</p>`;
      return;
    }
    const items = (mine.details || []).slice().sort((a, b) => (a.kickoff || 0) - (b.kickoff || 0)).map((d) => {
      const label = d.home && d.away ? `${d.home} × ${d.away}` : `مباراة #${d.id}`;
      const when = d.kickoff ? fTime.format(new Date(d.kickoff)) : "";
      return `<div class="fx-item" data-id="${d.id}">
        <div><b>${label}</b>${when ? `<small>${when}${d.league ? " · " + d.league : ""}</small>` : ""}</div>
        <button type="button" aria-label="إلغاء" data-off="${d.id}" data-home="${d.home || ""}" data-away="${d.away || ""}" data-kick="${d.kickoff || 0}">✕</button>
      </div>`;
    }).join("");
    fxList.innerHTML = items;
    fxList.querySelectorAll("[data-off]").forEach((b) => (b.onclick = async () => {
      b.disabled = true;
      if (window.PUSH) await window.PUSH.toggleMatch({ id: b.dataset.off, kickoff: +b.dataset.kick || Date.now(), home: b.dataset.home, away: b.dataset.away });
      paint();
    }));
  }

  togHilal.onclick = async () => {
    if (!window.PUSH || togHilal.disabled) return;
    const on = !togHilal.classList.contains("on");
    togHilal.disabled = true;
    await window.PUSH.setHilal(on);
    paint();
  };

  offAll.onclick = async () => {
    if (!window.PUSH || offAll.disabled) return;
    if (!confirm("نوقف كل التنبيهات (الهلال وكل مباريات روشن)؟ تقدر ترجّعها لاحقاً.")) return;
    await window.PUSH.offAll();
    paint();
  };

  // تحديث أولي + كل بضع ثوان في حالة تغيّر الاشتراك من مكان آخر
  paint();
  setInterval(paint, 5000);
})();
