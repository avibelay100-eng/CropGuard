/**
 * בניית המלצת הטיפול לאבחון: הנחיה בעברית, חומרים פעילים, ומוצרים עם טווח מחירים בשקלים.
 * הנתונים מגיעים מהטבלאות TreatmentRecommendation ו-ProductPriceRange (שנטענו ב-seed).
 */

import type { TreatmentOption } from "@cropguard/shared-types";

import type { PrismaClient } from "../generated/prisma/client.js";
import { activeIngredientHe } from "../i18n/activeIngredients.js";

/** תוכנית טיפול לאבחון: הנחיה בעברית, האם יש טיפול כימי, חומרים ומוצרים, והאם יש מחיר לא מאומת */
export interface TreatmentPlan {
  guidanceHe: string;
  chemicalControl: boolean;
  treatments: TreatmentOption[];
  /** true אם לפחות מחיר אחד בתשובה עוד לא אומת */
  hasUnverifiedPrices: boolean;
}

/** ההנחיה לעלה בריא - בלי המלצות ריסוס */
export const HEALTHY_GUIDANCE_HE =
  "העלה נראה בריא. אין צורך בטיפול נגד מחלות על סמך התמונה; המשיכו בהשקיה ובדישון מאוזנים ובמעקב שוטף.";

/** הנחיה כשאין המלצה במסד לתווית (לא אמור לקרות - בדיקה מוודאת כיסוי מלא) */
export const MISSING_GUIDANCE_HE =
  "לא נמצאה המלצת טיפול למחלה הזו במערכת. מומלץ להתייעץ עם מדריך הגנת הצומח.";

/** ★ התאמה לשוק הישראלי: תוכנית טיפול לתווית אחת - ההמלצה מהמסד, והמוצרים עם טווחי מחירים בשקלים */
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

  return composePlan(recommendation, products);
}

/**
 * תוכניות טיפול לכמה תוויות בבת אחת, בשתי שאילתות בלבד (לספריית המחלות),
 * במקום שתי שאילתות לכל תווית.
 */
export async function buildAllTreatmentPlans(
  prisma: PrismaClient,
  labels: ReadonlyArray<{ modelLabel: string; isHealthy: boolean }>,
): Promise<Map<string, TreatmentPlan>> {
  const [recommendations, products] = await Promise.all([
    prisma.treatmentRecommendation.findMany(),
    prisma.productPriceRange.findMany({ orderBy: [{ minPriceILS: "asc" }, { productName: "asc" }] }),
  ]);
  const byLabel = new Map(recommendations.map((recommendation) => [recommendation.modelLabel, recommendation]));

  return new Map(
    labels.map(({ modelLabel, isHealthy }) => {
      if (isHealthy) {
        return [modelLabel, { guidanceHe: HEALTHY_GUIDANCE_HE, chemicalControl: false, treatments: [], hasUnverifiedPrices: false }];
      }
      const recommendation = byLabel.get(modelLabel);
      if (!recommendation) {
        return [modelLabel, { guidanceHe: MISSING_GUIDANCE_HE, chemicalControl: false, treatments: [], hasUnverifiedPrices: false }];
      }
      const relevant = products.filter((product) => recommendation.activeIngredients.includes(product.activeIngredient));
      return [modelLabel, composePlan(recommendation, relevant)];
    }),
  );
}

type Recommendation = Awaited<ReturnType<PrismaClient["treatmentRecommendation"]["findFirstOrThrow"]>>;
type Product = Awaited<ReturnType<PrismaClient["productPriceRange"]["findFirstOrThrow"]>>;

/** מרכיב תוכנית טיפול מהמלצה ומהמוצרים הרלוונטיים */
function composePlan(recommendation: Recommendation, products: Product[]): TreatmentPlan {
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
