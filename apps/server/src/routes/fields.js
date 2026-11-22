/**
 * חלקות:
 *   GET    /api/fields      - FARMER רואה רק את החלקות שלו; AGRONOMIST ו-ADMIN רואים הכול
 *                            (ואפשר לסנן לפי ?ownerId=)
 *   POST   /api/fields      - יצירת חלקה; רק ADMIN יכול ליצור חלקה עבור משתמש אחר (ownerId)
 *   GET    /api/fields/:id  - חלקה אחת (מי שרשאי לראות אותה)
 *   PATCH  /api/fields/:id  - עריכה (בעל החלקה או ADMIN)
 *   DELETE /api/fields/:id  - מחיקה, כולל כל האבחונים (והתמונות שלהם) וכל יומן השדה
 *   /api/fields/:id/logs    - יומן השדה (routes/fieldLogs.js)
 *
 * פרטי החלקה המורחבים (שטח בדונמים, שיטת גידול והשקיה, עונה, הערות) כולם לא חובה.
 */

import { Router } from "express";
import { z } from "zod";

import { findAccessibleField } from "../auth/fieldAccess.js";
import { canSeeAllFarmers, requireAuth } from "../auth/middleware.js";
import { toFieldDto } from "../dto.js";
import { forbidden, notFound, validationError } from "../errors.js";
import { parseDateOnly, todayInIsrael } from "../services/phi.js";
import { fieldLogsRouter } from "./fieldLogs.js";
import { dateOnlySchema, fieldIdParam, fieldInclude, optionalText } from "./fieldShared.js";

// ★ התאמה לשוק הישראלי: שטח בדונמים, שיטות גידול נפוצות בארץ (כולל בית רשת ומנהרות), טפטוף/המטרה
const fieldDetailsShape = {
  areaDunams: z.number().positive().max(100_000).nullable().optional(),
  cultivationMethod: z.enum(["OPEN_FIELD", "NET_HOUSE", "GREENHOUSE", "TUNNEL"]).nullable().optional(),
  irrigationMethod: z.enum(["DRIP", "SPRINKLER"]).nullable().optional(),
  variety: optionalText(100),
  plantingDate: dateOnlySchema.nullable().optional(),
  expectedHarvestDate: dateOnlySchema.nullable().optional(),
  notes: optionalText(1000),
};

const coreShape = {
  name: z.string().trim().min(1, "Name is required").max(100),
  cropType: z.string().trim().min(1, "Crop type is required").max(50),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
};

const createFieldSchema = z.object({ ...coreShape, ...fieldDetailsShape, ownerId: z.string().min(1).optional() });

// בעריכה כל שדה לא חובה - שולחים רק את מה שמשתנה
const updateFieldSchema = z.object({
  name: coreShape.name.optional(),
  cropType: coreShape.cropType.optional(),
  latitude: coreShape.latitude.optional(),
  longitude: coreShape.longitude.optional(),
  ...fieldDetailsShape,
});

/**
 * @typedef {z.infer<z.ZodObject<typeof fieldDetailsShape>>} FieldDetailsInput
 */

/** פרטים מורחבים מהבקשה -> נתונים ל-Prisma. undefined = לא לגעת, null = למחוק, תאריך -> Date */
function toDetailsData(input) {
  const toDate = (value) => (value == null ? value : parseDateOnly(value));
  return {
    areaDunams: input.areaDunams,
    cultivationMethod: input.cultivationMethod,
    irrigationMethod: input.irrigationMethod,
    variety: input.variety,
    plantingDate: toDate(input.plantingDate),
    expectedHarvestDate: toDate(input.expectedHarvestDate),
    notes: input.notes,
  };
}

/** הקטיף הצפוי לא יכול להיות לפני השתילה */
function assertSeasonOrder(plantingDate, expectedHarvestDate) {
  if (plantingDate && expectedHarvestDate && expectedHarvestDate < plantingDate) {
    throw validationError("expectedHarvestDate: must be on or after plantingDate");
  }
}

const listQuerySchema = z.object({
  ownerId: z.string().min(1).optional(),
});

