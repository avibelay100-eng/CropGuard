/**
 * כלי עזר לבדיקות: fetch מדומה, נתוני דוגמה, ורינדור של האפליקציה כולה.
 */

import type {
  DiagnoseResponse,
  DiagnosisHistoryItem,
  DiagnosisListResponse,
  FieldDto,
  FieldLogDto,
  UserDto,
} from "@cropguard/shared-types";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router";
import { vi } from "vitest";

import { API_URL } from "../api/client";
import { App } from "../App";
import { AuthProvider } from "../auth/AuthContext";

// ---------------------------------------------------------------------------
// fetch מדומה
// ---------------------------------------------------------------------------

export interface MockRoute {
  method?: string;
  /** נתיב אחרי /api, כולל query string; RegExp לנתיב גמיש */
  path: string | RegExp;
  status?: number;
  body?: unknown;
  /** הבטחה שהתשובה מחכה לה - כדי לבדוק מצב טעינה */
  wait?: Promise<void>;
}

/** בקשה שנרשמה ב-fetch המדומה - כדי שבדיקה תוכל לבדוק מה נשלח לשרת */
export interface RecordedCall {
  method: string;
  path: string;
  headers: Headers;
  body: BodyInit | null | undefined;
}

/** fetch מדומה: מחזיר תשובות לפי שיטה ונתיב, ונכשל בקול על בקשה שלא הוגדרה */
export function mockFetch(routes: MockRoute[]) {
  const calls: RecordedCall[] = [];
  const fn = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    const path = url.startsWith(API_URL) ? url.slice(API_URL.length) : url;
    const method = init.method ?? "GET";
    calls.push({ method, path, headers: new Headers(init.headers), body: init.body });

    const route = routes.find(
      (r) => (r.method ?? "GET") === method && (typeof r.path === "string" ? r.path === path : r.path.test(path)),
    );
    if (!route) throw new Error(`Unmocked request: ${method} ${path}`);
    if (route.wait) await route.wait;
    const status = route.status ?? 200;
    // 204 ("אין תוכן") אסור שיהיה לו גוף - בדיוק כמו בשרת האמיתי
    if (status === 204) return new Response(null, { status });
    return new Response(JSON.stringify(route.body ?? null), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });
  vi.stubGlobal("fetch", fn);
  return { fn, calls };
}

/** הבטחה שהבדיקה משחררת ידנית */
export function deferred(): { promise: Promise<void>; resolve: () => void } {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => (resolve = r));
  return { promise, resolve };
}

// ---------------------------------------------------------------------------
// נתוני דוגמה
// ---------------------------------------------------------------------------

export const farmer: UserDto = {
  id: "u-farmer",
  email: "avi@example.test",
  name: "אבי כהן",
  role: "FARMER",
  phone: null,
  createdAt: "2026-11-01T08:00:00.000Z",
};

// אגרונום לדוגמה - רואה את כל החקלאים
export const agronomist: UserDto = { ...farmer, id: "u-agro", email: "dana@example.test", name: "דנה לוי", role: "AGRONOMIST" };

/** חלקה לדוגמה, עם אפשרות לשנות שדות */
export function field(overrides: Partial<FieldDto> = {}): FieldDto {
  return {
    id: "f-1",
    name: "חממה 3",
    cropType: "Tomato",
    latitude: 31.2518,
    longitude: 34.7913,
    ownerId: farmer.id,
    ownerName: farmer.name,
    diagnosisCount: 0,
    areaDunams: null,
    cultivationMethod: null,
    irrigationMethod: null,
    variety: null,
    plantingDate: null,
    expectedHarvestDate: null,
    notes: null,
    logCount: 0,
    harvestBlockedUntil: null,
    createdAt: "2026-11-01T08:00:00.000Z",
    updatedAt: "2026-11-01T08:00:00.000Z",
    ...overrides,
  };
}

/** רשומה ביומן השדה לדוגמה: ריסוס ב-20 בנובמבר עם 7 ימי המתנה */
export function fieldLog(overrides: Partial<FieldLogDto> = {}): FieldLogDto {
  return {
    id: "l-1",
    fieldId: "f-1",
    type: "SPRAY",
    appliedOn: "2026-11-20",
    productName: "Ridomil Gold MZ",
    activeIngredient: "metalaxyl-m + mancozeb",
    activeIngredientHe: "מטלקסיל-M + מנקוזב",
    dosePerDunam: 250,
    doseUnit: "g",
    phiDays: 7,
    safeHarvestDate: "2026-11-27",
    diagnosisId: null,
    disease: null,
    notes: null,
    createdAt: "2026-11-20T08:00:00.000Z",
    ...overrides,
  };
}

