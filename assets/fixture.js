/* صفحة تفاصيل المباراة — اقرأ ?id= واسحب من /match/:id كل 15 ثانية لو المباراة مباشر */
(function () {
  const { arTeam, arLeague } = window.MNB || { arTeam: (x) => x, arLeague: (x) => x?.name || "" };
  const TZ = "Asia/Riyadh";
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ar = (n) => String(n);

  const LIVE = ["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP"];
  const DONE = ["FT", "AET", "PEN", "AWD", "WO"];
  const STATUS_AR = { "1H": "الشوط الأول", "2H": "الشوط الثاني", "HT": "استراحة", "ET": "وقت إضافي", "BT": "استراحة الإضافي", "P": "ركلات الترجيح", "FT": "انتهت", "AET": "انتهت بعد الإضافي", "PEN": "انتهت بركلات الترجيح", "NS": "لم تبدأ", "TBD": "لم يتحدد", "PST": "مؤجلة", "CANC": "ملغاة", "ABD": "متوقفة", "INT": "متوقفة", "SUSP": "متوقفة" };
  const fTime = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
  const fDay = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });

  const params = new URLSearchParams(location.search);
  const ID = params.get("id");
  if (!ID || !/^\d+$/.test(ID)) {
    $("mHead").innerHTML = `<div class="m-loading">معرّف المباراة غير صحيح. <a href="matches.html">ارجع للمباريات</a></div>`;
    return;
  }

  const LOCAL_LOGOS = { "الاتحاد": "ittihad", "السد": "sadd", "الرياض": "riyadh", "الحزم": "hazem", "القادسية": "qadsiah", "الشمال": "shamal", "الفتح": "fateh" };
  function crest(team) {
    const name = arTeam(team?.name);
    if (LOCAL_LOGOS[name]) return `<img src="assets/teams/${LOCAL_LOGOS[name]}.png" alt="" loading="lazy" class="crest">`;
    if (team?.logo) return `<img src="${esc(team.logo)}" alt="" loading="lazy" class="crest" onerror="this.style.visibility='hidden'">`;
    const ch = name.replace(/^ال/, "").trim()[0] || "?";
    return `<svg class="crest" viewBox="0 0 28 32" aria-hidden="true"><path d="M14 1 L26 5 V15 C26 23 20 28.5 14 31 C8 28.5 2 23 2 15 V5 Z" fill="var(--chip)" stroke="var(--line)"/><text x="14" y="21" text-anchor="middle" font-weight="700" font-size="12" fill="var(--royal)">${esc(ch)}</text></svg>`;
  }

  function statusLabel(m) {
    if (LIVE.includes(m.status)) {
      const el = m.elapsed != null ? ar(m.elapsed) + (m.extra ? "+" + ar(m.extra) : "") + "'" : "";
      return `<span class="live-pill"><span class="dot"></span>${STATUS_AR[m.status] || "مباشر"}${el ? " " + el : ""}</span>`;
    }
    if (DONE.includes(m.status)) return `<span class="done-pill">${STATUS_AR[m.status] || "انتهت"}</span>`;
    return `<span class="pending-pill">${STATUS_AR[m.status] || m.status}</span>`;
  }

  function renderHead(m) {
    const isLive = LIVE.includes(m.status);
    const isDone = DONE.includes(m.status);
    const d = new Date(m.date);
    const league = esc(arLeague(m.league));
    const round = m.league?.round ? ` · ${esc(m.league.round.replace(/Regular Season - /, "الجولة "))}` : "";
    const [hg, ag] = m.goals;
    const showScore = isLive || isDone;
    // مهم: الصفحة RTL. نكتب "home - away" في الكود فينعكس بصرياً إلى "away - home"،
    // فيصير رقم الفريق المضيف قرب شعاره على اليمين، ورقم الضيف قرب شعاره على اليسار.
    const scoreOrTime = showScore
      ? `<span class="num">${hg} - ${ag}</span>`
      : `<span class="num kick">${esc(fTime.format(d))}</span>`;
    $("mHead").className = "m-head" + (isLive ? " live" : "") + (isDone ? " done" : "");
    $("mHead").innerHTML = `
      <div class="m-top">${league}${round}</div>
      <div class="m-status">${statusLabel(m)}</div>
      <div class="m-teams">
        <div class="m-team">${crest(m.home)}<b>${esc(arTeam(m.home.name))}</b></div>
        <div class="m-score">${scoreOrTime}</div>
        <div class="m-team">${crest(m.away)}<b>${esc(arTeam(m.away.name))}</b></div>
      </div>
      <div class="m-sub">
        <span class="m-date">${esc(fDay.format(d))} · ${esc(fTime.format(d))}</span>
        ${m.venue ? `<span class="m-venue"><svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/></svg>${esc(m.venue)}</span>` : ""}
        ${m.referee ? `<span class="m-ref">الحكم: ${esc(m.referee)}</span>` : ""}
      </div>
    `;
  }

  // -------- أحداث --------
  const EV_ICON = {
    Goal: { cls: "goal", sym: "⚽" },
    "Normal Goal": { cls: "goal", sym: "⚽" },
    Penalty: { cls: "pen", sym: "⚽" },
    "Own Goal": { cls: "own", sym: "⚽" },
    "Missed Penalty": { cls: "pen", sym: "✗" },
    "Yellow Card": { cls: "yc", sym: "🟨" },
    "Red Card": { cls: "rc", sym: "🟥" },
    "Second Yellow card": { cls: "rc", sym: "🟥" },
    subst: { cls: "sub", sym: "⇄" },
    Var: { cls: "var", sym: "VAR" }
  };
  function evIcon(e) {
    const key = e.detail || e.type;
    const i = EV_ICON[key] || EV_ICON[e.type] || { cls: "var", sym: "•" };
    return `<span class="ev-icon ${i.cls}">${esc(i.sym)}</span>`;
  }
  function evLabel(e) {
    if (e.type === "subst") {
      const inP = e.player || "—"; const outP = e.assist || "";
      return { title: `تبديل: ${esc(inP)}`, note: outP ? `خرج: ${esc(outP)}` : "" };
    }
    if (e.type === "Goal") {
      const kind = e.detail === "Penalty" ? "هدف (ركلة جزاء)" : e.detail === "Own Goal" ? "هدف عكسي" : e.detail === "Missed Penalty" ? "ركلة جزاء ضائعة" : "هدف";
      return { title: `${kind}: ${esc(e.player || "")}`, note: e.assist ? `صناعة: ${esc(e.assist)}` : "" };
    }
    if (e.type === "Card") {
      const kind = /Red/.test(e.detail || "") ? "كارت أحمر" : "كارت أصفر";
      return { title: `${kind}: ${esc(e.player || "")}`, note: e.comments ? esc(e.comments) : "" };
    }
    if (e.type === "Var") return { title: `VAR: ${esc(e.player || "")}`, note: e.detail || "" };
    return { title: `${e.type}: ${esc(e.player || "")}`, note: "" };
  }
  function renderEvents(m) {
    const el = $("tabEvents");
    const events = m.events || [];
    if (!events.length) {
      el.innerHTML = `<p class="empty">${LIVE.includes(m.status) ? "ما صار شي بعد. انتظر الأحداث." : DONE.includes(m.status) ? "ما تم تسجيل أحداث لهذه المباراة." : "تنتظر بداية المباراة."}</p>`;
      return;
    }
    // أحدث الأحداث أولاً (ترتيب تنازلي)
    const sorted = events.slice().sort((a, b) => (b.min || 0) - (a.min || 0) || (b.extra || 0) - (a.extra || 0));
    el.innerHTML = `<div class="ev-list">${sorted.map((e) => {
      const home = e.team === m.home?.id;
      const min = (e.min != null ? ar(e.min) : "") + (e.extra ? "+" + ar(e.extra) : "");
      const l = evLabel(e);
      const icon = evIcon(e);
      const minCell = `<div class="ev-min"><b>${min}</b>'</div>`;
      const body = `<div class="ev-body"><div class="ev-player">${l.title}</div>${l.note ? `<div class="ev-note">${l.note}</div>` : ""}</div>`;
      return home ? `<div class="ev home">${icon}${body}${minCell}</div>` : `<div class="ev">${minCell}${body}${icon}</div>`;
    }).join("")}</div>`;
  }

  // -------- التشكيلات --------
  function renderLineups(m) {
    const el = $("tabLineups");
    const lus = m.lineups || [];
    if (!lus.length) { el.innerHTML = `<p class="empty">التشكيلة ما نُشرت بعد.</p>`; return; }
    el.innerHTML = `<div class="lu-wrap">${lus.map((l) => {
      const team = l.teamId === m.home?.id ? m.home : m.away;
      const name = arTeam(team?.name) || esc(l.teamName || "");
      const start = (l.startXI || []).map((p) => `<div class="lu-p"><span class="no">${esc(p.number ?? "")}</span><span class="nm">${esc(p.name || "")}</span><span class="ps">${esc(p.pos || "")}</span></div>`).join("");
      const subs = (l.subs || []).map((p) => `<div class="lu-p"><span class="no">${esc(p.number ?? "")}</span><span class="nm">${esc(p.name || "")}</span><span class="ps">${esc(p.pos || "")}</span></div>`).join("");
      return `<div class="lu">
        <h3>${esc(name)} <small>${esc(l.formation || "")}</small></h3>
        ${l.coach ? `<p class="lu-coach">المدرب: ${esc(l.coach)}</p>` : ""}
        <div class="lu-sect"><h4>التشكيل الأساسي</h4><div class="lu-xi">${start}</div></div>
        ${subs ? `<div class="lu-sect"><h4>البدلاء</h4><div class="lu-xi">${subs}</div></div>` : ""}
      </div>`;
    }).join("")}</div>`;
  }

  // -------- الإحصائيات --------
  const STAT_AR = {
    "Shots on Goal": "تسديدات على المرمى", "Shots off Goal": "تسديدات خارج المرمى", "Total Shots": "مجموع التسديدات",
    "Blocked Shots": "تسديدات مصدودة", "Shots insidebox": "تسديدات من داخل المنطقة", "Shots outsidebox": "تسديدات من خارج المنطقة",
    "Fouls": "أخطاء", "Corner Kicks": "ركلات ركنية", "Offsides": "تسلل", "Ball Possession": "الاستحواذ",
    "Yellow Cards": "كروت صفراء", "Red Cards": "كروت حمراء", "Goalkeeper Saves": "تصديات الحارس", "Total passes": "مجموع التمريرات",
    "Passes accurate": "تمريرات ناجحة", "Passes %": "دقة التمرير", "expected_goals": "الأهداف المتوقعة", "goals_prevented": "أهداف مُنعت"
  };
  function statNum(v) { if (v == null) return 0; const n = parseFloat(String(v).replace(/[^\d.]/g, "")); return isFinite(n) ? n : 0; }
  function renderStats(m) {
    const el = $("tabStats");
    const stats = m.statistics || [];
    if (stats.length < 2) { el.innerHTML = `<p class="empty">الإحصائيات ما توفرت بعد.</p>`; return; }
    const home = stats.find((s) => s.teamId === m.home?.id) || stats[0];
    const away = stats.find((s) => s.teamId === m.away?.id) || stats[1];
    const keys = Array.from(new Set([...home.stats.map((s) => s.k), ...away.stats.map((s) => s.k)]));
    const rows = keys.map((k) => {
      const h = home.stats.find((x) => x.k === k)?.v;
      const a = away.stats.find((x) => x.k === k)?.v;
      if (h == null && a == null) return "";
      const hn = statNum(h), an = statNum(a), tot = hn + an;
      const hp = tot > 0 ? (hn / tot) * 100 : 50;
      const label = STAT_AR[k] || k;
      return `<div class="st-row">
        <div class="st-head"><span>${esc(h ?? "—")}</span><span class="lbl">${esc(label)}</span><span>${esc(a ?? "—")}</span></div>
        <div class="st-bar"><div class="h" style="width:${hp}%"></div><div class="a" style="width:${100 - hp}%"></div></div>
      </div>`;
    }).filter(Boolean).join("");
    el.innerHTML = `<div class="st-list">${rows}</div>`;
  }

  function renderAll(data) {
    const m = data.m;
    document.title = `${arTeam(m.home.name)} × ${arTeam(m.away.name)} — منبر الهلال`;
    renderHead(m);
    renderEvents(m);
    renderLineups(m);
    renderStats(m);
    $("mTabs").hidden = false;
    showTab(CUR_TAB);
    $("mUpdated").textContent = `آخر تحديث: ${new Date(data.at).toLocaleTimeString("ar-SA", { timeZone: TZ, hour: "2-digit", minute: "2-digit" })}`;
  }

  // تبويبات
  let CUR_TAB = "events";
  function showTab(t) {
    CUR_TAB = t;
    document.querySelectorAll("#mTabs button").forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === t));
    ["events", "lineups", "stats"].forEach((n) => $("tab" + n[0].toUpperCase() + n.slice(1)).hidden = n !== t);
  }
  document.querySelectorAll("#mTabs button").forEach((b) => (b.onclick = () => showTab(b.dataset.tab)));

  // جلب
  let BASE = null, LAST = null, TIMER = null;
  async function base() {
    if (BASE) return BASE;
    try { const j = await fetch("data/live.json?t=" + Date.now()).then((r) => r.json()); BASE = j.url.replace(/\/live$/, ""); } catch (e) {}
    return BASE;
  }
  async function load() {
    const b = await base();
    if (!b) { if (!LAST) $("mHead").innerHTML = `<div class="m-loading">تعذّر الاتصال بالخادم.</div>`; return; }
    try {
      const r = await fetch(b + "/match/" + ID + "?t=" + Date.now(), { cache: "no-store" });
      if (!r.ok) { if (!LAST) $("mHead").innerHTML = `<div class="m-loading">تعذّر تحميل المباراة.</div>`; return; }
      const data = await r.json();
      if (data.error) { $("mHead").innerHTML = `<div class="m-loading">${esc(data.error === "not-found" ? "المباراة غير موجودة." : "خطأ")}</div>`; return; }
      LAST = data;
      renderAll(data);
      scheduleNext();
    } catch (e) { if (!LAST) $("mHead").innerHTML = `<div class="m-loading">تعذّر تحميل المباراة.</div>`; scheduleNext(); }
  }
  function scheduleNext() {
    if (TIMER) clearTimeout(TIMER);
    const live = LAST?.m && LIVE.includes(LAST.m.status);
    const interval = live ? 15000 : (DONE.includes(LAST?.m?.status) ? 60000 : 30000);
    TIMER = setTimeout(() => { if (!document.hidden) load(); else scheduleNext(); }, interval);
  }
  document.addEventListener("visibilitychange", () => { if (!document.hidden) load(); });

  load();
})();
