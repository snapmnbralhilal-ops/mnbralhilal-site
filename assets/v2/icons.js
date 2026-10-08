/* مكتبة أيقونات منبر الهلال (v2) — خط 1.75px، 24×24، Lucide-style
   الاستخدام: ICON('home', { size: 20, cls: 'extra' }) أو <svg class="icon icon-home"><use href="#i2-home"/></svg> */
(function (g) {
  // كل الأيقونات بنفس اللون والسمك والحواف الدائرية — مريحة للعين وموحدة
  const SRC = {
    // تنقل أساسي
    home: 'M3 11.5 12 4l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z',
    ball: '<circle cx="12" cy="12" r="9"/><path d="m12 7 4.3 3.1-1.6 5h-5.4L7.7 10zM12 3v4M3.5 9l4.2 1M20.5 9l-4.2 1M8 20l1.3-4M16 20l-1.3-4"/>',
    play: '<circle cx="12" cy="12" r="9"/><path d="m10 8.5 6 3.5-6 3.5z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    news: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 8h10M7 12h10M7 16h6"/>',
    // المحتوى
    trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
    cal: '<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/>',
    bolt: '<path d="M13 2 4 14h7l-1 8 10-12h-7l1-8z"/>',
    star: '<path d="m12 3 2.6 5.6L21 9.5l-4.5 4.4 1 6.1L12 17.3l-5.5 2.7 1-6.1L3 9.5l6.4-.9z"/>',
    img: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-4.5-4.5L5 22"/>',
    video: '<rect x="2" y="5" width="16" height="14" rx="2"/><path d="m22 7-5 4 5 4z"/>',
    chart: '<path d="M3 21V3M21 21H3M8 17v-5M12 17V8M16 17v-9"/>',
    users: '<circle cx="9" cy="8" r="4"/><path d="M3 21a6 6 0 0 1 12 0M18 11a3 3 0 1 0 0-6M21 21a4 4 0 0 0-4-4"/>',
    history: '<path d="M3 12a9 9 0 1 0 2.8-6.5L3 8"/><path d="M3 3v5h5M12 7v5l3.5 2"/>',
    whistle: '<circle cx="16" cy="12" r="5"/><path d="M11 11 4 7v4h7M16 10v4"/>',
    // أزرار وأحوال
    bell: '<path d="M6 10a6 6 0 1 1 12 0v4l2 3H4l2-3z"/><path d="M10 20a2 2 0 0 0 4 0"/>',
    bellOff: '<path d="M3 3l18 18M10 20a2 2 0 0 0 4 0M6 10a6 6 0 0 1 10-4.5M18 10v4l2 3H8"/>',
    share: '<circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="m8.6 10.5 6.8-4M8.6 13.5l6.8 4"/>',
    download: '<path d="M12 3v12M7 11l5 5 5-5M4 21h16"/>',
    heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    arrow: '<path d="m14 6-6 6 6 6"/>',
    chevron: '<path d="m9 6 6 6-6 6"/>',
    close: '<path d="M6 6l12 12M18 6 6 18"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/>',
    pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
    tv: '<rect x="3" y="6" width="18" height="12" rx="2"/><path d="m8 21 4-3 4 3"/>',
    mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/>',
    live: '<circle cx="12" cy="12" r="3"/><path d="M8 8a6 6 0 0 0 0 8M16 8a6 6 0 0 1 0 8M5 5a10 10 0 0 0 0 14M19 5a10 10 0 0 1 0 14"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3h.1a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z"/>',
    menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
    check: '<path d="m5 12 4 4 10-10"/>',
    ext: '<path d="M14 4h6v6M10 14 20 4M19 13v6a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h6"/>'
  };

  function sprite() {
    const parts = Object.entries(SRC).map(([k, p]) =>
      `<symbol id="i2-${k}" viewBox="0 0 24 24">${p.startsWith('<') ? p : `<path d="${p}"/>`}</symbol>`);
    return `<svg width="0" height="0" style="position:absolute" aria-hidden="true">${parts.join('')}</svg>`;
  }

  const api = {
    inject() {
      if (document.getElementById('i2-sprite')) return;
      const d = document.createElement('div');
      d.id = 'i2-sprite'; d.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
      d.innerHTML = sprite();
      document.body.insertBefore(d, document.body.firstChild);
    },
    html(name, { size = 20, cls = '' } = {}) {
      return `<svg class="icon ${cls}" width="${size}" height="${size}" aria-hidden="true"><use href="#i2-${name}"/></svg>`;
    },
    keys: Object.keys(SRC)
  };
  g.ICON = api;
  g.icon = api.html; // اختصار
})(window);
