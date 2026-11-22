/**
 * הצגת תוכן מסד הנתונים בטרמינל - דרך מהירה לבדוק שה-migrate וה-seed עבדו.
 *
 * הרצה (מתוך apps/server):
 *     npm run db:show
 *
 * הסקריפט רק קורא, ולא משנה שום נתון.
 */

import { createPrismaClient } from "../src/db.js";

const prisma = createPrismaClient();

try {
  // 1. כמה שורות יש בכל טבלה
  const [users, fields, diagnoses, prices, treatments] = await Promise.all([
    prisma.user.count(),
    prisma.field.count(),
    prisma.diagnosis.count(),
    prisma.productPriceRange.count(),
    prisma.treatmentRecommendation.count(),
  ]);
  console.log("\n=== Row counts ===");
  console.table({
    User: users,
    Field: fields,
    Diagnosis: diagnoses,
    ProductPriceRange: prices,
    TreatmentRecommendation: treatments,
  });

  // 2. מילון המחירים
  const priceRows = await prisma.productPriceRange.findMany({
    orderBy: [{ activeIngredient: "asc" }, { productName: "asc" }],
  });
  console.log("\n=== ProductPriceRange (price dictionary) ===");
  console.table(
    priceRows.map((row) => ({
      activeIngredient: row.activeIngredient,
      product: row.productName,
      package: row.packageSize,
      "min ILS": Number(row.minPriceILS),
      "max ILS": Number(row.maxPriceILS),
      verified: row.isVerified,
    })),
  );

  // 3. החומרים המומלצים לכל מחלה
  const treatmentRows = await prisma.treatmentRecommendation.findMany({ orderBy: { modelLabel: "asc" } });
  console.log("\n=== TreatmentRecommendation ===");
  console.table(
    treatmentRows.map((row) => ({
      disease: row.modelLabel,
      chemicalControl: row.chemicalControl,
      activeIngredients: row.activeIngredients.join(", ") || "-",
    })),
  );

  // 4. אבחונים אחרונים (אם יש)
  if (diagnoses > 0) {
    const recent = await prisma.diagnosis.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: { field: { select: { name: true } } },
    });
    console.log("\n=== Latest diagnoses ===");
    console.table(
      recent.map((row) => ({
        field: row.field.name,
        disease: row.diseaseName,
        confidence: `${(row.confidence * 100).toFixed(1)}%`,
        healthy: row.isHealthy,
        createdAt: row.createdAt.toISOString(),
      })),
    );
  }
} finally {
  await prisma.$disconnect();
}
