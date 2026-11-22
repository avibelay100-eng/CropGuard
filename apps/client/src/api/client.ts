/**
 * שכבת התקשורת עם שרת הליבה (apps/server).
 *
 * כל הקריאות עוברות דרך request(): הוא מוסיף את כתובת הבסיס ואת ה-JWT,
 * והופך כל תשובת שגיאה ל-ApiError עם הודעה בעברית למשתמש.
 */

import type {
  AuthResponse,
  CreateFieldLogRequest,
  CreateFieldRequest,
  DiagnoseResponse,
  DiagnosisListResponse,
  DiagnosisStatusFilter,
  FieldDto,
  FieldListResponse,
  FieldLogDto,
  FieldLogListResponse,
  LibraryResponse,
  LoginRequest,
  NewsLanguage,
  NewsResponse,
  PasswordResetConfirmRequest,
  RegisterRequest,
  UpdateFieldRequest,
  UpdateMeRequest,
  ServerErrorCode,
  UserDto,
} from "@cropguard/shared-types";

/** כתובת ה-API; ניתן לשנות ב-.env עם VITE_API_URL */
export const API_URL: string = (import.meta.env.VITE_API_URL ?? "http://localhost:3000/api").replace(/\/+$/, "");

/** הודעה בעברית לכל קוד שגיאה של השרת */
const MESSAGES_HE: Record<ServerErrorCode | "network_error", string> = {
  bad_request: "הבקשה לא תקינה. בדקו את הפרטים ונסו שוב.",
  validation_error: "חלק מהפרטים חסרים או לא תקינים.",
  unauthorized: "צריך להתחבר מחדש.",
  forbidden: "אין לכם הרשאה לפעולה הזו.",
  not_found: "הפריט לא נמצא.",
  conflict: "הפרטים האלה כבר רשומים בחשבון אחר.",
  invalid_code: "הקוד שגוי או שפג תוקפו. אפשר לבקש קוד חדש.",
  payload_too_large: "התמונה גדולה מדי. אפשר לשלוח עד 10MB.",
  unsupported_media_type: "הקובץ שנבחר אינו תמונה.",
  too_many_requests: "יותר מדי ניסיונות. נסו שוב בעוד כמה דקות.",
  ai_unavailable: "שירות האבחון לא זמין כרגע. נסו שוב בעוד כמה דקות.",
  internal_error: "אירעה שגיאה בשרת. נסו שוב.",
  network_error: "אין חיבור לשרת. בדקו את החיבור לאינטרנט ושהשרת פועל.",
};

/** שגיאה מהשרת (או מהרשת), עם קוד קבוע והודעה בעברית מוכנה להצגה */
export class ApiError extends Error {
  override name = "ApiError";
  constructor(
    /** 0 כשאין חיבור לשרת */
    readonly status: number,
    readonly code: ServerErrorCode | "network_error",
    /** ההסבר המקורי מהשרת (באנגלית) - לדיבאג */
    readonly detail: string,
    /** הודעה בעברית להצגה למשתמש */
    readonly messageHe: string = MESSAGES_HE[code] ?? MESSAGES_HE.internal_error,
  ) {
    super(detail);
  }
}

// ---------------------------------------------------------------------------
// הטוקן: נשמר ב-localStorage כדי שהמשתמש יישאר מחובר אחרי רענון
// ---------------------------------------------------------------------------

const TOKEN_KEY = "cropguard.token";

/** קריאה/כתיבה של הטוקן, עטופות ב-try - בגלישה פרטית האחסון עלול להיות חסום */
export const tokenStore = {
  get(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token: string | null): void {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // מצב גלישה פרטית או אחסון חסום - המשתמש פשוט יתחבר שוב בפעם הבאה
    }
  },
};

/** נקרא כשהשרת מחזיר 401 - ה-AuthProvider מתנתק ומחזיר למסך ההתחברות */
let onUnauthorized: (() => void) | null = null;
/** ה-AuthProvider רושם כאן פונקציה שמנתקת את המשתמש כשהשרת אומר שהטוקן לא תקף */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

