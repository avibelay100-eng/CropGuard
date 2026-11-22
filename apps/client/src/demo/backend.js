/**
 * גרסת ההדגמה של CropGuard (GitHub Pages) - "שרת" שרץ כולו בדפדפן.
 *
 * GitHub Pages מגיש רק קבצים קבועים, בלי שרת, מסד נתונים או שירות AI. לכן בבנייה עם VITE_DEMO=true
 * מחליפים את fetch: כל בקשה לכתובת ה-API נענית כאן, באותה צורה בדיוק כמו בשרת האמיתי,
 * וכל שאר קוד האפליקציה (המסכים, שכבת ה-API, ההתחברות) נשאר בלי שום שינוי.
 *
 * - הנתונים נשמרים ב-localStorage של הדפדפן בלבד (כל מבקר רואה עותק משלו), ואפשר לאפס אותם.
 * - ספריית המחלות והחדשות הן עותק קבוע, שיוצא מהמערכת האמיתית (apps/server/scripts/export-demo-data.js).
 * - אין AI אמיתי: "אבחון" בוחר מצב מתוך הספרייה לפי הגידול של החלקה, בצורה דטרמיניסטית לפי התמונה.
 * - חישובי ה-PHI זהים לשרת: תאריך הריסוס + ימי ההמתנה, לפי לוח השנה בישראל.
 */

import libraryData from "./data/library.json";
import newsData from "./data/news.json";

const STORAGE_KEY = "cropguard.demo.v1";
export const DEMO_TOKEN = "demo-token";

// אותם טקסטים כמו בשרת (apps/server/src/routes/diagnose.js)
const DISCLAIMER_HE =
  "האבחון מבוסס על מודל בינה מלאכותית ואינו מחליף בדיקה של מדריך הגנת הצומח. " +
  "לפני שימוש בתכשיר יש לוודא שהוא רשום בישראל לגידול ולמחלה ולפעול לפי התווית.";
const UNVERIFIED_PRICES_WARNING_HE = "המחירים המוצגים הם הערכה בלבד ועדיין לא אומתו מול מחירון ספק.";
const DEMO_SCAN_NOTE_HE = "גרסת הדגמה: אין כאן מודל AI אמיתי - התוצאה נבחרה מתוך ספריית המחלות לפי הגידול של החלקה.";

/** הספרייה לפי תווית, ושמות החומרים הפעילים בעברית (מתוך ההמלצות שבספרייה) */
const LIBRARY = new Map(libraryData.entries.map((entry) => [entry.disease.modelLabel, entry]));
const INGREDIENT_HE = new Map(
  libraryData.entries.flatMap((entry) => entry.treatments.map((t) => [t.activeIngredient, t.activeIngredientHe])),
);

// ---------------------------------------------------------------------------
// תאריכים - כמו apps/server/src/services/phi.js
// ---------------------------------------------------------------------------

