/**
 * כרטיס התוצאה - "תווית דגימה":
 *   פס סטטוס בצבע התוצאה, שם המחלה בעברית (גדול), השם באנגלית, השם המדעי בנטוי,
 *   מד ודאות, הנחיית טיפול, וחומרים פעילים עם טווחי מחירים על סקאלה משותפת בשקלים.
 */

import type { DiagnoseResponse, TreatmentOption } from "@cropguard/shared-types";

import { formatPriceRange } from "../lib/format";
import { ConfidenceMeter } from "./ConfidenceMeter";

export function DiagnosisResult({ result }: { result: DiagnoseResponse }) {
  const tone = result.isHealthy ? "healthy" : "infected";
  const band = result.isHealthy ? "bg-leaf" : "bg-blight";

  return (
    <article aria-labelledby="result-title" className="overflow-hidden border-2 border-ink bg-white">
      {/* פס הסטטוס - הרגע האנימטיבי היחיד באפליקציה */}
      <div className="relative h-11 bg-paper-deep">
        <div
          className={`absolute inset-0 origin-right ${band}`}
          style={{ animation: "band-fill 600ms cubic-bezier(.2,.7,.2,1) both" }}
          aria-hidden="true"
        />
        <p className="relative flex h-full items-center px-5 font-semibold text-white">
          {result.isHealthy ? "✓ " : "⚠ "}
          {result.statusHe}
        </p>
      </div>

      <div className="flex flex-col gap-6 p-5 sm:p-7">
        {/* שם המחלה */}
        <header>
          <p className="text-soil">{result.disease.plantHe}</p>
          <h2 id="result-title" className="font-display text-4xl font-bold sm:text-5xl">
            {result.disease.nameHe}
          </h2>
          <p dir="ltr" className="mt-2 text-end text-ink">
            {result.disease.nameEn}
          </p>
          {result.disease.scientificName && (
            <p dir="ltr" lang="la" className="text-end font-latin text-lg text-soil italic">
              {result.disease.scientificName}
            </p>
          )}
        </header>

        <ConfidenceMeter percent={result.confidencePercent} uncertain={result.uncertain} tone={tone} />

        {result.warningsHe.length > 0 && (
          <ul className="flex flex-col gap-2" aria-label="אזהרות">
            {result.warningsHe.map((warning) => (
              <li key={warning} className="border-s-4 border-straw bg-straw-soft px-4 py-2 text-straw-ink">
                {warning}
              </li>
            ))}
          </ul>
        )}

        <section aria-labelledby="guidance-title" className="border-t border-line pt-5">
          <h3 id="guidance-title" className="text-xl font-bold">
            הנחיית טיפול
          </h3>
          <p className="mt-2 max-w-prose">{result.guidanceHe}</p>
        </section>

        {result.treatments.length > 0 && <Treatments treatments={result.treatments} />}

        {!result.isHealthy && !result.chemicalControl && (
          <p className="border-t border-line pt-5 text-soil">אין טיפול כימי שמרפא את המחלה הזו, ולכן לא מוצגים תכשירים.</p>
        )}

        <p className="border-t border-line pt-4 text-sm text-soil">{result.disclaimerHe}</p>
      </div>
    </article>
  );
}

function Treatments({ treatments }: { treatments: TreatmentOption[] }) {
  // סקאלה משותפת לכל המוצרים, כדי שאפשר יהיה להשוות טווחי מחירים במבט אחד
  const scaleMax = Math.max(...treatments.flatMap((t) => t.products.map((p) => p.maxPriceILS)), 1);

  return (
    <section aria-labelledby="treatments-title" className="border-t border-line pt-5">
      <h3 id="treatments-title" className="text-xl font-bold">
        חומרים פעילים ומחירים
      </h3>
      <ul className="mt-3 flex flex-col gap-5">
        {treatments.map((treatment, index) => (
          <li key={treatment.activeIngredient}>
            <div className="flex flex-wrap items-baseline gap-x-3">
              <span className="text-lg font-semibold">{treatment.activeIngredientHe}</span>
              <span dir="ltr" className="text-sm text-soil">
                {treatment.activeIngredient}
              </span>
              {index === 0 && (
                <span className="rounded-[var(--radius-label)] bg-leaf-soft px-2 text-sm font-medium text-leaf">
                  חומר פעיל מומלץ
                </span>
              )}
            </div>
            {treatment.products.length === 0 ? (
              <p className="mt-1 text-sm text-soil">אין עדיין מחיר במערכת לחומר הזה.</p>
            ) : (
              <ul className="mt-2 flex flex-col gap-2">
                {treatment.products.map((product) => (
                  <li key={`${product.productName}-${product.packageSize}`} className="grid grid-cols-[1fr_auto] gap-x-4">
                    <span>
                      <span dir="ltr" className="font-medium">
                        {product.productName}
                      </span>
                      <span className="ms-2 text-sm text-soil">
                        אריזת <bdi dir="ltr">{product.packageSize}</bdi>
                      </span>
                    </span>
                    <span className="font-semibold tabular-nums">
                      {/* bdi: בלי זה, בטקסט מימין לשמאל "₪110–180" מוצג הפוך כ-"180–₪110" */}
                      <bdi dir="ltr">{formatPriceRange(product.minPriceILS, product.maxPriceILS)}</bdi>
                      {!product.isVerified && (
                        <span className="me-0 ms-1 text-straw-ink" title="מחיר לא מאומת">
                          *
                        </span>
                      )}
                    </span>
                    {/* פס הטווח על הסקאלה המשותפת */}
                    <div className="relative col-span-2 mt-1 h-2 bg-paper-deep" aria-hidden="true">
                      <div
                        className="absolute inset-y-0 bg-straw"
                        style={{
                          insetInlineStart: `${(product.minPriceILS / scaleMax) * 100}%`,
                          width: `${Math.max(2, ((product.maxPriceILS - product.minPriceILS) / scaleMax) * 100)}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
      {treatments.some((t) => t.products.some((p) => !p.isVerified)) && (
        <p className="mt-3 text-sm text-straw-ink">* מחיר משוער שעדיין לא אומת מול מחירון ספק</p>
      )}
    </section>
  );
}
