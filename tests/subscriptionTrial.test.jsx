import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, cleanup, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import SubscriptionSummary from "../src/components/subscription/SubscriptionSummary";
import CheckoutQuoteDialog from "../src/components/subscription/CheckoutQuoteDialog";
import ProfilePage from "../src/pages/profile/ProfilePage";
import SubscriptionPage from "../src/pages/subscription/SubscriptionPage";
import * as AuthContextModule from "../src/context/AuthContext";
import * as SubscriptionContextModule from "../src/context/SubscriptionContext";
import * as TripContextModule from "../src/context/TripContext";
import * as NotificationContextModule from "../src/context/NotificationContext";
import { subscriptionService } from "../src/services/subscriptionService";
import { tagService } from "../src/services/tagService";
import { isTrialSubscription } from "../src/utils/subscriptionUtils";

// Gói được tặng / dùng thử khi đăng ký: GET /subscription/me trả isTrial = true, endsAt = null
const TRIAL_SUBSCRIPTION = {
  plan: "TripPass",
  endsAt: null,
  usage: { generateUsed: 0, generateLimit: null, resetAt: "2026-10-31T17:00:00Z" },
  savedTrips: { used: 0, limit: 3 },
  ai: { dailyUsed: 0, dailyLimit: 15, resetAt: "2099-10-14T17:00:00Z" },
  effectiveUntil: "2026-10-24T03:42:03.427505Z",
  isTrial: true,
};

const PAID_SUBSCRIPTION = {
  ...TRIAL_SUBSCRIPTION,
  endsAt: "2026-10-24T03:42:03Z",
  effectiveUntil: "2026-10-24T03:42:03Z",
  isTrial: false,
};

const PLANS = [
  { code: "Free", name: "Free", price: 0, durationDays: null, generateLimit: 1, savedTripLimit: 1 },
  { code: "TripPass", name: "Trip Pass", price: 19000, durationDays: 7, generateLimit: null, savedTripLimit: 3 },
];

const PURCHASE_QUOTE = {
  planCode: "TripPass",
  type: "Purchase",
  listPrice: 19000,
  creditAmount: 0,
  amount: 19000,
  durationDays: 7,
  credits: [],
};

describe("Gói dùng thử (isTrial)", () => {
  beforeEach(() => {
    sessionStorage.clear();
    localStorage.clear();
    vi.restoreAllMocks();
    vi.spyOn(tagService, "getTags").mockResolvedValue([]);
    vi.spyOn(NotificationContextModule, "useNotifications").mockReturnValue({ enabled: false, unreadCount: 0 });
  });

  afterEach(() => {
    cleanup();
    vi.restoreAllMocks();
  });

  const mockContexts = (subscription) => {
    vi.spyOn(AuthContextModule, "useAuth").mockReturnValue({
      user: { id: "user-123", fullName: "Nguyễn Văn A", email: "vana@example.com", role: "User" },
      isDemo: false,
      isLoggedIn: true,
      initializing: false,
      logout: vi.fn(),
      applyUserProfile: vi.fn(),
    });
    vi.spyOn(SubscriptionContextModule, "useSubscription").mockReturnValue({
      plans: PLANS,
      subscription,
      plansLoading: false,
      plansError: null,
      subscriptionLoading: false,
      subscriptionError: null,
      subscriptionUnavailableReason: null,
      refreshPlans: vi.fn(),
      refreshSubscription: vi.fn(),
      refreshAll: vi.fn(),
      clearSubscriptionState: vi.fn(),
    });
    vi.spyOn(TripContextModule, "useTrip").mockReturnValue({ savedTrips: [] });
  };

  it("isTrialSubscription chỉ đúng khi gói trả phí có isTrial = true", () => {
    expect(isTrialSubscription(TRIAL_SUBSCRIPTION)).toBe(true);
    expect(isTrialSubscription(PAID_SUBSCRIPTION)).toBe(false);
    expect(isTrialSubscription({ plan: "Free", endsAt: null, effectiveUntil: null, isTrial: false })).toBe(false);
    expect(isTrialSubscription(null)).toBe(false);
  });

  it("SubscriptionSummary hiện nhãn Dùng thử, ngày hết dùng thử, không có nút Gia hạn", () => {
    render(<SubscriptionSummary subscription={TRIAL_SUBSCRIPTION} plans={PLANS} onRenew={vi.fn()} />);

    expect(screen.getByText("Dùng thử")).toBeInTheDocument();
    expect(screen.getByText("24/10/2026")).toBeInTheDocument();
    expect(screen.getByText("Lượt tạo lịch trình tháng này")).toBeInTheDocument();
    expect(screen.queryByText("Đang hoạt động")).toBeNull();
    expect(screen.queryByText(/Gia hạn/)).toBeNull();
  });

  it("trang gói: thẻ Trip Pass hiện Mua, bấm thì gọi báo giá (không gọi renew) và hộp báo giá có cảnh báo", async () => {
    mockContexts(TRIAL_SUBSCRIPTION);
    const quoteSpy = vi.spyOn(subscriptionService, "getCheckoutQuote").mockResolvedValue(PURCHASE_QUOTE);
    const renewSpy = vi.spyOn(subscriptionService, "renew");

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    expect(screen.queryByText(/Gia hạn/)).toBeNull();
    expect(screen.getByText("Đang dùng thử")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Mua Trip Pass" }));

    await waitFor(() => expect(quoteSpy).toHaveBeenCalledWith("TripPass"));
    const warning = await screen.findByTestId("quote-trial-warning");
    expect(within(warning).getByText(/thay cho thời gian dùng thử còn lại/)).toBeInTheDocument();
    expect(renewSpy).not.toHaveBeenCalled();
  });

  it("trang gói: gói đã mua vẫn có nút Gia hạn", () => {
    mockContexts(PAID_SUBSCRIPTION);

    render(
      <MemoryRouter>
        <SubscriptionPage />
      </MemoryRouter>
    );

    expect(screen.getAllByText(/Gia hạn Trip Pass/).length).toBeGreaterThan(0);
    expect(screen.queryByText("Đang dùng thử")).toBeNull();
  });

  it("hộp báo giá không cảnh báo khi không dùng thử", () => {
    render(
      <CheckoutQuoteDialog isOpen onClose={vi.fn()} quote={PURCHASE_QUOTE} onConfirm={vi.fn()} />
    );
    expect(screen.queryByTestId("quote-trial-warning")).toBeNull();
  });

  it("ProfilePage hiện nhãn Dùng thử và Dùng thử đến", () => {
    mockContexts(TRIAL_SUBSCRIPTION);

    render(
      <MemoryRouter>
        <ProfilePage />
      </MemoryRouter>
    );

    expect(screen.getByText("Dùng thử")).toBeInTheDocument();
    expect(screen.getByText("Dùng thử đến")).toBeInTheDocument();
    expect(screen.getByText("24/10/2026")).toBeInTheDocument();
    expect(screen.getByText("Lượt tạo lịch trình tháng này")).toBeInTheDocument();
  });
});
