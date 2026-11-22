/**
 * מסכי התחברות והרשמה.
 * אימות בסיסי בצד הלקוח (לפני שליחה), והודעות שגיאה בעברית מהשרת.
 */

import type { RegisterRequest } from "@cropguard/shared-types";
import { useState, type FormEvent, type ReactNode } from "react";
import { Link, Navigate, useLocation } from "react-router";

import { ApiError, errorMessageHe } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Button, Notice, TextField } from "../components/ui";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** מסגרת משותפת למסכי הכניסה: עמודה צרה ממורכזת עם הלוגו */
function AuthShell({ title, children, footer }: { title: string; children: ReactNode; footer: ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-4 py-10">
      <div className="mb-8 flex items-center gap-3">
        <img src="/leaf.svg" alt="" className="size-10" />
        <div>
          <p className="font-display text-3xl font-bold text-leaf">CropGuard</p>
          <p className="text-soil">אבחון מחלות בעלי צמחים מתמונה</p>
        </div>
      </div>
      <section aria-labelledby="auth-title" className="border-t-4 border-leaf bg-white p-6 sm:p-8">
        <h1 id="auth-title" className="mb-6 text-2xl font-bold">
          {title}
        </h1>
        {children}
      </section>
      <p className="mt-6 text-center">{footer}</p>
    </main>
  );
}

/** אחרי התחברות חוזרים למסך שהמשתמש ביקש, או למסך הסריקה */
function useRedirectTarget(): string {
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from;
  return from && from !== "/login" && from !== "/register" ? from : "/scan";
}

export function LoginPage() {
  const { user, login } = useAuth();
  const target = useRedirectTarget();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // אחרי התחברות מוצלחת user מתעדכן, והשורה הזו מעבירה למסך המבוקש
  if (user) return <Navigate to={target} replace />;

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("נא למלא אימייל וסיסמה.");
      return;
    }
    setSubmitting(true);
    try {
      await login({ email, password });
    } catch (err) {
      // בהתחברות, 401 פירושו פרטים שגויים - לא "צריך להתחבר מחדש"
      setError(err instanceof ApiError && err.status === 401 ? "האימייל או הסיסמה שגויים." : errorMessageHe(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="התחברות"
      footer={
        <>
          אין לכם חשבון?{" "}
          <Link to="/register" className="font-semibold text-leaf underline underline-offset-4">
            הרשמה
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {error && <Notice>{error}</Notice>}
        <TextField label="אימייל" type="email" autoComplete="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} />
        <TextField
          label="סיסמה"
          type="password"
          autoComplete="current-password"
          dir="ltr"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <Button type="submit" disabled={submitting} className="mt-2">
          {submitting ? "מתחבר…" : "התחברות"}
        </Button>
      </form>
    </AuthShell>
  );
}

type RegisterRole = NonNullable<RegisterRequest["role"]>;

export function RegisterPage() {
  const { user, register } = useAuth();
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "FARMER" as RegisterRole });
  const [errors, setErrors] = useState<Partial<Record<"name" | "email" | "password", string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [registered, setRegistered] = useState(false);

  // משתמש חדש מתחיל בהוספת חלקה; משתמש שכבר מחובר ונכנס לכאן - חוזר לסריקה
  if (user) return <Navigate to={registered ? "/fields" : "/scan"} replace />;

  const update = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  const validate = () => {
    const next: typeof errors = {};
    if (!form.name.trim()) next.name = "נא למלא שם.";
    if (!EMAIL_PATTERN.test(form.email.trim())) next.email = "נא למלא כתובת אימייל תקינה.";
    if (form.password.length < 8) next.password = "הסיסמה צריכה להכיל לפחות 8 תווים.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      setRegistered(true);
      await register(form);
    } catch (err) {
      setRegistered(false);
      setError(errorMessageHe(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="יצירת חשבון"
      footer={
        <>
          כבר יש לכם חשבון?{" "}
          <Link to="/login" className="font-semibold text-leaf underline underline-offset-4">
            התחברות
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        {error && <Notice>{error}</Notice>}
        <TextField label="שם מלא" autoComplete="name" value={form.name} error={errors.name} onChange={(e) => update("name")(e.target.value)} />
        <TextField
          label="אימייל"
          type="email"
          autoComplete="email"
          dir="ltr"
          value={form.email}
          error={errors.email}
          onChange={(e) => update("email")(e.target.value)}
        />
        <TextField
          label="סיסמה"
          type="password"
          autoComplete="new-password"
          dir="ltr"
          hint="לפחות 8 תווים"
          value={form.password}
          error={errors.password}
          onChange={(e) => update("password")(e.target.value)}
        />
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1.5 font-medium">אני</legend>
          {(
            [
              ["FARMER", "חקלאי - מנהל חלקות ומצלם עלים"],
              ["AGRONOMIST", "אגרונום - מלווה חקלאים ורואה את כל החלקות"],
            ] as const
          ).map(([value, label]) => (
            <label key={value} className="flex cursor-pointer items-center gap-2">
              <input
                type="radio"
                name="role"
                value={value}
                checked={form.role === value}
                onChange={() => update("role")(value)}
                className="size-4 accent-leaf"
              />
              {label}
            </label>
          ))}
        </fieldset>
        <Button type="submit" disabled={submitting} className="mt-2">
          {submitting ? "יוצר חשבון…" : "יצירת חשבון"}
        </Button>
      </form>
    </AuthShell>
  );
}
