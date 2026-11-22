import { describe, expect, it, vi } from "vitest";

import { mockFetch } from "../test/utils";
import { api, ApiError, errorMessageHe, setUnauthorizedHandler, tokenStore } from "./client";

describe("API client", () => {
  it("sends JSON with the stored token", async () => {
    tokenStore.set("abc");
    const { calls } = mockFetch([{ method: "POST", path: "/fields", status: 201, body: { id: "f-1" } }]);

    await api.createField({ name: "A", cropType: "Tomato", latitude: 31, longitude: 34 });

    expect(calls[0]!.headers.get("Authorization")).toBe("Bearer abc");
    expect(calls[0]!.headers.get("Content-Type")).toBe("application/json");
    expect(JSON.parse(calls[0]!.body as string)).toEqual({ name: "A", cropType: "Tomato", latitude: 31, longitude: 34 });
  });

  it("sends the diagnosis as multipart form data without forcing a Content-Type", async () => {
    const { calls } = mockFetch([{ method: "POST", path: "/diagnose", status: 201, body: {} }]);
    const image = new File(["png"], "leaf.png", { type: "image/png" });

    await api.diagnose("f-1", image);

    const body = calls[0]!.body as FormData;
    expect(body).toBeInstanceOf(FormData);
    expect(body.get("fieldId")).toBe("f-1");
    expect((body.get("image") as File).name).toBe("leaf.png");
    expect(calls[0]!.headers.has("Content-Type")).toBe(false);
  });

  it("builds the history query string from the filters, skipping empty ones", async () => {
    const { calls } = mockFetch([{ path: /^\/diagnoses/, body: { items: [], total: 0, limit: 20, offset: 0 } }]);
    await api.listDiagnoses({ fieldId: "f-1", status: "infected", limit: 20, offset: 40 });
    await api.listDiagnoses({ fieldId: undefined });
    expect(calls.map((c) => c.path)).toEqual(["/diagnoses?fieldId=f-1&status=infected&limit=20&offset=40", "/diagnoses"]);
  });

  it("turns server errors into ApiError with a Hebrew message", async () => {
    mockFetch([{ method: "POST", path: "/diagnose", status: 503, body: { error: "ai_unavailable", detail: "down" } }]);

    const error = await api.diagnose("f-1", new File([""], "a.png")).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 503, code: "ai_unavailable", detail: "down" });
    expect(errorMessageHe(error)).toBe("שירות האבחון לא זמין כרגע. נסו שוב בעוד כמה דקות.");
  });

  it("reports a network failure in Hebrew", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    const error = await api.listFields().catch((e: unknown) => e);
    expect(error).toMatchObject({ status: 0, code: "network_error" });
    expect(errorMessageHe(error)).toContain("אין חיבור לשרת");
  });

  it("calls the unauthorized handler when a stored token is rejected", async () => {
    tokenStore.set("expired");
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    mockFetch([{ path: "/fields", status: 401, body: { error: "unauthorized", detail: "Invalid or expired token." } }]);

    await expect(api.listFields()).rejects.toBeInstanceOf(ApiError);
    expect(handler).toHaveBeenCalledOnce();
    setUnauthorizedHandler(null);
  });

  it("does not treat a failed login (no token) as an expired session", async () => {
    const handler = vi.fn();
    setUnauthorizedHandler(handler);
    mockFetch([{ method: "POST", path: "/auth/login", status: 401, body: { error: "unauthorized", detail: "x" } }]);

    await expect(api.login({ email: "a@b.c", password: "x" })).rejects.toBeInstanceOf(ApiError);
    expect(handler).not.toHaveBeenCalled();
    setUnauthorizedHandler(null);
  });
});
