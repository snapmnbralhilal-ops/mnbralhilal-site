/* منبر الهلال — خادم Cloudflare
   1) التحديث المباشر وقت مباريات الهلال            /live  /health
   2) ألعاب الجمهور: توقّع، رجل المباراة، تشكيلة الجمهور   /game
   3) دوري التوقعات (نقاط + ترتيب)                  /league
   4) تنبيهات الجوال (Web Push)                       /push
   5) لوحة تحكم منبر (ترفع لـ GitHub)                 /admin
   الحفظ: KV للحالة المباشرة، وDurable Objects للألعاب والدوري والتنبيهات (ما عليها حد الكتابة اليومي حق KV). */

const HILAL = 2932;
const TZ = "Asia/Riyadh";
const PRE = 5 * 60e3;          // يبدأ السحب قبل المباراة بـ5 دقائق
const POST = 150 * 60e3;       // ويستمر لين 150 دقيقة بعد البداية
const VOTE_OPEN = 105 * 60e3;  // التصويت يفتح بعد 105 دقيقة (أو أول ما تنتهي)
const GAME_DAY = 24 * 3600e3;  // المباراة تبقى "الحالية" 24 ساعة
const DONE = ["FT", "AET", "PEN", "AWD", "WO", "CANC", "ABD", "PST"];
const REPO = "snapmnbralhilal-ops/mnbralhilal-site";

const FORMS = {
  "4-3-3": "GDDDDMMMFFF", "4-2-3-1": "GDDDDMMMMMF", "4-4-2": "GDDDDMMMMFF", "3-5-2": "GDDDMMMMMFF", "3-4-3": "GDDDMMMMFFF"
};

const CORS = { "access-control-allow-origin": "*", "access-control-allow-methods": "GET,POST,OPTIONS", "access-control-allow-headers": "content-type,x-admin" };
const json = (obj, maxAge = 10, status = 200) => new Response(JSON.stringify(obj), {
  status, headers: { "content-type": "application/json; charset=utf-8", ...CORS, "cache-control": maxAge ? `public, max-age=${maxAge}` : "no-store" }
});
const noStore = (obj, status = 200) => json(obj, 0, status);

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    try {
      if (url.pathname === "/live") return json((await env.KV.get("live", "json")) || { status: "idle" }, 10);
      if (url.pathname === "/health") {
        if (url.searchParams.has("refresh")) await schedule(env, true);
        const [sched, usage] = await Promise.all([env.KV.get("sched", "json"), env.KV.get("usage:" + today(), "json")]);
        return noStore({ ok: true, interval: +env.LIVE_INTERVAL, scheduleAt: sched?.at ? new Date(sched.at).toISOString() : null,
          schedule: sched?.matches || [], scheduleErrors: sched?.errors || [], requestsToday: usage?.n || 0, admin: !!env.GH_TOKEN });
      }
      if (url.pathname.startsWith("/game")) return await game(req, env, url);
      if (url.pathname.startsWith("/league")) return await league(req, env, url);
      if (url.pathname.startsWith("/push")) return await pushRoute(req, env, url);
      if (url.pathname.startsWith("/admin")) return await admin(req, env, url);
      return json({ name: "mnbr-live", endpoints: ["/live", "/health", "/game", "/league", "/push", "/admin"] }, 60);
    } catch (e) {
      return noStore({ error: "server", detail: String(e && e.message || e) }, 500);
    }
  },
  async scheduled(event, env, ctx) {
    ctx.waitUntil(tick(env));
  }
};

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
async function site(env, path) {
  const r = await fetch(`${env.SITE}/${path}?t=${Date.now()}`, { headers: { "user-agent": "mnbr-live/1.0" }, cf: { cacheTtl: 0 } });
  if (!r.ok) throw new Error(`${path}: HTTP ${r.status}`);
  return r.json();
}

