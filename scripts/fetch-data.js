/* يجلب البيانات من API-Football ويكتب data/site.json
   التشغيل: API_FOOTBALL_KEY=xxxx node scripts/fetch-data.js
   كل تشغيلة تستهلك ٥ طلبات تقريباً (الخطة المجانية = ١٠٠ طلب باليوم). */
const fs = require("fs");
const path = require("path");
const { arTeam, arLeague, arRound } = require("../assets/names.js");

const KEY = process.env.API_FOOTBALL_KEY;
const HOST = process.env.API_FOOTBALL_HOST || "v3.football.api-sports.io";
const TZ = "Asia/Riyadh";
const HILAL_ID = 2932; // الهلال في API-Football
const SPL_ID = 307;    // دوري روشن
const EPL_ID = 39;     // الدوري الإنجليزي
const OUT = path.join(__dirname, "..", "data", "site.json");

// الدوريات اللي تظهر في "مباريات اليوم" مرتبة حسب الأهمية
const PRIORITY = [307, 17, 504, 826, 308, 18, 2, 39, 140, 135, 78, 61, 3, 848, 1, 15, 7, 4, 9, 6, 30, 32, 34, 29, 10, 5,
  305, 301, 233, 200, 94, 88, 203, 45, 48, 143, 137, 253];

const LIVE = ["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP"];
const DONE = ["FT", "AET", "PEN", "AWD", "WO"];

const errors = [];
let requests = 0;

async function api(endpoint, params) {
  const url = `https://${HOST}/${endpoint}?` + new URLSearchParams(params);
  requests++;
  const headers = HOST.includes("rapidapi")
    ? { "x-rapidapi-key": KEY, "x-rapidapi-host": HOST }
    : { "x-apisports-key": KEY };
  try {
    const res = await fetch(url, { headers });
    const json = await res.json();
    const errs = json.errors && (Array.isArray(json.errors) ? json.errors : Object.values(json.errors));
    if (!res.ok || (errs && errs.length)) {
      errors.push({ endpoint, params, error: errs?.length ? errs : res.status });
      return null;
    }
    return json.response;
  } catch (e) {
    errors.push({ endpoint, params, error: String(e) });
    return null;
  }
}

/* ---------- أدوات ---------- */
function riyadhDate(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}
function seasonFor(date = new Date()) {
  // موسم الدوري يبدأ بالصيف: أكتوبر ٢٠٢٦ = موسم 2026
  return date.getUTCMonth() >= 6 ? date.getUTCFullYear() : date.getUTCFullYear() - 1;
}
const team = (t) => ({ id: t.id, name: t.name, logo: t.logo });
function slim(f) {
  const s = f.fixture.status.short;
  return {
    id: f.fixture.id,
    date: f.fixture.date,
    status: s,
    elapsed: f.fixture.status.elapsed,
    venue: f.fixture.venue?.city || f.fixture.venue?.name || "",
    league: { id: f.league.id, name: f.league.name, country: f.league.country, logo: f.league.logo, round: f.league.round },
    home: team(f.teams.home),
    away: team(f.teams.away),
    goals: f.goals.home == null ? null : [f.goals.home, f.goals.away]
  };
}
function groupByLeague(fixtures, { max = 60 } = {}) {
  const pr = (id) => { const i = PRIORITY.indexOf(id); return i === -1 ? 999 : i; };
  let list = fixtures.map(slim);
  const important = list.filter((m) => PRIORITY.includes(m.league.id));
  // لو الدوريات المهمة ما فيها مباريات، نعرض من باقي الدوريات
  if (important.length >= 4) list = important;
  list.sort((a, b) => pr(a.league.id) - pr(b.league.id) || a.league.id - b.league.id || a.date.localeCompare(b.date));
  list = list.slice(0, max);
  const groups = [];
  for (const m of list) {
    let g = groups[groups.length - 1];
    if (!g || g.league.id !== m.league.id) { g = { league: { id: m.league.id, name: m.league.name, logo: m.league.logo }, matches: [] }; groups.push(g); }
    g.matches.push(m);
  }
  return groups;
}
function standingRows(resp) {
  const table = resp?.[0]?.league?.standings?.[0];
  if (!table) return null;
  return table.map((r) => ({
    rank: r.rank, team: team(r.team), points: r.points, gd: r.goalsDiff, played: r.all.played,
    win: r.all.win, draw: r.all.draw, lose: r.all.lose, description: r.description || ""
  }));
}

