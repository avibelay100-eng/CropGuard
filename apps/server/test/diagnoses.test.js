/**
 * בדיקות GET /api/diagnoses - היסטוריית אבחונים לפי חקלאי וחלקה.
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
} from "./helpers.js";

describe.skipIf(!hasTestDb)("GET /api/diagnoses", () => {
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

  async function diagnose(token, fieldId, label) {
    context.ai.next = prediction(label);
    const response = await request(context.app)
      .post("/api/diagnose")
      .set(...bearer(token))
      .field("fieldId", fieldId)
      .attach("image", PNG_BYTES, { filename: "leaf.png", contentType: "image/png" })
      .expect(201);
    return response.body.diagnosis.id;
  }

  const list = (token, query = "") => request(context.app).get(`/api/diagnoses${query}`).set(...bearer(token));

  /** שני חקלאים: לראשון שתי חלקות ושלושה אבחונים, לשני חלקה ואבחון אחד */
  async function scenario() {
    const farmerA = await createUser(context, "FARMER", "חקלאי א");
    const farmerB = await createUser(context, "FARMER", "חקלאי ב");
    const fieldA1 = await createField(context, farmerA.token, { name: "A1", cropType: "Tomato" });
    const fieldA2 = await createField(context, farmerA.token, { name: "A2", cropType: "Potato" });
    const fieldB1 = await createField(context, farmerB.token, { name: "B1", cropType: "Corn" });
    const a1 = await diagnose(farmerA.token, fieldA1.id, "Tomato___Late_blight");
    const a2 = await diagnose(farmerA.token, fieldA1.id, "Tomato___Healthy");
    const a3 = await diagnose(farmerA.token, fieldA2.id, "Potato___Early_blight");
    const b1 = await diagnose(farmerB.token, fieldB1.id, "Corn___Common_rust");
    return { farmerA, farmerB, fieldA1, fieldA2, fieldB1, ids: { a1, a2, a3, b1 } };
  }

  it("requires authentication", async () => {
    expect((await request(context.app).get("/api/diagnoses")).status).toBe(401);
  });

  it("shows a farmer only their own diagnoses, newest first, with Hebrew names", async () => {
    const { farmerA, ids } = await scenario();
    const response = await list(farmerA.token);

    expect(response.status).toBe(200);
    expect(response.body.total).toBe(3);
    expect(response.body.items.map((d) => d.id)).toEqual([ids.a3, ids.a2, ids.a1]);

    const potato = response.body.items[0];
    expect(potato.disease).toMatchObject({
      displayNameHe: "תפוח אדמה – כתמת עלים מוקדמת (אלטרנריה)",
      nameEn: "Potato Early blight",
      scientificName: "Alternaria solani",
    });
    expect(potato.field).toMatchObject({ name: "A2", cropType: "Potato" });
    expect(potato.cropMismatch).toBe(false);
    expect(potato.farmer.name).toBe("חקלאי א");
    expect(potato.activeIngredient).toBe("chlorothalonil");
  });

  it("filters by field", async () => {
    const { farmerA, fieldA1, ids } = await scenario();
    const response = await list(farmerA.token, `?fieldId=${fieldA1.id}`);
    expect(response.body.items.map((d) => d.id)).toEqual([ids.a2, ids.a1]);
    expect(response.body.total).toBe(2);
  });

  it("filters by healthy / infected status", async () => {
    const { farmerA, ids } = await scenario();
    const healthy = await list(farmerA.token, "?status=healthy");
    const infected = await list(farmerA.token, "?status=infected");

    expect(healthy.body.items.map((d) => d.id)).toEqual([ids.a2]);
    expect(infected.body.items.map((d) => d.id)).toEqual([ids.a3, ids.a1]);
    expect(infected.body.total).toBe(2);
    expect((await list(farmerA.token, "?status=sick")).status).toBe(422);
  });

  it("returns 404 when a farmer filters by another farmer's field", async () => {
    const { farmerA, fieldB1 } = await scenario();
    expect((await list(farmerA.token, `?fieldId=${fieldB1.id}`)).status).toBe(404);
  });

  it("forbids a farmer from asking for another farmer's diagnoses", async () => {
    const { farmerA, farmerB } = await scenario();
    expect((await list(farmerA.token, `?farmerId=${farmerB.user.id}`)).status).toBe(403);
  });

  it("lets an agronomist see everyone, or filter by farmer", async () => {
    const { farmerB, ids } = await scenario();
    const agronomist = await createUser(context, "AGRONOMIST");

    const all = await list(agronomist.token);
    expect(all.body.total).toBe(4);

    const onlyB = await list(agronomist.token, `?farmerId=${farmerB.user.id}`);
    expect(onlyB.body.items.map((d) => d.id)).toEqual([ids.b1]);
    expect(onlyB.body.items[0].disease.displayNameHe).toBe("תירס – חלדון מצוי");
  });

  it("lets an admin see everyone", async () => {
    await scenario();
    const admin = await createUser(context, "ADMIN");
    expect((await list(admin.token)).body.total).toBe(4);
  });

  it("paginates with limit and offset", async () => {
    const { farmerA, ids } = await scenario();
    const page1 = await list(farmerA.token, "?limit=2&offset=0");
    const page2 = await list(farmerA.token, "?limit=2&offset=2");

    expect(page1.body).toMatchObject({ total: 3, limit: 2, offset: 0 });
    expect(page1.body.items.map((d) => d.id)).toEqual([ids.a3, ids.a2]);
    expect(page2.body.items.map((d) => d.id)).toEqual([ids.a1]);
  });

  it.each(["?limit=0", "?limit=101", "?limit=abc", "?offset=-1"])("rejects invalid paging %s with 422", async (query) => {
    const farmer = await createUser(context);
    const response = await list(farmer.token, query);
    expect(response.status).toBe(422);
  });

  describe("DELETE /api/diagnoses/:id", () => {
    const remove = (token, id) =>
      request(context.app).delete(`/api/diagnoses/${id}`).set(...bearer(token));

    it("lets the owner delete a diagnosis, its image, and updates the field count", async () => {
      const { farmerA, fieldA1, ids } = await scenario();
      const saved = await context.prisma.diagnosis.findUniqueOrThrow({ where: { id: ids.a1 } });
      expect(context.images.images.has(saved.imageUrl)).toBe(true);

      const response = await remove(farmerA.token, ids.a1);

      expect(response.status).toBe(204);
      expect(await context.prisma.diagnosis.findUnique({ where: { id: ids.a1 } })).toBeNull();
      expect(context.images.images.has(saved.imageUrl)).toBe(false);
      const fields = await request(context.app).get("/api/fields").set(...bearer(farmerA.token));
      const field = fields.body.items.find((f) => f.id === fieldA1.id);
      expect(field.diagnosisCount).toBe(1);
    });

    it("returns 404 to a farmer deleting someone else's diagnosis, and keeps it", async () => {
      const { farmerB, ids } = await scenario();
      expect((await remove(farmerB.token, ids.a1)).status).toBe(404);
      expect(await context.prisma.diagnosis.findUnique({ where: { id: ids.a1 } })).not.toBeNull();
    });

    it("forbids an agronomist from deleting a farmer's diagnosis", async () => {
      const { ids } = await scenario();
      const agronomist = await createUser(context, "AGRONOMIST");
      const response = await remove(agronomist.token, ids.a1);
      expect(response.status).toBe(403);
      expect(await context.prisma.diagnosis.findUnique({ where: { id: ids.a1 } })).not.toBeNull();
    });

    it("lets an admin delete any diagnosis", async () => {
      const { ids } = await scenario();
      const admin = await createUser(context, "ADMIN");
      expect((await remove(admin.token, ids.b1)).status).toBe(204);
      expect(await context.prisma.diagnosis.findUnique({ where: { id: ids.b1 } })).toBeNull();
    });

    it("returns 404 for a diagnosis that does not exist, and requires a token", async () => {
      const farmer = await createUser(context);
      expect((await remove(farmer.token, "no-such-diagnosis")).status).toBe(404);
      expect((await request(context.app).delete("/api/diagnoses/whatever")).status).toBe(401);
    });
  });

  it("returns an empty list for a farmer with no diagnoses", async () => {
    const farmer = await createUser(context);
    const response = await list(farmer.token);
    expect(response.body).toEqual({ items: [], total: 0, limit: 20, offset: 0 });
  });
});
