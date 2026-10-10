import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import * as Auth from "../src/context/AuthContext";
import * as Subscription from "../src/context/SubscriptionContext";
import SingleItineraryPaymentModal from "../src/components/itineraryPurchase/SingleItineraryPaymentModal";
import PaymentReturnPage from "../src/pages/subscription/PaymentReturnPage";
import { itineraryPurchaseService } from "../src/services/itineraryPurchaseService";
import { subscriptionService } from "../src/services/subscriptionService";
import { saveSinglePaymentIntent, getSinglePaymentIntent } from "../src/utils/itineraryPurchaseSession";

let auth;
const availability = { purchaseAllowed: true, productKind: "SingleItinerary", currency: "VND", price: 17000 };
const order = { orderId: "single-order", productKind: "SingleItinerary", amount: 17000,
  status: "Pending", qrCode: "deterministic-qr", checkoutUrl: "https://example.test/checkout" };
function store(overrides = {}) {
  saveSinglePaymentIntent("A", { ...order, clientAttemptId: "same-attempt", ...overrides });
}
function Modal(props) { return <SingleItineraryPaymentModal isOpen availability={availability} onClose={vi.fn()} {...props} />; }
beforeEach(() => {
  sessionStorage.clear(); localStorage.clear();
  auth = { user: { id: "A" }, isDemo: false, isLoggedIn: true };
  vi.spyOn(Auth, "useAuth").mockImplementation(() => auth);
  vi.spyOn(Subscription, "useSubscription").mockReturnValue({ refreshSubscription: vi.fn() });
  vi.spyOn(itineraryPurchaseService, "getOrder").mockResolvedValue(order);
  vi.spyOn(itineraryPurchaseService, "checkout").mockImplementation(() => { throw new Error("Unexpected checkout"); });
  vi.spyOn(subscriptionService, "getOrder").mockRejectedValue(new Error("Subscription lookup error"));
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected live network"); }));
});
afterEach(() => { cleanup(); expect(fetch).not.toHaveBeenCalled(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("A8 single payment surface", () => {
  it("resumes a known order using GET only and authoritative amount", async () => {
    store(); itineraryPurchaseService.getOrder.mockResolvedValue({ ...order, amount: 23000 });
    render(<Modal />);
    await screen.findByText("Chờ thanh toán");
    expect(screen.getByText("23.000đ")).toBeInTheDocument();
    expect(itineraryPurchaseService.getOrder).toHaveBeenCalledWith(order.orderId);
    expect(itineraryPurchaseService.checkout).not.toHaveBeenCalled();
    expect(document.querySelector("svg")).not.toBeNull();
  });
  it.each([
    ["Paid", null, "Đang xác nhận quyền chốt lịch trình..."],
    ["Paid", { entitlementId: "unused", available: true }, "Thanh toán thành công!"],
    ["Failed", null, "Thanh toán chưa hoàn tất"],
    ["Expired", null, "Mã thanh toán đã hết hạn"],
    ["Future", null, "Chưa xác nhận được trạng thái đơn hàng."],
    ["Pending", null, "Đang chuẩn bị giao dịch thanh toán..."],
  ])("renders server %s with entitlement %j", async (status, entitlement, heading) => {
    store(); itineraryPurchaseService.getOrder.mockResolvedValue({ ...order, status, entitlement, qrCode: null, checkoutUrl: null });
    render(<Modal />);
    expect(await screen.findByText(heading)).toBeInTheDocument();
    expect(document.querySelector("svg")).toBeNull();
    expect(itineraryPurchaseService.checkout).not.toHaveBeenCalled();
  });
  it("offers verified unused entitlement only by explicit action", async () => {
    store();
    const entitlement = { entitlementId: "unused", available: true, consumedAt: null, consumedTripId: null };
    itineraryPurchaseService.getOrder.mockResolvedValue({ ...order, status: "Paid", entitlement });
    const use = vi.fn(); render(<Modal draftTripId="draft" onUseEntitlement={use} />);
    const button = await screen.findByRole("button", { name: "Dùng lượt này để chốt lịch trình" });
    expect(use).not.toHaveBeenCalled(); fireEvent.click(button);
    expect(use).toHaveBeenCalledExactlyOnceWith(entitlement);
  });
  it("never offers a consumed entitlement", async () => {
    store(); itineraryPurchaseService.getOrder.mockResolvedValue({ ...order, status: "Paid",
      entitlement: { entitlementId: "used", available: false, consumedTripId: "another-trip" } });
    render(<Modal draftTripId="draft" onUseEntitlement={vi.fn()} />);
    await screen.findByText("Thanh toán thành công!");
    expect(screen.queryByRole("button", { name: /Dùng lượt này/ })).not.toBeInTheDocument();
  });
  it.each([undefined, -1, NaN, Infinity])("does not invent a price for unavailable %s", (price) => {
    store({ orderId: undefined });
    render(<Modal availability={{ ...availability, purchaseAllowed: false, price }} />);
    expect(screen.getByText("Chưa xác định")).toBeInTheDocument();
  });
  it("retries an uncertain checkout using the existing attempt", async () => {
    store({ orderId: undefined });
    itineraryPurchaseService.checkout.mockResolvedValue({ status: 200, data: order });
    render(<Modal />);
    expect(itineraryPurchaseService.checkout).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại cùng lượt mua" }));
    await screen.findByText("Chờ thanh toán");
    expect(itineraryPurchaseService.checkout).toHaveBeenCalledExactlyOnceWith("same-attempt");
  });
  it("lookup retry does not create another purchase", async () => {
    store(); itineraryPurchaseService.getOrder.mockRejectedValueOnce(new Error("Offline")).mockResolvedValue(order);
    render(<Modal />);
    await screen.findByText("Chưa thể xác nhận trạng thái. Vui lòng kiểm tra lại.");
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra lại trạng thái" }));
    await screen.findByText("Chờ thanh toán");
    expect(itineraryPurchaseService.checkout).not.toHaveBeenCalled();
  });
  it("drops a deferred order when its owner changes", async () => {
    let resolve; itineraryPurchaseService.getOrder.mockReturnValue(new Promise((yes) => { resolve = yes; }));
    store(); const view = render(<Modal />);
    await waitFor(() => expect(itineraryPurchaseService.getOrder).toHaveBeenCalled());
    auth = { ...auth, user: { id: "B" } }; view.rerender(<Modal />);
    await act(async () => resolve({ ...order, status: "Paid", entitlement: { entitlementId: "A-private" } }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(getSinglePaymentIntent("B")).toBeNull();
  });
  it("Demo never mounts a checkout", () => {
    auth.isDemo = true; render(<Modal />);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(itineraryPurchaseService.checkout).not.toHaveBeenCalled();
  });
  it("focuses the dialog, supports Escape, and restores entry focus", () => {
    store({ orderId: undefined });
    const trigger = document.createElement("button"); document.body.append(trigger); trigger.focus();
    const close = vi.fn(); const view = render(<Modal onClose={close} />);
    expect(screen.getByRole("dialog")).toHaveFocus();
    fireEvent.keyDown(window, { key: "Escape" }); expect(close).toHaveBeenCalledTimes(1);
    view.unmount(); expect(trigger).toHaveFocus(); trigger.remove();
  });
});

describe("A8 return product boundary", () => {
  it("does not fall back from a subscription error to Single lookup", async () => {
    store();
    render(<MemoryRouter initialEntries={["/payment/success?orderId=unknown-subscription"]}><PaymentReturnPage /></MemoryRouter>);
    await screen.findByText("Subscription lookup error");
    expect(itineraryPurchaseService.getOrder).not.toHaveBeenCalled();
    expect(itineraryPurchaseService.checkout).not.toHaveBeenCalled();
  });
  it.each([null, { entitlementId: "verified", available: true }])("Single Paid requires server entitlement evidence %j", async (entitlement) => {
    store(); itineraryPurchaseService.getOrder.mockResolvedValue({ ...order, status: "Paid", entitlement });
    render(<MemoryRouter initialEntries={[`/payment/success?orderId=${order.orderId}`]}><PaymentReturnPage /></MemoryRouter>);
    const title = entitlement ? "Thanh toán lịch trình thành công!" : "Đang xác nhận quyền chốt lịch trình...";
    expect(await screen.findByText(title)).toBeInTheDocument();
    expect(subscriptionService.getOrder).not.toHaveBeenCalled();
    expect(itineraryPurchaseService.checkout).not.toHaveBeenCalled();
  });
});
