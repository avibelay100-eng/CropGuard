/**
 * אימות משתמשים:
 *   POST  /api/auth/register                - הרשמה (FARMER או AGRONOMIST; ADMIN לא יכול להירשם בעצמו)
 *   POST  /api/auth/login                   - התחברות, מחזיר JWT
 *   GET   /api/auth/me                      - פרטי המשתמש המחובר
 *   PATCH /api/auth/me                      - עדכון טלפון (לשחזור סיסמה)
 *   POST  /api/auth/password-reset/request  - שליחת קוד ב-SMS לטלפון של החשבון
 *   POST  /api/auth/password-reset/confirm  - קביעת סיסמה חדשה עם הקוד
 */

import { createHmac, randomInt, timingSafeEqual } from "node:crypto";

import type { AuthResponse } from "@cropguard/shared-types";
import { Router } from "express";
import { z } from "zod";

import { signToken } from "../auth/jwt.js";
import { requireAuth } from "../auth/middleware.js";
import { dummyPasswordCheck, hashPassword, verifyPassword } from "../auth/password.js";
import { maskPhone, normalizeIsraeliMobile } from "../auth/phone.js";
import type { AppDeps } from "../app.js";
import { toUserDto } from "../dto.js";
import { HttpError, conflict, forbidden, unauthorized } from "../errors.js";
import type { User } from "../generated/prisma/client.js";

// אימייל נשמר תמיד באותיות קטנות, כדי ש-Avi@x.com ו-avi@x.com יהיו אותו משתמש
const email = z.string().trim().toLowerCase().pipe(z.email("Invalid email address"));

// bcrypt משתמש רק ב-72 הבייטים הראשונים, לכן מגבילים את האורך
const password = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .max(72, "Password must be at most 72 characters");

/** טלפון נייד ישראלי בכל צורה נפוצה -> "+9725XXXXXXXX" */
const phone = z
  .string()
  .transform((value, context) => {
    const normalized = normalizeIsraeliMobile(value);
    if (!normalized) {
      context.addIssue({ code: "custom", message: "Enter an Israeli mobile number, e.g. 050-1234567" });
      return z.NEVER;
    }
    return normalized;
  });

const registerSchema = z.object({
  email,
  password,
  name: z.string().trim().min(1, "Name is required").max(100),
  role: z.enum(["FARMER", "AGRONOMIST", "ADMIN"]).default("FARMER"),
  // טלפון ריק = לא הוגדר (preprocess ולא union - כדי שהודעת השגיאה תהיה ברורה)
  phone: z.preprocess((value) => (value === "" ? undefined : value), phone.optional()),
});

const loginSchema = z.object({
  email,
  password: z.string().min(1, "Password is required"),
});

const updateMeSchema = z.object({
  // null או ריק = מחיקת הטלפון
  phone: z.preprocess((value) => (value === "" ? null : value), phone.nullable()),
});

const resetRequestSchema = z.object({ phone });
const resetConfirmSchema = z.object({
  phone,
  code: z.string().trim().regex(/^\d{6}$/, "The code has 6 digits"),
  newPassword: password,
});

/** כמה ניסיונות שגויים מותרים לקוד אחד */
const MAX_CODE_ATTEMPTS = 5;
/** לא שולחים קוד חדש לאותו משתמש יותר מפעם בדקה (מגן על החשבון ועל עלויות SMS) */
const RESEND_COOLDOWN_MS = 60_000;

const invalidCode = () => new HttpError(400, "invalid_code", "Invalid or expired code.");

