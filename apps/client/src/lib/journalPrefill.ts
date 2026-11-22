/**
 * ★ מילוי אוטומטי של יומן השדה מכרטיס האבחון.
 * מסך הסריקה מעביר את זה ביומן דרך ה-state של הניווט (לא בכתובת - אין סיבה שזה יופיע בהיסטוריית הדפדפן).
 * אחרי רענון ה-state נעלם, והטופס פשוט נפתח ריק - שום דבר לא נשבר.
 */

import type { DiagnoseResponse } from "@cropguard/shared-types";

/** תכשיר מההמלצה, עם ימי ההמתנה שלו (ערך דוגמה שהחקלאי חייב לאמת מול התווית) */
export interface PrefillOption {
  productName: string;
  activeIngredient: string;
  activeIngredientHe: string;
  phiDays: number | null;
}

/** מה שעובר מכרטיס האבחון לטופס היומן */
export interface JournalPrefill {
  diagnosisId: string;
  /** למשל "עגבנייה – כימשון" */
  diseaseNameHe: string;
  options: PrefillOption[];
}

/** בונה את המילוי מתשובת האבחון: כל המוצרים של כל החומרים המומלצים, לפי סדר ההמלצה */
export function prefillFromDiagnosis(result: DiagnoseResponse): JournalPrefill {
  return {
    diagnosisId: result.diagnosis.id,
    diseaseNameHe: result.disease.displayNameHe,
    options: result.treatments.flatMap((treatment) =>
      treatment.products.map((product) => ({
        productName: product.productName,
        activeIngredient: treatment.activeIngredient,
        activeIngredientHe: treatment.activeIngredientHe,
        phiDays: product.phiDays,
      })),
    ),
  };
}

/** קורא את המילוי מה-state של הניווט, ובודק שהצורה נכונה (state יכול להיות כל דבר) */
export function readPrefill(state: unknown): JournalPrefill | null {
  const prefill = (state as { prefill?: JournalPrefill } | null)?.prefill;
  return prefill && typeof prefill.diagnosisId === "string" && Array.isArray(prefill.options) ? prefill : null;
}
