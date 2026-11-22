/**
 * CropGuard AI Engine - בניית אפליקציית ה-REST (Fastify).
 *
 * נקודות קצה:
 *   GET  /         - דף בדיקה בעברית: מעלים תמונה ורואים את התוצאה בגדול
 *   GET  /health   - האם השירות חי והאם המודל נטען
 *   POST /predict  - העלאת תמונת עלה (multipart, שדה בשם "image"); מחזיר מחלה, ודאות ובריא/נגוע
 *   GET  /docs     - תיעוד אינטראקטיבי (Swagger) שאפשר לנסות ממנו את ה-API
 *
 * buildApp היא "מפעל": היא מחזירה אפליקציה מוכנה בלי להאזין לפורט,
 * כך שהבדיקות יכולות לבנות אפליקציה עם הגדרות משלהן ולשלוח אליה בקשות ישירות.
 */

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import multipart from "@fastify/multipart";
import swagger from "@fastify/swagger";
import swaggerUi from "@fastify/swagger-ui";
import Fastify, { type FastifyError, type FastifyInstance } from "fastify";

import { SERVICE_NAME, SERVICE_VERSION, TEST_PAGE_PATH, loadSettings, type Settings } from "./config.js";
import { InvalidImageError, prepareImage } from "./imageProcessing.js";
import { loadLabels, parseLabel } from "./labels.js";
import { InferenceError, ModelLoadError, loadPredictor, topKIndices, type Predictor } from "./modelLoader.js";
import type { AiEngineErrorCode, ErrorResponse, HealthResponse, PredictionResponse } from "@cropguard/shared-types";
import {
  errorResponseSchema,
  healthResponseSchema,
  predictRequestBodySchema,
  predictionResponseSchema,
} from "./schemas.js";

// ---------------------------------------------------------------------------
// שגיאות HTTP: כל שגיאה יוצאת מהשרת בפורמט אחיד {"error": ..., "detail": ...}
// ---------------------------------------------------------------------------

/** שגיאה עם קוד HTTP מפורש, שנזרקת מתוך ה-routes */
export class HttpError extends Error {
  override name = "HttpError";
  constructor(readonly statusCode: number, message: string) {
    super(message);
  }
}

// קוד קצר וקבוע לכל סטטוס, כדי שהאפליקציה בצד הלקוח תוכל להחליט מה להציג
const ERROR_CODES: Readonly<Record<number, AiEngineErrorCode>> = {
  400: "bad_request",
  404: "not_found",
  405: "method_not_allowed",
  413: "payload_too_large",
  415: "unsupported_media_type",
  422: "validation_error",
  500: "internal_error",
  503: "model_unavailable",
};

/** גוף השגיאה האחיד {error, detail} - אותו פורמט כמו בשרת הליבה */
function errorBody(statusCode: number, detail: string): ErrorResponse {
  return { error: ERROR_CODES[statusCode] ?? "error", detail };
}

/** ממפה כל שגיאה (שלנו, של Fastify או של התוסף multipart) לסטטוס והודעה ללקוח */
function classifyError(error: FastifyError | HttpError): { statusCode: number; detail: string } {
  if (error instanceof HttpError) {
    return { statusCode: error.statusCode, detail: error.message };
  }
  switch (error.code) {
    case "FST_REQ_FILE_TOO_LARGE":
    case "FST_ERR_CTP_BODY_TOO_LARGE":
      return { statusCode: 413, detail: "Uploaded file is too large." };
    case "FST_INVALID_MULTIPART_CONTENT_TYPE":
    case "FST_ERR_CTP_INVALID_MEDIA_TYPE":
      return { statusCode: 415, detail: 'Request must be multipart/form-data with an "image" file field.' };
    case "FST_FILES_LIMIT":
      return { statusCode: 400, detail: "Send exactly one image per request." };
  }
  if (error.validation) {
    return { statusCode: 422, detail: error.message };
  }
  // שגיאות 4xx אחרות של Fastify (למשל גוף בקשה פגום) - ההודעה שלהן בטוחה להצגה
  if (error.statusCode && error.statusCode >= 400 && error.statusCode < 500) {
    return { statusCode: error.statusCode, detail: error.message };
  }
  // שגיאה לא צפויה: לא חושפים פרטים פנימיים ללקוח, רק ללוג
  return { statusCode: 500, detail: "Internal server error." };
}

// סוגי תוכן שעשויים להכיל תמונה. חלק מספריות ה-HTTP במובייל שולחות octet-stream,
// ולכן הבדיקה האמיתית היא האם sharp מצליח לפענח את הבייטים.
const ACCEPTED_GENERIC_TYPES = new Set(["application/octet-stream", ""]);

