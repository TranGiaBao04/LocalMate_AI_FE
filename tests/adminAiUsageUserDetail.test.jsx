import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminUserDetailPage from "../src/pages/admin/AdminUserDetailPage";
import UserAiUsageTab from "../src/components/admin/users/UserAiUsageTab";
import { formatVnDateTime } from "../src/utils/subscriptionUtils";

const mocks = vi.hoisted(() => ({
  auth: { user: null },
  ai: { getUserSummary: vi.fn(), getUserCalls: vi.fn(), getSystemSummary: vi.fn() },
  users: { getUser: vi.fn(), getUserPayments: vi.fn(), getUserTrips: vi.fn(), lockUser: vi.fn(), unlockUser: vi.fn() },
}));
vi.mock("../src/context/AuthContext", () => ({ useAuth: () => mocks.auth }));
vi.mock("../src/services/adminAiUsageService", () => ({ adminAiUsageService: mocks.ai }));
vi.mock("../src/services/adminUserService", () => ({ adminUserService: mocks.users }));

const summary = () => ({ userId: "target-A", from: "2026-09-14", to: "2026-10-13", generatedAt: "2026-10-13T12:00:00Z",
  today: { used: 2, limit: 3, resetAt: "2026-10-13T17:00:00Z" },
  totals: { calls: 12, succeeded: 6, providerFailed: 2, invalidOutput: 1, abandoned: 1, inProgress: 2, inputTokens: 110, outputTokens: 70, averageDurationMs: null },
  days: [{ date: "2026-10-13", calls: 12, succeeded: 6, failed: 4, inputTokens: 110, outputTokens: 70 }],
});
const statuses = ["Succeeded", "ProviderFailed", "InvalidOutput", "Abandoned", "InProgress"];
const statusLabels = ["Thành công", "Lỗi nhà cung cấp", "Kết quả không hợp lệ", "Bị gián đoạn", "Đang xử lý"];
const rows = () => statuses.map((status, index) => ({ id: index < 2 ? "collision" : `call-${index}`, status,
  kind: index % 2 ? "Explain" : "ParseRequest", startedAt: "2026-10-13T12:00:00Z", completedAt: null,
  model: null, durationMs: null, inputTokens: index, outputTokens: index + 1, tripId: null }));
const page = (query, items = rows()) => ({ items, page: query.page, pageSize: 10, totalCount: 25, totalPages: 3 });
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
function Navigation() { const navigate = useNavigate(); return <button onClick={() => navigate("/admin/users/target-B")}>Đổi target</button>; }
const view = () => <MemoryRouter initialEntries={["/admin/users/target-A"]}><Navigation /><Routes><Route path="/admin/users/:userId" element={<AdminUserDetailPage />} /></Routes></MemoryRouter>;
async function mount() { const app = render(view()); await screen.findByRole("heading", { name: "Target target-A" }); return app; }
async function openAi() { fireEvent.click(screen.getByRole("tab", { name: "Lịch sử AI" })); await screen.findByRole("table", { name: "Nhật ký AI" }); }
const aiPanel = () => screen.getByRole("tabpanel", { name: "Lịch sử AI" });
const history = () => within(screen.getByRole("table", { name: "Nhật ký AI" }));
const metric = (label) => within(aiPanel()).getByText(label).nextElementSibling;
const lastQuery = () => mocks.ai.getUserCalls.mock.lastCall[1];

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.user = { id: "admin-A", permissions: ["ManageUsers"] };
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected live network request"); }));
  mocks.ai.getSystemSummary.mockImplementation(() => { throw new Error("API A forbidden in FE3"); });
  mocks.ai.getUserSummary.mockResolvedValue(summary());
  mocks.ai.getUserCalls.mockImplementation(async (_, query) => page(query));
  mocks.users.getUser.mockImplementation(async (id) => ({ id, fullName: `Target ${id}`, email: "fixture@example.invalid", status: "Active", stats: {}, subscription: null, role: { name: "User" } }));
  mocks.users.getUserPayments.mockResolvedValue({ items: [], page: 1, totalPages: 0, totalCount: 0 });
  mocks.users.getUserTrips.mockResolvedValue({ items: [], page: 1, totalPages: 0, totalCount: 0 });
  mocks.users.lockUser.mockImplementation(() => { throw new Error("Mutation forbidden"); });
  mocks.users.unlockUser.mockImplementation(() => { throw new Error("Mutation forbidden"); });
});
afterEach(() => {
  expect(fetch).not.toHaveBeenCalled(); expect(mocks.ai.getSystemSummary).not.toHaveBeenCalled();
  expect(mocks.users.lockUser).not.toHaveBeenCalled(); expect(mocks.users.unlockUser).not.toHaveBeenCalled();
  vi.unstubAllGlobals(); vi.restoreAllMocks();
});