/* ---------- الأخبار المكتوبة تلقائياً ---------- */
const fDay = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const fTime = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-latn", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const ar = (n) => String(n);
const plural = (n, one, two, few, many) => n === 1 ? one : n === 2 ? two : (n >= 3 && n <= 10) ? `${ar(n)} ${few}` : `${ar(n)} ${many}`;
const score = (m) => `${ar(m.goals[0])}-${ar(m.goals[1])}`;

function writeNews(d) {
  const news = [];
  const H = "الهلال";
  const results = d.hilal?.results || [], upcoming = d.hilal?.upcoming || [];

  const live = upcoming.find((m) => LIVE.includes(m.status));
  if (live) {
    const opp = live.home.id === HILAL_ID ? live.away : live.home;
    news.push({ tag: H, title: `مباشر: الهلال ${live.home.id === HILAL_ID ? "يستضيف" : "يحل ضيفاً على"} ${arTeam(opp.name)} الآن`, body: `النتيجة ${score(live)} في ${arLeague(live.league)}.`, link: "#hilal" });
  }

  const last = results[0];
  if (last) {
    const home = last.home.id === HILAL_ID;
    const opp = arTeam((home ? last.away : last.home).name);
    const us = home ? last.goals[0] : last.goals[1], them = home ? last.goals[1] : last.goals[0];
    const title = us > them ? `الهلال يتغلب على ${opp} بنتيجة ${ar(us)}-${ar(them)}`
      : us < them ? `الهلال يخسر أمام ${opp} بنتيجة ${ar(them)}-${ar(us)}`
      : `الهلال يتعادل مع ${opp} ${ar(us)}-${ar(them)}`;
    const rnd = arRound(last.league.round);
    news.push({ tag: H, title, body: `${home ? "على أرضه" : "خارج أرضه"} في ${arLeague(last.league)}${rnd ? " — " + rnd : ""}.`, link: "#hilal" });
  }

  // سلسلة نتائج
  let streak = 0;
  for (const m of results) {
    const home = m.home.id === HILAL_ID;
    const us = home ? m.goals[0] : m.goals[1], them = home ? m.goals[1] : m.goals[0];
    if (us > them) streak++; else break;
  }
  if (streak >= 3) news.push({ tag: H, title: `${plural(streak, "", "", "انتصارات", "انتصاراً")} متتالية للهلال`, body: `الزعيم يواصل سلسلة الانتصارات في كل البطولات.`, link: "#hilal" });

  const next = upcoming.find((m) => !LIVE.includes(m.status));
  if (next) {
    const home = next.home.id === HILAL_ID;
    const opp = arTeam((home ? next.away : next.home).name);
    news.push({ tag: H, title: `الهلال ${home ? "يستضيف" : "يحل ضيفاً على"} ${opp} في ${arLeague(next.league)}`,
      body: `${fDay.format(new Date(next.date))} الساعة ${fTime.format(new Date(next.date))} بتوقيت مكة.`, link: "#hilal" });
  }

  const spl = d.standings?.spl?.rows || [];
  const me = spl.find((r) => r.team.id === HILAL_ID);
  if (me && me.played > 0) {
    let body;
    if (me.rank === 1 && spl[1]) {
      const gap = me.points - spl[1].points;
      body = gap > 0 ? `بفارق ${plural(gap, "نقطة واحدة", "نقطتين", "نقاط", "نقطة")} عن ${arTeam(spl[1].team.name)} صاحب المركز الثاني.` : `بالتساوي في النقاط مع ${arTeam(spl[1].team.name)}.`;
    } else if (spl[0]) {
      body = `متأخراً بـ${plural(spl[0].points - me.points, "نقطة واحدة", "نقطتين", "نقاط", "نقطة")} عن المتصدر ${arTeam(spl[0].team.name)}.`;
    }
    news.push({ tag: H, title: `الهلال ${me.rank === 1 ? "يتصدر دوري روشن" : "في المركز " + ar(me.rank) + " بدوري روشن"} برصيد ${ar(me.points)} نقطة`, body: body || "", link: "#table" });
  }

  const epl = d.standings?.epl?.rows || [];
  if (epl[0] && epl[0].played > 0) {
    news.push({ tag: "عالمي", title: `${arTeam(epl[0].team.name)} يتصدر الدوري الإنجليزي برصيد ${ar(epl[0].points)} نقطة`,
      body: epl[1] ? `يليه ${arTeam(epl[1].team.name)} بـ${ar(epl[1].points)} نقطة.` : "", link: "#table" });
  }

  // أكبر فوز أمس في الدوريات المهمة
  const yday = (d.yesterday?.groups || []).flatMap((g) => g.matches).filter((m) => DONE.includes(m.status) && m.goals && PRIORITY.includes(m.league.id));
  const big = yday.filter((m) => m.goals[0] !== m.goals[1]).sort((a, b) => Math.abs(b.goals[0] - b.goals[1]) - Math.abs(a.goals[0] - a.goals[1]) || (b.goals[0] + b.goals[1]) - (a.goals[0] + a.goals[1]))[0];
  if (big) {
    const hw = big.goals[0] > big.goals[1];
    const w = arTeam((hw ? big.home : big.away).name), l = arTeam((hw ? big.away : big.home).name);
    const margin = Math.abs(big.goals[0] - big.goals[1]);
    news.push({ tag: "عالمي", title: `${w} ${margin >= 3 ? "يكتسح" : "يفوز على"} ${l} ${ar(Math.max(...big.goals))}-${ar(Math.min(...big.goals))}`,
      body: `في ${arLeague(big.league)}.`, link: "#today" });
  }

  const todayCount = (d.today?.groups || []).reduce((s, g) => s + g.matches.length, 0);
  if (todayCount) {
    const first = d.today.groups[0];
    news.push({ tag: "عالمي", title: `${plural(todayCount, "مباراة واحدة", "مباراتان", "مباريات", "مباراة")} اليوم في أبرز الدوريات`, body: `أبرزها في ${arLeague(first.league)}.`, link: "#today" });
  }
  return news.slice(0, 8);
}

