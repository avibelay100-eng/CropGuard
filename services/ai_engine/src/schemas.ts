/**
 * CropGuard AI Engine - מבני ה-JSON של ה-API.
 *
 * לכל תשובה יש גם טיפוס TypeScript (לבדיקת הקוד) וגם JSON Schema
 * (ש-Fastify משתמש בו לסריאליזציה מהירה ולתיעוד ב-/docs).
 */

export interface ClassScore {
  model_label: string;
  disease: string;
  confidence: number;
}

export interface PredictionResponse {
  /** שם קריא של המחלקה המובילה, למשל "Tomato Late blight" */
  disease: string;
  /** התווית הגולמית מ-labels-38.txt */
  model_label: string;
  plant: string;
  /** true כשהמחלקה המובילה היא "Healthy" */
  is_healthy: boolean;
  status: "healthy" | "infected";
  /** הסתברות המחלקה המובילה, 0..1 */
  confidence: number;
  /** אותה הסתברות באחוזים, 0..100 */
  confidence_percent: number;
  /** true כשהוודאות מתחת לסף שהוגדר */
  uncertain: boolean;
  top_predictions: ClassScore[];
}

export interface HealthResponse {
  service: string;
  version: string;
  status: "ok" | "degraded";
  model_loaded: boolean;
  class_count: number;
  /** הסיבה שהמודל לא נטען, או null */
  detail: string | null;
}

export interface ErrorResponse {
  /** קוד קצר וקבוע שהלקוח יכול לבדוק, למשל "unsupported_media_type" */
  error: string;
  /** הסבר לבני אדם */
  detail: string;
}

export const classScoreSchema = {
  type: "object",
  required: ["model_label", "disease", "confidence"],
  properties: {
    model_label: { type: "string", examples: ["Tomato___Late_blight"] },
    disease: { type: "string", examples: ["Tomato Late blight"] },
    confidence: { type: "number", minimum: 0, maximum: 1, examples: [0.9734] },
  },
} as const;

export const predictionResponseSchema = {
  type: "object",
  required: [
    "disease", "model_label", "plant", "is_healthy", "status",
    "confidence", "confidence_percent", "uncertain", "top_predictions",
  ],
  properties: {
    disease: { type: "string", description: "Readable name of the top class", examples: ["Tomato Late blight"] },
    model_label: { type: "string", description: "Raw class label from labels-38.txt", examples: ["Tomato___Late_blight"] },
    plant: { type: "string", examples: ["Tomato"] },
    is_healthy: { type: "boolean", description: "True when the top class is a 'Healthy' class" },
    status: { type: "string", enum: ["healthy", "infected"] },
    confidence: { type: "number", minimum: 0, maximum: 1, description: "Top-class probability, 0..1" },
    confidence_percent: { type: "number", minimum: 0, maximum: 100, description: "Top-class probability, 0..100" },
    uncertain: { type: "boolean", description: "True when confidence is below the configured threshold" },
    top_predictions: { type: "array", items: classScoreSchema },
  },
} as const;

export const healthResponseSchema = {
  type: "object",
  required: ["service", "version", "status", "model_loaded", "class_count", "detail"],
  properties: {
    service: { type: "string", examples: ["CropGuard AI Engine"] },
    version: { type: "string" },
    status: { type: "string", enum: ["ok", "degraded"] },
    model_loaded: { type: "boolean" },
    class_count: { type: "integer" },
    detail: { type: ["string", "null"] },
  },
} as const;

export const errorResponseSchema = {
  type: "object",
  required: ["error", "detail"],
  properties: {
    error: { type: "string", examples: ["unsupported_media_type"] },
    detail: { type: "string", examples: ["Uploaded file must be an image."] },
  },
} as const;

/** גוף הבקשה של /predict - משמש רק לתיעוד ב-Swagger (כדי שיופיע שם כפתור העלאת קובץ) */
export const predictRequestBodySchema = {
  type: "object",
  required: ["image"],
  properties: {
    image: { type: "string", format: "binary", description: "Leaf photo (JPEG, PNG, WebP...)" },
  },
} as const;
