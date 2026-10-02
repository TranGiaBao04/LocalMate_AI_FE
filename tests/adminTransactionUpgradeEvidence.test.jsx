import { Blob as ServerBlob } from "node:buffer";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import AdminTransactionsPage from "../src/pages/admin/AdminTransactionsPage";
import TransactionDetailDrawer from "../src/components/admin/transactions/TransactionDetailDrawer";
import CreditSourcesPanel from "../src/components/admin/transactions/CreditSourcesPanel";
import { adminApiClient } from "../src/api/adminApiClient";
import { adminTransactionService, serializeTransactionFilters } from "../src/services/adminTransactionService";
import { downloadBlob } from "../src/utils/exportFiles";
import { formatPlanPrice, formatVnDateTime } from "../src/utils/subscriptionUtils";

vi.mock("../src/api/adminApiClient", () => ({
  adminApiClient: { get: vi.fn(), getBlob: vi.fn(), post: vi.fn() },
}));
vi.mock("../src/utils/exportFiles", () => ({ downloadBlob: vi.fn() }));

const ORDER_ID = "order-upgrade";
const CHECKED_AT = "2026-10-02T03:04:00Z";
const RELEASE = {
  providerCheckedAt: CHECKED_AT,
  providerStatus: "Cancelled",
  requestedAmount: 43000,
  amountPaid: 0,
  amountRemaining: 43000,
  reasonCode: "provider_terminal_zero_paid",
};
const CSV = "\uFEFFOrderId,ProviderOrderCode,CreatedAtUtc,PaidAtUtc,ExpiresAtUtc,UserId,FullName,Email,ProductKind,PlanCode,PlanName,OperationType,Status,Amount,CreditAmount,Currency\r\nserver-order,123,,,,user,Nguyễn Văn A,email,SubscriptionPlan,VIP,VIP,Upgrade,Paid,43000,11000,VND\r\n";

let rows;
let summary;
let detail;
let serverBlob;

function transaction(overrides = {}) {
  return {
    id: ORDER_ID, providerOrderCode: 12345,
    userFullName: "Nguyễn Văn A", userEmail: "admin-evidence@example.com",
    productKind: "SubscriptionPlan", planCode: "VIP", planName: "Gói linh hoạt",
    operationType: "Upgrade", status: "ReviewRequired",
    amount: 43000, creditAmount: 11000, listPrice: 97000, currency: "VND",
    createdAt: "2026-10-01T01:00:00Z", expiresAt: "2026-10-01T02:00:00Z", paidAt: null,
    ...overrides,
  };
}

function source(overrides = {}) {
  return {
    planCode: "CUSTOM", planName: "Gói nguồn",
    originalEndsAt: "2026-10-30T03:04:00Z",
    remainingDays: 12, calculatedCreditAmount: 7300, state: "Released",
    terminatedAt: null, releasedAt: CHECKED_AT, releaseEvidence: { ...RELEASE },
    ...overrides,
  };
}

async function openPage() {
  render(<AdminTransactionsPage />);
  await waitFor(() => expect(screen.getByRole("button", { name: /Xem chi tiết đơn hàng/ })).toBeInTheDocument());
  return screen.getByRole("button", { name: /Xem chi tiết đơn hàng/ }).closest("tr");
}

async function openDetail() {
  render(<TransactionDetailDrawer isOpen transactionId={ORDER_ID} onClose={vi.fn()} showNotice={vi.fn()} />);
  await screen.findByText("Thông tin đơn hàng & Thanh toán");
  return screen.getByRole("dialog");
}

function valueFor(label, root = screen) {
  return root.getByText(label).parentElement;
}

function sourceField(label) {
  return screen.getByText(label).nextElementSibling;
}

function revenueCard() {
  return screen.getByText("Doanh thu gộp").parentElement;
}

function listRequest() {
  return adminApiClient.get.mock.calls.map(([path]) => new URL(path, "https://test.local"))
    .filter((url) => url.pathname === "/admin/transactions").at(-1);
}

