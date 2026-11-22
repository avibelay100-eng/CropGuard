/**
 * חלקות:
 *   GET  /api/fields  - FARMER רואה רק את החלקות שלו; AGRONOMIST ו-ADMIN רואים הכול
 *                       (ואפשר לסנן לפי ?ownerId=)
 *   POST /api/fields  - יצירת חלקה; רק ADMIN יכול ליצור חלקה עבור משתמש אחר (ownerId)
 */

import type { FieldListResponse } from "@cropguard/shared-types";
import { Router } from "express";
import { z } from "zod";

import { canSeeAllFarmers, requireAuth } from "../auth/middleware.js";
import type { AppDeps } from "../app.js";
import { toFieldDto } from "../dto.js";
import { forbidden, notFound } from "../errors.js";

const createFieldSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  cropType: z.string().trim().min(1, "Crop type is required").max(50),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  ownerId: z.string().min(1).optional(),
});

const listQuerySchema = z.object({
  ownerId: z.string().min(1).optional(),
});

export function fieldsRouter({ prisma, config }: AppDeps): Router {
  const router = Router();
  router.use(requireAuth(prisma, config.jwtSecret));

  router.get("/", async (request, response) => {
    const user = request.user!;
    const query = listQuerySchema.parse(request.query);

    let ownerId: string | undefined;
    if (canSeeAllFarmers(user.role)) {
      ownerId = query.ownerId;
    } else {
      if (query.ownerId && query.ownerId !== user.id) throw forbidden("Farmers can only list their own fields.");
      ownerId = user.id;
    }

    const fields = await prisma.field.findMany({
      where: ownerId ? { ownerId } : {},
      include: { _count: { select: { diagnoses: true } } },
      orderBy: { createdAt: "desc" },
    });
    const body: FieldListResponse = { items: fields.map(toFieldDto) };
    response.json(body);
  });

  router.post("/", async (request, response) => {
    const user = request.user!;
    const input = createFieldSchema.parse(request.body);

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
        ownerId,
      },
      include: { _count: { select: { diagnoses: true } } },
    });
    response.status(201).json(toFieldDto(field));
  });

  return router;
}