/* ============ جدول مباريات الهلال (من ملفات الموقع) ============ */
async function schedule(env, force = false) {
  const cached = await env.KV.get("sched", "json");
  const ttl = cached && cached.matches?.length && !cached.errors?.length ? 20 * 60e3 : 3 * 60e3;
  if (!force && cached && Date.now() - cached.at < ttl) return cached.matches;
  const matches = [], errors = [];
  try {
    const d = await site(env, "data/designs.json");
    for (const x of d?.designs || []) if (x.match?.date && (x.match.home === "الهلال" || x.match.away === "الهلال"))
      matches.push({ date: x.match.date, home: x.match.home, away: x.match.away });
  } catch (e) { errors.push(String(e.message || e)); }
  try {
    const s = await site(env, "data/site.json");
    for (const m of s?.hilal?.upcoming || []) matches.push({ date: m.date, home: m.home?.id === HILAL ? "الهلال" : null, away: m.away?.id === HILAL ? "الهلال" : null });
  } catch (e) { errors.push(String(e.message || e)); }
  // لو تعذّر جلب ملفات الموقع نحتفظ بالجدول السابق بدل ما يفضى
  if (errors.length && cached?.matches?.length) matches.push(...cached.matches);
  const seen = new Set(), uniq = [];
  for (const m of matches) { const k = new Date(m.date).getTime(); if (!seen.has(k)) { seen.add(k); uniq.push({ ...m, home: m.home || "الهلال", away: m.away || "الخصم" }); } }
  const prev = JSON.stringify(cached?.matches || []) + JSON.stringify(cached?.errors || []);
  // نكتب في KV بس لو تغيّر شي أو مرّت 6 ساعات (حد KV المجاني 1000 كتابة باليوم)
  if (!cached || prev !== JSON.stringify(uniq) + JSON.stringify(errors) || Date.now() - cached.at > 6 * 3600e3)
    await env.KV.put("sched", JSON.stringify({ at: Date.now(), matches: uniq, errors }));
  const games = (await env.KV.get("games", "json")) || [];
  const merged = [...new Set([...games, ...uniq.map((m) => new Date(m.date).getTime())])].sort((a, b) => a - b).slice(-12);
  if (merged.join() !== games.join()) await env.KV.put("games", JSON.stringify(merged));
  return uniq;
}

/* ============ التحديث المباشر ============ */
async function api(env, params) {
  const res = await fetch("https://v3.football.api-sports.io/fixtures?" + new URLSearchParams(params), { headers: { "x-apisports-key": env.API_FOOTBALL_KEY } });
  const key = "usage:" + today();
  const u = (await env.KV.get(key, "json")) || { n: 0 };
  u.n++; await env.KV.put(key, JSON.stringify(u), { expirationTtl: 3 * 86400 });
  const body = await res.json();
  return Array.isArray(body?.response) ? body.response : [];
}
const isHilal = (f) => f.teams.home.id === HILAL || f.teams.away.id === HILAL;
function slim(f) {
  return {
    id: f.fixture.id, date: f.fixture.date, status: f.fixture.status.short, elapsed: f.fixture.status.elapsed, extra: f.fixture.status.extra ?? null,
    league: { id: f.league.id, name: f.league.name, round: f.league.round },
    home: { id: f.teams.home.id, name: f.teams.home.name, logo: f.teams.home.logo },
    away: { id: f.teams.away.id, name: f.teams.away.name, logo: f.teams.away.logo },
    goals: [f.goals.home ?? 0, f.goals.away ?? 0],
    events: (f.events || []).filter((e) => e.type === "Goal" || (e.type === "Card" && /Red/.test(e.detail)))
      .map((e) => ({ min: e.time?.elapsed, extra: e.time?.extra, type: e.type, detail: e.detail, team: e.team?.id, player: e.player?.name, assist: e.assist?.name }))
  };
}
const hilalGoals = (m) => (m ? (m.home.id === HILAL ? m.goals[0] : m.goals[1]) : 0);
const oppGoals = (m) => (m ? (m.home.id === HILAL ? m.goals[1] : m.goals[0]) : 0);

