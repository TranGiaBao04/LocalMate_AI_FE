import { adminApiClient } from "../api/adminApiClient";

// Bỏ tham số rỗng để BE dùng mặc định (from/to: 30 ngày gần nhất, month: tháng hiện tại)
const toQuery = (params) =>
  new URLSearchParams(
    Object.entries(params).filter(([, value]) => value != null && value !== ""),
  ).toString();

// BE F2 Dashboard, cần quyền ViewRevenue. from/to "yyyy-MM-dd" giờ VN, gồm cả 2 đầu; month "yyyy-MM".
// Tiền là VNĐ đầy đủ. BE cache 5 phút, `generatedAt` là giờ UTC.
export const adminDashboardService = {
  // → { from, to, newUsers, tripsCreated, paidOrders, revenue, currency, generatedAt }
  getSummary: ({ from, to }) =>
    adminApiClient.get(`/admin/dashboard/summary?${toQuery({ from, to })}`),
  // → { from, to, currency, totalRevenue, days: [{ date, revenue, paidOrders }], generatedAt }, đủ mọi ngày
  getRevenueDaily: ({ from, to }) =>
    adminApiClient.get(`/admin/dashboard/revenue-daily?${toQuery({ from, to })}`),
  // → { from, to, totalTripsFinalized, days: [{ date, tripsFinalized }], generatedAt }, đủ mọi ngày.
  // Khác summary.tripsCreated (đếm mọi lịch trình theo ngày tạo).
  getTripsFinalizedDaily: ({ from, to }) =>
    adminApiClient.get(`/admin/dashboard/trips-finalized-daily?${toQuery({ from, to })}`),
  // → { from, to, totalTrips, stations: [{ order, name, tripCount, sharePercent }], generatedAt }
  getTopStations: ({ from, to, limit }) =>
    adminApiClient.get(`/admin/dashboard/top-stations?${toQuery({ from, to, limit })}`),
  // → { month, target, revenue, paidOrders, remaining, progressPercent, daysElapsed, daysInMonth,
  //     projected, isAchieved, currency, generatedAt }
  getBreakEven: ({ month }) =>
    adminApiClient.get(`/admin/dashboard/break-even?${toQuery({ month })}`),
};
