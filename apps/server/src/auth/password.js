/**
 * גיבוב ובדיקת סיסמאות עם bcrypt.
 * הסיסמה עצמה לא נשמרת בשום מקום - רק הגיבוב שלה.
 */

import bcrypt from "bcrypt";

/** גיבוב סיסמה חדשה. rounds = עלות החישוב (12 בייצור) - כך ניחוש בכוח איטי מאוד */
export function hashPassword(password, rounds) {
  return bcrypt.hash(password, rounds);
}

/** השוואת סיסמה לגיבוב השמור; bcrypt עושה את ההשוואה בזמן קבוע */
export function verifyPassword(password, hash) {
  return bcrypt.compare(password, hash);
}

// גיבוב "דמה" לבדיקה כשהמשתמש לא קיים: כך התחברות עם אימייל לא קיים לוקחת
// אותו זמן כמו סיסמה שגויה, ותוקף לא יכול לגלות לפי הזמן אילו אימיילים רשומים.
let dummyHash = null;

/** בדיקה מזויפת לאימייל לא קיים - מחזירה תמיד false, אבל לוקחת אותו זמן כמו בדיקה אמיתית */
export function dummyPasswordCheck(password, rounds) {
  dummyHash ??= bcrypt.hash("cropguard-dummy-password", rounds);
  return dummyHash.then((hash) => bcrypt.compare(password, hash)).then(() => false);
}
