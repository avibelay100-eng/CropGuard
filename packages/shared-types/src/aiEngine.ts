/**
 * טיפוסי ה-API של CropGuard AI Engine (services/ai_engine).
 *
 * אלה מבני ה-JSON שהשירות מחזיר. השרת (apps/server) והלקוח (apps/client)
 * מייבאים אותם מכאן, כך שכל שינוי ב-API מתגלה מיד בבדיקת הטיפוסים של כולם.
 *
 * חשוב: כל שינוי כאן מחייב שינוי תואם בסכמות ה-JSON שב-
 * services/ai_engine/src/schemas.ts. שם יש בדיקה בזמן קומפילציה שמוודאת
 * שהשדות זהים בשני המקומות.
 */

/** מצב העלה לפי המחלקה המובילה */
export type LeafStatus = "healthy" | "infected";

/** אחת מהתחזיות המובילות */
export interface ClassScore {
  /** התווית הגולמית מ-labels-38.txt, למשל "Tomato___Late_blight" */
  model_label: string;
  /** שם קריא באנגלית, למשל "Tomato Late blight" */
  disease: string;
  /** הסתברות, 0..1 */
  confidence: number;
}

/** התשובה של POST /predict */
export interface PredictionResponse {
  /** שם קריא של המחלקה המובילה, למשל "Tomato Late blight" */
  disease: string;
  /** התווית הגולמית מ-labels-38.txt */
  model_label: string;
  /** שם הצמח, למשל "Tomato" */
  plant: string;
  /** true כשהמחלקה המובילה היא "Healthy" */
  is_healthy: boolean;
  status: LeafStatus;
  /** הסתברות המחלקה המובילה, 0..1 */
  confidence: number;
  /** אותה הסתברות באחוזים, 0..100 */
  confidence_percent: number;
  /** true כשהוודאות מתחת לסף שהוגדר בשירות (ברירת מחדל 0.5) */
  uncertain: boolean;
  /** התחזיות המובילות, מהגבוהה לנמוכה; הראשונה זהה למחלקה המובילה */
  top_predictions: ClassScore[];
}

/** מצב השירות */
export type ServiceStatus = "ok" | "degraded";

/** התשובה של GET /health */
export interface HealthResponse {
  /** "CropGuard AI Engine" */
  service: string;
  version: string;
  /** "degraded" כשהמודל לא נטען - אז /predict מחזיר 503 */
  status: ServiceStatus;
  model_loaded: boolean;
  /** מספר המחלקות שהמודל מזהה (38) */
  class_count: number;
  /** הסיבה שהמודל לא נטען, או null */
  detail: string | null;
}

/**
 * קודי השגיאה הקבועים שהשירות מחזיר בשדה error.
 * "error" הוא קוד כללי לסטטוסים נדירים שאין להם קוד משלהם.
 */
export type AiEngineErrorCode =
  | "bad_request" //            400 - תמונה ריקה או פגומה
  | "not_found" //              404 - כתובת לא קיימת
  | "method_not_allowed" //     405
  | "payload_too_large" //      413 - קובץ גדול מהמגבלה
  | "unsupported_media_type" // 415 - הקובץ אינו תמונה / הבקשה אינה multipart
  | "validation_error" //       422 - אין קובץ בשדה "image"
  | "internal_error" //         500 - התחזית נכשלה
  | "model_unavailable" //      503 - המודל לא נטען
  | "error";

/** גוף התשובה בכל שגיאה */
export interface ErrorResponse {
  error: AiEngineErrorCode;
  /** הסבר לבני אדם (באנגלית) */
  detail: string;
}

/** תשובה של POST /predict: הצלחה או שגיאה */
export type PredictResult = PredictionResponse | ErrorResponse;
