import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import PaymentReturnPage from "../src/pages/subscription/PaymentReturnPage";
import SingleItineraryPaymentModal from "../src/components/itineraryPurchase/SingleItineraryPaymentModal";
import * as Auth from "../src/context/AuthContext";
import * as Subscription from "../src/context/SubscriptionContext";
import * as Session from "../src/utils/itineraryPurchaseSession";
import { saveSubscriptionPaymentSession } from "../src/utils/subscriptionPaymentSession";
import { itineraryPurchaseService } from "../src/services/itineraryPurchaseService";
import { subscriptionService } from "../src/services/subscriptionService";

const ownerId = "owner-a";
const intent = { orderId: "single-order", clientAttemptId: "attempt-a",
  productKind: "SingleItinerary", draftTripId: "draft-one" };
const order = { orderId: intent.orderId, productKind: "SingleItinerary",
  status: "Paid", amount: 29000, entitlement: { entitlementId: "entitlement-a",
    available: true, grantedAt: "2026-10-03T12:00:00Z", consumedAt: null, consumedTripId: null } };
const tick = () => act(async () => { await vi.advanceTimersByTimeAsync(0); });

describe("Single payment return cross-tab correlation", () => {
  let singleRead;
  let subscriptionRead;
  let openCheckout;

  beforeEach(() => {
    vi.restoreAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-03T12:00:00Z"));
    sessionStorage.clear();
    localStorage.clear();
    vi.spyOn(Auth, "useAuth").mockReturnValue({ user: { id: ownerId } });
    vi.spyOn(Subscription, "useSubscription").mockReturnValue({ refreshSubscription: vi.fn() });
    singleRead = vi.spyOn(itineraryPurchaseService, "getOrder").mockResolvedValue(order);
    subscriptionRead = vi.spyOn(subscriptionService, "getOrder").mockResolvedValue({
      orderId: "subscription-order", status: "Paid", planCode: "TripPass" });
    openCheckout = vi.spyOn(Session, "openSinglePaymentCheckout").mockImplementation(() => {});
  });

  afterEach(() => { vi.useRealTimers(); vi.restoreAllMocks(); });

  async function page(query = "orderId=single-order", mode = "success") {
    const view = render(<MemoryRouter initialEntries={[`/payment/${mode}?${query}`]}>
      <PaymentReturnPage mode={mode} />
    </MemoryRouter>);
    await tick();
    return view;
  }

  it("A: a fresh noopener tab recovers exact Single correlation, not financial state", async () => {
    expect(Session.prepareSinglePaymentReturn(ownerId, { ...intent, amount: 1,
      status: "Paid", checkoutUrl: "https://provider.test/pay", token: "secret" })).toBe(true);
    sessionStorage.clear();
    const recovered = Session.getSinglePaymentReturnIntent(ownerId, intent.orderId);
    expect(recovered).toMatchObject({ ...intent, ownerId });
    for (const field of ["amount", "status", "checkoutUrl", "token", "entitlement", "creditAmount"]) {
      expect(recovered).not.toHaveProperty(field);
    }
    expect(Session.getSinglePaymentReturnIntent(ownerId)).toBeNull();
    expect(Session.getSinglePaymentReturnIntent("owner-b", intent.orderId)).toBeNull();
    expect(Session.getSinglePaymentReturnIntent(ownerId, "other-order")).toBeNull();
  });

  it("B: Paid success in a fresh tab uses only the Single owned-order API", async () => {
    Session.prepareSinglePaymentReturn(ownerId, intent);
    await page("orderId=single-order&status=FAILED");
    expect(singleRead).toHaveBeenCalledWith(intent.orderId);
    expect(subscriptionRead).not.toHaveBeenCalled();
    expect(screen.getByText("Thanh toán lịch trình thành công!")).toBeInTheDocument();
    expect(Session.getSinglePaymentIntent(ownerId)).toMatchObject(intent);
    expect(openCheckout).not.toHaveBeenCalled();
  });

  it.each(["Failed", "Expired", "Pending"])("C: cancel return reads server %s from Single, regardless of redirect Paid", async (status) => {
    Session.prepareSinglePaymentReturn(ownerId, intent);
    singleRead.mockResolvedValue({ ...order, status, entitlement: null });
    await page("orderId=single-order&status=PAID", "cancel");
    expect(singleRead).toHaveBeenCalledWith(intent.orderId);
    expect(subscriptionRead).not.toHaveBeenCalled();
    expect(screen.queryByText("Thanh toán lịch trình thành công!")).not.toBeInTheDocument();
  });

  it("D: hard reload and reopening an explicit paid order retain Single classification", async () => {
    Session.prepareSinglePaymentReturn(ownerId, intent);
    const first = await page();
    first.unmount();
    sessionStorage.clear();
    await page();
    expect(singleRead).toHaveBeenCalledTimes(2);
    expect(subscriptionRead).not.toHaveBeenCalled();
    expect(screen.getByText("Thanh toán lịch trình thành công!")).toBeInTheDocument();
  });

  it("E: an ordinary Subscription order is not hijacked by shared Single history", async () => {
    Session.prepareSinglePaymentReturn(ownerId, intent);
    await page("orderId=subscription-order");
    expect(subscriptionRead).toHaveBeenCalledWith("subscription-order");
    expect(singleRead).not.toHaveBeenCalled();
    expect(screen.getByText("Thanh toán thành công!")).toBeInTheDocument();
  });

  it("E: queryless Subscription session wins over a local Single session", async () => {
    Session.saveSinglePaymentIntent(ownerId, intent);
    saveSubscriptionPaymentSession(ownerId, { orderId: "subscription-order" });
    await page("");
    expect(subscriptionRead).toHaveBeenCalledWith("subscription-order");
    expect(singleRead).not.toHaveBeenCalled();
  });

  it("F: shared Single history alone never selects an unrelated queryless return", async () => {
    Session.prepareSinglePaymentReturn(ownerId, intent);
    await page("status=PAID&orderCode=123");
    expect(singleRead).not.toHaveBeenCalled();
    expect(subscriptionRead).not.toHaveBeenCalled();
    expect(screen.queryByText("Thanh toán lịch trình thành công!")).not.toBeInTheDocument();
  });

  it.each(["wrong-owner", "wrong-product", "wrong-order", "expired", "future", "missing-attempt"])("F: %s cross-tab record cannot authorize Single handoff", async (condition) => {
    Session.prepareSinglePaymentReturn(ownerId, intent);
    const key = `${Session.SINGLE_RETURN_CONTEXT_PREFIX}${ownerId}`;
    const records = JSON.parse(localStorage.getItem(key));
    const changes = { "wrong-owner": { ownerId: "owner-b" }, "wrong-product": { productKind: "SubscriptionPlan" },
      "wrong-order": { orderId: "other-order" }, "expired": { savedAt: Date.now() - 86400000 },
      "future": { savedAt: Date.now() + 1000 }, "missing-attempt": { clientAttemptId: null } };
    Object.assign(records[0], changes[condition]);
    localStorage.setItem(key, JSON.stringify(records));
    await page("singleCheckout=single-order");
    expect(singleRead).not.toHaveBeenCalled();
    expect(subscriptionRead).not.toHaveBeenCalled();
    expect(openCheckout).not.toHaveBeenCalled();
  });

  it("handoff verifies backend Pending and persists this tab before opening provider URL", async () => {
    Session.prepareSinglePaymentReturn(ownerId, intent);
    const checkoutUrl = "https://provider.test/confirmed";
    singleRead.mockResolvedValue({ ...order, status: "Pending", entitlement: null, checkoutUrl });
    openCheckout.mockImplementation(() => {
      expect(Session.getSinglePaymentIntent(ownerId)).toMatchObject({ ...intent, checkoutUrl });
    });
    await page("singleCheckout=single-order");
    expect(singleRead).toHaveBeenCalledWith(intent.orderId);
    expect(openCheckout).toHaveBeenCalledWith(checkoutUrl);
    expect(subscriptionRead).not.toHaveBeenCalled();
  });

  it("provider return without internal orderId uses the exact tab context seeded by handoff", async () => {
    Session.prepareSinglePaymentReturn(ownerId, intent);
    singleRead.mockResolvedValueOnce({ ...order, status: "Pending", entitlement: null,
      checkoutUrl: "https://provider.test/confirmed" });
    const handoff = await page("singleCheckout=single-order");
    handoff.unmount();
    await page("orderCode=123&status=FAILED", "cancel");
    expect(singleRead.mock.calls).toEqual([[intent.orderId], [intent.orderId]]);
    expect(subscriptionRead).not.toHaveBeenCalled();
    expect(screen.getByText("Thanh toán lịch trình thành công!")).toBeInTheDocument();
  });

  it("handoff cannot redirect for a wrong order/product response", async () => {
    Session.prepareSinglePaymentReturn(ownerId, intent);
    singleRead.mockResolvedValue({ ...order, productKind: "SubscriptionPlan", status: "Pending",
      checkoutUrl: "https://provider.test/wrong" });
    await page("singleCheckout=single-order");
    expect(openCheckout).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(subscriptionRead).not.toHaveBeenCalled();
  });

  it("handoff cannot open provider if the new tab cannot persist its correlation", async () => {
    Session.prepareSinglePaymentReturn(ownerId, intent);
    singleRead.mockResolvedValue({ ...order, status: "Pending", entitlement: null,
      checkoutUrl: "https://provider.test/confirmed" });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => { throw new Error("disabled"); });
    await page("singleCheckout=single-order");
    expect(openCheckout).not.toHaveBeenCalled();
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("actual checkout link publishes non-secret correlation and preserves noopener", async () => {
    vi.spyOn(itineraryPurchaseService, "checkout").mockResolvedValue({ status: 200,
      data: { ...order, status: "Pending", entitlement: null, checkoutUrl: "https://provider.test/pay" } });
    render(<SingleItineraryPaymentModal isOpen availability={{ purchaseAllowed: true, price: 29000,
      productKind: "SingleItinerary", currency: "VND" }}
      draftTripId="draft-one" onClose={vi.fn()} />);
    await tick();
    const link = screen.getByRole("link", { name: /Mở trang thanh toán PayOS/ });
    expect(link).toHaveAttribute("href", "/payment/success?singleCheckout=single-order");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
    fireEvent.click(link);
    sessionStorage.clear();
    expect(Session.getSinglePaymentReturnIntent(ownerId, intent.orderId)).toMatchObject({
      orderId: intent.orderId, ownerId, productKind: "SingleItinerary", draftTripId: "draft-one" });
  });

  it("bounded history prunes old records and owner clear does not affect another account", () => {
    for (let index = 0; index < 12; index++) {
      Session.prepareSinglePaymentReturn(ownerId, { ...intent, orderId: `order-${index}` });
    }
    expect(Session.getSinglePaymentReturnIntent(ownerId, "order-0")).toBeNull();
    expect(Session.getSinglePaymentReturnIntent(ownerId, "order-11")).not.toBeNull();
    Session.clearSinglePaymentIntent("owner-b");
    expect(Session.getSinglePaymentReturnIntent(ownerId, "order-11")).not.toBeNull();
    Session.clearSinglePaymentIntent(ownerId);
    expect(Session.getSinglePaymentReturnIntent(ownerId, "order-11")).toBeNull();
  });
});
