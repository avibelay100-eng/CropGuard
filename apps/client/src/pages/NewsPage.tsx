/**
 * חדשות חקלאות ומדע מהארץ ומהעולם.
 * הכותרות מגיעות משרת הליבה (שאוסף אותן מהזנות RSS של המקורות); כל כתבה נפתחת באתר המקור.
 */

import type { NewsItem, NewsLanguage, NewsResponse } from "@cropguard/shared-types";
import { useEffect, useState } from "react";

import { api, errorMessageHe } from "../api/client";
import { Notice, PageHeader, Spinner } from "../components/ui";
import { formatDate } from "../lib/format";

const LANGUAGE_OPTIONS: ReadonlyArray<{ value: NewsLanguage | ""; label: string }> = [
  { value: "", label: "הכול" },
  { value: "he", label: "עברית" },
  { value: "en", label: "English" },
];

export function NewsPage() {
  const [news, setNews] = useState<NewsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [language, setLanguage] = useState<NewsLanguage | "">("");

  // טוענים פעם אחת את כל הכתבות; הסינון לפי שפה מקומי (הכול כבר בזיכרון)
  useEffect(() => {
    api
      .listNews()
      .then(setNews)
      .catch((err: unknown) => setError(errorMessageHe(err)));
  }, []);

  const items = news ? news.items.filter((item) => !language || item.language === language) : [];
  const failedSources = news?.sources.filter((source) => !source.ok) ?? [];

  return (
    <>
      <PageHeader title="חדשות חקלאות ומדע">
        מחקרים וחדשות מהארץ ומהעולם על חקלאות, צמחים ומזון. כל כתבה נפתחת באתר המקור.
      </PageHeader>

      <fieldset className="mb-6">
        <legend className="mb-1.5 font-medium">שפה</legend>
        <div className="inline-flex border-[1.5px] border-line bg-white">
          {LANGUAGE_OPTIONS.map((option) => (
            <label
              key={option.value || "all"}
              className={`cursor-pointer px-4 py-2 has-[:focus-visible]:outline-3 has-[:focus-visible]:outline-straw ${
                language === option.value ? "bg-ink text-white" : "text-ink hover:bg-paper-deep"
              }`}
            >
              <input
                type="radio"
                name="language"
                value={option.value}
                checked={language === option.value}
                onChange={() => setLanguage(option.value)}
                className="sr-only"
              />
              <span lang={option.value === "en" ? "en" : undefined}>{option.label}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {error && <Notice>{error}</Notice>}
      {!news && !error && <Spinner label="טוען חדשות…" />}

      {news && failedSources.length > 0 && failedSources.length < news.sources.length && (
        <div className="mb-4">
          <Notice tone="warning">
            חלק מהמקורות לא זמינים כרגע ({failedSources.map((s) => s.name).join(", ")}). שאר החדשות מוצגות.
          </Notice>
        </div>
      )}

      {news && items.length === 0 && (
        <div className="border-s-4 border-line bg-white p-6">
          <p>אין כרגע כתבות להצגה. נסו שוב מאוחר יותר.</p>
        </div>
      )}

      {items.length > 0 && (
        <ol className="flex flex-col gap-4" aria-label="כתבות">
          {items.map((item) => (
            <li key={item.id}>
              <NewsCard item={item} />
            </li>
          ))}
        </ol>
      )}

      {news && (
        <footer className="mt-8 border-t border-line pt-4 text-sm text-soil">
          <p>
            הכותרות והתקצירים מגיעים מהזנות ה-RSS הציבוריות של:{" "}
            {news.sources.map((source, index) => (
              <span key={source.id}>
                {index > 0 && ", "}
                <a
                  href={source.homepage}
                  target="_blank"
                  rel="noopener noreferrer"
                  lang={source.language}
                  className="text-leaf underline underline-offset-4"
                >
                  {source.name}
                </a>
              </span>
            ))}
            . עודכן ב-<time dateTime={news.fetchedAt}>{formatDate(news.fetchedAt)}</time>.
          </p>
        </footer>
      )}
    </>
  );
}

function NewsCard({ item }: { item: NewsItem }) {
  const english = item.language === "en";
  return (
    <article className="border border-line bg-white p-5 hover:border-leaf">
      <p className="flex flex-wrap items-center gap-x-3 text-sm text-soil">
        <span lang={item.language} className="font-semibold text-ink">
          {item.sourceName}
        </span>
        {english && (
          <span className="rounded-[var(--radius-label)] bg-paper-deep px-2 text-xs" lang="en">
            English
          </span>
        )}
        {item.publishedAt && <time dateTime={item.publishedAt}>{formatDate(item.publishedAt)}</time>}
      </p>
      {/* כתבה באנגלית: כיוון וקריאה משמאל לימין, וקורא המסך מבטא באנגלית */}
      <div lang={item.language} dir={english ? "ltr" : "rtl"} className="mt-2">
        <h2 className="font-display text-xl leading-snug font-bold">
          <a
            href={item.link}
            target="_blank"
            rel="noopener noreferrer"
            className="text-ink underline-offset-4 hover:text-leaf hover:underline"
          >
            {item.title}
            <span aria-hidden="true" className="ms-1 text-base text-soil">
              ↗
            </span>
            <span className="sr-only" lang="he" dir="rtl">
              {" "}
              (נפתח בלשונית חדשה)
            </span>
          </a>
        </h2>
        {item.summary && <p className="mt-2 max-w-prose text-soil">{item.summary}</p>}
      </div>
    </article>
  );
}
