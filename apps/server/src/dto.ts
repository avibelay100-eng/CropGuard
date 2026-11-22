/**
 * המרה משורות המסד (Prisma) לאובייקטים שהשרת מחזיר (DTO).
 * כך שדות פנימיים, כמו passwordHash, אף פעם לא יוצאים החוצה בטעות.
 */

import type { DiagnosisHistoryItem, FieldDto, UserDto } from "@cropguard/shared-types";

import type { Diagnosis, Field, User } from "./generated/prisma/client.js";
import { describeDisease } from "./i18n/diseases.js";

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

/** חלקה -> תשובה, כולל מספר האבחונים ושם הבעלים (לאגרונום שרואה חלקות של כמה חקלאים) */
export function toFieldDto(
  field: Field & { _count: { diagnoses: number }; owner: Pick<User, "name"> },
): FieldDto {
  return {
    id: field.id,
    name: field.name,
    cropType: field.cropType,
    latitude: field.latitude,
    longitude: field.longitude,
    ownerId: field.ownerId,
    ownerName: field.owner.name,
    diagnosisCount: field._count.diagnoses,
    createdAt: field.createdAt.toISOString(),
    updatedAt: field.updatedAt.toISOString(),
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
