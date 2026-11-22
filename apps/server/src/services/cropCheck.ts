/**
 * ★ מנגנון ליבה של CropGuard - Crop Mismatch Guard.
 * בדיקת התאמה בין מה שהמודל ראה לבין הגידול של החלקה.
 *
 * הבעיה: המודל הוא "מסווג סגור" - הוא מכיר 38 מצבים ב-14 גידולים, ותמיד בוחר אחד מהם,
 * גם כשמצלמים צמח שהוא לא מכיר (למשל כרוב), ולפעמים בביטחון גבוה.
 * החקלאי יודע מה מגדלים בחלקה, ולכן משווים לזה:
 *   - כמה מההסתברות של המודל נופלת על הגידול של החלקה
 *   - האם הצמח של התחזית המובילה הוא הגידול של החלקה
 *   - מהן האפשרויות הסבירות ביותר בתוך הגידול של החלקה
 */

import type { ClassScore, CropCheck } from "@cropguard/shared-types";

import { DISEASES, describeDisease, plantHe, plantOfLabel } from "../i18n/diseases.js";

/** כל הגידולים שהמודל מכיר (מתוך 38 התוויות) */
const SUPPORTED_CROPS = new Set(Object.keys(DISEASES).map(plantOfLabel));

const IN_FIELD_CROP_OPTIONS = 3;

/**
 * ★ מנגנון ליבה של CropGuard - Crop Mismatch Guard.
 * מקבל את הגידול של החלקה ואת כל 38 ההסתברויות, ומחזיר:
 *   - fieldCropSharePercent: כמה מההסתברות נופלת על הגידול של החלקה
 *   - matches: האם הצמח של התחזית המובילה הוא הגידול של החלקה
 *   - inFieldCrop: האפשרויות הסבירות בתוך הגידול הנכון
 * באי-התאמה, נתיב האבחון חוסם המלצות ריסוס ומסמן את האבחון כלא ודאי.
 */
export function checkCrop(fieldCrop: string, topLabel: string, scores: readonly ClassScore[]): CropCheck {
  const predictedPlant = plantOfLabel(topLabel);
  const supported = SUPPORTED_CROPS.has(fieldCrop);
  const inCrop = scores
    .filter((score) => plantOfLabel(score.model_label) === fieldCrop)
    .sort((a, b) => b.confidence - a.confidence);
  const share = inCrop.reduce((sum, score) => sum + score.confidence, 0);

  return {
    fieldCrop,
    fieldCropHe: plantHe(fieldCrop),
    predictedPlant,
    predictedPlantHe: plantHe(predictedPlant),
    supported,
    // גידול שהמודל לא מכיר לא יכול "להתאים"
    matches: supported && predictedPlant === fieldCrop,
    fieldCropSharePercent: Math.round(share * 1000) / 10,
    inFieldCrop: inCrop.slice(0, IN_FIELD_CROP_OPTIONS).map((score) => ({
      disease: describeDisease(score.model_label, score.disease),
      confidencePercent: Math.round(score.confidence * 1000) / 10,
    })),
  };
}

/** אזהרה בעברית כשאין התאמה (או null כשיש) */
export function cropWarningHe(check: CropCheck): string | null {
  if (!check.supported) {
    return `הגידול של החלקה (${check.fieldCropHe}) אינו אחד מהגידולים שהמודל מכיר, ולכן האבחון אינו אמין. אין להסתמך עליו לטיפול.`;
  }
  if (!check.matches) {
    return (
      `החלקה מוגדרת כ${check.fieldCropHe}, אבל המודל זיהה ${check.predictedPlantHe}. ` +
      "ייתכן שבתמונה צמח אחר (המודל מכיר רק 14 גידולים) או שהמודל טועה. " +
      "צלמו שוב עלה בודד של הגידול, או התייעצו עם מדריך."
    );
  }
  return null;
}

/** ההנחיה שמוצגת במקום המלצת טיפול כשאין התאמה - לא ממליצים על ריסוס לגידול הלא נכון */
export const CROP_MISMATCH_GUIDANCE_HE =
  "לא מוצגות המלצות ריסוס, כי הצמח שזוהה לא תואם לגידול של החלקה. " +
  "ודאו שצילמתם עלה של הגידול הנכון ונסו שוב; אם הבעיה נמשכת, פנו למדריך הגנת הצומח.";
