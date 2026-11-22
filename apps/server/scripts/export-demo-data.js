/**
 * ייצוא נתוני ההדגמה לגרסת GitHub Pages של הלקוח (apps/client/src/demo/data).
 *
 * גרסת ההדגמה רצה כולה בדפדפן, בלי שרת ובלי מסד נתונים, ולכן היא צריכה עותק קבוע של:
 *   - library.json - ספריית המחלות המלאה (תוכן בעברית + המלצות ומחירים), מאותה פונקציה שהשרת משתמש בה
 *   - news.json    - תמונת מצב של החדשות (כותרות, מקור, תאריך וקישור לכתבה המלאה - בלי תקצירים)
 *
 * הרצה (מתוך apps/server, כשמסד הפיתוח רץ ונטען ב-seed):
 *     npm run export-demo-data
 */

// ראשון: תעודות מערכת ההפעלה, לפני בקשות הרשת של החדשות
import "../src/systemCertificates.js";
import "dotenv/config";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createPrismaClient } from "../src/db.js";
import { buildLibraryEntries } from "../src/services/library.js";
import { createNewsService } from "../src/services/news.js";

const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../client/src/demo/data");
/** כמה כתבות לשמור בהדגמה - מספיק כדי להראות את המסך, בלי להעתיק אתרים שלמים */
const NEWS_LIMIT = 12;

/** כותב JSON מעוצב (UTF-8, עם ירידת שורה בסוף) */
function writeJson(name, data) {
  writeFileSync(path.join(OUT_DIR, name), `${JSON.stringify(data, null, 2)}\n`, "utf8");
}

/** ייצוא שני הקבצים; כשל בחדשות לא מבטל את ייצוא הספרייה */
async function main() {
  mkdirSync(OUT_DIR, { recursive: true });

  const prisma = createPrismaClient();
  try {
    const entries = await buildLibraryEntries(prisma);
    writeJson("library.json", { entries });
    console.log(`library.json: ${entries.length} entries`);
  } finally {
    await prisma.$disconnect();
  }

  const news = await createNewsService({
    onSourceError: (source, error) => console.warn(`[news] ${source.id} failed: ${(error).message}`),
  }).get();
  // רק כותרת, מקור, תאריך וקישור - בלי התקצירים, כדי לא לפרסם מחדש טקסט של אתרים אחרים בדף ציבורי
  // חצי בעברית וחצי באנגלית, כדי שסינון השפה בהדגמה יראה תוצאות בשתי השפות
  const perLanguage = (language) => news.items.filter((item) => item.language === language).slice(0, NEWS_LIMIT / 2);
  const items = [...perLanguage("he"), ...perLanguage("en")]
    .sort((x, y) => (y.publishedAt ?? "").localeCompare(x.publishedAt ?? ""))
    .map((item) => ({ ...item, summary: "" }));
  writeJson("news.json", { ...news, items, sources: news.sources.map((s) => ({ ...s, itemCount: items.filter((i) => i.sourceId === s.id).length })) });
  console.log(`news.json: ${items.length} items from ${news.sources.filter((s) => s.ok).length} sources`);
}

main().catch((err) => {
  console.error("Export failed:", err);
  process.exit(1);
});
