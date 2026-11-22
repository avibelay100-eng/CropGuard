/**
 * ספריית מחלות ומזיקים: כל 38 המצבים שהמודל מזהה, ככרטיסיות.
 * סינון לפי חיפוש חופשי, גידול וסוג הגורם; לחיצה על כרטיס פותחת חלון עם
 * תסמינים, מניעה, הנחיית טיפול ומחירי תכשירים בשקלים.
 */

import type { LibraryEntry, PathogenType } from "@cropguard/shared-types";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { api, errorMessageHe } from "../api/client";
import { Treatments } from "../components/DiagnosisResult";
import { Notice, PageHeader, SelectField, Spinner, TextField } from "../components/ui";
import { CROPS, cropLabelHe } from "../lib/crops";

/** סדר הסוגים בסינון, והצבע של כל סוג (תמיד לצד טקסט - לא צבע בלבד) */
const PATHOGEN_TYPES: ReadonlyArray<{ value: PathogenType; label: string; color: string; border: string }> = [
  { value: "fungus", label: "פטרייה", color: "bg-soil", border: "border-s-soil" },
  { value: "oomycete", label: "פטרייה מדומה", color: "bg-blight", border: "border-s-blight" },
  { value: "bacterium", label: "חיידק", color: "bg-straw", border: "border-s-straw" },
  { value: "virus", label: "וירוס", color: "bg-ink", border: "border-s-ink" },
  { value: "pest", label: "מזיק", color: "bg-[#7a4fa0]", border: "border-s-[#7a4fa0]" },
  { value: "healthy", label: "בריא", color: "bg-leaf", border: "border-s-leaf" },
];

const typeStyle = (type: PathogenType) => PATHOGEN_TYPES.find((t) => t.value === type);
const typeColor = (type: PathogenType) => typeStyle(type)?.color ?? "bg-line";

