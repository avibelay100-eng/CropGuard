/**
 * סוגי הגידולים שמודל ה-AI מכיר. הערך נשמר באנגלית (כמו שם הצמח בתוויות המודל),
 * והתצוגה בעברית.
 */

export const CROPS: ReadonlyArray<{ value: string; labelHe: string }> = [
  { value: "Tomato", labelHe: "עגבנייה" },
  { value: "Potato", labelHe: "תפוח אדמה" },
  { value: "Pepper, bell", labelHe: "פלפל" },
  { value: "Corn", labelHe: "תירס" },
  { value: "Grape", labelHe: "גפן" },
  { value: "Apple", labelHe: "תפוח" },
  { value: "Orange", labelHe: "תפוז" },
  { value: "Peach", labelHe: "אפרסק" },
  { value: "Cherry", labelHe: "דובדבן" },
  { value: "Strawberry", labelHe: "תות שדה" },
  { value: "Squash", labelHe: "דלעת" },
  { value: "Blueberry", labelHe: "אוכמנית" },
  { value: "Raspberry", labelHe: "פטל" },
  { value: "Soybean", labelHe: "סויה" },
];

/** שם הגידול בעברית; גידול לא מוכר מוצג כמו שהוא */
export function cropLabelHe(value: string): string {
  return CROPS.find((crop) => crop.value === value)?.labelHe ?? value;
}
