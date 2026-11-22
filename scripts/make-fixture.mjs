/**
 * יוצר את תמונת הבדיקה scripts/fixtures/synthetic-leaf.png:
 * משטח ירוק עם כתמים חומים - תמונה סינתטית (לא צילום אמיתי), שהמודל מזהה ככימשון בעגבנייה.
 * צריך להריץ רק אם הקובץ נמחק: node scripts/make-fixture.mjs
 */

import { mkdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import sharp from "sharp";

const size = 224;
const pixels = Buffer.alloc(size * size * 3);
// מחולל מספרים פסאודו-אקראי קבוע, כדי שהתמונה תהיה זהה בכל יצירה
let seed = 42;
const random = () => ((seed = (seed * 1103515245 + 12345) % 2 ** 31) / 2 ** 31);
const spots = Array.from({ length: 25 }, () => [20 + Math.floor(random() * 184), 20 + Math.floor(random() * 184)]);

for (let y = 0; y < size; y++) {
  for (let x = 0; x < size; x++) {
    const inSpot = spots.some(([cx, cy]) => (x - cx) ** 2 + (y - cy) ** 2 < 64);
    const [r, g, b] = inSpot ? [110, 70, 30] : [60, 140, 50];
    const offset = (y * size + x) * 3;
    pixels[offset] = r;
    pixels[offset + 1] = g;
    pixels[offset + 2] = b;
  }
}

const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures");
mkdirSync(dir, { recursive: true });
await sharp(pixels, { raw: { width: size, height: size, channels: 3 } }).png().toFile(path.join(dir, "synthetic-leaf.png"));
console.log("wrote scripts/fixtures/synthetic-leaf.png");
