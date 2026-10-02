import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { StrictMode } from "react";
import { render, screen, fireEvent, act, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SingleItineraryPaymentModal from "../src/components/itineraryPurchase/SingleItineraryPaymentModal";
import PaymentReturnPage from "../src/pages/subscription/PaymentReturnPage";
import DraftItineraryPage from "../src/pages/trip/DraftItineraryPage";
import * as Auth from "../src/context/AuthContext";
import * as Subscription from "../src/context/SubscriptionContext";
import * as Trip from "../src/context/TripContext";
import { itineraryPurchaseService } from "../src/services/itineraryPurchaseService";
import { subscriptionService } from "../src/services/subscriptionService";
import { tripService } from "../src/services/tripService";
import {
  getSinglePaymentIntent, saveSinglePaymentIntent, clearSinglePaymentIntent,
  getSinglePaymentSessionKey, LEGACY_SINGLE_PAYMENT_SESSION_KEY,
} from "../src/utils/itineraryPurchaseSession";
import { saveSubscriptionPaymentSession, getSubscriptionPaymentSession } from "../src/utils/subscriptionPaymentSession";

const OWNER_A = "owner-a";
const OWNER_B = "owner-b";
const ENTITLEMENT_ID = "8c268c0f-96ba-411a-9691-61f1ddda8511";
const availableEntitlement = {
  entitlementId: ENTITLEMENT_ID, available: true,
  grantedAt: "2026-10-01T12:00:00Z", consumedAt: null, consumedTripId: null,
};
const availability = {
  productKind: "SingleItinerary", productCode: "SINGLE_ITINERARY",
  productLabel: "Single Itinerary", contractVersionId: "version-single",
  price: 29000, currency: "VND", purchaseAllowed: true,
  unusedEntitlementCount: 0, normalFinalizeAvailable: false,
  normalSavedTripsUsed: 1, normalSavedTripLimit: 1,
};
const ownedOrder = (fields = {}) => ({
  orderId: "single-order", productKind: "SingleItinerary", productCode: "SINGLE_ITINERARY",
  contractVersionId: "version-single", status: "Pending", amount: 29000, currency: "VND",
  expiresAt: "2026-10-03T12:15:00Z", checkoutUrl: null, qrCode: null, paidAt: null,
  entitlement: null, ...fields,
});
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const tick = async (ms = 0) => { await act(async () => { await vi.advanceTimersByTimeAsync(ms); }); };
const settle = async (pending, value) => { await act(async () => { pending.resolve(value); }); };

describe("FE-UP7: Single Itinerary contract and regression closure", () => {
  let user;
  let trip;
  let checkout;
  let getOrder;
  let getAvailability;
  let getEntitlements;
  let finalize;
  let refreshSubscription;
  let subscriptionReads;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-03T12:00:00Z"));
    sessionStorage.clear();
    localStorage.clear();
    user = { id: OWNER_A };
    trip = { id: "draft-one", status: "draft", title: "Draft one", mainArea: "Bến Thành", durationHours: 3, estimatedBudget: 150000, items: [] };
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Unexpected HTTP request"));
    vi.spyOn(Auth, "useAuth").mockImplementation(() => ({ user, isDemo: false, isLoggedIn: !!user }));
    refreshSubscription = vi.fn().mockResolvedValue({ savedTrips: { used: 1, limit: 1 } });
    vi.spyOn(Subscription, "useSubscription").mockReturnValue({ refreshSubscription });
    finalize = vi.fn().mockResolvedValue({ id: trip.id, status: "finalized" });
    vi.spyOn(Trip, "useTrip").mockImplementation(() => ({ currentTrip: trip, finalizeTrip: finalize, deleteItem: vi.fn(), savedTrips: Array(20).fill({ status: "finalized" }) }));
    checkout = vi.spyOn(itineraryPurchaseService, "checkout").mockResolvedValue({ status: 200, data: ownedOrder() });
    getOrder = vi.spyOn(itineraryPurchaseService, "getOrder").mockImplementation(async (orderId) => ownedOrder({ orderId }));
    getAvailability = vi.spyOn(itineraryPurchaseService, "getAvailability").mockResolvedValue(availability);
    getEntitlements = vi.spyOn(itineraryPurchaseService, "getMyEntitlements").mockResolvedValue({ unusedEntitlementCount: 0, entitlements: [] });
    subscriptionReads = ["checkout", "renew", "getCheckoutQuote", "getMySubscription"].map((method) => vi.spyOn(subscriptionService, method));
  });

  afterEach(() => { globalThis.fetch = originalFetch; vi.useRealTimers(); vi.restoreAllMocks(); });

  function modal(props = {}) {
    return <SingleItineraryPaymentModal isOpen availability={availability} onClose={vi.fn()} draftTripId="draft-one" onUseEntitlement={vi.fn()} {...props} />;
  }
  async function mountModal(props = {}) {
    const view = render(modal(props));
    await tick();
    return view;
  }
  async function mountDraft(overrides = {}) {
    getAvailability.mockResolvedValue({ ...availability, ...overrides });
    const view = render(<MemoryRouter><DraftItineraryPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Chốt lịch trình/ }));
    await tick();
    return view;
  }
  async function mountReturn(mode = "success", fields = {}, query = "") {
    saveSinglePaymentIntent(OWNER_A, { clientAttemptId: "attempt-return", orderId: "single-order", draftTripId: "draft-one", productKind: "SingleItinerary" });
    getOrder.mockResolvedValue(ownedOrder(fields));
    const element = <MemoryRouter initialEntries={[`/payment/${mode}?orderId=single-order${query}`]}><PaymentReturnPage mode={mode} /></MemoryRouter>;
    const view = render(element);
    await tick();
    return view;
  }

  it("S01: server 29000 is displayed", async () => {
    await mountModal();
    expect(screen.getByText(/29\.000/)).toBeInTheDocument();
  });
  it.each([null, { ...availability, price: undefined }, { ...availability, price: NaN }])("S02: missing/malformed availability has no fallback payment price (%j)", async (value) => {
    await mountModal({ availability: value });
    expect(screen.getByText("Chưa xác định")).toBeInTheDocument();
    expect(checkout).not.toHaveBeenCalled();
    expect(screen.queryByText(/29\.000/)).not.toBeInTheDocument();
  });
  it("S03: server purchaseAllowed false blocks Draft purchase", async () => {
    await mountDraft({ purchaseAllowed: false });
    fireEvent.click(screen.getByRole("button", { name: /Mua thêm lịch trình chưa khả dụng/ }));
    expect(checkout).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog", { name: "Mua thêm 1 lịch trình" })).not.toBeInTheDocument();
  });
  it("S04: unknown purchaseAllowed blocks", async () => {
    await mountModal({ availability: { ...availability, purchaseAllowed: undefined } });
    expect(checkout).not.toHaveBeenCalled();
  });
  it("S05: valid true availability permits deliberate Draft purchase", async () => {
    await mountDraft();
    fireEvent.click(screen.getByRole("button", { name: /Mua thêm 1 lịch trình/ }));
    await tick();
    expect(checkout).toHaveBeenCalledTimes(1);
  });
  it("S06: unknown blocked code cannot be bypassed by local quota", async () => {
    await mountModal({ availability: { ...availability, purchaseAllowed: false, blockedCode: "future_server_block", normalFinalizeAvailable: false, normalSavedTripsUsed: 99 } });
    expect(screen.getByRole("alert")).toHaveTextContent("Hiện chưa thể mua thêm");
    expect(checkout).not.toHaveBeenCalled();
  });
  it("S07: UUID exists before POST", async () => {
    checkout.mockImplementation(async (attempt) => {
      expect(attempt).toMatch(/^[0-9a-f-]{36}$/i);
      return { status: 200, data: ownedOrder() };
    });
    await mountModal();
    expect(checkout).toHaveBeenCalledTimes(1);
  });
  it("S08: attempt is persisted before POST", async () => {
    checkout.mockImplementation(async (attempt) => {
      expect(getSinglePaymentIntent(OWNER_A)).toMatchObject({ clientAttemptId: attempt });
      expect(getSinglePaymentIntent(OWNER_A).orderId).toBeUndefined();
      return { status: 202, data: ownedOrder() };
    });
    await mountModal();
  });
  it("S09: real checkout wire body is exactly attempt only", async () => {
    checkout.mockRestore();
    globalThis.fetch.mockResolvedValue(new Response(JSON.stringify(ownedOrder()), { status: 202, headers: { "Content-Type": "application/json" } }));
    expect((await itineraryPurchaseService.checkout("attempt-wire")).status).toBe(202);
    const [url, init] = globalThis.fetch.mock.calls[0];
    expect(url).toMatch(/\/itinerary-purchases\/checkout$/);
    expect(init.method).toBe("POST");
    expect(JSON.parse(init.body)).toEqual({ clientAttemptId: "attempt-wire" });
  });
  it("S10: modal sends no price/product/owner/trip/version arguments", async () => {
    await mountModal();
    expect(checkout.mock.calls[0]).toEqual([getSinglePaymentIntent(OWNER_A).clientAttemptId]);
  });
  it("S11: lost response retains attempt without declaring Failed", async () => {
    checkout.mockRejectedValue(new Error("connection lost"));
    await mountModal();
    expect(getSinglePaymentIntent(OWNER_A).clientAttemptId).toBe(checkout.mock.calls[0][0]);
    expect(screen.getByText("Chưa xác nhận được giao dịch")).toBeInTheDocument();
    expect(screen.queryByText("Thanh toán chưa hoàn tất")).not.toBeInTheDocument();
  });
  it("S12: explicit uncertain retry uses same attempt", async () => {
    checkout.mockRejectedValueOnce(new Error("timeout"));
    await mountModal();
    fireEvent.click(screen.getByRole("button", { name: "Thử lại cùng lượt mua" }));
    await tick();
    expect(checkout.mock.calls[1][0]).toBe(checkout.mock.calls[0][0]);
  });
  it("S13: reload/reopen keeps attempt and requires explicit retry", async () => {
    checkout.mockRejectedValueOnce(new Error("timeout"));
    const view = await mountModal();
    const attempt = checkout.mock.calls[0][0];
    view.unmount();
    await mountModal();
    expect(checkout).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Thử lại cùng lượt mua" }));
    await tick();
    expect(checkout.mock.calls[1][0]).toBe(attempt);
  });
  it("S14: network error creates no automatic new UUID/POST", async () => {
    const uuid = vi.spyOn(crypto, "randomUUID");
    checkout.mockRejectedValue(new Error("offline"));
    await mountModal();
    await tick(30000);
    expect(uuid).toHaveBeenCalledTimes(1);
    expect(checkout).toHaveBeenCalledTimes(1);
  });
  it("S15: deliberate additional purchase gets new UUID after terminal evidence", async () => {
    checkout.mockResolvedValueOnce({ status: 200, data: ownedOrder({ status: "Expired" }) });
    await mountModal();
    fireEvent.click(screen.getByRole("button", { name: "Mua thêm một lượt mới" }));
    await tick();
    expect(checkout.mock.calls[0][0]).not.toBe(checkout.mock.calls[1][0]);
  });
  it("S16: N deliberate successful purchases preserve distinct attempts", async () => {
    checkout.mockResolvedValue({ status: 200, data: ownedOrder({ status: "Paid", entitlement: availableEntitlement }) });
    await mountModal();
    for (let index = 0; index < 2; index++) {
      fireEvent.click(screen.getByRole("button", { name: "Mua thêm một lượt mới" }));
      await tick();
    }
    expect(new Set(checkout.mock.calls.map(([attempt]) => attempt)).size).toBe(3);
  });
  it("S17: HTTP202 persists durable order and original attempt", async () => {
    checkout.mockResolvedValue({ status: 202, data: ownedOrder() });
    await mountModal();
    expect(screen.getByText("Đang chuẩn bị giao dịch thanh toán...")).toBeInTheDocument();
    expect(getSinglePaymentIntent(OWNER_A)).toMatchObject({ orderId: "single-order", status: "Pending", amount: 29000, clientAttemptId: checkout.mock.calls[0][0] });
  });
  it("S18: HTTP202 resumes by owned GET, never another checkout", async () => {
    checkout.mockResolvedValue({ status: 202, data: ownedOrder() });
    await mountModal();
    await tick(9000);
    expect(getOrder).toHaveBeenCalledTimes(3);
    expect(checkout).toHaveBeenCalledTimes(1);
  });
  it("S19: Pending QR is payment-ready", async () => {
    checkout.mockResolvedValue({ status: 200, data: ownedOrder({ qrCode: "MOCK-QR" }) });
    await mountModal();
    expect(screen.getByText("Chờ thanh toán")).toBeInTheDocument();
    expect(document.querySelector("svg")).toBeInTheDocument();
  });
  it("S20: URL-only Pending is payment-ready", async () => {
    checkout.mockResolvedValue({ status: 200, data: ownedOrder({ checkoutUrl: "https://example.test/owner-a" }) });
    await mountModal();
    expect(screen.getByRole("link", { name: /Mở trang thanh toán PayOS/ })).toHaveAttribute("href", "https://example.test/owner-a");
    expect(screen.getByText("Chờ thanh toán")).toBeInTheDocument();
  });
  it("S21: Pending without link is preparing", async () => {
    await mountModal();
    expect(screen.getByText("Đang chuẩn bị giao dịch thanh toán...")).toBeInTheDocument();
  });
  it("S22: Paid alone is verifying, not success", async () => {
    checkout.mockResolvedValue({ status: 200, data: ownedOrder({ status: "Paid" }) });
    await mountModal();
    expect(screen.getByText("Đang xác nhận quyền chốt lịch trình...")).toBeInTheDocument();
    expect(screen.queryByText("Thanh toán thành công!")).not.toBeInTheDocument();
  });
  it("S23: Paid without grant continues owned lookup", async () => {
    checkout.mockResolvedValue({ status: 200, data: ownedOrder({ status: "Paid" }) });
    getOrder.mockResolvedValue(ownedOrder({ status: "Paid" }));
    await mountModal();
    await tick(6000);
    expect(getOrder).toHaveBeenCalledTimes(2);
  });
  it("S24: Paid plus entitlement is success", async () => {
    checkout.mockResolvedValue({ status: 200, data: ownedOrder({ status: "Paid", entitlement: availableEntitlement }) });
    await mountModal();
    expect(screen.getByText("Thanh toán thành công!")).toBeInTheDocument();
    await tick(9000);
    expect(getOrder).not.toHaveBeenCalled();
  });
  it("S25: Single success never refreshes subscription as grant proof", async () => {
    await mountReturn("success", { status: "Paid", entitlement: availableEntitlement });
    expect(refreshSubscription).not.toHaveBeenCalled();
    subscriptionReads.forEach((spy) => expect(spy).not.toHaveBeenCalled());
  });
  it("S26: zero countdown cannot synthesize Expired", async () => {
    checkout.mockResolvedValue({ status: 200, data: ownedOrder({ expiresAt: "2020-01-01T00:00:00Z", qrCode: "QR" }) });
    getOrder.mockResolvedValue(ownedOrder({ qrCode: "QR" }));
    await mountModal();
    expect(screen.getByText("00:00")).toBeInTheDocument();
    await tick(3000);
    expect(screen.getByText("Chờ thanh toán")).toBeInTheDocument();
    expect(screen.queryByText("Mã thanh toán đã hết hạn")).not.toBeInTheDocument();
  });
  it("S27: server Expired displays distinct expiry", async () => {
    checkout.mockResolvedValue({ status: 200, data: ownedOrder({ status: "Expired" }) });
    await mountModal();
    expect(screen.getByText("Mã thanh toán đã hết hạn")).toBeInTheDocument();
  });
  it("S28: server Failed displays distinct failure", async () => {
    checkout.mockResolvedValue({ status: 200, data: ownedOrder({ status: "Failed" }) });
    await mountModal();
    expect(screen.getByText("Thanh toán chưa hoàn tất")).toBeInTheDocument();
  });
  it("S29: transient poll failure preserves reference and never POSTs", async () => {
    getOrder.mockRejectedValue(new Error("offline"));
    await mountModal();
    await tick(6000);
    expect(screen.getByRole("alert")).toHaveTextContent("Chưa thể xác nhận trạng thái");
    expect(getSinglePaymentIntent(OWNER_A).orderId).toBe("single-order");
    expect(checkout).toHaveBeenCalledTimes(1);
  });
  it("S30: long poll and repeated manual reads never overlap", async () => {
    const pending = deferred();
    getOrder.mockReturnValue(pending.promise);
    await mountModal();
    await tick(3000);
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra lại trạng thái" }));
    await tick(15000);
    expect(getOrder).toHaveBeenCalledTimes(1);
    await settle(pending, ownedOrder());
    await tick(3000);
    expect(getOrder).toHaveBeenCalledTimes(2);
  });
  it("S31: owner B cannot read A session", () => {
    saveSinglePaymentIntent(OWNER_A, { clientAttemptId: "a", orderId: "a-order", checkoutUrl: "https://example.test/a" });
    expect(getSinglePaymentIntent(OWNER_B)).toBeNull();
  });
  it("S32: owner B clear cannot clear A", () => {
    saveSinglePaymentIntent(OWNER_A, { clientAttemptId: "a" });
    clearSinglePaymentIntent(OWNER_B);
    expect(getSinglePaymentIntent(OWNER_A)).toMatchObject({ clientAttemptId: "a" });
  });
  it("S33: unowned legacy cache is discarded, never adopted", () => {
    sessionStorage.setItem(LEGACY_SINGLE_PAYMENT_SESSION_KEY, JSON.stringify({ orderId: "legacy", checkoutUrl: "https://example.test/legacy" }));
    expect(getSinglePaymentIntent(OWNER_A)).toBeNull();
    expect(sessionStorage.getItem(LEGACY_SINGLE_PAYMENT_SESSION_KEY)).toBeNull();
  });
  it("S34: discarding legacy cache does not itself purchase", () => {
    sessionStorage.setItem(LEGACY_SINGLE_PAYMENT_SESSION_KEY, "{}");
    getSinglePaymentIntent(OWNER_A);
    expect(checkout).not.toHaveBeenCalled();
  });
  it("S35: account switch ignores delayed checkout A", async () => {
    const pending = deferred();
    checkout.mockReturnValue(pending.promise);
    const view = await mountModal();
    user = { id: OWNER_B };
    view.rerender(modal());
    await settle(pending, { status: 200, data: ownedOrder({ checkoutUrl: "https://example.test/a-secret", status: "Paid", entitlement: availableEntitlement }) });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(getSinglePaymentIntent(OWNER_B)).toBeNull();
    expect(checkout).toHaveBeenCalledTimes(1);
  });
  it("S36: account switch ignores delayed poll A", async () => {
    const pending = deferred();
    getOrder.mockReturnValue(pending.promise);
    const view = await mountModal();
    await tick(3000);
    user = { id: OWNER_B };
    view.rerender(modal());
    await settle(pending, ownedOrder({ status: "Paid", entitlement: availableEntitlement }));
    expect(getSinglePaymentIntent(OWNER_B)).toBeNull();
    expect(getSinglePaymentIntent(OWNER_A).status).toBe("Pending");
  });
  it("S37: stale previous attempt response cannot overwrite deliberate new attempt", async () => {
    checkout.mockResolvedValueOnce({ status: 200, data: ownedOrder({ status: "Failed" }) });
    const pending = deferred();
    getOrder.mockReturnValue(pending.promise);
    await mountModal();
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra lại trạng thái" }));
    await tick();
    checkout.mockResolvedValueOnce({ status: 200, data: ownedOrder({ orderId: "new-order", checkoutUrl: "https://example.test/new" }) });
    fireEvent.click(screen.getByRole("button", { name: "Mua thêm một lượt mới" }));
    await tick();
    await settle(pending, ownedOrder({ status: "Paid", entitlement: availableEntitlement }));
    expect(getSinglePaymentIntent(OWNER_A).orderId).toBe("new-order");
    expect(screen.getByText("Chờ thanh toán")).toBeInTheDocument();
  });
  it("S38: cached QR/URL stays hidden until owned lookup confirms", async () => {
    saveSinglePaymentIntent(OWNER_A, { clientAttemptId: "a", orderId: "single-order", checkoutUrl: "https://example.test/cached" });
    const pending = deferred();
    getOrder.mockReturnValue(pending.promise);
    await mountModal();
    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    await settle(pending, ownedOrder({ checkoutUrl: "https://example.test/confirmed" }));
    expect(screen.getByRole("link")).toHaveAttribute("href", "https://example.test/confirmed");
    expect(checkout).not.toHaveBeenCalled();
  });
  it("S39: Single storage never changes Subscription session", () => {
    saveSubscriptionPaymentSession(OWNER_A, { orderId: "subscription-order", amount: 59000 });
    saveSinglePaymentIntent(OWNER_A, { clientAttemptId: "single-attempt" });
    clearSinglePaymentIntent(OWNER_A);
    expect(getSubscriptionPaymentSession(OWNER_A).orderId).toBe("subscription-order");
  });
  it("S40: success return performs owned Single lookup", async () => {
    await mountReturn();
    expect(getOrder).toHaveBeenCalledWith("single-order");
  });
  it("S41: cancel return also performs owned lookup", async () => {
    await mountReturn("cancel");
    expect(getOrder).toHaveBeenCalledWith("single-order");
  });
  it("S42: cancel Pending remains Pending and continues non-overlapping reads", async () => {
    await mountReturn("cancel");
    expect(screen.getByText("Giao dịch đang chờ thanh toán")).toBeInTheDocument();
    await tick(5000);
    expect(getOrder).toHaveBeenCalledTimes(3);
  });
  it("S43: cancel Paid plus entitlement succeeds", async () => {
    await mountReturn("cancel", { status: "Paid", entitlement: availableEntitlement });
    expect(screen.getByText("Thanh toán lịch trình thành công!")).toBeInTheDocument();
  });
  it("S44: cancel Paid without entitlement is verifying", async () => {
    await mountReturn("cancel", { status: "Paid" });
    expect(screen.getByText("Đang xác nhận quyền chốt lịch trình...")).toBeInTheDocument();
    await tick(2500);
    expect(getOrder).toHaveBeenCalledTimes(2);
  });
  it("S45: cancel Failed uses server failure", async () => {
    await mountReturn("cancel", { status: "Failed" });
    expect(screen.getByText("Thanh toán lịch trình chưa hoàn tất")).toBeInTheDocument();
  });
  it("S46: cancel Expired uses server expiry", async () => {
    await mountReturn("cancel", { status: "Expired" });
    expect(screen.getByText("Giao dịch mua lịch trình đã hết hạn")).toBeInTheDocument();
  });
  it("S47: success redirect query cannot synthesize Paid", async () => {
    await mountReturn("success", {}, "&status=Paid&success=true");
    expect(screen.queryByText("Thanh toán lịch trình thành công!")).not.toBeInTheDocument();
    expect(screen.getByText("Giao dịch đang chờ thanh toán")).toBeInTheDocument();
  });
  it("S48: return error retains order/attempt for explicit retry-read", async () => {
    await mountReturn();
    getOrder.mockRejectedValueOnce(new Error("offline"));
    await tick(2500);
    expect(screen.getByRole("alert")).toHaveTextContent("Vui lòng thử kiểm tra lại");
    expect(getSinglePaymentIntent(OWNER_A)).toMatchObject({ orderId: "single-order", clientAttemptId: "attempt-return" });
    fireEvent.click(screen.getByRole("button", { name: "Thử kiểm tra lại" }));
    await tick();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
  it("S49: initial return error cannot POST checkout", async () => {
    saveSinglePaymentIntent(OWNER_A, { orderId: "single-order", clientAttemptId: "attempt" });
    getOrder.mockRejectedValue(new Error("offline"));
    render(<MemoryRouter initialEntries={["/payment/cancel?orderId=single-order"]}><PaymentReturnPage mode="cancel" /></MemoryRouter>);
    await tick();
    expect(checkout).not.toHaveBeenCalled();
    expect(getSinglePaymentIntent(OWNER_A).clientAttemptId).toBe("attempt");
  });
  it("S50: Subscription error cannot fallback to Single", async () => {
    saveSinglePaymentIntent(OWNER_A, { orderId: "single-order", clientAttemptId: "attempt" });
    vi.spyOn(subscriptionService, "getOrder").mockRejectedValue(new Error("Subscription read error"));
    render(<MemoryRouter initialEntries={["/payment/success?orderId=subscription-order"]}><PaymentReturnPage /></MemoryRouter>);
    await tick();
    expect(screen.getByText("Subscription read error")).toBeInTheDocument();
    expect(getOrder).not.toHaveBeenCalled();
  });

  async function finalizeWire(funding) {
    globalThis.fetch.mockImplementation(async (url, init) => new Response(JSON.stringify(init.method === "POST" ? { tripId: "draft-one", status: "Finalized" } : { id: "draft-one", status: "Finalized", items: [] }), { status: 200, headers: { "Content-Type": "application/json" } }));
    await tripService.finalizeTrip("draft-one", funding);
    return JSON.parse(globalThis.fetch.mock.calls[0][1].body);
  }
  it("S51: explicit Normal has exact wire body", async () => {
    expect(await finalizeWire({ fundingSource: "Normal" })).toEqual({ fundingSource: "Normal" });
  });
  it("S52: explicit Single has exact wire body", async () => {
    expect(await finalizeWire({ fundingSource: "SingleEntitlement", entitlementId: ENTITLEMENT_ID })).toEqual({ fundingSource: "SingleEntitlement", entitlementId: ENTITLEMENT_ID });
  });
  it("S53: contradictory Normal plus entitlement fails before network", async () => {
    await expect(tripService.finalizeTrip("draft-one", { fundingSource: "Normal", entitlementId: ENTITLEMENT_ID })).rejects.toThrow(TypeError);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it.each([undefined, "", "   ", "not-a-guid", "00000000-0000-0000-0000-000000000000"])("S54: Single missing/invalid id rejects before network (%s)", async (id) => {
    await expect(tripService.finalizeTrip("draft-one", { fundingSource: "SingleEntitlement", entitlementId: id })).rejects.toThrow(TypeError);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it("S55: entitlement id alone cannot infer Single", async () => {
    await expect(tripService.finalizeTrip("draft-one", { entitlementId: ENTITLEMENT_ID })).rejects.toThrow(TypeError);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it("S56: unknown source fails before network", async () => {
    await expect(tripService.finalizeTrip("draft-one", { fundingSource: "Mystery", entitlementId: ENTITLEMENT_ID })).rejects.toThrow(TypeError);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
  it("S57: actual available entitlement can be explicitly selected", async () => {
    getEntitlements.mockResolvedValue({ unusedEntitlementCount: 1, entitlements: [availableEntitlement] });
    await mountDraft({ unusedEntitlementCount: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Dùng 1 lượt để chốt" }));
    await tick();
    expect(finalize).toHaveBeenCalledWith("draft-one", { fundingSource: "SingleEntitlement", entitlementId: ENTITLEMENT_ID });
  });
  it("S58: available false cannot be consumed even with null consumedAt", async () => {
    getEntitlements.mockResolvedValue({ unusedEntitlementCount: 1, entitlements: [{ ...availableEntitlement, available: false }] });
    await mountDraft({ unusedEntitlementCount: 1 });
    const button = screen.getByRole("button", { name: "Dùng 1 lượt để chốt" });
    expect(button).toBeDisabled();
    fireEvent.click(button);
    expect(finalize).not.toHaveBeenCalled();
  });
  it("S59: consumed evidence cannot be reused despite contradictory available true", async () => {
    getEntitlements.mockResolvedValue({ unusedEntitlementCount: 1, entitlements: [{ ...availableEntitlement, consumedAt: "2026-10-02T00:00:00Z", consumedTripId: "old-trip" }] });
    await mountDraft({ unusedEntitlementCount: 1 });
    expect(screen.getByRole("button", { name: "Dùng 1 lượt để chốt" })).toBeDisabled();
    expect(finalize).not.toHaveBeenCalled();
  });
  it("S60: successful purchase does not automatically bind/Finalize", async () => {
    checkout.mockResolvedValue({ status: 200, data: ownedOrder({ status: "Paid", entitlement: availableEntitlement }) });
    const use = vi.fn();
    await mountModal({ onUseEntitlement: use });
    await tick(10000);
    expect(use).not.toHaveBeenCalled();
    expect(finalize).not.toHaveBeenCalled();
  });
  it("S61: user can keep entitlement for later", async () => {
    checkout.mockResolvedValue({ status: 200, data: ownedOrder({ status: "Paid", entitlement: availableEntitlement }) });
    const onClose = vi.fn();
    const use = vi.fn();
    await mountModal({ onClose, onUseEntitlement: use });
    fireEvent.click(screen.getByRole("button", { name: "Để sau" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(use).not.toHaveBeenCalled();
  });
  it("S62: explicit purchased entitlement action Finalizes selected Trip only", async () => {
    checkout.mockResolvedValue({ status: 200, data: ownedOrder({ status: "Paid", entitlement: availableEntitlement }) });
    await mountDraft();
    fireEvent.click(screen.getByRole("button", { name: /Mua thêm 1 lịch trình/ }));
    await tick();
    expect(finalize).not.toHaveBeenCalled();
    getEntitlements.mockResolvedValue({ unusedEntitlementCount: 1, entitlements: [availableEntitlement] });
    fireEvent.click(screen.getByRole("button", { name: "Dùng lượt này để chốt lịch trình" }));
    await tick();
    expect(finalize).toHaveBeenCalledTimes(1);
    expect(finalize).toHaveBeenCalledWith("draft-one", { fundingSource: "SingleEntitlement", entitlementId: ENTITLEMENT_ID });
  });
  it("S63: delete cannot locally restore consumed Single evidence", async () => {
    const consumed = { ...availableEntitlement, available: false, consumedAt: "2026-10-02T00:00:00Z", consumedTripId: "old-trip" };
    getEntitlements.mockResolvedValue({ unusedEntitlementCount: 0, entitlements: [consumed] });
    const remove = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(null, { status: 204 }));
    await tripService.deleteTrip("old-trip");
    await mountDraft();
    expect(remove.mock.calls[0][1].method).toBe("DELETE");
    expect(screen.queryByRole("button", { name: "Dùng 1 lượt để chốt" })).not.toBeInTheDocument();
    expect(consumed.available).toBe(false);
  });
  it("S64: fork/new Draft cannot inherit previously consumed entitlement", async () => {
    getEntitlements.mockResolvedValue({ unusedEntitlementCount: 0, entitlements: [{ ...availableEntitlement, available: false, consumedAt: "2026-10-02T00:00:00Z", consumedTripId: "parent-trip" }] });
    trip = { ...trip, id: "fork-draft" };
    await mountDraft();
    expect(screen.queryByRole("button", { name: "Dùng 1 lượt để chốt" })).not.toBeInTheDocument();
    expect(finalize).not.toHaveBeenCalled();
  });
  it("S65: normal availability is server controlled", async () => {
    await mountDraft({ normalFinalizeAvailable: true });
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Chốt lịch trình" })).toBeEnabled();
  });
  it("S66: normal used capacity is server count, not local trip arrays", async () => {
    await mountDraft({ normalSavedTripsUsed: 7, normalSavedTripLimit: 7 });
    expect(screen.getByText("7/7 lịch trình")).toBeInTheDocument();
    expect(screen.queryByText(/20\/7/)).not.toBeInTheDocument();
  });
  it("S67: normal limit is server value", async () => {
    await mountDraft({ normalSavedTripsUsed: 3, normalSavedTripLimit: 5 });
    expect(screen.getByText("3/5 lịch trình")).toBeInTheDocument();
  });
  it("S68: successful Single Finalize never locally increments normal capacity", async () => {
    getEntitlements.mockResolvedValue({ unusedEntitlementCount: 1, entitlements: [availableEntitlement] });
    getAvailability.mockResolvedValueOnce({ ...availability, unusedEntitlementCount: 1 }).mockResolvedValue({ ...availability, unusedEntitlementCount: 0 });
    render(<MemoryRouter><DraftItineraryPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Chốt lịch trình/ }));
    await tick();
    fireEvent.click(screen.getByRole("button", { name: "Dùng 1 lượt để chốt" }));
    await tick();
    fireEvent.click(screen.getByRole("button", { name: /Chốt lịch trình/ }));
    await tick();
    expect(screen.getByText("1/1 lịch trình")).toBeInTheDocument();
    expect(screen.queryByText("2/1 lịch trình")).not.toBeInTheDocument();
  });
  it("S69: successful Finalize refreshes authoritative evidence and capacity", async () => {
    getEntitlements.mockResolvedValue({ unusedEntitlementCount: 1, entitlements: [availableEntitlement] });
    await mountDraft({ unusedEntitlementCount: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Dùng 1 lượt để chốt" }));
    await tick();
    expect(getAvailability).toHaveBeenCalledTimes(2);
    expect(getEntitlements).toHaveBeenCalledTimes(3);
    expect(refreshSubscription).toHaveBeenCalledTimes(1);
  });
  it("S70: Generate request contract remains unchanged by Single", async () => {
    const body = { durationHours: 3, budgetMax: 200000, tagIds: ["food"] };
    globalThis.fetch.mockResolvedValue(new Response(JSON.stringify({ id: "new-draft", status: "Draft", items: [] }), { status: 201, headers: { "Content-Type": "application/json" } }));
    await tripService.generateTrip(body);
    expect(globalThis.fetch.mock.calls[0][0]).toMatch(/\/trips\/generate$/);
    expect(JSON.parse(globalThis.fetch.mock.calls[0][1].body)).toEqual(body);
    expect(checkout).not.toHaveBeenCalled();
  });
  it("S71: Single never calls Subscription checkout", async () => { await mountModal(); expect(subscriptionReads[0]).not.toHaveBeenCalled(); });
  it("S72: Single never calls Subscription renew", async () => { await mountModal(); expect(subscriptionReads[1]).not.toHaveBeenCalled(); });
  it("S73: Single never calls Subscription quote", async () => { await mountModal(); expect(subscriptionReads[2]).not.toHaveBeenCalled(); });
  it("S74: Single Purchase/Credit0 does not infer Upgrade or show subscription credit", async () => {
    await mountModal();
    expect(getSinglePaymentIntent(OWNER_A).productKind).toBe("SingleItinerary");
    expect(getSinglePaymentIntent(OWNER_A).creditAmount).toBeUndefined();
    expect(screen.queryByText(/Upgrade|gia hạn|bù trừ/)).not.toBeInTheDocument();
    subscriptionReads.forEach((spy) => expect(spy).not.toHaveBeenCalled());
  });
  it("S75: Draft copy does not promise unlimited saving for every Upgrade", async () => {
    await mountDraft();
    expect(screen.getByText(/Nâng cấp sang gói phù hợp để có thêm hạn mức/)).toBeInTheDocument();
    expect(screen.queryByText(/lưu thêm không giới hạn/)).not.toBeInTheDocument();
  });
  it("S76: copy states initially unbound explicit use and keep later", async () => {
    await mountModal();
    expect(screen.getByText(/Lượt mua chưa gắn với lịch trình và chỉ dùng khi bạn chọn chốt/)).toBeInTheDocument();
  });

  it("Storage failure prevents checkout rather than risking an unpersisted attempt", async () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("storage disabled"); });
    await mountModal();
    expect(checkout).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toHaveTextContent("Chưa thể lưu lượt mua an toàn");
  });
  it("Default and string Normal callers remain explicit Normal", async () => {
    expect(await finalizeWire()).toEqual({ fundingSource: "Normal" });
    globalThis.fetch.mockClear();
    expect(await finalizeWire("Normal")).toEqual({ fundingSource: "Normal" });
  });
  it("Draft failed availability exposes read retry and blocks checkout/finalize", async () => {
    getAvailability.mockRejectedValue(new Error("offline"));
    render(<MemoryRouter><DraftItineraryPage /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: /Chốt lịch trình/ }));
    await tick();
    expect(screen.getByRole("button", { name: "Tải lại thông tin khả dụng" })).toBeInTheDocument();
    expect(within(screen.getByRole("dialog")).getByRole("button", { name: "Chốt lịch trình" })).toBeDisabled();
    expect(checkout).not.toHaveBeenCalled();
    expect(finalize).not.toHaveBeenCalled();
  });
  it("Return owner switch ignores late paid evidence and cannot clear A session", async () => {
    saveSinglePaymentIntent(OWNER_A, { clientAttemptId: "a", orderId: "single-order" });
    const pending = deferred();
    getOrder.mockReturnValue(pending.promise);
    vi.spyOn(subscriptionService, "getOrder").mockResolvedValue({ orderId: "single-order", status: "Pending" });
    const element = <MemoryRouter initialEntries={["/payment/success?orderId=single-order"]}><PaymentReturnPage /></MemoryRouter>;
    const view = render(element);
    await tick();
    user = { id: OWNER_B };
    view.rerender(element);
    // A new render element is necessary to simulate AuthContext rerender.
    view.rerender(<MemoryRouter initialEntries={["/payment/success?orderId=single-order"]}><PaymentReturnPage /></MemoryRouter>);
    await settle(pending, ownedOrder({ status: "Paid", entitlement: availableEntitlement }));
    expect(screen.queryByText("Thanh toán lịch trình thành công!")).not.toBeInTheDocument();
    expect(getSinglePaymentIntent(OWNER_A).orderId).toBe("single-order");
  });
  it("Single return retains product evidence after success instead of falling into Subscription", async () => {
    await mountReturn("success", { status: "Paid", entitlement: availableEntitlement });
    fireEvent.click(screen.getByRole("button", { name: "Thử kiểm tra lại" }));
    await tick();
    expect(screen.getByText("Thanh toán lịch trình thành công!")).toBeInTheDocument();
    expect(getSinglePaymentIntent(OWNER_A).orderId).toBe("single-order");
  });
  it("Draft rechecks availability before explicit consume and prevents double submit", async () => {
    getEntitlements.mockResolvedValue({ entitlements: [availableEntitlement], unusedEntitlementCount: 1 });
    await mountDraft({ unusedEntitlementCount: 1 });
    const pending = deferred();
    getEntitlements.mockReturnValue(pending.promise);
    const button = screen.getByRole("button", { name: "Dùng 1 lượt để chốt" });
    fireEvent.click(button);
    fireEvent.click(button);
    await settle(pending, { entitlements: [{ ...availableEntitlement, available: false }] });
    expect(finalize).not.toHaveBeenCalled();
  });
  it("Draft switch while entitlement read is pending cannot consume old Trip", async () => {
    getEntitlements.mockResolvedValue({ entitlements: [availableEntitlement], unusedEntitlementCount: 1 });
    const view = await mountDraft({ unusedEntitlementCount: 1 });
    const pending = deferred();
    getEntitlements.mockReturnValue(pending.promise);
    fireEvent.click(screen.getByRole("button", { name: "Dùng 1 lượt để chốt" }));
    trip = { ...trip, id: "new-draft" };
    view.rerender(<MemoryRouter><DraftItineraryPage /></MemoryRouter>);
    await settle(pending, { entitlements: [availableEntitlement] });
    expect(finalize).not.toHaveBeenCalled();
  });
  it("Owner is taken from scoped key, not an untrusted owner field", () => {
    sessionStorage.setItem(getSinglePaymentSessionKey(OWNER_A), JSON.stringify({ ownerId: OWNER_B, clientAttemptId: "a" }));
    expect(getSinglePaymentIntent(OWNER_B)).toBeNull();
    clearSinglePaymentIntent(OWNER_B);
    expect(getSinglePaymentIntent(OWNER_A).clientAttemptId).toBe("a");
  });
  it("Unmounted checkout cannot write later QR or grant evidence", async () => {
    const pending = deferred();
    checkout.mockReturnValue(pending.promise);
    const view = await mountModal();
    view.unmount();
    await settle(pending, { status: 200, data: ownedOrder({ checkoutUrl: "https://example.test/stale" }) });
    expect(getSinglePaymentIntent(OWNER_A).orderId).toBeUndefined();
  });
  it("Owned order amount overrides availability/catalog price", async () => {
    checkout.mockResolvedValue({ status: 200, data: ownedOrder({ amount: 27000, checkoutUrl: "https://example.test/pinned" }) });
    await mountModal();
    expect(screen.getByText(/27\.000/)).toBeInTheDocument();
    expect(screen.queryByText(/29\.000/)).not.toBeInTheDocument();
  });
  it("Normal finalize refresh preserves BE capacity and consumes no Single", async () => {
    await mountDraft({ normalFinalizeAvailable: true });
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Chốt lịch trình" }));
    await tick();
    expect(finalize).toHaveBeenCalledWith("draft-one", { fundingSource: "Normal" });
    expect(refreshSubscription).toHaveBeenCalledTimes(1);
    expect(checkout).not.toHaveBeenCalled();
  });
  it("202 without status still resumes through owned GET without inventing Pending", async () => {
    checkout.mockResolvedValue({ status: 202, data: ownedOrder({ status: undefined }) });
    await mountModal();
    expect(screen.getByText("Đang chuẩn bị giao dịch thanh toán...")).toBeInTheDocument();
    expect(getSinglePaymentIntent(OWNER_A).status).toBeUndefined();
    await tick(3000);
    expect(getOrder).toHaveBeenCalledTimes(1);
    expect(checkout).toHaveBeenCalledTimes(1);
  });
  it("StrictMode initialization cannot submit the attempt twice", async () => {
    render(<StrictMode>{modal()}</StrictMode>);
    await tick();
    expect(checkout).toHaveBeenCalledTimes(1);
  });
  it.each([null, undefined, ""])("Normal with any explicit entitlement field rejects (%s)", async (entitlementId) => {
    await expect(tripService.finalizeTrip("draft-one", { fundingSource: "Normal", entitlementId })).rejects.toThrow(TypeError);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
