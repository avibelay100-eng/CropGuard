/**
 * ★ בדיקות מסך יומן השדה ו-PHI: מצב הקטיף, טופס הרשומה (כולל חובת אישור התווית בריסוס),
 * תצוגה מקדימה של תאריך הקטיף, מחיקה, הרשאות, ומילוי אוטומטי מכרטיס האבחון.
 */

import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { agronomist, farmer, field, fieldLog, lateBlightResult, mismatchResult, healthyResult, renderApp } from "../test/utils";

const TODAY = "2026-11-22";

/** תשובת GET ליומן של חלקה f-1 */
function journal(items = [fieldLog()], harvestBlockedUntil = "2026-11-27", fieldOverrides = {}) {
  return {
    path: "/fields/f-1/logs",
    body: { field: field({ logCount: items.length, harvestBlockedUntil, ...fieldOverrides }), items, today: TODAY },
  };
}

describe("field journal page", () => {
  it("shows the harvest block and the entries with PHI details", async () => {
    renderApp("/fields/f-1/journal", {
      user: farmer,
      routes: [journal([fieldLog(), fieldLog({ id: "l-2", type: "IRRIGATE", productName: null, activeIngredient: null, activeIngredientHe: null, dosePerDunam: 30, doseUnit: "m3", phiDays: null, safeHarvestDate: null, appliedOn: "2026-11-18" })])],
    });

    expect(await screen.findByRole("heading", { name: "יומן שדה – חממה 3" })).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "מצב הקטיף" })).toHaveTextContent("אין לקטוף לפני 27 בנוב׳ 2026");

    const rows = within(screen.getByRole("list", { name: "רשומות היומן" })).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("ריסוס");
    expect(rows[0]).toHaveTextContent("Ridomil Gold MZ");
    expect(rows[0]).toHaveTextContent("מטלקסיל-M + מנקוזב");
    expect(rows[0]).toHaveTextContent("מינון: 250 גרם לדונם");
    expect(rows[0]).toHaveTextContent("ימי המתנה: 7 · קטיף מותר החל מ-27 בנוב׳ 2026 (עוד לא עברו)");
    expect(rows[1]).toHaveTextContent("השקיה");
    expect(rows[1]).toHaveTextContent('מינון: 30 מ"ק לדונם');
  });

  it("says the harvest is not blocked when no spray is still in its waiting period", async () => {
    renderApp("/fields/f-1/journal", { user: farmer, routes: [journal([], null)] });
    expect(await screen.findByRole("region", { name: "מצב הקטיף" })).toHaveTextContent("אין ריסוס שימי ההמתנה שלו עוד לא עברו");
    expect(screen.getByText("אין עדיין רשומות ביומן של החלקה הזו.")).toBeInTheDocument();
  });

  it("requires PHI days and a label check for a spray, previews the safe date, and saves", async () => {
    const user = userEvent.setup();
    const saved = fieldLog({ id: "l-9", productName: "Score 250 EC", phiDays: 7, safeHarvestDate: "2026-11-29", appliedOn: TODAY });
    const { calls } = renderApp("/fields/f-1/journal", {
      user: farmer,
      routes: [journal([], null, { areaDunams: 4 }), { method: "POST", path: "/fields/f-1/logs", status: 201, body: saved }],
    });

    await user.click(await screen.findByRole("button", { name: "רשומה חדשה ביומן" }));
    const form = screen.getByRole("form", { name: "רשומה חדשה ביומן" });
    expect(within(form).getByLabelText("תאריך הביצוע")).toHaveValue(TODAY);

    // שמירה בלי שם תכשיר, בלי ימי המתנה ובלי אישור - נחסמת
    await user.click(within(form).getByRole("button", { name: "שמירה ביומן" }));
    expect(within(form).getByText("נא לרשום את שם התכשיר.")).toBeInTheDocument();
    expect(within(form).getByText(/ימי המתנה הם מספר שלם/)).toBeInTheDocument();
    expect(within(form).getByText("חובה לאשר שבדקתם את התווית לפני שמירת ריסוס.")).toBeInTheDocument();
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);

    await user.type(within(form).getByLabelText("שם התכשיר"), "Score 250 EC");
    await user.type(within(form).getByLabelText("מינון לדונם"), "50");
    await user.selectOptions(within(form).getByLabelText("יחידה"), "ml");
    // שטח החלקה ידוע - מוצגת הכמות לכל החלקה
    expect(within(form).getByText('לכל החלקה: 200 סמ"ק')).toBeInTheDocument();
    await user.type(within(form).getByLabelText("ימי המתנה לקטיף (PHI)"), "7");
    expect(within(form).getByText("קטיף מותר החל מ-29 בנוב׳ 2026")).toBeInTheDocument();
    await user.click(within(form).getByLabelText("בדקתי את המינון ואת ימי ההמתנה מול תווית התכשיר"));
    await user.click(within(form).getByRole("button", { name: "שמירה ביומן" }));

    expect(await screen.findByText("הריסוס נרשם. קטיף מותר החל מ-29 בנוב׳ 2026.")).toBeInTheDocument();
    const post = calls.find((c) => c.method === "POST");
    expect(JSON.parse(post.body)).toEqual({
      type: "SPRAY",
      appliedOn: TODAY,
      productName: "Score 250 EC",
      activeIngredient: null,
      dosePerDunam: 50,
      doseUnit: "ml",
      phiDays: 7,
      diagnosisId: null,
      notes: null,
    });
    // אחרי השמירה היומן נטען מחדש מהשרת (כדי שמצב הקטיף יחושב שם)
    expect(calls.filter((c) => c.method === "GET" && c.path === "/fields/f-1/logs")).toHaveLength(2);
  });

  it("does not ask for PHI or a label check for fertilizing", async () => {
    const user = userEvent.setup();
    const saved = fieldLog({ id: "l-9", type: "FERTILIZE", phiDays: null, safeHarvestDate: null });
    const { calls } = renderApp("/fields/f-1/journal", {
      user: farmer,
      routes: [journal([], null), { method: "POST", path: "/fields/f-1/logs", status: 201, body: saved }],
    });

    await user.click(await screen.findByRole("button", { name: "רשומה חדשה ביומן" }));
    const form = screen.getByRole("form", { name: "רשומה חדשה ביומן" });
    await user.selectOptions(within(form).getByLabelText("סוג הפעולה"), "FERTILIZE");
    expect(within(form).queryByLabelText("ימי המתנה לקטיף (PHI)")).not.toBeInTheDocument();
    await user.click(within(form).getByRole("button", { name: "שמירה ביומן" }));

    expect(await screen.findByText("הדישון נרשם ביומן.")).toBeInTheDocument();
    expect(JSON.parse(calls.find((c) => c.method === "POST").body)).toMatchObject({ type: "FERTILIZE", phiDays: null });
  });

  it("rejects a future date", async () => {
    const user = userEvent.setup();
    renderApp("/fields/f-1/journal", { user: farmer, routes: [journal([], null)] });
    await user.click(await screen.findByRole("button", { name: "רשומה חדשה ביומן" }));
    const dateInput = screen.getByLabelText("תאריך הביצוע");
    await user.clear(dateInput);
    await user.type(dateInput, "2026-11-30");
    await user.click(screen.getByRole("button", { name: "שמירה ביומן" }));
    expect(screen.getByText("אי אפשר לרשום פעולה בתאריך עתידי.")).toBeInTheDocument();
  });

  it("deletes an entry after confirmation", async () => {
    const user = userEvent.setup();
    const { calls } = renderApp("/fields/f-1/journal", {
      user: farmer,
      routes: [journal(), { method: "DELETE", path: "/fields/f-1/logs/l-1", status: 204 }],
    });

    const row = within(await screen.findByRole("list", { name: "רשומות היומן" })).getAllByRole("listitem")[0];
    await user.click(within(row).getByRole("button", { name: "מחיקת הרשומה" }));
    expect(within(row).getByText("למחוק את הרשומה?")).toBeInTheDocument();
    await user.click(within(row).getByRole("button", { name: "כן, למחוק" }));

    expect(await screen.findByText("הרשומה נמחקה.")).toBeInTheDocument();
    expect(calls.some((c) => c.method === "DELETE" && c.path === "/fields/f-1/logs/l-1")).toBe(true);
  });

  it("is read-only for an agronomist looking at a farmer's field", async () => {
    renderApp("/fields/f-1/journal", { user: agronomist, routes: [journal()] });
    expect(await screen.findByText(/של אבי כהן/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "רשומה חדשה ביומן" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "מחיקת הרשומה" })).not.toBeInTheDocument();
  });

  it("shows the server's Hebrew error when the field is not found", async () => {
    renderApp("/fields/f-x/journal", {
      user: farmer,
      routes: [{ path: "/fields/f-x/logs", status: 404, body: { error: "not_found", detail: "Field not found." } }],
    });
    expect(await screen.findByRole("alert")).toHaveTextContent("הפריט לא נמצא.");
  });
});

