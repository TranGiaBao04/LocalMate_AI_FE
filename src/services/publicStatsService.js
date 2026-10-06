import { apiClient } from "../api/apiClient";

export const publicStatsService = {
  // Số liệu công khai cho trang đích → { tripsFinalized, generatedAt }. BE cache 10 phút.
  getPublicStats: () => apiClient.get("/public/stats", { auth: false }),
};
