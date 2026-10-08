import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SubscriptionSummary from "../src/components/subscription/SubscriptionSummary";
import PlanCard from "../src/components/subscription/PlanCard";
import ProfilePage from "../src/pages/profile/ProfilePage";
import SubscriptionPage from "../src/pages/subscription/SubscriptionPage";
import { SubscriptionProvider, useSubscription } from "../src/context/SubscriptionContext";
import * as AuthContextModule from "../src/context/AuthContext";
import * as SubscriptionContextModule from "../src/context/SubscriptionContext";
import * as TripContextModule from "../src/context/TripContext";
import * as NotificationContextModule from "../src/context/NotificationContext";
import { subscriptionService } from "../src/services/subscriptionService";
import {
  PAYMENT_ORDER_STATUS,
  PAYMENT_ORDER_TYPE,
  CUSTOMER_SUBSCRIPTION_ERROR_CODES,
} from "../src/utils/subscriptionUpgradeContract";
import { ApiError } from "../src/api/apiClient";
import { tagService } from "../src/services/tagService";
import { isPaidSubscription, isFreeSubscription } from "../src/utils/subscriptionUtils";

describe("FE-UP4: Current Subscription State & Renewal Verification", () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(tagService, "getTags").mockResolvedValue([]);
    vi.spyOn(NotificationContextModule, "useNotifications").mockReturnValue({ enabled: false, unreadCount: 0 });
  });

  afterEach(() => {
    cleanup();
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  // Helper to mock Auth, Subscription and Trip context
  const mockContexts = ({
    user = { id: "user-123", fullName: "Nguyễn Văn A", email: "vana@example.com", role: "User" },
    isDemo = false,
    isLoggedIn = true,
    subscription = { plan: "Free", endsAt: null, effectiveUntil: null },
    plans = [
      { code: "Free", price: 0, durationDays: null },
      { code: "Membership", price: 59000, durationDays: 30 },
    ],
    subscriptionLoading = false,
    subscriptionError = null,
    refreshSubscription = vi.fn(),
    savedTrips = [],
  } = {}) => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user,
      isDemo,
      isLoggedIn,
      initializing: false,
      logout: vi.fn(),
      applyUserProfile: vi.fn(),
    });

    vi.spyOn(SubscriptionContextModule, "useSubscription").mockReturnValue({
      plans,
      subscription,
      plansLoading: false,
      plansError: null,
      subscriptionLoading,
      subscriptionError,
      subscriptionUnavailableReason: isDemo ? "demo" : null,
      refreshPlans: vi.fn(),
      refreshSubscription,
      refreshAll: vi.fn(),
      clearSubscriptionState: vi.fn(),
    });

    vi.spyOn(TripContextModule, "useTrip").mockReturnValue({
      savedTrips,
    });
  };

  // ==========================================================================
  // S01: initial /me loading does not display Free as current
  // ==========================================================================
  it("S01: initial /me loading does not display Free as current", () => {
    mockContexts({
      subscription: null,
      subscriptionLoading: true,
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    // Free card should NOT be marked "Hiện tại"
    expect(screen.queryByText("Hiện tại")).toBeNull();
    // And Free action button should NOT say "Gói hiện tại"
    expect(screen.queryByText("Gói hiện tại")).toBeNull();
  });

  // ==========================================================================
  // S02: initial loading does not display Unlimited
  // ==========================================================================
  it("S02: initial loading does not display Unlimited", () => {
    mockContexts({
      subscription: null,
      subscriptionLoading: true,
    });

    const { container: summaryContainer } = render(
      <SubscriptionSummary subscription={null} loading={true} />
    );
    expect(summaryContainer).not.toHaveTextContent("Không giới hạn");
    cleanup();

    mockContexts({
      subscription: null,
      subscriptionLoading: true,
    });

    const { container: profileContainer } = render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );
    expect(profileContainer).not.toHaveTextContent("Không giới hạn");
  });

  // ==========================================================================
  // S03: /me failure shows unavailable state, not Free
  // ==========================================================================
  it("S03: /me failure shows unavailable state, not Free", () => {
    mockContexts({
      subscription: null,
      subscriptionLoading: false,
    });

    const { container: summaryContainer } = render(
      <SubscriptionSummary subscription={null} loading={false} />
    );
    expect(summaryContainer).toHaveTextContent("Không thể tải thông tin gói");
    expect(summaryContainer).not.toHaveTextContent("Gói của bạn Free");
    expect(summaryContainer).not.toHaveTextContent("Mặc định");
    cleanup();

    mockContexts({
      subscription: null,
      subscriptionLoading: false,
      subscriptionError: "Máy chủ gặp sự cố",
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );
    expect(screen.getByTestId("profile-subscription-unavailable")).toBeInTheDocument();
    expect(screen.getByText("Không thể tải thông tin gói")).toBeInTheDocument();
    expect(screen.queryByText("Gói hiện tại: Free")).toBeNull();
  });

  // ==========================================================================
  // S04: /me failure does not mark Free PlanCard current
  // ==========================================================================
  it("S04: /me failure does not mark Free PlanCard current", () => {
    mockContexts({
      subscription: null,
      subscriptionLoading: false,
      subscriptionError: "Không thể kết nối máy chủ",
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    expect(screen.queryByText("Hiện tại")).toBeNull();
    expect(screen.queryByText("Gói hiện tại")).toBeNull();
  });

  // ==========================================================================
  // S05: /me failure disables/hides Renewal
  // ==========================================================================
  it("S05: /me failure disables/hides Renewal", () => {
    const onRenew = vi.fn();
    render(
      <SubscriptionSummary
        subscription={null}
        loading={false}
        onRenew={onRenew}
      />
    );
    expect(screen.queryByRole("button", { name: /Gia hạn/i })).toBeNull();

    mockContexts({
      subscription: null,
      subscriptionLoading: false,
      subscriptionError: "Không thể tải thông tin gói",
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );
    expect(screen.queryByRole("button", { name: /Gia hạn/i })).toBeNull();
  });

  // ==========================================================================
  // S06: successful Free response displays Free only because Backend said Free
  // ==========================================================================
  it("S06: successful Free response displays Free only because Backend said Free", () => {
    const freeSubscription = {
      plan: "Free",
      endsAt: null,
      effectiveUntil: null,
      usage: {
        generateUsed: 0,
        generateLimit: 1,
        resetAt: "2026-11-01T00:00:00Z",
      },
      savedTrips: {
        used: 0,
        limit: 1,
      },
    };

    render(
      <SubscriptionSummary
        subscription={freeSubscription}
        loading={false}
      />
    );
    expect(screen.getByText("Free")).toBeInTheDocument();
    expect(screen.getByText("Mặc định")).toBeInTheDocument();

    mockContexts({
      subscription: freeSubscription,
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    // Free card is marked "Hiện tại"
    expect(screen.getByText("Hiện tại")).toBeInTheDocument();
    expect(screen.getByText("Gói hiện tại")).toBeInTheDocument();
  });

  // ==========================================================================
  // S07: custom paid plan code displays correctly
  // ==========================================================================
  it("S07: custom paid plan code displays correctly", () => {
    const customSubscription = {
      plan: "EnterpriseTier",
      endsAt: "2026-12-01T00:00:00Z",
      effectiveUntil: "2026-12-01T00:00:00Z",
      usage: {
        generateUsed: 12,
        generateLimit: 100,
        resetAt: "2026-12-01T00:00:00Z",
      },
      savedTrips: {
        used: 3,
        limit: 50,
      },
    };

    render(
      <SubscriptionSummary
        subscription={customSubscription}
        loading={false}
      />
    );
    expect(screen.getByText("EnterpriseTier")).toBeInTheDocument();
  });

  // ==========================================================================
  // S08: custom paid plan is not treated as Free/default
  // ==========================================================================
  it("S08: custom paid plan is not treated as Free/default", () => {
    const customSubscription = {
      plan: "EnterpriseTier",
      endsAt: "2026-12-01T00:00:00Z",
      effectiveUntil: "2026-12-01T00:00:00Z",
    };

    render(
      <SubscriptionSummary
        subscription={customSubscription}
        loading={false}
      />
    );
    expect(screen.getByText("Đang hoạt động")).toBeInTheDocument();
    expect(screen.queryByText("Mặc định")).toBeNull();
  });

  // ==========================================================================
  // S09: custom current paid plan can expose explicit Renew
  // ==========================================================================
  it("S09: custom current paid plan can expose explicit Renew", () => {
    const onRenew = vi.fn();
    const customSubscription = {
      plan: "EnterpriseTier",
      endsAt: "2026-12-01T00:00:00Z",
      effectiveUntil: "2026-12-01T00:00:00Z",
    };

    render(
      <SubscriptionSummary
        subscription={customSubscription}
        loading={false}
        onRenew={onRenew}
      />
    );

    const renewBtn = screen.getByRole("button", { name: /Gia hạn EnterpriseTier/i });
    expect(renewBtn).toBeInTheDocument();
    fireEvent.click(renewBtn);
    expect(onRenew).toHaveBeenCalledTimes(1);

    cleanup();

    // PlanCard for custom plan also supports explicit renewal when current
    const planCardRenew = vi.fn();
    render(
      <PlanCard
        plan={{ code: "EnterpriseTier", price: 150000, durationDays: 30 }}
        currentPlanCode="EnterpriseTier"
        onRenew={planCardRenew}
      />
    );
    const cardRenewBtn = screen.getByRole("button", { name: /Gia hạn EnterpriseTier/i });
    expect(cardRenewBtn).toBeInTheDocument();
    fireEvent.click(cardRenewBtn);
    expect(planCardRenew).toHaveBeenCalledTimes(1);
  });

  // ==========================================================================
  // S10: generateLimit = null => unlimited
  // ==========================================================================
  it("S10: generateLimit = null => unlimited", () => {
    const sub = {
      plan: "Membership",
      endsAt: "2026-12-01T00:00:00Z",
      effectiveUntil: "2026-12-01T00:00:00Z",
      usage: {
        generateUsed: 0,
        generateLimit: null,
        resetAt: "2026-12-01T00:00:00Z",
      },
    };

    const { container } = render(
      <SubscriptionSummary subscription={sub} loading={false} />
    );
    expect(container).toHaveTextContent("Không giới hạn");
  });

  // ==========================================================================
  // S11: generateLimit = 0 => finite zero
  // ==========================================================================
  it("S11: generateLimit = 0 => finite zero", () => {
    const sub = {
      plan: "CustomTier",
      endsAt: "2026-12-01T00:00:00Z",
      effectiveUntil: "2026-12-01T00:00:00Z",
      usage: {
        generateUsed: 0,
        generateLimit: 0,
        resetAt: "2026-12-01T00:00:00Z",
      },
    };

    const { container } = render(
      <SubscriptionSummary subscription={sub} loading={false} />
    );
    expect(container).toHaveTextContent("0 / 0");
    expect(container).not.toHaveTextContent("Không giới hạn");
  });

  // ==========================================================================
  // S12: generateLimit undefined/missing => NOT unlimited
  // ==========================================================================
  it("S12: generateLimit undefined/missing => NOT unlimited", () => {
    const sub = {
      plan: "Membership",
      endsAt: "2026-12-01T00:00:00Z",
      effectiveUntil: "2026-12-01T00:00:00Z",
      usage: {
        generateUsed: 5,
        // generateLimit missing
        resetAt: "2026-12-01T00:00:00Z",
      },
    };

    const { container } = render(
      <SubscriptionSummary subscription={sub} loading={false} />
    );
    expect(container).not.toHaveTextContent("Không giới hạn");
    expect(container).toHaveTextContent("Chưa có thông tin");
  });

  // ==========================================================================
  // S13: savedTrips.limit = null => unlimited
  // ==========================================================================
  it("S13: savedTrips.limit = null => unlimited", () => {
    const sub = {
      plan: "Membership",
      endsAt: "2026-12-01T00:00:00Z",
      effectiveUntil: "2026-12-01T00:00:00Z",
      savedTrips: {
        used: 10,
        limit: null,
      },
    };

    const { container } = render(
      <SubscriptionSummary subscription={sub} loading={false} />
    );
    expect(container).toHaveTextContent("Không giới hạn");
  });

  // ==========================================================================
  // S14: savedTrips.limit = 0 => finite zero
  // ==========================================================================
  it("S14: savedTrips.limit = 0 => finite zero", () => {
    const sub = {
      plan: "CustomTier",
      endsAt: "2026-12-01T00:00:00Z",
      effectiveUntil: "2026-12-01T00:00:00Z",
      savedTrips: {
        used: 0,
        limit: 0,
      },
    };

    const { container } = render(
      <SubscriptionSummary subscription={sub} loading={false} />
    );
    expect(container).toHaveTextContent("0 / 0");
    expect(container).not.toHaveTextContent("Không giới hạn");
  });

  // ==========================================================================
  // S15: savedTrips.limit undefined/missing => NOT unlimited
  // ==========================================================================
  it("S15: savedTrips.limit undefined/missing => NOT unlimited", () => {
    const sub = {
      plan: "CustomTier",
      endsAt: "2026-12-01T00:00:00Z",
      effectiveUntil: "2026-12-01T00:00:00Z",
      savedTrips: {
        used: 1,
        // limit missing
      },
    };

    const { container } = render(
      <SubscriptionSummary subscription={sub} loading={false} />
    );
    expect(container).not.toHaveTextContent("Không giới hạn");
    expect(container).toHaveTextContent("Chưa có thông tin");
  });

  // ==========================================================================
  // S16: paid finite Generate UI does not say "tháng này"
  // ==========================================================================
  it("S16: paid finite Generate UI does not say 'tháng này'", () => {
    const paidFiniteSub = {
      plan: "TripPass",
      endsAt: "2026-11-08T00:00:00Z",
      effectiveUntil: "2026-11-08T00:00:00Z",
      usage: {
        generateUsed: 3,
        generateLimit: 10,
        resetAt: "2026-11-08T00:00:00Z",
      },
    };

    const { container: summaryContainer } = render(
      <SubscriptionSummary subscription={paidFiniteSub} loading={false} />
    );
    expect(summaryContainer).not.toHaveTextContent("tháng này");
    expect(summaryContainer).toHaveTextContent("Lượt tạo lịch trình");

    cleanup();

    mockContexts({
      subscription: paidFiniteSub,
    });

    const { container: profileContainer } = render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );
    expect(profileContainer).not.toHaveTextContent("tháng này");
    expect(profileContainer).toHaveTextContent("Lượt tạo AI");
  });

  // ==========================================================================
  // S17: Free finite Generate may use monthly wording only from explicit Free state
  // ==========================================================================
  it("S17: Free finite Generate may use monthly wording only from explicit Free state", () => {
    const freeSub = {
      plan: "Free",
      endsAt: null,
      effectiveUntil: null,
      usage: {
        generateUsed: 0,
        generateLimit: 1,
        resetAt: "2026-11-01T00:00:00Z",
      },
    };

    const { container: summaryContainer } = render(
      <SubscriptionSummary subscription={freeSub} loading={false} />
    );
    expect(summaryContainer).toHaveTextContent("Lượt tạo lịch trình tháng này");

    cleanup();

    mockContexts({
      subscription: freeSub,
    });

    const { container: profileContainer } = render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );
    expect(profileContainer).toHaveTextContent("Lượt tạo AI tháng này");
  });

  // ==========================================================================
  // S18: resetAt displayed from Backend; no local reset math
  // ==========================================================================
  it("S18: resetAt displayed from Backend; no local reset math", () => {
    const sub = {
      plan: "TripPass",
      endsAt: "2026-11-08T00:00:00Z",
      effectiveUntil: "2026-11-08T00:00:00Z",
      usage: {
        generateUsed: 1,
        generateLimit: 5,
        resetAt: "2026-11-08T14:30:00Z", // Vietnam time: 21:30 08/11/2026
      },
    };

    const { container } = render(
      <SubscriptionSummary subscription={sub} loading={false} />
    );
    expect(container).toHaveTextContent("Làm mới vào 21:30 08/11/2026");
  });

  // ==========================================================================
  // S19: effectiveUntil displayed as current-period boundary
  // ==========================================================================
  it("S19: effectiveUntil displayed as current-period boundary", () => {
    const sub = {
      plan: "Membership",
      effectiveUntil: "2026-11-01T10:00:00Z",
      endsAt: null,
    };

    const { container } = render(
      <SubscriptionSummary subscription={sub} loading={false} />
    );
    expect(container).toHaveTextContent("Kỳ hiện tại đến: 17:00 01/11/2026");
  });

  // ==========================================================================
  // S20: endsAt displayed as paid-through horizon
  // ==========================================================================
  it("S20: endsAt displayed as paid-through horizon", () => {
    const sub = {
      plan: "Membership",
      effectiveUntil: null,
      endsAt: "2026-12-01T10:00:00Z",
    };

    const { container } = render(
      <SubscriptionSummary subscription={sub} loading={false} />
    );
    expect(container).toHaveTextContent("Đã thanh toán đến: 17:00 01/12/2026");
  });

  // ==========================================================================
  // S21: effectiveUntil < endsAt / different timestamps: both meanings represented
  // ==========================================================================
  it("S21: effectiveUntil < endsAt / different timestamps: both meanings represented", () => {
    const queuedRenewalSub = {
      plan: "Membership",
      effectiveUntil: "2026-11-01T10:00:00Z",
      endsAt: "2026-12-01T10:00:00Z",
    };

    const { container } = render(
      <SubscriptionSummary subscription={queuedRenewalSub} loading={false} />
    );
    expect(container).toHaveTextContent("Kỳ hiện tại đến: 17:00 01/11/2026");
    expect(container).toHaveTextContent("Đã thanh toán đến: 17:00 01/12/2026");
  });

  // ==========================================================================
  // S22: same effectiveUntil/endsAt does not misleadingly claim two different entitlements
  // ==========================================================================
  it("S22: same effectiveUntil/endsAt does not misleadingly claim two different entitlements", () => {
    const singlePeriodSub = {
      plan: "Membership",
      effectiveUntil: "2026-11-01T10:00:00Z",
      endsAt: "2026-11-01T10:00:00Z",
    };

    const { container } = render(
      <SubscriptionSummary subscription={singlePeriodSub} loading={false} />
    );
    expect(container).toHaveTextContent("Kỳ hiện tại đến: 17:00 01/11/2026");
    // Should NOT also render a duplicate "Đã thanh toán đến" row
    expect(container).not.toHaveTextContent("Đã thanh toán đến:");
  });

  // ==========================================================================
  // S23: savedTrips.used displayed from /me exactly
  // ==========================================================================
  it("S23: savedTrips.used displayed from /me exactly", () => {
    const sub = {
      plan: "TripPass",
      endsAt: "2026-11-08T00:00:00Z",
      effectiveUntil: "2026-11-08T00:00:00Z",
      savedTrips: {
        used: 2,
        limit: 3,
      },
    };

    const { container } = render(
      <SubscriptionSummary subscription={sub} loading={false} />
    );
    expect(container).toHaveTextContent("2 / 3");
  });

  // ==========================================================================
  // S24: ProfilePage missing subscription does not fallback to Free
  // ==========================================================================
  it("S24: ProfilePage missing subscription does not fallback to Free", () => {
    mockContexts({
      subscription: null,
      subscriptionLoading: false,
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    expect(screen.getByText("Không thể tải thông tin gói")).toBeInTheDocument();
    expect(screen.queryByText("Gói hiện tại: Free")).toBeNull();
  });

  // ==========================================================================
  // S25: ProfilePage missing quota does not render Unlimited
  // ==========================================================================
  it("S25: ProfilePage missing quota does not render Unlimited", () => {
    mockContexts({
      subscription: {
        plan: "Membership",
        endsAt: "2026-11-08T00:00:00Z",
        effectiveUntil: "2026-11-08T00:00:00Z",
        // usage and savedTrips limits omitted
      },
      subscriptionLoading: false,
    });

    const { container } = render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    expect(container).not.toHaveTextContent("Không giới hạn");
    expect(screen.getAllByText("Chưa có thông tin").length).toBeGreaterThanOrEqual(1);
  });

  // ==========================================================================
  // S26: Profile custom plan display works
  // ==========================================================================
  it("S26: Profile custom plan display works", () => {
    mockContexts({
      subscription: {
        plan: "ProPlusSpecial",
        endsAt: "2026-12-01T00:00:00Z",
        effectiveUntil: "2026-12-01T00:00:00Z",
      },
      subscriptionLoading: false,
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    expect(screen.getByText("ProPlusSpecial")).toBeInTheDocument();
  });

  // ==========================================================================
  // S27: Renew invokes POST /subscription/renew with no body
  // ==========================================================================
  it("S27: Renew invokes POST /subscription/renew with no body", async () => {
    mockContexts({
      subscription: {
        plan: "Membership",
        endsAt: "2026-11-01T00:00:00Z",
        effectiveUntil: "2026-11-01T00:00:00Z",
      },
    });

    const renewSpy = vi.spyOn(subscriptionService, "renew").mockResolvedValue({
      orderId: "order-renew-27",
      status: PAYMENT_ORDER_STATUS.PENDING,
      amount: 59000,
      type: PAYMENT_ORDER_TYPE.RENEWAL,
      listPrice: 59000,
      creditAmount: 0,
      qrCode: "data:image/png;base64,renewqr",
      checkoutUrl: "https://pay.payos.vn/renew",
      expiresAt: new Date(Date.now() + 600000).toISOString(),
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    const renewBtns = screen.getAllByRole("button", { name: /Gia hạn Membership/i });
    fireEvent.click(renewBtns[0]);

    await waitFor(() => {
      expect(renewSpy).toHaveBeenCalledTimes(1);
      // Confirmed: renew was called with 0 arguments
      expect(renewSpy).toHaveBeenCalledWith();
    });
  });

  // ==========================================================================
  // S28: Renew does NOT call checkout-quote
  // ==========================================================================
  it("S28: Renew does NOT call checkout-quote", async () => {
    mockContexts({
      subscription: {
        plan: "Membership",
        endsAt: "2026-11-01T00:00:00Z",
        effectiveUntil: "2026-11-01T00:00:00Z",
      },
    });

    const quoteSpy = vi.spyOn(subscriptionService, "getCheckoutQuote");
    vi.spyOn(subscriptionService, "renew").mockResolvedValue({
      orderId: "order-renew-28",
      status: PAYMENT_ORDER_STATUS.PENDING,
      amount: 59000,
      type: PAYMENT_ORDER_TYPE.RENEWAL,
      listPrice: 59000,
      creditAmount: 0,
      qrCode: "qr",
      checkoutUrl: "url",
      expiresAt: new Date(Date.now() + 600000).toISOString(),
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    const renewBtns = screen.getAllByRole("button", { name: /Gia hạn Membership/i });
    fireEvent.click(renewBtns[0]);

    await waitFor(() => {
      expect(quoteSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // S29: Renew does NOT send planCode
  // ==========================================================================
  it("S29: Renew does NOT send planCode", async () => {
    mockContexts({
      subscription: {
        plan: "Membership",
        endsAt: "2026-11-01T00:00:00Z",
        effectiveUntil: "2026-11-01T00:00:00Z",
      },
    });

    const renewSpy = vi.spyOn(subscriptionService, "renew").mockResolvedValue({
      orderId: "order-renew-29",
      status: PAYMENT_ORDER_STATUS.PENDING,
      amount: 59000,
      type: PAYMENT_ORDER_TYPE.RENEWAL,
      listPrice: 59000,
      creditAmount: 0,
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    const renewBtns = screen.getAllByRole("button", { name: /Gia hạn Membership/i });
    fireEvent.click(renewBtns[0]);

    await waitFor(() => {
      expect(renewSpy).toHaveBeenCalledWith();
    });
  });

  // ==========================================================================
  // S30: plan_already_active handoff invokes Renew, not checkout retry
  // ==========================================================================
  it("S30: plan_already_active handoff invokes Renew, not checkout retry", async () => {
    mockContexts({
      subscription: {
        plan: "Membership",
        endsAt: "2026-11-01T00:00:00Z",
        effectiveUntil: "2026-11-01T00:00:00Z",
      },
    });

    const renewSpy = vi.spyOn(subscriptionService, "renew").mockResolvedValue({
      orderId: "order-renew-30",
      status: PAYMENT_ORDER_STATUS.PENDING,
      amount: 59000,
      type: PAYMENT_ORDER_TYPE.RENEWAL,
      listPrice: 59000,
      creditAmount: 0,
    });
    const checkoutSpy = vi.spyOn(subscriptionService, "checkout");

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    const renewBtns = screen.getAllByRole("button", { name: /Gia hạn Membership/i });
    fireEvent.click(renewBtns[0]);

    await waitFor(() => {
      expect(renewSpy).toHaveBeenCalledTimes(1);
      expect(checkoutSpy).not.toHaveBeenCalled();
    });
  });

  // ==========================================================================
  // S31: Renew Pending uses FE-UP3 PaymentIntent path
  // ==========================================================================
  it("S31: Renew Pending uses FE-UP3 PaymentIntent path", async () => {
    mockContexts({
      subscription: {
        plan: "Membership",
        endsAt: "2026-11-01T00:00:00Z",
        effectiveUntil: "2026-11-01T00:00:00Z",
      },
    });

    vi.spyOn(subscriptionService, "renew").mockResolvedValue({
      orderId: "order-renew-31",
      status: PAYMENT_ORDER_STATUS.PENDING,
      amount: 59000,
      type: PAYMENT_ORDER_TYPE.RENEWAL,
      listPrice: 59000,
      creditAmount: 0,
      qrCode: "data:image/png;base64,renewqr",
      checkoutUrl: "https://pay.payos.vn/renew",
      expiresAt: new Date(Date.now() + 600000).toISOString(),
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    const renewBtns = screen.getAllByRole("button", { name: /Gia hạn Membership/i });
    fireEvent.click(renewBtns[0]);

    await waitFor(() => {
      expect(screen.getByText("Chờ thanh toán")).toBeInTheDocument();
      expect(screen.getByText("Mở trang thanh toán PayOS")).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // S32: Renew Paid triggers refresh /me
  // ==========================================================================
  it("S32: Renew Paid triggers refresh /me", async () => {
    const refreshSubscription = vi.fn();
    mockContexts({
      subscription: {
        plan: "Membership",
        endsAt: "2026-11-01T00:00:00Z",
        effectiveUntil: "2026-11-01T00:00:00Z",
      },
      refreshSubscription,
    });

    vi.spyOn(subscriptionService, "renew").mockResolvedValue({
      orderId: "order-renew-32",
      status: PAYMENT_ORDER_STATUS.PAID,
      amount: 59000,
      type: PAYMENT_ORDER_TYPE.RENEWAL,
      listPrice: 59000,
      creditAmount: 0,
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    const renewBtns = screen.getAllByRole("button", { name: /Gia hạn Membership/i });
    fireEvent.click(renewBtns[0]);

    await waitFor(() => {
      expect(refreshSubscription).toHaveBeenCalledTimes(1);
      expect(screen.getByText(/Gia hạn thành công!/i)).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // S33: Renew ReviewRequired remains ReviewRequired
  // ==========================================================================
  it("S33: Renew ReviewRequired remains ReviewRequired", async () => {
    mockContexts({
      subscription: {
        plan: "Membership",
        endsAt: "2026-11-01T00:00:00Z",
        effectiveUntil: "2026-11-01T00:00:00Z",
      },
    });

    vi.spyOn(subscriptionService, "renew").mockResolvedValue({
      orderId: "order-renew-33",
      status: PAYMENT_ORDER_STATUS.REVIEW_REQUIRED,
      amount: 59000,
      type: PAYMENT_ORDER_TYPE.RENEWAL,
      listPrice: 59000,
      creditAmount: 0,
    });

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    const renewBtns = screen.getAllByRole("button", { name: /Gia hạn Membership/i });
    fireEvent.click(renewBtns[0]);

    await waitFor(() => {
      expect(screen.getByText(/kiểm tra đối soát/i)).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // S34: no_active_subscription does not fabricate Free; refresh/error safe
  // ==========================================================================
  it("S34: no_active_subscription does not fabricate Free; refresh/error safe", async () => {
    const refreshSubscription = vi.fn();
    mockContexts({
      subscription: {
        plan: "Membership",
        endsAt: "2026-11-01T00:00:00Z",
        effectiveUntil: "2026-11-01T00:00:00Z",
      },
      refreshSubscription,
    });

    const error = new ApiError("Không có gói", 409, CUSTOMER_SUBSCRIPTION_ERROR_CODES.NO_ACTIVE_SUBSCRIPTION);
    vi.spyOn(subscriptionService, "renew").mockRejectedValue(error);

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    const renewBtns = screen.getAllByRole("button", { name: /Gia hạn Membership/i });
    fireEvent.click(renewBtns[0]);

    await waitFor(() => {
      expect(refreshSubscription).toHaveBeenCalledTimes(1);
      expect(
        screen.getByText("Bạn chưa có gói trả phí nào đang hoạt động để gia hạn. Vui lòng chọn gói mới.")
      ).toBeInTheDocument();
    });
  });

  // ==========================================================================
  // S35: account switch cannot show previous owner's subscription state
  // ==========================================================================
  it("S35: account switch cannot show previous owner's subscription state", async () => {
    let currentUser = { id: "user-A", fullName: "User A" };
    const getMySubSpy = vi.spyOn(subscriptionService, "getMySubscription");

    getMySubSpy.mockResolvedValueOnce({
      plan: "Membership",
      endsAt: "2026-11-01T00:00:00Z",
      effectiveUntil: "2026-11-01T00:00:00Z",
    });

    let currentContext = null;
    function ConsumerComponent() {
      currentContext = useSubscription();
      return (
        <div>
          <span data-testid="plan">{currentContext.subscription?.plan || "none"}</span>
          <span data-testid="loading">{currentContext.subscriptionLoading ? "loading" : "idle"}</span>
        </div>
      );
    }

    vi.spyOn(subscriptionService, "getPlans").mockResolvedValue([]);

    function DynamicAuthAndSubWrapper({ user }) {
      vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
        user,
        isDemo: false,
        isLoggedIn: Boolean(user),
        initializing: false,
      });

      return (
        <SubscriptionProvider>
          <ConsumerComponent />
        </SubscriptionProvider>
      );
    }

    // Mount with User A
    const { rerender } = render(<DynamicAuthAndSubWrapper user={currentUser} />);

    await waitFor(() => {
      expect(screen.getByTestId("plan")).toHaveTextContent("Membership");
    });

    // Switch to User B with pending promise for User B
    getMySubSpy.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          setTimeout(() => {
            resolve({
              plan: "TripPass",
              endsAt: "2026-11-08T00:00:00Z",
              effectiveUntil: "2026-11-08T00:00:00Z",
            });
          }, 50);
        })
    );

    rerender(<DynamicAuthAndSubWrapper user={{ id: "user-B", fullName: "User B" }} />);

    // User A's plan must be IMMEDIATELY wiped out; must NOT show Membership
    expect(screen.getByTestId("plan")).toHaveTextContent("none");
    expect(screen.getByTestId("loading")).toHaveTextContent("loading");

    await waitFor(() => {
      expect(screen.getByTestId("plan")).toHaveTextContent("TripPass");
    });
  });

  // ==========================================================================
  // S36: late old-owner /me response cannot overwrite new owner
  // ==========================================================================
  it("S36: late old-owner /me response cannot overwrite new owner", async () => {
    let resolveUserA;
    let resolveUserB;

    const promiseA = new Promise((resolve) => {
      resolveUserA = resolve;
    });
    const promiseB = new Promise((resolve) => {
      resolveUserB = resolve;
    });

    const getMySubSpy = vi.spyOn(subscriptionService, "getMySubscription");
    getMySubSpy
      .mockImplementationOnce(() => promiseA)
      .mockImplementationOnce(() => promiseB);

    vi.spyOn(subscriptionService, "getPlans").mockResolvedValue([]);

    function Consumer() {
      const { subscription, subscriptionLoading } = useSubscription();
      return (
        <div>
          <span data-testid="plan">{subscription?.plan || "none"}</span>
          <span data-testid="loading">{subscriptionLoading ? "loading" : "idle"}</span>
        </div>
      );
    }

    function DynamicWrapper({ user }) {
      vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
        user,
        isDemo: false,
        isLoggedIn: Boolean(user),
        initializing: false,
      });

      return (
        <SubscriptionProvider>
          <Consumer />
        </SubscriptionProvider>
      );
    }

    // 1. Mount with User A
    const { rerender } = render(<DynamicWrapper user={{ id: "user-A" }} />);
    expect(screen.getByTestId("loading")).toHaveTextContent("loading");

    // 2. Switch to User B before User A's fetch resolves
    rerender(<DynamicWrapper user={{ id: "user-B" }} />);

    // 3. User B's fetch resolves first with TripPass
    await act(async () => {
      resolveUserB({
        plan: "TripPass",
        endsAt: "2026-11-08T00:00:00Z",
        effectiveUntil: "2026-11-08T00:00:00Z",
      });
      await promiseB;
    });

    await waitFor(() => {
      expect(screen.getByTestId("plan")).toHaveTextContent("TripPass");
    });

    // 4. Now User A's fetch resolves late with Membership
    await act(async () => {
      resolveUserA({
        plan: "Membership",
        endsAt: "2026-12-01T00:00:00Z",
        effectiveUntil: "2026-12-01T00:00:00Z",
      });
      await promiseA;
    });

    // 5. User B's state MUST NOT be overwritten by User A's stale response!
    expect(screen.getByTestId("plan")).toHaveTextContent("TripPass");
  });

  // ==========================================================================
  // S37: inconsistent non-Free subscription with missing/null boundaries fails safely to unavailable state
  // ==========================================================================
  it("S37: inconsistent non-Free subscription with missing/null boundaries fails safely to unavailable state", () => {
    const malformedSub = {
      plan: "CustomTier",
      endsAt: null,
      effectiveUntil: null,
    };

    const { container: summaryContainer } = render(
      <SubscriptionSummary subscription={malformedSub} loading={false} />
    );
    // Must render unavailable state
    expect(screen.getByTestId("subscription-summary-unavailable")).toBeInTheDocument();
    // Must NEVER render "Mặc định" badge for a non-Free plan
    expect(summaryContainer).not.toHaveTextContent("Mặc định");
    expect(summaryContainer).not.toHaveTextContent("Đang hoạt động");
    cleanup();

    mockContexts({
      subscription: malformedSub,
      subscriptionLoading: false,
    });

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );
    expect(screen.getByTestId("profile-subscription-unavailable")).toBeInTheDocument();
    expect(screen.queryByText("Gói hiện tại: CustomTier")).toBeNull();
  });

  // ==========================================================================
  // S38: PlanCard does not render clickable Gia hạn button when onRenew is omitted
  // ==========================================================================
  it("S38: PlanCard does not render clickable Gia hạn button when onRenew is omitted", () => {
    render(
      <PlanCard
        plan={{ code: "Membership", price: 59000, durationDays: 30 }}
        currentPlanCode="Membership"
        onRenew={undefined}
      />
    );

    // Should NOT expose a dead clickable "Gia hạn" button
    expect(screen.queryByRole("button", { name: /Gia hạn/i })).toBeNull();
    // Should render disabled "Gói hiện tại"
    expect(screen.getByRole("button", { name: "Gói hiện tại" })).toBeDisabled();
    expect(screen.getByText("Gói đang dùng")).toBeInTheDocument();
  });

  // ==========================================================================
  // S39: isPaidSubscription strictly requires at least one effective lifecycle boundary
  // ==========================================================================
  it("S39: isPaidSubscription strictly requires at least one effective lifecycle boundary", () => {
    // Missing boundaries -> false
    expect(isPaidSubscription({ plan: "Membership" })).toBe(false);
    // Explicit null boundaries on non-Free -> false
    expect(isPaidSubscription({ plan: "Membership", endsAt: null, effectiveUntil: null })).toBe(false);
    // Free with null boundaries -> false
    expect(isPaidSubscription({ plan: "Free", endsAt: null, effectiveUntil: null })).toBe(false);
    expect(isFreeSubscription({ plan: "Free", endsAt: null, effectiveUntil: null })).toBe(true);

    // Valid boundary present -> true
    expect(
      isPaidSubscription({
        plan: "CustomPlan",
        endsAt: "2026-12-01T00:00:00Z",
        effectiveUntil: "2026-11-01T00:00:00Z",
      })
    ).toBe(true);
    expect(
      isPaidSubscription({
        plan: "CustomPlan",
        endsAt: "2026-12-01T00:00:00Z",
        effectiveUntil: null,
      })
    ).toBe(true);
    expect(
      isPaidSubscription({
        plan: "CustomPlan",
        endsAt: null,
        effectiveUntil: "2026-11-01T00:00:00Z",
      })
    ).toBe(true);
  });
});