async function pollOnce(env, win) {
  const now = Date.now();
  const last = (await env.KV.get("live", "json")) || {};
  const interval = Math.max(10, +env.LIVE_INTERVAL || 180) * 1000;
  if (last.kickoff === win.kickoff && DONE.includes(last.match?.status)) return;
  if (last.kickoff === win.kickoff && last.fetchedAt && now - last.fetchedAt < interval - 2000) return;

  let fx = (await api(env, { live: "all" })).find(isHilal);
  if (!fx && now - win.kickoff > 100 * 60e3) fx = (await api(env, { date: today(), timezone: TZ })).find(isHilal);
  const out = { kickoff: win.kickoff, fetchedAt: now, updated: new Date(now).toISOString() };
  const prev = last.kickoff === win.kickoff ? last.match : null;
  if (fx) {
    out.match = slim(fx);
    if (!out.match.events.length && prev?.events?.length) out.match.events = prev.events;
    out.status = DONE.includes(fx.fixture.status.short) ? "done" : "live";
  } else { out.status = now < win.kickoff + 10 * 60e3 ? "starting" : (prev ? last.status : "waiting"); if (prev) out.match = prev; }
  await env.KV.put("live", JSON.stringify(out));

  // تنبيهات: هدف للهلال، ونهاية المباراة
  const opp = win.home === "الهلال" ? win.away : win.home;
  if (out.match) {
    const hg = hilalGoals(out.match), og = oppGoals(out.match), was = prev ? hilalGoals(prev) : 0;
    if (hg > was) {
      const g = out.match.events.filter((e) => e.type === "Goal" && e.team === HILAL && e.detail !== "Missed Penalty").pop();
      const who = g?.player ? await arName(env, g.player) : "";
      await notify(env, `goal:${win.kickoff}:${hg}`, "⚽ هدف للهلال!", `${who ? who + (g.min ? " " + g.min + "'" : "") + " — " : ""}الهلال ${hg}-${og} ${opp}`, "matchday.html");
    }
    if (out.status === "done" && !(prev && DONE.includes(prev.status)))
      await notify(env, `ft:${win.kickoff}`, hg > og ? "💙 فاز الهلال!" : "انتهت المباراة", `الهلال ${hg}-${og} ${opp} — صوّت لرجل المباراة الحين ⭐`, "play.html#vote");
  }
}

async function tick(env) {
  const now = Date.now();
  const matches = (await schedule(env)).map((x) => ({ ...x, kickoff: new Date(x.date).getTime() }));
  // تنبيه قبل المباراة بساعة
  for (const m of matches) if (now >= m.kickoff - 62 * 60e3 && now < m.kickoff - 50 * 60e3) {
    const opp = m.home === "الهلال" ? m.away : m.home;
    await notify(env, `pre:${m.kickoff}`, "⏰ باقي ساعة على المباراة", `الهلال × ${opp} — توقّع النتيجة قبل لا يقفل 🎯`, "play.html#predict");
  }
  const m = matches.find((x) => now >= x.kickoff - PRE && now <= x.kickoff + POST);
  if (!m) return;
  if (now < m.kickoff) {
    const cur = await env.KV.get("live", "json");
    if (!(cur && cur.kickoff === m.kickoff)) await env.KV.put("live", JSON.stringify({ status: "pre", kickoff: m.kickoff, updated: new Date().toISOString() }));
    return;
  }
  const interval = Math.max(10, +env.LIVE_INTERVAL || 180);
  const loops = interval < 60 ? Math.floor(55 / interval) + 1 : 1;
  for (let i = 0; i < loops; i++) {
    if (i) await new Promise((r) => setTimeout(r, interval * 1000));
    await pollOnce(env, m);
  }
  await settle(env, m.kickoff);
}

/* ============ احتساب نقاط دوري التوقعات ============ */
async function settle(env, k) {
  const live = await env.KV.get("live", "json");
  if (!(live && live.kickoff === k && live.status === "done" && live.match)) return;
  const lg = env.LEAGUE.get(env.LEAGUE.idFromName("league"));
  if ((await (await lg.fetch(`https://l/settled?k=${k}`)).json()).settled) return;
  const hg = hilalGoals(live.match), og = oppGoals(live.match);
  let first = hg === 0 ? -1 : null;
  if (hg > 0) {
    try {
      const sq = (await site(env, "data/squad.json"))?.players || [];
      const g = live.match.events.find((e) => e.type === "Goal" && e.team === HILAL && !/Own Goal|Missed/.test(e.detail || ""));
      if (g?.player) {
        const p = matchPlayer(sq, g.player);
        first = p ? p.id : 0;
      }
    } catch (e) {}
  }
  const gm = env.GAME.get(env.GAME.idFromName(String(k)));
  const preds = await (await gm.fetch("https://g/all")).json();
  await lg.fetch("https://l/settle", { method: "POST", body: JSON.stringify({ k, hilal: hg, opp: og, first, preds }) });
}

