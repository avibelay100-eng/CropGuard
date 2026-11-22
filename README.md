# CropGuard

פלטפורמה לזיהוי מחלות בעלי צמחים מתוך תמונה.
כל הפרויקט כתוב ב-TypeScript ומנוהל כ-monorepo עם npm workspaces.

## מבנה

```
CropGuard/
├── services/
│   └── ai_engine/       שירות ה-AI: מקבל תמונה ומחזיר מחלה + ודאות   (שלב 1 - 15%)  ✅
├── apps/
│   ├── server/          שרת הליבה: Node.js + Prisma + PostgreSQL     (שלב 2 - 30%)  🚧
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
| `npm run dev:ai` | מריץ את שירות ה-AI במצב פיתוח |
| `npm test` | מריץ את הבדיקות של כל החבילות |
| `npm run typecheck` | בודק טיפוסים בכל החבילות |
| `npm run build` | בונה את כל החבילות |

## סטטוס

| שלב | חלק | מצב |
|---|---|---|
| 1 | `services/ai_engine` | הושלם: 27 בדיקות עוברות, תוצאות זהות למודל המקורי |
| - | `packages/shared-types` | טיפוסי ה-API של שירות ה-AI זמינים לשרת וללקוח |
| 2 | `apps/server` | בתהליך: בסיס נתונים מוכן (Prisma: סכמה, מיגרציה, Seed); ה-API עוד לא נבנה |
| - | `apps/client` | טרם התחיל |

כשחבילה חדשה מקבלת `package.json`, מוסיפים אותה לרשימת `workspaces` ב-`package.json` הראשי.
