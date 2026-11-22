/**
 * בדיקות המילון העברי: מכסה את כל 38 התוויות של המודל ואת כל החומרים הפעילים.
 */

import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import { PRODUCT_PRICES } from "../prisma/data/productPrices.js";
import { TREATMENTS } from "../prisma/data/treatments.js";
import { ACTIVE_INGREDIENTS_HE } from "../src/i18n/activeIngredients.js";
import { DISEASES, describeDisease } from "../src/i18n/diseases.js";

const LABELS = readFileSync(
  path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../services/ai_engine/model/labels-38.txt"),
  "utf-8",
)
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter(Boolean);

const HEBREW = /[֐-׿]/;

describe("Hebrew disease dictionary", () => {
  it("covers exactly the 38 labels of the AI model", () => {
    expect(Object.keys(DISEASES).sort()).toEqual([...LABELS].sort());
  });

  it("has Hebrew names, and a scientific name for every disease but not for healthy leaves", () => {
    for (const [label, entry] of Object.entries(DISEASES)) {
      expect(entry.plantHe, label).toMatch(HEBREW);
      expect(entry.nameHe, label).toMatch(HEBREW);
      const healthy = label.endsWith("___Healthy");
      expect(entry.scientificName === null, label).toBe(healthy);
      expect(entry.nameHe === "בריא", label).toBe(healthy);
    }
  });

  it("builds a display name and falls back to English for an unknown label", () => {
    expect(describeDisease("Tomato___Late_blight", "Tomato Late blight").displayNameHe).toBe("עגבנייה – כימשון");
    expect(describeDisease("Banana___Panama", "Banana Panama")).toEqual({
      modelLabel: "Banana___Panama",
      plantHe: "Banana Panama",
      nameHe: "Banana Panama",
      displayNameHe: "Banana Panama",
      nameEn: "Banana Panama",
      scientificName: null,
    });
  });
});

describe("Hebrew active ingredient names", () => {
  it("cover every ingredient in the price dictionary and the recommendations", () => {
    const ingredients = new Set([
      ...PRODUCT_PRICES.map((p) => p.activeIngredient),
      ...TREATMENTS.flatMap((t) => t.activeIngredients),
    ]);
    for (const ingredient of ingredients) {
      expect(ACTIVE_INGREDIENTS_HE[ingredient], ingredient).toMatch(HEBREW);
    }
  });
});