describe("logging a treatment from the diagnosis card", () => {
  const leaf = () => new File(["fake-png"], "leaf.png", { type: "image/png" });

  async function diagnoseAndOpenJournal(result = lateBlightResult) {
    const user = userEvent.setup();
    const saved = fieldLog({ id: "l-9", diagnosisId: "d-1", productName: "Revus 250 SC", phiDays: 3, safeHarvestDate: "2026-11-25", appliedOn: TODAY });
    const view = renderApp("/scan", {
      user: farmer,
      routes: [
        { path: "/fields", body: { items: [field()] } },
        { method: "POST", path: "/diagnose", status: 201, body: result },
        journal([], null),
        { method: "POST", path: "/fields/f-1/logs", status: 201, body: saved },
      ],
    });
    await user.upload(await screen.findByLabelText(/צלמו או בחרו תמונה של עלה/), leaf());
    await user.click(screen.getByRole("button", { name: "אבחון העלה" }));
    await screen.findByRole("heading", { level: 2 });
    return { user, ...view };
  }

  it("fills the disease, the recommended product and its PHI days, and links the diagnosis", async () => {
    const { user, calls } = await diagnoseAndOpenJournal();

    await user.click(screen.getByRole("link", { name: "רשום טיפול ביומן השדה" }));

    const form = await screen.findByRole("form", { name: "רשומה חדשה ביומן" });
    expect(form).toHaveTextContent("מולא אוטומטית מהאבחון: עגבנייה – כימשון");
    expect(within(form).getByLabelText("שם התכשיר")).toHaveValue("Ridomil Gold MZ");
    expect(within(form).getByLabelText("חומר פעיל (לא חובה)")).toHaveValue("metalaxyl-m + mancozeb");
    expect(within(form).getByLabelText("ימי המתנה לקטיף (PHI)")).toHaveValue("7");
    expect(within(form).getByLabelText("הערות")).toHaveValue("טיפול נגד עגבנייה – כימשון");
    expect(within(form).getByText(/ערך דוגמה/)).toBeInTheDocument();

    // בחירת תכשיר אחר מההמלצה מחליפה גם את ימי ההמתנה
    await user.selectOptions(within(form).getByLabelText("תכשיר מההמלצה"), "1");
    expect(within(form).getByLabelText("שם התכשיר")).toHaveValue("Revus 250 SC");
    expect(within(form).getByLabelText("ימי המתנה לקטיף (PHI)")).toHaveValue("3");

    await user.click(within(form).getByLabelText("בדקתי את המינון ואת ימי ההמתנה מול תווית התכשיר"));
    await user.click(within(form).getByRole("button", { name: "שמירה ביומן" }));

    expect(await screen.findByText("הריסוס נרשם. קטיף מותר החל מ-25 בנוב׳ 2026.")).toBeInTheDocument();
    expect(JSON.parse(calls.find((c) => c.method === "POST" && c.path === "/fields/f-1/logs").body)).toMatchObject({
      type: "SPRAY",
      productName: "Revus 250 SC",
      activeIngredient: "mandipropamid",
      phiDays: 3,
      diagnosisId: "d-1",
      notes: "טיפול נגד עגבנייה – כימשון",
    });
  });

  it("is not offered for a healthy leaf or when the crop does not match the field", async () => {
    await diagnoseAndOpenJournal(healthyResult);
    expect(screen.queryByRole("link", { name: "רשום טיפול ביומן השדה" })).not.toBeInTheDocument();
  });

  it("is not offered on a crop mismatch (no treatments are recommended)", async () => {
    await diagnoseAndOpenJournal(mismatchResult);
    expect(screen.queryByRole("link", { name: "רשום טיפול ביומן השדה" })).not.toBeInTheDocument();
  });
});