/** בונה את נתיבי החלקות; כולם דורשים התחברות (router.use למטה) */
export function fieldsRouter(deps) {
  const { prisma, config, imageStore } = deps;
  const router = Router();
  router.use(requireAuth(prisma, config.jwtSecret));

  // רשימת חלקות: חקלאי רואה רק את שלו; אגרונום ומנהל רואים הכול ויכולים לסנן לפי בעלים
  router.get("/", async (request, response) => {
    const user = request.user;
    const query = listQuerySchema.parse(request.query);

    let ownerId;
    if (canSeeAllFarmers(user.role)) {
      ownerId = query.ownerId;
    } else {
      if (query.ownerId && query.ownerId !== user.id) throw forbidden("Farmers can only list their own fields.");
      ownerId = user.id;
    }

    const fields = await prisma.field.findMany({
      where: ownerId ? { ownerId } : {},
      include: fieldInclude(todayInIsrael()),
      orderBy: { createdAt: "desc" },
    });
    const body = { items: fields.map(toFieldDto) };
    response.json(body);
  });

  // יצירת חלקה: קואורדינטות נבדקות בטווח; רק מנהל יוצר חלקה עבור משתמש אחר
  router.post("/", async (request, response) => {
    const user = request.user;
    const input = createFieldSchema.parse(request.body);
    assertSeasonOrder(input.plantingDate, input.expectedHarvestDate);

    let ownerId = user.id;
    if (input.ownerId && input.ownerId !== user.id) {
      if (user.role !== "ADMIN") throw forbidden("Only admins can create fields for other users.");
      const owner = await prisma.user.findUnique({ where: { id: input.ownerId }, select: { id: true } });
      if (!owner) throw notFound("Owner not found.");
      ownerId = owner.id;
    }

    const field = await prisma.field.create({
      data: {
        name: input.name,
        cropType: input.cropType,
        latitude: input.latitude,
        longitude: input.longitude,
        ...toDetailsData(input),
        ownerId,
      },
      include: fieldInclude(todayInIsrael()),
    });
    response.status(201).json(toFieldDto(field));
  });

  // חלקה אחת - לפי כללי הצפייה (חקלאי אחר מקבל 404)
  router.get("/:id", async (request, response) => {
    const field = await findAccessibleField(prisma, request.user, fieldIdParam(request), "read");
    const full = await prisma.field.findUniqueOrThrow({ where: { id: field.id }, include: fieldInclude(todayInIsrael()) });
    response.json(toFieldDto(full));
  });

  /**
   * עריכת חלקה (בעל החלקה או מנהל). שולחים רק שדות שמשתנים; null מוחק פרט מורחב.
   * שינוי הגידול לא משנה אבחונים קודמים - כל אבחון נשמר עם בדיקת ההתאמה שהייתה בזמנו.
   */
  router.patch("/:id", async (request, response) => {
    const user = request.user;
    const field = await findAccessibleField(prisma, user, fieldIdParam(request), "write");
    const input = updateFieldSchema.parse(request.body);

    // בדיקת סדר העונה מול הערכים שיהיו אחרי העדכון (מה שלא נשלח - נשאר כמו שהוא)
    if (input.plantingDate !== undefined || input.expectedHarvestDate !== undefined) {
      const current = await prisma.field.findUniqueOrThrow({
        where: { id: field.id },
        select: { plantingDate: true, expectedHarvestDate: true },
      });
      assertSeasonOrder(
        input.plantingDate !== undefined ? input.plantingDate : current.plantingDate?.toISOString().slice(0, 10),
        input.expectedHarvestDate !== undefined ? input.expectedHarvestDate : current.expectedHarvestDate?.toISOString().slice(0, 10),
      );
    }

    const updated = await prisma.field.update({
      where: { id: field.id },
      data: {
        name: input.name,
        cropType: input.cropType,
        latitude: input.latitude,
        longitude: input.longitude,
        ...toDetailsData(input),
      },
      include: fieldInclude(todayInIsrael()),
    });
    request.log?.info({ fieldId: field.id, by: user.id }, "Field updated");
    response.json(toFieldDto(updated));
  });

  /**
   * מחיקת חלקה (בעל החלקה או מנהל). המסד מוחק בשרשור את האבחונים ואת יומן השדה;
   * את קובצי התמונות מוחקים כאן, אחרי שהמחיקה במסד הצליחה (כשל בקובץ רק נרשם בלוג).
   */
  router.delete("/:id", async (request, response) => {
    const user = request.user;
    const field = await findAccessibleField(prisma, user, fieldIdParam(request), "write");

    const images = await prisma.diagnosis.findMany({ where: { fieldId: field.id }, select: { imageUrl: true } });
    await prisma.field.delete({ where: { id: field.id } });
    await Promise.all(
      images.map(({ imageUrl }) =>
        imageStore.remove(imageUrl).catch((err) => {
          request.log?.warn({ err, imageUrl }, "Could not delete diagnosis image");
        }),
      ),
    );

    request.log?.info({ fieldId: field.id, diagnoses: images.length, by: user.id }, "Field deleted");
    response.status(204).end();
  });

  // ★ יומן השדה ו-PHI - נתיבים מתחת לחלקה (ההתחברות כבר נבדקה למעלה)
  router.use("/:id/logs", fieldLogsRouter(deps));

  return router;
}
