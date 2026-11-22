/**
 * בדיקות חלקות: יצירה, אימות קלט והרשאות לפי תפקיד.
 */

import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { bearer, createField, createTestContext, createUser, hasTestDb, resetDatabase, type TestContext } from "./helpers.js";

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
});
