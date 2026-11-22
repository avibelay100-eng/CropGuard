/**
 * ★ מילוי אוטומטי של יומן השדה מכרטיס האבחון.
 * מסך הסריקה מעביר את זה ביומן דרך ה-state של הניווט (לא בכתובת - אין סיבה שזה יופיע בהיסטוריית הדפדפן).
 * אחרי רענון ה-state נעלם, והטופס פשוט נפתח ריק - שום דבר לא נשבר.
 */

/**
 * תכשיר מההמלצה, עם ימי ההמתנה שלו (ערך דוגמה שהחקלאי חייב לאמת מול התווית)
 * @typedef {object} PrefillOption
 * @property {string} productName
 * @property {string} activeIngredient
 * @property {string} activeIngredientHe
 * @property {number | null} phiDays
 */

/**
 * מה שעובר מכרטיס האבחון לטופס היומן
 * @typedef {object} JournalPrefill
 * @property {string} diagnosisId
 * @property {string} diseaseNameHe - למשל "עגבנייה – כימשון"
 * @property {PrefillOption[]} options
 */

/** בונה את המילוי מתשובת האבחון: כל המוצרים של כל החומרים המומלצים, לפי סדר ההמלצה */
export function prefillFromDiagnosis(result) {
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
export function readPrefill(state) {
  const prefill = (state)?.prefill;
  return prefill && typeof prefill.diagnosisId === "string" && Array.isArray(prefill.options) ? prefill : null;
}
