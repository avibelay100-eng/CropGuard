/**
 * יצירה ובדיקה של JWT.
 * הטוקן מכיל רק את מזהה המשתמש (sub) ואת התפקיד; הוא חתום ב-HS256 עם JWT_SECRET.
 */

import jwt from "jsonwebtoken";

import type { Role } from "../generated/prisma/client.js";

export interface TokenPayload {
  sub: string;
  role: Role;
}

export function signToken(
  payload: TokenPayload,
  secret: string,
  expiresInSeconds: number,
): { token: string; expiresAt: string } {
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
export function verifyToken(token: string, secret: string): { sub: string; issuedAt: number } | null {
  try {
    // algorithms מפורש מונע התקפת "alg: none" והחלפת אלגוריתם
    const decoded = jwt.verify(token, secret, { algorithms: ["HS256"] });
    if (typeof decoded === "string" || typeof decoded.sub !== "string" || typeof decoded.iat !== "number") return null;
    return { sub: decoded.sub, issuedAt: decoded.iat };
  } catch {
    return null;
  }
}
