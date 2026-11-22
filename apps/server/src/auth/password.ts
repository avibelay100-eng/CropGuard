/**
 * גיבוב ובדיקת סיסמאות עם bcrypt.
 * הסיסמה עצמה לא נשמרת בשום מקום - רק הגיבוב שלה.
 */

import bcrypt from "bcrypt";

export function hashPassword(password: string, rounds: number): Promise<string> {
  return bcrypt.hash(password, rounds);
}

export function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// גיבוב "דמה" לבדיקה כשהמשתמש לא קיים: כך התחברות עם אימייל לא קיים לוקחת
// אותו זמן כמו סיסמה שגויה, ותוקף לא יכול לגלות לפי הזמן אילו אימיילים רשומים.
let dummyHash: Promise<string> | null = null;

export function dummyPasswordCheck(password: string, rounds: number): Promise<boolean> {
  dummyHash ??= bcrypt.hash("cropguard-dummy-password", rounds);
  return dummyHash.then((hash) => bcrypt.compare(password, hash)).then(() => false);
}
