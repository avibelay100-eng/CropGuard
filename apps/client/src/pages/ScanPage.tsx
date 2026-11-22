/**
 * מסך הסריקה והאבחון - המסך המרכזי.
 * בוחרים חלקה ותמונה, שולחים לשרת, ומקבלים את כרטיס התוצאה.
 */

import type { DiagnoseResponse, FieldDto } from "@cropguard/shared-types";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { api, errorMessageHe } from "../api/client";
import { DiagnosisResult } from "../components/DiagnosisResult";
import { ImagePicker } from "../components/ImagePicker";
import { Button, Notice, PageHeader, SelectField, Spinner } from "../components/ui";
import { CROPS, cropLabelHe } from "../lib/crops";

export function ScanPage() {
  const [fields, setFields] = useState<FieldDto[] | null>(null);
  const [fieldsError, setFieldsError] = useState<string | null>(null);
  const [fieldId, setFieldId] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<DiagnoseResponse | null>(null);
  const resultRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    api
      .listFields()
      .then(({ items }) => {
        setFields(items);
        if (items[0]) setFieldId(items[0].id);
      })
      .catch((err: unknown) => setFieldsError(errorMessageHe(err)));
  }, []);

  // כשהתוצאה מגיעה - גוללים אליה ומעבירים אליה את המיקוד (גם לקוראי מסך)
  useEffect(() => {
    if (result) {
      resultRef.current?.scrollIntoView?.({ behavior: "smooth", block: "start" });
      resultRef.current?.focus();
    }
  }, [result]);

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!fieldId || !image) return;
    setError(null);
    setResult(null);
    setSubmitting(true);
    try {
      setResult(await api.diagnose(fieldId, image));
    } catch (err) {
      setError(errorMessageHe(err));
    } finally {
      setSubmitting(false);
    }
  };

  const startOver = () => {
    setResult(null);
    setImage(null);
    setError(null);
  };

  if (fieldsError) return <Notice>{fieldsError}</Notice>;
  if (!fields) return <Spinner label="טוען את החלקות…" />;

  if (fields.length === 0) {
    return (
      <>
        <PageHeader title="סריקת עלה" />
        <div className="border-s-4 border-leaf bg-white p-6">
          <p className="text-lg">כל אבחון נשמר בחלקה שלו. כדי להתחיל, הוסיפו את החלקה הראשונה.</p>
          <Link
            to="/fields"
            className="mt-4 inline-block rounded-[var(--radius-label)] bg-leaf px-5 py-2.5 font-semibold text-white hover:bg-leaf-dark"
          >
            הוספת חלקה
          </Link>
        </div>
      </>
    );
  }

  return (
    <>
      <PageHeader title="סריקת עלה">צלמו עלה אחד, ונגיד לכם מה מצבו ואיך לטפל בו.</PageHeader>

      {!result && (
        <form onSubmit={onSubmit} className="flex flex-col gap-5">
          <SelectField label="חלקה" value={fieldId} onChange={(e) => setFieldId(e.target.value)} disabled={submitting}>
            {fields.map((field) => (
              <option key={field.id} value={field.id}>
                {field.name} ({cropLabelHe(field.cropType)})
              </option>
            ))}
          </SelectField>

          <ImagePicker file={image} onChange={setImage} disabled={submitting} />

          {/* המודל מכיר רק את הגידולים האלה; צמח אחר (למשל כרוב) יקבל תוצאה שגויה */}
          <p className="text-sm text-soil">
            המודל מזהה 14 גידולים: {CROPS.map((crop) => crop.labelHe).join(", ")}. בצמחים אחרים, כמו כרוב או חסה, התוצאה לא תהיה
            נכונה.
          </p>

          {error && <Notice>{error}</Notice>}

          {submitting ? (
            <div className="border border-line bg-white p-5">
              <Spinner label="מנתח את העלה…" />
            </div>
          ) : (
            <Button type="submit" disabled={!image} className="py-3 text-lg">
              אבחון העלה
            </Button>
          )}
        </form>
      )}

      {result && (
        <div ref={resultRef} tabIndex={-1} className="flex flex-col gap-4 outline-none">
          <DiagnosisResult result={result} />
          <div className="flex flex-wrap gap-3">
            <Button onClick={startOver}>סריקה חדשה</Button>
            <Link
              to="/history"
              className="rounded-[var(--radius-label)] border-[1.5px] border-leaf bg-white px-5 py-2.5 font-semibold text-leaf hover:bg-leaf-soft"
            >
              להיסטוריית האבחונים
            </Link>
          </div>
        </div>
      )}
    </>
  );
}
