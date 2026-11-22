/**
 * בדיקות טלפון ושחזור סיסמה ב-SMS: נרמול מספרים, הרשמה ועדכון טלפון, הזרימה המלאה,
 * ואבטחה - בלי חשיפת מספרים רשומים, קוד חד-פעמי, הגבלת ניסיונות, תוקף, וביטול טוקנים ישנים.
 */

import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { maskPhone, normalizeIsraeliMobile } from "../src/auth/phone.js";
import { createConsoleSmsSender, createTwilioSmsSender } from "../src/services/sms.js";
import { bearer, createTestContext, hasTestDb, resetDatabase } from "./helpers.js";

describe("Israeli mobile numbers", () => {
  it.each([
    ["050-123-4567", "+972501234567"],
    ["0501234567", "+972501234567"],
    ["+972 50 123 4567", "+972501234567"],
    ["972521234567", "+972521234567"],
    ["(054) 765-4321", "+972547654321"],
  ])("normalizes %s to %s", (input, expected) => {
    expect(normalizeIsraeliMobile(input)).toBe(expected);
  });

  it.each(["03-1234567", "050123456", "05012345678", "abc", "+1 555 123 4567", ""])("rejects %s", (input) => {
    expect(normalizeIsraeliMobile(input)).toBeNull();
  });

  it("masks numbers for logs", () => {
    expect(maskPhone("+972501234567")).toBe("+97250***4567");
  });
});

describe("SMS senders", () => {
  it("console sender prints a dev-only line with a masked number", async () => {
    const lines = [];
    await createConsoleSmsSender((line) => lines.push(line)).send("+972501234567", "hello");
    expect(lines).toEqual(["[SMS - DEV ONLY, not really sent] to +97250***4567: hello"]);
  });

  it("Twilio sender posts a form with basic auth to the Messages API", async () => {
    const fetchImpl = vi.fn(async (_url, _init) => new Response("{}", { status: 201 }));
    await createTwilioSmsSender({ accountSid: "AC123", authToken: "secret", from: "+15550001111", fetchImpl }).send(
      "+972501234567",
      "קוד 123456",
    );
    const [url, init] = fetchImpl.mock.calls[0];
    expect(String(url)).toBe("https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json");
    expect(new Headers(init?.headers).get("Authorization")).toBe(`Basic ${Buffer.from("AC123:secret").toString("base64")}`);
    expect(Object.fromEntries(new URLSearchParams(String(init?.body)))).toEqual({
      To: "+972501234567",
      From: "+15550001111",
      Body: "קוד 123456",
    });
  });

  it("Twilio sender throws on an error response", async () => {
    const fetchImpl = vi.fn(async () => new Response("bad", { status: 401 }));
    await expect(
      createTwilioSmsSender({ accountSid: "AC1", authToken: "x", from: "+1", fetchImpl }).send("+972501234567", "x"),
    ).rejects.toThrow("Twilio responded 401");
  });
});