/** "היום" לפי לוח השנה בישראל, "YYYY-MM-DD" */
export function todayInIsrael(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** הוספת ימים לתאריך "YYYY-MM-DD" (ב-UTC, בלי קפיצות של שעון קיץ) */
export function addDays(value, days) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

/** תאריך-ושעה ISO לפני מספר ימים (לנתוני הדוגמה) */
function daysAgoIso(days, hour = 9) {
  return `${addDays(todayInIsrael(), -days)}T${String(hour).padStart(2, "0")}:15:00.000Z`;
}

// ---------------------------------------------------------------------------
// נתוני הדוגמה ההתחלתיים
// ---------------------------------------------------------------------------

/** המצב ההתחלתי של ההדגמה: חקלאי אחד, שלוש חלקות, כמה אבחונים ויומן עם ריסוס פעיל (PHI) */
export function createSeedState() {
  const today = todayInIsrael();
  const user = {
    id: "demo-farmer",
    email: "demo@cropguard.example",
    name: "חקלאי לדוגמה",
    role: "FARMER",
    phone: null,
    createdAt: daysAgoIso(120),
  };
  const field = (id, name, cropType, latitude, longitude, details, createdDaysAgo) => ({
    id,
    name,
    cropType,
    latitude,
    longitude,
    areaDunams: null,
    cultivationMethod: null,
    irrigationMethod: null,
    variety: null,
    plantingDate: null,
    expectedHarvestDate: null,
    notes: null,
    ...details,
    ownerId: user.id,
    createdAt: daysAgoIso(createdDaysAgo),
    updatedAt: daysAgoIso(createdDaysAgo),
  });
  const fields = [
    field("f-tomato", "בית רשת 2", "Tomato", 31.2518, 34.7913, {
      areaDunams: 4,
      cultivationMethod: "NET_HOUSE",
      irrigationMethod: "DRIP",
      variety: "מטרו",
      plantingDate: addDays(today, -80),
      expectedHarvestDate: addDays(today, 30),
      notes: "חלקה ליד הבאר",
    }, 90),
    field("f-potato", "שדה פתוח צפוני", "Potato", 32.6, 35.29, {
      areaDunams: 25,
      cultivationMethod: "OPEN_FIELD",
      irrigationMethod: "SPRINKLER",
      plantingDate: addDays(today, -60),
    }, 70),
    field("f-grape", "כרם הגליל", "Grape", 33.01, 35.5, { areaDunams: 12, cultivationMethod: "OPEN_FIELD", irrigationMethod: "DRIP", variety: "קברנה סוביניון" }, 60),
  ];
  const diagnosis = (id, fieldId, modelLabel, confidence, daysAgo, cropMismatch = false) => {
    const entry = LIBRARY.get(modelLabel);
    return {
      id,
      fieldId,
      modelLabel,
      imageUrl: `demo/${id}.jpg`,
      isHealthy: entry?.pathogenType === "healthy",
      confidence,
      activeIngredient: cropMismatch ? null : (entry?.treatments[0]?.activeIngredient ?? null),
      cropMismatch,
      createdAt: daysAgoIso(daysAgo, 8),
    };
  };
  const diagnoses = [
    diagnosis("d-late-blight", "f-tomato", "Tomato___Late_blight", 0.91, 2),
    diagnosis("d-early-blight", "f-potato", "Potato___Early_blight", 0.88, 6),
    diagnosis("d-grape-healthy", "f-grape", "Grape___Healthy", 0.95, 9),
    // ★ Crop Mismatch Guard: בשדה תפוחי האדמה צולם עלה שהמודל זיהה כעגבנייה
    diagnosis("d-mismatch", "f-potato", "Tomato___Early_blight", 0.62, 12, true),
  ];
  const logs = [
    {
      id: "l-spray",
      fieldId: "f-tomato",
      type: "SPRAY",
      appliedOn: addDays(today, -2),
      productName: "Ridomil Gold MZ",
      activeIngredient: "metalaxyl-m + mancozeb",
      dosePerDunam: 250,
      doseUnit: "g",
      phiDays: 7,
      safeHarvestDate: addDays(today, 5),
      diagnosisId: "d-late-blight",
      modelLabel: "Tomato___Late_blight",
      notes: "טיפול נגד עגבנייה – כימשון",
      createdAt: daysAgoIso(2, 10),
    },
    {
      id: "l-fertilize",
      fieldId: "f-tomato",
      type: "FERTILIZE",
      appliedOn: addDays(today, -5),
      productName: "אשלגן חנקתי",
      activeIngredient: null,
      dosePerDunam: 2,
      doseUnit: "kg",
      phiDays: null,
      safeHarvestDate: null,
      diagnosisId: null,
      modelLabel: null,
      notes: null,
      createdAt: daysAgoIso(5, 10),
    },
    {
      id: "l-irrigate",
      fieldId: "f-tomato",
      type: "IRRIGATE",
      appliedOn: addDays(today, -1),
      productName: null,
      activeIngredient: null,
      dosePerDunam: 3,
      doseUnit: "m3",
      phiDays: null,
      safeHarvestDate: null,
      diagnosisId: null,
      modelLabel: null,
      notes: null,
      createdAt: daysAgoIso(1, 10),
    },
  ];
  return { user, fields, diagnoses, logs, counter: 1 };
}

// ---------------------------------------------------------------------------
// שמירת המצב בדפדפן
// ---------------------------------------------------------------------------

/** טוען את המצב השמור, או יוצר חדש; אחסון חסום (גלישה פרטית) - עובד בזיכרון בלבד */
export function loadState(storage = globalThis.localStorage) {
  try {
    const saved = storage?.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {
    // אחסון חסום או נתונים פגומים - מתחילים מחדש
  }
  return createSeedState();
}

function saveState(state, storage) {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // אחסון חסום - ההדגמה ממשיכה בזיכרון
  }
}

/** איפוס ההדגמה לנתוני הדוגמה ההתחלתיים */
export function resetDemo(storage = globalThis.localStorage) {
  try {
    storage?.removeItem(STORAGE_KEY);
  } catch {
    // אין מה למחוק
  }
}

// ---------------------------------------------------------------------------
// המרה לתשובות - אותה צורה כמו ב-apps/server/src/dto.js
// ---------------------------------------------------------------------------

function describe(modelLabel) {
  const entry = LIBRARY.get(modelLabel);
  if (entry) return entry.disease;
  const nameEn = modelLabel.replace("___", " ").replaceAll("_", " ");
  return { modelLabel, plantHe: nameEn, nameHe: nameEn, displayNameHe: nameEn, nameEn, scientificName: null };
}

function plantHe(cropType) {
  return libraryData.entries.find((entry) => entry.plant === cropType)?.disease.plantHe ?? cropType;
}

function toFieldDto(state, field, today) {
  const blocking = state.logs
    .filter((log) => log.fieldId === field.id && log.safeHarvestDate && log.safeHarvestDate > today)
    .map((log) => log.safeHarvestDate)
    .sort()
    .at(-1);
  return {
    ...field,
    ownerName: state.user.name,
    diagnosisCount: state.diagnoses.filter((d) => d.fieldId === field.id).length,
    logCount: state.logs.filter((l) => l.fieldId === field.id).length,
    harvestBlockedUntil: blocking ?? null,
  };
}

function toLogDto(log) {
  return {
    id: log.id,
    fieldId: log.fieldId,
    type: log.type,
    appliedOn: log.appliedOn,
    productName: log.productName,
    activeIngredient: log.activeIngredient,
    activeIngredientHe: log.activeIngredient ? (INGREDIENT_HE.get(log.activeIngredient) ?? null) : null,
    dosePerDunam: log.dosePerDunam,
    doseUnit: log.doseUnit,
    phiDays: log.phiDays,
    safeHarvestDate: log.safeHarvestDate,
    diagnosisId: log.diagnosisId,
    disease: log.modelLabel && LIBRARY.has(log.modelLabel) ? describe(log.modelLabel) : null,
    notes: log.notes,
    createdAt: log.createdAt,
  };
}

function toHistoryItem(state, d) {
  const field = state.fields.find((f) => f.id === d.fieldId);
  return {
    id: d.id,
    createdAt: d.createdAt,
    imageUrl: d.imageUrl,
    field: { id: field.id, name: field.name, cropType: field.cropType },
    farmer: { id: state.user.id, name: state.user.name },
    disease: describe(d.modelLabel),
    isHealthy: d.isHealthy,
    confidence: d.confidence,
    activeIngredient: d.activeIngredient,
    cropMismatch: d.cropMismatch,
  };
}

// ---------------------------------------------------------------------------
// עזרים לתשובות HTTP
// ---------------------------------------------------------------------------

class DemoHttpError extends Error {
  constructor(status, code, detail) {
    super(detail);
    this.status = status;
    this.code = code;
  }
}

const notFound = (detail) => new DemoHttpError(404, "not_found", detail);
const invalid = (detail) => new DemoHttpError(422, "validation_error", detail);

/** מספר שלם קבוע מתוך מחרוזת - כדי שאותה תמונה תקבל תמיד אותה תוצאה */
function hash(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

const isDateOnly = (value) => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
const text = (value) => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);

// ---------------------------------------------------------------------------
// הנתיבים - אותם נתיבים ואותן תשובות כמו בשרת האמיתי
// ---------------------------------------------------------------------------

/**
 * מטפל בבקשה אחת. מחזיר { status, body }.
 * @param {object} state - המצב (משתנה במקום)
 * @param {{ method: string, path: string, query: URLSearchParams, body: unknown }} req
 */
export async function handle(state, req) {
  const { method, path, query, body } = req;
  const today = todayInIsrael();
  const nextId = (prefix) => `${prefix}-${Date.now().toString(36)}-${state.counter++}`;
  const fieldById = (id) => {
    const field = state.fields.find((f) => f.id === id);
    if (!field) throw notFound("Field not found.");
    return field;
  };
  let m;

  // --- התחברות (בהדגמה: כל אימייל וסיסמה מכניסים לאותו חקלאי לדוגמה) ---
  if (method === "POST" && (path === "/auth/login" || path === "/auth/register")) {
    if (!text(body?.email) || !text(body?.password)) throw invalid("email and password are required");
    if (path === "/auth/register" && text(body.name)) state.user = { ...state.user, name: text(body.name) };
    return { status: path === "/auth/register" ? 201 : 200, body: { token: DEMO_TOKEN, expiresAt: addDays(today, 30) + "T00:00:00.000Z", user: state.user } };
  }
  if (method === "GET" && path === "/auth/me") return { status: 200, body: state.user };
  if (method === "PATCH" && path === "/auth/me") {
    const digits = String(body?.phone ?? "").replace(/[\s\-().]/g, "");
    const national = digits.startsWith("+972") ? digits.slice(4) : digits.startsWith("0") ? digits.slice(1) : "";
    if (body?.phone != null && !/^5\d{8}$/.test(national)) throw invalid("phone: not an Israeli mobile number");
    state.user = { ...state.user, phone: body?.phone == null ? null : `+972${national}` };
    return { status: 200, body: state.user };
  }
  if (method === "POST" && path === "/auth/password-reset/request") return { status: 200, body: { ok: true } };
  if (method === "POST" && path === "/auth/password-reset/confirm") {
    if (!/^\d{6}$/.test(String(body?.code ?? ""))) return { status: 400, body: { error: "invalid_code", detail: "Invalid code." } };
    return { status: 200, body: { ok: true } };
  }

  // --- חלקות ---
  if (method === "GET" && path === "/fields") {
    const items = [...state.fields].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).map((f) => toFieldDto(state, f, today));
    return { status: 200, body: { items } };
  }
  if (method === "POST" && path === "/fields") {
    if (!text(body?.name) || !text(body?.cropType)) throw invalid("name and cropType are required");
    const now = new Date().toISOString();
    const field = {
      id: nextId("f"),
      name: text(body.name),
      cropType: body.cropType,
      latitude: body.latitude,
      longitude: body.longitude,
      areaDunams: body.areaDunams ?? null,
      cultivationMethod: body.cultivationMethod ?? null,
      irrigationMethod: body.irrigationMethod ?? null,
      variety: text(body.variety),
      plantingDate: body.plantingDate ?? null,
      expectedHarvestDate: body.expectedHarvestDate ?? null,
      notes: text(body.notes),
      ownerId: state.user.id,
      createdAt: now,
      updatedAt: now,
    };
    state.fields.push(field);
    return { status: 201, body: toFieldDto(state, field, today) };
  }
  if ((m = path.match(/^\/fields\/([^/]+)$/))) {
    const field = fieldById(decodeURIComponent(m[1]));
    if (method === "GET") return { status: 200, body: toFieldDto(state, field, today) };
    if (method === "PATCH") {
      for (const key of ["name", "cropType", "latitude", "longitude", "areaDunams", "cultivationMethod", "irrigationMethod", "plantingDate", "expectedHarvestDate"]) {
        if (body?.[key] !== undefined) field[key] = body[key];
      }
      for (const key of ["variety", "notes"]) if (body?.[key] !== undefined) field[key] = text(body[key]);
      field.updatedAt = new Date().toISOString();
      return { status: 200, body: toFieldDto(state, field, today) };
    }
    if (method === "DELETE") {
      // כמו במסד: מחיקת חלקה מוחקת גם את האבחונים ואת יומן השדה שלה
      state.fields = state.fields.filter((f) => f.id !== field.id);
      state.diagnoses = state.diagnoses.filter((d) => d.fieldId !== field.id);
      state.logs = state.logs.filter((l) => l.fieldId !== field.id);
      return { status: 204, body: null };
    }
  }

  // --- ★ יומן שדה ו-PHI ---
  if ((m = path.match(/^\/fields\/([^/]+)\/logs$/))) {
    const field = fieldById(decodeURIComponent(m[1]));
    if (method === "GET") {
      const items = state.logs
        .filter((l) => l.fieldId === field.id)
        .sort((a, b) => b.appliedOn.localeCompare(a.appliedOn) || b.createdAt.localeCompare(a.createdAt))
        .map(toLogDto);
      return { status: 200, body: { field: toFieldDto(state, field, today), items, today } };
    }
    if (method === "POST") {
      const isSpray = body?.type === "SPRAY";
      if (!["SPRAY", "FERTILIZE", "IRRIGATE"].includes(body?.type)) throw invalid("type: invalid");
      if (!isDateOnly(body.appliedOn)) throw invalid("appliedOn: must be a valid date (YYYY-MM-DD)");
      if (body.appliedOn > today) throw invalid("appliedOn: cannot be in the future");
      if (isSpray && (!Number.isInteger(body.phiDays) || body.phiDays < 0 || body.phiDays > 365)) throw invalid("phiDays: is required for a spray");
      if (isSpray && !text(body.productName)) throw invalid("productName: is required for a spray");
      let modelLabel = null;
      if (body.diagnosisId) {
        const diagnosis = state.diagnoses.find((d) => d.id === body.diagnosisId);
        if (!diagnosis || diagnosis.fieldId !== field.id) throw invalid("diagnosisId: not a diagnosis of this field");
        modelLabel = diagnosis.modelLabel;
      }
      const log = {
        id: nextId("l"),
        fieldId: field.id,
        type: body.type,
        appliedOn: body.appliedOn,
        productName: text(body.productName),
        activeIngredient: text(body.activeIngredient)?.toLowerCase() ?? null,
        dosePerDunam: body.dosePerDunam ?? null,
        doseUnit: body.doseUnit ?? null,
        phiDays: isSpray ? body.phiDays : null,
        // ★ PHI: תאריך הקטיף המותר מחושב כאן, כמו בשרת
        safeHarvestDate: isSpray ? addDays(body.appliedOn, body.phiDays) : null,
        diagnosisId: body.diagnosisId ?? null,
        modelLabel,
        notes: text(body.notes),
        createdAt: new Date().toISOString(),
      };
      state.logs.push(log);
      return { status: 201, body: toLogDto(log) };
    }
  }
  if (method === "DELETE" && (m = path.match(/^\/fields\/([^/]+)\/logs\/([^/]+)$/))) {
    const field = fieldById(decodeURIComponent(m[1]));
    const logId = decodeURIComponent(m[2]);
    if (!state.logs.some((l) => l.id === logId && l.fieldId === field.id)) throw notFound("Log entry not found.");
    state.logs = state.logs.filter((l) => l.id !== logId);
    return { status: 204, body: null };
  }

  // --- אבחון (בלי AI: מצב מתוך הספרייה לפי הגידול של החלקה) ---
  if (method === "POST" && path === "/diagnose") {
    const field = fieldById(String(body?.get?.("fieldId") ?? ""));
    const image = body?.get?.("image");
    const candidates = libraryData.entries.filter((entry) => entry.plant === field.cropType);
    if (!image || candidates.length === 0) throw invalid("image and a supported field are required");
    const seed = hash(`${image.name}|${image.size}|${field.id}`);
    const entry = candidates[seed % candidates.length];
    const isHealthy = entry.pathogenType === "healthy";
    const confidence = Math.round((0.82 + ((seed >>> 8) % 1500) / 10000) * 10000) / 10000;
    const diagnosis = {
      id: nextId("d"),
      fieldId: field.id,
      modelLabel: entry.disease.modelLabel,
      imageUrl: `demo/${image.name}`,
      isHealthy,
      confidence,
      activeIngredient: entry.treatments[0]?.activeIngredient ?? null,
      cropMismatch: false,
      createdAt: new Date().toISOString(),
    };
    state.diagnoses.push(diagnosis);
    const hasUnverified = entry.treatments.some((t) => t.products.some((p) => !p.isVerified));
    return {
      status: 201,
      body: {
        diagnosis: { id: diagnosis.id, fieldId: field.id, imageUrl: diagnosis.imageUrl, createdAt: diagnosis.createdAt },
        disease: entry.disease,
        isHealthy,
        status: isHealthy ? "healthy" : "infected",
        statusHe: isHealthy ? "בריא" : "נגוע",
        confidence,
        confidencePercent: Math.round(confidence * 10000) / 100,
        uncertain: false,
        guidanceHe: entry.guidanceHe,
        chemicalControl: entry.chemicalControl,
        treatments: entry.treatments,
        cropCheck: {
          fieldCrop: field.cropType,
          fieldCropHe: plantHe(field.cropType),
          predictedPlant: entry.plant,
          predictedPlantHe: entry.disease.plantHe,
          supported: true,
          matches: true,
          fieldCropSharePercent: Math.round((97 + (seed % 290) / 100) * 100) / 100,
          inFieldCrop: [],
        },
        warningsHe: [DEMO_SCAN_NOTE_HE, ...(hasUnverified ? [UNVERIFIED_PRICES_WARNING_HE] : [])],
        disclaimerHe: DISCLAIMER_HE,
      },
    };
  }

  // --- היסטוריה ---
  if (method === "GET" && path === "/diagnoses") {
    const fieldId = query.get("fieldId");
    if (fieldId) fieldById(fieldId);
    const status = query.get("status");
    const limit = Math.min(Math.max(Number(query.get("limit") ?? 20), 1), 100);
    const offset = Math.max(Number(query.get("offset") ?? 0), 0);
    const all = state.diagnoses
      .filter((d) => (!fieldId || d.fieldId === fieldId) && (!status || d.isHealthy === (status === "healthy")))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return {
      status: 200,
      body: { items: all.slice(offset, offset + limit).map((d) => toHistoryItem(state, d)), total: all.length, limit, offset },
    };
  }
  if (method === "DELETE" && (m = path.match(/^\/diagnoses\/([^/]+)$/))) {
    const id = decodeURIComponent(m[1]);
    if (!state.diagnoses.some((d) => d.id === id)) throw notFound("Diagnosis not found.");
    state.diagnoses = state.diagnoses.filter((d) => d.id !== id);
    // כמו במסד: הרשומה ביומן נשארת, רק הקישור לאבחון נמחק
    for (const log of state.logs) if (log.diagnosisId === id) log.diagnosisId = null;
    return { status: 204, body: null };
  }

  // --- ספרייה וחדשות (עותק קבוע) ---
  if (method === "GET" && path === "/library") return { status: 200, body: libraryData };
  if (method === "GET" && path === "/news") {
    const lang = query.get("lang");
    return { status: 200, body: lang ? { ...newsData, items: newsData.items.filter((item) => item.language === lang) } : newsData };
  }

  throw notFound(`No demo route for ${method} ${path}`);
}

