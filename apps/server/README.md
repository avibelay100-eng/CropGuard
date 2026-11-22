# CropGuard Server

שרת הליבה של CropGuard: Node.js (JavaScript) + Express 5 + Prisma 7 + PostgreSQL.
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

השרת עולה ב-`http://localhost:3000` (ה-API ב-`/api`). אפליקציית ה-React ב-`apps/client` מתחברת אליו.

## ה-API

כל הנתיבים מלבד הרשמה/התחברות/health דורשים כותרת `Authorization: Bearer <token>`.
הטיפוסים של כל הבקשות והתשובות נמצאים ב-`@cropguard/shared-types` (`src/server.js`).

| נתיב | מי | מה |
|---|---|---|
| `GET /api/health` | כולם | בדיקה שהשרת חי |
| `POST /api/auth/register` | כולם | הרשמה כ-`FARMER` (ברירת מחדל) או `AGRONOMIST` |
| `POST /api/auth/login` | כולם | התחברות; מחזיר JWT |
| `GET /api/auth/me` | מחובר | פרטי המשתמש |
| `PATCH /api/auth/me` | מחובר | הוספה/שינוי/הסרה של טלפון לשחזור סיסמה (`{"phone": "050-1234567"}` או `null`) |
| `POST /api/auth/password-reset/request` | כולם | שליחת קוד בן 6 ספרות ב-SMS לטלפון של החשבון (תשובה זהה תמיד) |
| `POST /api/auth/password-reset/confirm` | כולם | קוד + סיסמה חדשה; מבטל את כל הטוקנים הישנים |
| `GET /api/fields` | מחובר | חלקות. חקלאי: רק שלו. אגרונום/מנהל: הכול (`?ownerId=` לסינון) |
| `POST /api/fields` | מחובר | יצירת חלקה. רק מנהל יכול ליצור עבור אחר (`ownerId`). פרטים לא חובה: `areaDunams`, `cultivationMethod`, `irrigationMethod`, `variety`, `plantingDate`, `expectedHarvestDate`, `notes` |
| `GET /api/fields/:id` | מחובר | חלקה אחת (חקלאי אחר מקבל 404) |
| `PATCH /api/fields/:id` | בעלים/מנהל | עריכה - רק השדות שנשלחו; `null` מוחק פרט (אגרונום: 403) |
| `DELETE /api/fields/:id` | בעלים/מנהל | מחיקה, כולל כל האבחונים (והתמונות) ויומן השדה |
| `GET /api/fields/:id/logs` | מחובר | ★ יומן השדה: רשומות, החלקה (כולל `harvestBlockedUntil`) ו-`today` בישראל |
| `POST /api/fields/:id/logs` | בעלים/מנהל | ריסוס/דישון/השקיה. בריסוס `phiDays` חובה, ו-`safeHarvestDate` מחושב בשרת |
| `DELETE /api/fields/:id/logs/:logId` | בעלים/מנהל | מחיקת רשומה ביומן |
| `POST /api/diagnose` | מחובר | **הנתיב המרכזי** - טופס multipart: `image` + `fieldId`. כולל בדיקת התאמה לגידול של החלקה |
| `GET /api/diagnoses` | מחובר | היסטוריה: `?fieldId=`, `?farmerId=`, `?status=healthy\|infected`, `?limit=` (1-100), `?offset=` |
| `DELETE /api/diagnoses/:id` | בעל החלקה / מנהל | מחיקת אבחון (והתמונה שלו). אגרונום לא מוחק נתונים של חקלאי (403) |
| `GET /api/library` | מחובר | ספריית 38 המצבים: סוג גורם, תסמינים ומניעה בעברית, המלצות ומחירים |
| `GET /api/news` | מחובר | חדשות חקלאות ומדע מ-4 מקורות RSS (2 בעברית), עם מטמון של 30 דקות (`?lang=he\|en`) |

### בדיקת התאמה לגידול (cropCheck)

המודל מכיר רק 38 מצבים ב-14 גידולים, **ותמיד בוחר אחד מהם** - גם כשמצלמים צמח אחר (למשל כרוב),
ולפעמים בביטחון גבוה. לכן השרת מבקש מה-AI את כל 38 ההסתברויות (`?top_k=38`) ומשווה לגידול של החלקה:

- **אם הצמח שזוהה תואם** - תשובה רגילה.
- **אם לא** - אזהרה בעברית, האפשרויות הסבירות בתוך הגידול של החלקה, `uncertain: true`,
  **בלי המלצות ריסוס** (כדי לא להמליץ על תכשיר לגידול הלא נכון), והאבחון נשמר עם `cropMismatch: true`.

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
| 409 | `conflict` | אימייל או טלפון כבר רשומים |
| 400 | `invalid_code` | קוד שחזור שגוי, פג תוקף, משומש, או אחרי 5 ניסיונות |
| 413 | `payload_too_large` | תמונה גדולה מהמגבלה |
| 415 | `unsupported_media_type` | הקובץ אינו תמונה |
| 422 | `validation_error` | קלט לא תקין (שדה חסר, קואורדינטות מחוץ לטווח...) |
| 429 | `too_many_requests` | יותר מדי ניסיונות התחברות |
| 503 | `ai_unavailable` | שירות ה-AI לא זמין - שום דבר לא נשמר |

## מבנה

