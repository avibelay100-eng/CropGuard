# @cropguard/shared-types

טיפוסי TypeScript שמשותפים לכל חלקי CropGuard, כדי שהשרת, הלקוח ושירות ה-AI
ידברו באותה "שפה". שינוי בטיפוס כאן מתגלה מיד בבדיקת הטיפוסים של כל מי שמשתמש בו.

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

הקוד נמצא ב-`src/aiEngine.ts`.

## שימוש בחבילה אחרת בפרויקט

1. מוסיפים תלות ב-`package.json` של החבילה (למשל `apps/server`):

   ```json
   "dependencies": {
     "@cropguard/shared-types": "*"
   }
   ```

2. מריצים `npm install` מהתיקייה הראשית.

3. מייבאים עם **`import type`**:

   ```ts
   import type { PredictionResponse } from "@cropguard/shared-types";

   const response = await fetch("http://localhost:8001/predict", { method: "POST", body: form });
   const result: PredictionResponse = await response.json();
   ```

החבילה מכילה **טיפוסים בלבד**, בלי קוד שרץ, ולכן אין לה שלב build:
הטיפוסים נמחקים בקומפילציה, ו-`import type` מבטיח שלא תישאר בקוד הסופי שום תלות בחבילה.

## שינוי טיפוס של שירות ה-AI

כל שינוי ב-`src/aiEngine.ts` מחייב שינוי תואם בסכמות ה-JSON שב-
`services/ai_engine/src/schemas.ts`. אם השדות לא תואמים, `npm run typecheck`
נכשל ומצביע על המקום.
