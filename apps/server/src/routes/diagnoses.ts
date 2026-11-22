/**
 * GET    /api/diagnoses     - היסטוריית אבחונים, מהחדש לישן.
 * DELETE /api/diagnoses/:id - מחיקת אבחון (בעל החלקה או מנהל בלבד).
 *
 * סינון (query string):
 *   fieldId  - רק אבחונים של חלקה מסוימת
 *   farmerId - רק אבחונים של חקלאי מסוים (לאגרונום/מנהל; חקלאי רואה תמיד רק את שלו)
 *   status   - "healthy" או "infected"
 *   limit    - כמה שורות להחזיר (1..100, ברירת מחדל 20)
 *   offset   - מאיזו שורה להתחיל (לעימוד)
 */

import type { DiagnosisListResponse } from "@cropguard/shared-types";
import { Router } from "express";
import { z } from "zod";

import { canSeeAllFarmers, requireAuth } from "../auth/middleware.js";
import type { AppDeps } from "../app.js";
import { toDiagnosisHistoryItem } from "../dto.js";
import { forbidden, notFound } from "../errors.js";
import type { Prisma } from "../generated/prisma/client.js";

const querySchema = z.object({
  fieldId: z.string().min(1).optional(),
  farmerId: z.string().min(1).optional(),
  status: z.enum(["healthy", "infected"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export function diagnosesRouter({ prisma, config, imageStore }: AppDeps): Router {
  const router = Router();
  router.use(requireAuth(prisma, config.jwtSecret));

  router.get("/", async (request, response) => {
    const user = request.user!;
    const query = querySchema.parse(request.query);
    const seesAll = canSeeAllFarmers(user.role);

    if (!seesAll && query.farmerId && query.farmerId !== user.id) {
      throw forbidden("Farmers can only see their own diagnoses.");
    }

    // חלקה שלא קיימת, או של חקלאי אחר, מחזירה 404 במקום רשימה ריקה - כך הלקוח יודע שהסינון שגוי
    if (query.fieldId) {
      const field = await prisma.field.findUnique({ where: { id: query.fieldId }, select: { ownerId: true } });
      if (!field || (!seesAll && field.ownerId !== user.id)) throw notFound("Field not found.");
    }

    const ownerId = seesAll ? query.farmerId : user.id;
    const where: Prisma.DiagnosisWhereInput = {
      ...(query.fieldId ? { fieldId: query.fieldId } : {}),
      ...(ownerId ? { field: { ownerId } } : {}),
      ...(query.status ? { isHealthy: query.status === "healthy" } : {}),
    };

    const [items, total] = await Promise.all([
      prisma.diagnosis.findMany({
        where,
        include: {
          field: { select: { id: true, name: true, cropType: true, owner: { select: { id: true, name: true } } } },
        },
        orderBy: [{ createdAt: "desc" }, { id: "desc" }],
        take: query.limit,
        skip: query.offset,
      }),
      prisma.diagnosis.count({ where }),
    ]);

    const body: DiagnosisListResponse = {
      items: items.map(toDiagnosisHistoryItem),
      total,
      limit: query.limit,
      offset: query.offset,
    };
    response.json(body);
  });

  /**
   * מחיקת אבחון. מי מורשה:
   *   - בעל החלקה (כל תפקיד) - אלה הנתונים שלו
   *   - ADMIN - כל אבחון
   * אגרונום רואה אבחונים של כולם אבל לא מוחק נתונים של חקלאי אחר (403).
   * חקלאי שמנסה למחוק אבחון של אחר מקבל 404 - כמו בשאר המערכת, לא חושפים שהוא קיים.
   */
  router.delete("/:id", async (request, response) => {
    const user = request.user!;
    const id = String(request.params["id"] ?? "");

    const diagnosis = await prisma.diagnosis.findUnique({
      where: { id },
      select: { id: true, imageUrl: true, field: { select: { ownerId: true } } },
    });
    const isOwner = diagnosis?.field.ownerId === user.id;
    if (!diagnosis || (!isOwner && !canSeeAllFarmers(user.role))) throw notFound("Diagnosis not found.");
    if (!isOwner && user.role !== "ADMIN") throw forbidden("Only the field owner or an admin can delete a diagnosis.");

    await prisma.diagnosis.delete({ where: { id: diagnosis.id } });
    // התמונה נמחקת אחרי השורה במסד; כשל במחיקת הקובץ לא מבטל את המחיקה, רק נרשם בלוג
    await imageStore.remove(diagnosis.imageUrl).catch((err: unknown) => {
      request.log?.warn({ err, imageUrl: diagnosis.imageUrl }, "Could not delete diagnosis image");
    });

    request.log?.info({ diagnosisId: diagnosis.id, by: user.id }, "Diagnosis deleted");
    response.status(204).end();
  });

  return router;
}
