# @cropguard/shared-types

חוזה הנתונים המשותף לכל חלקי CropGuard, כדי שהשרת, הלקוח ושירות ה-AI
ידברו באותה "שפה". כל צורה מתועדת כהערת JSDoc `@typedef` - בלי קוד שרץ.

## מה יש כאן

| טיפוס | מה הוא מתאר |
|---|---|
| `PredictionResponse` | התשובה של `POST /predict` בשירות ה-AI |
| `ClassScore` | תחזית אחת מתוך `top_predictions` |
| `HealthResponse` | התשובה של `GET /health` |
| `ErrorResponse` | גוף התשובה בכל שגיאה |
| `AiEngineErrorCode` | קודי השגיאה הקבועים (`bad_request`, `model_unavailable` וכו') |
| `PredictResult` | `PredictionResponse` או `ErrorResponse` |
| `LeafStatus`, `ServiceStatus` | `"healthy" \| "infected"`, `"ok" \| "degraded"` |

הקוד נמצא ב-`src/aiEngine.js`.

## שימוש בחבילה אחרת בפרויקט

1. מוסיפים תלות ב-`package.json` של החבילה (למשל `apps/server`):

   ```json
   "dependencies": {
     "@cropguard/shared-types": "*"
   }
   ```

2. מריצים `npm install` מהתיקייה הראשית.

3. מפנים לטיפוס בהערת JSDoc (עורכי קוד מציגים השלמה אוטומטית):

   ```js
   const response = await fetch("http://localhost:8001/predict", { method: "POST", body: form });
   /** @type {import("@cropguard/shared-types/aiEngine").PredictionResponse} */
   const result = await response.json();
   ```

החבילה מכילה **תיעוד בלבד**, בלי קוד שרץ, ולכן אין לה שלב build ואף חלק לא תלוי בה בזמן ריצה.

## שינוי טיפוס של שירות ה-AI

כל שינוי ב-`src/aiEngine.js` מחייב שינוי תואם בסכמות ה-JSON שב-
`services/ai_engine/src/schemas.js` (Fastify מחזיר רק את השדות שבסכמה), ובבדיקות של השירות.
