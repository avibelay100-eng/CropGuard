/**
 * בניית המלצת הטיפול לאבחון: הנחיה בעברית, חומרים פעילים, ומוצרים עם טווח מחירים בשקלים.
 * הנתונים מגיעים מהטבלאות TreatmentRecommendation ו-ProductPriceRange (שנטענו ב-seed).
 */

import type { TreatmentOption } from "@cropguard/shared-types";

import type { PrismaClient } from "../generated/prisma/client.js";
import { activeIngredientHe } from "../i18n/activeIngredients.js";

export interface TreatmentPlan {
  guidanceHe: string;
  chemicalControl: boolean;
  treatments: TreatmentOption[];
  /** true אם לפחות מחיר אחד בתשובה עוד לא אומת */
  hasUnverifiedPrices: boolean;
}

export const HEALTHY_GUIDANCE_HE =
  "העלה נראה בריא. אין צורך בטיפול נגד מחלות על סמך התמונה; המשיכו בהשקיה ובדישון מאוזנים ובמעקב שוטף.";

export const MISSING_GUIDANCE_HE =
  "לא נמצאה המלצת טיפול למחלה הזו במערכת. מומלץ להתייעץ עם מדריך הגנת הצומח.";

export async function buildTreatmentPlan(
  prisma: PrismaClient,
  modelLabel: string,
  isHealthy: boolean,
): Promise<TreatmentPlan> {
  if (isHealthy) {
    return { guidanceHe: HEALTHY_GUIDANCE_HE, chemicalControl: false, treatments: [], hasUnverifiedPrices: false };
  }

  const recommendation = await prisma.treatmentRecommendation.findUnique({ where: { modelLabel } });
  if (!recommendation) {
    return { guidanceHe: MISSING_GUIDANCE_HE, chemicalControl: false, treatments: [], hasUnverifiedPrices: false };
  }

  const products = await prisma.productPriceRange.findMany({
    where: { activeIngredient: { in: recommendation.activeIngredients } },
    orderBy: [{ minPriceILS: "asc" }, { productName: "asc" }],
  });

  // שומרים על סדר ההמלצה (החומר הראשון הוא המועדף)
  const treatments: TreatmentOption[] = recommendation.activeIngredients.map((ingredient) => ({
    activeIngredient: ingredient,
    activeIngredientHe: activeIngredientHe(ingredient),
    products: products
      .filter((product) => product.activeIngredient === ingredient)
      .map((product) => ({
        productName: product.productName,
        packageSize: product.packageSize,
        // Decimal של Prisma -> מספר רגיל ב-JSON
        minPriceILS: Number(product.minPriceILS),
        maxPriceILS: Number(product.maxPriceILS),
        isVerified: product.isVerified,
        priceSource: product.priceSource,
      })),
  }));

  return {
    guidanceHe: recommendation.note,
    chemicalControl: recommendation.chemicalControl,
    treatments,
    hasUnverifiedPrices: products.some((product) => !product.isVerified),
  };
}
