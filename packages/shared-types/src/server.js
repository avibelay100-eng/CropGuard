/**
 * טיפוסי ה-API של שרת הליבה (apps/server).
 * הלקוח (apps/client) מייבא אותם מכאן, כך שהבקשות והתשובות תמיד תואמות לשרת.
 */

/**
 * תפקיד משתמש - זהה ל-enum Role בסכמת Prisma
 * @typedef {"FARMER" | "AGRONOMIST" | "ADMIN"} UserRole
 */

/**
 * פרטי משתמש שמוחזרים מהשרת (בלי סיסמה)
 * @typedef {object} UserDto
 * @property {string} id
 * @property {string} email
 * @property {string} name
 * @property {UserRole} role
 * @property {string | null} phone - טלפון נייד בפורמט בינלאומי (+9725...), לשחזור סיסמה; null אם לא הוגדר
 * @property {string} createdAt
 */

// ---------------------------------------------------------------------------
// אימות
// ---------------------------------------------------------------------------

/**
 * גוף הבקשה של POST /api/auth/register. ADMIN לא יכול להירשם בעצמו.
 * @typedef {object} RegisterRequest
 * @property {string} email
 * @property {string} password - לפחות 8 תווים
 * @property {string} name
 * @property {Exclude<UserRole, "ADMIN">} [role] - ברירת מחדל FARMER
 * @property {string} [phone] - טלפון נייד ישראלי, לשחזור סיסמה (לא חובה). כל צורה נפוצה מתקבלת: 050-1234567, +972501234567
 */

/**
 * גוף הבקשה של PATCH /api/auth/me - עדכון הטלפון (null מוחק אותו)
 * @typedef {object} UpdateMeRequest
 * @property {string | null} phone
 */

/**
 * שלב 1 בשחזור סיסמה: POST /api/auth/password-reset/request
 * @typedef {object} PasswordResetRequest
 * @property {string} phone
 */

/**
 * שלב 2 בשחזור סיסמה: POST /api/auth/password-reset/confirm
 * @typedef {object} PasswordResetConfirmRequest
 * @property {string} phone
 * @property {string} code - 6 ספרות מה-SMS
 * @property {string} newPassword
 */

/**
 * גוף הבקשה של POST /api/auth/login
 * @typedef {object} LoginRequest
 * @property {string} email
 * @property {string} password
 */

/**
 * התשובה להרשמה ולהתחברות
 * @typedef {object} AuthResponse
 * @property {string} token - JWT לשליחה בכותרת Authorization: Bearer <token>
 * @property {string} expiresAt - מתי הטוקן פג (ISO 8601)
 * @property {UserDto} user
 */

// ---------------------------------------------------------------------------
// חלקות
// ---------------------------------------------------------------------------

/**
 * ★ התאמה לשוק הישראלי: שיטת הגידול - שטח פתוח, בית רשת, חממה, מנהרות
 * @typedef {"OPEN_FIELD" | "NET_HOUSE" | "GREENHOUSE" | "TUNNEL"} CultivationMethod
 */

/**
 * שיטת ההשקיה - טפטוף או המטרה
 * @typedef {"DRIP" | "SPRINKLER"} IrrigationMethod
 */

/**
 * פרטי החלקה המורחבים - כולם לא חובה; null = לא הוגדר.
 * תאריכים בפורמט "YYYY-MM-DD" (תאריך בלבד, בלי שעה).
 * @typedef {object} FieldDetails
 * @property {number | null} areaDunams - שטח בדונמים (דונם = 1,000 מ"ר)
 * @property {CultivationMethod | null} cultivationMethod
 * @property {IrrigationMethod | null} irrigationMethod
 * @property {string | null} variety - הזן בעונה הנוכחית
 * @property {string | null} plantingDate
 * @property {string | null} expectedHarvestDate
 * @property {string | null} notes
 */

/**
 * גוף הבקשה של POST /api/fields
 * @typedef {object} CreateFieldRequest
 * @extends {Partial<FieldDetails>}
 * @property {string} name
 * @property {string} cropType - סוג הגידול, למשל "Tomato"
 * @property {number} latitude - -90..90
 * @property {number} longitude - -180..180
 * @property {string} [ownerId] - רק ADMIN יכול ליצור חלקה עבור משתמש אחר
 */

