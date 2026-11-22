/**
 * טיפוסי ה-API של CropGuard AI Engine (services/ai_engine).
 *
 * אלה מבני ה-JSON שהשירות מחזיר. השרת (apps/server) והלקוח (apps/client)
 * מייבאים אותם מכאן, כך שכל שינוי ב-API מתגלה מיד בבדיקת הטיפוסים של כולם.
 *
 * חשוב: כל שינוי כאן מחייב שינוי תואם בסכמות ה-JSON שב-
 * services/ai_engine/src/schemas.js. שם יש בדיקה בזמן קומפילציה שמוודאת
 * שהשדות זהים בשני המקומות.
 */

/**
 * מצב העלה לפי המחלקה המובילה
 * @typedef {"healthy" | "infected"} LeafStatus
 */

/**
 * אחת מהתחזיות המובילות
 * @typedef {object} ClassScore
 * @property {string} model_label - התווית הגולמית מ-labels-38.txt, למשל "Tomato___Late_blight"
 * @property {string} disease - שם קריא באנגלית, למשל "Tomato Late blight"
 * @property {number} confidence - הסתברות, 0..1
 */

/**
 * התשובה של POST /predict
 * @typedef {object} PredictionResponse
 * @property {string} disease - שם קריא של המחלקה המובילה, למשל "Tomato Late blight"
 * @property {string} model_label - התווית הגולמית מ-labels-38.txt
 * @property {string} plant - שם הצמח, למשל "Tomato"
 * @property {boolean} is_healthy - true כשהמחלקה המובילה היא "Healthy"
 * @property {LeafStatus} status
 * @property {number} confidence - הסתברות המחלקה המובילה, 0..1
 * @property {number} confidence_percent - אותה הסתברות באחוזים, 0..100
 * @property {boolean} uncertain - true כשהוודאות מתחת לסף שהוגדר בשירות (ברירת מחדל 0.5)
 * @property {ClassScore[]} top_predictions - התחזיות המובילות, מהגבוהה לנמוכה; הראשונה זהה למחלקה המובילה
 */

/**
 * מצב השירות
 * @typedef {"ok" | "degraded"} ServiceStatus
 */

/**
 * התשובה של GET /health
 * @typedef {object} HealthResponse
 * @property {string} service - "CropGuard AI Engine"
 * @property {string} version
 * @property {ServiceStatus} status - "degraded" כשהמודל לא נטען - אז /predict מחזיר 503
 * @property {boolean} model_loaded
 * @property {number} class_count - מספר המחלקות שהמודל מזהה (38)
 * @property {string | null} detail - הסיבה שהמודל לא נטען, או null
 */

/**
 * קודי השגיאה הקבועים שהשירות מחזיר בשדה error.
 * "error" הוא קוד כללי לסטטוסים נדירים שאין להם קוד משלהם.
 * @typedef {"bad_request" | "not_found" | "method_not_allowed" | "payload_too_large" | "unsupported_media_type" | "validation_error" | "internal_error" | "model_unavailable" | "error"} AiEngineErrorCode
 *   - "bad_request": 400 - תמונה ריקה או פגומה
 *   - "not_found": 404 - כתובת לא קיימת
 *   - "method_not_allowed": 405
 *   - "payload_too_large": 413 - קובץ גדול מהמגבלה
 *   - "unsupported_media_type": 415 - הקובץ אינו תמונה / הבקשה אינה multipart
 *   - "validation_error": 422 - אין קובץ בשדה "image"
 *   - "internal_error": 500 - התחזית נכשלה
 *   - "model_unavailable": 503 - המודל לא נטען
 */

/**
 * גוף התשובה בכל שגיאה
 * @typedef {object} ErrorResponse
 * @property {AiEngineErrorCode} error
 * @property {string} detail - הסבר לבני אדם (באנגלית)
 */

/**
 * תשובה של POST /predict: הצלחה או שגיאה
 * @typedef {PredictionResponse | ErrorResponse} PredictResult
 */

export {};
