/**
 * לקוח לשירות ה-AI (services/ai_engine): שולח תמונה ל-POST /predict ומחזיר את התחזית.
 *
 * התשובה נבדקת מול סכמה (zod) - שירות חיצוני הוא גבול אמון, ותשובה בצורה לא צפויה
 * נחשבת לתקלה בשירות ולא מגיעה הלאה למשתמש.
 */

import type { PredictionResponse } from "@cropguard/shared-types";
import { z } from "zod";

export interface UploadedImage {
  buffer: Buffer;
  mimetype: string;
  filename: string;
}

export interface AiClient {
  predict(image: UploadedImage): Promise<PredictionResponse>;
}

/**
 * kind:
 *   "unavailable" - השירות לא זמין, איטי מדי, או החזיר תשובה לא תקינה
 *   "rejected"    - השירות דחה את התמונה (למשל קובץ פגום); status הוא הסטטוס שהחזיר
 */
export class AiServiceError extends Error {
  override name = "AiServiceError";
  constructor(
    readonly kind: "unavailable" | "rejected",
    readonly status: number,
    message: string,
  ) {
    super(message);
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
}) satisfies z.ZodType<PredictionResponse>;

const errorSchema = z.object({ error: z.string(), detail: z.string() });

export function createHttpAiClient(baseUrl: string, timeoutMs: number): AiClient {
  return {
    async predict(image) {
      const form = new FormData();
      form.append("image", new Blob([new Uint8Array(image.buffer)], { type: image.mimetype }), image.filename);

      let response: Response;
      try {
        response = await fetch(`${baseUrl}/predict`, {
          method: "POST",
          body: form,
          signal: AbortSignal.timeout(timeoutMs),
        });
      } catch (err) {
        const reason = (err as Error).name === "TimeoutError" ? `timed out after ${timeoutMs} ms` : (err as Error).message;
        throw new AiServiceError("unavailable", 503, `AI engine is unreachable: ${reason}`);
      }

      const body: unknown = await response.json().catch(() => null);

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
