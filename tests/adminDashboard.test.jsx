import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import AdminDashboardPage from "../src/pages/admin/AdminDashboardPage";
import { validateRange, vndFormatter } from "../src/components/admin/dashboard/dashboardUtils";

const mocks = vi.hoisted(() => ({
  auth: { user: null },
  dashboard: { getSummary: vi.fn(), getRevenueDaily: vi.fn(), getTripsFinalizedDaily: vi.fn(), getTopStations: vi.fn(), getBreakEven: vi.fn() },
  stations: { getStations: vi.fn() },
  places: { getPlaces: vi.fn() },
}));
vi.mock("../src/context/AuthContext", () => ({ useAuth: () => mocks.auth }));
vi.mock("../src/services/adminDashboardService", () => ({ adminDashboardService: mocks.dashboard }));
vi.mock("../src/services/adminStationService", () => ({ adminStationService: mocks.stations }));
vi.mock("../src/services/adminPlaceService", () => ({ adminPlaceService: mocks.places }));

const station = { id: "s1", order: 1, name: "Bến Thành", totals: { active: 8 }, isUnderstocked: false, shortfall: 0 };
const coverage = { stations: [station, { ...station, id: "s2", order: 2, name: "Ga cần dữ liệu", totals: { active: 1 }, isUnderstocked: true, shortfall: 4 }], radiusMeters: 800, minActivePlacesPerStation: 5 };
const summary = { newUsers: 17, tripsCreated: 29, paidOrders: 7, revenue: 1234567, generatedAt: "2026-10-07T02:00:00Z" };
const revenue = { days: [{ date: "2026-10-06", revenue: 200000, paidOrders: 2 }, { date: "2026-10-07", revenue: 100000, paidOrders: 1 }], totalRevenue: 300000 };
const finalized = { days: [{ date: "2026-10-06", tripsFinalized: 3 }, { date: "2026-10-07", tripsFinalized: 5 }], totalTripsFinalized: 8 };
const breakEven = { month: "2026-10", target: 8000000, revenue: 900000, remaining: 7100000, projected: 3985714, progressPercent: 11.25, paidOrders: 7, daysElapsed: 7, daysInMonth: 31, isAchieved: false };
const mount = (permissions = ["ViewRevenue", "ManagePlaces"]) => {
  mocks.auth.user = { fullName: "Minh", permissions };
  return render(<MemoryRouter><AdminDashboardPage /></MemoryRouter>);
};
const ready = async () => { await screen.findByRole("article", { name: "Người dùng mới" }); await waitFor(() => expect(screen.getByRole("article", { name: "Người dùng mới" })).toHaveTextContent("17")); };
const metric = (name) => screen.getByRole("article", { name });
beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-10-07T03:00:00Z"));
  mocks.dashboard.getSummary.mockResolvedValue(summary);
  mocks.dashboard.getRevenueDaily.mockResolvedValue(revenue);
  mocks.dashboard.getTripsFinalizedDaily.mockResolvedValue(finalized);
  mocks.dashboard.getTopStations.mockResolvedValue({ totalTrips: 20, stations: [{ order: 8, name: "Ga server xếp đầu", tripCount: 4, sharePercent: 20 }, { order: 1, name: "Ga server xếp sau", tripCount: 2, sharePercent: 10 }] });
  mocks.dashboard.getBreakEven.mockResolvedValue(breakEven);
  mocks.stations.getStations.mockResolvedValue(coverage);
  mocks.places.getPlaces.mockResolvedValue({ items: [{ status: "Pending" }, { status: "Active", isVerified: false }, { status: "Active", isVerified: true }], totalCount: 900, page: 1 });
});
afterEach(() => vi.useRealTimers());

