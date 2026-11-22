/**
 * ניהול חלקות: רשימת החלקות והוספת חלקה חדשה.
 * אגרונום ומנהל רואים את החלקות של כל החקלאים, עם שם הבעלים.
 */

import type { FieldDto } from "@cropguard/shared-types";
import { useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { api, errorMessageHe } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Button, Notice, PageHeader, SelectField, Spinner, TextField } from "../components/ui";
import { CROPS, cropLabelHe } from "../lib/crops";
import { formatCoordinates } from "../lib/format";

type FormErrors = Partial<Record<"name" | "latitude" | "longitude", string>>;

const EMPTY_FORM = { name: "", cropType: CROPS[0]!.value, latitude: "", longitude: "" };

/** מסך החלקות: רשימה + טופס הוספה; כשאין חלקות הטופס נפתח מיד */
export function FieldsPage() {
  const { user } = useAuth();
  const seesAll = user?.role === "AGRONOMIST" || user?.role === "ADMIN";
  const [fields, setFields] = useState<FieldDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    api
      .listFields()
      .then(({ items }) => {
        setFields(items);
        setShowForm(items.length === 0);
      })
      .catch((err: unknown) => setLoadError(errorMessageHe(err)));
  }, []);

  if (loadError) return <Notice>{loadError}</Notice>;
  if (!fields) return <Spinner label="טוען את החלקות…" />;

  return (
    <>
      <PageHeader title={seesAll ? "חלקות" : "החלקות שלי"}>
        {seesAll ? "החלקות של כל החקלאים במערכת." : "כל אבחון נשמר בחלקה שבה צולם העלה."}
      </PageHeader>

      {showForm ? (
        <FieldForm
          onCreated={(field) => {
            setFields((current) => [field, ...(current ?? [])]);
            setShowForm(false);
          }}
          onCancel={fields.length > 0 ? () => setShowForm(false) : undefined}
        />
      ) : (
        <Button variant="secondary" onClick={() => setShowForm(true)}>
          הוספת חלקה
        </Button>
      )}

      {fields.length > 0 && (
        <ul className="mt-8 divide-y divide-line border-y border-line bg-white" aria-label="רשימת החלקות">
          {fields.map((field) => (
            <li key={field.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-4 py-4">
              <div>
                <p className="font-display text-xl font-bold">{field.name}</p>
                <p className="text-soil">
                  {cropLabelHe(field.cropType)}
                  {seesAll && <span className="ms-3">של {field.ownerName}</span>}
                </p>
                <p dir="ltr" className="text-end text-sm text-soil tabular-nums">
                  {formatCoordinates(field.latitude, field.longitude)}
                </p>
              </div>
              <div className="text-end">
                <p className="font-semibold tabular-nums">
                  {field.diagnosisCount === 1 ? "אבחון אחד" : `${field.diagnosisCount} אבחונים`}
                </p>
                {field.diagnosisCount > 0 && (
                  <Link to={`/history?fieldId=${field.id}`} className="text-sm text-leaf underline underline-offset-4">
                    לאבחונים של החלקה
                  </Link>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

/** טופס חלקה חדשה: אימות קואורדינטות, ומילוי מה-GPS של המכשיר */
function FieldForm({ onCreated, onCancel }: { onCreated: (field: FieldDto) => void; onCancel?: () => void }) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [errors, setErrors] = useState<FormErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);

  const update = (key: keyof typeof form) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  const validate = (): { latitude: number; longitude: number } | null => {
    const next: FormErrors = {};
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    if (!form.name.trim()) next.name = "נא לתת לחלקה שם.";
    if (form.latitude.trim() === "" || Number.isNaN(latitude) || latitude < -90 || latitude > 90) {
      next.latitude = "קו רוחב הוא מספר בין -90 ל-90.";
    }
    if (form.longitude.trim() === "" || Number.isNaN(longitude) || longitude < -180 || longitude > 180) {
      next.longitude = "קו אורך הוא מספר בין -180 ל-180.";
    }
    setErrors(next);
    return Object.keys(next).length === 0 ? { latitude, longitude } : null;
  };

  const useMyLocation = () => {
    if (!navigator.geolocation) {
      setError("הדפדפן לא תומך באיתור מיקום. אפשר להקליד את הקואורדינטות.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          latitude: position.coords.latitude.toFixed(6),
          longitude: position.coords.longitude.toFixed(6),
        }));
        setLocating(false);
      },
      () => {
        setError("לא הצלחנו לאתר את המיקום. אפשר להקליד את הקואורדינטות.");
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 15_000 },
    );
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    const coordinates = validate();
    if (!coordinates) return;
    setSubmitting(true);
    try {
      onCreated(await api.createField({ name: form.name.trim(), cropType: form.cropType, ...coordinates }));
      setForm(EMPTY_FORM);
    } catch (err) {
      setError(errorMessageHe(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby="new-field-title" className="flex flex-col gap-4 border-t-4 border-leaf bg-white p-5 sm:p-6">
      <h2 id="new-field-title" className="text-2xl font-bold">
        חלקה חדשה
      </h2>
      {error && <Notice>{error}</Notice>}
      <TextField label="שם החלקה" placeholder="למשל: חממה 3" value={form.name} error={errors.name} onChange={(e) => update("name")(e.target.value)} />
      <SelectField label="גידול" value={form.cropType} onChange={(e) => update("cropType")(e.target.value)}>
        {CROPS.map((crop) => (
          <option key={crop.value} value={crop.value}>
            {crop.labelHe}
          </option>
        ))}
      </SelectField>
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="קו רוחב"
          inputMode="decimal"
          dir="ltr"
          placeholder="31.2518"
          value={form.latitude}
          error={errors.latitude}
          onChange={(e) => update("latitude")(e.target.value)}
        />
        <TextField
          label="קו אורך"
          inputMode="decimal"
          dir="ltr"
          placeholder="34.7913"
          value={form.longitude}
          error={errors.longitude}
          onChange={(e) => update("longitude")(e.target.value)}
        />
      </div>
      <div>
        <Button variant="quiet" onClick={useMyLocation} disabled={locating}>
          {locating ? "מאתר מיקום…" : "מילוי לפי המיקום הנוכחי שלי"}
        </Button>
      </div>
      <div className="flex gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? "שומר…" : "שמירת החלקה"}
        </Button>
        {onCancel && (
          <Button variant="secondary" onClick={onCancel} disabled={submitting}>
            ביטול
          </Button>
        )}
      </div>
    </form>
  );
}
