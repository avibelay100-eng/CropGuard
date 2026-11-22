/**
 * הגדרות Prisma 7 לשרת CropGuard.
 *
 * מ-Prisma 7 כתובת מסד הנתונים לא נכתבת ב-schema.prisma אלא כאן,
 * ומשתני הסביבה לא נטענים אוטומטית - לכן dotenv/config בשורה הראשונה.
 */

import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    // הפקודה ש-"npx prisma db seed" ו-"prisma migrate dev" מריצות לטעינת נתוני הבסיס
    seed: "tsx prisma/seed.ts",
  },
  datasource: {
    // generate עובד גם בלי כתובת; migrate ו-seed צריכים DATABASE_URL אמיתי (ראו .env.example)
    url: process.env["DATABASE_URL"],
  },
});
