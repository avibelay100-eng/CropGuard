/**
 * לקוח לשירות ה-AI (services/ai_engine): שולח תמונה ל-POST /predict ומחזיר את התחזית.
 *
 * התשובה נבדקת מול סכמה (zod) - שירות חיצוני הוא גבול אמון, ותשובה בצורה לא צפויה
 * נחשבת לתקלה בשירות ולא מגיעה הלאה למשתמש.
 */

import { z } from "zod";

/**
 * תמונה שהתקבלה מהמשתמש, כפי שנשלחת לשירות ה-AI
 * @typedef {object} UploadedImage
 * @property {Buffer} buffer
 * @property {string} mimetype
 * @property {string} filename
 */

/**
 * הממשק שהשרת צריך משירות ה-AI. מאפשר להחליף מימוש (HTTP אמיתי / מדומה בבדיקות)
 * @typedef {object} AiClient
 * @property {(image: UploadedImage) => Promise<PredictionResponse>} predict
 */

/**
 * kind:
 *   "unavailable" - השירות לא זמין, איטי מדי, או החזיר תשובה לא תקינה
 *   "rejected"    - השירות דחה את התמונה (למשל קובץ פגום); status הוא הסטטוס שהחזיר
 */
export class AiServiceError extends Error {
  name = "AiServiceError";
  kind;
  status;
  constructor(kind, status, message) {
    super(message);
    this.kind = kind;
    this.status = status;
  }
}

const classScoreSchema = z.object({
  model_label: z.string(),
  disease: z.string(),
  confidence: z.number().min(0).max(1),
});

const predictionSchema = z.object({
  disease: z.string(),
  model_label: z.string(),
  plant: z.string(),
  is_healthy: z.boolean(),
  status: z.enum(["healthy", "infected"]),
  confidence: z.number().min(0).max(1),
  confidence_percent: z.number().min(0).max(100),
  uncertain: z.boolean(),
  top_predictions: z.array(classScoreSchema),
});

const errorSchema = z.object({ error: z.string(), detail: z.string() });

/**
 * לקוח HTTP לשירות ה-AI: שולח multipart ל-POST /predict?top_k=38 עם timeout.
 * 4xx = התמונה נדחתה (rejected); 5xx / timeout / תשובה בצורה לא צפויה = השירות לא זמין (unavailable).
 */
export function createHttpAiClient(baseUrl, timeoutMs) {
  return {
    async predict(image) {
      const form = new FormData();
      form.append("image", new Blob([new Uint8Array(image.buffer)], { type: image.mimetype }), image.filename);

      let response;
      try {
        // ★ Crop Mismatch Guard - top_k=38: כל ההתפלגות, כדי לבדוק כמה מההסתברות נופלת על הגידול של החלקה
        response = await fetch(`${baseUrl}/predict?top_k=38`, {
          method: "POST",
          body: form,
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        const reason = (err).name === "TimeoutError" ? `timed out after ${timeoutMs} ms` : (err).message;
        throw new AiServiceError("unavailable", 503, `AI engine is unreachable: ${reason}`);
      }

      const body = await response.json().catch(() => null);

      if (response.ok) {
        const parsed = predictionSchema.safeParse(body);
        if (!parsed.success) {
          throw new AiServiceError("unavailable", 503, "AI engine returned an unexpected response.");
        }
        return parsed.data;
      }

      const detail = errorSchema.safeParse(body).data?.detail ?? `HTTP ${response.status}`;
      // 4xx = בעיה בתמונה שהמשתמש שלח; 5xx = תקלה בשירות ה-AI עצמו
      if (response.status >= 400 && response.status < 500) {
        throw new AiServiceError("rejected", response.status, detail);
      }
      throw new AiServiceError("unavailable", 503, `AI engine error: ${detail}`);
    },
  };
}
