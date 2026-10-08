/* صفحة ذكرى التأسيس — تقرأ data/founding.json */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function countdown(dateStr) {
    const target = new Date(dateStr + "T00:00:00+03:00");
    const end = new Date(target.getTime() + 86400000);
    const tick = () => {
      const now = new Date();
      if (now >= target && now < end) { $("fdCount").innerHTML = `<div class="fd-today">اليوم ذكرى التأسيس 💙</div>`; return; }
      if (now >= end) { $("fdCount").innerHTML = ""; return; }
      const s = (target - now) / 1000;
      const parts = [[Math.floor(s / 86400), "يوم"], [Math.floor((s % 86400) / 3600), "ساعة"], [Math.floor((s % 3600) / 60), "دقيقة"], [Math.floor(s % 60), "ثانية"]];
      $("fdCount").innerHTML = parts.map(([v, l]) => `<div><b>${String(v).padStart(2, "0")}</b><small>${l}</small></div>`).join("");
    };
    tick(); setInterval(tick, 1000);
  }

  function countUp(el, to, ms = 1400) {
    const t0 = performance.now();
    const step = (t) => { const p = Math.min(1, (t - t0) / ms); el.textContent = Math.round(to * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }

  function reveal() {
    const io = "IntersectionObserver" in window ? new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      if (e.target.dataset.to) countUp(e.target, +e.target.dataset.to);
      io.unobserve(e.target);
    }), { threshold: 0.2 }) : null;
    document.querySelectorAll(".fd-t,.fd-line li,[data-to]").forEach((el) => io ? io.observe(el) : el.classList.add("in"));
  }

  function render(d) {
    const years = new Date(d.anniversary_date).getFullYear() - new Date(d.founded).getFullYear();
    $("fdYears").textContent = years;
    countdown(d.anniversary_date);

    const titles = (d.titles || []).slice().sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0)); // نفس ترتيب الملف، والمميزة أولاً
    const total = titles.reduce((s, t) => s + (t.count || 0), 0);
    $("fdTotal").dataset.to = total;
    $("fdTitles").innerHTML = titles.map((t) => `<div class="fd-t${t.featured ? " star" : ""}"><b data-to="${t.count}">0</b><span>${esc(t.name)}</span>${t.note ? `<small>${esc(t.note)}</small>` : ""}</div>`).join("");

    $("fdLine").innerHTML = (d.timeline || []).map((e) => `<li><span class="fd-y">${esc(e.year)}</span><h3>${esc(e.title)}</h3><p>${esc(e.text)}</p></li>`).join("");

    $("fdLegends").innerHTML = (d.legends || []).map((l) => {
      const ini = l.name.trim()[0] || "";
      return `<div class="fd-l"><span class="ini">${esc(ini)}</span><b>${esc(l.name)}</b><span>${esc(l.role || "")}</span></div>`;
    }).join("");

    const url = location.href.split("#")[0];
    const text = `${years} عاماً من الهلال 💙 ذكرى تأسيس الزعيم — من منبر الهلال`;
    $("shWa").href = "https://wa.me/?text=" + encodeURIComponent(text + "\n" + url);
    $("shX").href = "https://x.com/intent/post?text=" + encodeURIComponent(text) + "&url=" + encodeURIComponent(url);
    $("shCopy").onclick = () => navigator.clipboard?.writeText(url).then(() => { $("shCopy").textContent = "تم النسخ ✓"; setTimeout(() => ($("shCopy").textContent = "نسخ الرابط"), 1800); });
    reveal();
  }

  fetch("data/founding.json?t=" + Date.now(), { cache: "no-store" }).then((r) => r.json()).then(render).catch(() => {});
})();
