import { act, fireEvent, render as rtlRender, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import ProfilePage from "../src/pages/profile/ProfilePage";
import { apiClient } from "../src/api/apiClient";
import { StrictMode } from "react";
import { mapMyTrip } from "../src/utils/tripMapper";
import { formatVnDateTime } from "../src/utils/subscriptionUtils";
import { AuthProvider, useAuth } from "../src/context/AuthContext";
import { authService } from "../src/services/authService";
import { AUTH_EVENTS } from "../src/api/apiClient";

const boundary = vi.hoisted(() => ({ auth: {}, trip: {}, subscription: {}, notifications: {} }));
vi.mock("../src/context/AuthContext", async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, useAuth: () => boundary.realAuth ? actual.useAuth() : boundary.auth };
});
vi.mock("../src/context/TripContext", () => ({ useTrip: () => boundary.trip }));
vi.mock("../src/context/SubscriptionContext", () => ({ useSubscription: () => boundary.subscription }));
vi.mock("../src/context/NotificationContext", () => ({ useNotifications: () => boundary.notifications }));

const account = (id = "a", overrides = {}) => ({ id, fullName: `Account ${id}`, email: `${id}@example.test`, role: "User", preferences: { interestTagIds: ["food"], travelStyleTagIds: ["quiet"] }, ...overrides });
const tags = [
  { id: "food", name: "Ẩm thực", type: "Interest" },
  { id: "art", name: "Nghệ thuật", type: "Interest" },
  { id: "quiet", name: "Thư giãn", type: "TravelStyle" },
  { id: "active", name: "Năng động", type: "TravelStyle" },
];
function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}
function RouteProbe() { return <output aria-label="route">{useLocation().pathname}</output>; }
function tree() { return <MemoryRouter initialEntries={["/profile"]}><ProfilePage /><RouteProbe /></MemoryRouter>; }
async function render(ui) {
  let view;
  await act(async () => { view = rtlRender(ui); });
  return view;
}
async function edit() {
  fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa hồ sơ" }));
  await screen.findByRole("button", { name: "Ẩm thực" });
}
function rename(value) { fireEvent.change(screen.getByRole("textbox", { name: "Họ và tên" }), { target: { value } }); }
function save() { fireEvent.click(screen.getByRole("button", { name: "Lưu thay đổi" })); }

beforeEach(() => {
  vi.restoreAllMocks();
  localStorage.clear();
  sessionStorage.clear();
  boundary.auth = { user: account(), isLoggedIn: true, isDemo: false, initializing: false, logout: vi.fn(), applyUserProfile: vi.fn() };
  boundary.realAuth = false;
  boundary.trip = { savedTrips: [], tripsLoading: false, tripsLoaded: true, tripsError: false, retryTrips: vi.fn() };
  boundary.subscription = { subscription: { plan: "Free", usage: { generateUsed: 0, generateLimit: 1 }, savedTrips: { used: 0, limit: 1 } }, subscriptionLoading: false, subscriptionError: null, plans: [] };
  boundary.notifications = { enabled: false, userId: "a", unreadCount: 0, refreshUnreadCount: vi.fn() };
  vi.spyOn(apiClient, "get").mockImplementation(async (path) => {
    if (path === "/tags") return structuredClone(tags);
    throw new Error(`Unexpected GET ${path}`);
  });
  vi.spyOn(apiClient, "patch").mockRejectedValue(new Error("Unexpected PATCH"));
  for (const method of ["post", "put", "delete"]) vi.spyOn(apiClient, method).mockRejectedValue(new Error(`Unexpected ${method}`));
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected live network"); }));
});
afterEach(async () => {
  await act(async () => {});
  expect(globalThis.fetch).not.toHaveBeenCalled();
  for (const method of ["post", "put", "delete"]) expect(apiClient[method]).not.toHaveBeenCalled();
  vi.unstubAllGlobals(); vi.restoreAllMocks();
});