/**
 * מתקין את "השרת" של ההדגמה: כל fetch לכתובת ה-API נענה כאן; כל בקשה אחרת עוברת ל-fetch האמיתי.
 * @param {string} apiUrl - כתובת ה-API שהאפליקציה משתמשת בה (API_URL)
 */
export function installDemoBackend(apiUrl, { storage = globalThis.localStorage, delayMs = 250 } = {}) {
  const realFetch = globalThis.fetch.bind(globalThis);
  let state = loadState(storage);

  globalThis.fetch = async (input, init = {}) => {
    const url = String(input instanceof Request ? input.url : input);
    if (!url.startsWith(apiUrl)) return realFetch(input, init);

    const parsed = new URL(url.slice(apiUrl.length) || "/", "https://demo.invalid");
    const method = (init.method ?? "GET").toUpperCase();
    let body = init.body ?? null;
    if (typeof body === "string") body = JSON.parse(body);
    // כמו שרת אמיתי - קצת זמן תגובה; לאבחון יותר, כדי שיראו את מצב הטעינה
    await new Promise((resolve) => setTimeout(resolve, parsed.pathname === "/diagnose" ? delayMs * 4 : delayMs));

    try {
      const { status, body: responseBody } = await handle(state, { method, path: parsed.pathname, query: parsed.searchParams, body });
      saveState(state, storage);
      return status === 204 ? new Response(null, { status }) : json(status, responseBody);
    } catch (error) {
      if (error instanceof DemoHttpError) return json(error.status, { error: error.code, detail: error.message });
      return json(500, { error: "internal_error", detail: String(error) });
    }
  };

  return {
    /** חזרה לנתוני הדוגמה ההתחלתיים */
    reset() {
      resetDemo(storage);
      state = createSeedState();
    },
  };
}

function json(status, body) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}