/* يطابق اسم اللاعب الإنجليزي من API-Football مع قائمة الفريق (بالاسم الأخير) */
const fold = (x) => String(x || "").toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
function matchPlayer(sq, name) {
  const nm = fold(name);
  return nm ? sq.find((x) => x.en && nm.includes(fold(x.en).replace(/^al-/, "").split(" ").pop())) : null;
}
async function arName(env, name) {
  try { const p = matchPlayer((await site(env, "data/squad.json"))?.players || [], name); return (p && (p.short || p.name)) || name; } catch (e) { return name; }
}

/* ============ الألعاب ============ */
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
  if (live && live.kickoff === k && live.match) final = { hilal: hilalGoals(live.match), opp: oppGoals(live.match), done: live.status === "done" };
  let phase;
  if (now < k) phase = "predict";
  else if (final?.done || now >= k + VOTE_OPEN) phase = now < k + GAME_DAY ? "vote" : "closed";
  else phase = "live";
  return { phase, final };
}
async function ipHash(req) {
  const ip = req.headers.get("cf-connecting-ip") || "";
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(ip + "mnbr")))).slice(0, 8).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function game(req, env, url) {
  const k = await currentGame(env);
  if (!k) return noStore({ status: "none" });
  const { phase, final } = await phaseOf(env, k);
  const stub = env.GAME.get(env.GAME.idFromName(String(k)));
  const d = (url.searchParams.get("d") || "").slice(0, 40);
  if (req.method === "GET") {
    const st = await (await stub.fetch(`https://g/state?d=${encodeURIComponent(d)}`)).json();
    const out = { kickoff: k, phase, final, ...st };
    if (final?.done) {
      out.exactCount = st.exact?.[`${final.hilal}-${final.opp}`] || 0;
      out.outcomeCount = final.hilal > final.opp ? st.agg.w : final.hilal < final.opp ? st.agg.l : st.agg.d;
    }
    delete out.exact;
    return noStore(out);
  }
  if (req.method !== "POST") return noStore({ error: "method" }, 405);
  let body = {};
  try { body = JSON.parse(await req.text()); } catch (e) { return noStore({ error: "bad-json" }, 400); }
  if (body.k && +body.k !== k) return noStore({ error: "match-changed" }, 409);
  const path = url.pathname.replace("/game", "");
  if (!["/predict", "/vote", "/lineup"].includes(path)) return noStore({ error: "not-found" }, 404);
  if ((path === "/predict" || path === "/lineup") && phase !== "predict") return noStore({ error: "closed", phase }, 403);
  if (path === "/vote" && phase !== "vote") return noStore({ error: phase === "closed" ? "closed" : "not-open", phase }, 403);
  const r = await stub.fetch(`https://g${path}`, { method: "POST", body: JSON.stringify({ ...body, ip: await ipHash(req) }) });
  return noStore(await r.json(), r.status);
}

const emptyAgg = () => ({ n: 0, w: 0, d: 0, l: 0, sc: {}, st: {} });
const outcomeKey = (h, o) => (h > o ? "w" : h < o ? "l" : "d");
const inc = (obj, key, by) => { obj[key] = (obj[key] || 0) + by; if (obj[key] <= 0) delete obj[key]; };
const int = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;
const top = (obj, n) => Object.entries(obj || {}).sort((x, y) => y[1] - x[1]).slice(0, n);

