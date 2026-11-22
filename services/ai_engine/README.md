# CropGuard AI Engine

שירות REST שמקבל תמונה של עלה ומחזיר את המחלה, אחוז הוודאות והאם העלה בריא או נגוע.
כתוב ב-**TypeScript** (Node.js + Fastify) ומריץ את המודל עם **ONNX Runtime**.
המודל מזהה 38 מחלקות (26 מחלות ו-12 מצבי "בריא") ב-14 סוגי צמחים.

## מבנה התיקייה

| קובץ | תפקיד |
|---|---|
| `src/server.ts` | נקודת הכניסה: מעלה את השרת ומאזין לפורט |
| `src/app.ts` | בניית האפליקציה: טעינה בעלייה, נקודות קצה, טיפול בשגיאות, לוגים |
| `src/modelLoader.ts` | טעינת מודל ה-ONNX, בדיקתו והרצת תחזית |
| `src/imageProcessing.ts` | פענוח התמונה, המרה ל-RGB ושינוי גודל ל-224x224 |
| `src/labels.ts` | טעינת `labels-38.txt`, שמות קריאים וזיהוי "בריא" |
| `src/schemas.ts` | סכמות ה-JSON לסריאליזציה ולתיעוד. הטיפוסים עצמם נמצאים ב-`packages/shared-types` |
| `src/config.ts` | הגדרות ממשתני סביבה `AI_ENGINE_*` |
| `public/index.html` | דף בדיקה בעברית שמוגש בכתובת `/` |
| `test/` | בדיקות (Vitest) שרצות מול המודל האמיתי |
| `model/cropora_model.onnx` | המודל שהשירות מריץ |
| `model/cropora_model.keras` | המודל המקורי (מקור ההמרה) |
| `model/labels-38.txt` | 38 התוויות, לפי סדר הפלט של המודל |
| `tools/convert_to_onnx.py` | המרה חד-פעמית מ-Keras ל-ONNX (הקובץ היחיד ב-Python) |

## הרצה

דרוש Node.js 20 ומעלה. מתוך התיקייה `services/ai_engine`:

```powershell
npm install
npm run dev
```

השרת עולה בכתובת `http://localhost:8001`. ממתינים לשורה `CropGuard AI Engine ready` בלוג, ואז:

- **`http://localhost:8001/`** - דף בדיקה בעברית: בוחרים תמונה של עלה, לוחצים "בדיקת העלה"
  ורואים את שם המחלה, אחוז הוודאות והאם העלה בריא או נגוע.
- **`http://localhost:8001/docs`** - תיעוד ה-API למפתחים (Swagger).

לייצור:

```powershell
npm run build
npm start
```

## בדיקות

```powershell
npm test
npm run typecheck
```

הבדיקות משוות את התוצאות לערכי ייחוס שהופקו מהמודל המקורי ב-Keras על אותן תמונות.

## ה-API

### `GET /health`

```json
{ "service": "CropGuard AI Engine", "version": "0.1.0", "status": "ok",
  "model_loaded": true, "class_count": 38, "detail": null }
```

אם המודל לא נטען: `"status": "degraded"`, ו-`detail` מסביר למה.

### `POST /predict`

טופס `multipart/form-data` עם קובץ בשדה בשם **`image`** (JPEG, PNG, WebP ועוד).

```powershell
curl.exe -F "image=@leaf.jpg" http://localhost:8001/predict
```

```json
{
  "disease": "Tomato Late blight",
  "model_label": "Tomato___Late_blight",
  "plant": "Tomato",
  "is_healthy": false,
  "status": "infected",
  "confidence": 0.8995,
  "confidence_percent": 89.95,
  "uncertain": false,
  "top_predictions": [
    { "model_label": "Tomato___Late_blight", "disease": "Tomato Late blight", "confidence": 0.8995 },
    { "model_label": "Corn___Common_rust", "disease": "Corn Common rust", "confidence": 0.0918 },
    { "model_label": "Tomato___Healthy", "disease": "Tomato Healthy", "confidence": 0.0087 }
  ]
}
```

### שגיאות

כל שגיאה חוזרת בפורמט `{"error": "<קוד>", "detail": "<הסבר>"}`:

| סטטוס | `error` | מתי |
|---|---|---|
| 400 | `bad_request` | תמונה ריקה או פגומה |
| 413 | `payload_too_large` | קובץ גדול מהמגבלה (10MB) |
| 415 | `unsupported_media_type` | הקובץ אינו תמונה, או שהבקשה אינה multipart |
| 422 | `validation_error` | אין קובץ בשדה `image` |
| 500 | `internal_error` | התחזית נכשלה או החזירה תוצאה לא תקינה |
| 503 | `model_unavailable` | המודל לא נטען בעליית השרת (פרטים ב-`/health`) |

## הגדרות (משתני סביבה)

| משתנה | ברירת מחדל |
|---|---|
| `AI_ENGINE_PORT` | `8001` |
| `AI_ENGINE_HOST` | `0.0.0.0` |
| `AI_ENGINE_MODEL_PATH` | `model/cropora_model.onnx` |
| `AI_ENGINE_LABELS_PATH` | `model/labels-38.txt` |
| `AI_ENGINE_MAX_UPLOAD_BYTES` | `10485760` (10MB) |
| `AI_ENGINE_CONFIDENCE_THRESHOLD` | `0.5` (מתחת לזה `uncertain` יהיה true) |
| `AI_ENGINE_TOP_K` | `3` |
| `AI_ENGINE_LOG_LEVEL` | `info` |

## פרטים חשובים על המודל

- **לא מחלקים ב-255.** השירות שולח למודל ערכי RGB גולמיים 0..255, כי המודל מנרמל
  בעצמו ל-[-1, 1] בתוך הגרף שלו. חלוקה נוספת תיתן תוצאות שגויות.
- **ההמרה ל-ONNX נבדקה.** הסטייה מול Keras היא 1e-7 לכל היותר, עם אותה תחזית מובילה.
- **המרה מחדש** (רק אם המודל המקורי משתנה). דרושה סביבת Python עם גרסה יציבה של Keras:

  ```powershell
  pip install tensorflow tf2onnx onnx onnxruntime "keras<3.16"
  python tools/convert_to_onnx.py
  ```

  בגרסת הפיתוח 3.16.0.dev של Keras, שכבות האוגמנטציה פעלו גם בזמן תחזית,
  והתוצאות השתנו מהרצה להרצה. לכן הסקריפט מנטרל אותן לפני ההמרה.
