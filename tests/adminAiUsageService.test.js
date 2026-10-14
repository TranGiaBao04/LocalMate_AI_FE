import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { adminApiClient, ADMIN_API_EVENTS } from "../src/api/adminApiClient";
import { ApiError, AUTH_EVENTS } from "../src/api/apiClient";
import { adminAiUsageService } from "../src/services/adminAiUsageService";
import { setToken } from "../src/utils/authStorage";

const userId = "00000000-0000-0000-0000-000000000010";
const methods = [
  ["getSystemSummary", "/admin/ai-usage/summary", (params, options) => adminAiUsageService.getSystemSummary(params, options)],
  ["getUserSummary", `/admin/users/${userId}/ai-usage`, (params, options) => adminAiUsageService.getUserSummary(userId, params, options)],
  ["getUserCalls", `/admin/users/${userId}/ai-calls`, (params, options) => adminAiUsageService.getUserCalls(userId, params, options)],
];

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
  sessionStorage.clear();
});

describe("Admin AI Usage service contract", () => {
  let get;
  beforeEach(() => {
    get = vi.spyOn(adminApiClient, "get").mockResolvedValue(null);
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network request"); }));
  });

  it.each(methods)("%s uses the exact GET route without client defaults", async (_, path, call) => {
    await call();
    expect(get).toHaveBeenCalledExactlyOnceWith(path, undefined);
    expect(fetch).not.toHaveBeenCalled();
  });

  it.each(methods)("%s omits empty, null, undefined and unsupported parameters", async (_, path, call) => {
    await call({ from: "", to: null, page: undefined, search: "ignored", unknown: "ignored" });
    expect(get).toHaveBeenCalledExactlyOnceWith(path, undefined);
  });

  it.each(methods.slice(0, 2))("%s preserves Vietnam date strings without converting timezones", async (_, path, call) => {
    await call({ from: "2026-10-12", to: "2026-10-13", page: 2, kind: "Explain" });
    expect(get).toHaveBeenCalledExactlyOnceWith(`${path}?from=2026-10-12&to=2026-10-13`, undefined);
  });

  it("serializes only supported C paging, sorting and filter names", async () => {
    await adminAiUsageService.getUserCalls(userId, {
      page: 2, pageSize: 100, sortBy: "startedAt", sortDirection: "asc",
      from: "0001-01-01", to: "9999-12-31", kind: "Explain", status: "InProgress",
      search: "x".repeat(5000), cost: 12,
    });
    expect(get).toHaveBeenCalledExactlyOnceWith(
      `/admin/users/${userId}/ai-calls?page=2&pageSize=100&sortBy=startedAt&sortDirection=asc&from=0001-01-01&to=9999-12-31&kind=Explain&status=InProgress`, undefined,
    );
  });

  it.each(["from", "to"])("C preserves one-sided %s without adding the other boundary", async (field) => {
    await adminAiUsageService.getUserCalls(userId, { [field]: "2026-10-13" });
    expect(get).toHaveBeenCalledExactlyOnceWith(`/admin/users/${userId}/ai-calls?${field}=2026-10-13`, undefined);
  });

  it.each(["Succeeded", "ProviderFailed", "InvalidOutput", "Abandoned", "InProgress"])("preserves status %s", async (status) => {
    await adminAiUsageService.getUserCalls(userId, { kind: "ParseRequest", status, sortDirection: "desc" });
    expect(get).toHaveBeenCalledExactlyOnceWith(`/admin/users/${userId}/ai-calls?sortDirection=desc&kind=ParseRequest&status=${status}`, undefined);
  });

  it.each(["getUserSummary", "getUserCalls"])("%s encodes user ID as one path segment", async (method) => {
    await adminAiUsageService[method]("a/b?x=1#fragment");
    const suffix = method === "getUserSummary" ? "ai-usage" : "ai-calls";
    expect(get).toHaveBeenCalledExactlyOnceWith(`/admin/users/a%2Fb%3Fx%3D1%23fragment/${suffix}`, undefined);
  });

  it("leaves invalid supported values to backend validation rather than masking them", async () => {
    await adminAiUsageService.getUserCalls(userId, { page: 0, status: "unknown", from: "bad value&to=injected" });
    expect(get).toHaveBeenCalledExactlyOnceWith(`/admin/users/${userId}/ai-calls?page=0&from=bad+value%26to%3Dinjected&status=unknown`, undefined);
  });

  it.each(methods)("%s forwards AbortSignal and the original options", async (_, path, call) => {
    const options = { signal: new AbortController().signal };
    await call({}, options);
    expect(get).toHaveBeenCalledExactlyOnceWith(path, options);
    expect(get.mock.calls[0][1]).toBe(options);
  });

  it.each(methods)("%s preserves the exact response without defaults or field removal", async (name, _, call) => {
    const response = name === "getSystemSummary"
      ? { from: "2026-10-01", to: "2026-10-13", totals: { averageDurationMs: null }, byKind: [], days: [], topUsers: [], generatedAt: "2026-10-13T12:00:00Z" }
      : name === "getUserSummary"
        ? { userId, from: "2026-10-01", to: "2026-10-13", today: { used: 1, limit: 3, resetAt: "2026-10-13T17:00:00Z" }, totals: {}, days: [], generatedAt: null }
        : { items: [{ id: "call", kind: "Explain", status: "Abandoned", startedAt: "2026-10-13T12:00:00Z", completedAt: null, durationMs: null, model: null, inputTokens: 0, outputTokens: 0, tripId: null }], page: 1, pageSize: 20, totalCount: 1, totalPages: 1 };
    get.mockResolvedValue(response);
    expect(await call()).toBe(response);
  });

  it.each(methods)("%s does not catch or replace API and cancellation errors", async (_, __, call) => {
    for (const error of [
      new ApiError("invalid", 400, "invalid_ai_usage_query", { Page: ["Invalid"] }),
      new ApiError("unauthorized", 401), new ApiError("forbidden", 403),
      new ApiError("missing", 404, "user_not_found"),
      new ApiError("locked", 403, "account_locked"),
      new ApiError("missing account", 401, "account_not_found"),
      new DOMException("Cancelled", "AbortError"),
    ]) {
      get.mockRejectedValueOnce(error);
      await expect(call()).rejects.toBe(error);
    }
  });
});

