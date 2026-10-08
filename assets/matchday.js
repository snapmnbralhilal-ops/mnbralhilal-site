/* مركز المباراة: كل شي عن مباراة الهلال الحالية/القادمة في صفحة وحدة */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const TZ = "Asia/Riyadh";
  const fmt = (o) => new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { timeZone: TZ, ...o });
  const fDay = fmt({ weekday: "long", day: "numeric", month: "long" });
  const fTime = fmt({ hour: "2-digit", minute: "2-digit", hour12: false });
  const dayKey = (d) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(d));
  const LOGOS = { "الهلال": "https://media.api-sports.io/football/teams/2932.png", "الاتحاد": "assets/teams/ittihad.png", "السد": "assets/teams/sadd.png", "الرياض": "assets/teams/riyadh.png", "الحزم": "assets/teams/hazem.png", "القادسية": "assets/teams/qadsiah.png", "الشمال": "assets/teams/shamal.png", "الفتح": "assets/teams/fateh.png" };
  const FORMS = {
    "4-3-3": [[50, 89], [85, 70], [62, 74], [38, 74], [15, 70], [75, 49], [50, 54], [25, 49], [80, 23], [50, 15], [20, 23]],
    "4-2-3-1": [[50, 89], [85, 70], [62, 74], [38, 74], [15, 70], [63, 57], [37, 57], [82, 35], [50, 37], [18, 35], [50, 14]],
    "4-4-2": [[50, 89], [85, 70], [62, 74], [38, 74], [15, 70], [88, 46], [63, 51], [37, 51], [12, 46], [65, 18], [35, 18]],
    "3-5-2": [[50, 89], [75, 72], [50, 75], [25, 72], [90, 45], [68, 53], [50, 41], [32, 53], [10, 45], [64, 17], [36, 17]],
    "3-4-3": [[50, 89], [75, 72], [50, 75], [25, 72], [88, 48], [62, 53], [38, 53], [12, 48], [80, 23], [50, 15], [20, 23]]
  };
  const LIVE_ST = ["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP"];
  const ST_AR = { "1H": "الشوط الأول", HT: "استراحة", "2H": "الشوط الثاني", ET: "أشواط إضافية", BT: "استراحة", P: "ركلات الترجيح", FT: "انتهت", AET: "انتهت بعد الإضافي", PEN: "انتهت بالترجيح", SUSP: "متوقفة", INT: "متوقفة" };

  let DID = null; try { DID = localStorage.getItem("mnbr-did"); } catch (e) {}
  const j = (p) => fetch(p + (p.includes("?") ? "&" : "?") + "t=" + Date.now(), { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);

  let MATCH = null, DESIGN = null, DESIGNS = [], SQUAD = [], BYID = {}, API = null, LIVE = null, GAME = null, ADS = {};
  const isHome = () => MATCH?.home === "الهلال";
  const opp = () => (isHome() ? MATCH.away : MATCH.home);
  const crest = (n) => LOGOS[n] ? `<img src="${LOGOS[n]}" alt="" width="56" height="56">` : `<span class="pl-ph">${esc((n || "")[0] || "")}</span>`;
  const fold = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/-/g, " ").replace(/\s+/g, " ").trim();
  function matchPlayer(sq, name) {
    const nm = fold(name);
    if (!nm) return null;
    const w = nm.split(" ").filter((x) => x !== "al"), first = w[0].replace(/\.$/, "");
    return sq.find((x) => {
      if (!x.en) return false;
      const t = fold(x.en).split(" ").filter((y) => y !== "al");
      if (!w.includes(t[t.length - 1])) return false;
      // لو فيه اسم أول (أو حرفه الأول) لازم يطابق — عشان سالم وناصر الدوسري
      return t.length < 2 || w.length < 2 || (first.length === 1 ? t[0][0] === first : t[0] === first);
    }) || null;
  }
  const arPlayer = (name) => { const p = matchPlayer(SQUAD, name); return p ? p.short : name; };

  /* ---------- الرأس ---------- */
  let cd = null;
  function renderHero() {
    if (!MATCH) { $("mdHero").innerHTML = `<div class="empty">ما فيه مباراة قادمة للهلال حالياً</div>`; return; }
    const d = new Date(MATCH.date), k = d.getTime(), now = Date.now();
    const lm = LIVE && LIVE.kickoff && Math.abs(LIVE.kickoff - k) < 6 * 3600e3 ? LIVE.match : null;
    const live = lm && LIVE_ST.includes(lm.status), done = LIVE?.status === "done" && lm;
    let badge = "المباراة القادمة", cls = "";
    if (live) { badge = `<span class="dot"></span> مباشر ${lm.elapsed ? lm.elapsed + "'" : ""} · ${ST_AR[lm.status] || ""}`; cls = "ph-live"; }
    else if (done) { badge = ST_AR[lm.status] || "انتهت"; cls = "ph-vote"; }
    else if (now >= k && now < k + 3 * 3600e3) { badge = "انطلقت المباراة"; cls = "ph-live"; }
    else if (dayKey(now) === dayKey(k)) badge = "اليوم مباراة الهلال 💙";
    let mid;
    if (lm && (live || done)) {
      // الرقم اليمين = أهداف صاحب الأرض (اليمين)
      mid = `<b class="pl-score"><bdi dir="ltr">${lm.goals[1]} - ${lm.goals[0]}</bdi></b><small>${done ? "النتيجة النهائية" : "النتيجة الحين"}</small>`;
    } else mid = `<b class="pl-time">${fTime.format(d)}</b><small>${esc(fDay.format(d))}</small>`;
    $("mdHero").innerHTML = `<div class="pl-badge ${cls}">${badge}</div>
      <div class="pl-vs"><div class="pl-t">${crest(MATCH.home)}<b>${esc(MATCH.home)}</b></div><div class="pl-mid">${mid}</div><div class="pl-t">${crest(MATCH.away)}<b>${esc(MATCH.away)}</b></div></div>
      <div class="pl-meta">${esc([MATCH.competition, MATCH.round, MATCH.venue].filter(Boolean).join(" · "))}</div>
      ${!lm && now < k ? `<div class="pl-cd" id="mdCd"></div>` : ""}`;
    clearInterval(cd);
    if (!lm && now < k) {
      const t = () => { const el = $("mdCd"); if (!el) return; const s = Math.max(0, (k - Date.now()) / 1000);
        const D = Math.floor(s / 86400), hms = [Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), Math.floor(s % 60)].map((v) => String(v).padStart(2, "0")).join(":");
        el.innerHTML = s > 0 ? `باقي ${D ? `<b>${D} ${D === 1 ? "يوم" : D === 2 ? "يومين" : "أيام"}</b> و ` : ""}<b><bdi dir="ltr">${hms}</bdi></b>` : "انطلقت المباراة"; };
      t(); cd = setInterval(t, 1000);
    }
    renderEvents(lm);
  }
  function renderEvents(lm) {
    const ev = (lm?.events || []).filter((e) => e.type === "Goal" || e.type === "Card");
    const el = $("mdEvents");
    if (!lm || !ev.length) { el.hidden = true; return; }
    const hid = lm.home.id === 2932 ? lm.home.id : lm.away.id;
    el.hidden = false;
    el.innerHTML = `<h2 class="pl-h">أحداث المباراة</h2><ol class="md-ev">${ev.map((e) => {
      const ours = e.team === hid, own = /Own/.test(e.detail || ""), miss = /Missed/.test(e.detail || "");
      const ico = e.type === "Card" ? "🟥" : miss ? "❌" : "⚽";
      const who = ours ? arPlayer(e.player) : e.player;
      const note = own ? " (عكسي)" : /Penalty/.test(e.detail || "") && !miss ? " (جزاء)" : miss ? " (جزاء ضائع)" : "";
      return `<li class="${ours ? "us" : "them"}"><span class="m">${e.min ?? ""}${e.extra ? "+" + e.extra : ""}'</span><span class="i">${ico}</span><span class="n">${esc(who || "")}${note}${e.assist && e.type === "Goal" && !own ? `<small>صناعة: ${esc(ours ? arPlayer(e.assist) : e.assist)}</small>` : ""}</span><span class="tm">${esc(ours ? "الهلال" : opp())}</span></li>`;
    }).join("")}</ol>`;
  }

  /* ---------- معلومات المباراة ---------- */
  function renderInfo() {
    const m = MATCH; if (!m) return;
    const rows = [["🏆", "البطولة", [m.competition, m.round].filter(Boolean).join(" · ")], ["🏟️", "الملعب", m.venue], ["🎙️", "التعليق", m.commentators], ["📺", "الناقل", m.channel],
      ["🕘", "الموعد", `${fDay.format(new Date(m.date))} · ${fTime.format(new Date(m.date))} بتوقيت مكة`]].filter((r) => r[2]);
    const sp = (ADS.match_sponsor || []).filter((a) => a && a.image && a.active !== false)[0];
    $("mdInfo").hidden = false;
    $("mdInfo").innerHTML = `<h2 class="pl-h">معلومات المباراة</h2><dl class="md-info">${rows.map(([i, l, v]) => `<div><dt>${i} ${l}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl>
      ${sp ? `<div class="match-sp">المباراة برعاية ${sp.link ? `<a href="${esc(sp.link)}" target="_blank" rel="noopener sponsored"><img src="${esc(sp.image)}" alt="${esc(sp.title || "")}"></a>` : `<img src="${esc(sp.image)}" alt="${esc(sp.title || "")}">`}</div>` : ""}`;
  }

  /* ---------- تصاميم منبر لهالمباراة ---------- */
  function renderDesigns() {
    const key = dayKey(MATCH.date);
    const list = DESIGNS.filter((d) => (d.match?.date && dayKey(d.match.date) === key) || String(d.id || "").startsWith(key));
    if (!list.length) { $("mdDesigns").hidden = true; return; }
    $("mdDesigns").hidden = false;
    $("mdDesigns").innerHTML = `<h2 class="pl-h">بطاقات منبر للمباراة</h2><div class="md-dl">${list.map((d) => `<button type="button" class="d-item" data-d="${esc(d.id)}"><img src="${esc(d.thumb || d.image)}" alt="${esc(d.title || "")}" loading="lazy" width="270" height="360"><span class="d-meta"><b>${esc(d.type || "تصميم")}</b><small>${esc(d.title || "")}</small></span></button>`).join("")}</div>`;
    $("mdDesigns").querySelectorAll("[data-d]").forEach((b) => (b.onclick = () => openD(list.find((x) => x.id === b.dataset.d))));
  }
  function openD(d) {
    if (!d) return;
    $("mdLbT").textContent = [d.type, d.title].filter(Boolean).join(": ");
    $("mdLbImg").src = d.image; $("mdLbDl").href = d.image; $("mdLbDl").setAttribute("download", d.id + ".jpg");
    const abs = new URL(d.image, location.href).href;
    $("mdLbSh").hidden = !navigator.share;
    $("mdLbSh").onclick = () => navigator.share({ title: $("mdLbT").textContent, url: abs }).catch(() => {});
    $("mdLb").showModal ? $("mdLb").showModal() : $("mdLb").setAttribute("open", "");
  }
  $("mdLbX").onclick = () => $("mdLb").close();
  $("mdLb").addEventListener("click", (e) => { if (e.target.id === "mdLb") $("mdLb").close(); });

  /* ---------- الجمهور ---------- */
  function renderCrowd() {
    const g = GAME;
    const a = g?.agg;
    if (!g || !g.kickoff || Math.abs(g.kickoff - new Date(MATCH.date)) > 6 * 3600e3) { $("mdCrowd").hidden = $("mdLineup").hidden = $("mdMotm").hidden = true; return; }
    // التوقعات
    $("mdCrowd").hidden = false;
    if (!a || !a.n) $("mdCrowd").innerHTML = `<h2 class="pl-h">توقعات الجمهور</h2><p class="pl-muted">ما فيه توقعات للحين — <a href="play.html#predict">كن أول من يتوقّع 🎯</a></p>`;
    else {
      const pc = (x) => Math.round((x / a.n) * 100), w = pc(a.w), d = pc(a.d), l = Math.max(0, 100 - w - d);
      const top = (g.topScores || []).slice(0, 3).map(([s, n]) => { const [h, o] = s.split("-"); return `<div class="st-r"><b>${isHome() ? `${h} - ${o}` : `${o} - ${h}`}</b><span>${pc(n)}%</span></div>`; }).join("");
      $("mdCrowd").innerHTML = `<h2 class="pl-h">توقعات الجمهور <small class="md-n">${a.n.toLocaleString("en")} توقّع</small></h2>
        <div class="ob"><span class="ob-w" style="flex:${w || 0.0001}">${w >= 12 ? `الهلال ${w}%` : ""}</span><span class="ob-d" style="flex:${d || 0.0001}">${d >= 12 ? `تعادل ${d}%` : ""}</span><span class="ob-l" style="flex:${l || 0.0001}">${l >= 12 ? `${esc(opp())} ${l}%` : ""}</span></div>
        ${g.final?.done ? `<div class="hit"><b>${(g.exactCount || 0).toLocaleString("en")}</b> صابوا النتيجة بالضبط · <b>${(g.outcomeCount || 0).toLocaleString("en")}</b> صابوا الفائز</div>` : ""}
        <div class="st-s" style="margin-top:14px">أكثر النتائج توقّعاً</div>${top}
        ${g.phase === "predict" ? `<a class="card-btn pl-go" href="play.html#predict">🎯 ${g.mine?.pred ? "عدّل توقّعك" : "توقّع الحين"}</a>` : ""}`;
    }
    // تشكيلة الجمهور
    const cr = g.crowd;
    $("mdLineup").hidden = false;
    if (!cr || !cr.n || !FORMS[cr.form]) $("mdLineup").innerHTML = `<h2 class="pl-h">تشكيلة الجمهور</h2><p class="pl-muted">ما أحد اعتمد تشكيلته للحين — <a href="play.html#coach">اختر تشكيلتك 📋</a></p>`;
    else $("mdLineup").innerHTML = `<h2 class="pl-h">تشكيلة الجمهور <small class="md-n">${cr.n.toLocaleString("en")} مدرب · <bdi dir="ltr">${cr.form}</bdi></small></h2>
      <div class="pitch pitch-sm"><div class="pitch-lines" aria-hidden="true"><i class="pc-c"></i><i class="pc-l"></i><i class="pc-b1"></i><i class="pc-b2"></i></div>
      ${FORMS[cr.form].map(([x, y], i) => { const it = cr.xi[i] || {}, p = BYID[it.id]; return `<div class="slot full" style="left:${x}%;top:${y}%"><span class="sl-dot">${p ? p.n : "?"}</span><span class="sl-n">${p ? esc(p.short) : "—"}</span><span class="sl-pc">${it.pct || 0}%</span></div>`; }).join("")}</div>
      ${g.phase === "predict" ? `<a class="lb-btn pl-go" href="play.html#coach">📋 ${g.mine?.lineup ? "عدّل تشكيلتك" : "أضف تشكيلتك"}</a>` : ""}`;
    // رجل المباراة
    const v = g.votes;
    if (g.phase === "vote" || g.phase === "closed" || v?.n) {
      $("mdMotm").hidden = false;
      $("mdMotm").innerHTML = `<h2 class="pl-h">⭐ رجل المباراة ${v?.n ? `<small class="md-n">${v.n.toLocaleString("en")} صوت</small>` : ""}</h2>
        ${v?.n ? v.top.slice(0, 5).map(([id, n], i) => `<div class="vb"><span class="vb-n">${esc(BYID[+id]?.name || "—")}</span><span class="vb-bar"><i style="width:${Math.max(4, Math.round((n / v.n) * 100))}%"></i></span><b>${Math.round((n / v.n) * 100)}%</b>${i === 0 ? "<em>⭐</em>" : "<em></em>"}</div>`).join("") : `<p class="pl-muted">التصويت مفتوح الحين!</p>`}
        ${g.phase === "vote" ? `<a class="card-btn pl-go" href="play.html#vote">⭐ ${g.mine?.vote ? "غيّر صوتك" : "صوّت الحين"}</a>` : ""}`;
    } else $("mdMotm").hidden = true;
  }

  function renderAds() {
    document.querySelectorAll(".ad-slot").forEach((el) => {
      const list = (ADS[el.dataset.slot] || []).filter((a) => a && a.image && a.active !== false);
      if (!list.length) { el.hidden = true; return; }
      const a = list[Math.floor(Math.random() * list.length)];
      const img = `<img src="${esc(a.image)}" alt="${esc(a.title || "إعلان")}" loading="lazy">`;
      el.innerHTML = (a.link ? `<a href="${esc(a.link)}" target="_blank" rel="noopener sponsored">${img}</a>` : img) + `<span class="ad-tag">إعلان</span>`;
      el.hidden = false;
    });
  }

  async function findMatch(k) {
    const site = await j("data/site.json");
    const near = (d) => k ? Math.abs(new Date(d) - k) < 6 * 3600e3 : new Date(d) > Date.now() - 4 * 3600e3;
    const dm = DESIGNS.filter((x) => x.match?.date && (x.match.home === "الهلال" || x.match.away === "الهلال") && near(x.match.date))
      .sort((a, b) => new Date(a.match.date) - new Date(b.match.date))[0];
    if (dm) { DESIGN = dm; return dm.match; }
    const ar = window.MNB ? window.MNB.arTeam : (n) => n;
    const sm = (site?.hilal?.upcoming || []).find((m) => near(m.date));
    return sm ? { date: sm.date, home: ar(sm.home.name), away: ar(sm.away.name), competition: sm.league?.name || "" } : null;
  }
  async function refresh() {
    if (!API) return;
    [LIVE, GAME] = await Promise.all([j(API + "/live"), j(API + "/game" + (DID ? "?d=" + DID : ""))]);
    renderHero(); renderCrowd();
  }
  (async function init() {
    const [des, sq, live, ads] = await Promise.all([j("data/designs.json"), j("data/squad.json"), j("data/live.json"), j("data/ads.json")]);
    DESIGNS = des?.designs || []; SQUAD = sq?.players || []; SQUAD.forEach((p) => (BYID[p.id] = p)); ADS = ads || {};
    API = live?.url ? live.url.replace(/\/live$/, "") : null;
    if (API) [LIVE, GAME] = await Promise.all([j(API + "/live"), j(API + "/game" + (DID ? "?d=" + DID : ""))]);
    MATCH = await findMatch(GAME?.kickoff);
    renderHero();
    if (MATCH) { renderInfo(); renderDesigns(); renderCrowd(); }
    renderAds();
    // وقت المباراة نحدّث كل 30 ثانية، وغيره كل دقيقتين
    const loop = () => { const k = MATCH ? new Date(MATCH.date).getTime() : 0, now = Date.now();
      const hot = k && now > k - 15 * 60e3 && now < k + 3 * 3600e3;
      setTimeout(async () => { if (!document.hidden) await refresh(); loop(); }, hot ? 30e3 : 120e3); };
    loop();
  })();
})();
