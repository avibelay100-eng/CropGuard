/**
 * בדיקות ל"שרת" של גרסת ההדגמה (GitHub Pages): שהוא עונה באותה צורה כמו השרת האמיתי,
 * ושחישובי ה-PHI, המחיקות בשרשור והאבחון לפי הגידול עובדים.
 */

import { afterEach, describe, expect, it } from "vitest";

import { api, API_URL, tokenStore } from "../api/client";
import { addDays, createSeedState, handle, installDemoBackend, todayInIsrael } from "./backend";

const req = (method, path, body = null, query = "") => ({ method, path, query: new URLSearchParams(query), body });
const leaf = (name = "leaf.png", size = 1234) => new File([new Uint8Array(size)], name, { type: "image/png" });

describe("demo backend", () => {
  const today = todayInIsrael();

  it("seeds fields with Israeli details and an active PHI block on the sprayed field", async () => {
    const state = createSeedState();
    const { body } = await handle(state, req("GET", "/fields"));
    const tomato = body.items.find((f) => f.cropType === "Tomato");
    expect(tomato).toMatchObject({ areaDunams: 4, cultivationMethod: "NET_HOUSE", logCount: 3, harvestBlockedUntil: addDays(today, 5) });
    expect(body.items.find((f) => f.cropType === "Potato").harvestBlockedUntil).toBeNull();
  });

  it("computes the safe harvest date like the server, and validates sprays", async () => {
    const state = createSeedState();
    const spray = { type: "SPRAY", appliedOn: addDays(today, -1), productName: "Score 250 EC", phiDays: 14, dosePerDunam: 50, doseUnit: "ml" };
    const created = await handle(state, req("POST", "/fields/f-potato/logs", spray));
    expect(created).toMatchObject({ status: 201, body: { safeHarvestDate: addDays(today, 13), phiDays: 14 } });

    await expect(handle(state, req("POST", "/fields/f-potato/logs", { ...spray, phiDays: null }))).rejects.toMatchObject({ status: 422 });
    await expect(handle(state, req("POST", "/fields/f-potato/logs", { ...spray, appliedOn: addDays(today, 1) }))).rejects.toThrow(/future/);

    const journal = await handle(state, req("GET", "/fields/f-potato/logs"));
    expect(journal.body).toMatchObject({ today, field: { harvestBlockedUntil: addDays(today, 13) } });
  });

  it("deleting a field also deletes its diagnoses and journal", async () => {
    const state = createSeedState();
    expect((await handle(state, req("DELETE", "/fields/f-tomato"))).status).toBe(204);
    expect(state.diagnoses.some((d) => d.fieldId === "f-tomato")).toBe(false);
    expect(state.logs.some((l) => l.fieldId === "f-tomato")).toBe(false);
    await expect(handle(state, req("GET", "/fields/f-tomato"))).rejects.toMatchObject({ status: 404 });
  });

  it("diagnoses a condition of the field's crop, the same one for the same image", async () => {
    const state = createSeedState();
    const form = () => {
      const data = new FormData();
      data.append("fieldId", "f-grape");
      data.append("image", leaf("vine.jpg", 4321));
      return data;
    };
    const first = await handle(state, req("POST", "/diagnose", form()));
    const second = await handle(state, req("POST", "/diagnose", form()));
    expect(first.status).toBe(201);
    expect(first.body.disease.modelLabel).toMatch(/^Grape___/);
    expect(first.body.disease.modelLabel).toBe(second.body.disease.modelLabel);
    expect(first.body.cropCheck).toMatchObject({ fieldCrop: "Grape", matches: true });
    expect(first.body.warningsHe[0]).toMatch(/גרסת הדגמה/);
  });

  it("keeps a journal entry when its diagnosis is deleted (link removed)", async () => {
    const state = createSeedState();
    await handle(state, req("DELETE", "/diagnoses/d-late-blight"));
    const journal = await handle(state, req("GET", "/fields/f-tomato/logs"));
    expect(journal.body.items.find((l) => l.id === "l-spray")).toMatchObject({ diagnosisId: null, disease: { nameHe: "כימשון" } });
  });

  it("filters the history by status and shows the crop-mismatch example", async () => {
    const state = createSeedState();
    const infected = await handle(state, req("GET", "/diagnoses", null, "status=infected"));
    expect(infected.body.items.every((item) => !item.isHealthy)).toBe(true);
    expect(infected.body.items.some((item) => item.cropMismatch)).toBe(true);
  });
});

describe("installDemoBackend", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  it("answers the app's API calls in the browser, and saves changes", async () => {
    installDemoBackend(API_URL, { delayMs: 0 });
    tokenStore.set("demo-token");

    const { items } = await api.listFields();
    expect(items).toHaveLength(3);
    await api.createField({ name: "פרדס", cropType: "Orange", latitude: 32.1, longitude: 34.9 });
    expect((await api.listFields()).items[0].name).toBe("פרדס");

    // מצב שמור: התקנה חדשה (כמו רענון הדף) רואה את החלקה החדשה
    installDemoBackend(API_URL, { delayMs: 0 });
    expect((await api.listFields()).items).toHaveLength(4);

    // שגיאה חוזרת באותו פורמט כמו בשרת, ולכן מוצגת בעברית
    await expect(api.listFieldLogs("missing")).rejects.toMatchObject({ status: 404, messageHe: "הפריט לא נמצא." });
  });
});
