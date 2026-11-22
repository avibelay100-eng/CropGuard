/**
 * ★ מנגנון ליבה של CropGuard - יומן שדה ו-PHI (ימי המתנה לקטיף).
 *
 *   GET    /api/fields/:id/logs         - כל הרשומות בחלקה, מהחדשה לישנה (מי שרשאי לראות את החלקה)
 *   POST   /api/fields/:id/logs         - רשומה חדשה: ריסוס, דישון או השקיה (בעל החלקה או ADMIN)
 *   DELETE /api/fields/:id/logs/:logId  - מחיקת רשומה (בעל החלקה או ADMIN)
 *
 * בריסוס: ימי ההמתנה (phiDays) חובה, ותאריך הקטיף המותר (safeHarvestDate) מחושב כאן בשרת -
 * הלקוח לא שולח אותו, כך שאי אפשר לשמור תאריך קטיף שלא תואם לריסוס.
 * מצב הקטיף של החלקה (harvestBlockedUntil) מוצג ברשימת החלקות ובראש היומן.
 */

import { Router } from "express";
import { z } from "zod";

import { findAccessibleField } from "../auth/fieldAccess.js";
import { toFieldDto, toFieldLogDto } from "../dto.js";
import { notFound, validationError } from "../errors.js";
import { parseDateOnly, safeHarvestDate, todayInIsrael } from "../services/phi.js";
import { dateOnlySchema, fieldIdParam, fieldInclude, optionalText } from "./fieldShared.js";

/** יחידות המינון לדונם: גרם, סמ"ק, ק"ג, ליטר, מ"ק */
const DOSE_UNITS = ["g", "ml", "kg", "L", "m3"];

const createLogSchema = z
  .object({
    type: z.enum(["SPRAY", "FERTILIZE", "IRRIGATE"]),
    appliedOn: dateOnlySchema,
    productName: optionalText(100),
    // שם החומר הפעיל נשמר באותיות קטנות, כמו במילון המחירים
    activeIngredient: optionalText(100).transform((value) => value?.toLowerCase() ?? value),
    dosePerDunam: z.number().positive().max(100_000).nullable().optional(),
    doseUnit: z.enum(DOSE_UNITS).nullable().optional(),
    phiDays: z.number().int().min(0).max(365).nullable().optional(),
    diagnosisId: z.string().min(1).nullable().optional(),
    notes: optionalText(1000),
  })
  .superRefine((input, ctx) => {
    if (input.type === "SPRAY") {
      // בלי ימי המתנה אי אפשר לדעת מתי מותר לקטוף - לכן חובה בריסוס
      if (input.phiDays == null) ctx.addIssue({ code: "custom", path: ["phiDays"], message: "is required for a spray" });
      if (!input.productName) ctx.addIssue({ code: "custom", path: ["productName"], message: "is required for a spray" });
    } else if (input.phiDays != null) {
      ctx.addIssue({ code: "custom", path: ["phiDays"], message: "only applies to a spray" });
    }
    // מינון בלי יחידה (או להפך) הוא מידע חלקי ומטעה
    if ((input.dosePerDunam == null) !== (input.doseUnit == null)) {
      ctx.addIssue({ code: "custom", path: ["doseUnit"], message: "dosePerDunam and doseUnit go together" });
    }
  });

/** בונה את נתיבי היומן; נרשם בתוך fieldsRouter, ולכן requireAuth כבר רץ ו-:id זמין (mergeParams) */
export function fieldLogsRouter({ prisma }) {
  const router = Router({ mergeParams: true });

  // היומן המלא של החלקה + החלקה עצמה (כולל מצב הקטיף) + "היום" בישראל
  router.get("/", async (request, response) => {
    const field = await findAccessibleField(prisma, request.user, fieldIdParam(request), "read");
    const today = todayInIsrael();
    const [full, logs] = await Promise.all([
      prisma.field.findUniqueOrThrow({ where: { id: field.id }, include: fieldInclude(today) }),
      prisma.fieldLog.findMany({ where: { fieldId: field.id }, orderBy: [{ appliedOn: "desc" }, { createdAt: "desc" }] }),
    ]);
    const body = { field: toFieldDto(full), items: logs.map(toFieldLogDto), today };
    response.json(body);
  });

  /**
   * רשומה חדשה ביומן. בריסוס: safeHarvestDate = appliedOn + phiDays.
   * אם הרשומה נוצרה מאבחון - האבחון חייב להיות של אותה חלקה, ותווית המחלה נלקחת ממנו (לא מהלקוח).
   */
  router.post("/", async (request, response) => {
    const user = request.user;
    const field = await findAccessibleField(prisma, user, fieldIdParam(request), "write");
    const input = createLogSchema.parse(request.body);

    // אי אפשר לרשום פעולה שעוד לא בוצעה ("היום" לפי לוח השנה בישראל)
    if (input.appliedOn > todayInIsrael()) throw validationError("appliedOn: cannot be in the future");

    let modelLabel = null;
    if (input.diagnosisId) {
      const diagnosis = await prisma.diagnosis.findUnique({
        where: { id: input.diagnosisId },
        select: { fieldId: true, modelLabel: true },
      });
      if (!diagnosis || diagnosis.fieldId !== field.id) throw validationError("diagnosisId: not a diagnosis of this field");
      modelLabel = diagnosis.modelLabel;
    }

    const isSpray = input.type === "SPRAY";
    const log = await prisma.fieldLog.create({
      data: {
        fieldId: field.id,
        type: input.type,
        appliedOn: parseDateOnly(input.appliedOn),
        productName: input.productName ?? null,
        activeIngredient: input.activeIngredient ?? null,
        dosePerDunam: input.dosePerDunam ?? null,
        doseUnit: input.doseUnit ?? null,
        phiDays: isSpray ? input.phiDays : null,
        // ★ PHI: מחושב בשרת בלבד
        safeHarvestDate: isSpray ? parseDateOnly(safeHarvestDate(input.appliedOn, input.phiDays)) : null,
        diagnosisId: input.diagnosisId ?? null,
        modelLabel,
        notes: input.notes ?? null,
      },
    });
    request.log?.info({ fieldId: field.id, logId: log.id, type: log.type, by: user.id }, "Field log created");
    response.status(201).json(toFieldLogDto(log));
  });

  // מחיקת רשומה; רשומה של חלקה אחרת - 404 (גם אם המזהה קיים)
  router.delete("/:logId", async (request, response) => {
    const user = request.user;
    const field = await findAccessibleField(prisma, user, fieldIdParam(request), "write");
    const deleted = await prisma.fieldLog.deleteMany({ where: { id: String(request.params["logId"]), fieldId: field.id } });
    if (deleted.count === 0) throw notFound("Log entry not found.");
    response.status(204).end();
  });

  return router;
}
