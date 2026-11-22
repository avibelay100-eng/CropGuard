/**
 * טלפון נייד ישראלי - בדיקה מקדימה בלקוח (השרת בודק שוב ושומר בפורמט בינלאומי).
 */

export function isIsraeliMobile(input) {
  const digits = input.replace(/[\s\-().]/g, "");
  const national = digits.startsWith("+972") ? digits.slice(4) : digits.startsWith("972") ? digits.slice(3) : digits.startsWith("0") ? digits.slice(1) : "";
  return /^5\d{8}$/.test(national);
}

/** "+972501234567" -> "050-123-4567" לתצוגה */
export function formatIsraeliMobile(e164) {
  const national = e164.startsWith("+972") ? `0${e164.slice(4)}` : e164;
  return /^05\d{8}$/.test(national) ? `${national.slice(0, 3)}-${national.slice(3, 6)}-${national.slice(6)}` : e164;
}

// טקסטי עזר ושגיאה אחידים לכל שדות הטלפון באפליקציה
export const PHONE_HINT = "טלפון נייד ישראלי, למשל 050-1234567";
export const PHONE_ERROR = "נא למלא מספר נייד ישראלי תקין, למשל 050-1234567.";
