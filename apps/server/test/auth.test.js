/**
 * בדיקות אימות: הרשמה, התחברות, /me ו-RBAC בסיסי.
 */

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { bearer, createTestContext, createUser, hasTestDb, resetDatabase } from "./helpers.js";

describe.skipIf(!hasTestDb)("auth routes", () => {
  let context;

  beforeAll(() => {
    context = createTestContext();
  });
  beforeEach(async () => {
    await resetDatabase(context.prisma);
  });
  afterAll(async () => {
    await context.prisma.$disconnect();
  });

  const register = (body) => request(context.app).post("/api/auth/register").send(body);
  const login = (body) => request(context.app).post("/api/auth/login").send(body);

  describe("POST /api/auth/register", () => {
    it("creates a FARMER by default and returns a token without the password hash", async () => {
      const response = await register({ email: "Avi@Example.TEST", password: "correct-horse-battery", name: "אבי" });

      expect(response.status).toBe(201);
      expect(response.body.token).toEqual(expect.any(String));
      expect(response.body.expiresAt).toEqual(expect.any(String));
      expect(response.body.user).toMatchObject({ email: "avi@example.test", name: "אבי", role: "FARMER" });
      expect(JSON.stringify(response.body)).not.toContain("passwordHash");
    });

    it("stores a bcrypt hash, never the plain password", async () => {
      await register({ email: "hash@example.test", password: "correct-horse-battery", name: "Hash" }).expect(201);
      const user = await context.prisma.user.findUniqueOrThrow({ where: { email: "hash@example.test" } });

      expect(user.passwordHash).not.toBe("correct-horse-battery");
      expect(user.passwordHash).toMatch(/^\$2[aby]\$/);
      expect(await bcrypt.compare("correct-horse-battery", user.passwordHash)).toBe(true);
    });

    it("allows registering as AGRONOMIST", async () => {
      const response = await register({ email: "agro@example.test", password: "correct-horse-battery", name: "Agro", role: "AGRONOMIST" });
      expect(response.status).toBe(201);
      expect(response.body.user.role).toBe("AGRONOMIST");
    });

    it("refuses self-registration as ADMIN with 403", async () => {
      const response = await register({ email: "boss@example.test", password: "correct-horse-battery", name: "Boss", role: "ADMIN" });
      expect(response.status).toBe(403);
      expect(response.body.error).toBe("forbidden");
      expect(await context.prisma.user.count()).toBe(0);
    });

    it("rejects a duplicate email (case-insensitive) with 409", async () => {
      await register({ email: "dup@example.test", password: "correct-horse-battery", name: "One" }).expect(201);
      const response = await register({ email: "DUP@example.test", password: "another-password", name: "Two" });
      expect(response.status).toBe(409);
      expect(response.body.error).toBe("conflict");
    });

    it.each([
      [{ email: "not-an-email", password: "correct-horse-battery", name: "X" }, "email"],
      [{ email: "short@example.test", password: "short", name: "X" }, "password"],
      [{ email: "noname@example.test", password: "correct-horse-battery", name: "  " }, "name"],
      [{ email: "role@example.test", password: "correct-horse-battery", name: "X", role: "KING" }, "role"],
    ])("rejects invalid input %j with 422 mentioning %s", async (body, field) => {
      const response = await register(body);
      expect(response.status).toBe(422);
      expect(response.body.error).toBe("validation_error");
      expect(response.body.detail).toContain(field);
    });

    it("rejects malformed JSON with 400", async () => {
      const response = await request(context.app)
        .post("/api/auth/register")
        .set("Content-Type", "application/json")
        .send("{not json");
      expect(response.status).toBe(400);
      expect(response.body.error).toBe("bad_request");
    });
  });

  describe("POST /api/auth/login", () => {
    beforeEach(async () => {
      await register({ email: "farmer@example.test", password: "correct-horse-battery", name: "Farmer" }).expect(201);
    });

    it("returns a valid JWT for correct credentials", async () => {
      const response = await login({ email: "Farmer@Example.test", password: "correct-horse-battery" });

      expect(response.status).toBe(200);
      expect(response.body.user.email).toBe("farmer@example.test");
      const decoded = jwt.decode(response.body.token);
      expect(decoded.sub).toBe(response.body.user.id);
      expect(decoded.role).toBe("FARMER");
      expect(decoded.exp - decoded.iat).toBe(3600);
    });

    it("returns the same 401 for a wrong password and an unknown email", async () => {
      const wrongPassword = await login({ email: "farmer@example.test", password: "wrong-password" });
      const unknownEmail = await login({ email: "nobody@example.test", password: "correct-horse-battery" });

      expect(wrongPassword.status).toBe(401);
      expect(unknownEmail.status).toBe(401);
      expect(wrongPassword.body).toEqual(unknownEmail.body);
      expect(wrongPassword.body).toEqual({ error: "unauthorized", detail: "Invalid email or password." });
    });
  });

  describe("GET /api/auth/me", () => {
    it("returns the current user", async () => {
      const auth = await createUser(context, "AGRONOMIST", "Dana");
      const response = await request(context.app).get("/api/auth/me").set(...bearer(auth.token));
      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({ id: auth.user.id, name: "Dana", role: "AGRONOMIST" });
    });

    it.each([
      ["no header", undefined],
      ["wrong scheme", "Basic abc"],
      ["garbage token", "Bearer not-a-jwt"],
    ])("rejects %s with 401", async (_case, header) => {
      const call = request(context.app).get("/api/auth/me");
      const response = header ? await call.set("Authorization", header) : await call;
      expect(response.status).toBe(401);
      expect(response.body.error).toBe("unauthorized");
    });

    it("rejects a token signed with a different secret", async () => {
      const auth = await createUser(context);
      const forged = jwt.sign({ role: "ADMIN" }, "some-other-secret-that-is-long-enough!!", { subject: auth.user.id });
      const response = await request(context.app).get("/api/auth/me").set(...bearer(forged));
      expect(response.status).toBe(401);
    });

    it("rejects an expired token", async () => {
      const auth = await createUser(context);
      const expired = jwt.sign({ role: "FARMER" }, "test-secret-that-is-at-least-32-characters-long", {
        subject: auth.user.id,
        expiresIn: -10,
      });
      const response = await request(context.app).get("/api/auth/me").set(...bearer(expired));
      expect(response.status).toBe(401);
    });

    it("rejects the token of a user who was deleted", async () => {
      const auth = await createUser(context);
      await context.prisma.user.delete({ where: { id: auth.user.id } });
      const response = await request(context.app).get("/api/auth/me").set(...bearer(auth.token));
      expect(response.status).toBe(401);
    });
  });

  describe("rate limiting", () => {
    it("returns 429 after too many auth attempts", async () => {
      const limited = createTestContext({ authRateLimit: 2 });
      try {
        await request(limited.app).post("/api/auth/login").send({ email: "a@b.test", password: "x" }).expect(401);
        await request(limited.app).post("/api/auth/login").send({ email: "a@b.test", password: "x" }).expect(401);
        const response = await request(limited.app).post("/api/auth/login").send({ email: "a@b.test", password: "x" });
        expect(response.status).toBe(429);
        expect(response.body.error).toBe("too_many_requests");
      } finally {
        await limited.prisma.$disconnect();
      }
    });
  });
});
