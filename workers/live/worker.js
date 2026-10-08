/* منبر الهلال — عامل التحديث المباشر (Cloudflare Worker)
   - كل دقيقة يشيك جدول مباريات الهلال (من ملفات الموقع نفسه، بدون أي طلب API).
   - وقت المباراة فقط يسحب النتيجة من API-Football كل LIVE_INTERVAL ثانية ويحفظها.
   - الموقع يقرأ النتيجة من  /live  — مهما كان عدد الزوار، طلبات API ما تزيد. */

const HILAL = 2932;
const TZ = "Asia/Riyadh";
const PRE = 5 * 60e3;          // يبدأ قبل المباراة بـ5 دقائق
const POST = 150 * 60e3;       // ويستمر لين 150 دقيقة بعد البداية (أشواط إضافية/تأخير)
const LIVE = ["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP"];
const DONE = ["FT", "AET", "PEN", "AWD", "WO", "CANC", "ABD", "PST"];

const json = (obj, maxAge = 10) => new Response(JSON.stringify(obj), {
  headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", "cache-control": `public, max-age=${maxAge}` }
});

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/live") {
      const live = await env.KV.get("live", "json");
      return json(live || { status: "idle" }, 10);
    }
    if (url.pathname === "/health") {
      if (url.searchParams.has("refresh")) await schedule(env, true);
      const [sched, usage, beat] = await Promise.all([env.KV.get("sched", "json"), env.KV.get("usage:" + today(), "json"), env.KV.get("beat")]);
      return json({ ok: true, interval: +env.LIVE_INTERVAL, lastCron: beat ? new Date(+beat).toISOString() : null,
        scheduleAt: sched?.at ? new Date(sched.at).toISOString() : null, schedule: sched?.matches || [], scheduleErrors: sched?.errors || [],
        requestsToday: usage?.n || 0 }, 0);
    }
    return json({ name: "mnbr-live", endpoints: ["/live", "/health"] }, 60);
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(tick(env));
  }
};

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

/* جدول مباريات الهلال من ملفات الموقع — يتجدد كل 20 دقيقة */
async function schedule(env, force = false) {
  const cached = await env.KV.get("sched", "json");
  // لو آخر محاولة فشلت أو ما لقت شي، نعيد المحاولة بعد 3 دقائق بدل 20
  const ttl = cached && cached.matches?.length && !cached.errors?.length ? 20 * 60e3 : 3 * 60e3;
  if (!force && cached && Date.now() - cached.at < ttl) return cached.matches;
  const matches = [], errors = [];
  const get = async (path) => {
    const r = await fetch(`${env.SITE}/${path}?t=${Date.now()}`, { headers: { "user-agent": "mnbr-live/1.0" }, cf: { cacheTtl: 0 } });
    if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
    return r.json();
  };
  try {
    const site = await get("data/site.json");
    for (const m of site?.hilal?.upcoming || []) matches.push({ id: m.id || null, date: m.date });
  } catch (e) { errors.push(String(e.message || e)); }
  try {
    const d = await get("data/designs.json");
    for (const x of d?.designs || []) if (x.match?.date && (x.match.home === "الهلال" || x.match.away === "الهلال")) matches.push({ id: null, date: x.match.date });
  } catch (e) { errors.push(String(e.message || e)); }
  // بدون تكرار (نفس الموعد)
  const seen = new Set(), uniq = [];
  for (const m of matches) { const k = new Date(m.date).getTime(); if (!seen.has(k)) { seen.add(k); uniq.push(m); } }
  await env.KV.put("sched", JSON.stringify({ at: Date.now(), matches: uniq, errors }));
  return uniq;
}

async function api(env, params) {
  const res = await fetch("https://v3.football.api-sports.io/fixtures?" + new URLSearchParams(params), {
    headers: { "x-apisports-key": env.API_FOOTBALL_KEY }
  });
  const key = "usage:" + today();
  const u = (await env.KV.get(key, "json")) || { n: 0 };
  u.n++; await env.KV.put(key, JSON.stringify(u), { expirationTtl: 3 * 86400 });
  const body = await res.json();
  return Array.isArray(body?.response) ? body.response : [];
}

const isHilal = (f) => f.teams.home.id === HILAL || f.teams.away.id === HILAL;
function slim(f) {
  return {
    id: f.fixture.id, date: f.fixture.date, status: f.fixture.status.short, elapsed: f.fixture.status.elapsed,
    extra: f.fixture.status.extra ?? null,
    league: { id: f.league.id, name: f.league.name, round: f.league.round },
    home: { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo },
    away: { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo },
    goals: [f.goals.home ?? 0, f.goals.away ?? 0],
    events: (f.events || []).filter((e) => e.type === "Goal" || (e.type === "Card" && /Red/.test(e.detail)))
      .map((e) => ({ min: e.time?.elapsed, extra: e.time?.extra, type: e.type, detail: e.detail, team: e.team?.id, player: e.player?.name, assist: e.assist?.name }))
  };
}

async function pollOnce(env, win) {
  const now = Date.now();
  const last = (await env.KV.get("live", "json")) || {};
  const interval = Math.max(10, +env.LIVE_INTERVAL || 180) * 1000;
  if (last.kickoff === win.kickoff && DONE.includes(last.match?.status)) return; // انتهت — ما نصرف طلبات
  if (last.kickoff === win.kickoff && last.fetchedAt && now - last.fetchedAt < interval - 2000) return;

  let fx = (await api(env, { live: "all" })).find(isHilal);
  if (!fx && now - win.kickoff > 100 * 60e3) {
    // ما عادت مباشرة؟ غالباً انتهت — طلب واحد يجيب النتيجة النهائية
    fx = (await api(env, { date: today(), timezone: TZ })).find(isHilal);
  }
  const out = { kickoff: win.kickoff, fetchedAt: now, updated: new Date(now).toISOString() };
  if (fx) { out.status = DONE.includes(fx.fixture.status.short) ? "done" : "live"; out.match = slim(fx); }
  else { out.status = now < win.kickoff + 10 * 60e3 ? "starting" : (last.match ? last.status : "waiting"); if (last.match) out.match = last.match; }
  await env.KV.put("live", JSON.stringify(out));
}

async function tick(env) {
  const now = Date.now();
  await env.KV.put("beat", String(now));
  const matches = await schedule(env);
  const m = matches.map((x) => ({ ...x, kickoff: new Date(x.date).getTime() }))
    .find((x) => now >= x.kickoff - PRE && now <= x.kickoff + POST);
  if (!m) return;
  if (now < m.kickoff) { await env.KV.put("live", JSON.stringify({ status: "pre", kickoff: m.kickoff, updated: new Date().toISOString() })); return; }
  // باقة Pro (فترة أقل من دقيقة): نسحب أكثر من مرة داخل نفس الدقيقة
  const interval = Math.max(10, +env.LIVE_INTERVAL || 180);
  const loops = interval < 60 ? Math.floor(55 / interval) + 1 : 1;
  for (let i = 0; i < loops; i++) {
    if (i) await new Promise((r) => setTimeout(r, interval * 1000));
    await pollOnce(env, m);
  }
}