/**
 * גוף הבקשה של PATCH /api/fields/:id - רק השדות שמשתנים; null מוחק פרט מורחב
 * @typedef {Partial<Omit<CreateFieldRequest, "ownerId">>} UpdateFieldRequest
 */

/**
 * חלקה כפי שהשרת מחזיר אותה
 * @typedef {object} FieldDto
 * @extends {FieldDetails}
 * @property {string} id
 * @property {string} name
 * @property {string} cropType
 * @property {number} latitude
 * @property {number} longitude
 * @property {string} ownerId
 * @property {string} ownerName - שם הבעלים - חשוב לאגרונום שרואה חלקות של כמה חקלאים
 * @property {number} diagnosisCount - מספר האבחונים בחלקה
 * @property {number} logCount - מספר הרשומות ביומן השדה
 * @property {string | null} harvestBlockedUntil - ★ PHI: אם רוססה לאחרונה - התאריך הראשון שבו מותר לקטוף ("YYYY-MM-DD"). null = אין ריסוס שימי ההמתנה שלו עדיין לא עברו.
 * @property {string} createdAt
 * @property {string} updatedAt
 */

/**
 * התשובה של GET /api/fields
 * @typedef {object} FieldListResponse
 * @property {FieldDto[]} items
 */

// ---------------------------------------------------------------------------
// ★ יומן שדה ו-PHI (ימי המתנה לקטיף)
// ---------------------------------------------------------------------------

/**
 * סוג הרשומה ביומן: ריסוס, דישון או השקיה
 * @typedef {"SPRAY" | "FERTILIZE" | "IRRIGATE"} FieldLogType
 */

/**
 * יחידות המינון לדונם: גרם, סמ"ק, ק"ג, ליטר, מ"ק (מים)
 * @typedef {"g" | "ml" | "kg" | "L" | "m3"} DoseUnit
 */

/**
 * גוף הבקשה של POST /api/fields/:id/logs
 * @typedef {object} CreateFieldLogRequest
 * @property {FieldLogType} type
 * @property {string} appliedOn - תאריך הביצוע "YYYY-MM-DD"; לא בעתיד
 * @property {string | null} [productName]
 * @property {string | null} [activeIngredient] - שם החומר הפעיל באנגלית, למשל "mancozeb"
 * @property {number | null} [dosePerDunam]
 * @property {DoseUnit | null} [doseUnit]
 * @property {number | null} [phiDays] - חובה בריסוס (0..365); אסור בדישון ובהשקיה
 * @property {string | null} [diagnosisId] - האבחון שבעקבותיו רוססה החלקה - חייב להיות של אותה חלקה
 * @property {string | null} [notes]
 */

/**
 * רשומה ביומן השדה
 * @typedef {object} FieldLogDto
 * @property {string} id
 * @property {string} fieldId
 * @property {FieldLogType} type
 * @property {string} appliedOn
 * @property {string | null} productName
 * @property {string | null} activeIngredient
 * @property {string | null} activeIngredientHe - שם החומר הפעיל בעברית, אם הוא במילון
 * @property {number | null} dosePerDunam
 * @property {DoseUnit | null} doseUnit
 * @property {number | null} phiDays
 * @property {string | null} safeHarvestDate - התאריך הראשון שבו מותר לקטוף (appliedOn + phiDays); מחושב בשרת
 * @property {string | null} diagnosisId
 * @property {DiseaseInfo | null} disease - המחלה שבגללה רוססה החלקה, אם הרשומה נוצרה מאבחון
 * @property {string | null} notes
 * @property {string} createdAt
 */

/**
 * התשובה של GET /api/fields/:id/logs
 * @typedef {object} FieldLogListResponse
 * @property {FieldDto} field
 * @property {FieldLogDto[]} items - מהחדש לישן
 * @property {string} today - התאריך של היום לפי לוח השנה בישראל ("YYYY-MM-DD") - כך הלקוח והשרת מסכימים מה זה "היום"
 */

// ---------------------------------------------------------------------------
// אבחון
// ---------------------------------------------------------------------------

