/**
 * בדיקות ספריית המחלות: התוכן מכסה את כל 38 התוויות, וה-route מחזיר קטלוג מלא עם מחירים.
 */

import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { DISEASES } from "../src/i18n/diseases.js";
import { LIBRARY, PATHOGEN_TYPE_HE } from "../src/i18n/library.js";
import { bearer, createTestContext, createUser, hasTestDb, resetDatabase, type TestContext } from "./helpers.js";

const HEBREW = /[֐-׿]/;

describe("library content", () => {
  it("covers exactly the 38 labels of the model", () => {
    expect(Object.keys(LIBRARY).sort()).toEqual(Object.keys(DISEASES).sort());
  });

  it("has Hebrew symptoms and prevention, sources, and a valid pathogen type for every label", () => {
    for (const [label, content] of Object.entries(LIBRARY)) {
      expect(content.symptomsHe, label).toMatch(HEBREW);
      expect(content.preventionHe, label).toMatch(HEBREW);
      expect(content.sources.length, label).toBeGreaterThan(0);
      for (const source of content.sources) expect(source, label).toMatch(/^https:\/\//);
      expect(PATHOGEN_TYPE_HE[content.pathogenType], label).toBeDefined();
      // "בריא" בדיוק לתוויות *___Healthy
      expect(content.pathogenType === "healthy", label).toBe(label.endsWith("___Healthy"));
    }
  });

  it("classifies late blight as an oomycete, not a true fungus", () => {
    expect(LIBRARY["Tomato___Late_blight"]!.pathogenType).toBe("oomycete");
    expect(LIBRARY["Potato___Late_blight"]!.pathogenType).toBe("oomycete");
  });
});

describe.skipIf(!hasTestDb)("GET /api/library", () => {
  let context: TestContext;

  beforeAll(async () => {
    context = createTestContext();
    await resetDatabase(context.prisma);
  });
  afterAll(async () => {
    await context.prisma.$disconnect();
  });

  it("requires a token", async () => {
    expect((await request(context.app).get("/api/library")).status).toBe(401);
  });

  it("returns all 38 entries with Hebrew content and ILS prices", async () => {
    const user = await createUser(context);
    const response = await request(context.app).get("/api/library").set(...bearer(user.token));

    expect(response.status).toBe(200);
    const entries = response.body.entries as Array<Record<string, any>>;
    expect(entries).toHaveLength(38);

    const lateBlight = entries.find((e) => e.disease.modelLabel === "Tomato___Late_blight")!;
    expect(lateBlight).toMatchObject({
      plant: "Tomato",
      pathogenType: "oomycete",
      pathogenTypeHe: "פטרייה מדומה (אואומיצט)",
      chemicalControl: true,
      disease: { displayNameHe: "עגבנייה – כימשון", nameEn: "Tomato Late blight", scientificName: "Phytophthora infestans" },
    });
    expect(lateBlight.treatments[0]).toMatchObject({
      activeIngredient: "metalaxyl-m + mancozeb",
      products: [{ productName: "Ridomil Gold MZ", minPriceILS: 110, maxPriceILS: 180 }],
    });

    const pepper = entries.find((e) => e.disease.modelLabel === "Pepper,_bell___Healthy")!;
    expect(pepper).toMatchObject({ plant: "Pepper, bell", pathogenType: "healthy", treatments: [] });

    const virus = entries.find((e) => e.disease.modelLabel === "Tomato___Tomato_mosaic_virus")!;
    expect(virus).toMatchObject({ pathogenType: "virus", chemicalControl: false, treatments: [] });
  });
});
