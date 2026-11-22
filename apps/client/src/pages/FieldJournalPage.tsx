/**
 * ★ מנגנון ליבה של CropGuard - יומן שדה ו-PHI (ימי המתנה לקטיף).
 *
 * מסך אחד לכל חלקה: מצב הקטיף בראש המסך (מותר / אסור עד תאריך), טופס רשומה חדשה
 * (ריסוס, דישון או השקיה), ורשימת כל הרשומות מהחדשה לישנה.
 *
 * הגעה מכרטיס האבחון ממלאת את הטופס אוטומטית: המחלה, התכשירים המומלצים וימי ההמתנה.
 * ימי ההמתנה במערכת הם ערכי דוגמה, ולכן ריסוס נשמר רק אחרי שהחקלאי מאשר שבדק את תווית התכשיר.
 * תאריך הקטיף המותר מוצג כאן כתצוגה מקדימה, אבל נקבע בשרת.
 */

import type { DoseUnit, FieldLogDto, FieldLogListResponse, FieldLogType } from "@cropguard/shared-types";
import { useEffect, useId, useState, type FormEvent } from "react";
import { Link, useLocation, useParams } from "react-router";

import { api, errorMessageHe } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Button, Notice, PageHeader, SelectField, Spinner, TextAreaField, TextField } from "../components/ui";
import { cropLabelHe } from "../lib/crops";
import { DOSE_UNITS, FIELD_LOG_TYPES, doseUnitLabelHe, formatDunams, logTypeLabelHe } from "../lib/fieldLabels";
import { addDays, formatCalendarDate } from "../lib/format";
import { readPrefill, type JournalPrefill } from "../lib/journalPrefill";

/** מסך היומן של חלקה אחת */
export function FieldJournalPage() {
  const { fieldId = "" } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const [data, setData] = useState<FieldLogListResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  // המילוי מהאבחון נקרא פעם אחת; אחרי שמירה הוא נמחק כדי שהטופס הבא יהיה ריק
  const [prefill, setPrefill] = useState<JournalPrefill | null>(() => readPrefill(location.state));
  const [showForm, setShowForm] = useState(() => readPrefill(location.state) !== null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    api
      .listFieldLogs(fieldId)
      .then(setData)
      .catch((err: unknown) => setLoadError(errorMessageHe(err)));
  }, [fieldId]);

  if (loadError) return <Notice>{loadError}</Notice>;
  if (!data) return <Spinner label="טוען את יומן השדה…" />;

  const { field, items, today } = data;
  const canEdit = Boolean(user && (user.id === field.ownerId || user.role === "ADMIN"));

  /** אחרי שינוי ביומן טוענים מחדש - כך מצב הקטיף (harvestBlockedUntil) תמיד מחושב בשרת */
  const reload = async () => setData(await api.listFieldLogs(fieldId));

  return (
    <>
      <p className="mb-2">
        <Link to="/fields" className="text-sm text-leaf underline underline-offset-4">
          → חזרה לחלקות
        </Link>
      </p>
      <PageHeader title={`יומן שדה – ${field.name}`}>
        {cropLabelHe(field.cropType)}
        {field.areaDunams != null && ` · ${formatDunams(field.areaDunams)}`}
        {user?.id !== field.ownerId && ` · של ${field.ownerName}`}
      </PageHeader>

      <HarvestStatus blockedUntil={field.harvestBlockedUntil} />

      {status && (
        <div className="mt-4">
          <Notice tone="info">{status}</Notice>
        </div>
      )}

      {canEdit && (
        <div className="mt-6">
          {showForm ? (
            <LogForm
              fieldId={field.id}
              today={today}
              areaDunams={field.areaDunams}
              prefill={prefill}
              onSaved={async (log) => {
                setShowForm(false);
                setPrefill(null);
                setStatus(
                  log.safeHarvestDate
                    ? `הריסוס נרשם. קטיף מותר החל מ-${formatCalendarDate(log.safeHarvestDate)}.`
                    : `ה${logTypeLabelHe(log.type)} נרשם ביומן.`,
                );
                await reload();
              }}
              onCancel={() => {
                setShowForm(false);
                setPrefill(null);
              }}
            />
          ) : (
            <Button
              variant="secondary"
              onClick={() => {
                setStatus(null);
                setShowForm(true);
              }}
            >
              רשומה חדשה ביומן
            </Button>
          )}
        </div>
      )}

      {items.length === 0 ? (
        <p className="mt-8 text-soil">אין עדיין רשומות ביומן של החלקה הזו.</p>
      ) : (
        <ul className="mt-8 divide-y divide-line border-y border-line bg-white" aria-label="רשומות היומן">
          {items.map((log) => (
            <LogRow
              key={log.id}
              log={log}
              today={today}
              canEdit={canEdit}
              onDelete={async () => {
                await api.deleteFieldLog(field.id, log.id);
                setStatus("הרשומה נמחקה.");
                await reload();
              }}
            />
          ))}
        </ul>
      )}
    </>
  );
}

