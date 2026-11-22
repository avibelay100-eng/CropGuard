/**
 * ★ התאמה לשוק הישראלי: שמות בעברית לפרטי החלקה וליומן השדה.
 * הערכים עצמם (באנגלית) הם מה שנשמר בשרת; כאן רק התצוגה.
 */

/** שיטות הגידול הנפוצות בישראל */
export const CULTIVATION_METHODS = [
  { value: "OPEN_FIELD", labelHe: "שטח פתוח" },
  { value: "NET_HOUSE", labelHe: "בית רשת" },
  { value: "GREENHOUSE", labelHe: "חממה" },
  { value: "TUNNEL", labelHe: "מנהרות" },
];

/** שיטות השקיה */
export const IRRIGATION_METHODS = [
  { value: "DRIP", labelHe: "טפטוף" },
  { value: "SPRINKLER", labelHe: "המטרה" },
];

/** סוגי הרשומות ביומן השדה */
export const FIELD_LOG_TYPES = [
  { value: "SPRAY", labelHe: "ריסוס" },
  { value: "FERTILIZE", labelHe: "דישון" },
  { value: "IRRIGATE", labelHe: "השקיה" },
];

/** יחידות מינון לדונם - כמו שהן כתובות על תוויות בעברית */
export const DOSE_UNITS = [
  { value: "g", labelHe: "גרם" },
  { value: "ml", labelHe: 'סמ"ק' },
  { value: "kg", labelHe: 'ק"ג' },
  { value: "L", labelHe: "ליטר" },
  { value: "m3", labelHe: 'מ"ק' },
];

/** מחפש את השם בעברית ברשימה; ערך לא מוכר מוצג כמו שהוא */
function labelOf(list, value) {
  return list.find((item) => item.value === value)?.labelHe ?? value;
}

// השם בעברית של כל ערך - לתצוגה ברשימת החלקות וביומן
export const cultivationLabelHe = (value) => labelOf(CULTIVATION_METHODS, value);
export const irrigationLabelHe = (value) => labelOf(IRRIGATION_METHODS, value);
export const logTypeLabelHe = (value) => labelOf(FIELD_LOG_TYPES, value);
export const doseUnitLabelHe = (value) => labelOf(DOSE_UNITS, value);

/** שטח בדונמים לתצוגה: "12.5 דונם", ודונם אחד בלשון יחיד */
export function formatDunams(value) {
  return value === 1 ? "דונם אחד" : `${new Intl.NumberFormat("he-IL", { maximumFractionDigits: 2 }).format(value)} דונם`;
}
