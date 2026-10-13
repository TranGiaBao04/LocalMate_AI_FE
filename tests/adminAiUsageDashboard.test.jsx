import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import AdminDashboardPage from "../src/pages/admin/AdminDashboardPage";
import { countFormatter } from "../src/components/admin/dashboard/dashboardUtils";

const mocks = vi.hoisted(() => ({
  auth: { user: null }, ai: { getSystemSummary: vi.fn(), getUserSummary: vi.fn(), getUserCalls: vi.fn() },
  business: { getSummary: vi.fn(), getRevenueDaily: vi.fn(), getTripsFinalizedDaily: vi.fn(), getTopStations: vi.fn(), getBreakEven: vi.fn() },
  stations: { getStations: vi.fn() }, places: { getPlaces: vi.fn() },
}));
vi.mock("../src/context/AuthContext", () => ({ useAuth: () => mocks.auth }));
vi.mock("../src/services/adminAiUsageService", () => ({ adminAiUsageService: mocks.ai }));
vi.mock("../src/services/adminDashboardService", () => ({ adminDashboardService: mocks.business }));
vi.mock("../src/services/adminStationService", () => ({ adminStationService: mocks.stations }));
vi.mock("../src/services/adminPlaceService", () => ({ adminPlaceService: mocks.places }));

const target = { userId: "target-1", fullName: "Người dùng kiểm thử", email: "fixture@example.invalid", calls: 10, inputTokens: 110, outputTokens: 70 };
const day = { date: "2026-10-13", calls: 10, succeeded: 3, failed: 4, inputTokens: 110, outputTokens: 70, activeUsers: 2 };
const fixture = () => ({
  from: "2026-09-14", to: "2026-10-13", generatedAt: "2026-10-13T02:23:00Z",
  totals: { calls: 10, succeeded: 3, providerFailed: 2, invalidOutput: 1, abandoned: 1, inProgress: 3, inputTokens: 110, outputTokens: 70, averageDurationMs: null, activeUsers: 2 },
  byKind: [{ kind: "ParseRequest", calls: 7, succeeded: 2, inputTokens: 77, outputTokens: 49 }, { kind: "Explain", calls: 3, succeeded: 1, inputTokens: 33, outputTokens: 21 }],
  days: [day], topUsers: [target],
});
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const view = () => <MemoryRouter><AdminDashboardPage /></MemoryRouter>;
const mount = (permissions = ["ViewRevenue"], id = "admin-A") => {
  mocks.auth.user = { id, fullName: "Quản trị kiểm thử", permissions };
  return render(view());
};
const panel = () => screen.getByRole("region", { name: "Lượt dùng AI" });
const ready = async () => { await screen.findByRole("article", { name: "Tổng lượt AI" }); };
const metric = (name) => within(panel()).getByRole("article", { name });

