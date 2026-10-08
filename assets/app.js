/* منبر الهلال — يقرأ data/site.json (يتحدث تلقائياً من API-Football) ويعرضه */
(function () {
  const { arTeam, arLeague, arRound } = window.MNB;
  const TZ = "Asia/Riyadh";
  const $ = (id) => document.getElementById(id);
  const put = (id, html) => { const el = $(id); if (el) el.innerHTML = html; return el; };
  const lim = (id, def) => { const el = $(id); return el && el.dataset.limit ? +el.dataset.limit : def; };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ar = (n) => String(n);

  const LIVE = ["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP"];
  const DONE = ["FT", "AET", "PEN", "AWD", "WO"];
  const OFF = { PST: "مؤجلة", CANC: "ملغاة", ABD: "متوقفة", TBD: "لم يحدد" };

  const fmt = (opts) => new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { timeZone: TZ, ...opts });
  const fTime = fmt({ hour: "2-digit", minute: "2-digit", hour12: false });
  const fDay = fmt({ weekday: "long", day: "numeric", month: "long" });
  const fShort = fmt({ weekday: "long", day: "numeric", month: "long" });
  const fDM = fmt({ day: "numeric", month: "long" });

  let HILAL_ID = null;

  // شعارات بجودة عالية وخلفية شفافة (بدل شعارات API الصغيرة اللي فيها خلفية رمادية)
  const LOCAL_LOGOS = { "الاتحاد": "ittihad", "السد": "sadd", "الرياض": "riyadh", "الحزم": "hazem", "القادسية": "qadsiah", "الشمال": "shamal", "الفتح": "fateh" };
  function crest(team, cls = "crest") {
    const name = arTeam(team?.name);
    if (LOCAL_LOGOS[name]) return `<img class="${cls}" src="assets/teams/${LOCAL_LOGOS[name]}.png" alt="" loading="lazy" width="28" height="32">`;
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
    if (!$("sponsors")) return;
    $("sponsors").hidden = !sp.length;
    // شريط متحرك: نكرر الشعارات مرتين عشان الحركة تكون متصلة بدون فراغ
    const one = sp.map((a) => `<span class="sp-item">${adLink(a, `<img src="${esc(a.image)}" alt="${esc(a.title || "")}" title="${esc(a.title || "")}" onload="var r=this.naturalWidth/this.naturalHeight;if(r<1.6)this.classList.add(r<1.2?'sq2':'sq')" onerror="if(!this.dataset.retry){this.dataset.retry=1;this.src=this.src.split('#')[0]+'&r='+Date.now()}">`)}</span>`).join("");
    const reps = Math.max(2, Math.ceil(8 / sp.length) * 2);
    $("spList").innerHTML = `<div class="sp-set">${one.repeat(reps / 2)}</div><div class="sp-set" aria-hidden="true">${one.repeat(reps / 2)}</div>`;
  }
  function matchSponsorHtml() {
    const list = activeAds("match_sponsor");
    if (!list.length) return "";
    const a = list[0];
    return `<div class="match-sp">المباراة برعاية ${adLink(a, `<img src="${esc(a.image)}" alt="${esc(a.title || "")}">`)}</div>`;
  }


  /* ---------- تصاميم منبر (data/designs.json) ---------- */
  let DESIGNS = [];
  const TEAM_IDS = { "الهلال": 2932, "الاتحاد": 2938, "النصر": 2939, "الأهلي": 2929 };
  const teamObj = (name) => ({ id: TEAM_IDS[name] ?? null, name, logo: TEAM_IDS[name] ? `https://media.api-sports.io/football/teams/${TEAM_IDS[name]}.png` : "" });
  const sameDay = (a, b) => fmt({ year: "numeric", month: "numeric", day: "numeric" }).format(new Date(a)) === fmt({ year: "numeric", month: "numeric", day: "numeric" }).format(new Date(b));
  const designForMatch = (m) => m && DESIGNS.find((d) => d.match && d.match.date && sameDay(d.match.date, m.date));
  // لو API ما عطانا المباراة القادمة، ناخذها من بطاقة المباراة
  function nextFromDesigns() {
    const now = Date.now();
    const d = DESIGNS.filter((x) => x.match && x.match.date && new Date(x.match.date) > now - 3 * 3600e3)
      .sort((a, b) => a.match.date.localeCompare(b.match.date))[0];
    if (!d) return null;
    const mm = d.match;
    return { date: mm.date, status: "NS", venue: mm.venue || "", league: { name: mm.competition || "" }, home: teamObj(mm.home), away: teamObj(mm.away), goals: null };
  }
  function nextExtrasHtml(m) {
    const d = designForMatch(m);
    if (!d) return "";
    const mm = d.match || {};
    const info = [mm.round, mm.commentators ? "التعليق: " + mm.commentators : "", mm.channel ? "الناقل: " + mm.channel : ""].filter(Boolean).map(esc).join(" · ");
    return `<div class="next-extra">${info ? `<span>${info}</span>` : ""}<button type="button" class="card-btn" data-design="${esc(d.id)}">بطاقة المباراة</button></div>`;
  }
  function renderDesigns() {
    const box = $("designs");
    if (!box || !$("dList")) return;
    const list = DESIGNS.slice().sort((a, b) => (b.date || "").localeCompare(a.date || "")).slice(0, lim("dList", 999));
    box.hidden = !list.length && !box.dataset.keep;
    if (!list.length) { $("dList").innerHTML = `<div class="empty">قريباً — تصاميم منبر</div>`; return; }
    $("dList").innerHTML = list.map((d) => `<button type="button" class="d-item" data-design="${esc(d.id)}">
      <img src="${esc(d.thumb || d.image)}" alt="${esc(d.title || "")}" loading="lazy" width="270" height="360">
      <span class="d-meta"><b>${esc(d.type || "تصميم")}</b><small>${esc(d.title || "")}</small></span></button>`).join("");
  }
  function openDesign(id) {
    const d = DESIGNS.find((x) => x.id === id); if (!d) return;
    const abs = new URL(d.image, location.href).href;
    const text = [d.type, d.title].filter(Boolean).join(": ") + " — منبر الهلال";
    $("lbImg").src = d.image; $("lbImg").alt = d.title || "";
    $("lbTitle").textContent = [d.type, d.title].filter(Boolean).join(": ");
    $("lbDownload").href = d.image; $("lbDownload").setAttribute("download", (d.id || "design") + ".jpg");
    $("lbWa").href = "https://wa.me/?text=" + encodeURIComponent(text + "\n" + abs);
    $("lbX").href = "https://x.com/intent/post?text=" + encodeURIComponent(text) + "&url=" + encodeURIComponent(abs);
    $("lbShare").hidden = !navigator.share;
    $("lbShare").onclick = () => navigator.share({ title: text, url: abs }).catch(() => {});
    const dlg = $("lightbox");
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute("open", "");
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-design]"); if (b) { openDesign(b.dataset.design); return; }
    if (e.target.id === "lightbox" || e.target.closest("#lbClose")) $("lightbox").close();
  });
  async function loadDesigns() {
    try {
      const r = await fetch("data/designs.json?t=" + Date.now(), { cache: "no-store" });
      DESIGNS = r.ok ? ((await r.json()).designs || []) : [];
    } catch (e) { DESIGNS = []; }
    renderDesigns();
  }


  /* ---------- أضف للتقويم (.ics) ---------- */
  const icsDate = (d) => new Date(d).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const icsEsc = (t) => String(t || "").replace(/[\\,;]/g, (c) => "\\" + c).replace(/\n/g, "\\n");
  function icsEvent(m) {
    const start = new Date(m.date), end = new Date(start.getTime() + 2 * 3600e3);
    const title = `${arTeam(m.home.name)} × ${arTeam(m.away.name)}`;
    return ["BEGIN:VEVENT", `UID:mnbr-${m.id || start.getTime()}@mnbralhilal`, `DTSTAMP:${icsDate(Date.now())}`,
      `DTSTART:${icsDate(start)}`, `DTEND:${icsDate(end)}`, `SUMMARY:${icsEsc("⚽ " + title)}`,
      `DESCRIPTION:${icsEsc(arLeague(m.league) + " — من منبر الهلال")}`, m.venue ? `LOCATION:${icsEsc(m.venue)}` : "",
      "BEGIN:VALARM", "TRIGGER:-PT1H", "ACTION:DISPLAY", `DESCRIPTION:${icsEsc("باقي ساعة: " + title)}`, "END:VALARM", "END:VEVENT"].filter(Boolean).join("\r\n");
  }
  function downloadIcs(matches, name) {
    const body = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Mnbralhilal//AR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH", "X-WR-CALNAME:مباريات الهلال — منبر",
      ...matches.map(icsEvent), "END:VCALENDAR"].join("\r\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/calendar;charset=utf-8" }));
    const a = document.createElement("a"); a.href = url; a.download = name; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 1500);
  }
  let CAL_NEXT = null, CAL_ALL = [];
  document.addEventListener("click", (e) => {
    if (e.target.closest("#calNext") && CAL_NEXT) downloadIcs([CAL_NEXT], "hilal-match.ics");
    if (e.target.closest("#calAll") && CAL_ALL.length) downloadIcs(CAL_ALL, "hilal-matches.ics");
  });


  /* ---------- التحديث المباشر (Cloudflare Worker — data/live.json فيه الرابط) ---------- */
  let NEXT_BASE = null, LIVE_M = null, LIVE_URL = null, liveTimer = null, lastGoals = null;
  const sameMatch = (a, b) => Math.abs(new Date(a.date) - new Date(b.date)) < 6 * 3600e3;
  function goalToast(text) {
    const t = document.createElement("div");
    t.className = "goal-toast"; t.setAttribute("role", "status");
    t.innerHTML = `<b>⚽ هدف!</b><span>${esc(text)}</span>`;
    document.body.appendChild(t);
    setTimeout(() => t.classList.add("out"), 5200); setTimeout(() => t.remove(), 6000);
  }
  async function pollLive() {
    if (!LIVE_URL || !NEXT_BASE) return;
    let d;
    try { d = await (await fetch(LIVE_URL, { cache: "no-store" })).json(); } catch (e) { return; }
    if (!d || !d.match || !sameMatch(d.match, NEXT_BASE)) return;
    const lm = d.match;
    const m = { ...NEXT_BASE, id: lm.id, status: lm.status, elapsed: lm.elapsed, goals: lm.goals,
      home: { ...NEXT_BASE.home, id: lm.home.id, logo: NEXT_BASE.home.logo || lm.home.logo },
      away: { ...NEXT_BASE.away, id: lm.away.id, logo: NEXT_BASE.away.logo || lm.away.logo } };
    // هدف جديد للهلال؟
    const hilalHome = lm.home.id === 2932;
    const ours = hilalHome ? lm.goals[0] : lm.goals[1];
    if (lastGoals !== null && ours > lastGoals) {
      const g = (lm.events || []).filter((e) => e.type === "Goal" && e.team === 2932).pop();
      goalToast(g ? `${g.player || ""} ${g.min ? g.min + "'" : ""} — الهلال ${lm.goals[0]}-${lm.goals[1]}` : `الهلال ${lm.goals[0]}-${lm.goals[1]}`);
    }
    lastGoals = ours;
    LIVE_M = m;
    renderNext(m);
    if (d.status === "done") { clearInterval(liveTimer); liveTimer = null; }
  }
  async function startLive() {
    if (liveTimer || !NEXT_BASE) return;
    const k = new Date(NEXT_BASE.date).getTime(), now = Date.now();
    if (now < k - 10 * 60e3 || now > k + 160 * 60e3) {
      // نرجع نشيك قبل المباراة بدقائق لو الصفحة مفتوحة
      if (now < k && k - now < 6 * 3600e3) setTimeout(startLive, Math.max(30e3, k - 10 * 60e3 - now));
      return;
    }
    if (!LIVE_URL) {
      try { LIVE_URL = (await (await fetch("data/live.json?t=" + Date.now(), { cache: "no-store" })).json()).url; } catch (e) { return; }
    }
    if (!LIVE_URL) return;
    pollLive(); liveTimer = setInterval(pollLive, 30e3);
  }

  /* ---------- البطاقة الرئيسية: المباراة القادمة ---------- */
  let countTimer = null;
  function renderNext(m) {
    const card = $("nextCard");
    if (!card) return;
    if (!m) { card.innerHTML = `<div class="empty"><svg class="i"><use href="#i-ball"/></svg>لا توجد مباراة قادمة مسجلة حالياً</div>`; return; }
    const d = new Date(m.date);
    const live = LIVE.includes(m.status);
    const CITY = { Riyadh: "الرياض", Jeddah: "جدة", Dammam: "الدمام", Buraydah: "بريدة", Makkah: "مكة", Mecca: "مكة", Medina: "المدينة المنورة", "Al Khobar": "الخبر", Abha: "أبها", "Ha'il": "حائل", Hail: "حائل", Doha: "الدوحة", "Al Rayyan": "الريان", Dubai: "دبي", "Abu Dhabi": "أبوظبي", "Al Ain": "العين", Sharjah: "الشارقة" };
    const venue = m.venue ? " · " + esc(CITY[m.venue] || m.venue) : "";
    const mid = live
      ? `<span class="live"><span class="dot"></span>مباشر${m.elapsed ? " " + ar(m.elapsed) + "'" : ""}</span>
         <div class="kick num" style="direction:rtl">${m.goals?.[0] ?? 0} - ${m.goals?.[1] ?? 0}</div>`
      : `<small class="lbl">انطلاق المباراة</small>
         <div class="kick num">${fTime.format(d)}</div>
         <small class="lbl">بتوقيت مكة</small>`;
    card.innerHTML = `
      <div class="next-head"><span class="comp"><svg class="i"><use href="#i-trophy"/></svg>${esc(arLeague(m.league))}</span><span class="meta"><svg class="i"><use href="#i-${m.venue ? "pin" : "cal"}"/></svg>${esc(fDay.format(d))}${venue}</span></div>
      <div class="vs">
        <div class="t">${crest(m.home, "crest lg")}${esc(arTeam(m.home.name))}</div>
        <div class="mid">${mid}</div>
        <div class="t">${crest(m.away, "crest lg")}${esc(arTeam(m.away.name))}</div>
      </div>
      <div class="count num" id="count" aria-live="polite"></div>${nextExtrasHtml(m)}${live ? "" : `<div class="cal-row"><a class="cal-btn" href="play.html#predict">🎯 توقّع النتيجة</a><button type="button" class="cal-btn" id="calNext">📅 أضف للتقويم</button></div>`}${matchSponsorHtml()}`;
    CAL_NEXT = live ? null : m;
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
    if (!list) return;
    const show = (up) => {
      $("tabUp").setAttribute("aria-selected", up);
      $("tabRes").setAttribute("aria-selected", !up);
      const arr = up ? upcoming : results;
      list.innerHTML = arr.length ? arr.map((m) => row(m)).join("") : `<div class="empty">${up ? "لا توجد مباريات قادمة مسجلة" : "لا توجد نتائج بعد"}</div>`;
      CAL_ALL = upcoming.filter((m) => !LIVE.includes(m.status));
      if (up && CAL_ALL.length) list.innerHTML += `<button type="button" class="cal-btn cal-all" id="calAll">📅 أضف ${CAL_ALL.length > 1 ? "كل مباريات الهلال القادمة" : "المباراة"} للتقويم</button>`;
    };
    $("tabUp").onclick = () => show(true);
    $("tabRes").onclick = () => show(false);
    show(true);
    $("formStrip").innerHTML = results.slice(0, 5).reverse().map((m) => { const o = outcome(m); return o ? `<span class="res ${o}">${lbl[o]}</span>` : ""; }).join("") || "<span>—</span>";
  }

  /* ---------- مباريات اليوم / أمس ---------- */
  function renderDay(el, day, emptyMsg, limit) {
    if (!el) return;
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

  /* ---------- شريط النتائج أعلى الصفحة ---------- */
  function renderStrip(day) {
    if (!$("strip")) return;
    // الأولوية: مباريات الهلال ثم المباشر ثم الدوري السعودي ثم الباقي
    const all = [];
    (day?.groups || []).forEach((g) => g.matches.forEach((m) => all.push([g, m])));
    const score = ([g, m]) => (m.home.id === HILAL_ID || m.away.id === HILAL_ID ? 8 : 0) + (LIVE.includes(m.status) ? 4 : 0) + ((m.league?.country || "") === "Saudi-Arabia" ? 2 : 0);
    all.sort((x, y) => score(y) - score(x));
    const list = all.slice(0, 14);
    $("stripWrap").hidden = !list.length;
    $("strip").innerHTML = list.map(([g, m]) => {
      const live = LIVE.includes(m.status), done = DONE.includes(m.status);
      const top = live ? `<span class="pill">مباشر</span><span>${m.elapsed ? ar(m.elapsed) + "'" : ""}</span>`
        : done ? `<span>${esc(arLeague(g.league))}</span><span>انتهت</span>`
        : `<span>${esc(arLeague(g.league))}</span><span class="num">${fTime.format(new Date(m.date))}</span>`;
      const g0 = m.goals ? (m.goals[0] ?? 0) : "", g1 = m.goals ? (m.goals[1] ?? 0) : "";
      const hl = m.home.id === HILAL_ID || m.away.id === HILAL_ID ? " hl" : "";
      return `<a class="sc-card${hl}" href="matches.html#today"><div class="sc-top">${top}</div>
        <div class="sc-t">${crest(m.home)}<span>${esc(arTeam(m.home.name))}</span><b class="num">${g0}</b></div>
        <div class="sc-t">${crest(m.away)}<span>${esc(arTeam(m.away.name))}</span><b class="num">${g1}</b></div></a>`;
    }).join("");
  }

  /* ---------- الترتيب ---------- */
  function renderTables(st) {
    const spl = st?.spl?.rows || [];
    const n = spl.length;
    const cls = (r) => {
      const desc = (r.description || "").toLowerCase();
      return desc.includes("relegation") ? "rel" : (desc.includes("champions") || desc.includes("afc")) ? "acl" : (r.rank <= 3 ? "acl" : r.rank > n - 3 ? "rel" : "");
    };
    // جدول مختصر للرئيسية: أول ٥ + الهلال لو كان برا
    if ($("splMini")) {
      let rows = spl.slice(0, 5);
      const meRow = spl.find((r) => r.team.id === HILAL_ID);
      if (meRow && !rows.includes(meRow)) rows = [...rows.slice(0, 4), meRow];
      put("splMini", rows.length ? rows.map((r) => `<tr class="${cls(r)}${r.team.id === HILAL_ID ? " hl" : ""}"><td class="pos num">${r.rank}</td><td class="team"><div>${crest(r.team)}<span>${esc(arTeam(r.team.name))}</span></div></td><td class="num">${r.played}</td><td class="num" style="direction:ltr">${r.gd > 0 ? "+" : ""}${r.gd}</td><td class="pts">${r.points}</td></tr>`).join("")
        : `<tr><td colspan="5" class="empty">الترتيب غير متوفر حالياً</td></tr>`);
    }
    if ($("spl")) $("spl").innerHTML = spl.length ? spl.map((r) => {
      const desc = (r.description || "").toLowerCase();
      const cls = desc.includes("relegation") ? "rel" : (desc.includes("champions") || desc.includes("afc")) ? "acl" : (r.rank <= 3 ? "acl" : r.rank > n - 3 ? "rel" : "");
      return `<tr class="${cls}${r.team.id === HILAL_ID ? " hl" : ""}"><td class="pos num">${r.rank}</td><td class="team"><div>${crest(r.team)}<span>${esc(arTeam(r.team.name))}</span></div></td><td class="num">${r.played}</td><td class="num">${r.win}</td><td class="num">${r.draw}</td><td class="num">${r.lose}</td><td class="num" style="direction:ltr">${r.gd > 0 ? "+" : ""}${r.gd}</td><td class="pts">${r.points}</td></tr>`;
    }).join("") : `<tr><td colspan="8" class="empty">الترتيب غير متوفر حالياً</td></tr>`;

    const epl = (st?.epl?.rows || []).slice(0, lim("epl", 99));
    if ($("epl")) $("epl").innerHTML = epl.length ? epl.map((r) => `<tr><td class="pos num">${r.rank}</td><td class="team"><div>${crest(r.team)}<span>${esc(arTeam(r.team.name))}</span></div></td><td class="num">${r.played}</td><td class="pts">${r.points}</td></tr>`).join("")
      : `<tr><td colspan="4" class="empty">الترتيب غير متوفر حالياً</td></tr>`;
    if (!$("mini")) return;
    const me = spl.find((r) => r.team.id === HILAL_ID);
    $("mini").innerHTML = me
      ? `<div><b class="num">${ar(me.rank)}</b><small>الترتيب</small></div><div><b class="num">${ar(me.points)}</b><small>نقطة</small></div><div><b class="num" style="direction:ltr">${me.gd > 0 ? "+" : me.gd < 0 ? "-" : ""}${ar(Math.abs(me.gd))}</b><small>فارق الأهداف</small></div>`
      : `<div><b>—</b><small>الترتيب</small></div><div><b>—</b><small>نقطة</small></div><div><b>—</b><small>فارق الأهداف</small></div>`;
  }

  /* ---------- الأخبار ---------- */
  // روابط الأخبار القديمة كانت تشير لأقسام داخل الرئيسية؛ الحين كل قسم له صفحة
  const LINKS = { "#today": "matches.html#today", "#yesterday": "matches.html#yesterday", "#hilal": "matches.html", "#table": "standings.html", "#youth": "youth.html", "#news": "news.html", "#designs": "designs.html" };
  const fixLink = (l) => LINKS[l] || l || "news.html";
  function renderNews(news) {
    news = news || [];
    // شريط عاجل يظهر بس لو فيه خبر عاجل فعلاً ("breaking": true أو تصنيف "عاجل")
    const breaking = news.filter((n) => n.breaking || n.tag === "عاجل");
    const tk = document.querySelector(".ticker");
    if (tk) {
      tk.hidden = !breaking.length;
      const t = breaking.map((n) => `<span>● ${esc(n.title)}</span>`).join("");
      put("tick", t + t);
    }
    if (!$("newsList")) return;
    news = news.slice(0, lim("newsList", 999));
    $("newsList").innerHTML = news.length ? news.map((n) =>
      `<a href="${esc(fixLink(n.link))}"><span class="k${n.tag === "عالمي" ? " world" : ""}">${esc(n.tag)}</span><div><h3>${esc(n.title)}</h3><p>${esc(n.body)}</p></div></a>`).join("")
      : `<div class="empty">لا توجد أخبار حالياً</div>`;
  }

  /* ---------- آخر نتيجة للهلال (الرئيسية) ---------- */
  function renderLast(h) {
    if (!$("lastCard")) return;
    const results = h?.results || [];
    const m = results[0];
    const form = results.slice(0, 5).reverse().map((x) => { const o = outcome(x); return o ? `<span class="res ${o}">${lbl[o]}</span>` : ""; }).join("");
    if (!m) { put("lastCard", `<div class="empty">لا توجد نتائج مسجلة بعد هذا الموسم</div>`); return; }
    const o = outcome(m);
    const word = { w: "فوز", d: "تعادل", l: "خسارة" }[o] || "";
    put("lastCard", `
      <div class="last-head"><span>${esc(arLeague(m.league))}</span><span>${esc(fDM.format(new Date(m.date)))}</span></div>
      <div class="last-vs">
        <div class="t">${crest(m.home, "crest md")}<span>${esc(arTeam(m.home.name))}</span></div>
        <div class="last-sc num">${m.goals?.[0] ?? "-"} <i>-</i> ${m.goals?.[1] ?? "-"}</div>
        <div class="t">${crest(m.away, "crest md")}<span>${esc(arTeam(m.away.name))}</span></div>
      </div>
      <div class="last-foot">${word ? `<span class="res-word ${o}">${word}</span>` : ""}${form ? `<span class="form-mini"><small>آخر 5</small>${form}</span>` : ""}</div>`);
  }

  function render(data) {
    HILAL_ID = data.hilal?.teamId ?? null;
    let h = data.hilal || {};
    const fb = nextFromDesigns();
    if (!(h.upcoming || []).length && fb) h = { ...h, upcoming: [fb] };
    NEXT_BASE = (h.upcoming || [])[0] || null;
    renderNext(LIVE_M && NEXT_BASE && sameMatch(LIVE_M, NEXT_BASE) ? LIVE_M : NEXT_BASE);
    startLive();
    renderHilal(h);
    renderLast(h);
    if ($("todayDate")) $("todayDate").textContent = data.today?.date ? fDay.format(new Date(data.today.date + "T12:00:00+03:00")) : "";
    renderDay($("todayList"), data.today, "لا توجد مباريات اليوم في الدوريات المتابعة", 14);
    renderDay($("ydayList"), data.yesterday, "لا توجد نتائج لأمس", 10);
    renderTables(data.standings);
    renderStrip(data.today);
    renderNews(data.news);
    if ($("updated")) $("updated").textContent = data.updated
      ? "آخر تحديث: " + fmt({ day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(data.updated))
      : "بانتظار أول تحديث للبيانات";
  }

  /* ---------- الفئات السنية (data/youth.json — تعبئة يدوية) ---------- */
  const HILAL_LOGO = "https://media.api-sports.io/football/teams/2932.png";
  const yTeam = (name) => (name === "الهلال" ? { id: 2932, name, logo: HILAL_LOGO } : { id: null, name, logo: "" });
  function renderYouth(y) {
    const box = $("youth");
    if (!box) return;
    if (!y || (!(y.upcoming || []).length && !(y.results || []).length && !(y.table || []).length)) {
      box.hidden = !box.dataset.keep;
      put("yMatches", `<div class="empty">لا توجد بيانات للفئات السنية حالياً</div>`);
      return;
    }
    box.hidden = false;
    $("yTitle").textContent = y.title || "الهلال تحت 21";
    $("yComp").textContent = [y.competition, y.season].filter(Boolean).join(" · ");
    const toMatch = (m, done) => ({
      date: m.date, status: done ? "FT" : "NS",
      home: yTeam(m.home), away: yTeam(m.away),
      goals: done ? [m.homeGoals, m.awayGoals] : null,
      league: { name: [m.round, m.venue].filter(Boolean).join(" · ") }
    });
    const now = Date.now();
    const up = (y.upcoming || []).filter((m) => new Date(m.date) > now - 3 * 3600e3).sort((a, b) => a.date.localeCompare(b.date)).map((m) => toMatch(m, false));
    const res = (y.results || []).slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5).map((m) => toMatch(m, true));
    const list = [...up.slice(0, 3), ...res];
    $("yMatches").innerHTML = list.length ? list.map((m) => row(m)).join("") : `<div class="empty">لا توجد مباريات مسجلة</div>`;

    const t = (y.table || []).slice(0, 8);
    $("yTableHead").hidden = !t.length;
    $("yTable").closest(".tbl").hidden = !t.length;
    $("yUpdated").textContent = y.updated ? "حتى " + fmt({ day: "numeric", month: "long" }).format(new Date(y.updated + "T12:00:00+03:00")) : "";
    $("yTable").innerHTML = t.map((r, i) => `<tr class="${r.team === "الهلال" ? "hl" : ""}"><td class="pos num">${i + 1}</td><td class="team"><div>${crest(yTeam(r.team))}<span>${esc(r.team)}</span></div></td><td class="num">${r.played}</td><td class="num">${r.win}</td><td class="num">${r.draw}</td><td class="num">${r.lose}</td><td class="num" style="direction:ltr">${r.gf}:${r.ga}</td><td class="pts">${r.points}</td></tr>`).join("");

    const news = y.news || [];
    $("yNewsWrap").hidden = !news.length;
    $("yNews").innerHTML = news.map((n) => `<a href="${esc(n.link || "youth.html")}"><span class="k">${esc(n.tag || "تحت 21")}</span><div><h3>${esc(n.title)}</h3><p>${esc(n.body || "")}</p></div></a>`).join("");
  }
  async function loadYouth() {
    try {
      const r = await fetch("data/youth.json?t=" + Date.now(), { cache: "no-store" });
      renderYouth(r.ok ? await r.json() : null);
    } catch (e) { renderYouth(null); }
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
      if ($("updated")) $("updated").textContent = "تعذّر تحميل البيانات";
    }
  }
  /* ---------- كل الأرقام والرموز بالأرقام العربية الأصلية: ٠-٩ ← 0-9 ، ٪ ← % ---------- */
  const HINDI = "٠١٢٣٤٥٦٧٨٩", PERSIAN = "۰۱۲۳۴۵۶۷۸۹";
  const toArabic = (t) => t
    .replace(/[٠-٩]/g, (d) => HINDI.indexOf(d))
    .replace(/[۰-۹]/g, (d) => PERSIAN.indexOf(d))
    .replace(/٪/g, "%").replace(/٫/g, ".").replace(/٬/g, ",");
  const NEEDS = /[٠-٩۰-۹٪٫٬]/;
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

  (function () {
    const now = new Date(), y = now.getFullYear();
    const from = new Date(`${y}-10-01T00:00:00+03:00`), to = new Date(`${y}-10-21T00:00:00+03:00`);
    const el = document.getElementById("fdWrap");
    if (el) el.hidden = !(now >= from && now < to);
  })();

  Promise.all([loadAds(), loadDesigns()]).then(load).then(loadYouth);
  setInterval(load, 10 * 60 * 1000); // يعيد القراءة كل ١٠ دقائق
})();
