/**
 * CropGuard AI Engine - נקודת הכניסה: בונה את האפליקציה ומאזין לפורט.
 *
 * פיתוח:  npm run dev     (טעינה מחדש אוטומטית בכל שינוי)
 * ייצור:  npm run build && npm start
 */

import { buildApp } from "./app.js";
import { SERVICE_NAME, loadSettings } from "./config.js";

/** עלייה: בניית האפליקציה (כולל טעינת המודל), רישום סגירה מסודרת, והאזנה לפורט */
async function main(): Promise<void> {
  const settings = loadSettings();
  const app = await buildApp(settings);

  // סגירה מסודרת ב-Ctrl+C או כשמערכת ההפעלה/Docker עוצרת את התהליך
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      app.log.info({ signal }, `${SERVICE_NAME} shutting down`);
      app.close().then(
        () => process.exit(0),
        () => process.exit(1),
      );
    });
  }

  await app.listen({ host: settings.host, port: settings.port });
  app.log.info(
    `${SERVICE_NAME} ready - test page at http://localhost:${settings.port}/ , API docs at http://localhost:${settings.port}/docs`,
  );
}

main().catch((err: unknown) => {
  // כאן מגיעים רק אם השרת לא הצליח לעלות (למשל קובץ תוויות פגום או פורט תפוס)
  console.error(`${SERVICE_NAME} failed to start:`, err);
  process.exit(1);
});
