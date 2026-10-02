import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { apiClient, AUTH_EVENTS, ApiError } from "../src/api/apiClient";
import { adminApiClient, ADMIN_API_EVENTS } from "../src/api/adminApiClient";
import { STORAGE_KEYS } from "../src/constants";

describe("FE-UP1: Payment & Account Transport Boundary", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    localStorage.clear();
    globalThis.fetch = vi.fn();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it("JSON requests emit SESSION_ENDED on account_locked and account_not_found", async () => {
    localStorage.setItem(STORAGE_KEYS.TOKEN, "bearer-token-123");
    const events = [];
    const onSessionEnded = (e) => events.push(e.detail);
    window.addEventListener(AUTH_EVENTS.SESSION_ENDED, onSessionEnded);

    try {
      // 403 account_locked
      globalThis.fetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 403,
            code: "account_locked",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/problem+json" },
          }
        )
      );

      await expect(apiClient.get("/subscription/me")).rejects.toThrow(ApiError);
      expect(events).toHaveLength(1);
      expect(events[0].message).toContain("khoá");

      // 401 account_not_found
      globalThis.fetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 401,
            code: "account_not_found",
          }),
          {
            status: 401,
            headers: { "Content-Type": "application/problem+json" },
          }
        )
      );

      await expect(apiClient.get("/subscription/me")).rejects.toThrow(ApiError);
      expect(events).toHaveLength(2);
      expect(events[1].message).toContain("tồn tại");
    } finally {
      window.removeEventListener(AUTH_EVENTS.SESSION_ENDED, onSessionEnded);
    }
  });

  it("Blob requests emit SESSION_ENDED with exact message on account_locked and account_not_found", async () => {
    localStorage.setItem(STORAGE_KEYS.TOKEN, "bearer-token-456");
    const events = [];
    const onSessionEnded = (e) => events.push(e.detail);
    window.addEventListener(AUTH_EVENTS.SESSION_ENDED, onSessionEnded);

    try {
      globalThis.fetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 403,
            code: "account_locked",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/problem+json" },
          }
        )
      );

      let err = null;
      try {
        await apiClient.getBlob("/admin/transactions/export.csv");
      } catch (e) {
        err = e;
      }

      expect(err).toBeInstanceOf(ApiError);
      expect(err.message).toBe("Tài khoản đã bị khoá, vui lòng liên hệ hỗ trợ.");
      expect(events).toHaveLength(1);
      expect(events[0].message).toBe("Tài khoản đã bị khoá, vui lòng liên hệ hỗ trợ.");
    } finally {
      window.removeEventListener(AUTH_EVENTS.SESSION_ENDED, onSessionEnded);
    }
  });

  it("adminApiClient getBlob does not emit duplicate FORBIDDEN event when error is account_locked", async () => {
    localStorage.setItem(STORAGE_KEYS.TOKEN, "bearer-token-789");
    const sessionEndedEvents = [];
    const adminForbiddenEvents = [];

    const onSessionEnded = (e) => sessionEndedEvents.push(e.detail);
    const onAdminForbidden = (e) => adminForbiddenEvents.push(e.detail);

    window.addEventListener(AUTH_EVENTS.SESSION_ENDED, onSessionEnded);
    window.addEventListener(ADMIN_API_EVENTS.FORBIDDEN, onAdminForbidden);

    try {
      globalThis.fetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 403,
            code: "account_locked",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/problem+json" },
          }
        )
      );

      await expect(adminApiClient.getBlob("/admin/transactions/export.csv")).rejects.toThrow();

      // Dispatched shared session-ended event
      expect(sessionEndedEvents).toHaveLength(1);
      // Suppressed generic admin forbidden event (avoiding double toast)
      expect(adminForbiddenEvents).toHaveLength(0);
    } finally {
      window.removeEventListener(AUTH_EVENTS.SESSION_ENDED, onSessionEnded);
      window.removeEventListener(ADMIN_API_EVENTS.FORBIDDEN, onAdminForbidden);
    }
  });

  it("ordinary 403 without account_locked does NOT emit SESSION_ENDED", async () => {
    localStorage.setItem(STORAGE_KEYS.TOKEN, "bearer-token-normal");
    const sessionEndedEvents = [];
    const onSessionEnded = (e) => sessionEndedEvents.push(e.detail);
    window.addEventListener(AUTH_EVENTS.SESSION_ENDED, onSessionEnded);

    try {
      globalThis.fetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            status: 403,
            title: "Forbidden",
          }),
          {
            status: 403,
            headers: { "Content-Type": "application/problem+json" },
          }
        )
      );

      await expect(apiClient.getBlob("/admin/transactions/export.csv")).rejects.toThrow(ApiError);
      expect(sessionEndedEvents).toHaveLength(0);
    } finally {
      window.removeEventListener(AUTH_EVENTS.SESSION_ENDED, onSessionEnded);
    }
  });
});
