/**
 * שכבת התקשורת עם שרת הליבה (apps/server).
 *
 * כל הקריאות עוברות דרך request(): הוא מוסיף את כתובת הבסיס ואת ה-JWT,
 * והופך כל תשובת שגיאה ל-ApiError עם הודעה בעברית למשתמש.
 */

/** כתובת ה-API; ניתן לשנות ב-.env עם VITE_API_URL */
export const API_URL = (import.meta.env.VITE_API_URL ?? "http://localhost:3000/api").replace(/\/+$/, "");

/** הודעה בעברית לכל קוד שגיאה של השרת */
const MESSAGES_HE = {
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
  name = "ApiError";
  /** 0 כשאין חיבור לשרת */
  status;
  code;
  /** ההסבר המקורי מהשרת (באנגלית) - לדיבאג */
  detail;
  /** הודעה בעברית להצגה למשתמש */
  messageHe;
  constructor(
    status,
    code,
    detail,
    messageHe = MESSAGES_HE[code] ?? MESSAGES_HE.internal_error,
  ) {
    super(detail);
    this.status = status;
    this.code = code;
    this.detail = detail;
    this.messageHe = messageHe;
  }
}

// ---------------------------------------------------------------------------
// הטוקן: נשמר ב-localStorage כדי שהמשתמש יישאר מחובר אחרי רענון
// ---------------------------------------------------------------------------

const TOKEN_KEY = "cropguard.token";

/** קריאה/כתיבה של הטוקן, עטופות ב-try - בגלישה פרטית האחסון עלול להיות חסום */
export const tokenStore = {
  get() {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },
  set(token) {
    try {
      if (token) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      // מצב גלישה פרטית או אחסון חסום - המשתמש פשוט יתחבר שוב בפעם הבאה
    }
  },
};

/** נקרא כשהשרת מחזיר 401 - ה-AuthProvider מתנתק ומחזיר למסך ההתחברות */
let onUnauthorized = null;
/** ה-AuthProvider רושם כאן פונקציה שמנתקת את המשתמש כשהשרת אומר שהטוקן לא תקף */
export function setUnauthorizedHandler(handler) {
  onUnauthorized = handler;
}

/**
 * הלב של שכבת ה-API: כתובת בסיס, JWT, JSON, וטיפול אחיד בשגיאות.
 * 401 על בקשה עם טוקן = הטוקן פג -> ניתוק אוטומטי. 401 בהתחברות = סיסמה שגויה (לא מנתקים).
 */
async function request(path, init = {}) {
  const headers = new Headers(init.headers);
  const token = tokenStore.get();
  if (token) headers.set("Authorization", `Bearer ${token}`);
  // JSON רק כשהגוף הוא מחרוזת; FormData מגדיר את ה-Content-Type בעצמו
  if (typeof init.body === "string") headers.set("Content-Type", "application/json");

  let response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, "network_error", "Network request failed");
  }

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const error = body;
    const code = error?.error && error.error in MESSAGES_HE ? error.error : "internal_error";
    // 401 על בקשה עם טוקן = הטוקן פג/בוטל (ולא סיסמה שגויה בהתחברות)
    if (response.status === 401 && token) onUnauthorized?.();
    throw new ApiError(response.status, code, error?.detail ?? `HTTP ${response.status}`);
  }
  return body;
}

// ---------------------------------------------------------------------------
// נקודות הקצה
// ---------------------------------------------------------------------------

export const api = {
  login: (input) =>
    request("/auth/login", { method: "POST", body: JSON.stringify(input) }),

  register: (input) =>
    request("/auth/register", { method: "POST", body: JSON.stringify(input) }),

  me: () => request("/auth/me"),

  updateMe: (input) =>
    request("/auth/me", { method: "PATCH", body: JSON.stringify(input) }),

  requestPasswordReset: (phone) =>
    request("/auth/password-reset/request", { method: "POST", body: JSON.stringify({ phone }) }),

  confirmPasswordReset: (input) =>
    request("/auth/password-reset/confirm", { method: "POST", body: JSON.stringify(input) }),

  listFields: () => request("/fields"),

  createField: (input) =>
    request("/fields", { method: "POST", body: JSON.stringify(input) }),

  /** עריכת חלקה - רק השדות שנשלחו משתנים; null מוחק פרט מורחב */
  updateField: (id, input) =>
    request(`/fields/${encodeURIComponent(id)}`, { method: "PATCH", body: JSON.stringify(input) }),

  /** מחיקת חלקה - כולל כל האבחונים ויומן השדה שלה; השרת מחזיר 204 */
  deleteField: (id) => request(`/fields/${encodeURIComponent(id)}`, { method: "DELETE" }),

  /** ★ יומן השדה: הרשומות, החלקה (כולל מצב הקטיף) ו"היום" בישראל */
  listFieldLogs: (fieldId) => request(`/fields/${encodeURIComponent(fieldId)}/logs`),

  createFieldLog: (fieldId, input) =>
    request(`/fields/${encodeURIComponent(fieldId)}/logs`, { method: "POST", body: JSON.stringify(input) }),

  deleteFieldLog: (fieldId, logId) =>
    request(`/fields/${encodeURIComponent(fieldId)}/logs/${encodeURIComponent(logId)}`, { method: "DELETE" }),

  diagnose: (fieldId, image) => {
    const form = new FormData();
    form.append("fieldId", fieldId);
    form.append("image", image);
    return request("/diagnose", { method: "POST", body: form });
  },

  listDiagnoses: (filters = {}) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(filters)) {
      if (value !== undefined && value !== "") params.set(key, String(value));
    }
    const query = params.toString();
    return request(`/diagnoses${query ? `?${query}` : ""}`);
  },

  /** מחיקת אבחון; השרת מחזיר 204 בלי גוף */
  deleteDiagnosis: (id) => request(`/diagnoses/${encodeURIComponent(id)}`, { method: "DELETE" }),

  listNews: (language) => request(`/news${language ? `?lang=${language}` : ""}`),

  getLibrary: () => request("/library"),
};

/** הודעה בעברית לכל שגיאה (גם שגיאות שאינן ApiError) */
export function errorMessageHe(error) {
  return error instanceof ApiError ? error.messageHe : MESSAGES_HE.internal_error;
}
