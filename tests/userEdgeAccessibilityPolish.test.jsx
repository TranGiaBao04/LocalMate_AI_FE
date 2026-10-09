import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SideNavigation } from "../src/components/layout/BottomNavigation";
import MyTripsPage from "../src/pages/trip/MyTripsPage";
import SavedTripDetailPage from "../src/pages/trip/SavedTripDetailPage";
import ExportTripModal from "../src/components/trip/export/ExportTripModal";
import CheckoutQuoteDialog from "../src/components/subscription/CheckoutQuoteDialog";
import PaymentCheckoutModal from "../src/components/subscription/PaymentCheckoutModal";

const state = vi.hoisted(() => ({ auth: {}, trip: {}, subscription: {}, review: vi.fn(), submit: vi.fn(), removeReview: vi.fn(), pdf: vi.fn() }));
vi.mock("../src/context/AuthContext", () => ({ useAuth: () => state.auth }));
vi.mock("../src/context/TripContext", () => ({ useTrip: () => state.trip }));
vi.mock("../src/context/SubscriptionContext", () => ({ useSubscription: () => state.subscription }));
vi.mock("../src/services/masterDataService", () => ({ masterDataService: { getMasterData: async () => ({ reviewQuickTags: [] }) } }));
vi.mock("../src/services/reviewService", () => ({ reviewService: { getReview: state.review, submitReview: state.submit, deleteReview: state.removeReview } }));
vi.mock("../src/services/feedbackService", () => ({ feedbackService: { getTripFeedback: async () => null } }));
vi.mock("../src/components/trip/export/tripPdfGenerator", () => ({ generateTripPdfBlob: state.pdf }));

const trip = { id: "t1", title: "Lịch trình kiểm thử", status: "finalized", durationHours: 2, estimatedBudget: 100000, createdAt: "2026-10-09", items: [{ id: "i1", placeName: "Địa điểm", orderIndex: 1, scheduledTime: "09:00", durationMinutes: 60, estimatedBudget: 100000, isVisited: true }] };
function mount(page) { return render(<MemoryRouter initialEntries={["/trips/t1"]}><button>Outside</button><Routes><Route path="/trips/:tripId" element={page} /></Routes></MemoryRouter>); }
function deferred() { let resolve; const promise = new Promise(r => { resolve = r; }); return { promise, resolve }; }
beforeEach(() => {
  state.auth = { user: { id: "test", fullName: "Test" }, isLoggedIn: true, isDemo: false };
  state.trip = { savedTrips: [trip], tripsLoading: false, tripsLoaded: true, tripsError: null, deleteTrip: vi.fn().mockResolvedValue(), fetchTrip: vi.fn().mockResolvedValue(trip), markVisited: vi.fn() };
  state.subscription = { subscription: { plan: "Free" }, subscriptionLoading: false, subscriptionError: null };
  state.review.mockReset().mockRejectedValue({ status: 404, code: "review_not_found" });
  state.submit.mockReset().mockResolvedValue({ rating: 5 });
  state.removeReview.mockReset().mockResolvedValue();
  state.pdf.mockReset();
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected network forbidden"); }));
});

describe("A9 export and payment keyboard boundaries", () => {
  it("Export retains focus when generation disables all available controls; Escape cannot interrupt", async () => {
    const pending = deferred(); state.pdf.mockReturnValue(pending.promise); const close = vi.fn();
    mount(<ExportTripModal open onClose={close} trip={{ ...trip, status: "draft" }} />);
    expect(state.pdf).not.toHaveBeenCalled();
    const generate = screen.getByRole("button", { name: "Tạo PDF" }); generate.focus(); fireEvent.click(generate);
    await act(async () => {});
    const dialog = screen.getByRole("dialog"); fireEvent.keyDown(window, { key: "Tab" });
    expect(dialog).toHaveFocus(); fireEvent.keyDown(window, { key: "Escape" }); expect(close).not.toHaveBeenCalled();
    await act(async () => pending.resolve(new Blob(["test-only"], { type: "application/pdf" })));
    expect(screen.getByRole("button", { name: /Tải PDF/ })).toBeEnabled();
  });
  it.each([false, true])("Quote traps keyboard and preserves confirm-busy Escape rule: %s", (busy) => {
    const close = vi.fn(); const confirm = vi.fn();
    mount(<CheckoutQuoteDialog isOpen onClose={close} onConfirm={confirm} confirmLoading={busy}
      quote={{ type: "Purchase", planCode: "Membership", listPrice: 59000, creditAmount: 0, amount: 59000, durationDays: 30, credits: [] }} />);
    const dialog = screen.getByRole("dialog"); expect(dialog).toHaveFocus();
    const buttons = within(dialog).getAllByRole("button").filter(button => !button.disabled);
    if (buttons.length) { buttons[buttons.length - 1].focus(); fireEvent.keyDown(window, { key: "Tab" }); expect(buttons[0]).toHaveFocus(); }
    fireEvent.keyDown(window, { key: "Escape" }); expect(close).toHaveBeenCalledTimes(busy ? 0 : 1); expect(confirm).not.toHaveBeenCalled();
  });
  it("Payment ReviewRequired remains server-provided, focus wraps without lookup creating an order", () => {
    const close = vi.fn(); mount(<PaymentCheckoutModal isOpen onClose={close}
      paymentIntent={{ orderId: "test-order", ownerId: "test", status: "ReviewRequired", amount: 59000, planCode: "Membership" }} />);
    const dialog = screen.getByRole("dialog"); expect(dialog).toHaveFocus();
    const buttons = within(dialog).getAllByRole("button").filter(button => !button.disabled);
    buttons[buttons.length - 1].focus(); fireEvent.keyDown(window, { key: "Tab" }); expect(buttons[0]).toHaveFocus();
    fireEvent.keyDown(window, { key: "Escape" }); expect(close).toHaveBeenCalledOnce();
  });
});
afterEach(() => { expect(fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); });

