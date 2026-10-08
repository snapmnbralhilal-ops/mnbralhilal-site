/* منبر الهلال — يقرأ data/site.json (يتحدث تلقائياً من API-Football) ويعرضه */
(function () {
  const { arTeam, arLeague, arRound } = window.MNB;
  const TZ = "Asia/Riyadh";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ar = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);

  const LIVE = ["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP"];
  const DONE = ["FT", "AET", "PEN", "AWD", "WO"];
  const OFF = { PST: "مؤجلة", CANC: "ملغاة", ABD: "متوقفة", TBD: "لم يحدد" };

  const fmt = (opts) => new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-arab", { timeZone: TZ, ...opts });
  const fTime = fmt({ hour: "2-digit", minute: "2-digit", hour12: false });
  const fDay = fmt({ weekday: "long", day: "numeric", month: "long" });
  const fShort = fmt({ weekday: "short", day: "numeric", month: "numeric" });
  const fDM = fmt({ day: "numeric", month: "numeric" });

  let HILAL_ID = null;

  function crest(team, cls = "crest") {
    const name = arTeam(team?.name);
    if (team?.logo) return `<img class="${cls}" src="${esc(team.logo)}" alt="" loading="lazy" width="28" height="32" onerror="this.style.visibility='hidden'">`;
    const ch = name.replace(/^ال/, "").trim()[0] || "?";
    return `<svg class="${cls}" viewBox="0 0 28 32" aria-hidden="true"><path d="M14 1 L26 5 V15 C26 23 20 28.5 14 31 C8 28.5 2 23 2 15 V5 Z" fill="var(--chip)" stroke="var(--line)"/><text x="14" y="21" text-anchor="middle" font-family="Expo Arabic,sans-serif" font-weight="700" font-size="12" fill="var(--royal)">${esc(ch)}</text></svg>`;
  }

  function outcome(m) {
    if (!m.goals || HILAL_ID == null) return null;
    const home = m.home.id === HILAL_ID;
    const us = home ? m.goals[0] : m.goals[1], them = home ? m.goals[1] : m.goals[0];
    return us > them ? "w" : us < them ? "l" : "d";
  }
  const lbl = { w: "ف", d: "ت", l: "خ" };

  function scoreCell(m) {
    const d = new Date(m.date);
    if (LIVE.includes(m.status)) {
      const g = m.goals || [0, 0];
      return `<span class="sc num live-sc">${g[0] ?? 0} - ${g[1] ?? 0}</span>`;
    }
    if (DONE.includes(m.status) && m.goals) return `<span class="sc num">${m.goals[0]} - ${m.goals[1]}</span>`;
    if (OFF[m.status]) return `<span class="sc time">${OFF[m.status]}</span>`;
    return `<span class="sc time num">${fTime.format(d)}</span>`;
  }

  function row(m, { showWhen = true, hl = false } = {}) {
    const d = new Date(m.date);
    const o = DONE.includes(m.status) ? outcome(m) : null;
    const res = o ? `<span class="res ${o}">${lbl[o]}</span>` : "";
    let when = "";
    if (showWhen) {
      const top = LIVE.includes(m.status)
        ? `<span class="live"><span class="dot"></span>مباشر${m.elapsed ? " " + ar(m.elapsed) + "'" : ""}</span>`
        : esc(DONE.includes(m.status) ? fDM.format(d) : fShort.format(d));
      when = `<div class="when">${top}<br>${esc(arLeague(m.league))}${res}</div>`;
    } else if (LIVE.includes(m.status)) {
      when = `<div class="when"><span class="live"><span class="dot"></span>${m.elapsed ? ar(m.elapsed) + "'" : "مباشر"}</span></div>`;
    }
    const style = when ? "" : ' style="grid-template-columns:minmax(0,1fr) auto minmax(0,1fr)"';
    return `<div class="row${hl ? " hl" : ""}"${style}>${when}
      <div class="side">${crest(m.home)}<span>${esc(arTeam(m.home.name))}</span></div>${scoreCell(m)}
      <div class="side away">${crest(m.away)}<span>${esc(arTeam(m.away.name))}</span></div></div>`;
  }


  /* ---------- الإعلانات والرعاة (data/ads.json) ---------- */
  let ADS = {};
  const activeAds = (slot) => {
    const now = new Date();
    return (ADS[slot] || []).filter((a) => a && a.image && a.active !== false &&
      (!a.from || new Date(a.from + "T00:00:00+03:00") <= now) &&
      (!a.to || new Date(a.to + "T23:59:59+03:00") >= now));
  };
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const adLink = (a, inner) => a.link
    ? `<a href="${esc(a.link)}" target="_blank" rel="noopener sponsored">${inner}</a>` : inner;
  function renderAds() {
    document.querySelectorAll(".ad-slot").forEach((el) => {
      const list = activeAds(el.dataset.slot);
      if (!list.length) { el.hidden = true; el.innerHTML = ""; return; }
      const a = pick(list); // لو فيه أكثر من إعلان بنفس المكان، يتبدّلون عشوائياً
      el.innerHTML = adLink(a, `<img src="${esc(a.image)}" alt="${esc(a.title || "إعلان")}" loading="lazy">`) + `<span class="ad-tag">إعلان</span>`;
      el.hidden = false;
    });
    const sp = activeAds("sponsors");
    $("sponsors").hidden = !sp.length;
    $("spList").innerHTML = sp.map((a) => adLink(a, `<img src="${esc(a.image)}" alt="${esc(a.title || "")}" title="${esc(a.title || "")}" loading="lazy">`)).join("");
  }
  function matchSponsorHtml() {
    const list = activeAds("match_sponsor");
    if (!list.length) return "";
    const a = list[0];
    return `<div class="match-sp">المباراة برعاية ${adLink(a, `<img src="${esc(a.image)}" alt="${esc(a.title || "")}">`)}</div>`;
  }

  /* ---------- البطاقة الرئيسية: المباراة القادمة ---------- */
  let countTimer = null;
  function renderNext(m) {
    const card = $("nextCard");
    if (!m) { card.innerHTML = `<div class="empty">لا توجد مباراة قادمة مسجلة حالياً</div>`; return; }
    const d = new Date(m.date);
    const live = LIVE.includes(m.status);
    const CITY = { Riyadh: "الرياض", Jeddah: "جدة", Dammam: "الدمام", Buraydah: "بريدة", Makkah: "مكة", Mecca: "مكة", Medina: "المدينة المنورة", "Al Khobar": "الخبر", Abha: "أبها", "Ha'il": "حائل", Hail: "حائل", Doha: "الدوحة", "Al Rayyan": "الريان", Dubai: "دبي", "Abu Dhabi": "أبوظبي", "Al Ain": "العين", Sharjah: "الشارقة" };
    const venue = m.venue ? " · " + esc(CITY[m.venue] || m.venue) : "";
    const mid = live
      ? `<span class="live"><span class="dot"></span>مباشر${m.elapsed ? " " + ar(m.elapsed) + "'" : ""}</span>
         <div class="kick num" style="direction:rtl">${m.goals?.[0] ?? 0} - ${m.goals?.[1] ?? 0}</div>`
      : `<small style="color:var(--muted);font-size:12px">انطلاق المباراة</small>
         <div class="kick num">${fTime.format(d)}</div>
         <small style="color:var(--muted);font-size:12px">بتوقيت مكة</small>`;
    card.innerHTML = `
      <div class="next-head"><span class="comp">${esc(arLeague(m.league))}</span><span>${esc(fDay.format(d))}${venue}</span></div>
      <div class="vs">
        <div class="t">${crest(m.home, "crest lg")}${esc(arTeam(m.home.name))}</div>
        <div class="mid">${mid}</div>
        <div class="t">${crest(m.away, "crest lg")}${esc(arTeam(m.away.name))}</div>
      </div>
      <div class="count num" id="count" aria-live="polite"></div>${matchSponsorHtml()}`;
    clearInterval(countTimer);
    if (live) return;
    const tick = () => {
      const s = Math.max(0, (d - new Date()) / 1000);
      const D = Math.floor(s / 86400), H = Math.floor((s % 86400) / 3600), M = Math.floor((s % 3600) / 60), S = Math.floor(s % 60);
      $("count").innerHTML = s > 0
        ? [[D, "يوم"], [H, "ساعة"], [M, "دقيقة"], [S, "ثانية"]].map(([v, l]) => `<div><b>${ar(String(v).padStart(2, "0"))}</b><small>${l}</small></div>`).join("")
        : `<div><b>انطلقت المباراة</b></div>`;
    };
    tick(); countTimer = setInterval(tick, 1000);
  }

  /* ---------- مباريات الهلال ---------- */
  function renderHilal(h) {
    const upcoming = h?.upcoming || [], results = h?.results || [];
    const list = $("hilalList");
    const show = (up) => {
      $("tabUp").setAttribute("aria-selected", up);
      $("tabRes").setAttribute("aria-selected", !up);
      const arr = up ? upcoming : results;
      list.innerHTML = arr.length ? arr.map((m) => row(m)).join("") : `<div class="empty">${up ? "لا توجد مباريات قادمة مسجلة" : "لا توجد نتائج بعد"}</div>`;
    };
    $("tabUp").onclick = () => show(true);
    $("tabRes").onclick = () => show(false);
    show(true);
    $("formStrip").innerHTML = results.slice(0, 5).reverse().map((m) => { const o = outcome(m); return o ? `<span class="res ${o}">${lbl[o]}</span>` : ""; }).join("") || "<span>—</span>";
  }

  /* ---------- مباريات اليوم / أمس ---------- */
  function renderDay(el, day, emptyMsg, limit) {
    const groups = day?.groups || [];
    if (!groups.length) { el.innerHTML = `<div class="empty">${emptyMsg}</div>`; return; }
    let shown = 0, html = "", rest = "";
    for (const g of groups) {
      const block = `<div class="sub">${g.league.logo ? `<img src="${esc(g.league.logo)}" alt="" loading="lazy">` : ""}${esc(arLeague(g.league))}</div>` +
        g.matches.map((m) => row(m, { showWhen: false, hl: m.home.id === HILAL_ID || m.away.id === HILAL_ID })).join("");
      if (shown < limit) html += block; else rest += block;
      shown += g.matches.length;
    }
    el.innerHTML = html + (rest ? `<div hidden class="rest">${rest}</div><button class="more" type="button">عرض كل المباريات</button>` : "");
    const btn = el.querySelector(".more");
    if (btn) btn.onclick = () => { el.querySelector(".rest").hidden = false; btn.remove(); };
  }

  /* ---------- الترتيب ---------- */
  function renderTables(st) {
    const spl = st?.spl?.rows || [];
    const n = spl.length;
    $("spl").innerHTML = spl.length ? spl.map((r) => {
      const desc = (r.description || "").toLowerCase();
      const cls = desc.includes("relegation") ? "rel" : (desc.includes("champions") || desc.includes("afc")) ? "acl" : (r.rank <= 3 ? "acl" : r.rank > n - 3 ? "rel" : "");
      return `<tr class="${cls}${r.team.id === HILAL_ID ? " hl" : ""}"><td class="pos num">${r.rank}</td><td class="team"><div>${crest(r.team)}<span>${esc(arTeam(r.team.name))}</span></div></td><td class="num">${r.played}</td><td class="num">${r.win}</td><td class="num">${r.draw}</td><td class="num">${r.lose}</td><td class="num" style="direction:ltr">${r.gd > 0 ? "+" : ""}${r.gd}</td><td class="pts">${r.points}</td></tr>`;
    }).join("") : `<tr><td colspan="8" class="empty">الترتيب غير متوفر حالياً</td></tr>`;

    const epl = (st?.epl?.rows || []).slice(0, 6);
    $("epl").innerHTML = epl.length ? epl.map((r) => `<tr><td class="pos num">${r.rank}</td><td class="team"><div>${crest(r.team)}<span>${esc(arTeam(r.team.name))}</span></div></td><td class="num">${r.played}</td><td class="pts">${r.points}</td></tr>`).join("")
      : `<tr><td colspan="4" class="empty">الترتيب غير متوفر حالياً</td></tr>`;

    const me = spl.find((r) => r.team.id === HILAL_ID);
    $("mini").innerHTML = me
      ? `<div><b class="num">${ar(me.rank)}</b><small>الترتيب</small></div><div><b class="num">${ar(me.points)}</b><small>نقطة</small></div><div><b class="num" style="direction:ltr">${me.gd > 0 ? "+" : me.gd < 0 ? "-" : ""}${ar(Math.abs(me.gd))}</b><small>فارق الأهداف</small></div>`
      : `<div><b>—</b><small>الترتيب</small></div><div><b>—</b><small>نقطة</small></div><div><b>—</b><small>فارق الأهداف</small></div>`;
  }

  /* ---------- الأخبار ---------- */
  function renderNews(news) {
    news = news || [];
    $("newsList").innerHTML = news.length ? news.map((n) =>
      `<a href="${esc(n.link || "#")}"><span class="k${n.tag === "عالمي" ? " world" : ""}">${esc(n.tag)}</span><div><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p></div></a>`).join("")
      : `<div class="empty">لا توجد أخبار حالياً</div>`;
    const t = news.map((n) => `<span>● ${esc(n.title)}</span>`).join("") || "<span>منبر الهلال — كل جديد الأزرق</span>";
    $("tick").innerHTML = t + t;
  }

  function render(data) {
    HILAL_ID = data.hilal?.teamId ?? null;
    const h = data.hilal || {};
    renderNext((h.upcoming || [])[0]);
    renderHilal(h);
    $("todayDate").textContent = data.today?.date ? fDay.format(new Date(data.today.date + "T12:00:00+03:00")) : "";
    renderDay($("todayList"), data.today, "لا توجد مباريات اليوم في الدوريات المتابعة", 14);
    renderDay($("ydayList"), data.yesterday, "لا توجد نتائج لأمس", 10);
    renderTables(data.standings);
    renderNews(data.news);
    $("updated").textContent = data.updated
      ? "آخر تحديث: " + fmt({ day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(data.updated))
      : "بانتظار أول تحديث للبيانات";
  }

  async function loadAds() {
    try {
      const r = await fetch("data/ads.json?t=" + Date.now(), { cache: "no-store" });
      if (r.ok) ADS = await r.json();
    } catch (e) { ADS = {}; }
    renderAds();
  }

  async function load() {
    try {
      const res = await fetch("data/site.json?t=" + Date.now(), { cache: "no-store" });
      if (!res.ok) throw new Error(res.status);
      render(await res.json());
    } catch (e) {
      render({});
      $("updated").textContent = "تعذّر تحميل البيانات";
    }
  }
  /* ---------- كل الأرقام والرموز بالعربي: 0-9 ← ٠-٩ ، % ← ٪ ---------- */
  const AR_DIGITS = "٠١٢٣٤٥٦٧٨٩";
  const toArabic = (t) => t.replace(/[0-9]/g, (d) => AR_DIGITS[d]).replace(/%/g, "٪");
  const NEEDS = /[0-9%]/;
  function arabizeNode(node) {
    if (node.nodeType === Node.TEXT_NODE) {
      if (NEEDS.test(node.nodeValue)) node.nodeValue = toArabic(node.nodeValue);
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE || node.closest("script,style")) return;
    const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (n.parentElement && n.parentElement.closest("script,style")) continue;
      if (NEEDS.test(n.nodeValue)) n.nodeValue = toArabic(n.nodeValue);
    }
  }
  arabizeNode(document.body);
  new MutationObserver((muts) => {
    for (const m of muts) {
      if (m.type === "characterData") arabizeNode(m.target);
      else m.addedNodes.forEach(arabizeNode);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  document.title = toArabic(document.title);

  loadAds().then(load);
  setInterval(load, 10 * 60 * 1000); // يعيد القراءة كل ١٠ دقائق
})();
