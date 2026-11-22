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
│   └── client/          אפליקציית React + Tailwind, עברית ו-RTL         (שלב 4 - 80%)  ✅
└── packages/
    └── shared-types/    טיפוסי TypeScript משותפים לשרת, ללקוח ולשירות ה-AI      ✅
```

## התקנה והרצה

דרוש Node.js 20 ומעלה. מתוך התיקייה הראשית, פעם אחת:

```powershell
npm install
```

כדי להריץ את כל המערכת, צריך מסד נתונים (ראו `apps/server/README.md`) ושלושה טרמינלים:

```powershell
npm run dev:ai       # שירות ה-AI      - http://localhost:8001
npm run dev:server   # שרת הליבה       - http://localhost:3000/api
npm run dev:client   # האפליקציה       - http://localhost:5173
```

ואז פותחים בדפדפן את **http://localhost:5173**.

| פקודה | מה היא עושה |
|---|---|
| `npm run dev:ai` | מריץ את שירות ה-AI במצב פיתוח (פורט 8001) |
| `npm run dev:server` | מריץ את שרת הליבה במצב פיתוח (פורט 3000; ראו `apps/server/README.md`) |
| `npm run dev:client` | מריץ את אפליקציית ה-React (פורט 5173; ראו `apps/client/README.md`) |
| `npm run lint` | בדיקת קוד (oxlint) |
| `npm test` | מריץ את הבדיקות של כל החבילות |
| `npm run typecheck` | בודק טיפוסים בכל החבילות |
| `npm run build` | בונה את כל החבילות |

## סטטוס

| שלב | חלק | מצב |
|---|---|---|
| 1 | `services/ai_engine` | הושלם: 27 בדיקות עוברות, תוצאות זהות למודל המקורי |
| - | `packages/shared-types` | טיפוסי ה-API של שירות ה-AI ושל שרת הליבה, משותפים לכולם |
| 2 | `apps/server` - מסד נתונים | הושלם: Prisma 7 + PostgreSQL, מיגרציה, Seed |
| 3 | `apps/server` - API | הושלם: JWT + bcrypt + RBAC, חלקות, אבחון עם המלצות ומחירים בעברית, היסטוריה; 79 בדיקות |
| 4 | `apps/client` | הושלם: התחברות/הרשמה, סריקה עם כרטיס תוצאה, חלקות, היסטוריה עם סינון; 47 בדיקות |

כשחבילה חדשה מקבלת `package.json`, מוסיפים אותה לרשימת `workspaces` ב-`package.json` הראשי.
