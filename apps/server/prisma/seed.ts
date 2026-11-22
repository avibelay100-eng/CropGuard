/**
 * סקריפט Seed: טוען למסד הנתונים את מילון המחירים ואת החומרים המומלצים לכל מחלה.
 *
 * הרצה (מתוך apps/server, אחרי npm run db:migrate):
 *     npm run db:seed
 *
 * הסקריפט אידמפוטנטי - אפשר להריץ אותו שוב ושוב: שורות קיימות מתעדכנות (upsert)
 * ולא נוצרות כפילויות. הוא לא מוחק שורות שנוספו ידנית.
 * הפונקציה seedReferenceData משמשת גם את הבדיקות.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import { createPrismaClient } from "../src/db.js";
import type { PrismaClient } from "../src/generated/prisma/client.js";
import { PRODUCT_PRICES } from "./data/productPrices.js";
import { TREATMENTS } from "./data/treatments.js";

/** טוען את נתוני הבסיס (מחירים והמלצות) בטרנזקציה אחת */
export async function seedReferenceData(prisma: PrismaClient): Promise<void> {
  // הכול בטרנזקציה אחת: או שהכול נטען, או ששום דבר לא משתנה
  await prisma.$transaction(async (tx) => {
    for (const product of PRODUCT_PRICES) {
      await tx.productPriceRange.upsert({
        where: {
          activeIngredient_productName_packageSize: {
            activeIngredient: product.activeIngredient,
            productName: product.productName,
            packageSize: product.packageSize,
          },
        },
        create: product,
        update: product,
      });
    }

    for (const treatment of TREATMENTS) {
      await tx.treatmentRecommendation.upsert({
        where: { modelLabel: treatment.modelLabel },
        create: treatment,
        update: treatment,
      });
    }
  });
}

async function main(): Promise<void> {
  const prisma = createPrismaClient();
  try {
    await seedReferenceData(prisma);
    const unverified = PRODUCT_PRICES.filter((product) => !product.isVerified).length;
    console.log(`Seeded ${PRODUCT_PRICES.length} product price ranges and ${TREATMENTS.length} treatment recommendations.`);
    if (unverified > 0) {
      console.warn(`Warning: ${unverified} price ranges are placeholders (isVerified=false) - replace them with a real price list.`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

// מריצים את main רק כשהקובץ מורץ ישירות (ולא כשהבדיקות מייבאות אותו)
const isDirectRun = process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main().catch((err: unknown) => {
    console.error("Seed failed:", err);
    process.exit(1);
  });
}
