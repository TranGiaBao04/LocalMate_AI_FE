import { apiClient } from "../api/apiClient";

/**
 * Service kết nối trực tiếp với backend AI Matching & Heuristic Fallback Engine (BE-31 -> BE-38)
 */
export const matcherService = {
  /**
   * Gọi API Match địa điểm theo vĩ độ/kinh độ, ngân sách, thời gian & sở thích (BE-31 -> BE-33)
   * @param {Object} request Form input từ người dùng
   */
  matchTrip: async (request) => {
    const payload = {
      originLatitude: Number(request.startLat ?? request.originLatitude ?? 10.7769),
      originLongitude: Number(request.startLng ?? request.originLongitude ?? 106.7009),
      durationHours: Number(request.durationHours ?? 4),
      budgetMax: Number(request.budgetPerPerson ?? request.budgetMax ?? 300000),
      preferredTags: Array.isArray(request.interests)
        ? request.interests
        : Array.isArray(request.preferredTags)
        ? request.preferredTags
        : ["cafe", "check-in"],
      metroStationWindow: Number(request.metroStationWindow ?? 1),
    };

    return apiClient.post("/trips/match", payload);
  },

  /**
   * Gọi Heuristic Fallback Engine khi AI LLM bị timeout hoặc lỗi (BE-38)
   * @param {Object} request Form input từ người dùng
   * @param {string} reason Lý do fallback: "llm_timeout" | "llm_error" | "heuristic"
   */
  fallbackItinerary: async (request, reason = "heuristic") => {
    const payload = {
      originLatitude: Number(request.startLat ?? request.originLatitude ?? 10.7769),
      originLongitude: Number(request.startLng ?? request.originLongitude ?? 106.7009),
      durationHours: Number(request.durationHours ?? 4),
      budgetMax: Number(request.budgetPerPerson ?? request.budgetMax ?? 300000),
      preferredTags: Array.isArray(request.interests)
        ? request.interests
        : Array.isArray(request.preferredTags)
        ? request.preferredTags
        : ["cafe", "check-in"],
      metroStationWindow: Number(request.metroStationWindow ?? 1),
    };

    return apiClient.post(`/trips/fallback-itinerary?reason=${encodeURIComponent(reason)}`, payload);
  },
};
