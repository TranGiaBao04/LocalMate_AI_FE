import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import * as Auth from "../src/context/AuthContext";
import * as Subscription from "../src/context/SubscriptionContext";
import { subscriptionService } from "../src/services/subscriptionService";
import SubscriptionPage from "../src/pages/subscription/SubscriptionPage";
import PaymentReturnPage from "../src/pages/subscription/PaymentReturnPage";
import PlanCard from "../src/components/subscription/PlanCard";
import SubscriptionSummary from "../src/components/subscription/SubscriptionSummary";
import CheckoutQuoteDialog from "../src/components/subscription/CheckoutQuoteDialog";
import PaymentCheckoutModal from "../src/components/subscription/PaymentCheckoutModal";
import { saveSubscriptionPaymentSession } from "../src/utils/subscriptionPaymentSession";

const quote = { planCode: "Membership", type: "Purchase", listPrice: 59000,
  creditAmount: 0, amount: 59000, durationDays: 30, credits: [] };
const intent = { ...quote, orderId: "account-a-order", status: "Pending", qrCode: "test-only-qr" };
const deferred = () => { let resolve; let reject; const promise = new Promise((yes, no) => {
  resolve = yes; reject = no;
}); return { promise, resolve, reject }; };
let auth;
let context;
function Page() { return <MemoryRouter><SubscriptionPage /></MemoryRouter>; }
beforeEach(() => {
  sessionStorage.clear();
  auth = { user: { id: "A" }, isLoggedIn: true, isDemo: false };
  context = { plans: [{ code: "Membership", price: 59000, durationDays: 30 }],
    subscription: { plan: "Free" }, plansLoading: false, subscriptionLoading: false,
    refreshPlans: vi.fn(), refreshSubscription: vi.fn(), refreshAll: vi.fn() };
  vi.spyOn(Auth, "useAuth").mockImplementation(() => auth);
  vi.spyOn(Subscription, "useSubscription").mockImplementation(() => context);
  vi.spyOn(subscriptionService, "getCheckoutQuote").mockResolvedValue(quote);
  vi.spyOn(subscriptionService, "getOrder").mockResolvedValue(intent);
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected live network"); }));
});
afterEach(() => { cleanup(); expect(fetch).not.toHaveBeenCalled(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("A8 checkout owner boundary", () => {
  it.each(["resolve", "reject"])("ignores delayed checkout %s after account switch", async (completion) => {
    const pending = deferred();
    vi.spyOn(subscriptionService, "checkout").mockReturnValue(pending.promise);
    const view = render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "Chọn Membership" }));
    fireEvent.click(await screen.findByTestId("quote-confirm-button"));
    auth = { ...auth, user: { id: "B" } };
    view.rerender(<Page />);
    await act(async () => pending[completion](completion === "resolve" ? intent : new Error("A private failure")));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("A private failure")).not.toBeInTheDocument();
    expect(context.refreshSubscription).not.toHaveBeenCalled();
    expect(sessionStorage.length).toBe(0);
  });
  it("requires explicit confirmation before checkout", async () => {
    const checkout = vi.spyOn(subscriptionService, "checkout").mockResolvedValue(intent);
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "Chọn Membership" }));
    await screen.findByTestId("quote-confirm-button");
    expect(checkout).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("quote-confirm-button"));
    await waitFor(() => expect(checkout).toHaveBeenCalledExactlyOnceWith("Membership"));
  });
  it.each(["resolve", "reject"])("ignores delayed renewal %s after owner change", async (completion) => {
    context.subscription = { plan: "Membership", endsAt: "2027-01-01" };
    const pending = deferred();
    vi.spyOn(subscriptionService, "renew").mockReturnValue(pending.promise);
    const view = render(<Page />);
    fireEvent.click(screen.getAllByRole("button", { name: /Gia hạn Membership/ })[0]);
    auth = { ...auth, user: { id: "B" } };
    view.rerender(<Page />);
    await act(async () => pending[completion](completion === "resolve" ? intent : new Error("A renewal error")));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.queryByText("A renewal error")).not.toBeInTheDocument();
    expect(context.refreshSubscription).not.toHaveBeenCalled();
    expect(sessionStorage.length).toBe(0);
  });
  it("drops conflict reconciliation that finishes for an obsolete owner", async () => {
    const lookup = deferred();
    vi.spyOn(subscriptionService, "checkout").mockRejectedValue({ code: "pending_order_exists",
      data: { orderId: "account-a-order" } });
    subscriptionService.getOrder.mockReturnValue(lookup.promise);
    const view = render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "Chọn Membership" }));
    fireEvent.click(await screen.findByTestId("quote-confirm-button"));
    await waitFor(() => expect(subscriptionService.getOrder).toHaveBeenCalled());
    auth = { ...auth, user: { id: "B" } };
    view.rerender(<Page />);
    await act(async () => lookup.resolve(intent));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(sessionStorage.length).toBe(0);
  });
  it("blocks repeated confirmation while checkout is pending", async () => {
    const pending = deferred();
    const checkout = vi.spyOn(subscriptionService, "checkout").mockReturnValue(pending.promise);
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "Chọn Membership" }));
    const confirm = await screen.findByTestId("quote-confirm-button");
    fireEvent.click(confirm); fireEvent.click(confirm);
    expect(checkout).toHaveBeenCalledTimes(1);
    expect(confirm).toBeDisabled();
    await act(async () => pending.resolve(intent));
  });
  it("refreshes the same owner's subscription for Paid without displaying QR", async () => {
    vi.spyOn(subscriptionService, "checkout").mockResolvedValue({ ...intent, status: "Paid" });
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: "Chọn Membership" }));
    fireEvent.click(await screen.findByTestId("quote-confirm-button"));
    await waitFor(() => expect(context.refreshSubscription).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});

