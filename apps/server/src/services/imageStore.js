/**
 * שמירת תמונות העלים.
 * כרגע בדיסק (תיקיית uploads); הממשק מאפשר להחליף בהמשך לאחסון ענן (S3 וכו')
 * בלי לשנות את ה-routes.
 */

import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * הממשק לאחסון תמונות - מאפשר להחליף בעתיד דיסק מקומי באחסון ענן בלי לגעת ב-routes
 * @typedef {object} ImageStore
 * @property {(buffer: Buffer, mimetype: string) => Promise<string>} save - שומר את התמונה ומחזיר מזהה (נשמר ב-Diagnosis.imageUrl)
 * @property {(imageUrl: string) => Promise<void>} remove - מוחק תמונה שנשמרה (למשל אם שמירת האבחון נכשלה)
 */

const EXTENSIONS = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "image/gif": ".gif",
  "image/bmp": ".bmp",
  "image/tiff": ".tiff",
};

/** אחסון בדיסק: שם קובץ אקראי (UUID) ולא השם של המשתמש - מונע התנגשויות ו-path traversal */
export function createDiskImageStore(uploadDir) {
  return {
    async save(buffer, mimetype) {
      await mkdir(uploadDir, { recursive: true });
      // שם אקראי: לא משתמשים בשם הקובץ של המשתמש, כדי למנוע התנגשויות ו-path traversal
      const filename = `${randomUUID()}${EXTENSIONS[mimetype] ?? ".bin"}`;
      await writeFile(path.join(uploadDir, filename), buffer);
      return `uploads/${filename}`;
    },
    async remove(imageUrl) {
      const filename = path.basename(imageUrl);
      await rm(path.join(uploadDir, filename), { force: true });
    },
  };
}
