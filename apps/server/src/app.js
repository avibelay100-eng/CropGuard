/**
 * בניית אפליקציית Express של שרת הליבה.
 *
 * createApp מקבלת את כל התלויות מבחוץ (מסד נתונים, לקוח AI, אחסון תמונות),
 * כך שהבדיקות יכולות להחליף אותן - למשל שירות AI מדומה במקום האמיתי.
 *
 * נקודות קצה:
 *   GET  /api/health
 *   POST /api/auth/register, POST /api/auth/login, GET /api/auth/me
 *   GET  /api/fields, POST /api/fields, GET/PATCH/DELETE /api/fields/:id
 *   GET  /api/fields/:id/logs, POST /api/fields/:id/logs, DELETE /api/fields/:id/logs/:logId  (יומן שדה ו-PHI)
 *   POST /api/diagnose
 *   GET  /api/diagnoses, DELETE /api/diagnoses/:id
 *   GET  /api/news
 *   GET  /api/library
 */

import cors from "cors";
import express from "express";
import { rateLimit } from "express-rate-limit";
import { pino } from "pino";
import { pinoHttp } from "pino-http";

import { errorBody, errorHandler, notFoundHandler } from "./errors.js";
import { authRouter } from "./routes/auth.js";
import { diagnoseRouter } from "./routes/diagnose.js";
import { diagnosesRouter } from "./routes/diagnoses.js";
import { fieldsRouter } from "./routes/fields.js";
import { libraryRouter } from "./routes/library.js";
import { newsRouter } from "./routes/news.js";
import "./types/express.js";

/**
 * כל התלויות שהאפליקציה צריכה. מוזרקות מבחוץ (Dependency Injection), כך שבבדיקות מחליפים אותן במדומות - AI, SMS, חדשות
 * @typedef {object} AppDeps
 * @property {PrismaClient} prisma
 * @property {ServerConfig} config
 * @property {AiClient} aiClient
 * @property {ImageStore} imageStore
 * @property {NewsService} newsService
 * @property {SmsSender} smsSender
 */

/**
 * אפשרויות בנייה שאינן תלויות - כרגע רק כיבוי הלוגים בבדיקות
 * @typedef {object} AppOptions
 * @property {boolean} [logger] - false מכבה את הלוגים (בבדיקות)
 */

/**
 * בונה את אפליקציית Express: לוגים, CORS, JSON, הגבלת קצב, כל ה-routes, ו-handlers לשגיאות.
 * סדר הרישום חשוב: notFound ו-errorHandler תמיד אחרונים, כדי לתפוס כל מה שלא טופל.
 */
export function createApp(deps, options = {}) {
  const app = express();
  app.disable("x-powered-by");

  if (options.logger !== false) {
    const logger = pino({
      name: "cropguard.server",
      level: deps.config.logLevel,
      // לא כותבים טוקנים ועוגיות ללוג
      redact: ["req.headers.authorization", "req.headers.cookie"],
    });
    app.use(pinoHttp({ logger }));
  }

  app.use(cors({ origin: deps.config.corsOrigins }));
  app.use(express.json({ limit: "100kb" }));

  // בדיקת חיות פשוטה - בלי מסד ובלי אימות; משמשת את סקריפט ה-E2E ומערכות ניטור
  app.get("/api/health", (_request, response) => {
    response.json({ status: "ok", service: "CropGuard Server" });
  });

  // הגבלת קצב על הרשמה/התחברות - הגנה מניחוש סיסמאות
  if (deps.config.authRateLimit > 0) {
    app.use(
      "/api/auth",
      rateLimit({
        windowMs: 15 * 60 * 1000,
        limit: deps.config.authRateLimit,
        standardHeaders: "draft-8",
        legacyHeaders: false,
        handler: (_request, response) => {
          response.status(429).json(errorBody("too_many_requests", "Too many attempts. Please try again later."));
        },
      }),
    );
  }

  app.use("/api/auth", authRouter(deps));
  app.use("/api/fields", fieldsRouter(deps));
  app.use("/api/diagnose", diagnoseRouter(deps));
  app.use("/api/diagnoses", diagnosesRouter(deps));
  app.use("/api/news", newsRouter(deps));
  app.use("/api/library", libraryRouter(deps));

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
