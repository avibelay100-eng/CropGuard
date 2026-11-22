-- CreateEnum
CREATE TYPE "CultivationMethod" AS ENUM ('OPEN_FIELD', 'NET_HOUSE', 'GREENHOUSE', 'TUNNEL');

-- CreateEnum
CREATE TYPE "IrrigationMethod" AS ENUM ('DRIP', 'SPRINKLER');

-- CreateEnum
CREATE TYPE "FieldLogType" AS ENUM ('SPRAY', 'FERTILIZE', 'IRRIGATE');

-- AlterTable
ALTER TABLE "fields" ADD COLUMN     "areaDunams" DOUBLE PRECISION,
ADD COLUMN     "cultivationMethod" "CultivationMethod",
ADD COLUMN     "expectedHarvestDate" DATE,
ADD COLUMN     "irrigationMethod" "IrrigationMethod",
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "plantingDate" DATE,
ADD COLUMN     "variety" TEXT;

-- AlterTable
ALTER TABLE "product_price_ranges" ADD COLUMN     "phiDays" INTEGER;

-- CreateTable
CREATE TABLE "field_logs" (
    "id" TEXT NOT NULL,
    "type" "FieldLogType" NOT NULL,
    "appliedOn" DATE NOT NULL,
    "productName" TEXT,
    "activeIngredient" TEXT,
    "dosePerDunam" DOUBLE PRECISION,
    "doseUnit" TEXT,
    "phiDays" INTEGER,
    "safeHarvestDate" DATE,
    "modelLabel" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fieldId" TEXT NOT NULL,
    "diagnosisId" TEXT,

    CONSTRAINT "field_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "field_logs_fieldId_appliedOn_idx" ON "field_logs"("fieldId", "appliedOn");

-- CreateIndex
CREATE INDEX "field_logs_fieldId_safeHarvestDate_idx" ON "field_logs"("fieldId", "safeHarvestDate");

-- AddForeignKey
ALTER TABLE "field_logs" ADD CONSTRAINT "field_logs_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_logs" ADD CONSTRAINT "field_logs_diagnosisId_fkey" FOREIGN KEY ("diagnosisId") REFERENCES "diagnoses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
