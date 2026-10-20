import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import UpgradeHint from "../src/components/subscription/UpgradeHint";
import { getPerDaySaving, getUpgradeOptions } from "../src/utils/subscriptionUtils";

const state = vi.hoisted(() => ({ auth: {}, plan: {} }));
vi.mock("../src/context/AuthContext", () => ({ useAuth: () => state.auth }));
vi.mock("../src/context/SubscriptionContext", () => ({ useSubscription: () => state.plan }));

const FREE = { code: "Free", name: "Miễn phí", price: 0, durationDays: null, generateLimit: 1, savedTripLimit: 1, aiDailyCallLimit: 3 };
const WEEK = { code: "TripPass", name: "Gói Tuần", price: 19000, durationDays: 7, generateLimit: null, savedTripLimit: 3, aiDailyCallLimit: 15 };
const MONTH = { code: "Membership", name: "Gói Tháng", price: 59000, durationDays: 30, generateLimit: null, savedTripLimit: null, aiDailyCallLimit: 30 };
const PLANS = [MONTH, FREE, WEEK];

const resetAt = "2026-11-01T00:00:00Z";
const freeSub = {
  plan: "Free",
  usage: { generateUsed: 1, generateLimit: 1, resetAt },
  savedTrips: { used: 1, limit: 1 },
  ai: { dailyUsed: 3, dailyLimit: 3, resetAt: "2026-10-19T17:00:00Z" },
};
const weekSub = {
  plan: "TripPass",
  effectiveUntil: "2026-10-25T00:00:00Z",
  usage: { generateUsed: 4, generateLimit: null, resetAt },
  savedTrips: { used: 3, limit: 3 },
  ai: { dailyUsed: 15, dailyLimit: 15, resetAt: "2026-10-19T17:00:00Z" },
};
const monthSub = { ...weekSub, plan: "Membership", savedTrips: { used: 9, limit: null }, ai: { dailyUsed: 30, dailyLimit: 30, resetAt: "2026-10-19T17:00:00Z" } };

function Location() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}

function setup(ui) {
  return render(
    <MemoryRouter initialEntries={["/create"]}>
      <Routes><Route path="*" element={<>{ui}<Location /></>} /></Routes>
    </MemoryRouter>
  );
}

const planNames = () => within(screen.getByRole("region")).queryAllByText(/^Gói (Tuần|Tháng)$/).map((n) => n.textContent);

