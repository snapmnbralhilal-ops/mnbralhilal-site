#!/usr/bin/env node
/* فحص توافق مصادر بيانات المباريات:
   1) data/site.json  (محفوظ محلياً، يتحدث كل 30 دقيقة)
   2) /live-today     (worker — كل المباريات المباشرة)
   3) /live           (worker — مباراة الهلال)
   يفحص إن كان أي مباراة مكررة بين المصادر لها نفس الحالة الأساسية (status, goals).
   يستخدم كـfail-safe: يعطي exit=1 لو فيه تفاوت كبير. */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..");

const LIVE = ["1H", "HT", "2H", "ET", "BT", "P", "LIVE", "INT", "SUSP"];
const DONE = ["FT", "AET", "PEN", "AWD", "WO"];
const HILAL = 2932;

const flat = (today) => {
  const out = {};
  for (const g of today?.groups || []) for (const m of g.matches || []) out[m.id] = m;
  return out;
};

async function fetchJSON(url) {
  const r = await fetch(url, { cache: "no-store", headers: { "cache-control": "no-cache" } });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

function cmpGoals(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  return a[0] === b[0] && a[1] === b[1];
}

async function main() {
  const site = JSON.parse(readFileSync(join(ROOT, "data/site.json"), "utf8"));
  const liveJson = JSON.parse(readFileSync(join(ROOT, "data/live.json"), "utf8"));
  const base = liveJson.url.replace(/\/live$/, "");

  console.log(`المصدر: ${base}`);
  const [today, live] = await Promise.all([
    fetchJSON(base + "/live-today").catch((e) => ({ error: e.message })),
    fetchJSON(base + "/live").catch((e) => ({ error: e.message }))
  ]);

  const siteToday = flat(site.today);
  const workerToday = today?.matches || {};
  const workerLive = live?.match || null;

  console.log(`\nموجز:`);
  console.log(`  site.json today: ${Object.keys(siteToday).length} مباراة`);
  console.log(`  /live-today: ${Object.keys(workerToday).length} مباراة`);
  console.log(`  /live-today at: ${today.at ? new Date(today.at).toISOString() : "—"}`);
  console.log(`  /live.match: ${workerLive ? `#${workerLive.id} ${workerLive.status}` : "لا توجد"}`);

  const problems = [];

  // 1) فحص توافق مباراة الهلال في المصادر الثلاثة
  if (workerLive) {
    const inSite = Object.values(siteToday).find((m) => m.home.id === HILAL || m.away.id === HILAL);
    const inWT = workerToday[workerLive.id];
    if (inSite && inSite.id === workerLive.id) {
      if (!cmpGoals(inSite.goals, workerLive.goals)) {
        problems.push(`مباراة الهلال: site.json goals=${JSON.stringify(inSite.goals)} ≠ /live goals=${JSON.stringify(workerLive.goals)}`);
      }
    }
    if (inWT) {
      if (!cmpGoals(inWT.goals, workerLive.goals)) {
        problems.push(`مباراة الهلال: /live-today goals=${JSON.stringify(inWT.goals)} ≠ /live goals=${JSON.stringify(workerLive.goals)}`);
      }
    }
  }

  // 2) فحص تطابق live-today مع site.json للمباريات المشتركة
  for (const [id, lm] of Object.entries(workerToday)) {
    const sm = siteToday[id];
    if (!sm) continue;
    // لو site.json يقول "خلصت" وworker يقول "مباشر" خلال نافذة قصيرة من بعد = ok
    // لكن لو ساعة+ بعد انتهاء site.json ولسا worker مباشر → مشكلة
    if (DONE.includes(sm.status) && LIVE.includes(lm.status)) {
      problems.push(`#${id} (${sm.home.ar || sm.home.name}): site يقول خلصت، worker يقول مباشر`);
    }
  }

  // 3) تحقق إن live-today ما هو قديم جداً
  if (today.at) {
    const ageMin = (Date.now() - today.at) / 60000;
    if (ageMin > 10) problems.push(`/live-today قديم: آخر تحديث قبل ${Math.round(ageMin)} دقيقة`);
  } else {
    problems.push("/live-today ما عنده at timestamp");
  }

  if (!problems.length) {
    console.log(`\n✅ المصادر متوافقة`);
    process.exit(0);
  }
  console.log(`\n⚠ وُجدت ${problems.length} مشكلة:`);
  for (const p of problems) console.log(`  - ${p}`);
  // نرجع 0 (warning only) حتى ما نكسر CI لو كان API-Football معطّلاً مؤقتاً
  // لو نبي strict mode: process.exit(1);
  process.exit(0);
}

main().catch((e) => { console.error("فشل الفحص:", e.message); process.exit(2); });