export function authRouter({ prisma, config, smsSender }: AppDeps): Router {
  const router = Router();

  const issueToken = (user: User): AuthResponse => {
    const { token, expiresAt } = signToken({ sub: user.id, role: user.role }, config.jwtSecret, config.jwtExpiresInSeconds);
    return { token, expiresAt, user: toUserDto(user) };
  };

  /** הקוד נשמר רק כ-HMAC עם הסוד של השרת - גם מי שקורא את המסד לא יכול לנחש אותו בלי הסוד */
  const hashCode = (userId: string, code: string) =>
    createHmac("sha256", config.jwtSecret).update(`password-reset:${userId}:${code}`).digest("hex");

  const assertPhoneFree = async (phoneNumber: string, exceptUserId?: string) => {
    const owner = await prisma.user.findUnique({ where: { phone: phoneNumber }, select: { id: true } });
    if (owner && owner.id !== exceptUserId) throw conflict("This phone number is already linked to another account.");
  };

  router.post("/register", async (request, response) => {
    const input = registerSchema.parse(request.body);
    if (input.role === "ADMIN") {
      throw forbidden("Admin accounts cannot be self-registered.");
    }

    const existing = await prisma.user.findUnique({ where: { email: input.email }, select: { id: true } });
    if (existing) throw conflict("An account with this email already exists.");
    if (input.phone) await assertPhoneFree(input.phone);

    const user = await prisma.user.create({
      data: {
        email: input.email,
        name: input.name,
        role: input.role,
        phone: input.phone ?? null,
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

  router.patch("/me", requireAuth(prisma, config.jwtSecret), async (request, response) => {
    const input = updateMeSchema.parse(request.body);
    if (input.phone) await assertPhoneFree(input.phone, request.user!.id);
    const user = await prisma.user.update({ where: { id: request.user!.id }, data: { phone: input.phone } });
    response.json(toUserDto(user));
  });

  /**
   * שלב 1: שולחים קוד ב-SMS.
   * התשובה זהה תמיד - גם כשהמספר לא רשום - כדי שאי אפשר יהיה לגלות אילו מספרים רשומים.
   */
  router.post("/password-reset/request", async (request, response) => {
    const input = resetRequestSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { phone: input.phone }, select: { id: true } });

    if (user) {
      const now = Date.now();
      const recent = await prisma.passwordResetCode.findFirst({
        where: { userId: user.id, usedAt: null, createdAt: { gt: new Date(now - RESEND_COOLDOWN_MS) } },
        select: { id: true },
      });
      if (!recent) {
        const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
        // קוד חדש פוסל את כל הקודים הקודמים
        await prisma.$transaction([
          prisma.passwordResetCode.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date(now) } }),
          prisma.passwordResetCode.create({
            data: {
              userId: user.id,
              codeHash: hashCode(user.id, code),
              expiresAt: new Date(now + config.resetCodeTtlMinutes * 60_000),
            },
          }),
        ]);
        try {
          await smsSender.send(
            input.phone,
            `CropGuard: קוד האיפוס שלך הוא ${code}. בתוקף ל-${config.resetCodeTtlMinutes} דקות. אם לא ביקשת - התעלם.`,
          );
          request.log?.info({ userId: user.id, phone: maskPhone(input.phone) }, "Password reset code sent");
        } catch (err) {
          // לא חושפים ללקוח (זה היה מגלה שהמספר רשום); רק ללוג
          request.log?.error({ err, userId: user.id }, "Could not send password reset SMS");
        }
      }
    }

    response.json({ ok: true });
  });

  /** שלב 2: קוד + סיסמה חדשה. קוד שגוי, פג תוקף, משומש או אחרי 5 ניסיונות - אותה שגיאה. */
  router.post("/password-reset/confirm", async (request, response) => {
    const input = resetConfirmSchema.parse(request.body);
    const user = await prisma.user.findUnique({ where: { phone: input.phone }, select: { id: true } });
    if (!user) throw invalidCode();

    const entry = await prisma.passwordResetCode.findFirst({
      where: { userId: user.id, usedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!entry) throw invalidCode();

    // השוואה בזמן קבוע - לא מדליפה כמה ספרות נכונות
    const expected = Buffer.from(entry.codeHash, "hex");
    const actual = Buffer.from(hashCode(user.id, input.code), "hex");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      const attempts = entry.attempts + 1;
      await prisma.passwordResetCode.update({
        where: { id: entry.id },
        data: { attempts, ...(attempts >= MAX_CODE_ATTEMPTS ? { usedAt: new Date() } : {}) },
      });
      throw invalidCode();
    }

    const now = new Date();
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        // passwordChangedAt מבטל את כל הטוקנים שהונפקו לפני כן
        data: { passwordHash: await hashPassword(input.newPassword, config.bcryptRounds), passwordChangedAt: now },
      }),
      prisma.passwordResetCode.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } }),
    ]);
    request.log?.info({ userId: user.id }, "Password reset completed");
    response.json({ ok: true });
  });

  return router;
}
