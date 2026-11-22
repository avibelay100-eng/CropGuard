/**
 * POST /api/diagnose - הנתיב המרכזי.
 *
 * מקבל טופס multipart עם:
 *   image   - תמונת העלה
 *   fieldId - החלקה שאליה שייך האבחון
 *
 * שלבים:
 *   1. בדיקת הרשאה לחלקה (FARMER - רק חלקה שלו; AGRONOMIST/ADMIN - כל חלקה)
 *   2. שליחת התמונה לשירות ה-AI
 *   3. שמירת התמונה
 *   4. שליפת המלצות הטיפול והמחירים מהמסד
 *   5. שמירת האבחון ב-PostgreSQL
 *   6. החזרת תשובה מלאה בעברית, לצד השמות באנגלית והשם המדעי
 */

import type { DiagnoseResponse } from "@cropguard/shared-types";
import { Router } from "express";
import multer from "multer";
import { z } from "zod";

import { canSeeAllFarmers, requireAuth } from "../auth/middleware.js";
import type { AppDeps } from "../app.js";
import { HttpError, notFound, validationError } from "../errors.js";
import { describeDisease } from "../i18n/diseases.js";
import { AiServiceError } from "../services/aiClient.js";
import { buildTreatmentPlan } from "../services/treatments.js";

const bodySchema = z.object({
  fieldId: z.string({ error: '"fieldId" is required.' }).trim().min(1, '"fieldId" is required.'),
});

// סוגי תוכן שמתקבלים. octet-stream נשלח מחלק מספריות ה-HTTP במובייל; שירות ה-AI יפענח ויבדוק.
function isAcceptedImageType(mimetype: string): boolean {
  return mimetype.startsWith("image/") || mimetype === "application/octet-stream";
}

export const DISCLAIMER_HE =
  "האבחון מבוסס על מודל בינה מלאכותית ואינו מחליף בדיקה של מדריך הגנת הצומח. " +
  "לפני שימוש בתכשיר יש לוודא שהוא רשום בישראל לגידול ולמחלה ולפעול לפי התווית.";
export const UNCERTAIN_WARNING_HE =
  "הוודאות של האבחון נמוכה. מומלץ לצלם שוב עלה בודד, מקרוב ובתאורה טובה, או להתייעץ עם מדריך.";
export const UNVERIFIED_PRICES_WARNING_HE =
  "המחירים המוצגים הם הערכה בלבד ועדיין לא אומתו מול מחירון ספק.";

export function diagnoseRouter({ prisma, config, aiClient, imageStore }: AppDeps): Router {
  const router = Router();

  // התמונה נשמרת בזיכרון עד שהיא עוברת את כל הבדיקות; רק אז נכתבת לדיסק
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: config.maxUploadBytes, files: 1, fields: 5 },
  });

  router.post("/", requireAuth(prisma, config.jwtSecret), upload.single("image"), async (request, response) => {
    const user = request.user!;
    const file = request.file;
    if (!file) throw validationError('Missing "image" file field.');
    if (!isAcceptedImageType(file.mimetype)) {
      throw new HttpError(415, "unsupported_media_type", `Uploaded file must be an image (got '${file.mimetype}').`);
    }
    if (file.size === 0) throw new HttpError(400, "bad_request", "Uploaded image is empty.");
    const { fieldId } = bodySchema.parse(request.body ?? {});

    // 1. הרשאה לחלקה. חלקה של חקלאי אחר מחזירה 404 (ולא 403) כדי לא לחשוף שהיא קיימת.
    const field = await prisma.field.findUnique({ where: { id: fieldId }, select: { id: true, ownerId: true } });
    if (!field || (!canSeeAllFarmers(user.role) && field.ownerId !== user.id)) {
      throw notFound("Field not found.");
    }

    // 2. שירות ה-AI
    let prediction;
    try {
      prediction = await aiClient.predict({
        buffer: file.buffer,
        mimetype: file.mimetype,
        filename: file.originalname || "leaf",
      });
    } catch (err) {
      if (err instanceof AiServiceError) {
        if (err.kind === "rejected") {
          // התמונה עצמה לא תקינה - מעבירים ללקוח את אותו סטטוס
          const code = err.status === 413 ? "payload_too_large" : err.status === 415 ? "unsupported_media_type" : "bad_request";
          throw new HttpError(err.status === 422 ? 400 : err.status, code, err.message);
        }
        request.log?.error({ reason: err.message }, "AI engine unavailable");
        throw new HttpError(503, "ai_unavailable", "The diagnosis service is temporarily unavailable. Please try again later.");
      }
      throw err;
    }

    // 3-4. שמירת התמונה והמלצות הטיפול
    const plan = await buildTreatmentPlan(prisma, prediction.model_label, prediction.is_healthy);
    const imageUrl = await imageStore.save(file.buffer, file.mimetype);

    // 5. שמירת האבחון. אם השמירה נכשלת - מוחקים את התמונה כדי לא להשאיר קבצים יתומים.
    let diagnosis;
    try {
      diagnosis = await prisma.diagnosis.create({
        data: {
          fieldId: field.id,
          imageUrl,
          modelLabel: prediction.model_label,
          diseaseName: prediction.disease,
          confidence: prediction.confidence,
          isHealthy: prediction.is_healthy,
          activeIngredient: plan.treatments[0]?.activeIngredient ?? null,
        },
      });
    } catch (err) {
      await imageStore.remove(imageUrl).catch(() => undefined);
      throw err;
    }

    // 6. התשובה
    const warningsHe: string[] = [];
    if (prediction.uncertain) warningsHe.push(UNCERTAIN_WARNING_HE);
    if (plan.hasUnverifiedPrices) warningsHe.push(UNVERIFIED_PRICES_WARNING_HE);

    const body: DiagnoseResponse = {
      diagnosis: {
        id: diagnosis.id,
        fieldId: diagnosis.fieldId,
        imageUrl: diagnosis.imageUrl,
        createdAt: diagnosis.createdAt.toISOString(),
      },
      disease: describeDisease(prediction.model_label, prediction.disease),
      isHealthy: prediction.is_healthy,
      status: prediction.status,
      statusHe: prediction.is_healthy ? "בריא" : "נגוע",
      confidence: prediction.confidence,
      confidencePercent: prediction.confidence_percent,
      uncertain: prediction.uncertain,
      guidanceHe: plan.guidanceHe,
      chemicalControl: plan.chemicalControl,
      treatments: plan.treatments,
      warningsHe,
      disclaimerHe: DISCLAIMER_HE,
    };

    request.log?.info(
      { diagnosisId: diagnosis.id, fieldId: field.id, label: prediction.model_label, confidence: prediction.confidence },
      "Diagnosis saved",
    );
    response.status(201).json(body);
  });

  return router;
}