beforeEach(() => {
  state.auth = { isLoggedIn: true, isDemo: false };
  state.plan = { subscription: freeSub, plans: PLANS };
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("getUpgradeOptions / getPerDaySaving", () => {
  it("Miễn phí thấy mọi gói trả phí, rẻ trước", () => {
    expect(getUpgradeOptions("generate", freeSub, PLANS).map((p) => p.code)).toEqual(["TripPass", "Membership"]);
  });

  it("chỉ giữ gói mở rộng đúng giới hạn đang chạm", () => {
    // Gói Tuần cũng chỉ lưu 3 lịch nên không mở thêm cho người đang dùng Gói Tuần
    expect(getUpgradeOptions("savedTrips", weekSub, PLANS).map((p) => p.code)).toEqual(["Membership"]);
    expect(getUpgradeOptions("ai", monthSub, PLANS)).toEqual([]);
  });

  it("AI null là chưa đặt riêng cho gói, không tính là rộng hơn", () => {
    const plans = [FREE, { ...WEEK, aiDailyCallLimit: null }, MONTH];
    expect(getUpgradeOptions("ai", freeSub, plans).map((p) => p.code)).toEqual(["Membership"]);
  });

  it("người đang dùng thử thấy cả gói mình đang thử", () => {
    const trial = { ...weekSub, isTrial: true, usage: { generateUsed: 1, generateLimit: 1, resetAt } };
    expect(getUpgradeOptions("generate", trial, PLANS).map((p) => p.code)).toEqual(["TripPass", "Membership"]);
  });

  it("% rẻ hơn mỗi ngày tính từ giá và số ngày, đổi theo dữ liệu", () => {
    expect(getPerDaySaving(MONTH, PLANS)).toEqual({ percent: 28, baseName: "Gói Tuần" });
    // Admin đổi Gói Tuần thành 8 ngày: 59.000/30 so với 19.000/8
    expect(getPerDaySaving(MONTH, [FREE, { ...WEEK, durationDays: 8 }, MONTH])).toEqual({ percent: 17, baseName: "Gói Tuần" });
    // Gói Tuần 10 ngày thì mỗi ngày đã rẻ hơn Gói Tháng: không hiện nhãn
    expect(getPerDaySaving(MONTH, [FREE, { ...WEEK, durationDays: 10 }, MONTH])).toBeNull();
    expect(getPerDaySaving(MONTH, [FREE, { ...WEEK, price: 13000 }, MONTH])).toBeNull();
    expect(getPerDaySaving(WEEK, PLANS)).toBeNull();
  });
});

describe("UpgradeHint card", () => {
  it("hết lượt tạo lịch: hai gói, quyền lợi đúng lý do đứng đầu và in đậm, có lựa chọn chờ", () => {
    setup(<UpgradeHint reason="generate" resetAt={resetAt} />);
    const card = screen.getByRole("region", { name: "Muốn tạo thêm phương án cho chuyến đi?" });
    expect(card).toHaveTextContent("Bạn đã dùng 1/1 lượt tạo lịch tháng này. Nâng cấp để mở thêm:");
    expect(planNames()).toEqual(["Gói Tuần", "Gói Tháng"]);
    const week = within(card).getByText("Gói Tuần").closest("li");
    const perks = within(week).getAllByRole("listitem").map((n) => n.textContent);
    expect(perks).toEqual(["Tạo lịch không giới hạn", "Lưu 3 lịch", "15 lượt AI mỗi ngày"]);
    expect(within(week).getByText("Tạo lịch không giới hạn")).toHaveClass("font-semibold");
    expect(within(card).getByText("Rẻ hơn 28% mỗi ngày so với Gói Tuần")).toBeInTheDocument();
    expect(card).toHaveTextContent("Hoặc chờ đến 01/11/2026 để có thêm 1 lịch miễn phí.");
  });

  it("hết lượt lưu: quyền lợi lưu lên đầu; người dùng Gói Tuần chỉ thấy Gói Tháng", () => {
    state.plan.subscription = weekSub;
    setup(<UpgradeHint reason="savedTrips" />);
    expect(planNames()).toEqual(["Gói Tháng"]);
    const perks = within(screen.getByText("Gói Tháng").closest("li")).getAllByRole("listitem").map((n) => n.textContent);
    expect(perks[0]).toBe("Lưu không giới hạn");
    expect(screen.getByRole("region")).toHaveTextContent("Bạn đã lưu 3/3 lịch của gói hiện tại.");
  });

  it("gói có AI chưa đặt thì bỏ dòng AI", () => {
    state.plan.plans = [FREE, { ...WEEK, aiDailyCallLimit: null }, MONTH];
    setup(<UpgradeHint reason="generate" />);
    const perks = within(screen.getByText("Gói Tuần").closest("li")).getAllByRole("listitem").map((n) => n.textContent);
    expect(perks).toEqual(["Tạo lịch không giới hạn", "Lưu 3 lịch"]);
  });

  it("nút Xem các gói mở trang Gói, nút phụ của trang vẫn hiện", () => {
    setup(<UpgradeHint reason="generate"><button type="button">Xem lịch trình mẫu</button></UpgradeHint>);
    expect(screen.getByRole("button", { name: "Xem lịch trình mẫu" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xem các gói" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/subscription");
  });

  it.each([
    ["phiên demo", { isLoggedIn: true, isDemo: true }],
    ["chưa đăng nhập", { isLoggedIn: false, isDemo: false }],
  ])("ẩn với %s", (_, auth) => {
    state.auth = auth;
    setup(<UpgradeHint reason="generate" />);
    expect(screen.queryByRole("region")).not.toBeInTheDocument();
  });
});

describe("UpgradeHint inline", () => {
  it("hết lượt AI: một dòng nói gói rẻ nhất mở thêm gì", () => {
    setup(<UpgradeHint reason="ai" variant="inline" />);
    expect(screen.getByText(/Gói Tuần có 15 lượt AI mỗi ngày\./)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Xem các gói" }));
    expect(screen.getByTestId("location")).toHaveTextContent("/subscription");
  });

  it("khung Muốn đổi gì?: tạo phương án mới không giới hạn", () => {
    setup(<UpgradeHint reason="generate" variant="inline" />);
    expect(screen.getByText(/Tạo phương án mới không giới hạn với Gói Tuần\./)).toBeInTheDocument();
  });

  it("Gói Tháng hết lượt AI: không hiện gì", () => {
    state.plan.subscription = monthSub;
    const { container } = setup(<UpgradeHint reason="ai" variant="inline" />);
    expect(container.querySelector("p")).toBeNull();
  });

  it("chưa tải được danh sách gói thì vẫn chỉ đường tới trang Gói", () => {
    state.plan.plans = undefined;
    setup(<UpgradeHint reason="savedTrips" variant="inline" />);
    expect(screen.getByText(/Nâng cấp gói để mở thêm\./)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Xem các gói" })).toBeInTheDocument();
  });
});
