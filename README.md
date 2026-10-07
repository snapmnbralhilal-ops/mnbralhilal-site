# منبر الهلال — الموقع

موقع قناة منبر الهلال: مباريات ونتائج الهلال، ترتيب دوري روشن والدوري الإنجليزي، مباريات اليوم ونتائج أمس حول العالم، وأخبار تنكتب تلقائياً من البيانات.

## كيف يشتغل

- **البيانات** تجي من [API-Football](https://www.api-football.com/) عن طريق `scripts/fetch-data.js`، وتنحفظ في `data/site.json`.
- **التحديث التلقائي**: GitHub Actions يشغّل السكربت كل ساعتين (`.github/workflows/update-data.yml`). كل تشغيلة ≈ ٥ طلبات، يعني ≈ ٦٠ طلب باليوم من أصل ١٠٠ بالخطة المجانية.
- **الأخبار** تنكتب تلقائياً من النتائج والترتيب (بدون أي تكلفة إضافية).
- **الصفحة** (`index.html` + `assets/`) تقرأ `data/site.json` وتعرضه، وتعيد القراءة كل ١٠ دقائق.

## الإعداد (مرة وحدة)

1. **أضف مفتاح API-Football كسر (Secret):**
   Settings ← Secrets and variables ← Actions ← New repository secret
   - الاسم: `API_FOOTBALL_KEY`
   - القيمة: مفتاحك من لوحة تحكم API-Football
2. **شغّل أول تحديث يدوياً:** تبويب Actions ← «تحديث بيانات الموقع» ← Run workflow.
3. **انشر الموقع:** Settings ← Pages ← Source: `Deploy from a branch` ← Branch: `main` / `(root)`.
   (GitHub Pages المجاني يحتاج المستودع يكون Public. المفتاح يبقى سري في Secrets حتى لو المستودع عام.)

## تعديلات شائعة

- **اسم فريق يطلع بالإنجليزي؟** أضفه في `assets/names.js` داخل `TEAMS`.
- **تبي دوري يظهر في مباريات اليوم؟** أضف رقمه في `PRIORITY` داخل `scripts/fetch-data.js`.
- **أخطاء من الـ API** (مثل قيود الخطة المجانية) تنحفظ في `data/site.json` تحت `errors`.
