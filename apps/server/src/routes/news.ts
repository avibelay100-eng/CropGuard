/**
 * GET /api/news - חדשות חקלאות ומדע מהעולם ומישראל.
 *   ?lang=he|en - רק כתבות בעברית או באנגלית
 */

import type { NewsResponse } from "@cropguard/shared-types";
import { Router } from "express";
import { z } from "zod";

import { requireAuth } from "../auth/middleware.js";
import type { AppDeps } from "../app.js";

const querySchema = z.object({
  lang: z.enum(["he", "en"]).optional(),
});

export function newsRouter({ prisma, config, newsService }: AppDeps): Router {
  const router = Router();
  router.use(requireAuth(prisma, config.jwtSecret));

  router.get("/", async (request, response) => {
    const { lang } = querySchema.parse(request.query);
    const news = await newsService.get();
    const body: NewsResponse = lang ? { ...news, items: news.items.filter((item) => item.language === lang) } : news;
    // הדפדפן יכול לשמור את התשובה כמה דקות; המטמון האמיתי בשרת
    response.set("Cache-Control", "private, max-age=300");
    response.json(body);
  });

  return router;
}
