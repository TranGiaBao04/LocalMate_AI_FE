import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { canAccessAdmin, hasAnyPermission } from "../src/utils/adminAccess";
import { ADMIN_SECTIONS } from "../src/components/admin/adminSections";
import AdminRoute from "../src/components/admin/AdminRoute";
import AdminLayout from "../src/components/admin/AdminLayout";
import AdminTransactionsPage from "../src/pages/admin/AdminTransactionsPage";
import TransactionDetailDrawer from "../src/components/admin/transactions/TransactionDetailDrawer";
import EntitlementRepairDialog from "../src/components/admin/transactions/EntitlementRepairDialog";
import { adminTransactionService } from "../src/services/adminTransactionService";
import { ADMIN_API_EVENTS } from "../src/api/adminApiClient";
import { formatPlanPrice, formatVnDateTime } from "../src/utils/subscriptionUtils";
import { STORAGE_KEYS } from "../src/constants";

const auth = vi.hoisted(() => ({ user: null, logout: vi.fn(), refreshProfile: vi.fn() }));
vi.mock("../src/context/AuthContext", () => ({
  useAuth: () => ({ ...auth, isLoggedIn: true, initializing: false }),
}));
vi.mock("../src/utils/jwt", () => ({ isStoredTokenExpired: () => false }));

const ORDER = "order-upgrade";
const DETAIL_PATH = `/admin/transactions/${ORDER}`;
const READ_PERMISSION = ["ViewRevenue"];
const READ_AND_MUTATE = ["ViewRevenue", "ManagePlans"];
const transactionSection = ADMIN_SECTIONS.find((section) => section.path === "transactions");
let detail;
let summary;
let mutation;
let mutationStatus;
let detailAfterMutation;
let notice;
let refreshed;

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": status >= 400 ? "application/problem+json" : "application/json" },
  });
}

function requests(path, method = "GET") {
  return globalThis.fetch.mock.calls.filter(([url, options]) =>
    new URL(url, "https://tests.local").pathname.endsWith(path) && options.method === method);
}

function setPermissions(permissions) {
  auth.user = { role: "Admin", fullName: "Nguyễn An", permissions };
}

function drawer() {
  return <TransactionDetailDrawer isOpen transactionId={ORDER} onClose={vi.fn()}
    showNotice={notice} onReconciled={refreshed} />;
}

async function openDrawer() {
  const view = render(drawer());
  await screen.findByText("Thông tin đơn hàng & Thanh toán");
  return view;
}

async function openPage() {
  render(<AdminTransactionsPage />);
  fireEvent.click(await screen.findByRole("button", { name: /Xem chi tiết đơn hàng/ }));
  await screen.findByText("Thông tin đơn hàng & Thanh toán");
}

function submitRepair(reason = "Khôi phục bằng chứng lịch sử") {
  fireEvent.click(screen.getByRole("button", { name: /Khôi phục entitlement/ }));
  fireEvent.change(screen.getByLabelText(/Lý do khôi phục/), { target: { value: reason } });
  fireEvent.click(screen.getByRole("button", { name: "Xác nhận khôi phục" }));
}

function submitReconcile() {
  fireEvent.click(screen.getByRole("button", { name: /Đối soát PayOS/ }));
  fireEvent.click(screen.getByRole("button", { name: "Đối soát", exact: true }));
}

