/**
 * טיפוסי ה-API של שרת הליבה (apps/server).
 * הלקוח (apps/client) מייבא אותם מכאן, כך שהבקשות והתשובות תמיד תואמות לשרת.
 */

/** תפקיד משתמש - זהה ל-enum Role בסכמת Prisma */
export type UserRole = "FARMER" | "AGRONOMIST" | "ADMIN";

/** פרטי משתמש שמוחזרים מהשרת (בלי סיסמה) */
export interface UserDto {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  /** טלפון נייד בפורמט בינלאומי (+9725...), לשחזור סיסמה; null אם לא הוגדר */
  phone: string | null;
  createdAt: string;
}

// ---------------------------------------------------------------------------
// אימות
// ---------------------------------------------------------------------------

/** גוף הבקשה של POST /api/auth/register. ADMIN לא יכול להירשם בעצמו. */
export interface RegisterRequest {
  email: string;
  /** לפחות 8 תווים */
  password: string;
  name: string;
  /** ברירת מחדל FARMER */
  role?: Exclude<UserRole, "ADMIN">;
  /** טלפון נייד ישראלי, לשחזור סיסמה (לא חובה). כל צורה נפוצה מתקבלת: 050-1234567, +972501234567 */
  phone?: string;
}

/** גוף הבקשה של PATCH /api/auth/me - עדכון הטלפון (null מוחק אותו) */
export interface UpdateMeRequest {
  phone: string | null;
}

/** שלב 1 בשחזור סיסמה: POST /api/auth/password-reset/request */
export interface PasswordResetRequest {
  phone: string;
}

/** שלב 2 בשחזור סיסמה: POST /api/auth/password-reset/confirm */
export interface PasswordResetConfirmRequest {
  phone: string;
  /** 6 ספרות מה-SMS */
  code: string;
  newPassword: string;
}

/** גוף הבקשה של POST /api/auth/login */
export interface LoginRequest {
  email: string;
  password: string;
}

/** התשובה להרשמה ולהתחברות */
export interface AuthResponse {
  /** JWT לשליחה בכותרת Authorization: Bearer <token> */
  token: string;
  /** מתי הטוקן פג (ISO 8601) */
  expiresAt: string;
  user: UserDto;
}

// ---------------------------------------------------------------------------
// חלקות
// ---------------------------------------------------------------------------

/** גוף הבקשה של POST /api/fields */
export interface CreateFieldRequest {
  name: string;
  /** סוג הגידול, למשל "Tomato" */
  cropType: string;
  /** -90..90 */
  latitude: number;
  /** -180..180 */
  longitude: number;
  /** רק ADMIN יכול ליצור חלקה עבור משתמש אחר */
  ownerId?: string;
}

export interface FieldDto {
  id: string;
  name: string;
  cropType: string;
  latitude: number;
  longitude: number;
  ownerId: string;
  /** שם הבעלים - חשוב לאגרונום שרואה חלקות של כמה חקלאים */
  ownerName: string;
  /** מספר האבחונים בחלקה */
  diagnosisCount: number;
  createdAt: string;
  updatedAt: string;
}

/** התשובה של GET /api/fields */
export interface FieldListResponse {
  items: FieldDto[];
}

// ---------------------------------------------------------------------------
// אבחון
// ---------------------------------------------------------------------------

/** פרטי המחלה בעברית ובאנגלית */
export interface DiseaseInfo {
  /** התווית הגולמית מהמודל, למשל "Tomato___Late_blight" */
  modelLabel: string;
  /** שם הצמח בעברית, למשל "עגבנייה" */
  plantHe: string;
  /** שם המחלה בעברית, למשל "כימשון" (או "בריא") */
  nameHe: string;
  /** שם מלא לתצוגה, למשל "עגבנייה – כימשון" */
  displayNameHe: string;
  /** השם באנגלית, למשל "Tomato Late blight" */
  nameEn: string;
  /** השם המדעי של הגורם, למשל "Phytophthora infestans"; null לעלה בריא */
  scientificName: string | null;
}

/** מוצר מסחרי עם טווח מחירים */
export interface ProductOffer {
  productName: string;
  packageSize: string;
  minPriceILS: number;
  maxPriceILS: number;
  /** false = מחיר דוגמה שלא אומת; יש להציג אותו עם הסתייגות */
  isVerified: boolean;
  priceSource: string | null;
}

/** חומר פעיל מומלץ והמוצרים שמכילים אותו */
export interface TreatmentOption {
  /** שם החומר באנגלית, למשל "mancozeb" */
  activeIngredient: string;
  /** שם החומר בעברית, למשל "מנקוזב" */
  activeIngredientHe: string;
  products: ProductOffer[];
}

/**
 * בדיקת התאמה בין מה שהמודל ראה לבין הגידול של החלקה.
 * המודל מכיר רק 38 מצבים ב-14 גידולים, ותמיד בוחר אחד מהם - גם כשמצלמים צמח אחר.
 * לכן משווים לגידול שהחקלאי הגדיר לחלקה.
 */
export interface CropCheck {
  /** הגידול של החלקה, כפי שנשמר (למשל "Corn") */
  fieldCrop: string;
  fieldCropHe: string;
  /** הצמח שהמודל זיהה (מהתחזית המובילה) */
  predictedPlant: string;
  predictedPlantHe: string;
  /** false אם הגידול של החלקה אינו אחד מ-14 הגידולים שהמודל מכיר */
  supported: boolean;
  /** האם הצמח שהמודל זיהה הוא הגידול של החלקה */
  matches: boolean;
  /** כמה מההסתברות של המודל (0..100) נופלת על הגידול של החלקה */
  fieldCropSharePercent: number;
  /** האפשרויות הסבירות ביותר בתוך הגידול של החלקה (הסתברות גולמית של המודל, 0..100) */
  inFieldCrop: Array<{ disease: DiseaseInfo; confidencePercent: number }>;
}