/**
 * פרטי המחלה בעברית ובאנגלית
 * @typedef {object} DiseaseInfo
 * @property {string} modelLabel - התווית הגולמית מהמודל, למשל "Tomato___Late_blight"
 * @property {string} plantHe - שם הצמח בעברית, למשל "עגבנייה"
 * @property {string} nameHe - שם המחלה בעברית, למשל "כימשון" (או "בריא")
 * @property {string} displayNameHe - שם מלא לתצוגה, למשל "עגבנייה – כימשון"
 * @property {string} nameEn - השם באנגלית, למשל "Tomato Late blight"
 * @property {string | null} scientificName - השם המדעי של הגורם, למשל "Phytophthora infestans"; null לעלה בריא
 */

/**
 * מוצר מסחרי עם טווח מחירים
 * @typedef {object} ProductOffer
 * @property {string} productName
 * @property {string} packageSize
 * @property {number} minPriceILS
 * @property {number} maxPriceILS
 * @property {boolean} isVerified - false = מחיר דוגמה שלא אומת; יש להציג אותו עם הסתייגות
 * @property {string | null} priceSource
 * @property {number | null} phiDays - PHI - ימי המתנה לקטיף לפי תווית המוצר; ערך דוגמה שיש לאמת מול התווית; null אם לא ידוע
 */

/**
 * חומר פעיל מומלץ והמוצרים שמכילים אותו
 * @typedef {object} TreatmentOption
 * @property {string} activeIngredient - שם החומר באנגלית, למשל "mancozeb"
 * @property {string} activeIngredientHe - שם החומר בעברית, למשל "מנקוזב"
 * @property {ProductOffer[]} products
 */

/**
 * בדיקת התאמה בין מה שהמודל ראה לבין הגידול של החלקה.
 * המודל מכיר רק 38 מצבים ב-14 גידולים, ותמיד בוחר אחד מהם - גם כשמצלמים צמח אחר.
 * לכן משווים לגידול שהחקלאי הגדיר לחלקה.
 * @typedef {object} CropCheck
 * @property {string} fieldCrop - הגידול של החלקה, כפי שנשמר (למשל "Corn")
 * @property {string} fieldCropHe
 * @property {string} predictedPlant - הצמח שהמודל זיהה (מהתחזית המובילה)
 * @property {string} predictedPlantHe
 * @property {boolean} supported - false אם הגידול של החלקה אינו אחד מ-14 הגידולים שהמודל מכיר
 * @property {boolean} matches - האם הצמח שהמודל זיהה הוא הגידול של החלקה
 * @property {number} fieldCropSharePercent - כמה מההסתברות של המודל (0..100) נופלת על הגידול של החלקה
 * @property {Array<{ disease: DiseaseInfo; confidencePercent: number }>} inFieldCrop - האפשרויות הסבירות ביותר בתוך הגידול של החלקה (הסתברות גולמית של המודל, 0..100)
 */

/**
 * התשובה של POST /api/diagnose
 * @typedef {object} DiagnoseResponse
 * @property {{ id: string; fieldId: string; imageUrl: string; createdAt: string; }} diagnosis
 * @property {DiseaseInfo} disease
 * @property {boolean} isHealthy
 * @property {"healthy" | "infected"} status
 * @property {string} statusHe - "בריא" / "נגוע"
 * @property {number} confidence - 0..1
 * @property {number} confidencePercent - 0..100
 * @property {boolean} uncertain - הוודאות נמוכה מהסף - יש לצלם שוב או להתייעץ
 * @property {string} guidanceHe - הנחיית טיפול בעברית
 * @property {boolean} chemicalControl - false למחלות שאין להן טיפול כימי (וירוסים, HLB, אסקה) ולעלה בריא
 * @property {TreatmentOption[]} treatments - ריק גם כשהצמח שזוהה לא תואם לגידול של החלקה - כדי לא להמליץ על ריסוס לגידול הלא נכון
 * @property {CropCheck} cropCheck - התאמה לגידול של החלקה
 * @property {string[]} warningsHe - אזהרות בעברית (ודאות נמוכה, מחירים לא מאומתים)
 * @property {string} disclaimerHe - הסתייגות קבועה בעברית
 */

