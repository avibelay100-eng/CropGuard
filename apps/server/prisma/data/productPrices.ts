/**
 * מילון המחירים: מוצרים מסחריים לכל חומר פעיל, עם טווח מחירים בשקלים.
 *
 * ⚠️ חשוב: המחירים כאן הם ערכי דוגמה (placeholder) ולא מחירון אמיתי.
 * לכן כל השורות מסומנות isVerified: false. לפני שמציגים מחירים למשתמשים
 * יש להחליף אותם במחירון עדכני של ספק או חנות חקלאית, ולשנות את isVerified ל-true
 * ואת priceSource למקור האמיתי.
 *
 * שמות המוצרים הם מותגים מסחריים מוכרים של החומרים הפעילים; זמינות ורישום
 * בישראל לכל גידול צריכים אימות מול רשימת התכשירים הרשומים של משרד החקלאות.
 *
 * ⚠️ גם ימי ההמתנה לקטיף (phiDays) הם ערכי דוגמה: ה-PHI האמיתי מופיע בתווית התכשיר
 * ומשתנה לפי הגידול. לכן יומן השדה מחייב את החקלאי לאשר שבדק את התווית לפני שמירת ריסוס.
 */

export interface ProductPriceSeed {
  /** שם החומר הפעיל באנגלית, באותיות קטנות (כמו ב-treatments.ts) */
  activeIngredient: string;
  productName: string;
  /** גודל האריזה שהמחיר מתייחס אליו */
  packageSize: string;
  minPriceILS: number;
  maxPriceILS: number;
  isVerified: boolean;
  priceSource: string;
  /** PHI - ימי המתנה לקטיף לפי התווית (ערך דוגמה, לא מאומת) */
  phiDays: number;
}

const PLACEHOLDER_SOURCE = "placeholder - not a real price list, must be verified";

/** קיצור לשורה עם מחיר דוגמה שעוד לא אומת */
function placeholder(
  activeIngredient: string,
  productName: string,
  packageSize: string,
  minPriceILS: number,
  maxPriceILS: number,
  phiDays: number,
): ProductPriceSeed {
  return {
    activeIngredient,
    productName,
    packageSize,
    minPriceILS,
    maxPriceILS,
    isVerified: false,
    priceSource: PLACEHOLDER_SOURCE,
    phiDays,
  };
}

/**
 * ★ התאמה לשוק הישראלי: מילון המחירים בשקלים. כל השורות isVerified: false - ערכי דוגמה עד שיוחלפו במחירון ספק.
 * כסף נשמר במסד כ-Decimal(10,2) ולא כ-Float, כדי שלא יהיו שגיאות עיגול.
 */
// המספר האחרון בכל שורה: ימי המתנה לקטיף (PHI)
export const PRODUCT_PRICES: readonly ProductPriceSeed[] = [
  // --- קוטלי פטריות מגע ---
  placeholder("mancozeb", "Dithane M-45", "1 kg", 45, 75, 7),
  placeholder("captan", "Merpan 80 WDG", "1 kg", 70, 110, 7),
  placeholder("chlorothalonil", "Bravo 720 SC", "1 L", 80, 130, 7),
  placeholder("copper hydroxide", "Kocide 2000", "1 kg", 60, 100, 3),
  placeholder("sulfur", "Thiovit Jet", "1 kg", 20, 40, 3),

  // --- קוטלי פטריות סיסטמיים ---
  placeholder("azoxystrobin", "Amistar 250 SC", "1 L", 250, 400, 7),
  placeholder("pyraclostrobin", "Headline", "1 L", 280, 450, 7),
  placeholder("propiconazole", "Tilt 250 EC", "1 L", 150, 250, 14),
  placeholder("difenoconazole", "Score 250 EC", "1 L", 200, 330, 7),
  placeholder("myclobutanil", "Systhane 20 EW", "1 L", 180, 300, 14),

  // --- נגד כימשון (פטריות דמויות) ---
  placeholder("metalaxyl-m + mancozeb", "Ridomil Gold MZ", "1 kg", 110, 180, 7),
  placeholder("cymoxanil + mancozeb", "Curzate M", "1 kg", 70, 120, 7),
  placeholder("mandipropamid", "Revus 250 SC", "1 L", 300, 480, 3),

  // --- קוטל אקריות ---
  placeholder("abamectin", "Vertimec 1.8 EC", "1 L", 150, 260, 7),
];
