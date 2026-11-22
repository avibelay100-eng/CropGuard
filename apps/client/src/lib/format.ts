/**
 * עיצוב מספרים, מחירים ותאריכים בעברית.
 */

import type { UserRole } from "@cropguard/shared-types";

const shekel = new Intl.NumberFormat("he-IL", { maximumFractionDigits: 0 });

/** טווח מחירים בשקלים: "₪110–180", או מחיר בודד "₪45" */
export function formatPriceRange(min: number, max: number): string {
  return min === max ? `₪${shekel.format(min)}` : `₪${shekel.format(min)}–${shekel.format(max)}`;
}

/** אחוז עם ספרה אחת אחרי הנקודה, בלי ".0" מיותר: 89.95 -> "90%", 42.5 -> "42.5%" */
export function formatPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(1)}%`;
}

const dateTime = new Intl.DateTimeFormat("he-IL", { dateStyle: "medium", timeStyle: "short" });

export function formatDateTime(iso: string): string {
  return dateTime.format(new Date(iso));
}

export const ROLE_LABELS_HE: Record<UserRole, string> = {
  FARMER: "חקלאי",
  AGRONOMIST: "אגרונום",
  ADMIN: "מנהל מערכת",
};

/** קואורדינטות בתצוגה מקוצרת: "31.2500, 34.7900" */
export function formatCoordinates(latitude: number, longitude: number): string {
  return `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`;
}
