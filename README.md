# CropGuard

פלטפורמה לזיהוי מחלות בעלי צמחים מתוך תמונה.
כל הפרויקט כתוב ב-TypeScript ומנוהל כ-monorepo עם npm workspaces.

## מבנה

```
CropGuard/
├── services/
│   └── ai_engine/       שירות ה-AI: מקבל תמונה ומחזיר מחלה + ודאות   (שלב 1 - 15%)  ✅
├── apps/
│   ├── server/          שרת הליבה: Express + Prisma + PostgreSQL      (שלבים 2-3 - 50%) ✅
│   └── client/          ממשק המשתמש: React
└── packages/
    └── shared-types/    טיפוסי TypeScript משותפים לשרת, ללקוח ולשירות ה-AI      ✅
```

## התקנה והרצה

דרוש Node.js 20 ומעלה. מתוך התיקייה הראשית:

```powershell
npm install
npm run dev:ai
```

שירות ה-AI עולה ב-`http://localhost:8001`. שם יש דף בדיקה בעברית להעלאת תמונה,
ותיעוד ה-API נמצא ב-`http://localhost:8001/docs`.

| פקודה | מה היא עושה |
|---|---|
| `npm run dev:ai` | מריץ את שירות ה-AI במצב פיתוח (פורט 8001) |
| `npm run dev:server` | מריץ את שרת הליבה במצב פיתוח (פורט 4000; ראו `apps/server/README.md`) |
| `npm test` | מריץ את הבדיקות של כל החבילות |
| `npm run typecheck` | בודק טיפוסים בכל החבילות |
| `npm run build` | בונה את כל החבילות |

## סטטוס

| שלב | חלק | מצב |
|---|---|---|
| 1 | `services/ai_engine` | הושלם: 27 בדיקות עוברות, תוצאות זהות למודל המקורי |
| - | `packages/shared-types` | טיפוסי ה-API של שירות ה-AI זמינים לשרת וללקוח |
| 2 | `apps/server` - מסד נתונים | הושלם: Prisma 7 + PostgreSQL, מיגרציה, Seed |
| 3 | `apps/server` - API | הושלם: JWT + bcrypt + RBAC, חלקות, אבחון עם המלצות ומחירים בעברית, היסטוריה; 78 בדיקות |
| - | `apps/client` | טרם התחיל |

כשחבילה חדשה מקבלת `package.json`, מוסיפים אותה לרשימת `workspaces` ב-`package.json` הראשי.
