/* صفحة الفيديو — تقرأ data/videos.json وتعرض فيديوهات تيك توك */
(function () {
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const cleanUser = (u) => String(u || "").trim().replace(/^https?:\/\/(www\.)?tiktok\.com\//, "").replace(/^@/, "").replace(/[/?].*$/, "");
  const videoId = (url) => (String(url).match(/\/video\/(\d+)/) || [])[1];

  function videoEmbed(v) {
    const url = typeof v === "string" ? v : v.url;
    const id = videoId(url);
    if (!id) return "";
    const title = typeof v === "object" && v.title ? `<div class="v-title">${esc(v.title)}</div>` : "";
    return `<div class="v-card">${title}<blockquote class="tiktok-embed" cite="${esc(url)}" data-video-id="${id}" style="max-width:605px;min-width:288px;margin:0"><section><a target="_blank" rel="noopener" href="${esc(url)}">مشاهدة على تيك توك</a></section></blockquote></div>`;
  }

  // سكربت تيك توك يحوّل كل الروابط (حتى اللي بالتبويب المخفي) لمشغّلات — نحمّله مرة وحدة بس
  function loadTikTok() {
    if (document.getElementById("tt-embed")) return;
    const s = document.createElement("script");
    s.id = "tt-embed"; s.async = true; s.src = "https://www.tiktok.com/embed.js";
    document.body.appendChild(s);
  }

  function render(d) {
    const user = cleanUser(d.tiktok_user);
    const featured = (d.featured || []).map(videoEmbed).filter(Boolean);
    const clips = (d.clips || []).map(videoEmbed).filter(Boolean);

    $("vFeatured").innerHTML = featured.join("");
    $("vFeatured").hidden = !featured.length;
    if (user) {
      $("vProfileBox").hidden = false;
      $("vFollow").href = `https://www.tiktok.com/@${encodeURIComponent(user)}`;
      $("vOpen").href = `https://www.tiktok.com/@${encodeURIComponent(user)}`;
      $("vOpenUser").textContent = "@" + user;
      $("vProfile").innerHTML = `<blockquote class="tiktok-embed" cite="https://www.tiktok.com/@${esc(user)}" data-unique-id="${esc(user)}" data-embed-type="creator" style="max-width:780px;min-width:288px;margin:0 auto"><section><a target="_blank" rel="noopener" href="https://www.tiktok.com/@${esc(user)}?refer=creator_embed">@${esc(user)}</a></section></blockquote>`;
    }
    $("vEmpty").hidden = !!(user || featured.length);
    $("vClips").innerHTML = clips.join("");
    $("vClipsEmpty").hidden = !!clips.length;
    if (user || featured.length || clips.length) loadTikTok();
  }

  document.querySelectorAll("#vTabs button").forEach((b) => b.addEventListener("click", () => {
    document.querySelectorAll("#vTabs button").forEach((x) => x.setAttribute("aria-selected", x === b));
    $("tab-mnbr").hidden = b.dataset.tab !== "mnbr";
    $("tab-clips").hidden = b.dataset.tab !== "clips";
  }));
  if (location.hash === "#clips") document.querySelector('#vTabs [data-tab="clips"]').click();

  fetch("data/videos.json?t=" + Date.now(), { cache: "no-store" })
    .then((r) => (r.ok ? r.json() : {}))
    .catch(() => ({}))
    .then(render);
})();
