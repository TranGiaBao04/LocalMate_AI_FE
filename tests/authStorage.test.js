import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { getToken, setToken, removeToken } from "../src/utils/authStorage";
import { STORAGE_KEYS } from "../src/constants";
import { apiClient } from "../src/api/apiClient";
import { adminApiClient } from "../src/api/adminApiClient";
import { isStoredTokenExpired } from "../src/utils/jwt";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("Remember session storage", () => {
  it.each([false, true])("stores token only in the selected storage, remember=%s", (remember) => {
    localStorage.setItem(STORAGE_KEYS.TOKEN, "stale-persistent");
    sessionStorage.setItem(STORAGE_KEYS.TOKEN, "stale-session");
    setToken("new-token", remember);
    expect(localStorage.getItem(STORAGE_KEYS.TOKEN)).toBe(remember ? "new-token" : null);
    expect(sessionStorage.getItem(STORAGE_KEYS.TOKEN)).toBe(remember ? null : "new-token");
    expect(getToken()).toBe("new-token");
  });

  it("defaults to a tab-scoped session", () => {
    setToken("session-only");
    expect(sessionStorage.getItem(STORAGE_KEYS.TOKEN)).toBe("session-only");
    expect(localStorage.getItem(STORAGE_KEYS.TOKEN)).toBeNull();
  });

  it.each(["localStorage", "sessionStorage"])("reads existing %s without changing it", (store) => {
    window[store].setItem(STORAGE_KEYS.TOKEN, "existing");
    expect(getToken()).toBe("existing");
    expect(window[store].getItem(STORAGE_KEYS.TOKEN)).toBe("existing");
  });

  it("prefers tab-scoped token if legacy state contains both", () => {
    localStorage.setItem(STORAGE_KEYS.TOKEN, "old-account");
    sessionStorage.setItem(STORAGE_KEYS.TOKEN, "current-account");
    expect(getToken()).toBe("current-account");
  });

  it("clears both token locations without clearing unrelated data", () => {
    localStorage.setItem(STORAGE_KEYS.TOKEN, "old");
    sessionStorage.setItem(STORAGE_KEYS.TOKEN, "new");
    localStorage.setItem("other-key", "preserved");
    removeToken();
    expect(getToken()).toBeNull();
    expect(localStorage.getItem("other-key")).toBe("preserved");
  });

  it("persistent auth survives a new tab without session storage", () => {
    setToken("persistent", true);
    sessionStorage.clear();
    expect(getToken()).toBe("persistent");
  });

  it("tab-only auth is absent after that session storage ends", () => {
    setToken("session", false);
    sessionStorage.clear();
    expect(getToken()).toBeNull();
  });
});

describe("Shared authenticated transport", () => {
  it.each(["JSON", "Blob", "Upload"])("%s sends a session-only Bearer token", async (kind) => {
    setToken("session-token");
    const fetchMock = vi.fn().mockResolvedValue(new Response(kind === "Blob" ? "csv" : "{}", {
      headers: { "Content-Type": kind === "Blob" ? "text/csv" : "application/json" },
    }));
    vi.stubGlobal("fetch", fetchMock);
    if (kind === "Blob") await apiClient.getBlob("/owned/export");
    else if (kind === "Upload") await apiClient.upload("/owned/image", new FormData());
    else await apiClient.get("/owned");
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe("Bearer session-token");
  });

  it("anonymous auth requests still omit Authorization", async () => {
    setToken("session-token");
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { headers: { "Content-Type": "application/json" } }));
    vi.stubGlobal("fetch", fetchMock);
    await apiClient.post("/auth/login", { email: "a@b.vn", password: "form-password" }, { auth: false });
    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBeUndefined();
  });

  it("Admin JWT expiry checks recognize a session-only token", () => {
    const payload = btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 600 }));
    setToken(`header.${payload}.signature`);
    expect(isStoredTokenExpired()).toBe(false);
  });

  it("Admin 401 cleanup removes both token stores", async () => {
    localStorage.setItem(STORAGE_KEYS.TOKEN, "old");
    sessionStorage.setItem(STORAGE_KEYS.TOKEN, "current");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", {
      status: 401, headers: { "Content-Type": "application/json" },
    })));
    await expect(adminApiClient.get("/admin/users")).rejects.toMatchObject({ status: 401 });
    expect(getToken()).toBeNull();
  });
});
