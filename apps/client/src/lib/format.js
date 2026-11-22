/**
 * עיצוב מספרים, מחירים ותאריכים בעברית.
 */

const shekel = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });

/** טווח מחירים בשקלים: "₪110–180", או מחיר בודד "₪45" */
export function formatPriceRange(min, max) {
  return min === max ? `₪${shekel.format(min)}` : `₪${shekel.format(min)}–${shekel.format(max)}`;
}

/** אחוז עם ספרה אחת אחרי הנקודה, בלי ".0" מיותר: 89.95 -> "90%", 42.5 -> "42.5%" */
export function formatPercent(value) {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

const dateTime = new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeStyle: "short" });

/** תאריך ושעה בעברית, למשל "22 בנוב׳ 2026, 12:39" */
export function formatDateTime(iso) {
  return dateTime.format(new Date(iso));
}

const dateOnly = new Intl.DateTimeFormat("he-IL", { dateStyle: "medium" });

/** תאריך בלבד בעברית */
export function formatDate(iso) {
  return dateOnly.format(new Date(iso));
}

// תאריך בלבד ("YYYY-MM-DD") מוצג ב-UTC, כדי שאזור הזמן של הדפדפן לא יזיז אותו ביום
const calendarDate = new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeZone: "UTC" });

/** תאריך בלבד בעברית מ-"YYYY-MM-DD" (תאריכי שתילה, ריסוס וקטיף), למשל "29 בנוב׳ 2026" */
export function formatCalendarDate(value) {
  return calendarDate.format(new Date(`${value}T00:00:00.000Z`));
}

/** הוספת ימים לתאריך "YYYY-MM-DD" - אותו חישוב כמו בשרת (services/phi.js), לתצוגה מקדימה בטופס */
export function addDays(value, days) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** שמות התפקידים בעברית לתצוגה */
export const ROLE_LABELS_HE = {
  FARMER: "חקלאי",
  AGRONOMIST: "אגרונום",
  ADMIN: "מנהל מערכת",
};

/** קואורדינטות בתצוגה מקוצרת: "31.2500, 34.7900" */
export function formatCoordinates(latitude, longitude) {
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}
