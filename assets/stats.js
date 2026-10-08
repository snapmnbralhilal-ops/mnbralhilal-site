/* إحصائيات لاعبين الهلال (data/stats.json — يتحدث كل ساعة بباقة Pro) */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ar = window.MNB || { arTeam: (n) => n, arLeague: (l) => l?.name || "" };
  const POS = { GK: "حراسة", DF: "دفاع", MF: "وسط", FW: "هجوم" };
  const SORTS = [["goals", "الأهداف"], ["assists", "الصناعة"], ["ga", "أهداف + صناعة"], ["rating", "التقييم"], ["mins", "الدقائق"], ["apps", "المباريات"], ["cards", "البطاقات"]];
  let P = [], pos = "all", sort = "goals";
  const val = (p, k) => k === "ga" ? p.goals + p.assists : k === "cards" ? p.yellow + p.red * 2 : k === "rating" ? (p.mins >= 90 ? p.rating || 0 : 0) : p[k] || 0;
  const photo = (p, cls = "") => p.photo ? `<img class="${cls}" src="${esc(p.photo)}" alt="" loading="lazy" onerror="this.replaceWith(Object.assign(document.createElement('span'),{className:'${cls} ph',textContent:'${esc((p.n ?? "") + "")}'}))">` : `<span class="${cls} ph">${esc(p.n ?? "")}</span>`;
  const short = (n) => String(n || "").split(" ").slice(-1)[0];

  function leaders() {
    const top = (k, min = 0) => P.filter((p) => p.mins >= min && val(p, k) > 0).sort((a, b) => val(b, k) - val(a, k) || a.mins - b.mins)[0];
    const L = [["⚽", "الهداف", top("goals"), (p) => p.goals, "هدف"], ["🎯", "صانع الأهداف", top("assists"), (p) => p.assists, "صناعة"],
      ["⭐", "الأعلى تقييماً", top("rating", 270), (p) => p.rating?.toFixed(2), "تقييم"], ["⏱️", "الأكثر مشاركة", top("mins"), (p) => p.mins.toLocaleString("en"), "دقيقة"]].filter((x) => x[2]);
    $("leaders").innerHTML = L.map(([i, t, p, v, u]) => `<button type="button" class="sx-ld" data-p="${p.api}">${photo(p, "sx-ph")}<span class="sx-ld-t">${i} ${t}</span><b>${esc(p.name)}</b><span class="sx-ld-v"><em>${v(p)}</em> ${u}</span></button>`).join("");
  }
  function list() {
    const rows = P.filter((p) => pos === "all" || p.pos === pos).sort((a, b) => val(b, sort) - val(a, sort) || b.mins - a.mins);
    const k = sort;
    $("list").innerHTML = `<div class="sx-row sx-th"><span></span><span>اللاعب</span><span>م</span><span>⚽</span><span>🎯</span><span>${k === "rating" ? "⭐" : k === "mins" ? "د" : k === "cards" ? "🟨" : "⭐"}</span></div>` +
      rows.map((p, i) => `<button type="button" class="sx-row" data-p="${p.api}"><span class="sx-rk">${i + 1}</span><span class="sx-pl">${photo(p, "sx-mini")}<span><b>${esc(p.name)}</b><small>${p.n != null ? "#" + p.n + " · " : ""}${POS[p.pos] || ""}</small></span></span>
        <span>${p.apps}</span><span class="${k === "goals" || k === "ga" ? "on" : ""}">${p.goals}</span><span class="${k === "assists" || k === "ga" ? "on" : ""}">${p.assists}</span>
        <span class="${["rating", "mins", "cards"].includes(k) ? "on" : ""}">${k === "mins" ? p.mins : k === "cards" ? p.yellow + (p.red ? "+" + p.red + "🟥" : "") : p.rating ? p.rating.toFixed(1) : "—"}</span></button>`).join("");
  }
  function chips() {
    $("posF").innerHTML = [["all", "الكل"], ...Object.entries(POS)].map(([k, l]) => `<button type="button" class="chip${pos === k ? " on" : ""}" data-pos="${k}">${l}</button>`).join("");
    $("sortF").innerHTML = SORTS.map(([k, l]) => `<button type="button" class="chip${sort === k ? " on" : ""}" data-s="${k}">${l}</button>`).join("");
    $("posF").querySelectorAll("[data-pos]").forEach((b) => (b.onclick = () => { pos = b.dataset.pos; chips(); list(); }));
    $("sortF").querySelectorAll("[data-s]").forEach((b) => (b.onclick = () => { sort = b.dataset.s; chips(); list(); }));
  }
  function open(id) {
    const p = P.find((x) => x.api === +id); if (!p) return;
    const per90 = (v) => (p.mins ? ((v / p.mins) * 90).toFixed(2) : "0");
    const cells = [["مباريات", p.apps], ["أساسي", p.starts], ["دقائق", p.mins.toLocaleString("en")], ["أهداف", p.goals], ["صناعة", p.assists], ["تقييم", p.rating ? p.rating.toFixed(2) : "—"],
      ...(p.pos === "GK" ? [["تصديات", p.saves], ["استقبل", p.conceded]] : [["تسديدات", p.shots], ["على المرمى", p.shotsOn], ["تمريرات مفتاحية", p.keyPasses], ["مراوغات ناجحة", p.dribbles]]),
      ["تدخلات", p.tackles], ["قطع", p.interceptions], ["🟨", p.yellow], ["🟥", p.red], ["أهداف/90د", per90(p.goals)], ["ضربات جزاء", p.penScored]];
    $("pdT").textContent = p.name;
    $("pdB").innerHTML = `<div class="pd-top">${photo(p, "pd-ph")}<div><b>${esc(p.name)}</b><span>${[p.n != null ? "#" + p.n : "", POS[p.pos], p.age ? p.age + " سنة" : ""].filter(Boolean).join(" · ")}</span></div></div>
      <div class="pd-grid">${cells.map(([l, v]) => `<div><b>${v ?? 0}</b><small>${l}</small></div>`).join("")}</div>
      ${p.comps?.length > 1 ? `<div class="pd-h">حسب البطولة</div>${p.comps.map((c) => `<div class="pd-c"><span>${esc(ar.arLeague({ id: c.id, name: c.league }))}</span><span>${c.apps} م · ${c.goals} ⚽ · ${c.assists} 🎯</span></div>`).join("")}` : ""}`;
    $("pd").showModal ? $("pd").showModal() : $("pd").setAttribute("open", "");
  }
  document.addEventListener("click", (e) => { const b = e.target.closest("[data-p]"); if (b) open(b.dataset.p); if (e.target.id === "pd") $("pd").close(); });
  $("pdX").onclick = () => $("pd").close();

  function spl(rows) {
    if (!rows?.length) return;
    $("splBox").hidden = false;
    $("spl").innerHTML = rows.map((r, i) => `<div class="sx-sc${r.team.id === 2932 ? " hl" : ""}"><span class="sx-rk">${i + 1}</span><img src="${esc(r.team.logo)}" alt="" loading="lazy" width="26" height="26"><span><b>${esc(r.name)}</b><small>${esc(ar.arTeam(r.team.name))}</small></span><em>${r.goals}</em></div>`).join("");
  }

  fetch("data/stats.json?t=" + Date.now(), { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((d) => {
    if (!d || !d.players?.length) { $("leaders").innerHTML = `<div class="empty">الإحصائيات تطلع قريباً</div>`; return; }
    P = d.players;
    $("sxSub").textContent = "موسم " + d.season + "/" + String(d.season + 1).slice(2) + " · كل البطولات";
    leaders(); chips(); list(); spl(d.splScorers);
  }).catch(() => ($("leaders").innerHTML = `<div class="empty">تعذّر التحميل</div>`));
})();
