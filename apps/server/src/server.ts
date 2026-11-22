/**
 * נקודת הכניסה של שרת הליבה.
 *
 * פיתוח:  npm run dev
 * ייצור:  npm run build && npm start
 */

// ראשון: תעודות מערכת ההפעלה, לפני כל בקשת רשת (ראו את הקובץ להסבר)
import "./systemCertificates.js";
import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createPrismaClient } from "./db.js";
import { createHttpAiClient } from "./services/aiClient.js";
import { createDiskImageStore } from "./services/imageStore.js";
import { createNewsService } from "./services/news.js";
import { createConsoleSmsSender, createTwilioSmsSender } from "./services/sms.js";

const config = loadConfig();
const prisma = createPrismaClient(config.databaseUrl);

if (config.sms.provider === "console" && process.env["NODE_ENV"] === "production") {
  console.warn("WARNING: SMS_PROVIDER=console in production - password reset codes are printed, not sent.");
}
const smsSender =
  config.sms.provider === "twilio"
    ? createTwilioSmsSender({ accountSid: config.sms.accountSid, authToken: config.sms.authToken, from: config.sms.from })
    : createConsoleSmsSender();

const app = createApp({
  smsSender,
  prisma,
  config,
  aiClient: createHttpAiClient(config.aiEngineUrl, config.aiTimeoutMs),
  imageStore: createDiskImageStore(config.uploadDir),
  newsService: createNewsService({
    onSourceError: (source, error) => {
      const err = error as Error & { cause?: unknown };
      console.warn(`[news] ${source.id} failed: ${err.name}: ${err.message}`, err.cause ?? "");
    },
  }),
});

const server = app.listen(config.port, () => {
  console.log(`CropGuard Server ready on http://localhost:${config.port} (AI engine: ${config.aiEngineUrl})`);
});

// סגירה מסודרת: מפסיקים לקבל בקשות, ואז מנתקים את המסד
for (const signal of ["SIGINT", "SIGTERM"] as const) {
  process.once(signal, () => {
    server.close(() => {
      prisma.$disconnect().finally(() => process.exit(0));
    });
  });
}
