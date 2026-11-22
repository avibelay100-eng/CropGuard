/**
 * כלי עזר לבדיקות: הגדרות, שירות AI מדומה, אחסון תמונות בזיכרון ויצירת משתמשים.
 */

import "dotenv/config";
import type { AuthResponse, PredictionResponse } from "@cropguard/shared-types";
import type { Express } from "express";
import request from "supertest";

import { createApp } from "../src/app.js";
import type { ServerConfig } from "../src/config.js";
import { createPrismaClient } from "../src/db.js";
import type { PrismaClient, Role } from "../src/generated/prisma/client.js";
import { AiServiceError, type AiClient, type UploadedImage } from "../src/services/aiClient.js";
import type { ImageStore } from "../src/services/imageStore.js";
import type { NewsService } from "../src/services/news.js";
import type { SmsSender } from "../src/services/sms.js";

export const TEST_DATABASE_URL = process.env["TEST_DATABASE_URL"];
/** בלי מסד בדיקות - בדיקות האינטגרציה מדולגות */
export const hasTestDb = Boolean(TEST_DATABASE_URL);

export function testConfig(overrides: Partial<ServerConfig> = {}): ServerConfig {
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
export class FakeSmsSender implements SmsSender {
  readonly sent: Array<{ to: string; text: string }> = [];
  failNext = false;

  async send(to: string, text: string): Promise<void> {
    if (this.failNext) {
      this.failNext = false;
      throw new Error("SMS provider down");
    }
    this.sent.push({ to, text });
  }

  /** הקוד בן 6 הספרות מההודעה האחרונה */
  lastCode(): string {
    const match = this.sent.at(-1)?.text.match(/\b(\d{6})\b/);
    if (!match) throw new Error("No SMS code was sent");
    return match[1]!;
  }
}

/**
 * תשובת AI עקבית לתווית נתונה, כמו שהשירות האמיתי היה מחזיר.
 * others - תחזיות נוספות (תווית והסתברות), כמו בהתפלגות המלאה ש-top_k=38 מחזיר.
 */
export function prediction(
  modelLabel: string,
  confidence = 0.93,
  others: ReadonlyArray<[string, number]> = [],
): PredictionResponse {
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
export class FakeAiClient implements AiClient {
  next: PredictionResponse | AiServiceError = prediction("Tomato___Late_blight");
  readonly calls: UploadedImage[] = [];

  async predict(image: UploadedImage): Promise<PredictionResponse> {
    this.calls.push(image);
    if (this.next instanceof Error) throw this.next;
    return this.next;
  }
}

/** אחסון תמונות בזיכרון במקום בדיסק */
export class MemoryImageStore implements ImageStore {
  readonly images = new Map<string, Buffer>();
  private counter = 0;

  async save(buffer: Buffer): Promise<string> {
    const url = `uploads/test-${++this.counter}.png`;
    this.images.set(url, buffer);
    return url;
  }

  async remove(imageUrl: string): Promise<void> {
    this.images.delete(imageUrl);
  }
}

/** שירות חדשות מדומה: מחזיר רשימה קבועה, בלי לפנות לאינטרנט */
export const fakeNews: NewsService = {
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

export interface TestContext {
  app: Express;
  prisma: PrismaClient;
  ai: FakeAiClient;
  images: MemoryImageStore;
  sms: FakeSmsSender;
}

export function createTestContext(configOverrides: Partial<ServerConfig> = {}): TestContext {
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
export async function resetDatabase(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe('TRUNCATE TABLE "password_reset_codes", "field_logs", "diagnoses", "fields", "users" CASCADE');
}

let userCounter = 0;

/** רושם משתמש דרך ה-API ומחזיר טוקן. ADMIN נוצר כ-FARMER ומקודם ישירות במסד. */
export async function createUser(
  context: TestContext,
  role: Role = "FARMER",
  name = `User ${++userCounter}`,
): Promise<AuthResponse> {
  const email = `user${++userCounter}-${Date.now()}@example.test`;
  const response = await request(context.app)
    .post("/api/auth/register")
    .send({ email, password: "correct-horse-battery", name, role: role === "ADMIN" ? "FARMER" : role })
    .expect(201);
  const auth = response.body as AuthResponse;
  if (role === "ADMIN") {
    await context.prisma.user.update({ where: { id: auth.user.id }, data: { role: "ADMIN" } });
    auth.user.role = "ADMIN";
  }
  return auth;
}

export async function createField(
  context: TestContext,
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<{ id: string; ownerId: string }> {
  const response = await request(context.app)
    .post("/api/fields")
    .set("Authorization", `Bearer ${token}`)
    .send({ name: "חממה 3", cropType: "Tomato", latitude: 31.25, longitude: 34.79, ...overrides })
    .expect(201);
  return response.body as { id: string; ownerId: string };
}

/** תמונת PNG זעירה ותקינה (1x1) - שירות ה-AI המדומה לא מפענח אותה בכל מקרה */
export const PNG_BYTES = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGNgYPgPAAEDAQAIicLsAAAAAElFTkSuQmCC",
  "base64",
);

export function bearer(token: string): [string, string] {
  return ["Authorization", `Bearer ${token}`];
}
