/**
 * GET /api/library - ספריית המחלות: כל 38 המצבים שהמודל מזהה,
 * עם שמות בעברית ובאנגלית, שם מדעי, סוג הגורם, תסמינים, מניעה, והמלצות טיפול עם מחירים בשקלים.
 */

import type { LibraryEntry, LibraryResponse } from "@cropguard/shared-types";
import { Router } from "express";

import { requireAuth } from "../auth/middleware.js";
import type { AppDeps } from "../app.js";
import { DISEASES, describeDisease, plantOfLabel } from "../i18n/diseases.js";
import { LIBRARY, PATHOGEN_TYPE_HE } from "../i18n/library.js";
import { buildAllTreatmentPlans } from "../services/treatments.js";

/** שם באנגלית מתוך התווית, כמו ששירות ה-AI מחזיר: "Tomato___Late_blight" -> "Tomato Late blight" */
function englishName(modelLabel: string): string {
  const [plant = modelLabel, condition = ""] = modelLabel.split("___");
  return `${plant.replaceAll("_", " ")} ${condition.replaceAll("_", " ")}`.trim();
}

/** בונה את נתיב ספריית המחלות */
export function libraryRouter({ prisma, config }: AppDeps): Router {
  const router = Router();
  router.use(requireAuth(prisma, config.jwtSecret));

  // ★ התאמה לשוק הישראלי: הקטלוג המלא - תוכן בעברית מהקוד + המלצות ומחירים בשקלים מהמסד, בשתי שאילתות בלבד
  router.get("/", async (_request, response) => {
    const labels = Object.keys(DISEASES).map((modelLabel) => ({
      modelLabel,
      isHealthy: LIBRARY[modelLabel]?.pathogenType === "healthy",
    }));
    const plans = await buildAllTreatmentPlans(prisma, labels);

    const entries: LibraryEntry[] = labels.map(({ modelLabel }) => {
      const content = LIBRARY[modelLabel]!;
      const plan = plans.get(modelLabel)!;
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

    const body: LibraryResponse = { entries };
    // התוכן משתנה רק עם seed; אפשר לשמור בדפדפן כמה דקות
    response.set("Cache-Control", "private, max-age=300");
    response.json(body);
  });

  return router;
}
