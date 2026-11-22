/**
 * כלי עזר לבדיקות: הגדרות, שירות AI מדומה, אחסון תמונות בזיכרון ויצירת משתמשים.
 */

import "dotenv/config";
import request from "supertest";

import { createApp } from "../src/app.js";
import { createPrismaClient } from "../src/db.js";

export const TEST_DATABASE_URL = process.env["TEST_DATABASE_URL"];
/** בלי מסד בדיקות - בדיקות האינטגרציה מדולגות */
export const hasTestDb = Boolean(TEST_DATABASE_URL);

export function testConfig(overrides = {}) {
  return {
    port: 0,
    databaseUrl: TEST_DATABASE_URL ?? "",
    jwtSecret: "test-secret-that-is-at-least-32-characters-long",
    jwtExpiresInSeconds: 3600,
    // סבב גיבוב נמוך - כדי שהבדיקות יהיו מהירות (בייצור 12)
    bcryptRounds: 4,
    aiEngineUrl: "http://ai.invalid",
    aiTimeoutMs: 1000,
    uploadDir: "unused",
    maxUploadBytes: 1024 * 1024,
    corsOrigins: ["http://localhost:5173"],
    authRateLimit: 0,
    logLevel: "silent",
    resetCodeTtlMinutes: 10,
    sms: { provider: "console" },
    ...overrides,
  };
}

/** SMS מדומה: שומר את ההודעות, כדי שהבדיקה תוכל "לקרוא" את הקוד */
export class FakeSmsSender {
  sent = [];
  failNext = false;

  async send(to, text) {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("SMS provider down");
    }
    this.sent.push({ to, text });
  }

  /** הקוד בן 6 הספרות מההודעה האחרונה */
  lastCode() {
    const match = this.sent.at(-1)?.text.match(/\b(\d{6})\b/);
    if (!match) throw new Error("No SMS code was sent");
    return match[1];
  }
}

/**
 * תשובת AI עקבית לתווית נתונה, כמו שהשירות האמיתי היה מחזיר.
 * others - תחזיות נוספות (תווית והסתברות), כמו בהתפלגות המלאה ש-top_k=38 מחזיר.
 */
export function prediction(
  modelLabel,
  confidence = 0.93,
  others = [],
) {
  const [plant = modelLabel, condition = ""] = modelLabel.split("___");
  const disease = `${plant.replaceAll("_", " ")} ${condition.replaceAll("_", " ")}`.trim();
  const isHealthy = condition.toLowerCase() === "healthy";
  return {
    disease,
    model_label: modelLabel,
    plant: plant.replaceAll("_", " "),
    is_healthy: isHealthy,
    status: isHealthy ? "healthy" : "infected",
    confidence,
    confidence_percent: Math.round(confidence * 10000) / 100,
    uncertain: confidence < 0.5,
    top_predictions: [
      { model_label: modelLabel, disease, confidence },
      ...others.map(([label, score]) => ({ model_label: label, disease: label.replaceAll("_", " "), confidence: score })),
    ],
  };
}

/** שירות AI מדומה: מחזיר את מה שהבדיקה קבעה, וזוכר אילו תמונות קיבל */
export class FakeAiClient {
  next = prediction("Tomato___Late_blight");
  calls = [];

  async predict(image) {
    this.calls.push(image);
    if (this.next instanceof Error) throw this.next;
    return this.next;
  }
}

/** אחסון תמונות בזיכרון במקום בדיסק */
export class MemoryImageStore {
  images = new Map();
  counter = 0;

  async save(buffer) {
    const url = `uploads/test-${++this.counter}.png`;
    this.images.set(url, buffer);
    return url;
  }

  async remove(imageUrl) {
    this.images.delete(imageUrl);
  }
}

/** שירות חדשות מדומה: מחזיר רשימה קבועה, בלי לפנות לאינטרנט */
export const fakeNews = {
  async get() {
    return {
      items: [
        {
          id: "n1",
          title: "מחקר ישראלי על אשלגן בקרקע",
          summary: "תקציר",
          link: "https://www.hayadan.org.il/a",
          publishedAt: "2026-11-15T06:00:00.000Z",
          sourceId: "hayadan",
          sourceName: "הידען",
          language: "he",
        },
        {
          id: "n2",
          title: "New blight-resistant potato",
          summary: "Summary",
          link: "https://phys.org/b",
          publishedAt: "2026-11-14T06:00:00.000Z",
          sourceId: "physorg",
          sourceName: "Phys.org",
          language: "en",
        },
      ],
      sources: [],
      fetchedAt: "2026-11-22T00:00:00.000Z",
    };
  },
};

/**
 * @typedef {object} TestContext
 * @property {Express} app
 * @property {PrismaClient} prisma
 * @property {FakeAiClient} ai
 * @property {MemoryImageStore} images
 * @property {FakeSmsSender} sms
 */

export function createTestContext(configOverrides = {}) {
  const prisma = createPrismaClient(TEST_DATABASE_URL);
  const ai = new FakeAiClient();
  const images = new MemoryImageStore();
  const sms = new FakeSmsSender();
  const app = createApp(
    { prisma, config: testConfig(configOverrides), aiClient: ai, imageStore: images, newsService: fakeNews, smsSender: sms },
    { logger: false },
  );
  return { app, prisma, ai, images, sms };
}

/** מוחק את כל המשתמשים, החלקות, האבחונים, יומני השדה וקודי השחזור (נתוני הבסיס - מחירים והמלצות - נשארים) */
export async function resetDatabase(prisma) {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "password_reset_codes", "field_logs", "diagnoses", "fields", "users" CASCADE');
}

let userCounter = 0;

/** רושם משתמש דרך ה-API ומחזיר טוקן. ADMIN נוצר כ-FARMER ומקודם ישירות במסד. */
export async function createUser(
  context,
  role = "FARMER",
  name = `User ${++userCounter}`,
) {
  const email = `user${++userCounter}-${Date.now()}@example.test`;
  const response = await request(context.app)
    .post("/api/auth/register")
    .send({ email, password: "correct-horse-battery", name, role: role === "ADMIN" ? "FARMER" : role })
    .expect(201);
  const auth = response.body;
  if (role === "ADMIN") {
    await context.prisma.user.update({ where: { id: auth.user.id }, data: { role: "ADMIN" } });
    auth.user.role = "ADMIN";
  }
  return auth;
}

export async function createField(
  context,
  token,
  overrides = {},
) {
  const response = await request(context.app)
    .post("/api/fields")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "חממה 3", cropType: "Tomato", latitude: 31.25, longitude: 34.79, ...overrides })
    .expect(201);
  return response.body;
}

/** תמונת PNG זעירה ותקינה (1x1) - שירות ה-AI המדומה לא מפענח אותה בכל מקרה */
export const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNgYPgPAAEDAQAIicLsAAAAAElFTkSuQmCC",
  "base64",
);

export function bearer(token) {
  return ["Authorization", `Bearer ${token}`];
}