export class Game {
  constructor(ctx) { this.s = ctx.storage; }
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/state") {
      const d = url.searchParams.get("d");
      const [agg, vagg, lagg, mp, mv, ml] = await Promise.all([this.s.get("agg"), this.s.get("vagg"), this.s.get("lagg"),
        d ? this.s.get("p:" + d) : null, d ? this.s.get("v:" + d) : null, d ? this.s.get("l:" + d) : null]);
      const a = agg || emptyAgg(), v = vagg || { n: 0, p: {} };
      return Response.json({ agg: { n: a.n, w: a.w, d: a.d, l: a.l }, topScores: top(a.sc, 5), topScorers: top(a.st, 6), exact: a.sc,
        votes: { n: v.n, top: top(v.p, 8) }, crowd: crowdXI(lagg), mine: { pred: mp || null, vote: mv ?? null, lineup: ml || null } });
    }
    if (url.pathname === "/all") {
      const all = await this.s.list({ prefix: "p:" });
      return Response.json([...all].map(([key, p]) => ({ d: key.slice(2), h: p.h, o: p.o, s: p.s })));
    }
    const b = await req.json();
    const d = String(b.d || "").slice(0, 40);
    if (d.length < 8) return Response.json({ error: "device" }, { status: 400 });
    const ipk = "ip:" + b.ip, ipn = (await this.s.get(ipk)) || 0;
    if (ipn >= 60) return Response.json({ error: "limit" }, { status: 429 });

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
    if (url.pathname === "/lineup") {
      const f = String(b.form || ""), xi = Array.isArray(b.xi) ? b.xi.map(Number) : [];
      if (!FORMS[f] || xi.length !== 11 || new Set(xi).size !== 11 || !xi.every((x) => int(x, 1, 99))) return Response.json({ error: "values" }, { status: 400 });
      const L = (await this.s.get("lagg")) || { n: 0, forms: {}, pick: {} };
      const old = await this.s.get("l:" + d);
      const apply = (lu, by) => { inc(L.forms, lu.form, by); lu.xi.forEach((id, i) => inc(L.pick, FORMS[lu.form][i] + ":" + id, by)); };
      if (old) { L.n--; apply(old, -1); }
      const lu = { form: f, xi, t: Date.now() };
      L.n++; apply(lu, 1);
      await this.s.put({ lagg: L, ["l:" + d]: lu, [ipk]: ipn + 1 });
      return Response.json({ ok: true, lineup: lu });
    }
    return Response.json({ error: "not-found" }, { status: 404 });
  }
}
/* التشكيلة الأكثر اختياراً: الخطة الأشهر، وفي كل مركز أكثر اللاعبين اختياراً فيه */
function crowdXI(L) {
  if (!L || !L.n) return { n: 0 };
  const [form, fn] = top(L.forms, 1)[0] || [];
  if (!form) return { n: 0 };
  const used = new Set(), xi = [];
  for (const g of FORMS[form]) {
    const cand = Object.entries(L.pick).filter(([k]) => k[0] === g).map(([k, n]) => [+k.slice(2), n]).sort((a, b) => b[1] - a[1]);
    const pick = cand.find(([id]) => !used.has(id));
    if (pick) { used.add(pick[0]); xi.push({ id: pick[0], g, pct: Math.round((pick[1] / L.n) * 100) }); } else xi.push({ id: 0, g, pct: 0 });
  }
  return { n: L.n, form, formPct: Math.round((fn / L.n) * 100), xi, forms: top(L.forms, 5).map(([f, n]) => [f, Math.round((n / L.n) * 100)]) };
}

/* ============ دوري التوقعات ============ */
async function league(req, env, url) {
  const lg = env.LEAGUE.get(env.LEAGUE.idFromName("league"));
  if (req.method === "GET") return noStore(await (await lg.fetch(`https://l/board?d=${encodeURIComponent(url.searchParams.get("d") || "")}`)).json());
  if (url.pathname === "/league/nick" && req.method === "POST") {
    let body = {}; try { body = JSON.parse(await req.text()); } catch (e) {}
    const r = await lg.fetch("https://l/nick", { method: "POST", body: JSON.stringify({ d: body.d, nick: body.nick }) });
    return noStore(await r.json(), r.status);
  }
  return noStore({ error: "not-found" }, 404);
}
const BAD = /(كس|زب|شرموط|قحب|منيوك|نيك|fuck|shit|sex)/i;
const newUser = () => ({ pts: 0, played: 0, exact: 0, out: 0, sc: 0 });

