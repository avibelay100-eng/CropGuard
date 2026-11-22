import type { NewsResponse } from "@cropguard/shared-types";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { farmer, renderApp } from "../test/utils";

const news: NewsResponse = {
  items: [
    {
      id: "n1",
      title: "מחקר ישראלי: אשלגן בקרקע זמין לצמחים",
      summary: "חוקרים מצאו שבדיקות הקרקע מפספסות חלק מהאשלגן.",
      link: "https://www.hayadan.org.il/potassium",
      publishedAt: "2026-11-15T06:00:00.000Z",
      sourceId: "hayadan",
      sourceName: "הידען",
      language: "he",
    },
    {
      id: "n2",
      title: "Device measures strawberry skin strength",
      summary: "A new tool will help breeders.",
      link: "https://phys.org/strawberry",
      publishedAt: "2026-11-21T06:00:00.000Z",
      sourceId: "physorg",
      sourceName: "Phys.org",
      language: "en",
    },
  ],
  sources: [
    { id: "hayadan", name: "הידען", homepage: "https://www.hayadan.org.il", language: "he", ok: true, itemCount: 1 },
    { id: "physorg", name: "Phys.org", homepage: "https://phys.org", language: "en", ok: true, itemCount: 1 },
    { id: "zavit", name: "זווית", homepage: "https://www.zavit.org.il", language: "he", ok: false, itemCount: 0 },
  ],
  fetchedAt: "2026-11-22T10:00:00.000Z",
};

describe("news page", () => {
  it("is reachable from the navigation", async () => {
    const user = userEvent.setup();
    renderApp("/fields", { user: farmer, routes: [{ path: "/fields", body: { items: [] } }, { path: "/news", body: news }] });
    const nav = (await screen.findAllByRole("navigation", { name: "ניווט ראשי" }))[0]!;
    await user.click(within(nav).getByRole("link", { name: "חדשות" }));
    expect(await screen.findByRole("heading", { level: 1, name: "חדשות חקלאות ומדע" })).toBeInTheDocument();
  });

  it("lists articles with safe external links and the right language", async () => {
    renderApp("/news", { user: farmer, routes: [{ path: "/news", body: news }] });

    const list = await screen.findByRole("list", { name: "כתבות" });
    const articles = within(list).getAllByRole("article");
    expect(articles).toHaveLength(2);

    const hebrewLink = within(articles[0]!).getByRole("link", { name: /אשלגן בקרקע/ });
    expect(hebrewLink).toHaveAttribute("href", "https://www.hayadan.org.il/potassium");
    expect(hebrewLink).toHaveAttribute("target", "_blank");
    expect(hebrewLink).toHaveAttribute("rel", "noopener noreferrer");
    expect(hebrewLink).toHaveAccessibleName(/נפתח בלשונית חדשה/);

    const englishLink = within(articles[1]!).getByRole("link", { name: /strawberry/ });
    expect(englishLink.closest("[lang]")).toHaveAttribute("lang", "en");
    expect(englishLink.closest("[dir]")).toHaveAttribute("dir", "ltr");
    expect(within(articles[1]!).getByText("Phys.org")).toBeInTheDocument();
  });

  it("filters by language", async () => {
    const user = userEvent.setup();
    renderApp("/news", { user: farmer, routes: [{ path: "/news", body: news }] });

    await screen.findByRole("list", { name: "כתבות" });
    await user.click(screen.getByLabelText("עברית"));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /אשלגן/ })).toBeInTheDocument();

    await user.click(screen.getByLabelText("English"));
    expect(screen.getAllByRole("article")).toHaveLength(1);
    expect(screen.getByRole("link", { name: /strawberry/ })).toBeInTheDocument();
  });

  it("says when some sources are down and credits every source", async () => {
    renderApp("/news", { user: farmer, routes: [{ path: "/news", body: news }] });
    expect(await screen.findByText(/חלק מהמקורות לא זמינים כרגע \(זווית\)/)).toBeInTheDocument();
    for (const name of ["הידען", "Phys.org", "זווית"]) {
      expect(screen.getByRole("contentinfo")).toHaveTextContent(name);
    }
  });

  it("shows a Hebrew error when the news cannot be loaded", async () => {
    renderApp("/news", {
      user: farmer,
      routes: [{ path: "/news", status: 500, body: { error: "internal_error", detail: "x" } }],
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("אירעה שגיאה בשרת");
  });
});
