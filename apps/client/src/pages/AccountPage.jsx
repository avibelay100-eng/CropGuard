/**
 * החשבון שלי: פרטי המשתמש, והוספה/שינוי/הסרה של טלפון לשחזור סיסמה.
 */

import { useState } from "react";

import { api, errorMessageHe } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Button, Notice, PageHeader, TextField } from "../components/ui";
import { ROLE_LABELS_HE } from "../lib/format";
import { formatIsraeliMobile, isIsraeliMobile, PHONE_ERROR, PHONE_HINT } from "../lib/phone";

/** פרטי החשבון וטופס טלפון; אחרי שמירה - מעדכנים גם את המשתמש ב-AuthContext */
export function AccountPage() {
  const { user, setCurrentUser } = useAuth();
  const [phone, setPhone] = useState(user?.phone ? formatIsraeliMobile(user.phone) : "");
  const [fieldError, setFieldError] = useState(null);
  const [error, setError] = useState(null);
  const [saved, setSaved] = useState(null);
  const [saving, setSaving] = useState(false);

  if (!user) return null;

  const save = async (value) => {
    setError(null);
    setSaved(null);
    if (value !== null && !isIsraeliMobile(value)) {
      setFieldError(PHONE_ERROR);
      return;
    }
    setFieldError(null);
    setSaving(true);
    try {
      const updated = await api.updateMe({ phone: value });
      setCurrentUser(updated);
      setPhone(updated.phone ? formatIsraeliMobile(updated.phone) : "");
      setSaved(updated.phone ? "הטלפון נשמר. אפשר לשחזר איתו את הסיסמה." : "הטלפון הוסר מהחשבון.");
    } catch (err) {
      setError(errorMessageHe(err));
    } finally {
      setSaving(false);
    }
  };

  const onSubmit = (event) => {
    event.preventDefault();
    void save(phone.trim());
  };

  return (
    <>
      <PageHeader title="החשבון שלי" />

      <dl className="mb-8 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 border-y border-line bg-white px-4 py-4">
        <dt className="text-soil">שם</dt>
        <dd>{user.name}</dd>
        <dt className="text-soil">אימייל</dt>
        <dd dir="ltr" className="text-end">
          {user.email}
        </dd>
        <dt className="text-soil">תפקיד</dt>
        <dd>{ROLE_LABELS_HE[user.role]}</dd>
      </dl>

      <form onSubmit={onSubmit} noValidate aria-labelledby="phone-title" className="flex flex-col gap-4 border-t-4 border-leaf bg-white p-5">
        <h2 id="phone-title" className="text-xl font-bold">
          טלפון לשחזור סיסמה
        </h2>
        <p className="text-soil">אם תשכחו את הסיסמה, נשלח קוד ב-SMS למספר הזה.</p>
        {saved && <Notice tone="info">{saved}</Notice>}
        {error && <Notice>{error}</Notice>}
        <TextField
          label="טלפון נייד"
          type="tel"
          autoComplete="tel"
          inputMode="tel"
          dir="ltr"
          hint={PHONE_HINT}
          value={phone}
          error={fieldError ?? undefined}
          onChange={(e) => setPhone(e.target.value)}
        />
        <div className="flex flex-wrap gap-3">
          <Button type="submit" disabled={saving}>
            {saving ? "שומר…" : "שמירת הטלפון"}
          </Button>
          {user.phone && (
            <Button variant="secondary" onClick={() => void save(null)} disabled={saving}>
              הסרת הטלפון
            </Button>
          )}
        </div>
      </form>
    </>
  );
}
