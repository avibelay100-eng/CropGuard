/**
 * GET /api/news - חדשות חקלאות ומדע מהעולם ומישראל.
 *   ?lang=he|en - רק כתבות בעברית או באנגלית
 */

import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../auth/middleware.js";

const querySchema = z.object({
  lang: z.enum(["he", "en"]).optional(),
});

/** בונה את נתיב החדשות; newsService מוזרק (בבדיקות - רשימה קבועה בלי אינטרנט) */
export function newsRouter({ prisma, config, newsService }) {
  const router = Router();
  router.use(requireAuth(prisma, config.jwtSecret));

  // החדשות מהמטמון של השירות, עם סינון שפה אופציונלי
  router.get("/", async (request, response) => {
    const { lang } = querySchema.parse(request.query);
    const news = await newsService.get();
    const body = lang ? { ...news, items: news.items.filter((item) => item.language === lang) } : news;
    // הדפדפן יכול לשמור את התשובה כמה דקות; המטמון האמיתי בשרת
    response.set("Cache-Control", "private, max-age=300");
    response.json(body);
  });

  return router;
}