/* ---------- الأرشيف اليومي ----------
   الخطة المجانية تقفل طلبات "الموسم الحالي" (جدول فريق / ترتيب)، لكنها تسمح بمباريات يوم معيّن.
   فنحفظ مباريات كل يوم للدوريات اللي تهمنا في data/archive/، ومنها نبني جدول الهلال والترتيب. */
const ARCHIVE = path.join(__dirname, "..", "data", "archive");
const KEEP = new Set([SPL_ID, EPL_ID, 17, 504, 826]); // دوري روشن، الإنجليزي، آسيا للنخبة، كأس الملك، السوبر
const BACKFILL_PER_RUN = 20; // كم يوم قديم نجمع بكل تشغيلة لين يكتمل الموسم
const LOOKAHEAD_DAYS = 14;   // كم يوم قدام ندوّر فيه مباريات الهلال (مرة باليوم)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const GAP = Number(process.env.API_GAP_MS ?? 6500); // الخطة المجانية: ١٠ طلبات بالدقيقة

let lastCall = 0;
async function apiSlow(endpoint, params) {
  const wait = lastCall + GAP - Date.now();
  if (wait > 0) await sleep(wait);
  lastCall = Date.now();
  return api(endpoint, params);
}
function addDays(ymd, n) {
  const d = new Date(ymd + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const isHilal = (f) => f.teams.home.id === HILAL_ID || f.teams.away.id === HILAL_ID;
function saveDay(ymd, fixtures) {
  const keep = fixtures.filter((f) => KEEP.has(f.league.id) || isHilal(f)).map((f) => ({ ...slim(f), season: f.league.season }));
  fs.mkdirSync(ARCHIVE, { recursive: true });
  fs.writeFileSync(path.join(ARCHIVE, ymd + ".json"), JSON.stringify({ date: ymd, fetched: new Date().toISOString(), fixtures: keep }));
}
function loadArchive() {
  if (!fs.existsSync(ARCHIVE)) return [];
  const byId = new Map();
  for (const f of fs.readdirSync(ARCHIVE).filter((x) => x.endsWith(".json")).sort()) {
    const day = JSON.parse(fs.readFileSync(path.join(ARCHIVE, f), "utf8"));
    for (const m of day.fixtures) {
      const old = byId.get(m.id);
      // نفس المباراة ممكن تنحفظ بأكثر من يوم لو تأجلت — نعتمد آخر نسخة انجلبت
      if (!old || day.fetched >= old._fetched) byId.set(m.id, { ...m, _fetched: day.fetched });
    }
  }
  return [...byId.values()].map(({ _fetched, ...m }) => m);
}
function computeTable(all, leagueId, season) {
  const games = all.filter((m) => m.league.id === leagueId && m.season === season);
  if (!games.some((m) => DONE.includes(m.status))) return null;
  const T = new Map();
  const get = (t) => { if (!T.has(t.id)) T.set(t.id, { team: t, played: 0, win: 0, draw: 0, lose: 0, gf: 0, ga: 0 }); return T.get(t.id); };
  for (const m of games) {
    const h = get(m.home), a = get(m.away);
    if (!DONE.includes(m.status) || !m.goals) continue;
    const [x, y] = m.goals;
    h.played++; a.played++; h.gf += x; h.ga += y; a.gf += y; a.ga += x;
    if (x > y) { h.win++; a.lose++; } else if (x < y) { a.win++; h.lose++; } else { h.draw++; a.draw++; }
  }
  const rows = [...T.values()].map((r) => ({ ...r, points: r.win * 3 + r.draw, gd: r.gf - r.ga }))
    .sort((p, q) => q.points - p.points || q.gd - p.gd || q.gf - p.gf || p.team.name.localeCompare(q.team.name));
  rows.forEach((r, i) => { r.rank = i + 1; r.description = ""; });
  return rows;
}

/* ---------- التشغيل ---------- */
async function main() {
  if (!KEY) { console.error("❌ مفتاح API_FOOTBALL_KEY غير موجود"); process.exit(1); }
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(OUT, "utf8")); } catch {}

  const season = seasonFor();
  const todayYmd = riyadhDate(0), ydayYmd = riyadhDate(-1);

  // ١) اليوم وأمس — كل تشغيلة
  const today = await apiSlow("fixtures", { date: todayYmd, timezone: TZ });
  const yday = await apiSlow("fixtures", { date: ydayYmd, timezone: TZ });
  if (today) saveDay(todayYmd, today);
  if (yday) saveDay(ydayYmd, yday);

  // ٢) استكمال أيام الموسم القديمة (لين يكتمل الأرشيف)
  const have = new Set(fs.existsSync(ARCHIVE) ? fs.readdirSync(ARCHIVE).map((f) => f.replace(".json", "")) : []);
  const missing = [];
  for (let d = `${season}-08-01`; d < ydayYmd; d = addDays(d, 1)) if (!have.has(d)) missing.push(d);
  for (const d of missing.slice(-BACKFILL_PER_RUN).reverse()) {
    const r = await apiSlow("fixtures", { date: d, timezone: TZ });
    if (r) saveDay(d, r); else break; // لو انرفض (حد الخطة) نوقف ونكمل التشغيلة الجاية
  }

  // ٣) الأيام الجاية — مرة باليوم
  if (prev.lookahead !== todayYmd) {
    let ok = true;
    for (let i = 1; i <= LOOKAHEAD_DAYS && ok; i++) {
      const d = addDays(todayYmd, i);
      const r = await apiSlow("fixtures", { date: d, timezone: TZ });
      if (r) saveDay(d, r); else ok = false;
    }
    if (ok) prev.lookahead = todayYmd;
  }

  const all = loadArchive();
  const data = { ...prev, teamName: "الهلال" };
  data.updated = new Date().toISOString();
  data.season = season;

  // مباريات الهلال من الأرشيف
  const hil = all.filter((m) => m.home.id === HILAL_ID || m.away.id === HILAL_ID);
  const live = hil.filter((m) => LIVE.includes(m.status));
  const up = hil.filter((m) => !LIVE.includes(m.status) && !DONE.includes(m.status) && !["CANC", "ABD", "AWD", "WO"].includes(m.status))
    .filter((m) => new Date(m.date) > Date.now() - 3 * 3600e3)
    .sort((a, b) => a.date.localeCompare(b.date));
  const res = hil.filter((m) => DONE.includes(m.status) && m.goals).sort((a, b) => b.date.localeCompare(a.date));
  data.hilal = { teamId: HILAL_ID, upcoming: [...live, ...up].slice(0, 6), results: res.slice(0, 8) };

  if (today) data.today = { date: todayYmd, groups: groupByLeague(today) };
  if (yday) data.yesterday = { date: ydayYmd, groups: groupByLeague(yday.filter((f) => DONE.includes(f.fixture.status.short))) };

  // الترتيب محسوب من النتائج
  data.standings = { ...(prev.standings || {}) };
  const splRows = computeTable(all, SPL_ID, season), eplRows = computeTable(all, EPL_ID, season);
  if (splRows) data.standings.spl = { season, rows: splRows, computed: true };
  if (eplRows) data.standings.epl = { season, rows: eplRows, computed: true };
  const stillMissing = missing.length - Math.min(missing.length, BACKFILL_PER_RUN);
  data.archiveComplete = stillMissing <= 0;

  data.news = writeNews(data);
  data.errors = errors;
  data.requests = requests;

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(data, null, 1));
  console.log(`✅ تم التحديث — ${requests} طلبات، ${errors.length} أخطاء، أيام ناقصة بالأرشيف: ${Math.max(0, stillMissing)}`);
  for (const e of errors) console.log("⚠️", e.endpoint, JSON.stringify(e.params), JSON.stringify(e.error));
}

main();