/**
 * הלב של שכבת ה-API: כתובת בסיס, JWT, JSON, וטיפול אחיד בשגיאות.
 * 401 על בקשה עם טוקן = הטוקן פג -> ניתוק אוטומטי. 401 בהתחברות = סיסמה שגויה (לא מנתקים).
 */
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  // JSON רק כשהגוף הוא מחרוזת; FormData מגדיר את ה-Content-Type בעצמו
  if (typeof init.body === "string") headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "network_error", "Network request failed");
  }

  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const error = body as { error?: ServerErrorCode; detail?: string } | null;
    const code = error?.error && error.error in MESSAGES_HE ? error.error : "internal_error";
    // 401 על בקשה עם טוקן = הטוקן פג/בוטל (ולא סיסמה שגויה בהתחברות)
    if (response.status === 401 && token) onUnauthorized?.();
    throw new ApiError(response.status, code, error?.detail ?? `HTTP ${response.status}`);
  }
  return body as T;
}

// ---------------------------------------------------------------------------
// נקודות הקצה
// ---------------------------------------------------------------------------

export const api = {
  login: (input: LoginRequest) =>
    request<AuthResponse>("/auth/login", { method: "POST", body: JSON.stringify(input) }),

  register: (input: RegisterRequest) =>
    request<AuthResponse>("/auth/register", { method: "POST", body: JSON.stringify(input) }),

  me: () => request<UserDto>("/auth/me"),

  updateMe: (input: UpdateMeRequest) =>
    request<UserDto>("/auth/me", { method: "PATCH", body: JSON.stringify(input) }),

  requestPasswordReset: (phone: string) =>
    request<{ ok: true }>("/auth/password-reset/request", { method: "POST", body: JSON.stringify({ phone }) }),

  confirmPasswordReset: (input: PasswordResetConfirmRequest) =>
    request<{ ok: true }>("/auth/password-reset/confirm", { method: "POST", body: JSON.stringify(input) }),

  listFields: () => request<FieldListResponse>("/fields"),

  createField: (input: CreateFieldRequest) =>
    request<FieldDto>("/fields", { method: "POST", body: JSON.stringify(input) }),

  /** עריכת חלקה - רק השדות שנשלחו משתנים; null מוחק פרט מורחב */
  updateField: (id: string, input: UpdateFieldRequest) =>
    request<FieldDto>(`/fields/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }),

  /** מחיקת חלקה - כולל כל האבחונים ויומן השדה שלה; השרת מחזיר 204 */
  deleteField: (id: string) => request<null>(`/fields/${encodeURIComponent(id)}`, { method: "DELETE" }),

  /** ★ יומן השדה: הרשומות, החלקה (כולל מצב הקטיף) ו"היום" בישראל */
  listFieldLogs: (fieldId: string) => request<FieldLogListResponse>(`/fields/${encodeURIComponent(fieldId)}/logs`),

  createFieldLog: (fieldId: string, input: CreateFieldLogRequest) =>
    request<FieldLogDto>(`/fields/${encodeURIComponent(fieldId)}/logs`, { method: "POST", body: JSON.stringify(input) }),

  deleteFieldLog: (fieldId: string, logId: string) =>
    request<null>(`/fields/${encodeURIComponent(fieldId)}/logs/${encodeURIComponent(logId)}`, { method: "DELETE" }),

  diagnose: (fieldId: string, image: File) => {
    const form = new FormData();
    form.append("fieldId", fieldId);
    form.append("image", image);
    return request<DiagnoseResponse>("/diagnose", { method: "POST", body: form });
  },

  listDiagnoses: (filters: {
    fieldId?: string;
    status?: DiagnosisStatusFilter;
    limit?: number;
    offset?: number;
  } = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    const query = params.toString();
    return request<DiagnosisListResponse>(`/diagnoses${query ? `?${query}` : ""}`);
  },

  /** מחיקת אבחון; השרת מחזיר 204 בלי גוף */
  deleteDiagnosis: (id: string) => request<null>(`/diagnoses/${encodeURIComponent(id)}`, { method: "DELETE" }),

  listNews: (language?: NewsLanguage) => request<NewsResponse>(`/news${language ? `?lang=${language}` : ""}`),

  getLibrary: () => request<LibraryResponse>("/library"),
};

/** הודעה בעברית לכל שגיאה (גם שגיאות שאינן ApiError) */
export function errorMessageHe(error: unknown): string {
  return error instanceof ApiError ? error.messageHe : MESSAGES_HE.internal_error;
}
