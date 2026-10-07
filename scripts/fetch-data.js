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
const fDay = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-arab", { timeZone: TZ, weekday: "long", day: "numeric", month: "long" });
const fTime = new Intl.DateTimeFormat("ar-SA-u-ca-gregory-nu-arab", { timeZone: TZ, hour: "2-digit", minute: "2-digit", hour12: false });
const ar = (n) => String(n).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
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

/* ---------- التشغيل ---------- */
async function main() {
  if (!KEY) { console.error("❌ مفتاح API_FOOTBALL_KEY غير موجود"); process.exit(1); }
  let prev = {};
  try { prev = JSON.parse(fs.readFileSync(OUT, "utf8")); } catch {}

  const season = seasonFor();
  const [hilalFx, today, yday, spl, epl] = await Promise.all([
    api("fixtures", { team: HILAL_ID, season, timezone: TZ }),
    api("fixtures", { date: riyadhDate(0), timezone: TZ }),
    api("fixtures", { date: riyadhDate(-1), timezone: TZ }),
    api("standings", { league: SPL_ID, season }),
    api("standings", { league: EPL_ID, season })
  ]);

  const data = { ...prev, teamName: "الهلال" };
  data.updated = new Date().toISOString();
  data.season = season;

  // مباريات الهلال — من مباريات الموسم، أو من مباريات اليوم/أمس إذا الخطة ما سمحت
  let hilalAll = hilalFx ? hilalFx.map(slim) : null;
  if (!hilalAll) {
    const fromDays = [...(today || []), ...(yday || [])].map(slim).filter((m) => m.home.id === HILAL_ID || m.away.id === HILAL_ID);
    const known = new Map([...(prev.hilal?.upcoming || []), ...(prev.hilal?.results || [])].map((m) => [m.id, m]));
    for (const m of fromDays) known.set(m.id, m);
    hilalAll = known.size ? [...known.values()] : null;
  }
  if (hilalAll) {
    const live = hilalAll.filter((m) => LIVE.includes(m.status));
    const up = hilalAll.filter((m) => !LIVE.includes(m.status) && !DONE.includes(m.status) && !["CANC", "ABD", "AWD", "WO"].includes(m.status))
      .filter((m) => new Date(m.date) > Date.now() - 3 * 3600e3)
      .sort((a, b) => a.date.localeCompare(b.date));
    const res = hilalAll.filter((m) => DONE.includes(m.status) && m.goals).sort((a, b) => b.date.localeCompare(a.date));
    data.hilal = { teamId: HILAL_ID, upcoming: [...live, ...up].slice(0, 6), results: res.slice(0, 8) };
  } else {
    data.hilal = prev.hilal || { teamId: HILAL_ID, upcoming: [], results: [] };
  }

  if (today) data.today = { date: riyadhDate(0), groups: groupByLeague(today) };
  if (yday) data.yesterday = { date: riyadhDate(-1), groups: groupByLeague(yday.filter((f) => DONE.includes(f.fixture.status.short))) };

  data.standings = { ...(prev.standings || {}) };
  const splRows = standingRows(spl), eplRows = standingRows(epl);
  if (splRows) data.standings.spl = { season, rows: splRows };
  if (eplRows) data.standings.epl = { season, rows: eplRows };

  data.news = writeNews(data);
  data.errors = errors;
  data.requests = requests;

  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(data, null, 1));
  console.log(`✅ تم التحديث — ${requests} طلبات، ${errors.length} أخطاء`);
  for (const e of errors) console.log("⚠️", e.endpoint, JSON.stringify(e.params), JSON.stringify(e.error));
}

main();