describe("FE3 actual User Detail AI history", () => {
  it("U01/U02 payments remain default and AI does not fetch for either old tab", async () => {
    await mount();
    expect(screen.getByRole("tab", { name: "Lịch sử thanh toán" })).toHaveAttribute("aria-selected", "true");
    await waitFor(() => expect(mocks.users.getUserPayments).toHaveBeenCalledExactlyOnceWith("target-A", { page: 1, pageSize: 10, sortBy: "createdAt", sortDirection: "desc" }));
    fireEvent.click(screen.getByRole("tab", { name: "Lịch sử chuyến đi" }));
    await waitFor(() => expect(mocks.users.getUserTrips).toHaveBeenCalledTimes(1));
    expect(mocks.ai.getUserSummary).not.toHaveBeenCalled(); expect(mocks.ai.getUserCalls).not.toHaveBeenCalled();
  });
  it("U03/U10 AI opening requests B and full-history C with distinct AbortSignals", async () => {
    await mount(); await openAi();
    expect(mocks.ai.getUserSummary).toHaveBeenCalledExactlyOnceWith("target-A", {}, { signal: expect.any(AbortSignal) });
    expect(mocks.ai.getUserCalls).toHaveBeenCalledExactlyOnceWith("target-A", { page: 1, pageSize: 10, sortBy: "startedAt", sortDirection: "desc" }, { signal: expect.any(AbortSignal) });
    expect(mocks.ai.getUserCalls.mock.lastCall[2].signal).not.toBe(mocks.ai.getUserSummary.mock.lastCall[2].signal);
  });
  it.each([{ permissions: [] }, { permissions: ["ViewRevenue"] }])("U04 $permissions alone cannot expose AI or call B/C", async ({ permissions }) => {
    mocks.auth.user.permissions = permissions; await mount();
    expect(screen.queryByRole("tab", { name: "Lịch sử AI" })).not.toBeInTheDocument();
    expect(mocks.ai.getUserSummary).not.toHaveBeenCalled(); expect(mocks.ai.getUserCalls).not.toHaveBeenCalled();
  });
  it("U04 permission revoked while selected hides and aborts both sources", async () => {
    const app = await mount(); await openAi();
    const bSignal = mocks.ai.getUserSummary.mock.lastCall[2].signal, cSignal = mocks.ai.getUserCalls.mock.lastCall[2].signal;
    mocks.auth.user = { id: "admin-A", permissions: [] }; app.rerender(view());
    expect(screen.queryByRole("tabpanel", { name: "Lịch sử AI" })).not.toBeInTheDocument();
    expect(bSignal.aborted).toBe(true); expect(cSignal.aborted).toBe(true);
    expect(mocks.ai.getUserCalls).toHaveBeenCalledTimes(1);
  });
  it("U05/U06/U08/U09 historical range and today are distinct and exact", async () => {
    await mount(); await openAi();
    expect(aiPanel()).toHaveTextContent("2026-09-14 đến 2026-10-13");
    expect(screen.getByLabelText("Lượt AI hôm nay")).toHaveTextContent("2 / 3");
    expect(aiPanel()).toHaveTextContent(formatVnDateTime(summary().today.resetAt));
    expect(metric("Lượt gọi trong kỳ")).toHaveTextContent("12");
    expect(metric("Thất bại trong kỳ")).toHaveTextContent("4");
    expect(metric("Đang xử lý trong kỳ")).toHaveTextContent("2");
    expect(metric("Thời gian trung bình (ms)")).toHaveTextContent(/^—$/);
    expect(metric("Token đầu vào")).toHaveTextContent("110"); expect(metric("Token đầu ra")).toHaveTextContent("70");
  });
  it("U07 valid zero summary/limit never becomes unlimited", async () => {
    const data = summary(); data.today = { ...data.today, used: 0, limit: 0 };
    for (const key of Object.keys(data.totals)) data.totals[key] = key === "averageDurationMs" ? null : 0;
    mocks.ai.getUserSummary.mockResolvedValue(data); await mount(); await openAi();
    expect(screen.getByLabelText("Lượt AI hôm nay")).toHaveTextContent("0 / 0");
    expect(metric("Lượt gọi trong kỳ")).toHaveTextContent("0"); expect(aiPanel()).not.toHaveTextContent("không giới hạn");
  });
  it("U11/U12/U13 draft filters are applied explicitly then Reset restores full-history", async () => {
    await mount(); await openAi();
    fireEvent.change(screen.getByLabelText("Loại yêu cầu"), { target: { value: "Explain" } });
    fireEvent.change(screen.getByLabelText("Trạng thái"), { target: { value: "InProgress" } });
    fireEvent.change(screen.getByLabelText("Từ ngày"), { target: { value: "2020-01-01" } });
    fireEvent.change(screen.getByLabelText("Đến ngày"), { target: { value: "2030-12-31" } });
    expect(mocks.ai.getUserCalls).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng bộ lọc" }));
    await waitFor(() => expect(mocks.ai.getUserCalls).toHaveBeenCalledTimes(2));
    expect(lastQuery()).toEqual({ page: 1, pageSize: 10, sortBy: "startedAt", sortDirection: "desc", kind: "Explain", status: "InProgress", from: "2020-01-01", to: "2030-12-31" });
    fireEvent.click(screen.getByRole("button", { name: "Đặt lại bộ lọc" }));
    await waitFor(() => expect(mocks.ai.getUserCalls).toHaveBeenCalledTimes(3));
    expect(lastQuery()).toEqual({ page: 1, pageSize: 10, sortBy: "startedAt", sortDirection: "desc" });
    expect(mocks.ai.getUserSummary).toHaveBeenCalledTimes(1);
  });
  it.each([{ field: "from", value: "0001-01-01" }, { field: "to", value: "9999-12-31" }])("U14 supports optional extreme $field without date cap", async ({ field, value }) => {
    await mount(); await openAi();
    fireEvent.change(screen.getByLabelText(field === "from" ? "Từ ngày" : "Đến ngày"), { target: { value } });
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng bộ lọc" }));
    await waitFor(() => expect(lastQuery()[field]).toBe(value));
    expect(lastQuery()[field === "from" ? "to" : "from"]).toBeUndefined();
  });
  it("U15 invalid date ordering blocks calls and provides accessible field error", async () => {
    await mount(); await openAi();
    fireEvent.change(screen.getByLabelText("Từ ngày"), { target: { value: "2030-01-02" } });
    fireEvent.change(screen.getByLabelText("Đến ngày"), { target: { value: "2030-01-01" } });
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng bộ lọc" }));
    expect(screen.getByLabelText("Từ ngày")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("alert")).toHaveTextContent("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.");
    expect(mocks.ai.getUserCalls).toHaveBeenCalledTimes(1);
  });
  it("U16/U17 server paging and both sort directions reset page, not summary", async () => {
    await mount(); await openAi();
    fireEvent.click(screen.getByRole("button", { name: "Sau" }));
    await waitFor(() => expect(lastQuery().page).toBe(2)); await screen.findByRole("table", { name: "Nhật ký AI" });
    fireEvent.change(screen.getByLabelText("Thứ tự bắt đầu"), { target: { value: "asc" } });
    await waitFor(() => expect(lastQuery()).toMatchObject({ page: 1, sortBy: "startedAt", sortDirection: "asc" }));
    await screen.findByRole("table", { name: "Nhật ký AI" }); fireEvent.click(screen.getByRole("button", { name: "Sau" }));
    await waitFor(() => expect(lastQuery().page).toBe(2));
    fireEvent.change(screen.getByLabelText("Loại yêu cầu"), { target: { value: "ParseRequest" } });
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng bộ lọc" }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ page: 1, kind: "ParseRequest", sortDirection: "asc" }));
    fireEvent.change(screen.getByLabelText("Thứ tự bắt đầu"), { target: { value: "desc" } });
    await waitFor(() => expect(lastQuery()).toMatchObject({ page: 1, sortBy: "startedAt", sortDirection: "desc" }));
    expect(mocks.ai.getUserSummary).toHaveBeenCalledTimes(1);
  });
  it("U18 beyond-last-page preserves server totals and offers return without invented rows", async () => {
    await mount(); await openAi();
    mocks.ai.getUserCalls.mockResolvedValueOnce({ items: [], page: 2, pageSize: 10, totalCount: 7, totalPages: 1 });
    fireEvent.click(screen.getByRole("button", { name: "Sau" }));
    await screen.findByText("7 lượt gọi · Trang 2 / 1");
    expect(history().getAllByRole("row")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Về trang đầu" })).toBeInTheDocument();
  });
  it("U19/U20/U21 status mapping, nullable metadata and colliding IDs are safe", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    await mount(); await openAi();
    for (const label of statusLabels) expect(history().getByText(label)).toBeInTheDocument();
    expect(history().getAllByRole("row")).toHaveLength(6);
    expect(history().getAllByText("—")).toHaveLength(15);
    expect(history().getAllByText("Phân tích yêu cầu")).toHaveLength(3);
    expect(history().getAllByText("Giải thích lịch trình")).toHaveLength(2);
    expect(history().getAllByText(formatVnDateTime(rows()[0].startedAt))).toHaveLength(5);
    expect(within(aiPanel()).queryByRole("link")).not.toBeInTheDocument();
    expect(errorSpy.mock.calls.flat().join(" ")).not.toMatch(/same key|unique.*key/);
  });
  it("U22 summary error leaves successful call history; retry only retries B", async () => {
    mocks.ai.getUserSummary.mockRejectedValueOnce(new Error("Summary failure")); await mount(); await openAi();
    expect(screen.getByRole("alert")).toHaveTextContent("Summary failure");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" }));
    await screen.findByLabelText("Lượt AI hôm nay"); expect(mocks.ai.getUserCalls).toHaveBeenCalledTimes(1);
  });
  it("U23 history error leaves valid summary; retry only retries C", async () => {
    mocks.ai.getUserCalls.mockRejectedValueOnce(new Error("Calls failure")); await mount();
    fireEvent.click(screen.getByRole("tab", { name: "Lịch sử AI" }));
    await screen.findByLabelText("Lượt AI hôm nay"); expect(screen.getByRole("alert")).toHaveTextContent("Calls failure");
    fireEvent.click(screen.getByRole("button", { name: "Thử lại" })); await screen.findByRole("table", { name: "Nhật ký AI" });
    expect(mocks.ai.getUserSummary).toHaveBeenCalledTimes(1);
  });
  it.each([{ code: null, label: "API nhật ký AI chưa khả dụng" }, { code: "user_not_found", label: "Không tìm thấy người dùng" }])("U24 calls 404/$code is not successful empty usage", async ({ code, label }) => {
    mocks.ai.getUserCalls.mockRejectedValue({ status: 404, code }); await mount();
    fireEvent.click(screen.getByRole("tab", { name: "Lịch sử AI" })); await screen.findByText(label);
    expect(screen.queryByRole("table", { name: "Nhật ký AI" })).not.toBeInTheDocument();
    expect(screen.getByLabelText("Lượt AI hôm nay")).toHaveTextContent("2 / 3");
  });
  it.each(["From", "To", "Kind", "Status", "Page", "PageSize", "SortBy", "SortDirection"])("400 %s error remains visible and retryable", async (field) => {
    mocks.ai.getUserCalls.mockRejectedValue({ status: 400, code: "invalid_ai_usage_query", errors: { [field]: ["Giá trị BE không hợp lệ"] } });
    await mount(); fireEvent.click(screen.getByRole("tab", { name: "Lịch sử AI" }));
    await screen.findByRole("button", { name: "Thử lại" });
    expect(screen.getAllByRole("alert").some((node) => node.textContent.includes("Giá trị BE không hợp lệ"))).toBe(true);
  });
  it.each(["resolve", "reject"])("U25 obsolete filter %s cannot replace newest page", async (completion) => {
    const old = deferred(); await mount(); await openAi(); mocks.ai.getUserCalls.mockReturnValueOnce(old.promise);
    fireEvent.change(screen.getByLabelText("Loại yêu cầu"), { target: { value: "Explain" } });
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng bộ lọc" }));
    const signal = mocks.ai.getUserCalls.mock.lastCall[2].signal;
    fireEvent.change(screen.getByLabelText("Thứ tự bắt đầu"), { target: { value: "asc" } }); await screen.findByRole("table", { name: "Nhật ký AI" });
    expect(signal.aborted).toBe(true);
    await act(async () => old[completion](completion === "resolve" ? page({ page: 1 }, [{ ...rows()[0], model: "OLD-PRIVATE" }]) : new Error("OLD-PRIVATE")));
    expect(aiPanel()).not.toHaveTextContent("OLD-PRIVATE"); expect(history().getAllByRole("row")).toHaveLength(6);
  });
  it("U26 target change aborts sources, resets tab, and ignores old private data", async () => {
    const old = deferred(); mocks.ai.getUserSummary.mockReturnValueOnce(old.promise);
    await mount(); await openAi(); const signal = mocks.ai.getUserSummary.mock.lastCall[2].signal;
    fireEvent.click(screen.getByRole("button", { name: "Đổi target" })); await screen.findByRole("heading", { name: "Target target-B" });
    expect(screen.getByRole("tab", { name: "Lịch sử thanh toán" })).toHaveAttribute("aria-selected", "true");
    expect(signal.aborted).toBe(true);
    await act(async () => old.resolve({ ...summary(), today: { used: 999, limit: 999 } }));
    expect(screen.queryByLabelText("Lượt AI hôm nay")).not.toBeInTheDocument();
    await openAi(); expect(mocks.ai.getUserSummary.mock.lastCall[0]).toBe("target-B"); expect(mocks.ai.getUserCalls.mock.lastCall[0]).toBe("target-B");
  });
  it("U27 account switch hides ready A data before deferred B resolves", async () => {
    const app = await mount(); await openAi();
    const b = deferred(), c = deferred(); mocks.ai.getUserSummary.mockReturnValueOnce(b.promise); mocks.ai.getUserCalls.mockReturnValueOnce(c.promise);
    mocks.auth.user = { id: "admin-B", permissions: ["ManageUsers"] }; app.rerender(view());
    expect(screen.queryByLabelText("Lượt AI hôm nay")).not.toBeInTheDocument();
    expect(screen.queryByRole("table", { name: "Nhật ký AI" })).not.toBeInTheDocument();
    await act(async () => { b.resolve({ ...summary(), today: { used: 1, limit: 1 } }); c.resolve(page({ page: 1 }, [])); });
    expect(screen.getByLabelText("Lượt AI hôm nay")).toHaveTextContent("1 / 1");
  });
  it.each(["resolve", "reject"])("U27 B finishes before obsolete A %s; A cannot reappear", async (completion) => {
    const oldB = deferred(), oldC = deferred(); mocks.ai.getUserSummary.mockReturnValueOnce(oldB.promise); mocks.ai.getUserCalls.mockReturnValueOnce(oldC.promise);
    const app = await mount(); fireEvent.click(screen.getByRole("tab", { name: "Lịch sử AI" }));
    const signal = mocks.ai.getUserCalls.mock.lastCall[2].signal;
    mocks.auth.user = { id: "admin-B", permissions: ["ManageUsers"] }; app.rerender(view()); await screen.findByRole("table", { name: "Nhật ký AI" });
    expect(signal.aborted).toBe(true);
    await act(async () => { oldB[completion](completion === "resolve" ? { ...summary(), from: "OLD-PRIVATE" } : new Error("OLD-PRIVATE")); oldC[completion](completion === "resolve" ? page({ page: 1 }, [{ ...rows()[0], model: "OLD-PRIVATE" }]) : new Error("OLD-PRIVATE")); });
    expect(aiPanel()).not.toHaveTextContent("OLD-PRIVATE");
  });
  it("U28 closing AI tab aborts both; reopening makes fresh requests", async () => {
    const pending = deferred(); mocks.ai.getUserCalls.mockReturnValueOnce(pending.promise);
    await mount(); fireEvent.click(screen.getByRole("tab", { name: "Lịch sử AI" })); const signal = mocks.ai.getUserCalls.mock.lastCall[2].signal;
    fireEvent.click(screen.getByRole("tab", { name: "Lịch sử thanh toán" })); expect(signal.aborted).toBe(true);
    await act(async () => pending.resolve(page({ page: 1 }, [{ ...rows()[0], model: "OLD-PRIVATE" }])));
    await openAi(); expect(aiPanel()).not.toHaveTextContent("OLD-PRIVATE"); expect(mocks.ai.getUserCalls).toHaveBeenCalledTimes(2);
  });
  it("U29 existing Trips query unchanged, returning Payments reloads only Payments", async () => {
    await mount(); await openAi(); fireEvent.click(screen.getByRole("tab", { name: "Lịch sử chuyến đi" }));
    await waitFor(() => expect(mocks.users.getUserTrips).toHaveBeenCalledExactlyOnceWith("target-A", { status: "", includeDeleted: false, page: 1, pageSize: 10, sortBy: "createdAt", sortDirection: "desc" }));
    fireEvent.click(screen.getByRole("tab", { name: "Lịch sử thanh toán" })); await waitFor(() => expect(mocks.users.getUserPayments).toHaveBeenCalledTimes(2));
    expect(mocks.ai.getUserCalls).toHaveBeenCalledTimes(1); expect(mocks.ai.getUserSummary).toHaveBeenCalledTimes(1);
  });
  it("U31/U32 mobile records and tabs/filters retain semantic labels and relationships", async () => {
    await mount(); await openAi();
    expect(screen.getByRole("tab", { name: "Lịch sử AI" })).toHaveAttribute("aria-controls", "user-history-panel-ai");
    expect(aiPanel()).toHaveAttribute("aria-labelledby", "user-history-ai");
    expect(within(screen.getByLabelText("Nhật ký AI trên di động")).getAllByRole("article")).toHaveLength(5);
    expect(screen.getByRole("table", { name: "Nhật ký AI" }).parentElement).toHaveClass("overflow-x-auto");
    screen.getByLabelText("Từ ngày").focus(); fireEvent.change(screen.getByLabelText("Từ ngày"), { target: { value: "2026-10-01" } });
    expect(screen.getByLabelText("Từ ngày")).toHaveFocus();
    expect(screen.queryByRole("searchbox")).not.toBeInTheDocument();
  });
  it("direct tab consumer also denies permission without requests", async () => {
    mocks.auth.user.permissions = []; render(<UserAiUsageTab userId="target-A" />);
    expect(mocks.ai.getUserCalls).not.toHaveBeenCalled(); expect(mocks.ai.getUserSummary).not.toHaveBeenCalled();
  });
  it.each(statuses)("U11 status filter sends exact %s without fetching draft", async (status) => {
    await mount(); await openAi();
    fireEvent.change(screen.getByLabelText("Trạng thái"), { target: { value: status } });
    expect(mocks.ai.getUserCalls).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng bộ lọc" }));
    await waitFor(() => expect(lastQuery()).toMatchObject({ status, page: 1 }));
  });
  it("U21 exactly identical source rows still receive unique render keys", async () => {
    mocks.ai.getUserCalls.mockImplementation(async (_, query) => page(query, [rows()[0], { ...rows()[0] }]));
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    await mount(); await openAi();
    expect(history().getAllByRole("row")).toHaveLength(3);
    expect(spy.mock.calls.flat().join(" ")).not.toMatch(/same key|unique.*key/);
  });
  it("U25 pending old page is aborted when a filter is applied", async () => {
    const old = deferred(); await mount(); await openAi(); mocks.ai.getUserCalls.mockReturnValueOnce(old.promise);
    fireEvent.click(screen.getByRole("button", { name: "Sau" })); const signal = mocks.ai.getUserCalls.mock.lastCall[2].signal;
    fireEvent.change(screen.getByLabelText("Loại yêu cầu"), { target: { value: "Explain" } });
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng bộ lọc" })); await screen.findByRole("table", { name: "Nhật ký AI" });
    await act(async () => old.resolve(page({ page: 2 }, [{ ...rows()[0], model: "OLD-PAGE" }])));
    expect(signal.aborted).toBe(true); expect(aiPanel()).not.toHaveTextContent("OLD-PAGE"); expect(lastQuery()).toMatchObject({ page: 1, kind: "Explain" });
  });
  it("logout aborts pending requests and hides private AI before their completion", async () => {
    const b = deferred(), c = deferred(); mocks.ai.getUserSummary.mockReturnValueOnce(b.promise); mocks.ai.getUserCalls.mockReturnValueOnce(c.promise);
    const app = await mount(); fireEvent.click(screen.getByRole("tab", { name: "Lịch sử AI" }));
    const signal = mocks.ai.getUserCalls.mock.lastCall[2].signal;
    mocks.auth.user = null; app.rerender(view());
    await act(async () => { b.resolve(summary()); c.reject(new Error("OLD-PRIVATE")); });
    expect(signal.aborted).toBe(true); expect(screen.queryByLabelText("Lượt AI hôm nay")).not.toBeInTheDocument();
    expect(screen.queryByText("OLD-PRIVATE")).not.toBeInTheDocument();
  });
  it("loading B/C render named status with no fabricated totals", async () => {
    mocks.ai.getUserSummary.mockReturnValue(new Promise(() => {})); mocks.ai.getUserCalls.mockReturnValue(new Promise(() => {}));
    await mount(); fireEvent.click(screen.getByRole("tab", { name: "Lịch sử AI" }));
    expect(within(aiPanel()).getAllByRole("status")).toHaveLength(2);
    expect(screen.queryByLabelText("Lượt AI hôm nay")).not.toBeInTheDocument(); expect(screen.queryByRole("table", { name: "Nhật ký AI" })).not.toBeInTheDocument();
  });
  it("valid empty history retains zero server metadata and missing summary fields stay neutral", async () => {
    mocks.ai.getUserCalls.mockResolvedValue({ items: [], page: 1, pageSize: 10, totalCount: 0, totalPages: 0 });
    mocks.ai.getUserSummary.mockResolvedValue({ ...summary(), today: {}, totals: {} });
    await mount(); await openAi();
    // totalCount 0 giữ nguyên; totalPages 0 hiện là 1 trang để không ra "Trang 1 / 0"
    expect(aiPanel()).toHaveTextContent("0 lượt gọi · Trang 1 / 1");
    expect(screen.getByLabelText("Lượt AI hôm nay")).toHaveTextContent("— / —");
    expect(metric("Thất bại trong kỳ")).toHaveTextContent("—");
    expect(history().getAllByRole("row")).toHaveLength(1);
  });
  it.each([{ code: null, label: "API mức sử dụng AI chưa khả dụng" }, { code: "user_not_found", label: "Không tìm thấy người dùng" }])("U24 summary 404/$code does not fabricate quota", async ({ code, label }) => {
    mocks.ai.getUserSummary.mockRejectedValue({ status: 404, code }); await mount(); await openAi();
    expect(screen.getByText(label)).toBeInTheDocument(); expect(screen.queryByLabelText("Lượt AI hôm nay")).not.toBeInTheDocument();
  });
});