async function detailRefreshed() {
  await waitFor(() => expect(requests(DETAIL_PATH)).toHaveLength(2));
  await screen.findByText("Thông tin đơn hàng & Thanh toán");
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  localStorage.setItem(STORAGE_KEYS.TOKEN, "owned-test-session");
  setPermissions(READ_AND_MUTATE);
  auth.refreshProfile.mockResolvedValue(undefined);
  notice = vi.fn();
  refreshed = vi.fn();
  detailAfterMutation = null;
  mutationStatus = 200;
  mutation = { result: "Repaired", orderId: ORDER, subscriptionPeriodId: "server-period" };
  detail = {
    transaction: {
      id: ORDER, providerOrderCode: 12345, userFullName: "Nguyễn An",
      userEmail: "evidence@example.com", productKind: "SubscriptionPlan",
      planCode: "CUSTOM", planName: "Gói đã mua", operationType: "Upgrade", status: "Paid",
      amount: 43000, creditAmount: 11000, listPrice: 54000, currency: "VND",
      createdAt: "2026-10-01T00:00:00Z", paidAt: "2026-10-01T01:00:00Z",
    },
    entitlement: { grantStatus: "Missing", subscriptionPeriodId: null, startsAt: null, endsAt: null },
    repairEligibility: {
      eligible: true, code: "eligible_upgrade_historical_restore", message: "Đủ bằng chứng lịch sử.",
      proposedStartsAt: "2020-01-01T01:02:03Z", proposedEndsAt: "2020-02-01T04:05:06Z",
      reconstructionMode: "UpgradeDeterministicHistoricalReplay", assessedAt: "2026-10-03T03:00:00Z",
    },
    repairHistory: [{
      id: "audit-1", outcome: "NotEligible", reason: "Đánh giá trước đó",
      decisionCode: "historical_window_unproven", occurredAt: "2026-10-02T03:00:00Z",
      reconstructionMode: "UpgradeDeterministicHistoricalReplay",
    }],
    creditSources: [{ planCode: "SOURCE", planName: "Gói nguồn", remainingDays: 10,
      state: "Consumed", calculatedCreditAmount: 11000, originalEndsAt: "2026-11-01T00:00:00Z" }],
    statusHistory: [{ id: "history-1", fromStatus: "Pending", toStatus: "Paid", source: "Webhook",
      reasonCode: "verified_provider_paid", occurredAt: "2026-10-01T01:00:00Z" }],
    webhookReceipts: [],
  };
  summary = { totalTransactions: 37, paidCount: 17, pendingCount: 2, failedCount: 3,
    expiredCount: 4, reviewRequiredCount: 11, grossRevenue: 987654, currency: "VND" };
  // Exercise the real service and both HTTP clients; no backend or PayOS calls.
  vi.stubGlobal("fetch", vi.fn(async (url, options) => {
    const path = new URL(url, "https://tests.local").pathname;
    if (options.method === "POST") return json(mutation, mutationStatus);
    if (path.endsWith("/admin/transactions/summary")) return json(summary);
    if (path.endsWith("/admin/transactions")) return json({ items: [detail.transaction],
      page: 1, pageSize: 20, totalCount: 1, totalPages: 1 });
    if (path.endsWith(DETAIL_PATH)) {
      return json(detailAfterMutation && globalThis.fetch.mock.calls.some(([, o]) => o.method === "POST")
        ? detailAfterMutation : detail);
    }
    throw new Error(`Unexpected request: ${url}`);
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("FE-UP6 permission and repair evidence R01-R21", () => {
  it("R01 missing permissions plus Admin role fails closed", () => {
    auth.user = { role: "Admin" };
    expect(canAccessAdmin(auth.user)).toBe(false);
    expect(hasAnyPermission(auth.user, READ_AND_MUTATE)).toBe(false);
  });
  it("R02 empty permissions plus Admin role fails closed", () => {
    setPermissions([]);
    expect(canAccessAdmin(auth.user)).toBe(false);
    expect(hasAnyPermission(auth.user, READ_AND_MUTATE)).toBe(false);
  });
  it("R03 actual ViewRevenue exposes the transaction read section", () => {
    setPermissions(READ_PERMISSION);
    expect(transactionSection.permissions).toEqual(READ_PERMISSION);
    expect(hasAnyPermission(auth.user, transactionSection.permissions)).toBe(true);
  });
  it("R04 ManagePlans alone does not expose the transaction section", () => {
    setPermissions(["ManagePlans"]);
    expect(hasAnyPermission(auth.user, transactionSection.permissions)).toBe(false);
  });
  it("R05 read-only ViewRevenue preserves transaction/history/credit/repair evidence", async () => {
    setPermissions(READ_PERMISSION);
    await openDrawer();
    for (const text of ["Gói đã mua", "Gói nguồn", "verified_provider_paid",
      "historical_window_unproven", "Đánh giá trước đó", "eligible_upgrade_historical_restore"]) {
      expect(screen.getByText(text)).toBeInTheDocument();
    }
    expect(screen.getByText(formatVnDateTime(detail.repairEligibility.assessedAt))).toBeInTheDocument();
    expect(screen.getAllByText("UpgradeDeterministicHistoricalReplay")).toHaveLength(2);
    expect(screen.getByText(/Kỳ quyền dự kiến:/).nextElementSibling)
      .toHaveTextContent(formatVnDateTime(detail.repairEligibility.proposedStartsAt));
  });
  it("R06 ViewRevenue-only has no reconcile action", async () => {
    setPermissions(READ_PERMISSION);
    await openDrawer();
    expect(screen.queryByRole("button", { name: /Đối soát PayOS/ })).not.toBeInTheDocument();
    expect(requests(`${DETAIL_PATH}/reconcile`, "POST")).toHaveLength(0);
  });
  it("R07 ViewRevenue-only has no repair action", async () => {
    setPermissions(READ_PERMISSION);
    await openDrawer();
    expect(screen.queryByRole("button", { name: /Khôi phục entitlement/ })).not.toBeInTheDocument();
  });
  it("R08 ManagePlans shows reconcile action", async () => {
    await openDrawer();
    expect(screen.getByRole("button", { name: /Đối soát PayOS/ })).toBeEnabled();
  });
  it("R09 ManagePlans and backend eligible=true shows repair action", async () => {
    await openDrawer();
    expect(screen.getByRole("button", { name: /Khôi phục entitlement/ })).toBeEnabled();
  });
  it("R10 ManagePlans never overrides eligible=false", async () => {
    detail.repairEligibility.eligible = false;
    await openDrawer();
    expect(screen.queryByRole("button", { name: /Khôi phục entitlement/ })).not.toBeInTheDocument();
  });
  it("R11 eligible=true without ManagePlans shows no repair button", async () => {
    setPermissions(["ViewRevenue", "ManagePlaces"]);
    await openDrawer();
    expect(screen.queryByRole("button", { name: /Khôi phục entitlement/ })).not.toBeInTheDocument();
  });
  it("R12 missing entitlement is not local eligibility", async () => {
    detail.repairEligibility = { eligible: false, code: "historical_window_unproven" };
    await openDrawer();
    expect(screen.getAllByText("Thiếu entitlement").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Khôi phục entitlement/ })).not.toBeInTheDocument();
  });
  it("R13 ReviewRequired uses the backend explanation and offers no repair", async () => {
    detail.transaction.status = "ReviewRequired";
    detail.repairEligibility = { eligible: false, code: "payment_review_required", message: "Cần kiểm tra tài chính từ BE." };
    await openDrawer();
    expect(screen.getByText("payment_review_required")).toBeInTheDocument();
    expect(screen.getAllByText("Cần kiểm tra tài chính từ BE.").length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Khôi phục entitlement/ })).not.toBeInTheDocument();
  });
  it("R14 Single/product_not_applicable offers no subscription repair", async () => {
    detail.transaction.productKind = "SingleItinerary";
    detail.entitlement.grantStatus = "NotApplicable";
    detail.repairEligibility = { eligible: false, code: "product_not_applicable" };
    await openDrawer();
    expect(screen.getByText("product_not_applicable")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Khôi phục entitlement/ })).not.toBeInTheDocument();
  });
  it("R15 Single NotApplicable remains visible in read-only mode", async () => {
    setPermissions(READ_PERMISSION);
    detail.entitlement.grantStatus = "NotApplicable";
    detail.repairEligibility = { eligible: false, code: "product_not_applicable" };
    await openDrawer();
    expect(screen.getAllByText("Không áp dụng").length).toBeGreaterThan(0);
    expect(screen.getByText("Khôi phục quyền gói đăng ký không áp dụng cho sản phẩm này.")).toBeInTheDocument();
  });
  it("R16 Upgrade mode is the exact backend string in preview and confirmation", async () => {
    await openDrawer();
    fireEvent.click(screen.getByRole("button", { name: /Khôi phục entitlement/ }));
    const dialog = screen.getByRole("dialog", { name: "Khôi phục quyền hội viên?" });
    expect(within(dialog).getByText("UpgradeDeterministicHistoricalReplay")).toBeInTheDocument();
    expect(within(dialog).getByText("Gói đã mua")).toBeInTheDocument();
  });
  it("R17 ordinary mode is preserved exactly", async () => {
    detail.repairEligibility.reconstructionMode = "DeterministicHistoricalReplay";
    await openDrawer();
    expect(screen.getByText("DeterministicHistoricalReplay")).toBeInTheDocument();
  });
  it("R18 proposed interval is formatted from backend values without reconstruction", async () => {
    await openDrawer();
    const interval = screen.getByText("Kỳ quyền dự kiến:").nextElementSibling;
    expect(interval).toHaveTextContent(formatVnDateTime("2020-01-01T01:02:03Z"));
    expect(interval).toHaveTextContent(formatVnDateTime("2020-02-01T04:05:06Z"));
  });
  it("R19 expired restore does not gain days and retains backend eligibility", async () => {
    await openDrawer();
    expect(screen.getByText(/Việc khôi phục chỉ phục hồi bằng chứng lịch sử/)).toBeInTheDocument();
    submitRepair();
    await detailRefreshed();
    expect(screen.getByText("Kỳ quyền dự kiến:").nextElementSibling)
      .toHaveTextContent(formatVnDateTime("2020-02-01T04:05:06Z"));
  });
  it.each([
    ["R20", "expired", "2020-02-01T04:05:06Z"],
    ["R21", "legitimately terminated", "2026-01-02T00:00:00Z"],
  ])("%s Granted %s evidence is not locally repairable", async (_id, _label, endsAt) => {
    detail.entitlement = { grantStatus: "Granted", subscriptionPeriodId: "existing-period", startsAt: "2020-01-01T00:00:00Z", endsAt };
    detail.repairEligibility = { eligible: false, code: "already_granted", message: "Quyền đã tồn tại." };
    await openDrawer();
    expect(screen.getByText("existing-period")).toBeInTheDocument();
    expect(screen.getByText(formatVnDateTime(endsAt))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Khôi phục entitlement/ })).not.toBeInTheDocument();
  });
});

