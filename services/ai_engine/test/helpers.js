/**
 * כלי עזר לבדיקות: בניית בקשות multipart ויצירת תמונות בדיקה.
 */

import sharp from "sharp";

const BOUNDARY = "----CropGuardTestBoundary";

/**
 * @typedef {object} MultipartPart
 * @property {string} field
 * @property {string} [filename] - אם יש filename - זה חלק של קובץ; אחרת שדה טקסט
 * @property {string} [contentType]
 * @property {Buffer | string} data
 */

/** בונה גוף בקשה multipart/form-data ידנית, כדי לשלוט בכל פרט (סוג תוכן, שם שדה וכו') */
export function multipart(parts) {
  const chunks = [];
  for (const part of parts) {
    let header = `--${BOUNDARY}\r\nContent-Disposition: form-data; name="${part.field}"`;
    if (part.filename !== undefined) header += `; filename="${part.filename}"`;
    header += "\r\n";
    if (part.contentType !== undefined) header += `Content-Type: ${part.contentType}\r\n`;
    chunks.push(Buffer.from(`${header}\r\n`), Buffer.from(part.data), Buffer.from("\r\n"));
  }
  chunks.push(Buffer.from(`--${BOUNDARY}--\r\n`));
  return {
    payload: Buffer.concat(chunks),
    headers: { "content-type": `multipart/form-data; boundary=${BOUNDARY}` },
  };
}

/** קיצור: בקשה עם קובץ אחד בשדה "image" */
export function imageUpload(data, contentType = "image/png", filename = "leaf.png") {
  return multipart([{ field: "image", filename, contentType, data }]);
}

/** תמונה בצבע אחיד */
export function solidPng(width, height, rgb) {
  return sharp({ create: { width, height, channels: 3, background: { r: rgb[0], g: rgb[1], b: rgb[2] } } })
    .png()
    .toBuffer();
}

/**
 * תמונת מעבר צבע 224x224 - זהה בדיוק לתמונת הייחוס שהורצה על מודל ה-Keras המקורי:
 * אדום עולה משמאל לימין, ירוק יורד מלמעלה למטה, כחול קבוע 90.
 * (np.linspace + astype(uint8) של numpy = חיתוך כלפי אפס, כמו Math.trunc)
 */
export function gradientPng() {
  const size = 224;
  const pixels = Buffer.alloc(size * size * 3);
  const upStep = 255 / (size - 1);
  const downStep = (0 - 255) / (size - 1);
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const offset = (row * size + col) * 3;
      pixels[offset] = Math.trunc(col * upStep);
      pixels[offset + 1] = row === size - 1 ? 0 : Math.trunc(row * downStep + 255);
      pixels[offset + 2] = 90;
    }
  }
  return sharp(pixels, { raw: { width: size, height: size, channels: 3 } }).png().toBuffer();
}
