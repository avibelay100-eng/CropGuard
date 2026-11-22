/**
 * שחזור סיסמה ב-SMS, בשני שלבים:
 *   1. מספר טלפון -> השרת שולח קוד בן 6 ספרות (אם המספר רשום; התשובה זהה בכל מקרה)
 *   2. קוד + סיסמה חדשה -> הסיסמה מתעדכנת, וחוזרים למסך ההתחברות
 */

import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router";

import { api, errorMessageHe } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Button, Notice, TextField } from "../components/ui";
import { isIsraeliMobile, PHONE_ERROR } from "../lib/phone";
import { AuthShell } from "./AuthPages";

export function ForgotPasswordPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"phone" | "code">("phone");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<"phone" | "code" | "password", string>>>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to="/account" replace />;

  const sendCode = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!isIsraeliMobile(phone)) {
      setFieldErrors({ phone: PHONE_ERROR });
      return;
    }
    setFieldErrors({});
    setSubmitting(true);
    try {
      await api.requestPasswordReset(phone);
      setStep("code");
    } catch (err) {
      setError(errorMessageHe(err));
    } finally {
      setSubmitting(false);
    }
  };

  const resetPassword = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const next: typeof fieldErrors = {};
    if (!/^\d{6}$/.test(code.trim())) next.code = "הקוד בן 6 ספרות.";
    if (newPassword.length < 8) next.password = "הסיסמה צריכה להכיל לפחות 8 תווים.";
    setFieldErrors(next);
    if (Object.keys(next).length > 0) return;

    setSubmitting(true);
    try {
      await api.confirmPasswordReset({ phone, code: code.trim(), newPassword });
      navigate("/login", { replace: true, state: { resetDone: true } });
    } catch (err) {
      setError(errorMessageHe(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthShell
      title="שחזור סיסמה"
      footer={
        <Link to="/login" className="font-semibold text-leaf underline underline-offset-4">
          חזרה להתחברות
        </Link>
      }
    >
      {step === "phone" ? (
        <form onSubmit={sendCode} noValidate className="flex flex-col gap-4">
          <p className="text-soil">נשלח קוד ב-SMS למספר הטלפון שמחובר לחשבון.</p>
          {error && <Notice>{error}</Notice>}
          <TextField
            label="טלפון נייד"
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            dir="ltr"
            placeholder="050-1234567"
            value={phone}
            error={fieldErrors.phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <Button type="submit" disabled={submitting}>
            {submitting ? "שולח…" : "שליחת קוד"}
          </Button>
        </form>
      ) : (
        <form onSubmit={resetPassword} noValidate className="flex flex-col gap-4">
          {/* אותה הודעה תמיד - לא מגלים אם המספר רשום */}
          <Notice tone="info">
            אם המספר <bdi dir="ltr">{phone}</bdi> מחובר לחשבון, נשלח אליו קוד בן 6 ספרות. הקוד בתוקף ל-10 דקות.
          </Notice>
          {error && <Notice>{error}</Notice>}
          <TextField
            label="קוד מה-SMS"
            inputMode="numeric"
            autoComplete="one-time-code"
            dir="ltr"
            maxLength={6}
            value={code}
            error={fieldErrors.code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
          />
          <TextField
            label="סיסמה חדשה"
            type="password"
            autoComplete="new-password"
            dir="ltr"
            hint="לפחות 8 תווים"
            value={newPassword}
            error={fieldErrors.password}
            onChange={(e) => setNewPassword(e.target.value)}
          />
          <Button type="submit" disabled={submitting}>
            {submitting ? "מעדכן…" : "קביעת סיסמה חדשה"}
          </Button>
          <Button
            variant="quiet"
            onClick={() => {
              setStep("phone");
              setCode("");
              setError(null);
            }}
          >
            לא קיבלתי קוד - שליחה מחדש
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
