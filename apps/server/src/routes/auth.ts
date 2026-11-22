/**
 * אימות משתמשים:
 *   POST /api/auth/register - הרשמה (FARMER או AGRONOMIST; ADMIN לא יכול להירשם בעצמו)
 *   POST /api/auth/login    - התחברות, מחזיר JWT
 *   GET  /api/auth/me       - פרטי המשתמש המחובר
 */

import type { AuthResponse } from "@cropguard/shared-types";
import { Router } from "express";
import { z } from "zod";

import { signToken } from "../auth/jwt.js";
import { requireAuth } from "../auth/middleware.js";
import { dummyPasswordCheck, hashPassword, verifyPassword } from "../auth/password.js";
import type { AppDeps } from "../app.js";
import { toUserDto } from "../dto.js";
import { conflict, forbidden, unauthorized } from "../errors.js";
import type { User } from "../generated/prisma/client.js";

// אימייל נשמר תמיד באותיות קטנות, כדי ש-Avi@x.com ו-avi@x.com יהיו אותו משתמש
const email = z.string().trim().toLowerCase().pipe(z.email("Invalid email address"));

const registerSchema = z.object({
  email,
  // bcrypt משתמש רק ב-72 הבייטים הראשונים, לכן מגבילים את האורך
  password: z.string().min(8, "Password must be at least 8 characters").max(72, "Password must be at most 72 characters"),
  name: z.string().trim().min(1, "Name is required").max(100),
  role: z.enum(["FARMER", "AGRONOMIST", "ADMIN"]).default("FARMER"),
});

const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});

export function authRouter({ prisma, config }: AppDeps): Router {
  const router = Router();

  const issueToken = (user: User): AuthResponse => {
    const { token, expiresAt } = signToken({ sub: user.id, role: user.role }, config.jwtSecret, config.jwtExpiresInSeconds);
    return { token, expiresAt, user: toUserDto(user) };
  };

  router.post("/register", async (request, response) => {
    const input = registerSchema.parse(request.body);
    if (input.role === "ADMIN") {
      throw forbidden("Admin accounts cannot be self-registered.");
    }

    const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) throw conflict("An account with this email already exists.");

    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        role: input.role,
        passwordHash: await hashPassword(input.password, config.bcryptRounds),
      },
    });
    request.log?.info({ userId: user.id, role: user.role }, "User registered");
    response.status(201).json(issueToken(user));
  });

  router.post("/login", async (request, response) => {
    const input = loginSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { email: input.email } });

    // אותה הודעה ואותו זמן תגובה לאימייל לא קיים ולסיסמה שגויה
    const valid = user
      ? await verifyPassword(input.password, user.passwordHash)
      : await dummyPasswordCheck(input.password, config.bcryptRounds);
    if (!user || !valid) throw unauthorized("Invalid email or password.");

    response.json(issueToken(user));
  });

  router.get("/me", requireAuth(prisma, config.jwtSecret), async (request, response) => {
    const user = await prisma.user.findUniqueOrThrow({ where: { id: request.user!.id } });
    response.json(toUserDto(user));
  });

  return router;
}
