import { apiClient } from "../api/apiClient";
import { mapMyTrip, mapTrip } from "../utils/tripMapper";

// Request wizard -> TripRequestDto của BE. budgetMax là ngân sách MỘT NGƯỜI (VNĐ), không nhân số người.
// budgetMin BE chưa dùng nên gửi 0. BE không nhận peopleCount/timeOfDay.
export function toTripRequestDto({
  startLatitude,
  startLongitude,
  durationHours,
  budgetMaxPerPerson,
  tagIds,
  travelMode,
  plannedDate,
  startTime,
}) {
  return {
    startLatitude,
    startLongitude,
    durationHours,
    budgetMin: 0,
    budgetMax: budgetMaxPerPerson,
    tagIds,
    // "yyyy-MM-dd" giờ VN, bỏ trống = hôm nay
    ...(plannedDate && { plannedDate }),
    // "HH:mm" giờ VN, luôn gửi (bỏ trống BE dùng 08:00, lịch có thể bắt đầu ở quá khứ)
    startTime: `${startTime}:00`,
    // "Auto" (mặc định BE) | "Walking" | "Motorbike"
    ...(travelMode && { travelMode }),
  };
}

const getTripById = async (tripId) =>
  mapTrip(await apiClient.get(`/trips/${tripId}`));

export const tripService = {
  // { isFeasible, reason, nearestStation, durationCategory, budgetTier, estimatedStopCount, candidatePlaceCount }
  checkFeasibility: (dto) =>
    apiClient.post("/trips/feasibility-check", dto, { auth: false }),

  // 201 TripDetailResponse: trip nháp đã lưu (có id)
  generateTrip: async (dto) =>
    mapTrip(await apiClient.post("/trips/generate", dto)),

  getTrips: async () =>
    (await apiClient.get("/trips/my-trips")).map(mapMyTrip),
  getTripById,

  // save/finalize chỉ trả { tripId, status } nên gọi lại GET để lấy trip đầy đủ
  saveTrip: async (tripId) => {
    await apiClient.post("/trips/save", { tripId });
    return getTripById(tripId);
  },
  finalizeTrip: async (tripId) => {
    await apiClient.post(`/trips/${tripId}/finalize`);
    return getTripById(tripId);
  },
  deleteTrip: (tripId) => apiClient.delete(`/trips/${tripId}`),

  getItemAlternatives: (tripId, itemId, limit) =>
    apiClient.get(
      `/trips/${tripId}/items/${itemId}/alternatives${limit ? `?limit=${limit}` : ""}`,
    ),
  // Trả { warnings, place, ... }, giữ nguyên để hiển thị cảnh báo
  replaceItem: (tripId, itemId, newPlaceId) =>
    apiClient.put(`/trips/${tripId}/items/${itemId}/replace`, { newPlaceId }),
  deleteItem: (tripId, itemId) =>
    apiClient.delete(`/trips/${tripId}/items/${itemId}`),

  // BE không cần tripId ở path
  markVisited: (itemId) => apiClient.put(`/trips/items/${itemId}/visit`),
};
