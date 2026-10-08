/* الرئيسية — تصميم مجلة (v3). يقرأ نفس بيانات الموقع الحالية. */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const TZ = "Asia/Riyadh";
  const fmt = (o) => new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { timeZone: TZ, ...o });
  const fDay = fmt({ weekday: "long", day: "numeric", month: "long" });
  const fTime = fmt({ hour: "2-digit", minute: "2-digit", hour12: false });
  const fWeek = fmt({ weekday: "short" });
  const j = (p) => fetch(p + (p.includes("?") ? "&" : "?") + "t=" + Date.now(), { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const LIVE = ["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP"];
  const DONE = ["FT", "AET", "PEN"];
  const ar = window.MNB || { arTeam: (n) => n, arLeague: (l) => l?.name || "" };
  const HILAL = 2932;
  const CITY = { Riyadh: "الرياض", Jeddah: "جدة", Dammam: "الدمام", Doha: "الدوحة", Dubai: "دبي", "Abu Dhabi": "أبوظبي" };

  const crestImg = (t, size = 78) => {
    if (t?.id === HILAL) return `<img src="https://media.api-sports.io/football/teams/2932.png" alt="" width="${size}" height="${size}">`;
    if (t?.logo) return `<img src="${esc(t.logo)}" alt="" width="${size}" height="${size}" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'mn-ph',textContent:'${esc((ar.arTeam(t.name) || "")[0] || "")}'}))">`;
    return `<span class="mn-ph">${esc((ar.arTeam(t?.name) || "?")[0])}</span>`;
  };

  /* ========== 1) الهيرو ========== */
  let cdTimer = null, LIVE_URL = null, liveTimer = null, NEXT = null, LIVE_M = null;
  function renderHero() {
    const el = $("mnHero"); if (!el) return;
    const m = LIVE_M || NEXT;
    if (!m) { el.innerHTML = `<p style="text-align:center;color:var(--mn-muted);padding:40px 0">ما فيه مباراة قادمة للهلال حالياً</p>`; return; }
    const live = LIVE.includes(m.status), done = DONE.includes(m.status), d = new Date(m.date);
    const comp = ar.arLeague(m.league);
    const topRight = live
      ? `<span class="mn-live">مباشر${m.elapsed ? " · " + m.elapsed + "'" : ""}</span>`
      : done ? `<span style="color:var(--mn-ink);font-weight:700;letter-spacing:.1em">انتهت</span>`
      : `<span>قادمة</span>`;
    const centerSlot = (live || done) && m.goals
      ? `<b class="mn-score"><bdi dir="ltr">${m.goals[1]}:${m.goals[0]}</bdi></b><small>${done ? "النهائي" : "جارية"}</small>`
      : `<b class="mn-time">${fTime.format(d).replace(":", "<em>:</em>")}</b><small>بتوقيت مكة</small>`;
    const venue = m.venue ? (CITY[m.venue] || (/[؀-ۿ]/.test(m.venue) ? m.venue : "")) : "";

    el.innerHTML = `
      <div class="mn-hero-head">
        <span>${esc(comp)}${m.round ? " · " + esc(m.round) : ""}</span>
        ${topRight}
      </div>
      <div class="mn-matchup">
        <div class="mn-team">${crestImg(m.home)}<b>${esc(ar.arTeam(m.home.name))}</b></div>
        <div class="mn-centerslot">${centerSlot}</div>
        <div class="mn-team">${crestImg(m.away)}<b>${esc(ar.arTeam(m.away.name))}</b></div>
      </div>
      ${live || done ? "" : `<div class="mn-when">${esc(fDay.format(d))}</div>${venue ? `<div class="mn-venue">${esc(venue)}</div>` : ""}<div class="mn-cd" id="mnCd"></div>`}`;

    const after = $("mnHeroAfter"); if (after) {
      after.innerHTML = `
        <a class="mn-cta" href="matchday.html">${live ? "تابع المباراة لحظة بلحظة" : done ? "راجع المباراة" : "مركز المباراة"}</a>
        <nav class="mn-shortcuts">
          <a href="play.html#predict">${window.ICON ? window.ICON.html("whistle", { size: 18, cls: "mn-i" }) : ""}توقّع النتيجة</a>
          <a href="play.html#coach">${window.ICON ? window.ICON.html("users", { size: 18, cls: "mn-i" }) : ""}كن أنت المدرب</a>
        </nav>`;
    }

    clearInterval(cdTimer);
    if (!live && !done) {
      const t = () => {
        const s = Math.max(0, (d - Date.now()) / 1000); const el2 = $("mnCd"); if (!el2) return;
        const D = Math.floor(s / 86400), H = Math.floor((s % 86400) / 3600), M = Math.floor((s % 3600) / 60), S = Math.floor(s % 60);
        el2.innerHTML = s > 0
          ? [[D, "يوم"], [H, "ساعة"], [M, "دقيقة"], [S, "ثانية"]].map(([v, l]) => `<div><b>${String(v).padStart(2, "0")}</b><small>${l}</small></div>`).join("")
          : `<div><b style="font-size:22px;letter-spacing:0">انطلقت</b></div>`;
      };
      t(); cdTimer = setInterval(t, 1000);
    }
  }

  async function pollLive() {
    if (!LIVE_URL || !NEXT) return;
    const d = await j(LIVE_URL); if (!d?.match) return;
    const lm = d.match;
    if (!(Math.abs(new Date(NEXT.date) - new Date(lm.date)) < 6 * 3600e3)) return;
    LIVE_M = { ...NEXT, status: lm.status, elapsed: lm.elapsed, goals: lm.goals, home: { ...NEXT.home, id: lm.home.id }, away: { ...NEXT.away, id: lm.away.id } };
    renderHero();
    if (d.status === "done") { clearInterval(liveTimer); liveTimer = null; }
  }

  /* ========== 2) الشرائط السطرية ========== */
  async function renderInline() {
    const [occ, man] = await Promise.all([j("data/occasions.json"), j("data/manual-news.json")]);
    const nowR = () => { const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date()).map((x) => [x.type, x.value])); return { d: `${p.day}/${p.month}`, mins: (+p.hour % 24) * 60 + +p.minute }; };
    const n = nowR();
    const openAt = (occ?.time || "17:00").split(":").map(Number)[0] * 60 + (+((occ?.time || "17:00").split(":")[1]) || 0);
    const today = (occ?.items || []).filter((o) => o.d === n.d);
    const occEl = $("mnOcc");
    if (occEl && today.length && n.mins >= openAt) {
      occEl.innerHTML = `${window.ICON ? window.ICON.html("history", { size: 18, cls: "mn-i" }) : ""}<b>في مثل هذا اليوم</b><span>${esc(today[0].title)}${today.length > 1 ? ` و+${today.length - 1}` : ""}</span>`;
      occEl.hidden = false;
    }
    const now = Date.now();
    const b = ((man?.items || []).filter((n) => n.breaking && n.title && (!n.until || new Date(n.until) > now)))[0];
    const brkEl = $("mnBreak");
    if (brkEl && b) {
      brkEl.innerHTML = `${window.ICON ? window.ICON.html("bolt", { size: 18, cls: "mn-i" }) : ""}<b>عاجل</b><span>${esc(b.title)}</span>`;
      brkEl.hidden = false;
    }
  }

  /* ========== 3) الهلال هذا الموسم — سكوربورد ========== */
  function renderScoreboard(st, hilal) {
    const el = $("mnScoreboard"); if (!el) return;
    const me = (st?.spl?.rows || []).find((r) => r.team.id === HILAL);
    if (!me) { el.innerHTML = `<p style="text-align:center;color:var(--mn-muted);padding:20px">—</p>`; return; }
    const results = (hilal?.results || []).slice(0, 5);
    const form = results.map((m) => { const home = m.home.id === HILAL; const us = home ? m.goals[0] : m.goals[1], them = home ? m.goals[1] : m.goals[0]; return us > them ? ["w", "ف"] : us < them ? ["l", "خ"] : ["d", "ت"]; });
    el.innerHTML = `
      <div class="mn-score-row">
        <div><b>${me.points}</b><small>النقاط</small></div>
        <div><b>${me.rank}</b><small>الترتيب</small></div>
        <div><b>${me.played}</b><small>مباريات</small></div>
      </div>
      ${form.length ? `<div class="mn-form"><span class="lbl">آخر النتائج</span><div class="mn-form-strip">${form.reverse().map(([c, t]) => `<span class="${c}">${t}</span>`).join("")}</div></div>` : ""}`;
  }

  /* ========== 4) تصاميم — سكرول أفقي ========== */
  async function renderDesigns() {
    const d = await j("data/designs.json");
    const el = $("mnDesigns"); if (!el) return;
    const list = (d?.designs || []).slice(0, 8);
    if (!list.length) { el.innerHTML = ""; return; }
    el.innerHTML = list.map((x) => `<a href="designs.html" data-design="${esc(x.id)}"><img src="${esc(x.thumb || x.image)}" alt="" loading="lazy"><div class="mn-rail-meta"><em>${esc(x.type || "تصميم")}</em><b>${esc(x.title || "")}</b></div></a>`).join("");
  }

  /* ========== 5) مباريات الهلال — صفوف نظيفة ========== */
  function renderMatches(hilal) {
    const el = $("mnMatches"); if (!el) return;
    const now = Date.now();
    const items = [
      ...(hilal?.results || []).slice(0, 2).reverse(),
      ...(hilal?.upcoming || []).filter((m) => !(LIVE.includes(m.status) || DONE.includes(m.status))).slice(0, 3)
    ].slice(0, 4);
    if (!items.length) { el.innerHTML = ""; return; }
    el.innerHTML = items.map((m) => {
      const d = new Date(m.date), live = LIVE.includes(m.status), done = DONE.includes(m.status);
      const home = m.home.id === HILAL;
      const opp = ar.arTeam((home ? m.away : m.home).name);
      const us = m.goals ? (home ? m.goals[0] : m.goals[1]) : 0;
      const them = m.goals ? (home ? m.goals[1] : m.goals[0]) : 0;
      let sc, cls = "";
      if (live) { sc = `<bdi dir="ltr">${us}-${them}</bdi>`; cls = "live"; }
      else if (done) { sc = `<bdi dir="ltr">${us}-${them}</bdi>`; cls = us > them ? "win" : us < them ? "loss" : ""; }
      else sc = fTime.format(d);
      const whenCell = done || live ? `<div class="mn-when-cell"><b>${live ? "مباشر" : "انتهت"}</b><span>${esc(fWeek.format(d))}</span></div>` : `<div class="mn-when-cell"><b>${esc(fWeek.format(d))}</b><span>${esc(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "2-digit", month: "2-digit" }).format(d))}</span></div>`;
      return `<a class="mn-list-row" href="matches.html">
        <span class="mn-dot"></span>
        <div style="display:flex;align-items:center;gap:14px;min-width:0">
          ${whenCell}
          <div class="mn-vs">الهلال <em>${home ? "×" : "في ضيافة"}</em>${esc(opp)}</div>
        </div>
        <div class="mn-sc ${cls}">${sc}</div>
      </a>`;
    }).join("");
  }

  /* ========== 6) فيديو ========== */
  async function renderVideo() {
    const d = await j("data/videos.json");
    const el = $("mnVideo"); if (!el) return;
    const list = d?.featured?.length ? d.featured : (d?.clips || []);
    const v = list[0], user = d?.tiktok_user;
    if (!v && !user) { el.innerHTML = ""; const sec = $("mnVideoSec"); if (sec) sec.hidden = true; return; }
    const href = v?.url || (user ? `https://www.tiktok.com/@${user}` : "videos.html");
    const title = v?.title || (user ? `آخر فيديوهات منبر على تيك توك` : "فيديو منبر");
    const img = v?.thumb ? `<img src="${esc(v.thumb)}" alt="" loading="lazy">` : "";
    el.innerHTML = `<a href="${esc(href)}" target="_blank" rel="noopener">${img}<span class="mn-play">${window.ICON ? window.ICON.html("play", { size: 28 }) : "▶"}</span><span class="mn-cap">${esc(title)}</span></a>`;
  }

  /* ========== 7) أخبار ========== */
  function renderNews(site, man) {
    const el = $("mnNews"); if (!el) return;
    const mine = (man?.items || []).filter((n) => n.title).map((n) => ({ tag: n.tag || "منبر", title: n.title, body: n.body || "", breaking: n.breaking }));
    const items = [...mine, ...(site?.news || [])].slice(0, 5);
    el.innerHTML = items.map((n) => `<a href="news.html"><span class="mn-tag ${n.breaking ? "hl" : ""}">${esc(n.tag || "خبر")}</span><h3>${esc(n.title)}</h3>${n.body ? `<p>${esc(n.body)}</p>` : ""}</a>`).join("") || `<p style="color:var(--mn-muted);text-align:center;padding:30px 0">لا توجد أخبار</p>`;
  }

  /* ========== التحميل ========== */
  async function waitIcons(ms = 2000) { const t = Date.now(); while (!window.ICON && Date.now() - t < ms) await new Promise((r) => setTimeout(r, 50)); if (window.ICON && window.ICON.inject) window.ICON.inject(); }

  (async function init() {
    await waitIcons();
    const [site, live, man] = await Promise.all([j("data/site.json"), j("data/live.json"), j("data/manual-news.json")]);
    LIVE_URL = live?.url || null;
    let next = (site?.hilal?.upcoming || []).find((m) => !["CANC", "ABD", "PST"].includes(m.status));
    if (!next) {
      const dd = await j("data/designs.json");
      const dm = (dd?.designs || []).find((x) => x.match && new Date(x.match.date) > Date.now() - 3 * 3600e3);
      if (dm) next = { date: dm.match.date, status: "NS", venue: dm.match.venue || "", round: dm.match.round, league: { name: dm.match.competition || "" },
        home: { id: dm.match.home === "الهلال" ? HILAL : null, name: dm.match.home }, away: { id: dm.match.away === "الهلال" ? HILAL : null, name: dm.match.away }, goals: null };
    }
    NEXT = next;
    renderHero();
    renderScoreboard(site?.standings, site?.hilal);
    renderMatches(site?.hilal);
    renderInline();
    renderDesigns();
    renderVideo();
    renderNews(site, man);

    if (LIVE_URL && NEXT) {
      const k = new Date(NEXT.date).getTime(), now = Date.now();
      if (now > k - 10 * 60e3 && now < k + 160 * 60e3) { pollLive(); liveTimer = setInterval(pollLive, 15e3); }
      else if (now < k && k - now < 6 * 3600e3) setTimeout(() => { pollLive(); liveTimer = setInterval(pollLive, 15e3); }, Math.max(30e3, k - 10 * 60e3 - now));
    }
    $("updated") && ($("updated").textContent = site?.updated ? "آخر تحديث: " + fmt({ day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(site.updated)) : "");
  })();
})();