/** התשובה של POST /api/diagnose */
export interface DiagnoseResponse {
  diagnosis: {
    id: string;
    fieldId: string;
    imageUrl: string;
    createdAt: string;
  };
  disease: DiseaseInfo;
  isHealthy: boolean;
  status: "healthy" | "infected";
  /** "בריא" / "נגוע" */
  statusHe: string;
  /** 0..1 */
  confidence: number;
  /** 0..100 */
  confidencePercent: number;
  /** הוודאות נמוכה מהסף - יש לצלם שוב או להתייעץ */
  uncertain: boolean;
  /** הנחיית טיפול בעברית */
  guidanceHe: string;
  /** false למחלות שאין להן טיפול כימי (וירוסים, HLB, אסקה) ולעלה בריא */
  chemicalControl: boolean;
  /** ריק גם כשהצמח שזוהה לא תואם לגידול של החלקה - כדי לא להמליץ על ריסוס לגידול הלא נכון */
  treatments: TreatmentOption[];
  /** התאמה לגידול של החלקה */
  cropCheck: CropCheck;
  /** אזהרות בעברית (ודאות נמוכה, מחירים לא מאומתים) */
  warningsHe: string[];
  /** הסתייגות קבועה בעברית */
  disclaimerHe: string;
}

/** שורה בהיסטוריית האבחונים */
export interface DiagnosisHistoryItem {
  id: string;
  createdAt: string;
  imageUrl: string;
  field: { id: string; name: string; cropType: string };
  farmer: { id: string; name: string };
  disease: DiseaseInfo;
  isHealthy: boolean;
  confidence: number;
  /** החומר הפעיל הראשון שהומלץ, או null */
  activeIngredient: string | null;
  /** הצמח שזוהה לא תאם לגידול של החלקה - יש להתייחס לאבחון בזהירות */
  cropMismatch: boolean;
}

/** סינון לפי מצב העלה ב-GET /api/diagnoses?status= */
export type DiagnosisStatusFilter = "healthy" | "infected";

/** התשובה של GET /api/diagnoses */
export interface DiagnosisListResponse {
  items: DiagnosisHistoryItem[];
  /** מספר האבחונים הכולל שמתאים לסינון (לעימוד) */
  total: number;
  limit: number;
  offset: number;
}

// ---------------------------------------------------------------------------
// ספריית מחלות
// ---------------------------------------------------------------------------

/** סוג הגורם. אואומיצט (למשל כימשון) נראה כמו פטרייה אבל שייך לקבוצה אחרת */
export type PathogenType = "fungus" | "oomycete" | "bacterium" | "virus" | "pest" | "healthy";

/** רשומה אחת בספרייה - אחד מ-38 המצבים שהמודל מזהה */
export interface LibraryEntry {
  disease: DiseaseInfo;
  /** שם הצמח באנגלית, כמו cropType של חלקה (למשל "Tomato", "Pepper, bell") */
  plant: string;
  pathogenType: PathogenType;
  pathogenTypeHe: string;
  symptomsHe: string;
  preventionHe: string;
  /** הנחיית טיפול בעברית (גם לעלה בריא) */
  guidanceHe: string;
  chemicalControl: boolean;
  /** חומרים פעילים מקובלים ומוצרים עם טווחי מחירים בשקלים */
  treatments: TreatmentOption[];
  /** מקורות המידע (שירותי הדרכה חקלאית) */
  sources: string[];
}

/** התשובה של GET /api/library */
export interface LibraryResponse {
  entries: LibraryEntry[];
}

// ---------------------------------------------------------------------------
// חדשות
// ---------------------------------------------------------------------------

export type NewsLanguage = "he" | "en";

/** כתבה אחת מאחד ממקורות החדשות */
export interface NewsItem {
  /** מזהה יציב (מחושב מהקישור) */
  id: string;
  title: string;
  /** תקציר קצר בטקסט רגיל, בלי HTML; עד ~280 תווים */
  summary: string;
  /** קישור לכתבה המלאה באתר המקור (http/https בלבד) */
  link: string;
  /** ISO 8601, או null אם המקור לא ציין תאריך */
  publishedAt: string | null;
  sourceId: string;
  sourceName: string;
  language: NewsLanguage;
}

/** מצב של מקור חדשות בטעינה האחרונה */
export interface NewsSourceStatus {
  id: string;
  name: string;
  homepage: string;
  language: NewsLanguage;
  ok: boolean;
  itemCount: number;
}

/** התשובה של GET /api/news */
export interface NewsResponse {
  items: NewsItem[];
  sources: NewsSourceStatus[];
  /** מתי המקורות נטענו בפועל (התשובה יכולה להגיע מזיכרון המטמון) */
  fetchedAt: string;
}

// ---------------------------------------------------------------------------
// שגיאות
// ---------------------------------------------------------------------------

/** קודי השגיאה של שרת הליבה */
export type ServerErrorCode =
  | "bad_request"
  | "validation_error"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "invalid_code"
  | "payload_too_large"
  | "unsupported_media_type"
  | "too_many_requests"
  | "ai_unavailable"
  | "internal_error";

/** גוף התשובה בכל שגיאה של שרת הליבה */
export interface ServerErrorResponse {
  error: ServerErrorCode;
  detail: string;
}