/**
 * שורה בהיסטוריית האבחונים
 * @typedef {object} DiagnosisHistoryItem
 * @property {string} id
 * @property {string} createdAt
 * @property {string} imageUrl
 * @property {{ id: string; name: string; cropType: string }} field
 * @property {{ id: string; name: string }} farmer
 * @property {DiseaseInfo} disease
 * @property {boolean} isHealthy
 * @property {number} confidence
 * @property {string | null} activeIngredient - החומר הפעיל הראשון שהומלץ, או null
 * @property {boolean} cropMismatch - הצמח שזוהה לא תאם לגידול של החלקה - יש להתייחס לאבחון בזהירות
 */

/**
 * סינון לפי מצב העלה ב-GET /api/diagnoses?status=
 * @typedef {"healthy" | "infected"} DiagnosisStatusFilter
 */

/**
 * התשובה של GET /api/diagnoses
 * @typedef {object} DiagnosisListResponse
 * @property {DiagnosisHistoryItem[]} items
 * @property {number} total - מספר האבחונים הכולל שמתאים לסינון (לעימוד)
 * @property {number} limit
 * @property {number} offset
 */

// ---------------------------------------------------------------------------
// ספריית מחלות
// ---------------------------------------------------------------------------

/**
 * סוג הגורם. אואומיצט (למשל כימשון) נראה כמו פטרייה אבל שייך לקבוצה אחרת
 * @typedef {"fungus" | "oomycete" | "bacterium" | "virus" | "pest" | "healthy"} PathogenType
 */

/**
 * רשומה אחת בספרייה - אחד מ-38 המצבים שהמודל מזהה
 * @typedef {object} LibraryEntry
 * @property {DiseaseInfo} disease
 * @property {string} plant - שם הצמח באנגלית, כמו cropType של חלקה (למשל "Tomato", "Pepper, bell")
 * @property {PathogenType} pathogenType
 * @property {string} pathogenTypeHe
 * @property {string} symptomsHe
 * @property {string} preventionHe
 * @property {string} guidanceHe - הנחיית טיפול בעברית (גם לעלה בריא)
 * @property {boolean} chemicalControl
 * @property {TreatmentOption[]} treatments - חומרים פעילים מקובלים ומוצרים עם טווחי מחירים בשקלים
 * @property {string[]} sources - מקורות המידע (שירותי הדרכה חקלאית)
 */

/**
 * התשובה של GET /api/library
 * @typedef {object} LibraryResponse
 * @property {LibraryEntry[]} entries
 */

// ---------------------------------------------------------------------------
// חדשות
// ---------------------------------------------------------------------------

/**
 * @typedef {"he" | "en"} NewsLanguage
 */

/**
 * כתבה אחת מאחד ממקורות החדשות
 * @typedef {object} NewsItem
 * @property {string} id - מזהה יציב (מחושב מהקישור)
 * @property {string} title
 * @property {string} summary - תקציר קצר בטקסט רגיל, בלי HTML; עד ~280 תווים
 * @property {string} link - קישור לכתבה המלאה באתר המקור (http/https בלבד)
 * @property {string | null} publishedAt - ISO 8601, או null אם המקור לא ציין תאריך
 * @property {string} sourceId
 * @property {string} sourceName
 * @property {NewsLanguage} language
 */

/**
 * מצב של מקור חדשות בטעינה האחרונה
 * @typedef {object} NewsSourceStatus
 * @property {string} id
 * @property {string} name
 * @property {string} homepage
 * @property {NewsLanguage} language
 * @property {boolean} ok
 * @property {number} itemCount
 */

/**
 * התשובה של GET /api/news
 * @typedef {object} NewsResponse
 * @property {NewsItem[]} items
 * @property {NewsSourceStatus[]} sources
 * @property {string} fetchedAt - מתי המקורות נטענו בפועל (התשובה יכולה להגיע מזיכרון המטמון)
 */

// ---------------------------------------------------------------------------
// שגיאות
// ---------------------------------------------------------------------------

/**
 * קודי השגיאה של שרת הליבה
 * @typedef {"bad_request" | "validation_error" | "unauthorized" | "forbidden" | "not_found" | "conflict" | "invalid_code" | "payload_too_large" | "unsupported_media_type" | "too_many_requests" | "ai_unavailable" | "internal_error"} ServerErrorCode
 */

/**
 * גוף התשובה בכל שגיאה של שרת הליבה
 * @typedef {object} ServerErrorResponse
 * @property {ServerErrorCode} error
 * @property {string} detail
 */

export {};
