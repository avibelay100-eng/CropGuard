/**
 * מספרי טלפון נייד ישראליים: נרמול לפורמט בינלאומי אחיד (E.164).
 *
 * מקבל את כל הצורות הנפוצות - "050-123-4567", "0501234567", "+972 50 123 4567", "972501234567" -
 * ומחזיר "+972501234567". כך אותו מספר תמיד נשמר ונמצא באותה צורה.
 */

const ISRAELI_MOBILE = /^5\d{8}$/; // אחרי הקידומת: 5 ואז 8 ספרות (050, 052, 054...)

export function normalizeIsraeliMobile(input: string): string | null {
  const digits = input.replace(/[\s\-().]/g, "");
  let national: string;
  if (/^\+972\d+$/.test(digits)) national = digits.slice(4);
  else if (/^972\d+$/.test(digits)) national = digits.slice(3);
  else if (/^0\d+$/.test(digits)) national = digits.slice(1);
  else return null;
  return ISRAELI_MOBILE.test(national) ? `+972${national}` : null;
}

/** להצגה בלוגים בלי לחשוף את המספר: "+97250***4567" */
export function maskPhone(phone: string): string {
  return phone.length > 8 ? `${phone.slice(0, 6)}***${phone.slice(-4)}` : "***";
}
