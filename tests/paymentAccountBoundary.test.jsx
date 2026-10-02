import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { apiClient, AUTH_EVENTS, ApiError } from "../src/api/apiClient";
import { adminApiClient, ADMIN_API_EVENTS } from "../src/api/adminApiClient";
import { STORAGE_KEYS } from "../src/constants";
import {
  saveSubscriptionPaymentSession,
  getSubscriptionPaymentSession,
  clearSubscriptionPaymentSession,
} from "../src/utils/subscriptionPaymentSession";

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

  it.each([
    ["customer JSON", () => apiClient.get("/subscription/me"), false],
    ["customer Blob", () => apiClient.getBlob("/admin/transactions/export.csv"), false],
    ["admin JSON", () => adminApiClient.post("/admin/transactions/order/repair-entitlement", { reason: "Valid reason" }), true],
    ["admin Blob", () => adminApiClient.getBlob("/admin/transactions/export.csv"), true],
  ])("FE-UP6 ordinary %s 403 retains token and never ends session", async (_label, request, isAdmin) => {
    localStorage.setItem(STORAGE_KEYS.TOKEN, "valid-session");
    const sessionEnded = vi.fn();
    const unauthorized = vi.fn();
    const forbidden = vi.fn();
    window.addEventListener(AUTH_EVENTS.SESSION_ENDED, sessionEnded);
    window.addEventListener(ADMIN_API_EVENTS.UNAUTHORIZED, unauthorized);
    window.addEventListener(ADMIN_API_EVENTS.FORBIDDEN, forbidden);
    try {
      globalThis.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ code: "forbidden", status: 403 }), {
        status: 403, headers: { "Content-Type": "application/problem+json" },
      }));
      await expect(request()).rejects.toMatchObject({ status: 403 });
      expect(sessionEnded).not.toHaveBeenCalled();
      expect(unauthorized).not.toHaveBeenCalled();
      expect(forbidden).toHaveBeenCalledTimes(isAdmin ? 1 : 0);
      expect(localStorage.getItem(STORAGE_KEYS.TOKEN)).toBe("valid-session");
    } finally {
      window.removeEventListener(AUTH_EVENTS.SESSION_ENDED, sessionEnded);
      window.removeEventListener(ADMIN_API_EVENTS.UNAUTHORIZED, unauthorized);
      window.removeEventListener(ADMIN_API_EVENTS.FORBIDDEN, forbidden);
    }
  });

  it.each([
    ["JSON", () => adminApiClient.get("/admin/transactions")],
    ["Blob", () => adminApiClient.getBlob("/admin/transactions/export.csv")],
  ])("FE-UP6 admin %s 401 still clears session and emits login flow once", async (_label, request) => {
    localStorage.setItem(STORAGE_KEYS.TOKEN, "expired-session");
    const unauthorized = vi.fn();
    const forbidden = vi.fn();
    window.addEventListener(ADMIN_API_EVENTS.UNAUTHORIZED, unauthorized);
    window.addEventListener(ADMIN_API_EVENTS.FORBIDDEN, forbidden);
    try {
      globalThis.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ status: 401 }), {
        status: 401, headers: { "Content-Type": "application/problem+json" },
      }));
      await expect(request()).rejects.toMatchObject({ status: 401 });
      expect(localStorage.getItem(STORAGE_KEYS.TOKEN)).toBeNull();
      expect(unauthorized).toHaveBeenCalledTimes(1);
      expect(forbidden).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(ADMIN_API_EVENTS.UNAUTHORIZED, unauthorized);
      window.removeEventListener(ADMIN_API_EVENTS.FORBIDDEN, forbidden);
    }
  });

  it("FE-UP6 Blob account_not_found emits shared session ending, not generic admin 401", async () => {
    localStorage.setItem(STORAGE_KEYS.TOKEN, "removed-account");
    const ended = vi.fn();
    const unauthorized = vi.fn();
    window.addEventListener(AUTH_EVENTS.SESSION_ENDED, ended);
    window.addEventListener(ADMIN_API_EVENTS.UNAUTHORIZED, unauthorized);
    try {
      globalThis.fetch.mockResolvedValueOnce(new Response(JSON.stringify({ code: "account_not_found" }), {
        status: 401, headers: { "Content-Type": "application/problem+json" },
      }));
      await expect(adminApiClient.getBlob("/admin/transactions/export.csv"))
        .rejects.toMatchObject({ status: 401, code: "account_not_found" });
      expect(ended).toHaveBeenCalledTimes(1);
      expect(unauthorized).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(AUTH_EVENTS.SESSION_ENDED, ended);
      window.removeEventListener(ADMIN_API_EVENTS.UNAUTHORIZED, unauthorized);
    }
  });

  describe("Owner-scoped subscription payment session boundary", () => {
    it("account A session is unavailable to account B", () => {
      sessionStorage.clear();
      saveSubscriptionPaymentSession("user-a", {
        orderId: "order-a-123",
        qrCode: "qr-a",
        amount: 50000,
        planCode: "TripPass",
      });

      // User A can access its own session
      const sessionA = getSubscriptionPaymentSession("user-a");
      expect(sessionA).not.toBeNull();
      expect(sessionA.orderId).toBe("order-a-123");

      // User B cannot access User A's session
      const sessionB = getSubscriptionPaymentSession("user-b");
      expect(sessionB).toBeNull();
    });

    it("saving session for account B does not overwrite account A session", () => {
      sessionStorage.clear();
      saveSubscriptionPaymentSession("user-a", {
        orderId: "order-a-123",
        amount: 50000,
      });
      saveSubscriptionPaymentSession("user-b", {
        orderId: "order-b-456",
        amount: 99000,
      });

      const sessionA = getSubscriptionPaymentSession("user-a");
      const sessionB = getSubscriptionPaymentSession("user-b");

      expect(sessionA.orderId).toBe("order-a-123");
      expect(sessionB.orderId).toBe("order-b-456");
    });

    it("clearing session for account A does not affect account B", () => {
      sessionStorage.clear();
      saveSubscriptionPaymentSession("user-a", { orderId: "order-a-123" });
      saveSubscriptionPaymentSession("user-b", { orderId: "order-b-456" });

      clearSubscriptionPaymentSession("user-a");

      expect(getSubscriptionPaymentSession("user-a")).toBeNull();
      expect(getSubscriptionPaymentSession("user-b")).not.toBeNull();
      expect(getSubscriptionPaymentSession("user-b").orderId).toBe("order-b-456");
    });

    it("session cannot be retrieved with missing or invalid ownerId", () => {
      expect(getSubscriptionPaymentSession(null)).toBeNull();
      expect(getSubscriptionPaymentSession(undefined)).toBeNull();
      expect(getSubscriptionPaymentSession("")).toBeNull();
    });

    it("clearing session for account B does not erase account A legacy alias", () => {
      sessionStorage.clear();
      saveSubscriptionPaymentSession("user-a", { orderId: "order-a-123" });
      saveSubscriptionPaymentSession("user-b", { orderId: "order-b-456" });

      sessionStorage.setItem(
        "localmate_active_payment_intent",
        JSON.stringify({ ownerId: "user-a", orderId: "order-a-123" })
      );

      clearSubscriptionPaymentSession("user-b");

      expect(getSubscriptionPaymentSession("user-a")).not.toBeNull();
      expect(sessionStorage.getItem("localmate_active_payment_intent")).toContain("order-a-123");
    });
  });
});
