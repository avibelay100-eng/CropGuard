/**
 * ניהול חלקות: רשימה, הוספה, עריכה ומחיקה.
 * לכל חלקה: פרטים מורחבים (שטח בדונמים, שיטת גידול והשקיה, עונה), קישור ליומן השדה,
 * ו-★ אזהרת PHI כשריסוס אחרון עוד לא "התקרר" (אסור לקטוף לפני תאריך מסוים).
 * אגרונום ומנהל רואים את החלקות של כל החקלאים; עריכה ומחיקה - בעל החלקה או מנהל בלבד.
 */

import type { CultivationMethod, FieldDetails, FieldDto, IrrigationMethod } from "@cropguard/shared-types";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { api, errorMessageHe } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Button, Notice, PageHeader, SelectField, Spinner, TextAreaField, TextField } from "../components/ui";
import { CROPS, cropLabelHe } from "../lib/crops";
import {
  CULTIVATION_METHODS,
  IRRIGATION_METHODS,
  cultivationLabelHe,
  formatDunams,
  irrigationLabelHe,
} from "../lib/fieldLabels";
import { formatCalendarDate, formatCoordinates } from "../lib/format";

type FormErrors = Partial<Record<"name" | "latitude" | "longitude" | "areaDunams" | "expectedHarvestDate", string>>;

/** מצב הטופס - הכול מחרוזות, כמו שהן בשדות; ההמרה למספרים ול-null קורית בשליחה */
interface FormState {
  name: string;
  cropType: string;
  latitude: string;
  longitude: string;
  areaDunams: string;
  cultivationMethod: CultivationMethod | "";
  irrigationMethod: IrrigationMethod | "";
  variety: string;
  plantingDate: string;
  expectedHarvestDate: string;
  notes: string;
}

/** מצב התחלתי: ריק לחלקה חדשה, או הערכים של החלקה בעריכה */
function toFormState(field?: FieldDto): FormState {
  return {
    name: field?.name ?? "",
    cropType: field?.cropType ?? CROPS[0]!.value,
    latitude: field ? String(field.latitude) : "",
    longitude: field ? String(field.longitude) : "",
    areaDunams: field?.areaDunams != null ? String(field.areaDunams) : "",
    cultivationMethod: field?.cultivationMethod ?? "",
    irrigationMethod: field?.irrigationMethod ?? "",
    variety: field?.variety ?? "",
    plantingDate: field?.plantingDate ?? "",
    expectedHarvestDate: field?.expectedHarvestDate ?? "",
    notes: field?.notes ?? "",
  };
}

/** מי רשאי לערוך ולמחוק: בעל החלקה או מנהל (אגרונום רק צופה) */
function canEditField(field: FieldDto, user: { id: string; role: string } | null): boolean {
  return Boolean(user && (user.id === field.ownerId || user.role === "ADMIN"));
}

