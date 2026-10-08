import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import AdminTransactionsPage from "../src/pages/admin/AdminTransactionsPage";
import { adminTransactionService } from "../src/services/adminTransactionService";
import { downloadBlob } from "../src/utils/exportFiles";
import { formatVnDateTime } from "../src/utils/subscriptionUtils";
vi.mock("../src/services/adminTransactionService", () => ({ adminTransactionService: { getTransactions: vi.fn(), getSummary: vi.fn(), getTransactionDetail: vi.fn(), exportTransactions: vi.fn(), reconcileTransaction: vi.fn(), repairEntitlement: vi.fn() } }));
vi.mock("../src/utils/exportFiles", () => ({ downloadBlob: vi.fn() }));
vi.mock("../src/context/AuthContext", () => ({ useAuth: () => ({ user: { permissions: ["ViewRevenue", "ManagePlans"] } }) }));
const row = { id: "order", providerOrderCode: 42, amount: 43000, creditAmount: 11000, listPrice: 97000, status: "Paid", operationType: "Upgrade", planCode: "CUSTOM", planName: "Purchased Plan", userEmail: "user@example.test", createdAt: "2026-10-01T00:00:00Z", paidAt: "2026-10-02T00:00:00Z" };
const detail = { transaction: row, statusHistory: [{ id: "h", fromStatus: "Pending", toStatus: "Paid", occurredAt: row.paidAt, source: "Webhook", reasonCode: "server_verified" }], webhookReceipts: [], creditSources: [], repairHistory: [], repairEligibility: { eligible: false } };
async function mount() {
  render(<AdminTransactionsPage />);
  await screen.findByRole("button", { name: "Chi tiết giao dịch #42" });
}
const mobile = () => within(screen.getByLabelText("Danh sách giao dịch trên di động"));
beforeEach(() => {
  vi.clearAllMocks();
  adminTransactionService.getTransactions.mockResolvedValue({ items: [row], page: 1, totalPages: 3, totalCount: 44 });
  adminTransactionService.getSummary.mockResolvedValue({ grossRevenue: 123456, totalTransactions: 44, paidCount: 20, pendingCount: 10, failedCount: 2, expiredCount: 3, reviewRequiredCount: 9 });
  adminTransactionService.getTransactionDetail.mockResolvedValue(detail);
});
afterEach(() => vi.useRealTimers());
describe("A5 transaction responsive and overlay contract", () => {
  it("one controller fetch supplies desktop and mobile rows", async () => {
    await mount();
    expect(adminTransactionService.getTransactions).toHaveBeenCalledTimes(1);
    expect(adminTransactionService.getSummary).toHaveBeenCalledTimes(1);
    expect(within(screen.getByRole("table")).getByText("43.000đ")).toBeInTheDocument();
    expect(mobile().getByText("43.000đ")).toBeInTheDocument();
    expect(mobile().getByText("Purchased Plan")).toBeInTheDocument();
  });
  it("mobile amount never subtracts credit or infers list price", async () => {
    await mount();
    expect(mobile().getByText("43.000đ")).toBeInTheDocument();
    expect(mobile().getByText("Credit: 11.000đ")).toBeInTheDocument();
    expect(mobile().getByText("Giá gốc: 97.000đ")).toBeInTheDocument();
    expect(mobile().queryByText("32.000đ")).not.toBeInTheDocument();
  });
  it("mobile preserves CreatedAt and distinct PaidAt", async () => {
    await mount();
    expect(mobile().getByText(formatVnDateTime(row.createdAt))).toBeInTheDocument();
    expect(mobile().getByText(`Thanh toán: ${formatVnDateTime(row.paidAt)}`)).toBeInTheDocument();
  });
  it("mobile detail action opens same server drawer and restores focus", async () => {
    await mount();
    const trigger = mobile().getByRole("button", { name: "Chi tiết giao dịch #42" });
    trigger.focus(); fireEvent.click(trigger);
    await screen.findByText("Thông tin đơn hàng & Thanh toán");
    expect(adminTransactionService.getTransactionDetail).toHaveBeenCalledExactlyOnceWith("order");
    fireEvent.keyDown(document, { key: "Escape" });
    expect(trigger).toHaveFocus();
    expect(adminTransactionService.reconcileTransaction).not.toHaveBeenCalled();
  });
  it("history has meaningful list structure and exact server transition", async () => {
    await mount(); fireEvent.click(mobile().getByRole("button"));
    const history = await screen.findByRole("list", { name: "Lịch sử trạng thái" });
    expect(within(history).getAllByRole("listitem")).toHaveLength(1);
    expect(history).toHaveTextContent("server_verified");
    expect(history).toHaveTextContent("Webhook PayOS");
    expect(history).toHaveTextContent(formatVnDateTime(row.paidAt));
  });
  it("reconcile cancellation restores focus without posting", async () => {
    await mount(); fireEvent.click(mobile().getByRole("button"));
    const action = await screen.findByRole("button", { name: /Đối soát PayOS/ });
    action.focus(); fireEvent.click(action);
    const confirmation = screen.getByRole("dialog", { name: "Đối soát giao dịch với PayOS?" });
    expect(within(confirmation).getByRole("button", { name: "Hủy bỏ" })).toHaveFocus();
    fireEvent.keyDown(document, { key: "Escape" });
    expect(action).toHaveFocus();
    expect(adminTransactionService.reconcileTransaction).not.toHaveBeenCalled();
  });
  it("CSV retains server Blob, filename and exact canonical filter contract", async () => {
    const blob = new Blob(["server CSV"]); blob.fileName = "server.csv";
    adminTransactionService.exportTransactions.mockResolvedValue(blob);
    await mount();
    fireEvent.change(screen.getByLabelText("Lọc theo trạng thái"), { target: { value: "Paid" } });
    fireEvent.click(screen.getByRole("button", { name: /Xuất CSV/ }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledExactlyOnceWith(blob, "server.csv"));
    expect(adminTransactionService.exportTransactions).toHaveBeenCalledExactlyOnceWith({ search: "", status: "Paid", operationType: "", fromDate: "", toDate: "" });
  });
  it("shared pagination keeps pageSize20 and current sort", async () => {
    await mount(); fireEvent.click(screen.getByRole("button", { name: "Sau" }));
    await waitFor(() => expect(adminTransactionService.getTransactions.mock.lastCall[0]).toMatchObject({ page: 2, pageSize: 20, sortBy: "createdAt", sortDirection: "desc" }));
  });
  it("invalid date range remains visible and export disabled", async () => {
    await mount();
    fireEvent.change(screen.getByLabelText("Lọc từ ngày"), { target: { value: "2026-10-05" } });
    await waitFor(() => expect(adminTransactionService.getTransactions.mock.lastCall[0].fromDate).toBe("2026-10-05"));
    const count = adminTransactionService.getTransactions.mock.calls.length;
    fireEvent.change(screen.getByLabelText("Lọc đến ngày"), { target: { value: "2026-10-01" } });
    expect(screen.getByRole("alert")).toHaveTextContent("Ngày bắt đầu");
    expect(screen.getByRole("button", { name: /Xuất CSV/ })).toBeDisabled();
    expect(adminTransactionService.getTransactions).toHaveBeenCalledTimes(count);
  });
  it("search remains 350ms debounced and resets paging", async () => {
    vi.useFakeTimers(); render(<AdminTransactionsPage />); await act(async () => {});
    adminTransactionService.getTransactions.mockClear();
    fireEvent.change(screen.getByRole("searchbox"), { target: { value: "42" } });
    await act(async () => vi.advanceTimersByTime(349));
    expect(adminTransactionService.getTransactions).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(1));
    expect(adminTransactionService.getTransactions.mock.lastCall[0]).toMatchObject({ search: "42", page: 1 });
  });
});
