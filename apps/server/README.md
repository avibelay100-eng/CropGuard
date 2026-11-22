# CropGuard Server

שרת הליבה של CropGuard: Node.js + TypeScript + Prisma 7 + PostgreSQL (שלב 2 - 30%).

**סטטוס:** בסיס הנתונים מוכן (סכמה, מיגרציה ראשונה, Seed). שכבת ה-API עוד לא נבנתה.

## מבנה

| קובץ | תפקיד |
|---|---|
| `prisma/schema.prisma` | הגדרת הטבלאות |
| `prisma/migrations/` | סקריפטי SQL שיוצרים את הטבלאות (נוצרים ע"י `db:migrate`) |
| `prisma/seed.ts` | טוען את מילון המחירים ואת ההמלצות למסד הנתונים |
| `prisma/data/treatments.ts` | חומרים פעילים מומלצים לכל אחת מ-26 המחלות |
| `prisma/data/productPrices.ts` | מילון המחירים: מוצר מסחרי וטווח מחירים בשקלים לכל חומר פעיל |
| `prisma.config.ts` | הגדרות Prisma 7 (כתובת מסד הנתונים, פקודת ה-seed) |
| `src/db.ts` | יצירת חיבור למסד (`createPrismaClient`) |
| `src/generated/prisma/` | הקליינט ש-Prisma מייצר (לא נכנס ל-git, נוצר ב-`npm install`) |
| `test/seedData.test.ts` | בדיקות עקביות של נתוני ה-seed |

## הטבלאות

| מודל | שדות עיקריים |
|---|---|
| `User` | אימייל, שם, גיבוב סיסמה, תפקיד: `FARMER` / `AGRONOMIST` / `ADMIN` |
| `Field` | שם החלקה, סוג גידול, `latitude` / `longitude`, בעלים (User) |
| `Diagnosis` | חלקה, תמונת עלה, תווית ושם המחלה, ודאות (0..1), בריא/נגוע, חומר פעיל |
| `ProductPriceRange` | חומר פעיל, מוצר מסחרי, גודל אריזה, `minPriceILS` / `maxPriceILS`, האם המחיר אומת |
| `TreatmentRecommendation` | תווית מחלה, רשימת חומרים פעילים, האם יש טיפול כימי, הנחיה בעברית |

מחיקת משתמש מוחקת גם את החלקות שלו, ומחיקת חלקה מוחקת את האבחונים שלה.

## הרצה

1. **מסד נתונים PostgreSQL.** אחת מהאפשרויות:
   - **הכי פשוט לפיתוח:** `npx prisma dev` (מתוך `apps/server`) מריץ Postgres מקומי בלי התקנה,
     ומדפיס כתובת `postgres://...`.
   - התקנת PostgreSQL במחשב, או שירות ענן חינמי (Neon, Supabase, Prisma Postgres).

2. **הגדרת הכתובת:** מעתיקים את `.env.example` ל-`.env` ושמים ב-`DATABASE_URL` את הכתובת.

3. **יצירת הטבלאות וטעינת הנתונים:**

   ```powershell
   npm run db:migrate
   npm run db:seed
   ```

4. **צפייה בנתונים:** `npm run db:studio` פותח ממשק גרפי בדפדפן.

## פקודות

| פקודה | מה היא עושה |
|---|---|
| `npm run prisma:generate` | בונה מחדש את הקליינט אחרי שינוי בסכמה |
| `npm run db:migrate` | יוצר מיגרציה מהשינויים בסכמה ומחיל אותה |
| `npm run db:seed` | טוען מחירים והמלצות (אפשר להריץ שוב בבטחה) |
| `npm run db:studio` | ממשק גרפי לנתונים |
| `npm test` | בדיקות נתוני ה-seed (לא צריך מסד נתונים) |
| `npm run typecheck` | בדיקת טיפוסים |

## ⚠️ לפני שימוש אמיתי

- **המחירים ב-`productPrices.ts` הם ערכי דוגמה, לא מחירון אמיתי.** כולם מסומנים
  `isVerified: false`. יש להחליף אותם במחירון עדכני ולסמן `isVerified: true` עם מקור.
- **החומרים הפעילים הם מידע כללי משירותי הדרכה, לא המלצת ריסוס.** לפני הצגה למשתמשים
  יש לוודא שכל תכשיר רשום בישראל לגידול ולמחלה, ולהציג תמיד את ההנחיה להתייעץ עם מדריך.
