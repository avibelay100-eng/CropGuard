/**
 * בדיקות לנתוני ה-seed: רצות בלי מסד נתונים, ובודקות שהמילונים עקביים
 * עם עצמם ועם התוויות של מודל ה-AI.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { PRODUCT_PRICES } from "../prisma/data/productPrices.js";
import { TREATMENTS } from "../prisma/data/treatments.js";

// התוויות הקנוניות של המודל, מתוך שירות ה-AI
const LABELS_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../services/ai_engine/model/labels-38.txt",
);
const MODEL_LABELS = readFileSync(LABELS_PATH, "utf-8")
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line !== "" && !line.startsWith("#"));
const DISEASE_LABELS = MODEL_LABELS.filter((label) => !label.endsWith("___Healthy"));

describe("treatment recommendations", () => {
  it("cover exactly the 26 disease labels of the AI model (no healthy labels)", () => {
    expect(MODEL_LABELS).toHaveLength(38);
    expect(TREATMENTS.map((t) => t.modelLabel).sort()).toEqual([...DISEASE_LABELS].sort());
  });

  it("list active ingredients only when chemical control exists", () => {
    for (const treatment of TREATMENTS) {
      expect(treatment.activeIngredients.length > 0, treatment.modelLabel).toBe(treatment.chemicalControl);
      expect(treatment.note.trim(), treatment.modelLabel).not.toBe("");
    }
  });

  it("only reference active ingredients that have at least one product price", () => {
    const priced = new Set(PRODUCT_PRICES.map((p) => p.activeIngredient));
    const missing = TREATMENTS.flatMap((t) => t.activeIngredients).filter((ingredient) => !priced.has(ingredient));
    expect(missing).toEqual([]);
  });
});

describe("product price ranges", () => {
  it("have valid ILS ranges", () => {
    for (const product of PRODUCT_PRICES) {
      expect(product.minPriceILS, product.productName).toBeGreaterThan(0);
      expect(product.maxPriceILS, product.productName).toBeGreaterThanOrEqual(product.minPriceILS);
    }
  });

  it("are unique per ingredient, product and package (the seed upsert key)", () => {
    const keys = PRODUCT_PRICES.map((p) => `${p.activeIngredient}|${p.productName}|${p.packageSize}`);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it("use lowercase ingredient names", () => {
    for (const product of PRODUCT_PRICES) {
      expect(product.activeIngredient).toBe(product.activeIngredient.toLowerCase());
    }
  });

  // ★ PHI: כל מוצר צריך ימי המתנה לקטיף, כדי שיומן השדה יוכל למלא אותם אוטומטית
  it("have a whole-number pre-harvest interval (PHI) of 0..365 days", () => {
    for (const product of PRODUCT_PRICES) {
      expect(Number.isInteger(product.phiDays), product.productName).toBe(true);
      expect(product.phiDays, product.productName).toBeGreaterThanOrEqual(0);
      expect(product.phiDays, product.productName).toBeLessThanOrEqual(365);
    }
  });

  it("are not marked verified without a real source", () => {
    for (const product of PRODUCT_PRICES.filter((p) => p.isVerified)) {
      expect(product.priceSource, product.productName).not.toMatch(/placeholder/i);
    }
  });
});
