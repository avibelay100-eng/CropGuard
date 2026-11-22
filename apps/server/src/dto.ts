/**
 * המרה משורות המסד (Prisma) לאובייקטים שהשרת מחזיר (DTO).
 * כך שדות פנימיים, כמו passwordHash, אף פעם לא יוצאים החוצה בטעות.
 */

import type { DiagnosisHistoryItem, DoseUnit, FieldDto, FieldLogDto, UserDto } from "@cropguard/shared-types";

import type { Diagnosis, Field, FieldLog, User } from "./generated/prisma/client.js";
import { ACTIVE_INGREDIENTS_HE } from "./i18n/activeIngredients.js";
import { DISEASES, describeDisease } from "./i18n/diseases.js";
import { formatDateOnly } from "./services/phi.js";

/** משתמש -> תשובה. בוחרים שדות במפורש, כך ש-passwordHash לא יוצא החוצה אף פעם */
export function toUserDto(user: Pick<User, "id" | "email" | "name" | "role" | "phone" | "createdAt">): UserDto {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    role: user.role,
    phone: user.phone,
    createdAt: user.createdAt.toISOString(),
  };
}

/** מה שאילתת חלקה צריכה לכלול כדי לבנות FieldDto (ראו fieldInclude ב-routes/fields.ts) */
export type FieldWithRelations = Field & {
  _count: { diagnoses: number; logs: number };
  owner: Pick<User, "name">;
  /** הריסוס שימי ההמתנה שלו נגמרים אחרונים, אם עוד לא נגמרו (0 או 1 שורות) */
  logs: Array<Pick<FieldLog, "safeHarvestDate">>;
};

/** חלקה -> תשובה, כולל מספר האבחונים, שם הבעלים (לאגרונום) ומצב הקטיף (PHI) */
export function toFieldDto(field: FieldWithRelations): FieldDto {
  return {
    id: field.id,
    name: field.name,
    cropType: field.cropType,
    latitude: field.latitude,
    longitude: field.longitude,
    areaDunams: field.areaDunams,
    cultivationMethod: field.cultivationMethod,
    irrigationMethod: field.irrigationMethod,
    variety: field.variety,
    plantingDate: formatDateOnly(field.plantingDate),
    expectedHarvestDate: formatDateOnly(field.expectedHarvestDate),
    notes: field.notes,
    ownerId: field.ownerId,
    ownerName: field.owner.name,
    diagnosisCount: field._count.diagnoses,
    logCount: field._count.logs,
    harvestBlockedUntil: formatDateOnly(field.logs[0]?.safeHarvestDate ?? null),
    createdAt: field.createdAt.toISOString(),
    updatedAt: field.updatedAt.toISOString(),
  };
}

/** רשומת יומן -> תשובה, עם שם החומר הפעיל בעברית ושם המחלה מהמילון */
export function toFieldLogDto(log: FieldLog): FieldLogDto {
  return {
    id: log.id,
    fieldId: log.fieldId,
    type: log.type,
    appliedOn: formatDateOnly(log.appliedOn)!,
    productName: log.productName,
    activeIngredient: log.activeIngredient,
    activeIngredientHe: log.activeIngredient ? (ACTIVE_INGREDIENTS_HE[log.activeIngredient] ?? null) : null,
    dosePerDunam: log.dosePerDunam,
    doseUnit: log.doseUnit as DoseUnit | null,
    phiDays: log.phiDays,
    safeHarvestDate: formatDateOnly(log.safeHarvestDate),
    diagnosisId: log.diagnosisId,
    // השם באנגלית נגזר מהתווית: "Tomato___Late_blight" -> "Tomato Late blight"
    disease:
      log.modelLabel && log.modelLabel in DISEASES
        ? describeDisease(log.modelLabel, log.modelLabel.replace("___", " ").replaceAll("_", " "))
        : null,
    notes: log.notes,
    createdAt: log.createdAt.toISOString(),
  };
}

type DiagnosisWithField = Diagnosis & {
  field: Pick<Field, "id" | "name" | "cropType"> & { owner: Pick<User, "id" | "name"> };
};

/** אבחון שמור -> שורה בהיסטוריה, עם שמות בעברית מהמילון (המסד שומר רק את התווית והשם באנגלית) */
export function toDiagnosisHistoryItem(diagnosis: DiagnosisWithField): DiagnosisHistoryItem {
  return {
    id: diagnosis.id,
    createdAt: diagnosis.createdAt.toISOString(),
    imageUrl: diagnosis.imageUrl,
    field: { id: diagnosis.field.id, name: diagnosis.field.name, cropType: diagnosis.field.cropType },
    farmer: { id: diagnosis.field.owner.id, name: diagnosis.field.owner.name },
    disease: describeDisease(diagnosis.modelLabel, diagnosis.diseaseName),
    isHealthy: diagnosis.isHealthy,
    confidence: diagnosis.confidence,
    activeIngredient: diagnosis.activeIngredient,
    cropMismatch: diagnosis.cropMismatch,
  };
}
