# CropGuard Server

שרת הליבה של CropGuard: Node.js + TypeScript + Express 5 + Prisma 7 + PostgreSQL.
מקבל תמונת עלה, שולח אותה לשירות ה-AI, מוסיף המלצות טיפול ומחירים בשקלים, ושומר את האבחון.

## הרצה מהירה

דרושים: Node.js 20+, שירות ה-AI רץ (`npm run dev:ai` מהתיקייה הראשית), ומסד PostgreSQL.

```powershell
# 1. מסד נתונים מקומי (פעם אחת; אחר כך: npx prisma dev start cropguard)
npx prisma dev --detach --name cropguard

# 2. מעתיקים את .env.example ל-.env וממלאים DATABASE_URL ו-JWT_SECRET

# 3. טבלאות ונתוני בסיס
npm run db:migrate
npm run db:seed

# 4. השרת
npm run dev
```

השרת עולה ב-`http://localhost:4000`.

## ה-API

כל הנתיבים מלבד הרשמה/התחברות/health דורשים כותרת `Authorization: Bearer <token>`.
הטיפוסים של כל הבקשות והתשובות נמצאים ב-`@cropguard/shared-types` (`src/server.ts`).

| נתיב | מי | מה |
|---|---|---|
| `GET /api/health` | כולם | בדיקה שהשרת חי |
| `POST /api/auth/register` | כולם | הרשמה כ-`FARMER` (ברירת מחדל) או `AGRONOMIST` |
| `POST /api/auth/login` | כולם | התחברות; מחזיר JWT |
| `GET /api/auth/me` | מחובר | פרטי המשתמש |
| `GET /api/fields` | מחובר | חלקות. חקלאי: רק שלו. אגרונום/מנהל: הכול (`?ownerId=` לסינון) |
| `POST /api/fields` | מחובר | יצירת חלקה. רק מנהל יכול ליצור עבור אחר (`ownerId`) |
| `POST /api/diagnose` | מחובר | **הנתיב המרכזי** - טופס multipart: `image` + `fieldId` |
| `GET /api/diagnoses` | מחובר | היסטוריה: `?fieldId=`, `?farmerId=`, `?limit=` (1-100), `?offset=` |

### הרשאות (RBAC)

| | FARMER | AGRONOMIST | ADMIN |
|---|---|---|---|
| הרשמה עצמית | ✓ | ✓ | ✗ (ראו `promote-admin`) |
| חלקות ואבחונים של עצמו | ✓ | ✓ | ✓ |
| חלקות ואבחונים של כל החקלאים | ✗ | ✓ | ✓ |
| אבחון בחלקה של חקלאי אחר | ✗ | ✓ | ✓ |
| יצירת חלקה עבור משתמש אחר | ✗ | ✗ | ✓ |

חלקה של חקלאי אחר מחזירה 404 (ולא 403), כדי לא לחשוף שהיא קיימת.

### דוגמת תשובה של `POST /api/diagnose`

```json
{
  "diagnosis": { "id": "...", "fieldId": "...", "imageUrl": "uploads/....png", "createdAt": "..." },
  "disease": {
    "modelLabel": "Tomato___Late_blight",
    "plantHe": "עגבנייה",
    "nameHe": "כימשון",
    "displayNameHe": "עגבנייה – כימשון",
    "nameEn": "Tomato Late blight",
    "scientificName": "Phytophthora infestans"
  },
  "isHealthy": false,
  "status": "infected",
  "statusHe": "נגוע",
  "confidence": 0.8995,
  "confidencePercent": 89.95,
  "uncertain": false,
  "guidanceHe": "כימשון: לפנות למדריך מיד ולסלק צמחים נגועים; ...",
  "chemicalControl": true,
  "treatments": [
    {
      "activeIngredient": "metalaxyl-m + mancozeb",
      "activeIngredientHe": "מטלקסיל-M + מנקוזב",
      "products": [
        { "productName": "Ridomil Gold MZ", "packageSize": "1 kg", "minPriceILS": 110, "maxPriceILS": 180, "isVerified": false }
      ]
    }
  ],
  "warningsHe": ["המחירים המוצגים הם הערכה בלבד ועדיין לא אומתו מול מחירון ספק."],
  "disclaimerHe": "האבחון מבוסס על מודל בינה מלאכותית ואינו מחליף בדיקה של מדריך הגנת הצומח. ..."
}
```

### שגיאות

כל שגיאה: `{"error": "<קוד>", "detail": "<הסבר>"}`.

