/**
 * פס קבוע בראש גרסת ההדגמה: אומר במפורש שזו הדגמה (בלי שרת ובלי AI אמיתי),
 * מאפשר לאפס את הנתונים, ומקשר לקוד ב-GitHub.
 */

/** @param {{ onReset: () => void }} props */
export function DemoBanner({ onReset }) {
  return (
    <aside aria-label="גרסת הדגמה" className="border-b-2 border-straw bg-straw-soft px-4 py-2 text-sm text-straw-ink">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <p>
          <strong>גרסת הדגמה</strong> - הנתונים לדוגמה ונשמרים רק בדפדפן שלך. אין כאן מודל AI אמיתי: הסריקה בוחרת תוצאה מתוך
          ספריית המחלות.
        </p>
        <p className="flex shrink-0 gap-4">
          <button type="button" onClick={onReset} className="cursor-pointer font-semibold underline underline-offset-4">
            איפוס ההדגמה
          </button>
          <a
            href="https://github.com/avibelay100-eng/CropGuard"
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold underline underline-offset-4"
          >
            הקוד ב-GitHub
          </a>
        </p>
      </div>
    </aside>
  );
}
