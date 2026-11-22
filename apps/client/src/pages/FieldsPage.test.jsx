import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { agronomist, farmer, field, renderApp } from "../test/utils";

describe("fields page", () => {
  it("lists the farmer's fields with Hebrew crop names and diagnosis counts", async () => {
    renderApp("/fields", {
      user: farmer,
      routes: [
        { path: "/fields", body: { items: [field({ diagnosisCount: 3 }), field({ id: "f-2", name: "שדה צפוני", cropType: "Potato", diagnosisCount: 1 })] } },
      ],
    });

    const list = await screen.findByRole("list", { name: "רשימת החלקות" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("חממה 3");
    expect(rows[0]).toHaveTextContent("עגבנייה");
    expect(rows[0]).toHaveTextContent("3 אבחונים");
    expect(rows[0]).toHaveTextContent("31.2518, 34.7913");
    expect(rows[1]).toHaveTextContent("אבחון אחד");
    expect(within(rows[0]).getByRole("link", { name: "לאבחונים של החלקה" })).toHaveAttribute("href", "/history?fieldId=f-1");
    // חקלאי לא רואה "של <שם>" - הכול שלו
    expect(rows[0]).not.toHaveTextContent(`של ${farmer.name}`);
  });

  it("shows the owner of each field to an agronomist", async () => {
    renderApp("/fields", {
      user: agronomist,
      routes: [{ path: "/fields", body: { items: [field({ ownerName: "משה ישראלי" })] } }],
    });
    expect(await screen.findByRole("heading", { name: "חלקות" })).toBeInTheDocument();
    expect(screen.getByText("של משה ישראלי")).toBeInTheDocument();
  });

  it("opens the form straight away when there are no fields", async () => {
    renderApp("/fields", { user: farmer, routes: [{ path: "/fields", body: { items: [] } }] });
    expect(await screen.findByRole("form", { name: "חלקה חדשה" })).toBeInTheDocument();
  });

  it("validates coordinates in Hebrew", async () => {
    const user = userEvent.setup();
    const { calls } = renderApp("/fields", { user: farmer, routes: [{ path: "/fields", body: { items: [] } }] });

    await user.type(await screen.findByLabelText("קו רוחב"), "95");
    await user.type(screen.getByLabelText("קו אורך"), "abc");
    await user.click(screen.getByRole("button", { name: "שמירת החלקה" }));

    expect(screen.getByText("נא לתת לחלקה שם.")).toBeInTheDocument();
    expect(screen.getByText("קו רוחב הוא מספר בין -90 ל-90.")).toBeInTheDocument();
    expect(screen.getByText("קו אורך הוא מספר בין -180 ל-180.")).toBeInTheDocument();
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  it("creates a field and adds it to the top of the list", async () => {
    const user = userEvent.setup();
    const created = field({ id: "f-9", name: "פרדס", cropType: "Orange", latitude: 32.1, longitude: 34.9 });
    const { calls } = renderApp("/fields", {
      user: farmer,
      routes: [
        { path: "/fields", body: { items: [field()] } },
        { method: "POST", path: "/fields", status: 201, body: created },
      ],
    });

    await user.click(await screen.findByRole("button", { name: "הוספת חלקה" }));
    await user.type(screen.getByLabelText("שם החלקה"), "פרדס");
    await user.selectOptions(screen.getByLabelText("גידול"), "Orange");
    await user.type(screen.getByLabelText("קו רוחב"), "32.1");
    await user.type(screen.getByLabelText("קו אורך"), "34.9");
    await user.click(screen.getByRole("button", { name: "שמירת החלקה" }));

    const rows = within(await screen.findByRole("list", { name: "רשימת החלקות" })).getAllByRole("listitem");
    expect(rows[0]).toHaveTextContent("פרדס");
    expect(rows[0]).toHaveTextContent("תפוז");
    expect(screen.queryByRole("form", { name: "חלקה חדשה" })).not.toBeInTheDocument();

    const post = calls.find((c) => c.method === "POST");
    expect(JSON.parse(post.body)).toEqual({ name: "פרדס", cropType: "Orange", latitude: 32.1, longitude: 34.9 });
  });

  it("shows the extended details, the journal link and a PHI harvest warning", async () => {
    renderApp("/fields", {
      user: farmer,
      routes: [
        {
          path: "/fields",
          body: {
            items: [
              field({
                areaDunams: 12.5,
                cultivationMethod: "NET_HOUSE",
                irrigationMethod: "DRIP",
                variety: "מטרו",
                plantingDate: "2026-09-01",
                logCount: 3,
                harvestBlockedUntil: "2026-11-29",
                notes: "ליד הבאר",
              }),
            ],
          },
        },
      ],
    });

    const row = within(await screen.findByRole("list", { name: "רשימת החלקות" })).getAllByRole("listitem")[0];
    expect(row).toHaveTextContent("12.5 דונם · בית רשת · טפטוף · זן מטרו · שתילה 1 בספט׳ 2026");
    expect(row).toHaveTextContent("אין לקטוף לפני 29 בנוב׳ 2026");
    expect(row).toHaveTextContent("ליד הבאר");
    expect(within(row).getByRole("link", { name: "יומן שדה (3)" })).toHaveAttribute("href", "/fields/f-1/journal");
  });

  it("sends the optional details when creating a field", async () => {
    const user = userEvent.setup();
    const { calls } = renderApp("/fields", {
      user: farmer,
      routes: [
        { path: "/fields", body: { items: [] } },
        { method: "POST", path: "/fields", status: 201, body: field() },
      ],
    });

    await user.type(await screen.findByLabelText("שם החלקה"), "בית רשת 2");
    await user.type(screen.getByLabelText("קו רוחב"), "31.2");
    await user.type(screen.getByLabelText("קו אורך"), "34.8");
    await user.type(screen.getByLabelText("שטח (דונם)"), "4.5");
    await user.selectOptions(screen.getByLabelText("שיטת גידול"), "NET_HOUSE");
    await user.selectOptions(screen.getByLabelText("השקיה"), "SPRINKLER");
    await user.type(screen.getByLabelText("תאריך שתילה"), "2026-09-01");
    await user.click(screen.getByRole("button", { name: "שמירת החלקה" }));

    await screen.findByRole("list", { name: "רשימת החלקות" });
    const post = calls.find((c) => c.method === "POST");
    expect(JSON.parse(post.body)).toEqual({
      name: "בית רשת 2",
      cropType: "Tomato",
      latitude: 31.2,
      longitude: 34.8,
      areaDunams: 4.5,
      cultivationMethod: "NET_HOUSE",
      irrigationMethod: "SPRINKLER",
      plantingDate: "2026-09-01",
    });
  });

  it("validates the area and the season order", async () => {
    const user = userEvent.setup();
    const { calls } = renderApp("/fields", { user: farmer, routes: [{ path: "/fields", body: { items: [] } }] });

    await user.type(await screen.findByLabelText("שטח (דונם)"), "-2");
    await user.type(screen.getByLabelText("תאריך שתילה"), "2026-09-01");
    await user.type(screen.getByLabelText("קטיף צפוי"), "2026-08-01");
    await user.click(screen.getByRole("button", { name: "שמירת החלקה" }));

    expect(screen.getByText("שטח הוא מספר דונמים גדול מאפס.")).toBeInTheDocument();
    expect(screen.getByText("הקטיף הצפוי לא יכול להיות לפני השתילה.")).toBeInTheDocument();
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);
  });

  it("edits a field in place, sending cleared details as null", async () => {
    const user = userEvent.setup();
    const original = field({ areaDunams: 5, notes: "הערה ישנה" });
    const updated = field({ name: "חממה 4", areaDunams: 7.5, notes: null });
    const { calls } = renderApp("/fields", {
      user: farmer,
      routes: [
        { path: "/fields", body: { items: [original] } },
        { method: "PATCH", path: "/fields/f-1", body: updated },
      ],
    });

    const row = within(await screen.findByRole("list", { name: "רשימת החלקות" })).getAllByRole("listitem")[0];
    await user.click(within(row).getByRole("button", { name: "עריכה" }));

    const form = screen.getByRole("form", { name: "עריכת חלקה" });
    expect(within(form).getByLabelText("שם החלקה")).toHaveValue("חממה 3");
    await user.clear(within(form).getByLabelText("שם החלקה"));
    await user.type(within(form).getByLabelText("שם החלקה"), "חממה 4");
    await user.clear(within(form).getByLabelText("שטח (דונם)"));
    await user.type(within(form).getByLabelText("שטח (דונם)"), "7.5");
    await user.clear(within(form).getByLabelText("הערות"));
    await user.click(within(form).getByRole("button", { name: "שמירת השינויים" }));

    expect(await screen.findByText('החלקה "חממה 4" עודכנה.')).toBeInTheDocument();
    expect(screen.queryByRole("form", { name: "עריכת חלקה" })).not.toBeInTheDocument();
    const patch = calls.find((c) => c.method === "PATCH");
    expect(JSON.parse(patch.body)).toMatchObject({ name: "חממה 4", areaDunams: 7.5, notes: null, variety: null });
  });

  it("does not offer edit or delete to an agronomist on a farmer's field", async () => {
    renderApp("/fields", { user: agronomist, routes: [{ path: "/fields", body: { items: [field()] } }] });
    const row = within(await screen.findByRole("list", { name: "רשימת החלקות" })).getAllByRole("listitem")[0];
    expect(within(row).getByRole("link", { name: "יומן שדה" })).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "עריכה" })).not.toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: "מחיקה" })).not.toBeInTheDocument();
  });

  it("warns that deleting a field also deletes its diagnoses and journal, then deletes it", async () => {
    const user = userEvent.setup();
    const { calls } = renderApp("/fields", {
      user: farmer,
      routes: [
        { path: "/fields", body: { items: [field({ diagnosisCount: 3, logCount: 1 }), field({ id: "f-2", name: "שדה צפוני" })] } },
        { method: "DELETE", path: "/fields/f-1", status: 204 },
      ],
    });

    const row = within(await screen.findByRole("list", { name: "רשימת החלקות" })).getAllByRole("listitem")[0];
    await user.click(within(row).getByRole("button", { name: "מחיקה" }));

    const dialog = screen.getByRole("dialog", { name: 'למחוק את "חממה 3"?' });
    expect(dialog).toHaveTextContent("3 אבחונים (כולל התמונות) ו-רשומה אחת ביומן השדה");
    expect(dialog).toHaveTextContent("אי אפשר לבטל את הפעולה");

    // ביטול - שום דבר לא נמחק
    await user.click(within(dialog).getByRole("button", { name: "ביטול" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(calls.filter((c) => c.method === "DELETE")).toHaveLength(0);

    await user.click(within(row).getByRole("button", { name: "מחיקה" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "מחיקה לצמיתות" }));

    expect(await screen.findByText('החלקה "חממה 3" נמחקה, יחד עם האבחונים ויומן השדה שלה.')).toBeInTheDocument();
    const rows = within(screen.getByRole("list", { name: "רשימת החלקות" })).getAllByRole("listitem");
    expect(rows).toHaveLength(1);
    expect(rows[0]).toHaveTextContent("שדה צפוני");
    expect(calls.filter((c) => c.method === "DELETE").map((c) => c.path)).toEqual(["/fields/f-1"]);
  });

  it("fills the coordinates from the device location", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: (success) =>
          success({ coords: { latitude: 31.2518345, longitude: 34.7913111 } }),
      },
    });
    renderApp("/fields", { user: farmer, routes: [{ path: "/fields", body: { items: [] } }] });

    await user.click(await screen.findByRole("button", { name: "מילוי לפי המיקום הנוכחי שלי" }));

    expect(screen.getByLabelText("קו רוחב")).toHaveValue("31.251835");
    expect(screen.getByLabelText("קו אורך")).toHaveValue("34.791311");
  });
});