describe("A9 honest shared navigation", () => {
  it.each(["loading", "error", "missing"])("does not assert Free for unresolved subscription: %s", (mode) => {
    state.subscription = { subscription: null, subscriptionLoading: mode === "loading", subscriptionError: mode === "error" ? "Offline" : null };
    mount(<SideNavigation />);
    expect(screen.queryByText("Mặc định")).not.toBeInTheDocument();
    expect(screen.queryByText("Free")).not.toBeInTheDocument();
    expect(screen.getAllByText(mode === "loading" ? "Đang tải gói..." : "Chưa xác định gói").length).toBeGreaterThan(0);
  });
  it.each([{ tripsLoading: true }, { tripsLoaded: false }, { tripsError: "Offline" }])("does not assert saved count before authoritative list: %j", (flags) => {
    Object.assign(state.trip, flags); mount(<SideNavigation />);
    expect(screen.getByRole("button", { name: "Lịch trình", exact: true })).toBeInTheDocument();
    expect(screen.queryByText("1 đã lưu")).not.toBeInTheDocument();
  });
  it("preserves loaded zero, paid plan and unknown server plan", () => {
    state.trip.savedTrips = []; state.subscription.subscription = { plan: "FuturePlan" };
    mount(<SideNavigation />);
    expect(screen.getByRole("button", { name: "Lịch trình 0 đã lưu" })).toBeInTheDocument();
    expect(screen.getAllByText("FuturePlan")).toHaveLength(2);
  });
});

describe("A9 real Trip dialogs keyboard lifecycle", () => {
  it("Delete traps both Tab directions, Escape cancels, restores opener and body scrolling", () => {
    mount(<MyTripsPage />);
    const opener = screen.getByRole("button", { name: `Xóa lịch trình ${trip.title}` }); opener.focus(); fireEvent.click(opener);
    const dialog = screen.getByRole("dialog"); const cancel = within(dialog).getByRole("button", { name: "Huỷ" });
    expect(cancel).toHaveFocus(); expect(document.body.style.overflow).toBe("hidden");
    fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
    expect(within(dialog).getByRole("button", { name: "Xoá lịch trình" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement, { key: "Tab" }); expect(cancel).toHaveFocus();
    fireEvent.keyDown(cancel, { key: "Escape" }); expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(opener).toHaveFocus(); expect(document.body.style.overflow).not.toBe("hidden");
    expect(state.trip.deleteTrip).not.toHaveBeenCalled();
  });
  it("Delete keeps keyboard focus inside while every action is disabled", async () => {
    const pending = deferred(); state.trip.deleteTrip.mockReturnValue(pending.promise); mount(<MyTripsPage />);
    fireEvent.click(screen.getByRole("button", { name: `Xóa lịch trình ${trip.title}` }));
    const confirm = screen.getByRole("button", { name: "Xoá lịch trình" }); confirm.focus(); fireEvent.click(confirm);
    const dialog = screen.getByRole("dialog"); fireEvent.keyDown(dialog, { key: "Tab" });
    expect(dialog).toHaveFocus(); fireEvent.keyDown(dialog, { key: "Escape" }); expect(dialog).toBeInTheDocument();
    expect(state.trip.deleteTrip).toHaveBeenCalledExactlyOnceWith("t1"); await act(async () => pending.resolve());
  });
  it("Review receives focus, contains Tab, and restores the original Review action", async () => {
    mount(<SavedTripDetailPage />); const opener = await screen.findByRole("button", { name: /Đánh giá nhanh/ });
    opener.focus(); fireEvent.click(opener); const dialog = screen.getByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);
    const cancel = within(dialog).getByRole("button", { name: "Để sau" }); cancel.focus(); fireEvent.keyDown(cancel, { key: "Tab" });
    expect(within(dialog).getByRole("button", { name: "1 sao" })).toHaveFocus();
    fireEvent.keyDown(document.activeElement, { key: "Tab", shiftKey: true }); expect(cancel).toHaveFocus();
    fireEvent.click(cancel); expect(opener).toHaveFocus(); expect(state.submit).not.toHaveBeenCalled();
  });
  it("Delete Review receives safe initial focus and retains existing explicit-cancel behavior", async () => {
    state.review.mockResolvedValue({ rating: 4, quickTags: [], comment: "" }); mount(<SavedTripDetailPage />);
    const opener = await screen.findByRole("button", { name: "Xoá đánh giá Địa điểm" }); opener.focus(); fireEvent.click(opener);
    const dialog = screen.getByRole("dialog"); const cancel = within(dialog).getByRole("button", { name: "Giữ lại" });
    expect(cancel).toHaveFocus(); fireEvent.keyDown(cancel, { key: "Tab", shiftKey: true });
    expect(within(dialog).getByRole("button", { name: "Xoá đánh giá" })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Escape" }); expect(dialog).toBeInTheDocument();
    fireEvent.click(cancel); expect(opener).toHaveFocus(); expect(state.removeReview).not.toHaveBeenCalled();
  });
  it("returns Review success focus to a logical page action when the original opener no longer exists", async () => {
    mount(<SavedTripDetailPage />);
    const opener = await screen.findByRole("button", { name: /Đánh giá nhanh/ }); opener.focus(); fireEvent.click(opener);
    fireEvent.click(screen.getByRole("button", { name: "5 sao" }));
    fireEvent.click(screen.getByRole("button", { name: "Gửi đánh giá" }));
    fireEvent.click(await screen.findByRole("button", { name: "Quay lại lịch trình" }));
    expect(screen.getByRole("button", { name: "Về lịch trình cá nhân" })).toHaveFocus();
  });
});
