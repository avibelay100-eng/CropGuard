/**
 * בדיקת מקצה-לקצה חיה: מסע חקלאי מלא מול שלוש המערכות כשהן רצות.
 *
 *   הרשמה -> יצירת חלקה -> העלאת עלה נגוע -> אבחון AI בעברית עם מחירים בשקלים -> שמירה בהיסטוריה
 *
 * הרצה (אחרי npm run dev:ai, dev:server, dev:client):
 *     npm run e2e
 *     npm run e2e -- C:\path\to\real-leaf.jpg     # עם צילום אמיתי
 *
 * משתני סביבה (לא חובה): API_URL, AI_URL, CLIENT_URL.
 * כל הרצה יוצרת משתמש חדש (אימייל ייחודי, סיסמה אקראית שלא מודפסת).
 */

import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const API_URL = (process.env.API_URL ?? "http://localhost:3000/api").replace(/\/+$/, "");
const AI_URL = (process.env.AI_URL ?? "http://localhost:8001").replace(/\/+$/, "");
const CLIENT_URL = (process.env.CLIENT_URL ?? "http://localhost:5173").replace(/\/+$/, "");
const IMAGE_PATH =
  process.argv[2] ?? path.join(path.dirname(fileURLToPath(import.meta.url)), "fixtures", "synthetic-leaf.png");

const HEBREW = /[\u0590-\u05FF]/;
let failures = 0;
let stepNumber = 0;

function check(condition, message) {
  if (condition) {
    console.log(`   ✓ ${message}`);
  } else {
    console.log(`   ✗ ${message}`);
    failures++;
  }
}

async function step(title, run) {
  stepNumber++;
  const started = performance.now();
  console.log(`\n${stepNumber}. ${title}`);
  try {
    const result = await run();
    console.log(`   (${Math.round(performance.now() - started)} ms)`);
    return result;
  } catch (err) {
    console.log(`   ✗ ${err.message}`);
    console.log("\nE2E FAILED - the journey could not continue.");
    process.exit(1);
  }
}

async function call(method, url, { token, json, form } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (json) headers["Content-Type"] = "application/json";
  const response = await fetch(url, { method, headers, body: json ? JSON.stringify(json) : form });
  const body = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(`${method} ${url} -> HTTP ${response.status}: ${body?.detail ?? "no detail"}`);
  }
  return body;
}

console.log("CropGuard - E2E farmer journey");
console.log(`API ${API_URL} | AI ${AI_URL} | client ${CLIENT_URL}`);
console.log(`Image: ${IMAGE_PATH}`);

await step("Three systems are up", async () => {
  const ai = await call("GET", `${AI_URL}/health`);
  check(ai.status === "ok" && ai.model_loaded, `AI engine: model loaded, ${ai.class_count} classes`);
  const server = await call("GET", `${API_URL}/health`);
  check(server.status === "ok", "Core server: ok");
  const client = await fetch(CLIENT_URL).then((r) => r.status).catch(() => 0);
  check(client === 200, `React client: HTTP ${client}`);
});

const email = `e2e-${Date.now()}@cropguard.test`;
const auth = await step("Register a new farmer", async () => {
  const result = await call("POST", `${API_URL}/auth/register`, {
    json: { email, password: randomBytes(12).toString("base64url"), name: "חקלאי בדיקה" },
  });
  check(typeof result.token === "string" && result.token.split(".").length === 3, "Received a JWT");
  check(result.user.role === "FARMER", `Role: ${result.user.role}`);
  check(!JSON.stringify(result).includes("passwordHash"), "No password hash in the response");
  return result;
});

const field = await step("Create a field", async () => {
  const result = await call("POST", `${API_URL}/fields`, {
    token: auth.token,
    json: { name: "חממה 3 - בדיקת E2E", cropType: "Tomato", latitude: 31.2518, longitude: 34.7913 },
  });
  check(result.ownerId === auth.user.id, `Field "${result.name}" belongs to the new farmer`);
  return result;
});

const diagnosis = await step("Upload a leaf and get a live AI diagnosis", async () => {
  const bytes = await readFile(IMAGE_PATH);
  const extension = path.extname(IMAGE_PATH).toLowerCase();
  const type = extension === ".png" ? "image/png" : extension === ".webp" ? "image/webp" : "image/jpeg";
  const form = new FormData();
  form.append("fieldId", field.id);
  form.append("image", new Blob([bytes], { type }), path.basename(IMAGE_PATH));

  const result = await call("POST", `${API_URL}/diagnose`, { token: auth.token, form });
  console.log(`   -> ${result.disease.displayNameHe} | ${result.disease.nameEn} | ${result.disease.scientificName ?? "-"}`);
  console.log(`   -> ${result.statusHe}, ${result.confidencePercent}% confidence`);
  check(HEBREW.test(result.disease.displayNameHe), "Disease name is in Hebrew");
  check(result.disease.nameEn.length > 0, "English name is present");
  check(HEBREW.test(result.guidanceHe), "Treatment guidance is in Hebrew");
  check(HEBREW.test(result.disclaimerHe), "Disclaimer is in Hebrew");
  check(result.confidence >= 0 && result.confidence <= 1, "Confidence is a probability");
  if (!result.isHealthy && result.chemicalControl) {
    const products = result.treatments.flatMap((t) => t.products.map((p) => ({ ...p, ingredient: t.activeIngredientHe })));
    for (const p of products) console.log(`   -> ${p.ingredient}: ${p.productName} ${p.packageSize} ₪${p.minPriceILS}-${p.maxPriceILS}`);
    check(products.length > 0, `${products.length} products with ILS price ranges`);
    check(products.every((p) => p.minPriceILS > 0 && p.maxPriceILS >= p.minPriceILS), "Price ranges are valid");
    check(result.treatments.every((t) => HEBREW.test(t.activeIngredientHe)), "Active ingredients have Hebrew names");
  } else {
    console.log("   (healthy leaf or no chemical control - no products expected)");
  }
  return result;
});

await step("The diagnosis is saved in the field's history", async () => {
  const history = await call("GET", `${API_URL}/diagnoses?fieldId=${field.id}`, { token: auth.token });
  check(history.total === 1, `History for the field has ${history.total} diagnosis`);
  check(history.items[0]?.id === diagnosis.diagnosis.id, "It is the diagnosis we just made");
  check(history.items[0]?.disease.displayNameHe === diagnosis.disease.displayNameHe, "Hebrew name kept in history");

  const fields = await call("GET", `${API_URL}/fields`, { token: auth.token });
  const saved = fields.items.find((f) => f.id === field.id);
  check(saved?.diagnosisCount === 1, "Field shows 1 diagnosis");
});

await step("Security: another farmer cannot see this field", async () => {
  const other = await call("POST", `${API_URL}/auth/register`, {
    json: { email: `e2e-other-${Date.now()}@cropguard.test`, password: randomBytes(12).toString("base64url"), name: "חקלאי אחר" },
  });
  const response = await fetch(`${API_URL}/diagnoses?fieldId=${field.id}`, {
    headers: { Authorization: `Bearer ${other.token}` },
  });
  check(response.status === 404, `Other farmer gets HTTP ${response.status} (expected 404)`);
  const anonymous = await fetch(`${API_URL}/diagnoses`);
  check(anonymous.status === 401, `No token gets HTTP ${anonymous.status} (expected 401)`);
});

console.log(failures === 0 ? "\nE2E PASSED - full farmer journey works." : `\nE2E FAILED - ${failures} check(s) failed.`);
console.log(`Test user: ${email} (random password, not stored - not meant for logging in).`);
process.exit(failures === 0 ? 0 : 1);