/** מסך החלקות: רשימה + טופס הוספה/עריכה + דיאלוג מחיקה; כשאין חלקות טופס ההוספה נפתח מיד */
export function FieldsPage() {
  const { user } = useAuth();
  const seesAll = user?.role === "AGRONOMIST" || user?.role === "ADMIN";
  const [fields, setFields] = useState<FieldDto[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<FieldDto | null>(null);
  const [status, setStatus] = useState<string | null>(null);

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

  const replaceField = (updated: FieldDto) => setFields((current) => (current ?? []).map((f) => (f.id === updated.id ? updated : f)));

  return (
    <>
      <PageHeader title={seesAll ? "חלקות" : "החלקות שלי"}>
        {seesAll ? "החלקות של כל החקלאים במערכת." : "כל אבחון וכל ריסוס נשמרים בחלקה שלהם."}
      </PageHeader>

      {status && <Notice tone="info">{status}</Notice>}

      {showForm ? (
        <FieldForm
          onSaved={(field) => {
            setFields((current) => [field, ...(current ?? [])]);
            setShowForm(false);
            setStatus(`החלקה "${field.name}" נוספה.`);
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
          {fields.map((field) =>
            editingId === field.id ? (
              <li key={field.id} className="p-2">
                <FieldForm
                  field={field}
                  onSaved={(updated) => {
                    replaceField(updated);
                    setEditingId(null);
                    setStatus(`החלקה "${updated.name}" עודכנה.`);
                  }}
                  onCancel={() => setEditingId(null)}
                />
              </li>
            ) : (
              <FieldRow
                key={field.id}
                field={field}
                showOwner={seesAll}
                canEdit={canEditField(field, user)}
                onEdit={() => {
                  setStatus(null);
                  setEditingId(field.id);
                }}
                onDelete={() => setDeleting(field)}
              />
            ),
          )}
        </ul>
      )}

      <DeleteFieldDialog
        field={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={(deleted) => {
          setFields((current) => (current ?? []).filter((f) => f.id !== deleted.id));
          setDeleting(null);
          setStatus(`החלקה "${deleted.name}" נמחקה, יחד עם האבחונים ויומן השדה שלה.`);
        }}
      />
    </>
  );
}

/** שורת חלקה: שם, גידול, פרטים מורחבים, אזהרת PHI, מספר אבחונים, וקישורים/פעולות */
function FieldRow({
  field,
  showOwner,
  canEdit,
  onEdit,
  onDelete,
}: {
  field: FieldDto;
  showOwner: boolean;
  canEdit: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  // הפרטים המורחבים שהוגדרו, בשורה אחת מופרדת בנקודות
  const details = [
    field.areaDunams != null ? formatDunams(field.areaDunams) : null,
    field.cultivationMethod ? cultivationLabelHe(field.cultivationMethod) : null,
    field.irrigationMethod ? irrigationLabelHe(field.irrigationMethod) : null,
    field.variety ? `זן ${field.variety}` : null,
    field.plantingDate ? `שתילה ${formatCalendarDate(field.plantingDate)}` : null,
    field.expectedHarvestDate ? `קטיף צפוי ${formatCalendarDate(field.expectedHarvestDate)}` : null,
  ].filter(Boolean);

  return (
    <li className="flex flex-col gap-3 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div>
          <p className="font-display text-xl font-bold">{field.name}</p>
          <p className="text-soil">
            {cropLabelHe(field.cropType)}
            {showOwner && <span className="ms-3">של {field.ownerName}</span>}
          </p>
          {details.length > 0 && <p className="text-sm">{details.join(" · ")}</p>}
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
      </div>

      {/* ★ PHI: ריסוס שימי ההמתנה שלו עוד לא עברו */}
      {field.harvestBlockedUntil && (
        <p className="border-s-4 border-straw bg-straw-soft px-3 py-1.5 text-sm font-semibold text-straw-ink">
          ⚠ אין לקטוף לפני {formatCalendarDate(field.harvestBlockedUntil)} - ימי ההמתנה מהריסוס עוד לא עברו
        </p>
      )}

      {field.notes && <p className="max-w-prose text-sm text-soil">{field.notes}</p>}

      <div className="flex flex-wrap items-center gap-3">
        <Link
          to={`/fields/${field.id}/journal`}
          className="rounded-[var(--radius-label)] border-[1.5px] border-leaf bg-white px-4 py-1.5 text-sm font-semibold text-leaf hover:bg-leaf-soft"
        >
          יומן שדה{field.logCount > 0 && ` (${field.logCount})`}
        </Link>
        {canEdit && (
          <>
            <Button variant="quiet" onClick={onEdit}>
              עריכה
            </Button>
            <Button variant="quiet" onClick={onDelete} className="text-blight">
              מחיקה
            </Button>
          </>
        )}
      </div>
    </li>
  );
}

/** טופס חלקה - הוספה (בלי field) או עריכה (עם field): אימות, מילוי מה-GPS, ופרטים מורחבים לא חובה */
function FieldForm({
  field,
  onSaved,
  onCancel,
}: {
  field?: FieldDto;
  onSaved: (field: FieldDto) => void;
  onCancel?: () => void;
}) {
  const titleId = useId();
  const [form, setForm] = useState<FormState>(() => toFormState(field));
  const [errors, setErrors] = useState<FormErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [locating, setLocating] = useState(false);
  const editing = Boolean(field);

  const update = (key: keyof FormState) => (value: string) => setForm((current) => ({ ...current, [key]: value }));

  const validate = (): { latitude: number; longitude: number; areaDunams: number | null } | null => {
    const next: FormErrors = {};
    const latitude = Number(form.latitude);
    const longitude = Number(form.longitude);
    const area = form.areaDunams.trim() === "" ? null : Number(form.areaDunams);
    if (!form.name.trim()) next.name = "נא לתת לחלקה שם.";
    if (form.latitude.trim() === "" || Number.isNaN(latitude) || latitude < -90 || latitude > 90) {
      next.latitude = "קו רוחב הוא מספר בין -90 ל-90.";
    }
    if (form.longitude.trim() === "" || Number.isNaN(longitude) || longitude < -180 || longitude > 180) {
      next.longitude = "קו אורך הוא מספר בין -180 ל-180.";
    }
    if (area !== null && (Number.isNaN(area) || area <= 0 || area > 100_000)) {
      next.areaDunams = "שטח הוא מספר דונמים גדול מאפס.";
    }
    if (form.plantingDate && form.expectedHarvestDate && form.expectedHarvestDate < form.plantingDate) {
      next.expectedHarvestDate = "הקטיף הצפוי לא יכול להיות לפני השתילה.";
    }
    setErrors(next);
    return Object.keys(next).length === 0 ? { latitude, longitude, areaDunams: area } : null;
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
    const parsed = validate();
    if (!parsed) return;

    const details: FieldDetails = {
      areaDunams: parsed.areaDunams,
      cultivationMethod: form.cultivationMethod || null,
      irrigationMethod: form.irrigationMethod || null,
      variety: form.variety.trim() || null,
      plantingDate: form.plantingDate || null,
      expectedHarvestDate: form.expectedHarvestDate || null,
      notes: form.notes.trim() || null,
    };
    const base = { name: form.name.trim(), cropType: form.cropType, latitude: parsed.latitude, longitude: parsed.longitude };

    setSubmitting(true);
    try {
      if (field) {
        // בעריכה שולחים הכול - שדה שרוקן נשלח כ-null ונמחק בשרת
        onSaved(await api.updateField(field.id, { ...base, ...details }));
      } else {
        // ביצירה שולחים רק פרטים שמולאו
        const filled = Object.fromEntries(Object.entries(details).filter(([, value]) => value !== null));
        onSaved(await api.createField({ ...base, ...filled }));
        setForm(toFormState());
      }
    } catch (err) {
      setError(errorMessageHe(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby={titleId} className="flex flex-col gap-4 border-t-4 border-leaf bg-white p-5 sm:p-6">
      <h2 id={titleId} className="text-2xl font-bold">
        {editing ? "עריכת חלקה" : "חלקה חדשה"}
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

      {/* ★ התאמה לשוק הישראלי: הפרטים שחקלאי בישראל מנהל לכל חלקה */}
      <fieldset className="flex flex-col gap-4 border-t border-line pt-4">
        <legend className="pb-2 text-lg font-bold">פרטי החלקה והעונה (לא חובה)</legend>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField
            label="שטח (דונם)"
            inputMode="decimal"
            dir="ltr"
            placeholder="12.5"
            value={form.areaDunams}
            error={errors.areaDunams}
            onChange={(e) => update("areaDunams")(e.target.value)}
          />
          <SelectField label="שיטת גידול" value={form.cultivationMethod} onChange={(e) => update("cultivationMethod")(e.target.value)}>
            <option value="">לא צוין</option>
            {CULTIVATION_METHODS.map((method) => (
              <option key={method.value} value={method.value}>
                {method.labelHe}
              </option>
            ))}
          </SelectField>
          <SelectField label="השקיה" value={form.irrigationMethod} onChange={(e) => update("irrigationMethod")(e.target.value)}>
            <option value="">לא צוין</option>
            {IRRIGATION_METHODS.map((method) => (
              <option key={method.value} value={method.value}>
                {method.labelHe}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField label="זן" placeholder="למשל: מטרו" value={form.variety} onChange={(e) => update("variety")(e.target.value)} />
          <TextField label="תאריך שתילה" type="date" value={form.plantingDate} onChange={(e) => update("plantingDate")(e.target.value)} />
          <TextField
            label="קטיף צפוי"
            type="date"
            value={form.expectedHarvestDate}
            error={errors.expectedHarvestDate}
            onChange={(e) => update("expectedHarvestDate")(e.target.value)}
          />
        </div>
        <TextAreaField label="הערות" value={form.notes} maxLength={1000} onChange={(e) => update("notes")(e.target.value)} />
      </fieldset>

      <div className="flex gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? "שומר…" : editing ? "שמירת השינויים" : "שמירת החלקה"}
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

/**
 * דיאלוג אזהרה לפני מחיקת חלקה. <dialog> מובנה: מלכודת מיקוד, Esc סוגר, והמיקוד חוזר לכפתור שפתח.
 * הטקסט אומר במפורש כמה אבחונים ורשומות יומן יימחקו - המחיקה לא ניתנת לביטול.
 */
function DeleteFieldDialog({
  field,
  onClose,
  onDeleted,
}: {
  field: FieldDto | null;
  onClose: () => void;
  onDeleted: (field: FieldDto) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (field && !element.open) element.showModal();
    if (!field && element.open) element.close();
  }, [field]);

  const confirm = async () => {
    if (!field) return;
    setBusy(true);
    setError(null);
    try {
      await api.deleteField(field.id);
      onDeleted(field);
    } catch (err) {
      setError(errorMessageHe(err));
    } finally {
      setBusy(false);
    }
  };

  const diagnoses = field?.diagnosisCount === 1 ? "אבחון אחד" : `${field?.diagnosisCount ?? 0} אבחונים`;
  const logs = field?.logCount === 1 ? "רשומה אחת ביומן השדה" : `${field?.logCount ?? 0} רשומות ביומן השדה`;

  return (
    <dialog
      ref={dialog}
      aria-labelledby={titleId}
      onClose={() => {
        setError(null);
        onClose();
      }}
      className="m-auto w-[min(32rem,calc(100vw-2rem))] border-2 border-ink bg-white p-0 text-ink backdrop:bg-ink/50"
    >
      {field && (
        <div className="flex flex-col gap-4 p-5 sm:p-6">
          <h2 id={titleId} className="text-2xl font-bold">
            למחוק את "{field.name}"?
          </h2>
          <p className="border-s-4 border-blight bg-blight-soft px-4 py-3 text-blight">
            המחיקה תמחק לצמיתות גם {diagnoses} (כולל התמונות) ו-{logs}. אי אפשר לבטל את הפעולה.
          </p>
          {error && <Notice>{error}</Notice>}
          <div className="flex flex-wrap gap-3">
            <Button variant="danger" onClick={confirm} disabled={busy}>
              {busy ? "מוחק…" : "מחיקה לצמיתות"}
            </Button>
            <Button variant="secondary" onClick={() => dialog.current?.close()} disabled={busy}>
              ביטול
            </Button>
          </div>
        </div>
      )}
    </dialog>
  );
}
