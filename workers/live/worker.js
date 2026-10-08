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
      const [sched, usage] = await Promise.all([env.KV.get("sched", "json"), env.KV.get("usage:" + today(), "json")]);
      return json({ ok: true, interval: +env.LIVE_INTERVAL,
        scheduleAt: sched?.at ? new Date(sched.at).toISOString() : null, schedule: sched?.matches || [], scheduleErrors: sched?.errors || [],
        requestsToday: usage?.n || 0 }, 0);
    }
    if (url.pathname.startsWith("/game")) return game(req, env, url);
    return json({ name: "mnbr-live", endpoints: ["/live", "/health", "/game"] }, 60);
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
  // قائمة مباريات الألعاب (التوقعات/التصويت) — نحتفظ بآخر 12
  const games = (await env.KV.get("games", "json")) || [];
  const merged = [...new Set([...games, ...uniq.map((m) => new Date(m.date).getTime())])].sort((a, b) => a - b).slice(-12);
  if (merged.join() !== games.join()) await env.KV.put("games", JSON.stringify(merged));
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
  const matches = await schedule(env);
  const m = matches.map((x) => ({ ...x, kickoff: new Date(x.date).getTime() }))
    .find((x) => now >= x.kickoff - PRE && now <= x.kickoff + POST);
  if (!m) return;
  if (now < m.kickoff) {
    const cur = await env.KV.get("live", "json");
    if (!(cur && cur.kickoff === m.kickoff)) await env.KV.put("live", JSON.stringify({ status: "pre", kickoff: m.kickoff, updated: new Date().toISOString() }));
    return;
  }
  // باقة Pro (فترة أقل من دقيقة): نسحب أكثر من مرة داخل نفس الدقيقة
  const interval = Math.max(10, +env.LIVE_INTERVAL || 180);
  const loops = interval < 60 ? Math.floor(55 / interval) + 1 : 1;
  for (let i = 0; i < loops; i++) {
    if (i) await new Promise((r) => setTimeout(r, interval * 1000));
    await pollOnce(env, m);
  }
}


/* ============================================================
   ألعاب الجمهور: توقّع النتيجة + رجل المباراة
   كل مباراة لها Durable Object خاص (مفتاحه موعد البداية)
   ============================================================ */
const VOTE_OPEN = 105 * 60e3;   // التصويت يفتح بعد 105 دقيقة من البداية (أو أول ما تنتهي)
const GAME_DAY = 24 * 3600e3;   // المباراة تبقى "الحالية" 24 ساعة بعد بدايتها

const noStore = (obj, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { "content-type": "application/json; charset=utf-8", "access-control-allow-origin": "*", "cache-control": "no-store" }
});

async function currentGame(env) {
  const now = Date.now();
  let games = (await env.KV.get("games", "json")) || [];
  if (!games.length) { await schedule(env, true); games = (await env.KV.get("games", "json")) || []; }
  const recent = games.filter((k) => k <= now && now < k + GAME_DAY).pop();
  const next = games.find((k) => k > now);
  return recent ?? next ?? games[games.length - 1] ?? null;
}

async function phaseOf(env, k) {
  const now = Date.now();
  const live = await env.KV.get("live", "json");
  let final = null;
  if (live && live.kickoff === k && live.match) {
    const m = live.match, hilalHome = m.home.id === HILAL;
    final = { hilal: hilalHome ? m.goals[0] : m.goals[1], opp: hilalHome ? m.goals[1] : m.goals[0], done: live.status === "done" };
  }
  let phase;
  if (now < k) phase = "predict";
  else if (final?.done || now >= k + VOTE_OPEN) phase = now < k + GAME_DAY ? "vote" : "closed";
  else phase = "live";
  return { phase, final };
}

