/**
 * בניית קטלוג ספריית המחלות: תוכן בעברית מהקוד (i18n) + המלצות ומחירים בשקלים מהמסד.
 * משמש את GET /api/library ואת סקריפט ייצוא נתוני ההדגמה (scripts/export-demo-data.js),
 * כך שגרסת ההדגמה מציגה בדיוק את אותו תוכן כמו המערכת האמיתית.
 */

import { DISEASES, describeDisease, plantOfLabel } from "../i18n/diseases.js";
import { LIBRARY, PATHOGEN_TYPE_HE } from "../i18n/library.js";
import { buildAllTreatmentPlans } from "./treatments.js";

/** שם באנגלית מתוך התווית, כמו ששירות ה-AI מחזיר: "Tomato___Late_blight" -> "Tomato Late blight" */
function englishName(modelLabel) {
  const [plant = modelLabel, condition = ""] = modelLabel.split("___");
  return `${plant.replaceAll("_", " ")} ${condition.replaceAll("_", " ")}`.trim();
}

/** ★ התאמה לשוק הישראלי: כל 38 הרשומות - בשתי שאילתות בלבד */
export async function buildLibraryEntries(prisma) {
  const labels = Object.keys(DISEASES).map((modelLabel) => ({
    modelLabel,
    isHealthy: LIBRARY[modelLabel]?.pathogenType === "healthy",
  }));
  const plans = await buildAllTreatmentPlans(prisma, labels);

  return labels.map(({ modelLabel }) => {
    const content = LIBRARY[modelLabel];
    const plan = plans.get(modelLabel);
    return {
      disease: describeDisease(modelLabel, englishName(modelLabel)),
      plant: plantOfLabel(modelLabel),
      pathogenType: content.pathogenType,
      pathogenTypeHe: PATHOGEN_TYPE_HE[content.pathogenType],
      symptomsHe: content.symptomsHe,
      preventionHe: content.preventionHe,
      guidanceHe: plan.guidanceHe,
      chemicalControl: plan.chemicalControl,
      treatments: plan.treatments,
      sources: content.sources,
    };
  });
}
