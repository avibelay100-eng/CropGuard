import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { isIsraeliMobile, formatIsraeliMobile } from "../lib/phone";
import { farmer, renderApp } from "../test/utils";

describe("phone helpers", () => {
  it.each(["050-1234567", "0501234567", "+972 50 123 4567", "972541234567"])("accepts %s", (value) => {
    expect(isIsraeliMobile(value)).toBe(true);
  });
  it.each(["03-1234567", "12345", "", "+1 555 1234"])("rejects %s", (value) => {
    expect(isIsraeliMobile(value)).toBe(false);
  });
  it("formats for display", () => {
    expect(formatIsraeliMobile("+972501234567")).toBe("050-123-4567");
  });
});

describe("forgot password", () => {
  it("is linked from the login page", async () => {
    const user = userEvent.setup();
    renderApp("/login");
    await user.click(screen.getByRole("link", { name: "שכחתי סיסמה" }));
    expect(screen.getByRole("heading", { name: "שחזור סיסמה" })).toBeInTheDocument();
  });

  it("sends a code, then sets a new password and returns to login with a confirmation", async () => {
    const user = userEvent.setup();
    const { calls } = renderApp("/forgot-password", {
      routes: [
        { method: "POST", path: "/auth/password-reset/request", body: { ok: true } },
        { method: "POST", path: "/auth/password-reset/confirm", body: { ok: true } },
      ],
    });

    await user.type(screen.getByLabelText("טלפון נייד"), "050-123-4567");
    await user.click(screen.getByRole("button", { name: "שליחת קוד" }));

    // אותה הודעה בכל מקרה - לא מגלים אם המספר רשום
    expect(await screen.findByText(/אם המספר/)).toBeInTheDocument();

    await user.type(screen.getByLabelText("קוד מה-SMS"), "12a3456");
    expect(screen.getByLabelText("קוד מה-SMS")).toHaveValue("123456"); // רק ספרות
    await user.type(screen.getByLabelText("סיסמה חדשה"), "brand-new-password");
    await user.click(screen.getByRole("button", { name: "קביעת סיסמה חדשה" }));

    expect(await screen.findByText("הסיסמה עודכנה. אפשר להתחבר עם הסיסמה החדשה.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "התחברות" })).toBeInTheDocument();
    const confirm = calls.find((c) => c.path === "/auth/password-reset/confirm")!;
    expect(JSON.parse(confirm.body as string)).toEqual({ phone: "050-123-4567", code: "123456", newPassword: "brand-new-password" });
  });

  it("validates the phone before sending anything", async () => {
    const user = userEvent.setup();
    const { fn } = renderApp("/forgot-password");
    await user.type(screen.getByLabelText("טלפון נייד"), "03-1234567");
    await user.click(screen.getByRole("button", { name: "שליחת קוד" }));
    expect(screen.getByText(/נא למלא מספר נייד ישראלי/)).toBeInTheDocument();
    expect(fn).not.toHaveBeenCalled();
  });

  it("explains a wrong or expired code in Hebrew", async () => {
    const user = userEvent.setup();
    renderApp("/forgot-password", {
      routes: [
        { method: "POST", path: "/auth/password-reset/request", body: { ok: true } },
        { method: "POST", path: "/auth/password-reset/confirm", status: 400, body: { error: "invalid_code", detail: "x" } },
      ],
    });
    await user.type(screen.getByLabelText("טלפון נייד"), "0501234567");
    await user.click(screen.getByRole("button", { name: "שליחת קוד" }));
    await user.type(await screen.findByLabelText("קוד מה-SMS"), "000000");
    await user.type(screen.getByLabelText("סיסמה חדשה"), "brand-new-password");
    await user.click(screen.getByRole("button", { name: "קביעת סיסמה חדשה" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("הקוד שגוי או שפג תוקפו");
  });
});

describe("account page", () => {
  it("adds a phone for password recovery", async () => {
    const user = userEvent.setup();
    const { calls } = renderApp("/account", {
      user: farmer,
      routes: [{ method: "PATCH", path: "/auth/me", body: { ...farmer, phone: "+972501234567" } }],
    });

    await user.type(await screen.findByLabelText("טלפון נייד"), "0501234567");
    await user.click(screen.getByRole("button", { name: "שמירת הטלפון" }));

    expect(await screen.findByText(/הטלפון נשמר/)).toBeInTheDocument();
    expect(screen.getByLabelText("טלפון נייד")).toHaveValue("050-123-4567");
    expect(screen.getByRole("button", { name: "הסרת הטלפון" })).toBeInTheDocument();
    expect(JSON.parse(calls.find((c) => c.method === "PATCH")!.body as string)).toEqual({ phone: "0501234567" });
  });

  it("is reachable from the header", async () => {
    const user = userEvent.setup();
    renderApp("/fields", { user: farmer, routes: [{ path: "/fields", body: { items: [] } }] });
    await user.click(await screen.findByRole("link", { name: /אבי כהן/ }));
    expect(screen.getByRole("heading", { name: "החשבון שלי" })).toBeInTheDocument();
  });
});
