-- AlterTable
-- הצמח שהמודל זיהה לא תאם לגידול של החלקה
ALTER TABLE "diagnoses" ADD COLUMN "cropMismatch" BOOLEAN NOT NULL DEFAULT false;
