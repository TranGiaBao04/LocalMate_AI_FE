import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import AdminPlansPage from "../src/pages/admin/AdminPlansPage";
import PlanFormModal from "../src/components/admin/plans/PlanFormModal";
import PlanVersionHistoryModal from "../src/components/admin/plans/PlanVersionHistoryModal";
import { adminPlanService } from "../src/services/adminPlanService";

vi.mock("../src/services/adminPlanService", () => ({ adminPlanService: {
  getPlans: vi.fn(), getFeatures: vi.fn(), getPlanVersions: vi.fn(),
  createPlan: vi.fn(), updatePlan: vi.fn(), updatePlanStatus: vi.fn(), deletePlan: vi.fn(),
}}));
const plan = { id: "pass", code: "TRIP_PASS", name: "Trip Pass", isActive: true, isSystem: true, entitlementPriority: 100, activeSubscriberCount: 4,
  currentVersion: { versionNumber: 7, price: 19000, durationDays: 7, generateLimit: null, savedTripLimit: 3, features: [], aiDailyCallLimit: 0, aiExplainCallsPerTripLimit: null } };
const result = items => ({ items, page: 1, totalPages: 2, totalCount: 21 });
const desktop = () => within(screen.getByRole("table"));
const mobile = () => within(screen.getByLabelText("Danh sách gói trên di động"));
async function list(items = [plan]) {
  adminPlanService.getPlans.mockResolvedValue(result(items));
  render(<AdminPlansPage />);
  if (items.length) await desktop().findByText(items[0].name);
  else await waitFor(() => expect(screen.getAllByText("Chưa có gói dịch vụ nào phù hợp")).toHaveLength(2));
}
function form(mode = "create", value = plan, onClose = vi.fn()) {
  render(<PlanFormModal isOpen mode={mode} plan={value} onClose={onClose} onSuccess={vi.fn()} />);
  return onClose;
}
beforeEach(() => {
  vi.clearAllMocks();
  adminPlanService.getFeatures.mockResolvedValue([]);
  adminPlanService.getPlans.mockResolvedValue(result([plan]));
  adminPlanService.createPlan.mockResolvedValue(plan);
  adminPlanService.updatePlan.mockResolvedValue(plan);
  adminPlanService.updatePlanStatus.mockResolvedValue(plan);
  adminPlanService.deletePlan.mockResolvedValue({});
});
afterEach(() => vi.useRealTimers());

