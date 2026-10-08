/* لوحة تحكم منبر: ترفع التعديلات لـ GitHub عن طريق خادم منبر (Cloudflare)، والموقع يتحدث خلال دقيقة تقريباً */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  let API = null, PW = "", CAN_SAVE = false;
  try { PW = sessionStorage.getItem("mnbr-admin") || ""; } catch (e) {}

  /* ---------- أدوات ---------- */
  function toast(msg, err) {
    const t = $("toast"); t.textContent = msg; t.className = "adm-toast" + (err ? " err" : ""); t.hidden = false;
    clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), err ? 6000 : 3500);
  }
  async function call(path, init = {}) {
    const r = await fetch(API + path, { ...init, headers: { "x-admin": PW, "content-type": "text/plain", ...(init.headers || {}) } });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) {
      const m = { auth: "كلمة المرور غلط", "no-github-token": "ما فيه مفتاح GitHub — الحفظ مقفل", path: "ملف غير مسموح", files: "عدد الملفات غير صحيح" }[j.error];
      throw new Error(m || (j.detail ? "خطأ: " + j.detail : "صار خطأ (" + r.status + ")"));
    }
    return j;
  }
  const load = async (path) => (await call("/admin/file?path=" + encodeURIComponent(path))).content;
  async function commit(files, message, btn) {
    if (!CAN_SAVE) { toast("الحفظ مقفل لين يتضاف مفتاح GitHub", true); return false; }
    const old = btn && btn.textContent; if (btn) { btn.disabled = true; btn.textContent = "جاري الحفظ…"; }
    try {
      const r = await call("/admin/commit", { method: "POST", body: JSON.stringify({ files, message }) });
      toast("تم الحفظ ✅ يظهر بالموقع خلال دقيقة تقريباً (" + r.commit + ")");
      return true;
    } catch (e) { toast(e.message, true); return false; }
    finally { if (btn) { btn.disabled = false; btn.textContent = old; } }
  }
  const slug = () => Date.now().toString(36);
  const todayKey = () => new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
  // datetime-local (بتوقيت مكة) ⇄ ISO
  const toLocal = (iso) => { if (!iso) return ""; if (/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(iso) && /\+03:00$/.test(iso)) return iso.slice(0, 16);
    const d = new Date(iso); return isNaN(d) ? "" : new Date(d.getTime() + 3 * 3600e3).toISOString().slice(0, 16); };
  const fromLocal = (v) => (v ? v.slice(0, 16) + ":00+03:00" : "");

  // تصغير الصورة في الجوال قبل الرفع
  function readImage(file) {
    return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("الصورة ما انقرت")); i.src = URL.createObjectURL(file); });
  }
  async function resize(file, max, type = "image/jpeg", q = 0.86) {
    const img = await readImage(file);
    const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
    const x = c.getContext("2d");
    if (type === "image/jpeg") { x.fillStyle = "#000"; x.fillRect(0, 0, c.width, c.height); }
    x.drawImage(img, 0, 0, c.width, c.height);
    const url = c.toDataURL(type, q);
    return { base64: url.split(",")[1], url };
  }

  /* ---------- محرر قوائم عام ---------- */
  // fields: [key, label, type, opts]  type: text | textarea | number | date | datetime | check | image | select
  function listEditor(box, items, fields, { addLabel = "+ إضافة", newItem = () => ({}), title, onImage, extraBtn } = {}) {
    function draw() {
      box.innerHTML = items.map((it, i) => `<div class="adm-item" data-i="${i}"><button type="button" class="x" data-x="${i}">حذف</button>${extraBtn ? `<button type="button" class="up" data-e="${i}">${extraBtn.label}</button>` : ""}
        ${title ? `<div class="lbl" style="margin-top:12px">${esc(title(it, i))}</div>` : ""}
        <div class="adm-grid">${fields.map(([k, l, t, o]) => field(it, k, l, t, o, i)).join("")}</div></div>`).join("") +
        `<button type="button" class="lb-btn adm-add">${addLabel}</button>`;
      box.querySelector(".adm-add").onclick = () => { items.push(newItem()); draw(); };
      box.querySelectorAll("[data-x]").forEach((b) => (b.onclick = () => { if (confirm("أكيد تحذف؟")) { items.splice(+b.dataset.x, 1); draw(); } }));
      if (extraBtn) box.querySelectorAll("[data-e]").forEach((b) => (b.onclick = () => { extraBtn.run(+b.dataset.e); draw(); }));
      box.querySelectorAll("[data-k]").forEach((el) => {
        const it = items[+el.closest(".adm-item").dataset.i], k = el.dataset.k, t = el.dataset.t;
        if (t === "image") {
          el.onchange = async () => { const f = el.files[0]; if (!f) return; try { await onImage(it, k, f); draw(); } catch (e) { toast(e.message, true); } };
          return;
        }
        el.oninput = el.onchange = () => {
          if (t === "check") it[k] = el.checked;
          else if (t === "number") it[k] = el.value === "" ? null : +el.value;
          else if (t === "datetime") it[k] = fromLocal(el.value);
          else it[k] = el.value;
        };
      });
    }
    draw();
    return { redraw: draw };
  }
  function field(it, k, l, t, o = {}, i) {
    const id = `f${Math.random().toString(36).slice(2, 8)}`;
    const v = it[k];
    const cls = o.full ? ' class="full"' : "";
    if (t === "check") return `<div${cls}><label><input type="checkbox" data-k="${k}" data-t="check" ${v ? "checked" : ""}>${esc(l)}</label></div>`;
    if (t === "textarea") return `<div class="full"><label for="${id}">${esc(l)}</label><textarea id="${id}" data-k="${k}" data-t="text">${esc(v)}</textarea></div>`;
    if (t === "select") return `<div${cls}><label for="${id}">${esc(l)}</label><select id="${id}" data-k="${k}" data-t="text">${o.options.map((x) => `<option ${x === v ? "selected" : ""}>${esc(x)}</option>`).join("")}</select></div>`;
    if (t === "image") return `<div class="full"><label>${esc(l)}</label><div class="adm-img">${v ? `<img src="${esc(it["_preview_" + k] || v)}" alt="">` : ""}<input type="file" accept="image/*" data-k="${k}" data-t="image"></div></div>`;
    const type = { number: "number", date: "date", datetime: "datetime-local" }[t] || "text";
    const val = t === "datetime" ? toLocal(v) : v ?? "";
    return `<div${cls}><label for="${id}">${esc(l)}</label><input id="${id}" type="${type}" ${t === "number" ? 'inputmode="numeric"' : ""} data-k="${k}" data-t="${t}" value="${esc(val)}" ${o.ph ? `placeholder="${esc(o.ph)}"` : ""}></div>`;
  }
  const clean = (arr) => arr.map((x) => Object.fromEntries(Object.entries(x).filter(([k, v]) => !k.startsWith("_") && v !== "" && v !== null && v !== undefined)));

  /* ---------- 🎨 تصميم جديد ---------- */
  const TYPES = ["بطاقة المباراة", "تاريخ المواجهات", "النتيجة النهائية", "التشكيلة", "رجل المباراة", "إحصائية", "تهنئة", "تصميم"];
  async function tabDesign() {
    const box = $("s-design");
    box.innerHTML = `<h2>🎨 رفع تصميم جديد</h2><p class="adm-hint">الصورة تتصغّر تلقائياً قبل الرفع. لو التصميم لمباراة، عبّ بياناتها عشان تطلع في المباراة القادمة ومركز المباراة.</p>
      <label for="dFile">الصورة</label><input id="dFile" type="file" accept="image/*"><img id="dPrev" class="adm-prev" hidden alt="">
      <div class="adm-grid">
        <div><label for="dType">النوع</label><select id="dType">${TYPES.map((t) => `<option>${t}</option>`).join("")}</select></div>
        <div><label for="dDate">تاريخ النشر</label><input id="dDate" type="date" value="${todayKey()}"></div>
        <div class="full"><label for="dTitle">العنوان</label><input id="dTitle" placeholder="مثال: الهلال × الاتحاد"></div>
        <div class="full"><label><input type="checkbox" id="dIsMatch">مرتبط بمباراة للهلال</label></div>
      </div>
      <div class="adm-grid" id="dMatch" hidden>
        <div class="full"><label for="mDate">موعد المباراة (بتوقيت مكة)</label><input id="mDate" type="datetime-local"></div>
        <div><label for="mHome">المستضيف</label><input id="mHome" value="الهلال"></div>
        <div><label for="mAway">الضيف</label><input id="mAway"></div>
        <div><label for="mComp">البطولة</label><input id="mComp" placeholder="دوري روشن السعودي"></div>
        <div><label for="mRound">الجولة</label><input id="mRound" placeholder="الجولة 9"></div>
        <div class="full"><label for="mVenue">الملعب</label><input id="mVenue"></div>
        <div><label for="mComm">المعلقين</label><input id="mComm"></div>
        <div><label for="mCh">الناقل</label><input id="mCh" placeholder="ثمانية"></div>
      </div>
      <button type="button" class="card-btn adm-save" id="dSave">⬆️ ارفع التصميم</button>
      <h3>التصاميم الحالية</h3><div class="adm-dl" id="dList"><p class="adm-hint">جاري التحميل…</p></div>`;
    $("dIsMatch").onchange = () => ($("dMatch").hidden = !$("dIsMatch").checked);
    $("dType").onchange = () => { if ($("dType").value === "بطاقة المباراة" && !$("dIsMatch").checked) { $("dIsMatch").checked = true; $("dMatch").hidden = false; } };
    $("dFile").onchange = () => { const f = $("dFile").files[0]; if (f) { $("dPrev").src = URL.createObjectURL(f); $("dPrev").hidden = false; } };
    let data = null;
    const drawList = () => {
      const list = data.designs || [];
      $("dList").innerHTML = list.length ? list.map((d, i) => `<div class="adm-d"><img src="${esc(d.thumb || d.image)}" alt="" loading="lazy"><div><b>${esc(d.type || "")}</b>${esc(d.title || "")}</div><button type="button" data-del="${i}">حذف</button></div>`).join("") : `<p class="adm-hint">ما فيه تصاميم</p>`;
      $("dList").querySelectorAll("[data-del]").forEach((b) => (b.onclick = async () => {
        const d = list[+b.dataset.del]; if (!confirm(`تحذف «${d.title || d.type}» من الموقع؟`)) return;
        const fresh = await load("data/designs.json"); fresh.designs = (fresh.designs || []).filter((x) => x.id !== d.id);
        if (await commit([{ path: "data/designs.json", json: fresh }], "حذف تصميم: " + (d.title || d.id), b)) { data = fresh; drawList(); }
      }));
    };
    try { data = await load("data/designs.json"); drawList(); } catch (e) { $("dList").innerHTML = `<p class="adm-msg">${esc(e.message)}</p>`; }
    $("dSave").onclick = async () => {
      const f = $("dFile").files[0]; if (!f) return toast("اختر صورة أول", true);
      const isM = $("dIsMatch").checked;
      if (isM && (!$("mDate").value || !$("mAway").value.trim() || !$("mHome").value.trim())) return toast("عبّ موعد المباراة والفريقين", true);
      const base = (isM ? $("mDate").value.slice(0, 10) : $("dDate").value || todayKey()) + "-" + slug();
      try {
        const [big, small] = await Promise.all([resize(f, 1440), resize(f, 540, "image/jpeg", 0.8)]);
        const d = { id: base, type: $("dType").value, title: $("dTitle").value.trim() || (isM ? `${$("mHome").value.trim()} × ${$("mAway").value.trim()}` : $("dType").value),
          date: $("dDate").value || todayKey(), image: `assets/designs/${base}.jpg`, thumb: `assets/designs/${base}-thumb.jpg` };
        if (isM) d.match = Object.fromEntries(Object.entries({ date: fromLocal($("mDate").value), home: $("mHome").value.trim(), away: $("mAway").value.trim(),
          competition: $("mComp").value.trim(), round: $("mRound").value.trim(), venue: $("mVenue").value.trim(), commentators: $("mComm").value.trim(), channel: $("mCh").value.trim() }).filter(([, v]) => v));
        const fresh = await load("data/designs.json");
        fresh.designs = [d, ...(fresh.designs || [])];
        const ok = await commit([{ path: "data/designs.json", json: fresh }, { path: d.image, base64: big.base64 }, { path: d.thumb, base64: small.base64 }], "تصميم جديد: " + d.title, $("dSave"));
        if (ok) { data = fresh; drawList(); $("dFile").value = ""; $("dPrev").hidden = true; $("dTitle").value = ""; }
      } catch (e) { toast(e.message, true); }
    };
  }

  /* ---------- 📰 أخبار منبر والعاجل ---------- */
  async function tabNews() {
    const box = $("s-news");
    box.innerHTML = `<h2>📰 أخبار منبر والعاجل</h2><p class="adm-hint">الخبر العاجل يطلع بالشريط الأحمر فوق الموقع، ويختفي تلقائياً بعد المدة اللي تحددها. الأخبار العادية تطلع أول قائمة الأخبار.</p><div id="nList"></div><button type="button" class="card-btn adm-save" id="nSave">💾 احفظ الأخبار</button>`;
    let data;
    try { data = await load("data/manual-news.json"); } catch (e) { box.insertAdjacentHTML("beforeend", `<p class="adm-msg">${esc(e.message)}</p>`); return; }
    data.items = data.items || [];
    listEditor($("nList"), data.items, [
      ["title", "العنوان", "text", { full: true }], ["body", "التفاصيل (اختياري)", "textarea"], ["link", "رابط (اختياري)", "text", { full: true, ph: "https://" }],
      ["tag", "التصنيف", "text", { ph: "منبر" }], ["until", "يختفي بعد (بتوقيت مكة)", "datetime"], ["breaking", "عاجل 🔴 (يطلع بالشريط)", "check", { full: true }]
    ], { addLabel: "+ خبر جديد", newItem: () => ({ title: "", tag: "منبر", breaking: true, until: fromLocal(new Date(Date.now() + 3 * 3600e3 + 6 * 3600e3).toISOString().slice(0, 16)), at: new Date().toISOString() }) });
    $("nSave").onclick = () => {
      const items = clean(data.items).filter((x) => x.title);
      commit([{ path: "data/manual-news.json", json: { items } }], "أخبار منبر", $("nSave"));
    };
  }

  /* ---------- 🌱 الفئات السنية (تحت 21 + تحت 18/17/15) ---------- */
  async function tabYouth() {
    const box = $("s-youth");
    box.innerHTML = `<h2>🌱 الفئات السنية</h2><div class="adm-tabs adm-ytabs" id="yG"></div><div id="yBody"></div>
      <button type="button" class="card-btn adm-save" id="ySave">💾 احفظ الفئات السنية</button>`;
    let y;
    try { y = await load("data/youth.json"); } catch (e) { box.insertAdjacentHTML("beforeend", `<p class="adm-msg">${esc(e.message)}</p>`); return; }
    y.key = y.key || "u21"; y.groups = y.groups || [];
    const all = () => [y, ...y.groups];
    let cur = y;
    const fix = (g) => ["upcoming", "results", "table", "news"].forEach((k) => (g[k] = g[k] || []));
    function drawTabs() {
      $("yG").innerHTML = all().map((g, i) => `<button data-i="${i}" class="${g === cur ? "on" : ""}">${esc((g.title || g.key).replace(/^الهلال\s*/, ""))}</button>`).join("") + `<button data-new="1">+ فئة</button>`;
      $("yG").querySelectorAll("[data-i]").forEach((b) => (b.onclick = () => { cur = all()[+b.dataset.i]; drawTabs(); drawGroup(); }));
      $("yG").querySelector("[data-new]").onclick = () => {
        const n = prompt("رقم الفئة (مثال: 16)"); if (!n || !/^\d{1,2}$/.test(n.trim())) return;
        const g = { key: "u" + n.trim(), title: "الهلال تحت " + n.trim(), competition: "الدوري الممتاز تحت " + n.trim(), season: y.season || "", updated: todayKey(), upcoming: [], results: [], table: [], news: [] };
        y.groups.push(g); cur = g; drawTabs(); drawGroup();
      };
    }
    function drawGroup() {
      const g = cur; fix(g);
      $("yBody").innerHTML = `
        <div class="adm-grid"><div class="full"><label for="yTitle">العنوان</label><input id="yTitle"></div><div class="full"><label for="yComp">البطولة</label><input id="yComp"></div><div><label for="ySeason">الموسم</label><input id="ySeason"></div><div><label for="yUpd">الجدول محدّث حتى</label><input id="yUpd" type="date"></div></div>
        ${g !== y ? `<button type="button" class="lb-btn adm-add" id="yDel" style="margin-top:10px">🗑️ حذف هالفئة</button>` : ""}
        <h3>المباريات القادمة</h3><p class="adm-hint">بعد ما تنتهي المباراة اضغط «انتهت» وتنتقل للنتائج وتعبّي الأهداف.</p><div id="yUp"></div>
        <h3>النتائج</h3><div id="yRes"></div>
        <h3>جدول الترتيب (أول 8)</h3><div id="yTbl"></div>
        <h3>الأخبار</h3><div id="yNews"></div>`;
      const bind = (id, k, def) => { $(id).value = g[k] || def || ""; $(id).oninput = () => (g[k] = $(id).value.trim()); };
      bind("yTitle", "title"); bind("yComp", "competition"); bind("ySeason", "season"); bind("yUpd", "updated", todayKey());
      if ($("yDel")) $("yDel").onclick = () => { if (!confirm("تحذف " + (g.title || g.key) + "؟")) return; y.groups = y.groups.filter((x) => x !== g); cur = y; drawTabs(); drawGroup(); };
      const mf = [["date", "الموعد", "datetime", { full: true }], ["home", "المستضيف", "text"], ["away", "الضيف", "text"], ["round", "الجولة", "text"], ["venue", "الملعب", "text"]];
      let resEd;
      listEditor($("yUp"), g.upcoming, mf, { addLabel: "+ مباراة قادمة", newItem: () => ({ home: "الهلال", away: "" }), title: (m) => `${m.home || ""} × ${m.away || ""}`,
        extraBtn: { label: "انتهت ✓", run: (i) => { const m = g.upcoming.splice(i, 1)[0]; g.results.unshift({ ...m, homeGoals: 0, awayGoals: 0 }); resEd.redraw(); } } });
      resEd = listEditor($("yRes"), g.results, [["date", "الموعد", "datetime", { full: true }], ["home", "المستضيف", "text"], ["away", "الضيف", "text"], ["homeGoals", "أهداف المستضيف", "number"], ["awayGoals", "أهداف الضيف", "number"], ["round", "الجولة", "text"], ["venue", "الملعب", "text"]],
        { addLabel: "+ نتيجة", newItem: () => ({ home: "الهلال", homeGoals: 0, awayGoals: 0 }), title: (m) => `${m.home || ""} ${m.homeGoals ?? ""}-${m.awayGoals ?? ""} ${m.away || ""}` });
      listEditor($("yTbl"), g.table, [["team", "الفريق", "text", { full: true }], ["played", "لعب", "number"], ["points", "النقاط", "number"], ["win", "فوز", "number"], ["draw", "تعادل", "number"], ["lose", "خسارة", "number"], ["gf", "له", "number"], ["ga", "عليه", "number"]],
        { addLabel: "+ فريق", newItem: () => ({ team: "", played: 0, win: 0, draw: 0, lose: 0, gf: 0, ga: 0, points: 0 }), title: (r, i) => `${i + 1}. ${r.team || ""}` });
      listEditor($("yNews"), g.news, [["title", "العنوان", "text", { full: true }], ["body", "التفاصيل", "textarea"], ["link", "رابط (اختياري)", "text", { full: true }]], { addLabel: "+ خبر", newItem: () => ({ title: "" }) });
    }
    const out = (g) => ({ ...g, updated: g.updated || todayKey(),
      upcoming: clean(g.upcoming).filter((m) => m.date), results: clean(g.results).filter((m) => m.date),
      table: clean(g.table).filter((r) => r.team).sort((a, b) => (b.points || 0) - (a.points || 0) || ((b.gf || 0) - (b.ga || 0)) - ((a.gf || 0) - (a.ga || 0))),
      news: clean(g.news).filter((n) => n.title) });
    drawTabs(); drawGroup();
    $("ySave").onclick = () => {
      const { groups, ...main } = y;
      const file = { ...out(main), groups: groups.map(out) };
      commit([{ path: "data/youth.json", json: file }], "تحديث الفئات السنية", $("ySave"));
    };
  }

  /* ---------- 🤝 الرعاة والإعلانات ---------- */
  const SLOTS = [["sponsors", "رعاة منبر (الشريط المتحرك)"], ["match_sponsor", "راعي المباراة (تحت بطاقة المباراة)"], ["top", "إعلان أعلى الصفحة الرئيسية"], ["between", "إعلان بين الأقسام"], ["sidebar", "إعلان جانبي"]];
  async function tabAds() {
    const box = $("s-ads");
    box.innerHTML = `<h2>🤝 الرعاة والإعلانات</h2><p class="adm-hint">الشعار يرفع كصورة PNG (تحافظ على الشفافية). تقدر تحدد فترة الإعلان (من - إلى) أو توقفه بدون حذف.</p>${SLOTS.map(([k, l]) => `<h3>${l}</h3><div id="ad-${k}"></div>`).join("")}<button type="button" class="card-btn adm-save" id="aSave">💾 احفظ الرعاة والإعلانات</button>`;
    let ads;
    try { ads = await load("data/ads.json"); } catch (e) { box.insertAdjacentHTML("beforeend", `<p class="adm-msg">${esc(e.message)}</p>`); return; }
    const pending = [];
    const onImage = async (it, k, f) => {
      const png = /png|svg|gif|webp/.test(f.type);
      const r = await resize(f, it._slot === "sponsors" || it._slot === "match_sponsor" ? 600 : 1600, png ? "image/png" : "image/jpeg");
      const path = `assets/ads/${it._slot.replace(/_/g, "-")}-${slug()}.${png ? "png" : "jpg"}`;
      pending.push({ path, base64: r.base64 }); it[k] = path; it["_preview_" + k] = r.url;
    };
    for (const [k] of SLOTS) {
      ads[k] = (ads[k] || []).map((a) => ({ ...a, _slot: k, active: a.active !== false }));
      listEditor($("ad-" + k), ads[k], [["title", "الاسم", "text"], ["link", "الرابط (اختياري)", "text", { ph: "https://" }], ["image", "الصورة / الشعار", "image"], ["from", "من (اختياري)", "date"], ["to", "إلى (اختياري)", "date"], ["active", "مفعّل", "check", { full: true }]],
        { addLabel: "+ إضافة", newItem: () => ({ _slot: k, title: "", active: true }), onImage, title: (a) => a.title || "جديد" });
    }
    $("aSave").onclick = async () => {
      const out = { ...ads };
      for (const [k] of SLOTS) out[k] = clean(ads[k]).filter((a) => a.image).map((a) => { if (a.active) delete a.active; return a; });
      const used = new Set(SLOTS.flatMap(([k]) => out[k].map((a) => a.image)));
      if (await commit([{ path: "data/ads.json", json: out }, ...pending.filter((p) => used.has(p.path))], "تحديث الرعاة والإعلانات", $("aSave"))) pending.length = 0;
    };
  }

  /* ---------- 🏆 جائزة الدوري ---------- */
  async function tabLeague() {
    const box = $("s-league");
    box.innerHTML = `<h2>🏆 دوري التوقعات</h2><p class="adm-hint">النقاط تنحسب تلقائياً بعد كل مباراة (3 للنتيجة بالضبط، 1 للفائز، +1 لأول هدّاف). هنا تحدد الجائزة والراعي.</p>
      <div class="adm-grid"><div class="full"><label for="lPrize">الجائزة</label><input id="lPrize" placeholder="مثال: قسيمة 500 ريال لصاحب المركز الأول"></div>
      <div><label for="lSp">الراعي</label><input id="lSp"></div><div><label for="lSeason">الموسم</label><input id="lSeason"></div>
      <div class="full"><label>شعار الراعي</label><div class="adm-img"><img id="lLogoPrev" hidden alt=""><input id="lLogo" type="file" accept="image/*"></div></div></div>
      <button type="button" class="card-btn adm-save" id="lSave">💾 احفظ</button>
      <h3>الترتيب الحالي</h3><div id="lBoard" class="adm-hint">جاري التحميل…</div>`;
    let lg;
    try { lg = await load("data/league.json"); } catch (e) { box.insertAdjacentHTML("beforeend", `<p class="adm-msg">${esc(e.message)}</p>`); return; }
    $("lPrize").value = lg.prize || ""; $("lSp").value = lg.sponsor || ""; $("lSeason").value = lg.season || "";
    if (lg.prizeLogo) { $("lLogoPrev").src = lg.prizeLogo; $("lLogoPrev").hidden = false; }
    let logo = null;
    $("lLogo").onchange = async () => { const f = $("lLogo").files[0]; if (!f) return; logo = await resize(f, 400, "image/png"); $("lLogoPrev").src = logo.url; $("lLogoPrev").hidden = false; };
    $("lSave").onclick = async () => {
      const out = { ...lg, prize: $("lPrize").value.trim(), sponsor: $("lSp").value.trim(), season: $("lSeason").value.trim() };
      const files = [];
      if (logo) { out.prizeLogo = `assets/ads/league-${slug()}.png`; files.push({ path: out.prizeLogo, base64: logo.base64 }); }
      if (await commit([{ path: "data/league.json", json: out }, ...files], "جائزة دوري التوقعات", $("lSave"))) { lg = out; logo = null; }
    };
    try {
      const b = await fetch(API + "/league").then((r) => r.json());
      $("lBoard").innerHTML = b.top?.length ? `<ol>${b.top.slice(0, 20).map((u) => `<li><b>${esc(u.nick)}</b> — ${u.pts} نقطة (${u.played} مباراة، ${u.exact} 🎯)</li>`).join("")}</ol><p>${b.players} متسابق · ${b.matches} مباراة محسوبة</p>` : "ما فيه نقاط للحين — تنحسب بعد أول مباراة.";
    } catch (e) { $("lBoard").textContent = "تعذّر التحميل"; }
  }

  /* ---------- 🔔 تنبيه للمشتركين ---------- */
  function tabPush() {
    const box = $("s-push");
    box.innerHTML = `<h2>🔔 أرسل تنبيه</h2><p class="adm-hint">يوصل لكل اللي فعّلوا التنبيهات. التنبيهات التلقائية (قبل المباراة بساعة، الأهداف، النهاية) تشتغل لحالها — هذا للتنبيهات الخاصة.</p>
      <label for="pT">العنوان</label><input id="pT" value="منبر الهلال 💙">
      <label for="pB">النص</label><textarea id="pB" placeholder="مثال: نزل تصميم المباراة 🔥"></textarea>
      <label for="pP">يفتح صفحة</label><select id="pP"><option value="">الرئيسية</option><option value="matchday.html">مركز المباراة</option><option value="play.html">العب</option><option value="designs.html">التصاميم</option><option value="play.html#league">الدوري</option><option value="youth.html">تحت 21</option></select>
      <button type="button" class="card-btn adm-save" id="pSend">📣 أرسل</button>`;
    $("pSend").onclick = async () => {
      if (!$("pB").value.trim()) return toast("اكتب نص التنبيه", true);
      if (!confirm("يوصل لكل المشتركين — أكيد؟")) return;
      const b = $("pSend"); b.disabled = true;
      try { await call("/push/test", { method: "POST", body: JSON.stringify({ title: $("pT").value.trim(), body: $("pB").value.trim(), path: $("pP").value }) }); toast("انرسل ✅"); }
      catch (e) { toast(e.message, true); } finally { b.disabled = false; }
    };
  }

  /* ---------- 📅 مناسبات الهلال ---------- */
  const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  async function tabOcc() {
    const box = $("s-occ");
    box.innerHTML = `<h2>📅 مناسبات الهلال</h2><p class="adm-hint">تطلع بالرئيسية «في مثل هذا اليوم» الساعة 5 العصر. التاريخ بصيغة يوم/شهر مثل 16/10.</p>
      <label for="oM">الشهر</label><select id="oM">${MONTHS.map((m, i) => `<option value="${i + 1}">${m}</option>`).join("")}</select>
      <div id="oList" style="margin-top:12px"></div><button type="button" class="card-btn adm-save" id="oSave">💾 احفظ المناسبات</button>`;
    let data;
    try { data = await load("data/occasions.json"); } catch (e) { box.insertAdjacentHTML("beforeend", `<p class="adm-msg">${esc(e.message)}</p>`); return; }
    const byM = {};
    for (let m = 1; m <= 12; m++) byM[m] = [];
    for (const o of data.items || []) (byM[+String(o.d).slice(3, 5)] || byM[1]).push(o);
    const CATS = { "🎂 ميلاد": "birth", "🏆 بطولة / إنجاز": "title", "📜 ذكرى / حدث": "history" };
    const CATS_R = Object.fromEntries(Object.entries(CATS).map(([a, b]) => [b, a]));
    const draw = () => {
      const m = +$("oM").value;
      const arr = byM[m];
      arr.forEach((o) => (o._cat = CATS_R[o.cat] || "📜 ذكرى / حدث"));
      listEditor($("oList"), arr, [["d", "التاريخ (يوم/شهر)", "text", { ph: "16/10" }], ["_cat", "التصنيف", "select", { options: Object.keys(CATS) }], ["title", "المناسبة", "text", { full: true }]],
        { addLabel: "+ مناسبة", newItem: () => ({ d: "/" + String(m).padStart(2, "0"), title: "", _cat: "📜 ذكرى / حدث" }), title: (o) => `${o.d || ""} — ${o.title || ""}` });
    };
    $("oM").value = String(+new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", month: "2-digit" }).format(new Date()));
    $("oM").onchange = draw; draw();
    $("oSave").onclick = () => {
      const bad = [];
      const items = Object.values(byM).flat().filter((o) => o.title && o.title.trim()).map((o) => {
        let [dd, mm] = String(o.d || "").split("/").map((x) => parseInt(x, 10));
        if (!(dd >= 1 && dd <= 31 && mm >= 1 && mm <= 12)) bad.push(o.title);
        const it = { d: `${String(dd).padStart(2, "0")}/${String(mm).padStart(2, "0")}`, title: o.title.trim(), cat: CATS[o._cat] || o.cat || "history" };
        if (o.time) it.time = o.time;
        return it;
      }).sort((a, b) => a.d.slice(3) - b.d.slice(3) || a.d.slice(0, 2) - b.d.slice(0, 2));
      if (bad.length) return toast("تاريخ غلط في: " + bad.slice(0, 2).join("، "), true);
      commit([{ path: "data/occasions.json", json: { ...data, items } }], "تحديث مناسبات الهلال", $("oSave"));
    };
  }

  /* ---------- التبويبات والدخول ---------- */
  const TABS = { design: tabDesign, news: tabNews, youth: tabYouth, ads: tabAds, league: tabLeague, push: tabPush, occ: tabOcc };
  const loaded = {};
  function show(t) {
    document.querySelectorAll("#tabs button").forEach((b) => b.classList.toggle("on", b.dataset.t === t));
    Object.keys(TABS).forEach((k) => ($("s-" + k).hidden = k !== t));
    if (!loaded[t]) { loaded[t] = true; TABS[t](); }
  }
  document.querySelectorAll("#tabs button").forEach((b) => (b.onclick = () => show(b.dataset.t)));
  $("logout").onclick = () => { try { sessionStorage.removeItem("mnbr-admin"); } catch (e) {} location.reload(); };

  async function enter() {
    try {
      const r = await call("/admin/check");
      CAN_SAVE = !!r.github;
      try { sessionStorage.setItem("mnbr-admin", PW); } catch (e) {}
      $("login").hidden = true; $("panel").hidden = false; $("noGh").hidden = CAN_SAVE;
      show("design");
    } catch (e) {
      $("loginMsg").hidden = false; $("loginMsg").textContent = e.message;
      try { sessionStorage.removeItem("mnbr-admin"); } catch (er) {}
    }
  }
  $("login").onsubmit = (e) => { e.preventDefault(); PW = $("pw").value; enter(); };
  (async () => {
    try { API = (await fetch("data/live.json?t=" + Date.now()).then((r) => r.json())).url.replace(/\/live$/, ""); }
    catch (e) { $("loginMsg").hidden = false; $("loginMsg").textContent = "تعذّر الوصول للخادم"; return; }
    if (PW) enter();
  })();
})();
