import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import MyTripsPage from "../src/pages/trip/MyTripsPage";
import { mapMyTrip } from "../src/utils/tripMapper";

const boundary = vi.hoisted(() => ({ trip: null, demo: false }));
vi.mock("../src/context/TripContext", () => ({ useTrip: () => boundary.trip }));
vi.mock("../src/context/AuthContext", () => ({ useAuth: () => ({ user: { id: "test-owner" }, isLoggedIn: true, isDemo: boundary.demo }) }));
const first = mapMyTrip({ id: "t1", stationName: "Bến Thành", status: "Draft", durationHours: 2, estimatedBudget: 0, itemCount: 3, createdAt: "2026-10-09T00:00:00Z" });
const second = { ...first, id: "t2", title: "Một chuyến đi khác", status: "finalized" };
function RouteEvidence() { return <span data-testid="route">{useLocation().pathname}</span>; }
function mount() { return render(<MemoryRouter initialEntries={["/trips"]}><RouteEvidence /><MyTripsPage /></MemoryRouter>); }
function deferred() { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { resolve, reject, promise }; }
const remove = () => fireEvent.click(screen.getByRole("button", { name: `Xóa lịch trình ${first.title}` }));
beforeEach(() => {
  boundary.demo = false;
  boundary.trip = { savedTrips: [first, second], tripsLoading: false, tripsLoaded: true, tripsError: false, retryTrips: vi.fn(), deleteTrip: vi.fn().mockResolvedValue() };
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network forbidden"); }));
});
afterEach(() => { expect(globalThis.fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });

describe("A6 My Trips actual page contracts", () => {
  it("stretches the native link across the card while keeping Delete above it and independent", () => {
    mount(); const link = screen.getByRole("link", { name: first.title });
    const card = link.closest("li"); const button = within(card).getByRole("button", { name: `Xóa lịch trình ${first.title}` });
    expect(card).toHaveClass("relative", "isolate");
    expect(link).toHaveClass("after:absolute", "after:inset-0", "after:z-10");
    expect(button).toHaveClass("relative", "z-20");
    expect(button.closest("a")).toBeNull();
    fireEvent.click(button); expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByTestId("route")).toHaveTextContent("/trips");
    expect(boundary.trip.deleteTrip).not.toHaveBeenCalled();
  });
  it("detail links remain native keyboard-focusable controls independent of Delete", () => {
    mount(); const link = screen.getByRole("link", { name: first.title });
    expect(link.tagName).toBe("A"); expect(link.tabIndex).toBe(0); link.focus(); expect(link).toHaveFocus();
    const button = screen.getByRole("button", { name: `Xóa lịch trình ${first.title}` }); button.focus(); expect(button).toHaveFocus();
    expect(screen.getByTestId("route")).toHaveTextContent("/trips");
    expect(boundary.trip.deleteTrip).not.toHaveBeenCalled();
  });
  it("Demo takes priority over data and loading and preserves login/Create routes", () => {
    boundary.demo = true; boundary.trip.tripsLoading = true; mount();
    expect(screen.getByRole("heading", { name: "Đăng nhập để xem lịch trình" })).toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Lịch trình đã lưu" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Đăng nhập" })); expect(screen.getByTestId("route")).toHaveTextContent("/login");
    fireEvent.click(screen.getByRole("button", { name: "Tạo mới" })); expect(screen.getByTestId("route")).toHaveTextContent("/create");
  });
  it.each([{ tripsLoading: true }, { tripsLoaded: false }])("loading/not-loaded do not show cards or empty state: %j", (state) => {
    Object.assign(boundary.trip, state); mount(); expect(screen.getByRole("status")).toHaveTextContent("Đang tải lịch trình");
    expect(screen.queryByText(first.title)).not.toBeInTheDocument(); expect(screen.queryByText("Bạn chưa lưu lịch trình nào.")).not.toBeInTheDocument();
  });
  it("error calls existing retry without inventing data", () => {
    boundary.trip.tripsError = true; mount(); expect(screen.getByRole("alert")).toHaveTextContent("Không thể tải lịch trình");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" })); expect(boundary.trip.retryTrips).toHaveBeenCalledTimes(1);
  });
  it("empty list preserves both Create actions", () => {
    boundary.trip.savedTrips = []; mount(); expect(screen.getByRole("heading", { name: "Chưa có lịch trình đã lưu" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tạo lịch trình" })); expect(screen.getByTestId("route")).toHaveTextContent("/create");
  });
  it("real summary shape, order, zero budget and stop count remain honest without media/Metro", () => {
    mount(); const list = screen.getByRole("list", { name: "Lịch trình đã lưu" });
    expect(within(list).getAllByRole("heading").map(h => h.textContent)).toEqual([first.title, second.title]);
    expect(within(list).getAllByText("3 địa điểm")).toHaveLength(2); expect(within(list).getAllByText("~Miễn phí/người")).toHaveLength(2);
    expect(list.querySelector("img")).toBeNull(); expect(within(list).queryByText("Metro")).not.toBeInTheDocument();
    expect(first.items).toEqual([]); expect(screen.getByText("2 lịch trình")).toBeInTheDocument();
  });
  it("unknown status and long titles retain full accessible text", () => {
    const title = "Lịch trình tiếng Việt rất dài ".repeat(12); boundary.trip.savedTrips = [{ ...first, title, status: "future-status" }]; mount();
    expect(screen.getByText("Không rõ")).toBeInTheDocument(); const link = screen.getByRole("link", { name: title.trim() });
    expect(link).toHaveAttribute("href", "/trips/t1"); link.focus(); expect(link).toHaveFocus();
  });
  it("native detail link navigates and never wraps the independent Delete control", () => {
    mount(); const link = screen.getByRole("link", { name: first.title }); const button = screen.getByRole("button", { name: `Xóa lịch trình ${first.title}` });
    expect(link.contains(button)).toBe(false); expect(button.closest("a")).toBeNull(); link.focus(); expect(link).toHaveFocus();
    fireEvent.click(link); expect(screen.getByTestId("route")).toHaveTextContent("/trips/t1");
  });
  it.each(["cancel", "Escape"])("Delete %s closes without request/navigation", (kind) => {
    mount(); remove(); const dialog = screen.getByRole("dialog", { name: "Xoá lịch trình?" }); expect(within(dialog).getByText(first.title)).toBeInTheDocument();
    if (kind === "cancel") fireEvent.click(within(dialog).getByRole("button", { name: "Huỷ" })); else fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument(); expect(boundary.trip.deleteTrip).not.toHaveBeenCalled(); expect(screen.getByTestId("route")).toHaveTextContent("/trips");
  });
  it("Delete uses exact ID once, locks busy actions, closes only after success", async () => {
    const pending = deferred(); boundary.trip.deleteTrip.mockReturnValueOnce(pending.promise); mount(); remove();
    const dialog = screen.getByRole("dialog"); const confirm = within(dialog).getByRole("button", { name: "Xoá lịch trình" });
    fireEvent.click(confirm); fireEvent.click(confirm); expect(boundary.trip.deleteTrip).toHaveBeenCalledExactlyOnceWith("t1");
    expect(within(dialog).getByRole("button", { name: "Huỷ" })).toBeDisabled(); expect(within(dialog).getByRole("button", { name: "Đang xoá..." })).toBeDisabled();
    fireEvent.keyDown(dialog, { key: "Escape" }); expect(dialog).toBeInTheDocument();
    await act(async () => pending.resolve()); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
  it.each([404, 401, 403, 500])("Delete %s retains list and confirmation with mapped error", async (status) => {
    boundary.trip.deleteTrip.mockRejectedValueOnce({ status }); mount(); remove(); fireEvent.click(screen.getByRole("button", { name: "Xoá lịch trình" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(status === 404 ? "không còn tồn tại" : status === 500 ? "Không thể xoá" : "không có quyền xoá");
    expect(screen.getByRole("dialog")).toBeInTheDocument(); expect(screen.getByRole("link", { name: first.title })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Huỷ" })).toBeEnabled();
  });
});
