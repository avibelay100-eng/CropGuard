/**
 * GET /api/library - ספריית המחלות: כל 38 המצבים שהמודל מזהה,
 * עם שמות בעברית ובאנגלית, שם מדעי, סוג הגורם, תסמינים, מניעה, והמלצות טיפול עם מחירים בשקלים.
 * הבנייה עצמה ב-services/library.js (משותפת גם לייצוא נתוני ההדגמה).
 */

import { Router } from "express";

import { requireAuth } from "../auth/middleware.js";
import { buildLibraryEntries } from "../services/library.js";

/** בונה את נתיב ספריית המחלות */
export function libraryRouter({ prisma, config }) {
  const router = Router();
  router.use(requireAuth(prisma, config.jwtSecret));

  // ★ התאמה לשוק הישראלי: הקטלוג המלא - תוכן בעברית מהקוד + המלצות ומחירים בשקלים מהמסד
  router.get("/", async (_request, response) => {
    const body = { entries: await buildLibraryEntries(prisma) };
    // התוכן משתנה רק עם seed; אפשר לשמור בדפדפן כמה דקות
    response.set("Cache-Control", "private, max-age=300");
    response.json(body);
  });

  return router;
}
