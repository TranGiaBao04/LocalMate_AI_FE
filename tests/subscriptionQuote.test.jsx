import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import CheckoutQuoteDialog from "../src/components/subscription/CheckoutQuoteDialog";
import PlanCard from "../src/components/subscription/PlanCard";
import SubscriptionPage from "../src/pages/subscription/SubscriptionPage";
import { useSubscriptionCheckoutQuote } from "../src/hooks/useSubscriptionCheckoutQuote";
import { subscriptionService } from "../src/services/subscriptionService";
import * as AuthContextModule from "../src/context/AuthContext";
import * as SubscriptionContextModule from "../src/context/SubscriptionContext";

// Helper component for testing useSubscriptionCheckoutQuote hook
function HookTestComponent({ ownerId, onHook }) {
  const hookResult = useSubscriptionCheckoutQuote({ ownerId });
  onHook(hookResult);
  return (
    <div>
      <span data-testid="hook-loading">{String(hookResult.loading)}</span>
      <span data-testid="hook-quote-type">{hookResult.quote?.type || "none"}</span>
      <span data-testid="hook-error">{hookResult.error?.code || hookResult.error?.message || "none"}</span>
    </div>
  );
}

describe("FE-UP2: Subscription Checkout Quote & Classification UX", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Q01: select plan -> GET quote before POST checkout
  // ==========================================================================
  it("Q01: select plan -> GET quote before POST checkout", async () => {
    const mockQuote = {
      planCode: "Membership",
      type: "Upgrade",
      listPrice: 59000,
      creditAmount: 19000,
      amount: 40000,
      durationDays: 30,
      credits: [
        {
          planCode: "TripPass",
          planName: "Trip Pass",
          remainingDays: 5,
          creditAmount: 19000,
        },
      ],
    };

    const getQuoteSpy = vi
      .spyOn(subscriptionService, "getCheckoutQuote")
      .mockResolvedValue(mockQuote);
    const checkoutSpy = vi
      .spyOn(subscriptionService, "checkout")
      .mockResolvedValue({
        orderId: "order-123",
        status: "Pending",
        amount: 40000,
      });

    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: { id: "user-test-1" },
      isDemo: false,
      isLoggedIn: true,
    });

    vi.spyOn(SubscriptionContextModule, "useSubscription").mockReturnValue({
      plans: [
        { code: "Free", price: 0, durationDays: null },
        { code: "TripPass", price: 19000, durationDays: 7 },
        { code: "Membership", price: 59000, durationDays: 30 },
      ],
      subscription: { plan: "TripPass" },
      plansLoading: false,
      plansError: null,
      subscriptionLoading: false,
      subscriptionError: null,
      refreshPlans: vi.fn(),
      refreshSubscription: vi.fn(),
      refreshAll: vi.fn(),
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    // Select Membership
    const selectMembershipBtn = screen.getByRole("button", {
      name: /Chọn Membership/i,
    });
    fireEvent.click(selectMembershipBtn);

    // GET checkout-quote MUST be called first
    expect(getQuoteSpy).toHaveBeenCalledWith("Membership");

    // POST checkout MUST NOT be called yet
    expect(checkoutSpy).not.toHaveBeenCalled();

    // Quote preview dialog is displayed
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
      expect(screen.getByTestId("quote-list-price")).toHaveTextContent("59.000đ");
    });
  });

  // ==========================================================================
  // Q02: Purchase quote: render exact listPrice/creditAmount/amount/durationDays
  // ==========================================================================
  it("Q02: Purchase quote: render exact listPrice/creditAmount/amount/durationDays", () => {
    const quote = {
      planCode: "TripPass",
      type: "Purchase",
      listPrice: 50000,
      creditAmount: 0,
      amount: 50000,
      durationDays: 7,
      credits: [],
    };

    render(
      <CheckoutQuoteDialog
        isOpen={true}
        onClose={vi.fn()}
        quote={quote}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByTestId("quote-type-badge")).toHaveTextContent("Mua mới");
    expect(screen.getByTestId("quote-list-price")).toHaveTextContent("50.000đ");
    expect(screen.getByTestId("quote-payable-amount")).toHaveTextContent("50.000đ");
    expect(screen.getByTestId("quote-duration-days")).toHaveTextContent("7 ngày");
    expect(screen.getByTestId("quote-plan-code")).toHaveTextContent("Trip Pass");
    // Purchase has creditAmount 0, no credit deduction line rendered
    expect(screen.queryByTestId("quote-credit-amount")).not.toBeInTheDocument();
  });

  // ==========================================================================
  // Q03: Upgrade quote: render exact BE type and financials
  // ==========================================================================
  it("Q03: Upgrade quote: render exact BE type and financials", () => {
    const quote = {
      planCode: "Membership",
      type: "Upgrade",
      listPrice: 199000,
      creditAmount: 45000,
      amount: 154000,
      durationDays: 30,
      credits: [
        {
          planCode: "TripPass",
          planName: "Gói Trip Pass",
          remainingDays: 5,
          creditAmount: 45000,
        },
      ],
    };

    render(
      <CheckoutQuoteDialog
        isOpen={true}
        onClose={vi.fn()}
        quote={quote}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByTestId("quote-type-badge")).toHaveTextContent("Nâng cấp gói");
    expect(screen.getByTestId("quote-type")).toHaveTextContent("Upgrade");
    expect(screen.getByTestId("quote-list-price")).toHaveTextContent("199.000đ");
    expect(screen.getByTestId("quote-credit-amount")).toHaveTextContent("- 45.000đ");
    expect(screen.getByTestId("quote-payable-amount")).toHaveTextContent("154.000đ");
    expect(screen.getByTestId("quote-duration-days")).toHaveTextContent("30 ngày");
  });

  // ==========================================================================
  // Q04: render exact credits[] fields
  // ==========================================================================
  it("Q04: render exact credits[] fields", () => {
    const quote = {
      planCode: "Membership",
      type: "Upgrade",
      listPrice: 100000,
      creditAmount: 30000,
      amount: 70000,
      durationDays: 30,
      credits: [
        {
          planCode: "TripPass",
          planName: "Gói Du Lịch Hè",
          remainingDays: 14,
          creditAmount: 30000,
        },
      ],
    };

    render(
      <CheckoutQuoteDialog
        isOpen={true}
        onClose={vi.fn()}
        quote={quote}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByTestId("credit-row-name")).toHaveTextContent("Gói Du Lịch Hè (TripPass)");
    expect(screen.getByTestId("credit-row-days")).toHaveTextContent("Còn lại 14 ngày");
    expect(screen.getByTestId("credit-row-amount")).toHaveTextContent("30.000đ");
  });

  // ==========================================================================
  // Q05: row credit total differs from top-level applied credit: UI uses top-level creditAmount
  // ==========================================================================
  it("Q05: row credit total differs from top-level applied credit: UI uses top-level creditAmount", () => {
    // Sum of rows = 20,000 + 15,000 = 35,000.
    // Server capped applied credit = 25,000.
    const quote = {
      planCode: "Membership",
      type: "Upgrade",
      listPrice: 100000,
      creditAmount: 25000,
      amount: 75000,
      durationDays: 30,
      credits: [
        {
          planCode: "SourceA",
          planName: "Gói A",
          remainingDays: 10,
          creditAmount: 20000,
        },
        {
          planCode: "SourceB",
          planName: "Gói B",
          remainingDays: 5,
          creditAmount: 15000,
        },
      ],
    };

    render(
      <CheckoutQuoteDialog
        isOpen={true}
        onClose={vi.fn()}
        quote={quote}
        onConfirm={vi.fn()}
      />
    );

    // Top-level applied credit rendered MUST be 25,000đ (server authoritative creditAmount), NOT 35,000đ
    const creditDisplay = screen.getByTestId("quote-credit-amount");
    expect(creditDisplay).toHaveTextContent("- 25.000đ");
    expect(creditDisplay).not.toHaveTextContent("35.000đ");
  });

  // ==========================================================================
  // Q06: zero-credit Upgrade remains Upgrade if Backend type says Upgrade
  // ==========================================================================
  it("Q06: zero-credit Upgrade remains Upgrade if Backend type says Upgrade", () => {
    const quote = {
      planCode: "Membership",
      type: "Upgrade",
      listPrice: 59000,
      creditAmount: 0,
      amount: 59000,
      durationDays: 30,
      credits: [],
    };

    render(
      <CheckoutQuoteDialog
        isOpen={true}
        onClose={vi.fn()}
        quote={quote}
        onConfirm={vi.fn()}
      />
    );

    // Classification comes from quote.type, not creditAmount
    expect(screen.getByTestId("quote-type-badge")).toHaveTextContent("Nâng cấp gói");
    expect(screen.getByTestId("quote-type")).toHaveTextContent("Upgrade");
    expect(screen.getByTestId("quote-confirm-button")).toHaveTextContent("Xác nhận nâng cấp");
  });

  // ==========================================================================
  // Q07: custom plan Upgrade works without name/rank logic
  // ==========================================================================
  it("Q07: custom plan Upgrade works without name/rank logic", () => {
    const quote = {
      planCode: "CUSTOM_ENTERPRISE",
      type: "Upgrade",
      listPrice: 999000,
      creditAmount: 199000,
      amount: 800000,
      durationDays: 365,
      credits: [
        {
          planCode: "CUSTOM_PRO",
          planName: "Gói Pro Cũ",
          remainingDays: 50,
          creditAmount: 199000,
        },
      ],
    };

    render(
      <CheckoutQuoteDialog
        isOpen={true}
        onClose={vi.fn()}
        quote={quote}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByTestId("quote-type-badge")).toHaveTextContent("Nâng cấp gói");
    expect(screen.getByTestId("quote-plan-code")).toHaveTextContent("CUSTOM_ENTERPRISE");
    expect(screen.getByTestId("quote-list-price")).toHaveTextContent("999.000đ");
    expect(screen.getByTestId("quote-credit-amount")).toHaveTextContent("- 199.000đ");
    expect(screen.getByTestId("quote-payable-amount")).toHaveTextContent("800.000đ");
    expect(screen.getByTestId("quote-duration-days")).toHaveTextContent("365 ngày");
  });

  // ==========================================================================
  // Q08: custom plan Purchase works without builtin assumptions
  // ==========================================================================
  it("Q08: custom plan Purchase works without builtin assumptions", () => {
    const quote = {
      planCode: "CUSTOM_WEEKEND_PASS",
      type: "Purchase",
      listPrice: 35000,
      creditAmount: 0,
      amount: 35000,
      durationDays: 3,
      credits: [],
    };

    render(
      <CheckoutQuoteDialog
        isOpen={true}
        onClose={vi.fn()}
        quote={quote}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByTestId("quote-type-badge")).toHaveTextContent("Mua mới");
    expect(screen.getByTestId("quote-plan-code")).toHaveTextContent("CUSTOM_WEEKEND_PASS");
    expect(screen.getByTestId("quote-list-price")).toHaveTextContent("35.000đ");
    expect(screen.getByTestId("quote-payable-amount")).toHaveTextContent("35.000đ");
    expect(screen.getByTestId("quote-duration-days")).toHaveTextContent("3 ngày");
  });

  // ==========================================================================
  // Q09: same plan: 409 plan_already_active → renewal handoff → no fabricated Renewal quote
  // ==========================================================================
  it("Q09: same plan: 409 plan_already_active → renewal handoff → no fabricated Renewal quote", () => {
    const onRenewMock = vi.fn();
    const error = { code: "plan_already_active", status: 409 };

    render(
      <CheckoutQuoteDialog
        isOpen={true}
        onClose={vi.fn()}
        quote={null}
        error={error}
        onConfirm={vi.fn()}
        onRenew={onRenewMock}
      />
    );

    expect(screen.getByText("Gói này đang hoạt động")).toBeInTheDocument();
    expect(screen.getByText(/Gói dịch vụ này hiện đang hoạt động trên tài khoản/i)).toBeInTheDocument();

    const renewBtn = screen.getByTestId("quote-renew-button");
    expect(renewBtn).toHaveTextContent("Gia hạn gói này");

    fireEvent.click(renewBtn);
    expect(onRenewMock).toHaveBeenCalledTimes(1);

    // No confirm button, no fabricated quote
    expect(screen.queryByTestId("quote-confirm-button")).not.toBeInTheDocument();
  });

  // ==========================================================================
  // Q10: already_covered_by_higher_plan → blocked state → no checkout
  // ==========================================================================
  it("Q10: already_covered_by_higher_plan → blocked state → no checkout", () => {
    const error = { code: "already_covered_by_higher_plan", status: 409 };

    render(
      <CheckoutQuoteDialog
        isOpen={true}
        onClose={vi.fn()}
        quote={null}
        error={error}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText("Đã bao gồm trong gói hiện tại")).toBeInTheDocument();
    expect(screen.getByText(/Gói hiện tại của bạn đã bao gồm đầy đủ quyền lợi/i)).toBeInTheDocument();

    // Blocked: NO checkout / confirm button
    expect(screen.queryByTestId("quote-confirm-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("quote-cancel-button")).toHaveTextContent("Đóng");
  });

  // ==========================================================================
  // Q11: target_plan_already_scheduled → future target conflict → no checkout
  // ==========================================================================
  it("Q11: target_plan_already_scheduled → future target conflict → no checkout", () => {
    const error = { code: "target_plan_already_scheduled", status: 409 };

    render(
      <CheckoutQuoteDialog
        isOpen={true}
        onClose={vi.fn()}
        quote={null}
        error={error}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText("Gói đã được lên lịch")).toBeInTheDocument();
    expect(screen.getByText(/Gói cước này đã được lên lịch kích hoạt trong tương lai/i)).toBeInTheDocument();

    // Conflict: NO checkout / confirm button
    expect(screen.queryByTestId("quote-confirm-button")).not.toBeInTheDocument();
  });

  // ==========================================================================
  // Q12: invalid_plan_code → clear stale quote / unavailable state
  // ==========================================================================
  it("Q12: invalid_plan_code → clear stale quote / unavailable state", async () => {
    let hook;
    vi.spyOn(subscriptionService, "getCheckoutQuote").mockRejectedValue({
      code: "invalid_plan_code",
      status: 400,
    });

    render(
      <HookTestComponent
        ownerId="user-1"
        onHook={(h) => {
          hook = h;
        }}
      />
    );

    await act(async () => {
      await hook.requestQuote("NonExistentPlan");
    });

    expect(hook.quote).toBeNull();
    expect(hook.error?.code).toBe("invalid_plan_code");

    render(
      <CheckoutQuoteDialog
        isOpen={true}
        onClose={vi.fn()}
        quote={hook.quote}
        error={hook.error}
        onConfirm={vi.fn()}
      />
    );

    expect(screen.getByText("Gói cước không hợp lệ")).toBeInTheDocument();
    expect(screen.queryByTestId("quote-confirm-button")).not.toBeInTheDocument();
  });

  // ==========================================================================
  // Q13: stale request: select A then B, late A response cannot replace B state
  // ==========================================================================
  it("Q13: stale request: select A then B, late A response cannot replace B state", async () => {
    let hook;
    let resolvePlanA;
    let resolvePlanB;

    vi.spyOn(subscriptionService, "getCheckoutQuote").mockImplementation((code) => {
      if (code === "PlanA") {
        return new Promise((resolve) => {
          resolvePlanA = () =>
            resolve({
              planCode: "PlanA",
              type: "Purchase",
              listPrice: 10000,
              creditAmount: 0,
              amount: 10000,
              durationDays: 7,
              credits: [],
            });
        });
      }
      if (code === "PlanB") {
        return new Promise((resolve) => {
          resolvePlanB = () =>
            resolve({
              planCode: "PlanB",
              type: "Upgrade",
              listPrice: 50000,
              creditAmount: 10000,
              amount: 40000,
              durationDays: 30,
              credits: [],
            });
        });
      }
      return Promise.reject(new Error("Unknown plan"));
    });

    render(
      <HookTestComponent
        ownerId="user-1"
        onHook={(h) => {
          hook = h;
        }}
      />
    );

    // User chooses PlanA
    act(() => {
      hook.requestQuote("PlanA");
    });

    // Then quickly changes to PlanB while PlanA is still in flight
    act(() => {
      hook.requestQuote("PlanB");
    });

    // PlanB resolves first
    await act(async () => {
      resolvePlanB();
    });

    expect(hook.quote?.planCode).toBe("PlanB");

    // Later, stale PlanA resolves
    await act(async () => {
      resolvePlanA();
    });

    // PlanA MUST NOT overwrite PlanB!
    expect(hook.quote?.planCode).toBe("PlanB");
  });

  // ==========================================================================
  // Q14: account/owner change: old quote ignored
  // ==========================================================================
  it("Q14: account/owner change: old quote ignored", async () => {
    let hook;
    vi.spyOn(subscriptionService, "getCheckoutQuote").mockResolvedValue({
      planCode: "Membership",
      type: "Upgrade",
      listPrice: 59000,
      creditAmount: 19000,
      amount: 40000,
      durationDays: 30,
      credits: [],
    });

    const { rerender } = render(
      <HookTestComponent
        ownerId="owner-Alice"
        onHook={(h) => {
          hook = h;
        }}
      />
    );

    await act(async () => {
      await hook.requestQuote("Membership");
    });

    expect(hook.quote?.planCode).toBe("Membership");

    // Owner switches to Bob
    rerender(
      <HookTestComponent
        ownerId="owner-Bob"
        onHook={(h) => {
          hook = h;
        }}
      />
    );

    // Old quote from Alice MUST be ignored / cleared for Bob
    expect(hook.quote).toBeNull();
  });

  // ==========================================================================
  // Q15: quote success then checkout 409 is accepted as normal contract transition
  // ==========================================================================
  it("Q15: quote success then checkout 409 is accepted as normal contract transition", async () => {
    const mockQuote = {
      planCode: "Membership",
      type: "Purchase",
      listPrice: 59000,
      creditAmount: 0,
      amount: 59000,
      durationDays: 30,
      credits: [],
    };

    vi.spyOn(subscriptionService, "getCheckoutQuote").mockResolvedValue(mockQuote);
    // Checkout returns 409 pending_order_exists with metadata
    vi.spyOn(subscriptionService, "checkout").mockRejectedValue({
      status: 409,
      code: "pending_order_exists",
      data: {
        orderId: "existing-order-409",
        qrCode: "data:image/png;base64,mockqr",
        checkoutUrl: "https://pay.payos.vn/mock",
        amount: 59000,
        expiresAt: new Date(Date.now() + 600000).toISOString(),
      },
    });

    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: { id: "user-123" },
      isDemo: false,
      isLoggedIn: true,
    });

    vi.spyOn(SubscriptionContextModule, "useSubscription").mockReturnValue({
      plans: [{ code: "Membership", price: 59000, durationDays: 30 }],
      subscription: { plan: "Free" },
      plansLoading: false,
      plansError: null,
      subscriptionLoading: false,
      subscriptionError: null,
      refreshPlans: vi.fn(),
      refreshSubscription: vi.fn(),
      refreshAll: vi.fn(),
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    // Select plan
    fireEvent.click(screen.getByRole("button", { name: /Chọn Membership/i }));

    // Quote dialog appears
    await waitFor(() => {
      expect(screen.getByTestId("quote-confirm-button")).toBeInTheDocument();
    });

    // Confirm checkout -> triggers 409 transition
    fireEvent.click(screen.getByTestId("quote-confirm-button"));

    // Handled safely: quote dialog closes and payment modal opens with existing pending order
    await waitFor(() => {
      expect(screen.queryByTestId("quote-confirm-button")).not.toBeInTheDocument();
      // Reusable intent stored and modal opened
      const stored = sessionStorage.getItem("localmate_active_payment_intent");
      expect(stored).toContain("existing-order-409");
    });
  });

  // ==========================================================================
  // Q16: Confirm POST sends exact planCode only
  // ==========================================================================
  it("Q16: Confirm POST sends exact planCode only", async () => {
    const mockQuote = {
      planCode: "TripPass",
      type: "Purchase",
      listPrice: 19000,
      creditAmount: 0,
      amount: 19000,
      durationDays: 7,
      credits: [],
    };

    vi.spyOn(subscriptionService, "getCheckoutQuote").mockResolvedValue(mockQuote);
    const checkoutSpy = vi.spyOn(subscriptionService, "checkout").mockResolvedValue({
      orderId: "order-999",
      amount: 19000,
      status: "Pending",
      type: "Purchase",
    });

    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: { id: "user-123" },
      isDemo: false,
      isLoggedIn: true,
    });

    vi.spyOn(SubscriptionContextModule, "useSubscription").mockReturnValue({
      plans: [{ code: "TripPass", price: 19000, durationDays: 7 }],
      subscription: { plan: "Free" },
      plansLoading: false,
      plansError: null,
      subscriptionLoading: false,
      subscriptionError: null,
      refreshPlans: vi.fn(),
      refreshSubscription: vi.fn(),
      refreshAll: vi.fn(),
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /Chọn Trip Pass/i }));

    await waitFor(() => {
      expect(screen.getByTestId("quote-confirm-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("quote-confirm-button"));

    await waitFor(() => {
      expect(checkoutSpy).toHaveBeenCalledWith("TripPass");
    });
  });

  // ==========================================================================
  // Q17: Cancel creates no checkout
  // ==========================================================================
  it("Q17: Cancel creates no checkout", async () => {
    const mockQuote = {
      planCode: "Membership",
      type: "Upgrade",
      listPrice: 59000,
      creditAmount: 19000,
      amount: 40000,
      durationDays: 30,
      credits: [],
    };

    vi.spyOn(subscriptionService, "getCheckoutQuote").mockResolvedValue(mockQuote);
    const checkoutSpy = vi.spyOn(subscriptionService, "checkout");

    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: { id: "user-123" },
      isDemo: false,
      isLoggedIn: true,
    });

    vi.spyOn(SubscriptionContextModule, "useSubscription").mockReturnValue({
      plans: [{ code: "Membership", price: 59000, durationDays: 30 }],
      subscription: { plan: "TripPass" },
      plansLoading: false,
      plansError: null,
      subscriptionLoading: false,
      subscriptionError: null,
      refreshPlans: vi.fn(),
      refreshSubscription: vi.fn(),
      refreshAll: vi.fn(),
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /Chọn Membership/i }));

    await waitFor(() => {
      expect(screen.getByTestId("quote-cancel-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("quote-cancel-button"));

    // Preview closed, checkout NOT called
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
    expect(checkoutSpy).not.toHaveBeenCalled();
  });

  // ==========================================================================
  // Q18: no financial values passed into checkout request
  // ==========================================================================
  it("Q18: no financial values passed into checkout request", async () => {
    const mockQuote = {
      planCode: "Membership",
      type: "Upgrade",
      listPrice: 59000,
      creditAmount: 19000,
      amount: 40000,
      durationDays: 30,
      credits: [],
    };

    vi.spyOn(subscriptionService, "getCheckoutQuote").mockResolvedValue(mockQuote);
    const checkoutSpy = vi.spyOn(subscriptionService, "checkout").mockResolvedValue({
      orderId: "order-financial-check",
      amount: 40000,
      status: "Pending",
    });

    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: { id: "user-123" },
      isDemo: false,
      isLoggedIn: true,
    });

    vi.spyOn(SubscriptionContextModule, "useSubscription").mockReturnValue({
      plans: [{ code: "Membership", price: 59000, durationDays: 30 }],
      subscription: { plan: "TripPass" },
      plansLoading: false,
      plansError: null,
      subscriptionLoading: false,
      subscriptionError: null,
      refreshPlans: vi.fn(),
      refreshSubscription: vi.fn(),
      refreshAll: vi.fn(),
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole("button", { name: /Chọn Membership/i }));

    await waitFor(() => {
      expect(screen.getByTestId("quote-confirm-button")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId("quote-confirm-button"));

    await waitFor(() => {
      expect(checkoutSpy).toHaveBeenCalled();
    });

    // Check args strictly: should only be string planCode
    const callArg = checkoutSpy.mock.calls[0][0];
    expect(callArg).toBe("Membership");
    expect(typeof callArg).toBe("string");
    // Ensure no financial fields were passed
    expect(callArg).not.toHaveProperty("amount");
    expect(callArg).not.toHaveProperty("creditAmount");
    expect(callArg).not.toHaveProperty("listPrice");
  });

  // ==========================================================================
  // Q19: unknown quote type fails safe, not Purchase fallback
  // ==========================================================================
  it("Q19: unknown quote type fails safe, not Purchase fallback", () => {
    const unknownQuote = {
      planCode: "TripPass",
      type: "SpecialPromoDowngrade",
      listPrice: 50000,
      creditAmount: 0,
      amount: 50000,
      durationDays: 7,
      credits: [],
    };

    render(
      <CheckoutQuoteDialog
        isOpen={true}
        onClose={vi.fn()}
        quote={unknownQuote}
        onConfirm={vi.fn()}
      />
    );

    // Fail-safe state: message shown, NO confirm button, does NOT say "Mua mới"
    expect(screen.getByText("Loại giao dịch không được hỗ trợ")).toBeInTheDocument();
    expect(screen.queryByTestId("quote-type-badge")).not.toBeInTheDocument();
    expect(screen.queryByTestId("quote-confirm-button")).not.toBeInTheDocument();
    expect(screen.getByTestId("quote-cancel-button")).toHaveTextContent("Đóng");
  });

  // ==========================================================================
  // Q20: no Membership/TripPass rank decision remains in PlanCard flow
  // ==========================================================================
  it("Q20: no Membership/TripPass rank decision remains in PlanCard flow", () => {
    const onSelectMock = vi.fn();
    const onRenewMock = vi.fn();

    // 1. Current plan is Membership, target plan is TripPass
    // Old code blocked this with "Đã gồm trong Membership".
    // New code MUST allow selecting TripPass so backend can classify/block!
    const { rerender } = render(
      <PlanCard
        plan={{ code: "TripPass", price: 19000, durationDays: 7 }}
        currentPlanCode="Membership"
        onSelect={onSelectMock}
        onRenew={onRenewMock}
      />
    );

    expect(screen.queryByText("Đã gồm trong Membership")).not.toBeInTheDocument();
    const chooseTripPass = screen.getByRole("button", { name: /Chọn Trip Pass/i });
    expect(chooseTripPass).toBeEnabled();
    fireEvent.click(chooseTripPass);
    expect(onSelectMock).toHaveBeenCalledWith("TripPass");

    // 2. Current plan is TripPass, target plan is Membership
    // Old code hardcoded "Nâng cấp Membership".
    // New code MUST neutrally render "Chọn Membership"!
    rerender(
      <PlanCard
        plan={{ code: "Membership", price: 59000, durationDays: 30 }}
        currentPlanCode="TripPass"
        onSelect={onSelectMock}
        onRenew={onRenewMock}
      />
    );

    expect(screen.queryByText("Nâng cấp Membership")).not.toBeInTheDocument();
    const chooseMembership = screen.getByRole("button", { name: /Chọn Membership/i });
    expect(chooseMembership).toBeEnabled();

    // 3. Custom plan can be chosen without any hierarchy restriction
    rerender(
      <PlanCard
        plan={{ code: "CUSTOM_TIER", price: 99000, durationDays: 60 }}
        currentPlanCode="TripPass"
        onSelect={onSelectMock}
        onRenew={onRenewMock}
      />
    );

    const chooseCustom = screen.getByRole("button", { name: /Chọn CUSTOM_TIER/i });
    expect(chooseCustom).toBeEnabled();
    fireEvent.click(chooseCustom);
    expect(onSelectMock).toHaveBeenCalledWith("CUSTOM_TIER");

    // 4. Current plan is a custom plan: can renew
    rerender(
      <PlanCard
        plan={{ code: "CUSTOM_TIER", price: 99000, durationDays: 60 }}
        currentPlanCode="CUSTOM_TIER"
        onSelect={onSelectMock}
        onRenew={onRenewMock}
      />
    );

    expect(screen.getByText("Gói đang dùng")).toBeInTheDocument();
    const renewCustom = screen.getByRole("button", { name: /Gia hạn CUSTOM_TIER/i });
    expect(renewCustom).toBeEnabled();
    fireEvent.click(renewCustom);
    expect(onRenewMock).toHaveBeenCalled();
  });
});
