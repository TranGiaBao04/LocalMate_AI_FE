import { apiClient } from "../api/apiClient";
import { mapTrip } from "../utils/tripMapper";

export const itineraryService = {
  // Lịch trình mẫu, công khai.
  // [{ id, title, description, coverImageUrl, estimatedDurationMinutes, estimatedCostMin, estimatedCostMax,
  //    items: [{ placeId, placeName, orderIndex }], stationName }]
  getCuratedItineraries: () => apiClient.get("/itineraries/curated", { auth: false }),

  // Áp dụng lịch mẫu thành trip nháp (cần tài khoản thật, demo bị 403).
  // Thời gian của trip sau khi áp dụng có thể khác estimatedDurationMinutes.
  applyCuratedItinerary: async (curatedId, { plannedDate, startTime, travelMode } = {}) =>
    mapTrip(
      await apiClient.post(`/itineraries/curated/${curatedId}/apply`, {
        ...(plannedDate && { plannedDate }),
        startTime: `${startTime}:00`,
        ...(travelMode && { travelMode }),
      }),
    ),
};