export class League {
  constructor(ctx) { this.s = ctx.storage; }
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/settled") return Response.json({ settled: !!(await this.s.get("settled:" + url.searchParams.get("k"))) });
    if (url.pathname === "/board") {
      const d = url.searchParams.get("d");
      const board = (await this.s.get("board")) || [];
      const me = d ? await this.s.get("u:" + d) : null;
      const rank = me?.nick ? (board.findIndex((x) => x.nick === me.nick) + 1 || null) : null;
      return Response.json({ top: board.slice(0, 50), players: board.length, matches: (await this.s.get("matches")) || 0, me: me ? { ...me, rank } : null });
    }
    const b = await req.json();
    if (url.pathname === "/nick") {
      const d = String(b.d || "").slice(0, 40);
      const nick = String(b.nick || "").trim().replace(/\s+/g, " ");
      if (d.length < 8) return Response.json({ error: "device" }, { status: 400 });
      if (nick.length < 2 || nick.length > 18 || !/^[\p{L}\p{N} _.\-]+$/u.test(nick) || BAD.test(nick)) return Response.json({ error: "nick-invalid" }, { status: 400 });
      const key = "nick:" + nick.toLowerCase();
      const owner = await this.s.get(key);
      if (owner && owner !== d) return Response.json({ error: "nick-taken" }, { status: 409 });
      const u = (await this.s.get("u:" + d)) || newUser();
      if (u.nick && u.nick.toLowerCase() !== nick.toLowerCase()) await this.s.delete("nick:" + u.nick.toLowerCase());
      u.nick = nick;
      await this.s.put({ ["u:" + d]: u, [key]: d });
      await this.rebuild();
      return Response.json({ ok: true, me: u });
    }
    if (url.pathname === "/settle") {
      if (await this.s.get("settled:" + b.k)) return Response.json({ ok: true, already: true });
      const out = Math.sign(b.hilal - b.opp);
      let writes = {};
      for (const p of b.preds || []) {
        const u = (await this.s.get("u:" + p.d)) || newUser();
        let pts = 0;
        if (p.h === b.hilal && p.o === b.opp) { pts += 3; u.exact++; }
        else if (Math.sign(p.h - p.o) === out) { pts += 1; u.out++; }
        if ((p.s > 0 && p.s === b.first) || (p.s === -1 && b.hilal === 0)) { pts += 1; u.sc++; }
        u.pts += pts; u.played++; u.last = { k: b.k, pts };
        writes["u:" + p.d] = u;
        if (Object.keys(writes).length >= 100) { await this.s.put(writes); writes = {}; }
      }
      writes["settled:" + b.k] = { at: Date.now(), hilal: b.hilal, opp: b.opp, first: b.first, n: (b.preds || []).length };
      writes.matches = ((await this.s.get("matches")) || 0) + 1;
      await this.s.put(writes);
      await this.rebuild();
      return Response.json({ ok: true });
    }
    return Response.json({ error: "not-found" }, { status: 404 });
  }
  async rebuild() {
    const all = await this.s.list({ prefix: "u:" });
    const board = [...all.values()].filter((u) => u.nick && u.played > 0)
      .sort((a, b) => b.pts - a.pts || b.exact - a.exact || b.played - a.played)
      .map((u) => ({ nick: u.nick, pts: u.pts, played: u.played, exact: u.exact }));
    await this.s.put("board", board);
  }
}

/* ============ تنبيهات الجوال (Web Push) ============ */
async function notify(env, key, title, body, path) {
  const p = env.PUSH.get(env.PUSH.idFromName("push"));
  await p.fetch("https://p/notify", { method: "POST", body: JSON.stringify({ key, title, body, url: `${env.SITE}/${path || ""}` }) });
}
async function pushRoute(req, env, url) {
  const p = env.PUSH.get(env.PUSH.idFromName("push"));
  if (url.pathname === "/push/key") return json(await (await p.fetch("https://p/key")).json(), 3600);
  if (req.method !== "POST") return noStore({ error: "method" }, 405);
  if (url.pathname === "/push/sub" || url.pathname === "/push/unsub") {
    const r = await p.fetch("https://p" + url.pathname.replace("/push", ""), { method: "POST", body: await req.text() });
    return noStore(await r.json(), r.status);
  }
  if (url.pathname === "/push/test") {
    if (!(await isAdmin(req, env))) return noStore({ error: "auth" }, 401);
    const b = JSON.parse((await req.text()) || "{}");
    await notify(env, "test:" + Date.now(), b.title || "منبر الهلال 💙", b.body || "التنبيهات شغالة ✅", b.path || "");
    return noStore({ ok: true });
  }
  return noStore({ error: "not-found" }, 404);
}
const te = new TextEncoder();
const b64u = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
const concat = (...a) => { const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let i = 0; for (const x of a) { out.set(x, i); i += x.length; } return out; };
async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, len * 8));
}

