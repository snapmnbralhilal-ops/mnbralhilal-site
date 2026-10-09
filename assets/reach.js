/* أرقام منبر (data/reach.json) — تتحدث كل شهر من الملف */
(function () {
  const $ = (id) => document.getElementById(id);
  if (!$("reach")) return;
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const ICON = {
    x: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>',
    snapchat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M12 2.6c3.2 0 5.3 2.4 5.3 5.4v2.6l1.7-.5c.6-.1.9.6.4 1l-2 1.1c.7 1.9 2.1 3.1 3.8 3.6-.3.9-1.7 1.2-2.8 1.3-.2.6-.2 1.2-.7 1.3-.9.1-1.8-.4-3.1.1-1 .4-1.6 1.4-2.6 1.4s-1.6-1-2.6-1.4c-1.3-.5-2.2 0-3.1-.1-.5-.1-.5-.7-.7-1.3-1.1-.1-2.5-.4-2.8-1.3 1.7-.5 3.1-1.7 3.8-3.6l-2-1.1c-.5-.4-.2-1.1.4-1l1.7.5V8c0-3 2.1-5.4 5.3-5.4z"/></svg>',
    instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.4" cy="6.6" r="1.1" fill="currentColor" stroke="none"/></svg>',
    tiktok: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12.525.02c1.31-.02 2.61-.01 3.91-.02.08 1.53.63 3.09 1.75 4.17 1.12 1.11 2.7 1.62 4.24 1.79v4.03c-1.44-.05-2.89-.35-4.2-.97-.57-.26-1.1-.59-1.62-.93-.01 2.92.01 5.84-.02 8.75-.08 1.4-.54 2.79-1.35 3.94-1.31 1.92-3.58 3.17-5.91 3.21-1.43.08-2.86-.31-4.08-1.03-2.02-1.19-3.44-3.37-3.65-5.71-.02-.5-.03-1-.01-1.49.18-1.9 1.12-3.72 2.58-4.96 1.66-1.44 3.98-2.13 6.15-1.72.02 1.48-.04 2.96-.04 4.44-.99-.32-2.15-.23-3.02.37-.63.41-1.11 1.04-1.36 1.75-.21.51-.15 1.07-.14 1.61.24 1.64 1.82 3.02 3.5 2.87 1.12-.01 2.19-.66 2.77-1.61.19-.33.4-.67.41-1.06.1-1.79.06-3.57.07-5.36.01-4.03-.01-8.05.02-12.07z"/></svg>'
  };
  const fmtNum = (v, dec, unit, plus) => (plus ? "+" : "") + (dec ? v.toFixed(dec) : Math.round(v).toLocaleString("en-US")) + (unit || "");
  // العدّاد يبدأ لما القسم يظهر على الشاشة
  function countUp(el) {
    const to = +el.dataset.to, dec = +el.dataset.dec || 0, unit = el.dataset.unit || "", plus = el.dataset.plus === "1";
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = fmtNum(to, dec, unit, plus); return; }
    const t0 = performance.now(), ms = 1600;
    const step = (t) => { const p = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - p, 4); el.textContent = fmtNum(to * e, dec, unit, plus); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  }
  const span = (v, unit, plus) => { const dec = String(v).includes(".") ? String(v).split(".")[1].length : 0; return `data-to="${v}" data-dec="${dec}" data-unit="${esc(unit || "")}" data-plus="${plus ? 1 : 0}"`; };
  fetch("data/reach.json?t=" + Date.now(), { cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null).then((d) => {
    if (!d) return;
    $("rcPeriod").textContent = "منبر الهلال | " + (d.period || "");
    $("rcHead").textContent = d.headline || "أرقام منبر";
    const T = $("rcTotal"); T.outerHTML = `<b id="rcTotal" ${span(d.total, "", true)}>+0</b>`;
    $("rcTotalLbl").textContent = d.total_label || "";
    $("rcGrid").innerHTML = (d.platforms || []).map((p) => `<div class="rc-p rc-${esc(p.key)}">
      <span class="rc-ic">${ICON[p.key] || ""}</span>
      <b class="num" ${span(p.value, p.unit, p.plus)}>0</b>
      <span class="rc-lbl"><strong>${esc(p.name)}</strong> ${esc(p.label || "")}</span></div>`).join("");
    const a = d.audience;
    $("rcAud").innerHTML = a ? `<div><strong>${esc(a.label || "")}</strong><small>${esc(a.sub || "")}</small></div><b class="num" ${span(a.value, a.unit, a.plus)}>0</b>` : "";
    $("reach").hidden = false;
    const nums = $("reach").querySelectorAll("[data-to]");
    const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { countUp(e.target); io.unobserve(e.target); } }), { threshold: 0.4 });
    nums.forEach((n) => io.observe(n));
  });
})();
