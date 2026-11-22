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
  treatments: TreatmentOption[];
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
}

/** התשובה של GET /api/diagnoses */
export interface DiagnosisListResponse {
  items: DiagnosisHistoryItem[];
  /** מספר האבחונים הכולל שמתאים לסינון (לעימוד) */
  total: number;
  limit: number;
  offset: number;
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
