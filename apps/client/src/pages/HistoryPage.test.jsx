import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { agronomist, farmer, field, healthyResult, historyItem, historyPage, renderApp } from "../test/utils";

const fields = { path: "/fields", body: { items: [field(), field({ id: "f-2", name: "שדה צפוני", cropType: "Potato" })] } };

describe("history page", () => {
  it("lists past diagnoses with Hebrew and scientific names", async () => {
    renderApp("/history", {
      user: farmer,
      routes: [
        fields,
        {
          path: "/diagnoses?limit=20&offset=0",
          body: historyPage([historyItem(), historyItem({ id: "d-2", isHealthy: true, disease: healthyResult.disease, confidence: 0.97 })]),
        },
      ],
    });

    const list = await screen.findByRole("list", { name: "אבחונים" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(rows[0]).toHaveTextContent("עגבנייה – כימשון");
    expect(rows[0]).toHaveTextContent("Phytophthora infestans");
    expect(rows[0]).toHaveTextContent("נגוע");
    expect(rows[0]).toHaveTextContent("90%");
    expect(rows[0]).toHaveTextContent("חממה 3");
    expect(rows[1]).toHaveTextContent("בריא");
    expect(screen.getByText("מוצגים 2 מתוך 2")).toBeInTheDocument();
    // חקלאי לא צריך לראות את השם של עצמו בכל שורה
    expect(rows[0]).not.toHaveTextContent(farmer.name);
  });

  it("shows the farmer's name to an agronomist", async () => {
    renderApp("/history", {
      user: agronomist,
      routes: [fields, { path: "/diagnoses?limit=20&offset=0", body: historyPage([historyItem()]) }],
    });
    const list = await screen.findByRole("list", { name: "אבחונים" });
    expect(within(list).getByText(`של ${farmer.name}`)).toBeInTheDocument();
  });

  it("filters by status through the server", async () => {
    const user = userEvent.setup();
    const { calls } = renderApp("/history", {
      user: farmer,
      routes: [
        fields,
        { path: "/diagnoses?limit=20&offset=0", body: historyPage([historyItem()]) },
        { path: "/diagnoses?status=healthy&limit=20&offset=0", body: historyPage([]) },
      ],
    });

    await screen.findByRole("list", { name: "אבחונים" });
    await user.click(screen.getByLabelText("בריא"));

    expect(await screen.findByText("אין אבחונים שמתאימים לסינון הזה.")).toBeInTheDocument();
    expect(calls.map((c) => c.path)).toContain("/diagnoses?status=healthy&limit=20&offset=0");
  });

  it("reads the field filter from the address and can change it", async () => {
    const user = userEvent.setup();
    const { calls } = renderApp("/history?fieldId=f-1", {
      user: farmer,
      routes: [
        fields,
        { path: "/diagnoses?fieldId=f-1&limit=20&offset=0", body: historyPage([historyItem()]) },
        { path: "/diagnoses?fieldId=f-2&limit=20&offset=0", body: historyPage([historyItem({ id: "d-7" })]) },
      ],
    });

    await screen.findByRole("list", { name: "אבחונים" });
    const select = screen.getByLabelText("חלקה");
    await screen.findByRole("option", { name: "שדה צפוני (תפוח אדמה)" });
    expect(select).toHaveValue("f-1");

    await user.selectOptions(select, "f-2");
    await screen.findByRole("list", { name: "אבחונים" });
    expect(calls.map((c) => c.path)).toContain("/diagnoses?fieldId=f-2&limit=20&offset=0");
  });

  it("loads more diagnoses on request", async () => {
    const user = userEvent.setup();
    const firstPage = Array.from({ length: 20 }, (_, i) => historyItem({ id: `d-${i}` }));
    renderApp("/history", {
      user: farmer,
      routes: [
        fields,
        { path: "/diagnoses?limit=20&offset=0", body: historyPage(firstPage, 21) },
        { path: "/diagnoses?limit=20&offset=20", body: historyPage([historyItem({ id: "d-20" })], 21, 20) },
      ],
    });

    await screen.findByText("מוצגים 20 מתוך 21");
    await user.click(screen.getByRole("button", { name: "טעינת אבחונים נוספים" }));

    expect(await screen.findByText("מוצגים 21 מתוך 21")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "טעינת אבחונים נוספים" })).not.toBeInTheDocument();
  });

  describe("deleting a diagnosis", () => {
    it("asks for confirmation, deletes, and removes the row", async () => {
      const user = userEvent.setup();
      const { calls } = renderApp("/history", {
        user: farmer,
        routes: [
          fields,
          { path: "/diagnoses?limit=20&offset=0", body: historyPage([historyItem(), historyItem({ id: "d-2" })]) },
          { method: "DELETE", path: "/diagnoses/d-1", status: 204 },
        ],
      });

      const list = await screen.findByRole("list", { name: "אבחונים" });
      const [firstRow] = within(list).getAllByRole("listitem");
      await user.click(within(firstRow).getByRole("button", { name: /מחיקת האבחון/ }));

      // אישור: לא נמחק עדיין, והמיקוד עבר לכפתור הביטול
      expect(within(firstRow).getByRole("group", { name: /למחוק את האבחון הזה/ })).toBeInTheDocument();
      expect(within(firstRow).getByRole("button", { name: "ביטול" })).toHaveFocus();
      expect(calls.some((c) => c.method === "DELETE")).toBe(false);

      await user.click(within(firstRow).getByRole("button", { name: "כן, למחוק" }));

      expect(await screen.findByText("האבחון נמחק.")).toBeInTheDocument();
      expect(within(list).getAllByRole("listitem")).toHaveLength(1);
      expect(screen.getByText("מוצגים 1 מתוך 1")).toBeInTheDocument();
      expect(calls.filter((c) => c.method === "DELETE").map((c) => c.path)).toEqual(["/diagnoses/d-1"]);
    });

    it("cancels without deleting and returns focus to the delete button", async () => {
      const user = userEvent.setup();
      const { calls } = renderApp("/history", {
        user: farmer,
        routes: [fields, { path: "/diagnoses?limit=20&offset=0", body: historyPage([historyItem()]) }],
      });

      const deleteButton = await screen.findByRole("button", { name: /מחיקת האבחון/ });
      await user.click(deleteButton);
      await user.click(screen.getByRole("button", { name: "ביטול" }));

      expect(screen.queryByRole("group", { name: /למחוק/ })).not.toBeInTheDocument();
      await waitFor(() => expect(screen.getByRole("button", { name: /מחיקת האבחון/ })).toHaveFocus());
      expect(calls.some((c) => c.method === "DELETE")).toBe(false);
    });

    it("shows a Hebrew error and keeps the row when deletion fails", async () => {
      const user = userEvent.setup();
      renderApp("/history", {
        user: farmer,
        routes: [
          fields,
          { path: "/diagnoses?limit=20&offset=0", body: historyPage([historyItem()]) },
          { method: "DELETE", path: "/diagnoses/d-1", status: 500, body: { error: "internal_error", detail: "x" } },
        ],
      });

      await user.click(await screen.findByRole("button", { name: /מחיקת האבחון/ }));
      await user.click(screen.getByRole("button", { name: "כן, למחוק" }));

      expect(await screen.findByRole("alert")).toHaveTextContent("אירעה שגיאה בשרת");
      expect(screen.getAllByRole("listitem")).toHaveLength(1);
    });

    it("does not offer deletion of another farmer's diagnosis to an agronomist", async () => {
      renderApp("/history", {
        user: agronomist,
        routes: [fields, { path: "/diagnoses?limit=20&offset=0", body: historyPage([historyItem()]) }],
      });
      await screen.findByRole("list", { name: "אבחונים" });
      expect(screen.queryByRole("button", { name: /מחיקת האבחון/ })).not.toBeInTheDocument();
    });

    it("lets an admin delete anyone's diagnosis", async () => {
      renderApp("/history", {
        user: { ...agronomist, id: "u-admin", role: "ADMIN" },
        routes: [fields, { path: "/diagnoses?limit=20&offset=0", body: historyPage([historyItem()]) }],
      });
      expect(await screen.findByRole("button", { name: /מחיקת האבחון/ })).toBeInTheDocument();
    });
  });

  it("invites a first scan when there is no history", async () => {
    renderApp("/history", {
      user: farmer,
      routes: [fields, { path: "/diagnoses?limit=20&offset=0", body: historyPage([]) }],
    });
    expect(await screen.findByText(/עוד אין אבחונים/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "לסריקת עלה" })).toHaveAttribute("href", "/scan");
  });
});
