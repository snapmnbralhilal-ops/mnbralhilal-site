/* أسماء الفرق والبطولات بالعربي.
   API-Football يرجّع الأسماء بالإنجليزي؛ هذا الملف يحوّلها للعربي.
   أي فريق مو موجود هنا يظهر باسمه الإنجليزي — تقدر تضيفه هنا بسهولة.
   يُستخدم في المتصفح وفي سكربت جلب البيانات. */
(function (g) {
  // المفتاح = الاسم الإنجليزي بعد التبسيط (بدون Al / FC / مسافات / شرطات)
  const TEAMS = {
    // السعودية
    hilal: "الهلال", alhilalsaudi: "الهلال", hilalsaudi: "الهلال",
    nassr: "النصر", ittihad: "الاتحاد", ittihadjeddah: "الاتحاد",
    ahli: "الأهلي", ahlijeddah: "الأهلي", ahlisaudi: "الأهلي",
    shabab: "الشباب", qadsiah: "القادسية", qadisiyah: "القادسية", qadisiya: "القادسية",
    taawoun: "التعاون", taawon: "التعاون", taawoon: "التعاون",
    ettifaq: "الاتفاق", ittifaq: "الاتفاق", fateh: "الفتح", fath: "الفتح",
    khaleej: "الخليج", khaleejsaihat: "الخليج", fayha: "الفيحاء", feiha: "الفيحاء",
    kholood: "الخلود", khulood: "الخلود", riyadh: "الرياض", hazem: "الحزم", hazm: "الحزم",
    neom: "نيوم", najma: "النجمة", damac: "ضمك", dhamk: "ضمك",
    okhdood: "الأخدود", akhdoud: "الأخدود", akhdood: "الأخدود",
    raed: "الرائد", wehda: "الوحدة", wahda: "الوحدة", abha: "أبها", orobah: "العروبة", urooba: "العروبة",
    diriyah: "الدرعية", ula: "العُلا", batin: "الباطن", tai: "الطائي", faisaly: "الفيصلي",
    jabalain: "الجبلين", adalah: "العدالة", zulfi: "الزلفي", arabi: "العربي", jandal: "الجندل",
    bukayriyah: "البكيرية", jeddah: "جدة", qaisumah: "القيصومة", ohod: "أحد", kawkab: "الكوكب",
    hajer: "هجر", safa: "الصفا", nojoom: "النجوم", anwar: "الأنوار", jubail: "الجبيل",
    // الخليج والعرب
    sadd: "السد", gharafa: "الغرافة", duhail: "الدحيل", rayyan: "الريان", wakrah: "الوكرة",
    qatarsc: "قطر", shamal: "الشمال", sailiya: "السيلية", umsalal: "أم صلال", khor: "الخور",
    ain: "العين", jazira: "الجزيرة", shababalahli: "شباب الأهلي", shababahlidubai: "شباب الأهلي",
    sharjah: "الشارقة", wasl: "الوصل", nasr: "النصر الإماراتي", baniyas: "بني ياس",
    ahly: "الأهلي المصري", ahlycairo: "الأهلي المصري", zamalek: "الزمالك", pyramids: "بيراميدز",
    wydad: "الوداد", rajacasablanca: "الرجاء", esperancetunis: "الترجي",
    esteghlal: "استقلال", persepolis: "برسبوليس", sepahan: "سباهان", tractor: "تراكتور",
    // إنجلترا
    manchestercity: "مانشستر سيتي", arsenal: "آرسنال", liverpool: "ليفربول", chelsea: "تشيلسي",
    manchesterunited: "مانشستر يونايتد", tottenham: "توتنهام", newcastle: "نيوكاسل",
    astonvilla: "أستون فيلا", brighton: "برايتون", brentford: "برينتفورد", leeds: "ليدز",
    westham: "وست هام", everton: "إيفرتون", fulham: "فولهام", crystalpalace: "كريستال بالاس",
    wolves: "وولفرهامبتون", bournemouth: "بورنموث", nottinghamforest: "نوتنغهام فورست",
    sunderland: "سندرلاند", burnley: "بيرنلي", leicester: "ليستر سيتي", southampton: "ساوثهامبتون",
    ipswich: "إبسويتش",
    // إسبانيا
    realmadrid: "ريال مدريد", barcelona: "برشلونة", atleticomadrid: "أتلتيكو مدريد",
    sevilla: "إشبيلية", realbetis: "ريال بيتيس", villarreal: "فياريال", realsociedad: "ريال سوسيداد",
    athleticclub: "أتلتيك بلباو", valencia: "فالنسيا", getafe: "خيتافي", alaves: "ألافيس",
    girona: "جيرونا", celtavigo: "سيلتا فيغو", osasuna: "أوساسونا", mallorca: "مايوركا",
    // إيطاليا
    inter: "إنتر ميلان", acmilan: "ميلان", juventus: "يوفنتوس", napoli: "نابولي", asroma: "روما",
    roma: "روما", lazio: "لاتسيو", atalanta: "أتالانتا", fiorentina: "فيورنتينا", bologna: "بولونيا",
    // ألمانيا وفرنسا وغيرها
    bayernmunchen: "بايرن ميونخ", bayernmunich: "بايرن ميونخ", borussiadortmund: "بوروسيا دورتموند",
    bayerleverkusen: "باير ليفركوزن", rbleipzig: "لايبزيغ", eintrachtfrankfurt: "آينتراخت فرانكفورت",
    parissaintgermain: "باريس سان جيرمان", marseille: "مارسيليا", lyon: "ليون", monaco: "موناكو", lille: "ليل",
    benfica: "بنفيكا", porto: "بورتو", sportingcp: "سبورتينغ لشبونة", ajax: "أياكس", psv: "آيندهوفن",
    feyenoord: "فينورد", celtic: "سيلتك", rangers: "رينجرز", galatasaray: "غلطة سراي",
    fenerbahce: "فنربخشة", besiktas: "بشكتاش", intermiami: "إنتر ميامي",
    // منتخبات
    saudiarabia: "السعودية", qatar: "قطر", uae: "الإمارات", unitedarabemirates: "الإمارات",
    kuwait: "الكويت", bahrain: "البحرين", oman: "عُمان", iraq: "العراق", jordan: "الأردن",
    egypt: "مصر", morocco: "المغرب", algeria: "الجزائر", tunisia: "تونس", palestine: "فلسطين",
    brazil: "البرازيل", argentina: "الأرجنتين", france: "فرنسا", spain: "إسبانيا", england: "إنجلترا",
    germany: "ألمانيا", portugal: "البرتغال", italy: "إيطاليا", netherlands: "هولندا",
    usa: "أمريكا", unitedstates: "أمريكا", mexico: "المكسيك", canada: "كندا", japan: "اليابان",
    southkorea: "كوريا الجنوبية", koreasouth: "كوريا الجنوبية", australia: "أستراليا", iran: "إيران"
  };

  // البطولات حسب رقمها في API-Football
  const LEAGUES = {
    307: "دوري روشن السعودي", 308: "دوري يلو", 504: "كأس الملك", 826: "كأس السوبر السعودي",
    17: "دوري أبطال آسيا للنخبة", 18: "دوري أبطال آسيا ٢", 1: "كأس العالم",
    2: "دوري أبطال أوروبا", 3: "الدوري الأوروبي", 848: "دوري المؤتمر الأوروبي",
    39: "الدوري الإنجليزي", 140: "الدوري الإسباني", 135: "الدوري الإيطالي",
    78: "الدوري الألماني", 61: "الدوري الفرنسي", 94: "الدوري البرتغالي", 88: "الدوري الهولندي",
    203: "الدوري التركي", 253: "الدوري الأمريكي", 305: "دوري نجوم قطر", 301: "دوري أدنوك الإماراتي",
    233: "الدوري المصري", 200: "الدوري المغربي", 10: "مباريات ودية دولية", 667: "مباريات ودية للأندية",
    45: "كأس الاتحاد الإنجليزي", 48: "كأس الرابطة الإنجليزية", 143: "كأس ملك إسبانيا", 137: "كأس إيطاليا",
    32: "تصفيات كأس العالم - أوروبا", 30: "تصفيات كأس العالم - آسيا", 29: "تصفيات كأس العالم - أفريقيا",
    34: "تصفيات كأس العالم - أمريكا الجنوبية", 6: "كأس الأمم الأفريقية", 7: "كأس آسيا", 9: "كوبا أمريكا",
    4: "كأس الأمم الأوروبية", 5: "دوري الأمم الأوروبية", 15: "كأس العالم للأندية"
  };

  const ROUND_WORDS = [[/Regular Season - (\d+)/i, "الجولة $1"], [/Group Stage - (\d+)/i, "دور المجموعات - الجولة $1"],
    [/League Stage - (\d+)/i, "مرحلة الدوري - الجولة $1"], [/Round of 16/i, "دور الـ١٦"], [/Quarter-finals/i, "ربع النهائي"],
    [/Semi-finals/i, "نصف النهائي"], [/^Final$/i, "النهائي"]];

  function key(name) {
    return String(name || "")
      .normalize("NFD").replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/\b(fc|sc|cf|ac|afc|club|saudi|sfc|fk)\b/g, (m) => (m === "ac" ? "ac" : ""))
      .replace(/^(al|el)[\s-]+/, "")
      .replace(/[^a-z0-9]/g, "");
  }

  function arTeam(name) {
    if (!name) return "";
    const k = key(name);
    return TEAMS[k] || TEAMS[k.replace(/^al/, "")] || name;
  }
  function arLeague(league) {
    if (!league) return "";
    return LEAGUES[league.id] || league.name || "";
  }
  function arRound(round) {
    if (!round) return "";
    for (const [re, rep] of ROUND_WORDS) if (re.test(round)) return round.replace(re, rep).replace(/\d/g, (d) => "٠١٢٣٤٥٦٧٨٩"[d]);
    return round;
  }

  const api = { arTeam, arLeague, arRound, key };
  g.MNB = api;
  if (typeof module !== "undefined" && module.exports) module.exports = api;
})(typeof window !== "undefined" ? window : globalThis);
