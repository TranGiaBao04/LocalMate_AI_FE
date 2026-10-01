import { adminApiClient } from "../api/adminApiClient";

const toQuery = (params) => new URLSearchParams(params).toString();

// Hợp đồng đề xuất cho BE-86/87/88. from/to: "yyyy-MM-dd" theo giờ VN, gồm cả 2 đầu. Tiền: VNĐ.
export const adminDashboardService = {
  // BE-86 → { from, to, newUsers, generatedItineraries, paidItineraries, revenue }
  getSummary: ({ from, to }) =>
    adminApiClient.get(`/admin/dashboard/summary?${toQuery({ from, to })}`),
  // BE-87 → [{ date: "yyyy-MM-dd", revenue, paidOrders }], đủ mọi ngày trong khoảng
  getRevenueDaily: ({ from, to }) =>
    adminApiClient.get(`/admin/dashboard/revenue-daily?${toQuery({ from, to })}`),
  // BE-88 → [{ stationId, stationName, stationOrder, tripCount }], giảm dần theo tripCount
  getTopStations: ({ from, to, limit = 5 }) =>
    adminApiClient.get(`/admin/dashboard/top-stations?${toQuery({ from, to, limit })}`),
};