/** סוג תוכן שעשוי להיות תמונה; הבדיקה האמיתית היא הפענוח ב-sharp */
function isAcceptedContentType(mimetype: string): boolean {
  const type = mimetype.split(";")[0]!.trim().toLowerCase();
  return type.startsWith("image/") || ACCEPTED_GENERIC_TYPES.has(type);
}

// תשובות השגיאה שמופיעות בתיעוד של /predict
const PREDICT_ERROR_RESPONSES = Object.fromEntries(
  [400, 413, 415, 422, 500, 503].map((code) => [code, errorResponseSchema]),
);

/** עיגול למספר ספרות אחרי הנקודה - לתשובה נקייה (0.8995 ולא 0.89951234) */
function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

/** אפשרויות בנייה - כרגע רק כיבוי הלוגים בבדיקות */
export interface BuildAppOptions {
  /** false מכבה את הלוגים (שימושי בבדיקות) */
  logger?: boolean;
}

// ---------------------------------------------------------------------------
// בניית האפליקציה
// ---------------------------------------------------------------------------

export async function buildApp(
  overrides: Partial<Settings> = {},
  options: BuildAppOptions = {},
): Promise<FastifyInstance> {
  const settings: Settings = { ...loadSettings(), ...overrides };

  const app = Fastify({
    logger: options.logger === false ? false : { level: settings.logLevel, name: "cropguard.ai_engine" },
    // מזהה בקשה: לוקחים מהכותרת X-Request-ID אם הלקוח שלח, אחרת מייצרים חדש
    requestIdHeader: "x-request-id",
    genReqId: () => randomUUID().slice(0, 12),
  });

  // --- טעינה בעליית השרת ---------------------------------------------------

  // בלי תוויות תקינות אי אפשר לסמוך על אף תוצאה, ולכן השרת לא עולה בכלל
  const labels = await loadLabels(settings.labelsPath);

  // אם המודל לא נטען, השרת עדיין עולה כדי ש-/health יסביר מה הבעיה; /predict יחזיר 503
  let predictor: Predictor | null = null;
  let loadError: string | null = null;
  try {
    predictor = await loadPredictor(settings.modelPath, labels, settings.imageSize);
    app.log.info({ modelPath: settings.modelPath, classes: labels.length }, "Model loaded and warmed up");
  } catch (err) {
    if (!(err instanceof ModelLoadError)) throw err;
    loadError = err.message;
    app.log.error({ reason: err.message }, "Model unavailable, /predict will return 503");
  }

  app.addHook("onClose", async () => {
    await predictor?.close();
    app.log.info("CropGuard AI Engine shut down");
  });

  // --- תוספים -----------------------------------------------------------------

  await app.register(swagger, {
    openapi: {
      info: {
        title: SERVICE_NAME,
        version: SERVICE_VERSION,
        description: "CropGuard plant-leaf disease classification service (38 classes, ONNX Runtime).",
      },
    },
  });
  await app.register(swaggerUi, { routePrefix: "/docs" });

  // fileSize: קובץ גדול מהמגבלה גורם לשגיאה 413 בזמן הקריאה, בלי לטעון את כולו לזיכרון
  await app.register(multipart, {
    limits: { fileSize: settings.maxUploadBytes, files: 1, fields: 10 },
  });

  // --- טיפול בשגיאות ולוגים -------------------------------------------------

  // מחזירים ללקוח את מזהה הבקשה, כדי שיהיה אפשר למצוא אותה בלוג
  app.addHook("onSend", async (request, reply) => {
    reply.header("X-Request-ID", request.id);
  });

  app.setErrorHandler<FastifyError | HttpError>((error, request, reply) => {
    const { statusCode, detail } = classifyError(error);
    if (statusCode >= 500) {
      request.log.error({ err: error, statusCode }, "Request failed");
    } else {
      request.log.warn({ statusCode, detail }, "Request rejected");
    }
    return reply.status(statusCode).send(errorBody(statusCode, detail));
  });

  app.setNotFoundHandler((request, reply) => {
    return reply.status(404).send(errorBody(404, `Route ${request.method} ${request.url} not found.`));
  });

  // --- נקודות קצה -------------------------------------------------------------

  // דף הבדיקה נקרא פעם אחת לזיכרון. אם הוא חסר, השירות עדיין עובד - רק בלי הדף.
  let testPage: string | null = null;
  try {
    testPage = await readFile(TEST_PAGE_PATH, "utf-8");
  } catch {
    app.log.warn({ path: TEST_PAGE_PATH }, "Test page not found, GET / is disabled");
  }
  if (testPage !== null) {
    const page = testPage;
    // hide: הדף לא מופיע בתיעוד ה-API, כי הוא לא חלק מה-API
    app.get("/", { schema: { hide: true } }, async (_request, reply) => {
      return reply.type("text/html; charset=utf-8").send(page);
    });
  }

  // מצב השירות: ok כשהמודל נטען, degraded עם הסיבה כשלא
  app.get(
    "/health",
    {
      schema: {
        tags: ["system"],
        summary: "Service status and whether the model is loaded",
        response: { 200: healthResponseSchema },
      },
    },
    async (): Promise<HealthResponse> => ({
      service: SERVICE_NAME,
      version: SERVICE_VERSION,
      status: predictor ? "ok" : "degraded",
      model_loaded: predictor !== null,
      class_count: labels.length,
      detail: loadError,
    }),
  );

  // התחזית: קובץ -> בדיקות -> 224x224 -> ONNX -> אימות הפלט -> top_k תחזיות (ברירת מחדל 3; 38 = כל ההתפלגות)
  app.post(
    "/predict",
    {
      schema: {
        tags: ["inference"],
        summary: "Classify a leaf image",
        consumes: ["multipart/form-data"],
        querystring: {
          type: "object",
          properties: {
            top_k: {
              type: "integer",
              minimum: 1,
              maximum: 38,
              description: "How many top predictions to return (default 3; 38 = full distribution)",
            },
          },
        },
        body: predictRequestBodySchema,
        response: { 200: predictionResponseSchema, ...PREDICT_ERROR_RESPONSES },
      },
      // הסכמות משמשות רק לתיעוד; את הקובץ ואת top_k בודקים ידנית למטה
      validatorCompiler: () => () => true,
    },
    async (request): Promise<PredictionResponse> => {
      if (!predictor) {
        throw new HttpError(503, `Model is not available: ${loadError ?? "model not loaded"}`);
      }

      // ★ Crop Mismatch Guard - top_k: כמה תחזיות להחזיר. שרת הליבה מבקש את כל 38 כדי לבדוק התאמה לגידול של החלקה.
      const rawTopK = (request.query as Record<string, unknown> | undefined)?.["top_k"];
      let topK = settings.topK;
      if (rawTopK !== undefined) {
        const parsed = Number(rawTopK);
        if (!Number.isInteger(parsed) || parsed < 1 || parsed > labels.length) {
          throw new HttpError(422, `top_k must be an integer between 1 and ${labels.length}.`);
        }
        topK = parsed;
      }

      // 1. קריאת הקובץ מהבקשה
      const file = await request.file();
      if (!file) {
        throw new HttpError(422, 'Missing "image" file field.');
      }
      if (file.fieldname !== "image") {
        file.file.resume(); // מרוקנים את הזרם כדי לא להשאיר את הבקשה תקועה
        throw new HttpError(422, `Expected the file in a field named "image", got "${file.fieldname}".`);
      }
      if (!isAcceptedContentType(file.mimetype)) {
        file.file.resume();
        throw new HttpError(415, `Uploaded file must be an image (got '${file.mimetype}').`);
      }

      const raw = await file.toBuffer(); // זורק FST_REQ_FILE_TOO_LARGE אם הקובץ גדול מהמגבלה
      if (raw.length === 0) {
        throw new HttpError(400, "Uploaded image is empty.");
      }

      // 2. עיבוד התמונה ל-224x224 RGB
      let pixels: Float32Array;
      try {
        pixels = await prepareImage(raw, settings.imageSize);
      } catch (err) {
        if (err instanceof InvalidImageError) throw new HttpError(400, err.message);
        throw err;
      }

      // 3. הרצת המודל
      const started = performance.now();
      let scores: Float32Array;
      try {
        scores = await predictor.predictScores(pixels);
      } catch (err) {
        if (err instanceof InferenceError) {
          request.log.error({ reason: err.message }, "Model output broke the serving contract");
          throw new HttpError(500, "Model returned an invalid result.");
        }
        request.log.error({ err }, "Inference failed");
        throw new HttpError(500, "Model prediction failed.");
      }
      const inferenceMs = performance.now() - started;

      // 4. בניית התשובה
      const ranked = topKIndices(scores, topK);
      const bestIndex = ranked[0]!;
      const best = parseLabel(labels[bestIndex]!);
      const confidence = scores[bestIndex]!;
      const uncertain = confidence < settings.confidenceThreshold;

      request.log.info(
        {
          file: file.filename,
          label: best.modelLabel,
          confidence: round(confidence, 4),
          uncertain,
          inferenceMs: round(inferenceMs, 1),
        },
        "Prediction completed",
      );

      return {
        disease: best.displayName,
        model_label: best.modelLabel,
        plant: best.plant,
        is_healthy: best.isHealthy,
        status: best.isHealthy ? "healthy" : "infected",
        confidence: round(confidence, 4),
        confidence_percent: round(confidence * 100, 2),
        uncertain,
        top_predictions: ranked.map((index) => ({
          model_label: labels[index]!,
          disease: parseLabel(labels[index]!).displayName,
          confidence: round(scores[index]!, 4),
        })),
      };
    },
  );

  return app;
}