/** ★ התאמה לשוק הישראלי: ספריית 38 המצבים - חיפוש בעברית/אנגלית/לטינית, סינון לפי גידול וסוג גורם (כולל אואומיצט) */
export function LibraryPage() {
  const [entries, setEntries] = useState<LibraryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [crop, setCrop] = useState("");
  const [type, setType] = useState<PathogenType | "">("");
  const [open, setOpen] = useState<LibraryEntry | null>(null);

  useEffect(() => {
    api
      .getLibrary()
      .then(({ entries: list }) => setEntries(list))
      .catch((err: unknown) => setError(errorMessageHe(err)));
  }, []);

  const filtered = useMemo(() => {
    if (!entries) return [];
    const text = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (crop && entry.plant !== crop) return false;
      if (type && entry.pathogenType !== type) return false;
      if (!text) return true;
      // חיפוש בעברית, באנגלית ובשם המדעי
      return [entry.disease.displayNameHe, entry.disease.nameEn, entry.disease.scientificName ?? ""]
        .some((name) => name.toLowerCase().includes(text));
    });
  }, [entries, query, crop, type]);

  return (
    <>
      <PageHeader title="ספריית מחלות ומזיקים">
        כל 38 המצבים שהמודל מזהה: תסמינים, מניעה, וחומרים פעילים מקובלים עם טווחי מחירים.
      </PageHeader>

      <div className="mb-4 grid gap-4 sm:grid-cols-2">
        <TextField
          label="חיפוש"
          type="search"
          placeholder="למשל: כימשון, rust, Phytophthora"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <SelectField label="גידול" value={crop} onChange={(e) => setCrop(e.target.value)}>
          <option value="">כל הגידולים</option>
          {CROPS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.labelHe}
            </option>
          ))}
        </SelectField>
      </div>

      <fieldset className="mb-6">
        <legend className="mb-1.5 font-medium">סוג הגורם</legend>
        <div className="flex flex-wrap gap-2">
          {[{ value: "" as const, label: "הכול", color: "" }, ...PATHOGEN_TYPES].map((option) => (
            <label
              key={option.value || "all"}
              className={`flex cursor-pointer items-center gap-2 border-[1.5px] px-3 py-1.5 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-straw ${
                type === option.value ? "border-ink bg-ink text-white" : "border-line bg-white text-ink hover:border-ink"
              }`}
            >
              <input
                type="radio"
                name="pathogen-type"
                value={option.value}
                checked={type === option.value}
                onChange={() => setType(option.value)}
                className="sr-only"
              />
              {option.color && <span className={`size-2.5 rounded-full ${option.color}`} aria-hidden="true" />}
              {option.label}
            </label>
          ))}
        </div>
      </fieldset>

      {error && <Notice>{error}</Notice>}
      {!entries && !error && <Spinner label="טוען את הספרייה…" />}

      {entries && (
        <>
          <p className="mb-3 text-sm text-soil" aria-live="polite">
            {filtered.length === entries.length ? `${entries.length} מצבים` : `נמצאו ${filtered.length} מתוך ${entries.length}`}
          </p>
          {filtered.length === 0 ? (
            <div className="border-s-4 border-line bg-white p-6">
              <p>אין מצב שמתאים לחיפוש הזה. נסו לנקות את הסינון.</p>
            </div>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="מחלות ומזיקים">
              {filtered.map((entry) => (
                <li key={entry.disease.modelLabel}>
                  <LibraryCard entry={entry} onOpen={() => setOpen(entry)} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <LibraryDialog entry={open} onClose={() => setOpen(null)} />
    </>
  );
}

/** כרטיס בספרייה: כפתור שפותח חלון פרטים; סוג הגורם מוצג גם בצבע וגם בטקסט */
function LibraryCard({ entry, onOpen }: { entry: LibraryEntry; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-haspopup="dialog"
      className={`flex h-full w-full cursor-pointer flex-col border border-s-4 border-line bg-white p-4 text-start hover:border-ink ${
        typeStyle(entry.pathogenType)?.border ?? ""
      }`}
    >
      <span className="flex items-center justify-between gap-2 text-sm text-soil">
        <span>{entry.disease.plantHe}</span>
        <span className="flex items-center gap-1.5">
          <span className={`size-2.5 rounded-full ${typeColor(entry.pathogenType)}`} aria-hidden="true" />
          {entry.pathogenTypeHe}
        </span>
      </span>
      {/* בכרטיסי "בריא" השם המלא ("תפוח – בריא"), אחרת 12 כרטיסים נראים זהים */}
      <span className="mt-1 font-display text-xl leading-snug font-bold">
        {entry.pathogenType === "healthy" ? entry.disease.displayNameHe : entry.disease.nameHe}
      </span>
      {entry.disease.scientificName && (
        <span dir="ltr" lang="la" className="mt-1 text-end font-latin text-sm text-soil italic">
          {entry.disease.scientificName}
        </span>
      )}
    </button>
  );
}

/** חלון פרטים - <dialog> מובנה: מלכודת מיקוד, סגירה ב-Esc והחזרת המיקוד לכרטיס */
function LibraryDialog({ entry, onClose }: { entry: LibraryEntry | null; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (entry && !element.open) element.showModal();
    if (!entry && element.open) element.close();
  }, [entry]);

  return (
    // לחיצה על הרקע היא תוספת לעכבר; במקלדת סוגרים ב-Esc (מובנה ב-dialog) או בכפתור "סגירה"
    // oxlint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-noninteractive-element-interactions
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(event) => {
        // לחיצה על הרקע (מחוץ לתוכן) סוגרת
        if (event.target === dialog.current) dialog.current?.close();
      }}
      className="m-auto max-h-[90dvh] w-[min(42rem,calc(100vw-2rem))] overflow-y-auto border-2 border-ink bg-white p-0 text-ink backdrop:bg-ink/50"
    >
      {entry && (
        <div className="flex flex-col gap-5 p-5 sm:p-7">
          <header className="flex items-start justify-between gap-4">
            <div>
              <p className="text-soil">
                {cropLabelHe(entry.plant)}
                <span className="ms-3 inline-flex items-center gap-1.5">
                  <span className={`size-2.5 rounded-full ${typeColor(entry.pathogenType)}`} aria-hidden="true" />
                  {entry.pathogenTypeHe}
                </span>
              </p>
              <h2 id={titleId} className="font-display text-3xl font-bold">
                {entry.disease.nameHe}
              </h2>
              <p dir="ltr" className="text-end">
                {entry.disease.nameEn}
              </p>
              {entry.disease.scientificName && (
                <p dir="ltr" lang="la" className="text-end font-latin text-soil italic">
                  {entry.disease.scientificName}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={() => dialog.current?.close()}
              className="shrink-0 cursor-pointer border-[1.5px] border-line px-3 py-1 hover:border-ink"
            >
              סגירה
            </button>
          </header>

          <section>
            <h3 className="text-lg font-bold">{entry.pathogenType === "healthy" ? "מה רואים בעלה בריא" : "תסמינים"}</h3>
            <p className="mt-1 max-w-prose">{entry.symptomsHe}</p>
          </section>

          <section className="border-t border-line pt-4">
            <h3 className="text-lg font-bold">מניעה</h3>
            <p className="mt-1 max-w-prose">{entry.preventionHe}</p>
          </section>

          <section className="border-t border-line pt-4">
            <h3 className="text-lg font-bold">הנחיית טיפול</h3>
            <p className="mt-1 max-w-prose">{entry.guidanceHe}</p>
          </section>

          {entry.treatments.length > 0 && <Treatments treatments={entry.treatments} />}

          <footer className="border-t border-line pt-4 text-sm text-soil">
            <p>
              מקור:{" "}
              {entry.sources.map((source, index) => (
                <span key={source}>
                  {index > 0 && ", "}
                  <a href={source} target="_blank" rel="noopener noreferrer" lang="en" className="text-leaf underline underline-offset-4">
                    {new URL(source).hostname.replace(/^www\./, "")}
                  </a>
                </span>
              ))}
              . זהו מידע כללי ולא המלצת ריסוס; יש לוודא רישום התכשיר בישראל.
            </p>
          </footer>
        </div>
      )}
    </dialog>
  );
}
