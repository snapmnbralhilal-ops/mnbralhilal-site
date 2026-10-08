/* الرئيسية الجديدة — يقرأ نفس بيانات الموقع الحالية (data/site.json وغيرها) ويرسمها بالتصميم الجديد */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const TZ = "Asia/Riyadh";
  const fmt = (o) => new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { timeZone: TZ, ...o });
  const fDay = fmt({ weekday: "long", day: "numeric", month: "long" });
  const fTime = fmt({ hour: "2-digit", minute: "2-digit", hour12: false });
  const j = (p) => fetch(p + (p.includes("?") ? "&" : "?") + "t=" + Date.now(), { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const LIVE = ["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP"];
  const DONE = ["FT", "AET", "PEN"];
  const ar = window.MNB || { arTeam: (n) => n, arLeague: (l) => l?.name || "" };
  const HILAL = 2932;
  const LOCAL_LOGOS = { 2938: "ittihad", 2939: "nasr", 2929: "ahli" };
  const crest = (t) => {
    if (t?.id === HILAL) return `<img class="crest" src="https://media.api-sports.io/football/teams/2932.png" alt="">`;
    if (t?.id && LOCAL_LOGOS[t.id]) return `<img class="crest" src="assets/teams/${LOCAL_LOGOS[t.id]}.png" alt="">`;
    if (t?.logo) return `<img class="crest" src="${esc(t.logo)}" alt="" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'ph',textContent:'${esc((ar.arTeam(t.name) || "")[0] || "")}'}))">`;
    return `<span class="ph">${esc((ar.arTeam(t?.name) || "?")[0])}</span>`;
  };

  // ننتظر مكتبة الأيقونات قبل أي رسم (layout.js يحمّلها async)
  const ICON = () => (window.ICON && window.ICON.html) ? window.ICON : { html: (n, { size = 20 } = {}) => `<svg width="${size}" height="${size}" aria-hidden="true"><use href="#i2-${n}"/></svg>` };
  async function waitIcons(ms = 2000) {
    const t = Date.now();
    while (!window.ICON && Date.now() - t < ms) await new Promise((r) => setTimeout(r, 50));
    if (window.ICON && window.ICON.inject) window.ICON.inject();
  }

  /* ---------- 1) الهيرو: المباراة ---------- */
  let cdTimer = null, LIVE_URL = null, liveTimer = null, NEXT = null, LIVE_M = null;
  function renderHero() {
    const m = LIVE_M || NEXT;
    const el = $("v2Hero");
    if (!m) { el.innerHTML = `<div class="v2-empty">ما فيه مباراة قادمة للهلال حالياً</div>`; return; }
    const live = LIVE.includes(m.status), done = DONE.includes(m.status), d = new Date(m.date);
    const comp = ar.arLeague(m.league);
    const topBadge = live ? `<span class="v2-badge live">مباشر${m.elapsed ? " " + m.elapsed + "'" : ""}</span>` : done ? `<span class="v2-badge">النتيجة النهائية</span>` : `<span class="v2-badge">المباراة القادمة</span>`;
    const mid = (live || done) && m.goals
      ? `<b class="v2-score"><bdi dir="ltr">${m.goals[1]} - ${m.goals[0]}</bdi></b><small>${done ? "انتهت" : "النتيجة الآن"}</small>`
      : `<b class="v2-time">${fTime.format(d)}</b><small>بتوقيت مكة</small>`;
    // اسم الملعب: نترجم المدن الشائعة ونخفي الباقي بدل ما نكتب "Riyadh"
    const CITY = { Riyadh: "الرياض", Jeddah: "جدة", Dammam: "الدمام", Doha: "الدوحة", Dubai: "دبي", "Abu Dhabi": "أبوظبي" };
    const venue = m.venue ? (CITY[m.venue] || (/[؀-ۿ]/.test(m.venue) ? m.venue : "")) : "";
    const meta = [esc(fDay.format(d)), venue ? "في " + esc(venue) : "", m.round].filter(Boolean).join(" · ");
    el.innerHTML = `
      <div class="v2-hero-top"><span class="v2-comp">${ICON().html("trophy", { size: 14 })}${esc(comp)}</span>${topBadge}</div>
      <div class="v2-match">
        <div class="v2-side">${crest(m.home).replace('class="crest"', 'class="v2-crest"').replace('class="ph"', 'class="v2-crest ph"')}<b>${esc(ar.arTeam(m.home.name))}</b></div>
        <div class="v2-mid">${mid}</div>
        <div class="v2-side">${crest(m.away).replace('class="crest"', 'class="v2-crest"').replace('class="ph"', 'class="v2-crest ph"')}<b>${esc(ar.arTeam(m.away.name))}</b></div>
      </div>
      <div class="v2-meta">${meta}</div>
      ${live || done ? "" : `<div class="v2-cd" id="v2Cd"></div>`}
      <div class="v2-hero-cta">
        <a class="v2-cta-primary" href="matchday.html"><span>${live || done ? "مركز المباراة" : "تابع المباراة في مركز المباراة"}</span>${ICON().html("chevron", { size: 18 })}</a>
      </div>`;
    clearInterval(cdTimer);
    if (!live && !done) {
      const t = () => {
        const s = Math.max(0, (d - Date.now()) / 1000);
        const el2 = $("v2Cd"); if (!el2) return;
        const D = Math.floor(s / 86400), H = Math.floor((s % 86400) / 3600), M = Math.floor((s % 3600) / 60), S = Math.floor(s % 60);
        el2.innerHTML = s > 0
          ? [[D, "يوم"], [H, "ساعة"], [M, "دقيقة"], [S, "ثانية"]].map(([v, l]) => `<div><b>${String(v).padStart(2, "0")}</b><small>${l}</small></div>`).join("")
          : `<div style="min-width:auto;padding:10px 16px"><b>انطلقت المباراة</b></div>`;
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

  /* ---------- 2) بانر «في مثل هذا اليوم» ---------- */
  async function renderToday() {
    const d = await j("data/occasions.json");
    const el = $("v2Today"); if (!d || !el) return;
    const nowRiyadh = () => { const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).formatToParts(new Date()).map((x) => [x.type, x.value])); return { d: `${p.day}/${p.month}`, mins: (+p.hour % 24) * 60 + +p.minute }; };
    const n = nowRiyadh();
    const openAt = (d.time || "17:00").split(":").map(Number)[0] * 60 + (+((d.time || "17:00").split(":")[1]) || 0);
    const today = (d.items || []).filter((o) => o.d === n.d);
    if (!today.length || n.mins < openAt) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = `<a href="occasions.html" style="display:contents">
      <span class="v2-ic">${ICON().html("history", { size: 22 })}</span>
      <span class="v2-today-t"><b>في مثل هذا اليوم · ${today.length} ${today.length === 1 ? "مناسبة" : today.length === 2 ? "مناسبتين" : "مناسبات"}</b><span>${esc(today[0].title)}${today.length > 1 ? ` · +${today.length - 1}` : ""}</span></span>
      ${ICON().html("chevron", { size: 18 })}
    </a>`;
  }

  /* ---------- 3) خبر عاجل ---------- */
  async function renderBreaking(site) {
    const el = $("v2Break"); if (!el) return;
    const man = await j("data/manual-news.json");
    const now = Date.now();
    const mine = (man?.items || []).filter((n) => n.breaking && n.title && (!n.until || new Date(n.until) > now));
    const b = mine.concat((site?.news || []).filter((n) => n.breaking || n.tag === "عاجل"))[0];
    if (!b) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = `<span class="v2-tag">${ICON().html("bolt", { size: 11 })}عاجل</span><span>${esc(b.title)}</span>`;
  }

  /* ---------- 4) إحصائيات الهلال هذا الموسم ---------- */
  function renderStats(st, hilal) {
    const rows = st?.spl?.rows || [];
    const me = rows.find((r) => r.team.id === HILAL);
    const results = (hilal?.results || []).slice(0, 5);
    const el = $("v2Stats"); if (!el) return;
    if (!me) { el.innerHTML = `<div class="v2-empty" style="grid-column:1/-1">الإحصائيات تطلع قريباً</div>`; return; }
    const form = results.map((m) => {
      const home = m.home.id === HILAL;
      const us = home ? m.goals[0] : m.goals[1], them = home ? m.goals[1] : m.goals[0];
      return us > them ? ["w", "ف"] : us < them ? ["l", "خ"] : ["d", "ت"];
    });
    el.innerHTML = `
      <div class="v2-stat"><b>${me.rank}</b><small>الترتيب</small></div>
      <div class="v2-stat"><b>${me.points}</b><small>النقاط</small></div>
      <div class="v2-stat"><b>${me.played}</b><small>مباريات</small></div>
      <div class="v2-stat"><div class="form">${form.map(([c, t]) => `<span class="${c}">${t}</span>`).join("")}</div><small>آخر النتائج</small></div>`;
  }

  /* ---------- 5) آخر نتيجة + القادمة ---------- */
  function row(m, { hl = false } = {}) {
    const d = new Date(m.date), done = DONE.includes(m.status), live = LIVE.includes(m.status);
    const when = done || live ? "" : `<div class="when">${esc(fDay.format(d).split(" ")[0])}<br>${fTime.format(d)}</div>`;
    const sc = done || live ? `<div class="sc"><bdi dir="ltr">${m.goals[1]} - ${m.goals[0]}</bdi></div>` : `<div class="sc">—</div>`;
    return `<div class="v2-row${hl ? " hl" : ""}">${when || `<div class="when">${live ? "<span style='color:var(--v2-live)'>مباشر</span>" : "انتهت"}</div>`}
      <div class="side">${crest(m.home)}<span>${esc(ar.arTeam(m.home.name))}</span></div>
      ${sc}
      <div class="side away">${crest(m.away)}<span>${esc(ar.arTeam(m.away.name))}</span></div></div>`;
  }
  function renderResults(hilal) {
    const last = (hilal?.results || [])[0];
    const next = (hilal?.upcoming || []).filter((m) => !(LIVE.includes(m.status) || DONE.includes(m.status)))[0];
    const el = $("v2Results"); if (!el) return;
    const items = [last && row(last), next && next !== (LIVE_M || NEXT) ? row(next) : null].filter(Boolean);
    el.innerHTML = items.length ? items.join("") : "";
    el.hidden = !items.length;
  }

  /* ---------- 6) تصاميم ---------- */
  async function renderDesigns() {
    const d = await j("data/designs.json");
    const el = $("v2Designs"); if (!el) return;
    const list = (d?.designs || []).slice(0, 4);
    if (!list.length) { el.hidden = true; return; }
    el.innerHTML = list.map((x) => `<a href="designs.html" class="v2-d" data-design="${esc(x.id)}"><img src="${esc(x.thumb || x.image)}" alt="" loading="lazy"><div class="v2-d-meta"><b>${esc(x.type || "تصميم")}</b><span>${esc(x.title || "")}</span></div></a>`).join("");
  }

  /* ---------- 7) فيديو ---------- */
  async function renderVideo() {
    const d = await j("data/videos.json");
    const el = $("v2Video"); const sec = $("v2VideoSec"); if (!el) return;
    const list = d?.featured?.length ? d.featured : (d?.clips || []);
    const v = list[0];
    const user = d?.tiktok_user;
    // لو ما فيه فيديوهات بس عندنا يوزر تيك توك، نعرض بطاقة تحويل عامة
    const href = v?.url || (user ? `https://www.tiktok.com/@${user}` : "videos.html");
    const title = v?.title || (user ? `شاهد آخر فيديوهات منبر على تيك توك` : "فيديو منبر");
    const img = v?.thumb ? `<img src="${esc(v.thumb)}" alt="" style="width:100%;height:100%;object-fit:cover;position:absolute;inset:0" loading="lazy">` : "";
    el.innerHTML = `<a href="${esc(href)}" class="v2-video" target="_blank" rel="noopener">${img}<span class="v2-video-play">${ICON().html("play", { size: 26 })}</span><span class="v2-video-cap">${ICON().html("video", { size: 16 })}<span style="flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(title)}</span></span></a>`;
    if (sec && !v && !user) sec.hidden = true;
  }

  /* ---------- 8) أخبار ---------- */
  function renderNews(site, man) {
    const el = $("v2News"); if (!el) return;
    const mine = ((man?.items || [])).filter((n) => n.title).map((n) => ({ tag: n.tag || "منبر", title: n.title, body: n.body || "", breaking: n.breaking }));
    const items = [...mine, ...((site?.news || []))].slice(0, 4);
    el.innerHTML = items.map((n) => `<div class="v2-n"><span class="v2-ntag${n.breaking ? " hl" : ""}">${esc(n.tag || "خبر")}</span><div><b>${esc(n.title)}</b>${n.body ? `<p>${esc(n.body)}</p>` : ""}</div></div>`).join("") || `<div class="v2-empty">لا توجد أخبار جديدة</div>`;
  }

  /* ---------- التحميل ---------- */
  (async function init() {
    await waitIcons();
    const [site, live, man] = await Promise.all([j("data/site.json"), j("data/live.json"), j("data/manual-news.json")]);
    LIVE_URL = live?.url || null;
    // اختيار المباراة: من بيانات الهلال أو من بطاقات التصاميم كبديل
    let next = (site?.hilal?.upcoming || []).find((m) => !["CANC", "ABD", "PST"].includes(m.status));
    if (!next) {
      const d = await j("data/designs.json");
      const dm = (d?.designs || []).find((x) => x.match && new Date(x.match.date) > Date.now() - 3 * 3600e3);
      if (dm) next = { date: dm.match.date, status: "NS", venue: dm.match.venue || "", round: dm.match.round, league: { name: dm.match.competition || "" },
        home: { id: dm.match.home === "الهلال" ? HILAL : null, name: dm.match.home }, away: { id: dm.match.away === "الهلال" ? HILAL : null, name: dm.match.away }, goals: null };
    }
    NEXT = next;
    renderHero();
    renderResults(site?.hilal);
    renderStats(site?.standings, site?.hilal);
    renderBreaking(site);
    renderNews(site, man);
    renderToday();
    renderDesigns();
    renderVideo();

    // تحديث مباشر وقت المباراة
    if (LIVE_URL && NEXT) {
      const k = new Date(NEXT.date).getTime(), now = Date.now();
      if (now > k - 10 * 60e3 && now < k + 160 * 60e3) { pollLive(); liveTimer = setInterval(pollLive, 15e3); }
      else if (now < k && k - now < 6 * 3600e3) setTimeout(() => { pollLive(); liveTimer = setInterval(pollLive, 15e3); }, Math.max(30e3, k - 10 * 60e3 - now));
    }
    $("updated") && ($("updated").textContent = site?.updated ? "آخر تحديث: " + fmt({ day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(site.updated)) : "بانتظار أول تحديث");
  })();
})();
