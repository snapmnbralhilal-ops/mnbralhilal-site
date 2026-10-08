/* أزرار "تابعنا" — تقرأ data/social.json وتعرضها في كل عنصر .social */
(function () {
  const NETS = [
    { key: "x", label: "X", icon: "x", url: (u) => `https://x.com/${u}` },
    { key: "instagram", label: "انستقرام", icon: "instagram", url: (u) => `https://www.instagram.com/${u}/` },
    { key: "tiktok", label: "تيك توك", icon: "tiktok", url: (u) => `https://www.tiktok.com/@${u}` },
    { key: "snapchat", label: "سناب", icon: "snapchat", url: (u) => `https://www.snapchat.com/add/${u}` },
    // واتساب: رابط قناة (https://whatsapp.com/channel/…) أو رقم دولي بدون + (9665xxxxxxxx)
    { key: "whatsapp", label: "واتساب", icon: "whatsapp", url: (u) => /^https?:\/\//.test(u) ? u : `https://wa.me/${u.replace(/\D/g, "")}` }
  ];
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  fetch("data/social.json?t=" + Date.now(), { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : {})).catch(() => ({}))
    .then((s) => {
      const html = NETS.filter((n) => s[n.key]).map((n) => {
        const u = String(s[n.key]).trim().replace(/^@/, "");
        return `<a class="soc soc-${n.key}" href="${esc(n.url(u))}" target="_blank" rel="noopener" aria-label="${n.label}"><i style="--ic:url(https://cdn.jsdelivr.net/npm/simple-icons@13/icons/${n.icon}.svg)"></i><span>${n.label}</span></a>`;
      }).join("");
      document.querySelectorAll(".social").forEach((el) => { el.innerHTML = html; el.hidden = !html; });
    });
})();