/** ★ PHI: מצב הקטיף של החלקה - הדבר הראשון שהחקלאי רואה ביומן */
function HarvestStatus({ blockedUntil }: { blockedUntil: string | null }) {
  if (blockedUntil) {
    return (
      <section aria-label="מצב הקטיף" className="border-2 border-straw bg-straw-soft p-4 text-straw-ink">
        <p className="text-lg font-bold">⚠ אין לקטוף לפני {formatCalendarDate(blockedUntil)}</p>
        <p className="mt-1 text-sm">ימי ההמתנה מהריסוס האחרון עוד לא עברו. קטיף מותר החל מהתאריך הזה, לפי הרשומות ביומן.</p>
      </section>
    );
  }
  return (
    <section aria-label="מצב הקטיף" className="border-s-4 border-leaf bg-leaf-soft px-4 py-3 text-leaf">
      <p className="font-bold">✓ לפי היומן אין ריסוס שימי ההמתנה שלו עוד לא עברו</p>
      <p className="mt-1 text-sm text-ink">המצב מחושב רק מהריסוסים שנרשמו כאן.</p>
    </section>
  );
}

/** מצב הטופס - מחרוזות כמו בשדות; ההמרה למספרים קורית בשליחה */
interface LogFormState {
  type: FieldLogType;
  appliedOn: string;
  productName: string;
  activeIngredient: string;
  dosePerDunam: string;
  doseUnit: DoseUnit | "";
  phiDays: string;
  notes: string;
  /** אישור שהמינון וימי ההמתנה נבדקו מול תווית התכשיר - חובה בריסוס */
  labelChecked: boolean;
}

type LogFormErrors = Partial<Record<"appliedOn" | "productName" | "dosePerDunam" | "phiDays" | "labelChecked", string>>;

/** מצב התחלתי: מהמילוי של האבחון (התכשיר הראשון בהמלצה), או טופס ריק */
function initialLogForm(today: string, prefill: JournalPrefill | null): LogFormState {
  const first = prefill?.options[0];
  return {
    type: "SPRAY",
    appliedOn: today,
    productName: first?.productName ?? "",
    activeIngredient: first?.activeIngredient ?? "",
    dosePerDunam: "",
    doseUnit: "",
    phiDays: first?.phiDays != null ? String(first.phiDays) : "",
    notes: prefill ? `טיפול נגד ${prefill.diseaseNameHe}` : "",
    labelChecked: false,
  };
}

