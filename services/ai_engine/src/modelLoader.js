/**
 * CropGuard AI Engine - טעינת המודל והרצת תחזית עם ONNX Runtime.
 *
 * המודל המקורי הוא cropora_model.keras. הוא הומר פעם אחת ל-cropora_model.onnx
 * בעזרת tools/convert_to_onnx.py (נבדק: סטייה של 1e-7 לכל היותר מול Keras).
 *
 * אם הטעינה נכשלת נזרקת ModelLoadError. אין מעבר שקט לתחזיות מזויפות:
 * שירות שבור מחזיר 503, ולא תוצאה שגויה למשתמש.
 */

import { stat } from "node:fs/promises";
import * as ort from "onnxruntime-node";

/** המודל לא נטען או לא תואם לחוזה ההגשה */
export class ModelLoadError extends Error {
  name = "ModelLoadError";
}

/** המודל רץ, אבל הפלט שלו לא תקין (צורה שגויה, ערכים מחוץ לטווח וכו') */
export class InferenceError extends Error {
  name = "InferenceError";
}

/**
 * כל מה שהשרת צריך מהמודל: התוויות, ופונקציה שמחזירה הסתברות לכל תווית
 * @typedef {object} Predictor
 * @property {readonly string[]} labels
 * @property {(pixels: Float32Array) => Promise<Float32Array>} predictScores
 * @property {() => Promise<void>} close
 */

// סטייה מותרת בסכום ההסתברויות (אמור להיות 1 אחרי softmax)
const SUM_TOLERANCE = 1e-4;

/** בודק שהפלט הוא וקטור הסתברויות תקין באורך מספר התוויות, ומחזיר עותק שלו */
function validateScores(output, classCount) {
  if (!output) {
    throw new InferenceError("Model returned no output tensor");
  }
  if (output.type !== "float32") {
    throw new InferenceError(`Expected float32 output, got ${output.type}`);
  }
  const dims = output.dims.join(",");
  if (dims !== `1,${classCount}`) {
    throw new InferenceError(`Expected output shape [1, ${classCount}], got [${dims}]`);
  }

  const scores = Float32Array.from(output.data);
  let sum = 0;
  for (const value of scores) {
    if (!Number.isFinite(value) || value < 0 || value > 1) {
      throw new InferenceError("Model returned scores outside [0, 1]");
    }
    sum += value;
  }
  if (Math.abs(sum - 1) > SUM_TOLERANCE) {
    throw new InferenceError(`Model scores sum to ${sum.toFixed(5)}, expected 1 (logits are not supported)`);
  }
  return scores;
}

/** מריץ את מודל ה-ONNX על תמונה אחת ומחזיר 38 הסתברויות אחרי אימות; run רץ על thread נפרד ולא חוסם את השרת */
export class OnnxPredictor {
  session;
  labels;
  imageSize;
  inputName;
  outputName;

  constructor(session, labels, imageSize) {
    this.session = session;
    this.labels = labels;
    this.imageSize = imageSize;
    // הבדיקה ב-loadPredictor כבר וידאה שיש בדיוק קלט אחד ופלט אחד
    this.inputName = session.inputNames[0];
    this.outputName = session.outputNames[0];
  }

  async predictScores(pixels) {
    const expectedLength = this.imageSize * this.imageSize * 3;
    if (pixels.length !== expectedLength) {
      throw new InferenceError(`Expected ${expectedLength} pixel values, got ${pixels.length}`);
    }
    // טנזור בצורה [1, 224, 224, 3] - תמונה אחת, NHWC
    const input = new ort.Tensor("float32", pixels, [1, this.imageSize, this.imageSize, 3]);
    // run רץ על thread נפרד של ONNX Runtime, כך שהוא לא חוסם את השרת
    const results = await this.session.run({ [this.inputName]: input });
    return validateScores(results[this.outputName], this.labels.length);
  }

  async close() {
    await this.session.release();
  }
}

/** בודק שהמודל מקבל [N, size, size, 3], לפי המטא-דאטה שבקובץ ה-ONNX */
function validateInputShape(session, imageSize) {
  const metadata = session.inputMetadata?.[0];
  if (!metadata || !("shape" in metadata)) {
    return; // גרסאות ישנות של onnxruntime לא חושפות מטא-דאטה; בדיקת החימום תתפוס בעיות
  }
  const spatial = metadata.shape.slice(1).join(",");
  if (spatial !== `${imageSize},${imageSize},3`) {
    throw new ModelLoadError(`Expected model input [N, ${imageSize}, ${imageSize}, 3], got [${metadata.shape.join(", ")}]`);
  }
}

/**
 * טוען את המודל פעם אחת בעליית השרת, בודק אותו ומחמם אותו בהרצה על תמונה ריקה.
 * ההרצה הראשונה איטית יותר, ולכן עדיף שתקרה כאן ולא בבקשה של משתמש.
 */
export async function loadPredictor(
  modelPath,
  labels,
  imageSize = 224,
) {
  try {
    const info = await stat(modelPath);
    if (!info.isFile()) {
      throw new Error("not a file");
    }
  } catch {
    throw new ModelLoadError(`Model file not found: ${modelPath}`);
  }

  let session;
  try {
    session = await ort.InferenceSession.create(modelPath, {
      executionProviders: ["cpu"],
      graphOptimizationLevel: "all",
    });
  } catch (err) {
    throw new ModelLoadError(`Could not load ONNX model from ${modelPath}: ${(err).message}`, { cause: err });
  }

  if (session.inputNames.length !== 1 || session.outputNames.length !== 1) {
    await session.release();
    throw new ModelLoadError("Expected exactly one model input and one model output");
  }

  const predictor = new OnnxPredictor(session, labels, imageSize);
  try {
    validateInputShape(session, imageSize);
    // חימום: מוודא גם שהפלט באורך מספר התוויות
    await predictor.predictScores(new Float32Array(imageSize * imageSize * 3));
  } catch (err) {
    await session.release();
    if (err instanceof ModelLoadError) throw err;
    throw new ModelLoadError(`Model warm-up inference failed: ${(err).message}`, { cause: err });
  }
  return predictor;
}

/** האינדקסים של k הציונים הגבוהים ביותר, מהגבוה לנמוך */
export function topKIndices(scores, k) {
  const count = Math.max(1, Math.min(Math.floor(k), scores.length));
  return Array.from(scores.keys())
    .sort((a, b) => scores[b] - scores[a])
    .slice(0, count);
}
