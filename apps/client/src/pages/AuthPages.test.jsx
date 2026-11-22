import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { agronomist, farmer, field, historyPage, renderApp } from "../test/utils";

const authOk = (user = farmer) => ({ token: "new-token", expiresAt: "2026-11-23T00:00:00.000Z", user });

describe("login", () => {
  it("sends unauthenticated users to the login page", async () => {
    renderApp("/history");
    expect(await screen.findByRole("heading", { name: "התחברות" })).toBeInTheDocument();
  });

  it("logs in, stores the token and returns to the page that was asked for", async () => {
    const user = userEvent.setup();
    const { calls } = renderApp("/history", {
      routes: [
        { method: "POST", path: "/auth/login", body: authOk() },
        { path: "/fields", body: { items: [field()] } },
        { path: /^\/diagnoses/, body: historyPage([]) },
      ],
    });

    await user.type(await screen.findByLabelText("אימייל"), "avi@example.test");
    await user.type(screen.getByLabelText("סיסמה"), "correct-horse");
    await user.click(screen.getByRole("button", { name: "התחברות" }));

    expect(await screen.findByRole("heading", { name: "היסטוריית אבחונים" })).toBeInTheDocument();
    expect(localStorage.getItem("cropguard.token")).toBe("new-token");
    const login = calls.find((c) => c.path === "/auth/login");
    expect(JSON.parse(login.body)).toEqual({ email: "avi@example.test", password: "correct-horse" });
  });

  it("shows a Hebrew error for wrong credentials", async () => {
    const user = userEvent.setup();
    renderApp("/login", {
      routes: [{ method: "POST", path: "/auth/login", status: 401, body: { error: "unauthorized", detail: "Invalid" } }],
    });

    await user.type(screen.getByLabelText("אימייל"), "avi@example.test");
    await user.type(screen.getByLabelText("סיסמה"), "wrong");
    await user.click(screen.getByRole("button", { name: "התחברות" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("האימייל או הסיסמה שגויים.");
    expect(localStorage.getItem("cropguard.token")).toBeNull();
  });

  it("logs out when the stored token has expired", async () => {
    localStorage.setItem("cropguard.token", "expired");
    renderApp("/scan", {
      routes: [{ path: "/auth/me", status: 401, body: { error: "unauthorized", detail: "expired" } }],
    });
    expect(await screen.findByRole("heading", { name: "התחברות" })).toBeInTheDocument();
    expect(localStorage.getItem("cropguard.token")).toBeNull();
  });

  it("logs out from the header", async () => {
    const user = userEvent.setup();
    renderApp("/fields", { user: farmer, routes: [{ path: "/fields", body: { items: [field()] } }] });
    await user.click(await screen.findByRole("button", { name: "התנתקות" }));
    expect(await screen.findByRole("heading", { name: "התחברות" })).toBeInTheDocument();
    expect(localStorage.getItem("cropguard.token")).toBeNull();
  });
});

describe("register", () => {
  it("validates the form in Hebrew before sending anything", async () => {
    const user = userEvent.setup();
    const { fn } = renderApp("/register");

    await user.type(screen.getByLabelText("אימייל"), "not-an-email");
    await user.type(screen.getByLabelText("סיסמה"), "short");
    await user.click(screen.getByRole("button", { name: "יצירת חשבון" }));

    expect(screen.getByText("נא למלא שם.")).toBeInTheDocument();
    expect(screen.getByText("נא למלא כתובת אימייל תקינה.")).toBeInTheDocument();
    expect(screen.getByText("הסיסמה צריכה להכיל לפחות 8 תווים.")).toBeInTheDocument();
    expect(screen.getByLabelText("סיסמה")).toHaveAttribute("aria-invalid", "true");
    expect(fn).not.toHaveBeenCalled();
  });

  it("registers an agronomist and opens the fields page", async () => {
    const user = userEvent.setup();
    const { calls } = renderApp("/register", {
      routes: [
        { method: "POST", path: "/auth/register", status: 201, body: authOk(agronomist) },
        { path: "/fields", body: { items: [] } },
      ],
    });

    await user.type(screen.getByLabelText("שם מלא"), "דנה לוי");
    await user.type(screen.getByLabelText("אימייל"), "dana@example.test");
    await user.type(screen.getByLabelText("סיסמה"), "correct-horse");
    await user.click(screen.getByLabelText(/אגרונום/));
    await user.click(screen.getByRole("button", { name: "יצירת חשבון" }));

    expect(await screen.findByRole("heading", { name: "חלקות" })).toBeInTheDocument();
    const register = calls.find((c) => c.path === "/auth/register");
    expect(JSON.parse(register.body)).toEqual({
      name: "דנה לוי",
      email: "dana@example.test",
      password: "correct-horse",
      role: "AGRONOMIST",
    });
  });

  it("explains a taken email in Hebrew", async () => {
    const user = userEvent.setup();
    renderApp("/register", {
      routes: [{ method: "POST", path: "/auth/register", status: 409, body: { error: "conflict", detail: "exists" } }],
    });

    await user.type(screen.getByLabelText("שם מלא"), "אבי");
    await user.type(screen.getByLabelText("אימייל"), "avi@example.test");
    await user.type(screen.getByLabelText("סיסמה"), "correct-horse");
    await user.click(screen.getByRole("button", { name: "יצירת חשבון" }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("כבר קיים חשבון עם האימייל הזה."));
  });
});
