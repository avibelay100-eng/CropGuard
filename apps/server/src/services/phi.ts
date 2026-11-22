/**
 * ★ מנגנון ליבה של CropGuard - PHI (Pre-Harvest Interval, ימי המתנה לקטיף).
 *
 * אחרי ריסוס אסור לקטוף עד שעוברים ימי ההמתנה שבתווית התכשיר - אחרת נשארים שאריות
 * חומר הדברה בפרי. התאריך הראשון שבו מותר לקטוף הוא: תאריך הריסוס + ימי ההמתנה.
 *
 * הכול כאן עובד עם "תאריכים בלבד" (מחרוזות "YYYY-MM-DD"), לפי לוח השנה בישראל:
 * ריסוס ב-23:30 שעון ישראל הוא ריסוס של "היום" בישראל, גם אם ב-UTC זה כבר מחר.
 * במסד התאריכים נשמרים כ-DATE (בלי שעה), ש-Prisma מחזיר כחצות UTC.
 */

/** אזור הזמן של החקלאים - קובע מה זה "היום" */
export const FARM_TIME_ZONE = "Asia/Jerusalem";

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

/** התאריך של היום בישראל, "YYYY-MM-DD" (en-CA מחזיר בדיוק את הפורמט הזה) */
export function todayInIsrael(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: FARM_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** האם המחרוזת היא תאריך קיים בפורמט "YYYY-MM-DD" (למשל 2026-02-30 נדחה) */
export function isValidDateOnly(value: string): boolean {
  if (!DATE_ONLY.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().startsWith(value);
}

/** "YYYY-MM-DD" -> Date בחצות UTC, כמו ש-Prisma שומר עמודת DATE */
export function parseDateOnly(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

/** Date מעמודת DATE -> "YYYY-MM-DD"; null נשאר null */
export function formatDateOnly(date: Date | null): string | null {
  return date ? date.toISOString().slice(0, 10) : null;
}

/** הוספת ימים לתאריך "YYYY-MM-DD" (חישוב ב-UTC, כך שאין קפיצות של שעון קיץ) */
export function addDays(value: string, days: number): string {
  const date = parseDateOnly(value);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** תאריך הקטיף המותר: תאריך הריסוס + ימי ההמתנה */
export function safeHarvestDate(appliedOn: string, phiDays: number): string {
  return addDays(appliedOn, phiDays);
}
