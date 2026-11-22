/**
 * היסטוריית אבחונים: מהחדש לישן, עם סינון לפי חלקה ולפי מצב (נגוע/בריא),
 * וטעינה של עוד תוצאות בלחיצה.
 * הסינון נשמר בכתובת (?fieldId=&status=), כך שאפשר לקשר אליו - למשל ממסך החלקות.
 */

import { useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router";

import { api, errorMessageHe } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Button, Notice, PageHeader, SelectField, Spinner } from "../components/ui";
import { cropLabelHe } from "../lib/crops";
import { formatDateTime, formatPercent } from "../lib/format";

const PAGE_SIZE = 20;

const STATUS_OPTIONS = [
  { value: "", label: "הכול" },
  { value: "infected", label: "נגוע" },
  { value: "healthy", label: "בריא" },
];

/** ערך הסינון מהכתובת -> ערך חוקי בלבד (כל ערך אחר = הכול) */
function parseStatus(value) {
  return value === "healthy" || value === "infected" ? value : "";
}

/** מסך ההיסטוריה: הסינון חי בכתובת (שיתוף/קישור), והתוצאות מסומנות לפי הסינון שלהן - בלי איפוס state בתוך effect */
export function HistoryPage() {
  const { user } = useAuth();
  // שם החקלאי רלוונטי רק למי שרואה אבחונים של כמה חקלאים
  const showFarmer = user?.role === "AGRONOMIST" || user?.role === "ADMIN";
  // מוחקים רק נתונים של עצמנו; מנהל יכול למחוק הכול (כמו הכלל בשרת)
  const canDelete = (item) => user?.role === "ADMIN" || item.farmer.id === user?.id;
  const [deletedMessage, setDeletedMessage] = useState(null);
  const [params, setParams] = useSearchParams();
  const fieldId = params.get("fieldId") ?? "";
  const status = parseStatus(params.get("status"));

  const [fields, setFields] = useState([]);
  // כל תוצאה זוכרת לאיזה סינון היא שייכת. כשהסינון משתנה, התוצאה הישנה כבר לא "שלנו"
  // והמסך מציג טעינה - בלי לאפס state בתוך effect.
  const filterKey = `${fieldId}|${status}`;
  const [page, setPage] = useState(null);
  const [failure, setFailure] = useState(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const items = page?.key === filterKey ? page.items : null;
  const total = page?.key === filterKey ? page.total : 0;
  const error = failure?.key === filterKey ? failure.message : null;

  useEffect(() => {
    api
      .listFields()
      .then(({ items: list }) => setFields(list))
      .catch(() => setFields([]));
  }, []);

  // בכל שינוי סינון - טוענים את העמוד הראשון מחדש
  useEffect(() => {
    let cancelled = false;
    const key = `${fieldId}|${status}`;
    api
      .listDiagnoses({ fieldId: fieldId || undefined, status: status || undefined, limit: PAGE_SIZE, offset: 0 })
      .then((result) => {
        if (!cancelled) setPage({ key, items: result.items, total: result.total });
      })
      .catch((err) => {
        if (!cancelled) setFailure({ key, message: errorMessageHe(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [fieldId, status]);

  const onDeleted = (id) => {
    setPage((current) =>
      current ? { ...current, items: current.items.filter((item) => item.id !== id), total: current.total - 1 } : current,
    );
    setDeletedMessage("האבחון נמחק.");
  };

  const setFilter = (key, value) => {
    setDeletedMessage(null);
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, { replace: true });
  };

  const loadMore = async () => {
    if (!items) return;
    setLoadingMore(true);
    try {
      const next = await api.listDiagnoses({
        fieldId: fieldId || undefined,
        status: status || undefined,
        limit: PAGE_SIZE,
        offset: items.length,
      });
      setPage({ key: filterKey, items: [...items, ...next.items], total: next.total });
    } catch (err) {
      setFailure({ key: filterKey, message: errorMessageHe(err) });
    } finally {
      setLoadingMore(false);
    }
  };

  const filtered = Boolean(fieldId || status);

  return (
    <>
      <PageHeader title="היסטוריית אבחונים" />

      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div className="min-w-56 flex-1">
          <SelectField label="חלקה" value={fieldId} onChange={(e) => setFilter("fieldId", e.target.value)}>
            <option value="">כל החלקות</option>
            {fields.map((field) => (
              <option key={field.id} value={field.id}>
                {field.name} ({cropLabelHe(field.cropType)})
              </option>
            ))}
          </SelectField>
        </div>
        <fieldset>
          <legend className="mb-1.5 font-medium">מצב</legend>
          <div className="flex border-[1.5px] border-line bg-white">
            {STATUS_OPTIONS.map((option) => (
              <label
                key={option.value || "all"}
                className={`cursor-pointer px-4 py-2 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-straw ${
                  status === option.value ? "bg-ink text-white" : "text-ink hover:bg-paper-deep"
                }`}
              >
                <input
                  type="radio"
                  name="status"
                  value={option.value}
                  checked={status === option.value}
                  onChange={() => setFilter("status", option.value)}
                  className="sr-only"
                />
                {option.label}
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {error && <Notice>{error}</Notice>}
      {deletedMessage && (
        <div className="mb-4">
          <Notice tone="info">{deletedMessage}</Notice>
        </div>
      )}
      {!items && !error && <Spinner label="טוען אבחונים…" />}

      {items && items.length === 0 && (
        <div className="border-s-4 border-line bg-white p-6">
          {filtered ? (
            <p>אין אבחונים שמתאימים לסינון הזה.</p>
          ) : (
            <>
              <p className="text-lg">עוד אין אבחונים. כל סריקה שתעשו תופיע כאן.</p>
              <Link to="/scan" className="mt-3 inline-block font-semibold text-leaf underline underline-offset-4">
                לסריקת עלה
              </Link>
            </>
          )}
        </div>
      )}

      {items && items.length > 0 && (
        <>
          <p className="mb-2 text-sm text-soil" aria-live="polite">
            מוצגים {items.length} מתוך {total}
          </p>
          <ol className="divide-y divide-line border-y border-line bg-white" aria-label="אבחונים">
            {items.map((item) => (
              <HistoryRow
                key={item.id}
                item={item}
                showFarmer={showFarmer}
                canDelete={canDelete(item)}
                onDeleted={onDeleted}
              />
            ))}
          </ol>
          {items.length < total && (
            <div className="mt-4">
              <Button variant="secondary" onClick={loadMore} disabled={loadingMore}>
                {loadingMore ? "טוען…" : "טעינת אבחונים נוספים"}
              </Button>
            </div>
          )}
        </>
      )}
    </>
  );
}

/** שורת אבחון, עם סימון אי-התאמה לגידול, ומחיקה עם אישור בתוך השורה (המיקוד עובר לאישור וחוזר בביטול) */
function HistoryRow({
  item,
  showFarmer,
  canDelete,
  onDeleted,
}) {
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState(null);
  const deleteButton = useRef(null);
  const cancelButton = useRef(null);

  // כשנפתח האישור - המיקוד עובר אליו; בביטול - חוזר לכפתור המחיקה
  useEffect(() => {
    if (confirming) cancelButton.current?.focus();
  }, [confirming]);

  const cancel = () => {
    setConfirming(false);
    setError(null);
    requestAnimationFrame(() => deleteButton.current?.focus());
  };

  const confirmDelete = async () => {
    setDeleting(true);
    setError(null);
    try {
      await api.deleteDiagnosis(item.id);
      onDeleted(item.id);
    } catch (err) {
      setError(errorMessageHe(err));
      setDeleting(false);
    }
  };

  return (
    <li className="grid grid-cols-[auto_1fr_auto] items-start gap-x-4 px-4 py-4">
      {/* פס צבע בצד: ירוק לבריא, אדום לנגוע */}
      <span className={`mt-1 h-12 w-1.5 ${item.isHealthy ? "bg-leaf" : "bg-blight"}`}>
        <span className="sr-only">{item.isHealthy ? "בריא" : "נגוע"}</span>
      </span>
      <div>
        <p className="font-display text-xl font-bold">{item.disease.displayNameHe}</p>
        {item.disease.scientificName && (
          <p dir="ltr" lang="la" className="text-end font-latin text-soil italic">
            {item.disease.scientificName}
          </p>
        )}
        {item.cropMismatch && (
          <p className="mt-1 inline-block bg-straw-soft px-2 text-sm text-straw-ink">⚠ לא תואם לגידול של החלקה</p>
        )}
        <p className="mt-1 text-sm text-ink">
          {item.field.name}
          {showFarmer && <span className="ms-3 text-soil">של {item.farmer.name}</span>}
        </p>
        <time dateTime={item.createdAt} className="block text-sm text-soil">
          {formatDateTime(item.createdAt)}
        </time>

        {confirming && (
          <fieldset className="mt-3 flex flex-wrap items-center gap-3 border-0 border-s-4 border-blight bg-blight-soft px-3 py-2">
            <legend className="float-start me-1 text-blight">למחוק את האבחון הזה? אי אפשר לבטל.</legend>
            <Button variant="danger" onClick={confirmDelete} disabled={deleting} className="px-3 py-1.5">
              {deleting ? "מוחק…" : "כן, למחוק"}
            </Button>
            <Button ref={cancelButton} variant="secondary" onClick={cancel} disabled={deleting} className="px-3 py-1.5">
              ביטול
            </Button>
            {error && (
              <p role="alert" className="w-full text-sm text-blight">
                {error}
              </p>
            )}
          </fieldset>
        )}
      </div>
      <div className="flex flex-col items-end gap-2">
        <p className="font-semibold tabular-nums">{formatPercent(item.confidence * 100)}</p>
        {canDelete && !confirming && (
          <Button
            ref={deleteButton}
            variant="quiet"
            onClick={() => setConfirming(true)}
            className="text-sm text-blight hover:text-blight"
            aria-label={`מחיקת האבחון ${item.disease.displayNameHe} מתאריך ${formatDateTime(item.createdAt)}`}
          >
            מחיקה
          </Button>
        )}
      </div>
    </li>
  );
}