describe("A3 Dashboard preservation contract", () => {
  it("T01 exact four summary values, no fabricated comparisons", async () => {
    mount(); await ready();
    expect(metric("Lịch trình đã tạo")).toHaveTextContent("29");
    expect(metric("Đơn đã thanh toán")).toHaveTextContent("7");
    expect(metric("Doanh thu").textContent).toContain(vndFormatter.format(summary.revenue));
    expect(screen.queryByText(/so với tháng trước|↑|↓/)).not.toBeInTheDocument();
  });
  it("T02 ManagePlaces-only does not call or expose business data", async () => {
    mount(["ManagePlaces"]); await screen.findByText(station.name);
    for (const fn of Object.values(mocks.dashboard)) expect(fn).not.toHaveBeenCalled();
    expect(screen.queryByRole("article", { name: "Doanh thu" })).not.toBeInTheDocument();
    expect(screen.queryByRole("group", { name: "Khoảng thời gian" })).not.toBeInTheDocument();
  });
  it("T03 Metro uses exact server coverage and thresholds", async () => {
    mount(["ManagePlaces"]); await waitFor(() => expect(metric("Ga có dữ liệu")).toHaveTextContent("2"));
    expect(metric("Địa điểm quanh ga")).toHaveTextContent("9");
    expect(metric("Ga thiếu dữ liệu")).toHaveTextContent("1");
    expect(screen.getByText(/bán kính 800 m/)).toBeInTheDocument();
    expect(screen.getByText(/thiếu 4/)).toBeInTheDocument();
  });
  it("T04 Revenue-only gates station/place calls and renders Top standalone", async () => {
    mount(["ViewRevenue"]); await ready();
    expect(mocks.stations.getStations).not.toHaveBeenCalled();
    expect(mocks.places.getPlaces).not.toHaveBeenCalled();
    expect(screen.queryByRole("article", { name: "Ga có dữ liệu" })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Ga được chọn nhiều nhất" })).toBeInTheDocument();
  });
  it("portal permission without either optional Dashboard permission only gets permitted navigation", async () => {
    mount(["ManageSettings"]); await act(async () => {});
    for (const fn of Object.values(mocks.dashboard)) expect(fn).not.toHaveBeenCalled();
    expect(mocks.stations.getStations).not.toHaveBeenCalled();
    expect(mocks.places.getPlaces).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Cấu hình hệ thống" })).toHaveAttribute("href", "/admin/settings");
    expect(screen.queryByRole("link", { name: /Giao dịch PayOS/ })).not.toBeInTheDocument();
  });
  it.each([
    ["7 ngày", "2026-10-01"],
    ["30 ngày", "2026-09-08"],
    ["Tháng này", "2026-10-01"],
  ])("T05-07 %s preserves inclusive Vietnam range", async (label, from) => {
    mount(); await ready();
    fireEvent.click(screen.getByRole("button", { name: label }));
    await waitFor(() => expect(mocks.dashboard.getSummary.mock.lastCall[0]).toEqual({ from, to: "2026-10-07" }));
    expect(mocks.dashboard.getRevenueDaily.mock.lastCall[0]).toEqual({ from, to: "2026-10-07" });
    expect(mocks.dashboard.getBreakEven).toHaveBeenCalledTimes(1);
  });
  it("T08 custom editing waits for Apply; changes four range sources only", async () => {
    mount(); await ready();
    fireEvent.click(screen.getByRole("button", { name: "Tùy chọn" }));
    fireEvent.change(screen.getByLabelText("Từ ngày"), { target: { value: "2026-10-02" } });
    fireEvent.change(screen.getByLabelText("Đến ngày"), { target: { value: "2026-10-05" } });
    expect(mocks.dashboard.getSummary).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
    await waitFor(() => expect(mocks.dashboard.getSummary.mock.lastCall[0]).toEqual({ from: "2026-10-02", to: "2026-10-05" }));
    expect(mocks.dashboard.getBreakEven).toHaveBeenCalledTimes(1);
  });
  it("T09 invalid custom retains meaningful validation and blocks requests", async () => {
    mount(); await ready();
    fireEvent.click(screen.getByRole("button", { name: "Tùy chọn" }));
    fireEvent.change(screen.getByLabelText("Từ ngày"), { target: { value: "2026-10-08" } });
    fireEvent.click(screen.getByRole("button", { name: "Áp dụng" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.");
    expect(mocks.dashboard.getSummary).toHaveBeenCalledTimes(1);
  });
  it("T09 existing required/future/max366 rules retained", () => {
    expect(validateRange({ from: "", to: "" }, "2026-10-07")).toEqual({ from: "Chọn ngày bắt đầu.", to: "Chọn ngày kết thúc." });
    expect(validateRange({ from: "2026-10-01", to: "2026-10-08" }, "2026-10-07").to).toMatch(/sau hôm nay/);
    expect(validateRange({ from: "2025-01-01", to: "2026-10-07" }, "2026-10-07").from).toMatch(/366/);
  });
  it("T10 Top5/10/14 changes only top query, preserves server ranking/share denominator", async () => {
    mount(); await ready();
    expect(mocks.dashboard.getTopStations.mock.lastCall[0].limit).toBe(5);
    for (const limit of [10, 14, 5]) {
      fireEvent.change(screen.getByRole("combobox", { name: "Hiển thị" }), { target: { value: String(limit) } });
      await waitFor(() => expect(mocks.dashboard.getTopStations.mock.lastCall[0].limit).toBe(limit));
    }
    expect(mocks.dashboard.getSummary).toHaveBeenCalledTimes(1);
    const list = screen.getByText("Ga server xếp đầu").closest("ol");
    expect(within(list).getAllByRole("listitem")[0]).toHaveTextContent("Ga server xếp đầu");
    expect(list).toHaveTextContent("20%");
  });
  it("T11 break-even month changes only independent month query", async () => {
    mount(); await ready();
    fireEvent.change(screen.getByRole("combobox", { name: "Tháng" }), { target: { value: "2026-09" } });
    await waitFor(() => expect(mocks.dashboard.getBreakEven.mock.lastCall[0]).toEqual({ month: "2026-09" }));
    expect(mocks.dashboard.getSummary).toHaveBeenCalledTimes(1);
  });
  it("T12 revenue failure leaves Metro intact; retry is source-owned", async () => {
    mocks.dashboard.getRevenueDaily.mockRejectedValueOnce(new Error("Revenue source failure"));
    mount();
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Revenue source failure");
    expect(metric("Ga có dữ liệu")).toHaveTextContent("2");
    fireEvent.click(within(alert).getByRole("button", { name: "Thử lại" }));
    await waitFor(() => expect(mocks.dashboard.getRevenueDaily).toHaveBeenCalledTimes(2));
    expect(mocks.stations.getStations).toHaveBeenCalledTimes(1);
  });
  it("T13 station failure never becomes zero or healthy Metro", async () => {
    mocks.stations.getStations.mockRejectedValue(new Error("Coverage failure"));
    mount(); await ready();
    expect(metric("Ga có dữ liệu")).toHaveTextContent("—");
    expect(metric("Địa điểm quanh ga")).not.toHaveTextContent("0");
    expect(screen.queryByText("Tất cả ga đã đủ dữ liệu.")).not.toBeInTheDocument();
    expect(screen.getAllByRole("alert").some((el) => el.textContent.includes("Coverage failure"))).toBe(true);
  });
  it("T14 loading ownership is independent and summary numbers stay absent", async () => {
    mocks.dashboard.getSummary.mockReturnValue(new Promise(() => {}));
    mount(); await screen.findByText(station.name);
    expect(within(metric("Doanh thu")).getByRole("status")).toHaveTextContent("Đang tải doanh thu");
    expect(metric("Ga có dữ liệu")).toHaveTextContent("2");
    expect(screen.getByRole("button", { name: "Tải lại" })).toBeDisabled();
  });
  it("T15 empty revenue/finalized datasets produce honest separate states", async () => {
    mocks.dashboard.getRevenueDaily.mockResolvedValue({ days: [], totalRevenue: 0 });
    mocks.dashboard.getTripsFinalizedDaily.mockResolvedValue({ days: [], totalTripsFinalized: 0 });
    mount(); await ready();
    expect(screen.getByText("Chưa có đơn thanh toán trong khoảng này.")).toBeInTheDocument();
    expect(screen.getByText("Chưa có lịch trình nào được chốt trong khoảng này.")).toBeInTheDocument();
    expect(screen.queryByRole("img", { name: /Doanh thu theo ngày/ })).not.toBeInTheDocument();
  });
  it("T16 paged pending is secondary and scope-safe, no invented global total", async () => {
    mount(); await ready();
    expect(screen.getByText("Trong trang địa điểm được API trả về, không phải tổng toàn hệ thống.")).toBeInTheDocument();
    expect(screen.queryByRole("article", { name: "Chờ duyệt" })).not.toBeInTheDocument();
    const block = screen.getByText("Chờ duyệt trong trang").closest("dl");
    expect(block).toHaveTextContent("1");
    expect(block).not.toHaveTextContent("900");
    expect(mocks.places.getPlaces).toHaveBeenCalledWith();
  });
  it("T17-18 break-even displays server money/projection, no invented trend", async () => {
    mount(); await ready();
    expect(screen.getByText(vndFormatter.format(breakEven.projected).replace(/\s/g, " "))).toBeInTheDocument();
    expect(screen.getByText(`Còn thiếu ${vndFormatter.format(breakEven.remaining).replace(/\s/g, " ")}`)).toBeInTheDocument();
    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "11");
    expect(screen.queryByText(/so với tháng trước/)).not.toBeInTheDocument();
  });
  it("T19 charts expose PaidAt/FinalizedAt distinction and accessible daily tables", async () => {
    mount(); await ready();
    expect(screen.getByText(/Tính theo ngày thanh toán, chưa trừ phí PayOS/)).toBeInTheDocument();
    expect(screen.getByText(/gồm cả lịch trình bị xoá sau khi chốt/)).toBeInTheDocument();
    const disclosures = screen.getAllByText("Dữ liệu theo ngày");
    expect(disclosures).toHaveLength(2);
    fireEvent.click(disclosures[0]);
    expect(disclosures[0].closest("details").open).toBe(true);
    const table = screen.getByRole("table", { name: /Doanh thu theo ngày thanh toán/ });
    expect(table.textContent).toContain(vndFormatter.format(200000));
    expect(table).toHaveTextContent("06/10");
    expect(screen.getByRole("img", { name: /Lịch trình đã chốt theo ngày/ })).toBeInTheDocument();
  });
  it("T20 permission-filtered quick links retain exact destinations and unique Places action", async () => {
    mount(["ManagePlaces"]); await screen.findByText(station.name);
    const nav = screen.getByRole("navigation", { name: "Truy cập nhanh" });
    expect(within(nav).getByRole("link", { name: "Địa điểm & Tiện ích" })).toHaveAttribute("href", "/admin/places");
    expect(within(nav).getByRole("link", { name: "Nhập dữ liệu Excel" })).toHaveAttribute("href", "/admin/import");
    expect(within(nav).queryByRole("link", { name: /Giao dịch/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Thêm địa điểm" })).toHaveAttribute("href", "/admin/places");
  });
  it("T21 bounded chart bars and internal disclosure scroll, no fixed minimum page width", async () => {
    const { container } = mount(); await ready();
    expect(container.querySelector('[style*="min-width"]')).toBeNull();
    for (const chart of screen.getAllByRole("img")) {
      expect(chart.children).toHaveLength(2);
      for (const bar of chart.children) expect(parseFloat(bar.style.height)).toBeLessThanOrEqual(100);
    }
    expect(container.querySelector('details [role="region"]')).toHaveAttribute("tabindex", "0");
  });
  it("404 unavailable is distinct from generic failure and empty dataset", async () => {
    mocks.dashboard.getRevenueDaily.mockRejectedValue({ status: 404, message: "Not found" });
    mount(); await ready();
    expect(screen.getByRole("heading", { name: "Chờ API thống kê" })).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.queryByText("Chưa có đơn thanh toán trong khoảng này.")).not.toBeInTheDocument();
  });
  it("400 backend field errors remain connected to date inputs", async () => {
    mocks.dashboard.getSummary.mockRejectedValue({ status: 400, code: "invalid_dashboard_query", errors: { From: ["From phải trước hoặc bằng To."] } });
    mount(); await screen.findAllByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "Tùy chọn" }));
    expect(screen.getByLabelText("Từ ngày")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("Từ ngày")).toHaveAccessibleDescription("Ngày bắt đầu phải trước hoặc bằng ngày kết thúc.");
  });
  it("business refresh retries all five sources, not Metro; cache statement remains", async () => {
    mount(); await ready();
    await waitFor(() => expect(screen.getByRole("button", { name: "Tải lại" })).toBeEnabled());
    fireEvent.click(screen.getByRole("button", { name: "Tải lại" }));
    await waitFor(() => { for (const fn of Object.values(mocks.dashboard)) expect(fn).toHaveBeenCalledTimes(2); });
    expect(mocks.stations.getStations).toHaveBeenCalledTimes(1);
    expect(mocks.places.getPlaces).toHaveBeenCalledTimes(1);
    expect(screen.getByText(/làm mới sau mỗi 5 phút/)).toBeInTheDocument();
  });
});
