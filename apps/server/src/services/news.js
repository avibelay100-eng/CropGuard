/**
 * חדשות חקלאות ומדע ממקורות קבועים (RSS).
 *
 * אבטחה ופרטיות:
 *   - השרת פונה רק לרשימת המקורות הקבועה כאן. אין פרמטר שמשתמש יכול להעביר כתובת (מונע SSRF).
 *   - הטקסט מנוקה מ-HTML, וקישורים מותרים רק ב-http/https (מונע javascript: ושאר תעלולים).
 *   - הדפדפן של המשתמש לא פונה למקורות - רק השרת - כך שהם לא רואים את המשתמשים.
 *
 * ביצועים: התוצאה נשמרת בזיכרון ל-30 דקות. מקור שנכשל לא מפיל את השאר,
 * ואם כולם נכשלים מחזירים את התוצאה הקודמת (אם יש).
 */

import { createHash } from "node:crypto";

import { XMLParser } from "fast-xml-parser";

/**
 * מקור חדשות קבוע: שם, שפה וכתובת ההזנה (RSS)
 * @typedef {object} NewsSource
 * @property {string} id
 * @property {string} name
 * @property {string} homepage
 * @property {NewsLanguage} language
 * @property {string} feedUrl
 */

/** המקורות. כולם RSS ציבורי שנועד בדיוק לשיתוף כותרות; כל כתבה מקשרת למקור. */
export const NEWS_SOURCES = [
  {
    id: "hayadan",
    name: "הידען",
    homepage: "https://www.hayadan.org.il",
    language: "he",
    feedUrl: "https://www.hayadan.org.il/tag/%D7%97%D7%A7%D7%9C%D7%90%D7%95%D7%AA/feed",
  },
  {
    id: "zavit",
    name: "זווית",
    homepage: "https://www.zavit.org.il",
    language: "he",
    feedUrl: "https://www.zavit.org.il/tag/%D7%97%D7%A7%D7%9C%D7%90%D7%95%D7%AA/feed/",
  },
  {
    id: "sciencedaily",
    name: "ScienceDaily",
    homepage: "https://www.sciencedaily.com",
    language: "en",
    feedUrl: "https://www.sciencedaily.com/rss/plants_animals/agriculture_and_food.xml",
  },
  {
    id: "physorg",
    name: "Phys.org",
    homepage: "https://phys.org",
    language: "en",
    feedUrl: "https://phys.org/rss-feed/biology-news/agriculture/",
  },
];

const SUMMARY_MAX_LENGTH = 280;
const ITEMS_PER_SOURCE = 15;
const MAX_ITEMS = 60;

// ---------------------------------------------------------------------------
// ניקוי טקסט
// ---------------------------------------------------------------------------

const NAMED_ENTITIES = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  rsquo: "’",
  lsquo: "‘",
  rdquo: "”",
  ldquo: "“",
};

/** מפענח ישויות HTML (&amp;, &#8211; ...) - מקורות שונים מקודדים אחרת */
function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match;
    }
    if (entity.startsWith("#")) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

/**
 * HTML -> טקסט רגיל: מפענח ישויות, מסיר תגיות, מכווץ רווחים.
 * הסדר חשוב: קודם מפענחים (חלק מהמקורות שולחים HTML מקודד, &lt;b&gt;, ואפילו מקודד פעמיים),
 * ורק אחר כך מסירים תגיות. תגית = "<" ואחריה אות או "/", כך ש"a < b" נשאר.
 */