describe("FE-UP6 repair transport, validation and refresh R22-R36", () => {
  it.each([
    ["R22", []],
    ["R23", ["proposedStartsAt", "proposedEndsAt", "startsAt", "endsAt", "duration"]],
    ["R24", ["amount", "creditAmount", "listPrice"]],
    ["R25", ["sourceIds", "planVersionId", "periodId", "userId", "reconstructionMode"]],
  ])("%s request is reason-only without forbidden fields", async (_id, forbidden) => {
    await openDrawer();
    submitRepair();
    await detailRefreshed();
    const calls = requests(`${DETAIL_PATH}/repair-entitlement`, "POST");
    expect(calls).toHaveLength(1);
    const body = JSON.parse(calls[0][1].body);
    expect(body).toEqual({ reason: "Khôi phục bằng chứng lịch sử" });
    forbidden.forEach((key) => expect(body).not.toHaveProperty(key));
  });
  it("R26 normal surrounding spaces are trimmed on the wire", async () => {
    await openDrawer();
    submitRepair("   Kiểm tra chứng cứ   ");
    await detailRefreshed();
    expect(JSON.parse(requests(`${DETAIL_PATH}/repair-entitlement`, "POST")[0][1].body))
      .toEqual({ reason: "Kiểm tra chứng cứ" });
  });
  it.each([
    ["R27 empty", "   "], ["R28 over 500", "x".repeat(501)],
    ["R29 tab", "\tvalid"], ["R30 newline", "valid\n"],
    ["R31 CR", "a\rb"], ["R31 C0 start", "\u0000valid"],
    ["R31 C0 end", "valid\u001f"], ["R31 C1 middle", "a\u0085b"],
    ["R31 DEL", "a\u007fb"], ["R31 C1 end", "valid\u009f"],
  ])("%s original invalid input is blocked, never silently stripped", (label, reason) => {
    const confirm = vi.fn();
    render(<EntitlementRepairDialog open onConfirm={confirm} />);
    const input = screen.getByLabelText(/Lý do khôi phục/);
    // A textarea normalizes CR. Validate the control still blocks submission.
    fireEvent.change(input, { target: { value: reason } });
    expect(screen.getByRole("button", { name: "Xác nhận khôi phục" })).toBeDisabled();
    fireEvent.submit(input.closest("form"));
    expect(confirm).not.toHaveBeenCalled();
    expect(globalThis.fetch).not.toHaveBeenCalled();
    if (label.includes("C0") || label.includes("C1") || label.includes("tab")) {
      expect(screen.getByText(/không được chứa ký tự xuống dòng/)).toBeInTheDocument();
    }
  });
  it("500 valid characters are accepted", () => {
    const confirm = vi.fn();
    render(<EntitlementRepairDialog open onConfirm={confirm} />);
    fireEvent.change(screen.getByLabelText(/Lý do khôi phục/), { target: { value: "x".repeat(500) } });
    fireEvent.click(screen.getByRole("button", { name: "Xác nhận khôi phục" }));
    expect(confirm).toHaveBeenCalledWith("x".repeat(500));
  });
  it.each(["Repaired", "AlreadyGranted"])("%s 200 refreshes detail R32/R33", async (result) => {
    mutation.result = result;
    await openDrawer();
    submitRepair();
    await detailRefreshed();
    expect(notice).toHaveBeenCalledWith(result === "Repaired" ? "success" : "info", expect.any(String));
    expect(screen.queryByRole("dialog", { name: "Khôi phục quyền hội viên?" })).not.toBeInTheDocument();
    expect(refreshed).not.toHaveBeenCalled();
    // The POST response alone cannot create a local grant.
    expect(screen.getAllByText("Thiếu entitlement").length).toBeGreaterThan(0);
  });
  it.each([
    ["R34", "entitlement_repair_not_eligible"], ["R35", "entitlement_repair_conflict"],
  ])("%s %s refreshes detail once without retry or optimistic grant", async (_id, code) => {
    mutationStatus = 409;
    mutation = { code, decisionCode: "historical_replay_conflict", message: "private provider payload" };
    await openDrawer();
    submitRepair();
    await detailRefreshed();
    expect(requests(`${DETAIL_PATH}/repair-entitlement`, "POST")).toHaveLength(1);
    expect(notice).toHaveBeenCalledWith("error", expect.stringContaining("historical_replay_conflict"));
    expect(notice.mock.calls[0][1]).not.toContain("private provider payload");
    expect(screen.queryByRole("dialog", { name: "Khôi phục quyền hội viên?" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Thiếu entitlement").length).toBeGreaterThan(0);
    expect(refreshed).not.toHaveBeenCalled();
  });
  it("R36 repair 403 belongs to global forbidden handling, not a duplicate toast", async () => {
    const forbidden = vi.fn();
    window.addEventListener(ADMIN_API_EVENTS.FORBIDDEN, forbidden);
    try {
      mutationStatus = 403;
      mutation = { code: "forbidden" };
      await openDrawer();
      submitRepair();
      await waitFor(() => expect(forbidden).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Khôi phục quyền hội viên?" })).not.toBeInTheDocument());
      expect(notice).not.toHaveBeenCalled();
      expect(requests(DETAIL_PATH)).toHaveLength(1);
      expect(localStorage.getItem(STORAGE_KEYS.TOKEN)).toBe("owned-test-session");
    } finally {
      window.removeEventListener(ADMIN_API_EVENTS.FORBIDDEN, forbidden);
    }
  });
});

describe("FE-UP6 reconciliation and authoritative refresh R37-R50", () => {
  beforeEach(() => {
    detail.transaction.status = "Pending";
    detail.repairEligibility.eligible = false;
    mutation = { status: "Reconciled", localStatusBefore: "Pending", localStatusAfter: "Failed", statusChanged: true };
  });
  it("R37 reconcile POST has no body", async () => {
    await openDrawer();
    submitReconcile();
    await detailRefreshed();
    const calls = requests(`${DETAIL_PATH}/reconcile`, "POST");
    expect(calls).toHaveLength(1);
    expect(calls[0][1].body).toBeUndefined();
  });
  it("R38 normal reconciliation refreshes detail/list/summary from backend", async () => {
    await openPage();
    submitReconcile();
    await detailRefreshed();
    await waitFor(() => expect(requests("/admin/transactions/summary")).toHaveLength(2));
    expect(requests("/admin/transactions")).toHaveLength(2);
    expect(screen.getByRole("alert")).toHaveTextContent(/Đối soát hoàn tất/);
    expect(screen.getByRole("alert")).toHaveClass("border-blue-200");
    expect(screen.getByRole("alert")).not.toHaveTextContent(/thanh toán thành công/);
  });
  it.each([
    ["R39", { localStatusAfter: "ReviewRequired" }],
    ["R40", { settlementStatus: "CreditConflict" }],
  ])("%s reconciled review/credit conflict is warning, never payment success", async (_id, fields) => {
    Object.assign(mutation, fields);
    await openPage();
    submitReconcile();
    await detailRefreshed();
    const alert = screen.getByRole("alert");
    expect(alert).toHaveClass("border-amber-200", "z-[110]");
    expect(alert).not.toHaveClass("border-emerald-200");
    expect(within(alert).getByText("warning")).toBeInTheDocument();
    expect(alert).toHaveTextContent("Chưa xác nhận thanh toán thành công");
  });
  it("R41 CreditConflict never locally marks Paid or starts another operation", async () => {
    mutation.settlementStatus = "CreditConflict";
    mutation.localStatusAfter = "ReviewRequired";
    await openDrawer();
    submitReconcile();
    await detailRefreshed();
    expect(notice).toHaveBeenCalledWith("warning", expect.any(String));
    const status = screen.getByRole("heading", { name: "#12345" }).parentElement;
    expect(status).toHaveTextContent("Đang chờ");
    expect(status).not.toHaveTextContent("Đã thanh toán");
    expect(requests(`${DETAIL_PATH}/repair-entitlement`, "POST")).toHaveLength(0);
    expect(requests(`${DETAIL_PATH}/reconcile`, "POST")).toHaveLength(1);
  });
  it.each([["R42", "NoChange"], ["R43", "AlreadyPaid"], ["R47", "FutureOperationalStatus"]])(
    "%s %s is neutral info, not automatic green success", async (_id, status) => {
      mutation.status = status;
      await openDrawer();
      submitReconcile();
      await detailRefreshed();
      expect(notice).toHaveBeenCalledWith("info", expect.any(String));
      expect(notice).not.toHaveBeenCalledWith("success", expect.any(String));
      expect(refreshed).toHaveBeenCalledTimes(1);
    });
  it.each([
    ["R44", 503, "payment_provider_unavailable", "Chưa thể xác nhận trạng thái giao dịch"],
    ["R45", 502, "payment_provider_mismatch", "không khớp giao dịch"],
    ["R46", 404, "transaction_not_found", "Không tìm thấy giao dịch"],
  ])("%s %s/%s is safe, without a local status claim", async (_id, status, code, message) => {
    mutationStatus = status;
    mutation = { code, message: "SQL/private provider credentials" };
    await openDrawer();
    submitReconcile();
    await waitFor(() => expect(notice).toHaveBeenCalledWith("error", expect.stringContaining(message)));
    expect(notice.mock.calls[0][1]).not.toContain("credentials");
    expect(notice.mock.calls[0][1]).not.toContain("trạng thái không thay đổi");
    expect(refreshed).not.toHaveBeenCalled();
    expect(requests(DETAIL_PATH)).toHaveLength(1);
    expect(screen.getByRole("heading", { name: "#12345" }).parentElement).toHaveTextContent("Đang chờ");
  });
  it.each([["R48", "Reconciled"], ["R49", "AlreadyPaid"]])(
    "%s %s never increments paid count or revenue locally", async (_id, status) => {
      mutation.status = status;
      mutation.localStatusAfter = "Paid";
      await openPage();
      // Deliberately different server values prove the POST cannot determine totals.
      summary.paidCount = 9;
      summary.grossRevenue = 1234;
      submitReconcile();
      await detailRefreshed();
      await waitFor(() => expect(screen.getByText("Doanh thu gộp").parentElement)
        .toHaveTextContent(formatPlanPrice(1234)));
      expect(screen.getByText("Doanh thu gộp").parentElement).not.toHaveTextContent(formatPlanPrice(987654 + 43000));
      expect(requests("/admin/transactions/summary")).toHaveLength(2);
      const count = screen.getAllByText("Đã thanh toán")
        .find((el) => el.tagName === "P").parentElement;
      expect(count).toHaveTextContent("9");
      expect(count).not.toHaveTextContent("18");
    });
  it("R50 repair refreshes only detail, not financial list/summary", async () => {
    detail.repairEligibility.eligible = true;
    await openPage();
    submitRepair();
    await detailRefreshed();
    expect(requests("/admin/transactions")).toHaveLength(1);
    expect(requests("/admin/transactions/summary")).toHaveLength(1);
    expect(screen.getByText("Doanh thu gộp").parentElement).toHaveTextContent(formatPlanPrice(987654));
  });
});

describe("FE-UP6 permission refresh and separate read/mutation boundaries", () => {
  it("R51 ManagePlans mutation contract does not acquire ViewRevenue AND", async () => {
    setPermissions(["ManagePlans"]);
    expect(hasAnyPermission(auth.user, transactionSection.permissions)).toBe(false);
    await adminTransactionService.reconcileTransaction(ORDER);
    await adminTransactionService.repairEntitlement(ORDER, "Server enforces mutation permission");
    expect(requests(`${DETAIL_PATH}/reconcile`, "POST")).toHaveLength(1);
    expect(requests(`${DETAIL_PATH}/repair-entitlement`, "POST")).toHaveLength(1);
    setPermissions(READ_PERMISSION);
    expect(hasAnyPermission(auth.user, transactionSection.permissions)).toBe(true);
    expect(hasAnyPermission(auth.user, ["ManagePlans"])).toBe(false);
  });
  it.each([undefined, null, "ViewRevenue", { ViewRevenue: true }, []])(
    "R52 Admin role never provides fallback for %j permissions", (permissions) => {
      setPermissions(permissions);
      expect(canAccessAdmin(auth.user)).toBe(false);
      expect(ADMIN_SECTIONS.filter((section) => hasAnyPermission(auth.user, section.permissions))).toEqual([]);
    });
  it.each([[READ_PERMISSION], [["ManagePlans"]]])("route enforces the actual read snapshot %j", async (permissions) => {
    setPermissions(permissions);
    render(<MemoryRouter initialEntries={["/admin/transactions"]}><Routes>
      <Route path="/admin/transactions" element={<AdminRoute permissions={transactionSection.permissions}><p>transaction read surface</p></AdminRoute>} />
      <Route path="/admin" element={<p>admin home without transactions</p>} />
    </Routes></MemoryRouter>);
    expect(await screen.findByText(permissions.includes("ViewRevenue")
      ? "transaction read surface" : "admin home without transactions")).toBeInTheDocument();
  });
  it.each(["repair", "reconcile"])("revoking ManagePlans hides an open %s confirmation and prevents submission", async (action) => {
    const view = await openDrawer();
    fireEvent.click(screen.getByRole("button", { name: action === "repair" ? /Khôi phục entitlement/ : /Đối soát PayOS/ }));
    expect(screen.getAllByRole("dialog")).toHaveLength(2);
    setPermissions(READ_PERMISSION);
    view.rerender(drawer());
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.queryByRole("button", { name: /Khôi phục entitlement|Đối soát PayOS/ })).not.toBeInTheDocument();
    expect(globalThis.fetch.mock.calls.filter(([, o]) => o.method === "POST")).toHaveLength(0);
    expect(screen.getByText("eligible_upgrade_historical_restore")).toBeInTheDocument();
  });
  it("403 refresh cannot restore revoked permissions through Admin role", async () => {
    const view = render(<MemoryRouter initialEntries={["/admin"]}><AdminLayout /></MemoryRouter>);
    expect(screen.getAllByText("Giao dịch").length).toBeGreaterThan(0);
    auth.refreshProfile.mockImplementation(async () => { setPermissions(undefined); });
    await act(async () => window.dispatchEvent(new CustomEvent(ADMIN_API_EVENTS.FORBIDDEN)));
    view.rerender(<MemoryRouter initialEntries={["/admin"]}><AdminLayout /></MemoryRouter>);
    expect(auth.refreshProfile).toHaveBeenCalledTimes(1);
    expect(auth.logout).not.toHaveBeenCalled();
    expect(screen.queryByText("Giao dịch")).not.toBeInTheDocument();
    expect(canAccessAdmin(auth.user)).toBe(false);
  });
  it.each([undefined, "true", 1])("missing or non-boolean eligibility %j never enables repair", async (eligible) => {
    detail.repairEligibility.eligible = eligible;
    await openDrawer();
    expect(screen.queryByRole("button", { name: /Khôi phục entitlement/ })).not.toBeInTheDocument();
  });
  it("ineligible read-only assessment still shows backend mode, interval and assessment time", async () => {
    setPermissions(READ_PERMISSION);
    detail.repairEligibility.eligible = false;
    await openDrawer();
    expect(screen.getByText("Kỳ quyền dự kiến:").nextElementSibling)
      .toHaveTextContent(formatVnDateTime(detail.repairEligibility.proposedEndsAt));
    expect(screen.getAllByText("UpgradeDeterministicHistoricalReplay")).toHaveLength(2);
    expect(screen.getByText(formatVnDateTime(detail.repairEligibility.assessedAt))).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Khôi phục entitlement/ })).not.toBeInTheDocument();
  });
  it("reconcile 403 closes confirmation without duplicate local notice or session termination", async () => {
    const forbidden = vi.fn();
    window.addEventListener(ADMIN_API_EVENTS.FORBIDDEN, forbidden);
    try {
      mutationStatus = 403;
      mutation = { code: "forbidden" };
      await openDrawer();
      submitReconcile();
      await waitFor(() => expect(forbidden).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(screen.queryByRole("dialog", { name: "Đối soát giao dịch với PayOS?" })).not.toBeInTheDocument());
      expect(notice).not.toHaveBeenCalled();
      expect(localStorage.getItem(STORAGE_KEYS.TOKEN)).toBe("owned-test-session");
      expect(refreshed).not.toHaveBeenCalled();
    } finally {
      window.removeEventListener(ADMIN_API_EVENTS.FORBIDDEN, forbidden);
    }
  });
  it.each(["repair", "reconcile"])("%s cannot be submitted twice while its request is in flight", async (action) => {
    await openDrawer();
    let release;
    globalThis.fetch.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));
    if (action === "repair") {
      submitRepair();
      const dialog = screen.getByRole("dialog", { name: "Khôi phục quyền hội viên?" });
      expect(within(dialog).getByRole("button", { name: /Đang xử lý/ })).toBeDisabled();
      fireEvent.submit(within(dialog).getByLabelText(/Lý do khôi phục/).closest("form"));
    } else {
      submitReconcile();
      const dialog = screen.getByRole("dialog", { name: "Đối soát giao dịch với PayOS?" });
      const buttons = within(dialog).getAllByRole("button");
      expect(buttons.every((button) => button.disabled)).toBe(true);
      buttons.forEach((button) => fireEvent.click(button));
    }
    expect(globalThis.fetch.mock.calls.filter(([, o]) => o.method === "POST")).toHaveLength(1);
    await act(async () => release(json(mutation)));
    await detailRefreshed();
  });
});
