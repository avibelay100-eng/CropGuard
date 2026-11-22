/**
 * CropGuard AI Engine - הפיכת הבייטים של התמונה שהועלתה לטנזור שהמודל מצפה לו.
 */

import sharp from "sharp";

/** הבייטים שהועלו אינם תמונה שאפשר לפענח */
export class InvalidImageError extends Error {
  name = "InvalidImageError";
}

// הגנה מפני "פצצת דחיסה": קובץ קטן שמתפרק לתמונה ענקית בזיכרון
const MAX_INPUT_PIXELS = 100_000_000;

/**
 * מפענח את התמונה, ממיר ל-RGB ומשנה את הגודל ל-imageSize x imageSize.
 *
 * מחזיר מערך Float32 בסדר [שורה, עמודה, ערוץ] (NHWC) עם ערכים גולמיים 0..255.
 * חשוב: לא מחלקים ב-255! המודל מנרמל בעצמו ל-[-1, 1] בתוך הגרף שלו
 * (שכבות TrueDivide ו-Subtract), בדיוק כמו ב-backend-api.
 */
export async function prepareImage(raw, imageSize = 224) {
  let data;
  let info;
  try {
    ({ data, info } = await sharp(raw, { failOn: "error", limitInputPixels: MAX_INPUT_PIXELS })
      // הסרת ערוץ השקיפות (בלי מיזוג עם רקע) - כמו convert("RGB") של Pillow
      .removeAlpha()
      // גם תמונות בגווני אפור או CMYK הופכות לשלושה ערוצי RGB
      .toColourspace("srgb")
      // מתיחה לגודל המדויק בלי לשמור יחס, עם אינטרפולציה בילינארית כמו ב-Python
      .resize(imageSize, imageSize, { fit: "fill", kernel: sharp.kernel.linear })
      .raw()
      .toBuffer({ resolveWithObject: true }));
  } catch (err) {
    throw new InvalidImageError("The uploaded file is not a readable image.", { cause: err });
  }

  if (info.width !== imageSize || info.height !== imageSize || info.channels !== 3) {
    throw new InvalidImageError(
      `Unexpected decoded image layout ${info.width}x${info.height}x${info.channels}.`,
    );
  }

  // המרה מ-uint8 ל-float32, בלי לשנות את טווח הערכים
  return Float32Array.from(data);
}