describe("A7 baseline bug reproduction", () => {
  it("does not apply A's delayed profile save to active account B", async () => {
    const pending = deferred();
    apiClient.patch.mockReturnValue(pending.promise);
    const view = await render(tree());
    await edit(); rename("Account A edited"); save();
    expect(apiClient.patch).toHaveBeenCalledWith("/users/me", { fullName: "Account A edited" });
    const apply = boundary.auth.applyUserProfile;
    boundary.auth = { ...boundary.auth, user: account("b") };
    view.rerender(tree());
    await act(async () => pending.resolve(account("a", { fullName: "Account A edited" })));
    expect(apply).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Account b" })).toBeInTheDocument();
    expect(screen.queryByText("Đã cập nhật hồ sơ.")).not.toBeInTheDocument();
  });
  it("retains saved IDs absent from the active tag catalog when selecting another tag", async () => {
    boundary.auth.user = account("a", { preferences: { interestTagIds: ["food", "retired"], travelStyleTagIds: ["quiet"] } });
    apiClient.patch.mockResolvedValue(boundary.auth.user);
    await render(tree()); await edit();
    fireEvent.click(screen.getByRole("button", { name: "Nghệ thuật" })); save();
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith("/users/me", { preferences: { interestTagIds: ["food", "retired", "art"] } }));
  });
  it("can edit a profile with a null full name without crashing", async () => {
    boundary.auth.user = account("a", { fullName: null });
    await render(tree()); await edit();
    expect(screen.getByRole("textbox", { name: "Họ và tên" })).toHaveValue("");
  });
  it("does not present unloaded Trip counts as a factual zero", async () => {
    boundary.trip = { ...boundary.trip, tripsLoading: true, tripsLoaded: false };
    await render(tree());
    expect(screen.getByRole("status", { name: "Thống kê lịch trình" })).toHaveTextContent("Đang tải");
    expect(screen.queryByLabelText("Số lịch trình đã lưu")).not.toBeInTheDocument();
  });
});

