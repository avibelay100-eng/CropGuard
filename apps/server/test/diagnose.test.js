/**
 * בדיקות POST /api/diagnose - הנתיב המרכזי.
 * שירות ה-AI מדומה (FakeAiClient), המסד אמיתי.
 */

import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { DISCLAIMER_HE, UNCERTAIN_WARNING_HE, UNVERIFIED_PRICES_WARNING_HE } from "../src/routes/diagnose.js";
import { AiServiceError } from "../src/services/aiClient.js";
import { HEALTHY_GUIDANCE_HE } from "../src/services/treatments.js";
import {
  bearer,
  createField,
  createTestContext,
  createUser,
  hasTestDb,
  PNG_BYTES,
  prediction,
  resetDatabase,
} from "./helpers.js";

describe.skipIf(!hasTestDb)("POST /api/diagnose", () => {
  let context;
  let farmerToken;
  let fieldId;

  beforeAll(() => {
    context = createTestContext();
  });
  beforeEach(async () => {
    await resetDatabase(context.prisma);
    context.ai.calls.length = 0;
    context.ai.next = prediction("Tomato___Late_blight", 0.8995);
    context.images.images.clear();
    const farmer = await createUser(context);
    farmerToken = farmer.token;
    fieldId = (await createField(context, farmerToken)).id;
  });
  afterAll(async () => {
    await context.prisma.$disconnect();
  });

  const diagnose = (token, field = fieldId, image = PNG_BYTES, contentType = "image/png") => {
    let call = request(context.app).post("/api/diagnose").set(...bearer(token));
    if (field !== null) call = call.field("fieldId", field);
    if (image !== null) call = call.attach("image", image, { filename: "leaf.png", contentType });
    return call;
  };

  it("diagnoses a leaf, returns Hebrew guidance with prices, and saves the diagnosis", async () => {
    const response = await diagnose(farmerToken);

    expect(response.status).toBe(201);
    const body = response.body;

    // שם המחלה בעברית לצד האנגלית והשם המדעי
    expect(body.disease).toEqual({
      modelLabel: "Tomato___Late_blight",
      plantHe: "עגבנייה",
      nameHe: "כימשון",
      displayNameHe: "עגבנייה – כימשון",
      nameEn: "Tomato Late blight",
      scientificName: "Phytophthora infestans",
    });
    expect(body).toMatchObject({
      isHealthy: false,
      status: "infected",
      statusHe: "נגוע",
      confidence: 0.8995,
      confidencePercent: 89.95,
      uncertain: false,
      chemicalControl: true,
      disclaimerHe: DISCLAIMER_HE,
    });
    expect(body.guidanceHe).toContain("כימשון");

    // חומרים פעילים לפי סדר ההמלצה, עם שם בעברית ומוצרים במחירים בשקלים
    expect(body.treatments.map((t) => t.activeIngredient)).toEqual([
      "metalaxyl-m + mancozeb",
      "cymoxanil + mancozeb",
      "mandipropamid",
    ]);
    expect(body.treatments[0]).toMatchObject({
      activeIngredientHe: "מטלקסיל-M + מנקוזב",
      products: [{ productName: "Ridomil Gold MZ", packageSize: "1 kg", minPriceILS: 110, maxPriceILS: 180, isVerified: false }],
    });
    // המחירים עוד לא אומתו - חייבת להופיע אזהרה
    expect(body.warningsHe).toEqual([UNVERIFIED_PRICES_WARNING_HE]);

    // נשמר במסד, עם החומר הפעיל הראשון
    const saved = await context.prisma.diagnosis.findUniqueOrThrow({ where: { id: body.diagnosis.id } });
    expect(saved).toMatchObject({
      fieldId,
      modelLabel: "Tomato___Late_blight",
      diseaseName: "Tomato Late blight",
      confidence: 0.8995,
      isHealthy: false,
      activeIngredient: "metalaxyl-m + mancozeb",
      imageUrl: body.diagnosis.imageUrl,
    });

    // התמונה נשלחה לשירות ה-AI ונשמרה
    expect(context.ai.calls).toHaveLength(1);
    expect(context.ai.calls[0].buffer.equals(PNG_BYTES)).toBe(true);
    expect(context.images.images.get(body.diagnosis.imageUrl)?.equals(PNG_BYTES)).toBe(true);
  });

  it("returns healthy guidance and no treatments for a healthy leaf", async () => {
    context.ai.next = prediction("Tomato___Healthy", 0.97);
    const response = await diagnose(farmerToken);

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      isHealthy: true,
      statusHe: "בריא",
      guidanceHe: HEALTHY_GUIDANCE_HE,
      chemicalControl: false,
      treatments: [],
      warningsHe: [],
    });
    expect(response.body.disease).toMatchObject({ displayNameHe: "עגבנייה – בריא", scientificName: null });

    const saved = await context.prisma.diagnosis.findFirstOrThrow();
    expect(saved.activeIngredient).toBeNull();
  });

  it("returns no products for a disease without chemical control (virus)", async () => {
    context.ai.next = prediction("Tomato___Tomato_Yellow_Leaf_Curl_Virus", 0.9);
    const response = await diagnose(farmerToken);

    expect(response.status).toBe(201);
    expect(response.body.chemicalControl).toBe(false);
    expect(response.body.treatments).toEqual([]);
    expect(response.body.guidanceHe).toContain("אין תכשיר");
    expect(response.body.disease.scientificName).toBe("Tomato yellow leaf curl virus");
  });

  describe("crop check against the field's crop", () => {
    it("matches when the model sees the field's crop", async () => {
      const response = await diagnose(farmerToken);
      expect(response.body.cropCheck).toMatchObject({
        fieldCrop: "Tomato",
        fieldCropHe: "עגבנייה",
        predictedPlant: "Tomato",
        supported: true,
        matches: true,
        fieldCropSharePercent: 90,
      });
      expect(response.body.treatments.length).toBeGreaterThan(0);
      const saved = await context.prisma.diagnosis.findFirstOrThrow();
      expect(saved.cropMismatch).toBe(false);
    });

    it("warns, hides spray advice and saves the mismatch when the model sees another plant", async () => {
      const corn = await createField(context, farmerToken, { name: "שדה תירס", cropType: "Corn" });
      // תמונה של צמח אחר: המודל בטוח שזו עגבנייה, ורק מעט הסתברות נופלת על תירס
      context.ai.next = prediction("Tomato___Early_blight", 0.9, [
        ["Corn___Northern_Leaf_Blight", 0.024],
        ["Corn___Common_rust", 0.01],
      ]);

      const response = await diagnose(farmerToken, corn.id);

      expect(response.status).toBe(201);
      const body = response.body;
      expect(body.cropCheck).toMatchObject({
        fieldCrop: "Corn",
        fieldCropHe: "תירס",
        predictedPlant: "Tomato",
        predictedPlantHe: "עגבנייה",
        supported: true,
        matches: false,
        fieldCropSharePercent: 3.4,
      });
      expect(body.cropCheck.inFieldCrop.map((o) => o.disease.displayNameHe)).toEqual([
        "תירס – כתמת עלים צפונית",
        "תירס – חלדון מצוי",
      ]);
      // לא ממליצים על ריסוס לעגבנייה בשדה תירס
      expect(body.treatments).toEqual([]);
      expect(body.chemicalControl).toBe(false);
      expect(body.uncertain).toBe(true);
      expect(body.warningsHe[0]).toContain("החלקה מוגדרת כתירס, אבל המודל זיהה עגבנייה");

      const saved = await context.prisma.diagnosis.findUniqueOrThrow({ where: { id: body.diagnosis.id } });
      expect(saved).toMatchObject({ cropMismatch: true, activeIngredient: null });
    });

    it("warns when the field's crop is not one the model knows", async () => {
      const cabbage = await createField(context, farmerToken, { name: "כרוב", cropType: "Cabbage" });
      context.ai.next = prediction("Tomato___Early_blight", 0.6);

      const response = await diagnose(farmerToken, cabbage.id);

      expect(response.body.cropCheck).toMatchObject({ supported: false, matches: false, fieldCropSharePercent: 0 });
      expect(response.body.warningsHe[0]).toContain("אינו אחד מהגידולים שהמודל מכיר");
      expect(response.body.treatments).toEqual([]);
    });
  });

  it("warns in Hebrew when the AI is uncertain", async () => {
    context.ai.next = prediction("Tomato___Early_blight", 0.42);
    const response = await diagnose(farmerToken);

    expect(response.status).toBe(201);
    expect(response.body.uncertain).toBe(true);
    expect(response.body.warningsHe).toContain(UNCERTAIN_WARNING_HE);
  });

  it("lets an agronomist diagnose any farmer's field", async () => {
    const agronomist = await createUser(context, "AGRONOMIST");
    expect((await diagnose(agronomist.token)).status).toBe(201);
  });

  it("returns 404 (not 403) for another farmer's field, without calling the AI", async () => {
    const other = await createUser(context);
    const response = await diagnose(other.token);

    expect(response.status).toBe(404);
    expect(context.ai.calls).toHaveLength(0);
    expect(await context.prisma.diagnosis.count()).toBe(0);
  });

  it("returns 404 for a field that does not exist", async () => {
    expect((await diagnose(farmerToken, "no-such-field")).status).toBe(404);
  });

  it("requires authentication", async () => {
    const response = await request(context.app)
      .post("/api/diagnose")
      .field("fieldId", fieldId)
      .attach("image", PNG_BYTES, { filename: "leaf.png", contentType: "image/png" });
    expect(response.status).toBe(401);
  });

  it("rejects a request without an image with 422", async () => {
    const response = await diagnose(farmerToken, fieldId, null);
    expect(response.status).toBe(422);
    expect(response.body.detail).toContain("image");
  });

  it("rejects a request without fieldId with 422", async () => {
    const response = await diagnose(farmerToken, null);
    expect(response.status).toBe(422);
    expect(response.body.detail).toContain("fieldId");
  });

  it("rejects a non-image file with 415", async () => {
    const response = await diagnose(farmerToken, fieldId, Buffer.from("hello"), "text/plain");
    expect(response.status).toBe(415);
    expect(context.ai.calls).toHaveLength(0);
  });

  it("rejects an image over the size limit with 413", async () => {
    const small = createTestContext({ maxUploadBytes: 10 });
    try {
      const response = await request(small.app)
        .post("/api/diagnose")
        .set(...bearer(farmerToken))
        .field("fieldId", fieldId)
        .attach("image", PNG_BYTES, { filename: "leaf.png", contentType: "image/png" });
      expect(response.status).toBe(413);
      expect(response.body.error).toBe("payload_too_large");
    } finally {
      await small.prisma.$disconnect();
    }
  });

  it("returns 503 and saves nothing when the AI engine is down", async () => {
    context.ai.next = new AiServiceError("unavailable", 503, "AI engine is unreachable: ECONNREFUSED");
    const response = await diagnose(farmerToken);

    expect(response.status).toBe(503);
    expect(response.body.error).toBe("ai_unavailable");
    // פרטים פנימיים (כתובת, ECONNREFUSED) לא נחשפים ללקוח
    expect(response.body.detail).not.toContain("ECONNREFUSED");
    expect(await context.prisma.diagnosis.count()).toBe(0);
    expect(context.images.images.size).toBe(0);
  });

  it("passes the AI engine's rejection of a bad image through as 400", async () => {
    context.ai.next = new AiServiceError("rejected", 400, "The uploaded file is not a readable image.");
    const response = await diagnose(farmerToken);

    expect(response.status).toBe(400);
    expect(response.body).toEqual({ error: "bad_request", detail: "The uploaded file is not a readable image." });
    expect(await context.prisma.diagnosis.count()).toBe(0);
  });
});