async function game(req, env, url) {
  if (req.method === "OPTIONS") return new Response(null, { headers: { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST", "access-control-allow-headers": "content-type" } });
  const k = await currentGame(env);
  if (!k) return noStore({ status: "none" });
  const { phase, final } = await phaseOf(env, k);
  const stub = env.GAME.get(env.GAME.idFromName(String(k)));
  const d = (url.searchParams.get("d") || "").slice(0, 40);

  if (req.method === "GET") {
    const st = await (await stub.fetch(`https://g/state?d=${encodeURIComponent(d)}`)).json();
    const out = { kickoff: k, phase, final, ...st };
    if (final?.done && st.exact) out.exactCount = st.exact[`${final.hilal}-${final.opp}`] || 0;
    if (final?.done) out.outcomeCount = final.hilal > final.opp ? st.agg.w : final.hilal < final.opp ? st.agg.l : st.agg.d;
    return noStore(out);
  }
  if (req.method !== "POST") return noStore({ error: "method" }, 405);

  let body = {};
  try { body = JSON.parse(await req.text()); } catch (e) { return noStore({ error: "bad-json" }, 400); }
  if (body.k && +body.k !== k) return noStore({ error: "match-changed" }, 409);
  const ip = req.headers.get("cf-connecting-ip") || "";
  const ipHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip + "mnbr")))).slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");

  if (url.pathname === "/game/predict") {
    if (phase !== "predict") return noStore({ error: "closed", phase }, 403);
  } else if (url.pathname === "/game/vote") {
    if (phase !== "vote") return noStore({ error: phase === "closed" ? "closed" : "not-open", phase }, 403);
  } else return noStore({ error: "not-found" }, 404);

  const r = await stub.fetch(`https://g${url.pathname.replace("/game", "")}`, { method: "POST", body: JSON.stringify({ ...body, ip: ipHash }) });
  return noStore(await r.json(), r.status);
}

const emptyAgg = () => ({ n: 0, w: 0, d: 0, l: 0, sc: {}, st: {} });
const outcomeKey = (h, o) => (h > o ? "w" : h < o ? "l" : "d");
const inc = (obj, key, by) => { obj[key] = (obj[key] || 0) + by; if (obj[key] <= 0) delete obj[key]; };
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

export class Game {
  constructor(ctx) { this.s = ctx.storage; }

  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/state") {
      const d = url.searchParams.get("d");
      const [agg, vagg, mp, mv] = await Promise.all([
        this.s.get("agg"), this.s.get("vagg"), d ? this.s.get("p:" + d) : null, d ? this.s.get("v:" + d) : null
      ]);
      const a = agg || emptyAgg();
      const topScores = Object.entries(a.sc).sort((x, y) => y[1] - x[1]).slice(0, 5);
      const topScorers = Object.entries(a.st).sort((x, y) => y[1] - x[1]).slice(0, 6);
      const v = vagg || { n: 0, p: {} };
      const topVotes = Object.entries(v.p).sort((x, y) => y[1] - x[1]).slice(0, 8);
      return Response.json({ agg: { n: a.n, w: a.w, d: a.d, l: a.l }, topScores, topScorers, exact: a.sc,
        votes: { n: v.n, top: topVotes }, mine: { pred: mp || null, vote: mv ?? null } });
    }

    const b = await req.json();
    const d = String(b.d || "").slice(0, 40);
    if (d.length < 8) return Response.json({ error: "device" }, { status: 400 });
    // حد بسيط لكل شبكة: 40 عملية لكل مباراة
    const ipk = "ip:" + b.ip, ipn = (await this.s.get(ipk)) || 0;
    if (ipn >= 40) return Response.json({ error: "limit" }, { status: 429 });

    if (url.pathname === "/predict") {
      const h = +b.h, o = +b.o, st = +b.s || 0;
      if (!int(h, 0, 15) || !int(o, 0, 15) || !int(st, -1, 99)) return Response.json({ error: "values" }, { status: 400 });
      const agg = (await this.s.get("agg")) || emptyAgg();
      const old = await this.s.get("p:" + d);
      if (old) { agg.n--; agg[outcomeKey(old.h, old.o)]--; inc(agg.sc, `${old.h}-${old.o}`, -1); if (old.s > 0) inc(agg.st, old.s, -1); }
      const p = { h, o, s: st, t: Date.now() };
      agg.n++; agg[outcomeKey(h, o)]++; inc(agg.sc, `${h}-${o}`, 1); if (st > 0) inc(agg.st, st, 1);
      await this.s.put({ agg, ["p:" + d]: p, [ipk]: ipn + 1 });
      return Response.json({ ok: true, pred: p });
    }
    if (url.pathname === "/vote") {
      const pl = +b.p;
      if (!int(pl, 1, 99)) return Response.json({ error: "values" }, { status: 400 });
      const v = (await this.s.get("vagg")) || { n: 0, p: {} };
      const old = await this.s.get("v:" + d);
      if (old) { v.n--; inc(v.p, old, -1); }
      v.n++; inc(v.p, pl, 1);
      await this.s.put({ vagg: v, ["v:" + d]: pl, [ipk]: ipn + 1 });
      return Response.json({ ok: true, vote: pl });
    }
    return Response.json({ error: "not-found" }, { status: 404 });
  }
}