/** טופס רשומה חדשה ביומן, עם תצוגה מקדימה של תאריך הקטיף המותר */
function LogForm({
  fieldId,
  today,
  areaDunams,
  prefill,
  onSaved,
  onCancel,
}: {
  fieldId: string;
  today: string;
  areaDunams: number | null;
  prefill: JournalPrefill | null;
  onSaved: (log: FieldLogDto) => void | Promise<void>;
  onCancel: () => void;
}) {
  const titleId = useId();
  const [form, setForm] = useState<LogFormState>(() => initialLogForm(today, prefill));
  const [optionIndex, setOptionIndex] = useState(0);
  const [errors, setErrors] = useState<LogFormErrors>({});
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isSpray = form.type === "SPRAY";
  const set = <K extends keyof LogFormState>(key: K, value: LogFormState[K]) => setForm((current) => ({ ...current, [key]: value }));

  // תצוגה מקדימה: תאריך הריסוס + ימי ההמתנה (השרת מחשב את אותו דבר בעצמו)
  const phi = Number(form.phiDays);
  const previewDate =
    isSpray && form.appliedOn && form.phiDays.trim() !== "" && Number.isInteger(phi) && phi >= 0 ? addDays(form.appliedOn, phi) : null;

  // סה"כ כמות לחלקה כולה, כשידוע השטח - עוזר להכין את מיכל הריסוס
  const dose = Number(form.dosePerDunam);
  const totalForField = areaDunams != null && form.doseUnit && form.dosePerDunam.trim() !== "" && dose > 0 ? dose * areaDunams : null;

  /** בחירת תכשיר מההמלצה ממלאת את השם, החומר הפעיל וימי ההמתנה */
  const chooseOption = (index: number) => {
    setOptionIndex(index);
    const option = prefill?.options[index];
    if (!option) return;
    setForm((current) => ({
      ...current,
      productName: option.productName,
      activeIngredient: option.activeIngredient,
      phiDays: option.phiDays != null ? String(option.phiDays) : "",
    }));
  };

  const validate = (): boolean => {
    const next: LogFormErrors = {};
    if (!form.appliedOn) next.appliedOn = "נא לבחור תאריך.";
    else if (form.appliedOn > today) next.appliedOn = "אי אפשר לרשום פעולה בתאריך עתידי.";
    if (isSpray && !form.productName.trim()) next.productName = "נא לרשום את שם התכשיר.";
    if (form.dosePerDunam.trim() !== "" && (Number.isNaN(dose) || dose <= 0)) next.dosePerDunam = "מינון הוא מספר גדול מאפס.";
    else if ((form.dosePerDunam.trim() === "") !== (form.doseUnit === "")) next.dosePerDunam = "נא למלא גם מינון וגם יחידה (או אף אחד מהם).";
    if (isSpray && (form.phiDays.trim() === "" || !Number.isInteger(phi) || phi < 0 || phi > 365)) {
      next.phiDays = "ימי המתנה הם מספר שלם בין 0 ל-365 - מופיע בתווית התכשיר.";
    }
    if (isSpray && !form.labelChecked) next.labelChecked = "חובה לאשר שבדקתם את התווית לפני שמירת ריסוס.";
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    if (!validate()) return;
    setSubmitting(true);
    try {
      const log = await api.createFieldLog(fieldId, {
        type: form.type,
        appliedOn: form.appliedOn,
        productName: form.productName.trim() || null,
        activeIngredient: form.activeIngredient.trim() || null,
        dosePerDunam: form.dosePerDunam.trim() === "" ? null : dose,
        doseUnit: form.doseUnit || null,
        phiDays: isSpray ? phi : null,
        diagnosisId: prefill?.diagnosisId ?? null,
        notes: form.notes.trim() || null,
      });
      await onSaved(log);
    } catch (err) {
      setError(errorMessageHe(err));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={onSubmit} noValidate aria-labelledby={titleId} className="flex flex-col gap-4 border-t-4 border-leaf bg-white p-5 sm:p-6">
      <h2 id={titleId} className="text-2xl font-bold">
        רשומה חדשה ביומן
      </h2>
      {prefill && (
        <p className="border-s-4 border-leaf bg-leaf-soft px-4 py-2">
          מולא אוטומטית מהאבחון: <strong>{prefill.diseaseNameHe}</strong>
        </p>
      )}
      {error && <Notice>{error}</Notice>}

      <div className="grid gap-4 sm:grid-cols-2">
        <SelectField
          label="סוג הפעולה"
          value={form.type}
          onChange={(e) => {
            const type = e.target.value as FieldLogType;
            // ימי המתנה ואישור התווית שייכים רק לריסוס
            setForm((current) => ({ ...current, type, ...(type === "SPRAY" ? {} : { phiDays: "", labelChecked: false }) }));
          }}
        >
          {FIELD_LOG_TYPES.map((type) => (
            <option key={type.value} value={type.value}>
              {type.labelHe}
            </option>
          ))}
        </SelectField>
        <TextField label="תאריך הביצוע" type="date" max={today} value={form.appliedOn} error={errors.appliedOn} onChange={(e) => set("appliedOn", e.target.value)} />
      </div>

      {isSpray && prefill && prefill.options.length > 0 && (
        <SelectField label="תכשיר מההמלצה" value={String(optionIndex)} onChange={(e) => chooseOption(Number(e.target.value))}>
          {prefill.options.map((option, index) => (
            <option key={`${option.productName}-${option.activeIngredient}`} value={index}>
              {option.productName} ({option.activeIngredientHe})
            </option>
          ))}
        </SelectField>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label={isSpray ? "שם התכשיר" : "שם המוצר (לא חובה)"}
          value={form.productName}
          error={errors.productName}
          onChange={(e) => set("productName", e.target.value)}
        />
        <TextField label="חומר פעיל (לא חובה)" dir="ltr" value={form.activeIngredient} onChange={(e) => set("activeIngredient", e.target.value)} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="מינון לדונם"
          inputMode="decimal"
          dir="ltr"
          value={form.dosePerDunam}
          error={errors.dosePerDunam}
          hint={totalForField !== null ? `לכל החלקה: ${totalForField.toLocaleString("he-IL", { maximumFractionDigits: 2 })} ${doseUnitLabelHe(form.doseUnit as DoseUnit)}` : undefined}
          onChange={(e) => set("dosePerDunam", e.target.value)}
        />
        <SelectField label="יחידה" value={form.doseUnit} onChange={(e) => set("doseUnit", e.target.value as DoseUnit | "")}>
          <option value="">בחרו יחידה</option>
          {DOSE_UNITS.map((unit) => (
            <option key={unit.value} value={unit.value}>
              {unit.labelHe}
            </option>
          ))}
        </SelectField>
      </div>

      {/* ★ PHI: ימי ההמתנה ותצוגה מקדימה של תאריך הקטיף המותר */}
      {isSpray && (
        <div className="flex flex-col gap-3 border-s-4 border-straw bg-straw-soft p-4">
          <TextField
            label="ימי המתנה לקטיף (PHI)"
            inputMode="numeric"
            dir="ltr"
            value={form.phiDays}
            error={errors.phiDays}
            hint={prefill ? "מולא מהמערכת כערך דוגמה. ימי ההמתנה משתנים לפי גידול - יש לבדוק בתווית התכשיר." : "כפי שמופיע בתווית התכשיר לגידול הזה."}
            onChange={(e) => set("phiDays", e.target.value)}
          />
          {previewDate && (
            <p className="font-semibold text-straw-ink">קטיף מותר החל מ-{formatCalendarDate(previewDate)}</p>
          )}
          <label className="flex items-start gap-2">
            <input
              type="checkbox"
              checked={form.labelChecked}
              onChange={(e) => set("labelChecked", e.target.checked)}
              aria-invalid={Boolean(errors.labelChecked)}
              className="mt-1 size-4 accent-leaf"
            />
            <span>בדקתי את המינון ואת ימי ההמתנה מול תווית התכשיר</span>
          </label>
          {errors.labelChecked && <p className="text-sm text-blight">{errors.labelChecked}</p>}
        </div>
      )}

      <TextAreaField label="הערות" value={form.notes} maxLength={1000} onChange={(e) => set("notes", e.target.value)} />

      <div className="flex gap-3">
        <Button type="submit" disabled={submitting}>
          {submitting ? "שומר…" : "שמירה ביומן"}
        </Button>
        <Button variant="secondary" onClick={onCancel} disabled={submitting}>
          ביטול
        </Button>
      </div>
    </form>
  );
}

/** רשומה ביומן: סוג, תאריך, תכשיר, מינון, ימי המתנה ותאריך קטיף (מודגש אם עוד לא הגיע), ומחיקה עם אישור */
function LogRow({ log, today, canEdit, onDelete }: { log: FieldLogDto; today: string; canEdit: boolean; onDelete: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const active = log.safeHarvestDate !== null && log.safeHarvestDate > today;

  const remove = async () => {
    setBusy(true);
    setError(null);
    try {
      await onDelete();
    } catch (err) {
      setError(errorMessageHe(err));
      setBusy(false);
    }
  };

  return (
    <li className="flex flex-col gap-1.5 px-4 py-4">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4">
        <p className="font-bold">
          <span className="me-2 rounded-[var(--radius-label)] bg-paper-deep px-2 text-sm font-medium">{logTypeLabelHe(log.type)}</span>
          {log.productName ?? logTypeLabelHe(log.type)}
        </p>
        <p className="text-sm text-soil">{formatCalendarDate(log.appliedOn)}</p>
      </div>
      {log.activeIngredient && (
        <p className="text-sm">
          {log.activeIngredientHe ?? (
            <span dir="ltr" lang="en">
              {log.activeIngredient}
            </span>
          )}
        </p>
      )}
      {log.dosePerDunam != null && log.doseUnit && (
        <p className="text-sm">
          מינון: <bdi dir="ltr">{log.dosePerDunam}</bdi> {doseUnitLabelHe(log.doseUnit)} לדונם
        </p>
      )}
      {log.phiDays != null && log.safeHarvestDate && (
        <p className={`text-sm ${active ? "font-semibold text-straw-ink" : "text-soil"}`}>
          ימי המתנה: {log.phiDays} · קטיף מותר החל מ-{formatCalendarDate(log.safeHarvestDate)}
          {active && " (עוד לא עברו)"}
        </p>
      )}
      {log.disease && <p className="text-sm text-soil">בעקבות אבחון: {log.disease.displayNameHe}</p>}
      {log.notes && <p className="max-w-prose text-sm text-soil">{log.notes}</p>}
      {error && <Notice>{error}</Notice>}
      {canEdit &&
        (confirming ? (
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-sm font-semibold">למחוק את הרשומה?</span>
            <Button variant="danger" className="px-3 py-1 text-sm" onClick={remove} disabled={busy}>
              {busy ? "מוחק…" : "כן, למחוק"}
            </Button>
            <Button variant="quiet" onClick={() => setConfirming(false)} disabled={busy}>
              ביטול
            </Button>
          </div>
        ) : (
          <div>
            <Button variant="quiet" onClick={() => setConfirming(true)}>
              מחיקת הרשומה
            </Button>
          </div>
        ))}
    </li>
  );
}
