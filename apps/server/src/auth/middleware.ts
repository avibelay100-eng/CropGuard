/**
 * Middleware לאימות והרשאות (RBAC).
 *
 * requireAuth: בודק את ה-JWT בכותרת Authorization וטוען את המשתמש מהמסד.
 *   הטעינה מהמסד בכל בקשה מבטיחה שמשתמש שנמחק או שתפקידו שונה מאבד גישה מיד,
 *   ולא רק כשהטוקן שלו פג.
 * requireRole: מאפשר גישה רק לתפקידים שצוינו.
 */

import type { RequestHandler } from "express";

import { forbidden, unauthorized } from "../errors.js";
import type { PrismaClient, Role } from "../generated/prisma/client.js";
import { verifyToken } from "./jwt.js";

/**
 * אימות כל בקשה: בדיקת חתימה ותוקף, טעינת המשתמש מהמסד, ודחיית טוקן שהונפק לפני שינוי סיסמה.
 * בסוף - request.user זמין לכל route שאחריו.
 */
export function requireAuth(prisma: PrismaClient, jwtSecret: string): RequestHandler {
  return async (request, _response, next) => {
    const header = request.headers.authorization ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw unauthorized('Missing "Authorization: Bearer <token>" header.');
    }

    const verified = verifyToken(token, jwtSecret);
    if (!verified) throw unauthorized("Invalid or expired token.");

    const user = await prisma.user.findUnique({
      where: { id: verified.sub },
      select: { id: true, email: true, name: true, role: true, passwordChangedAt: true },
    });
    if (!user) throw unauthorized("Invalid or expired token.");

    // טוקן שהונפק לפני שינוי הסיסמה האחרון נדחה - כך שחזור סיסמה מנתק סשנים גנובים
    if (user.passwordChangedAt && verified.issuedAt < Math.floor(user.passwordChangedAt.getTime() / 1000)) {
      throw unauthorized("Invalid or expired token.");
    }

    request.user = { id: user.id, email: user.email, name: user.name, role: user.role };
    next();
  };
}

/** הרשאה לפי תפקיד (RBAC): מאפשר רק את התפקידים שהועברו; משתמש אחר מקבל 403 */
export function requireRole(...roles: Role[]): RequestHandler {
  return (request, _response, next) => {
    if (!request.user) throw unauthorized();
    if (!roles.includes(request.user.role)) throw forbidden();
    next();
  };
}

/** קיצור: האם המשתמש רואה נתונים של כל החקלאים (אגרונום/מנהל) */
export function canSeeAllFarmers(role: Role): boolean {
  return role === "AGRONOMIST" || role === "ADMIN";
}