describe("Real admin API client integration with fail-closed mocked transport", () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network request"); }));
  });

  it.each(methods)("%s uses /api exactly once and only GET with cancellation", async (_, path, call) => {
    const signal = new AbortController().signal;
    const response = { serverField: null };
    fetch.mockResolvedValueOnce(new Response(JSON.stringify(response), { headers: { "content-type": "application/json" } }));
    expect(await call({}, { signal })).toEqual(response);
    expect(fetch).toHaveBeenCalledExactlyOnceWith(`/api${path}`, expect.objectContaining({ method: "GET", signal, body: undefined }));
  });

  it.each([
    [400, "invalid_ai_usage_query", null], [404, "user_not_found", null],
    [401, null, ADMIN_API_EVENTS.UNAUTHORIZED], [403, null, ADMIN_API_EVENTS.FORBIDDEN],
    [403, "account_locked", AUTH_EVENTS.SESSION_ENDED],
    [401, "account_not_found", AUTH_EVENTS.SESSION_ENDED],
  ])("preserves %s/%s and existing global session/permission handling", async (status, code, eventName) => {
    setToken("test-only-in-memory-token", true);
    const listener = vi.fn();
    if (eventName) window.addEventListener(eventName, listener);
    try {
      const data = { code, errors: status === 400 ? { Page: ["Invalid page"] } : undefined };
      fetch.mockResolvedValueOnce(new Response(JSON.stringify(data), { status, headers: { "content-type": "application/problem+json" } }));
      await expect(adminAiUsageService.getUserCalls(userId)).rejects.toMatchObject({ name: "ApiError", status, code });
      expect(fetch).toHaveBeenCalledTimes(1);
      if (eventName) expect(listener).toHaveBeenCalledTimes(1);
    } finally {
      if (eventName) window.removeEventListener(eventName, listener);
    }
  });
});
