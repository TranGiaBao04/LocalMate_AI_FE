import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within, cleanup } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import * as Auth from "../src/context/AuthContext";
import * as Trip from "../src/context/TripContext";
import * as Subscription from "../src/context/SubscriptionContext";
import { NotificationProvider } from "../src/context/NotificationContext";
import NotificationBell from "../src/components/notifications/NotificationBell";
import ProfilePage from "../src/pages/profile/ProfilePage";
import HomePage from "../src/pages/home/HomePage";
import { notificationService } from "../src/services/notificationService";
import { tagService } from "../src/services/tagService";
import { placeService } from "../src/services/placeService";
import { useCuratedItineraries } from "../src/hooks/useCuratedItineraries";
import { STORAGE_KEYS } from "../src/constants";

vi.mock("../src/hooks/useCuratedItineraries", () => ({ useCuratedItineraries: vi.fn() }));
vi.mock("../src/components/home/HomeSearch", () => ({ default: () => <div /> }));

const notification = (id, overrides = {}) => ({
  id, type: "welcome", title: `Notification ${id}`, body: `Body ${id}`,
  targetType: "None", targetId: null, isRead: false, readAt: null,
  createdAt: "2026-10-04T09:00:00Z", ...overrides,
});
const deferred = () => {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
};
function RouteProbe() { return <output aria-label="route">{useLocation().pathname}</output>; }
function Shell({ children }) {
  return <MemoryRouter initialEntries={["/home"]}><NotificationProvider>{children}<RouteProbe /></NotificationProvider></MemoryRouter>;
}
let items;
let auth;
function renderInbox(variant = "bell") { return render(<Shell><NotificationBell variant={variant} /></Shell>); }
async function openInbox(count = items.filter((item) => !item.isRead).length) {
  await waitFor(() => expect(screen.getByRole("button", { name: count ? `Thông báo, ${count} chưa đọc` : "Thông báo", exact: true })).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: count ? `Thông báo, ${count} chưa đọc` : "Thông báo", exact: true }));
  return screen.getByRole("dialog", { name: "Thông báo" });
}

beforeEach(() => {
  vi.restoreAllMocks();
  auth = { user: { id: "a", fullName: "Local User A", email: "a@example.test", role: "User" }, isLoggedIn: true, isDemo: false, initializing: false, logout: vi.fn(), applyUserProfile: vi.fn() };
  vi.spyOn(Auth, "useAuth").mockImplementation(() => auth);
  vi.spyOn(Trip, "useTrip").mockReturnValue({ savedTrips: [] });
  vi.spyOn(Subscription, "useSubscription").mockReturnValue({ subscription: { plan: "Free", usage: {}, savedTrips: {} }, plans: [], subscriptionLoading: false });
  vi.spyOn(tagService, "getTags").mockResolvedValue([]);
  vi.spyOn(placeService, "getMetroClusters").mockResolvedValue([]);
  useCuratedItineraries.mockReturnValue({ curated: [], loading: false });
  items = [notification("1")];
  vi.spyOn(notificationService, "getUnreadCount").mockImplementation(async () => ({ count: items.filter((item) => !item.isRead).length }));
  vi.spyOn(notificationService, "getNotifications").mockImplementation(async ({ page, pageSize }) => ({ items: items.slice((page - 1) * pageSize, page * pageSize), page, pageSize, totalCount: items.length, totalPages: Math.ceil(items.length / pageSize) }));
  vi.spyOn(notificationService, "markRead").mockImplementation(async (id) => { items = items.map((item) => item.id === id ? { ...item, isRead: true } : item); });
  vi.spyOn(notificationService, "markAllRead").mockImplementation(async () => { items = items.map((item) => ({ ...item, isRead: true })); });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); localStorage.clear(); });

