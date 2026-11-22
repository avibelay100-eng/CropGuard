/**
 * בדיקות שירות החדשות: פענוח RSS/Atom, ניקוי HTML, קישורים בטוחים, מטמון, ומקור שנכשל.
 * בלי אינטרנט - fetch מדומה. ובדיקת ה-route מול השרת (עם שירות חדשות מדומה).
 */

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { createNewsService, parseFeed, safeLink, toPlainText, truncate } from "../src/services/news.js";
import { bearer, createTestContext, createUser, hasTestDb, resetDatabase } from "./helpers.js";

const hebrewSource = {
  id: "he1",
  name: "מקור עברי",
  homepage: "https://he.example",
  language: "he",
  feedUrl: "https://he.example/feed",
};
const englishSource = {
  id: "en1",
  name: "English Source",
  homepage: "https://en.example",
  language: "en",
  feedUrl: "https://en.example/feed",
};

const rss = (items) => `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Feed</title>${items}</channel></rss>`;

const HEBREW_FEED = rss(`
  <item>
    <title>מחקר ישראלי: אשלגן בקרקע &#8211; זמין יותר</title>
    <link>https://he.example/potassium</link>
    <pubDate>Sun, 15 Nov 2026 06:00:00 +0000</pubDate>
    <description><![CDATA[<p>חוקרים מצאו ש<strong>אשלגן</strong> זמין&nbsp;לצמחים.</p><img src="x.jpg">]]></description>
  </item>
  <item>
    <title>כתבה ישנה</title>
    <link>https://he.example/old</link>
    <pubDate>Mon, 02 Nov 2026 07:32:46 +0000</pubDate>
    <description>טקסט</description>
  </item>`);

const ENGLISH_FEED = rss(`
  <item>
    <title>Blight-resistant potato &amp;amp; wheat</title>
    <link>https://en.example/potato</link>
    <pubDate>Tue, 17 Nov 2026 10:00:00 +0000</pubDate>
    <description>Researchers &lt;b&gt;bred&lt;/b&gt; a new variety.</description>
  </item>
  <item>
    <title>Evil link</title>
    <link>javascript:alert(1)</link>
    <description>Should be dropped</description>
  </item>`);

const ATOM_FEED = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Atom entry</title>
    <link rel="alternate" href="https://atom.example/a"/>
    <published>2026-11-20T08:00:00Z</published>
    <summary>Atom summary</summary>
  </entry>