export class Push {
  constructor(ctx) { this.s = ctx.storage; }
  async vapid() {
    let v = await this.s.get("vapid");
    if (!v) {
      const kp = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, ["sign", "verify"]);
      v = { priv: await crypto.subtle.exportKey("jwk", kp.privateKey), pub: b64u(await crypto.subtle.exportKey("raw", kp.publicKey)) };
      await this.s.put("vapid", v);
    }
    return v;
  }
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/key") return Response.json({ key: (await this.vapid()).pub });
    const b = await req.json();
    if (url.pathname === "/sub" || url.pathname === "/unsub") {
      const sub = b.sub || b;
      if (!sub?.endpoint || !/^https:\/\//.test(sub.endpoint)) return Response.json({ error: "bad-sub" }, { status: 400 });
      const id = b64u(await crypto.subtle.digest("SHA-256", te.encode(sub.endpoint))).slice(0, 22);
      if (url.pathname === "/unsub") { await this.s.delete("s:" + id); return Response.json({ ok: true }); }
      if (!sub.keys?.p256dh || !sub.keys?.auth) return Response.json({ error: "bad-sub" }, { status: 400 });
      await this.s.put("s:" + id, { endpoint: sub.endpoint, keys: { p256dh: sub.keys.p256dh, auth: sub.keys.auth }, t: Date.now() });
      return Response.json({ ok: true });
    }
    if (url.pathname === "/notify") {
      if (await this.s.get("sent:" + b.key)) return Response.json({ ok: true, dup: true });
      const subs = [...(await this.s.list({ prefix: "s:" })).keys()];
      const jobs = (await this.s.get("jobs")) || [];
      if (subs.length) jobs.push({ payload: { title: b.title, body: b.body, url: b.url }, queue: subs });
      await this.s.put({ ["sent:" + b.key]: Date.now(), jobs });
      if (subs.length) await this.s.setAlarm(Date.now() + 100);
      return Response.json({ ok: true, queued: subs.length });
    }
    return Response.json({ error: "not-found" }, { status: 404 });
  }
  async alarm() {
    const jobs = (await this.s.get("jobs")) || [];
    const job = jobs[0];
    if (!job) return;
    const batch = job.queue.splice(0, 40);   // حد الطلبات لكل تشغيلة بالخطة المجانية
    const v = await this.vapid();
    const key = await crypto.subtle.importKey("jwk", v.priv, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
    const body = te.encode(JSON.stringify(job.payload));
    await Promise.all(batch.map(async (sk) => {
      const sub = await this.s.get(sk); if (!sub) return;
      try {
        const res = await sendPush(sub, body, key, v.pub);
        if (res.status === 404 || res.status === 410) await this.s.delete(sk);
      } catch (e) {}
    }));
    if (!job.queue.length) jobs.shift();
    await this.s.put("jobs", jobs);
    if (jobs.length) await this.s.setAlarm(Date.now() + 1000);
  }
}
async function sendPush(sub, payload, signKey, pubB64) {
  // تشفير RFC 8291 (aes128gcm)
  const uaPub = unb64u(sub.keys.p256dh), auth = unb64u(sub.keys.auth);
  const eph = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", eph.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, eph.privateKey, 256));
  const ikm = await hkdf(auth, shared, concat(te.encode("WebPush: info\0"), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const aes = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, aes, concat(payload, new Uint8Array([2]))));
  const header = concat(salt, new Uint8Array([0, 0, 16, 0]), new Uint8Array([asPub.length]), asPub);
  // توقيع VAPID
  const aud = new URL(sub.endpoint).origin;
  const h = b64u(te.encode(JSON.stringify({ typ: "JWT", alg: "ES256" })));
  const c = b64u(te.encode(JSON.stringify({ aud, exp: Math.floor(Date.now() / 1000) + 12 * 3600, sub: "https://snapmnbralhilal-ops.github.io/mnbralhilal-site" })));
  const sig = b64u(await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, signKey, te.encode(`${h}.${c}`)));
  return fetch(sub.endpoint, { method: "POST", body: concat(header, ct), headers: {
    authorization: `vapid t=${h}.${c}.${sig}, k=${pubB64}`, "content-encoding": "aes128gcm", "content-type": "application/octet-stream", ttl: "3600", urgency: "high" } });
}