describe("A7 Profile UI and personalization contracts", () => {
  it("renders name, email, role and existing preference names without a request to update", async () => {
    await render(tree());
    expect(screen.getByRole("heading", { name: "Hồ sơ" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Account a" })).toBeInTheDocument();
    expect(screen.getByText("a@example.test")).toBeInTheDocument();
    expect(screen.getByLabelText("Ảnh đại diện")).toHaveTextContent("AA");
    await screen.findByText("Ẩm thực");
    expect(screen.getByText("Thư giãn")).toBeInTheDocument();
    expect(apiClient.patch).not.toHaveBeenCalled();
    expect(apiClient.get).toHaveBeenCalledTimes(1);
  });
  it("keeps Demo read-only with no private Trip stats or tag request", async () => {
    boundary.auth.isDemo = true;
    boundary.trip.savedTrips = [{ id: "private", title: "Private Trip" }];
    await render(tree());
    expect(screen.getByText("Phiên Demo")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Chỉnh sửa hồ sơ" })).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Số lịch trình đã lưu")).not.toBeInTheDocument();
    expect(screen.queryByText("Private Trip")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Đăng ký ngay" })).toHaveAttribute("href", "/register");
    expect(screen.getByRole("button", { name: "Thông báo" })).toBeDisabled();
    expect(apiClient.get).not.toHaveBeenCalled();
  });
  it("cancels a local edit without a PATCH and starts again from saved preferences", async () => {
    await render(tree()); await edit(); rename("Not saved");
    fireEvent.click(screen.getByRole("button", { name: "Ẩm thực" }));
    fireEvent.click(screen.getByRole("button", { name: "Hủy" }));
    expect(apiClient.patch).not.toHaveBeenCalled();
    await edit();
    expect(screen.getByRole("textbox", { name: "Họ và tên" })).toHaveValue("Account a");
    expect(screen.getByRole("button", { name: "Ẩm thực" })).toHaveAttribute("aria-pressed", "true");
  });
  it("does not submit an unchanged form even through a direct submit event", async () => {
    await render(tree()); await edit();
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled();
    fireEvent.submit(screen.getByRole("form", { name: "Chỉnh sửa hồ sơ" }));
    rename("  Account a  ");
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled();
    expect(apiClient.patch).not.toHaveBeenCalled();
  });
  it.each([["   ", "Vui lòng nhập họ và tên."], ["a".repeat(201), "Họ và tên không được quá 200 ký tự."]])("validates changed full name and associates the error: %s", async (name, error) => {
    await render(tree()); await edit(); rename(name); save();
    expect(screen.getByRole("alert")).toHaveTextContent(error);
    const input = screen.getByRole("textbox", { name: "Họ và tên" });
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(input).toHaveAccessibleDescription(error);
    expect(apiClient.patch).not.toHaveBeenCalled();
    rename("Valid name");
    expect(input).toHaveAttribute("aria-invalid", "false");
  });
  it("trims a changed name, sends no unchanged preference group and applies current-owner response", async () => {
    const updated = account("a", { fullName: "Tên mới" });
    apiClient.patch.mockResolvedValue(updated);
    await render(tree()); await edit(); rename("  Tên mới  "); save();
    await screen.findByText("Đã cập nhật hồ sơ.");
    expect(apiClient.patch).toHaveBeenCalledExactlyOnceWith("/users/me", { fullName: "Tên mới" });
    expect(boundary.auth.applyUserProfile).toHaveBeenCalledExactlyOnceWith(updated);
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });
  it.each(["Interest", "TravelStyle"])("only sends changed %s IDs", async (type) => {
    apiClient.patch.mockResolvedValue(account());
    await render(tree()); await edit();
    const interest = type === "Interest";
    fireEvent.click(screen.getByRole("button", { name: interest ? "Nghệ thuật" : "Năng động" }));
    expect(screen.getByRole("button", { name: interest ? "Nghệ thuật" : "Năng động" })).toHaveAttribute("aria-pressed", "true");
    save();
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledExactlyOnceWith("/users/me", { preferences: interest ? { interestTagIds: ["food", "art"] } : { travelStyleTagIds: ["quiet", "active"] } }));
  });
  it("sends explicit empty IDs only after the user removes the last active selection", async () => {
    apiClient.patch.mockResolvedValue(account());
    await render(tree()); await edit();
    fireEvent.click(screen.getByRole("button", { name: "Ẩm thực" })); save();
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith("/users/me", { preferences: { interestTagIds: [] } }));
  });
  it("sends all three changed fields, preserving both groups", async () => {
    apiClient.patch.mockResolvedValue(account());
    await render(tree()); await edit(); rename("Combined");
    fireEvent.click(screen.getByRole("button", { name: "Nghệ thuật" }));
    fireEvent.click(screen.getByRole("button", { name: "Năng động" })); save();
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith("/users/me", { fullName: "Combined", preferences: { interestTagIds: ["food", "art"], travelStyleTagIds: ["quiet", "active"] } }));
  });
  it("locks input, chips, Cancel and repeated submit while save is pending", async () => {
    const pending = deferred(); apiClient.patch.mockReturnValue(pending.promise);
    await render(tree()); await edit(); rename("Pending"); save();
    const form = screen.getByRole("form");
    expect(form).toHaveAttribute("aria-busy", "true");
    expect(screen.getByRole("textbox")).toBeDisabled();
    expect(screen.getByRole("button", { name: "Ẩm thực" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Hủy" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Đang lưu..." })).toBeDisabled();
    fireEvent.submit(form); fireEvent.submit(form);
    expect(apiClient.patch).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve(account()));
  });
  it.each([
    [{ errors: { fullName: ["invalid"] }, status: 400 }, "Họ và tên không hợp lệ"],
    [{ errors: { FullName: ["invalid"] }, status: 400 }, "Họ và tên không hợp lệ"],
    [{ code: "no_changes", status: 400 }, "Không có thay đổi để lưu"],
    [{ code: "invalid_preference", status: 400 }, "Sở thích đã thay đổi trên máy chủ"],
    [{ status: 401 }, "Phiên đăng nhập không còn hợp lệ"],
    [{ status: 403 }, "Phiên đăng nhập không còn hợp lệ"],
    [new Error("network"), "Không kết nối được máy chủ"],
    [{ status: 500 }, "Không thể cập nhật hồ sơ"],
  ])("maps update error %j and retains editable draft", async (error, text) => {
    apiClient.patch.mockRejectedValue(error);
    await render(tree()); await edit(); rename("Retry name"); save();
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(text));
    expect(screen.getByRole("textbox")).toHaveValue("Retry name");
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeEnabled();
    expect(boundary.auth.applyUserProfile).not.toHaveBeenCalled();
    apiClient.patch.mockResolvedValue(account("a", { fullName: "Retry name" })); save();
    await screen.findByText("Đã cập nhật hồ sơ.");
    expect(apiClient.patch).toHaveBeenCalledTimes(2);
  });
  it.each([null, account("b")])("rejects an invalid/wrong-owner update response %j", async (response) => {
    apiClient.patch.mockResolvedValue(response);
    await render(tree()); await edit(); rename("Changed"); save();
    await screen.findByText("Máy chủ trả về hồ sơ không hợp lệ. Vui lòng thử lại.");
    expect(boundary.auth.applyUserProfile).not.toHaveBeenCalled();
  });
  it("renders tag loading, permits name-only save and preserves preferences", async () => {
    const pending = deferred(); apiClient.get.mockReturnValueOnce(pending.promise);
    apiClient.patch.mockResolvedValue(account());
    await render(tree()); fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa hồ sơ" }));
    expect(screen.getAllByText("Đang tải danh mục...")).toHaveLength(2);
    rename("Name only"); save();
    await screen.findByText("Đã cập nhật hồ sơ.");
    expect(apiClient.patch).toHaveBeenCalledExactlyOnceWith("/users/me", { fullName: "Name only" });
    await act(async () => pending.resolve(tags));
  });
  it("shows catalog error, retries and maintains the existing selections", async () => {
    apiClient.get.mockRejectedValueOnce(new Error("offline"));
    await render(tree());
    fireEvent.click(await screen.findByRole("button", { name: "Tải lại danh mục" }));
    await screen.findByText("Ẩm thực");
    await edit();
    expect(screen.getByRole("button", { name: "Ẩm thực" })).toHaveAttribute("aria-pressed", "true");
    expect(apiClient.get).toHaveBeenCalledTimes(2);
    expect(apiClient.patch).not.toHaveBeenCalled();
  });
  it.each([[], null])("handles empty or malformed catalog %j without losing saved IDs", async (catalog) => {
    apiClient.get.mockResolvedValueOnce(catalog);
    await render(tree());
    await screen.findByRole("button", { name: "Tải lại danh mục" });
    fireEvent.click(screen.getByRole("button", { name: "Chỉnh sửa hồ sơ" }));
    expect(screen.getByRole("button", { name: "Lưu thay đổi" })).toBeDisabled();
    expect(boundary.auth.user.preferences.interestTagIds).toEqual(["food"]);
  });
  it("retains an unavailable TravelStyle ID when toggling a current TravelStyle", async () => {
    boundary.auth.user.preferences.travelStyleTagIds = ["quiet", "archived-style"];
    apiClient.patch.mockResolvedValue(account());
    await render(tree()); await edit();
    expect(screen.getByText("1 lựa chọn đã lưu hiện không có trong danh mục.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Năng động" })); save();
    await waitFor(() => expect(apiClient.patch).toHaveBeenCalledWith("/users/me", { preferences: { travelStyleTagIds: ["quiet", "archived-style", "active"] } }));
  });
  it("allows empty preferences and safely renders missing profile data", async () => {
    boundary.auth.user = { id: "a", preferences: null, email: null, fullName: null, role: null };
    await render(tree());
    expect(screen.getByRole("heading", { name: "Chưa cập nhật tên" })).toBeInTheDocument();
    expect(screen.getByText("Chưa cập nhật email")).toBeInTheDocument();
    expect(screen.getByText("Chưa cập nhật vai trò")).toBeInTheDocument();
    await edit();
    expect(screen.getByRole("button", { name: "Ẩm thực" })).toHaveAttribute("aria-pressed", "false");
  });
});