| קובץ | תפקיד |
|---|---|
| `src/server.js` | נקודת הכניסה |
| `src/app.js` | בניית אפליקציית Express (מקבלת את התלויות מבחוץ - נוח לבדיקות) |
| `src/config.js` | הגדרות ממשתני סביבה, עם בדיקת תקינות בעלייה |
| `src/errors.js` | טיפול אחיד בשגיאות |
| `src/auth/` | JWT, bcrypt, middleware לאימות ולהרשאות |
| `src/routes/` | `auth`, `fields`, `fieldLogs` (יומן שדה), `diagnose`, `diagnoses`, `library`, `news` |
| `src/services/phi.js` | ★ חישובי PHI: "היום" לפי לוח השנה בישראל, תאריך הריסוס + ימי ההמתנה |
| `src/services/aiClient.js` | לקוח לשירות ה-AI (עם timeout ובדיקת התשובה) |
| `src/services/treatments.js` | בניית המלצת הטיפול והמחירים מהמסד |
| `src/services/imageStore.js` | שמירת תמונות (תיקיית `uploads/`) |
| `src/i18n/` | שמות המחלות והחומרים הפעילים בעברית, ושמות מדעיים |
| `src/dto.js` | המרה משורות המסד לתשובות (בלי שדות פנימיים כמו passwordHash) |
| `prisma/` | סכמה, מיגרציות, seed ונתוני הבסיס |
| `scripts/` | `show-db` (הצגת הנתונים), `promote-admin` (הפיכת משתמש למנהל) |
| `test/` | בדיקות |

## בדיקות

```powershell
npm test
```

133 בדיקות: אימות, טלפון ושחזור סיסמה, חלקות, אבחון (כולל בדיקת התאמה לגידול), היסטוריה ומחיקה,
ספריית המחלות, חדשות, לקוח ה-AI והמילון העברי.
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
| `npm start` | הרצה לייצור (דרך tsx - ראו הערה למטה) |
| `npm test` | כל הבדיקות |
| `npm run lint` | בדיקת קוד (oxlint) |
| `npm run db:migrate` | מיגרציה מהשינויים בסכמה |
| `npm run db:seed` | טעינת מחירים והמלצות (בטוח להריץ שוב) |
| `npm run db:show` | הצגת תוכן הטבלאות בטרמינל |
| `npm run promote-admin -- <email>` | הפיכת משתמש רשום למנהל |
| `npm run prisma:generate` | בניית הקליינט מחדש אחרי שינוי בסכמה |

> **למה השרת רץ דרך `tsx` אם הקוד ב-JavaScript?** כל הקוד שלנו הוא JavaScript, אבל Prisma 7 מייצר
> את הקליינט (`src/generated/prisma`, לא נשמר ב-git) כקובצי TypeScript בלבד. `tsx` יודע לטעון אותם
> מתוך קוד JavaScript, ולכן גם `npm run dev` וגם `npm start` רצים דרכו. שירות ה-AI והלקוח לא צריכים אותו.

### מסד נתונים מקומי עם `prisma dev`

```powershell
npx prisma dev ls                  # מצב השרתים והכתובות
npx prisma dev stop cropguard      # עצירה (הנתונים נשמרים)
npx prisma dev start cropguard     # הפעלה מחדש
```

> Prisma Studio (`npm run db:studio`) לא מצליח לקרוא את המסד של `prisma dev` בגרסה הזו
> (שגיאת PostgreSQL `26000`). עם PostgreSQL רגיל הוא עובד; עם `prisma dev` משתמשים ב-`npm run db:show`.

## שחזור סיסמה ב-SMS

- הקוד: 6 ספרות אקראיות (`crypto.randomInt`), תוקף 10 דקות, חד-פעמי, עד 5 ניסיונות. נשמר רק כ-HMAC עם הסוד של השרת.
- התשובה לבקשת קוד זהה תמיד - גם למספר לא רשום - כדי שאי אפשר לגלות אילו מספרים רשומים.
- קוד חדש לכל היותר פעם בדקה לאותו משתמש; כל הקודים הקודמים נפסלים.
- אחרי שינוי סיסמה, טוקנים שהונפקו לפני כן נדחים (`passwordChangedAt`).
- **שליחה:** `SMS_PROVIDER=console` (ברירת מחדל, פיתוח) מדפיס את ההודעה בטרמינל של השרת.
  לשליחה אמיתית: `SMS_PROVIDER=twilio` עם `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` (דורש חשבון Twilio).

## חיבור לאינטרנט מאחורי אנטי-וירוס

שירותי אנטי-וירוס (Avast וכו') סורקים HTTPS וחותמים מחדש בתעודה משלהם, ש-Node לא מכיר.
`src/systemCertificates.js` מוסיף לאמון של Node את התעודות ש-Windows כבר סומך עליהן - בלי לבטל בדיקת תעודות.

## ⚠️ לפני שימוש אמיתי

- **המחירים ב-`prisma/data/productPrices.js` הם ערכי דוגמה, לא מחירון אמיתי.** כולם `isVerified: false`,
  והתשובה של `/api/diagnose` מצרפת אזהרה בעברית. יש להחליף במחירון עדכני.
- **החומרים הפעילים הם מידע כללי משירותי הדרכה, לא המלצת ריסוס.** יש לוודא רישום בישראל לכל גידול ומחלה.
- **התמונות נשמרות בדיסק (`uploads/`) ואין עדיין נתיב להצגתן.** לייצור כדאי אחסון ענן ונתיב מאובטח.
