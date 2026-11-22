/**
 * בדיקות חלקות: יצירה, פרטים מורחבים, עריכה, מחיקה, אימות קלט והרשאות לפי תפקיד.
 */

import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import {
  bearer,
  createField,
  createTestContext,
  createUser,
  hasTestDb,
  PNG_BYTES,
  prediction,
  resetDatabase,
  type TestContext,
} from "./helpers.js";
import { todayInIsrael } from "../src/services/phi.js";

describe.skipIf(!hasTestDb)("field routes", () => {
  let context: TestContext;

  beforeAll(() => {
    context = createTestContext();
  });
  beforeEach(async () => {
    await resetDatabase(context.prisma);
  });
  afterAll(async () => {
    await context.prisma.$disconnect();
  });

  it("requires authentication", async () => {
    expect((await request(context.app).get("/api/fields")).status).toBe(401);
    expect((await request(context.app).post("/api/fields").send({})).status).toBe(401);
  });

  describe("POST /api/fields", () => {
    it("creates a field owned by the current user", async () => {
      const farmer = await createUser(context);
      const response = await request(context.app)
        .post("/api/fields")
        .set(...bearer(farmer.token))
        .send({ name: "  חממה 3  ", cropType: "Tomato", latitude: 31.25, longitude: 34.79 });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        name: "חממה 3",
        cropType: "Tomato",
        latitude: 31.25,
        longitude: 34.79,
        ownerId: farmer.user.id,
        ownerName: farmer.user.name,
        diagnosisCount: 0,
      });
      expect(await context.prisma.field.count()).toBe(1);
    });

    it.each([
      [{ latitude: 91 }, "latitude"],
      [{ latitude: -90.5 }, "latitude"],
      [{ longitude: 181 }, "longitude"],
      [{ longitude: "34.79" }, "longitude"],
      [{ name: "" }, "name"],
      [{ cropType: "" }, "cropType"],
    ])("rejects %j with 422", async (override, field) => {
      const farmer = await createUser(context);
      const response = await request(context.app)
        .post("/api/fields")
        .set(...bearer(farmer.token))
        .send({ name: "A", cropType: "Tomato", latitude: 31, longitude: 34, ...override });
      expect(response.status).toBe(422);
      expect(response.body.detail).toContain(field);
    });

    it("forbids a farmer from creating a field for someone else", async () => {
      const farmer = await createUser(context);
      const other = await createUser(context);
      const response = await request(context.app)
        .post("/api/fields")
        .set(...bearer(farmer.token))
        .send({ name: "A", cropType: "Tomato", latitude: 31, longitude: 34, ownerId: other.user.id });
      expect(response.status).toBe(403);
    });

    it("lets an admin create a field for another user", async () => {
      const admin = await createUser(context, "ADMIN");
      const farmer = await createUser(context);
      const field = await createField(context, admin.token, { ownerId: farmer.user.id });
      expect(field.ownerId).toBe(farmer.user.id);
    });

    it("returns 404 when an admin targets a user that does not exist", async () => {
      const admin = await createUser(context, "ADMIN");
      const response = await request(context.app)
        .post("/api/fields")
        .set(...bearer(admin.token))
        .send({ name: "A", cropType: "Tomato", latitude: 31, longitude: 34, ownerId: "missing-user" });
      expect(response.status).toBe(404);
    });
  });

  describe("GET /api/fields", () => {
    it("shows a farmer only their own fields", async () => {
      const farmerA = await createUser(context);
      const farmerB = await createUser(context);
      const fieldA = await createField(context, farmerA.token, { name: "A" });
      await createField(context, farmerB.token, { name: "B" });

      const response = await request(context.app).get("/api/fields").set(...bearer(farmerA.token));
      expect(response.status).toBe(200);
      expect(response.body.items.map((f: { id: string }) => f.id)).toEqual([fieldA.id]);
    });

    it("forbids a farmer from listing another farmer's fields", async () => {
      const farmerA = await createUser(context);
      const farmerB = await createUser(context);
      const response = await request(context.app)
        .get(`/api/fields?ownerId=${farmerB.user.id}`)
        .set(...bearer(farmerA.token));
      expect(response.status).toBe(403);
    });

    it("shows an agronomist every field, and can filter by owner", async () => {
      const agronomist = await createUser(context, "AGRONOMIST");
      const farmerA = await createUser(context);
      const farmerB = await createUser(context);
      await createField(context, farmerA.token, { name: "A" });
      const fieldB = await createField(context, farmerB.token, { name: "B" });

      const all = await request(context.app).get("/api/fields").set(...bearer(agronomist.token));
      expect(all.body.items).toHaveLength(2);

      const filtered = await request(context.app)
        .get(`/api/fields?ownerId=${farmerB.user.id}`)
        .set(...bearer(agronomist.token));
      expect(filtered.body.items.map((f: { id: string }) => f.id)).toEqual([fieldB.id]);
    });
  });

  // ★ התאמה לשוק הישראלי: שטח בדונמים, שיטת גידול, השקיה ועונה
  describe("extended field details", () => {
    const details = {
      areaDunams: 12.5,
      cultivationMethod: "NET_HOUSE",
      irrigationMethod: "DRIP",
      variety: "  מטרו  ",
      plantingDate: "2026-09-01",
      expectedHarvestDate: "2027-01-15",
      notes: "חלקה ליד הבאר",
    };

    it("stores and returns all the optional details", async () => {
      const farmer = await createUser(context);
      const response = await request(context.app)
        .post("/api/fields")
        .set(...bearer(farmer.token))
        .send({ name: "בית רשת 2", cropType: "Tomato", latitude: 31.25, longitude: 34.79, ...details });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({ ...details, variety: "מטרו", logCount: 0, harvestBlockedUntil: null });
    });

    it("returns null details when they were not given", async () => {
      const farmer = await createUser(context);
      const field = await createField(context, farmer.token);
      const response = await request(context.app).get(`/api/fields/${field.id}`).set(...bearer(farmer.token));
      expect(response.body).toMatchObject({
        areaDunams: null,
        cultivationMethod: null,
        irrigationMethod: null,
        variety: null,
        plantingDate: null,
        expectedHarvestDate: null,
        notes: null,
      });
    });

    it.each([
      [{ areaDunams: 0 }, "areaDunams"],
      [{ areaDunams: -3 }, "areaDunams"],
      [{ cultivationMethod: "ROOFTOP" }, "cultivationMethod"],
      [{ irrigationMethod: "FLOOD" }, "irrigationMethod"],
      [{ plantingDate: "2026-02-30" }, "plantingDate"],
      [{ plantingDate: "01/09/2026" }, "plantingDate"],
      [{ plantingDate: "2026-09-01", expectedHarvestDate: "2026-08-01" }, "expectedHarvestDate"],
      [{ notes: "x".repeat(1001) }, "notes"],
    ])("rejects %j with 422", async (override, field) => {
      const farmer = await createUser(context);
      const response = await request(context.app)
        .post("/api/fields")
        .set(...bearer(farmer.token))
        .send({ name: "A", cropType: "Tomato", latitude: 31, longitude: 34, ...override });
      expect(response.status).toBe(422);
      expect(response.body.detail).toContain(field);
    });
  });

  describe("GET /api/fields/:id", () => {
    it("hides another farmer's field (404) but shows it to an agronomist", async () => {
      const owner = await createUser(context);
      const other = await createUser(context);
      const agronomist = await createUser(context, "AGRONOMIST");
      const field = await createField(context, owner.token);

      expect((await request(context.app).get(`/api/fields/${field.id}`).set(...bearer(other.token))).status).toBe(404);
      const seen = await request(context.app).get(`/api/fields/${field.id}`).set(...bearer(agronomist.token));
      expect(seen.status).toBe(200);
      expect(seen.body.id).toBe(field.id);
    });
  });

  describe("PATCH /api/fields/:id", () => {
    it("lets the owner change only the fields that were sent, and clear details with null", async () => {
      const farmer = await createUser(context);
      const field = await createField(context, farmer.token, { areaDunams: 5, variety: "מטרו", notes: "הערה" });

      const response = await request(context.app)
        .patch(`/api/fields/${field.id}`)
        .set(...bearer(farmer.token))
        .send({ name: "חממה 4", areaDunams: 7.5, cultivationMethod: "GREENHOUSE", notes: null, variety: "" });

      expect(response.status).toBe(200);
      expect(response.body).toMatchObject({
        name: "חממה 4",
        cropType: "Tomato",
        latitude: 31.25,
        areaDunams: 7.5,
        cultivationMethod: "GREENHOUSE",
        notes: null,
        variety: null,
      });
    });

    it("checks the season order against the values already saved", async () => {
      const farmer = await createUser(context);
      const field = await createField(context, farmer.token, { plantingDate: "2026-09-01" });
      const response = await request(context.app)
        .patch(`/api/fields/${field.id}`)
        .set(...bearer(farmer.token))
        .send({ expectedHarvestDate: "2026-08-15" });
      expect(response.status).toBe(422);
      expect(response.body.detail).toContain("expectedHarvestDate");
    });

    it("validates the edited values", async () => {
      const farmer = await createUser(context);
      const field = await createField(context, farmer.token);
      const response = await request(context.app)
        .patch(`/api/fields/${field.id}`)
        .set(...bearer(farmer.token))
        .send({ latitude: 120 });
      expect(response.status).toBe(422);
    });

    it("returns 404 to another farmer, 403 to an agronomist, and lets an admin edit", async () => {
      const owner = await createUser(context);
      const other = await createUser(context);
      const agronomist = await createUser(context, "AGRONOMIST");
      const admin = await createUser(context, "ADMIN");
      const field = await createField(context, owner.token);
      const patch = (token: string) =>
        request(context.app).patch(`/api/fields/${field.id}`).set(...bearer(token)).send({ name: "שונה" });

      expect((await patch(other.token)).status).toBe(404);
      expect((await patch(agronomist.token)).status).toBe(403);
      expect((await patch(admin.token)).status).toBe(200);
    });
  });

  describe("DELETE /api/fields/:id", () => {
    it("deletes the field with its diagnoses, their images and its journal", async () => {
      const farmer = await createUser(context);
      const field = await createField(context, farmer.token);
      context.ai.next = prediction("Tomato___Late_blight");
      await request(context.app)
        .post("/api/diagnose")
        .set(...bearer(farmer.token))
        .field("fieldId", field.id)
        .attach("image", PNG_BYTES, { filename: "leaf.png", contentType: "image/png" })
        .expect(201);
      await request(context.app)
        .post(`/api/fields/${field.id}/logs`)
        .set(...bearer(farmer.token))
        .send({ type: "IRRIGATE", appliedOn: todayInIsrael(), dosePerDunam: 30, doseUnit: "m3" })
        .expect(201);
      expect(context.images.images.size).toBe(1);

      const response = await request(context.app).delete(`/api/fields/${field.id}`).set(...bearer(farmer.token));

      expect(response.status).toBe(204);
      expect(await context.prisma.field.count()).toBe(0);
      expect(await context.prisma.diagnosis.count()).toBe(0);
      expect(await context.prisma.fieldLog.count()).toBe(0);
      expect(context.images.images.size).toBe(0);
    });

    it("returns 404 to another farmer and 403 to an agronomist, and keeps the field", async () => {
      const owner = await createUser(context);
      const other = await createUser(context);
      const agronomist = await createUser(context, "AGRONOMIST");
      const field = await createField(context, owner.token);

      expect((await request(context.app).delete(`/api/fields/${field.id}`).set(...bearer(other.token))).status).toBe(404);
      expect((await request(context.app).delete(`/api/fields/${field.id}`).set(...bearer(agronomist.token))).status).toBe(403);
      expect(await context.prisma.field.count()).toBe(1);
    });

    it("lets an admin delete any field", async () => {
      const owner = await createUser(context);
      const admin = await createUser(context, "ADMIN");
      const field = await createField(context, owner.token);
      expect((await request(context.app).delete(`/api/fields/${field.id}`).set(...bearer(admin.token))).status).toBe(204);
    });
  });
});