async function setCanonicalFilters() {
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: " VIP " } });
  fireEvent.change(screen.getByLabelText("Lọc theo trạng thái"), { target: { value: "ReviewRequired" } });
  fireEvent.change(screen.getByLabelText("Lọc theo loại giao dịch"), { target: { value: "Upgrade" } });
  fireEvent.change(screen.getByLabelText("Lọc từ ngày"), { target: { value: "2026-10-01" } });
  fireEvent.change(screen.getByLabelText("Lọc đến ngày"), { target: { value: "2026-10-02" } });
  await waitFor(() => {
    expect(listRequest().searchParams.get("search")).toBe("VIP");
    expect(listRequest().searchParams.get("createdTo")).toBe("2026-10-03T00:00:00+07:00");
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  rows = [transaction()];
  summary = {
    totalTransactions: 101, paidCount: 20, pendingCount: 15, failedCount: 2,
    expiredCount: 7, reviewRequiredCount: 57, grossRevenue: 123456, currency: "VND",
  };
  detail = {
    transaction: transaction(), statusHistory: [], webhookReceipts: [],
    creditSources: [source()], repairHistory: [], entitlement: { grantStatus: "Unknown" },
    repairEligibility: { eligible: false },
  };
  serverBlob = new ServerBlob([CSV], { type: "text/csv; charset=utf-8" });
  serverBlob.fileName = "localmate-transactions-server.csv";
  adminApiClient.get.mockImplementation(async (path) => {
    const url = new URL(path, "https://test.local");
    if (url.pathname === "/admin/transactions/summary") return summary;
    if (url.pathname === "/admin/transactions") return { items: rows, page: 1, pageSize: 20, totalCount: 101, totalPages: 6 };
    if (url.pathname === `/admin/transactions/${ORDER_ID}`) return detail;
    throw new Error(`Unexpected read: ${path}`);
  });
  adminApiClient.getBlob.mockResolvedValue(serverBlob);
});

afterEach(() => vi.restoreAllMocks());