describe("A5 Plans preservation and responsive interactions", () => {
  it("keeps server order and initial query", async () => {
    await list([plan, { ...plan, id: "b", name: "Second", code: "B" }]);
    expect(desktop().getAllByRole("row").slice(1).map(row => row.textContent)).toEqual([expect.stringContaining("Trip Pass"), expect.stringContaining("Second")]);
    expect(adminPlanService.getPlans.mock.calls[0][0]).toEqual({ page: 1, pageSize: 10, search: "", sortBy: "entitlementPriority", sortDirection: "asc" });
  });
  it("desktop and mobile share one fetch and exact current version", async () => {
    await list();
    expect(adminPlanService.getPlans).toHaveBeenCalledTimes(1);
    expect(desktop().getByText(/Ưu tiên:/).textContent).toContain("v7");
    expect(mobile().getByText(/TRIP_PASS/)).toHaveTextContent("v7");
    expect(mobile().getByText("19.000đ")).toBeInTheDocument();
  });
  it("keeps active and inactive textual lifecycle", async () => {
    await list([plan, { ...plan, id: "off", name: "Inactive", isActive: false }]);
    expect(desktop().getByText("Hoạt động")).toBeInTheDocument();
    expect(desktop().getByText("Tạm dừng")).toBeInTheDocument();
  });
  it("Free remains protected from deactivation/deletion", async () => {
    await list([{ ...plan, code: "FREE", name: "Free" }]);
    expect(desktop().getByRole("button", { name: "Tạm dừng gói" })).toBeDisabled();
    expect(desktop().queryByRole("button", { name: "Xóa gói" })).not.toBeInTheDocument();
  });
  it("only unpublished custom plan exposes deletion", async () => {
    await list([{ ...plan, isSystem: false, currentVersion: null }]);
    fireEvent.click(desktop().getByRole("button", { name: "Xóa gói" }));
    fireEvent.click(screen.getByRole("button", { name: "Hủy bỏ" }));
    expect(adminPlanService.deletePlan).not.toHaveBeenCalled();
  });
  it("published custom plan cannot offer deletion", async () => {
    await list([{ ...plan, isSystem: false }]);
    expect(desktop().queryByRole("button", { name: "Xóa gói" })).not.toBeInTheDocument();
  });
  it.each([true, false])("activation uses unchanged callback with target opposite %s", async active => {
    await list([{ ...plan, isActive: active }]);
    fireEvent.click(desktop().getByRole("button", { name: active ? "Tạm dừng gói" : "Kích hoạt gói" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: active ? "Tạm dừng gói" : "Kích hoạt gói" }));
    await waitFor(() => expect(adminPlanService.updatePlanStatus).toHaveBeenCalledWith("pass", !active));
  });
  it("sort announces direction and resets server page", async () => {
    await list();
    fireEvent.click(desktop().getByRole("button", { name: "Sắp xếp theo Tên gói" }));
    await waitFor(() => expect(adminPlanService.getPlans.mock.lastCall[0]).toMatchObject({ sortBy: "name", sortDirection: "asc", page: 1 }));
    expect(desktop().getByRole("columnheader", { name: /Tên gói/ })).toHaveAttribute("aria-sort", "ascending");
  });
  it("boolean filters retain server contract and reset", async () => {
    await list();
    fireEvent.change(screen.getByLabelText("Lọc theo loại gói"), { target: { value: "false" } });
    fireEvent.change(screen.getByLabelText("Lọc theo trạng thái"), { target: { value: "true" } });
    await waitFor(() => expect(adminPlanService.getPlans.mock.lastCall[0]).toMatchObject({ isSystem: false, isActive: true, page: 1 }));
    fireEvent.click(screen.getByRole("button", { name: "Xóa lọc" }));
    await waitFor(() => expect(adminPlanService.getPlans.mock.lastCall[0]).not.toHaveProperty("isSystem"));
  });
  it("loading remains distinct from error and empty", async () => {
    adminPlanService.getPlans.mockReturnValue(new Promise(() => {}));
    render(<AdminPlansPage />);
    expect(screen.queryByText("Chưa có gói dịch vụ nào phù hợp")).not.toBeInTheDocument();
    expect(screen.getAllByRole("status").length).toBeGreaterThan(0);
  });
  it("error is an accessible retry state, not empty data", async () => {
    adminPlanService.getPlans.mockRejectedValue(new Error("Plan read failed"));
    render(<AdminPlansPage />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Plan read failed");
    expect(screen.queryByText("Chưa có gói dịch vụ nào phù hợp")).not.toBeInTheDocument();
  });
  it("empty list is not an error", async () => {
    await list([]);
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(mobile().getByText("Chưa có gói dịch vụ nào phù hợp")).toBeInTheDocument();
  });
  it("create sends original fields only, without AI metadata", async () => {
    form();
    fireEvent.change(screen.getByLabelText("Mã gói (Code)"), { target: { value: "custom" } });
    fireEvent.change(screen.getByLabelText("Tên hiển thị gói"), { target: { value: " Custom Plan " } });
    fireEvent.click(screen.getByRole("button", { name: "Tạo gói dịch vụ", exact: true }));
    await waitFor(() => expect(adminPlanService.createPlan).toHaveBeenCalledExactlyOnceWith({ code: "CUSTOM", name: "Custom Plan", entitlementPriority: 10, price: 50000, durationDays: 30, generateLimit: 10, savedTripLimit: 5, featureIds: [] }));
  });
  it("edit sends original version terms, not immutable identity or AI fields", async () => {
    form("edit");
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật gói" }));
    await waitFor(() => expect(adminPlanService.updatePlan).toHaveBeenCalledExactlyOnceWith("pass", { name: "Trip Pass", price: 19000, durationDays: 7, generateLimit: null, savedTripLimit: 3, featureIds: [] }));
    expect(screen.queryByLabelText(/AiDaily/)).not.toBeInTheDocument();
  });
  it("Free keeps price0 and durationNULL", async () => {
    form("edit", { ...plan, code: "FREE" });
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật gói" }));
    await waitFor(() => expect(adminPlanService.updatePlan.mock.lastCall[1]).toMatchObject({ price: 0, durationDays: null }));
  });
  it("zero Generate/Saved stays zero, not unlimited", async () => {
    form("edit", { ...plan, currentVersion: { ...plan.currentVersion, generateLimit: 0, savedTripLimit: 0 } });
    expect(screen.getByLabelText("Lượt tạo AI (Generate Limit)")).toHaveValue(0);
    expect(screen.getByLabelText("Lượt lưu chuyến (Saved Trip Limit)")).toHaveValue(0);
    expect(screen.getAllByRole("checkbox").every(input => !input.checked)).toBe(true);
  });
  it("invalid numeric and required input does not submit", async () => {
    form();
    fireEvent.submit(screen.getByLabelText("Tên hiển thị gói").closest("form"));
    expect(adminPlanService.createPlan).not.toHaveBeenCalled();
    expect(screen.getByText("Tên gói không được để trống.")).toBeInTheDocument();
  });
  it("existing invalid_plan_data remains visible without adding AI fields", async () => {
    adminPlanService.updatePlan.mockRejectedValue({ code: "invalid_plan_data", message: "AI terms required", errors: { AiDailyCallLimit: ["Required"] } });
    form("edit");
    fireEvent.click(screen.getByRole("button", { name: "Cập nhật gói" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("AI terms required");
    expect(screen.queryByLabelText(/daily/i)).not.toBeInTheDocument();
  });
  it("mobile edit action is keyboard-focusable and enters shared dialog", async () => {
    await list();
    const edit = mobile().getByRole("button", { name: "Chỉnh sửa gói" });
    edit.focus();
    expect(edit).toHaveFocus();
    fireEvent.click(edit);
    expect(screen.getByRole("dialog", { name: /Chỉnh sửa gói/ })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(edit).toHaveFocus();
  });
  it("form traps focus and returns to the initiating action", async () => {
    await list();
    const trigger = screen.getByRole("button", { name: /Tạo gói mới/ });
    trigger.focus(); fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog");
    const first = within(dialog).getByLabelText("Mã gói (Code)");
    expect(first).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(within(dialog).getByRole("button", { name: "Tạo gói dịch vụ" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveFocus();
  });
  it("history retains server ordering, current identity and exact snapshots", async () => {
    adminPlanService.getPlanVersions.mockResolvedValue(result([
      { id: "old", versionNumber: 2, price: 10000, durationDays: 5, generateLimit: 0, savedTripLimit: null, isCurrent: false, aiDailyCallLimit: null },
      { id: "current", versionNumber: 7, price: 19000, durationDays: 7, generateLimit: null, savedTripLimit: 3, isCurrent: true, aiDailyCallLimit: 0 },
    ]));
    render(<PlanVersionHistoryModal isOpen plan={plan} onClose={vi.fn()} />);
    const history = await screen.findByRole("list", { name: "Lịch sử phiên bản" });
    const records = within(history).getAllByRole("listitem");
    expect(records[0]).toHaveTextContent("v2");
    expect(records[0]).toHaveTextContent("0 lượt");
    expect(records[1]).toHaveTextContent("v7");
    expect(records[1]).toHaveTextContent("Phiên bản hiện tại");
    expect(adminPlanService.getPlanVersions).toHaveBeenCalledExactlyOnceWith("pass", { page: 1, pageSize: 10 });
    expect(screen.queryByText(/LLM|Explain|hàng ngày/)).not.toBeInTheDocument();
  });
  it("300ms search debounce remains unchanged", async () => {
    vi.useFakeTimers();
    render(<AdminPlansPage />); await act(async () => {});
    adminPlanService.getPlans.mockClear();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "paid" } });
    await act(async () => vi.advanceTimersByTime(299));
    expect(adminPlanService.getPlans).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(1));
    expect(adminPlanService.getPlans.mock.lastCall[0].search).toBe("paid");
  });
  it("mobile empty action preserves create form entry point", async () => {
    await list([]);
    fireEvent.click(mobile().getByRole("button", { name: "Tạo gói mới" }));
    expect(screen.getByRole("dialog", { name: "Tạo gói dịch vụ mới" })).toBeInTheDocument();
    expect(adminPlanService.createPlan).not.toHaveBeenCalled();
  });
});
