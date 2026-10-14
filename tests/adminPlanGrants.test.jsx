import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminUserDetailPage from "../src/pages/admin/AdminUserDetailPage";
import AdminUsersPage from "../src/pages/admin/AdminUsersPage";
import { getGrantState } from "../src/components/admin/users/userLabels";
import { ApiError } from "../src/api/apiClient";
import { formatVnDateTime } from "../src/utils/subscriptionUtils";

const mocks = vi.hoisted(() => ({
  auth: { user: null },
  users: {
    getUser: vi.fn(), getUserPayments: vi.fn(), getUserTrips: vi.fn(), lockUser: vi.fn(), unlockUser: vi.fn(),
    getGrants: vi.fn(), grantPlan: vi.fn(), getUsers: vi.fn(), getFilterOptions: vi.fn(),
  },
  plans: { getPlans: vi.fn() },
}));
vi.mock("../src/context/AuthContext", () => ({ useAuth: () => mocks.auth }));
vi.mock("../src/services/adminUserService", () => ({ adminUserService: mocks.users }));
vi.mock("../src/services/adminPlanService", () => ({ adminPlanService: mocks.plans }));

const PLAN_ITEMS = [
  { id: "plan-free", code: "FREE", name: "Free", isActive: true, currentVersion: { id: "v0" } },
  { id: "plan-trip", code: "TRIP_PASS", name: "Trip Pass", isActive: true, currentVersion: { id: "v1" } },
  { id: "plan-member", code: "MEMBERSHIP", name: "Membership", isActive: true, currentVersion: { id: "v2" } },
  { id: "plan-off", code: "OLD", name: "Gói cũ", isActive: false, currentVersion: { id: "v3" } },
  { id: "plan-draft", code: "DRAFT", name: "Gói chưa có phiên bản", isActive: true, currentVersion: null },
];

const GRANT_RESULT = {
  grantId: "g-new", userId: "u1", plan: { code: "TripPass", name: "Trip Pass" }, days: 7,
  startsAt: "2026-10-21T03:42:03Z", endsAt: "2026-10-28T03:42:03Z", source: "Admin",
  reason: "Tặng ra mắt", grantedBy: { userId: "admin", fullName: "LocalMate Admin" }, createdAt: "2026-10-14T03:42:03Z",
};

const userDetail = (overrides = {}) => ({
  id: "u1", fullName: "Người dùng 1", email: "u1@example.invalid", status: "Active", stats: {},
  role: { name: "User" }, subscription: null, canLock: false, canUnlock: false, ...overrides,
});

const view = () => (
  <MemoryRouter initialEntries={["/admin/users/u1"]}>
    <Routes><Route path="/admin/users/:userId" element={<AdminUserDetailPage />} /></Routes>
  </MemoryRouter>
);

async function mount() {
  render(view());
  await screen.findByRole("heading", { name: "Người dùng 1" });
}

async function openDialogAndFill({ plan = "plan-trip", days = "7", reason = "  Tặng ra mắt  " } = {}) {
  fireEvent.click(screen.getByRole("button", { name: /Tặng gói/ }));
  const dialog = await screen.findByRole("dialog", { name: "Tặng gói" });
  await waitFor(() => expect(within(dialog).getByRole("option", { name: "Trip Pass" })).toBeInTheDocument());
  fireEvent.change(within(dialog).getByLabelText("Gói *"), { target: { value: plan } });
  fireEvent.change(within(dialog).getByLabelText("Số ngày *"), { target: { value: days } });
  fireEvent.change(within(dialog).getByLabelText("Lý do *"), { target: { value: reason } });
  return dialog;
}

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.user = { id: "admin", permissions: ["ManageUsers", "ManagePlans"] };
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected live network request"); }));
  mocks.users.getUser.mockResolvedValue(userDetail());
  mocks.users.getUserPayments.mockResolvedValue({ items: [], page: 1, totalPages: 0, totalCount: 0 });
  mocks.users.getUserTrips.mockResolvedValue({ items: [], page: 1, totalPages: 0, totalCount: 0 });
  mocks.users.getGrants.mockResolvedValue([]);
  mocks.plans.getPlans.mockResolvedValue({ items: PLAN_ITEMS, page: 1, totalPages: 1, totalCount: PLAN_ITEMS.length });
});

