/**
 * נקודת הכניסה של שרת הליבה.
 *
 * פיתוח:  npm run dev
 * ייצור:  npm run build && npm start
 */

import { createApp } from "./app.js";
import { loadConfig } from "./config.js";
import { createPrismaClient } from "./db.js";
import { createHttpAiClient } from "./services/aiClient.js";
import { createDiskImageStore } from "./services/imageStore.js";

const config = loadConfig();
const prisma = createPrismaClient(config.databaseUrl);

const app = createApp({
  prisma,
  config,
  aiClient: createHttpAiClient(config.aiEngineUrl, config.aiTimeoutMs),
  imageStore: createDiskImageStore(config.uploadDir),
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