describe("A8 return lookup", () => {
  it("clears a failed lookup when retry returns Pending", async () => {
    subscriptionService.getOrder.mockRejectedValueOnce(new Error("Lookup unavailable"))
      .mockResolvedValueOnce({ orderId: "return-order", status: "Pending" });
    render(<MemoryRouter initialEntries={["/payment/success?orderId=return-order"]}><PaymentReturnPage /></MemoryRouter>);
    await screen.findByText("Lookup unavailable");
    fireEvent.click(screen.getByRole("button", { name: "Thử kiểm tra lại" }));
    await waitFor(() => expect(subscriptionService.getOrder).toHaveBeenCalledTimes(2));
    expect(await screen.findByText("Giao dịch đang chờ thanh toán")).toBeInTheDocument();
    expect(screen.queryByText("Lookup unavailable")).not.toBeInTheDocument();
  });
});

describe("A8 honest catalog and usage", () => {
  it("keeps Demo purchase disabled", () => {
    auth.isDemo = true;
    render(<Page />);
    expect(screen.getByRole("button", { name: "Cần tài khoản chính thức" })).toBeDisabled();
    expect(subscriptionService.getCheckoutQuote).not.toHaveBeenCalled();
  });
  it("renders catalog loading", () => {
    context.plans = []; context.plansLoading = true;
    render(<Page />);
    expect(screen.getByRole("status", { name: "Đang tải gói cước" })).toBeInTheDocument();
  });
  it("retries catalog errors without checkout", () => {
    context.plans = []; context.plansError = "Catalog unavailable";
    render(<Page />);
    fireEvent.click(screen.getByRole("button", { name: /Thử lại/ }));
    expect(context.refreshPlans).toHaveBeenCalledTimes(1);
  });
  it("presents and retries an empty catalog honestly", () => {
    context.plans = [];
    render(<Page />);
    expect(screen.getByText("Chưa có gói cước khả dụng.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Tải lại danh sách gói/ }));
    expect(context.refreshPlans).toHaveBeenCalledTimes(1);
  });
  it.each([undefined, NaN, Infinity, -1])("does not invent a price for %s", (price) => {
    render(<PlanCard plan={{ code: "Custom", price }} onSelect={vi.fn()} />);
    expect(screen.getByText("Chưa có giá")).toBeInTheDocument();
    expect(screen.queryByText("0đ")).not.toBeInTheDocument();
  });
  it("preserves authoritative zero price and finite quotas", () => {
    render(<PlanCard plan={{ code: "Free", price: 0, durationDays: null, generateLimit: 0, savedTripLimit: 0 }} />);
    expect(screen.getByText("0đ")).toBeInTheDocument();
    expect(screen.getByText("0 lượt tạo lịch trình")).toBeInTheDocument();
    expect(screen.getByText("Tối đa 0 lịch trình đã chốt")).toBeInTheDocument();
  });
  it.each([null, {}, { plan: "Future" }])("does not invent subscription usage for %j", (subscription) => {
    render(<SubscriptionSummary subscription={subscription} />);
    expect(screen.getByTestId("subscription-summary-unavailable")).toBeInTheDocument();
  });
  it("shows known Free usage and distinguishes missing counters", () => {
    render(<SubscriptionSummary subscription={{ plan: "Free", usage: { generateLimit: 3, generateUsed: 1 } }} />);
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(screen.getByText("Chưa có thông tin")).toBeInTheDocument();
  });
  it("shows paid effective and paid-through boundaries separately", () => {
    render(<SubscriptionSummary subscription={{ plan: "Membership", effectiveUntil: "2027-01-01", endsAt: "2027-02-01",
      usage: { generateLimit: null }, savedTrips: { limit: null } }} />);
    expect(screen.getByText(/Kỳ hiện tại đến/)).toBeInTheDocument();
    expect(screen.getByText(/Đã thanh toán đến/)).toBeInTheDocument();
    expect(screen.getAllByText("Không giới hạn")).toHaveLength(2);
  });
});

describe("A8 quote and payment states", () => {
  it.each(["Purchase", "Upgrade"])("displays exact %s server amounts and submits only plan code", (type) => {
    const confirm = vi.fn();
    render(<CheckoutQuoteDialog isOpen quote={{ ...quote, type, listPrice: 98765, creditAmount: 12345, amount: 86420 }}
      onConfirm={confirm} onClose={vi.fn()} />);
    expect(screen.getByText("98.765đ")).toBeInTheDocument();
    expect(screen.getByText("86.420đ")).toBeInTheDocument();
    if (type === "Upgrade") expect(screen.getByText(/12.345đ/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId("quote-confirm-button"));
    expect(confirm).toHaveBeenCalledExactlyOnceWith("Membership");
  });
  it("preserves quote Escape busy guard and restores entry focus", () => {
    const close = vi.fn();
    const trigger = document.createElement("button"); document.body.append(trigger); trigger.focus();
    const view = render(<CheckoutQuoteDialog isOpen quote={quote} confirmLoading onClose={close} />);
    expect(screen.getByRole("dialog")).toHaveFocus();
    fireEvent.keyDown(window, { key: "Escape" }); expect(close).not.toHaveBeenCalled();
    view.unmount(); expect(trigger).toHaveFocus(); trigger.remove();
  });
  it("cycles quote keyboard focus within enabled actions", () => {
    render(<CheckoutQuoteDialog isOpen quote={quote} onClose={vi.fn()} onConfirm={vi.fn()} />);
    const confirm = screen.getByTestId("quote-confirm-button"); confirm.focus();
    fireEvent.keyDown(window, { key: "Tab" });
    expect(screen.getByRole("button", { name: "Đóng", exact: true })).toHaveFocus();
    fireEvent.keyDown(window, { key: "Tab", shiftKey: true }); expect(confirm).toHaveFocus();
  });
  it.each([
    ["Paid", "Thanh toán thành công!"], ["ReviewRequired", "Thanh toán đang cần được kiểm tra"],
    ["Expired", "Mã thanh toán đã hết hạn"], ["Failed", "Thanh toán chưa hoàn tất"],
    ["Future", "Trạng thái giao dịch: Future"],
  ])("renders %s without a payable QR", (status, heading) => {
    render(<PaymentCheckoutModal isOpen paymentIntent={{ ...intent, status }} onClose={vi.fn()} />);
    expect(screen.getByText(heading)).toBeInTheDocument();
    expect(document.querySelector("svg")).toBeNull();
    expect(screen.queryByRole("link", { name: /PayOS/ })).not.toBeInTheDocument();
  });
  it("does not synthesize Expired from an elapsed countdown", async () => {
    render(<PaymentCheckoutModal isOpen paymentIntent={{ ...intent, expiresAt: "2020-01-01" }} onClose={vi.fn()} />);
    await waitFor(() => expect(subscriptionService.getOrder).toHaveBeenCalled());
    expect(screen.getByText("Chờ thanh toán")).toBeInTheDocument();
    expect(screen.getByText("00:00")).toBeInTheDocument();
  });
  it("unknown-status retry looks up the same order without starting checkout", async () => {
    const checkout = vi.spyOn(subscriptionService, "checkout");
    render(<PaymentCheckoutModal isOpen paymentIntent={{ ...intent, status: "Unknown" }} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Kiểm tra lại" }));
    await waitFor(() => expect(subscriptionService.getOrder).toHaveBeenCalledWith(intent.orderId));
    expect(checkout).not.toHaveBeenCalled();
  });
  it("does not accept a lookup completion after closing", async () => {
    const pending = deferred(); subscriptionService.getOrder.mockReturnValue(pending.promise);
    const success = vi.fn();
    const view = render(<PaymentCheckoutModal isOpen paymentIntent={intent} onSuccess={success} onClose={vi.fn()} />);
    await waitFor(() => expect(subscriptionService.getOrder).toHaveBeenCalled());
    view.rerender(<PaymentCheckoutModal isOpen={false} paymentIntent={intent} onSuccess={success} onClose={vi.fn()} />);
    await act(async () => pending.resolve({ ...intent, status: "Paid" }));
    expect(success).not.toHaveBeenCalled();
  });
  it.each(["Pending", "Paid", "Failed", "Expired", "ReviewRequired"])("return trusts server %s, not redirect success", async (status) => {
    subscriptionService.getOrder.mockResolvedValue({ ...intent, status });
    saveSubscriptionPaymentSession("A", intent);
    render(<MemoryRouter initialEntries={[`/payment/success?orderId=${intent.orderId}&status=PAID`]}><PaymentReturnPage /></MemoryRouter>);
    await waitFor(() => expect(subscriptionService.getOrder).toHaveBeenCalledWith(intent.orderId));
    await waitFor(() => expect(screen.queryByText(/Đang xác nhận trạng thái thanh toán từ máy chủ/)).not.toBeInTheDocument());
    expect(Boolean(screen.queryByText("Thanh toán thành công!"))).toBe(status === "Paid");
    expect(context.refreshSubscription).toHaveBeenCalledTimes(status === "Paid" ? 1 : 0);
  });
});
