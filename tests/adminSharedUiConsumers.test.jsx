import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminPlansPage from "../src/pages/admin/AdminPlansPage";
import AdminUsersPage from "../src/pages/admin/AdminUsersPage";
import AdminRolesPage from "../src/pages/admin/AdminRolesPage";
import FeedbackList from "../src/components/admin/feedback/FeedbackList";

const mocks = vi.hoisted(() => ({
  auth: { user: { id: "admin", permissions: ["ManageUsers", "ManagePlaces"] }, refreshProfile: vi.fn() },
  plans: { getPlans: vi.fn(), updatePlanStatus: vi.fn(), deletePlan: vi.fn() },
  users: { getUsers: vi.fn(), getFilterOptions: vi.fn() },
  roles: { getRoles: vi.fn(), getPermissions: vi.fn(), deleteRole: vi.fn() },
  feedback: { getReviews: vi.fn(), getTripFeedback: vi.fn() },
}));
vi.mock("../src/context/AuthContext", () => ({ useAuth: () => mocks.auth }));
vi.mock("../src/services/adminPlanService", () => ({ adminPlanService: mocks.plans }));
vi.mock("../src/services/adminUserService", () => ({ adminUserService: mocks.users }));
vi.mock("../src/services/adminRoleService", () => ({ adminRoleService: mocks.roles }));
vi.mock("../src/services/adminFeedbackService", () => ({ adminFeedbackService: mocks.feedback }));

const plan = { id: "pass", code: "TRIP_PASS", name: "Trip Pass", isActive: true, isSystem: true, entitlementPriority: 100, activeSubscriberCount: 0, currentVersion: { price: 19000, durationDays: 7, generateLimit: null, savedTripLimit: 3, versionNumber: 1 } };
const user = { id: "u1", fullName: "Người dùng thật", email: "u@example.test", status: "Active", role: { name: "User" }, plan: { name: "Free" }, canLock: false, canUnlock: false, createdAt: "2026-10-01T00:00:00Z" };
const review = { id: "r1", rating: 4, quickTags: [], comment: "Nội dung đánh giá nguyên bản", createdAt: "2026-10-01T00:00:00Z", user: { userId: "u1", fullName: "Người đánh giá", email: "r@example.test" }, place: { id: "p1", name: "Địa điểm thật", isVisible: true }, tripDeleted: false };
const paged = (items, page = 1) => ({ items, page, totalPages: 2, totalCount: 25 });
const mount = (element) => render(<MemoryRouter>{element}</MemoryRouter>);
beforeEach(() => {
  vi.clearAllMocks();
  mocks.auth.user = { id: "admin", permissions: ["ManageUsers", "ManagePlaces"] };
  mocks.plans.getPlans.mockImplementation(async (query) => paged([plan], query.page));
  mocks.users.getUsers.mockImplementation(async (query) => paged([user], query.page));
  mocks.users.getFilterOptions.mockResolvedValue({ roles: [], plans: [] });
  mocks.roles.getRoles.mockResolvedValue([{ id: "role", name: "Custom Role", description: "Quyền hiện có", isSystem: false, userCount: 0, permissions: ["ManagePlaces"] }]);
  mocks.roles.getPermissions.mockResolvedValue([{ code: "ManagePlaces", name: "Quản lý địa điểm" }]);
  mocks.feedback.getReviews.mockImplementation(async (query) => paged([review], query.page));
  mocks.feedback.getTripFeedback.mockResolvedValue(paged([]));
});
afterEach(() => { vi.useRealTimers(); });