describe("FE-UP5 admin financial evidence A01-A50", () => {
  it("A01 ReviewRequired appears in the status filter", async () => {
    await openPage();
    expect(within(screen.getByLabelText("Lọc theo trạng thái")).getByRole("option", { name: "Cần kiểm tra" })).toHaveValue("ReviewRequired");
  });
  it("A02 Upgrade appears in the operation filter", async () => {
    await openPage();
    expect(within(screen.getByLabelText("Lọc theo loại giao dịch")).getByRole("option", { name: "Nâng cấp" })).toHaveValue("Upgrade");
  });
  it("A03 Upgrade renders its explicit label in list and detail", async () => {
    const row = await openPage();
    expect(within(row).getByText("Nâng cấp")).toBeInTheDocument();
    fireEvent.click(within(row).getByRole("button"));
    const dialog = await screen.findByRole("dialog");
    await waitFor(() => expect(within(dialog).getByText("Nâng cấp")).toBeInTheDocument());
  });
  it("A04 Upgrade is not Purchase", async () => {
    const row = await openPage();
    expect(within(row).queryByText(/^Mua/)).not.toBeInTheDocument();
  });
  it("A05 Purchase keeps the explicit Mua label", async () => {
    rows = [transaction({ operationType: "Purchase" })];
    expect(within(await openPage()).getByText("Mua")).toBeInTheDocument();
  });
  it("A06 Renewal keeps the explicit Gia hạn label", async () => {
    rows = [transaction({ operationType: "Renewal" })];
    expect(within(await openPage()).getByText("Gia hạn")).toBeInTheDocument();
  });
  it("A07 unknown operation remains a neutral raw label, not Purchase", async () => {
    rows = [transaction({ operationType: "FutureOperation" })];
    const row = await openPage();
    expect(within(row).getByText("FutureOperation")).toHaveClass("text-slate-600");
    expect(within(row).queryByText(/^Mua/)).not.toBeInTheDocument();
    detail.transaction.operationType = "FutureOperation";
    fireEvent.click(within(row).getByRole("button"));
    await waitFor(() => expect(within(screen.getByRole("dialog")).getByText("FutureOperation")).toBeInTheDocument());
  });
  it("A08 ReviewRequired gets an explicit badge in list and detail", async () => {
    expect(within(await openPage()).getByText("Cần kiểm tra")).toHaveClass("ring-1");
    fireEvent.click(screen.getByRole("button", { name: /Xem chi tiết đơn hàng/ }));
    await waitFor(() => expect(within(screen.getByRole("dialog")).getByText("Cần kiểm tra")).toHaveClass("ring-1"));
  });
  it("A09 ReviewRequired is not a successful Paid badge", async () => {
    const badge = within(await openPage()).getByText("Cần kiểm tra");
    expect(badge).not.toHaveClass("bg-emerald-50");
    expect(badge).toHaveClass("bg-blue-50");
  });
  it("A10 ReviewRequired is not a Failed badge", async () => {
    expect(within(await openPage()).getByText("Cần kiểm tra")).not.toHaveClass("bg-rose-50");
  });
  it("A11 review count is the server summary count, not the page count", async () => {
    await openPage();
    expect(screen.getAllByText("Cần kiểm tra").find((node) => node.tagName === "P").parentElement).toHaveTextContent("57");
  });
  it("A12 gross revenue comes directly from the backend", async () => {
    await openPage();
    expect(revenueCard()).toHaveTextContent("123.456đ");
    expect(revenueCard()).not.toHaveTextContent("43.000đ");
  });
  it("A13 credit, list price and ReviewRequired cash never increase revenue", async () => {
    summary.grossRevenue = 0;
    rows = [transaction({ amount: 999999, creditAmount: 888888, listPrice: 777777 })];
    await openPage();
    expect(revenueCard()).toHaveTextContent("0đ");
    expect(revenueCard()).not.toHaveTextContent(/999\.999|888\.888|777\.777/);
  });
  it("A14 list displays cash amount as authoritative", async () => {
    const row = await openPage();
    expect(within(row).getByText("43.000đ")).toHaveClass("font-semibold");
    expect(row).toHaveTextContent("Credit: 11.000đ");
    expect(row).toHaveTextContent("Giá gốc: 97.000đ");
  });
  it("A15 detail displays amount as actual cash", async () => {
    const dialog = await openDetail();
    expect(valueFor("Thực trả:", within(dialog))).toHaveTextContent("43.000đ");
  });
  it("A16 detail displays server applied credit", async () => {
    const dialog = await openDetail();
    expect(valueFor("Credit đã áp dụng:", within(dialog))).toHaveTextContent("11.000đ");
  });
  it("A17 detail displays server list price even if inconsistent with cash plus credit", async () => {
    const dialog = await openDetail();
    expect(valueFor("Giá gốc:", within(dialog))).toHaveTextContent("97.000đ");
    expect(dialog).not.toHaveTextContent("54.000đ");
  });
  it("A18 missing financial fields are not derived or synthesized as zero", async () => {
    detail.transaction.listPrice = undefined;
    detail.transaction.creditAmount = null;
    const dialog = await openDetail();
    expect(valueFor("Giá gốc:", within(dialog))).toHaveTextContent("—");
    expect(valueFor("Credit đã áp dụng:", within(dialog))).toHaveTextContent("—");
    expect(valueFor("Credit đã áp dụng:", within(dialog))).not.toHaveTextContent("0đ");
  });
  it("A19 Single with null plan identity has an explicit product label", async () => {
    rows = [transaction({ productKind: "SingleItinerary", operationType: "Purchase", planCode: null, planName: null })];
    expect(within(await openPage()).getByText("Lịch trình đơn lẻ")).toBeInTheDocument();
  });
  it("A20 Single never fabricates TripPass", async () => {
    detail.transaction = transaction({ productKind: "SingleItinerary", operationType: "Purchase", planCode: null, planName: null });
    const dialog = await openDetail();
    expect(valueFor("Sản phẩm:", within(dialog))).toHaveTextContent("Lịch trình đơn lẻ");
    expect(dialog).not.toHaveTextContent(/Trip ?Pass/);
  });
  it("A21 Single never fabricates Membership", async () => {
    rows = [transaction({ productKind: "SingleItinerary", planCode: null, planName: null })];
    expect(await openPage()).not.toHaveTextContent("Membership");
  });
  it.each([
    ["A22", "Reserved", "Đã giữ"],
    ["A23", "Consumed", "Đã sử dụng"],
    ["A24", "Released", "Đã giải phóng"],
    ["A25", "Conflict", "Xung đột"],
  ])("%s source %s renders its normalized label", (id, state, label) => {
    expect(id).toMatch(/^A2[2-5]$/);
    render(<CreditSourcesPanel sources={[source({ state })]} />);
    expect(screen.getByText(label)).toBeInTheDocument();
  });
  it("A26 ReviewRequired plus Released remains Released", async () => {
    const dialog = await openDetail();
    expect(dialog).toHaveTextContent("Cần kiểm tra");
    expect(dialog).toHaveTextContent("Đã giải phóng");
    expect(within(screen.getByRole("article")).queryByText("Xung đột")).not.toBeInTheDocument();
  });
  it("A27 terminatedAt cannot imply Consumed", () => {
    render(<CreditSourcesPanel sources={[source({ state: "Reserved", terminatedAt: CHECKED_AT })]} />);
    expect(screen.getByText("Đã giữ")).toBeInTheDocument();
    expect(screen.queryByText("Đã sử dụng")).not.toBeInTheDocument();
  });
  it("A28 releasedAt cannot imply Released", () => {
    render(<CreditSourcesPanel sources={[source({ state: "Conflict", releasedAt: CHECKED_AT })]} />);
    expect(screen.getByText("Xung đột")).toBeInTheDocument();
    expect(screen.queryByText("Đã giải phóng")).not.toBeInTheDocument();
  });
  it("A29 calculated source credit is explanatory evidence", () => {
    render(<CreditSourcesPanel sources={[source()]} />);
    expect(sourceField("Credit tính từ nguồn")).toHaveTextContent("7.300đ");
    expect(sourceField("Số ngày còn lại")).toHaveTextContent("12");
    expect(sourceField("Hạn gốc")).toHaveTextContent(formatVnDateTime(source().originalEndsAt));
  });
  it("A30 source credits never sum into applied credit", async () => {
    detail.creditSources = [source(), source({ calculatedCreditAmount: 8200 })];
    const dialog = await openDetail();
    expect(valueFor("Credit đã áp dụng:", within(dialog))).toHaveTextContent("11.000đ");
    expect(dialog).not.toHaveTextContent("15.500đ");
  });
  it.each([
    ["A31", "Kiểm tra nhà cung cấp", formatVnDateTime(CHECKED_AT)],
    ["A32", "Trạng thái nhà cung cấp", "Cancelled"],
    ["A33", "Số tiền yêu cầu", "43.000đ"],
    ["A34", "Đã trả nhà cung cấp", "0đ"],
    ["A35", "Còn phải trả", "43.000đ"],
    ["A36", "Mã lý do", "provider_terminal_zero_paid"],
  ])("%s release evidence %s is displayed", (id, label, expected) => {
    expect(id).toMatch(/^A3[1-6]$/);
    render(<CreditSourcesPanel sources={[source()]} />);
    expect(sourceField(label)).toHaveTextContent(expected);
  });
  it("A37 private credit IDs are never rendered, even if supplied", async () => {
    const privateIds = { claimId: "SECRET_CLAIM", periodId: "SECRET_PERIOD", sourceOrderId: "SECRET_SOURCE", versionId: "SECRET_VERSION", userId: "SECRET_USER" };
    detail.creditSources = [source({ ...privateIds, releaseEvidence: { ...RELEASE, ...privateIds } })];
    expect(await openDetail()).not.toHaveTextContent(/SECRET_/);
  });
  it("A38 raw provider/webhook payload, QR and checkout URL never render", async () => {
    detail.creditSources = [source({ rawPayload: "SECRET_PROVIDER", releaseEvidence: { ...RELEASE, rawResponse: "SECRET_RESPONSE" } })];
    detail.transaction.checkoutUrl = "SECRET_CHECKOUT";
    detail.transaction.qrCode = "SECRET_QR";
    detail.webhookReceipts = [{
      id: "receipt", receivedAt: CHECKED_AT, isSuccessful: true, providerOrderCode: 123,
      amount: 43000, rawPayloadSha256: "safe-sha256", hasRawPayload: true,
      rawPayloadRetainUntil: CHECKED_AT, rawPayload: "SECRET_WEBHOOK",
    }];
    const dialog = await openDetail();
    expect(dialog).not.toHaveTextContent(/SECRET_/);
    expect(dialog).toHaveTextContent("safe-sha256");
  });
  it("A39 one detail read supplies all evidence without extra requests", async () => {
    const getDetail = vi.spyOn(adminTransactionService, "getTransactionDetail");
    await openDetail();
    expect(getDetail).toHaveBeenCalledExactlyOnceWith(ORDER_ID);
    expect(adminApiClient.get).toHaveBeenCalledExactlyOnceWith(`/admin/transactions/${ORDER_ID}`);
    expect(adminApiClient.post).not.toHaveBeenCalled();
  });
  it("A40 CSV downloads the original server Blob and server filename", async () => {
    await openPage();
    fireEvent.click(screen.getByRole("button", { name: /Xuất CSV/ }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalledExactlyOnceWith(serverBlob, serverBlob.fileName));
  });
  it("A41 CSV shares exactly the canonical list and summary filters", async () => {
    await openPage();
    await setCanonicalFilters();
    fireEvent.click(screen.getByRole("button", { name: /Xuất CSV/ }));
    await waitFor(() => expect(adminApiClient.getBlob).toHaveBeenCalled());
    const exported = new URL(adminApiClient.getBlob.mock.calls[0][0], "https://test.local");
    const expected = {
      search: "VIP", status: "ReviewRequired", operationType: "Upgrade",
      createdFrom: "2026-10-01T00:00:00+07:00", createdTo: "2026-10-03T00:00:00+07:00",
    };
    expect(Object.fromEntries(exported.searchParams)).toEqual(expected);
    const summaryRequest = adminApiClient.get.mock.calls.map(([path]) => new URL(path, "https://test.local"))
      .filter((url) => url.pathname === "/admin/transactions/summary").at(-1);
    expect(Object.fromEntries(summaryRequest.searchParams)).toEqual(expected);
    for (const [key, value] of Object.entries(expected)) expect(listRequest().searchParams.get(key)).toBe(value);
  });
  it("A42 CSV is never rebuilt from the current page", async () => {
    await openPage();
    fireEvent.click(screen.getByRole("button", { name: "Sau" }));
    await waitFor(() => expect(listRequest().searchParams.get("page")).toBe("2"));
    fireEvent.click(screen.getByRole("button", { name: /Xuất CSV/ }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalled());
    expect(downloadBlob.mock.calls[0][0]).toBe(serverBlob);
    expect(new URL(adminApiClient.getBlob.mock.calls[0][0], "https://test.local").search).toBe("");
  });
  it("A43 server CSV CreditAmount, BOM, Unicode and bytes pass through unchanged", async () => {
    const blob = await adminTransactionService.exportTransactions({});
    expect(blob).toBe(serverBlob);
    expect(await blob.text()).toBe(CSV.slice(1));
    expect(new Uint8Array(await blob.arrayBuffer()).slice(0, 3)).toEqual(new Uint8Array([239, 187, 191]));
    expect(await blob.text()).toContain("Amount,CreditAmount,Currency");
    expect(await blob.text()).toContain("Nguyễn Văn A");
  });
  it("A44 client never appends ListPrice to server CSV", async () => {
    await openPage();
    fireEvent.click(screen.getByRole("button", { name: /Xuất CSV/ }));
    await waitFor(() => expect(downloadBlob).toHaveBeenCalled());
    expect(downloadBlob.mock.calls[0][0]).toBe(serverBlob);
    expect(await serverBlob.text()).not.toContain("ListPrice");
  });
  it("A45 over-limit export shows narrowing guidance without partial download", async () => {
    adminApiClient.getBlob.mockRejectedValue({ code: "transaction_export_limit_exceeded", status: 400, data: { maxRows: 10000, matchingRows: 10001 } });
    await openPage();
    fireEvent.click(screen.getByRole("button", { name: /Xuất CSV/ }));
    expect(await screen.findByRole("alert")).toHaveTextContent("10.000");
    expect(screen.getByRole("alert")).toHaveTextContent("thu hẹp");
    expect(downloadBlob).not.toHaveBeenCalled();
  });
  it("A46 ReviewRequired filter serializes its exact status", async () => {
    await openPage();
    fireEvent.change(screen.getByLabelText("Lọc theo trạng thái"), { target: { value: "ReviewRequired" } });
    await waitFor(() => expect(listRequest().searchParams.get("status")).toBe("ReviewRequired"));
  });
  it("A47 Upgrade filter serializes its exact operation", async () => {
    await openPage();
    fireEvent.change(screen.getByLabelText("Lọc theo loại giao dịch"), { target: { value: "Upgrade" } });
    await waitFor(() => expect(listRequest().searchParams.get("operationType")).toBe("Upgrade"));
  });
  it("A48 CreatedAt keeps inclusive/exclusive absolute boundaries", () => {
    const timestamps = { createdFrom: "2026-10-01T12:00:00Z", createdTo: "2026-10-02T19:00:00+07:00" };
    expect(Object.fromEntries(serializeTransactionFilters(timestamps))).toEqual(timestamps);
    expect(Object.fromEntries(serializeTransactionFilters({ fromDate: "2026-12-31", toDate: "2026-12-31" }))).toEqual({
      createdFrom: "2026-12-31T00:00:00+07:00", createdTo: "2027-01-01T00:00:00+07:00",
    });
  });
  it("A49 table only offers supported sort keys", async () => {
    await openPage();
    const expected = ["createdAt", "providerOrderCode", "userEmail", "planCode", "operationType", "amount", "status"];
    const buttons = within(screen.getByRole("table")).getAllByRole("columnheader")
      .map((header) => within(header).queryByRole("button")).filter(Boolean);
    expect(buttons).toHaveLength(expected.length);
    for (const [index, button] of buttons.entries()) {
      fireEvent.click(button);
      await waitFor(() => expect(listRequest().searchParams.get("sortBy")).toBe(expected[index]));
    }
    expect(screen.queryByRole("button", { name: /^Credit/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^Giá gốc/ })).not.toBeInTheDocument();
  });
  it("A50 no unsupported product or credit filters are introduced", async () => {
    const params = { search: " VIP ", status: "ReviewRequired", operationType: "Upgrade", productKind: "SingleItinerary", creditAmount: 12, listPrice: 20, sourceState: "Released", page: 2 };
    expect(Object.fromEntries(serializeTransactionFilters(params))).toEqual({ search: "VIP", status: "ReviewRequired", operationType: "Upgrade" });
    await openPage();
    expect(screen.getAllByRole("combobox")).toHaveLength(2);
    expect(listRequest().searchParams.has("productKind")).toBe(false);
  });
});

describe("FE-UP5 evidence edge cases", () => {
  it.each([[], null, undefined])("empty credit sources stay compact (%s)", (sources) => {
    const { container } = render(<CreditSourcesPanel sources={sources} />);
    expect(container).toBeEmptyDOMElement();
  });
  it("unknown or missing source state is not inferred from dates", () => {
    render(<CreditSourcesPanel sources={[source({ state: "FutureState" }), source({ state: null })]} />);
    expect(screen.getByText("FutureState")).toHaveClass("bg-slate-100");
    expect(screen.queryByText("Đã giải phóng")).not.toBeInTheDocument();
  });
  it("zero remains zero and missing source money remains unavailable", () => {
    render(<CreditSourcesPanel sources={[source({ remainingDays: 0, calculatedCreditAmount: 0, releaseEvidence: { ...RELEASE, amountRemaining: null } })]} />);
    expect(sourceField("Credit tính từ nguồn")).toHaveTextContent("0đ");
    expect(sourceField("Số ngày còn lại")).toHaveTextContent("0");
    expect(sourceField("Còn phải trả")).toHaveTextContent("—");
  });
  it.each([
    [{ planCode: "Membership", planName: "Tên gói đã mua" }, "Tên gói đã mua"],
    [{ planCode: "HISTORICAL", planName: null }, "HISTORICAL"],
    [{ planCode: null, planName: null }, "Gói đăng ký"],
  ])("subscription product keeps server historical identity (%s)", async (identity, label) => {
    rows = [transaction(identity)];
    expect(within(await openPage()).getByText(label)).toBeInTheDocument();
  });
  it("missing list cash, credit and gross use placeholders without arithmetic", async () => {
    rows = [transaction({ amount: null, creditAmount: undefined, listPrice: null })];
    const row = await openPage();
    expect(row).toHaveTextContent("Credit: —");
    expect(row).toHaveTextContent("Giá gốc: —");
    expect(row).not.toHaveTextContent("0đ");
  });
  it("missing summary revenue and review count do not fabricate zero", async () => {
    summary.grossRevenue = null;
    summary.reviewRequiredCount = undefined;
    await openPage();
    expect(revenueCard()).toHaveTextContent("—");
    expect(screen.getAllByText("Cần kiểm tra").find((node) => node.tagName === "P").parentElement).toHaveTextContent("—");
  });
  it("detail preserves server history and receipt order without extra API calls", async () => {
    detail.statusHistory = [
      { id: "h1", source: "Webhook", reasonCode: "first-server-history", fromStatus: "Pending", toStatus: "Failed", occurredAt: "2026-10-03T00:00:00Z" },
      { id: "h2", source: "AdminReconcile", reasonCode: "second-server-history", fromStatus: "Failed", toStatus: "Paid", occurredAt: "2026-10-01T00:00:00Z" },
    ];
    detail.webhookReceipts = [
      { id: "r1", receivedAt: "2026-10-01T00:00:00Z", rawPayloadSha256: "first-server-hash", isSuccessful: false, amount: 1 },
      { id: "r2", receivedAt: "2026-10-03T00:00:00Z", rawPayloadSha256: "second-server-hash", isSuccessful: true, amount: 2 },
    ];
    const dialog = await openDetail();
    expect(dialog.textContent.indexOf("first-server-history")).toBeLessThan(dialog.textContent.indexOf("second-server-history"));
    expect(dialog.textContent.indexOf("first-server-hash")).toBeLessThan(dialog.textContent.indexOf("second-server-hash"));
    expect(adminApiClient.get).toHaveBeenCalledTimes(1);
  });
  it("ordinary operations do not invent or display Upgrade credit in the list", async () => {
    rows = [transaction({ operationType: "Purchase", creditAmount: 0, amount: 29000, listPrice: 29000 })];
    const row = await openPage();
    expect(row).toHaveTextContent(formatPlanPrice(29000));
    expect(row).not.toHaveTextContent("Credit:");
  });
});