export function toPlainText(html) {
  if (typeof html !== "string") return "";
  const decoded = decodeEntities(decodeEntities(html));
  return decoded
    .replace(/<(script|style)\b[\s\S]*?<\/\1\s*>/gi, " ")
    .replace(/<\/?[a-z][^>]*>/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** קיצור בגבול מילה, עם "…" */
export function truncate(text, max = SUMMARY_MAX_LENGTH) {
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** רק קישורי http/https תקינים; כל השאר (javascript:, data:...) נזרקים */
export function safeLink(value) {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === "http:" || url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** תאריך מההזנה -> ISO; תאריך לא תקין -> null (הכתבה עדיין מוצגת, בלי תאריך) */
function toIsoDate(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const date = new Date(value.trim());
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

// ---------------------------------------------------------------------------
// פענוח RSS 2.0 ו-Atom
// ---------------------------------------------------------------------------

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  // ישויות מפוענחות ידנית ב-toPlainText; כך גם תגיות HTML בתוך התקציר נשארות טקסט שאפשר לנקות
  processEntities: false,
  isArray: (name) => name === "item" || name === "entry" || name === "link",
});

const asArray = (value) => (value === undefined ? [] : Array.isArray(value) ? value : [value]);

/** הטקסט של צומת XML (מחרוזת, או אובייקט עם #text) */
function text(node) {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (node && typeof node === "object" && "#text" in node) return String((node)["#text"]);
  return "";
}

/** מפענח הזנת RSS 2.0 או Atom לרשימת כתבות נקיות; כתבה בלי כותרת או בלי קישור בטוח - נזרקת */
export function parseFeed(xml, source) {
  const doc = parser.parse(xml);
  const rssItems = asArray(doc?.rss?.channel?.item);
  const atomEntries = asArray(doc?.feed?.entry);

  const raw = [
    ...rssItems.map((item) => ({
      title: text(item.title),
      link: text(asArray(item.link)[0]),
      date: text(item.pubDate) || text(item["dc:date"]),
      summary: text(item.description),
    })),
    ...atomEntries.map((entry) => {
      const links = asArray(entry.link);
      const alternate = links.find((l) => !l["@_rel"] || l["@_rel"] === "alternate") ?? links[0];
      return {
        title: text(entry.title),
        link: alternate?.["@_href"] ?? "",
        date: text(entry.published) || text(entry.updated),
        summary: text(entry.summary) || text(entry.content),
      };
    }),
  ];

  const items = [];
  for (const entry of raw) {
    const link = safeLink(entry.link);
    const title = toPlainText(entry.title);
    if (!link || !title) continue; // כתבה בלי כותרת או בלי קישור תקין - מדלגים
    items.push({
      id: createHash("sha256").update(link).digest("hex").slice(0, 16),
      title: truncate(title, 200),
      summary: truncate(toPlainText(entry.summary)),
      link,
      publishedAt: toIsoDate(entry.date),
      sourceId: source.id,
      sourceName: source.name,
      language: source.language,
    });
    if (items.length >= ITEMS_PER_SOURCE) break;
  }
  return items;
}

// ---------------------------------------------------------------------------
// השירות: טעינה, מיזוג ומטמון
// ---------------------------------------------------------------------------

/**
 * @typedef {object} NewsService
 * @property {() => Promise<NewsResponse>} get
 */

/**
 * הגדרות השירות - כולן ניתנות להחלפה בבדיקות (fetch מדומה, שעון מדומה)
 * @typedef {object} NewsServiceOptions
 * @property {readonly NewsSource[]} [sources]
 * @property {typeof fetch} [fetchImpl]
 * @property {number} [ttlMs] - כמה זמן לשמור את התוצאה בזיכרון
 * @property {number} [timeoutMs]
 * @property {() => number} [now]
 * @property {(source: NewsSource, error: unknown) => void} [onSourceError] - נקרא כשמקור נכשל - כדי שהסיבה תגיע ללוג ולא תיעלם בשקט
 */

/** שירות החדשות: טוען את כל המקורות במקביל, ממזג, ממיין ושומר במטמון */
export function createNewsService({
  sources = NEWS_SOURCES,
  fetchImpl = fetch,
  ttlMs = 30 * 60 * 1000,
  timeoutMs = 10_000,
  now = Date.now,
  onSourceError,
} = {}) {
  let cache = null;
  // בקשה אחת בכל פעם: אם כמה משתמשים פותחים את הדף יחד, הם מחכים לאותה טעינה
  let inFlight = null;

  /** טעינת מקור אחד, עם timeout ו-User-Agent כללי (בלי מידע על המשתמשים) */
  async function loadSource(source) {
    const response = await fetchImpl(source.feedUrl, {
      // User-Agent כללי, בלי שום מידע על המשתמשים
      headers: { "User-Agent": "CropGuardNews/1.0", Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return parseFeed(await response.text(), source);
  }

  /** טעינת כל המקורות; מקור שנכשל לא מפיל את השאר (Promise.allSettled) */
  async function load() {
    const results = await Promise.allSettled(sources.map(loadSource));

    const statuses = sources.map((source, index) => {
      const result = results[index];
      if (result.status === "rejected") onSourceError?.(source, result.reason);
      return {
        id: source.id,
        name: source.name,
        homepage: source.homepage,
        language: source.language,
        ok: result.status === "fulfilled",
        itemCount: result.status === "fulfilled" ? result.value.length : 0,
      };
    });

    // מיזוג, הסרת כפילויות (אותו קישור משני מקורות), ומיון מהחדש לישן
    const seen = new Set();
    const items = results
      .flatMap((result) => (result.status === "fulfilled" ? result.value : []))
      .filter((item) => (seen.has(item.link) ? false : (seen.add(item.link), true)))
      .sort((a, b) => (b.publishedAt ?? "").localeCompare(a.publishedAt ?? ""))
      .slice(0, MAX_ITEMS);

    const value = { items, sources: statuses, fetchedAt: new Date(now()).toISOString() };

    // כל המקורות נכשלו: לא שומרים את הכישלון במטמון (אחרת תקלת רשת רגעית = דף ריק ל-30 דקות).
    // אם יש תוצאה ישנה - מחזירים אותה; הבקשה הבאה תנסה שוב.
    if (statuses.every((status) => !status.ok)) {
      return cache ? cache.value : value;
    }
    cache = { value, at: now() };
    return value;
  }

  return {
    async get() {
      if (cache && now() - cache.at < ttlMs) return cache.value;
      inFlight ??= load().finally(() => {
        inFlight = null;
      });
      return inFlight;
    },
  };
}
