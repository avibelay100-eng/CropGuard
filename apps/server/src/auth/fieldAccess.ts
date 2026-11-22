/**
 * הרשאות על חלקה אחת - משותף לנתיבי החלקות ולנתיבי יומן השדה, כך שהכללים זהים בכל מקום:
 *
 *   קריאה  - בעל החלקה, אגרונום ומנהל. חקלאי אחר מקבל 404 (לא חושפים שהחלקה קיימת).
 *   כתיבה  - בעל החלקה ומנהל בלבד. אגרונום רואה הכול אבל לא משנה נתונים של חקלאי (403).
 */

import { forbidden, notFound } from "../errors.js";
import type { PrismaClient } from "../generated/prisma/client.js";
import type { AuthUser } from "../types/express.js";
import { canSeeAllFarmers } from "./middleware.js";

/** "read" לצפייה, "write" לעריכה, מחיקה והוספה ליומן */
export type FieldAccessMode = "read" | "write";

/** מחזיר את החלקה אם למשתמש יש הרשאה; אחרת זורק 404 או 403 לפי הכללים למעלה */
export async function findAccessibleField(
  prisma: PrismaClient,
  user: AuthUser,
  fieldId: string,
  mode: FieldAccessMode,
): Promise<{ id: string; ownerId: string }> {
  const field = await prisma.field.findUnique({ where: { id: fieldId }, select: { id: true, ownerId: true } });
  const isOwner = field?.ownerId === user.id;
  if (!field || (!isOwner && !canSeeAllFarmers(user.role))) throw notFound("Field not found.");
  if (mode === "write" && !isOwner && user.role !== "ADMIN") {
    throw forbidden("Only the field owner or an admin can change this field.");
  }
  return field;
}