/** תשובת אבחון לדוגמה: כימשון בעגבנייה, עם מחירים ובלי אי-התאמה */
export const lateBlightResult: DiagnoseResponse = {
  diagnosis: { id: "d-1", fieldId: "f-1", imageUrl: "uploads/a.png", createdAt: "2026-11-22T10:09:42.932Z" },
  disease: {
    modelLabel: "Tomato___Late_blight",
    plantHe: "עגבנייה",
    nameHe: "כימשון",
    displayNameHe: "עגבנייה – כימשון",
    nameEn: "Tomato Late blight",
    scientificName: "Phytophthora infestans",
  },
  isHealthy: false,
  status: "infected",
  statusHe: "נגוע",
  confidence: 0.8995,
  confidencePercent: 89.95,
  uncertain: false,
  guidanceHe: "כימשון: לפנות למדריך מיד ולסלק צמחים נגועים.",
  chemicalControl: true,
  treatments: [
    {
      activeIngredient: "metalaxyl-m + mancozeb",
      activeIngredientHe: "מטלקסיל-M + מנקוזב",
      products: [
        { productName: "Ridomil Gold MZ", packageSize: "1 kg", minPriceILS: 110, maxPriceILS: 180, isVerified: false, priceSource: "placeholder", phiDays: 7 },
      ],
    },
    {
      activeIngredient: "mandipropamid",
      activeIngredientHe: "מנדיפרופמיד",
      products: [
        { productName: "Revus 250 SC", packageSize: "1 L", minPriceILS: 300, maxPriceILS: 480, isVerified: false, priceSource: "placeholder", phiDays: 3 },
      ],
    },
  ],
  cropCheck: {
    fieldCrop: "Tomato",
    fieldCropHe: "עגבנייה",
    predictedPlant: "Tomato",
    predictedPlantHe: "עגבנייה",
    supported: true,
    matches: true,
    fieldCropSharePercent: 99.5,
    inFieldCrop: [],
  },
  warningsHe: ["המחירים המוצגים הם הערכה בלבד ועדיין לא אומתו מול מחירון ספק."],
  disclaimerHe: "האבחון מבוסס על מודל בינה מלאכותית ואינו מחליף בדיקה של מדריך הגנת הצומח.",
};

/** תמונה של צמח אחר בשדה תירס: המודל זיהה עגבנייה */
export const mismatchResult: DiagnoseResponse = {
  ...lateBlightResult,
  uncertain: true,
  treatments: [],
  chemicalControl: false,
  guidanceHe: "לא מוצגות המלצות ריסוס, כי הצמח שזוהה לא תואם לגידול של החלקה.",
  cropCheck: {
    fieldCrop: "Corn",
    fieldCropHe: "תירס",
    predictedPlant: "Tomato",
    predictedPlantHe: "עגבנייה",
    supported: true,
    matches: false,
    fieldCropSharePercent: 3.4,
    inFieldCrop: [
      {
        disease: {
          modelLabel: "Corn___Northern_Leaf_Blight",
          plantHe: "תירס",
          nameHe: "כתמת עלים צפונית",
          displayNameHe: "תירס – כתמת עלים צפונית",
          nameEn: "Corn Northern Leaf Blight",
          scientificName: "Exserohilum turcicum",
        },
        confidencePercent: 2.4,
      },
    ],
  },
  warningsHe: ["החלקה מוגדרת כתירס, אבל המודל זיהה עגבנייה. ייתכן שבתמונה צמח אחר."],
};

/** תשובת אבחון לדוגמה: עלה עגבנייה בריא */
export const healthyResult: DiagnoseResponse = {
  ...lateBlightResult,
  disease: {
    modelLabel: "Tomato___Healthy",
    plantHe: "עגבנייה",
    nameHe: "בריא",
    displayNameHe: "עגבנייה – בריא",
    nameEn: "Tomato Healthy",
    scientificName: null,
  },
  isHealthy: true,
  status: "healthy",
  statusHe: "בריא",
  confidence: 0.97,
  confidencePercent: 97,
  guidanceHe: "העלה נראה בריא. אין צורך בטיפול.",
  chemicalControl: false,
  treatments: [],
  warningsHe: [],
};

/** שורת היסטוריה לדוגמה */
export function historyItem(overrides: Partial<DiagnosisHistoryItem> = {}): DiagnosisHistoryItem {
  return {
    id: "d-1",
    createdAt: "2026-11-22T10:09:42.932Z",
    imageUrl: "uploads/a.png",
    field: { id: "f-1", name: "חממה 3", cropType: "Tomato" },
    farmer: { id: farmer.id, name: farmer.name },
    disease: lateBlightResult.disease,
    isHealthy: false,
    confidence: 0.8995,
    activeIngredient: "metalaxyl-m + mancozeb",
    cropMismatch: false,
    ...overrides,
  };
}

/** עמוד היסטוריה לדוגמה (פריטים + סה"כ לעימוד) */
export function historyPage(items: DiagnosisHistoryItem[], total = items.length, offset = 0): DiagnosisListResponse {
  return { items, total, limit: 20, offset };
}

// ---------------------------------------------------------------------------
// רינדור
// ---------------------------------------------------------------------------

/**
 * מרנדר את כל האפליקציה בכתובת נתונה. עם user - המשתמש כבר מחובר
 * (טוקן שמור + /auth/me מחזיר אותו). routes - שאר התשובות המדומות.
 */
export function renderApp(path: string, { user, routes = [] }: { user?: UserDto; routes?: MockRoute[] } = {}) {
  if (user) localStorage.setItem("cropguard.token", "test-token");
  const fetchMock = mockFetch([...(user ? [{ path: "/auth/me", body: user }] : []), ...routes]);
  const view = render(
    <MemoryRouter initialEntries={[path]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
  return { ...view, ...fetchMock };
}