describe("A7 deferred request and account lifecycle", () => {
  function AuthControls() {
    const auth = useAuth();
    return <><button type="button" onClick={() => auth.login("a@example.test", "test-only")}>Login A</button><button type="button" onClick={() => auth.login("b@example.test", "test-only")}>Login B</button><output aria-label="actual auth owner">{auth.user?.id || "logged-out"}|{auth.user?.fullName || ""}</output></>;
  }
  it.each(["switch", "session-ended", "same-owner"])("uses actual AuthProvider to protect a deferred profile completion: %s", async (transition) => {
    boundary.realAuth = true;
    vi.spyOn(authService, "login").mockResolvedValue({ accessToken: "test-only-in-memory-session" });
    vi.spyOn(authService, "getProfile").mockResolvedValueOnce(account()).mockResolvedValueOnce(account("b"));
    const pending = deferred(); apiClient.patch.mockReturnValue(pending.promise);
    await render(<MemoryRouter><AuthProvider><AuthControls /><ProfilePage /></AuthProvider></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Login A" }));
    await screen.findByRole("heading", { name: "Account a" });
    await edit(); rename("A updated"); save();
    if (transition === "switch") {
      fireEvent.click(screen.getByRole("button", { name: "Login B" }));
      await screen.findByRole("heading", { name: "Account b" });
    } else if (transition === "session-ended") {
      act(() => window.dispatchEvent(new CustomEvent(AUTH_EVENTS.SESSION_ENDED, { detail: { message: "Test session ended" } })));
      expect(screen.getByLabelText("actual auth owner")).toHaveTextContent("logged-out");
    }
    await act(async () => pending.resolve(account("a", { fullName: "A updated" })));
    expect(screen.getByLabelText("actual auth owner")).toHaveTextContent(transition === "switch" ? "b|Account b" : transition === "session-ended" ? "logged-out|" : "a|A updated");
    if (transition !== "same-owner") expect(screen.queryByText("Đã cập nhật hồ sơ.")).not.toBeInTheDocument();
    else expect(screen.getByRole("heading", { name: "A updated" })).toBeInTheDocument();
  });
  it.each(["reject", "resolve"])("ignores stale %s without affecting B's own pending save", async (completion) => {
    const old = deferred(); const current = deferred();
    apiClient.patch.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const view = await render(tree()); await edit(); rename("Old A"); save();
    const apply = boundary.auth.applyUserProfile;
    boundary.auth = { ...boundary.auth, user: account("b") };
    view.rerender(tree()); await edit(); rename("New B"); save();
    await act(async () => completion === "resolve" ? old.resolve(account("a")) : old.reject({ status: 500 }));
    expect(apply).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đang lưu..." })).toBeDisabled();
    await act(async () => current.resolve(account("b", { fullName: "New B" })));
    expect(apply).toHaveBeenCalledExactlyOnceWith(account("b", { fullName: "New B" }));
  });
  it.each(["logout", "demo", "initializing"])("clears private draft and ignores delayed save on %s", async (transition) => {
    const pending = deferred(); apiClient.patch.mockReturnValue(pending.promise);
    const view = await render(tree()); await edit(); rename("Private A edit"); save();
    const apply = boundary.auth.applyUserProfile;
    boundary.auth = transition === "demo" ? { ...boundary.auth, user: account("demo"), isDemo: true }
      : transition === "initializing" ? { ...boundary.auth, initializing: true }
        : { ...boundary.auth, user: null, isLoggedIn: false };
    view.rerender(tree());
    expect(screen.queryByDisplayValue("Private A edit")).not.toBeInTheDocument();
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
    await act(async () => pending.resolve(account("a")));
    expect(apply).not.toHaveBeenCalled();
  });
  it("does not revive a save from the old A session after logout and A login", async () => {
    const pending = deferred(); apiClient.patch.mockReturnValue(pending.promise);
    const view = await render(tree()); await edit(); rename("Old session"); save();
    const apply = boundary.auth.applyUserProfile;
    boundary.auth = { ...boundary.auth, user: null, isLoggedIn: false }; view.rerender(tree());
    boundary.auth = { ...boundary.auth, user: account(), isLoggedIn: true }; view.rerender(tree());
    await act(async () => pending.resolve(account("a", { fullName: "Old session" })));
    expect(apply).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: "Account a" })).toBeInTheDocument();
  });
  it.each(["resolve", "reject"])("ignores %s after page unmount", async (completion) => {
    const pending = deferred(); apiClient.patch.mockReturnValue(pending.promise);
    const view = await render(tree()); await edit(); rename("Unmounted"); save(); view.unmount();
    await act(async () => completion === "resolve" ? pending.resolve(account()) : pending.reject({ status: 401 }));
    expect(boundary.auth.applyUserProfile).not.toHaveBeenCalled();
  });
  it("ignores old owner's catalog completion and uses B's current catalog", async () => {
    const old = deferred(); const current = deferred();
    apiClient.get.mockReturnValueOnce(old.promise).mockReturnValueOnce(current.promise);
    const view = await render(tree());
    boundary.auth = { ...boundary.auth, user: account("b") }; view.rerender(tree());
    await act(async () => current.resolve([{ id: "food", type: "Interest", name: "B catalog" }]));
    await act(async () => old.resolve(tags));
    expect(screen.getByText("B catalog")).toBeInTheDocument();
    expect(screen.queryByText("Ẩm thực")).not.toBeInTheDocument();
  });
  it("supports StrictMode lifecycle replay without dropping a valid current save", async () => {
    apiClient.patch.mockResolvedValue(account());
    await render(<StrictMode>{tree()}</StrictMode>); await edit(); rename("Strict mode"); save();
    await screen.findByText("Đã cập nhật hồ sơ.");
    expect(boundary.auth.applyUserProfile).toHaveBeenCalledTimes(1);
  });
});

