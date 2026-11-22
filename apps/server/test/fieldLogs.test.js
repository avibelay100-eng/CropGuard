/**
 * ★ בדיקות יומן השדה ו-PHI: חישוב תאריך הקטיף המותר בשרת, חובת ימי המתנה בריסוס,
 * קישור לאבחון, מצב הקטיף ברשימת החלקות, והרשאות לפי תפקיד.
 */

import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { addDays, todayInIsrael } from "../src/services/phi.js";
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

describe.skipIf(!hasTestDb)("field journal and PHI", () => {
  let context;

  beforeAll(() => {
    context = createTestContext();
  });
  beforeEach(async () => {
    await resetDatabase(context.prisma);
  });
  afterAll(async () => {
    await context.prisma.$disconnect();
  });

  const today = () => todayInIsrael();

  /** ריסוס תקין לדוגמה; override משנה שדות */
  const spray = (override = {}) => ({
    type: "SPRAY",
    appliedOn: today(),
    productName: "Ridomil Gold MZ",
    activeIngredient: "Metalaxyl-M + Mancozeb",
    dosePerDunam: 250,
    doseUnit: "g",
    phiDays: 7,
    ...override,
  });

  const addLog = (token, fieldId, body) =>
    request(context.app).post(`/api/fields/${fieldId}/logs`).set(...bearer(token)).send(body);

  async function diagnose(token, fieldId, label = "Tomato___Late_blight") {
    context.ai.next = prediction(label);
    const response = await request(context.app)
      .post("/api/diagnose")
      .set(...bearer(token))
      .field("fieldId", fieldId)
      .attach("image", PNG_BYTES, { filename: "leaf.png", contentType: "image/png" })
      .expect(201);
    return response.body.diagnosis.id;
  }

  describe("POST /api/fields/:id/logs", () => {
    it("computes the safe harvest date on the server: spray date + PHI days", async () => {
      const farmer = await createUser(context);
      const field = await createField(context, farmer.token);
      const appliedOn = addDays(today(), -2);

      // safeHarvestDate שהלקוח שולח מתעלמים ממנו - השרת מחשב בעצמו
      const response = await addLog(farmer.token, field.id, spray({ appliedOn, safeHarvestDate: "2000-01-01" }));

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        type: "SPRAY",
        appliedOn,
        productName: "Ridomil Gold MZ",
        activeIngredient: "metalaxyl-m + mancozeb",
        activeIngredientHe: "מטלקסיל-M + מנקוזב",
        dosePerDunam: 250,
        doseUnit: "g",
        phiDays: 7,
        safeHarvestDate: addDays(appliedOn, 7),
        disease: null,
      });
    });

    it("requires PHI days and a product name for a spray", async () => {
      const farmer = await createUser(context);
      const field = await createField(context, farmer.token);
      const response = await addLog(farmer.token, field.id, spray({ phiDays: null, productName: "" }));
      expect(response.status).toBe(422);
      expect(response.body.detail).toContain("phiDays");
      expect(response.body.detail).toContain("productName");
    });

    it("accepts a fertilizer entry without PHI, and rejects PHI on it", async () => {
      const farmer = await createUser(context);
      const field = await createField(context, farmer.token);

      const ok = await addLog(farmer.token, field.id, { type: "FERTILIZE", appliedOn: today(), productName: "אשלגן כלורי", dosePerDunam: 20, doseUnit: "kg" });
      expect(ok.status).toBe(201);
      expect(ok.body).toMatchObject({ phiDays: null, safeHarvestDate: null });

      const bad = await addLog(farmer.token, field.id, { type: "FERTILIZE", appliedOn: today(), phiDays: 3 });
      expect(bad.status).toBe(422);
      expect(bad.body.detail).toContain("phiDays");
    });

    it.each([
      [{ appliedOn: "2026-02-30" }, "appliedOn"],
      [{ phiDays: -1 }, "phiDays"],
      [{ phiDays: 2.5 }, "phiDays"],
      [{ doseUnit: "cups" }, "doseUnit"],
      [{ dosePerDunam: 250, doseUnit: null }, "doseUnit"],
      [{ type: "HARVEST" }, "type"],
    ])("rejects %j with 422", async (override, field) => {
      const farmer = await createUser(context);
      const created = await createField(context, farmer.token);
      const response = await addLog(farmer.token, created.id, spray(override));
      expect(response.status).toBe(422);
      expect(response.body.detail).toContain(field);
    });

    it("rejects an application date in the future (Israeli calendar)", async () => {
      const farmer = await createUser(context);
      const field = await createField(context, farmer.token);
      const response = await addLog(farmer.token, field.id, spray({ appliedOn: addDays(today(), 1) }));
      expect(response.status).toBe(422);
      expect(response.body.detail).toContain("future");
    });

    it("links the entry to a diagnosis of the same field and takes the disease from it", async () => {
      const farmer = await createUser(context);
      const field = await createField(context, farmer.token);
      const diagnosisId = await diagnose(farmer.token, field.id);

      const response = await addLog(farmer.token, field.id, spray({ diagnosisId }));
      expect(response.status).toBe(201);
      expect(response.body.diagnosisId).toBe(diagnosisId);
      expect(response.body.disease).toMatchObject({ modelLabel: "Tomato___Late_blight", nameHe: "כימשון" });
    });

    it("rejects a diagnosis that belongs to another field", async () => {
      const farmer = await createUser(context);
      const fieldA = await createField(context, farmer.token, { name: "A" });
      const fieldB = await createField(context, farmer.token, { name: "B" });
      const diagnosisId = await diagnose(farmer.token, fieldA.id);

      const response = await addLog(farmer.token, fieldB.id, spray({ diagnosisId }));
      expect(response.status).toBe(422);
      expect(response.body.detail).toContain("diagnosisId");
    });

    it("keeps the journal entry when its diagnosis is deleted", async () => {
      const farmer = await createUser(context);
      const field = await createField(context, farmer.token);
      const diagnosisId = await diagnose(farmer.token, field.id);
      const log = await addLog(farmer.token, field.id, spray({ diagnosisId }));

      await request(context.app).delete(`/api/diagnoses/${diagnosisId}`).set(...bearer(farmer.token)).expect(204);

      const journal = await request(context.app).get(`/api/fields/${field.id}/logs`).set(...bearer(farmer.token));
      expect(journal.body.items).toHaveLength(1);
      expect(journal.body.items[0]).toMatchObject({ id: log.body.id, diagnosisId: null, disease: { nameHe: "כימשון" } });
    });

    it("returns 404 to another farmer and 403 to an agronomist, and lets an admin write", async () => {
      const owner = await createUser(context);
      const other = await createUser(context);
      const agronomist = await createUser(context, "AGRONOMIST");
      const admin = await createUser(context, "ADMIN");
      const field = await createField(context, owner.token);

      expect((await addLog(other.token, field.id, spray())).status).toBe(404);
      expect((await addLog(agronomist.token, field.id, spray())).status).toBe(403);
      expect((await addLog(admin.token, field.id, spray())).status).toBe(201);
    });
  });

  describe("harvest status (PHI)", () => {
    it("blocks the harvest until the latest safe date, and shows it on the field list", async () => {
      const farmer = await createUser(context);
      const field = await createField(context, farmer.token);
      // ריסוס ישן שימי ההמתנה שלו כבר עברו - לא חוסם
      await addLog(farmer.token, field.id, spray({ appliedOn: addDays(today(), -20), phiDays: 7 }));
      // שני ריסוסים פעילים - הקובע הוא זה שנגמר אחרון, גם אם רוסס קודם
      await addLog(farmer.token, field.id, spray({ appliedOn: addDays(today(), -3), phiDays: 14 }));
      await addLog(farmer.token, field.id, spray({ appliedOn: addDays(today(), -1), phiDays: 3 }));

      const list = await request(context.app).get("/api/fields").set(...bearer(farmer.token));
      expect(list.body.items[0]).toMatchObject({ logCount: 3, harvestBlockedUntil: addDays(today(), 11) });

      const journal = await request(context.app).get(`/api/fields/${field.id}/logs`).set(...bearer(farmer.token));
      expect(journal.body.today).toBe(today());
      expect(journal.body.field.harvestBlockedUntil).toBe(addDays(today(), 11));
    });

    it("does not block on the safe date itself, or when the waiting period has passed", async () => {
      const farmer = await createUser(context);
      const field = await createField(context, farmer.token);
      // רוסס לפני 7 ימים עם PHI 7 => מותר לקטוף היום
      await addLog(farmer.token, field.id, spray({ appliedOn: addDays(today(), -7), phiDays: 7 }));
      // דישון והשקיה לא משפיעים על הקטיף
      await addLog(farmer.token, field.id, { type: "IRRIGATE", appliedOn: today() });

      const list = await request(context.app).get("/api/fields").set(...bearer(farmer.token));
      expect(list.body.items[0]).toMatchObject({ logCount: 2, harvestBlockedUntil: null });
    });
  });

  describe("GET /api/fields/:id/logs", () => {
    it("lists entries newest first", async () => {
      const farmer = await createUser(context);
      const field = await createField(context, farmer.token);
      await addLog(farmer.token, field.id, spray({ appliedOn: addDays(today(), -5), productName: "ישן" }));
      await addLog(farmer.token, field.id, spray({ appliedOn: today(), productName: "חדש" }));

      const response = await request(context.app).get(`/api/fields/${field.id}/logs`).set(...bearer(farmer.token));
      expect(response.status).toBe(200);
      expect(response.body.items.map((item) => item.productName)).toEqual(["חדש", "ישן"]);
      expect(response.body.field.id).toBe(field.id);
    });

    it("hides another farmer's journal (404) but shows it to an agronomist", async () => {
      const owner = await createUser(context);
      const other = await createUser(context);
      const agronomist = await createUser(context, "AGRONOMIST");
      const field = await createField(context, owner.token);
      await addLog(owner.token, field.id, spray());

      expect((await request(context.app).get(`/api/fields/${field.id}/logs`).set(...bearer(other.token))).status).toBe(404);
      const seen = await request(context.app).get(`/api/fields/${field.id}/logs`).set(...bearer(agronomist.token));
      expect(seen.status).toBe(200);
      expect(seen.body.items).toHaveLength(1);
    });
  });

  describe("DELETE /api/fields/:id/logs/:logId", () => {
    it("deletes an entry, and the harvest is no longer blocked by it", async () => {
      const farmer = await createUser(context);
      const field = await createField(context, farmer.token);
      const log = await addLog(farmer.token, field.id, spray());

      const response = await request(context.app).delete(`/api/fields/${field.id}/logs/${log.body.id}`).set(...bearer(farmer.token));
      expect(response.status).toBe(204);

      const list = await request(context.app).get("/api/fields").set(...bearer(farmer.token));
      expect(list.body.items[0]).toMatchObject({ logCount: 0, harvestBlockedUntil: null });
    });

    it("returns 404 for an entry of a different field, and 403 to an agronomist", async () => {
      const farmer = await createUser(context);
      const agronomist = await createUser(context, "AGRONOMIST");
      const fieldA = await createField(context, farmer.token, { name: "A" });
      const fieldB = await createField(context, farmer.token, { name: "B" });
      const log = await addLog(farmer.token, fieldA.id, spray());

      expect((await request(context.app).delete(`/api/fields/${fieldB.id}/logs/${log.body.id}`).set(...bearer(farmer.token))).status).toBe(404);
      expect((await request(context.app).delete(`/api/fields/${fieldA.id}/logs/${log.body.id}`).set(...bearer(agronomist.token))).status).toBe(403);
      expect(await context.prisma.fieldLog.count()).toBe(1);
    });
  });

  it("includes each product's PHI days in the diagnosis treatments (for auto-fill)", async () => {
    const farmer = await createUser(context);
    const field = await createField(context, farmer.token);
    context.ai.next = prediction("Tomato___Late_blight");
    const response = await request(context.app)
      .post("/api/diagnose")
      .set(...bearer(farmer.token))
      .field("fieldId", field.id)
      .attach("image", PNG_BYTES, { filename: "leaf.png", contentType: "image/png" })
      .expect(201);

    const ridomil = response.body.treatments[0].products[0];
    expect(ridomil).toMatchObject({ productName: "Ridomil Gold MZ", phiDays: 7 });
  });
});
