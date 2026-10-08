/* مناسبات الهلال (data/occasions.json):
   - الرئيسية: «في مثل هذا اليوم» يطلع الساعة 5 العصر بتوقيت مكة (وقت النشر الموحد)
   - صفحة occasions.html: كل المناسبات حسب الشهر */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
  const CAT = { birth: ["🎂", "أعياد الميلاد"], title: ["🏆", "بطولات وإنجازات"], history: ["📜", "ذكريات وأحداث"] };
  // الوقت الحين بتوقيت مكة
  const nowRiyadh = () => { const p = Object.fromEntries(new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Riyadh", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }).formatToParts(new Date()).map((x) => [x.type, x.value]));
    return { d: `${p.day}/${p.month}`, day: +p.day, month: +p.month, mins: (+p.hour % 24) * 60 + +p.minute, secs: (+p.hour % 24) * 3600 + +p.minute * 60 + +p.second }; };
  const toMins = (t) => { const [h, m] = String(t || "17:00").split(":").map(Number); return h * 60 + (m || 0); };
  const item = (o, cls = "") => `<li class="oc-i ${cls} oc-${o.cat}"><span class="oc-ic" aria-hidden="true">${CAT[o.cat]?.[0] || "💙"}</span><span class="oc-t">${esc(o.title)}</span></li>`;

  fetch("data/occasions.json?t=" + Date.now(), { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).then((data) => {
    if (!data) return;
    const items = data.items || [];
    const at = toMins(data.time);

    /* ---------- الرئيسية ---------- */
    const wrap = $("occWrap");
    if (wrap) {
      const show = () => {
        const n = nowRiyadh();
        const today = items.filter((o) => o.d === n.d && n.mins >= toMins(o.time || data.time));
        if (!today.length) { wrap.hidden = true; return; }
        wrap.hidden = false;
        wrap.innerHTML = `<a class="occ-card" href="occasions.html#today"><div class="occ-h"><b>💙 في مثل هذا اليوم</b><small>${n.day} ${MONTHS[n.month - 1]}</small></div><ul class="oc-list">${today.map((o) => item(o)).join("")}</ul><span class="occ-go">كل مناسبات الهلال ←</span></a>`;
      };
      show();
      // لو الصفحة مفتوحة قبل الساعة 5، تطلع لحالها وقتها
      const n = nowRiyadh();
      if (n.mins < at) setTimeout(show, (at * 60 - n.secs) * 1000 + 2000);
    }

    /* ---------- صفحة المناسبات ---------- */
    const page = $("occPage");
    if (!page) return;
    const n = nowRiyadh();
    let month = n.month, cat = "all";
    const today = items.filter((o) => o.d === n.d);
    const key = (o) => +o.d.slice(3, 5) * 100 + +o.d.slice(0, 2);
    const nowKey = n.month * 100 + n.day;
    const upcoming = [...items.filter((o) => key(o) > nowKey), ...items.filter((o) => key(o) < nowKey)].slice(0, 5);
    $("ocToday").innerHTML = `<div class="occ-h"><b>💙 اليوم · ${n.day} ${MONTHS[n.month - 1]}</b></div>` +
      (today.length ? `<ul class="oc-list">${today.map((o) => item(o)).join("")}</ul>` : `<p class="oc-empty">ما فيه مناسبة اليوم</p>`) +
      `<div class="oc-next"><small>الجاية</small>${upcoming.map((o) => `<div><span class="oc-dt">${+o.d.slice(0, 2)} ${MONTHS[+o.d.slice(3, 5) - 1]}</span>${CAT[o.cat]?.[0] || ""} ${esc(o.title)}</div>`).join("")}</div>`;
    const draw = () => {
      $("ocMonths").innerHTML = MONTHS.map((m, i) => `<button type="button" class="chip${i + 1 === month ? " on" : ""}" data-m="${i + 1}">${m}</button>`).join("");
      $("ocCats").innerHTML = [["all", "الكل"], ...Object.entries(CAT).map(([k, v]) => [k, v[0] + " " + v[1]])].map(([k, l]) => `<button type="button" class="chip${k === cat ? " on" : ""}" data-c="${k}">${l}</button>`).join("");
      $("ocMonths").querySelectorAll("[data-m]").forEach((b) => (b.onclick = () => { month = +b.dataset.m; draw(); }));
      $("ocCats").querySelectorAll("[data-c]").forEach((b) => (b.onclick = () => { cat = b.dataset.c; draw(); }));
      const list = items.filter((o) => +o.d.slice(3, 5) === month && (cat === "all" || o.cat === cat));
      const days = [...new Set(list.map((o) => o.d))];
      $("ocList").innerHTML = days.length ? days.map((d) => `<div class="oc-day${d === n.d ? " is-today" : ""}"><div class="oc-num"><b>${+d.slice(0, 2)}</b><small>${MONTHS[month - 1]}</small></div><ul class="oc-list">${list.filter((o) => o.d === d).map((o) => item(o)).join("")}</ul></div>`).join("")
        : `<p class="oc-empty">ما فيه مناسبات مسجلة بهالشهر</p>`;
      const cur = $("ocMonths").querySelector(".on"); if (cur) cur.scrollIntoView({ inline: "center", block: "nearest" });
    };
    draw();
    $("ocCount").textContent = items.length + " مناسبة";
  }).catch(() => {});
})();