describe("A2 existing consumer compatibility", () => {
  it("Plans preserve price, old Generate/Saved semantics, sort and pagination", async () => {
    mount(<AdminPlansPage />);
    await within(screen.getByRole("table")).findByText("Trip Pass");
    expect(screen.getByRole("table")).toHaveTextContent("19.000đ");
    expect(within(screen.getByRole("table")).getByTitle("Lượt tạo AI")).toHaveTextContent("AI: ∞");
    expect(within(screen.getByRole("table")).getByTitle("Lượt lưu chuyến")).toHaveTextContent("Lưu: 3 chuyến");
    fireEvent.click(screen.getByRole("button", { name: "Sắp xếp theo Tên gói" }));
    await waitFor(() => expect(mocks.plans.getPlans.mock.lastCall[0]).toMatchObject({ sortBy: "name", sortDirection: "asc", page: 1, pageSize: 10 }));
    fireEvent.click(screen.getByRole("button", { name: "Sau" }));
    await waitFor(() => expect(mocks.plans.getPlans.mock.lastCall[0].page).toBe(2));
  });
  it("Plan confirmation opens and cancels without a mutation", async () => {
    mount(<AdminPlansPage />);
    await within(screen.getByRole("table")).findByText("Trip Pass");
    fireEvent.click(within(screen.getByRole("table")).getByRole("button", { name: "Tạm dừng gói", exact: true }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: "Hủy bỏ" })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: "Escape" });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(mocks.plans.updatePlanStatus).not.toHaveBeenCalled();
    expect(mocks.plans.deletePlan).not.toHaveBeenCalled();
  });
  it("Users preserve links, action eligibility and immediate status filter", async () => {
    mount(<AdminUsersPage />);
    expect(await screen.findByRole("link", { name: /Người dùng thật/ })).toHaveAttribute("href", "/admin/users/u1");
    expect(screen.queryByRole("button", { name: /Khoá/ })).not.toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "Lọc theo trạng thái" }), { target: { value: "Locked" } });
    await waitFor(() => expect(mocks.users.getUsers.mock.lastCall[0]).toMatchObject({ status: "Locked", page: 1, pageSize: 20 }));
    fireEvent.click(screen.getByRole("button", { name: "Sau" }));
    await waitFor(() => expect(mocks.users.getUsers.mock.lastCall[0].page).toBe(2));
  });
  it("Roles preserve permissions and destructive confirmation ownership", async () => {
    mount(<AdminRolesPage />);
    await screen.findByText("Custom Role");
    expect(screen.getByText("Quản lý địa điểm")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Xoá/ }));
    expect(screen.getByRole("dialog", { name: "Xoá role" })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(mocks.roles.deleteRole).not.toHaveBeenCalled();
  });
  it("Feedback restricted domain links stay restricted; sorting/filtering unchanged", async () => {
    mocks.auth.user.permissions = [];
    mount(<FeedbackList kind="reviews" />);
    await screen.findByText(review.comment);
    expect(screen.queryByRole("link", { name: "Người đánh giá" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Địa điểm thật" })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Sắp xếp theo Số sao" }));
    await waitFor(() => expect(mocks.feedback.getReviews.mock.lastCall[0].sortBy).toBe("rating"));
    fireEvent.change(screen.getByRole("combobox", { name: "Lọc theo số sao" }), { target: { value: "5" } });
    await waitFor(() => expect(mocks.feedback.getReviews.mock.lastCall[0]).toMatchObject({ rating: "5", page: 1 }));
  });
  it("Feedback retains invalid date validation and suppresses invalid fetch", async () => {
    mount(<FeedbackList kind="reviews" />);
    await screen.findByText(review.comment);
    fireEvent.change(screen.getByLabelText("Gửi từ ngày"), { target: { value: "2026-10-07" } });
    await waitFor(() => expect(mocks.feedback.getReviews.mock.lastCall[0].from).toBe("2026-10-07"));
    const count = mocks.feedback.getReviews.mock.calls.length;
    fireEvent.change(screen.getByLabelText("Gửi đến ngày"), { target: { value: "2026-10-01" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Ngày bắt đầu không được sau ngày kết thúc.");
    expect(mocks.feedback.getReviews).toHaveBeenCalledTimes(count);
  });
  it.each([
    ["Plans", 300, () => <AdminPlansPage />, () => mocks.plans.getPlans],
    ["Users", 350, () => <AdminUsersPage />, () => mocks.users.getUsers],
    ["Feedback", 350, () => <FeedbackList kind="reviews" />, () => mocks.feedback.getReviews],
  ])("%s search keeps caller-owned %i ms debounce", async (_, delay, element, service) => {
    vi.useFakeTimers();
    mount(element());
    await act(async () => {});
    service().mockClear();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "từ khóa mới" } });
    await act(async () => { vi.advanceTimersByTime(delay - 1); });
    expect(service()).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(1); });
    expect(service().mock.lastCall[0].search).toBe("từ khóa mới");
  });
});
