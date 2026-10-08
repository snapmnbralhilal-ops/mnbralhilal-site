// فحص مؤقت: وش الدوريات والفرق السنية المتوفرة في API-Football
const KEY = process.env.API_FOOTBALL_KEY;
const get = (p, q) => fetch(`https://v3.football.api-sports.io/${p}?` + new URLSearchParams(q), { headers: { "x-apisports-key": KEY } }).then((r) => r.json()).then((j) => j.response || []);
(async () => {
  const lg = await get("leagues", { country: "Saudi-Arabia" });
  for (const l of lg) { const s = l.seasons?.slice(-1)[0]; console.log(`::notice::LEAGUE ${l.league.id} | ${l.league.name} | ${l.league.type} | last season ${s?.year} current=${s?.current} cov.standings=${s?.coverage?.standings}`); }
  const tm = await get("teams", { search: "Hilal" });
  for (const t of tm) console.log(`::notice::TEAM ${t.team.id} | ${t.team.name} | ${t.team.country}`);
})();
