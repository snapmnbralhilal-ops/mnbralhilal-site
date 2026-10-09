/* صفحة "العب مع منبر": توقّع النتيجة، رجل المباراة، كن أنت المدرب */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const TZ = "Asia/Riyadh";
  const fmt = (o) => new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { timeZone: TZ, ...o });
  const fDay = fmt({ weekday: "long", day: "numeric", month: "long" });
  const fTime = fmt({ hour: "2-digit", minute: "2-digit", hour12: false });
  const LOGOS = { "الهلال": "https://media.api-sports.io/football/teams/2932.png", "الاتحاد": "assets/teams/ittihad.png", "السد": "assets/teams/sadd.png", "الرياض": "assets/teams/riyadh.png", "الحزم": "assets/teams/hazem.png", "القادسية": "assets/teams/qadsiah.png", "الشمال": "assets/teams/shamal.png", "الفتح": "assets/teams/fateh.png" };
  const POS_AR = { GK: "حراسة", DF: "دفاع", MF: "وسط", FW: "هجوم" };

  // معرّف الجهاز (توقّع واحد لكل جهاز)
  let DID = null;
  try { DID = localStorage.getItem("mnbr-did"); } catch (e) {}
  if (!DID) {
    DID = "d" + Array.from(crypto.getRandomValues(new Uint8Array(10))).map((b) => b.toString(16).padStart(2, "0")).join("");
    try { localStorage.setItem("mnbr-did", DID); } catch (e) {}
  }
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  let SQUAD = [], BYID = {}, API = null, GAME = null, MATCH = null;
  const pName = (id) => BYID[id]?.short || "";

  /* ---------- التبويبات ---------- */
  function showTab(t) {
    document.querySelectorAll(".pl-tabs button").forEach((b) => b.setAttribute("aria-selected", b.dataset.t === t));
    ["predict", "vote", "coach", "league"].forEach((x) => ($("t-" + x).hidden = x !== t));
    if (t === "league") loadLeague();
    try { history.replaceState(null, "", "#" + t); } catch (e) {}
  }
  document.querySelectorAll(".pl-tabs button").forEach((b) => (b.onclick = () => showTab(b.dataset.t)));

  /* ---------- رأس الصفحة: المباراة ---------- */
  let cdTimer = null;
  function renderMatch() {
    if (!MATCH) { $("plMatch").innerHTML = `<div class="empty">ما فيه مباراة قادمة للهلال حالياً — الألعاب ترجع مع المباراة الجاية</div>`; return; }
    const d = new Date(MATCH.date);
    const ph = GAME?.phase || "predict";
    const badge = { predict: "التوقعات مفتوحة", live: "المباراة جارية", vote: "انتهت · صوّت لرجل المباراة", closed: "انتهت" }[ph];
    const fin = GAME?.final;
    const mid = fin && ph !== "predict"
      ? (() => { const hg = MATCH.home === "الهلال" ? fin.hilal : fin.opp, ag = MATCH.home === "الهلال" ? fin.opp : fin.hilal;
          // المستضيف على اليمين: الرقم اليمين = أهدافه
          return `<b class="pl-score"><bdi dir="ltr">${ag} - ${hg}</bdi></b><small>${fin.done ? "النتيجة النهائية" : "مباشر"}</small>`; })()
      : `<b class="pl-time">${fTime.format(d)}</b><small>${esc(fDay.format(d))}</small>`;
    const crest = (n) => LOGOS[n] ? `<img src="${LOGOS[n]}" alt="" width="56" height="56">` : `<span class="pl-ph">${esc(n[0] || "")}</span>`;
    $("plMatch").innerHTML = `
      <div class="pl-badge ph-${ph}">${badge}</div>
      <div class="pl-vs">
        <div class="pl-t">${crest(MATCH.home)}<b>${esc(MATCH.home)}</b></div>
        <div class="pl-mid">${mid}</div>
        <div class="pl-t">${crest(MATCH.away)}<b>${esc(MATCH.away)}</b></div>
      </div>
      <div class="pl-meta">${esc([MATCH.competition, MATCH.round, MATCH.venue].filter(Boolean).join(" · "))}</div>
      ${ph === "predict" ? `<div class="pl-cd" id="plCd"></div>` : ""}`;
    clearInterval(cdTimer);
    if (ph === "predict") {
      const tick = () => {
        const s = Math.max(0, (d - Date.now()) / 1000);
        const el = $("plCd"); if (!el) return;
        const days = Math.floor(s / 86400), hms = [Math.floor((s % 86400) / 3600), Math.floor((s % 3600) / 60), Math.floor(s % 60)].map((v) => String(v).padStart(2, "0")).join(":");
        el.innerHTML = s > 0 ? `يقفل التوقع بعد ${days ? `<b>${days} ${days === 1 ? "يوم" : days === 2 ? "يومين" : "أيام"}</b> و ` : ""}<b><bdi dir="ltr">${hms}</bdi></b>` : "انتهى وقت التوقع";
        if (s <= 0) { clearInterval(cdTimer); setTimeout(refresh, 3000); }
      };
      tick(); cdTimer = setInterval(tick, 1000);
    }
  }

  /* ---------- توقّع النتيجة ---------- */
  let draft = { h: 1, o: 0, s: 0 };
  const opp = () => MATCH?.home === "الهلال" ? MATCH.away : MATCH?.home || "الخصم";
  const hilalFirst = () => MATCH?.home === "الهلال";

  function stepper(key, label) {
    return `<div class="stp"><span class="stp-l">${esc(label)}</span>
      <div class="stp-row"><button type="button" class="stp-b" data-k="${key}" data-d="1" aria-label="زيادة">+</button>
      <b class="stp-v" id="v-${key}">${draft[key]}</b>
      <button type="button" class="stp-b" data-k="${key}" data-d="-1" aria-label="نقص">−</button></div></div>`;
  }
  function scorerChips() {
    const pool = SQUAD.filter((p) => p.pos === "FW" || p.pos === "MF").concat(SQUAD.filter((p) => p.pos === "DF"));
    return `<div class="chips">${pool.map((p) => `<button type="button" class="chip${draft.s === p.id ? " on" : ""}" data-s="${p.id}"><i>${p.n}</i>${esc(p.short)}</button>`).join("")}
      <button type="button" class="chip${draft.s === -1 ? " on" : ""}" data-s="-1">ما يسجل الهلال</button></div>`;
  }
  function renderPredict() {
    const ph = GAME?.phase || "predict";
    const mine = GAME?.mine?.pred;
    if (ph === "predict" && (!mine || renderPredict.editing)) {
      if (mine && !renderPredict.editing) draft = { h: mine.h, o: mine.o, s: mine.s };
      $("pForm").innerHTML = `
        <h2 class="pl-h">وش توقّعك؟</h2>
        <div class="stps">${hilalFirst() ? stepper("h", "الهلال") + stepper("o", opp()) : stepper("o", opp()) + stepper("h", "الهلال")}</div>
        <div class="pl-sub">أول هدّاف للهلال <small>(اختياري)</small></div>
        ${scorerChips()}
        <button type="button" class="card-btn pl-go" id="pSend">ثبّت توقّعي</button>
        <p class="pl-err" id="pErr" hidden></p>`;
      $("pForm").querySelectorAll(".stp-b").forEach((b) => (b.onclick = () => {
        const k = b.dataset.k; draft[k] = Math.max(0, Math.min(15, draft[k] + +b.dataset.d)); $("v-" + k).textContent = draft[k];
      }));
      $("pForm").querySelectorAll(".chip").forEach((c) => (c.onclick = () => {
        const v = +c.dataset.s; draft.s = draft.s === v ? 0 : v;
        $("pForm").querySelectorAll(".chip").forEach((x) => x.classList.toggle("on", +x.dataset.s === draft.s));
      }));
      $("pSend").onclick = sendPrediction;
    } else if (mine) {
      const sc = mine.s > 0 ? pName(mine.s) : mine.s === -1 ? "ما يسجل الهلال" : "";
      const fin = GAME.final;
      let verdict = "";
      if (fin?.done) {
        const exact = mine.h === fin.hilal && mine.o === fin.opp;
        const out = Math.sign(mine.h - mine.o) === Math.sign(fin.hilal - fin.opp);
        verdict = exact ? `<div class="vd ok">🎯 صبت النتيجة بالضبط!</div>` : out ? `<div class="vd mid">✅ صبت الفائز</div>` : `<div class="vd no">❌ ما صابت هالمرة</div>`;
      }
      $("pForm").innerHTML = `
        <h2 class="pl-h">توقّعك</h2>
        <div class="my-pred"><b>${hilalFirst() ? `الهلال ${mine.h} - ${mine.o} ${esc(opp())}` : `${esc(opp())} ${mine.o} - ${mine.h} الهلال`}</b>${sc ? `<span>أول هدّاف: ${esc(sc)}</span>` : ""}</div>
        ${verdict}
        <div class="pl-btns">
          <button type="button" class="card-btn" id="pShare">📤 شارك توقّعي</button>
          ${ph === "predict" ? `<button type="button" class="lb-btn" id="pEdit">عدّل التوقع</button>` : ""}
        </div>`;
      $("pShare").onclick = () => shareImage(predictionCard(mine), "tawaqqui-mnbr.png", `توقّعي لمباراة ${MATCH.home} × ${MATCH.away} 🎯`);
      if ($("pEdit")) $("pEdit").onclick = () => { renderPredict.editing = true; draft = { h: mine.h, o: mine.o, s: mine.s }; renderPredict(); };
    } else {
      $("pForm").innerHTML = `<h2 class="pl-h">التوقعات مقفلة</h2><p class="pl-muted">${ph === "live" ? "المباراة بدأت — تابع النتيجة، والتصويت لرجل المباراة يفتح بعد الصافرة." : "انتهى وقت التوقع لهذي المباراة."}</p>`;
    }
    renderPredStats();
  }
  async function sendPrediction() {
    const btn = $("pSend"); btn.disabled = true; btn.textContent = "جاري الحفظ…";
    try {
      const r = await fetch(API + "/game/predict", { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify({ d: DID, k: GAME?.kickoff, h: draft.h, o: draft.o, s: draft.s }) });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error === "closed" ? "انتهى وقت التوقع" : j.error === "limit" ? "وصلت الحد المسموح من هالشبكة" : "صار خطأ، جرّب مرة ثانية");
      renderPredict.editing = false;
      await refresh();
    } catch (e) {
      btn.disabled = false; btn.textContent = "ثبّت توقّعي";
      const er = $("pErr"); er.hidden = false; er.textContent = e.message || "تعذّر الاتصال";
    }
  }
  function renderPredStats() {
    const a = GAME?.agg;
    if (!a || !a.n) { $("pStats").innerHTML = GAME ? `<p class="pl-muted center">كن أول من يتوقّع 👆</p>` : ""; return; }
    const pc = (x) => Math.round((x / a.n) * 100);
    const w = pc(a.w), d = pc(a.d), l = Math.max(0, 100 - w - d);
    const fin = GAME.final;
    $("pStats").innerHTML = `
      <div class="st-h">توقعات الجمهور <small>${a.n.toLocaleString("en")} توقّع</small></div>
      <div class="ob">
        <span class="ob-w" style="flex:${w || 0.0001}">${w >= 12 ? `الهلال ${w}%` : ""}</span>
        <span class="ob-d" style="flex:${d || 0.0001}">${d >= 12 ? `تعادل ${d}%` : ""}</span>
        <span class="ob-l" style="flex:${l || 0.0001}">${l >= 12 ? `${esc(opp())} ${l}%` : ""}</span>
      </div>
      <div class="ob-legend"><span><i class="ob-w"></i>فوز الهلال ${w}%</span><span><i class="ob-d"></i>تعادل ${d}%</span><span><i class="ob-l"></i>فوز ${esc(opp())} ${l}%</span></div>
      ${fin?.done ? `<div class="hit"><b>${(GAME.exactCount || 0).toLocaleString("en")}</b> صابوا النتيجة بالضبط · <b>${(GAME.outcomeCount || 0).toLocaleString("en")}</b> صابوا الفائز</div>` : ""}
      <div class="st-grid">
        <div><div class="st-s">أكثر النتائج توقّعاً</div>${(GAME.topScores || []).map(([s, n]) => { const [h, o] = s.split("-"); return `<div class="st-r"><b>${hilalFirst() ? `${h} - ${o}` : `${o} - ${h}`}</b><span>${pc(n)}%</span></div>`; }).join("")}</div>
        <div><div class="st-s">أول هدّاف</div>${(GAME.topScorers || []).map(([id, n]) => `<div class="st-r"><b>${esc(pName(+id) || "—")}</b><span>${n}</span></div>`).join("") || `<p class="pl-muted">—</p>`}</div>
      </div>`;
  }

  /* ---------- رجل المباراة ---------- */
  let voteDraft = null;
  function renderVote() {
    const ph = GAME?.phase || "predict";
    const mine = GAME?.mine?.vote;
    const v = GAME?.votes || { n: 0, top: [] };
    const bars = v.n ? `<div class="st-h">نتيجة التصويت <small>${v.n.toLocaleString("en")} صوت</small></div>
      ${v.top.map(([id, n], i) => `<div class="vb${+id === mine ? " me" : ""}"><span class="vb-n">${esc(BYID[+id]?.name || "—")}</span><span class="vb-bar"><i style="width:${Math.max(4, Math.round((n / v.n) * 100))}%"></i></span><b>${Math.round((n / v.n) * 100)}%</b>${i === 0 ? "<em>⭐</em>" : ""}</div>`).join("")}` : "";
    if (ph !== "vote") {
      $("vBody").innerHTML = `<h2 class="pl-h">⭐ رجل المباراة</h2><p class="pl-muted">${ph === "closed" ? "انتهى التصويت." : "التصويت يفتح بعد صافرة النهاية — ارجع لنا بعد المباراة واختر نجمك."}</p>${bars}`;
      return;
    }
    if (mine && !renderVote.editing) {
      $("vBody").innerHTML = `<h2 class="pl-h">صوّتت لـ ${esc(BYID[mine]?.name || "")} ⭐</h2>
        <div class="pl-btns"><button type="button" class="lb-btn" id="vEdit">غيّر صوتك</button></div>${bars}`;
      $("vEdit").onclick = () => { renderVote.editing = true; voteDraft = mine; renderVote(); };
      return;
    }
    const groups = ["FW", "MF", "DF", "GK"];
    $("vBody").innerHTML = `<h2 class="pl-h">مين رجل المباراة؟</h2>
      ${groups.map((g) => `<div class="pl-sub">${POS_AR[g]}</div><div class="chips">${SQUAD.filter((p) => p.pos === g).map((p) => `<button type="button" class="chip${voteDraft === p.id ? " on" : ""}" data-p="${p.id}"><i>${p.n}</i>${esc(p.short)}</button>`).join("")}</div>`).join("")}
      <button type="button" class="card-btn pl-go" id="vSend" ${voteDraft ? "" : "disabled"}>صوّت</button><p class="pl-err" id="vErr" hidden></p>${bars}`;
    $("vBody").querySelectorAll(".chip").forEach((c) => (c.onclick = () => {
      voteDraft = +c.dataset.p;
      $("vBody").querySelectorAll(".chip").forEach((x) => x.classList.toggle("on", +x.dataset.p === voteDraft));
      $("vSend").disabled = false;
    }));
    $("vSend").onclick = async () => {
      const b = $("vSend"); b.disabled = true; b.textContent = "جاري…";
      try {
        const r = await fetch(API + "/game/vote", { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify({ d: DID, k: GAME?.kickoff, p: voteDraft }) });
        const j = await r.json(); if (!r.ok) throw new Error(j.error === "closed" ? "انتهى التصويت" : "صار خطأ، جرّب مرة ثانية");
        renderVote.editing = false; await refresh();
      } catch (e) { b.disabled = false; b.textContent = "صوّت"; const er = $("vErr"); er.hidden = false; er.textContent = e.message; }
    };
  }

  /* ---------- كن أنت المدرب ---------- */
  const FORMS = {
    "4-3-3": [["GK", 50, 89], ["DF", 85, 70], ["DF", 62, 74], ["DF", 38, 74], ["DF", 15, 70], ["MF", 75, 49], ["MF", 50, 54], ["MF", 25, 49], ["FW", 80, 23], ["FW", 50, 15], ["FW", 20, 23]],
    "4-2-3-1": [["GK", 50, 89], ["DF", 85, 70], ["DF", 62, 74], ["DF", 38, 74], ["DF", 15, 70], ["MF", 63, 57], ["MF", 37, 57], ["MF", 82, 35], ["MF", 50, 37], ["MF", 18, 35], ["FW", 50, 14]],
    "4-4-2": [["GK", 50, 89], ["DF", 85, 70], ["DF", 62, 74], ["DF", 38, 74], ["DF", 15, 70], ["MF", 88, 46], ["MF", 63, 51], ["MF", 37, 51], ["MF", 12, 46], ["FW", 65, 18], ["FW", 35, 18]],
    "3-5-2": [["GK", 50, 89], ["DF", 75, 72], ["DF", 50, 75], ["DF", 25, 72], ["MF", 90, 45], ["MF", 68, 53], ["MF", 50, 41], ["MF", 32, 53], ["MF", 10, 45], ["FW", 64, 17], ["FW", 36, 17]],
    "3-4-3": [["GK", 50, 89], ["DF", 75, 72], ["DF", 50, 75], ["DF", 25, 72], ["MF", 88, 48], ["MF", 62, 53], ["MF", 38, 53], ["MF", 12, 48], ["FW", 80, 23], ["FW", 50, 15], ["FW", 20, 23]]
  };
  let coach = store.get("mnbr-coach", { form: "4-3-3", xi: [] });
  if (!FORMS[coach.form]) coach = { form: "4-3-3", xi: [] };
  const saveCoach = () => store.set("mnbr-coach", coach);
  let pickSlot = -1;

  function renderCoach() {
    $("coForms").innerHTML = Object.keys(FORMS).map((f) => `<button type="button" class="chip${coach.form === f ? " on" : ""}" data-f="${f}">${f}</button>`).join("");
    $("coForms").querySelectorAll(".chip").forEach((c) => (c.onclick = () => { coach.form = c.dataset.f; saveCoach(); renderCoach(); }));
    const slots = FORMS[coach.form];
    $("pitch").innerHTML = `<div class="pitch-lines" aria-hidden="true"><i class="pc-c"></i><i class="pc-l"></i><i class="pc-b1"></i><i class="pc-b2"></i></div>` +
      slots.map(([g, x, y], i) => {
        const p = BYID[coach.xi[i]];
        return `<button type="button" class="slot${p ? " full" : ""}" style="left:${x}%;top:${y}%" data-i="${i}" aria-label="${p ? esc(p.name) : "اختر " + POS_AR[g]}">
          <span class="sl-dot${p && p.img ? " ph" : ""}">${p ? (p.img ? `<img src="${esc(p.img)}" alt="" decoding="async"><em>${p.n}</em>` : p.n) : "+"}</span><span class="sl-n">${p ? esc(p.short) : POS_AR[g]}</span></button>`;
      }).join("");
    $("pitch").querySelectorAll(".slot").forEach((s) => (s.onclick = () => openPicker(+s.dataset.i)));
    renderCoachSend();
  }

  /* ---------- تشكيلة الجمهور ---------- */
  const sameLineup = (a, b) => a && b && a.form === b.form && a.xi.join() === b.xi.join();
  function renderCoachSend() {
    const el = $("coSend"); if (!el) return;
    const ph = GAME?.phase, full = coach.xi.filter(Boolean).length === 11;
    const mine = GAME?.mine?.lineup;
    if (!GAME || !GAME.kickoff) { el.innerHTML = ""; return; }
    if (ph !== "predict") {
      el.innerHTML = mine ? `<div class="vd mid">تشكيلتك محسوبة ضمن تشكيلة الجمهور ✅</div>` : "";
      return;
    }
    const synced = mine && sameLineup(mine, { form: coach.form, xi: coach.xi.slice(0, 11) });
    el.innerHTML = synced
      ? `<div class="vd ok">✅ تشكيلتك داخلة في تشكيلة الجمهور — تقدر تعدّلها لين بداية المباراة</div>`
      : `<button type="button" class="card-btn pl-go" id="coPost" ${full ? "" : "disabled"}>${mine ? "🔄 حدّث تشكيلتي في تشكيلة الجمهور" : "🗳️ اعتمد تشكيلتي للمباراة"}</button>
         <p class="pl-muted center" style="margin-top:8px">${full ? "تشكيلتك تدخل مع تشكيلات الجمهور، ونطلع منها التشكيلة الأكثر اختياراً" : "كمّل 11 لاعب عشان تقدر تعتمدها"}</p><p class="pl-err" id="coErr" hidden></p>`;
    if ($("coPost")) $("coPost").onclick = async () => {
      const b = $("coPost"); b.disabled = true; b.textContent = "جاري الإرسال…";
      try {
        const r = await fetch(API + "/game/lineup", { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify({ d: DID, k: GAME.kickoff, form: coach.form, xi: coach.xi.slice(0, 11) }) });
        const jj = await r.json();
        if (!r.ok) throw new Error(jj.error === "closed" ? "المباراة بدأت — انقفل الاعتماد" : jj.error === "limit" ? "وصلت الحد المسموح من هالشبكة" : "صار خطأ، جرّب مرة ثانية");
        await refresh();
      } catch (e) { b.disabled = false; b.textContent = "🗳️ اعتمد تشكيلتي للمباراة"; const er = $("coErr"); er.hidden = false; er.textContent = e.message || "تعذّر الاتصال"; }
    };
  }
  function renderCrowd() {
    const el = $("coCrowd"); if (!el) return;
    const cr = GAME?.crowd;
    if (!cr || !cr.n || !FORMS[cr.form]) {
      el.innerHTML = GAME?.kickoff ? `<div class="st-h">تشكيلة الجمهور</div><p class="pl-muted center">ما أحد اعتمد تشكيلته للحين — كن الأول 👆</p>` : "";
      return;
    }
    el.innerHTML = `<div class="st-h">تشكيلة الجمهور <small>${cr.n.toLocaleString("en")} مدرب</small></div>
      <div class="cr-forms">${(cr.forms || []).map(([f, pc]) => `<span class="${f === cr.form ? "on" : ""}"><bdi dir="ltr">${f}</bdi> ${pc}%</span>`).join("")}</div>
      <div class="pitch pitch-sm" aria-label="تشكيلة الجمهور"><div class="pitch-lines" aria-hidden="true"><i class="pc-c"></i><i class="pc-l"></i><i class="pc-b1"></i><i class="pc-b2"></i></div>
      ${FORMS[cr.form].map(([g, x, y], i) => { const it = cr.xi[i] || {}; const p = BYID[it.id];
        return `<div class="slot full" style="left:${x}%;top:${y}%"><span class="sl-dot">${p ? p.n : "?"}</span><span class="sl-n">${p ? esc(p.short) : "—"}</span><span class="sl-pc">${it.pct || 0}%</span></div>`; }).join("")}
      </div>
      <p class="pl-muted center" style="margin-top:8px">الخطة الأكثر اختياراً <bdi dir="ltr">${cr.form}</bdi> (${cr.formPct}%)، والنسبة تحت كل لاعب = كم مدرب (من اللي اختاروا نفس الخطة) حطّه في هالمركز</p>`;
  }
  function openPicker(i) {
    pickSlot = i;
    const g = FORMS[coach.form][i][0];
    $("pkTitle").textContent = "اختر " + (g === "GK" ? "الحارس" : "لاعب " + POS_AR[g]);
    const order = [g, ...["GK", "DF", "MF", "FW"].filter((x) => x !== g)];
    $("pkTabs").innerHTML = order.map((x, j) => `<button type="button" class="chip${j === 0 ? " on" : ""}" data-g="${x}">${POS_AR[x]}</button>`).join("");
    const list = (grp) => {
      const used = new Set(coach.xi.filter((_, j) => j !== i));
      $("pkList").innerHTML = SQUAD.filter((p) => p.pos === grp).map((p) => `<button type="button" class="pk-row${used.has(p.id) ? " used" : ""}${coach.xi[i] === p.id ? " on" : ""}" data-p="${p.id}">${p.img ? `<i class="ph"><img src="${esc(p.img)}" alt="" loading="lazy" decoding="async"></i>` : `<i>${p.n}</i>`}<b>${esc(p.name)}${p.img ? ` <span class="pk-n">${p.n}</span>` : ""}</b>${used.has(p.id) ? "<small>في التشكيلة</small>" : ""}</button>`).join("") +
        (coach.xi[i] ? `<button type="button" class="pk-row rm" data-p="0"><b>شيل اللاعب من المركز</b></button>` : "");
      $("pkList").querySelectorAll(".pk-row").forEach((r) => (r.onclick = () => {
        const pid = +r.dataset.p;
        if (pid) { const j = coach.xi.indexOf(pid); if (j > -1 && j !== i) coach.xi[j] = 0; }
        coach.xi[i] = pid; saveCoach(); renderCoach(); $("picker").close();
      }));
    };
    $("pkTabs").querySelectorAll(".chip").forEach((c) => (c.onclick = () => {
      $("pkTabs").querySelectorAll(".chip").forEach((x) => x.classList.toggle("on", x === c)); list(c.dataset.g);
    }));
    list(g);
    $("picker").showModal ? $("picker").showModal() : $("picker").setAttribute("open", "");
  }
  $("pkClose").onclick = () => $("picker").close();
  $("picker").addEventListener("click", (e) => { if (e.target.id === "picker") $("picker").close(); });
  $("coClear").onclick = () => { coach.xi = []; saveCoach(); renderCoach(); };
  $("coAuto").onclick = () => {
    const pref = { GK: [37, 33, 17], DF: [19, 3, 87, 78, 4, 2, 24], MF: [8, 22, 28, 70, 6, 18], FW: [29, 7, 11, 38, 77, 75] };
    const used = new Set(); coach.xi = FORMS[coach.form].map(([g]) => { const id = (pref[g] || []).find((x) => !used.has(x) && BYID[x]) || 0; used.add(id); return id; });
    saveCoach(); renderCoach();
  };
  $("coShare").onclick = () => {
    if (coach.xi.filter(Boolean).length < 11) { alert("كمّل التشكيلة (11 لاعب) قبل المشاركة"); return; }
    shareImage(lineupCard(), "tashkeelati-mnbr.png", "تشكيلتي للهلال — كن أنت المدرب مع منبر 📋");
  };

  /* ---------- دوري التوقعات ---------- */
  let LEAGUE_CFG = null, lgBusy = false;
  async function loadLeague() {
    if (lgBusy) return; lgBusy = true;
    try {
      const [b, cfg] = await Promise.all([API ? j(API + "/league?d=" + DID) : null, LEAGUE_CFG ? LEAGUE_CFG : j("data/league.json")]);
      LEAGUE_CFG = cfg || {};
      renderLeague(b);
    } finally { lgBusy = false; }
  }
  function renderLeague(b) {
    const cfg = LEAGUE_CFG || {};
    if (!b) { $("lgBody").innerHTML = `<p class="pl-muted center">تعذّر تحميل الدوري — جرّب بعد شوي</p>`; return; }
    const me = b.me;
    const prize = cfg.prize ? `<div class="lg-prize">${cfg.prizeLogo ? `<img src="${esc(cfg.prizeLogo)}" alt="" loading="lazy">` : "🎁"}<div><b>جائزة الدوري</b><span>${esc(cfg.prize)}</span>${cfg.sponsor ? `<small>برعاية ${esc(cfg.sponsor)}</small>` : ""}</div></div>` : "";
    const myCard = me?.nick
      ? `<div class="lg-me"><div><small>لقبك</small><b>${esc(me.nick)}</b></div><div><small>الترتيب</small><b>${me.rank ? "#" + me.rank : "—"}</b></div><div><small>النقاط</small><b>${me.pts}</b></div><div><small>مباريات</small><b>${me.played}</b></div></div>
         ${me.last ? `<p class="pl-muted center">آخر مباراة: <b>+${me.last.pts}</b> ${me.last.pts === 1 ? "نقطة" : "نقاط"}</p>` : `<p class="pl-muted center">نقاطك تنحسب بعد أول مباراة تتوقّعها</p>`}
         <button type="button" class="lb-btn lg-edit" id="lgEdit">غيّر لقبك</button>`
      : "";
    const form = `<form class="lg-form" id="lgForm" ${me?.nick ? "hidden" : ""}>
        <label for="lgNick">${me?.nick ? "لقبك الجديد" : "اختر لقبك عشان يطلع اسمك في الترتيب"}</label>
        <div class="lg-row"><input id="lgNick" maxlength="18" autocomplete="nickname" placeholder="مثال: الزعيم 9" value="${esc(me?.nick || "")}"><button class="card-btn" type="submit">حفظ</button></div>
        <p class="pl-err" id="lgErr" hidden></p></form>`;
    const rows = (b.top || []).map((u, i) => `<tr class="${me?.nick && u.nick === me.nick ? "me" : ""}"><td>${i < 3 ? ["🥇", "🥈", "🥉"][i] : i + 1}</td><td>${esc(u.nick)}</td><td>${u.played}</td><td>${u.exact}</td><td><b>${u.pts}</b></td></tr>`).join("");
    $("lgBody").innerHTML = `<h2 class="pl-h">🏆 دوري توقعات منبر</h2>${prize}${myCard}${form}
      <div class="lg-rules"><span><b>3</b> نتيجة بالضبط</span><span><b>1</b> الفائز صح</span><span><b>+1</b> أول هدّاف</span></div>
      <div class="st-h">الترتيب <small>${(b.players || 0).toLocaleString("en")} متسابق · ${b.matches || 0} ${b.matches === 1 ? "مباراة" : "مباريات"}</small></div>
      ${rows ? `<div class="tbl-wrap"><table class="lg-tbl"><thead><tr><th>#</th><th>اللقب</th><th>لعب</th><th>🎯</th><th>نقاط</th></tr></thead><tbody>${rows}</tbody></table></div>`
        : `<p class="pl-muted center">الترتيب يطلع بعد أول مباراة تنحسب نقاطها — توقّع الحين وحط لقبك 👆</p>`}`;
    if ($("lgEdit")) $("lgEdit").onclick = () => { $("lgForm").hidden = false; $("lgEdit").hidden = true; $("lgNick").focus(); };
    $("lgForm").onsubmit = async (e) => {
      e.preventDefault();
      const nick = $("lgNick").value.trim(), er = $("lgErr"); er.hidden = true;
      try {
        const r = await fetch(API + "/league/nick", { method: "POST", headers: { "content-type": "text/plain" }, body: JSON.stringify({ d: DID, nick }) });
        const jj = await r.json();
        if (!r.ok) throw new Error(jj.error === "nick-taken" ? "هاللقب مأخوذ، اختر غيره" : jj.error === "nick-invalid" ? "اللقب لازم يكون من 2 إلى 18 حرف أو رقم، وبدون كلمات مسيئة" : "صار خطأ، جرّب مرة ثانية");
        loadLeague();
      } catch (e2) { er.hidden = false; er.textContent = e2.message || "تعذّر الاتصال"; }
    };
  }

  /* ---------- صور المشاركة (بهوية منبر) ---------- */
  const W = 1080, H = 1350;
  async function canvasBase(title) {
    await Promise.all([document.fonts.load('700 60px "Expo Arabic"'), document.fonts.load('400 30px "Expo Arabic"')]).catch(() => {});
    const c = document.createElement("canvas"); c.width = W; c.height = H;
    const x = c.getContext("2d");
    const g = x.createRadialGradient(W / 2, -200, 100, W / 2, 300, 1300);
    g.addColorStop(0, "#2F5BFF"); g.addColorStop(0.45, "#0A1C6B"); g.addColorStop(1, "#02040F");
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.globalAlpha = 0.06; x.strokeStyle = "#fff"; x.lineWidth = 3;
    for (let i = -H; i < W; i += 44) { x.beginPath(); x.moveTo(i, 0); x.lineTo(i + H * 0.45, H); x.stroke(); }
    x.globalAlpha = 1;
    try { const logo = await loadImg("assets/icon-512.png"); x.save(); roundRect(x, W / 2 - 60, 60, 120, 120, 28); x.clip(); x.drawImage(logo, W / 2 - 60, 60, 120, 120); x.restore(); } catch (e) {}
    x.direction = "rtl"; x.textAlign = "center"; x.fillStyle = "#fff";
    x.font = '700 64px "Expo Arabic", sans-serif'; x.fillText(title, W / 2, 270);
    x.font = '400 30px "Expo Arabic", sans-serif'; x.fillStyle = "#AFC0FF";
    x.fillText([MATCH?.competition, MATCH && fDay.format(new Date(MATCH.date))].filter(Boolean).join(" · "), W / 2, 322);
    // التذييل
    x.fillStyle = "rgba(255,255,255,.08)"; x.fillRect(0, H - 120, W, 120);
    x.fillStyle = "#fff"; x.font = '700 34px "Expo Arabic", sans-serif'; x.fillText("منبر الهلال  ·  MNBRALHILAL", W / 2, H - 66);
    x.font = '400 24px "Expo Arabic", sans-serif'; x.fillStyle = "#AFC0FF"; x.fillText("توقّع وشارك معنا على موقع منبر الهلال", W / 2, H - 28);
    return { c, x };
  }
  function loadImg(src) { return new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; }); }
  function roundRect(x, X, Y, w, h, r) { x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + w, Y, X + w, Y + h, r); x.arcTo(X + w, Y + h, X, Y + h, r); x.arcTo(X, Y + h, X, Y, r); x.arcTo(X, Y, X + w, Y, r); x.closePath(); }

  async function predictionCard(p) {
    const { c, x } = await canvasBase("توقّعي 🎯");
    const left = hilalFirst() ? MATCH.away : MATCH.home, right = hilalFirst() ? MATCH.home : MATCH.away;
    const lg = hilalFirst() ? p.o : p.h, rg = hilalFirst() ? p.h : p.o;
    // بطاقة النتيجة
    x.fillStyle = "rgba(255,255,255,.07)"; roundRect(x, 90, 420, W - 180, 440, 40); x.fill();
    for (const [name, cx] of [[right, W - 270], [left, 270]]) {
      const src = name !== "الهلال" && LOGOS[name] && !/^https?:/.test(LOGOS[name]) ? LOGOS[name] : null;
      if (src) { try { const im = await loadImg(src); x.drawImage(im, cx - 80, 470, 160, 160); } catch (e) {} }
      else { x.fillStyle = name === "الهلال" ? "#1C3BE8" : "#333"; x.beginPath(); x.arc(cx, 550, 80, 0, 7); x.fill(); x.fillStyle = "#fff"; x.font = '700 70px "Expo Arabic"'; x.textAlign = "center"; x.fillText(name.replace(/^ال/, "")[0], cx, 575); }
      x.fillStyle = "#fff"; x.font = '700 44px "Expo Arabic"'; x.textAlign = "center"; x.fillText(name, cx, 700);
    }
    x.direction = "ltr"; x.font = '700 150px "Expo Arabic"'; x.fillStyle = "#fff"; x.textAlign = "center";
    x.fillText(`${lg} - ${rg}`, W / 2, 610);
    x.direction = "rtl";
    if (p.s) {
      x.font = '400 40px "Expo Arabic"'; x.fillStyle = "#C9D4FF";
      x.fillText(p.s === -1 ? "الهلال ما يسجل" : `أول هدّاف: ${pName(p.s)}`, W / 2, 800);
    }
    x.font = '700 46px "Expo Arabic"'; x.fillStyle = "#fff"; x.fillText("وانت وش توقّعك؟ 👀", W / 2, 1010);
    x.font = '400 32px "Expo Arabic"'; x.fillStyle = "#AFC0FF"; x.font = '400 26px "Expo Arabic"'; x.fillText(location.host + location.pathname.replace(/[^/]*$/, "") + "play.html", W / 2, 1070);
    return c;
  }

  async function lineupCard() {
    const { c, x } = await canvasBase("تشكيلتي 📋");
    const PX = 110, PY = 370, PW = W - 220, PH = 820;
    const pg = x.createLinearGradient(0, PY, 0, PY + PH); pg.addColorStop(0, "#0F5E2E"); pg.addColorStop(1, "#0A4522");
    x.fillStyle = pg; roundRect(x, PX, PY, PW, PH, 30); x.fill();
    x.save(); roundRect(x, PX, PY, PW, PH, 30); x.clip();
    for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? "rgba(255,255,255,.03)" : "rgba(0,0,0,.04)"; x.fillRect(PX, PY + (PH / 8) * i, PW, PH / 8); }
    x.strokeStyle = "rgba(255,255,255,.35)"; x.lineWidth = 4;
    x.strokeRect(PX + 20, PY + 20, PW - 40, PH - 40);
    x.beginPath(); x.moveTo(PX + 20, PY + PH / 2); x.lineTo(PX + PW - 20, PY + PH / 2); x.stroke();
    x.beginPath(); x.arc(W / 2, PY + PH / 2, 90, 0, 7); x.stroke();
    x.strokeRect(W / 2 - 170, PY + 20, 340, 130); x.strokeRect(W / 2 - 170, PY + PH - 150, 340, 130);
    x.restore();
    x.font = '700 30px "Expo Arabic"'; x.fillStyle = "rgba(0,0,0,.45)"; roundRect(x, PX + 34, PY + 34, 140, 50, 14); x.fill();
    x.fillStyle = "#fff"; x.textAlign = "center"; x.direction = "ltr"; x.fillText(coach.form, PX + 104, PY + 70); x.direction = "rtl";
    const loadImg = (src) => new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = src; });
    const pics = await Promise.all(FORMS[coach.form].map((_, i) => { const p = BYID[coach.xi[i]]; return p && p.img ? loadImg(p.img) : null; }));
    FORMS[coach.form].forEach(([g, sx, sy], i) => {
      const p = BYID[coach.xi[i]]; if (!p) return;
      const cx = PX + (sx / 100) * PW, cy = PY + (sy / 100) * PH, im = pics[i];
      if (im) {
        const R = 46, gr = x.createLinearGradient(0, cy - R, 0, cy + R); gr.addColorStop(0, "#3A63F0"); gr.addColorStop(1, "#0B1E5B");
        x.fillStyle = gr; x.beginPath(); x.arc(cx, cy, R, 0, 7); x.fill();
        x.save(); x.beginPath(); x.arc(cx, cy, R, 0, 7); x.clip(); x.drawImage(im, cx - R, cy - R, R * 2, R * 2); x.restore();
        x.strokeStyle = g === "GK" ? "#F5B800" : "#fff"; x.lineWidth = 4; x.beginPath(); x.arc(cx, cy, R, 0, 7); x.stroke();
        x.fillStyle = "#fff"; x.beginPath(); x.arc(cx - R * .78, cy - R * .5, 18, 0, 7); x.fill();
        x.fillStyle = "#0B1530"; x.font = '700 20px "Expo Arabic"'; x.direction = "ltr"; x.fillText(String(p.n), cx - R * .78, cy - R * .5 + 7); x.direction = "rtl";
      } else {
      x.fillStyle = g === "GK" ? "#F5B800" : "#1C3BE8"; x.beginPath(); x.arc(cx, cy, 44, 0, 7); x.fill();
      x.strokeStyle = "#fff"; x.lineWidth = 4; x.stroke();
      x.fillStyle = g === "GK" ? "#111" : "#fff"; x.font = '700 36px "Expo Arabic"'; x.direction = "ltr"; x.fillText(String(p.n), cx, cy + 13); x.direction = "rtl";
      }
      x.font = im ? '700 25px "Expo Arabic"' : '700 28px "Expo Arabic"'; const tw = x.measureText(p.short).width + 26;
      const ly = im ? 34 : 52, lh = im ? 38 : 42; x.fillStyle = im ? "rgba(8,14,32,.88)" : "rgba(0,0,0,.65)"; roundRect(x, cx - tw / 2, cy + ly, tw, lh, 12); x.fill();
      x.fillStyle = "#fff"; x.fillText(p.short, cx, cy + ly + (im ? 27 : 30));
    });
    return c;
  }

  async function shareImage(cPromise, fileName, text) {
    const c = await cPromise;
    const blob = await new Promise((r) => c.toBlob(r, "image/png"));
    const file = new File([blob], fileName, { type: "image/png" });
    const url = location.origin + location.pathname;
    try {
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], text: text + "\n" + url }); return; }
    } catch (e) { if (e.name === "AbortError") return; }
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = fileName; document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
  }

  /* ---------- التحميل ---------- */
  const j = (p) => fetch(p + (p.includes("?") ? "&" : "?") + "t=" + Date.now(), { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  async function refresh() {
    if (API) {
      const latest = await j(API + "/game?d=" + DID);
      if (latest) GAME = latest; // احتفظ بآخر حالة سليمة عند انقطاع الخدمة مؤقتًا
    }
    if (GAME && GAME.kickoff && MATCH && Math.abs(new Date(MATCH.date) - GAME.kickoff) > 6 * 3600e3) MATCH = await findMatch(GAME.kickoff);
    renderMatch(); renderPredict(); renderVote(); renderCoachSend(); renderCrowd();
    if (!$("t-league").hidden) loadLeague();
  }
  async function findMatch(k) {
    const [des, site] = await Promise.all([j("data/designs.json"), j("data/site.json")]);
    const near = (d) => k ? Math.abs(new Date(d) - k) < 6 * 3600e3 : new Date(d) > Date.now() - 24 * 3600e3;
    const dm = (des?.designs || []).map((x) => x.match).filter((m) => m?.date && (m.home === "الهلال" || m.away === "الهلال") && near(m.date))
      .sort((a, b) => new Date(a.date) - new Date(b.date))[0];
    if (dm) return dm;
    const ar = window.MNB ? window.MNB.arTeam : (n) => n;
    const sm = (site?.hilal?.upcoming || []).find((m) => near(m.date));
    return sm ? { date: sm.date, home: ar(sm.home.name), away: ar(sm.away.name), competition: "" } : null;
  }
  (async function init() {
    const [sq, live] = await Promise.all([j("data/squad.json"), j("data/live.json")]);
    SQUAD = sq?.players || []; SQUAD.forEach((p) => (BYID[p.id] = p));
    API = live?.url ? live.url.replace(/\/live$/, "") : null;
    if (API) {
      const latest = await j(API + "/game?d=" + DID);
      if (latest) GAME = latest; // احتفظ بآخر حالة سليمة عند انقطاع الخدمة مؤقتًا
    }
    MATCH = await findMatch(GAME?.kickoff);
    renderMatch(); renderPredict(); renderVote(); renderCoach(); renderCrowd();
    if (GAME && GAME.phase === "vote" && !location.hash) showTab("vote");
    const h = location.hash.slice(1); if (["predict", "vote", "coach", "league"].includes(h)) showTab(h);
    setInterval(() => { if (!document.hidden) refresh(); }, 60e3);
  })();
})();