| סטטוס | `error` | מתי |
|---|---|---|
| 400 | `bad_request` | JSON פגום, תמונה פגומה (לפי שירות ה-AI) |
| 401 | `unauthorized` | אין טוקן, טוקן לא תקין/פג, אימייל או סיסמה שגויים |
| 403 | `forbidden` | אין הרשאה (למשל הרשמה כ-ADMIN) |
| 404 | `not_found` | חלקה לא קיימת או של חקלאי אחר |
| 409 | `conflict` | אימייל כבר רשום |
| 413 | `payload_too_large` | תמונה גדולה מהמגבלה |
| 415 | `unsupported_media_type` | הקובץ אינו תמונה |
| 422 | `validation_error` | קלט לא תקין (שדה חסר, קואורדינטות מחוץ לטווח...) |
| 429 | `too_many_requests` | יותר מדי ניסיונות התחברות |
| 503 | `ai_unavailable` | שירות ה-AI לא זמין - שום דבר לא נשמר |

## מבנה

| קובץ | תפקיד |
|---|---|
| `src/server.ts` | נקודת הכניסה |
| `src/app.ts` | בניית אפליקציית Express (מקבלת את התלויות מבחוץ - נוח לבדיקות) |
| `src/config.ts` | הגדרות ממשתני סביבה, עם בדיקת תקינות בעלייה |
| `src/errors.ts` | טיפול אחיד בשגיאות |
| `src/auth/` | JWT, bcrypt, middleware לאימות ולהרשאות |
| `src/routes/` | `auth`, `fields`, `diagnose`, `diagnoses` |
| `src/services/aiClient.ts` | לקוח לשירות ה-AI (עם timeout ובדיקת התשובה) |
| `src/services/treatments.ts` | בניית המלצת הטיפול והמחירים מהמסד |
| `src/services/imageStore.ts` | שמירת תמונות (תיקיית `uploads/`) |
| `src/i18n/` | שמות המחלות והחומרים הפעילים בעברית, ושמות מדעיים |
| `src/dto.ts` | המרה משורות המסד לתשובות (בלי שדות פנימיים כמו passwordHash) |
| `prisma/` | סכמה, מיגרציות, seed ונתוני הבסיס |
| `scripts/` | `show-db` (הצגת הנתונים), `promote-admin` (הפיכת משתמש למנהל) |
| `test/` | בדיקות |

## בדיקות

```powershell
npm test
```

78 בדיקות: אימות, חלקות, אבחון, היסטוריה, לקוח ה-AI והמילון העברי.
- **בדיקות האינטגרציה** רצות מול מסד PostgreSQL אמיתי, עם שירות AI מדומה (כדי לבדוק גם תקלות בשירות).
  הן דורשות `TEST_DATABASE_URL` ב-`.env` - **מסד נפרד**, כי הבדיקות מוחקות בו נתונים:
  ```powershell
  npx prisma dev --detach --name cropguard-test --port 51230 --db-port 51231 --shadow-db-port 51232
  ```
  בלי `TEST_DATABASE_URL` הן מדולגות, ובדיקות היחידה עדיין רצות.
- **לקוח ה-AI** נבדק מול שרת HTTP מקומי שמחקה את השירות.

## פקודות

| פקודה | מה היא עושה |
|---|---|
| `npm run dev` | השרת במצב פיתוח (טעינה מחדש אוטומטית) |
| `npm run build` / `npm start` | בנייה והרצה לייצור |
| `npm test` | כל הבדיקות |
| `npm run typecheck` | בדיקת טיפוסים |
| `npm run db:migrate` | מיגרציה מהשינויים בסכמה |
| `npm run db:seed` | טעינת מחירים והמלצות (בטוח להריץ שוב) |
| `npm run db:show` | הצגת תוכן הטבלאות בטרמינל |
| `npm run promote-admin -- <email>` | הפיכת משתמש רשום למנהל |
| `npm run prisma:generate` | בניית הקליינט מחדש אחרי שינוי בסכמה |

### מסד נתונים מקומי עם `prisma dev`

```powershell
npx prisma dev ls                  # מצב השרתים והכתובות
npx prisma dev stop cropguard      # עצירה (הנתונים נשמרים)
npx prisma dev start cropguard     # הפעלה מחדש
```

> Prisma Studio (`npm run db:studio`) לא מצליח לקרוא את המסד של `prisma dev` בגרסה הזו
> (שגיאת PostgreSQL `26000`). עם PostgreSQL רגיל הוא עובד; עם `prisma dev` משתמשים ב-`npm run db:show`.

## ⚠️ לפני שימוש אמיתי

- **המחירים ב-`prisma/data/productPrices.ts` הם ערכי דוגמה, לא מחירון אמיתי.** כולם `isVerified: false`,
  והתשובה של `/api/diagnose` מצרפת אזהרה בעברית. יש להחליף במחירון עדכני.
- **החומרים הפעילים הם מידע כללי משירותי הדרכה, לא המלצת ריסוס.** יש לוודא רישום בישראל לכל גידול ומחלה.
- **התמונות נשמרות בדיסק (`uploads/`) ואין עדיין נתיב להצגתן.** לייצור כדאי אחסון ענן ונתיב מאובטח.