describe.skipIf(!hasTestDb)("phone and password reset routes", () => {
  let context;
  const PHONE = "050-123-4567";
  const E164 = "+972501234567";

  beforeAll(() => {
    context = createTestContext();
  });
  beforeEach(async () => {
    await resetDatabase(context.prisma);
    context.sms.sent.length = 0;
  });
  afterAll(async () => {
    await context.prisma.$disconnect();
  });

  const register = (body) => request(context.app).post("/api/auth/register").send(body);
  const login = (email, password) => request(context.app).post("/api/auth/login").send({ email, password });
  const requestCode = (phone) => request(context.app).post("/api/auth/password-reset/request").send({ phone });
  const confirm = (phone, code, newPassword = "brand-new-password") =>
    request(context.app).post("/api/auth/password-reset/confirm").send({ phone, code, newPassword });

  const registerWithPhone = async () =>
    (await register({ email: "avi@example.test", password: "old-password-1", name: "אבי", phone: PHONE }).expect(201)).body;

  describe("phone on the account", () => {
    it("stores the phone in international format at registration", async () => {
      const auth = await registerWithPhone();
      expect(auth.user.phone).toBe(E164);
    });

    it("rejects an invalid phone and a phone that belongs to someone else", async () => {
      const bad = await register({ email: "a@example.test", password: "password-123", name: "A", phone: "12345" });
      expect(bad.status).toBe(422);
      expect(bad.body.detail).toContain("Israeli mobile");

      await registerWithPhone();
      const taken = await register({ email: "b@example.test", password: "password-123", name: "B", phone: "+972501234567" });
      expect(taken.status).toBe(409);
    });

    it("lets a user add, change and remove their phone", async () => {
      const auth = (await register({ email: "c@example.test", password: "password-123", name: "C" }).expect(201)).body;
      expect(auth.user.phone).toBeNull();

      const added = await request(context.app).patch("/api/auth/me").set(...bearer(auth.token)).send({ phone: "0547654321" });
      expect(added.body.phone).toBe("+972547654321");

      const removed = await request(context.app).patch("/api/auth/me").set(...bearer(auth.token)).send({ phone: null });
      expect(removed.body.phone).toBeNull();
    });
  });

  describe("password reset by SMS", () => {
    it("resets the password with the SMS code, logs out old sessions, and the new password works", async () => {
      const auth = await registerWithPhone();

      expect((await requestCode(PHONE)).body).toEqual({ ok: true });
      expect(context.sms.sent).toHaveLength(1);
      expect(context.sms.sent[0].to).toBe(E164);
      expect(context.sms.sent[0].text).toContain("קוד האיפוס שלך");

      // הקוד לא נשמר כטקסט גלוי
      const stored = await context.prisma.passwordResetCode.findFirstOrThrow();
      expect(stored.codeHash).not.toContain(context.sms.lastCode());

      // ממתינים שנייה, כדי שזמן השינוי יהיה אחרי זמן ההנפקה של הטוקן הישן (JWT מדויק לשנייה)
      await new Promise((resolve) => setTimeout(resolve, 1100));
      expect((await confirm(PHONE, context.sms.lastCode())).body).toEqual({ ok: true });

      expect((await login("avi@example.test", "old-password-1")).status).toBe(401);
      expect((await login("avi@example.test", "brand-new-password")).status).toBe(200);
      // הטוקן הישן נדחה
      expect((await request(context.app).get("/api/auth/me").set(...bearer(auth.token))).status).toBe(401);
    });

    it("answers the same for an unregistered number and sends nothing", async () => {
      const response = await requestCode("052-999-8888");
      expect(response.status).toBe(200);
      expect(response.body).toEqual({ ok: true });
      expect(context.sms.sent).toHaveLength(0);
    });

    it("still answers the same when the SMS provider fails", async () => {
      await registerWithPhone();
      context.sms.failNext = true;
      expect((await requestCode(PHONE)).body).toEqual({ ok: true });
    });

    it("does not send a second code within a minute", async () => {
      await registerWithPhone();
      await requestCode(PHONE);
      await requestCode(PHONE);
      expect(context.sms.sent).toHaveLength(1);
    });

    it("rejects a wrong code, and locks the code after 5 wrong attempts", async () => {
      await registerWithPhone();
      await requestCode(PHONE);
      const code = context.sms.lastCode();
      const wrong = code === "000000" ? "111111" : "000000";

      for (let i = 0; i < 5; i++) {
        const response = await confirm(PHONE, wrong);
        expect(response.status).toBe(400);
        expect(response.body.error).toBe("invalid_code");
      }
      // גם הקוד הנכון כבר לא עובד
      expect((await confirm(PHONE, code)).status).toBe(400);
      expect((await login("avi@example.test", "old-password-1")).status).toBe(200);
    });

    it("does not accept a code twice", async () => {
      await registerWithPhone();
      await requestCode(PHONE);
      const code = context.sms.lastCode();
      expect((await confirm(PHONE, code)).status).toBe(200);
      expect((await confirm(PHONE, code, "another-password")).status).toBe(400);
    });

    it("rejects an expired code", async () => {
      await registerWithPhone();
      await requestCode(PHONE);
      await context.prisma.passwordResetCode.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
      expect((await confirm(PHONE, context.sms.lastCode())).status).toBe(400);
    });

    it("validates the code format and the new password", async () => {
      expect((await confirm(PHONE, "12ab")).status).toBe(422);
      expect((await confirm(PHONE, "123456", "short")).status).toBe(422);
      expect((await requestCode("not a phone")).status).toBe(422);
    });
  });
});
