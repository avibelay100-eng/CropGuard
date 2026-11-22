/**
 * הגדרות ריצה של CropGuard AI Engine.
 * כל ערך נקרא פעם אחת ממשתנה סביבה AI_ENGINE_*, ואם הוא לא מוגדר משתמשים בברירת המחדל.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

// שם וגרסת השירות - מופיעים ב-/health, ב-/docs ובלוגים
export const SERVICE_NAME = "CropGuard AI Engine";
export const SERVICE_VERSION = "0.1.0";

// תיקיית השירות (services/ai_engine).
// הקוד רץ מתוך src/ (בפיתוח עם tsx) או מתוך dist/ (אחרי build) - שתיהן רמה אחת מתחת לשירות.
export const SERVICE_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// המודל והתוויות יושבים בתוך השירות עצמו, כך שהשירות עומד בפני עצמו
export const MODEL_DIR = path.join(SERVICE_DIR, "model");

// דף הבדיקה (public/index.html) שמוגש בכתובת "/"
export const TEST_PAGE_PATH = path.join(SERVICE_DIR, "public", "index.html");

/** ההגדרות של שירות ה-AI */
export interface Settings {
  /** נתיב לקובץ המודל בפורמט ONNX (הומר מ-cropora_model.keras) */
  modelPath: string;
  /** נתיב לקובץ 38 התוויות, לפי סדר הפלט של המודל */
  labelsPath: string;
  /** גודל התמונה שהמודל מצפה לה (224x224) */
  imageSize: number;
  /** גודל קובץ מקסימלי להעלאה, בבייטים */
  maxUploadBytes: number;
  /** מתחת לסף הזה התשובה מסומנת uncertain=true */
  confidenceThreshold: number;
  /** כמה תחזיות מובילות להחזיר ב-top_predictions */
  topK: number;
  host: string;
  port: number;
  logLevel: string;
}

/** ברירות המחדל - המודל והתוויות מתוך model/, תמונה 224x224, סף ודאות 0.5 */
export const defaultSettings: Settings = {
  modelPath: path.join(MODEL_DIR, "cropora_model.onnx"),
  labelsPath: path.join(MODEL_DIR, "labels-38.txt"),
  imageSize: 224,
  maxUploadBytes: 10 * 1024 * 1024,
  confidenceThreshold: 0.5,
  topK: 3,
  host: "0.0.0.0",
  port: 8001,
  logLevel: "info",
};

/** קורא משתנה סביבה מספרי; זורק שגיאה ברורה אם הערך אינו מספר */
function envNumber(env: NodeJS.ProcessEnv, name: string, fallback: number): number {
  const raw = env[name];
  if (raw === undefined || raw.trim() === "") {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    throw new Error(`Environment variable ${name} must be a number, got "${raw}"`);
  }
  return value;
}

/** קורא משתנה סביבה טקסטואלי; ריק = ברירת המחדל */
function envString(env: NodeJS.ProcessEnv, name: string, fallback: string): string {
  const raw = env[name];
  return raw === undefined || raw.trim() === "" ? fallback : raw.trim();
}

/** בונה את ההגדרות ממשתני הסביבה */
export function loadSettings(env: NodeJS.ProcessEnv = process.env): Settings {
  return {
    modelPath: envString(env, "AI_ENGINE_MODEL_PATH", defaultSettings.modelPath),
    labelsPath: envString(env, "AI_ENGINE_LABELS_PATH", defaultSettings.labelsPath),
    imageSize: envNumber(env, "AI_ENGINE_IMAGE_SIZE", defaultSettings.imageSize),
    maxUploadBytes: envNumber(env, "AI_ENGINE_MAX_UPLOAD_BYTES", defaultSettings.maxUploadBytes),
    confidenceThreshold: envNumber(env, "AI_ENGINE_CONFIDENCE_THRESHOLD", defaultSettings.confidenceThreshold),
    topK: envNumber(env, "AI_ENGINE_TOP_K", defaultSettings.topK),
    host: envString(env, "AI_ENGINE_HOST", defaultSettings.host),
    port: envNumber(env, "AI_ENGINE_PORT", defaultSettings.port),
    logLevel: envString(env, "AI_ENGINE_LOG_LEVEL", defaultSettings.logLevel).toLowerCase(),
  };
}