afterEach(() => {
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("Admin tặng gói", () => {
  it("chỉ có ManageUsers thì không thấy nút và tab Tặng gói, không gọi getGrants", async () => {
    mocks.auth.user.permissions = ["ManageUsers"];
    await mount();
    expect(screen.queryByRole("button", { name: /Tặng gói/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Tặng gói" })).not.toBeInTheDocument();
    expect(mocks.users.getGrants).not.toHaveBeenCalled();
  });

  it("user đang bị khoá thì nút Tặng gói bị khoá", async () => {
    mocks.users.getUser.mockResolvedValue(userDetail({ status: "Locked" }));
    await mount();
    expect(screen.getByRole("button", { name: /Tặng gói/ })).toBeDisabled();
  });

  it("dialog chỉ liệt kê gói trả phí đang bật, có phiên bản hiện hành", async () => {
    await mount();
    fireEvent.click(screen.getByRole("button", { name: /Tặng gói/ }));
    const dialog = await screen.findByRole("dialog", { name: "Tặng gói" });
    await within(dialog).findByRole("option", { name: "Trip Pass" });
    expect(mocks.plans.getPlans).toHaveBeenCalledWith({ isActive: true, pageSize: 100 });
    const names = within(dialog).getAllByRole("option").map((option) => option.textContent);
    expect(names).toEqual(["Chọn gói", "Trip Pass", "Membership"]);
  });

  it("tặng qua bước xác nhận, báo ngày hiệu lực, mở tab Tặng gói và tải lại lịch sử", async () => {
    mocks.users.grantPlan.mockResolvedValue(GRANT_RESULT);
    await mount();
    const dialog = await openDialogAndFill();

    fireEvent.click(within(dialog).getByRole("button", { name: "Tiếp tục" }));
    const confirm = await screen.findByRole("dialog", { name: "Xác nhận tặng gói" });
    expect(within(confirm).getByText(/không thu hồi được/)).toBeInTheDocument();
    expect(mocks.users.grantPlan).not.toHaveBeenCalled();

    fireEvent.click(within(confirm).getByRole("button", { name: "Xác nhận tặng" }));
    await waitFor(() => expect(mocks.users.grantPlan).toHaveBeenCalledExactlyOnceWith("u1", { planId: "plan-trip", days: 7, reason: "Tặng ra mắt" }));

    expect(await screen.findByText(`Đã tặng Trip Pass, có hiệu lực từ ${formatVnDateTime(GRANT_RESULT.startsAt)} đến ${formatVnDateTime(GRANT_RESULT.endsAt)}.`)).toBeInTheDocument();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Tặng gói" })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(mocks.users.getGrants).toHaveBeenCalledWith("u1"));
    expect(mocks.users.getUser).toHaveBeenCalledTimes(2);
  });

  it("400 invalid_grant: hiện lỗi dưới ô và quay lại form", async () => {
    mocks.users.grantPlan.mockRejectedValue(new ApiError("x", 400, "invalid_grant", { Days: ["Số ngày phải từ 1 đến 90."] }));
    await mount();
    const dialog = await openDialogAndFill();
    fireEvent.click(within(dialog).getByRole("button", { name: "Tiếp tục" }));
    fireEvent.click(await screen.findByRole("button", { name: "Xác nhận tặng" }));

    const form = await screen.findByRole("dialog", { name: "Tặng gói" });
    expect(await within(form).findByText("Số ngày phải từ 1 đến 90.")).toBeInTheDocument();
  });

  it("409 user_locked: hiện câu tiếng Việt", async () => {
    mocks.users.grantPlan.mockRejectedValue(new ApiError("Conflict", 409, "user_locked"));
    await mount();
    const dialog = await openDialogAndFill();
    fireEvent.click(within(dialog).getByRole("button", { name: "Tiếp tục" }));
    fireEvent.click(await screen.findByRole("button", { name: "Xác nhận tặng" }));
    expect(await screen.findByText("Không thể tặng gói cho tài khoản đang bị khoá.")).toBeInTheDocument();
  });

  it("chưa điền lý do hoặc số ngày ngoài 1–90 thì không bấm Tiếp tục được", async () => {
    await mount();
    let dialog = await openDialogAndFill({ reason: "   " });
    expect(within(dialog).getByRole("button", { name: "Tiếp tục" })).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Lý do *"), { target: { value: "Có lý do" } });
    fireEvent.change(within(dialog).getByLabelText("Số ngày *"), { target: { value: "91" } });
    dialog = screen.getByRole("dialog", { name: "Tặng gói" });
    expect(within(dialog).getByText("Số ngày phải từ 1 đến 90.")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Tiếp tục" })).toBeDisabled();
  });

  it("tab lịch sử: dòng dùng thử khi đăng ký hiện nguồn đúng và dấu — cho lý do, người tặng", async () => {
    mocks.users.getGrants.mockResolvedValue([
      { ...GRANT_RESULT, grantId: "g-trial", source: "SignupTrial", reason: null, grantedBy: null },
    ]);
    await mount();
    fireEvent.click(screen.getByRole("tab", { name: "Tặng gói" }));
    const table = await screen.findByRole("table");
    const row = (await within(table).findByText("Dùng thử khi đăng ký")).closest("tr");
    expect(within(row).getAllByText("—")).toHaveLength(2);
  });

  it("khối gói hiện tại ghi Dùng thử khi subscription.isTrial", async () => {
    mocks.users.getUser.mockResolvedValue(userDetail({
      subscription: { plan: "TripPass", endsAt: null, effectiveUntil: "2026-10-24T03:42:03Z", isTrial: true },
    }));
    await mount();
    expect(screen.getByText("· Dùng thử")).toBeInTheDocument();
    expect(screen.getByText("Dùng thử đến")).toBeInTheDocument();
  });
});

describe("getGrantState", () => {
  const grant = { startsAt: "2026-10-21T00:00:00Z", endsAt: "2026-10-28T00:00:00Z" };
  it.each([
    ["2026-10-20T00:00:00Z", "Chưa bắt đầu"],
    ["2026-10-21T00:00:00Z", "Đang hiệu lực"],
    ["2026-10-28T00:00:00Z", "Đã hết"],
  ])("lúc %s là %s", (now, label) => {
    expect(getGrantState(grant, new Date(now).getTime()).label).toBe(label);
  });
});

describe("Danh sách user", () => {
  it("dòng có planIsTrial hiện · Dùng thử", async () => {
    mocks.users.getFilterOptions.mockResolvedValue({ roles: [], plans: [] });
    mocks.users.getUsers.mockResolvedValue({
      items: [{
        id: "u1", fullName: "Người dùng 1", email: "u1@example.invalid", role: { id: "r", name: "User" },
        status: "Active", lockedAt: null, plan: { code: "TripPass", name: "Trip Pass" },
        planEffectiveUntil: "2026-10-24T03:42:03Z", planIsTrial: true, createdAt: "2026-10-07T15:52:35Z",
        managesRoles: false, canLock: false, canUnlock: false,
      }],
      page: 1, pageSize: 20, totalPages: 1, totalCount: 1,
    });
    render(<MemoryRouter><AdminUsersPage /></MemoryRouter>);
    const table = await screen.findByRole("table");
    expect(await within(table).findByText("· Dùng thử")).toBeInTheDocument();
  });
});
