import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import PlanStatusChip from "../src/components/layout/PlanStatusChip";

const state = vi.hoisted(() => ({ auth: {}, plan: {} }));
vi.mock("../src/context/AuthContext", () => ({ useAuth: () => state.auth }));
vi.mock("../src/context/SubscriptionContext", () => ({ useSubscription: () => state.plan }));

// 10:00 ngày 19/10/2026 giờ VN
const NOW = new Date("2026-10-19T03:00:00Z");
const PLANS = [
  { code: "Free", name: "Miễn phí" },
  { code: "TripPass", name: "Gói Tuần" },
];
const inDays = (days) => new Date(NOW.getTime() + days * 24 * 60 * 60 * 1000).toISOString();

function Location() {
  return <span data-testid="location">{useLocation().pathname}</span>;
}

function setup(path = "/trips") {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <Routes><Route path="*" element={<><PlanStatusChip /><Location /></>} /></Routes>
    </MemoryRouter>
  );
}

const chip = () => screen.getByRole("button", { name: /^Gói hiện tại:/ });

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  state.auth = { isLoggedIn: true, isDemo: false };
  state.plan = { subscription: null, subscriptionLoading: false, plans: PLANS };
});

afterEach(() => {
  vi.useRealTimers();
});

describe("PlanStatusChip", () => {
  it("Miễn phí còn lượt: tên gói từ API, số lịch còn lại", () => {
    state.plan.subscription = { plan: "Free", planName: "Miễn phí", usage: { generateUsed: 0, generateLimit: 1, resetAt: inDays(12) } };
    setup();
    expect(chip()).toHaveAccessibleName("Gói hiện tại: Miễn phí · còn 1/1 lịch. Mở trang gói dịch vụ.");
    expect(chip()).toHaveClass("bg-surface-container-low");
    expect(screen.getByText("1/1 lịch")).toBeInTheDocument();
  });

  it("Miễn phí hết lượt: màu cảnh báo", () => {
    state.plan.subscription = { plan: "Free", planName: "Miễn phí", usage: { generateUsed: 1, generateLimit: 1, resetAt: inDays(12) } };
    setup();
    expect(chip()).toHaveAccessibleName("Gói hiện tại: Miễn phí · hết lượt tháng này. Mở trang gói dịch vụ.");
    expect(chip()).toHaveClass("bg-amber-50");
    expect(screen.getByText("Hết lượt")).toBeInTheDocument();
  });

  it("đã qua mốc làm mới lượt thì coi như còn đủ lượt", () => {
    state.plan.subscription = { plan: "Free", planName: "Miễn phí", usage: { generateUsed: 1, generateLimit: 1, resetAt: inDays(-1) } };
    setup();
    expect(chip()).toHaveAccessibleName("Gói hiện tại: Miễn phí · còn 1/1 lịch. Mở trang gói dịch vụ.");
  });

  it("gói trả phí: số ngày còn lại làm tròn lên", () => {
    state.plan.subscription = { plan: "TripPass", planName: "Gói Tuần", effectiveUntil: inDays(4.2), usage: { generateUsed: 3, generateLimit: null } };
    setup();
    expect(chip()).toHaveAccessibleName("Gói hiện tại: Gói Tuần · còn 5 ngày. Mở trang gói dịch vụ.");
    expect(chip()).toHaveClass("bg-blue-50");
    expect(screen.getByText("5 ngày")).toBeInTheDocument();
  });

  it.each([[2, "2 ngày"], [0.5, "1 ngày"]])("gói trả phí còn %s ngày: màu cảnh báo", (days, short) => {
    state.plan.subscription = { plan: "TripPass", planName: "Gói Tuần", effectiveUntil: inDays(days) };
    setup();
    expect(chip()).toHaveClass("bg-amber-50");
    expect(screen.getByText(short)).toBeInTheDocument();
  });

  it("dùng thử: ghi rõ dùng thử, màu như gói trả phí", () => {
    state.plan.subscription = { plan: "TripPass", planName: "Gói Tuần", isTrial: true, effectiveUntil: inDays(3) };
    setup();
    expect(chip()).toHaveAccessibleName("Gói hiện tại: Dùng thử Gói Tuần · còn 3 ngày. Mở trang gói dịch vụ.");
    expect(chip()).toHaveClass("bg-blue-50");
  });

  it("thiếu planName thì lấy tên trong danh sách gói", () => {
    state.plan.subscription = { plan: "TripPass", effectiveUntil: inDays(5) };
    setup();
    expect(chip()).toHaveAccessibleName("Gói hiện tại: Gói Tuần · còn 5 ngày. Mở trang gói dịch vụ.");
  });

  it("đang tải: khung xám, không có nút", () => {
    state.plan.subscriptionLoading = true;
    setup();
    expect(screen.getByTestId("plan-chip-loading")).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it.each([
    ["chưa đăng nhập", { isLoggedIn: false, isDemo: false }],
    ["phiên demo", { isLoggedIn: true, isDemo: true }],
  ])("ẩn khi %s", (_, auth) => {
    state.auth = auth;
    state.plan.subscription = { plan: "Free", planName: "Miễn phí", usage: { generateUsed: 0, generateLimit: 1 } };
    setup();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("ẩn ở trang Gói", () => {
    state.plan.subscription = { plan: "Free", planName: "Miễn phí", usage: { generateUsed: 0, generateLimit: 1 } };
    setup("/subscription");
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("bấm thì mở trang Gói", () => {
    state.plan.subscription = { plan: "Free", planName: "Miễn phí", usage: { generateUsed: 0, generateLimit: 1 } };
    setup();
    fireEvent.click(chip());
    expect(screen.getByTestId("location")).toHaveTextContent("/subscription");
  });
});
