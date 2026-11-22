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

export function requireAuth(prisma: PrismaClient, jwtSecret: string): RequestHandler {
  return async (request, _response, next) => {
    const header = request.headers.authorization ?? "";
    const [scheme, token] = header.split(" ");
    if (scheme !== "Bearer" || !token) {
      throw unauthorized('Missing "Authorization: Bearer <token>" header.');
    }

    const userId = verifyToken(token, jwtSecret);
    if (!userId) throw unauthorized("Invalid or expired token.");

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, name: true, role: true },
    });
    if (!user) throw unauthorized("Invalid or expired token.");

    request.user = user;
    next();
  };
}

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