describe("shared notification integration", () => {
  it.each([0, 3, 11])("T01 renders the authoritative badge for count %s", async (count) => {
    items = Array.from({ length: count }, (_, i) => notification(String(i)));
    renderInbox();
    const name = count ? `Thông báo, ${count} chưa đọc` : "Thông báo";
    const button = await screen.findByRole("button", { name, exact: true });
    if (count) expect(within(button).getByText(count > 9 ? "9+" : String(count))).toBeInTheDocument();
    else expect(button.textContent).toBe("notifications");
  });
  it("T02 loads page 1 with pageSize 10 and renders loading and item content", async () => {
    const pending = deferred();
    notificationService.getNotifications.mockReturnValueOnce(pending.promise);
    renderInbox();
    const dialog = await openInbox();
    expect(within(dialog).getByRole("status")).toHaveTextContent("Đang tải thông báo");
    expect(notificationService.getNotifications).toHaveBeenCalledWith({ page: 1, pageSize: 10 });
    await act(async () => pending.resolve({ items, page: 1, totalPages: 1 }));
    expect(screen.getByText("Body 1")).toBeInTheDocument();
  });
  it("renders the empty state without a read-all action", async () => {
    items = [];
    renderInbox();
    await openInbox();
    expect(await screen.findByText("Chưa có thông báo nào.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Đánh dấu đã đọc hết" })).not.toBeInTheDocument();
  });
  it("T03 marks only the selected unread item and reconciles the count", async () => {
    items.push(notification("2"));
    renderInbox();
    await openInbox();
    fireEvent.click(await screen.findByRole("button", { name: /Notification 1/ }));
    await screen.findByRole("button", { name: "Thông báo, 1 chưa đọc", exact: true });
    expect(notificationService.markRead).toHaveBeenCalledExactlyOnceWith("1");
    expect(items[1].isRead).toBe(false);
  });
  it("does not call mark-read for an already read item", async () => {
    items[0].isRead = true;
    renderInbox();
    await openInbox();
    fireEvent.click(await screen.findByRole("button", { name: /Notification 1/ }));
    expect(notificationService.markRead).not.toHaveBeenCalled();
  });
  it("prevents duplicate in-flight mark-read calls", async () => {
    const pending = deferred();
    notificationService.markRead.mockReturnValueOnce(pending.promise);
    renderInbox();
    await openInbox();
    const button = await screen.findByRole("button", { name: /Notification 1/ });
    fireEvent.click(button); fireEvent.click(button);
    expect(notificationService.markRead).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve());
  });
  it("T04 read-all updates all loaded items and removes the badge", async () => {
    items.push(notification("2"));
    renderInbox();
    await openInbox();
    await screen.findByText("Notification 2");
    fireEvent.click(screen.getByRole("button", { name: "Đánh dấu đã đọc hết" }));
    await screen.findByRole("button", { name: "Thông báo", exact: true });
    expect(notificationService.markAllRead).toHaveBeenCalledTimes(1);
    expect(items.every((item) => item.isRead)).toBe(true);
  });
  it("T05 load-more appends page 2 without replacing page 1", async () => {
    items = Array.from({ length: 11 }, (_, i) => notification(String(i + 1)));
    renderInbox();
    await openInbox();
    fireEvent.click(await screen.findByRole("button", { name: "Xem thêm" }));
    await screen.findByText("Notification 11");
    expect(screen.getByText("Notification 1")).toBeInTheDocument();
    expect(notificationService.getNotifications).toHaveBeenLastCalledWith({ page: 2, pageSize: 10 });
    expect(screen.queryByRole("button", { name: "Xem thêm" })).not.toBeInTheDocument();
  });
  it.each([
    ["T06", "CreateTrip", null, "/create"],
    ["T07", "Trip", "trip-owned", "/trips/trip-owned"],
    ["T08", "Subscription", null, "/subscription"],
    ["T09", "None", null, "/home"],
    ["T09", "Unknown", "other", "/home"],
    ["T09", "Trip", null, "/home"],
  ])("%s target %s navigates only to its supported route", async (_, targetType, targetId, route) => {
    items[0] = notification("1", { targetType, targetId });
    renderInbox(); await openInbox();
    fireEvent.click(await screen.findByRole("button", { name: /Notification 1/ }));
    await waitFor(() => expect(screen.getByLabelText("route")).toHaveTextContent(route));
    expect(notificationService.markRead).toHaveBeenCalledExactlyOnceWith("1");
  });
  it("T10 Profile opens the same inbox and reconciles on close/reopen", async () => {
    render(<Shell><ProfilePage /></Shell>);
    await openInbox();
    await screen.findByText("Notification 1");
    fireEvent.click(screen.getByRole("button", { name: "Đóng thông báo" }));
    items.push(notification("new"));
    await openInbox(1);
    await screen.findByText("Notification new");
    expect(notificationService.getNotifications).toHaveBeenCalledTimes(2);
  });
  it("T11 actual Home and Profile reconcile through one provider and service", async () => {
    render(<Shell><HomePage /><ProfilePage /></Shell>);
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Thông báo, 1 chưa đọc" })).toHaveLength(2));
    expect(notificationService.getUnreadCount).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getAllByRole("button", { name: "Thông báo, 1 chưa đọc" })[1]);
    await screen.findByText("Notification 1");
    fireEvent.click(screen.getByRole("button", { name: "Đánh dấu đã đọc hết" }));
    await waitFor(() => expect(screen.getAllByRole("button", { name: "Thông báo", exact: true })).toHaveLength(2));
    expect(notificationService.markAllRead).toHaveBeenCalledTimes(1);
  });
  it("T12 account change drops the old inbox and ignores a late count/list response", async () => {
    const oldCount = deferred(); const oldList = deferred();
    notificationService.getUnreadCount.mockReturnValueOnce(oldCount.promise);
    notificationService.getNotifications.mockReturnValueOnce(oldList.promise);
    const view = renderInbox();
    await openInbox(0);
    auth = { ...auth, user: { ...auth.user, id: "b" } };
    items = [notification("b"), notification("b2")];
    view.rerender(<Shell><NotificationBell /></Shell>);
    await screen.findByRole("button", { name: "Thông báo, 2 chưa đọc" });
    await act(async () => { oldCount.resolve({ count: 99 }); oldList.resolve({ items: [notification("old-owner")], page: 1, totalPages: 1 }); });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("Notification old-owner")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thông báo, 2 chưa đọc" })).toBeInTheDocument();
  });
  it.each(["demo", "signed-out", "initializing"])("T13 %s state makes no inbox requests", async (state) => {
    vi.useFakeTimers();
    auth = { ...auth, isDemo: state === "demo", isLoggedIn: state !== "signed-out", initializing: state === "initializing" };
    renderInbox("profile");
    expect(screen.getByRole("button", { name: "Thông báo", exact: true })).toBeDisabled();
    fireEvent.click(screen.getByRole("button", { name: "Thông báo", exact: true }));
    await act(async () => { await vi.advanceTimersByTimeAsync(180_000); });
    expect(notificationService.getUnreadCount).not.toHaveBeenCalled();
    expect(notificationService.getNotifications).not.toHaveBeenCalled();
  });
  it("T14 failed pagination preserves old data and retries exactly the failed page", async () => {
    items = Array.from({ length: 21 }, (_, i) => notification(String(i + 1)));
    renderInbox(); await openInbox();
    fireEvent.click(await screen.findByRole("button", { name: "Xem thêm" }));
    await screen.findByText("Notification 20");
    notificationService.getNotifications.mockRejectedValueOnce(new Error("Offline"));
    fireEvent.click(screen.getByRole("button", { name: "Xem thêm" }));
    await screen.findByRole("alert");
    expect(screen.getByText("Notification 1")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await screen.findByText("Notification 21");
    expect(notificationService.getNotifications).toHaveBeenLastCalledWith({ page: 3, pageSize: 10 });
    expect(screen.getAllByText("Notification 11")).toHaveLength(1);
  });
  it("failed mark-read preserves unread state, shows retry and does not navigate", async () => {
    items[0].targetType = "CreateTrip";
    notificationService.markRead.mockRejectedValueOnce(new Error("Offline"));
    renderInbox(); await openInbox();
    fireEvent.click(await screen.findByRole("button", { name: /Notification 1/ }));
    await screen.findByRole("alert");
    expect(screen.getByLabelText("route")).toHaveTextContent("/home");
    expect(screen.getByRole("button", { name: "Thông báo, 1 chưa đọc" })).toBeInTheDocument();
    expect(items[0].isRead).toBe(false);
  });
  it("failed read-all preserves unread state and offers retry", async () => {
    items = Array.from({ length: 11 }, (_, i) => notification(String(i + 1)));
    notificationService.markAllRead.mockRejectedValueOnce(new Error("Offline"));
    renderInbox(); await openInbox();
    fireEvent.click(await screen.findByRole("button", { name: "Xem thêm" }));
    await screen.findByText("Notification 11");
    fireEvent.click(screen.getByRole("button", { name: "Đánh dấu đã đọc hết" }));
    await screen.findByRole("alert");
    expect(items[0].isRead).toBe(false);
    expect(screen.getByRole("button", { name: "Thử lại" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(screen.queryByRole("alert")).not.toBeInTheDocument());
    expect(notificationService.getNotifications).toHaveBeenLastCalledWith({ page: 1, pageSize: 10 });
    expect(screen.getAllByText("Notification 1")).toHaveLength(1);
  });
  it("Escape and outside click close the shared panel", async () => {
    renderInbox(); await openInbox();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    await openInbox();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it("uses one visibility-aware polling interval rather than per-entry polling", async () => {
    vi.useFakeTimers();
    render(<Shell><NotificationBell /><NotificationBell variant="profile" /></Shell>);
    await act(async () => {});
    expect(notificationService.getUnreadCount).toHaveBeenCalledTimes(1);
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(notificationService.getUnreadCount).toHaveBeenCalledTimes(2);
  });
  it("notification service preserves the exact real API routes and HTTP methods", async () => {
    vi.restoreAllMocks();
    localStorage.setItem(STORAGE_KEYS.TOKEN, "unit-test-only");
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ items: [], page: 2, pageSize: 10, totalCount: 0, totalPages: 0 }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ count: 0 }), { status: 200, headers: { "Content-Type": "application/json" } }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetch);
    await notificationService.getNotifications({ page: 2, pageSize: 10 });
    await notificationService.getUnreadCount();
    await notificationService.markRead("owned-id");
    await notificationService.markAllRead();
    expect(fetch.mock.calls.map(([url, options]) => [url.replace(/^.*\/api/, "/api"), options.method])).toEqual([
      ["/api/notifications?page=2&pageSize=10", "GET"],
      ["/api/notifications/unread-count", "GET"],
      ["/api/notifications/owned-id/read", "POST"],
      ["/api/notifications/read-all", "POST"],
    ]);
    expect(fetch.mock.calls.every(([, options]) => options.headers.Authorization === "Bearer unit-test-only")).toBe(true);
  });
});
