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
    expect(within(rows[0]!).getByRole("link", { name: "לאבחונים של החלקה" })).toHaveAttribute("href", "/history?fieldId=f-1");
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

    const post = calls.find((c) => c.method === "POST")!;
    expect(JSON.parse(post.body as string)).toEqual({ name: "פרדס", cropType: "Orange", latitude: 32.1, longitude: 34.9 });
  });

  it("fills the coordinates from the device location", async () => {
    const user = userEvent.setup();
    vi.stubGlobal("navigator", {
      ...navigator,
      geolocation: {
        getCurrentPosition: (success: PositionCallback) =>
          success({ coords: { latitude: 31.2518345, longitude: 34.7913111 } } as GeolocationPosition),
      },
    });
    renderApp("/fields", { user: farmer, routes: [{ path: "/fields", body: { items: [] } }] });

    await user.click(await screen.findByRole("button", { name: "מילוי לפי המיקום הנוכחי שלי" }));

    expect(screen.getByLabelText("קו רוחב")).toHaveValue("31.251835");
    expect(screen.getByLabelText("קו אורך")).toHaveValue("34.791311");
  });
});
