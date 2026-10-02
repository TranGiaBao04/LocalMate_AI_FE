import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import PaymentCheckoutModal from "../src/components/subscription/PaymentCheckoutModal";
import SubscriptionPage from "../src/pages/subscription/SubscriptionPage";
import PaymentReturnPage from "../src/pages/subscription/PaymentReturnPage";
import { subscriptionService } from "../src/services/subscriptionService";
import { itineraryPurchaseService } from "../src/services/itineraryPurchaseService";
import * as AuthContextModule from "../src/context/AuthContext";
import * as SubscriptionContextModule from "../src/context/SubscriptionContext";
import {
  saveSubscriptionPaymentSession,
  getSubscriptionPaymentSession,
} from "../src/utils/subscriptionPaymentSession";
import {
  PAYMENT_ORDER_STATUS,
  PAYMENT_ORDER_TYPE,
} from "../src/utils/subscriptionUpgradeContract";

describe("FE-UP3: Server-Authoritative Payment Lifecycle", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // Helper to mock Auth and Subscription context
  const mockContexts = ({
    user = { id: "user-123" },
    plan = "Free",
    plans = [{ code: "Membership", price: 59000, durationDays: 30 }],
    refreshSubscription = vi.fn(),
  } = {}) => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user,
      isDemo: false,
      isLoggedIn: true,
    });

    vi.spyOn(SubscriptionContextModule, "useSubscription").mockReturnValue({
      plans,
      subscription: { plan },
      plansLoading: false,
      plansError: null,
      subscriptionLoading: false,
      subscriptionError: null,
      refreshPlans: vi.fn(),
      refreshSubscription,
      refreshAll: vi.fn(),
    });
  };

  // ==========================================================================
  // P01: checkout returns Pending + QR -> payment-ready
  // ==========================================================================
  it("P01: checkout returns Pending + QR -> payment-ready", async () => {
    mockContexts();
    vi.spyOn(subscriptionService, "getCheckoutQuote").mockResolvedValue({
      planCode: "Membership",
      type: "Purchase",
      listPrice: 59000,
      creditAmount: 0,
      amount: 59000,
      durationDays: 30,
      credits: [],
    });

    vi.spyOn(subscriptionService, "checkout").mockResolvedValue({
      orderId: "order-p01",
      qrCode: "data:image/png;base64,mockqr",
      checkoutUrl: "https://pay.payos.vn/mock",
      amount: 59000,
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      status: PAYMENT_ORDER_STATUS.PENDING,
      type: PAYMENT_ORDER_TYPE.PURCHASE,
      listPrice: 59000,
      creditAmount: 0,
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /Chọn Membership/i }));
    await waitFor(() => expect(screen.getByTestId("quote-confirm-button")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("quote-confirm-button"));

    await waitFor(() => {
      expect(screen.getByText("Chờ thanh toán")).toBeInTheDocument();
      expect(screen.getByText("Mở ứng dụng Ngân hàng hoặc Ví điện tử bất kỳ để quét mã VietQR")).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Mở trang thanh toán PayOS/i })).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // P02: checkout returns Pending + URL only -> payment-ready
  // ==========================================================================
  it("P02: checkout returns Pending + URL only -> payment-ready", async () => {
    vi.spyOn(subscriptionService, "getOrder").mockResolvedValue({
      orderId: "order-p02",
      status: PAYMENT_ORDER_STATUS.PENDING,
      amount: 59000,
    });

    const paymentIntent = {
      orderId: "order-p02",
      qrCode: null,
      checkoutUrl: "https://pay.payos.vn/checkout-url-only",
      amount: 59000,
      status: PAYMENT_ORDER_STATUS.PENDING,
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      planCode: "Membership",
    };

    render(
      <PaymentCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        paymentIntent={paymentIntent}
      />
    );

    expect(screen.getByText("Chờ thanh toán")).toBeInTheDocument();
    expect(screen.queryByText(/Mở ứng dụng Ngân hàng/i)).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Mở trang thanh toán PayOS/i })).toHaveAttribute(
      "href",
      "https://pay.payos.vn/checkout-url-only"
    );
  });

  // ==========================================================================
  // P03: checkout returns Paid -> immediate server-confirmed success; no QR required
  // ==========================================================================
  it("P03: checkout returns Paid -> immediate server-confirmed success; no QR required", async () => {
    const refreshSubscriptionSpy = vi.fn();
    mockContexts({ refreshSubscription: refreshSubscriptionSpy });

    vi.spyOn(subscriptionService, "getCheckoutQuote").mockResolvedValue({
      planCode: "Membership",
      type: "Purchase",
      listPrice: 59000,
      creditAmount: 0,
      amount: 59000,
      durationDays: 30,
      credits: [],
    });

    vi.spyOn(subscriptionService, "checkout").mockResolvedValue({
      orderId: "order-p03",
      qrCode: null,
      checkoutUrl: null,
      amount: 59000,
      expiresAt: null,
      status: PAYMENT_ORDER_STATUS.PAID,
      type: PAYMENT_ORDER_TYPE.PURCHASE,
      listPrice: 59000,
      creditAmount: 0,
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /Chọn Membership/i }));
    await waitFor(() => expect(screen.getByTestId("quote-confirm-button")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("quote-confirm-button"));

    await waitFor(() => {
      expect(refreshSubscriptionSpy).toHaveBeenCalled();
      expect(screen.getByText(/Thanh toán thành công!/i)).toBeInTheDocument();
      // No active payment QR shown
      expect(screen.queryByText(/Mở ứng dụng Ngân hàng/i)).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // P04: checkout returns ReviewRequired -> review state; no pay/retry
  // ==========================================================================
  it("P04: checkout returns ReviewRequired -> review state; no pay/retry", async () => {
    mockContexts();
    vi.spyOn(subscriptionService, "getCheckoutQuote").mockResolvedValue({
      planCode: "Membership",
      type: "Upgrade",
      listPrice: 59000,
      creditAmount: 19000,
      amount: 40000,
      durationDays: 30,
      credits: [],
    });

    vi.spyOn(subscriptionService, "checkout").mockResolvedValue({
      orderId: "order-p04",
      qrCode: "stale-qr-hint",
      checkoutUrl: "https://pay.payos.vn/stale",
      amount: 40000,
      status: PAYMENT_ORDER_STATUS.REVIEW_REQUIRED,
      type: PAYMENT_ORDER_TYPE.UPGRADE,
      listPrice: 59000,
      creditAmount: 19000,
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /Chọn Membership/i }));
    await waitFor(() => expect(screen.getByTestId("quote-confirm-button")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("quote-confirm-button"));

    await waitFor(() => {
      expect(screen.getByText("Thanh toán đang cần được kiểm tra")).toBeInTheDocument();
      expect(screen.getByText(/Giao dịch đang cần kiểm tra đối soát/i)).toBeInTheDocument();
      // QR and PayOS links must NOT be rendered
      expect(screen.queryByText(/Mở ứng dụng Ngân hàng/i)).not.toBeInTheDocument();
      expect(screen.queryByRole("link", { name: /Mở trang thanh toán PayOS/i })).not.toBeInTheDocument();
      // No automatic or manual checkout retry CTA
      expect(screen.queryByRole("button", { name: /Thử thanh toán lại/i })).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /Tạo mã thanh toán mới/i })).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // P05: checkout returns Failed -> failed terminal
  // ==========================================================================
  it("P05: checkout returns Failed -> failed terminal", async () => {
    const paymentIntent = {
      orderId: "order-p05",
      status: PAYMENT_ORDER_STATUS.FAILED,
      amount: 59000,
      planCode: "Membership",
    };

    render(
      <PaymentCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        paymentIntent={paymentIntent}
      />
    );

    expect(screen.getByText("Thanh toán chưa hoàn tất")).toBeInTheDocument();
    expect(screen.queryByText(/Chờ thanh toán/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Thử thanh toán lại" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đóng" })).toBeInTheDocument();
  });

  // ==========================================================================
  // P06: checkout returns Expired -> expired terminal
  // ==========================================================================
  it("P06: checkout returns Expired -> expired terminal", async () => {
    const paymentIntent = {
      orderId: "order-p06",
      status: PAYMENT_ORDER_STATUS.EXPIRED,
      amount: 59000,
      planCode: "Membership",
    };

    render(
      <PaymentCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        paymentIntent={paymentIntent}
      />
    );

    expect(screen.getByText("Mã thanh toán đã hết hạn")).toBeInTheDocument();
    expect(screen.queryByText(/Chờ thanh toán/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Tạo mã thanh toán mới" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đóng" })).toBeInTheDocument();
  });

  // ==========================================================================
  // P07: unknown initial status -> fail safe, not Pending
  // ==========================================================================
  it("P07: unknown initial status -> fail safe, not Pending", async () => {
    const paymentIntent = {
      orderId: "order-p07",
      status: "Processing",
      amount: 59000,
      planCode: "Membership",
    };

    render(
      <PaymentCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        paymentIntent={paymentIntent}
      />
    );

    expect(screen.getByText(/Trạng thái giao dịch: Processing/i)).toBeInTheDocument();
    // Must NOT coerce to Pending or Failed
    expect(screen.queryByText("Chờ thanh toán")).not.toBeInTheDocument();
    expect(screen.queryByText("Thanh toán chưa hoàn tất")).not.toBeInTheDocument();
  });

  // ==========================================================================
  // P08: HTTP 201 never forces Pending
  // ==========================================================================
  it("P08: HTTP 201 never forces Pending", async () => {
    mockContexts();
    vi.spyOn(subscriptionService, "getCheckoutQuote").mockResolvedValue({
      planCode: "Membership",
      type: "Purchase",
      listPrice: 59000,
      creditAmount: 0,
      amount: 59000,
      durationDays: 30,
      credits: [],
    });

    // 201 response with ReviewRequired status
    vi.spyOn(subscriptionService, "checkout").mockResolvedValue({
      orderId: "order-p08",
      qrCode: null,
      checkoutUrl: null,
      amount: 59000,
      status: PAYMENT_ORDER_STATUS.REVIEW_REQUIRED,
      type: PAYMENT_ORDER_TYPE.PURCHASE,
      listPrice: 59000,
      creditAmount: 0,
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /Chọn Membership/i }));
    await waitFor(() => expect(screen.getByTestId("quote-confirm-button")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("quote-confirm-button"));

    await waitFor(() => {
      // Respects returned ReviewRequired, does not force Pending
      expect(screen.getByText("Thanh toán đang cần được kiểm tra")).toBeInTheDocument();
      expect(screen.queryByText("Chờ thanh toán")).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // P09: quote financial values never overwrite checkout response
  // ==========================================================================
  it("P09: quote financial values never overwrite checkout response", async () => {
    mockContexts();
    // Quote had amount 40000
    vi.spyOn(subscriptionService, "getCheckoutQuote").mockResolvedValue({
      planCode: "Membership",
      type: "Upgrade",
      listPrice: 59000,
      creditAmount: 19000,
      amount: 40000,
      durationDays: 30,
      credits: [],
    });

    // Checkout returned updated amount 45000 and creditAmount 14000
    vi.spyOn(subscriptionService, "checkout").mockResolvedValue({
      orderId: "order-p09",
      qrCode: "qr-p09",
      checkoutUrl: "https://pay.payos.vn/p09",
      amount: 45000,
      status: PAYMENT_ORDER_STATUS.PENDING,
      type: PAYMENT_ORDER_TYPE.UPGRADE,
      listPrice: 59000,
      creditAmount: 14000,
      expiresAt: new Date(Date.now() + 600000).toISOString(),
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /Chọn Membership/i }));
    await waitFor(() => expect(screen.getByTestId("quote-confirm-button")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("quote-confirm-button"));

    await waitFor(() => {
      // Must display 45.000đ from checkout, NOT 40.000đ from quote
      expect(screen.getByText(/45\.000đ/)).toBeInTheDocument();
      expect(screen.queryByText(/40\.000đ/)).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // P10: pending_order_exists 409: extract orderId -> owned GET -> server status authority
  // ==========================================================================
  it("P10: pending_order_exists 409: extract orderId -> owned GET -> server status authority", async () => {
    mockContexts();
    vi.spyOn(subscriptionService, "getCheckoutQuote").mockResolvedValue({
      planCode: "Membership",
      type: "Purchase",
      listPrice: 59000,
      creditAmount: 0,
      amount: 59000,
      durationDays: 30,
      credits: [],
    });

    vi.spyOn(subscriptionService, "checkout").mockRejectedValue({
      status: 409,
      code: "pending_order_exists",
      data: {
        orderId: "existing-order-p10",
        qrCode: "qr-hint-p10",
        checkoutUrl: "https://pay.payos.vn/p10",
        amount: 59000,
      },
    });

    const getOrderSpy = vi.spyOn(subscriptionService, "getOrder").mockResolvedValue({
      orderId: "existing-order-p10",
      status: PAYMENT_ORDER_STATUS.PENDING,
      planCode: "Membership",
      amount: 59000,
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      type: PAYMENT_ORDER_TYPE.PURCHASE,
      listPrice: 59000,
      creditAmount: 0,
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /Chọn Membership/i }));
    await waitFor(() => expect(screen.getByTestId("quote-confirm-button")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("quote-confirm-button"));

    await waitFor(() => {
      expect(getOrderSpy).toHaveBeenCalledWith("existing-order-p10");
      expect(screen.getByText("Chờ thanh toán")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // P11: another_pending_order same lifecycle rule
  // ==========================================================================
  it("P11: another_pending_order same lifecycle rule", async () => {
    mockContexts();
    vi.spyOn(subscriptionService, "getCheckoutQuote").mockResolvedValue({
      planCode: "Membership",
      type: "Purchase",
      listPrice: 59000,
      creditAmount: 0,
      amount: 59000,
      durationDays: 30,
      credits: [],
    });

    vi.spyOn(subscriptionService, "checkout").mockRejectedValue({
      status: 409,
      code: "another_pending_order",
      data: {
        orderId: "another-order-p11",
      },
    });

    const getOrderSpy = vi.spyOn(subscriptionService, "getOrder").mockResolvedValue({
      orderId: "another-order-p11",
      status: PAYMENT_ORDER_STATUS.PENDING,
      planCode: "TripPass",
      amount: 19000,
      expiresAt: new Date(Date.now() + 600000).toISOString(),
      type: PAYMENT_ORDER_TYPE.PURCHASE,
      listPrice: 19000,
      creditAmount: 0,
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /Chọn Membership/i }));
    await waitFor(() => expect(screen.getByTestId("quote-confirm-button")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("quote-confirm-button"));

    await waitFor(() => {
      expect(getOrderSpy).toHaveBeenCalledWith("another-order-p11");
      // Displays the actual owned planCode from server order (TripPass)
      expect(screen.getByText(/Thanh toán Trip Pass/i)).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // P12: payment_review_required -> owned lookup / Review state
  // ==========================================================================
  it("P12: payment_review_required -> owned lookup / Review state", async () => {
    mockContexts();
    vi.spyOn(subscriptionService, "getCheckoutQuote").mockResolvedValue({
      planCode: "Membership",
      type: "Purchase",
      listPrice: 59000,
      creditAmount: 0,
      amount: 59000,
      durationDays: 30,
      credits: [],
    });

    vi.spyOn(subscriptionService, "checkout").mockRejectedValue({
      status: 409,
      code: "payment_review_required",
      data: {
        orderId: "review-order-p12",
      },
    });

    vi.spyOn(subscriptionService, "getOrder").mockResolvedValue({
      orderId: "review-order-p12",
      status: PAYMENT_ORDER_STATUS.REVIEW_REQUIRED,
      planCode: "Membership",
      amount: 40000,
      type: PAYMENT_ORDER_TYPE.UPGRADE,
      listPrice: 59000,
      creditAmount: 19000,
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /Chọn Membership/i }));
    await waitFor(() => expect(screen.getByTestId("quote-confirm-button")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("quote-confirm-button"));

    await waitFor(() => {
      expect(screen.getByText("Thanh toán đang cần được kiểm tra")).toBeInTheDocument();
      // No active payment QR shown
      expect(screen.queryByText(/Mở ứng dụng Ngân hàng/i)).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // P13: 409 HTTP status is not PaymentOrderStatus
  // ==========================================================================
  it("P13: 409 HTTP status is not PaymentOrderStatus", async () => {
    mockContexts();
    vi.spyOn(subscriptionService, "getCheckoutQuote").mockResolvedValue({
      planCode: "Membership",
      type: "Purchase",
      listPrice: 59000,
      creditAmount: 0,
      amount: 59000,
      durationDays: 30,
      credits: [],
    });

    vi.spyOn(subscriptionService, "checkout").mockRejectedValue({
      status: 409,
      code: "pending_order_exists",
      data: {
        orderId: "order-p13",
        status: 409, // ProblemDetails HTTP status, NOT payment status
      },
    });

    vi.spyOn(subscriptionService, "getOrder").mockResolvedValue({
      orderId: "order-p13",
      status: PAYMENT_ORDER_STATUS.PENDING,
      planCode: "Membership",
      amount: 59000,
      type: PAYMENT_ORDER_TYPE.PURCHASE,
      listPrice: 59000,
      creditAmount: 0,
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /Chọn Membership/i }));
    await waitFor(() => expect(screen.getByTestId("quote-confirm-button")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("quote-confirm-button"));

    await waitFor(() => {
      // Evaluated as Pending from getOrder, not 409
      expect(screen.getByText("Chờ thanh toán")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // P14: 409 metadata without QR but checkoutUrl exists remains usable hint
  // ==========================================================================
  it("P14: 409 metadata without QR but checkoutUrl exists remains usable hint", async () => {
    mockContexts();
    vi.spyOn(subscriptionService, "getCheckoutQuote").mockResolvedValue({
      planCode: "Membership",
      type: "Purchase",
      listPrice: 59000,
      creditAmount: 0,
      amount: 59000,
      durationDays: 30,
      credits: [],
    });

    vi.spyOn(subscriptionService, "checkout").mockRejectedValue({
      status: 409,
      code: "pending_order_exists",
      data: {
        orderId: "order-p14",
        qrCode: null,
        checkoutUrl: "https://pay.payos.vn/p14-hint",
      },
    });

    vi.spyOn(subscriptionService, "getOrder").mockResolvedValue({
      orderId: "order-p14",
      status: PAYMENT_ORDER_STATUS.PENDING,
      planCode: "Membership",
      amount: 59000,
      type: PAYMENT_ORDER_TYPE.PURCHASE,
      listPrice: 59000,
      creditAmount: 0,
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /Chọn Membership/i }));
    await waitFor(() => expect(screen.getByTestId("quote-confirm-button")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("quote-confirm-button"));

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Mở trang thanh toán PayOS/i })).toHaveAttribute(
        "href",
        "https://pay.payos.vn/p14-hint"
      );
    });
  });

  // ==========================================================================
  // P15: 409 metadata must not fabricate status
  // ==========================================================================
  it("P15: 409 metadata must not fabricate status", async () => {
    mockContexts();
    vi.spyOn(subscriptionService, "getCheckoutQuote").mockResolvedValue({
      planCode: "Membership",
      type: "Purchase",
      listPrice: 59000,
      creditAmount: 0,
      amount: 59000,
      durationDays: 30,
      credits: [],
    });

    vi.spyOn(subscriptionService, "checkout").mockRejectedValue({
      status: 409,
      code: "pending_order_exists",
      data: {
        orderId: "order-p15",
      },
    });

    // Server says order is actually Paid already!
    vi.spyOn(subscriptionService, "getOrder").mockResolvedValue({
      orderId: "order-p15",
      status: PAYMENT_ORDER_STATUS.PAID,
      planCode: "Membership",
      amount: 59000,
      type: PAYMENT_ORDER_TYPE.PURCHASE,
      listPrice: 59000,
      creditAmount: 0,
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /Chọn Membership/i }));
    await waitFor(() => expect(screen.getByTestId("quote-confirm-button")).toBeInTheDocument());

    fireEvent.click(screen.getByTestId("quote-confirm-button"));

    await waitFor(() => {
      // Must not fabricate Pending; server Paid shows success immediately
      expect(screen.getByText(/Thanh toán thành công!/i)).toBeInTheDocument();
      expect(screen.queryByText("Chờ thanh toán")).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // P16: countdown reaches zero -> does NOT synthesize Expired
  // ==========================================================================
  it("P16: countdown reaches zero -> does NOT synthesize Expired", async () => {
    vi.useFakeTimers();

    const getOrderSpy = vi.spyOn(subscriptionService, "getOrder").mockResolvedValue({
      orderId: "order-p16",
      status: PAYMENT_ORDER_STATUS.PENDING,
      amount: 59000,
    });

    const paymentIntent = {
      orderId: "order-p16",
      status: PAYMENT_ORDER_STATUS.PENDING,
      amount: 59000,
      expiresAt: new Date(Date.now() + 2000).toISOString(),
    };

    render(
      <PaymentCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        paymentIntent={paymentIntent}
      />
    );

    expect(screen.getByText("Chờ thanh toán")).toBeInTheDocument();

    // Advance past countdown
    await act(async () => {
      vi.advanceTimersByTime(2500);
      await Promise.resolve();
    });

    // Lookup was performed, backend returned Pending, modal must REMAIN Pending (not synthesize Expired)
    expect(getOrderSpy).toHaveBeenCalled();
    expect(screen.getByText("Chờ thanh toán")).toBeInTheDocument();
    expect(screen.queryByText("Mã thanh toán đã hết hạn")).not.toBeInTheDocument();
  });

  // ==========================================================================
  // P17: countdown zero + lookup Pending -> remains Pending
  // ==========================================================================
  it("P17: countdown zero + lookup Pending -> remains Pending", async () => {
    vi.useFakeTimers();

    vi.spyOn(subscriptionService, "getOrder").mockResolvedValue({
      orderId: "order-p17",
      status: PAYMENT_ORDER_STATUS.PENDING,
      amount: 59000,
    });

    const paymentIntent = {
      orderId: "order-p17",
      status: PAYMENT_ORDER_STATUS.PENDING,
      amount: 59000,
      expiresAt: new Date(Date.now() + 1000).toISOString(),
    };

    render(
      <PaymentCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        paymentIntent={paymentIntent}
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(1500);
      await Promise.resolve();
    });

    expect(screen.getByText("Chờ thanh toán")).toBeInTheDocument();
    expect(screen.queryByText("Mã thanh toán đã hết hạn")).not.toBeInTheDocument();
  });

  // ==========================================================================
  // P18: countdown zero + lookup Expired -> Expired only after Backend says so
  // ==========================================================================
  it("P18: countdown zero + lookup Expired -> Expired only after Backend says so", async () => {
    vi.useFakeTimers();

    vi.spyOn(subscriptionService, "getOrder").mockResolvedValue({
      orderId: "order-p18",
      status: PAYMENT_ORDER_STATUS.EXPIRED,
      amount: 59000,
    });

    const paymentIntent = {
      orderId: "order-p18",
      status: PAYMENT_ORDER_STATUS.PENDING,
      amount: 59000,
      expiresAt: new Date(Date.now() + 1000).toISOString(),
    };

    render(
      <PaymentCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        paymentIntent={paymentIntent}
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(1500);
      await Promise.resolve();
    });

    expect(screen.getByText("Mã thanh toán đã hết hạn")).toBeInTheDocument();
  });

  // ==========================================================================
  // P19: countdown zero + network failure -> unresolved, not Expired
  // ==========================================================================
  it("P19: countdown zero + network failure -> unresolved, not Expired", async () => {
    vi.useFakeTimers();

    vi.spyOn(subscriptionService, "getOrder").mockRejectedValue(new Error("Network Error"));

    const paymentIntent = {
      orderId: "order-p19",
      status: PAYMENT_ORDER_STATUS.PENDING,
      amount: 59000,
      expiresAt: new Date(Date.now() + 1000).toISOString(),
    };

    render(
      <PaymentCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        paymentIntent={paymentIntent}
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(1500);
      await Promise.resolve();
    });

    // Must NOT become Expired
    expect(screen.queryByText("Mã thanh toán đã hết hạn")).not.toBeInTheDocument();
    expect(screen.getByText("Chờ thanh toán")).toBeInTheDocument();
  });

  // ==========================================================================
  // P20: poll network failure -> no automatic checkout POST
  // ==========================================================================
  it("P20: poll network failure -> no automatic checkout POST", async () => {
    vi.useFakeTimers();

    const checkoutSpy = vi.spyOn(subscriptionService, "checkout");
    vi.spyOn(subscriptionService, "getOrder").mockRejectedValue(new Error("Connection reset"));

    const paymentIntent = {
      orderId: "order-p20",
      status: PAYMENT_ORDER_STATUS.PENDING,
      amount: 59000,
    };

    render(
      <PaymentCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        paymentIntent={paymentIntent}
      />
    );

    await act(async () => {
      vi.advanceTimersByTime(3500);
      await Promise.resolve();
    });

    // Checkout must NEVER be called by polling
    expect(checkoutSpy).not.toHaveBeenCalled();
    // Modal remains in pending check state
    expect(screen.getByText("Chờ thanh toán")).toBeInTheDocument();
  });

  // ==========================================================================
  // P21: one order lookup in-flight per owner/order
  // ==========================================================================
  it("P21: one order lookup in-flight per owner/order", async () => {
    vi.useFakeTimers();

    let resolveSlowGet;
    const slowGetPromise = new Promise((resolve) => {
      resolveSlowGet = resolve;
    });

    let getOrderCallCount = 0;
    vi.spyOn(subscriptionService, "getOrder").mockImplementation(() => {
      getOrderCallCount += 1;
      return slowGetPromise;
    });

    const paymentIntent = {
      orderId: "order-p21",
      status: PAYMENT_ORDER_STATUS.PENDING,
      amount: 59000,
    };

    render(
      <PaymentCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        paymentIntent={paymentIntent}
      />
    );

    // Initial check triggers 1 call
    await act(async () => {
      await Promise.resolve();
    });

    // Advance 6 seconds (2 poll intervals) while first request is still in-flight
    await act(async () => {
      vi.advanceTimersByTime(6000);
      await Promise.resolve();
    });

    // Overlapping poll calls must NOT be fired while previous is in-flight
    expect(getOrderCallCount).toBe(1);

    // Resolve in-flight request
    await act(async () => {
      resolveSlowGet({ orderId: "order-p21", status: PAYMENT_ORDER_STATUS.PENDING });
      await Promise.resolve();
    });
  });

  // ==========================================================================
  // P22: late stale poll cannot overwrite newer status
  // ==========================================================================
  it("P22: late stale poll cannot overwrite newer status", async () => {
    let resolveStaleGet;
    const staleGetPromise = new Promise((resolve) => {
      resolveStaleGet = resolve;
    });

    vi.spyOn(subscriptionService, "getOrder")
      .mockImplementationOnce(() => staleGetPromise)
      .mockResolvedValueOnce({ orderId: "order-p22", status: PAYMENT_ORDER_STATUS.PAID });

    const onSuccess = vi.fn();
    const { rerender } = render(
      <PaymentCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        paymentIntent={{ orderId: "order-p22", status: PAYMENT_ORDER_STATUS.PENDING }}
        onSuccess={onSuccess}
      />
    );

    // Later, order is updated to Paid via direct prop or newer check
    rerender(
      <PaymentCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        paymentIntent={{ orderId: "order-p22", status: PAYMENT_ORDER_STATUS.PAID }}
        onSuccess={onSuccess}
      />
    );

    expect(screen.getByText("Thanh toán thành công!")).toBeInTheDocument();

    // Now stale getOrder resolves with Pending
    await act(async () => {
      resolveStaleGet({ orderId: "order-p22", status: PAYMENT_ORDER_STATUS.PENDING });
      await Promise.resolve();
    });

    // Status must remain Paid, not revert to Pending
    expect(screen.getByText("Thanh toán thành công!")).toBeInTheDocument();
    expect(screen.queryByText("Chờ thanh toán")).not.toBeInTheDocument();
  });

  // ==========================================================================
  // P23: account A session unavailable to account B
  // ==========================================================================
  it("P23: account A session unavailable to account B", () => {
    saveSubscriptionPaymentSession("account-A", {
      orderId: "order-account-a",
      qrCode: "qr-a",
      amount: 59000,
    });

    expect(getSubscriptionPaymentSession("account-A")).not.toBeNull();
    expect(getSubscriptionPaymentSession("account-B")).toBeNull();
  });

  // ==========================================================================
  // P24: owner change invalidates stale lookup
  // ==========================================================================
  it("P24: owner change invalidates stale lookup", async () => {
    vi.spyOn(subscriptionService, "getOrder").mockResolvedValue({
      orderId: "order-p24",
      status: PAYMENT_ORDER_STATUS.PENDING,
      amount: 59000,
    });

    const { rerender } = render(
      <PaymentCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        paymentIntent={{
          orderId: "order-p24-A",
          ownerId: "user-A",
          status: PAYMENT_ORDER_STATUS.PENDING,
        }}
      />
    );

    // Switch owner/intent to user B
    await act(async () => {
      rerender(
        <PaymentCheckoutModal
          isOpen={true}
          onClose={vi.fn()}
          paymentIntent={{
            orderId: "order-p24-B",
            ownerId: "user-B",
            status: PAYMENT_ORDER_STATUS.PENDING,
          }}
        />
      );
    });

    expect(screen.getByText("Chờ thanh toán")).toBeInTheDocument();
  });

  // ==========================================================================
  // P25: reload/resume uses GET order authority
  // ==========================================================================
  it("P25: reload/resume uses GET order authority", async () => {
    saveSubscriptionPaymentSession("user-123", {
      orderId: "order-p25-cached",
      qrCode: "qr-cached-hint",
      status: PAYMENT_ORDER_STATUS.PENDING, // Cached as pending
    });

    mockContexts();
    // Server order lookup actually reports Paid!
    const getOrderSpy = vi.spyOn(subscriptionService, "getOrder").mockResolvedValue({
      orderId: "order-p25-cached",
      status: PAYMENT_ORDER_STATUS.PAID,
      planCode: "Membership",
      amount: 59000,
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getOrderSpy).toHaveBeenCalledWith("order-p25-cached");
      // Session resume uses server status Paid, not cached Pending
      expect(screen.getByText(/Thanh toán thành công!/i)).toBeInTheDocument();
      // Paid session is cleared
      expect(getSubscriptionPaymentSession("user-123")).toBeNull();
    });
  });

  // ==========================================================================
  // P26: cached QR not shown as payable after Paid
  // ==========================================================================
  it("P26: cached QR not shown as payable after Paid", () => {
    render(
      <PaymentCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        paymentIntent={{
          orderId: "order-p26",
          qrCode: "old-cached-qr",
          status: PAYMENT_ORDER_STATUS.PAID,
          amount: 59000,
        }}
      />
    );

    expect(screen.getByText("Thanh toán thành công!")).toBeInTheDocument();
    expect(screen.queryByText(/Mở ứng dụng Ngân hàng/i)).not.toBeInTheDocument();
  });

  // ==========================================================================
  // P27: cached QR not shown after ReviewRequired
  // ==========================================================================
  it("P27: cached QR not shown after ReviewRequired", () => {
    render(
      <PaymentCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        paymentIntent={{
          orderId: "order-p27",
          qrCode: "old-cached-qr",
          status: PAYMENT_ORDER_STATUS.REVIEW_REQUIRED,
          amount: 59000,
        }}
      />
    );

    expect(screen.getByText("Thanh toán đang cần được kiểm tra")).toBeInTheDocument();
    expect(screen.queryByText(/Mở ứng dụng Ngân hàng/i)).not.toBeInTheDocument();
  });

  // ==========================================================================
  // P28: return navigation -> owned GET
  // ==========================================================================
  it("P28: return navigation -> owned GET", async () => {
    saveSubscriptionPaymentSession("user-123", {
      orderId: "order-p28",
      status: PAYMENT_ORDER_STATUS.PENDING,
    });

    mockContexts();
    const getOrderSpy = vi.spyOn(subscriptionService, "getOrder").mockResolvedValue({
      orderId: "order-p28",
      status: PAYMENT_ORDER_STATUS.PAID,
      planCode: "Membership",
      amount: 59000,
    });

    render(
      <MemoryRouter initialEntries={["/payment/success?orderId=order-p28"]}>
        <Routes>
          <Route path="/payment/success" element={<PaymentReturnPage mode="success" />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getOrderSpy).toHaveBeenCalledWith("order-p28");
      expect(screen.getByText("Thanh toán thành công!")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // P29: cancel navigation -> owned GET; no local cancellation status
  // ==========================================================================
  it("P29: cancel navigation -> owned GET; no local cancellation status", async () => {
    saveSubscriptionPaymentSession("user-123", {
      orderId: "order-p29",
      status: PAYMENT_ORDER_STATUS.PENDING,
    });

    mockContexts();
    // Server order is still Pending
    const getOrderSpy = vi.spyOn(subscriptionService, "getOrder").mockResolvedValue({
      orderId: "order-p29",
      status: PAYMENT_ORDER_STATUS.PENDING,
      planCode: "Membership",
      amount: 59000,
    });

    render(
      <MemoryRouter initialEntries={["/payment/cancel?orderId=order-p29"]}>
        <Routes>
          <Route path="/payment/cancel" element={<PaymentReturnPage mode="cancel" />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(getOrderSpy).toHaveBeenCalledWith("order-p29");
      // Does not synthesize Failed/Expired, displays server Pending state
      expect(screen.getByText("Bạn đã quay lại từ cổng thanh toán")).toBeInTheDocument();
      expect(screen.getByText(/Giao dịch vẫn đang ở trạng thái chờ thanh toán/i)).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // P30: return query alone cannot produce Paid
  // ==========================================================================
  it("P30: return query alone cannot produce Paid", async () => {
    mockContexts();
    // URL says status=PAID, but server GET returns Pending!
    vi.spyOn(subscriptionService, "getOrder").mockResolvedValue({
      orderId: "order-p30",
      status: PAYMENT_ORDER_STATUS.PENDING,
      planCode: "Membership",
      amount: 59000,
    });

    render(
      <MemoryRouter initialEntries={["/payment/success?orderId=order-p30&status=PAID"]}>
        <Routes>
          <Route path="/payment/success" element={<PaymentReturnPage mode="success" />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      // Must NOT show success because server status is Pending
      expect(screen.queryByText("Thanh toán thành công!")).not.toBeInTheDocument();
      expect(screen.getByText("Giao dịch đang chờ thanh toán")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // P31: Paid triggers authoritative subscription refresh
  // ==========================================================================
  it("P31: Paid triggers authoritative subscription refresh", async () => {
    const refreshSubscriptionSpy = vi.fn();
    mockContexts({ refreshSubscription: refreshSubscriptionSpy });

    vi.spyOn(subscriptionService, "getOrder").mockResolvedValue({
      orderId: "order-p31",
      status: PAYMENT_ORDER_STATUS.PAID,
      planCode: "Membership",
      amount: 59000,
    });

    render(
      <MemoryRouter initialEntries={["/payment/success?orderId=order-p31"]}>
        <Routes>
          <Route path="/payment/success" element={<PaymentReturnPage mode="success" />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(refreshSubscriptionSpy).toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // P32: ReviewRequired does not trigger Paid refresh/success
  // ==========================================================================
  it("P32: ReviewRequired does not trigger Paid refresh/success", async () => {
    const refreshSubscriptionSpy = vi.fn();
    mockContexts({ refreshSubscription: refreshSubscriptionSpy });

    vi.spyOn(subscriptionService, "getOrder").mockResolvedValue({
      orderId: "order-p32",
      status: PAYMENT_ORDER_STATUS.REVIEW_REQUIRED,
      planCode: "Membership",
      amount: 59000,
    });

    render(
      <MemoryRouter initialEntries={["/payment/success?orderId=order-p32"]}>
        <Routes>
          <Route path="/payment/success" element={<PaymentReturnPage mode="success" />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("Thanh toán đang cần được kiểm tra")).toBeInTheDocument();
      expect(refreshSubscriptionSpy).not.toHaveBeenCalled();
      expect(screen.queryByText("Thanh toán thành công!")).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // P33: Failed/Expired do not auto-create replacement
  // ==========================================================================
  it("P33: Failed/Expired do not auto-create replacement", () => {
    const checkoutSpy = vi.spyOn(subscriptionService, "checkout");

    render(
      <PaymentCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        paymentIntent={{
          orderId: "order-p33",
          status: PAYMENT_ORDER_STATUS.FAILED,
          amount: 59000,
        }}
      />
    );

    expect(screen.getByText("Thanh toán chưa hoàn tất")).toBeInTheDocument();
    expect(checkoutSpy).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // P34: transient GET failure supports lookup retry only
  // ==========================================================================
  it("P34: transient GET failure supports lookup retry only", async () => {
    let callCount = 0;
    const checkoutSpy = vi.spyOn(subscriptionService, "checkout");
    const getOrderSpy = vi.spyOn(subscriptionService, "getOrder").mockImplementation(async () => {
      callCount += 1;
      if (callCount === 1) {
        throw new Error("Network timeout");
      }
      return {
        orderId: "order-p34",
        status: PAYMENT_ORDER_STATUS.PENDING,
        amount: 59000,
      };
    });

    render(
      <PaymentCheckoutModal
        isOpen={true}
        onClose={vi.fn()}
        paymentIntent={{
          orderId: "order-p34",
          status: PAYMENT_ORDER_STATUS.PENDING,
          amount: 59000,
        }}
      />
    );

    // Trigger lookup retry button
    await waitFor(() => {
      expect(screen.getByText(/Đang chờ xác nhận thanh toán từ ngân hàng/i)).toBeInTheDocument();
    });

    const retryLookupBtn = screen.getByRole("button", { name: /Kiểm tra lại trạng thái/i });
    fireEvent.click(retryLookupBtn);

    await waitFor(() => {
      expect(getOrderSpy).toHaveBeenCalledTimes(2);
      expect(checkoutSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // P35: unknown subscription lookup error does not fall back to Single
  // ==========================================================================
  it("P35: unknown subscription lookup error does not fall back to Single", async () => {
    saveSubscriptionPaymentSession("user-123", {
      orderId: "sub-order-p35",
      status: PAYMENT_ORDER_STATUS.PENDING,
    });

    mockContexts();
    vi.spyOn(subscriptionService, "getOrder").mockRejectedValue(new Error("500 Internal Error"));
    const singleGetOrderSpy = vi.spyOn(itineraryPurchaseService, "getOrder");

    render(
      <MemoryRouter initialEntries={["/payment/success?orderId=sub-order-p35"]}>
        <Routes>
          <Route path="/payment/success" element={<PaymentReturnPage mode="success" />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText("500 Internal Error")).toBeInTheDocument();
      // Must NOT fallback to Single
      expect(singleGetOrderSpy).not.toHaveBeenCalled();
      expect(screen.queryByText(/Thanh toán lịch trình thành công/i)).not.toBeInTheDocument();
    });
  });

  // ==========================================================================
  // P36: full intent fields type/listPrice/creditAmount/status preserved
  // ==========================================================================
  it("P36: full intent fields type/listPrice/creditAmount/status preserved", () => {
    saveSubscriptionPaymentSession("user-123", {
      orderId: "order-p36",
      status: PAYMENT_ORDER_STATUS.PENDING,
      type: PAYMENT_ORDER_TYPE.UPGRADE,
      listPrice: 59000,
      creditAmount: 19000,
      amount: 40000,
      qrCode: "qr-p36",
      checkoutUrl: "https://pay.payos.vn/p36",
      expiresAt: "2026-10-03T12:00:00Z",
    });

    const session = getSubscriptionPaymentSession("user-123");
    expect(session.type).toBe("Upgrade");
    expect(session.listPrice).toBe(59000);
    expect(session.creditAmount).toBe(19000);
    expect(session.amount).toBe(40000);
    expect(session.status).toBe("Pending");
    expect(session.qrCode).toBe("qr-p36");
    expect(session.checkoutUrl).toBe("https://pay.payos.vn/p36");
  });
});