/* ============ لوحة التحكم (ترفع الملفات لـ GitHub بكومت واحد) ============ */
async function isAdmin(req, env) {
  const pw = req.headers.get("x-admin") || "";
  if (!pw || !env.ADMIN_HASH) return false;
  const h = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", te.encode(pw)))).map((b) => b.toString(16).padStart(2, "0")).join("");
  return h === env.ADMIN_HASH;
}
const ALLOWED = /^(data\/(designs|youth|ads|manual-news|league|squad|videos|social|founding)\.json|assets\/(designs|ads)\/[a-z0-9._-]+\.(jpg|jpeg|png|webp))$/;
async function gh(env, path, init = {}) {
  const r = await fetch(`https://api.github.com/repos/${REPO}${path}`, { ...init, headers: {
    authorization: `Bearer ${env.GH_TOKEN}`, accept: "application/vnd.github+json", "user-agent": "mnbr-admin", "content-type": "application/json" } });
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`GitHub ${r.status}: ${body.message || ""}`);
  return body;
}
async function admin(req, env, url) {
  if (!(await isAdmin(req, env))) return noStore({ error: "auth" }, 401);
  if (url.pathname === "/admin/check") return noStore({ ok: true, github: !!env.GH_TOKEN });
  if (!env.GH_TOKEN) return noStore({ error: "no-github-token" }, 503);
  if (url.pathname === "/admin/file") {
    const path = url.searchParams.get("path") || "";
    if (!ALLOWED.test(path) || !path.endsWith(".json")) return noStore({ error: "path" }, 400);
    const f = await gh(env, `/contents/${path}?ref=main`);
    const bytes = Uint8Array.from(atob(f.content.replace(/\n/g, "")), (c) => c.charCodeAt(0));
    return noStore({ path, sha: f.sha, content: JSON.parse(new TextDecoder().decode(bytes)) });
  }
  if (url.pathname === "/admin/commit" && req.method === "POST") {
    const b = JSON.parse(await req.text());
    const files = b.files || [];
    if (!files.length || files.length > 10) return noStore({ error: "files" }, 400);
    for (const f of files) if (!ALLOWED.test(f.path)) return noStore({ error: "path", path: f.path }, 400);
    const ref = await gh(env, "/git/ref/heads/main");
    const base = await gh(env, `/git/commits/${ref.object.sha}`);
    const tree = [];
    for (const f of files) {
      const blob = await gh(env, "/git/blobs", { method: "POST", body: JSON.stringify(f.json !== undefined
        ? { content: JSON.stringify(f.json, null, 2) + "\n", encoding: "utf-8" } : { content: f.base64, encoding: "base64" }) });
      tree.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
    }
    const t = await gh(env, "/git/trees", { method: "POST", body: JSON.stringify({ base_tree: base.tree.sha, tree }) });
    const c = await gh(env, "/git/commits", { method: "POST", body: JSON.stringify({
      message: String(b.message || "تحديث من لوحة التحكم").slice(0, 200), tree: t.sha, parents: [ref.object.sha],
      author: { name: "لوحة تحكم منبر", email: "admin@mnbralhilal.local" } }) });
    await gh(env, "/git/refs/heads/main", { method: "PATCH", body: JSON.stringify({ sha: c.sha }) });
    return noStore({ ok: true, commit: c.sha.slice(0, 7) });
  }
  return noStore({ error: "not-found" }, 404);
}
