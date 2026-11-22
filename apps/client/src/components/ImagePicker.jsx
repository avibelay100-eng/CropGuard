/**
 * בחירת תמונת עלה: לחיצה (בטלפון - גם מצלמה) או גרירת קובץ, עם תצוגה מקדימה.
 */

import { useEffect, useId, useMemo, useState } from "react";

/** בחירת תמונה בלחיצה (בטלפון - גם מצלמה) או בגרירה, עם תצוגה מקדימה ושחרור הזיכרון שלה */
export function ImagePicker({
  file,
  onChange,
  disabled,
}) {
  const inputId = useId();
  const [dragging, setDragging] = useState(false);

  // כתובת תצוגה מקדימה לתמונה, ושחרור שלה מהזיכרון כשהתמונה מתחלפת
  const preview = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const onDrop = (event) => {
    event.preventDefault();
    setDragging(false);
    if (!disabled) onChange(event.dataTransfer.files[0] ?? null);
  };

  return (
    // גרירת קובץ היא תוספת לעכבר; במקלדת ובקורא מסך התווית פותחת את בורר הקבצים הרגיל
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions
    <label
      htmlFor={inputId}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
      className={`flex min-h-56 cursor-pointer flex-col items-center justify-center gap-3 border-2 border-dashed p-4 text-center transition-colors ${
        dragging ? "border-leaf bg-leaf-soft" : "border-line bg-white hover:border-leaf"
      } ${disabled ? "pointer-events-none opacity-60" : ""}`}
    >
      {preview ? (
        <>
          <img src={preview} alt="התמונה שנבחרה" className="max-h-72 max-w-full object-contain" />
          <span className="text-sm text-soil">לחצו כדי להחליף תמונה</span>
        </>
      ) : (
        <>
          <svg viewBox="0 0 48 48" className="size-12 text-leaf" aria-hidden="true">
            <path d="M10 38C10 22 20 12 38 10c0 18-10 28-28 28Z" fill="currentColor" fillOpacity=".15" stroke="currentColor" strokeWidth="2" />
            <path d="M12 36 30 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          <span className="text-lg font-semibold">צלמו או בחרו תמונה של עלה</span>
          <span className="text-sm text-soil">עלה בודד, מקרוב, באור יום. JPG, PNG או WebP עד 10MB.</span>
        </>
      )}
      <input
        id={inputId}
        type="file"
        accept="image/*"
        className="sr-only"
        disabled={disabled}
        onChange={(event) => onChange(event.target.files?.[0] ?? null)}
      />
    </label>
  );
}
