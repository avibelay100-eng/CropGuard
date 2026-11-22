/**
 * רכיבי ממשק בסיסיים: כפתור, שדה טופס, הודעה, ספינר.
 */

import type { ComponentPropsWithRef, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { useId } from "react";

type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-leaf text-white hover:bg-leaf-dark disabled:bg-leaf/50",
  secondary: "border-[1.5px] border-leaf text-leaf bg-white hover:bg-leaf-soft disabled:opacity-50",
  quiet: "text-soil underline underline-offset-4 hover:text-ink disabled:opacity-50",
  danger: "bg-blight text-white hover:brightness-90 disabled:opacity-50",
};

/** כפתור בארבעה סגנונות (ראשי, משני, שקט, מסוכן). ב-React 19 ref עובר כ-prop רגיל */
export function Button({
  variant = "primary",
  className = "",
  ...props
  // ב-React 19 ref הוא prop רגיל, כך שהוא עובר ישר ל-<button> (נדרש להחזרת מיקוד)
}: ComponentPropsWithRef<"button"> & { variant?: ButtonVariant }) {
  const base = variant === "quiet" ? "px-1 py-1" : "rounded-[var(--radius-label)] px-5 py-2.5 font-semibold";
  return (
    <button
      type="button"
      className={`${base} ${BUTTON_STYLES[variant]} cursor-pointer transition-colors disabled:cursor-not-allowed ${className}`}
      {...props}
    />
  );
}

interface FieldShellProps {
  label: string;
  hint?: string;
  error?: string;
  children: (props: { id: string; describedBy: string | undefined; invalid: boolean }) => ReactNode;
}

/** תווית + שדה + רמז/שגיאה, מחוברים נכון לקוראי מסך */
function FieldShell({ label, hint, error, children }: FieldShellProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const describedBy = error || hint ? hintId : undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="font-medium">
        {label}
      </label>
      {children({ id, describedBy, invalid: Boolean(error) })}
      {(error || hint) && (
        <p id={hintId} className={`text-sm ${error ? "text-blight" : "text-soil"}`}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

/** שדה טקסט עם תווית, רמז ושגיאה - מחוברים לקוראי מסך (aria-describedby, aria-invalid) */
export function TextField({
  label,
  hint,
  error,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string; error?: string }) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <input id={id} aria-describedby={describedBy} aria-invalid={invalid} className="input" {...props} />
      )}
    </FieldShell>
  );
}

/** רשימה נפתחת באותה מעטפת נגישה כמו שדה הטקסט */
export function SelectField({
  label,
  hint,
  error,
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { label: string; hint?: string; error?: string }) {
  return (
    <FieldShell label={label} hint={hint} error={error}>
      {({ id, describedBy, invalid }) => (
        <select id={id} aria-describedby={describedBy} aria-invalid={invalid} className="input" {...props}>
          {children}
        </select>
      )}
    </FieldShell>
  );
}

/** הודעת שגיאה או מידע; שגיאה מוקראת מיד לקוראי מסך */
export function Notice({ tone = "error", children }: { tone?: "error" | "warning" | "info"; children: ReactNode }) {
  const styles = {
    error: "border-blight bg-blight-soft text-blight",
    warning: "border-straw bg-straw-soft text-straw-ink",
    info: "border-line bg-white text-ink",
  }[tone];
  return (
    <div role={tone === "error" ? "alert" : "status"} className={`border-s-4 px-4 py-3 ${styles}`}>
      {children}
    </div>
  );
}

/** ספינר טעינה בתוך <output>, כך שקורא מסך מקריא את הטקסט */
export function Spinner({ label }: { label: string }) {
  return (
    <output className="flex items-center gap-3 text-soil">
      <svg className="size-6 animate-spin text-leaf" viewBox="0 0 24 24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeOpacity="0.2" strokeWidth="3" />
        <path d="M22 12a10 10 0 0 0-10-10" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
      </svg>
      <span>{label}</span>
    </output>
  );
}

/** כותרת עמוד + תיאור קצר */
export function PageHeader({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <header className="mb-6">
      <h1 className="text-3xl font-bold text-ink">{title}</h1>
      {children && <p className="mt-1 text-soil">{children}</p>}
    </header>
  );
}