beforeEach(() => {
  vi.resetAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
  vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Unexpected live network request"); }));
  mocks.ai.getSystemSummary.mockResolvedValue(fixture());
  mocks.ai.getUserSummary.mockImplementation(() => { throw new Error("API B forbidden in FE2"); });
  mocks.ai.getUserCalls.mockImplementation(() => { throw new Error("API C forbidden in FE2"); });
  mocks.business.getSummary.mockResolvedValue({ newUsers: 17, tripsCreated: 3, paidOrders: 1, revenue: 15000, generatedAt: "2026-10-13T01:00:00Z" });
  mocks.business.getRevenueDaily.mockResolvedValue({ days: [], totalRevenue: 0 });
  mocks.business.getTripsFinalizedDaily.mockResolvedValue({ days: [], totalTripsFinalized: 0 });
  mocks.business.getTopStations.mockResolvedValue({ stations: [], totalTrips: 0 });
  mocks.business.getBreakEven.mockResolvedValue(null);
  mocks.stations.getStations.mockResolvedValue({ stations: [] });
  mocks.places.getPlaces.mockResolvedValue([]);
});
afterEach(() => {
  expect(mocks.ai.getUserSummary).not.toHaveBeenCalled();
  expect(mocks.ai.getUserCalls).not.toHaveBeenCalled();
  expect(fetch).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("FE2 real Dashboard AI integration", () => {
  it("D01 ViewRevenue loads API A in the section after business", async () => {
    mount(); await ready();
    expect(mocks.ai.getSystemSummary).toHaveBeenCalledExactlyOnceWith({ from: "2026-09-14", to: "2026-10-13" });
    const sections = [...document.querySelectorAll("section")];
    expect(sections.indexOf(panel())).toBe(sections.indexOf(screen.getByRole("region", { name: "Kinh doanh" })) + 1);
  });
  it.each([{ permissions: ["ManagePlaces"] }, { permissions: ["ManageUsers"] }, { permissions: [] }])("D02/D03 unauthorized $permissions never loads or renders global AI", async ({ permissions }) => {
    mount(permissions); await act(async () => {});
    expect(screen.queryByRole("region", { name: "Lượt dùng AI" })).not.toBeInTheDocument();
    expect(mocks.ai.getSystemSummary).not.toHaveBeenCalled();
  });
  it("D04 revenue-only exposes authorized aggregate without user profile links", async () => {
    mount(); await ready();
    expect(within(panel()).getByText(target.fullName)).toBeInTheDocument();
    expect(within(panel()).queryByRole("link")).not.toBeInTheDocument();
  });
  it("D05 ManageUsers also permits exact user detail link", async () => {
    mount(["ViewRevenue", "ManageUsers"]); await ready();
    expect(within(panel()).getByRole("link", { name: target.fullName })).toHaveAttribute("href", "/admin/users/target-1");
  });
  it.each([["7 ngày", "2026-10-07", 2], ["30 ngày", "2026-09-14", 1], ["Tháng này", "2026-10-01", 2]])("D06 %s uses the exact shared range with no duplicate fetch", async (label, from, calls) => {
    mount(); await ready();
    fireEvent.click(screen.getByRole("button", { name: label }));
    await waitFor(() => expect(mocks.ai.getSystemSummary).toHaveBeenCalledTimes(calls));
    expect(mocks.ai.getSystemSummary.mock.lastCall).toEqual([{ from, to: "2026-10-13" }]);
    expect(mocks.business.getSummary.mock.lastCall[0]).toEqual({ from, to: "2026-10-13" });
  });
  it("D07/D08 editing custom dates waits for Apply then issues one request", async () => {
    mount(); await ready();
    fireEvent.click(screen.getByRole("button", { name: "Tùy chọn" }));
    fireEvent.change(screen.getByLabelText("Từ ngày"), { target: { value: "2026-10-02" } });
    fireEvent.change(screen.getByLabelText("Đến ngày"), { target: { value: "2026-10-05" } });
    expect(mocks.ai.getSystemSummary).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
    await waitFor(() => expect(mocks.ai.getSystemSummary).toHaveBeenCalledTimes(2));
    expect(mocks.ai.getSystemSummary.mock.lastCall).toEqual([{ from: "2026-10-02", to: "2026-10-05" }]);
  });
  it("D09/D10 coordinated refresh preserves AI's cached timestamp", async () => {
    mount(); await ready();
    expect(within(panel()).getByText("09:23")).toHaveAttribute("dateTime", fixture().generatedAt);
    expect(panel()).toHaveTextContent("5 phút");
    fireEvent.click(screen.getByRole("button", { name: "Tải lại" }));
    await ready();
    expect(mocks.ai.getSystemSummary).toHaveBeenCalledTimes(2);
    expect(mocks.business.getSummary).toHaveBeenCalledTimes(2);
    expect(within(panel()).getByText("09:23")).toHaveAttribute("dateTime", fixture().generatedAt);
  });
  it("loading never displays factual zero totals", async () => {
    mocks.ai.getSystemSummary.mockReturnValue(new Promise(() => {}));
    mount();
    await act(async () => {});
    expect(screen.getByRole("article", { name: "Người dùng mới" })).toHaveTextContent("17");
    expect(within(panel()).getByRole("status")).toHaveTextContent("Đang tải thống kê AI...");
    expect(within(panel()).queryByRole("article")).not.toBeInTheDocument();
  });
  it("D11 valid empty summary displays authoritative zeros", async () => {
    const data = fixture();
    for (const key of Object.keys(data.totals)) data.totals[key] = key === "averageDurationMs" ? null : 0;
    data.topUsers = []; mocks.ai.getSystemSummary.mockResolvedValue(data);
    mount(); await ready();
    for (const name of ["Tổng lượt AI", "Thành công", "Thất bại", "Tổng token", "Người dùng hoạt động", "Đang xử lý"]) expect(metric(name)).toHaveTextContent("0");
    expect(panel()).not.toHaveTextContent("chưa khả dụng");
  });
  it("D12 404 is retryable unavailable, never zero success", async () => {
    mocks.ai.getSystemSummary.mockRejectedValueOnce({ status: 404 });
    mount(); await screen.findByText("API thống kê AI chưa khả dụng trên môi trường hiện tại.");
    expect(within(panel()).queryByRole("article")).not.toBeInTheDocument();
    fireEvent.click(within(panel()).getByRole("button", { name: "Thử lại" }));
    await ready(); expect(mocks.ai.getSystemSummary).toHaveBeenCalledTimes(2);
  });
  it("D13 other errors stay source-owned and retryable", async () => {
    mocks.ai.getSystemSummary.mockRejectedValueOnce(new Error("AI source failure"));
    mount(); expect(await within(panel()).findByRole("alert")).toHaveTextContent("AI source failure");
    fireEvent.click(within(panel()).getByRole("button", { name: "Thử lại" }));
    await ready(); expect(mocks.business.getSummary).toHaveBeenCalledTimes(1);
  });
  it("D14 AI field errors reach existing custom range fields", async () => {
    mocks.ai.getSystemSummary.mockRejectedValueOnce({ status: 400, code: "invalid_ai_usage_query", errors: { From: ["From không hợp lệ."], To: ["To không hợp lệ."] } });
    mount(); await within(panel()).findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Tùy chọn" }));
    expect(screen.getByLabelText("Từ ngày")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Đến ngày")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Ngày bắt đầu không hợp lệ.")).toBeInTheDocument();
    expect(screen.getByText("Ngày kết thúc không hợp lệ.")).toBeInTheDocument();
  });
  it("D15/D16 exact tokens and failed exclude InProgress", async () => {
    mount(); await ready();
    expect(metric("Tổng token")).toHaveTextContent("180");
    expect(metric("Thất bại")).toHaveTextContent("4");
    expect(metric("Đang xử lý")).toHaveTextContent("3");
    expect(within(panel()).getByText("Token đầu vào").nextElementSibling).toHaveTextContent("110");
    expect(within(panel()).getByText("Token đầu ra").nextElementSibling).toHaveTextContent("70");
  });
  it("D17 null duration is a neutral placeholder, not zero", async () => {
    mount(); await ready();
    expect(within(panel()).getByText("Thời gian xử lý trung bình").nextElementSibling).toHaveTextContent(/^—$/);
  });
  it("D18 each Backend kind displays its own exact metrics", async () => {
    mount(); await ready();
    for (const kind of fixture().byKind) {
      const row = within(panel()).getByRole("article", { name: kind.kind });
      for (const [label, key] of [["Lượt gọi", "calls"], ["Thành công", "succeeded"], ["Token vào", "inputTokens"], ["Token ra", "outputTokens"]]) {
        expect(within(row).getByText(label).nextElementSibling).toHaveTextContent(countFormatter.format(kind[key]));
      }
    }
  });
  it("D19 daily visualization and full table preserve Vietnam calendar data", async () => {
    mount(); await ready();
    expect(within(panel()).getByRole("img")).toHaveAccessibleName(/13\/10.*giờ Việt Nam/);
    fireEvent.click(within(panel()).getByText("Dữ liệu AI theo ngày"));
    const table = within(panel()).getByRole("table");
    expect(within(table).getByText("13/10/2026")).toHaveAttribute("dateTime", day.date);
    expect(within(table).getAllByRole("row")[1]).toHaveTextContent("10");
    expect(within(table).getAllByRole("cell").map((cell) => cell.textContent)).toEqual(["10", "3", "4", "110", "70", "2"]);
  });
  it("D20 empty Top Users has a genuine empty state", async () => {
    mocks.ai.getSystemSummary.mockResolvedValue({ ...fixture(), topUsers: [] });
    mount(); await ready(); expect(panel()).toHaveTextContent("Chưa có người dùng sử dụng AI trong khoảng này");
  });
  it.each(["resolve", "reject"])("D21 old range %s cannot replace current data", async (completion) => {
    const pending = deferred(); mocks.ai.getSystemSummary.mockReturnValueOnce(pending.promise);
    mount(); fireEvent.click(screen.getByRole("button", { name: "7 ngày" })); await ready();
    await act(async () => pending[completion](completion === "resolve" ? { ...fixture(), totals: { ...fixture().totals, calls: 999 } } : new Error("obsolete range")));
    expect(metric("Tổng lượt AI")).toHaveTextContent("10");
    expect(panel()).not.toHaveTextContent("999"); expect(panel()).not.toHaveTextContent("obsolete range");
  });
  it("D22 ready A metrics disappear immediately when owner changes; late A cannot update B", async () => {
    const aRefresh = deferred(), b = deferred();
    const app = mount(); await ready();
    mocks.ai.getSystemSummary.mockReturnValueOnce(aRefresh.promise);
    fireEvent.click(screen.getByRole("button", { name: "Tải lại" }));
    mocks.ai.getSystemSummary.mockReturnValueOnce(b.promise);
    mocks.auth.user = { id: "admin-B", fullName: "B", permissions: ["ViewRevenue"] };
    app.rerender(view());
    expect(within(panel()).queryByRole("article")).not.toBeInTheDocument();
    await act(async () => aRefresh.resolve({ ...fixture(), totals: { ...fixture().totals, calls: 999 } }));
    expect(panel()).not.toHaveTextContent("999");
    await act(async () => b.resolve({ ...fixture(), totals: { ...fixture().totals, calls: 2 }, topUsers: [] }));
    expect(metric("Tổng lượt AI")).toHaveTextContent("2");
    expect(mocks.ai.getSystemSummary).toHaveBeenCalledTimes(3);
  });
  it("D22 ready A data never renders while B request is pending", async () => {
    const app = mount(); await ready();
    mocks.ai.getSystemSummary.mockReturnValue(new Promise(() => {}));
    mocks.auth.user = { id: "admin-B", permissions: ["ViewRevenue"] }; app.rerender(view());
    expect(within(panel()).queryByText(target.fullName)).not.toBeInTheDocument();
    expect(within(panel()).getByRole("status")).toHaveTextContent("Đang tải thống kê AI...");
  });
  it.each(["resolve", "reject"])("D22 B finishes first; late A %s cannot replace data or errors", async (completion) => {
    const a = deferred(); mocks.ai.getSystemSummary.mockReturnValueOnce(a.promise);
    const app = mount();
    mocks.ai.getSystemSummary.mockResolvedValue({ ...fixture(), totals: { ...fixture().totals, calls: 23 }, topUsers: [] });
    mocks.auth.user = { id: "admin-B", permissions: ["ViewRevenue"] }; app.rerender(view()); await ready();
    await act(async () => a[completion](completion === "resolve" ? fixture() : new Error("A private error")));
    expect(metric("Tổng lượt AI")).toHaveTextContent("23");
    expect(panel()).not.toHaveTextContent(target.fullName);
    expect(within(panel()).queryByRole("alert")).not.toBeInTheDocument();
  });
  it("removing ManageUsers removes profile links without refetching AI", async () => {
    const app = mount(["ViewRevenue", "ManageUsers"]); await ready();
    mocks.auth.user = { id: "admin-A", permissions: ["ViewRevenue"] }; app.rerender(view());
    expect(within(panel()).queryByRole("link")).not.toBeInTheDocument();
    expect(mocks.ai.getSystemSummary).toHaveBeenCalledTimes(1);
  });
  it("D23 permission removal hides data and prevents stale completion; restoration reloads", async () => {
    const pending = deferred(); mocks.ai.getSystemSummary.mockReturnValueOnce(pending.promise);
    const app = mount();
    mocks.auth.user = { id: "admin-A", permissions: ["ManageUsers"] }; app.rerender(view());
    await act(async () => pending.resolve(fixture()));
    expect(screen.queryByRole("region", { name: "Lượt dùng AI" })).not.toBeInTheDocument();
    expect(mocks.ai.getSystemSummary).toHaveBeenCalledTimes(1);
    mocks.auth.user = { id: "admin-A", permissions: ["ViewRevenue"] }; app.rerender(view()); await ready();
    expect(mocks.ai.getSystemSummary).toHaveBeenCalledTimes(2);
  });
  it("logout/unmount suppresses late completion without further access", async () => {
    const pending = deferred(); mocks.ai.getSystemSummary.mockReturnValueOnce(pending.promise);
    const app = mount(); mocks.auth.user = null; app.rerender(view());
    app.unmount(); await act(async () => pending.reject(new Error("obsolete session")));
    expect(mocks.ai.getSystemSummary).toHaveBeenCalledTimes(1);
  });
  it("D24 366 dates and long identity stay in bounded chart/table without fabricating users", async () => {
    const data = fixture();
    data.days = Array.from({ length: 366 }, (_, i) => ({ ...day, date: new Date(Date.UTC(2025, 9, 13 + i)).toISOString().slice(0, 10) }));
    data.topUsers = Array.from({ length: 12 }, (_, i) => ({ ...target, userId: `user-${i}`, fullName: "Tênrấtdài".repeat(70), email: `${"long".repeat(70)}@example.invalid` }));
    mocks.ai.getSystemSummary.mockResolvedValue(data); mount(); await ready();
    expect(within(panel()).getAllByRole("listitem")).toHaveLength(10);
    expect(within(panel()).getByRole("img").children).toHaveLength(366);
    expect(within(panel()).getByRole("img")).toHaveAccessibleName("Lượt gọi AI theo ngày từ 13/10/2025 đến 13/10/2026, giờ Việt Nam");
    expect(within(panel()).getByRole("img").nextElementSibling).toHaveTextContent("13/10/2025");
    expect(within(panel()).getByRole("img").nextElementSibling).toHaveTextContent("13/10/2026");
    expect(within(panel()).getByRole("img")).toHaveClass("min-w-0", "gap-0");
    fireEvent.click(within(panel()).getByText("Dữ liệu AI theo ngày"));
    expect(within(panel()).getByRole("region", { name: "Bảng lượt dùng AI theo ngày" })).toHaveClass("overflow-auto", "max-w-full");
    expect(within(panel()).getAllByRole("row")).toHaveLength(367);
  });
  it("D25 AI failure does not hide valid business metrics", async () => {
    mocks.ai.getSystemSummary.mockRejectedValue(new Error("AI failed")); mount();
    await within(panel()).findByRole("alert");
    expect(screen.getByRole("article", { name: "Người dùng mới" })).toHaveTextContent("17");
  });
  it("business failure does not hide valid AI metrics", async () => {
    mocks.business.getSummary.mockRejectedValue(new Error("Business failed")); mount(); await ready();
    expect(metric("Tổng lượt AI")).toHaveTextContent("10");
    expect(screen.getByRole("alert")).toHaveTextContent("Business failed");
  });
  it("missing fields never turn into invented zero metrics", async () => {
    mocks.ai.getSystemSummary.mockResolvedValue({ ...fixture(), totals: {} }); mount(); await ready();
    expect(metric("Tổng token")).toHaveTextContent("—");
    expect(metric("Thất bại")).toHaveTextContent("—");
  });
});
