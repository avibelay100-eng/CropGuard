/**
 * חלקים משותפים לנתיבי החלקות (fields.ts) ולנתיבי יומן השדה (fieldLogs.ts).
 * בקובץ נפרד כדי ששני הקבצים לא ייבאו זה את זה (ייבוא מעגלי).
 */

import type { Request } from "express";
import { z } from "zod";

import type { Prisma } from "../generated/prisma/client.js";
import { isValidDateOnly, parseDateOnly } from "../services/phi.js";

/** תאריך בלבד, "YYYY-MM-DD"; תאריך שלא קיים (31 בפברואר) נדחה */
export const dateOnlySchema = z.string().refine(isValidDateOnly, { message: "must be a valid date (YYYY-MM-DD)" });

/** טקסט חופשי לא חובה: רווחים נחתכים, ומחרוזת ריקה נשמרת כ-null */
export function optionalText(max: number) {
  return z
    .string()
    .trim()
    .max(max)
    .nullable()
    .optional()
    .transform((value) => (value === "" ? null : value));
}

/** מזהה החלקה מהכתובת (/api/fields/:id/...) - גם בנתיבים מקוננים עם mergeParams */
export function fieldIdParam(request: Request): string {
  return String((request.params as Record<string, string | undefined>)["id"] ?? "");
}

/**
 * מה כל חלקה מחזירה בנוסף לשדות שלה: מספר האבחונים והרשומות ביומן, שם הבעלים,
 * ו-★ PHI: הריסוס שימי ההמתנה שלו נגמרים אחרונים - רק אם עוד לא נגמרו (תאריך הקטיף אחרי היום בישראל).
 */
export function fieldInclude(today: string) {
  return {
    _count: { select: { diagnoses: true, logs: true } },
    owner: { select: { name: true } },
    logs: {
      where: { safeHarvestDate: { gt: parseDateOnly(today) } },
      orderBy: { safeHarvestDate: "desc" },
      take: 1,
      select: { safeHarvestDate: true },
    },
  } satisfies Prisma.FieldInclude;
}
