import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { deferred, farmer, field, lateBlightResult, renderApp } from "../test/utils";

const leaf = () => new File(["fake-png"], "leaf.png", { type: "image/png" });

describe("scan page", () => {
  it("asks for a field first when the farmer has none", async () => {
    renderApp("/scan", { user: farmer, routes: [{ path: "/fields", body: { items: [] } }] });
    expect(await screen.findByText(/הוסיפו את החלקה הראשונה/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "הוספת חלקה" })).toHaveAttribute("href", "/fields");
  });

  it("keeps the diagnose button disabled until an image is chosen", async () => {
    renderApp("/scan", { user: farmer, routes: [{ path: "/fields", body: { items: [field()] } }] });
    expect(await screen.findByRole("button", { name: "אבחון העלה" })).toBeDisabled();
  });

  it("uploads a leaf, shows a spinner, then the result card", async () => {
    const user = userEvent.setup();
    const gate = deferred();
    const { calls } = renderApp("/scan", {
      user: farmer,
      routes: [
        { path: "/fields", body: { items: [field(), field({ id: "f-2", name: "שדה צפוני", cropType: "Potato" })] } },
        { method: "POST", path: "/diagnose", status: 201, body: lateBlightResult, wait: gate.promise },
      ],
    });

    await user.selectOptions(await screen.findByLabelText("חלקה"), "f-2");
    expect(screen.getByRole("option", { name: "שדה צפוני (תפוח אדמה)" })).toBeInTheDocument();
    await user.upload(screen.getByLabelText(/צלמו או בחרו תמונה של עלה/), leaf());
    expect(screen.getByAltText("התמונה שנבחרה")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "אבחון העלה" }));

    // מצב טעינה
    expect(await screen.findByText("מנתח את העלה…")).toBeInTheDocument();
    gate.resolve();

    // כרטיס התוצאה
    expect(await screen.findByRole("heading", { level: 2, name: "כימשון" })).toBeInTheDocument();
    expect(screen.getByText(/₪110–180/)).toBeInTheDocument();

    const request = calls.find((c) => c.path === "/diagnose")!;
    const form = request.body as FormData;
    expect(form.get("fieldId")).toBe("f-2");
    expect((form.get("image") as File).name).toBe("leaf.png");
  });

  it("starts a new scan from the result", async () => {
    const user = userEvent.setup();
    renderApp("/scan", {
      user: farmer,
      routes: [
        { path: "/fields", body: { items: [field()] } },
        { method: "POST", path: "/diagnose", status: 201, body: lateBlightResult },
      ],
    });

    await user.upload(await screen.findByLabelText(/צלמו או בחרו תמונה של עלה/), leaf());
    await user.click(screen.getByRole("button", { name: "אבחון העלה" }));
    await user.click(await screen.findByRole("button", { name: "סריקה חדשה" }));

    expect(screen.getByRole("button", { name: "אבחון העלה" })).toBeDisabled();
    expect(screen.queryByRole("heading", { name: "כימשון" })).not.toBeInTheDocument();
  });

  it("shows a Hebrew message when the AI service is down", async () => {
    const user = userEvent.setup();
    renderApp("/scan", {
      user: farmer,
      routes: [
        { path: "/fields", body: { items: [field()] } },
        { method: "POST", path: "/diagnose", status: 503, body: { error: "ai_unavailable", detail: "down" } },
      ],
    });

    await user.upload(await screen.findByLabelText(/צלמו או בחרו תמונה של עלה/), leaf());
    await user.click(screen.getByRole("button", { name: "אבחון העלה" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("שירות האבחון לא זמין כרגע");
    // אפשר לנסות שוב עם אותה תמונה
    expect(screen.getByRole("button", { name: "אבחון העלה" })).toBeEnabled();
  });
});