</feed>`;

describe("news text helpers", () => {
  it("turns HTML into plain text and decodes entities", () => {
    expect(toPlainText("<p>Hello <b>world</b>&nbsp;&#8211; &amp;amp; done</p><script>bad()</script>")).toBe(
      "Hello world – & done",
    );
    expect(toPlainText(undefined)).toBe("");
  });

  it("keeps a plain '<' that is not a tag", () => {
    expect(toPlainText("yield &lt; 5 tons")).toBe("yield < 5 tons");
  });

  it("truncates on a word boundary", () => {
    expect(truncate("one two three four five", 15)).toBe("one two three…");
    expect(truncate("short", 12)).toBe("short");
  });

  it("only allows http and https links", () => {
    expect(safeLink("https://phys.org/a")).toBe("https://phys.org/a");
    expect(safeLink("javascript:alert(1)")).toBeNull();
    expect(safeLink("data:text/html,x")).toBeNull();
    expect(safeLink("not a url")).toBeNull();
  });
});

describe("parseFeed", () => {
  it("parses RSS into clean items", () => {
    const [first] = parseFeed(HEBREW_FEED, hebrewSource);
    expect(first).toMatchObject({
      title: "מחקר ישראלי: אשלגן בקרקע – זמין יותר",
      summary: "חוקרים מצאו ש אשלגן זמין לצמחים.",
      link: "https://he.example/potassium",
      publishedAt: "2026-11-15T06:00:00.000Z",
      sourceId: "he1",
      sourceName: "מקור עברי",
      language: "he",
    });
    expect(first.id).toMatch(/^[0-9a-f]{16}$/);
  });

  it("drops items with unsafe links and decodes double-encoded text", () => {
    const items = parseFeed(ENGLISH_FEED, englishSource);
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe("Blight-resistant potato & wheat");
    expect(items[0].summary).toBe("Researchers bred a new variety.");
  });

  it("parses Atom feeds", () => {
    expect(parseFeed(ATOM_FEED, englishSource)[0]).toMatchObject({
      title: "Atom entry",
      link: "https://atom.example/a",
      publishedAt: "2026-11-20T08:00:00.000Z",
      summary: "Atom summary",
    });
  });
});

describe("news service", () => {
  const fakeFetch = (bodies) =>
    vi.fn(async (url, _init) => {
      const body = bodies[String(url)];
      if (body === undefined) throw new Error("network down");
      if (typeof body === "number") return new Response("", { status: body });
      return new Response(body, { status: 200 });
    });

  it("merges sources newest first and reports each source's status", async () => {
    const fetchImpl = fakeFetch({ [hebrewSource.feedUrl]: HEBREW_FEED, [englishSource.feedUrl]: ENGLISH_FEED });
    const service = createNewsService({ sources: [hebrewSource, englishSource], fetchImpl });

    const news = await service.get();

    expect(news.items.map((i) => i.link)).toEqual([
      "https://en.example/potato",
      "https://he.example/potassium",
      "https://he.example/old",
    ]);
    expect(news.sources).toEqual([
      { id: "he1", name: "מקור עברי", homepage: "https://he.example", language: "he", ok: true, itemCount: 2 },
      { id: "en1", name: "English Source", homepage: "https://en.example", language: "en", ok: true, itemCount: 1 },
    ]);
  });

  it("keeps working when one source fails", async () => {
    const fetchImpl = fakeFetch({ [hebrewSource.feedUrl]: HEBREW_FEED, [englishSource.feedUrl]: 503 });
    const news = await createNewsService({ sources: [hebrewSource, englishSource], fetchImpl }).get();
    expect(news.items).toHaveLength(2);
    expect(news.sources.find((s) => s.id === "en1")).toMatchObject({ ok: false, itemCount: 0 });
  });

  it("caches results, refreshes after the TTL, and falls back to the old result if everything fails", async () => {
    let clock = 0;
    const bodies = { [hebrewSource.feedUrl]: HEBREW_FEED };
    const fetchImpl = fakeFetch(bodies);
    const service = createNewsService({ sources: [hebrewSource], fetchImpl, ttlMs: 1000, now: () => clock });

    const first = await service.get();
    await service.get();
    expect(fetchImpl).toHaveBeenCalledTimes(1); // מהמטמון

    clock = 2000;
    delete bodies[hebrewSource.feedUrl]; // עכשיו המקור נופל
    const afterFailure = await service.get();
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(afterFailure).toEqual(first); // התוצאה הקודמת, לא דף ריק
  });

  it("does not cache a total failure, so the next request retries", async () => {
    const bodies = {};
    const fetchImpl = fakeFetch(bodies);
    const errors = [];
    const service = createNewsService({
      sources: [hebrewSource],
      fetchImpl,
      onSourceError: (source, error) => errors.push(`${source.id}: ${(error).message}`),
    });

    const failed = await service.get();
    expect(failed.items).toEqual([]);
    expect(errors).toEqual(["he1: network down"]); // הסיבה מגיעה ללוג

    bodies[hebrewSource.feedUrl] = HEBREW_FEED; // הרשת חזרה
    const recovered = await service.get();
    expect(recovered.items).toHaveLength(2);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("shares one load between concurrent requests", async () => {
    const fetchImpl = fakeFetch({ [hebrewSource.feedUrl]: HEBREW_FEED });
    const service = createNewsService({ sources: [hebrewSource], fetchImpl });
    await Promise.all([service.get(), service.get(), service.get()]);
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("sends a generic User-Agent and no user data", async () => {
    const fetchImpl = fakeFetch({ [hebrewSource.feedUrl]: HEBREW_FEED });
    await createNewsService({ sources: [hebrewSource], fetchImpl }).get();
    const init = fetchImpl.mock.calls[0][1];
    expect(new Headers(init?.headers).get("User-Agent")).toBe("CropGuardNews/1.0");
    expect(new Headers(init?.headers).has("Authorization")).toBe(false);
  });
});

describe.skipIf(!hasTestDb)("GET /api/news", () => {
  let context;

  beforeAll(async () => {
    context = createTestContext();
    await resetDatabase(context.prisma);
  });
  afterAll(async () => {
    await context.prisma.$disconnect();
  });

  it("requires a token", async () => {
    expect((await request(context.app).get("/api/news")).status).toBe(401);
  });

  it("returns the news, optionally filtered by language", async () => {
    const user = await createUser(context);
    const all = await request(context.app).get("/api/news").set(...bearer(user.token));
    expect(all.status).toBe(200);
    expect(all.body.items).toHaveLength(2);

    const hebrew = await request(context.app).get("/api/news?lang=he").set(...bearer(user.token));
    expect(hebrew.body.items.map((i) => i.language)).toEqual(["he"]);

    expect((await request(context.app).get("/api/news?lang=fr").set(...bearer(user.token))).status).toBe(422);
  });
});
