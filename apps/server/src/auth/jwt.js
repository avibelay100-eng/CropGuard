/**
 * יצירה ובדיקה של JWT.
 * הטוקן מכיל רק את מזהה המשתמש (sub) ואת התפקיד; הוא חתום ב-HS256 עם JWT_SECRET.
 */

import jwt from "jsonwebtoken";

/**
 * מה נכנס לטוקן: רק מזהה ותפקיד - בלי מידע אישי, כי JWT קריא לכל מי שמחזיק בו
 * @typedef {object} TokenPayload
 * @property {string} sub
 * @property {Role} role
 */

/** חותם JWT ב-HS256 עם תוקף, ומחזיר גם את זמן התפוגה כדי שהלקוח יוכל להציג/לנהל אותו */
export function signToken(
  payload,
  secret,
  expiresInSeconds,
) {
  const token = jwt.sign({ role: payload.role }, secret, {
    algorithm: "HS256",
    subject: payload.sub,
    expiresIn: expiresInSeconds,
  });
  const expiresAt = new Date(Date.now() + expiresInSeconds * 1000).toISOString();
  return { token, expiresAt };
}

/**
 * מחזיר את מזהה המשתמש ואת זמן ההנפקה (שניות), או null אם הטוקן לא תקין או פג תוקף.
 * זמן ההנפקה משמש לדחיית טוקנים ישנים אחרי שינוי סיסמה.
 */
export function verifyToken(token, secret) {
  try {
    // algorithms מפורש מונע התקפת "alg: none" והחלפת אלגוריתם
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
    if (typeof decoded === "string" || typeof decoded.sub !== "string" || typeof decoded.iat !== "number") return null;
    return { sub: decoded.sub, issuedAt: decoded.iat };
  } catch {
    return null;
  }
}
