/**
 * הגדרות הריצה של שרת הליבה, ממשתני סביבה (קובץ .env בפיתוח).
 * ערך חסר או לא תקין עוצר את השרת כבר בעלייה, עם הודעה שמסבירה מה לתקן.
 */

import "dotenv/config";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

// תיקיית apps/server (הקוד רץ מ-src/ או מ-dist/, שתיהן רמה אחת מתחת)
export const SERVER_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export interface ServerConfig {
  port: number;
  databaseUrl: string;
  /** סוד לחתימת JWT - לפחות 32 תווים */
  jwtSecret: string;
  /** תוקף הטוקן בשניות */
  jwtExpiresInSeconds: number;
  /** עלות הגיבוב של bcrypt (10-12 בייצור) */
  bcryptRounds: number;
  /** כתובת שירות ה-AI, בלי / בסוף */
  aiEngineUrl: string;
  /** כמה זמן לחכות לשירות ה-AI */
  aiTimeoutMs: number;
  /** איפה לשמור את תמונות העלים */
  uploadDir: string;
  maxUploadBytes: number;
  /** כתובות האתרים שמותר להם לפנות לשרת מהדפדפן (CORS) */
  corsOrigins: string[];
  /** כמה בקשות התחברות/הרשמה מותרות מכל IP ב-15 דקות; 0 מבטל את ההגבלה */
  authRateLimit: number;
  logLevel: string;
}

const envSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required (see apps/server/.env.example)"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters (see apps/server/.env.example)"),
  JWT_EXPIRES_IN_SECONDS: z.coerce.number().int().positive().default(12 * 60 * 60),
  BCRYPT_ROUNDS: z.coerce.number().int().min(4).max(15).default(12),
  AI_ENGINE_URL: z.url().default("http://localhost:8001"),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(15_000),
  UPLOAD_DIR: z.string().default(path.join(SERVER_DIR, "uploads")),
  MAX_UPLOAD_BYTES: z.coerce.number().int().positive().default(10 * 1024 * 1024),
  CORS_ORIGINS: z.string().default("http://localhost:5173"),
  AUTH_RATE_LIMIT: z.coerce.number().int().min(0).default(20),
  LOG_LEVEL: z.string().default("info"),
});

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`).join("\n");
    throw new Error(`Invalid server configuration:\n${problems}`);
  }
  const values = parsed.data;
  return {
    port: values.PORT,
    databaseUrl: values.DATABASE_URL,
    jwtSecret: values.JWT_SECRET,
    jwtExpiresInSeconds: values.JWT_EXPIRES_IN_SECONDS,
    bcryptRounds: values.BCRYPT_ROUNDS,
    aiEngineUrl: values.AI_ENGINE_URL.replace(/\/+$/, ""),
    aiTimeoutMs: values.AI_TIMEOUT_MS,
    uploadDir: path.resolve(SERVER_DIR, values.UPLOAD_DIR),
    maxUploadBytes: values.MAX_UPLOAD_BYTES,
    corsOrigins: values.CORS_ORIGINS.split(",").map((origin) => origin.trim()).filter(Boolean),
    authRateLimit: values.AUTH_RATE_LIMIT,
    logLevel: values.LOG_LEVEL.toLowerCase(),
  };
}
