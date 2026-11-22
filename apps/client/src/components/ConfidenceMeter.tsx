/**
 * מד ודאות: פס שמתמלא מימין, עם סימון של סף הוודאות (50%).
 * מתחת לסף - הפס בצבע קש (אזהרה); מעליו - בצבע הסטטוס של התוצאה.
 */

import { formatPercent } from "../lib/format";

/** חייב להתאים ל-AI_ENGINE_CONFIDENCE_THRESHOLD בשירות ה-AI */
export const CONFIDENCE_THRESHOLD_PERCENT = 50;

export function ConfidenceMeter({
  percent,
  uncertain,
  tone,
}: {
  percent: number;
  uncertain: boolean;
  tone: "healthy" | "infected";
}) {
  const fill = uncertain ? "bg-straw" : tone === "healthy" ? "bg-leaf" : "bg-blight";
  return (
    <div>
      <div className="flex items-baseline justify-between">
        <span id="confidence-label" className="font-medium">
          ודאות המודל
        </span>
        <span className="font-display text-2xl font-bold tabular-nums">{formatPercent(percent)}</span>
      </div>
      {/* <meter> אמיתי לקוראי מסך; הפס הצבעוני שמתחתיו הוא רק התצוגה */}
      <meter
        className="sr-only"
        aria-labelledby="confidence-label"
        min={0}
        max={100}
        low={CONFIDENCE_THRESHOLD_PERCENT}
        optimum={100}
        value={percent}
        aria-valuetext={`${formatPercent(percent)}${uncertain ? " - ודאות נמוכה" : ""}`}
      />
      <div className="relative mt-2 h-3 bg-paper-deep" aria-hidden="true">
        <div className={`absolute inset-y-0 start-0 ${fill}`} style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
        {/* סימון הסף */}
        <div className="absolute -inset-y-1 w-0.5 bg-ink" style={{ insetInlineStart: `${CONFIDENCE_THRESHOLD_PERCENT}%` }} />
      </div>
      <p className="mt-1 text-xs text-soil">הקו מסמן את סף הוודאות ({CONFIDENCE_THRESHOLD_PERCENT}%)</p>
    </div>
  );
}
