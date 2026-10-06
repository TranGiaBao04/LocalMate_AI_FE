import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { act, renderHook, waitFor } from "@testing-library/react";
import { AuthProvider, useAuth } from "../src/context/AuthContext";
import { authService } from "../src/services/authService";
import { AUTH_EVENTS, apiClient } from "../src/api/apiClient";
import { STORAGE_KEYS } from "../src/constants";
import { getToken } from "../src/utils/authStorage";

vi.mock("../src/services/authService", () => ({
  authService: { login: vi.fn(), googleLogin: vi.fn(), demo: vi.fn(), getProfile: vi.fn() },
}));

const profile = { id: "user-a", fullName: "Minh", permissions: [], role: "User" };
const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  authService.getProfile.mockResolvedValue(profile);
});

afterEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.unstubAllGlobals();
});

describe("AuthContext remember integration", () => {
  it.each([false, true])("registered login loads profile and stores only token, remember=%s", async (remember) => {
    const spy = vi.spyOn(Storage.prototype, "setItem");
    authService.login.mockResolvedValue({ accessToken: "registered-token" });
    const { result } = renderHook(useAuth, { wrapper });
    let response;
    await act(async () => {
      response = await result.current.login("minh@example.vn", "never-store-password", remember);
    });
    expect(authService.login).toHaveBeenCalledWith("minh@example.vn", "never-store-password");
    expect(authService.getProfile).toHaveBeenCalledTimes(1);
    expect(response.user).toEqual(profile);
    expect(result.current.isDemo).toBe(false);
    expect(localStorage.getItem(STORAGE_KEYS.TOKEN)).toBe(remember ? "registered-token" : null);
    expect(sessionStorage.getItem(STORAGE_KEYS.TOKEN)).toBe(remember ? null : "registered-token");
    expect(spy.mock.calls).toEqual([[STORAGE_KEYS.TOKEN, "registered-token"]]);
    spy.mockRestore();
  });

  it.each([false, true])("Google completion uses the same remember choice=%s", async (remember) => {
    authService.googleLogin.mockResolvedValue({ accessToken: "google-token" });
    const { result } = renderHook(useAuth, { wrapper });
    await act(async () => { await result.current.loginWithGoogle("provider-id-token", remember); });
    expect(authService.googleLogin).toHaveBeenCalledWith("provider-id-token");
    expect(result.current.user).toEqual(profile);
    expect(localStorage.getItem(STORAGE_KEYS.TOKEN)).toBe(remember ? "google-token" : null);
    expect(sessionStorage.getItem(STORAGE_KEYS.TOKEN)).toBe(remember ? null : "google-token");
  });

  it.each(["localStorage", "sessionStorage"])("bootstraps existing %s profile on reload", async (store) => {
    window[store].setItem(STORAGE_KEYS.TOKEN, "existing");
    const { result } = renderHook(useAuth, { wrapper });
    await waitFor(() => expect(result.current.initializing).toBe(false));
    expect(authService.getProfile).toHaveBeenCalledTimes(1);
    expect(result.current.user).toEqual(profile);
  });

  it("failed bootstrap clears both stores and user", async () => {
    localStorage.setItem(STORAGE_KEYS.TOKEN, "old");
    sessionStorage.setItem(STORAGE_KEYS.TOKEN, "expired");
    authService.getProfile.mockRejectedValue(new Error("expired"));
    const { result } = renderHook(useAuth, { wrapper });
    await waitFor(() => expect(result.current.initializing).toBe(false));
    expect(getToken()).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it("failed profile after login removes token and propagates failure", async () => {
    const failure = new Error("profile unavailable");
    authService.login.mockResolvedValue({ accessToken: "token" });
    authService.getProfile.mockRejectedValue(failure);
    const { result } = renderHook(useAuth, { wrapper });
    await act(async () => {
      await expect(result.current.login("a@b.vn", "password", false)).rejects.toBe(failure);
    });
    expect(getToken()).toBeNull();
    expect(result.current.user).toBeNull();
  });

  it("logout clears both stores and demo marker", async () => {
    authService.login.mockResolvedValue({ accessToken: "token" });
    const { result } = renderHook(useAuth, { wrapper });
    await act(async () => { await result.current.login("a@b.vn", "password", false); });
    localStorage.setItem(STORAGE_KEYS.TOKEN, "stale");
    localStorage.setItem(STORAGE_KEYS.IS_DEMO, "true");
    act(() => result.current.logout());
    expect(getToken()).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.IS_DEMO)).toBeNull();
    expect(result.current.isLoggedIn).toBe(false);
  });

  it.each(["account_locked", "account_not_found"])("real transport %s event clears both stores and retains notice", async (code) => {
    authService.login.mockResolvedValue({ accessToken: "token" });
    const { result } = renderHook(useAuth, { wrapper });
    await act(async () => { await result.current.login("a@b.vn", "password", false); });
    localStorage.setItem(STORAGE_KEYS.TOKEN, "stale");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ code }), {
      status: 403, headers: { "Content-Type": "application/json" },
    })));
    await act(async () => { await expect(apiClient.get("/users/me")).rejects.toMatchObject({ code }); });
    expect(getToken()).toBeNull();
    expect(result.current.isLoggedIn).toBe(false);
    expect(result.current.sessionNotice).not.toBe("");
    expect(AUTH_EVENTS.SESSION_ENDED).toBe("localmate:session-ended");
  });

  it("Demo stays a persistent demo session and replaces stale registered token", async () => {
    authService.demo.mockResolvedValue({ token: "demo-token" });
    const { result } = renderHook(useAuth, { wrapper });
    sessionStorage.setItem(STORAGE_KEYS.TOKEN, "stale-user");
    await act(async () => { await result.current.loginDemo(); });
    expect(localStorage.getItem(STORAGE_KEYS.TOKEN)).toBe("demo-token");
    expect(sessionStorage.getItem(STORAGE_KEYS.TOKEN)).toBeNull();
    expect(localStorage.getItem(STORAGE_KEYS.IS_DEMO)).toBe("true");
    expect(result.current.user.id).toBe("demo");
    expect(result.current.isDemo).toBe(true);
    expect(authService.getProfile).not.toHaveBeenCalled();
  });

  it("existing Demo reload does not load a persisted-user profile", () => {
    localStorage.setItem(STORAGE_KEYS.TOKEN, "demo-token");
    localStorage.setItem(STORAGE_KEYS.IS_DEMO, "true");
    const { result } = renderHook(useAuth, { wrapper });
    expect(result.current.user.id).toBe("demo");
    expect(result.current.initializing).toBe(false);
    expect(authService.getProfile).not.toHaveBeenCalled();
  });
});
