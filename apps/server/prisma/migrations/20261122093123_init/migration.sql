-- CreateEnum
CREATE TYPE "Role" AS ENUM ('FARMER', 'AGRONOMIST', 'ADMIN');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'FARMER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fields" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cropType" TEXT NOT NULL,
    "latitude" DOUBLE PRECISION NOT NULL,
    "longitude" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ownerId" TEXT NOT NULL,

    CONSTRAINT "fields_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "diagnoses" (
    "id" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL,
    "modelLabel" TEXT NOT NULL,
    "diseaseName" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "isHealthy" BOOLEAN NOT NULL,
    "activeIngredient" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fieldId" TEXT NOT NULL,

    CONSTRAINT "diagnoses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_price_ranges" (
    "id" TEXT NOT NULL,
    "activeIngredient" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "packageSize" TEXT NOT NULL,
    "minPriceILS" DECIMAL(10,2) NOT NULL,
    "maxPriceILS" DECIMAL(10,2) NOT NULL,
    "isVerified" BOOLEAN NOT NULL DEFAULT false,
    "priceSource" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_price_ranges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "treatment_recommendations" (
    "id" TEXT NOT NULL,
    "modelLabel" TEXT NOT NULL,
    "activeIngredients" TEXT[],
    "chemicalControl" BOOLEAN NOT NULL,
    "note" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "treatment_recommendations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "fields_ownerId_idx" ON "fields"("ownerId");

-- CreateIndex
CREATE INDEX "diagnoses_fieldId_createdAt_idx" ON "diagnoses"("fieldId", "createdAt");

-- CreateIndex
CREATE INDEX "diagnoses_modelLabel_idx" ON "diagnoses"("modelLabel");

-- CreateIndex
CREATE INDEX "product_price_ranges_activeIngredient_idx" ON "product_price_ranges"("activeIngredient");

-- CreateIndex
CREATE UNIQUE INDEX "product_price_ranges_activeIngredient_productName_packageSi_key" ON "product_price_ranges"("activeIngredient", "productName", "packageSize");

-- CreateIndex
CREATE UNIQUE INDEX "treatment_recommendations_modelLabel_key" ON "treatment_recommendations"("modelLabel");

-- AddForeignKey
ALTER TABLE "fields" ADD CONSTRAINT "fields_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "diagnoses" ADD CONSTRAINT "diagnoses_fieldId_fkey" FOREIGN KEY ("fieldId") REFERENCES "fields"("id") ON DELETE CASCADE ON UPDATE CASCADE;