describe("A7 subscription, recent Trips and account consumers", () => {
  it("uses server Free quota and saved-trip usage values", async () => {
    boundary.subscription.subscription.usage = { generateUsed: 2, generateLimit: 7 };
    boundary.subscription.subscription.savedTrips = { used: 3, limit: 9 };
    await render(tree());
    expect(screen.getByText("Lượt tạo AI tháng này")).toBeInTheDocument();
    expect(screen.getByText("2 / 7")).toBeInTheDocument();
    expect(screen.getByText("3 / 9")).toBeInTheDocument();
  });
  it("uses a custom paid plan and Vietnam-local effective/paid dates", async () => {
    const sub = { plan: "Custom", effectiveUntil: "2026-10-20T03:00:00Z", endsAt: "2026-11-20T03:00:00Z", usage: { generateLimit: null }, savedTrips: { limit: null } };
    boundary.subscription = { ...boundary.subscription, subscription: sub, plans: [{ code: "Custom", name: "Gói riêng" }] };
    await render(tree());
    expect(screen.getByText("Gói riêng")).toBeInTheDocument();
    expect(screen.getByText(formatVnDateTime(sub.effectiveUntil))).toBeInTheDocument();
    expect(screen.getByText(formatVnDateTime(sub.endsAt))).toBeInTheDocument();
    expect(screen.getAllByText("Không giới hạn")).toHaveLength(2);
    expect(screen.queryByText("Lượt tạo AI tháng này")).not.toBeInTheDocument();
  });
  it.each(["loading", "error", "missing", "unbounded-code"])("honestly renders subscription %s without quota fallback", async (mode) => {
    boundary.subscription.subscription = mode === "unbounded-code" ? { plan: "Unknown" } : null;
    boundary.subscription.subscriptionLoading = mode === "loading";
    boundary.subscription.subscriptionError = mode === "error" ? "Subscription unavailable" : null;
    await render(tree());
    expect(screen.queryByText("Không giới hạn")).not.toBeInTheDocument();
    expect(screen.queryByText("Free", { exact: true })).not.toBeInTheDocument();
    expect(screen.getByTestId(mode === "loading" ? "profile-subscription-loading" : "profile-subscription-unavailable")).toBeInTheDocument();
  });
  it("does not invent usage when server omits quota fields", async () => {
    boundary.subscription.subscription = { plan: "Free" };
    await render(tree()); expect(screen.getAllByText("Chưa có thông tin")).toHaveLength(2);
  });
  it("hides cached quota values when SubscriptionContext reports an error", async () => {
    boundary.subscription.subscriptionError = "Failed refresh";
    await render(tree());
    expect(screen.getByTestId("profile-subscription-unavailable")).toHaveTextContent("Failed refresh");
    expect(screen.queryByText("0 / 1")).not.toBeInTheDocument();
  });
  it("renders mapped summary counts, finalized/draft stats and first-three order without detail GET", async () => {
    boundary.trip.savedTrips = ["z", "a", "q", "excluded"].map((id, index) => mapMyTrip({ id, stationName: id, durationHours: 2, status: index === 1 ? "Finalized" : "Draft", itemCount: 8 }));
    await render(tree()); await screen.findByText("Ẩm thực");
    expect(screen.getByLabelText("Số lịch trình đã lưu")).toHaveTextContent("4");
    expect(screen.getByLabelText("Số lịch trình đã chốt")).toHaveTextContent("1");
    expect(screen.getByLabelText("Số lịch trình nháp")).toHaveTextContent("3");
    const recent = screen.getByRole("region", { name: "Lịch trình gần đây" });
    const links = within(recent).getAllByRole("link").filter((link) => link.getAttribute("href").startsWith("/trips/"));
    expect(links.map((link) => link.getAttribute("href"))).toEqual(["/trips/z", "/trips/a", "/trips/q"]);
    expect(links[0]).toHaveTextContent("8 địa điểm");
    expect(apiClient.get).toHaveBeenCalledExactlyOnceWith("/tags");
    links[0].focus(); expect(links[0]).toHaveFocus();
    fireEvent.click(links[0]); expect(screen.getByLabelText("route")).toHaveTextContent("/trips/z");
  });
  it("handles long Trip titles and omitted item/duration fields with semantic links", async () => {
    const title = "Lịch trình tiếng Việt rất dài ".repeat(30);
    boundary.trip.savedTrips = [{ id: "long", title, status: "unknown" }];
    await render(tree());
    const link = screen.getByRole("link", { name: new RegExp("Lịch trình tiếng Việt rất dài") });
    expect(link).toHaveAttribute("href", "/trips/long");
    expect(link).toHaveTextContent("Chưa có thời lượng");
    expect(link).toHaveTextContent("Chưa rõ trạng thái");
    expect(link).toHaveTextContent("— địa điểm");
    expect(link.querySelector("button, a")).toBeNull();
  });
  it.each(["loading", "not-loaded", "error", "empty"])("renders honest recent Trips %s state", async (mode) => {
    boundary.trip.tripsLoading = mode === "loading";
    boundary.trip.tripsLoaded = mode !== "not-loaded";
    boundary.trip.tripsError = mode === "error";
    await render(tree());
    const recent = screen.getByRole("region", { name: "Lịch trình gần đây" });
    if (mode === "loading" || mode === "not-loaded") expect(within(recent).getByRole("status")).toHaveTextContent("Đang tải lịch trình");
    else if (mode === "error") {
      expect(within(recent).getByRole("alert")).toHaveTextContent("Chưa tải được lịch trình");
      fireEvent.click(within(recent).getByRole("button", { name: "Thử lại lịch trình" }));
      expect(boundary.trip.retryTrips).toHaveBeenCalledTimes(1);
      expect(screen.queryByLabelText("Số lịch trình đã lưu")).not.toBeInTheDocument();
    } else expect(within(recent).getByText("Chưa có lịch trình đã lưu.")).toBeInTheDocument();
  });
  it.each([["Xem tất cả", "/trips"], ["Quản lý gói", "/subscription"], ["Về LocalMate AI", "/about"]])("preserves semantic %s navigation", async (name, path) => {
    await render(tree()); const link = screen.getByRole("link", { name });
    expect(link).toHaveAttribute("href", path); fireEvent.click(link);
    expect(screen.getByLabelText("route")).toHaveTextContent(path);
  });
  it("opens the real NotificationBell inbox explicitly without read mutation", async () => {
    boundary.notifications = { ...boundary.notifications, enabled: true, unreadCount: 2 };
    apiClient.get.mockImplementation(async (path) => {
      if (path === "/tags") return tags;
      if (path === "/notifications?page=1&pageSize=10") return { items: [], page: 1, totalPages: 1 };
      throw new Error("Unexpected GET " + path);
    });
    await render(tree());
    fireEvent.click(screen.getByRole("button", { name: "Thông báo, 2 chưa đọc" }));
    const inbox = await screen.findByRole("dialog", { name: "Thông báo" });
    await within(inbox).findByText("Chưa có thông báo nào.");
    expect(apiClient.get).toHaveBeenCalledWith("/notifications?page=1&pageSize=10");
    expect(boundary.notifications.refreshUnreadCount).toHaveBeenCalledTimes(1);
    fireEvent.click(within(inbox).getByRole("button", { name: "Đóng thông báo" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("preserves Logout and home navigation without misleading Privacy/Help controls", async () => {
    await render(tree());
    expect(screen.queryByRole("button", { name: /Quyền riêng tư|Trợ giúp/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));
    expect(boundary.auth.logout).toHaveBeenCalledTimes(1);
    expect(screen.getByLabelText("route")).toHaveTextContent("/");
  });
});
